import BookingNotification from '../models/bookingNotification.model';
import User from '../models/user.model';

// ============================================
// Types
// ============================================

export type NotificationType =
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rejected'
  | 'booking_started'
  | 'booking_completed'
  | 'booking_reminder'
  | 'message_received'
  | 'review_received'
  | 'promotion'
  | 'loyalty_update';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface NotificationData {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  channels?: NotificationChannel[];
}

export interface EmailData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

// ============================================
// Notification Templates
// ============================================

const NOTIFICATION_TEMPLATES: Record<NotificationType, { customer: { title: string; message: string }; provider: { title: string; message: string } }> = {
  booking_request: {
    customer: {
      title: 'Booking Request Submitted',
      message: 'Your booking request has been submitted. You\'ll be notified once the provider responds.',
    },
    provider: {
      title: 'New Booking Request',
      message: 'You have a new booking request. Please review and respond.',
    },
  },
  booking_confirmed: {
    customer: {
      title: 'Booking Confirmed',
      message: 'Great! Your booking has been confirmed by the provider.',
    },
    provider: {
      title: 'Booking Accepted',
      message: 'You have successfully accepted the booking request.',
    },
  },
  booking_cancelled: {
    customer: {
      title: 'Booking Cancelled',
      message: 'Your booking has been cancelled. Refund will be processed if applicable.',
    },
    provider: {
      title: 'Booking Cancelled',
      message: 'Booking has been cancelled by the customer.',
    },
  },
  booking_rejected: {
    customer: {
      title: 'Booking Request Declined',
      message: 'Unfortunately, your booking request has been declined by the provider.',
    },
    provider: {
      title: 'Booking Rejected',
      message: 'You have declined the booking request.',
    },
  },
  booking_started: {
    customer: {
      title: 'Service Started',
      message: 'Your service has started. The provider should arrive shortly.',
    },
    provider: {
      title: 'Service Started',
      message: 'You have started the service.',
    },
  },
  booking_completed: {
    customer: {
      title: 'Service Completed',
      message: 'Your service has been completed. Please consider leaving a review.',
    },
    provider: {
      title: 'Service Completed',
      message: 'You have successfully completed the service.',
    },
  },
  booking_reminder: {
    customer: {
      title: 'Booking Reminder',
      message: 'You have a booking coming up soon. Don\'t forget!',
    },
    provider: {
      title: 'Booking Reminder',
      message: 'You have a booking scheduled. Please prepare.',
    },
  },
  message_received: {
    customer: {
      title: 'New Message',
      message: 'You have a new message about your booking.',
    },
    provider: {
      title: 'New Message',
      message: 'You have a new message about a booking.',
    },
  },
  review_received: {
    customer: {
      title: 'Thank You for Your Review!',
      message: 'Your review helps others make informed decisions.',
    },
    provider: {
      title: 'New Review Received',
      message: 'You have received a new review from a customer.',
    },
  },
  promotion: {
    customer: {
      title: 'Special Offer!',
      message: 'Check out our latest promotions and deals.',
    },
    provider: {
      title: 'Marketing Update',
      message: 'New marketing tools available for your business.',
    },
  },
  loyalty_update: {
    customer: {
      title: 'Loyalty Points Update',
      message: 'Your loyalty points have been updated.',
    },
    provider: {
      title: 'Loyalty Update',
      message: 'Your provider loyalty status has been updated.',
    },
  },
};

// ============================================
// NotificationService Class
// ============================================

export class NotificationService {
  // ========================================
  // In-App Notifications
  // ========================================

  async createNotification(data: NotificationData): Promise<any> {
    const notification = new BookingNotification({
      recipientId: data.recipientId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionText: data.actionText,
      actionUrl: data.actionUrl,
      metadata: data.metadata || {},
      channels: data.channels || ['in_app'],
    });

    await notification.save();
    return notification;
  }

  async createBookingNotification(
    bookingId: string,
    recipientId: string,
    notificationType: NotificationType,
    metadata: Record<string, any>
  ): Promise<any> {
    const template = NOTIFICATION_TEMPLATES[notificationType];

    // Determine recipient role from metadata
    const isProvider = metadata.providerName !== undefined;
    const roleTemplate = isProvider ? template.provider : template.customer;

    const notification = new BookingNotification({
      bookingId,
      recipientId,
      type: notificationType,
      title: roleTemplate.title,
      message: roleTemplate.message,
      metadata: this.formatMetadata(notificationType, metadata),
    });

    await notification.save();
    return notification;
  }

  async sendBookingNotifications(
    bookingId: string,
    customerId: string | null,
    providerId: string,
    notificationType: NotificationType,
    metadata: Record<string, any>
  ): Promise<void> {
    const notifications: Promise<any>[] = [];

    // Customer notification
    if (customerId) {
      notifications.push(
        this.createBookingNotification(bookingId, customerId, notificationType, {
          ...metadata,
          isProvider: false,
        })
      );
    }

    // Provider notification
    notifications.push(
      this.createBookingNotification(bookingId, providerId, notificationType, {
        ...metadata,
        isProvider: true,
      })
    );

    await Promise.allSettled(notifications);
  }

  // ========================================
  // Get User Notifications
  // ========================================

  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    } = {}
  ): Promise<{
    notifications: any[];
    unreadCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit = 20, unreadOnly = false, type } = options;

    const query: any = { recipientId: userId };
    if (unreadOnly) query.isRead = false;
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      BookingNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('bookingId', 'bookingNumber status'),
      BookingNotification.countDocuments(query),
      BookingNotification.countDocuments({ recipientId: userId, isRead: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await BookingNotification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { $set: { isRead: true, readAt: new Date() } }
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await BookingNotification.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await BookingNotification.findOneAndDelete({ _id: notificationId, recipientId: userId });
  }

  async clearAllNotifications(userId: string): Promise<void> {
    await BookingNotification.deleteMany({ recipientId: userId });
  }

  // ========================================
  // Email Notifications
  // ========================================

  async sendEmail(data: EmailData): Promise<void> {
    // This would integrate with your email service
    // For now, just log the email
    console.log(`[Email] To: ${data.to}`);
    console.log(`[Email] Subject: ${data.subject}`);
    console.log(`[Email] Template: ${data.template}`);

    // In production, you would call your email service here:
    // await emailService.send(data);
  }

  async sendBulkEmail(userIds: string[], data: Omit<EmailData, 'to'>): Promise<void> {
    const users = await User.find({ _id: { $in: userIds }, 'communicationPreferences.email.marketing': true });

    for (const user of users) {
      await this.sendEmail({
        ...data,
        to: user.email,
      });
    }
  }

  // ========================================
  // Push Notifications
  // ========================================

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    _data?: Record<string, any>
  ): Promise<void> {
    // This would integrate with FCM, APNs, or a service like OneSignal
    console.log(`[Push] User: ${userId}`);
    console.log(`[Push] Title: ${title}`);
    console.log(`[Push] Body: ${body}`);

    // In production, you would call your push notification service here:
    // await pushService.send(userId, { title, body, data });
  }

  // ========================================
  // SMS Notifications
  // ========================================

  async sendSms(phoneNumber: string, message: string): Promise<void> {
    // This would integrate with Twilio or similar
    console.log(`[SMS] To: ${phoneNumber}`);
    console.log(`[SMS] Message: ${message}`);

    // In production, you would call your SMS service here:
    // await smsService.send(phoneNumber, message);
  }

  // ========================================
  // Scheduled Notifications
  // ========================================

  async scheduleBookingReminder(
    bookingId: string,
    _customerId: string,
    _providerId: string,
    reminderTime: Date,
    _metadata: Record<string, any>
  ): Promise<void> {
    // This would typically use a job queue like Bull/BullMQ
    // For now, just log the scheduled notification
    console.log(`[Scheduled] Booking reminder scheduled for ${reminderTime}`);
    console.log(`[Scheduled] Booking ID: ${bookingId}`);

    // In production with BullMQ:
    // await reminderQueue.add(
    //   'booking-reminder',
    //   { bookingId, customerId, providerId, metadata },
    //   { runAt: reminderTime }
    // );
  }

  // ========================================
  // Helper Methods
  // ========================================

  private formatMetadata(type: NotificationType, data: Record<string, any>): Record<string, any> {
    const formatted: Record<string, any> = {};

    switch (type) {
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rejected':
      case 'booking_started':
      case 'booking_completed':
        formatted.bookingNumber = data.bookingNumber;
        formatted.serviceName = data.serviceName;
        formatted.scheduledDate = data.scheduledDate;
        formatted.totalAmount = data.totalAmount;
        formatted.currency = data.currency;
        if (data.providerName) formatted.providerName = data.providerName;
        if (data.customerName) formatted.customerName = data.customerName;
        break;

      case 'message_received':
        formatted.bookingNumber = data.bookingNumber;
        formatted.serviceName = data.serviceName;
        break;

      case 'review_received':
        formatted.rating = data.rating;
        formatted.review = data.review;
        formatted.providerName = data.providerName;
        break;

      default:
        Object.assign(formatted, data);
    }

    return formatted;
  }

  async getNotificationPreferences(userId: string): Promise<Record<NotificationType, boolean>> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const prefs = user.communicationPreferences;

    return {
      booking_request: true,
      booking_confirmed: prefs.email?.bookingUpdates ?? true,
      booking_cancelled: prefs.email?.bookingUpdates ?? true,
      booking_rejected: prefs.email?.bookingUpdates ?? true,
      booking_started: prefs.push?.bookingUpdates ?? true,
      booking_completed: prefs.push?.bookingUpdates ?? true,
      booking_reminder: prefs.push?.reminders ?? true,
      message_received: prefs.push?.newMessages ?? true,
      review_received: prefs.email?.bookingUpdates ?? true,
      promotion: prefs.email?.promotions ?? false,
      loyalty_update: true,
    };
  }

  async updateNotificationPreferences(
    userId: string,
    _updates: Partial<Record<NotificationType, boolean>>
  ): Promise<void> {
    // This would update the user's communication preferences
    console.log(`[Preferences] Updating notification preferences for user ${userId}`);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
