import { api } from './api';

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
}

export const notificationApi = new NotificationApiService();
export default notificationApi;
