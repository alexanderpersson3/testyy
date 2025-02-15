import NodeCache from 'node-cache';

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  checkPeriod: number;
}

/**
 * Cache service for data caching
 */
export class CacheService {
  private cache: NodeCache;
  private enabled: boolean;

  constructor(config: CacheConfig) {
    this.enabled = config.enabled;
    this.cache = new NodeCache({
      stdTTL: config.ttl,
      checkperiod: config.checkPeriod,
      useClones: false
    });
  }

  /**
   * Set a value in cache
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    if (!this.enabled) return false;
    return this.cache.set(key, value, ttl);
  }

  /**
   * Get a value from cache
   */
  public get<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    return this.cache.get<T>(key);
  }

  /**
   * Delete a value from cache
   */
  public delete(key: string): number {
    if (!this.enabled) return 0;
    return this.cache.del(key);
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    if (!this.enabled) return;
    this.cache.flushAll();
  }

  /**
   * Get cache stats
   */
  public getStats(): { hits: number; misses: number; keys: number } {
    return {
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      keys: this.cache.keys().length
    };
  }

  /**
   * Check if key exists in cache
   */
  public has(key: string): boolean {
    if (!this.enabled) return false;
    return this.cache.has(key);
  }

  /**
   * Get multiple values from cache
   */
  public getMany<T>(keys: string[]): Record<string, T> {
    if (!this.enabled) return {};
    return this.cache.mget<T>(keys);
  }

  /**
   * Set multiple values in cache
   */
  public setMany<T>(items: Record<string, T>, ttl?: number): boolean {
    if (!this.enabled) return false;
    return this.cache.mset(
      Object.entries(items).map(([key, value]) => ({
        key,
        val: value,
        ttl
      }))
    );
  }

  /**
   * Get cache keys
   */
  public getKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Get TTL for a key
   */
  public getTtl(key: string): number | undefined {
    return this.cache.getTtl(key);
  }
} 