import { Capacitor } from '@capacitor/core';

class OfflineService {
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private handleOnline() {
    this.isOnline = true;
    this.notifyListeners();
  }

  private handleOffline() {
    this.isOnline = false;
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.isOnline));
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async cacheResponse(url: string, response: Response): Promise<void> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('api-cache-v1');
        const clonedResponse = response.clone();
        await cache.put(url, clonedResponse);
      } catch (error) {
        console.warn('[OfflineService] Failed to cache response:', error);
      }
    }
  }

  async getCachedResponse(url: string): Promise<Response | null> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('api-cache-v1');
        const cached = await cache.match(url);
        return cached || null;
      } catch (error) {
        console.warn('[OfflineService] Failed to get cached response:', error);
        return null;
      }
    }
    return null;
  }

  async fetchWithOffline(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options);

    // Cache successful GET requests
    if (response.ok && (!options || options.method === 'GET' || !options.method)) {
      this.cacheResponse(url, response.clone());
    }

    return response;
  }

  async fetchWithFallback(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    try {
      // Try network first
      const response = await this.fetchWithOffline(url, options);
      return response;
    } catch (error) {
      // If offline or fetch fails, try cache
      const cached = await this.getCachedResponse(url);
      if (cached) {
        return cached;
      }
      throw error;
    }
  }
}

export const offlineService = new OfflineService();

// React hook for offline status
import { useState, useEffect } from 'react';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(offlineService.getStatus());

  useEffect(() => {
    return offlineService.subscribe(setIsOnline);
  }, []);

  return isOnline;
}

export default offlineService;
