/**
 * NotificationsSection Component
 * Displays recent notifications with real data from the backend API
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Calendar,
  CreditCard,
  Star,
  Settings,
  Gift,
  MessageSquare,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  RefreshCw,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationApi, type Notification } from '../../services/notificationApi';
import { cn } from '../../lib/utils';
import { FadeSection } from '../ui/FadeSection';
import Button from '../common/Button';
import { useSocketEvent } from '../../hooks/useSocket';
import type { NotificationEvent } from '../../services/socket';

// =============================================================================
// Types
// =============================================================================

interface NotificationsSectionProps {
  limit?: number;
  showViewAll?: boolean;
  className?: string;
  userRole?: 'customer' | 'provider' | 'admin';
}

interface NotificationItem {
  _id: string;
  type: 'booking' | 'payment' | 'review' | 'system' | 'promotion';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: string;
  readAt?: string;
  channels?: {
    inApp?: { sent: boolean; sentAt?: string; read?: boolean; readAt?: string };
    email?: { sent: boolean; sentAt?: string };
    sms?: { sent: boolean; sentAt?: string };
    push?: { sent: boolean; sentAt?: string };
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get icon component for notification type
 */
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'booking':
      return Calendar;
    case 'payment':
      return CreditCard;
    case 'review':
      return Star;
    case 'promotion':
      return Gift;
    case 'system':
      return Settings;
    case 'message':
      return MessageSquare;
    default:
      return Bell;
  }
};

/**
 * Get color classes for notification type
 */
const getTypeColors = (type: string) => {
  switch (type) {
    case 'booking':
      return { bg: 'bg-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-50' };
    case 'payment':
      return { bg: 'bg-green-100', text: 'text-green-600', iconBg: 'bg-green-50' };
    case 'review':
      return { bg: 'bg-yellow-100', text: 'text-yellow-600', iconBg: 'bg-yellow-50' };
    case 'promotion':
      return { bg: 'bg-purple-100', text: 'text-purple-600', iconBg: 'bg-purple-50' };
    case 'system':
      return { bg: 'bg-gray-100', text: 'text-gray-600', iconBg: 'bg-gray-50' };
    case 'message':
      return { bg: 'bg-cyan-100', text: 'text-cyan-600', iconBg: 'bg-cyan-50' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', iconBg: 'bg-gray-50' };
  }
};

/**
 * Format timestamp to relative time
 */
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get navigation path based on notification data
 */
const getNotificationPath = (
  notification: NotificationItem,
  userRole: 'customer' | 'provider' | 'admin' = 'customer'
): string => {
  const data = notification.data || {};
  const isProvider = userRole === 'provider';

  if (data.bookingId) {
    return isProvider
      ? `/provider/bookings/${data.bookingId}`
      : `/customer/bookings/${data.bookingId}`;
  }
  if (data.serviceId) {
    return `/services/${data.serviceId}`;
  }
  if (data.providerId) {
    return `/provider/${data.providerId}`;
  }
  if (data.reviewId) {
    return `/customer/reviews`;
  }

  // Fallback based on type
  switch (notification.type) {
    case 'booking':
      return '/customer/bookings';
    case 'payment':
      return '/customer/payment-methods';
    case 'review':
      return '/customer/reviews';
    case 'promotion':
      return '/search';
    default:
      return '/customer/notifications';
  }
};

// =============================================================================
// Empty State Component
// =============================================================================

const EmptyNotifications: React.FC = () => (
  <div className="rounded-2xl border border-nilin-border/50 bg-white/40 p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-nilin-blush/50 mx-auto mb-4 flex items-center justify-center">
      <BellOff className="w-8 h-8 text-nilin-coral/60" />
    </div>
    <h3 className="font-semibold text-nilin-charcoal mb-2">No notifications</h3>
    <p className="text-sm text-nilin-warmGray max-w-xs mx-auto">
      You're all caught up! New notifications about your bookings, offers, and updates will appear here.
    </p>
  </div>
);

// =============================================================================
// Loading Skeleton
// =============================================================================

const NotificationsSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="flex items-center gap-4 p-4 rounded-2xl border border-nilin-border/50 bg-white/40"
      >
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
        <div className="h-3 bg-gray-200 rounded animate-pulse w-12" />
      </div>
    ))}
  </div>
);

// =============================================================================
// Notification Item Component
// =============================================================================

interface NotificationItemProps {
  notification: NotificationItem;
  onMarkAsRead: (id: string) => Promise<void>;
  onClick: (notification: NotificationItem) => void;
  index: number;
}

const NotificationItemComponent: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onClick,
  index
}) => {
  const [isMarking, setIsMarking] = useState(false);
  const Icon = getTypeIcon(notification.type);
  const colors = getTypeColors(notification.type);

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMarking || notification.isRead) return;

    setIsMarking(true);
    try {
      await onMarkAsRead(notification._id);
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <FadeSection delay={index * 50}>
      <div
        onClick={() => onClick(notification)}
        className={cn(
          'flex items-start gap-4 p-4 rounded-2xl border border-nilin-border/50 cursor-pointer',
          'bg-white/60 backdrop-blur-md hover:bg-white hover:shadow-nilin-sm',
          'transition-all duration-200',
          !notification.isRead && 'bg-nilin-blush/20 border-nilin-coral/20'
        )}
      >
        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          colors.iconBg
        )}>
          <Icon className={cn('w-5 h-5', colors.text)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  'text-sm font-medium truncate',
                  notification.isRead ? 'text-nilin-charcoal' : 'text-nilin-charcoal font-semibold'
                )}>
                  {notification.title}
                </h4>
                {!notification.isRead && (
                  <span className="w-2 h-2 bg-nilin-coral rounded-full flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-nilin-warmGray whitespace-nowrap">
                {formatTime(notification.createdAt)}
              </span>
              {!notification.isRead && (
                <button
                  onClick={handleMarkAsRead}
                  disabled={isMarking}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors',
                    'text-nilin-coral hover:bg-nilin-coral/10',
                    isMarking && 'opacity-50 cursor-wait'
                  )}
                >
                  {isMarking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </FadeSection>
  );
};

// =============================================================================
// Main NotificationsSection Component
// =============================================================================

const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  limit = 5,
  showViewAll = true,
  className = '',
  userRole = 'customer',
}) => {
  const navigate = useNavigate();

  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await notificationApi.getNotifications({
        page: 1,
        limit: limit,
      });

      if (response.success) {
        // Map backend notifications to our format
        const mappedNotifications: NotificationItem[] = response.data.notifications.map((n: any) => ({
          _id: n._id,
          type: n.type || 'system',
          title: n.title || 'Notification',
          message: n.message || '',
          isRead: n.isRead ?? n.channels?.inApp?.read ?? false,
          data: n.data || n.metadata || {},
          createdAt: n.createdAt,
          readAt: n.readAt || n.channels?.inApp?.readAt,
          channels: n.channels,
        }));

        setNotifications(mappedNotifications);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [limit]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Socket listener for real-time notifications
  useSocketEvent('notification:new', (data: NotificationEvent) => {
    const newNotification: NotificationItem = {
      _id: data.id,
      type: data.type as NotificationItem['type'],
      title: data.title,
      message: data.message,
      isRead: data.read ?? false,
      data: data.data as Record<string, any> || {},
      createdAt: data.timestamp instanceof Date ? data.timestamp.toISOString() : String(data.timestamp),
    };

    setNotifications(prev => [newNotification, ...prev]);
    if (!newNotification.isRead) {
      setUnreadCount(prev => prev + 1);
    }
  });

  // Mark single notification as read
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
      toast.error('Failed to mark as read');
      throw err;
    }
  }, []);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    setIsMarkingAll(true);
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  }, [unreadCount]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    // Mark as read if not already
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }

    // Navigate to relevant page
    const path = getNotificationPath(notification, userRole);
    navigate(path);
  }, [handleMarkAsRead, navigate]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  const hasUnread = unreadCount > 0;
  const displayNotifications = notifications.slice(0, limit);

  return (
    <div className={cn('', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10
                          flex items-center justify-center">
            <Bell className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-medium text-nilin-charcoal">Notifications</h2>
            {hasUnread && (
              <span className="text-xs text-nilin-warmGray">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors disabled:opacity-50"
            aria-label="Refresh notifications"
          >
            <RefreshCw
              className={cn('w-4 h-4 text-nilin-warmGray', isRefreshing && 'animate-spin')}
            />
          </button>

          {/* Mark all as read button */}
          {hasUnread && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nilin-coral
                         hover:bg-nilin-coral/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {isMarkingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              Mark all read
            </button>
          )}

          {/* View all button */}
          {showViewAll && (
            <button
              onClick={() => navigate('/customer/notifications')}
              className="flex items-center gap-1 text-sm font-medium text-nilin-coral
                         hover:text-nilin-rose transition-colors group"
            >
              View all
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <NotificationsSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button onClick={handleRefresh} variant="secondary" size="sm">
            Try Again
          </Button>
        </div>
      ) : displayNotifications.length === 0 ? (
        <EmptyNotifications />
      ) : (
        <div className="space-y-3">
          {displayNotifications.map((notification, index) => (
            <NotificationItemComponent
              key={notification._id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onClick={handleNotificationClick}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsSection;
