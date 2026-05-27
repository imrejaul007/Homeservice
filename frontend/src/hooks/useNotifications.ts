/**
 * useNotifications Hook
 *
 * React hook for managing push notifications with permission status tracking,
 * token management, notification handlers, and notification center access.
 *
 * P0 FIX: Proper cleanup of intervals and race condition fixes with isInitialized
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  advancedNotifications,
  type NotificationCenterItem,
  type NotificationAnalytics,
} from '../services/AdvancedNotificationService';

// =============================================================================
// Types
// =============================================================================

export interface UseNotificationsOptions {
  /** Auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Callback when new notification arrives */
  onNewNotification?: (notification: NotificationCenterItem) => void;
  /** Callback when permission changes */
  onPermissionChange?: (status: 'granted' | 'denied' | 'prompt' | 'unknown') => void;
}

export interface UseNotificationsReturn {
  // State
  isInitialized: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
  deviceToken: string | null;
  notifications: NotificationCenterItem[];
  unreadCount: number;
  analytics: NotificationAnalytics;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  requestPermission: () => Promise<'granted' | 'denied'>;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => void;
  clearAll: () => void;
  refreshToken: () => Promise<void>;
  unsubscribe: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    autoInitialize = true,
    onNewNotification,
    onPermissionChange,
  } = options;

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationCenterItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [analytics, setAnalytics] = useState<NotificationAnalytics>({
    received: 0,
    displayed: 0,
    dismissed: 0,
    clicked: 0,
    byType: {},
  });
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // P0 FIX: Ref to track initialization state to avoid stale closure race conditions
  const isInitializingRef = useRef(false);
  // P0 FIX: Ref to track if component is still mounted
  const isMountedRef = useRef(true);

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the notification service
   * P0 FIX: Uses refs to prevent race conditions with stale closure
   */
  const initialize = useCallback(async () => {
    // P0 FIX: Prevent concurrent initialization attempts
    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;
    setIsLoading(true);

    try {
      await advancedNotifications.initialize();

      // P0 FIX: Check if component is still mounted before updating state
      if (isMountedRef.current) {
        setIsInitialized(advancedNotifications.isInitialized());
        setPermissionStatus(advancedNotifications.getPermissionStatus());
        setDeviceToken(advancedNotifications.getDeviceToken());
        setNotifications(advancedNotifications.getNotificationCenter());
        setUnreadCount(advancedNotifications.getUnreadCount());
        setAnalytics(advancedNotifications.getAnalytics());
      }
    } catch (error) {
      console.error('[useNotifications] Failed to initialize:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isInitializingRef.current = false;
    }
  }, []);

  // ==========================================================================
  // Permission Management
  // ==========================================================================

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<'granted' | 'denied'> => {
    setIsLoading(true);
    try {
      const result = await advancedNotifications.requestPermission();
      const newStatus = advancedNotifications.getPermissionStatus();
      setPermissionStatus(newStatus);
      onPermissionChange?.(newStatus);

      if (result === 'granted') {
        setDeviceToken(advancedNotifications.getDeviceToken());
      }

      return result;
    } catch (error) {
      console.error('[useNotifications] Permission request failed:', error);
      return 'denied';
    } finally {
      setIsLoading(false);
    }
  }, [onPermissionChange]);

  // ==========================================================================
  // Notification Management
  // ==========================================================================

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback((notificationId: string) => {
    advancedNotifications.markAsRead(notificationId);
    setNotifications(advancedNotifications.getNotificationCenter());
    setUnreadCount(advancedNotifications.getUnreadCount());
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    await advancedNotifications.markAllAsRead();
    setNotifications(advancedNotifications.getNotificationCenter());
    setUnreadCount(0);
  }, []);

  /**
   * Delete notification
   */
  const deleteNotification = useCallback((notificationId: string) => {
    advancedNotifications.deleteNotification(notificationId);
    setNotifications(advancedNotifications.getNotificationCenter());
    setUnreadCount(advancedNotifications.getUnreadCount());
  }, []);

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    advancedNotifications.clearAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  /**
   * Refresh device token
   */
  const refreshToken = useCallback(async () => {
    await advancedNotifications.refreshToken();
    setDeviceToken(advancedNotifications.getDeviceToken());
  }, []);

  /**
   * Unsubscribe from notifications
   * P0 FIX: Also resets mounted ref
   */
  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    isMountedRef.current = false;
  }, []);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // P0 FIX: Auto-initialize on mount with proper cleanup
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }

    // P0 FIX: Cleanup on unmount - set mounted flag to false
    return () => {
      isMountedRef.current = false;
    };
  }, [autoInitialize, initialize]);

  // P0 FIX: Subscribe to new notifications with proper cleanup
  useEffect(() => {
    if (onNewNotification) {
      unsubscribeRef.current = advancedNotifications.subscribe((notification) => {
        // P0 FIX: Check if still mounted before calling callback
        if (isMountedRef.current) {
          onNewNotification(notification);
        }
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [onNewNotification]);

  // Listen for permission changes
  useEffect(() => {
    const handlePermissionChange = (event: CustomEvent) => {
      const newStatus = event.detail?.status as 'granted' | 'denied' | 'prompt' | 'unknown';
      setPermissionStatus(newStatus);
      onPermissionChange?.(newStatus);
    };

    window.addEventListener('notification-permission-change', handlePermissionChange as EventListener);

    return () => {
      window.removeEventListener('notification-permission-change', handlePermissionChange as EventListener);
    };
  }, [onPermissionChange]);

  // Listen for FCM token refresh
  useEffect(() => {
    const handleTokenRefresh = (event: CustomEvent) => {
      const token = event.detail?.token;
      if (token) {
        setDeviceToken(token);
      }
    };

    window.addEventListener('fcm-token-refresh', handleTokenRefresh as EventListener);

    return () => {
      window.removeEventListener('fcm-token-refresh', handleTokenRefresh as EventListener);
    };
  }, []);

  // Event-based updates instead of polling - much more efficient for battery
  useEffect(() => {
    const updateState = () => {
      // P0 FIX: Check if component is still mounted
      if (isMountedRef.current) {
        setNotifications(advancedNotifications.getNotificationCenter());
        setUnreadCount(advancedNotifications.getUnreadCount());
        setAnalytics(advancedNotifications.getAnalytics());
      }
    };

    const unsubscribe = advancedNotifications.subscribeToStateChanges(updateState);

    // Initial state load
    updateState();

    return unsubscribe;
  }, []);

  // P0 FIX: Fallback: Long-interval sync only for edge cases (e.g., missed events)
  // This is a safety net, not the primary update mechanism
  // Uses refs to avoid stale closure issues
  useEffect(() => {
    const FALLBACK_INTERVAL_MS = 60000; // 60 seconds - much better than 5s

    const interval = setInterval(() => {
      // P0 FIX: Use ref instead of state to avoid stale closure
      if (isMountedRef.current && isInitializingRef.current === false) {
        setNotifications(advancedNotifications.getNotificationCenter());
        setUnreadCount(advancedNotifications.getUnreadCount());
        setAnalytics(advancedNotifications.getAnalytics());
      }
    }, FALLBACK_INTERVAL_MS);

    return () => {
      // P0 FIX: Always clear interval on cleanup
      clearInterval(interval);
    };
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    isInitialized,
    permissionStatus,
    deviceToken,
    notifications,
    unreadCount,
    analytics,
    isLoading,

    // Actions
    initialize,
    requestPermission,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refreshToken,
    unsubscribe,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for notification permission status
 */
export function useNotificationPermission() {
  const { permissionStatus, requestPermission, isInitialized } = useNotifications({
    autoInitialize: false,
  });

  return {
    status: permissionStatus,
    isGranted: permissionStatus === 'granted',
    isDenied: permissionStatus === 'denied',
    isPrompt: permissionStatus === 'prompt',
    isUnknown: permissionStatus === 'unknown',
    requestPermission,
    isInitialized,
  };
}

/**
 * Hook for notification center
 */
export function useNotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications({
    autoInitialize: false,
  });

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}

/**
 * Hook for device token
 */
export function useDeviceToken() {
  const { deviceToken, refreshToken, isInitialized } = useNotifications({
    autoInitialize: false,
  });

  return {
    token: deviceToken,
    hasToken: !!deviceToken,
    refreshToken,
    isInitialized,
  };
}

/**
 * Hook for notification analytics
 */
export function useNotificationAnalytics() {
  const { analytics } = useNotifications({
    autoInitialize: false,
  });

  return {
    analytics,
    totalReceived: analytics.received,
    totalDisplayed: analytics.displayed,
    totalClicked: analytics.clicked,
    clickThroughRate: analytics.displayed > 0
      ? (analytics.clicked / analytics.displayed) * 100
      : 0,
    byType: analytics.byType,
  };
}

export default useNotifications;
