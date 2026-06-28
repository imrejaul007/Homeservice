import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  CreditCard,
  Star,
  AlertCircle,
  Package,
  MessageSquare,
  Gift,
  Settings,
  BellRing,
  Mail,
  Smartphone,
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import DigestPreferences from '../../components/notifications/DigestPreferences';
import { Skeleton } from '../../components/common/SkeletonLoader';
import { useAuthStore } from '../../stores/authStore';
import { notificationApi, normalizeBackendNotificationType, type Notification } from '../../services/notificationApi';
import { useSocketEvent } from '../../hooks/useSocket';
import type { NotificationEvent } from '../../services/socket';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';

type TabType = 'notifications' | 'digest';

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const isProvider = user?.role === 'provider';
  const notificationsPath = isProvider ? '/provider/notifications' : '/customer/notifications';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialTab = searchParams.get('tab') === 'digest' ? 'digest' : 'notifications';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const previousNotificationsRef = useRef<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await notificationApi.getNotifications({ limit: 50 });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: notificationsPath } });
      return;
    }
    fetchNotifications();
  }, [isAuthenticated, navigate, fetchNotifications]);

  useSocketEvent('notification:new', (data: NotificationEvent) => {
    const normalizedType = normalizeBackendNotificationType(data.type);
    const newNotification: Notification = {
      id: data.id,
      userId: data.userId,
      type: normalizedType,
      title: data.title,
      message: data.message,
      isRead: data.read ?? false,
      data: data.data,
      createdAt: new Date(data.timestamp).toISOString(),
    };

    setNotifications((prev) => {
      if (prev.some((n) => n.id === newNotification.id)) return prev;
      return [newNotification, ...prev];
    });
    if (!newNotification.isRead) {
      setUnreadCount((prev) => prev + 1);
    }
  });

  const handleMarkAsRead = async (notificationId: string) => {
    // Store previous state for rollback
    previousNotificationsRef.current = notifications;
    const previousUnreadCount = unreadCount;

    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await notificationApi.markAsRead(notificationId);
      toast.success('Notification marked as read');
    } catch (err: unknown) {
      // Rollback on failure
      setNotifications(previousNotificationsRef.current);
      setUnreadCount(previousUnreadCount);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || 'Failed to mark as read. Please try again.');
    }
  };

  const handleMarkAllAsRead = async () => {
    // Store previous state for rollback
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationApi.markAllAsRead();
      toast.success('All notifications marked as read');
    } catch (err: unknown) {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || 'Failed to mark all as read. Please try again.');
    }
  };

  const handleDelete = async (notificationId: string) => {
    // Store previous state for rollback
    previousNotificationsRef.current = notifications;
    const previousUnreadCount = unreadCount;
    const deletedNotification = notifications.find(n => n.id === notificationId);

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (deletedNotification && !deletedNotification.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await notificationApi.deleteNotification(notificationId);
      toast.success('Notification deleted');
    } catch (err: unknown) {
      // Rollback on failure
      setNotifications(previousNotificationsRef.current);
      setUnreadCount(previousUnreadCount);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || 'Failed to delete notification. Please try again.');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    const data = notification.data || {};

    const actionUrl = data.actionUrl ?? data.url;
    if (typeof actionUrl === 'string' && actionUrl.startsWith('/')) {
      navigate(actionUrl);
      return;
    }

    const roomId = data.roomId ?? data.chatRoomId;
    if (roomId) {
      navigate(isProvider ? '/provider/messages' : '/customer/messages', {
        state: { roomId: String(roomId) },
      });
      return;
    }

    if (data.disputeId) {
      navigate(
        isProvider
          ? '/provider/operations'
          : `/customer/my-claims/${String(data.disputeId)}`
      );
      return;
    }

    if (data.bookingId) {
      navigate(isProvider ? `/provider/bookings/${data.bookingId}` : `/customer/bookings/${data.bookingId}`);
      return;
    }
    if (data.serviceId) {
      navigate(isProvider ? '/provider/services' : `/services/${data.serviceId}`);
      return;
    }
    if (data.customerId && isProvider) {
      navigate('/provider/messages', { state: { customerId: data.customerId as string } });
      return;
    }
    if (data.providerId && !isProvider) {
      navigate(`/provider/${data.providerId}`);
      return;
    }
    if (
      notification.type === 'message' ||
      notification.type === 'message_received' ||
      (typeof notification.type === 'string' && notification.type.startsWith('message'))
    ) {
      navigate(isProvider ? '/provider/messages' : '/customer/messages', {
        state: data.bookingId
          ? {
              bookingId: String(data.bookingId),
              customerId: data.customerId ? String(data.customerId) : undefined,
              providerId: data.providerId ? String(data.providerId) : undefined,
            }
          : data.providerId && !isProvider
            ? { providerId: String(data.providerId) }
            : data.customerId && isProvider
              ? { customerId: String(data.customerId) }
              : undefined,
      });
      return;
    }
    if (
      notification.type === 'booking' ||
      (typeof notification.type === 'string' && notification.type.startsWith('booking_'))
    ) {
      navigate(isProvider ? '/provider/bookings' : '/customer/bookings');
      return;
    }
    if (notification.type === 'payment') {
      navigate(isProvider ? '/provider/earnings' : '/customer/payment-methods');
      return;
    }
    if (notification.type === 'review') {
      navigate(isProvider ? '/provider/reviews' : '/customer/reviews');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rejected':
      case 'booking_started':
      case 'booking_completed':
      case 'booking_reminder':
        return <Calendar className="w-5 h-5" />;
      case 'payment':
        return <CreditCard className="w-5 h-5" />;
      case 'review':
        return <Star className="w-5 h-5" />;
      case 'promotion':
        return <Gift className="w-5 h-5" />;
      case 'message':
        return <MessageSquare className="w-5 h-5" />;
      case 'system':
        return <Settings className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'booking':
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rejected':
      case 'booking_started':
      case 'booking_completed':
      case 'booking_reminder':
        return 'bg-blue-100 text-blue-600';
      case 'payment':
        return 'bg-green-100 text-green-600';
      case 'review':
        return 'bg-yellow-100 text-yellow-600';
      case 'promotion':
        return 'bg-purple-100 text-purple-600';
      case 'message':
        return 'bg-cyan-100 text-cyan-600';
      case 'system':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-nilin-coral/20 text-nilin-coral';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Breadcrumb />
        </div>
        <div className="flex-1">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-10 w-32 rounded-nilin" />
            </div>

            {/* Tabs skeleton */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>

            {/* Notifications skeleton */}
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="glass-nilin rounded-nilin-lg p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">Notifications</h1>
                <p className="text-nilin-warmGray">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="btn-nilin flex items-center gap-2"
              >
                <CheckCheck className="w-5 h-5" />
                Mark All Read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Notification views" className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              role="tab"
              aria-selected={activeTab === 'notifications'}
              tabIndex={activeTab === 'notifications' ? 0 : -1}
              onClick={() => setActiveTab('notifications')}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'notifications'
                  ? 'border-nilin-coral text-nilin-coral'
                  : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              <Bell className="w-4 h-4" />
              All Notifications
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'digest'}
              tabIndex={activeTab === 'digest' ? 0 : -1}
              onClick={() => setActiveTab('digest')}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'digest'
                  ? 'border-nilin-coral text-nilin-coral'
                  : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              <BellRing className="w-4 h-4" />
              Digest Settings
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'digest' ? (
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="mb-6">
                <h2 className="text-xl font-serif text-nilin-charcoal mb-2">Notification Digest</h2>
                <p className="text-nilin-warmGray">
                  Receive a summary of your notifications instead of individual alerts. Choose when and how you want to be notified.
                </p>
              </div>
              <DigestPreferences />
            </div>
          ) : (
          <>
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-800">{error}</span>
              </div>
              <button
                type="button"
                onClick={fetchNotifications}
                className="px-4 py-2 text-sm font-medium text-red-800 border border-red-300 rounded-lg hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No notifications</h3>
              <p className="text-nilin-warmGray max-w-md mx-auto">
                You're all caught up! We'll notify you when something important happens.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`glass-nilin rounded-nilin-lg p-4 hover-lift transition-all cursor-pointer ${
                    !notification.isRead ? 'bg-nilin-blush/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium ${!notification.isRead ? 'text-nilin-charcoal' : 'text-nilin-warmGray'}`}>
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <span className="w-2 h-2 rounded-full bg-nilin-coral flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-nilin-warmGray mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <span className="text-xs text-nilin-lightGray mt-2 block">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              disabled={loadingIds.has(notification.id)}
                              className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-nilin-muted transition-colors text-nilin-warmGray hover:text-nilin-charcoal disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              {loadingIds.has(notification.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification.id);
                            }}
                            disabled={loadingIds.has(notification.id)}
                            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-nilin-warmGray hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete"
                            aria-label="Delete notification"
                          >
                            {loadingIds.has(notification.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clear All Read */}
          {notifications.some(n => n.isRead) && (
            <div className="mt-6 text-center">
              <button
                onClick={async () => {
                  // Store previous state for rollback
                  const previousNotifications = [...notifications];

                  // Optimistic update
                  setNotifications(prev => prev.filter(n => !n.isRead));

                  try {
                    await notificationApi.deleteAllRead();
                    toast.success('Read notifications cleared');
                  } catch (err: unknown) {
                    // Rollback on failure
                    setNotifications(previousNotifications);
                    const axiosErr = err as { response?: { data?: { message?: string } } };
                    toast.error(axiosErr.response?.data?.message || 'Failed to clear read notifications. Please try again.');
                  }
                }}
                className="text-sm text-nilin-warmGray hover:text-nilin-coral transition-colors"
              >
                Clear all read notifications
              </button>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default NotificationsPage;
