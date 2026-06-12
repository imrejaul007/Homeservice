import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { ChatHistory } from './ChatHistory';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { Badge } from '../common/Badge';
import { chatApi, ChatMessage as ChatMessageType, ChatRoom as ChatRoomType, ChatRoomListItem, getUnreadCountForUser, normalizeChatRoom, normalizeMessage } from '../../services/chatApi';
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
  onSelectRoom: (room: ChatRoomType | ChatRoomWithDetails | null) => void;
  /** On back to rooms list callback */
  onBackToRooms: () => void;
  /** On new message callback */
  onNewMessage?: (message: ChatMessageType) => void;
  /** On unread count change */
  onUnreadChange?: (count: number) => void;
  /** Widget (floating) vs full-page embedded layout */
  layout?: 'widget' | 'page';
  /** Booking page embed — conversation only, no room list */
  embedded?: boolean;
  /** Custom className */
  className?: string;
}

// Use ChatRoomListItem as base but add missing ChatRoom required fields
interface ChatRoomWithDetails extends ChatRoomListItem {
  // Add missing required fields from ChatRoom
  isMuted: boolean;
  status: 'active' | 'archived' | 'blocked';
  createdAt: string;
  updatedAt: string;
  bookingDetails?: {
    _id?: string;
    id?: string;
    bookingNumber?: string;
    status?: string;
    scheduledDate?: string;
    serviceName?: string;
  };
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
  // Explicitly include properties from ChatRoom that may be needed
  unreadCounts?: Record<string, number>;
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
  layout = 'widget',
  embedded = false,
  className,
}: ChatWindowProps) {
  const isPageLayout = layout === 'page';
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const appliedInitialRoomIdRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  const getRoomId = useCallback((room: ChatRoomWithDetails | ChatRoomType | null | undefined): string | null => {
    if (!room) return null;
    return room._id || (room as unknown as { id: string }).id || null;
  }, []);

  // =============================================================================
  // Fetch Chat Rooms
  // =============================================================================

  const fetchChatRooms = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatApi.getChatRooms({ limit: 50 }, signal);
      const normalizedRooms = response.rooms.map(normalizeChatRoom).map(r => r as unknown as ChatRoomWithDetails);
      setChatRooms(normalizedRooms);

      // Calculate total unread count
      const totalUnread = response.rooms.reduce(
        (sum, room) => sum + getUnreadCountForUser(room, userId),
        0
      );
      onUnreadChange?.(totalUnread);
    } catch (err) {
      // Ignore abort errors - they are expected when component unmounts
      if (signal?.aborted) return;
      setError('Failed to load conversations');
      console.error('Error fetching chat rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadChange, userId]);

  // =============================================================================
  // Mark Messages as Read
  // =============================================================================

  const markMessagesAsRead = useCallback(async (roomId: string) => {
    try {
      await chatApi.markRoomAsRead(roomId);

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
  // Fetch Messages
  // =============================================================================

  const fetchMessages = useCallback(async (roomId: string, cursor?: Date, signal?: AbortSignal) => {
    setIsLoadingMessages(true);

    try {
      const options: Record<string, string | number> = { limit: 50 };
      if (cursor) {
        options.before = cursor.toISOString();
      }

      const response = await chatApi.getMessages(roomId, options, signal);
      const normalizedMessages = response.messages.map(normalizeMessage);

      if (cursor) {
        setMessages(prev => [...normalizedMessages.reverse(), ...prev]);
      } else {
        setMessages(normalizedMessages.reverse());
      }

      setHasMoreMessages(response.hasMore);

      await markMessagesAsRead(roomId);
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [markMessagesAsRead]);

  // =============================================================================
  // Send Message
  // =============================================================================

  const sendMessage = useCallback(async (content: string, files?: File[]) => {
    if (!selectedRoom) return;

    const receiver = selectedRoom.participants.find(p => {
      const participantId = (p.userId?._id || p._id || (p as unknown as { id: string }).id)?.toString();
      return participantId && participantId !== userId.toString();
    });

    if (!receiver) return;

    try {
      const roomId = selectedRoom._id || (selectedRoom as unknown as { id: string }).id;
      const receiverId = (
        receiver.userId?._id || receiver._id || receiver.id || ''
      ).toString();

      let uploadedAttachments;
      let messageType: 'text' | 'image' | 'file' = 'text';

      if (files && files.length > 0) {
        const uploadResult = await chatApi.uploadChatAttachments(files);
        uploadedAttachments = uploadResult.attachments;
        const allImages = files.every((file) => file.type.startsWith('image/'));
        messageType = allImages ? 'image' : 'file';
      }

      const bookingId =
        typeof selectedRoom.bookingId === 'string'
          ? selectedRoom.bookingId
          : (selectedRoom as ChatRoomListItem).bookingDetails?._id;

      const response = await chatApi.sendMessage(roomId, {
        receiverId,
        content: content || undefined,
        type: messageType,
        bookingId,
        attachments: uploadedAttachments,
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
  // Typing Indicator
  // =============================================================================

  const startTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (selectedRoom) {
      const roomId = selectedRoom._id || (selectedRoom as unknown as { id: string }).id;
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
      socketService.stopChatTyping(roomId);
    }
  }, [selectedRoom]);

  // =============================================================================
  // Select Room
  // =============================================================================

  const handleSelectRoom = useCallback((room: ChatRoomWithDetails | ChatRoomListItem) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const roomId = getRoomId(room);
    if (!roomId || activeRoomIdRef.current === roomId) {
      return;
    }

    activeRoomIdRef.current = roomId;
    appliedInitialRoomIdRef.current = roomId;
    setSelectedRoomState(room as unknown as ChatRoomWithDetails);
    setMessages([]);
    onSelectRoom(room as unknown as unknown as ChatRoomWithDetails);
  }, [getRoomId, onSelectRoom]);

  const handleBackToRoomsInternal = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    activeRoomIdRef.current = null;
    appliedInitialRoomIdRef.current = null;
    setSelectedRoomState(null);
    setMessages([]);
    setTypingUsers([]);
    onBackToRooms();
  }, [onBackToRooms]);

  // Sync room opened by parent (deep-link from booking "Message" button)
  useEffect(() => {
    if (!initialSelectedRoom) {
      if (appliedInitialRoomIdRef.current) {
        activeRoomIdRef.current = null;
        appliedInitialRoomIdRef.current = null;
        setSelectedRoomState(null);
        setMessages([]);
      }
      return;
    }

    const normalized = normalizeChatRoom(initialSelectedRoom) as ChatRoomWithDetails;
    const roomId = getRoomId(normalized);
    if (!roomId || appliedInitialRoomIdRef.current === roomId) {
      return;
    }

    appliedInitialRoomIdRef.current = roomId;
    activeRoomIdRef.current = roomId;
    setSelectedRoomState(normalized);
    setMessages([]);
  }, [initialSelectedRoom, getRoomId]);

  // =============================================================================
  // Effects
  // =============================================================================

  // Ensure socket is connected for real-time messages
  useEffect(() => {
    socketService.connect();
  }, []);

  // Load chat rooms on mount (skip room list fetch in embedded booking chat)
  useEffect(() => {
    if (embedded) return;
    const controller = new AbortController();
    fetchChatRooms(controller.signal);
    return () => controller.abort();
  }, [fetchChatRooms, embedded]);

  const selectedRoomId = getRoomId(selectedRoom);

  // Load messages when active room changes
  useEffect(() => {
    if (!selectedRoomId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    fetchMessages(selectedRoomId, undefined, signal);

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedRoomId, fetchMessages]);

  // Socket subscriptions (stable — uses refs for current room/user)
  useEffect(() => {
    const userIdRef = { current: userId };

    const handleIncomingMessage = (data: {
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
      const selectedRoomId = activeRoomIdRef.current;
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
    };

    const unsubNewMessage = socketService.on('message:new', handleIncomingMessage);
    const unsubChatNewMessage = socketService.on('chat:new_message', handleIncomingMessage);

    const unsubTypingStart = socketService.on('typing:start', (data) => {
      const selectedRoomId = activeRoomIdRef.current;
      if (data.chatRoomId === selectedRoomId && data.userId !== userIdRef.current) {
        setTypingUsers(prev => {
          if (prev.some(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, userName: data.userName || 'User' }];
        });
      }
    });

    const unsubTypingStop = socketService.on('typing:stop', (data) => {
      const selectedRoomId = activeRoomIdRef.current;
      if (data.chatRoomId === selectedRoomId) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    });

    const unsubMessageDelivered = socketService.onChatMessageDelivered((data) => {
      const selectedRoomId = activeRoomIdRef.current;
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

    return () => {
      unsubNewMessage();
      unsubChatNewMessage();
      unsubTypingStart();
      unsubTypingStop();
      unsubMessageDelivered();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [userId, onNewMessage]);

  // Join/leave socket room when selection changes
  useEffect(() => {
    if (!selectedRoomId) return;

    socketService.joinChatRoom(selectedRoomId);
    return () => {
      socketService.leaveChatRoom(selectedRoomId);
    };
  }, [selectedRoomId]);

  // Scroll to bottom when messages change (separate to avoid re-running socket setup)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // =============================================================================
  // Render
  // =============================================================================

  const getOtherParticipant = (room: ChatRoomWithDetails | ChatRoomListItem) => {
    return room.participants.find(p => {
      const participantId = (p.userId?._id || p._id || (p as unknown as { id: string }).id)?.toString();
      return participantId && participantId !== userId.toString();
    });
  };

  const getParticipantName = (room: ChatRoomWithDetails | ChatRoomListItem): string => {
    if (room.name && room.name !== 'Chat') {
      return room.name;
    }

    const other = getOtherParticipant(room);
    if (other) {
      const firstName = other.userId?.firstName || other.firstName || '';
      const lastName = other.userId?.lastName || other.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) return fullName;
      if (other.name) return other.name;
    }

    return 'Conversation';
  };

  const getRoomSubtitle = (room: ChatRoomWithDetails | ChatRoomListItem): string | undefined => {
    if (room.type !== 'booking') return undefined;

    const details = (room as ChatRoomListItem).bookingDetails;
    const parts: string[] = [];

    if (details?.serviceName) {
      parts.push(details.serviceName);
    }
    if (details?.bookingNumber) {
      parts.push(`#${details.bookingNumber}`);
    } else if (details?.status) {
      parts.push(details.status.replace(/_/g, ' '));
    }

    return parts.length > 0 ? parts.join(' · ') : 'Booking conversation';
  };

  const getParticipantAvatar = (room: ChatRoomWithDetails | ChatRoomListItem): string | undefined => {
    const otherParticipant = getOtherParticipant(room);
    return otherParticipant?.userId?.avatar || otherParticipant?.avatar;
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-white overflow-hidden transition-all duration-300 ease-out',
        isPageLayout
          ? 'w-full h-full min-h-0 rounded-none shadow-none'
          : 'rounded-2xl shadow-2xl w-[calc(100vw-32px)] h-[calc(100vh-100px)] max-w-md max-h-[600px] md:w-[420px] md:h-[560px]',
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
            {!embedded && (
            <button
              onClick={handleBackToRoomsInternal}
              className="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Back to conversations"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            )}

            {/* Room info */}
            <div className={cn('flex items-center gap-3 flex-1', !embedded && 'ml-2')}>
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
                {getRoomSubtitle(selectedRoom) && (
                  <span className="text-xs text-white/80 truncate block">
                    {getRoomSubtitle(selectedRoom)}
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

        {/* Actions — widget only */}
        {!isPageLayout && (
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
        )}
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
              onClick={() => fetchChatRooms()}
              className="px-4 py-2 bg-[#E8B4A8] text-white rounded-lg hover:bg-[#D4948A] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : embedded && !selectedRoom ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E8B4A8]" />
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
        ) : embedded ? null : (
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
                  const unread = getUnreadCountForUser(room, userId);
                  const lastMsgSenderId = typeof room.lastMessage?.senderId === 'string'
                    ? room.lastMessage.senderId
                    : (room.lastMessage?.senderId as unknown as { _id: string })?._id;
                  return (
                  <button
                    key={roomId}
                    onClick={() => handleSelectRoom(room)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left',
                      unread > 0 && 'bg-blue-50/50'
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
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E8B4A8] text-white text-xs flex items-center justify-center">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn(
                          'font-medium truncate flex-1 min-w-0',
                          unread > 0 ? 'text-gray-900' : 'text-gray-700'
                        )}>
                          {getParticipantName(room)}
                        </h4>
                        {room.updatedAt && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatRelativeTime(room.updatedAt)}
                          </span>
                        )}
                      </div>
                      {getRoomSubtitle(room) && (
                        <p className="text-xs text-gray-400 truncate">{getRoomSubtitle(room)}</p>
                      )}
                      {room.lastMessage && (
                        <p className={cn(
                          'text-sm truncate',
                          unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'
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
