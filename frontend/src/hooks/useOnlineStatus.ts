import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Online Status Hook
 *
 * Tracks device online/offline status using:
 * - Browser navigator.onLine API
 * - Capacitor App plugin for native detection
 *
 * Provides callbacks for state changes and a goOnline method
 * to programmatically trigger online status.
 */
interface UseOnlineStatusOptions {
  /** Initial online status (defaults to navigator.onLine) */
  initialStatus?: boolean;
  /** Debounce delay for status changes (ms) */
  debounceMs?: number;
  /** Enable Capacitor native detection */
  useCapacitor?: boolean;
  /** Callback when status changes to online */
  onOnline?: () => void;
  /** Callback when status changes to offline */
  onOffline?: () => void;
  /** Health check endpoint URL */
  healthEndpoint?: string;
}

interface UseOnlineStatusReturn {
  /** Current online status */
  isOnline: boolean;
  /** Connection quality status: 'online', 'slow', or 'offline' */
  status: 'online' | 'slow' | 'offline';
  /** Whether the device was previously offline */
  wasOffline: boolean;
  /** Whether the status is currently being checked */
  isChecking: boolean;
  /** Callback to manually trigger online status */
  goOnline: () => void;
  /** Force check the current status */
  checkStatus: () => Promise<boolean>;
  /** Last time status was checked */
  lastChecked: Date | null;
  /** Effective connection type (if available) */
  effectiveType?: string;
}

export function useOnlineStatus(options: UseOnlineStatusOptions = {}): UseOnlineStatusReturn {
  const {
    initialStatus = typeof navigator !== 'undefined' ? navigator.onLine : true,
    debounceMs = 100,
    useCapacitor = Capacitor.isNativePlatform(),
    onOnline,
    onOffline,
    healthEndpoint = '/api/health',
  } = options;

  const [isOnline, setIsOnline] = useState(initialStatus);
  const [status, setStatus] = useState<'online' | 'slow' | 'offline'>('online');
  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined);
  const [wasOffline, setWasOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(isOnline);
  const wasOfflineRef = useRef(false);

  /**
   * Check connection quality using Network Information API
   * Returns 'slow' for 2g/slow-2g connections
   */
  const checkConnectionQuality = useCallback(() => {
    if (typeof navigator === 'undefined') {
      return;
    }

    // Check Network Information API if available
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        addEventListener: (event: string, handler: () => void) => void;
        removeEventListener: (event: string, handler: () => void) => void;
      };
    }).connection;

    if (connection?.effectiveType) {
      setEffectiveType(connection.effectiveType);

      // Mark as slow if on 2g or slow-2g
      if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
        setStatus('slow');
        return;
      }
    }

    // Also check RTT (round-trip time) as a fallback quality indicator
    if (connection && 'rtt' in connection) {
      const rtt = (connection as { rtt?: number }).rtt;
      // Consider connections with high latency as slow
      if (rtt && rtt > 1000) { // > 1 second RTT
        setStatus('slow');
        return;
      }
    }

    // Default to online
    setStatus(isOnline ? 'online' : 'offline');
  }, [isOnline]);

  // Keep refs in sync
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    wasOfflineRef.current = wasOffline;
  }, [wasOffline]);

  /**
   * Check actual connectivity by attempting a lightweight request
   */
  const checkStatus = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);

    try {
      // Use navigator.onLine as a quick check
      const browserOnline = navigator.onLine;

      // For native apps, also try to ping the server
      if (useCapacitor && browserOnline) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          // Try to reach the API
          const response = await fetch(healthEndpoint, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache',
          });

          clearTimeout(timeoutId);
          return response.ok;
        } catch {
          // If fetch fails but browser says online, we might be in a captive portal
          // or have limited connectivity
          return navigator.onLine;
        }
      }

      return browserOnline;
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, [useCapacitor, healthEndpoint]);

  /**
   * Handle coming back online
   */
  const handleOnline = useCallback(() => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Debounce the status change
    debounceTimerRef.current = setTimeout(() => {
      setIsOnline(true);
      // Check connection quality after coming online
      checkConnectionQuality();

      if (wasOfflineRef.current) {
        setWasOffline(false);
      }

      onOnline?.();
    }, debounceMs);
  }, [debounceMs, onOnline, checkConnectionQuality]);

  /**
   * Handle going offline
   */
  const handleOffline = useCallback(() => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setIsOnline(false);
    setStatus('offline');
    setWasOffline(true);
    onOffline?.();
  }, [onOffline]);

  /**
   * Manually trigger online status (e.g., after a successful sync)
   */
  const goOnline = useCallback(() => {
    if (!isOnlineRef.current) {
      setIsOnline(true);
      // Check connection quality after coming online
      checkConnectionQuality();
      if (wasOfflineRef.current) {
        setWasOffline(false);
      }
      onOnline?.();
    }
  }, [onOnline, checkConnectionQuality]);

  // Set up event listeners
  useEffect(() => {
    // Browser events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up connection quality change listener (Network Information API)
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        addEventListener: (event: string, handler: () => void) => void;
        removeEventListener: (event: string, handler: () => void) => void;
      };
    }).connection;

    const handleConnectionChange = () => {
      checkConnectionQuality();
    };

    if (connection?.addEventListener) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Capacitor App plugin for native detection
    let capacitorSubscription: { remove: () => void } | null = null;

    if (useCapacitor) {
      try {
        App.addListener('appStateChange', (state) => {
          // App is active and network should be available
          if (state.isActive) {
            handleOnline();
          } else {
            // App is backgrounded - don't treat as offline
            // The browser's online/offline events will handle actual connectivity
          }
        }).then((subscription) => {
          capacitorSubscription = subscription;
        }).catch(() => {
          // App plugin not available or failed
        });
      } catch {
        // Capacitor not available
      }
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection?.removeEventListener) {
        connection.removeEventListener('change', handleConnectionChange);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (capacitorSubscription) {
        capacitorSubscription.remove();
      }
    };
  }, [handleOnline, handleOffline, useCapacitor, checkConnectionQuality]);

  // Initial status check on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      if (!navigator.onLine) {
        setIsOnline(false);
        setStatus('offline');
        setWasOffline(true);
      } else {
        // Check connection quality on initial load
        checkConnectionQuality();
      }
    }
  }, [checkConnectionQuality]);

  return {
    isOnline,
    status,
    effectiveType,
    wasOffline,
    isChecking,
    goOnline,
    checkStatus,
    lastChecked,
  };
}

export default useOnlineStatus;

/**
 * Hook to track if we're in a "just came back online" state
 * Useful for triggering sync operations
 */
export function useOnlineSync(triggerOnline: boolean, onSync: () => Promise<void>) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (triggerOnline && !hasSynced.current) {
      hasSynced.current = true;
      setIsSyncing(true);

      onSync()
        .then(() => {
          setLastSynced(new Date());
        })
        .catch((error) => {
          console.error('Online sync failed:', error);
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }

    // Reset when going offline
    if (!triggerOnline) {
      hasSynced.current = false;
    }
  }, [triggerOnline, onSync]);

  return {
    isSyncing,
    lastSynced,
  };
}
