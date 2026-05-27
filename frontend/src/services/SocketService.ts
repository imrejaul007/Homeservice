import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import logger from '../lib/logger';

// P0 FIX: Track active subscriptions for proper cleanup
interface ListenerSubscription {
  event: string;
  callback: Function;
  unsubscribe: () => void;
}

// Socket event types
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

export interface MessageEvent {
  bookingId: string;
  message: string;
  senderId: string;
  timestamp: Date;
}

export interface TypingEvent {
  bookingId: string;
  userId: string;
}

// Socket server events interface
interface ServerToClientEvents {
  'booking:status_changed': (data: BookingEvent) => void;
  'booking:new_request': (data: { booking: BookingEvent; providerId: string }) => void;
  'booking:confirmed': (data: BookingEvent) => void;
  'booking:cancelled': (data: BookingEvent) => void;
  'booking:reminder': (data: { bookingId: string; minutesUntil: number }) => void;
  'notification:new': (data: NotificationEvent) => void;
  'notification:read': (data: { notificationId: string }) => void;
  'message:new': (data: MessageEvent) => void;
  'connected': (data: { socketId: string }) => void;
  'error': (data: { message: string }) => void;
  'unauthorized': () => void;
  'typing:start': (data: TypingEvent) => void;
  'typing:stop': (data: TypingEvent) => void;
}

interface ClientToServerEvents {
  'join:user_room': (userId: string) => void;
  'leave:user_room': (userId: string) => void;
  'join:booking_room': (bookingId: string) => void;
  'leave:booking_room': (bookingId: string) => void;
  'typing:start': (data: { bookingId: string }) => void;
  'typing:stop': (data: { bookingId: string }) => void;
}

// Event callback types
type BookingStatusCallback = (data: BookingEvent) => void;
type BookingRequestCallback = (data: { booking: BookingEvent; providerId: string }) => void;
type NotificationCallback = (data: NotificationEvent) => void;
type MessageCallback = (data: MessageEvent) => void;
type ConnectionCallback = (data: { socketId: string }) => void;
type ErrorCallback = (data: { message: string }) => void;
type TypingCallback = (data: TypingEvent) => void;

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<Function>> = new Map();
  // P0 FIX: Track active subscriptions for proper cleanup
  private activeSubscriptions: Map<string, ListenerSubscription> = new Map();
  private subscriptionIdCounter = 0;
  private isDisconnecting = false;
  // P0 FIX: Track if event listeners have been set up to prevent duplicates
  private listenersSetup = false;

  // Singleton pattern
  private static instance: SocketService;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Socket.io connection
   * P0 FIX: Added connection status checks and duplicate prevention
   */
  connect(): void {
    // P0 FIX: Prevent connecting if already disconnecting
    if (this.isDisconnecting) {
      logger.info('Socket connection prevented: currently disconnecting');
      return;
    }

    // P0 FIX: Check if already connected to prevent duplicate connections
    if (this.socket?.connected) {
      logger.info('Socket already connected');
      return;
    }

    // P0 FIX: Check if connection is in progress
    if ((this.socket as any)?.connecting) {
      logger.info('Socket connection already in progress');
      return;
    }

    const authStore = useAuthStore.getState();
    const tokens = authStore.tokens;

    if (!tokens?.accessToken) {
      logger.warn('Cannot connect socket: No auth token available');
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

    this.socket = io(socketUrl, {
      auth: {
        token: tokens.accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  /**
   * Setup socket event listeners
   * P0 FIX: Prevent duplicate event listener setup
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // P0 FIX: Prevent duplicate listener setup
    if (this.listenersSetup) {
      logger.info('Socket event listeners already set up, skipping duplicate setup');
      return;
    }
    this.listenersSetup = true;

    // Connection events
    this.socket.on('connect', () => {
      logger.info('Socket connected', { socketId: this.socket?.id });
      this.reconnectAttempts = 0;
      this.emit('connected', { socketId: this.socket?.id || '' });
      this.emitToServer('join:user_room', useAuthStore.getState().user?.id || '');
      this.notifyListeners('connect', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { reason, socketId: this.socket?.id });
      this.notifyListeners('disconnect', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      logger.error('Socket connection error', {
        error: error.message,
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      this.notifyListeners('connect_error', { error: error.message });
    });

    // Authorization
    this.socket.on('unauthorized', () => {
      logger.warn('Socket unauthorized - token may be invalid');
      this.notifyListeners('unauthorized', {});
    });

    // Error handling
    this.socket.on('error', (data) => {
      logger.error('Socket error received', { message: data.message });
      this.notifyListeners('error', data);
    });

    // Booking events
    this.socket.on('booking:status_changed', (data) => {
      logger.info('Booking status changed', { bookingId: data.bookingId, status: data.status });
      this.notifyListeners('booking:status_changed', data);
    });

    this.socket.on('booking:new_request', (data) => {
      logger.info('New booking request received', { bookingId: data.booking.bookingId });
      this.notifyListeners('booking:new_request', data);
    });

    this.socket.on('booking:confirmed', (data) => {
      logger.info('Booking confirmed', { bookingId: data.bookingId });
      this.notifyListeners('booking:confirmed', data);
    });

    this.socket.on('booking:cancelled', (data) => {
      logger.info('Booking cancelled', { bookingId: data.bookingId });
      this.notifyListeners('booking:cancelled', data);
    });

    this.socket.on('booking:reminder', (data) => {
      logger.info('Booking reminder', { bookingId: data.bookingId, minutesUntil: data.minutesUntil });
      this.notifyListeners('booking:reminder', data);
    });

    // Notification events
    this.socket.on('notification:new', (data) => {
      logger.info('New notification received', { id: data.id, type: data.type });
      this.notifyListeners('notification:new', data);
    });

    this.socket.on('notification:read', (data) => {
      logger.info('Notification marked as read', { notificationId: data.notificationId });
      this.notifyListeners('notification:read', data);
    });

    // Message events
    this.socket.on('message:new', (data) => {
      logger.info('New message received', { bookingId: data.bookingId });
      this.notifyListeners('message:new', data);
    });

    // Typing indicators
    this.socket.on('typing:start', (data) => {
      this.notifyListeners('typing:start', data);
    });

    this.socket.on('typing:stop', (data) => {
      this.notifyListeners('typing:stop', data);
    });
  }

  /**
   * Emit event to server
   */
  private emitToServer<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    if (!this.socket?.connected) {
      logger.warn(`Cannot emit ${event}: Socket not connected`);
      return;
    }
    this.socket.emit(event, ...args);
  }

  /**
   * Join a booking room
   */
  joinBookingRoom(bookingId: string): void {
    this.emitToServer('join:booking_room', bookingId);
    logger.info('Joining booking room', { bookingId });
  }

  /**
   * Leave a booking room
   */
  leaveBookingRoom(bookingId: string): void {
    this.emitToServer('leave:booking_room', bookingId);
    logger.info('Leaving booking room', { bookingId });
  }

  /**
   * Start typing indicator
   */
  startTyping(bookingId: string): void {
    this.emitToServer('typing:start', { bookingId });
  }

  /**
   * Stop typing indicator
   */
  stopTyping(bookingId: string): void {
    this.emitToServer('typing:stop', { bookingId });
  }

  /**
   * Disconnect socket and clean up all resources
   * P0 FIX: Proper cleanup of event listeners, subscriptions, and state
   */
  disconnect(): void {
    // P0 FIX: Prevent multiple simultaneous disconnections
    if (this.isDisconnecting) {
      logger.info('Socket already disconnecting');
      return;
    }
    this.isDisconnecting = true;

    // P0 FIX: Clean up all active subscriptions
    this.activeSubscriptions.forEach((subscription) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        logger.error('Error cleaning up subscription', { error });
      }
    });
    this.activeSubscriptions.clear();

    // P0 FIX: Clear all internal listeners
    this.listeners.clear();

    // P0 FIX: Disconnect socket if connected
    if (this.socket) {
      // Remove all socket event listeners before disconnecting
      this.socket.removeAllListeners();

      // Disconnect the socket
      this.socket.disconnect();
      this.socket = null;

      // Reset connection state flags
      this.listenersSetup = false;
      this.reconnectAttempts = 0;

      logger.info('Socket disconnected and cleaned up');
    }

    // P0 FIX: Reset disconnecting flag after cleanup
    this.isDisconnecting = false;
  }

  /**
   * Check if socket is connected
   * P0 FIX: Added isDisconnecting check for accurate status
   */
  isConnected(): boolean {
    return !this.isDisconnecting && (this.socket?.connected || false);
  }

  /**
   * Get connection status details
   * P0 FIX: New helper for debugging connection state
   */
  getConnectionStatus(): { connected: boolean; connecting: boolean; disconnecting: boolean; socketExists: boolean } {
    return {
      connected: this.socket?.connected || false,
      connecting: (this.socket as any)?.connecting || false,
      disconnecting: this.isDisconnecting,
      socketExists: this.socket !== null,
    };
  }

  /**
   * Subscribe to booking status changes
   */
  onBookingStatusChanged(callback: BookingStatusCallback): () => void {
    return this.addListener('booking:status_changed', callback);
  }

  /**
   * Subscribe to new booking requests (providers)
   */
  onNewBookingRequest(callback: BookingRequestCallback): () => void {
    return this.addListener('booking:new_request', callback);
  }

  /**
   * Subscribe to new notifications
   */
  onNewNotification(callback: NotificationCallback): () => void {
    return this.addListener('notification:new', callback);
  }

  /**
   * Subscribe to new messages
   */
  onNewMessage(callback: MessageCallback): () => void {
    return this.addListener('message:new', callback);
  }

  /**
   * Subscribe to connection status
   */
  onConnect(callback: ConnectionCallback): () => void {
    return this.addListener('connect', callback);
  }

  /**
   * Subscribe to connection errors
   */
  onConnectError(callback: ErrorCallback): () => void {
    return this.addListener('connect_error', callback);
  }

  /**
   * Subscribe to typing indicators
   */
  onTypingStart(callback: TypingCallback): () => void {
    return this.addListener('typing:start', callback);
  }

  onTypingStop(callback: TypingCallback): () => void {
    return this.addListener('typing:stop', callback);
  }

  /**
   * Subscribe to unauthorized events
   */
  onUnauthorized(callback: () => void): () => void {
    return this.addListener('unauthorized', callback);
  }

  /**
   * Remove event listener (alias for unsubscribe)
   * Maintains API compatibility
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  // P0 FIX: Internal listener management with subscription tracking
  addListener(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    // P0 FIX: Track subscription for proper cleanup
    const subscriptionId = `sub_${++this.subscriptionIdCounter}`;

    // Return unsubscribe function that also removes from tracking
    const unsubscribe = () => {
      this.listeners.get(event)?.delete(callback);
      this.activeSubscriptions.delete(subscriptionId);
    };

    this.activeSubscriptions.set(subscriptionId, {
      event,
      callback,
      unsubscribe,
    });

    return unsubscribe;
  }

  private notifyListeners(event: string, data: any): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Error in socket listener', { event, error });
      }
    });
  }

  // Emit for connection events (used internally)
  private emit(event: string, data: any): void {
    this.notifyListeners(event, data);
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();
export default socketService;
