import { api } from './api';

// ============================================
// Chat Types
// ============================================

export interface ChatParticipant {
  _id: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  avatar?: string;
  role: 'customer' | 'provider' | 'admin';
  isOnline?: boolean;
  lastSeen?: string;
  isMuted?: boolean;
  isPinned?: boolean;
  userId?: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: string;
  };
}

export interface ChatMessage {
  _id: string;
  id?: string;
  roomId?: string;
  chatRoomId?: string;
  bookingId?: string;
  senderId: string | { _id: string; firstName: string; lastName: string; avatar?: string };
  receiverId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'booking_update';
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    thumbnailUrl?: string;
  }>;
  metadata?: {
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
    bookingId?: string;
    bookingStatus?: string;
  };
  status: 'sent' | 'delivered' | 'read';
  isRead?: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt?: string;
  replyTo?: {
    _id: string;
    content: string;
    type: string;
    senderId?: { firstName?: string; lastName?: string };
  };
}

export interface ChatRoom {
  _id: string;
  id?: string;
  type: 'direct' | 'booking' | 'support';
  name?: string;
  participants: ChatParticipant[];
  bookingId?: {
    _id: string;
    bookingNumber?: string;
    status: string;
    scheduledDate?: string;
    serviceId?: string;
  } | string;
  bookingDetails?: {
    serviceName: string;
    scheduledDate?: string;
    status: string;
  };
  lastMessage?: ChatMessage;
  lastMessageAt?: string;
  unreadCount: number;
  unreadCounts?: Record<string, number>; // Per-user unread counts Map<string, number>
  isPinned: boolean;
  isMuted: boolean;
  status: 'active' | 'archived' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoomListItem {
  _id: string;
  id?: string;
  type: 'direct' | 'booking' | 'support';
  name?: string;
  participants: ChatParticipant[];
  bookingId?: string;
  lastMessage?: {
    content: string;
    senderName: string;
    createdAt: string;
    senderId?: string;
    type?: string;
  };
  unreadCount: number;
  unreadCounts?: Record<string, number>; // Per-user unread counts Map<string, number>
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetMessagesOptions {
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
  includeDeleted?: boolean;
}

export interface GetChatRoomsOptions {
  page?: number;
  limit?: number;
  search?: string;
  bookingId?: string;
  hasUnread?: boolean;
  type?: 'direct' | 'booking' | 'support';
  status?: 'active' | 'archived' | 'blocked';
}

export interface SendMessagePayload {
  receiverId: string;
  content: string;
  type?: 'text' | 'image' | 'file';
  bookingId?: string;
  replyTo?: string;
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    thumbnailUrl?: string;
  }>;
}

export interface CreateChatRoomPayload {
  type: 'direct' | 'booking' | 'support';
  participantIds: string[];
  name?: string;
  bookingId?: string;
}

export interface DirectChatPayload {
  participantId: string;
  initialMessage?: string;
}

export interface BookingChatPayload {
  bookingId: string;
  customerId: string;
  providerId: string;
}

// ============================================
// API Response Types
// ============================================

export interface ChatRoomsResponse {
  rooms: ChatRoomListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MessagesResponse {
  messages: ChatMessage[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface UnreadCountResponse {
  total: number;
  byRoom?: Array<{ roomId: string; count: number }>;
}

// ============================================
// Chat API Service
// ============================================

export interface ChatApi {
  /**
   * Get all chat rooms for the current user
   */
  getChatRooms: (options?: GetChatRoomsOptions, signal?: AbortSignal) => Promise<ChatRoomsResponse>;

  /**
   * Get a single chat room by ID
   */
  getChatRoom: (roomId: string, signal?: AbortSignal) => Promise<{ chatRoom: ChatRoom }>;

  /**
   * Get messages for a specific chat room
   */
  getMessages: (
    roomId: string,
    options?: GetMessagesOptions,
    signal?: AbortSignal
  ) => Promise<MessagesResponse>;

  /**
   * Send a message to a chat room
   */
  sendMessage: (
    roomId: string,
    payload: SendMessagePayload
  ) => Promise<{ message: ChatMessage }>;

  /**
   * Mark messages as read
   */
  markAsRead: (messageIds: string[]) => Promise<{
    success: boolean;
    markedCount: number;
  }>;

  /**
   * Mark all messages in a room as read
   */
  markRoomAsRead: (roomId: string, messageIds?: string[]) => Promise<{
    markedCount: number;
  }>;

  /**
   * Create a new chat room
   */
  createChatRoom: (payload: CreateChatRoomPayload) => Promise<{ chatRoom: ChatRoom }>;

  /**
   * Get or create a direct chat room
   */
  getOrCreateDirectChat: (payload: DirectChatPayload) => Promise<{ chatRoom: ChatRoom }>;

  /**
   * Get or create a booking chat room
   */
  getOrCreateBookingChat: (payload: BookingChatPayload) => Promise<{ chatRoom: ChatRoom }>;

  /**
   * Delete a chat room
   */
  deleteChatRoom: (roomId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Archive a chat room
   */
  archiveChatRoom: (roomId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Get unread count for a chat room
   */
  getRoomUnreadCount: (roomId: string) => Promise<{
    unreadCount: number;
  }>;

  /**
   * Get total unread message count
   */
  getUnreadCount: () => Promise<UnreadCountResponse>;

  /**
   * Delete a message
   */
  deleteMessage: (messageId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Search messages within a room
   */
  searchMessages: (
    roomId: string,
    query: string,
    options?: { page?: number; limit?: number }
  ) => Promise<MessagesResponse>;
}

export const chatApi: ChatApi = {
  /**
   * Get all chat rooms for the current user
   */
  getChatRooms: async (options = {}, signal) => {
    const response = await api.get('/chat/rooms', { params: options, signal });
    return response.data.data;
  },

  /**
   * Get a single chat room by ID with full details
   */
  getChatRoom: async (roomId: string, signal) => {
    const response = await api.get(`/chat/rooms/${roomId}`, { signal });
    return response.data.data;
  },

  /**
   * Get messages for a specific chat room with pagination
   */
  getMessages: async (roomId: string, options = {}, signal) => {
    const params: Record<string, string | number | boolean> = {};

    if (options.limit) params.limit = options.limit;
    if (options.page) params.page = options.page;
    if (options.before) params.before = options.before;
    if (options.after) params.after = options.after;
    if (options.includeDeleted) params.includeDeleted = options.includeDeleted;

    const response = await api.get(`/chat/rooms/${roomId}/messages`, { params, signal });
    return response.data.data;
  },

  /**
   * Send a message to a chat room
   */
  sendMessage: async (roomId: string, payload: SendMessagePayload) => {
    const response = await api.post(`/chat/rooms/${roomId}/messages`, payload);
    return response.data.data;
  },

  /**
   * Mark specific messages as read
   */
  markAsRead: async (messageIds: string[]) => {
    const response = await api.patch(`/chat/messages/read`, { messageIds });
    return response.data.data;
  },

  /**
   * Mark all messages in a room as read
   */
  markRoomAsRead: async (roomId: string, messageIds?: string[]) => {
    const response = await api.patch(`/chat/rooms/${roomId}/read`, { messageIds });
    return response.data.data;
  },

  /**
   * Create a new chat room
   */
  createChatRoom: async (payload: CreateChatRoomPayload) => {
    const response = await api.post('/chat/rooms', payload);
    return response.data.data;
  },

  /**
   * Get or create a direct chat room
   */
  getOrCreateDirectChat: async (payload: DirectChatPayload) => {
    const response = await api.post('/chat/rooms/direct', payload);
    return response.data.data;
  },

  /**
   * Get or create a booking chat room
   */
  getOrCreateBookingChat: async (payload: BookingChatPayload) => {
    const response = await api.post('/chat/rooms/booking', payload);
    return response.data.data;
  },

  /**
   * Delete a chat room (soft delete)
   */
  deleteChatRoom: async (roomId: string) => {
    const response = await api.delete(`/chat/rooms/${roomId}`);
    return response.data;
  },

  /**
   * Archive a chat room
   */
  archiveChatRoom: async (roomId: string) => {
    const response = await api.patch(`/chat/rooms/${roomId}/archive`);
    return response.data;
  },

  /**
   * Get unread count for a specific chat room
   */
  getRoomUnreadCount: async (roomId: string) => {
    const response = await api.get(`/chat/rooms/${roomId}/unread`);
    return response.data.data;
  },

  /**
   * Get total unread message count across all rooms
   */
  getUnreadCount: async () => {
    const response = await api.get('/chat/unread');
    const data = response.data.data as { unreadCount?: number; total?: number; byRoom?: UnreadCountResponse['byRoom'] };
    return {
      total: data.unreadCount ?? data.total ?? 0,
      byRoom: data.byRoom,
    };
  },

  /**
   * Delete a message
   */
  deleteMessage: async (messageId: string) => {
    const response = await api.delete(`/chat/messages/${messageId}`);
    return response.data;
  },

  /**
   * Search messages within a specific room
   */
  searchMessages: async (
    roomId: string,
    query: string,
    options = {}
  ) => {
    try {
      const response = await api.get(`/chat/rooms/${roomId}/search`, {
        params: { query, ...options },
      });
      return response.data.data;
    } catch {
      return {
        messages: [],
        hasMore: false
      };
    }
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get unread count for a specific user from a chat room
 * Backend stores unreadCounts as Map<string, number>, frontend receives as Record<string, number>
 */
export function getUnreadCountForUser(
  room: ChatRoom | ChatRoomListItem,
  userId: string
): number {
  return room.unreadCounts?.[userId] ?? room.unreadCount ?? 0;
}

/**
 * Normalize chat room data (handles _id vs id inconsistencies)
 */
export function normalizeChatRoom(room: ChatRoom | ChatRoomListItem): ChatRoomListItem {
  return {
    _id: room._id || (room as unknown as { id: string }).id,
    type: room.type,
    name: room.name,
    participants: room.participants,
    bookingId: typeof room.bookingId === 'string' ? room.bookingId : room.bookingId?._id,
    lastMessage: room.lastMessage ? {
      content: room.lastMessage.content,
      senderName: room.lastMessage.senderName || 'User',
      createdAt: room.lastMessage.createdAt,
      senderId: typeof room.lastMessage.senderId === 'string'
        ? room.lastMessage.senderId
        : (room.lastMessage.senderId as unknown as { _id: string })?._id,
      type: room.lastMessage.type
    } : undefined,
    unreadCount: room.unreadCount,
    unreadCounts: room.unreadCounts,
    isPinned: room.isPinned,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

/**
 * Normalize message data
 */
export function normalizeMessage(message: ChatMessage): ChatMessage {
  const senderId = typeof message.senderId === 'string'
    ? message.senderId
    : (message.senderId as unknown as { _id: string })?._id;

  const sender = typeof message.senderId === 'object'
    ? message.senderId as unknown as { firstName: string; lastName: string; avatar?: string }
    : null;

  return {
    _id: message._id || (message as unknown as { id: string }).id,
    roomId: message.roomId || message.chatRoomId,
    chatRoomId: message.chatRoomId || message.roomId,
    // Include bookingId if present
    bookingId: 'bookingId' in message ? message.bookingId : undefined,
    senderId: senderId,
    receiverId: message.receiverId,
    senderName: message.senderName || (sender ? `${sender.firstName} ${sender.lastName}` : undefined),
    senderAvatar: message.senderAvatar || sender?.avatar,
    content: message.content,
    type: message.type,
    attachments: message.attachments,
    status: message.status,
    isRead: message.isRead || message.status === 'read',
    readAt: message.readAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    replyTo: message.replyTo
  };
}

export default chatApi;
