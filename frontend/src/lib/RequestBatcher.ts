/**
 * RequestBatcher.ts - API request batching for NILIN app
 * Batches similar requests within a time window and deduplicates concurrent identical requests
 */

export interface BatchedRequest<T> {
  key: string;
  fetcher: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface BatchOptions {
  /** Time window in ms to batch similar requests (default: 100ms) */
  batchWindow?: number;
  /** Maximum batch size before flushing (default: 50) */
  maxBatchSize?: number;
  /** Enable deduplication (default: true) */
  deduplicate?: boolean;
}

interface PendingRequest<T> {
  request: BatchedRequest<T>;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface DeduplicationEntry<T> {
  promise: Promise<T>;
  timestamp: number;
}

const DEFAULT_OPTIONS: Required<BatchOptions> = {
  batchWindow: 100,
  maxBatchSize: 50,
  deduplicate: true,
};

class RequestBatcherService {
  private static instance: RequestBatcherService;
  private options: Required<BatchOptions>;
  private batchQueue: Map<string, BatchedRequest<unknown>[]>;
  private pendingRequests: Map<string, PendingRequest<unknown>>;
  private deduplicationCache: Map<string, DeduplicationEntry<unknown>>;
  private flushTimers: Map<string, ReturnType<typeof setTimeout>>;
  private isProcessing: Map<string, boolean>;
  private maxDeduplicationAge: number = 60000; // 1 minute

  private constructor(options: BatchOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.batchQueue = new Map();
    this.pendingRequests = new Map();
    this.deduplicationCache = new Map();
    this.flushTimers = new Map();
    this.isProcessing = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: BatchOptions): RequestBatcherService {
    if (!RequestBatcherService.instance) {
      RequestBatcherService.instance = new RequestBatcherService(options);
    }
    return RequestBatcherService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (RequestBatcherService.instance) {
      RequestBatcherService.instance.clearAll();
      RequestBatcherService.instance = undefined as unknown as RequestBatcherService;
    }
  }

  /**
   * Batch similar requests within the time window
   * All requests with the same key will wait for the first request to complete
   */
  public async batch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check for deduplication first
    if (this.options.deduplicate) {
      const deduplicated = await this.deduplicate(key, fetcher);
      if (deduplicated !== null) {
        return deduplicated;
      }
    }

    return new Promise<T>((resolve, reject) => {
      const request: BatchedRequest<T> = {
        key,
        fetcher,
        resolve: resolve as (value: unknown) => void,
        reject: reject as (error: Error) => void,
        timestamp: Date.now(),
      };

      // Add to batch queue
      if (!this.batchQueue.has(key)) {
        this.batchQueue.set(key, []);
      }
      this.batchQueue.get(key)!.push(request as BatchedRequest<unknown>);

      // Schedule flush
      this.scheduleFlush(key);

      // Flush immediately if batch is full
      if (this.batchQueue.get(key)!.length >= this.options.maxBatchSize) {
        this.flush(key);
      }
    });
  }

  /**
   * Deduplicate concurrent identical requests
   */
  public async deduplicate<T>(key: string, fetcher: () => Promise<T>): Promise<T | null> {
    const now = Date.now();

    // Check if there's an existing request with the same key
    if (this.deduplicationCache.has(key)) {
      const entry = this.deduplicationCache.get(key) as DeduplicationEntry<T>;

      // Check if the cached promise is still valid
      if (now - entry.timestamp < this.maxDeduplicationAge) {
        // Return the existing promise (deduplication hit)
        return entry.promise;
      }

      // Remove expired entry
      this.deduplicationCache.delete(key);
    }

    // Create new promise and cache it
    const promise = fetcher().finally(() => {
      // Clean up cache after completion
      setTimeout(() => {
        const current = this.deduplicationCache.get(key);
        if (current && current.promise === promise) {
          this.deduplicationCache.delete(key);
        }
      }, 1000);
    });

    this.deduplicationCache.set(key, {
      promise: promise as Promise<unknown>,
      timestamp: now,
    });

    return null; // Indicate this is a new request
  }

  /**
   * Schedule a batch flush
   */
  private scheduleFlush(key: string): void {
    // Clear existing timer
    if (this.flushTimers.has(key)) {
      clearTimeout(this.flushTimers.get(key)!);
    }

    // Schedule new flush
    const timeoutId = setTimeout(() => {
      this.flush(key);
    }, this.options.batchWindow);

    this.flushTimers.set(key, timeoutId);
  }

  /**
   * Flush a batch of requests
   */
  private async flush(key: string): Promise<void> {
    // Clear timer
    if (this.flushTimers.has(key)) {
      clearTimeout(this.flushTimers.get(key)!);
      this.flushTimers.delete(key);
    }

    // Get batch
    const batch = this.batchQueue.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear queue
    this.batchQueue.delete(key);

    // Mark as processing
    this.isProcessing.set(key, true);

    try {
      // Get the first request's fetcher
      const firstRequest = batch[0] as BatchedRequest<unknown>;
      const fetcher = firstRequest.fetcher;

      // Execute the request
      const result = await fetcher();

      // Resolve all requests in the batch with the same result
      for (const request of batch) {
        try {
          request.resolve(result);
        } catch {
          // Ignore resolution errors
        }
      }
    } catch (error) {
      // Reject all requests in the batch with the same error
      const errorObj = error instanceof Error ? error : new Error(String(error));

      for (const request of batch) {
        try {
          request.reject(errorObj);
        } catch {
          // Ignore rejection errors
        }
      }
    } finally {
      this.isProcessing.set(key, false);
    }
  }

  /**
   * Get the number of pending requests in a batch
   */
  public getPendingCount(key: string): number {
    return this.batchQueue.get(key)?.length ?? 0;
  }

  /**
   * Get all pending batch keys
   */
  public getPendingKeys(): string[] {
    return Array.from(this.batchQueue.keys());
  }

  /**
   * Cancel pending requests for a key
   */
  public cancelPending(key: string): void {
    // Clear timer
    if (this.flushTimers.has(key)) {
      clearTimeout(this.flushTimers.get(key)!);
      this.flushTimers.delete(key);
    }

    // Get batch
    const batch = this.batchQueue.get(key);
    if (!batch) {
      return;
    }

    // Reject all pending requests
    const error = new Error('Request cancelled');
    for (const request of batch) {
      request.reject(error);
    }

    // Clear queue
    this.batchQueue.delete(key);
  }

  /**
   * Check if a key is currently processing
   */
  public isKeyProcessing(key: string): boolean {
    return this.isProcessing.get(key) ?? false;
  }

  /**
   * Clear deduplication cache
   */
  public clearDeduplicationCache(): void {
    this.deduplicationCache.clear();
  }

  /**
   * Clear all pending requests
   */
  public clearAll(): void {
    // Clear all timers
    for (const timer of Array.from(this.flushTimers.values())) {
      clearTimeout(timer);
    }
    this.flushTimers.clear();

    // Cancel all pending requests
    for (const key of Array.from(this.batchQueue.keys())) {
      this.cancelPending(key);
    }

    // Clear caches
    this.batchQueue.clear();
    this.deduplicationCache.clear();
    this.isProcessing.clear();
  }

  /**
   * Get statistics
   */
  public getStats(): {
    pendingBatches: number;
    totalPendingRequests: number;
    deduplicatedKeys: number;
    processingKeys: string[];
  } {
    let totalPending = 0;
    for (const batch of Array.from(this.batchQueue.values())) {
      totalPending += batch.length;
    }

    return {
      pendingBatches: this.batchQueue.size,
      totalPendingRequests: totalPending,
      deduplicatedKeys: this.deduplicationCache.size,
      processingKeys: Array.from(this.isProcessing.entries())
        .filter(([, processing]) => processing)
        .map(([key]) => key),
    };
  }

  /**
   * Update options
   */
  public setOptions(options: Partial<BatchOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// Export singleton instance
export const requestBatcher = RequestBatcherService.getInstance();

// Export class
export { RequestBatcherService };

// Default export
export default requestBatcher;
