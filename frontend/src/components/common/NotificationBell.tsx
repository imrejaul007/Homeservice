import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Clock, AlertCircle, Calendar, MessageSquare, Star, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { socketService, type NotificationEvent } from '../../services/socket';
import { useAuthStore } from '../../stores/authStore';

interface Notification {
  _id: string;
  type: 'booking' | 'message' | 'message_received' | 'chat' | 'support' | 'system' | 'promotion' | 'payment' | 'review';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

interface NotificationBellProps {
  userId?: string;
  userRole?: 'customer' | 'provider' | 'admin';
}

function normalizeNotification(raw: Partial<Notification> & { id?: string }): Notification {
  const id = raw._id || raw.id || '';
  return {
    _id: id,
    type: (raw.type as Notification['type']) || 'system',
    title: raw.title || '',
    message: raw.message || '',
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt || new Date().toISOString(),
    data: raw.data,
  };
}

// Custom NILIN-styled Bell SVG Component
const NilinBellIcon: React.FC<{ hasUnread: boolean; isRinging: boolean }> = ({ hasUnread, isRinging }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-colors duration-300 ${isRinging ? 'animate-nilin-bell-ringing' : ''}`}
  >
    {/* Bell body */}
    <path
      d="M12 2C10.9 2 10 2.9 10 4V4.29C7.19 5.17 5 7.92 5 11V15L3 17V18H21V17L19 15V11C19 7.92 16.81 5.17 14 4.29V4C14 2.9 13.1 2 12 2ZM12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22Z"
      fill={hasUnread ? '#E8B4A8' : '#6B6B6B'}
      className="transition-colors duration-300"
    />
    {/* Bell top mount */}
    <path
      d="M12 1V0C12 0 13 0 13 1V2H11V1C11 0 12 0 12 1Z"
      fill={hasUnread ? '#D4A89A' : '#9B9B9B'}
      className="transition-colors duration-300"
    />
    {/* Glow effect when has unread */}
    {hasUnread && (
      <circle
        cx="12"
        cy="13"
        r="10"
        fill="none"
        stroke="#E8B4A8"
        strokeWidth="2"
        strokeDasharray="4 2"
        className="animate-pulse opacity-50"
      />
    )}
  </svg>
);

// Empty state bell icon
const NilinBellOffIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C10.9 2 10 2.9 10 4V4.29C7.19 5.17 5 7.92 5 11V15L3 17V18H21V17L19 15V11C19 7.92 16.81 5.17 14 4.29V4C14 2.9 13.1 2 12 2Z"
      fill="#9B9B9B"
    />
    <path
      d="M12 1V0C12 0 13 0 13 1V2H11V1C11 0 12 0 12 1Z"
      fill="#BDBDBD"
    />
    {/* Crossed out line */}
    <line x1="4" y1="4" x2="20" y2="20" stroke="#9B9B9B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, userRole = 'customer' }) => {
  const navigate = useNavigate();
  const { isAuthenticated, tokens } = useAuthStore();
  const hasAuthToken = isAuthenticated && Boolean(tokens?.accessToken);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadCount = useRef(unreadCount);

  // Handle new notification from socket
  const handleNewNotification = useCallback((event: NotificationEvent) => {
    // Add new notification to the list
    const newNotification: Notification = {
      _id: event.id,
      type: (event.type as string) as Notification['type'],
      title: event.title,
      message: event.message,
      isRead: false,
      createdAt: new Date(event.timestamp).toISOString(),
      data: event.data,
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
    setUnreadCount(prev => prev + 1);

    // Trigger ringing animation on new notification
    setIsRinging(true);
    setTimeout(() => setIsRinging(false), 1500);

    // Play sound or show toast if window is not focused
    if (document.hidden) {
      // Could play notification sound here
    }
  }, []);

  // Connect to socket and listen for notifications
  useEffect(() => {
    if (!userId || !hasAuthToken) return;

    let unsubscribe: (() => void) | undefined;

    // Connect to socket
    socketService.connect().then(() => {
      setIsConnected(true);

      // Listen for new notifications
      unsubscribe = socketService.onNewNotification(handleNewNotification);
    }).catch(() => {
      setIsConnected(false);
    });

    // Cleanup on unmount: only unsubscribe, let singleton manage socket lifecycle
    return () => {
      unsubscribe?.();
      // CRITICAL FIX: Do NOT disconnect socket here - it's a singleton shared across all components
      // The socketService singleton manages its own lifecycle
    };
  }, [userId, hasAuthToken, handleNewNotification]);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const response = await api.get('/notifications', {
        params: { limit: 10 }
      });
      if (response.data?.success) {
        const payload = response.data.data;
        const list = Array.isArray(payload)
          ? payload
          : payload?.notifications ?? [];
        setNotifications(list.map(normalizeNotification));
        setUnreadCount(payload?.unreadCount ?? response.data.unreadCount ?? 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!userId) return;
    try {
      const response = await api.get('/notifications/unread-count');
      if (response.data?.success) {
        setUnreadCount(response?.data?.data?.count ?? 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      toast.error('Failed to load unread count');
    }
  };

  useEffect(() => {
    if (userId && hasAuthToken) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userId, hasAuthToken]);

  // Ring animation when new notifications arrive
  useEffect(() => {
    if (unreadCount > prevUnreadCount.current) {
      setIsRinging(true);
      setTimeout(() => setIsRinging(false), 1500);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Mark as read
  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n =>
          n._id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <Calendar className="h-4 w-4 text-nilin-coral" />;
      case 'message':
      case 'message_received':
      case 'chat':
        return <MessageSquare className="h-4 w-4 text-nilin-success" />;
      case 'promotion':
        return <Star className="h-4 w-4 text-yellow-500" />;
      case 'review':
        return <Star className="h-4 w-4 text-nilin-rose" />;
      case 'support':
        return <AlertCircle className="h-4 w-4 text-nilin-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-nilin-warmGray" />;
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
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

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    setIsOpen(false);

    const bookingId = notification.data?.bookingId as string | undefined;
    const isProvider = userRole === 'provider';

    if (bookingId) {
      navigate(isProvider ? `/provider/bookings/${bookingId}` : `/customer/bookings/${bookingId}`);
    } else if (notification.type === 'booking') {
      navigate(isProvider ? '/provider/bookings' : '/customer/bookings');
    } else if (notification.type === 'message' || notification.type === 'message_received' || notification.type === 'chat' || notification.type === 'support') {
      // For chat/support types, treat as message navigation
      const chatRoomId = notification.data?.chatRoomId as string | undefined;
      const bookingIdFromChat = notification.data?.bookingId as string | undefined;
      navigate(isProvider ? '/provider/messages' : '/customer/messages', {
        state: chatRoomId || bookingIdFromChat
          ? {
              bookingId: bookingIdFromChat,
              providerId: notification.data?.providerId as string | undefined,
              customerId: notification.data?.customerId as string | undefined,
            }
          : undefined,
      });
    } else {
      navigate(isProvider ? '/provider/dashboard' : '/customer/notifications');
    }
  };

  if (!userId) return null;

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button - NILIN styled with glass effect */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`
          relative p-2.5 rounded-full transition-all duration-300
          ${hasUnread
            ? 'bg-nilin-blush/50 hover:bg-nilin-blush shadow-nilin-warm'
            : 'hover:bg-nilin-muted'
          }
          ${isRinging ? 'animate-nilin-bell-button' : ''}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
        `}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
      >
        {/* Glass effect background */}
        <div className={`
          absolute inset-0 rounded-full transition-opacity duration-300
          ${hasUnread ? 'opacity-100' : 'opacity-0'}
        `}>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-nilin-peach/30 to-nilin-blush/30" />
        </div>

        {/* Bell Icon */}
        <div className="relative z-10">
          {hasUnread ? (
            <NilinBellIcon hasUnread={true} isRinging={isRinging} />
          ) : (
            <NilinBellOffIcon />
          )}
        </div>

        {/* Unread Badge - NILIN styled */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-nilin-coral rounded-full px-1 shadow-nilin-warm animate-nilin-badge-pulse z-20">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - NILIN styled */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-3 w-80 rounded-nilin-lg shadow-nilin-lg bg-white ring-1 ring-nilin-border z-50 overflow-hidden animate-nilin-dropdown-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-nilin-border/50 bg-gradient-to-r from-nilin-cream to-nilin-peach/20">
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-medium text-nilin-charcoal text-lg">Notifications</h3>
              {hasUnread && (
                <span className="px-2 py-0.5 text-[10px] font-medium text-white bg-nilin-coral rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-nilin-coral hover:text-nilin-rose font-medium transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-nilin-blush/50 transition-colors"
              >
                <X className="h-4 w-4 text-nilin-warmGray" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto scrollbar-nilin">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-nilin-coral border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-nilin-warmGray mt-3">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-nilin-muted flex items-center justify-center">
                  <NilinBellOffIcon />
                </div>
                <p className="text-sm text-nilin-warmGray font-medium">No notifications yet</p>
                <p className="text-xs text-nilin-lightGray mt-1">We'll notify you when something arrives</p>
              </div>
            ) : (
              notifications.map((notification, index) => (
                <div
                  key={notification._id || `notification-${notification.createdAt}-${notification.title}`}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    px-4 py-3 cursor-pointer border-b border-nilin-border/30
                    transition-all duration-200 hover:bg-nilin-blush/30
                    ${!notification.isRead ? 'bg-nilin-blush/20' : ''}
                    ${index === 0 && !notification.isRead ? 'rounded-t-nilin-lg' : ''}
                    ${index === notifications.length - 1 ? 'rounded-b-nilin-lg' : ''}
                  `}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon container */}
                    <div className={`
                      flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                      ${!notification.isRead ? 'bg-nilin-coral/10' : 'bg-nilin-muted'}
                    `}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`
                          text-sm truncate
                          ${!notification.isRead ? 'font-semibold text-nilin-charcoal' : 'text-nilin-warmGray'}
                        `}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="h-2 w-2 bg-nilin-coral rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex items-center mt-1.5 gap-2">
                        <Clock className="h-3 w-3 text-nilin-lightGray" />
                        <span className="text-[10px] text-nilin-lightGray">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Quick action */}
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification._id);
                        }}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-nilin-coral/20 text-nilin-warmGray hover:text-nilin-coral transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-nilin-border/50 bg-gradient-to-r from-nilin-muted/50 to-nilin-cream/50">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(userRole === 'provider' ? '/provider/notifications' : '/customer/notifications');
              }}
              className="w-full text-center text-sm text-nilin-coral hover:text-nilin-rose font-medium transition-colors py-1"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
