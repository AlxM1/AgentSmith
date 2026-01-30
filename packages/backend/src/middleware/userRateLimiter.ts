// @ts-nocheck
// Per-User Rate Limiting Middleware
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, IRateLimiterOptions } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

interface RateLimitConfig {
  points: number;      // Number of requests
  duration: number;    // Per X seconds
  blockDuration?: number; // Block for X seconds when limit exceeded
}

// Default rate limits by endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication endpoints (strict)
  auth: {
    points: 10,
    duration: 900, // 15 minutes
    blockDuration: 900
  },
  // Workflow executions (moderate)
  execution: {
    points: 50,
    duration: 60,
    blockDuration: 60
  },
  // API read operations (lenient)
  read: {
    points: 200,
    duration: 60
  },
  // API write operations (moderate)
  write: {
    points: 100,
    duration: 60
  },
  // Admin operations (moderate)
  admin: {
    points: 100,
    duration: 60
  },
  // Webhook ingestion (lenient)
  webhook: {
    points: 500,
    duration: 60
  }
};

class UserRateLimiter {
  private limiters: Map<string, RateLimiterRedis | RateLimiterMemory> = new Map();
  private redis: Redis | null = null;
  private useRedis: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    try {
      this.redis = new Redis({
        host: config.redis?.host || 'localhost',
        port: config.redis?.port || 6379,
        password: config.redis?.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('connect', () => {
        this.useRedis = true;
        logger.info('Rate limiter connected to Redis');
      });

      this.redis.on('error', (err) => {
        logger.warn('Rate limiter Redis error, falling back to memory:', err.message);
        this.useRedis = false;
      });

      // Try to connect
      this.redis.connect().catch(() => {
        this.useRedis = false;
      });
    } catch (error) {
      logger.warn('Rate limiter using memory store (Redis not available)');
      this.useRedis = false;
    }
  }

  private getLimiter(type: string): RateLimiterRedis | RateLimiterMemory {
    if (this.limiters.has(type)) {
      return this.limiters.get(type)!;
    }

    const config = RATE_LIMITS[type] || RATE_LIMITS.read;
    const opts: IRateLimiterOptions = {
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration || 0,
      keyPrefix: `rl:${type}`
    };

    let limiter: RateLimiterRedis | RateLimiterMemory;

    if (this.useRedis && this.redis) {
      limiter = new RateLimiterRedis({
        ...opts,
        storeClient: this.redis
      });
    } else {
      limiter = new RateLimiterMemory(opts);
    }

    this.limiters.set(type, limiter);
    return limiter;
  }

  /**
   * Create rate limit middleware for a specific type
   */
  middleware(type: keyof typeof RATE_LIMITS) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const limiter = this.getLimiter(type);

      // Use user ID if authenticated, otherwise use IP
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      const key = userId || req.ip || 'anonymous';

      try {
        const result = await limiter.consume(key);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': String(RATE_LIMITS[type].points),
          'X-RateLimit-Remaining': String(result.remainingPoints),
          'X-RateLimit-Reset': String(Math.ceil(result.msBeforeNext / 1000))
        });

        next();
      } catch (rateLimiterRes) {
        const retryAfter = Math.ceil((rateLimiterRes as { msBeforeNext: number }).msBeforeNext / 1000);

        res.set({
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMITS[type].points),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(retryAfter)
        });

        logger.warn(`Rate limit exceeded for ${type}`, { key, retryAfter });

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter
        });
      }
    };
  }

  /**
   * Check rate limit without consuming a point (for checking availability)
   */
  async check(type: keyof typeof RATE_LIMITS, key: string): Promise<{ allowed: boolean; remaining: number }> {
    const limiter = this.getLimiter(type);

    try {
      const result = await limiter.get(key);
      if (!result) {
        return { allowed: true, remaining: RATE_LIMITS[type].points };
      }
      return {
        allowed: result.remainingPoints > 0,
        remaining: result.remainingPoints
      };
    } catch {
      return { allowed: true, remaining: RATE_LIMITS[type].points };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(type: keyof typeof RATE_LIMITS, key: string): Promise<void> {
    const limiter = this.getLimiter(type);
    await limiter.delete(key);
  }

  /**
   * Get current usage for a key
   */
  async getUsage(type: keyof typeof RATE_LIMITS, key: string): Promise<{
    consumed: number;
    remaining: number;
    resetIn: number;
  }> {
    const limiter = this.getLimiter(type);
    const config = RATE_LIMITS[type];

    try {
      const result = await limiter.get(key);
      if (!result) {
        return {
          consumed: 0,
          remaining: config.points,
          resetIn: 0
        };
      }
      return {
        consumed: config.points - result.remainingPoints,
        remaining: result.remainingPoints,
        resetIn: Math.ceil(result.msBeforeNext / 1000)
      };
    } catch {
      return {
        consumed: 0,
        remaining: config.points,
        resetIn: 0
      };
    }
  }
}

export const userRateLimiter = new UserRateLimiter();

// Export middleware functions for common use cases
export const authRateLimit = userRateLimiter.middleware('auth');
export const executionRateLimit = userRateLimiter.middleware('execution');
export const readRateLimit = userRateLimiter.middleware('read');
export const writeRateLimit = userRateLimiter.middleware('write');
export const adminRateLimit = userRateLimiter.middleware('admin');
export const webhookRateLimit = userRateLimiter.middleware('webhook');
