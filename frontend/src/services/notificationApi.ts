import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export interface Notification {
  _id: string;
  userId: string;
  type: 'booking' | 'payment' | 'review' | 'system' | 'promotion';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: string;
  readAt?: string;
}

export type NotificationType = 'booking' | 'payment' | 'review' | 'promotion' | 'system';

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface NotificationPreferencesResponse {
  email?: {
    bookingUpdates?: boolean;
    reminders?: boolean;
    promotions?: boolean;
    marketing?: boolean;
    newsletters?: boolean;
    loyaltyUpdates?: boolean;
  };
  sms?: {
    bookingUpdates?: boolean;
    reminders?: boolean;
    promotions?: boolean;
    newMessages?: boolean;
  };
  push?: {
    bookingUpdates?: boolean;
    reminders?: boolean;
    promotions?: boolean;
    newMessages?: boolean;
    marketing?: boolean;
  };
  quietHours?: QuietHours;
}

// =============================================================================
// Response Interfaces
// =============================================================================

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    total: number;
    unreadCount: number;
  };
}

interface NotificationResponse {
  success: boolean;
  data: {
    notification: Notification;
  };
}

interface PreferencesResponse {
  success: boolean;
  data: NotificationPreferencesResponse;
}

class NotificationApiService {
  /**
   * Get all notifications
   */
  async getNotifications(options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.unreadOnly) params.append('unreadOnly', 'true');

    const queryString = params.toString();
    const url = queryString ? `/notifications?${queryString}` : '/notifications';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<{ success: boolean; data: { count: number } }> {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<NotificationResponse> {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/notifications/mark-all-read');
    return response.data;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(): Promise<{ success: boolean; message: string }> {
    const response = await api.delete('/notifications/read');
    return response.data;
  }

  // =============================================================================
  // Preferences
  // =============================================================================

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<PreferencesResponse> {
    const response = await api.get('/notifications/preferences');
    return response.data;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: {
    email?: {
      bookingUpdates?: boolean;
      reminders?: boolean;
      promotions?: boolean;
      marketing?: boolean;
      newsletters?: boolean;
    };
    sms?: {
      bookingUpdates?: boolean;
      reminders?: boolean;
      promotions?: boolean;
    };
    push?: {
      bookingUpdates?: boolean;
      reminders?: boolean;
      promotions?: boolean;
      newMessages?: boolean;
    };
    quietHours?: QuietHours;
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.patch('/notifications/preferences', preferences);
    return response.data;
  }

  // =============================================================================
  // Analytics
  // =============================================================================

  /**
   * Track notification delivery
   */
  async trackDelivery(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push'
  ): Promise<{ success: boolean }> {
    const response = await api.post('/notifications/analytics/delivery', {
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * Track notification open/click
   */
  async trackClick(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push'
  ): Promise<{ success: boolean }> {
    const response = await api.post('/notifications/analytics/click', {
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * Track notification view (for analytics)
   */
  async trackView(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push'
  ): Promise<{ success: boolean }> {
    const response = await api.post('/notifications/analytics/view', {
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * Get notification analytics summary
   */
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    channel?: string;
  }): Promise<{
    success: boolean;
    data: {
      totalSent: number;
      totalDelivered: number;
      totalClicked: number;
      clickThroughRate: number;
      byChannel: Record<string, { sent: number; delivered: number; clicked: number; rate: number }>;
      byType: Record<string, { count: number; rate: number }>;
    };
  }> {
    const response = await api.get('/notifications/analytics/summary', { params });
    return response.data;
  }

  // =============================================================================
  // Filtered Notifications
  // =============================================================================

  /**
   * Get filtered notifications
   */
  async getFilteredNotifications(options?: {
    page?: number;
    limit?: number;
    type?: NotificationType;
    unreadOnly?: boolean;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.unreadOnly) params.append('unreadOnly', 'true');
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.search) params.append('search', options.search);

    const queryString = params.toString();
    const url = queryString ? `/notifications?${queryString}` : '/notifications';

    const response = await api.get(url);
    return response.data;
  }
}

export const notificationApi = new NotificationApiService();
export default notificationApi;
