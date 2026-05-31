import { Server, Socket } from 'socket.io';
import Joi from 'joi';
import logger from '../utils/logger';
import { chatService } from '../services/chat.service';

// =============================================================================
// Types
// =============================================================================

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  joinedAt?: number;
}

export interface ChatServerToClientEvents {
  // Connection
  'connected': (data: { socketId: string }) => void;
  'error': (data: { message: string }) => void;
  'unauthorized': () => void;

  // Chat events
  'chat:room_joined': (data: { chatRoomId: string }) => void;
  'chat:room_left': (data: { chatRoomId: string }) => void;
  'chat:new_message': (data: {
    messageId: string;
    chatRoomId: string;
    senderId: string;
    receiverId: string;
    content: string;
    type: string;
    status: string;
    createdAt: Date;
  }) => void;

  // Message events (booking-focused for compatibility with frontend)
  'message:new': (data: ChatMessageEvent) => void;
  'message:delivered': (data: { messageId: string; chatRoomId: string; deliveredAt: Date }) => void;
  'message:read': (data: MessageReadEvent) => void;
  'message:deleted': (data: { chatRoomId: string; messageId: string }) => void;

  // Booking-focused message events (for frontend compatibility)
  'booking:message': (data: {
    bookingId: string;
    message: string;
    senderId: string;
    timestamp: Date;
  }) => void;

  // Typing indicators
  'typing:start': (data: TypingEvent) => void;
  'typing:stop': (data: TypingEvent) => void;

  // Presence
  'presence:online': (data: { userId: string }) => void;
  'presence:offline': (data: { userId: string }) => void;

  // Acknowledgment
  'ack': (data: { event: string; status: 'success' | 'error'; message?: string }) => void;
}

export interface ChatClientToServerEvents {
  // Room management
  'join:chat_room': (chatRoomId: string) => void;
  'leave:chat_room': (chatRoomId: string) => void;

  // Booking room management (for frontend compatibility)
  'join:booking_room': (bookingId: string) => void;
  'leave:booking_room': (bookingId: string) => void;

  // Messaging
  'send:message': (data: SendMessageData) => void;
  'mark:read': (data: MarkReadData) => void;

  // Typing
  'typing:start': (data: { chatRoomId: string; bookingId?: string }) => void;
  'typing:stop': (data: { chatRoomId: string; bookingId?: string }) => void;

  // Acknowledgment
  'ack': (data: { event: string; status: 'success' | 'error'; message?: string }) => void;
}

// Event data types
export interface ChatMessageEvent {
  messageId: string;
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
}

export interface MessageReadEvent {
  chatRoomId: string;
  userId: string;
  messageIds?: string[];
  readAt: Date;
}

export interface TypingEvent {
  chatRoomId: string;
  userId: string;
  userName?: string;
}

export interface SendMessageData {
  chatRoomId: string;
  receiverId: string;
  content?: string;
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

export interface MarkReadData {
  chatRoomId: string;
  messageIds?: string[];
}

// =============================================================================
// Validation Schemas
// =============================================================================

const joinRoomSchema = Joi.object({
  chatRoomId: Joi.string().required().hex().length(24).messages({
    'string.hex': 'Chat room ID must be a valid hex string',
    'string.length': 'Chat room ID must be 24 characters',
    'any.required': 'Chat room ID is required'
  })
});

const sendMessageSchema = Joi.object({
  chatRoomId: Joi.string().required().hex().length(24).messages({
    'string.hex': 'Chat room ID must be a valid hex string',
    'string.length': 'Chat room ID must be 24 characters',
    'any.required': 'Chat room ID is required'
  }),
  receiverId: Joi.string().required().hex().length(24).messages({
    'string.hex': 'Receiver ID must be a valid hex string',
    'string.length': 'Receiver ID must be 24 characters',
    'any.required': 'Receiver ID is required'
  }),
  content: Joi.string().max(5000).allow('').optional(),
  type: Joi.string().valid('text', 'image', 'file').default('text'),
  bookingId: Joi.string().hex().length(24).optional(),
  replyTo: Joi.string().hex().length(24).optional(),
  attachments: Joi.array().items(
    Joi.object({
      url: Joi.string().required(),
      filename: Joi.string().required(),
      mimeType: Joi.string().required(),
      size: Joi.number().positive().required(),
      thumbnailUrl: Joi.string().optional()
    })
  ).max(10).optional()
});

const markReadSchema = Joi.object({
  chatRoomId: Joi.string().required().hex().length(24).messages({
    'string.hex': 'Chat room ID must be a valid hex string',
    'string.length': 'Chat room ID must be 24 characters',
    'any.required': 'Chat room ID is required'
  }),
  messageIds: Joi.array().items(
    Joi.string().hex().length(24)
  ).optional()
});

const typingSchema = Joi.object({
  chatRoomId: Joi.string().required().hex().length(24).messages({
    'string.hex': 'Chat room ID must be a valid hex string',
    'string.length': 'Chat room ID must be 24 characters',
    'any.required': 'Chat room ID is required'
  })
});

// =============================================================================
// Typing Timeout Tracking
// =============================================================================

const typingTimers: Map<string, NodeJS.Timeout> = new Map();
const TYPING_TIMEOUT_MS = 3000; // Stop typing indicator after 3 seconds of inactivity

// =============================================================================
// Chat Handler Class
// =============================================================================

export class ChatSocketHandler {
  private io: Server<ChatClientToServerEvents, ChatServerToClientEvents>;
  private userSockets: Map<string, Set<string>> = new Map();
  private chatRoomSockets: Map<string, Set<string>> = new Map();
  private userStatus: Map<string, 'online' | 'offline'> = new Map();

  constructor(io: Server<ChatClientToServerEvents, ChatServerToClientEvents>) {
    this.io = io;
    this.setupHandlers();
  }

  // =============================================================================
  // Validation Helper
  // =============================================================================

  private validate<T>(schema: Joi.ObjectSchema, data: unknown): { valid: boolean; value?: T; error?: string } {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorMessage = error.details.map(d => d.message).join('; ');
      return { valid: false, error: errorMessage };
    }

    return { valid: true, value: value as T };
  }

  // =============================================================================
  // Setup Handlers
  // =============================================================================

  private setupHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      if (!socket.userId) {
        socket.emit('unauthorized');
        socket.disconnect();
        return;
      }

      logger.info('Chat client connected', {
        context: 'ChatSocketHandler',
        action: 'CONNECT',
        socketId: socket.id,
        userId: socket.userId,
      });

      // Track user socket
      this.addUserSocket(socket.userId, socket.id);

      // Emit connection confirmation
      socket.emit('connected', { socketId: socket.id });

      // Notify presence
      this.setUserOnline(socket.userId);

      // Join chat room
      socket.on('join:chat_room', (data) => this.handleJoinRoom(socket, data));

      // Leave chat room
      socket.on('leave:chat_room', (data) => this.handleLeaveRoom(socket, data));

      // Join booking room (alias for frontend compatibility)
      socket.on('join:booking_room', (bookingId) => this.handleJoinBookingRoom(socket, bookingId));

      // Leave booking room (alias for frontend compatibility)
      socket.on('leave:booking_room', (bookingId) => this.handleLeaveBookingRoom(socket, bookingId));

      // Send message
      socket.on('send:message', (data) => this.handleSendMessage(socket, data));

      // Mark as read
      socket.on('mark:read', (data) => this.handleMarkRead(socket, data));

      // Typing indicators
      socket.on('typing:start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing:stop', (data) => this.handleTypingStop(socket, data));

      // Acknowledgment
      socket.on('ack', (data) => this.handleAck(socket, data));

      // Handle disconnection
      socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
    });
  }

  // =============================================================================
  // Room Management Handlers
  // =============================================================================

  private async handleJoinRoom(socket: AuthenticatedSocket, rawData: string): Promise<void> {
    const validation = this.validate<string>(joinRoomSchema, rawData);
    if (!validation.valid) {
      socket.emit('error', { message: validation.error || 'Invalid data' });
      return;
    }

    const { chatRoomId } = validation.value as unknown as { chatRoomId: string };

    // Verify user is a participant
    try {
      const { rooms } = await chatService.getChatRooms(socket.userId!, { limit: 100 });
      const isParticipant = rooms.some(r => r._id.toString() === chatRoomId);

      if (!isParticipant) {
        socket.emit('error', { message: 'Not authorized to join this chat room' });
        return;
      }

      // Join the socket room
      socket.join(`chat:${chatRoomId}`);

      // Track socket in room
      if (!this.chatRoomSockets.has(chatRoomId)) {
        this.chatRoomSockets.set(chatRoomId, new Set());
      }
      this.chatRoomSockets.get(chatRoomId)?.add(socket.id);

      // Notify the user
      socket.emit('chat:room_joined', { chatRoomId });

      logger.info('User joined chat room', {
        context: 'ChatSocketHandler',
        action: 'JOIN_ROOM',
        socketId: socket.id,
        userId: socket.userId,
        chatRoomId,
      });
    } catch (error) {
      logger.error('Failed to join chat room', {
        context: 'ChatSocketHandler',
        action: 'JOIN_ROOM_ERROR',
        socketId: socket.id,
        userId: socket.userId,
        chatRoomId,
        error: (error as Error).message,
      });
      socket.emit('error', { message: 'Failed to join chat room' });
    }
  }

  private async handleLeaveRoom(socket: AuthenticatedSocket, rawData: string): Promise<void> {
    const validation = this.validate<string>(typingSchema, rawData);
    if (!validation.valid) {
      socket.emit('error', { message: validation.error || 'Invalid data' });
      return;
    }

    const { chatRoomId } = validation.value as unknown as { chatRoomId: string };

    // Leave the socket room
    socket.leave(`chat:${chatRoomId}`);

    // Remove from tracking
    this.chatRoomSockets.get(chatRoomId)?.delete(socket.id);

    // Stop typing if active
    this.clearTypingTimer(`${socket.userId}:${chatRoomId}`);

    // Notify
    socket.emit('chat:room_left', { chatRoomId });

    logger.info('User left chat room', {
      context: 'ChatSocketHandler',
      action: 'LEAVE_ROOM',
      socketId: socket.id,
      userId: socket.userId,
      chatRoomId,
    });
  }

  /**
   * Handle join booking room (frontend compatibility)
   */
  private async handleJoinBookingRoom(socket: AuthenticatedSocket, bookingId: string): Promise<void> {
    // For booking rooms, we need to find the chat room associated with this booking
    try {
      const { rooms } = await chatService.getChatRooms(socket.userId!, {
        bookingId,
        limit: 1
      });

      if (rooms.length > 0) {
        const chatRoomId = rooms[0]._id.toString();

        // Join the socket room
        socket.join(`chat:${chatRoomId}`);

        // Track socket in room
        if (!this.chatRoomSockets.has(chatRoomId)) {
          this.chatRoomSockets.set(chatRoomId, new Set());
        }
        this.chatRoomSockets.get(chatRoomId)?.add(socket.id);

        // Notify the user
        socket.emit('chat:room_joined', { chatRoomId });

        logger.info('User joined booking chat room', {
          context: 'ChatSocketHandler',
          action: 'JOIN_BOOKING_ROOM',
          socketId: socket.id,
          userId: socket.userId,
          bookingId,
          chatRoomId,
        });
      } else {
        socket.emit('error', { message: 'No chat room found for this booking' });
      }
    } catch (error) {
      logger.error('Failed to join booking chat room', {
        context: 'ChatSocketHandler',
        action: 'JOIN_BOOKING_ROOM_ERROR',
        socketId: socket.id,
        userId: socket.userId,
        bookingId,
        error: (error as Error).message,
      });
      socket.emit('error', { message: 'Failed to join booking chat room' });
    }
  }

  /**
   * Handle leave booking room (frontend compatibility)
   */
  private async handleLeaveBookingRoom(socket: AuthenticatedSocket, bookingId: string): Promise<void> {
    try {
      const { rooms } = await chatService.getChatRooms(socket.userId!, {
        bookingId,
        limit: 1
      });

      if (rooms.length > 0) {
        const chatRoomId = rooms[0]._id.toString();

        // Leave the socket room
        socket.leave(`chat:${chatRoomId}`);

        // Remove from tracking
        this.chatRoomSockets.get(chatRoomId)?.delete(socket.id);

        // Stop typing if active
        this.clearTypingTimer(`${socket.userId}:${chatRoomId}`);

        // Notify
        socket.emit('chat:room_left', { chatRoomId });

        logger.info('User left booking chat room', {
          context: 'ChatSocketHandler',
          action: 'LEAVE_BOOKING_ROOM',
          socketId: socket.id,
          userId: socket.userId,
          bookingId,
          chatRoomId,
        });
      }
    } catch (error) {
      logger.error('Failed to leave booking chat room', {
        context: 'ChatSocketHandler',
        action: 'LEAVE_BOOKING_ROOM_ERROR',
        socketId: socket.id,
        userId: socket.userId,
        bookingId,
        error: (error as Error).message,
      });
    }
  }

  // =============================================================================
  // Message Handlers
  // =============================================================================

  private async handleSendMessage(socket: AuthenticatedSocket, rawData: SendMessageData): Promise<void> {
    const validation = this.validate<SendMessageData>(sendMessageSchema, rawData);
    if (!validation.valid) {
      socket.emit('ack', {
        event: 'send:message',
        status: 'error',
        message: validation.error
      });
      return;
    }

    const data = validation.value!;

    try {
      // Send the message via chat service
      const message = await chatService.sendMessage({
        chatRoomId: data.chatRoomId,
        senderId: socket.userId!,
        receiverId: data.receiverId,
        content: data.content || '',
        type: data.type || 'text',
        bookingId: data.bookingId,
        replyTo: data.replyTo,
        attachments: data.attachments
      });

      // Emit the message to the chat room
      const messageEvent: ChatMessageEvent = {
        messageId: message._id.toString(),
        chatRoomId: data.chatRoomId,
        senderId: socket.userId!,
        receiverId: data.receiverId,
        content: message.content || '',
        type: message.type,
        attachments: message.attachments,
        status: message.status,
        createdAt: message.createdAt
      };

      // Emit message:new (standard event)
      this.io.to(`chat:${data.chatRoomId}`).emit('message:new', messageEvent);

      // Emit chat:new_message (frontend compatibility - matches what ChatWidget listens for)
      this.io.to(`chat:${data.chatRoomId}`).emit('chat:new_message', {
        messageId: message._id.toString(),
        chatRoomId: data.chatRoomId,
        senderId: socket.userId!,
        receiverId: data.receiverId,
        content: message.content || '',
        type: message.type,
        status: message.status,
        createdAt: message.createdAt
      });

      // Also emit booking:message for frontend compatibility
      if (data.bookingId) {
        this.io.to(`chat:${data.chatRoomId}`).emit('booking:message', {
          bookingId: data.bookingId,
          message: message.content || '',
          senderId: socket.userId!,
          timestamp: message.createdAt
        });
      }

      // Acknowledge to sender
      socket.emit('ack', {
        event: 'send:message',
        status: 'success',
        message: message._id.toString()
      });

      // Stop typing indicator
      this.handleTypingStop(socket, { chatRoomId: data.chatRoomId });

      logger.info('Message sent via socket', {
        context: 'ChatSocketHandler',
        action: 'SEND_MESSAGE',
        socketId: socket.id,
        userId: socket.userId,
        chatRoomId: data.chatRoomId,
        messageId: message._id.toString(),
      });
    } catch (error) {
      logger.error('Failed to send message via socket', {
        context: 'ChatSocketHandler',
        action: 'SEND_MESSAGE_ERROR',
        socketId: socket.id,
        userId: socket.userId,
        chatRoomId: data.chatRoomId,
        error: (error as Error).message,
      });
      socket.emit('ack', {
        event: 'send:message',
        status: 'error',
        message: (error as Error).message
      });
    }
  }

  private async handleMarkRead(socket: AuthenticatedSocket, rawData: MarkReadData): Promise<void> {
    const validation = this.validate<MarkReadData>(markReadSchema, rawData);
    if (!validation.valid) {
      socket.emit('error', { message: validation.error || 'Invalid data' });
      return;
    }

    const { chatRoomId, messageIds } = validation.value!;

    try {
      await chatService.markMessagesAsRead(chatRoomId, socket.userId!, messageIds);

      // Emit read event to the chat room
      const readEvent: MessageReadEvent = {
        chatRoomId,
        userId: socket.userId!,
        messageIds,
        readAt: new Date()
      };

      this.io.to(`chat:${chatRoomId}`).emit('message:read', readEvent);

      logger.debug('Messages marked as read via socket', {
        context: 'ChatSocketHandler',
        action: 'MARK_READ',
        socketId: socket.id,
        userId: socket.userId,
        chatRoomId,
        messageCount: messageIds?.length || 'all',
      });
    } catch (error) {
      logger.error('Failed to mark messages as read via socket', {
        context: 'ChatSocketHandler',
        action: 'MARK_READ_ERROR',
        socketId: socket.id,
        userId: socket.userId,
        chatRoomId,
        error: (error as Error).message,
      });
    }
  }

  // =============================================================================
  // Typing Indicators
  // =============================================================================

  private handleTypingStart(socket: AuthenticatedSocket, rawData: { chatRoomId: string }): void {
    const validation = this.validate<{ chatRoomId: string }>(typingSchema, rawData);
    if (!validation.valid) {
      return;
    }

    const { chatRoomId } = validation.value!;
    const timerKey = `${socket.userId}:${chatRoomId}`;

    // Set or reset the typing timer
    this.clearTypingTimer(timerKey);
    const timer = setTimeout(() => {
      this.handleTypingStop(socket, { chatRoomId });
    }, TYPING_TIMEOUT_MS);
    typingTimers.set(timerKey, timer);

    // Emit to other users in the room
    const typingEvent: TypingEvent = {
      chatRoomId,
      userId: socket.userId!,
      userName: undefined // Could fetch from user service
    };

    socket.to(`chat:${chatRoomId}`).emit('typing:start', typingEvent);

    logger.debug('User started typing', {
      context: 'ChatSocketHandler',
      action: 'TYPING_START',
      socketId: socket.id,
      userId: socket.userId,
      chatRoomId,
    });
  }

  private handleTypingStop(socket: AuthenticatedSocket, rawData: { chatRoomId: string }): void {
    const validation = this.validate<{ chatRoomId: string }>(typingSchema, rawData);
    if (!validation.valid) {
      return;
    }

    const { chatRoomId } = validation.value!;
    const timerKey = `${socket.userId}:${chatRoomId}`;

    // Clear the typing timer
    this.clearTypingTimer(timerKey);

    // Emit to other users in the room
    const typingEvent: TypingEvent = {
      chatRoomId,
      userId: socket.userId!
    };

    socket.to(`chat:${chatRoomId}`).emit('typing:stop', typingEvent);

    logger.debug('User stopped typing', {
      context: 'ChatSocketHandler',
      action: 'TYPING_STOP',
      socketId: socket.id,
      userId: socket.userId,
      chatRoomId,
    });
  }

  private clearTypingTimer(key: string): void {
    const existingTimer = typingTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      typingTimers.delete(key);
    }
  }

  // =============================================================================
  // Acknowledgment Handler
  // =============================================================================

  private handleAck(socket: AuthenticatedSocket, data: { event: string; status: 'success' | 'error'; message?: string }): void {
    logger.debug('Received acknowledgment from client', {
      context: 'ChatSocketHandler',
      action: 'ACK',
      socketId: socket.id,
      userId: socket.userId,
      event: data.event,
      status: data.status,
    });
  }

  // =============================================================================
  // Disconnect Handler
  // =============================================================================

  private handleDisconnect(socket: AuthenticatedSocket, reason: string): void {
    if (!socket.userId) return;

    logger.info('Chat client disconnected', {
      context: 'ChatSocketHandler',
      action: 'DISCONNECT',
      socketId: socket.id,
      userId: socket.userId,
      reason,
    });

    // Remove from user sockets
    this.removeUserSocket(socket.userId, socket.id);

    // Remove from all chat rooms
    for (const [chatRoomId, sockets] of this.chatRoomSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);

        // Clear typing timers
        this.clearTypingTimer(`${socket.userId}:${chatRoomId}`);

        // Emit typing stop to the room
        const typingEvent: TypingEvent = {
          chatRoomId,
          userId: socket.userId
        };
        this.io.to(`chat:${chatRoomId}`).emit('typing:stop', typingEvent);
      }

      // Clean up empty rooms
      if (sockets.size === 0) {
        this.chatRoomSockets.delete(chatRoomId);
      }
    }

    // Update presence
    this.setUserOffline(socket.userId);
  }

  // =============================================================================
  // User Socket Tracking
  // =============================================================================

  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
  }

  private removeUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  // =============================================================================
  // Presence Tracking
  // =============================================================================

  private setUserOnline(userId: string): void {
    const wasOffline = this.userStatus.get(userId) === 'offline';
    this.userStatus.set(userId, 'online');

    if (wasOffline) {
      this.io.emit('presence:online', { userId });
    }
  }

  private setUserOffline(userId: string): void {
    // Only set offline if user has no more sockets
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      const wasOnline = this.userStatus.get(userId) === 'online';
      this.userStatus.set(userId, 'offline');

      if (wasOnline) {
        this.io.emit('presence:offline', { userId });
      }
    }
  }

  // =============================================================================
  // Public Methods
  // =============================================================================

  /**
   * Emit a message to a specific chat room
   */
  emitToRoom<T extends keyof ChatServerToClientEvents>(
    chatRoomId: string,
    event: T,
    data: Parameters<ChatServerToClientEvents[T]>[0]
  ): void {
    this.io.to(`chat:${chatRoomId}`).emit(event as any, data);
  }

  /**
   * Emit a message to a specific user
   */
  emitToUser<T extends keyof ChatServerToClientEvents>(
    userId: string,
    event: T,
    data: Parameters<ChatServerToClientEvents[T]>[0]
  ): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.io.to(socketId).emit(event as any, data);
      }
    }
  }

  /**
   * Get online status of a user
   */
  isUserOnline(userId: string): boolean {
    return this.userStatus.get(userId) === 'online';
  }

  /**
   * Get number of users in a chat room
   */
  getRoomSize(chatRoomId: string): number {
    return this.chatRoomSockets.get(chatRoomId)?.size || 0;
  }

  /**
   * Get total connected sockets
   */
  getTotalConnections(): number {
    let total = 0;
    for (const sockets of this.userSockets.values()) {
      total += sockets.size;
    }
    return total;
  }
}

// =============================================================================
// Export
// =============================================================================

export default ChatSocketHandler;
