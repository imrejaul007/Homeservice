/**
 * Admin Notification Types
 * Type definitions for admin panel notifications
 */

// Admin-specific notification types
export const ADMIN_NOTIFICATION_TYPES = [
  'new_dispute',
  'refund_request',
  'provider_suspended',
  'sla_violation',
  'new_provider_submission',
  'new_service_pending',
  'new_withdrawal_request',
  'user_report',
  'payment_flagged',
  'compliance_alert',
] as const;

export type AdminNotificationType = typeof ADMIN_NOTIFICATION_TYPES[number] | string;

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification source/category
 */
export type NotificationCategory =
  | 'booking'
  | 'payment'
  | 'provider'
  | 'customer'
  | 'dispute'
  | 'compliance'
  | 'system';

/**
 * Admin notification interface
 */
export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  priority: NotificationPriority;
  category: NotificationCategory;
  data?: {
    entityId?: string;
    entityType?: string;
    bookingId?: string;
    providerId?: string;
    customerId?: string;
    disputeId?: string;
    amount?: number;
    currency?: string;
    reason?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  };
  createdAt: string;
  readAt?: string;
}

/**
 * Notification icon mapping
 */
export interface NotificationIcon {
  icon: string;
  bgColor: string;
  textColor: string;
}

/**
 * Get icon configuration for notification type
 */
export function getNotificationIcon(type: AdminNotificationType): NotificationIcon {
  switch (type) {
    case 'new_dispute':
      return { icon: 'gavel', bgColor: 'bg-orange-100', textColor: 'text-orange-600' };
    case 'refund_request':
      return { icon: 'credit-card', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };
    case 'provider_suspended':
      return { icon: 'alert-triangle', bgColor: 'bg-red-100', textColor: 'text-red-600' };
    case 'sla_violation':
      return { icon: 'clock', bgColor: 'bg-purple-100', textColor: 'text-purple-600' };
    case 'new_provider_submission':
      return { icon: 'user-plus', bgColor: 'bg-green-100', textColor: 'text-green-600' };
    case 'new_service_pending':
      return { icon: 'file-text', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' };
    case 'new_withdrawal_request':
      return { icon: 'banknote', bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' };
    case 'user_report':
      return { icon: 'flag', bgColor: 'bg-rose-100', textColor: 'text-rose-600' };
    case 'payment_flagged':
      return { icon: 'shield-alert', bgColor: 'bg-amber-100', textColor: 'text-amber-600' };
    case 'compliance_alert':
      return { icon: 'shield-check', bgColor: 'bg-red-100', textColor: 'text-red-600' };
    default:
      return { icon: 'bell', bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
  }
}

/**
 * Get priority badge styling
 */
export function getPriorityStyle(priority: NotificationPriority): {
  bgColor: string;
  textColor: string;
  label: string;
} {
  switch (priority) {
    case 'urgent':
      return { bgColor: 'bg-red-500', textColor: 'text-white', label: 'Urgent' };
    case 'high':
      return { bgColor: 'bg-orange-500', textColor: 'text-white', label: 'High' };
    case 'normal':
      return { bgColor: 'bg-blue-500', textColor: 'text-white', label: 'Normal' };
    case 'low':
      return { bgColor: 'bg-gray-400', textColor: 'text-white', label: 'Low' };
    default:
      return { bgColor: 'bg-gray-400', textColor: 'text-white', label: 'Normal' };
  }
}

/**
 * Normalize backend notification to admin notification format
 */
export function normalizeAdminNotification(raw: {
  _id?: string;
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  read?: boolean;
  data?: Record<string, unknown>;
  createdAt?: string;
  readAt?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
}): AdminNotification {
  return {
    id: raw._id || raw.id || '',
    type: (raw.type as AdminNotificationType) || 'system',
    title: raw.title || 'New Notification',
    message: raw.message || '',
    isRead: raw.isRead ?? raw.read ?? false,
    priority: raw.priority || 'normal',
    category: raw.category || 'system',
    data: raw.data,
    createdAt: raw.createdAt || new Date().toISOString(),
    readAt: raw.readAt,
  };
}
