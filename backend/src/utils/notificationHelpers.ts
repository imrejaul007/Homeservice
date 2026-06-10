import { NotificationChannel } from '../services/notification.service';

/**
 * Map backend notification type to frontend socket/UI category
 */
export function mapTypeToSocketCategory(type: string): 'booking' | 'message' | 'system' | 'promotion' {
  if (type.startsWith('booking_')) return 'booking';
  if (type.startsWith('message')) return 'message';
  if (type === 'promotion' || type === 'loyalty_update') return 'promotion';
  return 'system';
}

/**
 * Build default multi-channel object for BookingNotification
 */
export function buildDefaultChannels(enabledChannels?: NotificationChannel[]) {
  const enabled = new Set(enabledChannels || ['in_app']);

  return {
    email: { enabled: enabled.has('email'), sent: false },
    sms: { enabled: enabled.has('sms'), sent: false },
    push: { enabled: enabled.has('push'), sent: false },
    inApp: {
      enabled: enabled.has('in_app'),
      sent: true,
      sentAt: new Date(),
      read: false,
      dismissed: false,
    },
  };
}

/**
 * Format BookingNotification document for API response
 */
export function formatNotificationForApi(doc: any) {
  const bookingId = doc.bookingId?._id?.toString?.() || doc.bookingId?.toString?.();
  const metadata = doc.metadata || {};
  const customData = metadata.customData || {};

  return {
    id: doc._id.toString(),
    userId: doc.recipientId?.toString?.() || String(doc.recipientId),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    isRead: doc.channels?.inApp?.read ?? false,
    data: {
      bookingId,
      bookingNumber: metadata.bookingNumber,
      serviceName: metadata.serviceName,
      providerId: customData.providerId,
      serviceId: customData.serviceId,
      ...customData,
    },
    createdAt: doc.createdAt?.toISOString?.() || new Date(doc.createdAt).toISOString(),
    readAt: doc.channels?.inApp?.readAt?.toISOString?.(),
  };
}

/**
 * Build socket event payload from a notification document
 */
export function formatNotificationForSocket(doc: any) {
  const api = formatNotificationForApi(doc);
  return {
    id: api.id,
    type: mapTypeToSocketCategory(doc.type),
    title: api.title,
    message: api.message,
    data: api.data,
    userId: api.userId,
    read: api.isRead,
  };
}
