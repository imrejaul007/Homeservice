/**
 * CapacitorSafeStorage.ts
 * A cross-platform storage utility that works on both web and native (Capacitor)
 * Falls back to localStorage/sessionStorage on web, uses @capacitor/preferences on native
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface CapacitorStorageOptions {
  /** Use session storage (cleared on tab close) vs persistent storage */
  sessionOnly?: boolean;
  /** Prefix for all keys to avoid collisions */
  prefix?: string;
}

type StorageValue = string | null;

/**
 * Capacitor-safe storage wrapper
 * Provides a unified API for localStorage/sessionStorage on web
 * and @capacitor/preferences on native platforms
 */
export class CapacitorStorage {
  private static instance: CapacitorStorage;
  private prefix: string;
  private isNative: boolean;
  private memoryCache: Map<string, string>;

  private constructor(options: CapacitorStorageOptions = {}) {
    this.prefix = options.prefix || 'nilin';
    this.isNative = Capacitor.isNativePlatform();
    this.memoryCache = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: CapacitorStorageOptions): CapacitorStorage {
    if (!CapacitorStorage.instance) {
      CapacitorStorage.instance = new CapacitorStorage(options);
    }
    return CapacitorStorage.instance;
  }

  /**
   * Get full storage key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}_${key}`;
  }

  /**
   * Check if running on native platform
   */
  public isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Set an item in storage
   */
  public async setItem(key: string, value: string): Promise<void> {
    const storageKey = this.getKey(key);

    // Always cache in memory for consistency
    this.memoryCache.set(storageKey, value);

    if (this.isNative) {
      try {
        await Preferences.set({
          key: storageKey,
          value: value,
        });
      } catch (error) {
        console.error('[CapacitorStorage] Failed to set item:', error);
        throw error;
      }
    } else {
      // Web fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(storageKey, value);
        } catch (error) {
          console.error('[CapacitorStorage] localStorage set failed:', error);
          throw error;
        }
      }
    }
  }

  /**
   * Get an item from storage
   */
  public async getItem(key: string): Promise<string | null> {
    const storageKey = this.getKey(key);

    // Check memory cache first
    if (this.memoryCache.has(storageKey)) {
      return this.memoryCache.get(storageKey);
    }

    if (this.isNative) {
      try {
        const result = await Preferences.get({
          key: storageKey,
        });
        if (result.value) {
          this.memoryCache.set(storageKey, result.value);
          return result.value;
        }
        return null;
      } catch (error) {
        console.error('[CapacitorStorage] Failed to get item:', error);
        return null;
      }
    } else {
      // Web fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const value = localStorage.getItem(storageKey);
          if (value) {
            this.memoryCache.set(storageKey, value);
          }
          return value;
        } catch (error) {
          console.error('[CapacitorStorage] localStorage get failed:', error);
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Remove an item from storage
   */
  public async removeItem(key: string): Promise<void> {
    const storageKey = this.getKey(key);

    // Remove from memory cache
    this.memoryCache.delete(storageKey);

    if (this.isNative) {
      try {
        await Preferences.remove({
          key: storageKey,
        });
      } catch (error) {
        console.error('[CapacitorStorage] Failed to remove item:', error);
      }
    } else {
      // Web fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem(storageKey);
        } catch (error) {
          console.error('[CapacitorStorage] localStorage remove failed:', error);
        }
      }
    }
  }

  /**
   * Clear all items with the configured prefix
   */
  public async clear(): Promise<void> {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(this.prefix)) {
        this.memoryCache.delete(key);
      }
    }

    if (this.isNative) {
      try {
        const keys = await Preferences.keys();
        for (const key of keys.keys) {
          if (key.startsWith(this.prefix)) {
            await Preferences.remove({ key });
          }
        }
      } catch (error) {
        console.error('[CapacitorStorage] Failed to clear items:', error);
      }
    } else {
      // Web fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((key) => localStorage.removeItem(key));
        } catch (error) {
          console.error('[CapacitorStorage] localStorage clear failed:', error);
        }
      }
    }
  }

  /**
   * Get all keys with the configured prefix
   */
  public async keys(): Promise<string[]> {
    if (this.isNative) {
      try {
        const result = await Preferences.keys();
        return result.keys
          .filter((key) => key.startsWith(this.prefix))
          .map((key) => key.replace(`${this.prefix}_`, ''));
      } catch (error) {
        console.error('[CapacitorStorage] Failed to get keys:', error);
        return [];
      }
    } else {
      // Web fallback
      const keys: string[] = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.prefix)) {
            keys.push(key.replace(`${this.prefix}_`, ''));
          }
        }
      }
      return keys;
    }
  }

  /**
   * Set an object (serializes automatically)
   */
  public async setObject<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.setItem(key, serialized);
  }

  /**
   * Get an object (deserializes automatically)
   */
  public async getObject<T>(key: string): Promise<T | null> {
    const value = await this.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
}

// Singleton export
export const capacitorStorage = CapacitorStorage.getInstance();

// Zustand storage adapter for use with createJSONStorage
import type { StateStorage } from 'zustand/middleware';

/**
 * Create a Zustand-compatible storage adapter
 */
export function createCapacitorStorageAdapter(options?: CapacitorStorageOptions): StateStorage {
  const storage = CapacitorStorage.getInstance(options);

  return {
    getItem: async (name: string): Promise<string | null> => {
      return await storage.getItem(name);
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await storage.setItem(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
      await storage.removeItem(name);
    },
  };
}

export default capacitorStorage;
