import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ChatWindow } from './ChatWindow';
import { Badge } from '../common/Badge';
import { chatApi, ChatMessage, ChatRoom, ChatRoomListItem } from '../../services/chatApi';
import { socketService } from '../../services/socket';

// =============================================================================
// Types
// =============================================================================

export interface ChatWidgetProps {
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** User avatar URL */
  userAvatar?: string;
  /** Badge count for unread messages */
  unreadCount?: number;
  /** Whether the widget is minimized by default */
  defaultMinimized?: boolean;
  /** Custom className */
  className?: string;
  /** On new message callback */
  onNewMessage?: (message: ChatMessage) => void;
  /** On unread count change */
  onUnreadCountChange?: (count: number) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ChatWidget({
  userId,
  userName,
  userAvatar,
  unreadCount: unreadCountProp = 0,
  defaultMinimized = true,
  className,
  onNewMessage,
  onUnreadCountChange,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(!defaultMinimized);
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | ChatRoomListItem | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoomListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(unreadCountProp);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Fetch chat rooms from API
  const fetchChatRooms = useCallback(async () => {
    if (!userId) return;

    setIsLoadingRooms(true);
    try {
      const response = await chatApi.getChatRooms({ limit: 20 });
      if (response.rooms) {
        setChatRooms(response.rooms);

        // Calculate total unread count
        const totalUnread = response.rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0);
        setUnreadCount(totalUnread);
        onUnreadCountChange?.(totalUnread);
      }
    } catch (err) {
      console.error('Error fetching chat rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [userId, onUnreadCountChange]);

  // Subscribe to real-time updates via socket
  useEffect(() => {
    if (!userId) return;

    // Subscribe to new messages
    const unsubscribeNewMessage = socketService.on('message:new', (data) => {
      // Update chat room with new message
      setChatRooms((prev) => {
        const updatedRooms = prev.map((room) => {
          // Match by booking ID (this is the correct property for MessageEvent)
          const matchesBooking = room.bookingId && room.bookingId === data.bookingId;
          if (matchesBooking) {
            return {
              ...room,
              lastMessage: {
                content: data.message,
                senderName: 'User',
                createdAt: new Date().toISOString(),
              },
              unreadCount: (room.unreadCount || 0) + 1,
            };
          }
          return room;
        });
        // Sort by last message time
        return updatedRooms.sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });
      });

      // Update unread count
      setUnreadCount((prev) => {
        const newCount = prev + 1;
        onUnreadCountChange?.(newCount);
        return newCount;
      });

      // Notify about new message
      if (onNewMessage) {
        onNewMessage({
          _id: '',
          chatRoomId: data.bookingId,
          senderId: data.senderId,
          receiverId: '',
          content: data.message,
          type: 'text',
          status: 'sent',
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Subscribe to message read status changes
    const unsubscribeRead = socketService.on('message:read', (data) => {
      setChatRooms((prev) =>
        prev.map((room) => {
          // Match by booking ID or room ID
          const matchesRoom = data.roomId && (room._id || (room as unknown as { id: string }).id) === data.roomId;
          const matchesBooking = room.bookingId && data.bookingId && room.bookingId === data.bookingId;
          return (matchesRoom || matchesBooking) ? { ...room, unreadCount: 0 } : room;
        })
      );
      setUnreadCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        onUnreadCountChange?.(newCount);
        return newCount;
      });
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeRead();
    };
  }, [userId, onNewMessage, onUnreadCountChange]);

  // Fetch chat rooms on mount and periodically
  useEffect(() => {
    fetchChatRooms();

    // Refresh every 30 seconds
    const interval = setInterval(fetchChatRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchChatRooms, userId]);

  // Handle click outside to minimize
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        // Don't auto-minimize if clicking inside the chat window
        if (isOpen && !isMinimized) {
          setIsMinimized(true);
        }
      }
    };

    if (isOpen && !isMinimized) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isMinimized]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsMinimized(true);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsMinimized(true);
    }
  }, [isOpen, isMinimized]);

  const handleOpenChat = useCallback((room: ChatRoom) => {
    setSelectedRoom(room);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(true);
    setSelectedRoom(null);
  }, []);

  const handleBackToRooms = useCallback(() => {
    setSelectedRoom(null);
  }, []);

  const handleUnreadChange = useCallback((count: number) => {
    setUnreadCount(count);
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  return (
    <div
      ref={widgetRef}
      className={cn(
        'fixed z-50 flex flex-col transition-all duration-300 ease-out',
        // Position
        'bottom-4 right-4 md:bottom-6 md:right-6',
        className
      )}
    >
      {/* Chat Window */}
      {isOpen && (
        <ChatWindow
          userId={userId}
          userName={userName}
          userAvatar={userAvatar}
          initialSelectedRoom={selectedRoom as ChatRoom | null}
          isMinimized={isMinimized}
          onClose={handleClose}
          onMinimize={() => setIsMinimized(true)}
          onExpand={() => setIsMinimized(false)}
          onSelectRoom={(room) => setSelectedRoom(room as ChatRoom | ChatRoomListItem | null)}
          onBackToRooms={handleBackToRooms}
          onNewMessage={onNewMessage}
          onUnreadChange={handleUnreadChange}
        />
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'relative flex items-center justify-center rounded-full shadow-lg transition-all duration-300',
          'bg-gradient-to-br from-[#E8B4A8] to-[#D4948A]',
          'hover:from-[#D4948A] hover:to-[#C07A72]',
          'active:scale-95',
          'focus:outline-none focus:ring-4 focus:ring-[#E8B4A8]/30',
          // Size
          'w-14 h-14 md:w-16 md:h-16',
          // Animation for open state
          isOpen && !isMinimized && 'opacity-0 scale-0 pointer-events-none'
        )}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {/* Chat Icon */}
        <svg
          className="w-6 h-6 md:w-7 md:h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

// =============================================================================
// Export
// =============================================================================

export default ChatWidget;
