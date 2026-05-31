/**
 * OfflineStorage Service
 *
 * Handles caching of categories and services for offline access.
 * Queues failed API requests for retry when back online.
 * Uses Capacitor-safe storage for cross-platform compatibility (web + native).
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// =============================================================================
// Types
// =============================================================================

export interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: string;
  payload?: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface CacheConfig {
  /** Cache TTL in milliseconds (default: 1 hour) */
  ttl?: number;
  /** Maximum cached items (default: 100) */
  maxItems?: number;
  /** Storage key prefix */
  prefix?: string;
}

// =============================================================================
// OfflineStorage Class
// =============================================================================

class OfflineStorageService {
  private prefix: string;
  private defaultTTL: number;
  private maxItems: number;
  private isNative: boolean;
  private memoryCache: Map<string, string>;

  // Storage keys
  private readonly CATEGORIES_KEY = 'offline_categories';
  private readonly SERVICES_KEY = 'offline_services';
  private readonly REQUEST_QUEUE_KEY = 'offline_request_queue';

  constructor(config: CacheConfig = {}) {
    this.prefix = config.prefix || 'nilin_offline';
    this.defaultTTL = config.ttl || 60 * 60 * 1000; // 1 hour
    this.maxItems = config.maxItems || 100;
    this.isNative = Capacitor.isNativePlatform();
    this.memoryCache = new Map();
  }

  // ==========================================================================
  // Private Storage Helpers (Capacitor-safe)
  // ==========================================================================

  private getStorageKey(key: string): string {
    return `${this.prefix}_${key}`;
  }

  private async getStorageValue(key: string): Promise<string | null> {
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key) ?? null;
      }

      if (this.isNative) {
        const result = await Preferences.get({ key });
        if (result.value) {
          this.memoryCache.set(key, result.value);
          return result.value;
        }
        return null;
      } else {
        // Web fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          const value = localStorage.getItem(key);
          if (value) {
            this.memoryCache.set(key, value);
          }
          return value;
        }
        return null;
      }
    } catch (error) {
      console.error('[OfflineStorage] Get error:', error);
      return null;
    }
  }

  private async setStorageValue(key: string, value: string): Promise<void> {
    try {
      // Always update memory cache
      this.memoryCache.set(key, value);

      if (this.isNative) {
        await Preferences.set({ key, value });
      } else {
        // Web fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, value);
        }
      }
    } catch (error) {
      console.error('[OfflineStorage] Set error:', error);
    }
  }

  private async removeStorageValue(key: string): Promise<void> {
    try {
      // Remove from memory cache
      this.memoryCache.delete(key);

      if (this.isNative) {
        await Preferences.remove({ key });
      } else {
        // Web fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('[OfflineStorage] Remove error:', error);
    }
  }

  private async clearAllWithPrefix(): Promise<void> {
    if (this.isNative) {
      try {
        const keys = await Preferences.keys();
        for (const k of keys.keys) {
          if (k.startsWith(this.prefix)) {
            await Preferences.remove({ key: k });
          }
        }
      } catch (error) {
        console.error('[OfflineStorage] Clear error:', error);
      }
    } else {
      // Web fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.prefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      }
    }
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(this.prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Get cached data if still valid
   */
  async get<T>(key: string): Promise<T | null> {
    const storageKey = this.getStorageKey(key);
    const cached = await this.getStorageValue(storageKey);

    if (!cached) {
      return null;
    }

    try {
      const parsed: CachedItem<T> = JSON.parse(cached);

      // Check if expired
      if (Date.now() > parsed.expiresAt) {
        await this.removeStorageValue(storageKey);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('[OfflineStorage] Parse error:', error);
      await this.removeStorageValue(storageKey);
      return null;
    }
  }

  /**
   * Cache data with TTL
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const storageKey = this.getStorageKey(key);
    const now = Date.now();
    const itemTTL = ttl || this.defaultTTL;

    const cachedItem: CachedItem<T> = {
      data,
      timestamp: now,
      expiresAt: now + itemTTL,
    };

    await this.setStorageValue(storageKey, JSON.stringify(cachedItem));
  }

  /**
   * Remove cached item
   */
  async remove(key: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    await this.removeStorageValue(storageKey);
  }

  /**
   * Clear all cached items
   */
  async clear(): Promise<void> {
    await this.clearAllWithPrefix();
  }

  // ==========================================================================
  // Categories Cache
  // ==========================================================================

  /**
   * Cache categories data
   */
  async cacheCategories(categories: unknown): Promise<void> {
    await this.set(this.CATEGORIES_KEY, categories, this.defaultTTL);
  }

  /**
   * Get cached categories
   */
  async getCategories<T>(): Promise<T | null> {
    return this.get<T>(this.CATEGORIES_KEY);
  }

  // ==========================================================================
  // Services Cache
  // ==========================================================================

  /**
   * Cache services data
   */
  async cacheServices(services: unknown): Promise<void> {
    await this.set(this.SERVICES_KEY, services, this.defaultTTL);
  }

  /**
   * Get cached services
   */
  async getServices<T>(): Promise<T | null> {
    return this.get<T>(this.SERVICES_KEY);
  }

  /**
   * Cache individual service
   */
  async cacheService<T>(serviceId: string, service: T): Promise<void> {
    await this.set(`service_${serviceId}`, service, this.defaultTTL);
  }

  /**
   * Get cached individual service
   */
  async getService<T>(serviceId: string): Promise<T | null> {
    return this.get<T>(`service_${serviceId}`);
  }

  // ==========================================================================
  // Request Queue (for offline mutations)
  // ==========================================================================

  /**
   * Add request to queue
   */
  async queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queue = await this.getRequestQueue();
    const newRequest: QueuedRequest = {
      ...request,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    queue.push(newRequest);

    // Limit queue size
    if (queue.length > this.maxItems) {
      queue.shift();
    }

    await this.setStorageValue(
      this.getStorageKey(this.REQUEST_QUEUE_KEY),
      JSON.stringify(queue)
    );
  }

  /**
   * Get all queued requests
   */
  async getRequestQueue(): Promise<QueuedRequest[]> {
    const stored = await this.getStorageValue(this.getStorageKey(this.REQUEST_QUEUE_KEY));

    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Remove request from queue
   */
  async dequeueRequest(requestId: string): Promise<void> {
    const queue = await this.getRequestQueue();
    const filtered = queue.filter((r) => r.id !== requestId);

    await this.setStorageValue(
      this.getStorageKey(this.REQUEST_QUEUE_KEY),
      JSON.stringify(filtered)
    );
  }

  /**
   * Update request retry count
   */
  async updateRequestRetry(requestId: string): Promise<void> {
    const queue = await this.getRequestQueue();
    const request = queue.find((r) => r.id === requestId);

    if (request) {
      request.retryCount++;
      await this.setStorageValue(
        this.getStorageKey(this.REQUEST_QUEUE_KEY),
        JSON.stringify(queue)
      );
    }
  }

  /**
   * Clear request queue
   */
  async clearRequestQueue(): Promise<void> {
    await this.removeStorageValue(this.getStorageKey(this.REQUEST_QUEUE_KEY));
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const queue = await this.getRequestQueue();
    return queue.length;
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  /**
   * Process queued requests when back online
   */
  async processQueue(
    executeRequest: (request: QueuedRequest) => Promise<boolean>
  ): Promise<{ success: number; failed: number }> {
    const queue = await this.getRequestQueue();
    let success = 0;
    let failed = 0;

    for (const request of queue) {
      try {
        const result = await executeRequest(request);

        if (result) {
          await this.dequeueRequest(request.id);
          success++;
        } else {
          // Increment retry count
          await this.updateRequestRetry(request.id);

          // Remove if max retries exceeded
          if (request.retryCount >= request.maxRetries) {
            await this.dequeueRequest(request.id);
            failed++;
          }
        }
      } catch (error) {
        console.error('[OfflineStorage] Queue processing error:', error);
        failed++;
      }
    }

    return { success, failed };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

// Default instance with standard config
export const offlineStorage = new OfflineStorageService({
  ttl: 60 * 60 * 1000, // 1 hour
  maxItems: 100,
  prefix: 'nilin_offline',
});

// Factory for creating custom instances
export function createOfflineStorage(config?: CacheConfig): OfflineStorageService {
  return new OfflineStorageService(config);
}

// =============================================================================
// React Hook
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to access offline storage functionality
 */
export function useOfflineStorage() {
  const [queueSize, setQueueSize] = useState(0);

  // Update queue size on mount
  useEffect(() => {
    offlineStorage.getQueueSize().then(setQueueSize);
  }, []);

  const addToQueue = useCallback(async (request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>) => {
    await offlineStorage.queueRequest(request);
    setQueueSize((prev) => prev + 1);
  }, []);

  const processQueue = useCallback(async (executeRequest: (request: QueuedRequest) => Promise<boolean>) => {
    const result = await offlineStorage.processQueue(executeRequest);
    setQueueSize(await offlineStorage.getQueueSize());
    return result;
  }, []);

  const cacheCategories = useCallback(async (categories: unknown) => {
    await offlineStorage.cacheCategories(categories);
  }, []);

  const getCachedCategories = useCallback(async <T>() => {
    return offlineStorage.getCategories<T>();
  }, []);

  const cacheServices = useCallback(async (services: unknown) => {
    await offlineStorage.cacheServices(services);
  }, []);

  const getCachedServices = useCallback(async <T>() => {
    return offlineStorage.getServices<T>();
  }, []);

  return {
    queueSize,
    addToQueue,
    processQueue,
    cacheCategories,
    getCachedCategories,
    cacheServices,
    getCachedServices,
    clearQueue: offlineStorage.clearRequestQueue.bind(offlineStorage),
    clearCache: offlineStorage.clear.bind(offlineStorage),
  };
}

export default offlineStorage;
