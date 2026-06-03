import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/utils';
import { ChatWidget, ChatWidgetProps } from './ChatWidget';
import { chatApi, ChatMessage, ChatRoomListItem, ChatRoom as ChatRoomType } from '../../services/chatApi';
import { socketService } from '../../services/socket';

// =============================================================================
// Types
// =============================================================================

export interface ChatIntegrationProps {
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** User avatar URL */
  userAvatar?: string;
  /** Booking ID for booking-specific chat */
  bookingId?: string;
  /** Provider ID for provider-specific chat */
  providerId?: string;
  /** Current booking status (for booking chat) */
  bookingStatus?: string;
  /** Current user role */
  userRole: 'customer' | 'provider' | 'admin';
  /** Whether to show the floating chat button */
  showFloatingButton?: boolean;
  /** Position of floating button */
  floatingPosition?: 'bottom-right' | 'bottom-left';
  /** Custom className */
  className?: string;
  /** On chat room created callback */
  onChatRoomCreated?: (room: ChatRoomType) => void;
  /** On new message callback */
  onNewMessage?: (message: ChatMessage) => void;
}

export interface ChatTabProps {
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** User avatar URL */
  userAvatar?: string;
  /** Booking ID for this tab */
  bookingId?: string;
  /** Booking status */
  bookingStatus?: string;
  /** Custom className */
  className?: string;
  /** On room selected */
  onRoomSelected?: (room: ChatRoomType) => void;
}

export interface BookingChatProps {
  /** Booking ID */
  bookingId: string;
  /** Customer ID */
  customerId: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar */
  customerAvatar?: string;
  /** Provider ID */
  providerId: string;
  /** Provider name */
  providerName: string;
  /** Provider avatar */
  providerAvatar?: string;
  /** Current user ID */
  currentUserId: string;
  /** Current user role */
  currentUserRole: 'customer' | 'provider';
  /** Booking status */
  bookingStatus?: string;
  /** Service name */
  serviceName?: string;
  /** Scheduled date */
  scheduledDate?: string;
  /** Custom className */
  className?: string;
  /** On message sent */
  onMessageSent?: () => void;
}

// =============================================================================
// Chat Integration Component
// =============================================================================

export function ChatIntegration({
  userId,
  userName,
  userAvatar,
  bookingId,
  providerId,
  bookingStatus,
  userRole,
  showFloatingButton = true,
  floatingPosition = 'bottom-right',
  className,
  onChatRoomCreated,
  onNewMessage,
}: ChatIntegrationProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatRoom, setCurrentChatRoom] = useState<ChatRoomListItem | null>(null);

  // Fetch unread count on mount
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const result = await chatApi.getUnreadCount();
        setUnreadCount(result.total);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Subscribe to socket updates
    const unsubscribe = socketService.on('message:new', () => {
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // Create or get booking chat room
  const initializeBookingChat = useCallback(async () => {
    if (!bookingId) return null;

    setIsLoading(true);
    try {
      // Check if we already have a chat room for this booking
      const { rooms } = await chatApi.getChatRooms({ bookingId });

      if (rooms.length > 0) {
        const existingRoom = rooms.find(
          (r) => r.bookingId === bookingId
        );
        if (existingRoom) {
          setCurrentChatRoom(existingRoom);
          return existingRoom;
        }
      }

      // For booking chats, we need to use the booking chat endpoint
      // This is a simplified version - in production, you'd call the booking chat endpoint
      return null;
    } catch (error) {
      console.error('Error initializing booking chat:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  // Initialize booking chat on mount
  useEffect(() => {
    if (bookingId) {
      initializeBookingChat();
    }
  }, [bookingId, initializeBookingChat]);

  // Handle new message
  const handleNewMessage = useCallback(
    (message: ChatMessage) => {
      onNewMessage?.(message);
    },
    [onNewMessage]
  );

  // Handle unread count change
  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  return (
    <div className={cn('relative', className)}>
      {/* Chat Widget */}
      <ChatWidget
        userId={userId}
        userName={userName}
        userAvatar={userAvatar}
        unreadCount={unreadCount}
        defaultMinimized={true}
        onNewMessage={handleNewMessage}
        onUnreadCountChange={handleUnreadCountChange}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E8B4A8]" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Chat Tab Component (for in-page tabs)
// =============================================================================

export function ChatTab({
  userId,
  userName,
  userAvatar,
  bookingId,
  bookingStatus,
  className,
  onRoomSelected,
}: ChatTabProps) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'booking'>('rooms');
  const [rooms, setRooms] = useState<ChatRoomListItem[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomListItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch chat rooms
  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoading(true);
      try {
        const result = await chatApi.getChatRooms({ limit: 50 });
        setRooms(result.rooms || []);
      } catch (error) {
        console.error('Error fetching chat rooms:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, [userId]);

  // Handle room selection
  const handleRoomSelect = useCallback(
    (room: ChatRoomListItem) => {
      setSelectedRoom(room);
      onRoomSelected?.(room as ChatRoomType);
    },
    [onRoomSelected]
  );

  // Filter rooms by booking if applicable
  const filteredRooms = useMemo(() => {
    if (!bookingId) return rooms;
    return rooms.filter((r) => r.bookingId === bookingId);
  }, [rooms, bookingId]);

  return (
    <div className={cn('flex flex-col bg-white rounded-xl shadow-sm', className)}>
      {/* Tabs Header */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('rooms')}
          className={cn(
            'flex-1 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'rooms'
              ? 'text-[#E8B4A8] border-b-2 border-[#E8B4A8]'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          All Messages
        </button>
        {bookingId && (
          <button
            onClick={() => setActiveTab('booking')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'booking'
                ? 'text-[#E8B4A8] border-b-2 border-[#E8B4A8]'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Booking Chat
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-96">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E8B4A8]" />
          </div>
        ) : activeTab === 'rooms' ? (
          <div className="divide-y divide-gray-100">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No conversations yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Start a chat from a booking
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => (
                <RoomListItem
                  key={room.id}
                  room={room}
                  currentUserId={userId}
                  isSelected={selectedRoom?.id === room.id}
                  onClick={() => handleRoomSelect(room)}
                />
              ))
            )}
          </div>
        ) : (
          <BookingChatView
            bookingId={bookingId!}
            bookingStatus={bookingStatus}
            rooms={rooms.filter((r) => r.bookingId === bookingId)}
            onRoomSelect={handleRoomSelect}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Booking Chat View
// =============================================================================

interface BookingChatViewProps {
  bookingId: string;
  bookingStatus?: string;
  rooms: ChatRoomListItem[];
  onRoomSelect: (room: ChatRoomListItem) => void;
}

function BookingChatView({
  bookingId,
  bookingStatus,
  rooms,
  onRoomSelect,
}: BookingChatViewProps) {
  if (rooms.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E8B4A8]/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[#E8B4A8]"
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
        </div>
        <p className="text-gray-600 font-medium">No booking chat yet</p>
        <p className="text-sm text-gray-400 mt-1">
          The chat will be available once the booking is confirmed
        </p>
        {bookingStatus && (
          <div className="mt-3">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                bookingStatus === 'confirmed'
                  ? 'bg-green-100 text-green-800'
                  : bookingStatus === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              {bookingStatus}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {rooms.map((room) => (
        <RoomListItem
          key={room.id}
          room={room}
          currentUserId=""
          onClick={() => onRoomSelect(room)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Room List Item Component
// =============================================================================

interface RoomListItemProps {
  room: ChatRoomListItem;
  currentUserId: string;
  isSelected?: boolean;
  onClick: () => void;
}

function RoomListItem({
  room,
  currentUserId,
  isSelected,
  onClick,
}: RoomListItemProps) {
  const getParticipantName = (): string => {
    if (room.participants.length === 0) return 'Unknown';

    // For direct chats, show other participant name
    const otherParticipant = room.participants.find(
      (p) => (p.id ?? p._id) !== currentUserId
    );
    if (otherParticipant) {
      return otherParticipant.name;
    }

    // For booking chats, show booking info
    if (room.bookingId) {
      return `Booking ${room.bookingId}`;
    }

    return room.participants[0]?.name || 'Chat';
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left',
        isSelected && 'bg-[#E8B4A8]/5',
        room.unreadCount > 0 && 'bg-blue-50/30'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] flex items-center justify-center text-white font-semibold">
          {room.participants[0]?.avatar ? (
            <img
              src={room.participants[0].avatar}
              alt={getParticipantName()}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getParticipantName().charAt(0).toUpperCase()
          )}
        </div>
        {room.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E8B4A8] text-white text-xs flex items-center justify-center">
            {room.unreadCount > 9 ? '9+' : room.unreadCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={cn(
              'font-medium truncate',
              room.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
            )}
          >
            {getParticipantName()}
          </h4>
          {room.updatedAt && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatTime(room.updatedAt)}
            </span>
          )}
        </div>
        {room.lastMessage && (
          <p
            className={cn(
              'text-sm truncate',
              room.unreadCount > 0
                ? 'text-gray-700 font-medium'
                : 'text-gray-500'
            )}
          >
            {room.lastMessage.content || (
              <span className="italic text-gray-400">
                {room.lastMessage.type === 'image'
                  ? '[Image]'
                  : room.lastMessage.type === 'file'
                  ? '[File]'
                  : 'New message'}
              </span>
            )}
          </p>
        )}
      </div>
    </button>
  );
}

// =============================================================================
// Booking Chat Component (Standalone)
// =============================================================================

export function BookingChat({
  bookingId,
  customerId,
  customerName,
  customerAvatar,
  providerId,
  providerName,
  providerAvatar,
  currentUserId,
  currentUserRole,
  bookingStatus,
  serviceName,
  scheduledDate,
  className,
  onMessageSent,
}: BookingChatProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the other participant info
  const otherParticipant = useMemo(() => {
    if (currentUserRole === 'customer') {
      return { id: providerId, name: providerName, avatar: providerAvatar };
    }
    return { id: customerId, name: customerName, avatar: customerAvatar };
  }, [currentUserRole, customerId, customerName, customerAvatar, providerId, providerName, providerAvatar]);

  // Initialize chat room on mount
  useEffect(() => {
    const initChatRoom = async () => {
      try {
        const result = await chatApi.getOrCreateBookingChat({
          bookingId,
          customerId,
          providerId,
        });
        if (result.chatRoom) {
          const roomId = result.chatRoom._id || (result.chatRoom as unknown as { id: string }).id;
          setChatRoomId(roomId);
        }
      } catch (error) {
        console.error('Error initializing booking chat room:', error);
      }
    };

    initChatRoom();
  }, [bookingId, customerId, providerId]);

  // Handle message send
  const handleSend = useCallback(async () => {
    if (!message.trim()) return;

    // Ensure we have a valid chat room ID
    if (!chatRoomId) {
      // Try to get/create the chat room first
      try {
        const result = await chatApi.getOrCreateBookingChat({
          bookingId,
          customerId,
          providerId,
        });
        if (!result.chatRoom) return;
        const roomId = result.chatRoom._id || (result.chatRoom as unknown as { id: string }).id;
        setChatRoomId(roomId);

        await chatApi.sendMessage(roomId, {
          receiverId: otherParticipant.id,
          content: message.trim(),
          type: 'text',
        });
        setMessage('');
        onMessageSent?.();
      } catch (error) {
        console.error('Error sending message:', error);
      }
      return;
    }

    setIsSending(true);
    try {
      await chatApi.sendMessage(chatRoomId, {
        receiverId: otherParticipant.id,
        content: message.trim(),
        type: 'text',
      });
      setMessage('');
      onMessageSent?.();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  }, [message, bookingId, customerId, providerId, chatRoomId, otherParticipant.id, onMessageSent]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isTyping && chatRoomId) {
      setIsTyping(true);
      socketService.startTyping(chatRoomId);
    }

    // Clear existing timeout and set new one
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (chatRoomId) {
        socketService.stopTyping(chatRoomId);
      }
    }, 3000);
  }, [chatRoomId, isTyping]);

  // Cleanup typing timeout on chatRoomId change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      // Stop typing when switching rooms
      if (isTyping && chatRoomId) {
        socketService.stopTyping(chatRoomId);
      }
    };
  }, [chatRoomId, isTyping]);

  // Subscribe to typing events
  useEffect(() => {
    const unsubscribe = socketService.onTypingStart(({ bookingId: bId }) => {
      if (bId === bookingId) {
        // Show typing indicator for other user
      }
    });

    return () => {
      unsubscribe();
    };
  }, [bookingId]);

  return (
    <div className={cn('flex flex-col bg-white rounded-xl shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] flex items-center justify-center text-white font-semibold">
          {otherParticipant.avatar ? (
            <img
              src={otherParticipant.avatar}
              alt={otherParticipant.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            otherParticipant.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{otherParticipant.name}</h4>
          {serviceName && (
            <p className="text-xs text-gray-500 truncate">{serviceName}</p>
          )}
        </div>
        {bookingStatus && (
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              bookingStatus === 'confirmed'
                ? 'bg-green-100 text-green-800'
                : bookingStatus === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {bookingStatus}
          </span>
        )}
      </div>

      {/* Booking Info */}
      {scheduledDate && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500">
            Scheduled:{' '}
            <span className="font-medium text-gray-700">
              {new Date(scheduledDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className={cn(
              'flex-1 px-4 py-2 rounded-full bg-gray-100',
              'placeholder-gray-500 text-gray-800',
              'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/30'
            )}
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all',
              message.trim()
                ? 'bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default ChatIntegration;
