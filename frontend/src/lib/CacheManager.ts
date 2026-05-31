/**
 * CacheManager.ts - Smart caching with TTL and LRU eviction for NILIN app
 * Provides cache-first strategy for reads with configurable expiration
 */

export interface CacheOptions {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTTL?: number;
  /** Maximum number of items (default: 100) */
  maxSize?: number;
  /** Maximum total cache size in bytes (default: 10MB) */
  maxBytes?: number;
  /** Enable LRU eviction (default: true) */
  enableLRU?: boolean;
  /** Enable statistics tracking (default: false) */
  enableStats?: boolean;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  size: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  itemCount: number;
  hitRate: number;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  maxBytes: number;
  enableLRU: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  maxBytes: 10 * 1024 * 1024, // 10MB
  enableLRU: true,
};

class CacheManagerService {
  private static instance: CacheManagerService;
  private cache: Map<string, CacheEntry<unknown>>;
  private accessOrder: string[]; // For LRU tracking
  private config: CacheConfig;
  private stats: CacheStats;
  private estimatedSize: number = 0;
  // Max access order array size to prevent memory leak (MAJOR PERFORMANCE FIX)
  private static readonly MAX_ACCESS_ORDER_SIZE = 1000;

  private constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.config = { ...DEFAULT_CONFIG };
    this.updateConfig(options);
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: CacheOptions): CacheManagerService {
    if (!CacheManagerService.instance) {
      CacheManagerService.instance = new CacheManagerService(options);
    }
    return CacheManagerService.instance;
  }

  /**
   * Reset singleton instance
   */
  public static resetInstance(): void {
    if (CacheManagerService.instance) {
      CacheManagerService.instance.clear();
      CacheManagerService.instance = undefined as unknown as CacheManagerService;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(options: CacheOptions): void {
    if (options.defaultTTL !== undefined) {
      this.config.defaultTTL = options.defaultTTL;
    }
    if (options.maxSize !== undefined) {
      this.config.maxSize = options.maxSize;
    }
    if (options.maxBytes !== undefined) {
      this.config.maxBytes = options.maxBytes;
    }
    if (options.enableLRU !== undefined) {
      this.config.enableLRU = options.enableLRU;
    }
  }

  /**
   * Get an item from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.recordMiss();
      return null;
    }

    // Update access order for LRU
    if (this.config.enableLRU) {
      this.updateAccessOrder(key);
    }

    // Update hit count
    entry.hits++;

    this.recordHit();
    return entry.value;
  }

  /**
   * Get an item from cache, or fetch and cache if not present
   */
  public async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetcher();

    // Cache the result
    this.set(key, value, ttl);

    return value;
  }

  /**
   * Set an item in cache
   */
  public set<T>(key: string, value: T, ttl?: number): void {
    const effectiveTTL = ttl ?? this.config.defaultTTL;
    const serialized = this.serialize(value);
    const size = this.estimateSize(serialized);

    // Check if we need to evict
    this.ensureCapacity(size);

    // Delete existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Create new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: effectiveTTL,
      size,
      hits: 0,
    };

    this.cache.set(key, entry);
    this.estimatedSize += size;

    // Update access order - with bounds checking (MAJOR PERFORMANCE FIX)
    if (this.config.enableLRU) {
      // Prevent unbounded growth during bulk operations
      if (this.accessOrder.length >= CacheManagerService.MAX_ACCESS_ORDER_SIZE) {
        this.rebuildAccessOrder();
      }
      this.accessOrder.push(key);
    }

    this.updateStats();
  }

  /**
   * Set multiple items at once
   */
  public setMany<T>(items: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const item of items) {
      this.set(item.key, item.value, item.ttl);
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete an item from cache
   */
  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.estimatedSize -= entry.size;
    this.cache.delete(key);

    // Remove from access order
    if (this.config.enableLRU) {
      const index = this.accessOrder.indexOf(key);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    this.updateStats();
    return true;
  }

  /**
   * Invalidate cache by key pattern
   */
  public invalidate(pattern: string | RegExp): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());

    for (const key of keys) {
      const matches =
        typeof pattern === 'string'
          ? key.includes(pattern)
          : pattern.test(key);

      if (matches) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.estimatedSize = 0;
    this.stats.itemCount = 0;
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all keys
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all entries
   */
  public entries<T>(): Array<{ key: string; value: T; metadata: CacheEntry<T> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value as T,
      metadata: entry as CacheEntry<T>,
    }));
  }

  /**
   * Get cache size in bytes
   */
  public getSize(): number {
    return this.estimatedSize;
  }

  /**
   * Get item count
   */
  public getCount(): number {
    return this.cache.size;
  }

  /**
   * Clean expired entries
   */
  public cleanExpired(): number {
    let count = 0;
    const now = Date.now();

    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && this.isExpired(entry)) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Check if cache has expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (entry.ttl === 0) {
      return false; // No expiration
    }
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Update access order for LRU
   * Uses circular buffer pattern to prevent unbounded memory growth
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Prevent unbounded growth: if accessOrder is too large, trim oldest entries
    // that are no longer in the cache
    if (this.accessOrder.length >= CacheManagerService.MAX_ACCESS_ORDER_SIZE) {
      this.rebuildAccessOrder();
    }

    this.accessOrder.push(key);
  }

  /**
   * Rebuild access order from actual cache keys
   * Called when accessOrder array grows too large
   */
  private rebuildAccessOrder(): void {
    // Keep only keys that still exist in cache, maintain relative order
    const validKeys: string[] = [];
    for (const key of this.accessOrder) {
      if (this.cache.has(key)) {
        validKeys.push(key);
      }
    }
    // Keep at most half the max size to prevent frequent rebuilds
    this.accessOrder = validKeys.slice(-Math.floor(CacheManagerService.MAX_ACCESS_ORDER_SIZE / 2));
  }

  /**
   * Ensure we have capacity for new item
   */
  private ensureCapacity(newItemSize: number): void {
    // Evict by LRU if at max size
    while (
      this.cache.size >= this.config.maxSize ||
      this.estimatedSize + newItemSize > this.config.maxBytes
    ) {
      if (this.accessOrder.length === 0) {
        break;
      }

      // Remove least recently used
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.delete(lruKey);
        this.stats.evictions++;
      } else {
        break;
      }
    }
  }

  /**
   * Serialize value for size estimation
   */
  private serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: string): number {
    // Rough estimate: 2 bytes per character for UTF-16
    return value.length * 2;
  }

  /**
   * Record a cache hit
   */
  private recordHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  /**
   * Record a cache miss
   */
  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.size = this.estimatedSize;
    this.stats.itemCount = this.cache.size;
  }

  /**
   * Preload cache with data
   */
  public preload<T>(items: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const item of items) {
      this.set(item.key, item.value, item.ttl);
    }
  }

  /**
   * Get cache info for debugging
   */
  public getInfo(): {
    config: CacheConfig;
    stats: CacheStats;
    oldestItem: number | null;
    newestItem: number | null;
    mostAccessed: Array<{ key: string; hits: number }>;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of Array.from(this.cache.values())) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (newest === null || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }

    const mostAccessed = Array.from(this.cache.values())
      .map((e) => ({ key: e.key, hits: e.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      config: { ...this.config },
      stats: { ...this.stats },
      oldestItem: oldest,
      newestItem: newest,
      mostAccessed,
    };
  }
}

// Export singleton instance
export const cacheManager = CacheManagerService.getInstance();

// Export class
export { CacheManagerService };

// Default export
export default cacheManager;
