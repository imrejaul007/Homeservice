import { NotificationChannel } from '../services/notification.service';

export type NotificationCategory =
  | 'booking'
  | 'payment'
  | 'review'
  | 'system'
  | 'promotion'
  | 'message';

/**
 * Normalize backend notification type to category for query building
 */
export function normalizeBackendNotificationType(type: string): NotificationCategory {
  // Map specific backend types to frontend categories
  if (type.startsWith('booking_')) return 'booking';
  if (type.startsWith('message')) return 'message';
  if (type.startsWith('review')) return 'review';
  if (type === 'promotion') return 'promotion';
  if (type.startsWith('withdrawal')) return 'payment';
  if (type === 'loyalty_update') return 'promotion';
  if (type.includes('dispute')) return 'system';
  if (type.includes('provider') || type.includes('service')) return 'system';

  // Default to 'system' for unknown types
  return 'system';
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'booking',
  'payment',
  'review',
  'system',
  'promotion',
  'message',
];

export function isNotificationCategory(type: string): type is NotificationCategory {
  return NOTIFICATION_CATEGORIES.includes(type as NotificationCategory);
}

/** MongoDB query fragment for filtering by UI category or exact backend type */
export function buildNotificationCategoryQuery(
  type: string
): Record<string, unknown> | null {
  switch (type) {
    case 'booking':
      return { type: { $regex: /^booking_/ } };
    case 'message':
      return { type: { $regex: /^message/ } };
    case 'review':
      return { type: { $regex: /^review/ } };
    case 'promotion':
      return { type: { $in: ['promotion', 'loyalty_update'] } };
    case 'payment':
      return { type: { $regex: /^withdrawal/ } };
    case 'system':
      return {
        type: {
          $not: {
            $regex: /^(booking_|message|review|promotion|loyalty_update|withdrawal)/,
          },
        },
      };
    default:
      return null;
  }
}

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
 * Fields that should be filtered from metadata before returning to client
 * These are internal/sensitive fields that should not be exposed
 */
const SENSITIVE_METADATA_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'secretKey',
  'privateKey',
  'sessionId',
  'sessionToken',
  'authToken',
  'bearerToken',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'socialSecurityNumber',
  'bankAccount',
  'accountNumber',
  'routingNumber',
  'pin',
  'otp',
  'verificationCode',
  'resetToken',
  'emailVerificationToken',
  'phoneVerificationCode',
  'internalNote',
  'adminComment',
  'systemComment',
  '_internal',
  '__private',
];

/**
 * Filter sensitive data from metadata object
 * Returns a new object with sensitive fields removed
 */
export function filterSensitiveData(metadata: Record<string, any> | null | undefined): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip sensitive fields (case-insensitive check)
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_METADATA_FIELDS.some(
      sensitive => lowerKey.includes(sensitive.toLowerCase())
    );

    if (isSensitive) {
      // Replace sensitive values with a safe placeholder
      filtered[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively filter nested objects
      filtered[key] = filterSensitiveData(value);
    } else if (Array.isArray(value)) {
      // Filter arrays by recursively filtering each element
      filtered[key] = value.map((item: any) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? filterSensitiveData(item)
          : item
      );
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Format BookingNotification document for API response
 * Filters sensitive data from metadata before returning
 */
export function formatNotificationForApi(doc: any) {
  const bookingId = doc.bookingId?._id?.toString?.() || doc.bookingId?.toString?.();
  const metadata = filterSensitiveData(doc.metadata || {});
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
 * Filters sensitive data from metadata before sending via socket
 */
export function formatNotificationForSocket(doc: any) {
  const metadata = filterSensitiveData(doc.metadata || {});
  const customData = metadata.customData || {};
  const bookingId = doc.bookingId?._id?.toString?.() || doc.bookingId?.toString?.();

  return {
    id: doc._id.toString(),
    type: mapTypeToSocketCategory(doc.type),
    title: doc.title,
    message: doc.message,
    data: {
      bookingId,
      bookingNumber: metadata.bookingNumber,
      serviceName: metadata.serviceName,
      providerId: customData.providerId,
      serviceId: customData.serviceId,
      ...customData,
    },
    userId: doc.recipientId?.toString?.() || String(doc.recipientId),
    read: doc.channels?.inApp?.read ?? false,
  };
}
