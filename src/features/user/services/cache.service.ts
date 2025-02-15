interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
  lastAccessed: Date;
  version: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  version?: number;
}

export class CacheService {
  private static instance: CacheService;
  private readonly cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 3600; // 1 hour in seconds
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 300; // 5 minutes in seconds
  private cleanupIntervalId?: NodeJS.Timeout;

  private constructor() {
    this.cache = new Map();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupIntervalId = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL * 1000);
  }

  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.DEFAULT_TTL;
    const version = options.version || 1;

    const entry: CacheEntry<T> = {
      data,
      expiresAt: new Date(Date.now() + ttl * 1000),
      lastAccessed: new Date(),
      version,
    };

    this.cache.set(key, entry);

    // Evict oldest entries if cache is too large
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = new Date();
    return entry.data;
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get the current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if the cache service is healthy
   */
  isHealthy(): boolean {
    return this.cache.size <= this.MAX_CACHE_SIZE;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict the oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a: any, b: any) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

    // Remove oldest 10% of entries
    const removeCount = Math.ceil(this.MAX_CACHE_SIZE * 0.1);
    entries.slice(0, removeCount).forEach(([key]) => {
      this.cache.delete(key);
    });
  }

  /**
   * Get data progressively with progress tracking
   */
  async getProgressively<T>(
    key: string,
    fetchData: () => Promise<T>,
    options: {
      chunkSize?: number;
      ttl?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    const data = await fetchData();

    if (Array.isArray(data)) {
      const chunkSize = options.chunkSize || 10;
      const chunks = Math.ceil(data.length / chunkSize);

      for (let i = 0; i < chunks; i++) {
        const progress = Math.min(Math.round(((i + 1) / chunks) * 100), 100);
        options.onProgress?.(progress);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI updates
      }
    }

    await this.set(key, data, { ttl: options.ttl });
    return data;
  }

  /**
   * Cleanup resources when the service is destroyed
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.cache.clear();
  }
}

// Export a singleton instance
export const cache = CacheService.getInstance();
