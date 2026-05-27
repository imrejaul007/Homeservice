import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, BellOff, Check, Clock, AlertCircle, Calendar, MessageSquare, Star, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { socketService, type NotificationEvent } from '../../services/socket';

interface Notification {
  _id: string;
  type: 'booking' | 'message' | 'system' | 'promotion' | 'payment' | 'review';
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

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, userRole = 'customer' }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle new notification from socket
  const handleNewNotification = useCallback((event: NotificationEvent) => {
    // Add new notification to the list
    const newNotification: Notification = {
      _id: event.id,
      type: event.type,
      title: event.title,
      message: event.message,
      isRead: false,
      createdAt: new Date(event.timestamp).toISOString(),
      data: event.data,
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
    setUnreadCount(prev => prev + 1);

    // Play sound or show toast if window is not focused
    if (document.hidden) {
      // Could play notification sound here
    }
  }, []);

  // Connect to socket and listen for notifications
  useEffect(() => {
    if (!userId) return;

    // Connect to socket
    socketService.connect().then(() => {
      setIsConnected(true);

      // Listen for new notifications
      socketService.on('notification:new', handleNewNotification);
    }).catch(err => {
      console.error('Failed to connect to socket:', err);
      setIsConnected(false);
    });

    // Disconnect on unmount
    return () => {
      const unsubscribe = socketService.onNewNotification(handleNewNotification);
      unsubscribe();
      socketService.disconnect();
    };
  }, [userId, handleNewNotification]);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const response = await api.get('/notifications', {
        params: { limit: 10 }
      });
      if (response.data?.success) {
        setNotifications(response.data.data || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
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
        setUnreadCount(response.data.data?.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

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
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'promotion':
        return <Star className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
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

    // Navigate based on notification type
    if (notification.data?.bookingId) {
      navigate(`/bookings/${notification.data.bookingId}`);
    } else if (notification.type === 'booking') {
      navigate('/provider/bookings');
    } else if (notification.type === 'message') {
      navigate('/messages');
    } else {
      navigate('/notifications');
    }
  };

  if (!userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/50 transition-colors relative"
      >
        {unreadCount > 0 ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-nilin-coral rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-xl shadow-nilin-lg bg-white ring-1 ring-nilin-border z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-nilin-border/50">
            <h3 className="font-semibold text-nilin-charcoal">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-nilin-coral hover:text-nilin-coral/80 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-nilin-warmGray" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-nilin-coral border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-nilin-warmGray">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-nilin-border/30 last:border-b-0 ${
                    !notification.isRead ? 'bg-nilin-blush/20' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.isRead ? 'font-medium text-nilin-charcoal' : 'text-nilin-charcoal'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center mt-1">
                        <Clock className="h-3 w-3 text-nilin-warmGray mr-1" />
                        <span className="text-[10px] text-nilin-warmGray">
                          {formatTime(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                          <span className="ml-2 h-2 w-2 bg-nilin-coral rounded-full"></span>
                        )}
                      </div>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification._id);
                        }}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-200 text-nilin-warmGray hover:text-nilin-coral"
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
          <div className="px-4 py-3 border-t border-nilin-border/50 bg-gray-50/50">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full text-center text-sm text-nilin-coral hover:text-nilin-coral/80 font-medium"
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
