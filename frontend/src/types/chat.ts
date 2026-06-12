// Chat Types for NILIN Homeservice

// =============================================================================
// Chat Participant
// =============================================================================

// Issue #22: Updated role enum to match backend chatRoom.model.ts participant role enum
export interface ChatParticipant {
  _id: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  avatar?: string;
  // Role in chat room - matches backend: 'owner' | 'admin' | 'member'
  role: 'owner' | 'admin' | 'member';
  isOnline?: boolean;
  lastSeen?: string;
  userId?: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: string;
  };
}

// =============================================================================
// Chat Message
// =============================================================================

export interface ChatMessage {
  _id: string;
  id?: string;
  // Issue #20: Standardize on chatRoomId (backend uses chatRoomId)
  roomId?: string;
  chatRoomId?: string;
  // Issue #18: Added bookingId field to match backend message.model.ts
  bookingId?: string;
  senderId: string | { _id: string; firstName: string; lastName: string; avatar?: string };
  receiverId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'booking_update';
  attachments?: ChatAttachment[];
  metadata?: ChatMessageMetadata;
  status: 'sent' | 'delivered' | 'read';
  isRead?: boolean;
  // Issue #19: Accept both string (API response) and Date for backend compatibility
  readAt?: string | Date;
  createdAt: string;
  updatedAt?: string;
  replyTo?: ChatReplyTo;
}

export interface ChatAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
}

export interface ChatMessageMetadata {
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  bookingId?: string;
  bookingStatus?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  userAgent?: string;
  ipAddress?: string;
}

export interface ChatReplyTo {
  _id: string;
  content: string;
  type: string;
  senderId?: { firstName?: string; lastName?: string };
}

// =============================================================================
// Chat Room
// =============================================================================

// Issue #9 & #10 fix: Added missing fields from backend chatRoom.model.ts
// - settings: Room settings (allowMessages, notificationsEnabled)
// - unreadCounts: Map of userId to unread count (for multi-user rooms)
// - isDeleted: Soft delete flag
// - deletedAt: Soft delete timestamp
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
    _id?: string;
    id?: string;
    bookingNumber?: string;
    serviceName?: string;
    scheduledDate?: string;
    status?: string;
  };
  lastMessage?: ChatMessage;
  lastMessageAt?: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  status: 'active' | 'archived' | 'blocked';
  // Issue #9 fix: Added settings and unreadCounts from backend
  settings?: {
    allowMessages: boolean;
    notificationsEnabled: boolean;
  };
  unreadCounts?: Record<string, number>;
  // Issue #10 fix: Added soft delete fields from backend
  isDeleted?: boolean;
  deletedAt?: string;
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
  isPinned: boolean;
  isMuted: boolean;
  status: 'active' | 'archived' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API Options
// =============================================================================

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
  attachments?: ChatAttachment[];
}

export interface CreateChatRoomPayload {
  type: 'direct' | 'booking' | 'support';
  participantIds: string[];
  name?: string;
  bookingId?: string;
}

// =============================================================================
// API Responses
// =============================================================================

// Issue #21: Updated to match actual backend response (chat.routes.ts returns only rooms and total)
export interface ChatRoomsResponse {
  rooms: ChatRoomListItem[];
  total: number;
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

// =============================================================================
// Socket Events
// =============================================================================

/**
 * Issue #11 fix: Document socket event consistency
 *
 * Socket event naming conventions:
 * - Backend emits: 'message:new' (standard event) and 'chat:new_message' (frontend compatibility)
 * - Frontend ChatSocketMessageEvent uses 'messageId' field
 * - Backend chat.service.ts emits 'messageId' - CONSISTENT
 *
 * Note: The backend intentionally emits both event names for backward compatibility.
 * Different frontend components listen for different events:
 * - ChatWidget listens for 'chat:new_message'
 * - Standard components should use 'message:new'
 */
export interface ChatSocketMessageEvent {
  messageId: string;
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: ChatAttachment[];
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
}

export interface ChatSocketReadEvent {
  chatRoomId: string;
  userId: string;
  messageIds?: string[];
  readAt: Date;
}

export interface ChatSocketTypingEvent {
  chatRoomId: string;
  userId: string;
  userName?: string;
}

// =============================================================================
// Moderation
// =============================================================================

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high';
  detectedPatterns?: string[];
}

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  score: number;
}

// =============================================================================
// Analytics
// =============================================================================

export interface MessageMetrics {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  mediaMessages: number;
  fileMessages: number;
  averageMessageLength: number;
}

export interface ResponseTimeMetrics {
  averageResponseTimeMs: number;
  medianResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  responseRate: number;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  averageConversationDurationHours: number;
  messagesPerConversation: number;
}

export interface UserChatMetrics {
  userId: string;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  averageResponseTimeMs: number;
  responseRate: number;
  conversationsStarted: number;
  lastActiveAt: Date;
}
