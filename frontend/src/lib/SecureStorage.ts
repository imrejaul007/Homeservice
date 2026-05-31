/**
 * SecureStorage.ts - Enterprise-grade encrypted storage for NILIN app
 * Uses EncryptedSharedPreferences pattern for Android via Capacitor
 * Falls back to sessionStorage with base64 encoding for web
 */

import { Capacitor } from '@capacitor/core';

// CapacitorSecureStorage interface for type safety
interface CapacitorSecureStoragePlugin {
  keys(): Promise<{ value: string[] }>;
  get(key: string): Promise<{ value: string }>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// Try to import the secure storage plugin
let CapacitorSecureStorage: CapacitorSecureStoragePlugin | null = null;
try {
  // Dynamic import for optional dependency
  CapacitorSecureStorage = require('@capacitor-community/secure-storage').SecureStorage;
} catch {
  // Plugin not available, will use fallback
}

export interface SecureStorageOptions {
  encrypt?: boolean;
  ttl?: number; // Time-to-live in milliseconds
}

interface StorageItem<T = unknown> {
  value: T;
  timestamp: number;
  ttl?: number;
}

class SecureStorageService {
  private static instance: SecureStorageService;
  private isCapacitor: boolean;
  private memoryCache: Map<string, string>;
  private useCapacitorStorage: boolean = false;
  private capacitorStorageReady: boolean = false;
  private isBrowser: boolean;

  private constructor() {
    // FIX #12: Added SSR guard - check for browser environment before accessing Capacitor
    this.isBrowser = typeof window !== 'undefined';
    this.isCapacitor = this.isBrowser ? Capacitor.isNativePlatform() : false;
    this.memoryCache = new Map();

    // Initialize Capacitor Secure Storage if available
    if (this.isCapacitor) {
      this.initializeCapacitorStorage();
    }
  }

  /**
   * Initialize Capacitor Secure Storage
   */
  private async initializeCapacitorStorage(): Promise<void> {
    try {
      // Check if the secure storage plugin is available
      if (CapacitorSecureStorage) {
        await CapacitorSecureStorage.keys();
        this.useCapacitorStorage = true;
        this.capacitorStorageReady = true;
        console.log('[SecureStorage] Capacitor Secure Storage initialized');
      } else {
        throw new Error('Secure storage not available');
      }
    } catch {
      console.warn('[SecureStorage] Capacitor Secure Storage not available, using fallback');
      this.useCapacitorStorage = false;
      this.capacitorStorageReady = true;
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  /**
   * Check if we're on a native platform
   */
  public isNative(): boolean {
    return this.isCapacitor;
  }

  /**
   * Simple base64 encoding (browser-safe)
   */
  private base64Encode(str: string): string {
    try {
      // Use btoa for basic encoding
      const encoded = btoa(str);
      // Make it URL-safe by replacing characters
      return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch {
      // Fallback for Unicode strings
      const utf8 = encodeURIComponent(str);
      return btoa(utf8);
    }
  }

  /**
   * Simple base64 decoding
   */
  private base64Decode(str: string): string {
    // Restore standard base64
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }

    try {
      return atob(base64);
    } catch {
      // Fallback for Unicode strings
      try {
        return decodeURIComponent(atob(base64));
      } catch {
        return atob(base64); // Return what we have
      }
    }
  }

  /**
   * Set an item in secure storage
   */
  public async setItem(key: string, value: string, options?: SecureStorageOptions): Promise<boolean> {
    try {
      const storageKey = `nilin_${key}`;
      const timestamp = Date.now();
      const ttl = options?.ttl;

      // Create storage item with metadata
      const item: StorageItem<string> = {
        value,
        timestamp,
        ttl,
      };

      const serialized = JSON.stringify(item);

      if (this.useCapacitorStorage && CapacitorSecureStorage) {
        try {
          await CapacitorSecureStorage.set(storageKey, serialized);
          this.memoryCache.set(storageKey, serialized);
          return true;
        } catch {
          // Fall through to fallback
        }
      }

      // Fallback to sessionStorage with encoding (SSR guard)
      if (this.isBrowser) {
        const encoded = this.base64Encode(serialized);
        sessionStorage.setItem(storageKey, encoded);
        this.memoryCache.set(storageKey, encoded);
      }
      return true;
    } catch (error) {
      console.error('[SecureStorage] Failed to set item:', error);
      return false;
    }
  }

  /**
   * Get an item from secure storage
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      const storageKey = `nilin_${key}`;

      // Check memory cache first
      if (this.memoryCache.has(storageKey)) {
        const cached = this.memoryCache.get(storageKey)!;

        if (this.useCapacitorStorage) {
          try {
            const item = JSON.parse(cached) as StorageItem<string>;
            if (this.isItemExpired(item)) {
              await this.removeItem(key);
              return null;
            }
            return item.value;
          } catch {
            return null;
          }
        } else {
          // Decode from sessionStorage
          const decoded = this.base64Decode(cached);
          const item = JSON.parse(decoded) as StorageItem<string>;
          if (this.isItemExpired(item)) {
            await this.removeItem(key);
            return null;
          }
          return item.value;
        }
      }

      if (this.useCapacitorStorage && CapacitorSecureStorage) {
        try {
          const result = await CapacitorSecureStorage.get(storageKey);
          if (result.value) {
            const item = JSON.parse(result.value) as StorageItem<string>;
            if (this.isItemExpired(item)) {
              await this.removeItem(key);
              return null;
            }
            this.memoryCache.set(storageKey, result.value);
            return item.value;
          }
          return null;
        } catch {
          // Fall through to fallback
        }
      }

      // Fallback to sessionStorage (SSR guard)
      if (!this.isBrowser) return null;

      const encoded = sessionStorage.getItem(storageKey);
      if (!encoded) return null;

      const decoded = this.base64Decode(encoded);
      const item = JSON.parse(decoded) as StorageItem<string>;

      if (this.isItemExpired(item)) {
        await this.removeItem(key);
        return null;
      }

      this.memoryCache.set(storageKey, encoded);
      return item.value;
    } catch (error) {
      console.error('[SecureStorage] Failed to get item:', error);
      return null;
    }
  }

  /**
   * Check if an item has expired
   */
  private isItemExpired(item: StorageItem): boolean {
    if (!item.ttl) return false;
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * Remove an item from secure storage
   * FIX #12: Added SSR guard for sessionStorage access
   */
  public async removeItem(key: string): Promise<boolean> {
    try {
      const storageKey = `nilin_${key}`;

      if (this.useCapacitorStorage && CapacitorSecureStorage) {
        try {
          await CapacitorSecureStorage.remove(storageKey);
        } catch {
          // Continue to fallback
        }
      }

      // SSR guard: Only access sessionStorage in browser
      if (this.isBrowser) {
        sessionStorage.removeItem(storageKey);
      }
      this.memoryCache.delete(storageKey);
      return true;
    } catch (error) {
      console.error('[SecureStorage] Failed to remove item:', error);
      return false;
    }
  }

  /**
   * Clear all secure storage
   * FIX #12: Added SSR guard for sessionStorage access
   */
  public async clear(): Promise<boolean> {
    try {
      if (this.useCapacitorStorage && CapacitorSecureStorage) {
        try {
          const storedKeys = await CapacitorSecureStorage.keys();
          for (const key of storedKeys.value) {
            if (key.startsWith('nilin_')) {
              await CapacitorSecureStorage.remove(key);
            }
          }
        } catch {
          // Continue to fallback
        }
      }

      // SSR guard: Only access sessionStorage in browser
      if (this.isBrowser) {
        // Clear sessionStorage items with our prefix
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith('nilin_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => sessionStorage.removeItem(key));
      }

      // Clear memory cache
      this.memoryCache.clear();

      return true;
    } catch (error) {
      console.error('[SecureStorage] Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Get all keys in secure storage
   * FIX #12: Added SSR guard for sessionStorage access
   */
  public async keys(): Promise<string[]> {
    try {
      const keys: string[] = [];

      if (this.useCapacitorStorage && CapacitorSecureStorage) {
        try {
          const result = await CapacitorSecureStorage.keys();
          for (const key of result.value) {
            if (key.startsWith('nilin_')) {
              keys.push(key.replace('nilin_', ''));
            }
          }
          return keys;
        } catch {
          // Fall through to fallback
        }
      }

      // SSR guard: Only access sessionStorage in browser
      if (this.isBrowser) {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith('nilin_')) {
            keys.push(key.replace('nilin_', ''));
          }
        }
      }

      return keys;
    } catch (error) {
      console.error('[SecureStorage] Failed to get keys:', error);
      return [];
    }
  }

  /**
   * Set object value (serializes automatically)
   */
  public async setObject<T>(key: string, value: T, options?: SecureStorageOptions): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      return this.setItem(key, serialized, options);
    } catch (error) {
      console.error('[SecureStorage] Failed to set object:', error);
      return false;
    }
  }

  /**
   * Get object value (deserializes automatically)
   */
  public async getObject<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[SecureStorage] Failed to get object:', error);
      return null;
    }
  }

  /**
   * Check if a key exists
   */
  public async hasItem(key: string): Promise<boolean> {
    const value = await this.getItem(key);
    return value !== null;
  }
}

// Export singleton instance
export const secureStorage = SecureStorageService.getInstance();

// Export class for testing
export { SecureStorageService };

// Default export
export default secureStorage;
