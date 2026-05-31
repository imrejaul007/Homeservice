/**
 * Notification Components Index
 * Re-exports all notification-related components
 */

export { WhatsAppOptIn } from './WhatsAppOptIn';
export { BrowserPushPermission } from './BrowserPushPermission';
export { NotificationPreferences } from './NotificationPreferences';
export { QuietHours } from './QuietHours';
export { ChannelPreferences } from './ChannelPreferences';
export { NotificationHistory } from './NotificationHistory';
export type { NotificationItem } from './NotificationHistory';

// New components
export { NotificationCenter } from './NotificationCenter';
export type { NotificationItem as NotificationCenterItem } from './NotificationCenter';
export { ToastContainer, useToast, toast } from './NotificationToast';
export type { ToastNotification } from './NotificationToast';
export { UnreadBadge, UnreadBadgeCompact, UnreadDot } from './UnreadBadge';
