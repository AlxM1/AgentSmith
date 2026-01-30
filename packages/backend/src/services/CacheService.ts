/**
 * Cache Service with Redis
 * Provides caching with TTL, tags, and invalidation strategies
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number;           // Time to live in seconds
  tags?: string[];        // Tags for grouped invalidation
  compress?: boolean;     // Compress large values
  namespace?: string;     // Key namespace
}

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt?: number;
  tags?: string[];
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(keys: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mget(keys: string[]): Promise<(string | null)[]>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  scan(cursor: number, options?: { MATCH?: string; COUNT?: number }): Promise<{ cursor: number; keys: string[] }>;
  sadd(key: string, members: string | string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, members: string | string[]): Promise<number>;
  info(section?: string): Promise<string>;
};

class CacheService extends EventEmitter {
  private redis: RedisClient | null = null;
  private localCache: Map<string, CacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private defaultTTL = 3600; // 1 hour
  private maxLocalCacheSize = 1000;
  private namespace = 'cache';

  constructor(options?: { namespace?: string; defaultTTL?: number; maxLocalCacheSize?: number }) {
    super();
    if (options?.namespace) this.namespace = options.namespace;
    if (options?.defaultTTL) this.defaultTTL = options.defaultTTL;
    if (options?.maxLocalCacheSize) this.maxLocalCacheSize = options.maxLocalCacheSize;
  }

  /**
   * Initialize with Redis client
   */
  setRedisClient(client: RedisClient): void {
    this.redis = client;
    console.log('Cache service connected to Redis');
  }

  /**
   * Generate cache key with namespace
   */
  private makeKey(key: string, options?: CacheOptions): string {
    const ns = options?.namespace || this.namespace;
    return `${ns}:${key}`;
  }

  /**
   * Generate hash for complex keys
   */
  private hashKey(obj: any): string {
    const str = JSON.stringify(obj);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const cacheKey = this.makeKey(key, options);

    // Try Redis first
    if (this.redis) {
      try {
        const data = await this.redis.get(cacheKey);
        if (data) {
          this.stats.hits++;
          this.emit('cache:hit', { key: cacheKey });
          return JSON.parse(data) as T;
        }
      } catch (error) {
        console.error('Redis get error:', error);
        // Fall through to local cache
      }
    }

    // Fall back to local cache
    const entry = this.localCache.get(cacheKey);
    if (entry) {
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.localCache.delete(cacheKey);
        this.stats.misses++;
        this.emit('cache:miss', { key: cacheKey });
        return null;
      }
      entry.hits++;
      this.stats.hits++;
      this.emit('cache:hit', { key: cacheKey, source: 'local' });
      return entry.value as T;
    }

    this.stats.misses++;
    this.emit('cache:miss', { key: cacheKey });
    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const cacheKey = this.makeKey(key, options);
    const ttl = options?.ttl ?? this.defaultTTL;
    const tags = options?.tags || [];

    // Store in Redis
    if (this.redis) {
      try {
        const serialized = JSON.stringify(value);
        if (ttl > 0) {
          await this.redis.set(cacheKey, serialized, { EX: ttl });
        } else {
          await this.redis.set(cacheKey, serialized);
        }

        // Store tag associations
        for (const tag of tags) {
          const tagKey = `${this.namespace}:tag:${tag}`;
          await this.redis.sadd(tagKey, cacheKey);
        }

        this.emit('cache:set', { key: cacheKey, ttl, tags });
      } catch (error) {
        console.error('Redis set error:', error);
        // Fall through to local cache
      }
    }

    // Also store in local cache
    this.setLocal(cacheKey, value, ttl, tags);
  }

  /**
   * Set in local cache
   */
  private setLocal<T>(key: string, value: T, ttl: number, tags: string[]): void {
    // Evict if at capacity
    if (this.localCache.size >= this.maxLocalCacheSize) {
      this.evictLocal();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : undefined,
      tags,
      hits: 0,
    };

    this.localCache.set(key, entry);

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Evict least recently used entries from local cache
   */
  private evictLocal(): void {
    // Find entries with lowest hit count
    let minHits = Infinity;
    let evictKey: string | null = null;

    for (const [key, entry] of this.localCache) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        evictKey = key;
      }
    }

    if (evictKey) {
      this.localCache.delete(evictKey);
      this.emit('cache:evict', { key: evictKey, reason: 'capacity' });
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    const cacheKey = this.makeKey(key, options);

    let deleted = false;

    // Delete from Redis
    if (this.redis) {
      try {
        const count = await this.redis.del(cacheKey);
        deleted = count > 0;
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }

    // Delete from local cache
    if (this.localCache.has(cacheKey)) {
      const entry = this.localCache.get(cacheKey);
      this.localCache.delete(cacheKey);

      // Update tag index
      if (entry?.tags) {
        for (const tag of entry.tags) {
          this.tagIndex.get(tag)?.delete(cacheKey);
        }
      }

      deleted = true;
    }

    if (deleted) {
      this.emit('cache:delete', { key: cacheKey });
    }

    return deleted;
  }

  /**
   * Invalidate all entries with a specific tag
   */
  async invalidateTag(tag: string): Promise<number> {
    let count = 0;

    // Invalidate in Redis
    if (this.redis) {
      try {
        const tagKey = `${this.namespace}:tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);

        if (keys.length > 0) {
          count = await this.redis.del(keys);
          await this.redis.del(tagKey);
        }
      } catch (error) {
        console.error('Redis invalidateTag error:', error);
      }
    }

    // Invalidate in local cache
    const localKeys = this.tagIndex.get(tag);
    if (localKeys) {
      for (const key of localKeys) {
        this.localCache.delete(key);
        count++;
      }
      this.tagIndex.delete(tag);
    }

    this.emit('cache:invalidateTag', { tag, count });
    return count;
  }

  /**
   * Invalidate multiple tags
   */
  async invalidateTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invalidateTag(tag);
    }
    return total;
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let count = 0;
    const fullPattern = `${this.namespace}:${pattern}`;

    // Invalidate in Redis
    if (this.redis) {
      try {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          count = await this.redis.del(keys);
        }
      } catch (error) {
        console.error('Redis invalidatePattern error:', error);
      }
    }

    // Invalidate in local cache
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.localCache.keys()) {
      if (regex.test(key)) {
        this.localCache.delete(key);
        count++;
      }
    }

    this.emit('cache:invalidatePattern', { pattern, count });
    return count;
  }

  /**
   * Get or set pattern (fetch if not cached)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Check if key exists
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    const cacheKey = this.makeKey(key, options);

    if (this.redis) {
      try {
        return (await this.redis.exists(cacheKey)) > 0;
      } catch (error) {
        console.error('Redis has error:', error);
      }
    }

    const entry = this.localCache.get(cacheKey);
    if (entry) {
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.localCache.delete(cacheKey);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string, options?: CacheOptions): Promise<number> {
    const cacheKey = this.makeKey(key, options);

    if (this.redis) {
      try {
        return await this.redis.ttl(cacheKey);
      } catch (error) {
        console.error('Redis getTTL error:', error);
      }
    }

    const entry = this.localCache.get(cacheKey);
    if (entry?.expiresAt) {
      return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    }

    return -1;
  }

  /**
   * Extend TTL
   */
  async touch(key: string, ttl?: number, options?: CacheOptions): Promise<boolean> {
    const cacheKey = this.makeKey(key, options);
    const newTTL = ttl ?? this.defaultTTL;

    if (this.redis) {
      try {
        const result = await this.redis.expire(cacheKey, newTTL);
        return result > 0;
      } catch (error) {
        console.error('Redis touch error:', error);
      }
    }

    const entry = this.localCache.get(cacheKey);
    if (entry) {
      entry.expiresAt = Date.now() + newTTL * 1000;
      return true;
    }

    return false;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // Clear Redis
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${this.namespace}:*`);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }

    // Clear local cache
    this.localCache.clear();
    this.tagIndex.clear();

    this.emit('cache:clear', {});
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    let memoryUsage = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.localCache.values()) {
      const entryDate = new Date(entry.createdAt);
      if (!oldestEntry || entryDate < oldestEntry) {
        oldestEntry = entryDate;
      }
      if (!newestEntry || entryDate > newestEntry) {
        newestEntry = entryDate;
      }
    }

    // Try to get Redis memory info
    if (this.redis) {
      try {
        const info = await this.redis.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          memoryUsage = parseInt(match[1], 10);
        }
      } catch (error) {
        // Ignore
      }
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.localCache.size,
      hitRate,
      memoryUsage,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Memoize a function with caching
   */
  memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyGenerator: (...args: Parameters<T>) => string,
    options?: CacheOptions
  ): T {
    return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      const key = keyGenerator(...args);
      return this.getOrSet(key, () => fn(...args), options);
    }) as T;
  }
}

// Export singleton instance
export const cacheService = new CacheService({
  namespace: 'agentsmith',
  defaultTTL: 3600,
  maxLocalCacheSize: 1000,
});

export default CacheService;

// ============================================
// Cache decorators for common patterns
// ============================================

/**
 * Decorator for caching method results
 */
export function Cached(options?: CacheOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      return cacheService.getOrSet(key, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Decorator for invalidating cache on method call
 */
export function InvalidatesCache(tags: string[]) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      await cacheService.invalidateTags(tags);
      return result;
    };

    return descriptor;
  };
}
