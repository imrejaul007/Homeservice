/**
 * Booking Notification Templates
 * Pre-defined templates for various booking-related notifications
 */

export interface BookingNotificationTemplate {
  id: string;
  type: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'booking_rejected' |
        'booking_started' | 'booking_completed' | 'booking_reminder' | 'provider_assigned' |
        'payment_received' | 'payment_failed' | 'review_request';
  title: string;
  messageTemplate: string;
  icon: string;
  color: string;
  actions?: Array<{
    action: string;
    label: string;
    url?: string;
  }>;
  dataFields?: string[];
}

// Booking notification templates with rich formatting
export const BOOKING_NOTIFICATION_TEMPLATES: BookingNotificationTemplate[] = [
  {
    id: 'booking_request',
    type: 'booking_request',
    title: 'New Booking Request',
    messageTemplate: 'New booking request for {{serviceName}} from {{customerName}}. Scheduled for {{scheduledDate}} at {{scheduledTime}}.',
    icon: 'calendar-plus',
    color: 'bg-blue-100 text-blue-600',
    actions: [
      { action: 'accept', label: 'Accept', url: '/provider/bookings/{{bookingId}}' },
      { action: 'decline', label: 'Decline', url: '/provider/bookings/{{bookingId}}' },
      { action: 'view', label: 'View Details' },
    ],
    dataFields: ['bookingId', 'serviceName', 'customerName', 'scheduledDate', 'scheduledTime', 'totalAmount', 'address'],
  },
  {
    id: 'booking_confirmed',
    type: 'booking_confirmed',
    title: 'Booking Confirmed',
    messageTemplate: 'Your booking #{{bookingNumber}} for {{serviceName}} has been confirmed. Provider: {{providerName}}. Scheduled: {{scheduledDate}} at {{scheduledTime}}.',
    icon: 'check-circle',
    color: 'bg-green-100 text-green-600',
    actions: [
      { action: 'view', label: 'View Booking' },
      { action: 'cancel', label: 'Cancel Booking' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'serviceName', 'providerName', 'scheduledDate', 'scheduledTime', 'address', 'totalAmount'],
  },
  {
    id: 'booking_cancelled',
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    messageTemplate: 'Booking #{{bookingNumber}} for {{serviceName}} has been cancelled. {{cancellationReason}}',
    icon: 'x-circle',
    color: 'bg-red-100 text-red-600',
    actions: [
      { action: 'view', label: 'View Details' },
      { action: 'rebook', label: 'Book Again' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'serviceName', 'cancellationReason', 'refundAmount', 'refundStatus'],
  },
  {
    id: 'booking_rejected',
    type: 'booking_rejected',
    title: 'Booking Rejected',
    messageTemplate: 'Your booking request for {{serviceName}} on {{scheduledDate}} was rejected. Reason: {{rejectionReason}}',
    icon: 'x-circle',
    color: 'bg-orange-100 text-orange-600',
    actions: [
      { action: 'view', label: 'View Details' },
      { action: 'rebook', label: 'Book Again' },
    ],
    dataFields: ['bookingId', 'serviceName', 'scheduledDate', 'rejectionReason', 'providerName'],
  },
  {
    id: 'booking_started',
    type: 'booking_started',
    title: 'Service Started',
    messageTemplate: '{{providerName}} has started working on your {{serviceName}} booking #{{bookingNumber}}.',
    icon: 'play-circle',
    color: 'bg-cyan-100 text-cyan-600',
    actions: [
      { action: 'view', label: 'Track Progress' },
      { action: 'message', label: 'Message Provider' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'serviceName', 'providerName', 'providerPhone', 'providerImage'],
  },
  {
    id: 'booking_completed',
    type: 'booking_completed',
    title: 'Service Completed',
    messageTemplate: 'Your {{serviceName}} booking #{{bookingNumber}} has been completed by {{providerName}}. Total: {{totalAmount}}.',
    icon: 'check-double',
    color: 'bg-emerald-100 text-emerald-600',
    actions: [
      { action: 'review', label: 'Leave Review' },
      { action: 'view', label: 'View Receipt' },
      { action: 'rebook', label: 'Book Again' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'serviceName', 'providerName', 'totalAmount', 'completedAt'],
  },
  {
    id: 'booking_reminder',
    type: 'booking_reminder',
    title: 'Booking Reminder',
    messageTemplate: 'Reminder: Your {{serviceName}} booking with {{providerName}} is scheduled for tomorrow at {{scheduledTime}}. Address: {{address}}.',
    icon: 'bell-ring',
    color: 'bg-yellow-100 text-yellow-600',
    actions: [
      { action: 'view', label: 'View Booking' },
      { action: 'reschedule', label: 'Reschedule' },
      { action: 'cancel', label: 'Cancel' },
    ],
    dataFields: ['bookingId', 'serviceName', 'providerName', 'scheduledDate', 'scheduledTime', 'address', 'providerPhone'],
  },
  {
    id: 'provider_assigned',
    type: 'provider_assigned',
    title: 'Provider Assigned',
    messageTemplate: '{{providerName}} has been assigned to your {{serviceName}} booking #{{bookingNumber}}. Rating: {{providerRating}} stars.',
    icon: 'user-check',
    color: 'bg-purple-100 text-purple-600',
    actions: [
      { action: 'view', label: 'View Provider Profile' },
      { action: 'message', label: 'Message Provider' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'serviceName', 'providerId', 'providerName', 'providerRating', 'providerImage', 'providerPhone'],
  },
  {
    id: 'payment_received',
    type: 'payment_received',
    title: 'Payment Received',
    messageTemplate: 'Payment of {{amount}} {{currency}} received for booking #{{bookingNumber}}. Transaction ID: {{transactionId}}.',
    icon: 'credit-card',
    color: 'bg-green-100 text-green-600',
    actions: [
      { action: 'view', label: 'View Receipt' },
      { action: 'invoice', label: 'Download Invoice' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'amount', 'currency', 'transactionId', 'paymentMethod'],
  },
  {
    id: 'payment_failed',
    type: 'payment_failed',
    title: 'Payment Failed',
    messageTemplate: 'Payment of {{amount}} {{currency}} for booking #{{bookingNumber}} failed. Reason: {{failureReason}}. Please update your payment method.',
    icon: 'alert-triangle',
    color: 'bg-red-100 text-red-600',
    actions: [
      { action: 'retry', label: 'Retry Payment' },
      { action: 'method', label: 'Update Payment Method' },
    ],
    dataFields: ['bookingId', 'bookingNumber', 'amount', 'currency', 'failureReason', 'retryDeadline'],
  },
  {
    id: 'review_request',
    type: 'review_request',
    title: 'Rate Your Experience',
    messageTemplate: 'How was your {{serviceName}} service with {{providerName}}? Share your feedback to earn loyalty points!',
    icon: 'star',
    color: 'bg-yellow-100 text-yellow-600',
    actions: [
      { action: 'review', label: 'Write Review' },
      { action: 'skip', label: 'Skip' },
    ],
    dataFields: ['bookingId', 'serviceName', 'providerName', 'providerId', 'pointsReward'],
  },
];

/**
 * Generate notification message from template
 */
export function generateNotificationMessage(
  template: BookingNotificationTemplate,
  data: Record<string, string | number>
): string {
  let message = template.messageTemplate;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    message = message.replace(new RegExp(placeholder, 'g'), String(value));
  }

  return message;
}

/**
 * Get template by notification type
 */
export function getTemplateByType(type: string): BookingNotificationTemplate | undefined {
  return BOOKING_NOTIFICATION_TEMPLATES.find(t => t.type === type);
}

/**
 * Get default icon component name mapping
 */
export const ICON_MAP: Record<string, string> = {
  'calendar-plus': 'Calendar',
  'check-circle': 'CheckCircle',
  'x-circle': 'XCircle',
  'play-circle': 'PlayCircle',
  'check-double': 'CheckDouble',
  'bell-ring': 'BellRing',
  'user-check': 'UserCheck',
  'credit-card': 'CreditCard',
  'alert-triangle': 'AlertTriangle',
  'star': 'Star',
};

/**
 * Get color classes for notification type
 */
export function getNotificationColor(type: string): string {
  const template = getTemplateByType(type);
  if (template) {
    return template.color;
  }

  // Fallback colors based on type
  const fallbackColors: Record<string, string> = {
    booking: 'bg-blue-100 text-blue-600',
    payment: 'bg-green-100 text-green-600',
    review: 'bg-yellow-100 text-yellow-600',
    promotion: 'bg-purple-100 text-purple-600',
    system: 'bg-gray-100 text-gray-600',
    message: 'bg-cyan-100 text-cyan-600',
  };

  return fallbackColors[type] || 'bg-gray-100 text-gray-600';
}

/**
 * Quick action definitions for booking notifications
 */
export interface QuickAction {
  action: string;
  label: string;
  icon: string;
  color: string;
}

export const QUICK_ACTIONS: Record<string, QuickAction> = {
  accept: { action: 'accept', label: 'Accept', icon: 'Check', color: 'text-green-600 hover:bg-green-50' },
  decline: { action: 'decline', label: 'Decline', icon: 'X', color: 'text-red-600 hover:bg-red-50' },
  view: { action: 'view', label: 'View', icon: 'Eye', color: 'text-blue-600 hover:bg-blue-50' },
  cancel: { action: 'cancel', label: 'Cancel', icon: 'X', color: 'text-red-600 hover:bg-red-50' },
  reschedule: { action: 'reschedule', label: 'Reschedule', icon: 'Calendar', color: 'text-orange-600 hover:bg-orange-50' },
  rebook: { action: 'rebook', label: 'Book Again', icon: 'RefreshCw', color: 'text-blue-600 hover:bg-blue-50' },
  review: { action: 'review', label: 'Review', icon: 'Star', color: 'text-yellow-600 hover:bg-yellow-50' },
  message: { action: 'message', label: 'Message', icon: 'MessageSquare', color: 'text-purple-600 hover:bg-purple-50' },
  retry: { action: 'retry', label: 'Retry', icon: 'RefreshCw', color: 'text-green-600 hover:bg-green-50' },
  receipt: { action: 'receipt', label: 'Receipt', icon: 'FileText', color: 'text-blue-600 hover:bg-blue-50' },
};

/**
 * Format booking notification for display
 */
export function formatBookingNotification(
  type: string,
  data: Record<string, any>
): { title: string; message: string; icon: string; color: string } {
  const template = getTemplateByType(type);

  if (template) {
    return {
      title: template.title,
      message: generateNotificationMessage(template, data),
      icon: template.icon,
      color: template.color,
    };
  }

  // Generic fallback
  return {
    title: 'Notification',
    message: data.message || 'You have a new notification',
    icon: 'bell',
    color: 'bg-gray-100 text-gray-600',
  };
}

export default BOOKING_NOTIFICATION_TEMPLATES;
