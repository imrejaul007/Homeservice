/**
 * Unread Badge Component
 * Notification count badge with animated updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { notificationApi } from '../../services/notificationApi';
import toast from 'react-hot-toast';

interface UnreadBadgeProps {
  onClick: () => void;
  className?: string;
  showZero?: boolean;
  maxCount?: number;
  pollingInterval?: number; // ms, default 30000 (30 seconds)
}

export const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  onClick,
  className,
  showZero = false,
  maxCount = 99,
  pollingInterval = 30000,
}) => {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const previousCountRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      const newCount = response.data.count;

      // Check for new notifications
      if (newCount > previousCountRef.current && previousCountRef.current > 0) {
        setHasNewNotifications(true);
        setTimeout(() => setHasNewNotifications(false), 2000);
      }

      // Animate if count changed
      if (newCount !== count) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }

      setCount(newCount);
      previousCountRef.current = newCount;
    } catch (error) {
      toast.error('Failed to load unread count');
    } finally {
      setIsLoading(false);
    }
  }, [count]);

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount();

    // Set up polling
    pollIntervalRef.current = setInterval(fetchUnreadCount, pollingInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchUnreadCount, pollingInterval]);

  // Listen for custom events (when new notifications are added)
  useEffect(() => {
    const handleNewNotification = () => {
      fetchUnreadCount();
    };

    window.addEventListener('new-notification', handleNewNotification);
    return () => {
      window.removeEventListener('new-notification', handleNewNotification);
    };
  }, [fetchUnreadCount]);

  // Format display count
  const displayCount = count > maxCount ? `${maxCount}+` : count;

  // Don't show badge if count is 0 and showZero is false
  if (!showZero && count === 0 && !isLoading) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'relative p-2 rounded-full hover:bg-gray-100 transition-colors',
          className
        )}
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-2 rounded-full hover:bg-gray-100 transition-colors',
        hasNewNotifications && 'animate-pulse',
        className
      )}
      aria-label={`${count} unread notifications`}
    >
      {/* Bell Icon */}
      {isLoading ? (
        <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
      ) : (
        <Bell
          className={cn(
            'w-5 h-5 transition-transform',
            isAnimating && 'scale-125',
            count > 0 ? 'text-[#E8B4A8]' : 'text-gray-600'
          )}
        />
      )}

      {/* Badge */}
      {count > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full',
            'flex items-center justify-center text-xs font-bold',
            'bg-[#E8B4A8] text-white',
            'shadow-sm',
            'transition-all duration-300',
            isAnimating && 'scale-125',
            hasNewNotifications && 'animate-bounce'
          )}
        >
          {displayCount}
        </span>
      )}

      {/* Pulse ring for new notifications */}
      {hasNewNotifications && (
        <span className="absolute inset-0 rounded-full bg-[#E8B4A8]/30 animate-ping" />
      )}
    </button>
  );
};

// Compact version for navbar
export const UnreadBadgeCompact: React.FC<UnreadBadgeProps> = ({
  onClick,
  className,
  maxCount = 9,
  pollingInterval = 30000,
}) => {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch unread count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await notificationApi.getUnreadCount();
        setCount(response.data.count);
      } catch (error) {
        toast.error('Failed to load unread count');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, pollingInterval);
    return () => clearInterval(interval);
  }, [pollingInterval]);

  if (count === 0 && !isLoading) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center',
        'w-5 h-5 rounded-full',
        'bg-[#E8B4A8] text-white text-xs font-bold',
        'transition-transform hover:scale-110',
        className
      )}
      aria-label={`${count} unread`}
    >
      {count > maxCount ? `${maxCount}+` : count}
    </button>
  );
};

// Dot version (just a small indicator)
export const UnreadDot: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className }) => {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await notificationApi.getUnreadCount();
        setHasUnread(response.data.count > 0);
      } catch (error) {
        toast.error('Failed to load unread count');
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!hasUnread) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-2 h-2 rounded-full bg-[#E8B4A8]',
        'animate-pulse',
        className
      )}
      aria-label="Unread notifications"
    />
  );
};

export default UnreadBadge;
