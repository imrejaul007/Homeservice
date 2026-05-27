import { PushNotifications } from '@capacitor/push-notifications';
import type { Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { offlineSync, type ActionType } from './OfflineSync';

const MAX_QUEUE_SIZE = 500;
const MAX_QUEUE_AGE_DAYS = 7;
const PERMISSION_KEY = 'notification_permission';

const loadPermission = (): string => {
  try {
    const stored = localStorage.getItem(PERMISSION_KEY);
    return stored ? JSON.parse(stored) : 'default';
  } catch {
    return 'default';
  }
};

const savePermission = (permission: string): void => {
  localStorage.setItem(PERMISSION_KEY, JSON.stringify(permission));
};

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    type?: 'booking' | 'message' | 'promotion' | 'system';
    bookingId?: string;
    providerId?: string;
    url?: string;
    [key: string]: unknown;
  };
}

interface QueuedNotification {
  id: string;
  payload: NotificationPayload;
  timestamp: number;
  queuedAt: number;
  status: 'pending' | 'dismissed';
}

class NotificationService {
  private initialized = false;
  private deviceToken: string | null = null;
  private offlineQueue: Map<string, QueuedNotification> = new Map();
  private readonly OFFLINE_QUEUE_KEY = 'nilin_offline_notifications';

  constructor() {
    this.loadOfflineQueue();
    this.setupNetworkListeners();
  }

  /**
   * Load queued notifications from storage
   */
  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (stored) {
        const parsed: [string, QueuedNotification][] = JSON.parse(stored);
        this.offlineQueue = new Map(parsed);
        // Prune any old or excess notifications on load
        this.pruneQueue();
      }
    } catch (error) {
      console.error('[Notifications] Failed to load offline queue:', error);
      this.offlineQueue = new Map();
    }
  }

  /**
   * Save offline queue to storage
   */
  private saveOfflineQueue(): void {
    try {
      const entries = Array.from(this.offlineQueue.entries());
      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[Notifications] Failed to save offline queue:', error);
    }
  }

  /**
   * Prune old and excess notifications from the queue
   * - Removes notifications older than MAX_QUEUE_AGE_DAYS
   * - Enforces MAX_QUEUE_SIZE limit by removing oldest
   */
  private pruneQueue(): void {
    const cutoff = Date.now() - MAX_QUEUE_AGE_DAYS * 24 * 60 * 60 * 1000;
    let prunedCount = 0;

    // First, remove expired notifications
    for (const [id, notification] of this.offlineQueue) {
      if (notification.queuedAt < cutoff) {
        this.offlineQueue.delete(id);
        prunedCount++;
      }
    }

    // Then, enforce max size by removing oldest
    while (this.offlineQueue.size > MAX_QUEUE_SIZE) {
      const oldest = this.getOldestQueuedNotification();
      if (oldest) {
        this.offlineQueue.delete(oldest.id);
        prunedCount++;
      } else {
        break;
      }
    }

    if (prunedCount > 0) {
      console.log(`[Notifications] Pruned ${prunedCount} notifications from queue`);
      this.saveOfflineQueue();
    }
  }

  /**
   * Setup network listeners for online/offline handling
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handle coming back online
   */
  private handleOnline(): void {
    console.log('[Notifications] Back online, processing queued notifications');
    this.processQueuedNotifications();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    console.log('[Notifications] Gone offline');
  }

  /**
   * Process all queued notifications
   */
  private async processQueuedNotifications(): Promise<void> {
    const queued = Array.from(this.offlineQueue.values()).filter(
      (n) => n.status === 'pending'
    );

    for (const notification of queued) {
      try {
        // Dismiss the notification via backend
        await this.dismissNotificationBackend(notification.id);
        notification.status = 'dismissed';
      } catch (error) {
        console.error('[Notifications] Failed to dismiss queued notification:', error);
      }
    }

    this.saveOfflineQueue();
  }

  /**
   * Dismiss notification via backend API
   */
  private async dismissNotificationBackend(notificationId: string): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('Cannot dismiss notification while offline');
    }

    // Get auth tokens
    const getTokens = () => {
      try {
        const stored = sessionStorage.getItem('auth-storage');
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed?.state?.tokens || null;
      } catch {
        return null;
      }
    };

    const tokens = getTokens();
    if (!tokens?.accessToken) {
      console.log('[Notifications] Not authenticated, skipping dismiss');
      return;
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/notifications/${notificationId}/dismiss`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to dismiss notification: ${response.status}`);
    }
  }

  /**
   * Queue a notification for later dismissal when offline
   */
  private queueNotificationForLaterDismissal(notificationId: string, payload: NotificationPayload): void {
    if (!navigator.onLine) {
      // Prune queue before adding new item (handles age and size limits)
      this.pruneQueue();

      // Check size limit (redundant but explicit)
      if (this.offlineQueue.size >= MAX_QUEUE_SIZE) {
        const oldest = this.getOldestQueuedNotification();
        if (oldest) {
          this.offlineQueue.delete(oldest.id);
          console.log('[Notifications] Removed oldest notification to make room:', oldest.id);
        }
      }

      const queuedNotification: QueuedNotification = {
        id: notificationId,
        payload,
        timestamp: Date.now(),
        queuedAt: Date.now(),
        status: 'pending',
      };
      this.offlineQueue.set(notificationId, queuedNotification);
      this.saveOfflineQueue();

      // Also queue for offline sync
      offlineSync.queueAction(
        'notification_dismiss' as ActionType,
        { id: notificationId },
        { notificationPayload: payload }
      );

      console.log('[Notifications] Notification queued for later dismissal:', notificationId);
    }
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[Notifications] Not running on native platform, skipping initialization');
      return;
    }

    if (this.initialized) {
      console.log('[Notifications] Already initialized');
      return;
    }

    try {
      // Check and request permission
      const permission = await this.requestPermission();

      if (permission !== 'granted') {
        console.log('[Notifications] Permission not granted:', permission);
        return;
      }

      // Register for push notifications
      await this.register();
      this.initialized = true;
    } catch (error) {
      console.error('[Notifications] Failed to initialize:', error);
    }
  }

  private async requestPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const result = await PushNotifications.requestPermissions();
      const permission = result.receive === 'granted' ? 'granted' : 'denied';
      savePermission(permission);
      return permission;
    } catch (error) {
      console.error('[Notifications] Permission request failed:', error);
      return 'denied';
    }
  }

  private async register(): Promise<void> {
    // Add listener for registration
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('[Notifications] Device token:', token.value);
      this.deviceToken = token.value;
      this.registerTokenWithBackend(token.value);
    });

    // Add listener for registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Notifications] Registration error:', error);
    });

    // Add listener for push notifications received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Notifications] Received while foreground:', notification);
      this.handleForegroundNotification(notification);
    });

    // Add listener for when user taps on notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Notifications] Action performed:', action);
      this.handleNotificationAction(action);
    });

    // Register with APNs/FCM
    await PushNotifications.register();
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      // Get tokens from sessionStorage (same pattern as api.ts)
      const getTokens = () => {
        try {
          const stored = sessionStorage.getItem('auth-storage');
          if (!stored) return null;
          const parsed = JSON.parse(stored);
          return parsed?.state?.tokens || null;
        } catch {
          return null;
        }
      };

      const tokens = getTokens();
      if (!tokens?.accessToken) {
        console.log('[Notifications] Not authenticated, skipping token registration');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          token,
          platform: Capacitor.getPlatform(),
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
        }),
      });

      if (response.ok) {
        console.log('[Notifications] Device token registered with backend');
      } else {
        console.error('[Notifications] Failed to register token with backend:', response.status);
      }
    } catch (error) {
      console.error('[Notifications] Error registering token:', error);
    }
  }

  private handleForegroundNotification(notification: PushNotificationSchema): void {
    const { title, body, data } = notification;

    // Check if we're offline
    if (!navigator.onLine) {
      console.log('[Notifications] Offline, queueing foreground notification');
      // Queue the notification for later processing
      const notificationId = (data?.id as string) || `offline_${Date.now()}`;
      this.queueNotificationForLaterDismissal(notificationId, {
        title: title || '',
        body: body || '',
        data: data as NotificationPayload['data'],
      });

      // Still show a local toast to inform the user
      toast('You\'re offline. This notification will be processed when you\'re back online.', {
        duration: 4000,
        position: 'top-right',
        icon: '📴',
      });
      return;
    }

    // Show toast notification using react-hot-toast
    toast(body || 'New notification', {
      duration: 5000,
      position: 'top-right',
      icon: '🔔',
    });

    // Handle notification data click
    if (data?.url) {
      this.handleNotificationClick(data as Record<string, unknown>);
    }
  }

  private handleNotificationAction(action: ActionPerformed): void {
    const notificationData = action.notification.data;
    this.handleNotificationClick(notificationData as Record<string, unknown>);
  }

  private handleNotificationClick(data?: Record<string, unknown>): void {
    if (!data) return;

    const url = data.url as string;
    if (url) {
      // Dispatch deep link event
      window.dispatchEvent(new CustomEvent('capacitor-deep-link', {
        detail: { url }
      }));
    }
  }

  async unregister(): Promise<void> {
    try {
      await PushNotifications.unregister();
      this.deviceToken = null;
      this.initialized = false;
      console.log('[Notifications] Unregistered from push notifications');
    } catch (error) {
      console.error('[Notifications] Failed to unregister:', error);
    }
  }

  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the number of queued offline notifications
   */
  getOfflineQueueSize(): number {
    return Array.from(this.offlineQueue.values()).filter(
      (n) => n.status === 'pending'
    ).length;
  }

  /**
   * Get the total queue size (including dismissed)
   */
  getQueueSize(): number {
    return this.offlineQueue.size;
  }

  /**
   * Manually prune the notification queue
   * Removes expired (>7 days) and excess (>500) notifications
   */
  manualPrune(): void {
    this.pruneQueue();
  }

  /**
   * Get the oldest queued notification
   */
  getOldestQueuedNotification(): QueuedNotification | null {
    let oldest: QueuedNotification | null = null;
    let oldestTime = Infinity;

    this.offlineQueue.forEach((item) => {
      if (item.queuedAt < oldestTime) {
        oldestTime = item.queuedAt;
        oldest = item;
      }
    });

    return oldest;
  }

  /**
   * Clear the offline notification queue
   */
  clearOfflineQueue(): void {
    this.offlineQueue.clear();
    this.saveOfflineQueue();
  }

  /**
   * Get all queued offline notifications
   */
  getQueuedNotifications(): QueuedNotification[] {
    return Array.from(this.offlineQueue.values()).filter(
      (n) => n.status === 'pending'
    );
  }

  /**
   * Manually sync queued notifications (when coming back online)
   */
  async syncQueuedNotifications(): Promise<{ success: number; failed: number }> {
    const queued = this.getQueuedNotifications();
    let success = 0;
    let failed = 0;

    for (const notification of queued) {
      try {
        await this.dismissNotificationBackend(notification.id);
        notification.status = 'dismissed';
        success++;
      } catch (error) {
        console.error('[Notifications] Failed to sync notification:', notification.id, error);
        failed++;
      }
    }

    this.saveOfflineQueue();
    return { success, failed };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export hook for React components
export function useNotifications() {
  return {
    initialize: () => notificationService.initialize(),
    unregister: () => notificationService.unregister(),
    getToken: () => notificationService.getDeviceToken(),
    getOfflineQueueSize: () => notificationService.getOfflineQueueSize(),
    getQueueSize: () => notificationService.getQueueSize(),
    getOldestQueuedNotification: () => notificationService.getOldestQueuedNotification(),
    clearOfflineQueue: () => notificationService.clearOfflineQueue(),
    syncQueuedNotifications: () => notificationService.syncQueuedNotifications(),
    pruneQueue: () => notificationService.manualPrune(),
  };
}

export default notificationService;
