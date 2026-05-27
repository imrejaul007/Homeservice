/**
 * Advanced Notification Service
 *
 * Enterprise-grade notification handling with rate limiting, analytics tracking,
 * permission management, device token management, and in-app notification center.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import toast from 'react-hot-toast';
import { offlineSync, type ActionType } from './OfflineSync';
import { notificationApi, type Notification } from './notificationApi';

// =============================================================================
// Types
// =============================================================================

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  data?: NotificationData;
}

export interface NotificationData {
  type?: 'booking' | 'message' | 'promotion' | 'system' | 'reminder' | 'sync' | 'clear_cache' | 'token_refresh';
  bookingId?: string;
  providerId?: string;
  url?: string;
  [key: string]: unknown;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface NotificationAnalytics {
  received: number;
  displayed: number;
  dismissed: number;
  clicked: number;
  byType: Record<string, number>;
}

export interface NotificationCenterItem extends Notification {
  isLocal: boolean;
  localId?: string;
}

interface QueuedNotification {
  id: string;
  payload: NotificationPayload;
  timestamp: number;
  status: 'pending' | 'dismissed';
}

// =============================================================================
// Constants
// =============================================================================

const RATE_LIMIT_MAX = 5; // Max notifications per type per minute
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const OFFLINE_QUEUE_KEY = 'nilin_offline_notifications';
const ANALYTICS_KEY = 'nilin_notification_analytics';
const TOKEN_STORAGE_KEY = 'nilin_fcm_token';
const CENTER_STORAGE_KEY = 'nilin_notification_center';
const PENDING_NOTIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours for stale pending notifications
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up rate limits every 5 minutes

// =============================================================================
// Advanced Notification Service
// =============================================================================

class AdvancedNotificationService {
  private initialized = false;
  private deviceToken: string | null = null;
  private offlineQueue: Map<string, QueuedNotification> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private analytics: NotificationAnalytics = {
    received: 0,
    displayed: 0,
    dismissed: 0,
    clicked: 0,
    byType: {},
  };
  private notificationCenter: NotificationCenterItem[] = [];
  private permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
  private listeners: Set<(notification: NotificationCenterItem) => void> = new Set();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
  private stateChangeListeners: Set<() => void> = new Set();

  constructor() {
    this.loadOfflineQueue();
    this.loadAnalytics();
    this.loadNotificationCenter();
    this.setupNetworkListeners();
    this.setupFCMTokenListener();
    this.startCleanupInterval();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[AdvancedNotifications] Not running on native platform, skipping');
      return;
    }

    if (this.initialized) {
      console.log('[AdvancedNotifications] Already initialized');
      return;
    }

    try {
      // Check permission status
      this.permissionStatus = await this.checkPermissionStatus();

      if (this.permissionStatus === 'granted') {
        await this.register();
        this.initialized = true;
      } else if (this.permissionStatus === 'prompt') {
        // Will request permission when user enables notifications
        console.log('[AdvancedNotifications] Permission not yet requested');
      } else {
        console.log('[AdvancedNotifications] Permission denied');
      }
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to initialize:', error);
    }
  }

  /**
   * Request notification permission (Android 13+)
   */
  async requestPermission(): Promise<'granted' | 'denied'> {
    if (!Capacitor.isNativePlatform()) {
      // In web, use Notification API
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        this.permissionStatus = permission === 'granted' ? 'granted' : 'denied';
        return this.permissionStatus;
      }
      return 'denied';
    }

    try {
      const result = await PushNotifications.requestPermissions();
      this.permissionStatus = result.receive === 'granted' ? 'granted' : 'denied';

      if (this.permissionStatus === 'granted') {
        await this.register();
        this.initialized = true;
      }

      return this.permissionStatus;
    } catch (error) {
      console.error('[AdvancedNotifications] Permission request failed:', error);
      return 'denied';
    }
  }

  /**
   * Check current permission status
   */
  async checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window) {
        return Notification.permission === 'granted' ? 'granted' :
               Notification.permission === 'denied' ? 'denied' : 'prompt';
      }
      return 'unknown';
    }

    try {
      const permission = await PushNotifications.checkPermissions();
      return permission.receive === 'granted' ? 'granted' :
             permission.receive === 'denied' ? 'denied' : 'prompt';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Register for push notifications
   */
  private async register(): Promise<void> {
    // Registration listener
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('[AdvancedNotifications] Device token:', token.value);
      this.deviceToken = token.value;
      this.saveDeviceToken(token.value);
      this.registerTokenWithBackend(token.value);
      this.notifyStateChange();
    });

    // Registration error listener
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[AdvancedNotifications] Registration error:', error);
      this.dispatchEvent('registration-error', error);
    });

    // Foreground notification listener
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      this.handleNotificationReceived(notification);
      this.notifyStateChange();
    });

    // Notification action listener (user taps notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      this.handleNotificationAction(action);
      this.notifyStateChange();
    });

    // Native token listener - handles both initial registration and token refresh
    // Note: Capacitor doesn't have a separate 'token' event; use 'registration' for token acquisition
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('[AdvancedNotifications] FCM token received:', token.value);
      this.deviceToken = token.value;
      this.saveDeviceToken(token.value);
      this.registerTokenWithBackend(token.value);
      this.notifyStateChange();
    });

    // Register with FCM
    await PushNotifications.register();
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  /**
   * Save device token locally
   * Uses sessionStorage instead of localStorage to prevent XSS token theft
   * Token is used for current session only and can be re-obtained on app restart
   */
  private saveDeviceToken(token: string): void {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to save token:', error);
    }
  }

  /**
   * Get stored device token
   * Uses sessionStorage for security (clears on tab close)
   * Falls back to memory cache if sessionStorage unavailable
   */
  getDeviceToken(): string | null {
    if (this.deviceToken) return this.deviceToken;

    try {
      // Primary: sessionStorage (secure, clears on tab close)
      this.deviceToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      // Fallback: in-memory only (for environments without sessionStorage)
      this.deviceToken = null;
    }

    return this.deviceToken;
  }

  /**
   * Register token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    const tokens = this.getAuthTokens();
    if (!tokens?.accessToken) {
      console.log('[AdvancedNotifications] Not authenticated, skipping token registration');
      return;
    }

    try {
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
        console.log('[AdvancedNotifications] Device token registered with backend');
      } else {
        console.error('[AdvancedNotifications] Failed to register token:', response.status);
      }
    } catch (error) {
      console.error('[AdvancedNotifications] Token registration error:', error);
    }
  }

  /**
   * Refresh token with backend
   */
  async refreshToken(): Promise<void> {
    const token = this.getDeviceToken();
    if (token) {
      await this.registerTokenWithBackend(token);
    }
  }

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  /**
   * Check if notification should be rate limited
   */
  private shouldRateLimit(type: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(type);

    if (!entry || now > entry.resetTime) {
      // New window
      this.rateLimits.set(type, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW_MS,
      });
      return false;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
      console.log(`[AdvancedNotifications] Rate limited: ${type} (${entry.count}/${RATE_LIMIT_MAX})`);
      return true;
    }

    entry.count++;
    return false;
  }

  /**
   * Reset rate limit for a type
   */
  resetRateLimit(type?: string): void {
    if (type) {
      this.rateLimits.delete(type);
    } else {
      this.rateLimits.clear();
    }
  }

  /**
   * Start periodic cleanup interval for rate limits and pending notifications
   */
  private startCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredRateLimits();
      this.cleanupStalePendingNotifications();
    }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up expired rate limit entries to prevent memory leaks
   */
  private cleanupExpiredRateLimits(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [type, entry] of this.rateLimits.entries()) {
      if (now > entry.resetTime) {
        this.rateLimits.delete(type);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[AdvancedNotifications] Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Clean up stale pending notifications that have been waiting too long
   */
  private cleanupStalePendingNotifications(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, notification] of this.offlineQueue.entries()) {
      if (notification.status === 'pending' && now - notification.timestamp > PENDING_NOTIFICATION_EXPIRY_MS) {
        // Mark as dismissed instead of deleting - keeps record for debugging
        notification.status = 'dismissed';
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[AdvancedNotifications] Cleaned up ${cleaned} stale pending notifications`);
      this.saveOfflineQueue();
    }
  }

  /**
   * Stop cleanup interval (for cleanup on unregister)
   */
  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  // ==========================================================================
  // Notification Handling
  // ==========================================================================

  /**
   * Handle notification received while in foreground
   */
  private handleNotificationReceived(notification: PushNotificationSchema): void {
    const { title, body, data } = notification;
    const type = (data?.type as string) || 'system';

    console.log('[AdvancedNotifications] Received:', title, body, data);

    // Update analytics
    this.trackAnalytics('received', type);

    // Check rate limit
    if (this.shouldRateLimit(type)) {
      console.log('[AdvancedNotifications] Skipping due to rate limit');
      return;
    }

    // Handle silent notifications
    if (data?.silent === true || data?.['silent'] === 'true') {
      this.handleSilentNotification(data);
      return;
    }

    // Create notification center item
    const centerItem: NotificationCenterItem = {
      _id: (data?.id as string) || `local_${Date.now()}`,
      userId: '',
      type: type as Notification['type'],
      title: title || '',
      message: body || '',
      isRead: false,
      isLocal: true,
      localId: `local_${Date.now()}`,
      data: data as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };

    // Add to notification center
    this.addToNotificationCenter(centerItem);

    // Display toast
    this.displayToast(title || 'Notification', body || '', data);

    // Track analytics
    this.trackAnalytics('displayed', type);

    // Notify listeners
    this.notifyListeners(centerItem);
  }

  /**
   * Handle silent notification
   */
  private handleSilentNotification(data: NotificationData): void {
    const type = data.type;

    switch (type) {
      case 'sync':
        // Trigger background sync
        offlineSync.syncPendingActions();
        break;

      case 'clear_cache':
        // Clear local caches
        this.clearLocalCaches();
        break;

      case 'token_refresh':
        // Refresh FCM token
        this.refreshToken();
        break;

      default:
        console.log('[AdvancedNotifications] Unknown silent notification type:', type);
    }
  }

  /**
   * Handle notification action (user tap)
   */
  private handleNotificationAction(action: ActionPerformed): void {
    const notificationData = action.notification.data;
    const type = (notificationData?.type as string) || 'system';

    console.log('[AdvancedNotifications] Action performed:', action);

    // Update analytics
    this.trackAnalytics('clicked', type);

    // Mark as read if exists
    if (notificationData?.id) {
      this.markAsRead(notificationData.id as string);
    }

    // Handle deep link
    if (notificationData?.url) {
      this.handleDeepLink(notificationData.url as string);
    } else if (notificationData?.bookingId) {
      this.handleDeepLink(`nilin://open/booking/${notificationData.bookingId}`);
    }
  }

  /**
   * Display toast notification
   */
  private displayToast(title: string, body: string, data?: NotificationData): void {
    const icon = this.getToastIcon(data?.type);

    toast(body || title, {
      duration: 5000,
      position: 'top-right',
      icon,
      style: {
        background: '#333',
        color: '#fff',
      },
    });

    // Play sound if available
    this.playNotificationSound();
  }

  /**
   * Get toast icon based on notification type
   */
  private getToastIcon(type?: string): string {
    switch (type) {
      case 'booking':
        return '📅';
      case 'promotion':
        return '🎁';
      case 'reminder':
        return '⏰';
      case 'message':
        return '💬';
      default:
        return '🔔';
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    try {
      // Could play a custom sound here
      // Using system default by not specifying
    } catch {
      // Ignore sound errors
    }
  }

  /**
   * Handle deep link from notification
   */
  private handleDeepLink(url: string): void {
    window.dispatchEvent(new CustomEvent('capacitor-deep-link', {
      detail: { url }
    }));
  }

  // ==========================================================================
  // Notification Center
  // ==========================================================================

  /**
   * Add notification to local center
   */
  private addToNotificationCenter(item: NotificationCenterItem): void {
    this.notificationCenter.unshift(item);

    // Keep only last 100 notifications
    if (this.notificationCenter.length > 100) {
      this.notificationCenter = this.notificationCenter.slice(0, 100);
    }

    this.saveNotificationCenter();
  }

  /**
   * Load notification center from storage
   */
  private loadNotificationCenter(): void {
    try {
      const stored = localStorage.getItem(CENTER_STORAGE_KEY);
      if (stored) {
        this.notificationCenter = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to load notification center:', error);
      this.notificationCenter = [];
    }
  }

  /**
   * Save notification center to storage
   */
  private saveNotificationCenter(): void {
    try {
      localStorage.setItem(CENTER_STORAGE_KEY, JSON.stringify(this.notificationCenter));
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to save notification center:', error);
    }
  }

  /**
   * Get all notifications from center
   */
  getNotificationCenter(): NotificationCenterItem[] {
    return this.notificationCenter;
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.notificationCenter.filter(n => !n.isRead).length;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const index = this.notificationCenter.findIndex(
      n => n._id === notificationId || n.localId === notificationId
    );

    if (index !== -1 && !this.notificationCenter[index].isRead) {
      this.notificationCenter[index].isRead = true;
      this.notificationCenter[index].readAt = new Date().toISOString();
      this.saveNotificationCenter();
    }

    // Also mark on server if not local
    if (!notificationId.startsWith('local_')) {
      this.markAsReadOnServer(notificationId);
    }
  }

  /**
   * Mark notification as read on server
   */
  private async markAsReadOnServer(notificationId: string): Promise<void> {
    try {
      await notificationApi.markAsRead(notificationId);
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to mark as read on server:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    this.notificationCenter.forEach(n => {
      n.isRead = true;
      n.readAt = new Date().toISOString();
    });

    this.saveNotificationCenter();

    try {
      await notificationApi.markAllAsRead();
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to mark all as read:', error);
    }
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId: string): void {
    this.notificationCenter = this.notificationCenter.filter(
      n => n._id !== notificationId && n.localId !== notificationId
    );
    this.saveNotificationCenter();

    // Also delete from server if not local
    if (!notificationId.startsWith('local_')) {
      this.deleteNotificationOnServer(notificationId);
    }
  }

  /**
   * Delete notification on server
   */
  private async deleteNotificationOnServer(notificationId: string): Promise<void> {
    try {
      await notificationApi.deleteNotification(notificationId);
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to delete on server:', error);
    }
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    this.notificationCenter = [];
    this.saveNotificationCenter();
  }

  /**
   * Subscribe to new notifications
   */
  subscribe(callback: (notification: NotificationCenterItem) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(notification: NotificationCenterItem): void {
    this.listeners.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[AdvancedNotifications] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Offline Handling
  // ==========================================================================

  /**
   * Setup network listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handle going online
   */
  private handleOnline(): void {
    console.log('[AdvancedNotifications] Back online, processing queued notifications');
    this.processOfflineQueue();
    this.syncWithServer();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    console.log('[AdvancedNotifications] Gone offline');
  }

  /**
   * Load offline queue from storage
   */
  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        const parsed: [string, QueuedNotification][] = JSON.parse(stored);
        this.offlineQueue = new Map(parsed);
      }
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to load offline queue:', error);
      this.offlineQueue = new Map();
    }
  }

  /**
   * Save offline queue to storage
   */
  private saveOfflineQueue(): void {
    try {
      const entries = Array.from(this.offlineQueue.entries());
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to save offline queue:', error);
    }
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    const queued = Array.from(this.offlineQueue.values()).filter(n => n.status === 'pending');

    for (const notification of queued) {
      try {
        if (!notification.id.startsWith('local_')) {
          await notificationApi.markAsRead(notification.id);
        }
        notification.status = 'dismissed';
      } catch (error) {
        console.error('[AdvancedNotifications] Failed to process queued notification:', error);
      }
    }

    this.saveOfflineQueue();
  }

  /**
   * Sync with server
   */
  private async syncWithServer(): Promise<void> {
    try {
      // Fetch latest notifications from server
      const response = await notificationApi.getNotifications({ limit: 50 });

      if (response.success && response.data) {
        // Merge server notifications with local
        const serverIds = new Set(response.data.notifications.map(n => n._id));

        // Add server notifications that aren't local
        response.data.notifications.forEach(serverNotification => {
          const exists = this.notificationCenter.some(
            n => n._id === serverNotification._id
          );

          if (!exists) {
            this.notificationCenter.push({
              ...serverNotification,
              isLocal: false,
            });
          }
        });

        // Sort by created date
        this.notificationCenter.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        this.saveNotificationCenter();
      }
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to sync with server:', error);
    }
  }

  // ==========================================================================
  // FCM Token Listener
  // ==========================================================================

  /**
   * Setup FCM token refresh listener for web/hybrid environments
   */
  private setupFCMTokenListener(): void {
    window.addEventListener('fcm-token-refresh', ((event: CustomEvent) => {
      const token = event.detail?.token;
      if (token) {
        console.log('[AdvancedNotifications] FCM token refreshed via custom event:', token);
        this.deviceToken = token;
        this.saveDeviceToken(token);
        this.registerTokenWithBackend(token);
        this.notifyStateChange();
      }
    }) as EventListener);
  }

  // ==========================================================================
  // Analytics
  // ==========================================================================

  /**
   * Load analytics from storage
   */
  private loadAnalytics(): void {
    try {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      if (stored) {
        this.analytics = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to load analytics:', error);
    }
  }

  /**
   * Save analytics to storage
   */
  private saveAnalytics(): void {
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(this.analytics));
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to save analytics:', error);
    }
  }

  /**
   * Track analytics event
   */
  trackAnalytics(event: keyof Omit<NotificationAnalytics, 'byType'>, type?: string): void {
    switch (event) {
      case 'received':
        this.analytics.received++;
        break;
      case 'displayed':
        this.analytics.displayed++;
        break;
      case 'dismissed':
        this.analytics.dismissed++;
        break;
      case 'clicked':
        this.analytics.clicked++;
        break;
    }

    if (type) {
      this.analytics.byType[type] = (this.analytics.byType[type] || 0) + 1;
    }

    this.saveAnalytics();
  }

  /**
   * Get analytics
   */
  getAnalytics(): NotificationAnalytics {
    return { ...this.analytics };
  }

  /**
   * Reset analytics
   */
  resetAnalytics(): void {
    this.analytics = {
      received: 0,
      displayed: 0,
      dismissed: 0,
      clicked: 0,
      byType: {},
    };
    this.saveAnalytics();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get auth tokens from sessionStorage
   */
  private getAuthTokens(): { accessToken: string; refreshToken: string } | null {
    try {
      const stored = sessionStorage.getItem('auth-storage');
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return parsed?.state?.tokens || null;
    } catch {
      return null;
    }
  }

  /**
   * Clear local caches
   */
  private clearLocalCaches(): void {
    this.notificationCenter = [];
    this.saveNotificationCenter();
    this.offlineQueue.clear();
    this.saveOfflineQueue();
    console.log('[AdvancedNotifications] Local caches cleared');
  }

  /**
   * Dispatch custom event
   */
  private dispatchEvent(eventName: string, data?: unknown): void {
    window.dispatchEvent(new CustomEvent(`notification-${eventName}`, { detail: data }));
  }

  /**
   * Notify all state change listeners - enables event-based updates instead of polling
   */
  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[AdvancedNotifications] State change listener error:', error);
      }
    });
  }

  /**
   * Subscribe to state changes - use this instead of polling for updates
   * Returns unsubscribe function
   */
  subscribeToStateChanges(callback: () => void): () => void {
    this.stateChangeListeners.add(callback);
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  /**
   * Unregister from push notifications
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await PushNotifications.unregister();
      this.deviceToken = null;
      this.initialized = false;
      this.stopCleanupInterval();
      console.log('[AdvancedNotifications] Unregistered from push notifications');
    } catch (error) {
      console.error('[AdvancedNotifications] Failed to unregister:', error);
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get permission status
   */
  getPermissionStatus(): 'granted' | 'denied' | 'prompt' | 'unknown' {
    return this.permissionStatus;
  }

  /**
   * Get offline queue size
   */
  getOfflineQueueSize(): number {
    return Array.from(this.offlineQueue.values()).filter(n => n.status === 'pending').length;
  }

  // ==========================================================================
  // Logout Cleanup
  // ==========================================================================

  /**
   * Clear all notification data on logout
   * Removes offline queue, notification center, and resets analytics
   * This ensures no notification data leaks between user sessions
   */
  async clearOnLogout(): Promise<void> {
    console.log('[AdvancedNotifications] Clearing notification data on logout');

    try {
      // Clear offline queue
      this.offlineQueue.clear();
      try {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      } catch (error) {
        console.error('[AdvancedNotifications] Failed to clear offline queue storage:', error);
      }

      // Clear notification center
      this.notificationCenter = [];
      try {
        localStorage.removeItem(CENTER_STORAGE_KEY);
      } catch (error) {
        console.error('[AdvancedNotifications] Failed to clear notification center storage:', error);
      }

      // Reset rate limits (user-specific)
      this.rateLimits.clear();

      // Reset analytics for new user
      this.analytics = {
        received: 0,
        displayed: 0,
        dismissed: 0,
        clicked: 0,
        byType: {},
      };
      try {
        localStorage.removeItem(ANALYTICS_KEY);
      } catch (error) {
        console.error('[AdvancedNotifications] Failed to clear analytics storage:', error);
      }

      // Clear device token (force re-registration on next login)
      this.deviceToken = null;
      try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch (error) {
        console.error('[AdvancedNotifications] Failed to clear token storage:', error);
      }

      // Stop cleanup interval
      this.stopCleanupInterval();

      // Reset initialized state (allows re-init on next login)
      this.initialized = false;

      console.log('[AdvancedNotifications] Notification data cleared on logout');
    } catch (error) {
      console.error('[AdvancedNotifications] Error during logout cleanup:', error);
    }
  }

  /**
   * Get notification storage statistics for monitoring
   * Useful for debugging storage usage
   */
  getStorageStats(): {
    offlineQueueSize: number;
    notificationCenterSize: number;
    analyticsTotal: number;
  } {
    return {
      offlineQueueSize: this.offlineQueue.size,
      notificationCenterSize: this.notificationCenter.length,
      analyticsTotal: this.analytics.received + this.analytics.displayed +
                     this.analytics.dismissed + this.analytics.clicked,
    };
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const advancedNotifications = new AdvancedNotificationService();
export default advancedNotifications;
