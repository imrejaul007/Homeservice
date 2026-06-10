/**
 * Notification Center Component
 * Full-featured notification list with filtering, pagination, and actions
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Search,
  X,
  Loader2,
  Calendar,
  CreditCard,
  Star,
  Settings,
  Gift,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Filter,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { notificationApi, type Notification } from '../../services/notificationApi';

export interface NotificationItem {
  id: string;
  type: 'booking' | 'payment' | 'review' | 'system' | 'promotion' | 'message';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: Date | string;
  readAt?: Date | string;
  channels?: {
    inApp?: { sent: boolean; sentAt?: Date | string; read?: boolean; readAt?: Date | string };
    email?: { sent: boolean; sentAt?: Date | string };
    sms?: { sent: boolean; sentAt?: Date | string };
    push?: { sent: boolean; sentAt?: Date | string };
    whatsapp?: { sent: boolean; sentAt?: Date | string };
    telegram?: { sent: boolean; sentAt?: Date | string };
  };
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  maxHeight?: string;
}

type FilterType = 'all' | 'booking' | 'payment' | 'review' | 'promotion' | 'system' | 'message';
type SortOrder = 'newest' | 'oldest' | 'unread_first';

interface Toast {
  id: string;
  notification: NotificationItem;
  isVisible: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  className,
  maxHeight = '600px',
}) => {
  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Infinite scroll ref
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1 && !append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const response = await notificationApi.getNotifications({
        page: pageNum,
        limit: 20,
        unreadOnly: false,
      });

      const newNotifications = response.data.notifications.map((n) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      })) as NotificationItem[];

      if (append) {
        setNotifications(prev => [...prev, ...newNotifications]);
      } else {
        setNotifications(newNotifications);
      }

      setUnreadCount(response.data.unreadCount);
      setHasMore(newNotifications.length === 20);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(1, false);
    }
  }, [isOpen, fetchNotifications]);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchNotifications(1, false);
  }, [fetchNotifications]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      fetchNotifications(page + 1, true);
    }
  }, [isLoadingMore, hasMore, isLoading, page, fetchNotifications]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, handleLoadMore]);

  // Mark as read
  const handleMarkAsRead = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark as read');
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    setActionLoading('all');
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date() })));
      setUnreadCount(0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark all as read');
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Delete notification
  const handleDelete = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await notificationApi.deleteNotification(id);
      const deleted = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deleted && !deleted.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete notification');
    } finally {
      setActionLoading(null);
    }
  }, [notifications]);

  // Delete all read
  const handleDeleteAllRead = useCallback(async () => {
    setActionLoading('deleteAll');
    try {
      await notificationApi.deleteAllRead();
      setNotifications(prev => prev.filter(n => !n.isRead));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete read notifications');
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Filter and sort notifications
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        n =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(n => n.type === filterType);
    }

    // Unread filter
    if (filterUnread) {
      result = result.filter(n => !n.isRead);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      switch (sortOrder) {
        case 'oldest':
          return dateA - dateB;
        case 'unread_first':
          if (a.isRead !== b.isRead) {
            return a.isRead ? 1 : -1;
          }
          return dateB - dateA;
        case 'newest':
        default:
          return dateB - dateA;
      }
    });

    return result;
  }, [notifications, searchQuery, filterType, filterUnread, sortOrder]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, NotificationItem[]>();

    filteredNotifications.forEach(notification => {
      const date = new Date(notification.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
      }

      const existing = groups.get(groupKey) || [];
      existing.push(notification);
      groups.set(groupKey, existing);
    });

    return groups;
  }, [filteredNotifications]);

  // Get type icon
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

  // Get type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'booking':
        return 'bg-blue-100 text-blue-600';
      case 'payment':
        return 'bg-green-100 text-green-600';
      case 'review':
        return 'bg-yellow-100 text-yellow-600';
      case 'promotion':
        return 'bg-purple-100 text-purple-600';
      case 'system':
        return 'bg-gray-100 text-gray-600';
      case 'message':
        return 'bg-cyan-100 text-cyan-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Format time
  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const hasUnread = notifications.some(n => !n.isRead);
  const hasReadNotifications = notifications.some(n => n.isRead);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col',
          'animate-slide-in-right',
          className
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#E8B4A8] to-[#D4A5A5] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-lg">Notifications</h2>
                <p className="text-white/80 text-sm">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                    : 'All caught up!'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-4">
            {hasUnread && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={actionLoading === 'all'}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === 'all' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark all read
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]',
                'text-sm'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Filter */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className={cn(
                  'appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]',
                  'text-sm bg-white cursor-pointer'
                )}
              >
                <option value="all">All types</option>
                <option value="booking">Booking</option>
                <option value="payment">Payment</option>
                <option value="review">Review</option>
                <option value="system">System</option>
                <option value="promotion">Promotion</option>
                <option value="message">Message</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className={cn(
                  'appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]',
                  'text-sm bg-white cursor-pointer'
                )}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="unread_first">Unread first</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Unread Toggle */}
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors',
                filterUnread
                  ? 'bg-[#E8B4A8] border-[#E8B4A8] text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4" />
              Unread only
            </button>

            {/* Clear Filters */}
            {(searchQuery || filterType !== 'all' || filterUnread || sortOrder !== 'newest') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterUnread(false);
                  setSortOrder('newest');
                }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#E8B4A8] animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <p className="text-gray-600 text-center mb-4">{error}</p>
              <button
                onClick={() => fetchNotifications(1)}
                className="px-4 py-2 bg-[#E8B4A8] text-white rounded-lg hover:bg-[#D4A5A5] transition-colors"
              >
                Try again
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BellOff className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="font-medium text-gray-900 mb-1">No notifications</h4>
              <p className="text-sm text-gray-500 text-center">
                {notifications.length === 0
                  ? "You're all caught up! New notifications will appear here."
                  : "No notifications match your current filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Array.from(groupedNotifications.entries()).map(([groupLabel, groupNotifications]) => (
                <div key={groupLabel}>
                  {/* Date Header */}
                  <div className="px-4 py-2 bg-gray-50 sticky top-0 z-10">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {groupLabel}
                    </span>
                  </div>

                  {/* Notifications */}
                  {groupNotifications.map((notification) => {
                    const isExpanded = expandedId === notification.id;
                    const isActionLoading = actionLoading === notification.id;
                    const Icon = getTypeIcon(notification.type);

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-4 transition-colors',
                          !notification.isRead && 'bg-blue-50/30',
                          'hover:bg-gray-50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Type Icon */}
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            getTypeColor(notification.type)
                          )}>
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className={cn(
                                    'text-sm font-medium',
                                    notification.isRead ? 'text-gray-600' : 'text-gray-900'
                                  )}>
                                    {notification.title}
                                  </h4>
                                  {!notification.isRead && (
                                    <span className="w-2 h-2 bg-[#E8B4A8] rounded-full flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                  {notification.message}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {formatTime(notification.createdAt)}
                                </span>
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  notification.isRead
                                    ? 'bg-gray-100 text-gray-500'
                                    : 'bg-blue-100 text-blue-600'
                                )}>
                                  {notification.isRead ? 'Read' : 'New'}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-3">
                              {!notification.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  disabled={isActionLoading}
                                  className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                                    'text-gray-600 hover:bg-gray-200',
                                    isActionLoading && 'opacity-50'
                                  )}
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  Mark read
                                </button>
                              )}

                              <button
                                onClick={() => setExpandedId(isExpanded ? null : notification.id)}
                                className={cn(
                                  'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                                  'text-gray-600 hover:bg-gray-200'
                                )}
                              >
                                {isExpanded ? 'Less' : 'Details'}
                              </button>

                              <button
                                onClick={() => handleDelete(notification.id)}
                                disabled={isActionLoading}
                                className={cn(
                                  'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                                  'text-red-600 hover:bg-red-50',
                                  isActionLoading && 'opacity-50'
                                )}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                Delete
                              </button>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                                {/* Metadata */}
                                {notification.data && Object.keys(notification.data).length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                      Details
                                    </h5>
                                    <div className="space-y-1">
                                      {Object.entries(notification.data).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-2 text-sm">
                                          <span className="text-gray-500 capitalize min-w-[100px]">{key}:</span>
                                          <span className="text-gray-900">{String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Delivery Status */}
                                {notification.channels && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                      Delivered via
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(notification.channels)
                                        .filter(([_, status]) => status?.sent)
                                        .map(([channel]) => (
                                          <span
                                            key={channel}
                                            className="px-2 py-1 bg-white rounded text-xs text-gray-600 capitalize flex items-center gap-1"
                                          >
                                            {channel === 'inApp' ? (
                                              <CheckCircle className="w-3 h-3 text-green-500" />
                                            ) : (
                                              <Check className="w-3 h-3" />
                                            )}
                                            {channel === 'inApp' ? 'In-app' : channel}
                                          </span>
                                        ))}
                                      {!Object.values(notification.channels || {}).some(c => c?.sent) && (
                                        <span className="text-xs text-gray-500">In-app only</span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Timestamps */}
                                <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-200">
                                  <p>Created: {new Date(notification.createdAt).toLocaleString()}</p>
                                  {notification.readAt && (
                                    <p>Read: {new Date(notification.readAt).toLocaleString()}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Load More Trigger */}
              <div ref={loadMoreRef} className="p-4 text-center">
                {isLoadingMore && (
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                )}
                {!hasMore && notifications.length > 0 && (
                  <p className="text-sm text-gray-400">You've reached the end</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasReadNotifications && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleDeleteAllRead}
              disabled={actionLoading === 'deleteAll'}
              className={cn(
                'flex items-center gap-2 mx-auto px-4 py-2 text-sm font-medium text-gray-600',
                'hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors',
                actionLoading === 'deleteAll' && 'opacity-50'
              )}
            >
              {actionLoading === 'deleteAll' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete all read notifications
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationCenter;
