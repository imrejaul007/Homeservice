/**
 * NotificationItem Component
 * Renders a single notification with icon, content, and read state
 */

import React from 'react';
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Clock,
  UserPlus,
  FileText,
  DollarSign,
  Flag,
  ShieldAlert,
  ShieldCheck,
  Gavel,
  CreditCard,
  X,
} from 'lucide-react';
import type { AdminNotification, AdminNotificationType } from '../../types/notification';
import { getNotificationIcon } from '../../types/notification';

interface NotificationItemProps {
  notification: AdminNotification;
  onClick?: (notification: AdminNotification) => void;
  onDismiss?: (notificationId: string) => void;
  isSelected?: boolean;
}

/**
 * Map notification types to Lucide icons
 */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  bell: Bell,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  clock: Clock,
  'user-plus': UserPlus,
  'file-text': FileText,
  banknote: DollarSign,
  flag: Flag,
  'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck,
  gavel: Gavel,
  'credit-card': CreditCard,
};

export function NotificationItem({
  notification,
  onClick,
  onDismiss,
  isSelected = false,
}: NotificationItemProps) {
  const { icon, bgColor, textColor } = getNotificationIcon(notification.type);
  const IconComponent = iconMap[icon] || Bell;

  /**
   * Format relative time
   */
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  /**
   * Get priority indicator styling
   */
  const getPriorityIndicator = () => {
    if (notification.priority === 'urgent') {
      return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
    }
    if (notification.priority === 'high') {
      return <span className="w-2 h-2 rounded-full bg-orange-500" />;
    }
    return null;
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 transition-all duration-200
        ${notification.isRead
          ? 'bg-white hover:bg-gray-50'
          : 'bg-blue-50/50 hover:bg-blue-100/50'
        }
        ${isSelected ? 'ring-2 ring-nilin-coral ring-inset' : ''}
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={() => onClick?.(notification)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(notification);
        }
      }}
      aria-label={`${notification.isRead ? '' : 'Unread: '}${notification.title}`}
    >
      {/* Unread indicator dot */}
      {!notification.isRead && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-nilin-coral rounded-l" />
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
        <IconComponent className={`w-5 h-5 ${textColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`text-sm font-semibold truncate ${notification.isRead ? 'text-nilin-charcoal' : 'text-nilin-charcoal'}`}>
            {notification.title}
          </h4>
          {getPriorityIndicator()}
        </div>

        <p className="text-sm text-nilin-warmGray line-clamp-2 mb-2">
          {notification.message}
        </p>

        <div className="flex items-center gap-3">
          <span className="text-xs text-nilin-warmGray">
            {formatRelativeTime(notification.createdAt)}
          </span>

          {notification.category && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded capitalize">
              {notification.category}
            </span>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="flex-shrink-0 w-11 h-11 rounded-lg hover:bg-gray-200 flex items-center justify-center text-nilin-warmGray hover:text-nilin-charcoal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Click feedback for unread */}
      {!notification.isRead && onClick && (
        <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-transparent hover:border-nilin-coral/20 transition-colors" />
      )}
    </div>
  );
}

export default NotificationItem;
