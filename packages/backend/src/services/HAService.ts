// @ts-nocheck
/**
 * High Availability Service
 *
 * Enterprise feature for multi-main deployment:
 * - Leader election using Redis
 * - Instance health monitoring
 * - Automatic failover
 * - Distributed locking
 * - Work distribution
 */

import IORedis from 'ioredis';
type RedisClient = IORedis;
import crypto from 'crypto';
import os from 'os';
import { logger } from '../lib/logger.js';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface HAConfig {
  enabled: boolean;
  instanceId?: string;
  leaderKey: string;
  leaderTtlMs: number;
  heartbeatIntervalMs: number;
  electionTimeoutMs: number;
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
}

export interface InstanceInfo {
  id: string;
  hostname: string;
  pid: number;
  startedAt: Date;
  lastHeartbeat: Date;
  isLeader: boolean;
  version: string;
  metadata?: Record<string, unknown>;
}

export interface LeaderInfo {
  instanceId: string;
  hostname: string;
  electedAt: Date;
  term: number;
}

export interface DistributedLock {
  key: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
  token: string;
}

type HAEvent =
  | 'leader-elected'
  | 'leader-lost'
  | 'instance-joined'
  | 'instance-left'
  | 'quorum-lost'
  | 'quorum-restored';

// ============================================================================
// HA SERVICE
// ============================================================================

class HAService extends EventEmitter {
  private config: HAConfig | null = null;
  private redis: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private instanceId: string = '';
  private isLeader: boolean = false;
  private currentLeader: LeaderInfo | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private electionTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private term: number = 0;

  constructor() {
    super();
    this.instanceId = this.generateInstanceId();
  }

  /**
   * Initialize HA service
   */
  async initialize(config: HAConfig): Promise<void> {
    if (!config.enabled) {
      logger.info('HA service disabled');
      return;
    }

    this.config = {
      leaderKey: 'agentsmith:leader',
      leaderTtlMs: 30000,
      heartbeatIntervalMs: 10000,
      electionTimeoutMs: 5000,
      ...config,
    };

    if (config.instanceId) {
      this.instanceId = config.instanceId;
    }

    try {
      // Create Redis connections
      const redisOptions = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db || 0,
        keyPrefix: config.redis.keyPrefix || 'agentsmith:ha:',
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      };

      this.redis = new IORedis(redisOptions);
      this.subscriber = new IORedis(redisOptions);

      // Subscribe to HA events
      await this.setupSubscriptions();

      // Register this instance
      await this.registerInstance();

      // Start leader election
      await this.startElection();

      // Start heartbeat
      this.startHeartbeat();

      this.isInitialized = true;
      logger.info('HA service initialized', {
        instanceId: this.instanceId,
        hostname: os.hostname(),
      });
    } catch (error) {
      logger.error('Failed to initialize HA service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if this instance is the leader
   */
  isCurrentLeader(): boolean {
    return this.isLeader;
  }

  /**
   * Get current leader info
   */
  getCurrentLeader(): LeaderInfo | null {
    return this.currentLeader;
  }

  /**
   * Get this instance's ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Get all active instances
   */
  async getInstances(): Promise<InstanceInfo[]> {
    if (!this.redis) return [];

    const keys = await this.redis.keys('instance:*');
    const instances: InstanceInfo[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        instances.push(JSON.parse(data));
      }
    }

    return instances;
  }

  /**
   * Step down as leader
   */
  async stepDown(): Promise<void> {
    if (!this.isLeader || !this.redis || !this.config) return;

    try {
      await this.redis.del(this.config.leaderKey);
      this.isLeader = false;
      this.emit('leader-lost', { instanceId: this.instanceId });

      logger.info('Stepped down as leader', { instanceId: this.instanceId });

      // Trigger new election
      await this.publishEvent('election-requested', { term: this.term + 1 });
    } catch (error) {
      logger.error('Failed to step down', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================================================
  // DISTRIBUTED LOCKING
  // ============================================================================

  /**
   * Acquire a distributed lock
   */
  async acquireLock(
    key: string,
    ttlMs: number = 30000,
    retryCount: number = 3,
    retryDelayMs: number = 100
  ): Promise<DistributedLock | null> {
    if (!this.redis) return null;

    const token = crypto.randomUUID();
    const lockKey = `lock:${key}`;

    for (let i = 0; i < retryCount; i++) {
      // Try to acquire lock using SET NX EX
      const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');

      if (result === 'OK') {
        const now = new Date();
        const lock: DistributedLock = {
          key,
          owner: this.instanceId,
          acquiredAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
          token,
        };

        logger.debug('Lock acquired', { key, token: token.substring(0, 8) });
        return lock;
      }

      // Wait before retry
      if (i < retryCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    logger.debug('Failed to acquire lock', { key, retries: retryCount });
    return null;
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lock: DistributedLock): Promise<boolean> {
    if (!this.redis) return false;

    const lockKey = `lock:${lock.key}`;

    // Use Lua script to ensure we only delete our own lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lock.token);

    if (result === 1) {
      logger.debug('Lock released', { key: lock.key });
      return true;
    }

    logger.debug('Failed to release lock (not owner)', { key: lock.key });
    return false;
  }

  /**
   * Extend lock TTL
   */
  async extendLock(lock: DistributedLock, ttlMs: number): Promise<boolean> {
    if (!this.redis) return false;

    const lockKey = `lock:${lock.key}`;

    // Use Lua script to extend only if we own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lock.token, ttlMs);

    if (result === 1) {
      lock.expiresAt = new Date(Date.now() + ttlMs);
      return true;
    }

    return false;
  }

  /**
   * Execute with lock (auto acquire/release)
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = 30000
  ): Promise<T | null> {
    const lock = await this.acquireLock(key, ttlMs);
    if (!lock) return null;

    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  // ============================================================================
  // WORK DISTRIBUTION
  // ============================================================================

  /**
   * Claim work item (only one instance processes it)
   */
  async claimWork(workId: string, ttlMs: number = 60000): Promise<boolean> {
    if (!this.redis) return false;

    const key = `work:${workId}`;
    const result = await this.redis.set(key, this.instanceId, 'PX', ttlMs, 'NX');

    return result === 'OK';
  }

  /**
   * Release work item
   */
  async releaseWork(workId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `work:${workId}`;

    // Only release if we own it
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, this.instanceId);
    return result === 1;
  }

  /**
   * Get work owner
   */
  async getWorkOwner(workId: string): Promise<string | null> {
    if (!this.redis) return null;

    const key = `work:${workId}`;
    return this.redis.get(key);
  }

  // ============================================================================
  // LEADER ELECTION
  // ============================================================================

  private async startElection(): Promise<void> {
    if (!this.redis || !this.config) return;

    // Check if there's an existing leader
    const existingLeader = await this.redis.get(this.config.leaderKey);

    if (existingLeader) {
      const leaderInfo = JSON.parse(existingLeader) as LeaderInfo;
      this.currentLeader = leaderInfo;
      this.isLeader = leaderInfo.instanceId === this.instanceId;

      if (this.isLeader) {
        logger.info('Resumed as leader', { instanceId: this.instanceId });
      }
      return;
    }

    // Try to become leader
    await this.attemptElection();
  }

  private async attemptElection(): Promise<void> {
    if (!this.redis || !this.config) return;

    this.term++;

    const leaderInfo: LeaderInfo = {
      instanceId: this.instanceId,
      hostname: os.hostname(),
      electedAt: new Date(),
      term: this.term,
    };

    // Try to set leader key with NX (only if not exists)
    const result = await this.redis.set(
      this.config.leaderKey,
      JSON.stringify(leaderInfo),
      'PX',
      this.config.leaderTtlMs,
      'NX'
    );

    if (result === 'OK') {
      this.isLeader = true;
      this.currentLeader = leaderInfo;

      logger.info('Elected as leader', {
        instanceId: this.instanceId,
        term: this.term,
      });

      this.emit('leader-elected', { instanceId: this.instanceId, term: this.term });
      await this.publishEvent('leader-elected', leaderInfo);
    } else {
      // Someone else is leader, fetch their info
      const leaderData = await this.redis.get(this.config.leaderKey);
      if (leaderData) {
        this.currentLeader = JSON.parse(leaderData);
        this.term = this.currentLeader.term;
      }
    }
  }

  private async refreshLeadership(): Promise<void> {
    if (!this.redis || !this.config || !this.isLeader) return;

    try {
      // Extend leader TTL
      const result = await this.redis.pexpire(
        this.config.leaderKey,
        this.config.leaderTtlMs
      );

      if (result === 0) {
        // Key doesn't exist, we lost leadership
        this.isLeader = false;
        this.emit('leader-lost', { instanceId: this.instanceId });
        logger.warn('Lost leadership (key expired)', { instanceId: this.instanceId });

        // Try to re-elect
        await this.attemptElection();
      }
    } catch (error) {
      logger.error('Failed to refresh leadership', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================================================
  // HEARTBEAT & REGISTRATION
  // ============================================================================

  private async registerInstance(): Promise<void> {
    if (!this.redis) return;

    const instanceInfo: InstanceInfo = {
      id: this.instanceId,
      hostname: os.hostname(),
      pid: process.pid,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      isLeader: this.isLeader,
      version: process.env.npm_package_version || '1.0.0',
    };

    await this.redis.set(
      `instance:${this.instanceId}`,
      JSON.stringify(instanceInfo),
      'EX',
      60 // 60 second expiry
    );

    await this.publishEvent('instance-joined', instanceInfo);
    logger.debug('Instance registered', { instanceId: this.instanceId });
  }

  private startHeartbeat(): void {
    if (!this.config) return;

    this.heartbeatTimer = setInterval(async () => {
      try {
        // Update instance info
        await this.registerInstance();

        // Refresh leadership if we're the leader
        if (this.isLeader) {
          await this.refreshLeadership();
        } else {
          // Check if leader is still alive
          await this.checkLeaderHealth();
        }
      } catch (error) {
        logger.error('Heartbeat error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, this.config.heartbeatIntervalMs);
  }

  private async checkLeaderHealth(): Promise<void> {
    if (!this.redis || !this.config) return;

    const leaderData = await this.redis.get(this.config.leaderKey);

    if (!leaderData) {
      // Leader is gone, start election
      logger.info('Leader lost, starting election', { previousLeader: this.currentLeader?.instanceId });
      await this.attemptElection();
    }
  }

  // ============================================================================
  // PUBSUB
  // ============================================================================

  private async setupSubscriptions(): Promise<void> {
    if (!this.subscriber) return;

    const channel = 'agentsmith:ha:events';

    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (ch, message) => {
      if (ch !== channel) return;

      try {
        const event = JSON.parse(message);
        this.handleEvent(event);
      } catch (error) {
        logger.error('Failed to parse HA event', { message });
      }
    });
  }

  private async publishEvent(type: string, data: any): Promise<void> {
    if (!this.redis) return;

    const event = {
      type,
      data,
      source: this.instanceId,
      timestamp: new Date().toISOString(),
    };

    await this.redis.publish('agentsmith:ha:events', JSON.stringify(event));
  }

  private handleEvent(event: { type: string; data: any; source: string }): void {
    // Ignore our own events
    if (event.source === this.instanceId) return;

    switch (event.type) {
      case 'leader-elected':
        this.currentLeader = event.data;
        this.isLeader = false;
        logger.info('New leader elected', { leader: event.data.instanceId });
        break;

      case 'instance-joined':
        this.emit('instance-joined', event.data);
        logger.debug('Instance joined', { instanceId: event.data.id });
        break;

      case 'instance-left':
        this.emit('instance-left', event.data);
        logger.debug('Instance left', { instanceId: event.data.id });
        break;

      case 'election-requested':
        if (event.data.term > this.term) {
          this.term = event.data.term;
          this.attemptElection();
        }
        break;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private generateInstanceId(): string {
    const hostname = os.hostname();
    const pid = process.pid;
    const random = crypto.randomBytes(4).toString('hex');
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * Shutdown HA service
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }

    // Publish leave event
    if (this.redis) {
      await this.publishEvent('instance-left', { id: this.instanceId });

      // Remove instance registration
      await this.redis.del(`instance:${this.instanceId}`);

      // Step down if leader
      if (this.isLeader && this.config) {
        await this.redis.del(this.config.leaderKey);
      }
    }

    // Close connections
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    this.isInitialized = false;
    logger.info('HA service shut down', { instanceId: this.instanceId });
  }
}

// Export singleton instance
export const haService = new HAService();
