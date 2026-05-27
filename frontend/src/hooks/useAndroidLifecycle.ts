/**
 * useAndroidLifecycle Hook
 *
 * React hook for interacting with Android lifecycle events.
 * Provides crash recovery, sync triggers, and app state information.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

// Types
export interface CrashRecoveryData {
  timestamp: number;
  crashCount: number;
  anrCount: number;
  lastCrashStack?: string;
}

export interface AppState {
  isActive: boolean;
  isInBackground: boolean;
  lastActiveTime: number | null;
  lastBackgroundTime: number | null;
  backgroundDuration: number | null;
}

export interface UseAndroidLifecycleReturn {
  appState: AppState;
  crashRecovery: CrashRecoveryData | null;
  lastSyncTime: number | null;
  triggerSync: () => void;
  dismissCrashRecovery: () => void;
}

const INITIAL_APP_STATE: AppState = {
  isActive: true,
  isInBackground: false,
  lastActiveTime: null,
  lastBackgroundTime: null,
  backgroundDuration: null,
};

/**
 * Hook for Android lifecycle management
 */
export function useAndroidLifecycle(): UseAndroidLifecycleReturn {
  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);
  const [crashRecovery, setCrashRecovery] = useState<CrashRecoveryData | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Track background/foreground state
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Web fallback - use document visibility
      const handleVisibilityChange = () => {
        const isVisible = document.visibilityState === 'visible';
        const now = Date.now();

        setAppState((prev) => ({
          ...prev,
          isActive: isVisible,
          isInBackground: !isVisible,
          lastActiveTime: isVisible ? now : prev.lastActiveTime,
          lastBackgroundTime: !isVisible ? now : prev.lastBackgroundTime,
          backgroundDuration: !isVisible && prev.lastActiveTime
            ? now - prev.lastActiveTime
            : prev.backgroundDuration,
        }));
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // Native platform - listen for app state events
    let cleanup: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        const { App } = await import('@capacitor/app');

        const subscription = await App.addListener('appStateChange', (state) => {
          const now = Date.now();
          const isActive = state.isActive;

          setAppState((prev) => ({
            ...prev,
            isActive,
            isInBackground: !isActive,
            lastActiveTime: isActive ? now : prev.lastActiveTime,
            lastBackgroundTime: !isActive ? now : prev.lastBackgroundTime,
            backgroundDuration: !isActive && prev.lastActiveTime
              ? now - prev.lastActiveTime
              : prev.backgroundDuration,
          }));
        });

        cleanup = () => subscription.remove();
      } catch (error) {
        console.warn('[useAndroidLifecycle] App plugin not available:', error);
      }
    };

    setupListeners();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Listen for crash recovery events
  useEffect(() => {
    const handleCrashRecovery = (event: CustomEvent<CrashRecoveryData>) => {
      console.log('[useAndroidLifecycle] Crash recovery event received:', event.detail);
      setCrashRecovery(event.detail);
    };

    window.addEventListener('app-crash-recovery', handleCrashRecovery as EventListener);

    return () => {
      window.removeEventListener('app-crash-recovery', handleCrashRecovery as EventListener);
    };
  }, []);

  // Listen for sync trigger events
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleSyncTrigger = () => {
      console.log('[useAndroidLifecycle] Sync trigger received');
      setLastSyncTime(Date.now());
    };

    window.addEventListener('nilin-sync-trigger', handleSyncTrigger);

    return () => {
      window.removeEventListener('nilin-sync-trigger', handleSyncTrigger);
    };
  }, []);

  // Dismiss crash recovery banner
  const dismissCrashRecovery = useCallback(() => {
    setCrashRecovery(null);
  }, []);

  // Trigger manual sync
  const triggerSync = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      // On native, this would call MainActivity.triggerSync()
      // For now, dispatch a custom event that native code can listen to
      window.dispatchEvent(new CustomEvent('nilin-sync-trigger'));
    }
    setLastSyncTime(Date.now());
  }, []);

  return {
    appState,
    crashRecovery,
    lastSyncTime,
    triggerSync,
    dismissCrashRecovery,
  };
}

/**
 * Hook for detecting if app was killed in background
 */
export function useBackgroundKillDetection() {
  const [wasKilledInBackground, setWasKilledInBackground] = useState(false);
  const backgroundStartRef = useRef<number | null>(null);

  const { appState } = useAndroidLifecycle();

  useEffect(() => {
    if (appState.isInBackground) {
      backgroundStartRef.current = Date.now();
    } else if (backgroundStartRef.current !== null) {
      // Coming back to foreground
      const backgroundDuration = Date.now() - backgroundStartRef.current;

      // If background duration > 30 minutes and we have crash recovery data,
      // the app might have been killed
      if (backgroundDuration > 30 * 60 * 1000) {
        setWasKilledInBackground(true);
      }

      backgroundStartRef.current = null;
    }
  }, [appState.isInBackground]);

  return wasKilledInBackground;
}

export default useAndroidLifecycle;
