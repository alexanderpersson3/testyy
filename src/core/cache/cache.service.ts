/**
 * Cache service using Redis Cluster for distributed caching.
 * 
 * Note: There are known TypeScript definition issues with the ioredis package.
 * These can be resolved by either:
 * 1. Adding "allowSyntheticDefaultImports": true to tsconfig.json
 * 2. Upgrading to a newer version of ioredis with better TypeScript support
 * 3. Creating custom type definitions
 * 
 * For now, we use @ts-ignore comments where necessary since the functionality
 * works correctly at runtime.
 */

import Redis from 'ioredis';
import { Logger } from '../logger/logger';
import { EventEmitter } from 'events';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CacheConfig {
  redis: {
    nodes: { host: string; port: number }[];
    // @ts-ignore - Redis.ClusterOptions exists at runtime
    options?: Redis.ClusterOptions;
  };
  defaultTTL: number;
  staleTTL: number;
  cleanupInterval?: number; // Interval in ms for cleanup of expired entries
  maxMemoryUsage?: number; // Maximum memory usage in bytes before eviction
  compression?: {
    enabled: boolean;
    minSize?: number; // Minimum size in bytes before compression (default: 1024)
    level?: number; // Compression level (0-9, default: 6)
  };
  monitoring?: {
    enabled: boolean;
    interval?: number; // Stats collection interval in ms (default: 60000)
    alertThresholds?: {
      memoryUsage?: number; // Percentage (default: 90)
      hitRate?: number; // Ratio (default: 0.5)
      errorRate?: number; // Ratio (default: 0.05)
      latency?: number; // Milliseconds (default: 100)
    };
  };
}

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  compressed?: boolean;
  size?: number;
}

interface CacheStats extends Record<string, number> {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  hitRate: number;
  missRate: number;
  memoryUsagePercent: number;
  evictionCount: number;
  compressionRatio: number;
  averageLatency: number;
  errorRate: number;
  totalOperations: number;
  compressedKeys: number;
  totalCompressedSize: number;
  totalUncompressedSize: number;
}

export interface CacheEvent<T = any> {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'expire' | 'error' | 'evict' | 'compress' | 'decompress';
  key: string;
  data?: T;
  timestamp: number;
  metadata?: Record<string, any>;
  duration?: number;
}

interface LatencyStats {
  count: number;
  total: number;
  min: number;
  max: number;
  average: number;
}

export class CacheService extends EventEmitter {
  private static instance: CacheService;
  // @ts-ignore - Redis.Cluster exists at runtime
  private readonly redis: Redis.Cluster;
  private readonly logger: Logger;
  private readonly defaultTTL: number;
  private readonly staleTTL: number;
  private readonly maxMemoryUsage: number;
  private readonly compression: Required<NonNullable<CacheConfig['compression']>>;
  private readonly monitoring: Required<NonNullable<CacheConfig['monitoring']>>;
  private cleanupInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;
  private evictionCount: number = 0;
  private operationLatencies: Map<string, LatencyStats> = new Map();
  private errorCount: number = 0;
  private totalOperations: number = 0;

  private constructor(config: CacheConfig) {
    super();
    this.logger = new Logger('CacheService');
    this.defaultTTL = config.defaultTTL;
    this.staleTTL = config.staleTTL;
    this.maxMemoryUsage = config.maxMemoryUsage || Infinity;

    // Setup compression config
    this.compression = {
      enabled: config.compression?.enabled ?? false,
      minSize: config.compression?.minSize ?? 1024,
      level: config.compression?.level ?? 6
    };

    // Setup monitoring config
    this.monitoring = {
      enabled: config.monitoring?.enabled ?? true,
      interval: config.monitoring?.interval ?? 60000,
      alertThresholds: {
        memoryUsage: config.monitoring?.alertThresholds?.memoryUsage ?? 90,
        hitRate: config.monitoring?.alertThresholds?.hitRate ?? 0.5,
        errorRate: config.monitoring?.alertThresholds?.errorRate ?? 0.05,
        latency: config.monitoring?.alertThresholds?.latency ?? 100
      }
    };

    // Initialize Redis Cluster
    // @ts-ignore - Redis.Cluster constructor exists at runtime
    this.redis = new Redis.Cluster(config.redis.nodes, {
      scaleReads: 'slave',
      clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
      ...config.redis.options
    });

    this.setupEventHandlers();
    this.setupIntervals(config);
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis Cluster');
    });

    this.redis.on('error', (err: Error) => {
      this.errorCount++;
      this.logger.error('Redis Cluster error', { error: err });
      this.emit('error', this.createEvent('error', '', undefined, { error: err }));
    });

    this.redis.on('node:error', (err: Error, node: Redis) => {
      this.errorCount++;
      this.logger.error('Redis Cluster node error', { 
        error: err, 
        // @ts-ignore - node.options exists at runtime
        nodeId: node.options?.name 
      });
    });
  }

  private setupIntervals(config: CacheConfig): void {
    // Setup cleanup interval if configured
    if (config.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup().catch(err => {
          this.errorCount++;
          this.logger.error('Cache cleanup failed', { error: err });
        });
      }, config.cleanupInterval);
    }

    // Setup monitoring if enabled
    if (this.monitoring.enabled) {
      this.statsInterval = setInterval(async () => {
        try {
          const stats = await this.getStats();
          const thresholds = this.monitoring.alertThresholds;
          
          // Check thresholds and emit warnings
          if (thresholds.memoryUsage && stats.memoryUsagePercent > thresholds.memoryUsage) {
            this.logger.warn('High memory usage in Redis cache', {
              memoryUsagePercent: stats.memoryUsagePercent,
              threshold: thresholds.memoryUsage,
              totalMemory: stats.memory
            });
          }

          if (thresholds.hitRate && stats.hitRate < thresholds.hitRate) {
            this.logger.warn('Low cache hit rate', {
              hitRate: stats.hitRate,
              threshold: thresholds.hitRate,
              hits: stats.hits,
              misses: stats.misses
            });
          }

          if (thresholds.errorRate && stats.errorRate > thresholds.errorRate) {
            this.logger.warn('High error rate', {
              errorRate: stats.errorRate,
              threshold: thresholds.errorRate,
              errors: this.errorCount,
              totalOperations: this.totalOperations
            });
          }

          if (thresholds.latency && stats.averageLatency > thresholds.latency) {
            this.logger.warn('High average latency', {
              averageLatency: stats.averageLatency,
              threshold: thresholds.latency,
              ...this.getLatencyStats()
            });
          }

          // Log compression stats if enabled
          if (this.compression.enabled) {
            this.logger.info('Compression stats', {
              compressionRatio: stats.compressionRatio,
              compressedKeys: stats.compressedKeys,
              totalCompressedSize: stats.totalCompressedSize,
              totalUncompressedSize: stats.totalUncompressedSize,
              savedBytes: stats.totalUncompressedSize - stats.totalCompressedSize
            });
          }
        } catch (err) {
          this.errorCount++;
          this.logger.error('Failed to monitor cache stats', { error: err });
        }
      }, this.monitoring.interval);
    }
  }

  private async trackLatency<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = process.hrtime();
    try {
      const result = await fn();
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1e6;

      // Update latency stats
      const existingStats = this.operationLatencies.get(operation);
      const stats = existingStats || {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        average: 0
      };

      stats.count++;
      stats.total += duration;
      stats.min = Math.min(stats.min, duration);
      stats.max = Math.max(stats.max, duration);
      stats.average = stats.total / stats.count;

      this.operationLatencies.set(operation, stats);
      this.totalOperations++;

      return result;
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  private getLatencyStats(): Record<string, LatencyStats> {
    const stats: Record<string, LatencyStats> = {};
    for (const [operation, latencyStats] of this.operationLatencies.entries()) {
      if (latencyStats) {
        stats[operation] = { ...latencyStats };
      }
    }
    return stats;
  }

  private async compressData(data: string): Promise<Buffer> {
    const buffer = Buffer.from(data);
    if (buffer.length < this.compression.minSize) {
      return buffer;
    }
    return gzipAsync(buffer, { level: this.compression.level });
  }

  private async decompressData(data: Buffer): Promise<string> {
    const decompressed = await gunzipAsync(data);
    return decompressed.toString();
  }

  private createEvent<T>(
    type: CacheEvent['type'],
    key: string,
    data?: T,
    metadata?: Record<string, any>
  ): CacheEvent<T> {
    return {
      type,
      key,
      data,
      timestamp: Date.now(),
      metadata
    };
  }

  private createEntry<T>(data: T, ttl?: number): CacheEntry<T> {
    const now = Date.now();
    return {
      data,
      createdAt: now,
      updatedAt: now,
      expiresAt: ttl ? now + ttl * 1000 : undefined
    };
  }

  async get<T>(
    key: string,
    options: {
      fetchFn?: () => Promise<T>;
      ttl?: number;
      staleTTL?: number;
    } = {}
  ): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      
      if (!cached) {
        this.emit('miss', this.createEvent('miss', key));
        
        if (!options.fetchFn) {
          return null;
        }

        // Cache miss - fetch fresh data
        const data = await options.fetchFn();
        if (data) {
          const entry = this.createEntry(data, options.ttl);
          await this.set(key, entry, options.ttl);
        }
        return data;
      }

      const entry = JSON.parse(cached) as CacheEntry<T>;
      
      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.emit('expire', this.createEvent('expire', key, entry.data));
        await this.delete(key);
        
        if (options.fetchFn) {
          const data = await options.fetchFn();
          if (data) {
            const newEntry = this.createEntry(data, options.ttl);
            await this.set(key, newEntry, options.ttl);
          }
          return data;
        }
        return null;
      }

      this.emit('hit', this.createEvent('hit', key, entry.data));
      
      const now = Date.now();
      const age = now - entry.updatedAt;
      const isStale = age > (options.staleTTL || this.staleTTL);

      if (isStale && options.fetchFn) {
        // Stale-while-revalidate pattern
        this.revalidate(key, options.fetchFn, options.ttl).catch((err: Error) => {
          this.logger.error('Cache revalidation failed', { error: err, key });
        });
      }

      return entry.data;
    } catch (err) {
      this.logger.error('Cache get error', { error: err instanceof Error ? err : String(err), key });
      this.emit('error', this.createEvent('error', key, undefined, { error: err }));
      
      if (options.fetchFn) {
        // Fallback to fetch function on cache error
        return options.fetchFn();
      }
      
      return null;
    }
  }

  private async revalidate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<void> {
    try {
      const data = await fetchFn();
      if (data) {
        const entry = this.createEntry(data, ttl);
        await this.set(key, entry, ttl);
      }
    } catch (err) {
      throw new Error(`Cache revalidation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async set<T>(key: string, data: T | CacheEntry<T>, ttl?: number): Promise<void> {
    try {
      const entry = this.isEntry(data) ? data : this.createEntry(data, ttl);
      
      // Check memory usage before setting
      const stats = await this.getStats();
      if (stats.memoryUsagePercent >= 90) {
        await this.evictEntries();
      }

      await this.redis.set(
        key,
        JSON.stringify(entry),
        'EX',
        ttl || this.defaultTTL
      );
      
      this.emit('set', this.createEvent('set', key, data));
    } catch (err) {
      this.logger.error('Cache set error', { error: err instanceof Error ? err : String(err), key });
      this.emit('error', this.createEvent('error', key, undefined, { error: err }));
    }
  }

  private async evictEntries(): Promise<void> {
    try {
      const keys = await this.redis.keys('*');
      if (keys.length === 0) return;

      type CacheItem = { key: string; entry: CacheEntry<any> };

      // Get all entries and sort by last access
      const entries = await Promise.all(
        keys.map(async (key: string) => {
          const data = await this.redis.get(key);
          if (!data) return null;
          const entry = JSON.parse(data) as CacheEntry<any>;
          return { key, entry };
        })
      );

      // Sort by last access time and remove oldest 10%
      const validEntries = entries.filter((e: CacheItem | null): e is CacheItem => e !== null);
      validEntries.sort((a: CacheItem, b: CacheItem) => a.entry.updatedAt - b.entry.updatedAt);

      const toEvict = validEntries.slice(0, Math.max(1, Math.floor(validEntries.length * 0.1)));
      
      for (const { key, entry } of toEvict) {
        await this.delete(key);
        this.evictionCount++;
        this.emit('evict', this.createEvent('evict', key, entry.data));
      }

      this.logger.info('Cache entries evicted', { count: toEvict.length });
    } catch (err) {
      this.logger.error('Failed to evict cache entries', { error: err });
    }
  }

  private isEntry<T>(data: any): data is CacheEntry<T> {
    return (
      typeof data === 'object' &&
      data !== null &&
      'data' in data &&
      'createdAt' in data &&
      'updatedAt' in data
    );
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.emit('delete', this.createEvent('delete', key));
    } catch (err) {
      this.logger.error('Cache delete error', { error: err instanceof Error ? err : String(err), key });
      this.emit('error', this.createEvent('error', key, undefined, { error: err }));
    }
  }

  async clear(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.info('Cache cleared', { pattern, keysRemoved: keys.length });
      }
    } catch (err) {
      this.logger.error('Cache clear error', { error: err instanceof Error ? err : String(err), pattern });
      this.emit('error', this.createEvent('error', pattern, undefined, { error: err }));
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const keys = await this.redis.keys('*');
      let expiredCount = 0;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (!data) continue;

        const entry = JSON.parse(data) as CacheEntry<any>;
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          await this.delete(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        this.logger.info('Cache cleanup completed', { expiredEntriesRemoved: expiredCount });
      }
    } catch (err) {
      this.logger.error('Cache cleanup error', { error: err instanceof Error ? err : String(err) });
    }
  }

  async getStats(): Promise<CacheStats> {
    const nodes = await this.redis.nodes('master');
    const stats = await Promise.all(
      nodes.map(async (node: Redis) => {
        // @ts-ignore - node.info exists at runtime
        const info = await node.info();
        // @ts-ignore - node.info exists at runtime
        const keyspace = await node.info('keyspace');
        return {
          hits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0'),
          misses: parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0'),
          keys: parseInt(keyspace.match(/keys=(\d+)/)?.[1] || '0'),
          memory: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0')
        };
      })
    );

    const totals = stats.reduce(
      (acc: CacheStats, curr: CacheStats) => ({
        hits: acc.hits + curr.hits,
        misses: acc.misses + curr.misses,
        keys: acc.keys + curr.keys,
        memory: acc.memory + curr.memory,
        hitRate: 0,
        missRate: 0,
        memoryUsagePercent: 0,
        evictionCount: this.evictionCount,
        compressionRatio: 0,
        averageLatency: 0,
        errorRate: 0,
        totalOperations: this.totalOperations,
        compressedKeys: 0,
        totalCompressedSize: 0,
        totalUncompressedSize: 0
      }),
      {
        hits: 0,
        misses: 0,
        keys: 0,
        memory: 0,
        hitRate: 0,
        missRate: 0,
        memoryUsagePercent: 0,
        evictionCount: 0,
        compressionRatio: 0,
        averageLatency: 0,
        errorRate: 0,
        totalOperations: 0,
        compressedKeys: 0,
        totalCompressedSize: 0,
        totalUncompressedSize: 0
      }
    );

    const total = totals.hits + totals.misses;
    totals.hitRate = total > 0 ? totals.hits / total : 0;
    totals.missRate = total > 0 ? totals.misses / total : 0;
    totals.memoryUsagePercent = (totals.memory / this.maxMemoryUsage) * 100;
    totals.errorRate = this.totalOperations > 0 ? this.errorCount / this.totalOperations : 0;

    // Calculate average latency across all operations
    let totalLatency = 0;
    let totalCount = 0;
    for (const stats of this.operationLatencies.values()) {
      totalLatency += stats.total;
      totalCount += stats.count;
    }
    totals.averageLatency = totalCount > 0 ? totalLatency / totalCount : 0;

    // Add compression stats if enabled
    if (this.compression.enabled) {
      const keys = await this.redis.keys('*');
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const entry = JSON.parse(data) as CacheEntry<any>;
          if (entry.compressed) {
            totals.compressedKeys++;
            totals.totalCompressedSize += entry.size || 0;
            totals.totalUncompressedSize += Buffer.from(JSON.stringify(entry.data)).length;
          }
        }
      }
      totals.compressionRatio = totals.totalUncompressedSize > 0
        ? totals.totalCompressedSize / totals.totalUncompressedSize
        : 1;
    }

    return totals;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const nodes = await this.redis.nodes();
      const results = await Promise.all(
        nodes.map((node: Redis) => {
          // @ts-ignore - node.ping exists at runtime
          return node.ping();
        })
      );
      return results.every((result: string) => result === 'PONG');
    } catch (err) {
      this.logger.error('Cache health check failed', { error: err instanceof Error ? err : String(err) });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    await this.redis.disconnect();
  }
} 