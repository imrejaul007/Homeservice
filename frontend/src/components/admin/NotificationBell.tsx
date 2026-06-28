/**
 * NotificationBell Component
 * Bell icon with unread count badge and dropdown for recent notifications
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Settings, Check, CheckCheck, X } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { adminNotificationService } from '../../services/adminNotificationService';
import type { AdminNotification } from '../../types/notification';
import toast from 'react-hot-toast';

interface NotificationBellProps {
  /** Custom class for the bell button */
  className?: string;
  /** Maximum notifications to show in dropdown */
  maxNotifications?: number;
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: AdminNotification) => void;
}

export function NotificationBell({
  className = '',
  maxNotifications = 10,
  onNotificationClick,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  /**
   * Load initial notifications and subscribe to updates
   */
  useEffect(() => {
    // Load initial data
    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        const result = await adminNotificationService.getNotifications({
          limit: maxNotifications,
        });
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        console.error('[NotificationBell] Failed to load notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();

    // Subscribe to real-time notifications
    const unsubscribe = adminNotificationService.onNotification((notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, maxNotifications - 1)]);
      setUnreadCount((prev) => prev + 1);

      // Show toast for new notifications
      toast(notification.title, {
        description: notification.message,
        icon: '🔔',
        duration: 4000,
      });
    });

    // Subscribe to unread count changes
    const unsubscribeCount = adminNotificationService.onUnreadCountChange((count) => {
      setUnreadCount(count);
    });

    // Connect to WebSocket
    adminNotificationService.connect();

    return () => {
      unsubscribe();
      unsubscribeCount();
    };
  }, [maxNotifications]);

  /**
   * Handle click outside to close dropdown
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  /**
   * Handle notification click
   */
  const handleNotificationClick = useCallback(
    async (notification: AdminNotification) => {
      // Mark as read if unread
      if (!notification.isRead) {
        const success = await adminNotificationService.markAsRead(notification.id);
        if (success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }

      // Call custom handler if provided
      onNotificationClick?.(notification);

      // Close dropdown
      setIsOpen(false);
    },
    [onNotificationClick]
  );

  /**
   * Handle marking all as read
   */
  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const success = await adminNotificationService.markAllAsRead();
      if (success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('[NotificationBell] Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  /**
   * Handle dismiss notification
   */
  const handleDismiss = async (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && !notification.isRead) {
      await adminNotificationService.markAsRead(notificationId);
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  /**
   * Toggle dropdown
   */
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={toggleDropdown}
        className="relative flex items-center justify-center w-11 h-11 rounded-xl border border-nilin-border bg-white hover:bg-nilin-blush/50 transition-all text-nilin-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 bg-nilin-coral text-white text-xs font-bold rounded-full flex items-center justify-center animate-in fade-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl border border-nilin-border shadow-lg z-50 animate-fade-in overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-nilin-border bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-nilin-warmGray" />
              <h3 className="font-semibold text-nilin-charcoal">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-nilin-coral/10 text-nilin-coral rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAllRead}
                  className="p-1.5 rounded-lg hover:bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                  aria-label="Mark all as read"
                  title="Mark all as read"
                >
                  {isMarkingAllRead ? (
                    <div className="w-4 h-4 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[28rem] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-nilin-coral border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-nilin-border" />
                <p className="text-sm font-medium text-nilin-charcoal">No notifications</p>
                <p className="text-xs text-nilin-warmGray mt-1">
                  You'll see important updates here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-nilin-border/30">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-nilin-border bg-gray-50/50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notifications page
                  window.location.href = '/admin/notifications';
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-nilin-coral hover:bg-nilin-blush/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
