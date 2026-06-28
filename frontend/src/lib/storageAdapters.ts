/**
 * Shared storage adapter utilities for Zustand stores
 * Provides consistent cross-platform (Capacitor/Web) storage behavior
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { type StateStorage } from 'zustand/middleware';

/**
 * Capacitor-safe Zustand storage adapter
 * Uses Capacitor Preferences on native platforms, falls back to localStorage on web
 */
export const capacitorStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Preferences.get({ key: name });
        return result.value;
      } catch {
        return null;
      }
    }
    // Browser fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(name);
    }
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: name, value });
    } else {
      // Browser fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: name });
    } else {
      // Browser fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    }
  },
};

/**
 * Check if storage quota is exceeded
 * @param error The error to check
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'QuotaExceededError' ||
      error.message.includes('QuotaExceededError') ||
      error.message.includes('storage limit');
  }
  return false;
}

/**
 * Create a storage adapter with quota exceeded handling
 * @param adapter The base storage adapter
 * @param onQuotaExceeded Optional callback when quota is exceeded
 */
export function createQuotaSafeAdapter(
  adapter: StateStorage,
  onQuotaExceeded?: () => void
): StateStorage {
  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        return await adapter.getItem(name);
      } catch (error) {
        console.error(`Storage getItem error for "${name}":`, error);
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        await adapter.setItem(name, value);
      } catch (error) {
        if (isQuotaExceededError(error)) {
          console.error(`Storage quota exceeded for "${name}"`);
          onQuotaExceeded?.();
        } else {
          console.error(`Storage setItem error for "${name}":`, error);
        }
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await adapter.removeItem(name);
      } catch (error) {
        console.error(`Storage removeItem error for "${name}":`, error);
      }
    },
  };
}