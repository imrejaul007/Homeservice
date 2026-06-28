/**
 * Admin Notification Service
 * WebSocket-based notification service for admin panel
 */

import { socketService, ServerToClientEvents, ClientToServerEvents } from './socket';
import { notificationApi } from './notificationApi';
import type { AdminNotification, AdminNotificationType, NotificationPriority } from '../types/notification';

// Event callback types
type NotificationCallback = (notification: AdminNotification) => void;
type UnreadCountCallback = (count: number) => void;

/**
 * Admin-specific notification event types for WebSocket
 */
interface AdminServerToClientEvents extends ServerToClientEvents {
  'admin:notification': (data: {
    id: string;
    type: AdminNotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    category?: string;
    data?: Record<string, unknown>;
    timestamp: Date;
  }) => void;
  'admin:unread_count': (data: { count: number }) => void;
  'admin:dispute_new': (data: {
    disputeId: string;
    bookingId: string;
    disputeNumber: string;
    category: string;
    priority: string;
  }) => void;
  'admin:refund_request': (data: {
    refundId: string;
    bookingId: string;
    amount: number;
    currency: string;
    reason?: string;
  }) => void;
  'admin:provider_suspended': (data: {
    providerId: string;
    providerName: string;
    reason: string;
    until?: Date;
  }) => void;
  'admin:sla_violation': (data: {
    bookingId: string;
    bookingNumber: string;
    slaType: string;
    violationMinutes: number;
  }) => void;
  'admin:new_withdrawal_request': (data: {
    withdrawalId: string;
    providerId: string;
    providerName: string;
    amount: number;
    currency: string;
    requestedAt: Date;
  }) => void;
}

class AdminNotificationService {
  private isConnected = false;
  private listeners: Set<NotificationCallback> = new Set();
  private unreadCountListeners: Set<UnreadCountCallback> = new Set();
  private unreadCount = 0;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.setupSocketListeners();
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupSocketListeners(): void {
    // Handle admin notifications
    socketService.on('admin:notification' as keyof ServerToClientEvents, (data: unknown) => {
      const notificationData = data as {
        id: string;
        type: AdminNotificationType;
        title: string;
        message: string;
        priority?: NotificationPriority;
        category?: string;
        data?: Record<string, unknown>;
        timestamp: Date;
      };

      const notification: AdminNotification = {
        id: notificationData.id,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        isRead: false,
        priority: notificationData.priority || 'normal',
        category: (notificationData.category as AdminNotification['category']) || 'system',
        data: notificationData.data,
        createdAt: new Date(notificationData.timestamp).toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle new disputes
    socketService.on('dispute:new' as keyof ServerToClientEvents, (data: unknown) => {
      const disputeData = data as {
        disputeId: string;
        bookingId: string;
        disputeNumber: string;
        category: string;
        priority: string;
      };

      const notification: AdminNotification = {
        id: `dispute_${disputeData.disputeId}`,
        type: 'new_dispute',
        title: 'New Dispute Filed',
        message: `Dispute #${disputeData.disputeNumber} - ${disputeData.category}`,
        isRead: false,
        priority: disputeData.priority === 'high' ? 'high' : 'normal',
        category: 'dispute',
        data: {
          entityId: disputeData.disputeId,
          entityType: 'dispute',
          bookingId: disputeData.bookingId,
        },
        createdAt: new Date().toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle refund requests
    socketService.on('admin:refund_request' as keyof ServerToClientEvents, (data: unknown) => {
      const refundData = data as {
        refundId: string;
        bookingId: string;
        amount: number;
        currency: string;
        reason?: string;
      };

      const notification: AdminNotification = {
        id: `refund_${refundData.refundId}`,
        type: 'refund_request',
        title: 'Refund Request',
        message: `Refund request for ${refundData.currency} ${refundData.amount.toFixed(2)}${refundData.reason ? `: ${refundData.reason}` : ''}`,
        isRead: false,
        priority: 'normal',
        category: 'payment',
        data: {
          entityId: refundData.refundId,
          entityType: 'refund',
          bookingId: refundData.bookingId,
          amount: refundData.amount,
          currency: refundData.currency,
          reason: refundData.reason,
        },
        createdAt: new Date().toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle provider suspension
    socketService.on('provider:suspended' as keyof ServerToClientEvents, (data: unknown) => {
      const suspendData = data as {
        providerId: string;
        reason: string;
        until?: Date;
      };

      const notification: AdminNotification = {
        id: `suspend_${suspendData.providerId}_${Date.now()}`,
        type: 'provider_suspended',
        title: 'Provider Suspended',
        message: `Provider account has been suspended${suspendData.until ? ` until ${new Date(suspendData.until).toLocaleDateString()}` : ''}${suspendData.reason ? `: ${suspendData.reason}` : ''}`,
        isRead: false,
        priority: 'high',
        category: 'provider',
        data: {
          entityId: suspendData.providerId,
          entityType: 'provider',
        },
        createdAt: new Date().toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle SLA violations
    socketService.on('admin:sla_violation' as keyof ServerToClientEvents, (data: unknown) => {
      const slaData = data as {
        bookingId: string;
        bookingNumber: string;
        slaType: string;
        violationMinutes: number;
      };

      const notification: AdminNotification = {
        id: `sla_${slaData.bookingId}_${Date.now()}`,
        type: 'sla_violation',
        title: 'SLA Violation',
        message: `${slaData.slaType} violation on booking #${slaData.bookingNumber} - ${slaData.violationMinutes} minutes overdue`,
        isRead: false,
        priority: 'urgent',
        category: 'booking',
        data: {
          entityId: slaData.bookingId,
          entityType: 'booking',
          bookingId: slaData.bookingId,
        },
        createdAt: new Date().toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle new withdrawal requests
    socketService.on('admin:new_withdrawal_request' as keyof ServerToClientEvents, (data: unknown) => {
      const withdrawalData = data as {
        withdrawalId: string;
        providerId: string;
        providerName: string;
        amount: number;
        currency: string;
        requestedAt: Date;
      };

      const notification: AdminNotification = {
        id: `withdrawal_${withdrawalData.withdrawalId}`,
        type: 'new_withdrawal_request',
        title: 'New Withdrawal Request',
        message: `${withdrawalData.providerName} requested withdrawal of ${withdrawalData.currency} ${withdrawalData.amount.toFixed(2)}`,
        isRead: false,
        priority: 'normal',
        category: 'payment',
        data: {
          entityId: withdrawalData.withdrawalId,
          entityType: 'withdrawal',
          providerId: withdrawalData.providerId,
          amount: withdrawalData.amount,
          currency: withdrawalData.currency,
        },
        createdAt: new Date(withdrawalData.requestedAt).toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle new provider submissions
    socketService.on('admin:new_provider_submission' as keyof ServerToClientEvents, (data: unknown) => {
      const providerData = data as {
        providerId: string;
        providerName: string;
        submittedAt: Date;
      };

      const notification: AdminNotification = {
        id: `provider_${providerData.providerId}_${Date.now()}`,
        type: 'new_provider_submission',
        title: 'New Provider Submission',
        message: `${providerData.providerName} has submitted their application for review`,
        isRead: false,
        priority: 'normal',
        category: 'provider',
        data: {
          entityId: providerData.providerId,
          entityType: 'provider',
        },
        createdAt: new Date(providerData.submittedAt).toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Handle new service pending
    socketService.on('admin:new_service_pending' as keyof ServerToClientEvents, (data: unknown) => {
      const serviceData = data as {
        serviceId: string;
        providerId: string;
        serviceName: string;
      };

      const notification: AdminNotification = {
        id: `service_${serviceData.serviceId}_${Date.now()}`,
        type: 'new_service_pending',
        title: 'New Service Pending',
        message: `Service "${serviceData.serviceName}" is pending approval`,
        isRead: false,
        priority: 'normal',
        category: 'provider',
        data: {
          entityId: serviceData.serviceId,
          entityType: 'service',
          providerId: serviceData.providerId,
        },
        createdAt: new Date().toISOString(),
      };

      this.notifyListeners(notification);
      this.incrementUnreadCount();
    });

    // Connection state handling
    socketService.onConnect(() => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[AdminNotificationService] Connected');
    });

    socketService.onDisconnect(() => {
      this.isConnected = false;
      console.log('[AdminNotificationService] Disconnected');
    });
  }

  /**
   * Connect to the notification service
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await socketService.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[AdminNotificationService] Connected successfully');
    } catch (error) {
      console.error('[AdminNotificationService] Connection failed:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the notification service
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isConnected = false;
    console.log('[AdminNotificationService] Disconnected');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[AdminNotificationService] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      console.log(`[AdminNotificationService] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to real-time notifications
   */
  onNotification(callback: NotificationCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to unread count changes
   */
  onUnreadCountChange(callback: UnreadCountCallback): () => void {
    this.unreadCountListeners.add(callback);
    // Immediately notify with current count
    callback(this.unreadCount);
    return () => {
      this.unreadCountListeners.delete(callback);
    };
  }

  /**
   * Get current unread count
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Fetch notifications from API
   */
  async getNotifications(options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<{
    notifications: AdminNotification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const response = await notificationApi.getNotifications(options);

      if (response.success) {
        const notifications = response.data.notifications.map((n) => ({
          id: n._id || n.id || '',
          type: (n.type as AdminNotificationType) || 'system',
          title: n.title || 'Notification',
          message: n.message || '',
          isRead: n.isRead ?? false,
          priority: 'normal' as NotificationPriority,
          category: 'system' as AdminNotification['category'],
          data: n.data,
          createdAt: n.createdAt || new Date().toISOString(),
          readAt: n.readAt,
        }));

        this.unreadCount = response.data.unreadCount;
        this.notifyUnreadCountListeners();

        return {
          notifications,
          total: response.data.total,
          unreadCount: response.data.unreadCount,
        };
      }

      return { notifications: [], total: 0, unreadCount: 0 };
    } catch (error) {
      console.error('[AdminNotificationService] Failed to fetch notifications:', error);
      return { notifications: [], total: 0, unreadCount: 0 };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const response = await notificationApi.markAsRead(notificationId);

      if (response.success) {
        if (this.unreadCount > 0) {
          this.unreadCount--;
          this.notifyUnreadCountListeners();
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('[AdminNotificationService] Failed to mark as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<boolean> {
    try {
      const response = await notificationApi.markAllAsRead();

      if (response.success) {
        this.unreadCount = 0;
        this.notifyUnreadCountListeners();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[AdminNotificationService] Failed to mark all as read:', error);
      return false;
    }
  }

  /**
   * Get unread count from API
   */
  async fetchUnreadCount(): Promise<number> {
    try {
      const response = await notificationApi.getUnreadCount();

      if (response.success) {
        this.unreadCount = response.data.count;
        this.notifyUnreadCountListeners();
        return this.unreadCount;
      }

      return 0;
    } catch (error) {
      console.error('[AdminNotificationService] Failed to fetch unread count:', error);
      return 0;
    }
  }

  /**
   * Notify all listeners of new notification
   */
  private notifyListeners(notification: AdminNotification): void {
    this.listeners.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[AdminNotificationService] Listener error:', error);
      }
    });
  }

  /**
   * Notify all unread count listeners
   */
  private notifyUnreadCountListeners(): void {
    this.unreadCountListeners.forEach((callback) => {
      try {
        callback(this.unreadCount);
      } catch (error) {
        console.error('[AdminNotificationService] Unread count listener error:', error);
      }
    });
  }

  /**
   * Increment unread count
   */
  private incrementUnreadCount(): void {
    this.unreadCount++;
    this.notifyUnreadCountListeners();
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const adminNotificationService = new AdminNotificationService();

export default adminNotificationService;
