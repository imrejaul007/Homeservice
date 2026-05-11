import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

// Types
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
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

class SocketServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private bookingRooms: Map<string, Set<string>> = new Map(); // bookingId -> Set of socketIds

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
      logger.info('Client connected', {
        socketId: socket.id,
        userId: socket.userId,
        action: 'SOCKET_CONNECTED',
      });

      // Track user socket
      if (socket.userId) {
        this.addUserSocket(socket.userId, socket.id);
      }

      // Join user-specific room
      socket.on('join:user_room', (userId: string) => {
        if (socket.userId === userId || socket.userRole === 'admin') {
          socket.join(`user:${userId}`);
          logger.info('User joined their room', {
            socketId: socket.id,
            userId,
            action: 'JOIN_USER_ROOM',
          });
        }
      });

      // Leave user room
      socket.on('leave:user_room', (userId: string) => {
        socket.leave(`user:${userId}`);
        logger.info('User left their room', {
          socketId: socket.id,
          userId,
          action: 'LEAVE_USER_ROOM',
        });
      });

      // Join booking room
      socket.on('join:booking_room', (bookingId: string) => {
        socket.join(`booking:${bookingId}`);

        if (!this.bookingRooms.has(bookingId)) {
          this.bookingRooms.set(bookingId, new Set());
        }
        this.bookingRooms.get(bookingId)?.add(socket.id);

        logger.info('Socket joined booking room', {
          socketId: socket.id,
          bookingId,
          action: 'JOIN_BOOKING_ROOM',
        });
      });

      // Leave booking room
      socket.on('leave:booking_room', (bookingId: string) => {
        socket.leave(`booking:${bookingId}`);
        this.bookingRooms.get(bookingId)?.delete(socket.id);

        logger.info('Socket left booking room', {
          socketId: socket.id,
          bookingId,
          action: 'LEAVE_BOOKING_ROOM',
        });
      });

      // Typing indicators
      socket.on('typing:start', (data: { bookingId: string }) => {
        socket.to(`booking:${data.bookingId}`).emit('typing:start', {
          bookingId: data.bookingId,
          userId: socket.userId,
        });
      });

      socket.on('typing:stop', (data: { bookingId: string }) => {
        socket.to(`booking:${data.bookingId}`).emit('typing:stop', {
          bookingId: data.bookingId,
          userId: socket.userId,
        });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
          action: 'SOCKET_DISCONNECTED',
        });

        // Remove from tracking
        if (socket.userId) {
          this.removeUserSocket(socket.userId, socket.id);
        }

        // Remove from booking rooms
        this.bookingRooms.forEach((sockets, bookingId) => {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.bookingRooms.delete(bookingId);
          }
        });
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

  // Emit to specific user
  emitToUser(userId: string, event: keyof ServerToClientEvents, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug('Emitted event to user', {
      userId,
      event,
      action: 'EMIT_TO_USER',
    });
  }

  // Emit to booking room
  emitToBooking(bookingId: string, event: keyof ServerToClientEvents, data: any): void {
    this.io.to(`booking:${bookingId}`).emit(event, data);
    logger.debug('Emitted event to booking room', {
      bookingId,
      event,
      action: 'EMIT_TO_BOOKING',
    });
  }

  // Emit to multiple users
  emitToUsers(userIds: string[], event: keyof ServerToClientEvents, data: any): void {
    userIds.forEach((userId) => {
      this.emitToUser(userId, event, data);
    });
  }

  // Emit to admins
  emitToAdmins(event: keyof ServerToClientEvents, data: any): void {
    // In a real app, you'd track admin socket IDs separately
    this.io.emit(event, data);
  }

  // Emit booking status change
  emitBookingStatusChange(booking: {
    _id: string;
    bookingNumber: string;
    status: string;
    customerId?: string;
    providerId?: string;
  }): void {
    const eventData: BookingEvent = {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      userId: '',
      timestamp: new Date(),
    };

    // Emit to customer
    if (booking.customerId) {
      this.emitToUser(booking.customerId.toString(), 'booking:status_changed', {
        ...eventData,
        userId: booking.customerId.toString(),
      });
    }

    // Emit to provider
    if (booking.providerId) {
      this.emitToUser(booking.providerId.toString(), 'booking:status_changed', {
        ...eventData,
        userId: booking.providerId.toString(),
      });
    }

    logger.info('Emitted booking status change', {
      bookingId: booking._id,
      status: booking.status,
      action: 'EMIT_BOOKING_STATUS',
    });
  }

  // Emit new booking request to provider
  emitNewBookingRequest(booking: {
    _id: string;
    bookingNumber: string;
    status: string;
    providerId: string;
  }): void {
    const eventData: BookingEvent = {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      userId: booking.providerId,
      timestamp: new Date(),
    };

    this.emitToUser(booking.providerId, 'booking:new_request', {
      booking: eventData,
      providerId: booking.providerId,
    });

    logger.info('Emitted new booking request', {
      bookingId: booking._id,
      providerId: booking.providerId,
      action: 'EMIT_NEW_BOOKING',
    });
  }

  // Emit notification
  emitNotification(notification: NotificationEvent): void {
    this.emitToUser(notification.userId, 'notification:new', notification);
    logger.info('Emitted notification', {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      action: 'EMIT_NOTIFICATION',
    });
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
