/**
 * useServiceWorker Hook
 *
 * Hook for managing service worker registration and background sync.
 * Enables background sync for offline actions when the service worker supports it.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

// Extended registration info we want to track
export interface SWRegistrationInfo {
  /** The raw service worker registration */
  registration: ServiceWorkerRegistration | null;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Whether a new service worker is waiting to activate */
  waitingWorker: ServiceWorker | null;
  /** The active service worker */
  activeWorker: ServiceWorker | null;
}

export interface UseServiceWorkerReturn {
  /** Service worker registration info */
  registrationInfo: SWRegistrationInfo | null;
  /** Whether service worker is supported */
  isSupported: boolean;
  /** Whether service worker is registered */
  isRegistered: boolean;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Registration error if any */
  error: Error | null;
  /** Force update the service worker */
  update: () => Promise<void>;
  /** Register for background sync */
  registerSync: (tag: string) => Promise<boolean>;
  /** Request notification permission for background sync */
  requestNotificationPermission: () => Promise<NotificationPermission>;
  /** Check if push is supported */
  isPushSupported: boolean;
  /** Skip waiting and activate new service worker immediately */
  skipWaiting: () => void;
}

// =============================================================================
// Background Sync Manager interface (not in standard TypeScript lib)
// =============================================================================

interface SyncManager {
  register(tag: string): Promise<void>;
}

interface BackgroundSyncManager {
  register(tag: string): Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useServiceWorker(): UseServiceWorkerReturn {
  const [registrationInfo, setRegistrationInfo] = useState<SWRegistrationInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPushSupported, setIsPushSupported] = useState(false);

  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check for push support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsPushSupported('PushManager' in window);
    }
  }, []);

  // Register service worker
  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const registerSW = async () => {
      try {
        const swUrl = '/sw.js'; // Standard service worker location

        const reg = await navigator.serviceWorker.register(swUrl, {
          scope: '/',
        });

        registrationRef.current = reg;

        setRegistrationInfo({
          registration: reg,
          updateAvailable: false,
          waitingWorker: reg.waiting,
          activeWorker: reg.active,
        });

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New service worker available
                setUpdateAvailable(true);
                setRegistrationInfo((prev) => prev ? {
                  ...prev,
                  updateAvailable: true,
                  waitingWorker: reg.waiting,
                } : null);
              }
            });
          }
        });

        // Handle controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Reload to activate new service worker
          window.location.reload();
        });

        console.log('[ServiceWorker] Registered successfully');
      } catch (err) {
        console.error('[ServiceWorker] Registration failed:', err);
        setError(err instanceof Error ? err : new Error('Registration failed'));
      }
    };

    registerSW();

    return () => {
      // Cleanup if needed
    };
  }, [isSupported]);

  // Update service worker
  const update = useCallback(async (): Promise<void> => {
    if (!registrationRef.current) {
      throw new Error('Service worker not registered');
    }

    try {
      await registrationRef.current.update();
      setUpdateAvailable(false);
      console.log('[ServiceWorker] Updated');
    } catch (err) {
      console.error('[ServiceWorker] Update failed:', err);
      throw err;
    }
  }, []);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (registrationRef.current?.waiting) {
      registrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  }, []);

  // Register for background sync
  const registerSync = useCallback(async (tag: string): Promise<boolean> => {
    if (!registrationRef.current) {
      console.warn('[ServiceWorker] Not registered, cannot register sync');
      return false;
    }

    try {
      // Try to use Background Sync API
      const sync = (registrationRef.current as unknown as { sync: BackgroundSyncManager | null }).sync;

      if (sync && 'register' in sync) {
        await (sync as SyncManager).register(tag);
        console.log(`[ServiceWorker] Sync registered: ${tag}`);
        return true;
      }

      // Fallback: if Background Sync not supported, we'll sync immediately
      console.log('[ServiceWorker] Background sync not supported, will sync immediately');
      return false;
    } catch (err) {
      console.error('[ServiceWorker] Sync registration failed:', err);
      return false;
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[ServiceWorker] Notification permission:', permission);
      return permission;
    } catch (err) {
      console.error('[ServiceWorker] Notification permission request failed:', err);
      return 'denied';
    }
  }, []);

  return {
    registrationInfo,
    isSupported,
    isRegistered: registrationInfo !== null,
    updateAvailable,
    error,
    update,
    registerSync,
    requestNotificationPermission,
    isPushSupported,
    skipWaiting,
  };
}

// =============================================================================
// Background Sync Helper
// =============================================================================

/**
 * Schedule a background sync when supported
 * Call this after queuing an offline action
 */
export async function scheduleBackgroundSync(tag: string = 'offline-actions'): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return false;
  }

  try {
    const registration = navigator.serviceWorker.ready;
    const reg = await registration;

    if ('sync' in reg) {
      await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
      console.log(`[BackgroundSync] Scheduled: ${tag}`);
      return true;
    }
  } catch (err) {
    console.error('[BackgroundSync] Failed to schedule:', err);
  }

  return false;
}

/**
 * Check if background sync is supported
 */
export function isBackgroundSyncSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'SyncManager' in window
  );
}

export default useServiceWorker;
