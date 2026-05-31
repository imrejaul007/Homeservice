/**
 * Notification History Component
 * Display and manage notification history with filtering and actions
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Search,
  X,
  Loader2,
  Calendar,
  MessageSquare,
  CreditCard,
  Star,
  Settings,
  Gift,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface NotificationItem {
  id: string;
  type: 'booking' | 'payment' | 'review' | 'system' | 'promotion';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
  channels?: {
    inApp?: { sent: boolean; sentAt?: Date; read?: boolean; readAt?: Date };
    email?: { sent: boolean; sentAt?: Date };
    sms?: { sent: boolean; sentAt?: Date };
    push?: { sent: boolean; sentAt?: Date };
    whatsapp?: { sent: boolean; sentAt?: Date };
    telegram?: { sent: boolean; sentAt?: Date };
  };
}

interface NotificationHistoryProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteAllRead: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAllRead,
  isLoading = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<NotificationItem['type'] | 'all'>('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filterType !== 'all' && notification.type !== filterType) {
        return false;
      }

      // Unread filter
      if (filterUnread && notification.isRead) {
        return false;
      }

      return true;
    });
  }, [notifications, searchQuery, filterType, filterUnread]);

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

  const handleMarkAsRead = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await onMarkAsRead(id);
    } finally {
      setActionLoading(null);
    }
  }, [onMarkAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    setActionLoading('all');
    try {
      await onMarkAllAsRead();
    } finally {
      setActionLoading(null);
    }
  }, [onMarkAllAsRead]);

  const handleDelete = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await onDelete(id);
    } finally {
      setActionLoading(null);
    }
  }, [onDelete]);

  const handleDeleteAllRead = useCallback(async () => {
    setActionLoading('deleteAll');
    try {
      await onDeleteAllRead();
    } finally {
      setActionLoading(null);
    }
  }, [onDeleteAllRead]);

  const getTypeIcon = (type: NotificationItem['type']) => {
    const icons = {
      booking: Calendar,
      payment: CreditCard,
      review: Star,
      system: Settings,
      promotion: Gift,
    };
    const Icon = icons[type] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  const getTypeColor = (type: NotificationItem['type']) => {
    const colors = {
      booking: 'bg-blue-100 text-blue-600',
      payment: 'bg-green-100 text-green-600',
      review: 'bg-yellow-100 text-yellow-600',
      system: 'bg-gray-100 text-gray-600',
      promotion: 'bg-purple-100 text-purple-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const hasUnread = notifications.some(n => !n.isRead);
  const hasReadNotifications = notifications.some(n => n.isRead);

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#E8B4A8] to-[#D4A5A5] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-white/80 text-sm">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                  : 'All caught up!'}
              </p>
            </div>
          </div>

          {/* Bulk Actions */}
          {hasUnread && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={actionLoading === 'all'}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
            >
              {actionLoading === 'all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              Mark all read
            </button>
          )}
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
        <div className="flex items-center gap-3">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
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
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Unread Filter Toggle */}
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
          {(searchQuery || filterType !== 'all' || filterUnread) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setFilterUnread(false);
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}

          {/* Results count */}
          <span className="ml-auto text-sm text-gray-500">
            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#E8B4A8] animate-spin" />
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

                {/* Notifications in Group */}
                {groupNotifications.map((notification) => {
                  const isExpanded = expandedId === notification.id;
                  const isActionLoading = actionLoading === notification.id;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 transition-colors',
                        !notification.isRead && 'bg-blue-50/50',
                        'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type Icon */}
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                          getTypeColor(notification.type)
                        )}>
                          {getTypeIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className={cn(
                                  'text-sm font-medium',
                                  notification.isRead ? 'text-gray-700' : 'text-gray-900'
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

                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {formatTime(notification.createdAt)}
                            </span>
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
                                Mark as read
                              </button>
                            )}

                            <button
                              onClick={() => setExpandedId(isExpanded ? null : notification.id)}
                              className={cn(
                                'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                                'text-gray-600 hover:bg-gray-200'
                              )}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  Less
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-3 h-3" />
                                  Details
                                </>
                              )}
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
                                        <span className="text-gray-500 capitalize">{key}:</span>
                                        <span className="text-gray-900">{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Delivery Channels */}
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
                                          className="px-2 py-1 bg-white rounded text-xs text-gray-600 capitalize"
                                        >
                                          {channel}
                                        </span>
                                      ))}
                                    {!Object.values(notification.channels || {}).some(c => c?.sent) && (
                                      <span className="text-xs text-gray-500">In-app only</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Timestamps */}
                              <div className="text-xs text-gray-500 space-y-1">
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
  );
};

export default NotificationHistory;
