/**
 * Push Notification Templates for Offer Expiry Notifications
 * Templates for FCM/APNS push notifications
 */

import admin from 'firebase-admin';

/**
 * Push notification payload interface
 */
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  android?: {
    channelId?: string;
    priority?: 'high' | 'normal' | 'default';
    notification?: {
      icon?: string;
      color?: string;
      sound?: string;
      clickAction?: string;
    };
  };
  apns?: {
    payload?: {
      aps?: {
        alert?: {
          title?: string;
          body?: string;
        };
        sound?: string;
        badge?: number;
        'mutable-content'?: number;
        category?: string;
      };
      data?: Record<string, any>;
    };
    headers?: Record<string, string>;
  };
  webpush?: {
    notification?: {
      title?: string;
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      requireInteraction?: boolean;
      data?: Record<string, any>;
      actions?: Array<{
        action: string;
        title: string;
        icon?: string;
      }>;
    };
    fcmOptions?: {
      link?: string;
    };
  };
}

/**
 * Push notification data types for deep linking
 */
export type OfferPushDataType =
  | 'offer_expiry_reminder'
  | 'offer_unused_reminder'
  | 'offer_expired'
  | 'admin_offer_alert';

/**
 * Offer expiry reminder push notification
 * Sent 1-3 days before offer expires
 */
export function offerExpiryReminderPush(data: {
  firstName?: string;
  offerCode: string;
  offerTitle?: string;
  discountText?: string;
  daysRemaining: number;
  ctaUrl?: string;
}): PushNotificationPayload {
  const greeting = data.firstName ? `Hey ${data.firstName}! ` : '';
  const daysText = data.daysRemaining === 1 ? 'day' : 'days';
  const offerName = data.offerTitle || 'your offer';

  const title = `Your "${data.offerCode}" expires in ${data.daysRemaining} ${daysText}!`;
  const body = data.discountText
    ? `${greeting}Don't miss ${data.discountText}! Your ${offerName} is expiring soon.`
    : `${greeting}Your claimed offer is about to expire. Don't let it go to waste!`;

  return {
    title,
    body,
    data: {
      type: 'offer_expiry_reminder' as OfferPushDataType,
      offerCode: data.offerCode,
      offerTitle: data.offerTitle,
      offerName: offerName,
      discountText: data.discountText,
      daysRemaining: data.daysRemaining,
      ctaUrl: data.ctaUrl || '/book',
      action: 'open_offer',
    },
    android: {
      channelId: 'offer_reminders',
      priority: 'high',
      notification: {
        icon: 'ic_notification',
        color: '#FF6B6B',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          badge: 1,
          'mutable-content': 1,
          category: 'OFFER_EXPIRY',
        },
        data: {
          type: 'offer_expiry_reminder',
          offerCode: data.offerCode,
          offerTitle: data.offerTitle,
          ctaUrl: data.ctaUrl || '/book',
        },
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/ic_notification.png',
        badge: '/icons/ic_badge.png',
        tag: `offer-expiry-${data.offerCode}`,
        requireInteraction: data.daysRemaining === 1,
        data: {
          url: data.ctaUrl || '/book',
          offerCode: data.offerCode,
          type: 'offer_expiry_reminder',
        },
        actions: [
          { action: 'use_offer', title: 'Use Now' },
          { action: 'dismiss', title: 'Later' },
        ],
      },
      fcmOptions: {
        link: data.ctaUrl || '/book',
      },
    },
  };
}

/**
 * Unused offer reminder push notification
 * Sent after user hasn't used a claimed offer after 7 days
 */
export function offerUnusedReminderPush(data: {
  firstName?: string;
  offerCode: string;
  offerTitle?: string;
  daysUntilExpiry: number;
  ctaUrl?: string;
}): PushNotificationPayload {
  const greeting = data.firstName ? `${data.firstName}, ` : '';
  const offerName = data.offerTitle || 'claimed offer';

  const title = `You haven't used your offer yet!`;
  const body = `${greeting}Your ${offerName} (${data.offerCode}) is still valid for ${data.daysUntilExpiry} more days. Use it now!`;

  return {
    title,
    body,
    data: {
      type: 'offer_unused_reminder' as OfferPushDataType,
      offerCode: data.offerCode,
      offerTitle: data.offerTitle,
      daysUntilExpiry: data.daysUntilExpiry,
      ctaUrl: data.ctaUrl || '/book',
      action: 'open_offer',
    },
    android: {
      channelId: 'offer_reminders',
      priority: 'default',
      notification: {
        icon: 'ic_notification',
        color: '#8B5CF6',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          badge: 1,
          category: 'OFFER_UNUSED',
        },
        data: {
          type: 'offer_unused_reminder',
          offerCode: data.offerCode,
          offerTitle: data.offerTitle,
          ctaUrl: data.ctaUrl || '/book',
        },
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/ic_notification.png',
        badge: '/icons/ic_badge.png',
        tag: `offer-unused-${data.offerCode}`,
        data: {
          url: data.ctaUrl || '/book',
          offerCode: data.offerCode,
          type: 'offer_unused_reminder',
        },
        actions: [
          { action: 'use_offer', title: 'Use Offer' },
        ],
      },
      fcmOptions: {
        link: data.ctaUrl || '/book',
      },
    },
  };
}

/**
 * Expired offer push notification
 * Sent when a claimed offer has expired
 */
export function offerExpiredPush(data: {
  firstName?: string;
  offerCode: string;
  offerTitle?: string;
  ctaUrl?: string;
}): PushNotificationPayload {
  const greeting = data.firstName ? `${data.firstName}, ` : '';

  const title = `Your offer has expired`;
  const body = `${greeting}The offer ${data.offerCode} is no longer available. Check out new offers!`;

  return {
    title,
    body,
    data: {
      type: 'offer_expired' as OfferPushDataType,
      offerCode: data.offerCode,
      offerTitle: data.offerTitle,
      ctaUrl: data.ctaUrl || '/offers',
      action: 'browse_offers',
    },
    android: {
      channelId: 'offer_updates',
      priority: 'default',
      notification: {
        icon: 'ic_notification',
        color: '#6B7280',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          category: 'OFFER_EXPIRED',
        },
        data: {
          type: 'offer_expired',
          offerCode: data.offerCode,
          ctaUrl: data.ctaUrl || '/offers',
        },
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/ic_notification.png',
        badge: '/icons/ic_badge.png',
        tag: `offer-expired-${data.offerCode}`,
        data: {
          url: data.ctaUrl || '/offers',
          offerCode: data.offerCode,
          type: 'offer_expired',
        },
        actions: [
          { action: 'browse_offers', title: 'Browse Offers' },
        ],
      },
      fcmOptions: {
        link: data.ctaUrl || '/offers',
      },
    },
  };
}

/**
 * Admin alert push notification
 * Sent to admins when high-value offers are expiring
 */
export function adminOfferExpiryAlertPush(data: {
  offersCount: number;
  totalRemainingUses: number;
  offersSummary?: string[];
  ctaUrl?: string;
}): PushNotificationPayload {
  const offersText = data.offersCount === 1 ? 'offer' : 'offers';
  const usesText = data.totalRemainingUses === 1 ? 'use' : 'uses';

  const title = `${data.offersCount} ${offersText} expiring soon`;
  const body = `${data.totalRemainingUses} remaining ${usesText} at risk. Review and take action.`;

  return {
    title,
    body,
    data: {
      type: 'admin_offer_alert' as OfferPushDataType,
      offersCount: data.offersCount,
      totalRemainingUses: data.totalRemainingUses,
      offersSummary: data.offersSummary,
      ctaUrl: data.ctaUrl || '/admin/offers',
      action: 'open_admin_offers',
    },
    android: {
      channelId: 'admin_alerts',
      priority: 'high',
      notification: {
        icon: 'ic_notification_admin',
        color: '#3B82F6',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'critical',
          badge: 1,
          category: 'ADMIN_OFFER_ALERT',
        },
        data: {
          type: 'admin_offer_alert',
          offersCount: data.offersCount,
          totalRemainingUses: data.totalRemainingUses,
          ctaUrl: data.ctaUrl || '/admin/offers',
        },
      },
      headers: {
        'apns-priority': '10',
        'apns-topic': 'com.nilin.homeapp.admin',
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/ic_admin_notification.png',
        badge: '/icons/ic_badge.png',
        tag: 'admin-offer-alert',
        requireInteraction: true,
        data: {
          url: data.ctaUrl || '/admin/offers',
          type: 'admin_offer_alert',
        },
        actions: [
          { action: 'review_offers', title: 'Review Offers' },
        ],
      },
      fcmOptions: {
        link: data.ctaUrl || '/admin/offers',
      },
    },
  };
}

/**
 * Helper to check if user has active push tokens
 */
export function hasActivePushTokens(deviceTokens?: Array<{ token: string; isActive: boolean }>): boolean {
  if (!deviceTokens || !Array.isArray(deviceTokens)) {
    return false;
  }
  return deviceTokens.some(t => t.isActive && t.token);
}

/**
 * Get active push tokens for a user
 */
export function getActivePushTokens(deviceTokens?: Array<{ token: string; isActive: boolean; platform?: string }>): string[] {
  if (!deviceTokens || !Array.isArray(deviceTokens)) {
    return [];
  }
  return deviceTokens.filter(t => t.isActive && t.token).map(t => t.token);
}