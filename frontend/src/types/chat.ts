// Chat Types for NILIN Homeservice

// =============================================================================
// Chat Participant
// =============================================================================

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
  roomId?: string;
  chatRoomId?: string;
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
  readAt?: string;
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
  isPinned: boolean;
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

// =============================================================================
// Socket Events
// =============================================================================

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
