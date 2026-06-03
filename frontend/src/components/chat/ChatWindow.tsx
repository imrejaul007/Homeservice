import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { ChatHistory } from './ChatHistory';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { Badge } from '../common/Badge';
import { chatApi, ChatMessage as ChatMessageType, ChatRoom as ChatRoomType, normalizeChatRoom, normalizeMessage } from '../../services/chatApi';
import { socketService } from '../../services/socket';

// =============================================================================
// Types
// =============================================================================

export interface ChatWindowProps {
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** User avatar URL */
  userAvatar?: string;
  /** Initially selected chat room */
  initialSelectedRoom?: ChatRoomType | null;
  /** Whether the window is minimized */
  isMinimized?: boolean;
  /** On close callback */
  onClose: () => void;
  /** On minimize callback */
  onMinimize: () => void;
  /** On expand callback */
  onExpand: () => void;
  /** On select room callback */
  onSelectRoom: (room: ChatRoomType | null) => void;
  /** On back to rooms list callback */
  onBackToRooms: () => void;
  /** On new message callback */
  onNewMessage?: (message: ChatMessageType) => void;
  /** On unread count change */
  onUnreadChange?: (count: number) => void;
  /** Custom className */
  className?: string;
}

interface ChatRoomWithDetails extends ChatRoomType {
  participantsWithDetails?: Array<{
    userId: {
      _id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
      role: string;
    };
    role: string;
    joinedAt: string;
    lastReadAt?: string;
    isMuted?: boolean;
    isPinned?: boolean;
  }>;
  lastMessageDetails?: ChatMessageType;
}

// =============================================================================
// Component
// =============================================================================

export function ChatWindow({
  userId,
  userName,
  userAvatar,
  initialSelectedRoom,
  isMinimized,
  onClose,
  onMinimize,
  onExpand,
  onSelectRoom,
  onBackToRooms,
  onNewMessage,
  onUnreadChange,
  className,
}: ChatWindowProps) {
  // State
  const [chatRooms, setChatRooms] = useState<ChatRoomWithDetails[]>([]);
  const [selectedRoom, setSelectedRoomState] = useState<ChatRoomWithDetails | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // =============================================================================
  // Fetch Chat Rooms
  // =============================================================================

  const fetchChatRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatApi.getChatRooms({ limit: 50 });
      const normalizedRooms = response.rooms.map(normalizeChatRoom) as ChatRoomWithDetails[];
      setChatRooms(normalizedRooms);

      // Calculate total unread count
      const totalUnread = response.rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0);
      onUnreadChange?.(totalUnread);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error fetching chat rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadChange]);

  // =============================================================================
  // Fetch Messages
  // =============================================================================

  const fetchMessages = useCallback(async (roomId: string, cursor?: Date) => {
    setIsLoadingMessages(true);

    try {
      const options: Record<string, string | number> = { limit: 50 };
      if (cursor) {
        options.before = cursor.toISOString();
      }

      const response = await chatApi.getMessages(roomId, options);
      const normalizedMessages = response.messages.map(normalizeMessage);

      if (cursor) {
        setMessages(prev => [...normalizedMessages.reverse(), ...prev]);
      } else {
        setMessages(normalizedMessages.reverse());
      }

      setHasMoreMessages(response.hasMore);

      // Mark messages as read
      await markMessagesAsRead(roomId);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // =============================================================================
  // Send Message
  // =============================================================================

  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!selectedRoom) return;

    // Get receiver ID
    const receiver = selectedRoom.participants.find(
      p => p.userId?._id !== userId
    );

    if (!receiver) return;

    try {
      const roomId = selectedRoom._id || (selectedRoom as unknown as { id: string }).id;

      const response = await chatApi.sendMessage(roomId, {
        receiverId: receiver.userId?._id || receiver.id || '',
        content,
        type: attachments?.length ? 'file' : 'text',
      });

      if (response.message) {
        const normalizedMessage = normalizeMessage(response.message);
        setMessages(prev => [...prev, normalizedMessage]);
        onNewMessage?.(normalizedMessage);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message. Please try again.');
    }
  }, [selectedRoom, userId, onNewMessage]);

  // =============================================================================
  // Mark Messages as Read
  // =============================================================================

  const markMessagesAsRead = useCallback(async (roomId: string) => {
    try {
      await chatApi.markRoomAsRead(roomId);

      // Update local unread count
      setChatRooms(prev =>
        prev.map(room =>
          (room._id || (room as unknown as { id: string }).id) === roomId ? { ...room, unreadCount: 0 } : room
        )
      );
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, []);

  // =============================================================================
  // Typing Indicator
  // =============================================================================

  const startTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (selectedRoom) {
      const roomId = selectedRoom._id || (selectedRoom as unknown as { id: string }).id;
      // Emit typing start via socket service (both booking and chat room)
      socketService.startTyping(roomId);
      socketService.startChatTyping(roomId);
    }

    // Auto stop after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [selectedRoom]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (selectedRoom) {
      const roomId = selectedRoom._id || (selectedRoom as unknown as { id: string }).id;
      // Emit typing stop via socket service (both booking and chat room)
      socketService.stopTyping(roomId);
      socketService.stopChatTyping(roomId);
    }
  }, [selectedRoom]);

  // =============================================================================
  // Select Room
  // =============================================================================

  const handleSelectRoom = useCallback((room: ChatRoomWithDetails) => {
    // Clear typing timeout when changing rooms
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setSelectedRoomState(room);
    onSelectRoom(room);
    const roomId = room._id || (room as unknown as { id: string }).id;
    fetchMessages(roomId);
  }, [fetchMessages, onSelectRoom]);

  // =============================================================================
  // Effects
  // =============================================================================

  // Combined effect for initial load and socket setup
  // Uses refs to avoid dependency changes that cause cascading renders
  useEffect(() => {
    const currentSelectedRoomId = selectedRoom?._id;
    const currentUserId = userId;

    // Use refs to capture current values for socket callbacks
    // This avoids re-subscribing on every selectedRoom change
    const selectedRoomIdRef = { current: currentSelectedRoomId };
    const userIdRef = { current: currentUserId };

    // Initial load of chat rooms
    fetchChatRooms();

    // Load messages when room changes
    if (currentSelectedRoomId) {
      fetchMessages(currentSelectedRoomId);
    }

    // Subscribe to socket events once (not on every dependency change)
    const unsubNewMessage = socketService.on('message:new', (data: {
      messageId?: string;
      chatRoomId?: string;
      senderId?: string;
      receiverId?: string;
      content?: string;
      type?: string;
      attachments?: Array<{ url: string; filename: string; mimeType: string; size: number; thumbnailUrl?: string }>;
      status?: string;
      createdAt?: string | Date;
    }) => {
      // Use ref values to check if message belongs to current room
      const selectedRoomId = selectedRoomIdRef.current;
      if (data.chatRoomId === selectedRoomId && data.senderId !== userIdRef.current) {
        // Convert socket message to ChatMessage format
        const chatMessage: ChatMessageType = {
          _id: data.messageId,
          chatRoomId: data.chatRoomId,
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          type: data.type as 'text' | 'image' | 'file' | 'system' | 'booking_update',
          attachments: data.attachments,
          status: data.status as 'sent' | 'delivered' | 'read',
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toString(),
        };
        setMessages(prev => [...prev, chatMessage]);
        onNewMessage?.(chatMessage);
      }
    });

    const unsubTypingStart = socketService.onChatTypingStart((data) => {
      const selectedRoomId = selectedRoomIdRef.current;
      if (data.chatRoomId === selectedRoomId && data.userId !== userIdRef.current) {
        setTypingUsers(prev => {
          if (prev.some(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, userName: data.userName || 'User' }];
        });
      }
    });

    const unsubTypingStop = socketService.onChatTypingStop((data) => {
      const selectedRoomId = selectedRoomIdRef.current;
      if (data.chatRoomId === selectedRoomId) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    });

    const unsubMessageDelivered = socketService.onChatMessageDelivered((data) => {
      const selectedRoomId = selectedRoomIdRef.current;
      if (data.chatRoomId === selectedRoomId) {
        setMessages(prev =>
          prev.map(msg =>
            (msg._id || msg.id) === data.messageId
              ? { ...msg, status: 'delivered' as const }
              : msg
          )
        );
      }
    });

    // Join/leave chat room when selected
    if (currentSelectedRoomId) {
      socketService.joinChatRoom(currentSelectedRoomId);
    }

    // Cleanup function
    return () => {
      unsubNewMessage();
      unsubTypingStart();
      unsubTypingStop();
      unsubMessageDelivered();
      if (currentSelectedRoomId) {
        socketService.leaveChatRoom(currentSelectedRoomId);
      }
      // Clear typing timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - run once on mount, cleanup on unmount

  // Scroll to bottom when messages change (separate to avoid re-running socket setup)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // =============================================================================
  // Render
  // =============================================================================

  const getParticipantName = (room: ChatRoomWithDetails): string => {
    if (room.type === 'booking' && room.bookingId) {
      const bookingId = typeof room.bookingId === 'object' ? room.bookingId : null;
      return `Booking ${bookingId?.bookingNumber || room.bookingId}`;
    }

    const otherParticipant = room.participants.find(p => {
      const participantId = p.userId?._id || p._id || (p as unknown as { id: string }).id;
      return participantId !== userId;
    });

    if (otherParticipant) {
      const firstName = otherParticipant.userId?.firstName || otherParticipant.firstName || '';
      const lastName = otherParticipant.userId?.lastName || otherParticipant.lastName || '';
      return `${firstName} ${lastName}`.trim() || otherParticipant.name || 'Chat';
    }

    return room.name || 'Chat';
  };

  const getParticipantAvatar = (room: ChatRoomWithDetails): string | undefined => {
    const otherParticipant = room.participants.find(p => {
      const participantId = p.userId?._id || p._id || (p as unknown as { id: string }).id;
      return participantId !== userId;
    });
    return otherParticipant?.userId?.avatar || otherParticipant?.avatar;
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out',
        // Size
        'w-[calc(100vw-32px)] h-[calc(100vh-100px)] max-w-md max-h-[600px]',
        'md:w-[420px] md:h-[560px]',
        // Minimized state
        isMinimized && 'h-0 opacity-0 pointer-events-none',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#E8B4A8] to-[#D4948A] text-white">
        {selectedRoom ? (
          <>
            {/* Back button */}
            <button
              onClick={onBackToRooms}
              className="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Back to conversations"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Room info */}
            <div className="flex items-center gap-3 flex-1 ml-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                {getParticipantAvatar(selectedRoom) ? (
                  <img
                    src={getParticipantAvatar(selectedRoom)}
                    alt={getParticipantName(selectedRoom)}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getParticipantName(selectedRoom).charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{getParticipantName(selectedRoom)}</h3>
                {selectedRoom.bookingId && (
                  <span className="text-xs text-white/80">
                    {typeof selectedRoom.bookingId === 'object' ? selectedRoom.bookingId.status : 'Booking'}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold">Messages</h2>
            <Badge variant="default" className="bg-white/20 text-white">
              {chatRooms.length}
            </Badge>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Minimize chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {error ? (
          // Error State
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchChatRooms}
              className="px-4 py-2 bg-[#E8B4A8] text-white rounded-lg hover:bg-[#D4948A] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : selectedRoom ? (
          // Messages View
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                // Loading
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E8B4A8]" />
                </div>
              ) : messages.length === 0 ? (
                // Empty
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400">Start the conversation!</p>
                </div>
              ) : (
                <>
                  {hasMoreMessages && (
                    <button
                      onClick={() => messages[0] && fetchMessages(selectedRoom._id || (selectedRoom as unknown as { id: string }).id, new Date(messages[0].createdAt))}
                      className="w-full py-2 text-sm text-[#E8B4A8] hover:text-[#D4948A] transition-colors"
                    >
                      Load older messages
                    </button>
                  )}
                  <ChatHistory
                    messages={messages}
                    currentUserId={userId}
                    typingUsers={typingUsers}
                  />
                  <div ref={messagesEndRef} />
                </>
              )}

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <TypingIndicator users={typingUsers} />
              )}
            </div>

            {/* Message Input */}
            <MessageInput
              onSend={sendMessage}
              onTyping={startTyping}
              disabled={false}
            />
          </>
        ) : (
          // Rooms List
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E8B4A8]" />
              </div>
            ) : chatRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-500">No conversations yet</p>
                <p className="text-sm text-gray-400">Start a chat from a booking or provider page</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {chatRooms.map((room) => {
                  const roomId = room._id || (room as unknown as { id: string }).id;
                  const lastMsgSenderId = typeof room.lastMessage?.senderId === 'string'
                    ? room.lastMessage.senderId
                    : (room.lastMessage?.senderId as unknown as { _id: string })?._id;
                  return (
                  <button
                    key={roomId}
                    onClick={() => handleSelectRoom(room)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left',
                      room.unreadCount && room.unreadCount > 0 && 'bg-blue-50/50'
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] flex items-center justify-center text-white font-semibold">
                        {getParticipantAvatar(room) ? (
                          <img
                            src={getParticipantAvatar(room)}
                            alt={getParticipantName(room)}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getParticipantName(room).charAt(0).toUpperCase()
                        )}
                      </div>
                      {room.unreadCount && room.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E8B4A8] text-white text-xs flex items-center justify-center">
                          {room.unreadCount > 9 ? '9+' : room.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn(
                          'font-medium truncate',
                          room.unreadCount && room.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                        )}>
                          {getParticipantName(room)}
                        </h4>
                        {room.updatedAt && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatRelativeTime(room.updatedAt)}
                          </span>
                        )}
                      </div>
                      {room.lastMessage && (
                        <p className={cn(
                          'text-sm truncate',
                          room.unreadCount && room.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'
                        )}>
                          {lastMsgSenderId === userId ? 'You: ' : ''}
                          {room.lastMessage.type === 'image' ? '[Image]' :
                           room.lastMessage.type === 'file' ? '[File]' :
                           room.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatRelativeTime(dateString: string): string {
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
}

// =============================================================================
// Export
// =============================================================================

export default ChatWindow;
