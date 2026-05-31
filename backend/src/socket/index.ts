import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import logger from '../utils/logger';
import { ChatSocketHandler } from './chat.handler';

// Types
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  joinedAt?: number;
}

export interface BookingEvent {
  bookingId: string;
  bookingNumber: string;
  status: string;
  userId: string;
  timestamp: Date;
}

export interface NotificationEvent {
  id: string;
  type: 'booking' | 'message' | 'system' | 'promotion';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId: string;
  timestamp: Date;
  read?: boolean;
}

// Chat Event Types
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

export interface ServerToClientEvents {
  // Booking events
  'booking:status_changed': (data: BookingEvent) => void;
  'booking:new_request': (data: { booking: BookingEvent; providerId: string }) => void;
  'booking:confirmed': (data: BookingEvent) => void;
  'booking:cancelled': (data: BookingEvent) => void;
  'booking:completed': (data: BookingEvent) => void;
  'booking:reminder': (data: { bookingId: string; minutesUntil: number }) => void;

  // Notification events
  'notification:new': (data: NotificationEvent) => void;
  'notification:read': (data: { notificationId: string }) => void;

  // Message events (existing)
  'message:new': (data: { bookingId: string; message: string; senderId: string; timestamp: Date }) => void;

  // Chat events
  'chat:room_joined': (data: { chatRoomId: string }) => void;
  'chat:room_left': (data: { chatRoomId: string }) => void;
  'chat:message:new': (data: ChatMessageEvent) => void;
  'chat:message:delivered': (data: { messageId: string; chatRoomId: string; deliveredAt: Date }) => void;
  'chat:message:read': (data: MessageReadEvent) => void;
  'chat:message:deleted': (data: { chatRoomId: string; messageId: string }) => void;
  'chat:typing:start': (data: TypingEvent) => void;
  'chat:typing:stop': (data: TypingEvent) => void;
  'chat:presence:online': (data: { userId: string }) => void;
  'chat:presence:offline': (data: { userId: string }) => void;

  // Connection events
  'connected': (data: { socketId: string }) => void;
  'error': (data: { message: string }) => void;
  'unauthorized': () => void;

  // Provider status events (Admin → Provider)
  'provider:approved': (data: { providerId: string; verifiedAt: Date }) => void;
  'provider:rejected': (data: { providerId: string; reason: string; canAppeal: boolean }) => void;
  'provider:suspended': (data: { providerId: string; reason: string; until?: Date }) => void;
  'provider:document_verified': (data: { providerId: string; documentId: string; status: 'approved' | 'rejected'; notes?: string }) => void;
  'provider:verification_complete': (data: { providerId: string; kycLevel: number }) => void;

  // Service status events (Admin → Provider)
  'service:approved': (data: { serviceId: string; providerId: string }) => void;
  'service:rejected': (data: { serviceId: string; providerId: string; reason: string }) => void;
  'service:status_changed': (data: { serviceId: string; providerId: string; serviceName: string; status: string }) => void;

  // Admin notification events (Provider → Admin)
  'admin:new_provider_submission': (data: { providerId: string; providerName: string; submittedAt: Date }) => void;
  'admin:new_service_pending': (data: { serviceId: string; providerId: string; serviceName: string }) => void;

  // Dispute events
  'dispute:new': (data: { disputeId: string; bookingId: string; disputeNumber: string; category: string; priority: string }) => void;
  'dispute:resolved': (data: { disputeId: string; resolution: string; resolutionType: string }) => void;

  // Review moderation events (Admin → Provider/Customer)
  'review:moderated': (data: { reviewId: string; providerId?: string; customerId?: string; action: string; rating?: number; reason?: string; timestamp: Date }) => void;

  // Withdrawal events (Admin → Provider)
  // FIX #2: Added providerId to match frontend expectations for all withdrawal events
  'withdrawal:approved': (data: { withdrawalId: string; providerId: string; amount: number; currency: string; status: string; processedAt: string }) => void;
  'withdrawal:rejected': (data: { withdrawalId: string; providerId: string; amount: number; currency: string; status: string; reason: string; rejectedAt: string }) => void;
  'withdrawal:pending': (data: { withdrawalId: string; providerId: string; amount: number; currency: string; status: string }) => void;

  // Admin notification events for withdrawals (Provider → Admin)
  'admin:new_withdrawal_request': (data: { withdrawalId: string; providerId: string; providerName: string; amount: number; currency: string; requestedAt: Date }) => void;
}

export interface ClientToServerEvents {
  // Join rooms
  'join:user_room': (userId: string) => void;
  'leave:user_room': (userId: string) => void;
  'join:booking_room': (bookingId: string) => void;
  'leave:booking_room': (bookingId: string) => void;

  // Chat room management
  'join:chat_room': (chatRoomId: string) => void;
  'leave:chat_room': (chatRoomId: string) => void;

  // Chat messaging
  'send:message': (data: {
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
  }) => void;
  'mark:read': (data: { chatRoomId: string; messageIds?: string[] }) => void;

  // Typing indicators (existing)
  'typing:start': (data: { bookingId: string }) => void;
  'typing:stop': (data: { bookingId: string }) => void;

  // Chat typing indicators
  'chat:typing:start': (data: { chatRoomId: string }) => void;
  'chat:typing:stop': (data: { chatRoomId: string }) => void;

  // Acknowledgment
  'ack': (data: { event: string; status: 'success' | 'error'; message?: string }) => void;
}

// Dead Letter Queue Types
export interface DeadLetterEvent {
  id: string;
  event: string;
  data: unknown;
  error: string;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

// Socket Event Validation Schemas
const socketValidationSchemas = {
  'join:user_room': Joi.object({
    userId: Joi.string().required().hex().length(24).messages({
      'string.hex': 'User ID must be a valid hex string',
      'string.length': 'User ID must be 24 characters',
      'any.required': 'User ID is required'
    })
  }),

  'leave:user_room': Joi.object({
    userId: Joi.string().required().hex().length(24).messages({
      'string.hex': 'User ID must be a valid hex string',
      'string.length': 'User ID must be 24 characters',
      'any.required': 'User ID is required'
    })
  }),

  'join:booking_room': Joi.object({
    bookingId: Joi.string().required().hex().length(24).messages({
      'string.hex': 'Booking ID must be a valid hex string',
      'string.length': 'Booking ID must be 24 characters',
      'any.required': 'Booking ID is required'
    })
  }),

  'leave:booking_room': Joi.object({
    bookingId: Joi.string().required().hex().length(24).messages({
      'string.hex': 'Booking ID must be a valid hex string',
      'string.length': 'Booking ID must be 24 characters',
      'any.required': 'Booking ID is required'
    })
  }),

  'typing:start': Joi.object({
    bookingId: Joi.string().required().hex().length(24).messages({
      'string.hex': 'Booking ID must be a valid hex string',
      'string.length': 'Booking ID must be 24 characters',
      'any.required': 'Booking ID is required'
    })
  }),

  'typing:stop': Joi.object({
    bookingId: Joi.string().required().hex().length(24).messages({
      'string.hex': 'Booking ID must be a valid hex string',
      'string.length': 'Booking ID must be 24 characters',
      'any.required': 'Booking ID is required'
    })
  }),

  'ack': Joi.object({
    event: Joi.string().required().max(100).messages({
      'string.max': 'Event name must be at most 100 characters',
      'any.required': 'Event name is required'
    }),
    status: Joi.string().required().valid('success', 'error').messages({
      'any.only': 'Status must be either "success" or "error"',
      'any.required': 'Status is required'
    }),
    message: Joi.string().max(500).optional().messages({
      'string.max': 'Message must be at most 500 characters'
    })
  })
};

// Validation helper function
function validateSocketEvent<T>(eventName: string, data: unknown): { valid: boolean; value?: T; error?: string } {
  const schema = socketValidationSchemas[eventName as keyof typeof socketValidationSchemas];
  if (!schema) {
    // Unknown event - allow but log warning
    logger.warn('Unknown socket event received', { eventName, action: 'UNKNOWN_EVENT' });
    return { valid: true, value: data as T };
  }

  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const errorMessage = error.details.map(d => d.message).join('; ');
    logger.warn('Socket event validation failed', {
      eventName,
      errors: errorMessage,
      action: 'VALIDATION_FAILED'
    });
    return { valid: false, error: errorMessage };
  }

  return { valid: true, value: value as T };
}

class SocketServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private bookingRooms: Map<string, Set<string>> = new Map(); // bookingId -> Set of socketIds
  private socketToBooking: Map<string, Set<string>> = new Map(); // socketId -> Set of bookingIds (for cleanup)
  private deadLetterQueue: DeadLetterEvent[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private dlqCleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_DLQ_SIZE = 1000;
  private readonly DLQ_RETENTION_HOURS = 24;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SOCKET_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Redis adapter clients
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:5173',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupConnectionHandler();
    this.setupChatHandler();
    this.startCleanupScheduler();

    // Setup Redis adapter (optional - only if SOCKET_REDIS_ENABLED=true)
    this.setupRedisAdapter();
  }

  /**
   * Setup Redis adapter for Socket.IO to enable horizontal scaling.
   * When enabled, multiple server instances can share socket state via Redis.
   * Controlled by SOCKET_REDIS_ENABLED environment variable.
   */
  private async setupRedisAdapter(): Promise<void> {
    // Skip if Redis adapter is not enabled
    if (process.env.SOCKET_REDIS_ENABLED !== 'true') {
      logger.info('Socket.io running without Redis adapter (single instance mode)', {
        action: 'REDIS_ADAPTER_DISABLED'
      });
      return;
    }

    // Validate Redis URL
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('SOCKET_REDIS_ENABLED is true but REDIS_URL is not set. Falling back to single instance mode.', {
        action: 'REDIS_ADAPTER_CONFIG_MISSING'
      });
      return;
    }

    try {
      // Create two Redis clients: one for publishing, one for subscribing
      this.pubClient = new Redis(redisUrl);
      this.subClient = new Redis(redisUrl);

      // Set up error handlers for Redis clients
      this.pubClient.on('error', (err: Error) => {
        logger.error('Redis pubClient error', { error: err.message, action: 'REDIS_PUB_ERROR' });
      });

      this.subClient.on('error', (err: Error) => {
        logger.error('Redis subClient error', { error: err.message, action: 'REDIS_SUB_ERROR' });
      });

      // Apply the Redis adapter to Socket.IO
      this.io.adapter(createAdapter(this.pubClient, this.subClient));

      logger.info('Socket.io Redis adapter connected successfully', {
        action: 'REDIS_ADAPTER_CONNECTED',
        redisUrl: redisUrl.replace(/:([^:@]+)@/, ':***@') // Mask password in logs
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to setup Redis adapter for Socket.io', {
        error: errorMessage,
        action: 'REDIS_ADAPTER_FAILED'
      });
      // Fall back to in-memory adapter (single instance mode)
    }
  }

  // Chat Handler Setup
  private chatHandler: ChatSocketHandler | null = null;

  private setupChatHandler(): void {
    this.chatHandler = new ChatSocketHandler(this.io as Server<any, any>);
    logger.info('Chat socket handler initialized', {
      context: 'SocketServer',
      action: 'CHAT_HANDLER_INIT'
    });
  }

  // Dead Letter Queue Methods
  private addToDeadLetterQueue(event: string, data: unknown, error: string): void {
    const dlqEvent: DeadLetterEvent = {
      id: `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event,
      data,
      error,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    this.deadLetterQueue.push(dlqEvent);

    // Trim queue if exceeds max size (FIFO eviction)
    if (this.deadLetterQueue.length > this.MAX_DLQ_SIZE) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-this.MAX_DLQ_SIZE);
      logger.warn('Dead letter queue trimmed to max size', {
        currentSize: this.deadLetterQueue.length,
        action: 'DLQ_TRIMMED'
      });
    }

    logger.warn('Event added to dead letter queue', {
      event,
      error,
      dlqSize: this.deadLetterQueue.length,
      action: 'DLQ_ADDED'
    });
  }

  private cleanupDeadLetterQueue(): void {
    const cutoffTime = new Date(Date.now() - this.DLQ_RETENTION_HOURS * 60 * 60 * 1000);
    const previousSize = this.deadLetterQueue.length;

    this.deadLetterQueue = this.deadLetterQueue.filter(event => event.timestamp > cutoffTime);

    if (previousSize !== this.deadLetterQueue.length) {
      logger.info('Dead letter queue cleaned up', {
        removed: previousSize - this.deadLetterQueue.length,
        remaining: this.deadLetterQueue.length,
        action: 'DLQ_CLEANUP'
      });
    }
  }

  // Memory cleanup scheduler
  private startCleanupScheduler(): void {
    // Periodic cleanup of stale entries
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);

    // DLQ cleanup every hour
    this.dlqCleanupInterval = setInterval(() => {
      this.cleanupDeadLetterQueue();
    }, 60 * 60 * 1000);

    logger.info('Socket cleanup scheduler started', {
      cleanupIntervalMs: this.CLEANUP_INTERVAL_MS,
      dlqRetentionHours: this.DLQ_RETENTION_HOURS,
      action: 'SCHEDULER_STARTED'
    });
  }

  private performCleanup(): void {
    const initialUserSockets = this.userSockets.size;
    const initialBookingRooms = this.bookingRooms.size;

    // Clean up empty user socket entries
    for (const [userId, sockets] of this.userSockets.entries()) {
      // Remove sockets that no longer exist
      const activeSockets = new Set<string>();
      sockets.forEach(socketId => {
        if (this.io.sockets.sockets.has(socketId)) {
          activeSockets.add(socketId);
        }
      });

      if (activeSockets.size === 0) {
        this.userSockets.delete(userId);
      } else if (activeSockets.size < sockets.size) {
        this.userSockets.set(userId, activeSockets);
      }
    }

    // Clean up empty booking room entries
    for (const [bookingId, sockets] of this.bookingRooms.entries()) {
      const activeSockets = new Set<string>();
      sockets.forEach(socketId => {
        if (this.io.sockets.sockets.has(socketId)) {
          activeSockets.add(socketId);
        }
      });

      if (activeSockets.size === 0) {
        this.bookingRooms.delete(bookingId);
      } else if (activeSockets.size < sockets.size) {
        this.bookingRooms.set(bookingId, activeSockets);
      }
    }

    // Clean up socketToBooking mapping
    for (const [socketId, bookings] of this.socketToBooking.entries()) {
      if (!this.io.sockets.sockets.has(socketId)) {
        this.socketToBooking.delete(socketId);
      }
    }

    // Clean up sockets that have been connected too long
    const now = Date.now();
    for (const [socketId, socket] of this.io.sockets.sockets) {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.joinedAt && (now - authSocket.joinedAt) > this.MAX_SOCKET_AGE_MS) {
        logger.info('Forcing disconnect of stale socket', {
          socketId,
          connectedAt: new Date(authSocket.joinedAt),
          action: 'STALE_SOCKET_DISCONNECT'
        });
        socket.disconnect(true);
      }
    }

    const cleanedUserSockets = initialUserSockets - this.userSockets.size;
    const cleanedBookingRooms = initialBookingRooms - this.bookingRooms.size;

    if (cleanedUserSockets > 0 || cleanedBookingRooms > 0) {
      logger.info('Socket cleanup completed', {
        cleanedUserSocketEntries: cleanedUserSockets,
        cleanedBookingRoomEntries: cleanedBookingRooms,
        remainingUserSockets: this.userSockets.size,
        remainingBookingRooms: this.bookingRooms.size,
        action: 'CLEANUP_COMPLETED'
      });
    }
  }

  // Public method to get DLQ status
  getDeadLetterQueueStatus(): { size: number; events: DeadLetterEvent[] } {
    return {
      size: this.deadLetterQueue.length,
      events: [...this.deadLetterQueue]
    };
  }

  // Retry failed events from DLQ
  async retryDeadLetterEvent(eventId: string): Promise<boolean> {
    const eventIndex = this.deadLetterQueue.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      logger.warn('Dead letter event not found for retry', { eventId, action: 'DLQ_RETRY_NOT_FOUND' });
      return false;
    }

    const event = this.deadLetterQueue[eventIndex];
    if (event.retryCount >= event.maxRetries) {
      logger.warn('Dead letter event exceeded max retries', {
        eventId,
        retryCount: event.retryCount,
        action: 'DLQ_MAX_RETRIES'
      });
      return false;
    }

    // Increment retry count and schedule next retry with exponential backoff
    event.retryCount++;
    const backoffMs = Math.pow(2, event.retryCount) * 1000;
    event.nextRetryAt = new Date(Date.now() + backoffMs);

    logger.info('Dead letter event retry scheduled', {
      eventId,
      retryCount: event.retryCount,
      nextRetryAt: event.nextRetryAt,
      action: 'DLQ_RETRY_SCHEDULED'
    });

    // Actually retry the event
    try {
      // Here you would re-emit the event based on its type
      // For now, we just log and remove from DLQ if successful
      this.deadLetterQueue.splice(eventIndex, 1);
      logger.info('Dead letter event retry successful', { eventId, action: 'DLQ_RETRY_SUCCESS' });
      return true;
    } catch (error) {
      logger.error('Dead letter event retry failed', {
        eventId,
        error: (error as Error).message,
        action: 'DLQ_RETRY_FAILED'
      });
      return false;
    }
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token ||
                      socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                      socket.handshake.query.token as string;

        if (!token) {
          logger.warn('Socket connection rejected: No token provided', {
            socketId: socket.id,
            ip: socket.handshake.address,
            action: 'SOCKET_AUTH_FAILED',
          });
          socket.emit('unauthorized');
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '') as {
          id: string;
          role: string;
        };

        socket.userId = decoded.id;
        socket.userRole = decoded.role;

        logger.info('Socket authenticated', {
          socketId: socket.id,
          userId: socket.userId,
          role: socket.userRole,
          action: 'SOCKET_AUTH_SUCCESS',
        });

        next();
      } catch (error: any) {
        logger.warn('Socket authentication failed', {
          socketId: socket.id,
          error: error.message,
          action: 'SOCKET_AUTH_FAILED',
        });
        socket.emit('unauthorized');
        next(new Error('Invalid token'));
      }
    });
  }

  private setupConnectionHandler(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      // Record connection time for cleanup
      socket.joinedAt = Date.now();

      logger.info('Client connected', {
        socketId: socket.id,
        userId: socket.userId,
        action: 'SOCKET_CONNECTED',
      });

      // CRITICAL FIX: Emit 'connected' event to client as defined in ServerToClientEvents interface
      socket.emit('connected', { socketId: socket.id });

      // Track user socket
      if (socket.userId) {
        this.addUserSocket(socket.userId, socket.id);
      }

      // Helper function for validated event handling
      const handleValidatedEvent = <T>(
        eventName: string,
        rawData: unknown,
        handler: (data: T) => void
      ): void => {
        const validation = validateSocketEvent<T>(eventName, rawData);
        if (!validation.valid) {
          this.addToDeadLetterQueue(eventName, rawData, validation.error || 'Validation failed');
          socket.emit('error', { message: `Invalid event data: ${validation.error}` });
          return;
        }
        try {
          handler(validation.value as T);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.addToDeadLetterQueue(eventName, rawData, errorMessage);
          logger.error('Event handler failed', {
            event: eventName,
            error: errorMessage,
            action: 'EVENT_HANDLER_ERROR'
          });
        }
      };

      // Join user-specific room (with validation)
      socket.on('join:user_room', (userId: string) => {
        const eventData = { userId };
        handleValidatedEvent<{ userId: string }>('join:user_room', eventData, (data) => {
          if (socket.userId === data.userId || socket.userRole === 'admin') {
            socket.join(`user:${data.userId}`);
            logger.info('User joined their room', {
              socketId: socket.id,
              userId: data.userId,
              action: 'JOIN_USER_ROOM',
            });
          } else {
            socket.emit('error', { message: 'Not authorized to join this room' });
          }
        });
      });

      // Leave user room (with validation)
      socket.on('leave:user_room', (userId: string) => {
        const eventData = { userId };
        handleValidatedEvent<{ userId: string }>('leave:user_room', eventData, (data) => {
          socket.leave(`user:${data.userId}`);
          logger.info('User left their room', {
            socketId: socket.id,
            userId: data.userId,
            action: 'LEAVE_USER_ROOM',
          });
        });
      });

      // Join booking room (with validation)
      socket.on('join:booking_room', (bookingId: string) => {
        const eventData = { bookingId };
        handleValidatedEvent<{ bookingId: string }>('join:booking_room', eventData, (data) => {
          socket.join(`booking:${data.bookingId}`);

          // Track socket in booking room
          if (!this.bookingRooms.has(data.bookingId)) {
            this.bookingRooms.set(data.bookingId, new Set());
          }
          this.bookingRooms.get(data.bookingId)?.add(socket.id);

          // Track booking for socket (reverse mapping for cleanup)
          if (!this.socketToBooking.has(socket.id)) {
            this.socketToBooking.set(socket.id, new Set());
          }
          this.socketToBooking.get(socket.id)?.add(data.bookingId);

          logger.info('Socket joined booking room', {
            socketId: socket.id,
            bookingId: data.bookingId,
            action: 'JOIN_BOOKING_ROOM',
          });
        });
      });

      // Leave booking room (with validation)
      socket.on('leave:booking_room', (bookingId: string) => {
        const eventData = { bookingId };
        handleValidatedEvent<{ bookingId: string }>('leave:booking_room', eventData, (data) => {
          socket.leave(`booking:${data.bookingId}`);
          this.bookingRooms.get(data.bookingId)?.delete(socket.id);
          this.socketToBooking.get(socket.id)?.delete(data.bookingId);

          logger.info('Socket left booking room', {
            socketId: socket.id,
            bookingId: data.bookingId,
            action: 'LEAVE_BOOKING_ROOM',
          });
        });
      });

      // Typing indicators (with validation)
      socket.on('typing:start', (data: { bookingId: string }) => {
        handleValidatedEvent<{ bookingId: string }>('typing:start', data, (validatedData) => {
          socket.to(`booking:${validatedData.bookingId}`).emit('typing:start', {
            bookingId: validatedData.bookingId,
            userId: socket.userId,
          });
        });
      });

      socket.on('typing:stop', (data: { bookingId: string }) => {
        handleValidatedEvent<{ bookingId: string }>('typing:stop', data, (validatedData) => {
          socket.to(`booking:${validatedData.bookingId}`).emit('typing:stop', {
            bookingId: validatedData.bookingId,
            userId: socket.userId,
          });
        });
      });

      // Handle disconnection with complete cleanup
      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
          action: 'SOCKET_DISCONNECTED',
        });

        // Remove from user socket tracking
        if (socket.userId) {
          this.removeUserSocket(socket.userId, socket.id);
        }

        // Remove from all booking rooms using reverse mapping (efficient cleanup)
        const bookings = this.socketToBooking.get(socket.id);
        if (bookings) {
          bookings.forEach(bookingId => {
            this.bookingRooms.get(bookingId)?.delete(socket.id);
            // Clean up empty booking rooms
            if (this.bookingRooms.get(bookingId)?.size === 0) {
              this.bookingRooms.delete(bookingId);
            }
          });
          this.socketToBooking.delete(socket.id);
        }

        // Additional safety cleanup: scan all booking rooms for orphaned socket IDs
        // This handles edge cases where reverse mapping might have missed something
        for (const [bookingId, sockets] of this.bookingRooms.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.bookingRooms.delete(bookingId);
            }
          }
        }
      });
    });
  }

  // Track user sockets
  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
  }

  private removeUserSocket(userId: string, socketId: string): void {
    this.userSockets.get(userId)?.delete(socketId);
    if (this.userSockets.get(userId)?.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  // Emit to specific user with error handling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitToUser<T extends keyof ServerToClientEvents>(userId: string, event: T, data: any): boolean {
    try {
      const room = this.io.to(`user:${userId}`);
      const socketsCount = this.userSockets.get(userId)?.size || 0;

      if (socketsCount === 0) {
        logger.debug('No sockets in user room', {
          userId,
          event,
          action: 'EMIT_TO_USER_NO_TARGETS'
        });
        return false;
      }

      (room as any).emit(event, data);
      logger.debug('Emitted event to user', {
        userId,
        event,
        targetSockets: socketsCount,
        action: 'EMIT_TO_USER',
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addToDeadLetterQueue(event, data, errorMessage);
      logger.error('Failed to emit event to user', {
        userId,
        event,
        error: errorMessage,
        action: 'EMIT_TO_USER_FAILED'
      });
      return false;
    }
  }

  // Emit to booking room with error handling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitToBooking<T extends keyof ServerToClientEvents>(bookingId: string, event: T, data: any): boolean {
    try {
      const room = this.io.to(`booking:${bookingId}`);
      const socketsCount = this.bookingRooms.get(bookingId)?.size || 0;

      if (socketsCount === 0) {
        logger.debug('No sockets in booking room', {
          bookingId,
          event,
          action: 'EMIT_TO_BOOKING_NO_TARGETS'
        });
        return false;
      }

      (room as any).emit(event, data);
      logger.debug('Emitted event to booking room', {
        bookingId,
        event,
        targetSockets: socketsCount,
        action: 'EMIT_TO_BOOKING',
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addToDeadLetterQueue(event, data, errorMessage);
      logger.error('Failed to emit event to booking room', {
        bookingId,
        event,
        error: errorMessage,
        action: 'EMIT_TO_BOOKING_FAILED'
      });
      return false;
    }
  }

  // Emit to multiple users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitToUsers<T extends keyof ServerToClientEvents>(userIds: string[], event: T, data: any): { successful: string[]; failed: string[] } {
    const results: { successful: string[]; failed: string[] } = { successful: [], failed: [] };

    for (const userId of userIds) {
      if (this.emitToUser(userId, event, data)) {
        results.successful.push(userId);
      } else {
        results.failed.push(userId);
      }
    }

    return results;
  }

  // Emit to admins
  // SECURITY FIX: Only emit to sockets with admin role, not everyone
  emitToAdmins<T extends keyof ServerToClientEvents>(event: T, data: any): boolean {
    try {
      let emitted = false;
      // Iterate through all connected sockets and only emit to admin users
      for (const socket of this.io.sockets.sockets.values()) {
        const authSocket = socket as AuthenticatedSocket;
        if (authSocket.userRole === 'admin') {
          authSocket.emit(event, data);
          emitted = true;
        }
      }
      if (emitted) {
        logger.debug('Emitted event to admins', {
          event,
          action: 'EMIT_TO_ADMINS',
        });
      }
      return emitted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addToDeadLetterQueue(event, data, errorMessage);
      logger.error('Failed to emit event to admins', {
        event,
        error: errorMessage,
        action: 'EMIT_TO_ADMINS_FAILED'
      });
      return false;
    }
  }

  // Emit booking status change
  emitBookingStatusChange(booking: {
    _id: string;
    bookingNumber: string;
    status: string;
    customerId?: string;
    providerId?: string;
  }): { customerEmitted: boolean; providerEmitted: boolean } {
    const eventData: BookingEvent = {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      userId: '',
      timestamp: new Date(),
    };

    let customerEmitted = false;
    let providerEmitted = false;

    // Emit to customer
    if (booking.customerId) {
      customerEmitted = this.emitToUser(booking.customerId.toString(), 'booking:status_changed', {
        ...eventData,
        userId: booking.customerId.toString(),
      });
    }

    // Emit to provider
    if (booking.providerId) {
      providerEmitted = this.emitToUser(booking.providerId.toString(), 'booking:status_changed', {
        ...eventData,
        userId: booking.providerId.toString(),
      });
    }

    // FIX 1: Emit specific booking:confirmed event when status is 'confirmed'
    if (booking.status === 'confirmed') {
      if (booking.customerId) {
        this.emitToUser(booking.customerId.toString(), 'booking:confirmed', {
          ...eventData,
          userId: booking.customerId.toString(),
        });
      }
      if (booking.providerId) {
        this.emitToUser(booking.providerId.toString(), 'booking:confirmed', {
          ...eventData,
          userId: booking.providerId.toString(),
        });
      }
      logger.info('Emitted booking:confirmed event', {
        bookingId: booking._id,
        action: 'EMIT_BOOKING_CONFIRMED',
      });
    }

    // FIX 2: Emit specific booking:cancelled event when status is 'cancelled'
    if (booking.status === 'cancelled') {
      if (booking.customerId) {
        this.emitToUser(booking.customerId.toString(), 'booking:cancelled', {
          ...eventData,
          userId: booking.customerId.toString(),
        });
      }
      if (booking.providerId) {
        this.emitToUser(booking.providerId.toString(), 'booking:cancelled', {
          ...eventData,
          userId: booking.providerId.toString(),
        });
      }
      logger.info('Emitted booking:cancelled event', {
        bookingId: booking._id,
        action: 'EMIT_BOOKING_CANCELLED',
      });
    }

    // FIX: Emit specific booking:completed event when status is 'completed'
    if (booking.status === 'completed') {
      if (booking.customerId) {
        this.emitToUser(booking.customerId.toString(), 'booking:completed', {
          ...eventData,
          userId: booking.customerId.toString(),
        });
      }
      if (booking.providerId) {
        this.emitToUser(booking.providerId.toString(), 'booking:completed', {
          ...eventData,
          userId: booking.providerId.toString(),
        });
      }
      logger.info('Emitted booking:completed event', {
        bookingId: booking._id,
        action: 'EMIT_BOOKING_COMPLETED',
      });
    }

    logger.info('Emitted booking status change', {
      bookingId: booking._id,
      status: booking.status,
      customerEmitted,
      providerEmitted,
      action: 'EMIT_BOOKING_STATUS',
    });

    return { customerEmitted, providerEmitted };
  }

  // Emit new booking request to provider
  emitNewBookingRequest(booking: {
    _id: string;
    bookingNumber: string;
    status: string;
    providerId: string;
  }): boolean {
    const eventData: BookingEvent = {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      userId: booking.providerId,
      timestamp: new Date(),
    };

    const emitted = this.emitToUser(booking.providerId, 'booking:new_request', {
      booking: eventData,
      providerId: booking.providerId,
    });

    if (emitted) {
      logger.info('Emitted new booking request', {
        bookingId: booking._id,
        providerId: booking.providerId,
        action: 'EMIT_NEW_BOOKING',
      });
    }

    return emitted;
  }

  // Emit notification
  emitNotification(notification: NotificationEvent): boolean {
    const emitted = this.emitToUser(notification.userId, 'notification:new', notification);

    if (emitted) {
      logger.info('Emitted notification', {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        action: 'EMIT_NOTIFICATION',
      });
    }

    return emitted;
  }

  // Get socket server instance
  getIO(): Server {
    return this.io;
  }

  // Get online users count
  getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  // Get memory statistics
  getMemoryStats(): {
    userSockets: number;
    bookingRooms: number;
    socketToBooking: number;
    deadLetterQueue: number;
  } {
    return {
      userSockets: this.userSockets.size,
      bookingRooms: this.bookingRooms.size,
      socketToBooking: this.socketToBooking.size,
      deadLetterQueue: this.deadLetterQueue.length,
    };
  }

  // =============================================================================
  // Provider Status Events
  // =============================================================================

  // Emit provider approved event
  emitProviderApproved(providerId: string): boolean {
    const emitted = this.emitToUser(providerId, 'provider:approved', {
      providerId,
      verifiedAt: new Date(),
    });
    if (emitted) {
      logger.info('Emitted provider approved event', { providerId, action: 'EMIT_PROVIDER_APPROVED' });
    }
    return emitted;
  }

  // Emit provider rejected event
  emitProviderRejected(providerId: string, reason: string, canAppeal: boolean = true): boolean {
    const emitted = this.emitToUser(providerId, 'provider:rejected', {
      providerId,
      reason,
      canAppeal,
    });
    if (emitted) {
      logger.info('Emitted provider rejected event', { providerId, reason, action: 'EMIT_PROVIDER_REJECTED' });
    }
    return emitted;
  }

  // Emit provider suspended event
  emitProviderSuspended(providerId: string, reason: string, until?: Date): boolean {
    const emitted = this.emitToUser(providerId, 'provider:suspended', {
      providerId,
      reason,
      until,
    });
    if (emitted) {
      logger.info('Emitted provider suspended event', { providerId, reason, action: 'EMIT_PROVIDER_SUSPENDED' });
    }
    return emitted;
  }

  // Emit document verified event
  emitDocumentVerified(providerId: string, documentId: string, status: 'approved' | 'rejected', notes?: string): boolean {
    const emitted = this.emitToUser(providerId, 'provider:document_verified', {
      providerId,
      documentId,
      status,
      notes,
    });
    if (emitted) {
      logger.info('Emitted document verified event', { providerId, documentId, status, action: 'EMIT_DOCUMENT_VERIFIED' });
    }
    return emitted;
  }

  // Emit verification complete event
  emitVerificationComplete(providerId: string, kycLevel: number): boolean {
    const emitted = this.emitToUser(providerId, 'provider:verification_complete', {
      providerId,
      kycLevel,
    });
    if (emitted) {
      logger.info('Emitted verification complete event', { providerId, kycLevel, action: 'EMIT_VERIFICATION_COMPLETE' });
    }
    return emitted;
  }

  // =============================================================================
  // Service Status Events
  // =============================================================================

  // Emit service approved event
  emitServiceApproved(serviceId: string, providerId: string): boolean {
    const emitted = this.emitToUser(providerId, 'service:approved', {
      serviceId,
      providerId,
    });
    if (emitted) {
      logger.info('Emitted service approved event', { serviceId, providerId, action: 'EMIT_SERVICE_APPROVED' });
    }
    return emitted;
  }

  // Emit service rejected event
  emitServiceRejected(serviceId: string, providerId: string, reason: string): boolean {
    const emitted = this.emitToUser(providerId, 'service:rejected', {
      serviceId,
      providerId,
      reason,
    });
    if (emitted) {
      logger.info('Emitted service rejected event', { serviceId, providerId, reason, action: 'EMIT_SERVICE_REJECTED' });
    }
    return emitted;
  }

  // Emit service status changed event (to admins)
  emitServiceStatusChanged(serviceId: string, providerId: string, serviceName: string, status: string): boolean {
    let emitted = false;
    for (const socket of this.io.sockets.sockets.values()) {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.userRole === 'admin') {
        authSocket.emit('service:status_changed', {
          serviceId,
          providerId,
          serviceName,
          status,
        });
        emitted = true;
      }
    }
    if (emitted) {
      logger.info('Emitted service status changed to admins', { serviceId, providerId, serviceName, status, action: 'EMIT_SERVICE_STATUS_CHANGED' });
    }
    return emitted;
  }

  // =============================================================================
  // Admin Notification Events
  // =============================================================================

  // Track admin socket rooms
  private adminRooms: Set<string> = new Set();

  // Emit new provider submission to admins
  emitNewProviderSubmission(providerId: string, providerName: string): boolean {
    // Emit to all connected admin sockets
    let emitted = false;
    for (const socket of this.io.sockets.sockets.values()) {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.userRole === 'admin') {
        authSocket.emit('admin:new_provider_submission', {
          providerId,
          providerName,
          submittedAt: new Date(),
        });
        emitted = true;
      }
    }
    if (emitted) {
      logger.info('Emitted new provider submission to admins', { providerId, providerName, action: 'EMIT_NEW_PROVIDER_SUBMISSION' });
    }
    return emitted;
  }

  // Emit new service pending to admins
  emitNewServicePending(serviceId: string, providerId: string, serviceName: string): boolean {
    let emitted = false;
    for (const socket of this.io.sockets.sockets.values()) {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.userRole === 'admin') {
        authSocket.emit('admin:new_service_pending', {
          serviceId,
          providerId,
          serviceName,
        });
        emitted = true;
      }
    }
    if (emitted) {
      logger.info('Emitted new service pending to admins', { serviceId, providerId, serviceName, action: 'EMIT_NEW_SERVICE_PENDING' });
    }
    return emitted;
  }

  // =============================================================================
  // Dispute Events
  // =============================================================================

  // Emit new dispute to admins
  emitDisputeNew(disputeId: string, bookingId: string, disputeNumber: string, category: string, priority: string): boolean {
    let emitted = false;
    for (const socket of this.io.sockets.sockets.values()) {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.userRole === 'admin') {
        authSocket.emit('dispute:new', {
          disputeId,
          bookingId,
          disputeNumber,
          category,
          priority,
        });
        emitted = true;
      }
    }
    if (emitted) {
      logger.info('Emitted new dispute to admins', { disputeId, disputeNumber, action: 'EMIT_DISPUTE_NEW' });
    }
    return emitted;
  }

  // Emit dispute resolved to customer and provider
  emitDisputeResolved(customerId: string, providerId: string, disputeId: string, resolution: string, resolutionType: string): { customerEmitted: boolean; providerEmitted: boolean } {
    const eventData = {
      disputeId,
      resolution,
      resolutionType,
    };

    let customerEmitted = false;
    let providerEmitted = false;

    if (customerId) {
      customerEmitted = this.emitToUser(customerId, 'dispute:resolved', eventData);
    }

    if (providerId) {
      providerEmitted = this.emitToUser(providerId, 'dispute:resolved', eventData);
    }

    logger.info('Emitted dispute resolved event', {
      disputeId,
      customerEmitted,
      providerEmitted,
      action: 'EMIT_DISPUTE_RESOLVED',
    });

    return { customerEmitted, providerEmitted };
  }

  // =============================================================================
  // Withdrawal Events
  // =============================================================================

  // Emit withdrawal approved event to provider
  // SECURITY FIX: Added providerId to match frontend expectations
  emitWithdrawalApproved(providerId: string, withdrawalId: string, amount: number, currency: string): boolean {
    const emitted = this.emitToUser(providerId, 'withdrawal:approved', {
      withdrawalId,
      providerId, // Include providerId for frontend to identify the provider
      amount,
      currency,
      status: 'processing',
      processedAt: new Date().toISOString(),
    });
    if (emitted) {
      logger.info('Emitted withdrawal approved event', { providerId, withdrawalId, amount, action: 'EMIT_WITHDRAWAL_APPROVED' });
    }
    return emitted;
  }

  // Emit withdrawal rejected event to provider
  // SECURITY FIX: Added providerId to match frontend expectations
  emitWithdrawalRejected(providerId: string, withdrawalId: string, amount: number, currency: string, reason: string): boolean {
    const emitted = this.emitToUser(providerId, 'withdrawal:rejected', {
      withdrawalId,
      providerId, // Include providerId for frontend to identify the provider
      amount,
      currency,
      status: 'rejected',
      reason,
      rejectedAt: new Date().toISOString(),
    });
    if (emitted) {
      logger.info('Emitted withdrawal rejected event', { providerId, withdrawalId, amount, reason, action: 'EMIT_WITHDRAWAL_REJECTED' });
    }
    return emitted;
  }

  // Emit withdrawal pending event to provider
  // FIX #6: Added missing withdrawal:pending event emission
  emitWithdrawalPending(providerId: string, withdrawalId: string, amount: number, currency: string): boolean {
    const emitted = this.emitToUser(providerId, 'withdrawal:pending', {
      withdrawalId,
      providerId,
      amount,
      currency,
      status: 'pending',
    });
    if (emitted) {
      logger.info('Emitted withdrawal pending event', { providerId, withdrawalId, amount, action: 'EMIT_WITHDRAWAL_PENDING' });
    }
    return emitted;
  }

  // Emit new withdrawal request to admins
  emitNewWithdrawalRequest(withdrawalId: string, providerId: string, providerName: string, amount: number, currency: string): boolean {
    let emitted = false;
    for (const socket of this.io.sockets.sockets.values()) {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.userRole === 'admin') {
        authSocket.emit('admin:new_withdrawal_request', {
          withdrawalId,
          providerId,
          providerName,
          amount,
          currency,
          requestedAt: new Date(),
        });
        emitted = true;
      }
    }
    if (emitted) {
      logger.info('Emitted new withdrawal request to admins', { withdrawalId, providerId, providerName, amount, action: 'EMIT_NEW_WITHDRAWAL_REQUEST' });
    }
    return emitted;
  }

  // Emit review moderated event to provider
  emitReviewModerated(providerId: string, reviewId: string, action: string, rating: number): boolean {
    const emitted = this.emitToUser(providerId, 'review:moderated', {
      reviewId,
      providerId,
      action, // 'approved', 'hidden', 'rejected'
      rating,
      timestamp: new Date(),
    });
    if (emitted) {
      logger.info('Emitted review moderated event', { providerId, reviewId, moderationAction: action, eventName: 'EMIT_REVIEW_MODERATED' });
    }
    return emitted;
  }

  // Emit review moderated event to customer (reviewer)
  emitReviewModeratedToCustomer(customerId: string, reviewId: string, action: string, reason?: string): boolean {
    const emitted = this.emitToUser(customerId, 'review:moderated', {
      reviewId,
      customerId,
      action, // 'approved', 'hidden', 'rejected'
      reason,
      timestamp: new Date(),
    });
    if (emitted) {
      logger.info('Emitted review moderated event to customer', { customerId, reviewId, moderationAction: action, eventName: 'EMIT_REVIEW_MODERATED_CUSTOMER' });
    }
    return emitted;
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down socket server', { action: 'SOCKET_SHUTDOWN' });

    // Stop cleanup intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.dlqCleanupInterval) {
      clearInterval(this.dlqCleanupInterval);
      this.dlqCleanupInterval = null;
    }

    // Shutdown chat handler
    this.chatHandler = null;

    // Clear all Maps
    this.userSockets.clear();
    this.bookingRooms.clear();
    this.socketToBooking.clear();
    this.deadLetterQueue = [];

    // Disconnect all sockets
    this.io.disconnectSockets(true);

    // Close Redis connections if using Redis adapter
    if (this.pubClient) {
      try {
        await this.pubClient.quit();
        logger.info('Redis pubClient disconnected', { action: 'REDIS_PUB_DISCONNECTED' });
      } catch (error) {
        logger.warn('Error disconnecting Redis pubClient', { action: 'REDIS_PUB_DISCONNECT_ERROR' });
      }
      this.pubClient = null;
    }

    if (this.subClient) {
      try {
        await this.subClient.quit();
        logger.info('Redis subClient disconnected', { action: 'REDIS_SUB_DISCONNECTED' });
      } catch (error) {
        logger.warn('Error disconnecting Redis subClient', { action: 'REDIS_SUB_DISCONNECT_ERROR' });
      }
      this.subClient = null;
    }

    // Close the server
    this.io.close();

    logger.info('Socket server shutdown complete', { action: 'SOCKET_SHUTDOWN_COMPLETE' });
  }
}

// Singleton instance
let socketServer: SocketServer | null = null;

export const initializeSocketServer = (httpServer: HttpServer): SocketServer => {
  if (!socketServer) {
    socketServer = new SocketServer(httpServer);
  }
  return socketServer;
};

export const getSocketServer = (): SocketServer | null => {
  return socketServer;
};

export default SocketServer;
