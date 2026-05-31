import mongoose, { Types } from 'mongoose';
import Message, { IMessage, MessageType, MessageStatus } from '../models/message.model';
import ChatRoom, { IChatRoom, ChatRoomType } from '../models/chatRoom.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { getSocketServer } from '../socket';
import { addTenantFilter, getTenantContext } from '../utils/tenantFilter';
import { validateMessageContent } from './chatModeration.service';

// =============================================================================
// Types
// =============================================================================

export interface SendMessageInput {
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type?: MessageType;
  bookingId?: string;
  replyTo?: string;
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    thumbnailUrl?: string;
  }>;
  metadata?: {
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    userAgent?: string;
  };
}

export interface GetMessagesOptions {
  limit?: number;
  before?: Date;
  after?: Date;
  includeDeleted?: boolean;
}

export interface ChatRoomWithParticipants extends IChatRoom {
  participantsWithDetails?: Array<{
    userId: {
      _id: mongoose.Types.ObjectId;
      firstName: string;
      lastName: string;
      avatar?: string;
      role: string;
    };
    role: string;
    joinedAt: Date;
    lastReadAt?: Date;
    isMuted?: boolean;
    isPinned?: boolean;
  }>;
  lastMessageDetails?: IMessage;
}

// =============================================================================
// Chat Service Class
// =============================================================================

export class ChatService {
  // =============================================================================
  // Message Operations
  // =============================================================================

  /**
   * Send a new message
   */
  async sendMessage(input: SendMessageInput): Promise<IMessage> {
    const { chatRoomId, senderId, receiverId, content, type = 'text', bookingId, replyTo, attachments, metadata } = input;

    // Validate input
    if (!chatRoomId || !senderId || !receiverId) {
      throw new ApiError(400, 'Chat room ID, sender ID, and receiver ID are required');
    }

    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new ApiError(400, 'Invalid chat room ID');
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      throw new ApiError(400, 'Invalid sender ID');
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      throw new ApiError(400, 'Invalid receiver ID');
    }

    // Verify chat room exists
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.isDeleted) {
      throw new ApiError(404, 'Chat room not found');
    }

    // Verify sender is a participant
    if (!chatRoom.isParticipant(senderId)) {
      throw new ApiError(403, 'Sender is not a participant in this chat room');
    }

    // Check if room is blocked
    if (chatRoom.status === 'blocked') {
      throw new ApiError(403, 'This chat room is blocked');
    }

    // Validate content for text messages
    if (type === 'text' && !content?.trim()) {
      throw new ApiError(400, 'Message content is required');
    }

    if (type === 'text' && content.length > 5000) {
      throw new ApiError(400, 'Message content cannot exceed 5000 characters');
    }

    // Content moderation
    if (type === 'text') {
      const moderationResult = await validateMessageContent(content);

      if (moderationResult.flagged) {
        logger.warn('Message flagged by moderation', {
          context: 'ChatService',
          action: 'MESSAGE_FLAGGED',
          chatRoomId,
          senderId,
          reason: moderationResult.reason,
        });

        // Depending on severity, either block or warn
        if (moderationResult.severity === 'high') {
          throw new ApiError(400, 'Message contains inappropriate content and cannot be sent');
        }
      }
    }

    // Validate attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (!attachment.url || !attachment.filename || !attachment.mimeType) {
          throw new ApiError(400, 'Invalid attachment data');
        }
        // Max file size: 10MB
        if (attachment.size > 10 * 1024 * 1024) {
          throw new ApiError(400, 'Attachment size cannot exceed 10MB');
        }
      }
    }

    // Create message
    const message = new Message({
      chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
      senderId: new mongoose.Types.ObjectId(senderId),
      receiverId: new mongoose.Types.ObjectId(receiverId),
      content: type === 'text' ? content.trim() : undefined,
      type,
      bookingId: bookingId ? new mongoose.Types.ObjectId(bookingId) : undefined,
      replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : undefined,
      attachments,
      status: 'sent',
      metadata
    });

    await message.save();

    // Update chat room
    const preview = type === 'text' ? content.substring(0, 100) :
      type === 'image' ? '[Image]' :
      type === 'file' ? `[File: ${attachments?.[0]?.filename || 'attachment'}]` :
      content;

    await ChatRoom.updateLastMessage(chatRoomId, message._id as mongoose.Types.ObjectId, preview);

    // Increment unread count for receiver
    await chatRoom.incrementUnreadCount(new mongoose.Types.ObjectId(receiverId));

    // Emit socket event for real-time delivery
    this.emitNewMessage(chatRoomId, message);

    logger.info('Message sent', {
      context: 'ChatService',
      action: 'SEND_MESSAGE',
      messageId: message._id.toString(),
      chatRoomId,
      senderId,
      receiverId,
      type,
    });

    // Populate sender details for response
    await message.populate('senderId', 'firstName lastName avatar role');

    return message;
  }

  /**
   * Get messages for a chat room
   */
  async getMessages(
    chatRoomId: string,
    userId: string,
    options: GetMessagesOptions = {}
  ): Promise<{
    messages: IMessage[];
    hasMore: boolean;
    nextCursor?: Date;
  }> {
    const { limit = 50, before, after, includeDeleted = false } = options;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new ApiError(400, 'Invalid chat room ID');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    // Verify chat room exists and user is a participant
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.isDeleted) {
      throw new ApiError(404, 'Chat room not found');
    }

    if (!chatRoom.isParticipant(userId)) {
      throw new ApiError(403, 'User is not a participant in this chat room');
    }

    // Build query
    const query: Record<string, unknown> = {
      chatRoomId: new mongoose.Types.ObjectId(chatRoomId)
    };

    if (!includeDeleted) {
      query.isDeleted = false;
    }

    // Cursor-based pagination
    if (before) {
      query.createdAt = { $lt: before };
    }

    if (after) {
      query.createdAt = { ...(query.createdAt as object || {}), $gt: after };
    }

    // Fetch one extra to determine if there are more
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('senderId', 'firstName lastName avatar role')
      .populate('replyTo', 'content type attachments senderId')
      .lean();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra item
    }

    // Get next cursor from oldest message
    const nextCursor = messages.length > 0
      ? messages[messages.length - 1].createdAt
      : undefined;

    // Reverse to show oldest first in response
    return {
      messages: messages.reverse() as unknown as IMessage[],
      hasMore,
      nextCursor
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    chatRoomId: string,
    userId: string,
    messageIds?: string[]
  ): Promise<number> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new ApiError(400, 'Invalid chat room ID');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    // Verify chat room exists and user is a participant
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.isDeleted) {
      throw new ApiError(404, 'Chat room not found');
    }

    if (!chatRoom.isParticipant(userId)) {
      throw new ApiError(403, 'User is not a participant in this chat room');
    }

    // Build query
    const query: Record<string, unknown> = {
      chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
      receiverId: new mongoose.Types.ObjectId(userId),
      status: { $ne: 'read' },
      isDeleted: false
    };

    if (messageIds && messageIds.length > 0) {
      query._id = {
        $in: messageIds.map(id => {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, `Invalid message ID: ${id}`);
          }
          return new mongoose.Types.ObjectId(id);
        })
      };
    }

    // Mark messages as read
    const result = await Message.updateMany(query, {
      $set: {
        status: 'read',
        readAt: new Date()
      }
    });

    // Reset unread count for this room
    await chatRoom.resetUnreadCount(new mongoose.Types.ObjectId(userId));

    // Emit socket event for real-time update
    this.emitMessagesRead(chatRoomId, userId, messageIds);

    logger.info('Messages marked as read', {
      context: 'ChatService',
      action: 'MARK_READ',
      chatRoomId,
      userId,
      count: result.modifiedCount,
    });

    return result.modifiedCount;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new ApiError(400, 'Invalid message ID');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      throw new ApiError(404, 'Message not found');
    }

    // Only sender can delete their own messages
    if (message.senderId.toString() !== userId) {
      throw new ApiError(403, 'Only the sender can delete this message');
    }

    await message.softDelete(new mongoose.Types.ObjectId(userId));

    // Emit socket event
    this.emitMessageDeleted(message.chatRoomId.toString(), messageId);

    logger.info('Message deleted', {
      context: 'ChatService',
      action: 'DELETE_MESSAGE',
      messageId,
      chatRoomId: message.chatRoomId.toString(),
      deletedBy: userId,
    });
  }

  // =============================================================================
  // Chat Room Operations
  // =============================================================================

  /**
   * Get chat rooms for a user
   */
  async getChatRooms(
    userId: string,
    options: {
      status?: 'active' | 'archived' | 'blocked';
      type?: ChatRoomType;
      limit?: number;
      skip?: number;
      bookingId?: string;
    } = {}
  ): Promise<{
    rooms: ChatRoomWithParticipants[];
    total: number;
  }> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const { status = 'active', type, limit = 20, skip = 0, bookingId } = options;

    // Build query
    const query: Record<string, unknown> = {
      'participants.userId': new mongoose.Types.ObjectId(userId),
      status,
      isDeleted: false
    };

    if (type) {
      query.type = type;
    }

    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      query.bookingId = new mongoose.Types.ObjectId(bookingId);
    }

    // Get total count
    const total = await ChatRoom.countDocuments(query);

    // Get rooms
    const rooms = await ChatRoom.find(query)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants.userId', 'firstName lastName avatar role')
      .populate('lastMessage')
      .populate('bookingId', 'bookingNumber status scheduledDate serviceId')
      .lean() as unknown as ChatRoomWithParticipants[];

    // Get last message details for each room
    const messageIds = rooms
      .filter(r => r.lastMessage)
      .map(r => r.lastMessage);

    if (messageIds.length > 0) {
      const messages = await Message.find({
        _id: { $in: messageIds.map((m: unknown) => (m as { _id: mongoose.Types.ObjectId })._id) }
      }).select('_id senderId content type attachments createdAt').lean();

      const messageMap = new Map(messages.map(m => [m._id.toString(), m]));

      for (const room of rooms) {
        if (room.lastMessage) {
          room.lastMessageDetails = messageMap.get((room.lastMessage as unknown as { _id: { toString: () => string } })._id.toString()) as unknown as IMessage;
        }
      }
    }

    return { rooms, total };
  }

  /**
   * Create a chat room
   */
  async createChatRoom(
    userId: string,
    type: ChatRoomType,
    participantIds: string[],
    options: {
      name?: string;
      bookingId?: string;
    } = {}
  ): Promise<IChatRoom> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    for (const participantId of participantIds) {
      if (!mongoose.Types.ObjectId.isValid(participantId)) {
        throw new ApiError(400, `Invalid participant ID: ${participantId}`);
      }
    }

    // Ensure creator is in participants
    const allParticipants = [...new Set([userId, ...participantIds])];

    // Build participant array
    const participants = allParticipants.map((id, index) => ({
      userId: new mongoose.Types.ObjectId(id),
      role: index === 0 ? 'owner' : 'member' as const,
      joinedAt: new Date()
    }));

    // Create room
    const chatRoom = new ChatRoom({
      type,
      name: options.name,
      participants,
      bookingId: options.bookingId ? new mongoose.Types.ObjectId(options.bookingId) : undefined,
      status: 'active'
    });

    await chatRoom.save();

    logger.info('Chat room created', {
      context: 'ChatService',
      action: 'CREATE_ROOM',
      chatRoomId: chatRoom._id.toString(),
      type,
      participants: allParticipants,
    });

    return chatRoom;
  }

  /**
   * Get or create a direct chat room
   */
  async getOrCreateDirectChat(
    userId1: string,
    userId2: string
  ): Promise<IChatRoom> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(userId1)) {
      throw new ApiError(400, 'Invalid user ID 1');
    }

    if (!mongoose.Types.ObjectId.isValid(userId2)) {
      throw new ApiError(400, 'Invalid user ID 2');
    }

    if (userId1 === userId2) {
      throw new ApiError(400, 'Cannot create a direct chat with yourself');
    }

    const chatRoom = await ChatRoom.findOrCreateDirectChat(
      new mongoose.Types.ObjectId(userId1),
      new mongoose.Types.ObjectId(userId2)
    );

    // Populate participants
    await chatRoom.populate('participants.userId', 'firstName lastName avatar role');

    return chatRoom;
  }

  /**
   * Get or create a booking chat room
   */
  async getOrCreateBookingChat(
    bookingId: string,
    customerId: string,
    providerId: string
  ): Promise<IChatRoom> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Invalid booking ID');
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new ApiError(400, 'Invalid customer ID');
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    const chatRoom = await ChatRoom.findOrCreateBookingChat(
      new mongoose.Types.ObjectId(bookingId),
      new mongoose.Types.ObjectId(customerId),
      new mongoose.Types.ObjectId(providerId)
    );

    // Populate participants
    await chatRoom.populate('participants.userId', 'firstName lastName avatar role');

    return chatRoom;
  }

  /**
   * Archive a chat room
   */
  async archiveChatRoom(chatRoomId: string, userId: string): Promise<void> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new ApiError(400, 'Invalid chat room ID');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.isDeleted) {
      throw new ApiError(404, 'Chat room not found');
    }

    if (!chatRoom.isParticipant(userId)) {
      throw new ApiError(403, 'User is not a participant in this chat room');
    }

    await chatRoom.archive();
  }

  /**
   * Delete (soft delete) a chat room
   */
  async deleteChatRoom(chatRoomId: string, userId: string): Promise<void> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new ApiError(400, 'Invalid chat room ID');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.isDeleted) {
      throw new ApiError(404, 'Chat room not found');
    }

    if (!chatRoom.isParticipant(userId)) {
      throw new ApiError(403, 'User is not a participant in this chat room');
    }

    chatRoom.isDeleted = true;
    chatRoom.deletedAt = new Date();
    await chatRoom.save();

    // Soft delete all messages in the room
    await Message.updateMany(
      { chatRoomId: new mongoose.Types.ObjectId(chatRoomId) },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    logger.info('Chat room deleted', {
      context: 'ChatService',
      action: 'DELETE_ROOM',
      chatRoomId,
      deletedBy: userId,
    });
  }

  // =============================================================================
  // Unread Count Operations
  // =============================================================================

  /**
   * Get unread count for a specific chat room
   */
  async getUnreadCount(chatRoomId: string, userId: string): Promise<number> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new ApiError(400, 'Invalid chat room ID');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.isDeleted) {
      throw new ApiError(404, 'Chat room not found');
    }

    if (!chatRoom.isParticipant(userId)) {
      throw new ApiError(403, 'User is not a participant in this chat room');
    }

    return chatRoom.unreadCounts.get(userId) || 0;
  }

  /**
   * Get total unread count for a user
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    return ChatRoom.getTotalUnreadCount(userId);
  }

  // =============================================================================
  // Socket Event Emitters
  // =============================================================================

  /**
   * Emit new message to chat room
   */
  private emitNewMessage(chatRoomId: string, message: IMessage): void {
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitToBooking(chatRoomId, 'message:new', {
        messageId: message._id.toString(),
        chatRoomId,
        senderId: (message.senderId as mongoose.Types.ObjectId).toString(),
        receiverId: (message.receiverId as mongoose.Types.ObjectId).toString(),
        content: message.content,
        type: message.type,
        attachments: message.attachments,
        status: message.status,
        createdAt: message.createdAt
      });
    }
  }

  /**
   * Emit messages read event
   */
  private emitMessagesRead(chatRoomId: string, userId: string, messageIds?: string[]): void {
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitToBooking(chatRoomId, 'message:read' as any, {
        chatRoomId,
        userId,
        messageIds: messageIds || [],
        readAt: new Date()
      });
    }
  }

  /**
   * Emit message deleted event
   */
  private emitMessageDeleted(chatRoomId: string, messageId: string): void {
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitToBooking(chatRoomId, 'message:deleted' as any, {
        chatRoomId,
        messageId
      });
    }
  }
}

// =============================================================================
// Export
// =============================================================================

export const chatService = new ChatService();
export default chatService;
