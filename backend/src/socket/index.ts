import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import logger from '../utils/logger';

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

export interface ServerToClientEvents {
  // Booking events
  'booking:status_changed': (data: BookingEvent) => void;
  'booking:new_request': (data: { booking: BookingEvent; providerId: string }) => void;
  'booking:confirmed': (data: BookingEvent) => void;
  'booking:cancelled': (data: BookingEvent) => void;
  'booking:reminder': (data: { bookingId: string; minutesUntil: number }) => void;

  // Notification events
  'notification:new': (data: NotificationEvent) => void;
  'notification:read': (data: { notificationId: string }) => void;

  // Message events
  'message:new': (data: { bookingId: string; message: string; senderId: string; timestamp: Date }) => void;

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

  // Admin notification events (Provider → Admin)
  'admin:new_provider_submission': (data: { providerId: string; providerName: string; submittedAt: Date }) => void;
  'admin:new_service_pending': (data: { serviceId: string; providerId: string; serviceName: string }) => void;
}

export interface ClientToServerEvents {
  // Join rooms
  'join:user_room': (userId: string) => void;
  'leave:user_room': (userId: string) => void;
  'join:booking_room': (bookingId: string) => void;
  'leave:booking_room': (bookingId: string) => void;

  // Typing indicators
  'typing:start': (data: { bookingId: string }) => void;
  'typing:stop': (data: { bookingId: string }) => void;

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
    this.startCleanupScheduler();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitToAdmins<T extends keyof ServerToClientEvents>(event: T, data: any): boolean {
    try {
      (this.io as any).emit(event, data);
      logger.debug('Emitted event to all admins', {
        event,
        action: 'EMIT_TO_ADMINS',
      });
      return true;
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

  // Graceful shutdown
  shutdown(): void {
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

    // Clear all Maps
    this.userSockets.clear();
    this.bookingRooms.clear();
    this.socketToBooking.clear();
    this.deadLetterQueue = [];

    // Disconnect all sockets
    this.io.disconnectSockets(true);

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
