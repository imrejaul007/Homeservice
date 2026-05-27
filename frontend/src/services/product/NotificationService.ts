// Push Notification Service - Production-grade notification architecture
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, Token, ActionPerformed } from '@capacitor/push-notifications';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  badge?: number;
}

export interface NotificationAction {
  id: string;
  title: string;
}

class NotificationService {
  private isEnabled: boolean = false;
  private token: string | null = null;
  private listeners: ((payload: PushNotificationSchema) => void)[] = [];

  constructor() {
    this.isEnabled = Capacitor.isNativePlatform();
  }

  // Request permission
  async requestPermission(): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('[Notifications] Not running on native platform');
      return false;
    }

    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await this.register();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Notifications] Permission error:', error);
      return false;
    }
  }

  // Register for push notifications
  async register(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Register with FCM/APNs
      await PushNotifications.register();

      // Handle registration
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('[Notifications] Token:', token.value);
        this.token = token.value;
        this.sendTokenToServer(token.value);
      });

      // Handle registration error
      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Notifications] Registration error:', error);
      });

      // Handle notifications
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        this.handleNotification(notification);
      });

      // Handle notification tap
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        this.handleAction(notification.notification, notification.actionId);
      });
    } catch (error) {
      console.error('[Notifications] Registration failed:', error);
    }
  }

  // Handle incoming notification
  private handleNotification(notification: PushNotificationSchema) {
    console.log('[Notifications] Received:', notification);

    // Show in-app notification
    this.showInAppNotification({
      title: notification.title || 'Notification',
      body: notification.body || '',
      data: notification.data,
    });

    // Notify listeners
    this.listeners.forEach((listener) => listener(notification));
  }

  // Handle notification action
  private handleAction(notification: PushNotificationSchema | undefined, actionId: string | undefined) {
    console.log('[Notifications] Action:', actionId, notification);

    if (notification?.data) {
      // Handle deep linking based on notification data
      const { type, id } = notification.data;

      switch (type) {
        case 'booking':
          // Navigate to booking details
          window.location.href = `/customer/bookings/${id}`;
          break;
        case 'provider':
          // Navigate to provider profile
          window.location.href = `/provider/${id}`;
          break;
        case 'promotion':
          // Navigate to promotion
          window.location.href = `/promotions/${id}`;
          break;
        default:
          // Default to home
          window.location.href = '/';
      }
    }
  }

  // Send token to server
  private async sendTokenToServer(token: string): Promise<void> {
    try {
      const response = await fetch('/api/notifications/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
      });

      if (!response.ok) {
        throw new Error('Failed to send token');
      }
    } catch (error) {
      console.error('[Notifications] Failed to send token:', error);
    }
  }

  // Show in-app notification (toast/snackbar)
  private showInAppNotification(payload: NotificationPayload): void {
    // Import react-hot-toast dynamically
    import('react-hot-toast').then((toast) => {
      toast.default(payload.body, {
        duration: 5000,
        icon: '🔔',
        style: {
          background: '#2D2D2D',
          color: '#FFFFFF',
          borderRadius: '12px',
        },
      });
    });
  }

  // Subscribe to notifications
  subscribe(callback: (payload: PushNotificationSchema) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  // Local notification (for reminders, etc.)
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    // Uses native local notifications plugin
    // await LocalNotifications.schedule({ notifications: [...] });
    console.log('[Notifications] Local:', payload);
  }

  // Schedule reminder
  async scheduleReminder(id: string, title: string, body: string, triggerAt: Date): Promise<void> {
    // await LocalNotifications.schedule({
    //   notifications: [{
    //     id: parseInt(id),
    //     title,
    //     body,
    //     trigger: { at: triggerAt },
    //   }]
    // });
    console.log('[Notifications] Scheduled reminder:', id, triggerAt);
  }

  // Cancel reminder
  async cancelReminder(id: string): Promise<void> {
    // await LocalNotifications.cancel({ notifications: [{ id: parseInt(id) }] });
    console.log('[Notifications] Cancelled reminder:', id);
  }

  // Get token
  getToken(): string | null {
    return this.token;
  }

  // Check if enabled
  isAvailable(): boolean {
    return this.isEnabled;
  }
}

export const notificationService = new NotificationService();

// Hook for notifications
import { useEffect, useState } from 'react';

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const requestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setHasPermission(granted);
    if (granted) {
      setToken(notificationService.getToken());
    }
    return granted;
  };

  return {
    hasPermission,
    token,
    requestPermission,
    isAvailable: notificationService.isAvailable(),
  };
}

export default notificationService;
