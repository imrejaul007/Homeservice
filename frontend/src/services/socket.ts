/**
 * SocketService - Unified WebSocket Client for NILIN Homeservice
 *
 * Manages real-time bidirectional communication with the server using Socket.IO.
 * Handles authentication, reconnection with exponential backoff, event routing,
 * and provides typed event interfaces for type-safe socket communication.
 *
 * Package: com.nilin.app
 * NILIN brand color: #E8B4A8
 *
 * @example
 * ```typescript
 * // Connect and listen for events
 * socketService.connect().then(() => {
 *   socketService.onBookingStatusChanged((data) => {
 *     console.log('Booking status:', data.status);
 *   });
 * });
 * ```
 */

import { io, Socket } from 'socket.io-client';
import { secureStorage } from '@/lib/security';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Booking status change event from server
 */
export interface BookingEvent {
  bookingId: string;
  bookingNumber: string;
  status: string;
  userId: string;
  timestamp: Date;
}

/**
 * Notification event types
 */
export type NotificationType = 'booking' | 'message' | 'system' | 'promotion';

/**
 * New notification event from server
 */
export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId: string;
  timestamp: Date;
  read?: boolean;
}

/**
 * Chat message event
 */
export interface MessageEvent {
  bookingId: string;
  message: string;
  senderId: string;
  timestamp: Date;
}

/**
 * Typing indicator event
 */
export interface TypingEvent {
  bookingId: string;
  userId: string;
}

/**
 * Server-to-client event definitions
 * Events emitted by the server to the client
 */
export interface ServerToClientEvents {
  /** Booking status changed for customer/provider */
  'booking:status_changed': (data: BookingEvent) => void;

  /** New booking request sent to provider */
  'booking:new_request': (data: { booking: BookingEvent; providerId: string }) => void;

  /** Booking was confirmed */
  'booking:confirmed': (data: BookingEvent) => void;

  /** Booking was cancelled */
  'booking:cancelled': (data: BookingEvent) => void;

  /** Booking was completed */
  'booking:completed': (data: BookingEvent) => void;

  /** Booking reminder notification */
  'booking:reminder': (data: { bookingId: string; minutesUntil: number }) => void;

  /** New notification received */
  'notification:new': (data: NotificationEvent) => void;

  /** Notification marked as read */
  'notification:read': (data: { notificationId: string }) => void;

  /** New chat message in booking */
  'message:new': (data: MessageEvent) => void;

  /** Message read receipt */
  'message:read': (data: { bookingId?: string; messageId?: string; roomId?: string }) => void;

  /** Booking chat message (alias) */
  'booking:message': (data: MessageEvent) => void;

  /** Provider location update during booking */
  'booking:provider_location': (data: { bookingId: string; latitude: number; longitude: number; timestamp?: Date }) => void;

  /** Socket connected and authenticated */
  'connected': (data: { socketId: string }) => void;

  /** General socket error */
  'error': (data: { message: string }) => void;

  /** Socket unauthorized - token invalid or expired */
  'unauthorized': () => void;

  /** User started typing in booking chat */
  'typing:start': (data: TypingEvent) => void;

  /** User stopped typing in booking chat */
  'typing:stop': (data: TypingEvent) => void;

  // Provider status events (Admin -> Provider)
  /** Provider account approved */
  'provider:approved': (data: { providerId: string; verifiedAt: Date }) => void;

  /** Provider account rejected */
  'provider:rejected': (data: { providerId: string; reason: string; canAppeal: boolean }) => void;

  /** Provider account suspended */
  'provider:suspended': (data: { providerId: string; reason: string; until?: Date }) => void;

  /** Provider document verified/rejected */
  'provider:document_verified': (data: {
    providerId: string;
    documentId: string;
    status: 'approved' | 'rejected';
    notes?: string;
  }) => void;

  /** Provider KYC verification completed */
  'provider:verification_complete': (data: { providerId: string; kycLevel: number }) => void;

  // Service status events (Admin -> Provider)
  /** Service approved by admin */
  'service:approved': (data: { serviceId: string; providerId: string }) => void;

  /** Service rejected by admin */
  'service:rejected': (data: { serviceId: string; providerId: string; reason: string }) => void;

  // Review moderation events (Admin -> Provider/Customer)
  /** Review moderated by admin */
  'review:moderated': (data: {
    reviewId: string;
    providerId?: string;
    customerId?: string;
    action: 'approved' | 'hidden' | 'rejected';
    rating?: number;
    reason?: string;
    timestamp: Date;
  }) => void;

  /** Service status changed (emitted to admins when service status changes) */
  'service:status_changed': (data: {
    serviceId: string;
    providerId: string;
    serviceName: string;
    status: string;
  }) => void;

  // Admin notification events (Provider -> Admin)
  /** New provider submitted for approval */
  'admin:new_provider_submission': (data: {
    providerId: string;
    providerName: string;
    submittedAt: Date;
  }) => void;

  /** New service pending admin approval */
  'admin:new_service_pending': (data: {
    serviceId: string;
    providerId: string;
    serviceName: string;
  }) => void;

  // Dispute events
  /** New dispute filed */
  'dispute:new': (data: {
    disputeId: string;
    bookingId: string;
    disputeNumber: string;
    category: string;
    priority: string;
  }) => void;

  /** Dispute resolved */
  'dispute:resolved': (data: { disputeId: string; resolution: string; resolutionType: string }) => void;

  // Withdrawal events (Admin -> Provider)
  /** New withdrawal request submitted to admin */
  'admin:new_withdrawal_request': (data: {
    withdrawalId: string;
    providerId: string;
    providerName: string;
    amount: number;
    currency: string;
    requestedAt: Date;
  }) => void;

  /** Withdrawal is pending processing */
  'withdrawal:pending': (data: {
    withdrawalId: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
  }) => void;

  /** Withdrawal approved */
  'withdrawal:approved': (data: {
    withdrawalId: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
    processedAt: string;
  }) => void;

  /** Withdrawal rejected */
  'withdrawal:rejected': (data: {
    withdrawalId: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
    reason: string;
    rejectedAt: string;
  }) => void;

  // Built-in Socket.IO events
  /** Socket disconnected from server */
  'disconnect': (data: { reason: string }) => void;

  // Chat events (from chat handler)
  /** Chat room joined */
  'chat:room_joined': (data: { chatRoomId: string }) => void;
  /** Chat room left */
  'chat:room_left': (data: { chatRoomId: string }) => void;
  /** Chat message new */
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
  /** Chat message read */
  'chat:message_read': (data: {
    chatRoomId: string;
    userId: string;
    messageIds?: string[];
    readAt: Date;
  }) => void;
}

/**
 * Client-to-server event definitions
 * Events emitted by the client to the server
 */
export interface ClientToServerEvents {
  /** Join user's personal notification room */
  'join:user_room': (userId: string) => void;

  /** Leave user's personal notification room */
  'leave:user_room': (userId: string) => void;

  /** Join booking's chat room */
  'join:booking_room': (bookingId: string) => void;

  /** Leave booking's chat room */
  'leave:booking_room': (bookingId: string) => void;

  /** Start typing indicator in booking chat */
  'typing:start': (data: { bookingId: string }) => void;

  /** Stop typing indicator in booking chat */
  'typing:stop': (data: { bookingId: string }) => void;
}

// Typed socket instance
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// =============================================================================
// Reconnection Configuration
// =============================================================================

/**
 * Reconnection backoff configuration
 * Uses exponential backoff with jitter to prevent thundering herd
 */
interface ReconnectionConfig {
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Backoff multiplier */
  multiplier: number;
  /** Random jitter factor (0-1) */
  jitter: number;
  /** Maximum number of reconnection attempts */
  maxAttempts: number;
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 1.5,
  jitter: 0.3,
  maxAttempts: 10,
};

// =============================================================================
// SocketService Class
// =============================================================================

/**
 * SocketService - Manages Socket.IO connection with typed events
 *
 * Features:
 * - Automatic authentication via JWT token
 * - Exponential backoff reconnection
 * - Event subscription with automatic cleanup
 * - Connection state management
 * - Dead letter queue for failed events
 *
 * @example
 * ```typescript
 * // Subscribe to booking updates
 * const unsubscribe = socketService.onBookingStatusChanged((event) => {
 *   updateBookingUI(event);
 * });
 *
 * // Cleanup on component unmount
 * unsubscribe();
 * ```
 */
class SocketService {
  /** Socket.IO socket instance */
  private socket: TypedSocket | null = null;

  /** Current reconnection attempt count */
  private reconnectAttempts = 0;

  /** User-defined event listeners */
  private listeners: Map<string, Set<Function>> = new Map();

  /** Flag to prevent concurrent connection attempts */
  private isConnecting = false;

  /** Flag to prevent duplicate listener registration */
  private listenersSetup = false;

  /** Reconnection configuration */
  private reconnectionConfig: ReconnectionConfig;

  /** Current effective reconnect delay */
  private currentReconnectDelay: number;

  /** Timeout for reconnection attempt */
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Pending events for retry after reconnection */
  private pendingEvents: Array<{ event: string; data: unknown }> = [];

  /** Maximum pending events to queue */
  private readonly MAX_PENDING_EVENTS = 50;

  /** Connection start time for tracking */
  private connectionStartTime: number = 0;

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.reconnectionConfig = { ...DEFAULT_RECONNECTION_CONFIG, ...config };
    this.currentReconnectDelay = this.reconnectionConfig.initialDelay;
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Calculate next reconnection delay with exponential backoff and jitter
   *
   * FIX #4: Implements proper exponential backoff to prevent server overload
   * during network issues or server restarts.
   */
  private calculateNextDelay(): number {
    const { initialDelay, maxDelay, multiplier, jitter } = this.reconnectionConfig;

    // Calculate exponential delay
    const exponentialDelay = Math.min(
      initialDelay * Math.pow(multiplier, this.reconnectAttempts),
      maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitterRange = exponentialDelay * jitter;
    const jitterOffset = (Math.random() * 2 - 1) * jitterRange;

    return Math.round(Math.min(exponentialDelay + jitterOffset, maxDelay));
  }

  /**
   * Reset reconnection state after successful connection
   */
  private resetReconnectionState(): void {
    this.reconnectAttempts = 0;
    this.currentReconnectDelay = this.reconnectionConfig.initialDelay;
    this.connectionStartTime = Date.now();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Get the Socket.IO server URL
   * FIX #12: Added SSR guard for import.meta.env access
   */
  private getSocketUrl(): string {
    // SSR guard: Only access environment variables in browser
    if (typeof import.meta === 'undefined') {
      return 'http://localhost:5000';
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    // Remove /api suffix if present
    return apiUrl.replace(/\/api$/, '');
  }

  /**
   * Get authentication token from secure storage
   * FIX #12: Added SSR guard for secureStorage access
   */
  private getToken(): string | null {
    // SSR guard: Only access storage in browser
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const stored = secureStorage.getItem('auth-storage');
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored);
      return parsed?.state?.tokens?.accessToken ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Extract user ID from JWT token payload
   */
  private getUserIdFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || '';
    } catch {
      console.error('[SocketService] Failed to parse JWT token');
      return '';
    }
  }

  /**
   * Connect to the Socket.IO server
   *
   * FIX #1: Fixed type mismatches between client and server event definitions
   * FIX #4: Added exponential backoff reconnection handling
   */
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Already connected
      if (this.socket?.connected) {
        resolve(this.socket.id || '');
        return;
      }

      // Already attempting to connect
      if (this.isConnecting) {
        resolve('');
        return;
      }

      this.isConnecting = true;
      const token = this.getToken();

      if (!token) {
        this.isConnecting = false;
        reject(new Error('No authentication token available'));
        return;
      }

      const url = this.getSocketUrl();

      this.socket = io(url, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.reconnectionConfig.maxAttempts,
        reconnectionDelay: this.reconnectionConfig.initialDelay,
        reconnectionDelayMax: this.reconnectionConfig.maxDelay,
        timeout: 20000,
      });

      // -------------------------------------------------------------------------
      // Connection Event Handlers
      // -------------------------------------------------------------------------

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected:', this.socket?.id);
        this.isConnecting = false;
        this.resetReconnectionState();
        this.notifyListeners('connected', { socketId: this.socket?.id });

        // Join user's room
        this.emit('join:user_room', this.getUserIdFromToken(token));

        // Flush pending events
        this.flushPendingEvents();

        resolve(this.socket?.id || '');
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('[SocketService] Disconnected:', reason);
        this.notifyListeners('disconnect', { reason });

        // FIX #6: Handle reconnection state tracking
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          // Intentional disconnect - don't auto-reconnect
          return;
        }

        // Unexpected disconnect - schedule reconnection with backoff
        this.scheduleReconnect();
      });

      this.socket.on('connect_error', (error: Error) => {
        this.isConnecting = false;
        this.reconnectAttempts++;
        console.error('[SocketService] Connection error:', error.message);

        // FIX #6: Exponential backoff for reconnection
        this.currentReconnectDelay = this.calculateNextDelay();
        console.log(
          `[SocketService] Reconnecting in ${this.currentReconnectDelay}ms (attempt ${this.reconnectAttempts})`
        );

        this.notifyListeners('connect_error', { error: error.message });

        if (this.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
          reject(new Error(`Failed to connect after ${this.reconnectionConfig.maxAttempts} attempts`));
        } else {
          reject(error);
        }
      });

      this.socket.on('unauthorized', () => {
        console.error('[SocketService] Unauthorized - token may be invalid or expired');
        this.disconnect();
        this.notifyListeners('unauthorized', {});
      });

      this.socket.on('error', (data: { message: string }) => {
        console.error('[SocketService] Server error:', data.message);
        this.notifyListeners('error', data);
      });

      // Setup default event forwarding
      this.setupDefaultListeners();
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   *
   * FIX #4: Proper backoff scheduling instead of relying on Socket.IO defaults
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
      console.error(
        `[SocketService] Max reconnection attempts (${this.reconnectionConfig.maxAttempts}) reached`
      );
      this.notifyListeners('connect_error', {
        error: 'Maximum reconnection attempts reached',
      });
      return;
    }

    this.currentReconnectDelay = this.calculateNextDelay();
    console.log(
      `[SocketService] Scheduling reconnect in ${this.currentReconnectDelay}ms (attempt ${this.reconnectAttempts + 1})`
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        console.log('[SocketService] Attempting reconnection...');
        this.socket.connect();
      }
    }, this.currentReconnectDelay);
  }

  /**
   * Flush pending events after reconnection
   *
   * FIX #6: Replay pending events that failed during disconnection
   */
  private flushPendingEvents(): void {
    if (this.pendingEvents.length === 0) return;

    console.log(`[SocketService] Flushing ${this.pendingEvents.length} pending events`);

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    for (const { event, data } of events) {
      try {
        this.emit(event as keyof ClientToServerEvents, data as never);
      } catch (error) {
        console.error('[SocketService] Failed to flush event:', event, error);
      }
    }
  }

  /**
   * Queue event for retry if connection is lost
   *
   * FIX #6: Event queueing for unreliable connections
   */
  private queuePendingEvent(event: string, data: unknown): void {
    if (this.pendingEvents.length >= this.MAX_PENDING_EVENTS) {
      // Remove oldest event
      this.pendingEvents.shift();
    }
    this.pendingEvents.push({ event, data });
  }

  /**
   * Disconnect from the Socket.IO server
   *
   * FIX #1: Proper cleanup of all listeners to prevent memory leaks
   */
  disconnect(): void {
    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      // Remove all listeners to prevent memory leaks
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear internal listeners map
    this.listeners.clear();

    // Reset flags
    this.listenersSetup = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    console.log('[SocketService] Disconnected and cleaned up');
  }

  /**
   * Manually trigger reconnection
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  // ---------------------------------------------------------------------------
  // Event Emission
  // ---------------------------------------------------------------------------

  /**
   * Emit event to server with queueing support
   *
   * FIX #11: Better error handling and logging for emit failures
   */
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ): void {
    if (!this.socket) {
      console.warn(`[SocketService] Cannot emit ${event}: socket not initialized`);
      return;
    }

    if (this.socket.connected) {
      try {
        // Use type assertion for emit - Socket.IO's typed emit signature is complex
        (this.socket as unknown as { emit: (event: string, data: unknown) => void }).emit(event, data);
        console.debug(`[SocketService] Emitted: ${event}`);
      } catch (error) {
        console.error(`[SocketService] Emit error for ${event}:`, error);
        // Queue for retry
        this.queuePendingEvent(event, data);
      }
    } else {
      // Queue event for when connection is restored
      console.debug(`[SocketService] Queuing event for later: ${event}`);
      this.queuePendingEvent(event, data);
    }
  }

  /**
   * Emit event with acknowledgment callback
   *
   * FIX #6: Added acknowledgment support for reliable event delivery
   */
  emitWithAck<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0],
    timeout: number = 5000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Acknowledgment timeout for ${event}`));
      }, timeout);

      // Use type assertion for emit with ack
      (this.socket as unknown as {
        emit: (event: string, data: unknown, ack: (ack: unknown) => void) => void;
      }).emit(event, data, (ack: unknown) => {
        clearTimeout(timeoutId);
        resolve(ack);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Room Management
  // ---------------------------------------------------------------------------

  /**
   * Join a booking's chat room for real-time updates
   */
  joinBookingRoom(bookingId: string): void {
    this.emit('join:booking_room', bookingId);
  }

  /**
   * Leave a booking's chat room
   */
  leaveBookingRoom(bookingId: string): void {
    this.emit('leave:booking_room', bookingId);
  }

  // ---------------------------------------------------------------------------
  // Typing Indicators
  // ---------------------------------------------------------------------------

  /**
   * Send typing start indicator
   *
   * FIX #9: Implemented missing typing indicator support
   */
  startTyping(bookingId: string): void {
    this.emit('typing:start', { bookingId });
  }

  /**
   * Send typing stop indicator
   */
  stopTyping(bookingId: string): void {
    this.emit('typing:stop', { bookingId });
  }

  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to an event with automatic cleanup support
   *
   * Returns an unsubscribe function that should be called
   * when the listener is no longer needed.
   */
  on<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback as Function);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as Function);
    };
  }

  /**
   * Subscribe to an event only once
   */
  once<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): void {
    if (this.socket) {
      // Socket.IO's typed once has complex generics, use untyped version
      (this.socket as unknown as { once: (event: string, callback: Function) => void }).once(event, callback);
    }
  }

  /**
   * Remove a specific event listener
   */
  off<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): void {
    this.listeners.get(event)?.delete(callback as Function);
  }

  /**
   * Notify all listeners of an event
   *
   * FIX #1: Proper error handling to prevent one listener
   * from breaking others
   */
  private notifyListeners(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    for (const callback of listeners) {
      try {
        (callback as Function)(data);
      } catch (error) {
        console.error(`[SocketService] Listener error for ${event}:`, error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Default Event Listeners Setup
  // ---------------------------------------------------------------------------

  /**
   * Setup default event listeners that forward server events
   *
   * FIX #3: Fixed missing disconnect event handler
   * FIX #10: Fixed event naming consistency
   */
  private setupDefaultListeners(): void {
    if (!this.socket) return;

    // Prevent duplicate listener registration
    if (this.listenersSetup) {
      return;
    }
    this.listenersSetup = true;

    // Built-in connection events
    this.socket.on('connected', (data) => {
      this.notifyListeners('connected', data);
    });

    this.socket.on('disconnect', (reason) => {
      this.notifyListeners('disconnect', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.notifyListeners('connect_error', { error: error.message });
    });

    // Booking events
    this.socket.on('booking:status_changed', (data) => {
      this.notifyListeners('booking:status_changed', data);
    });

    this.socket.on('booking:new_request', (data) => {
      this.notifyListeners('booking:new_request', data);
    });

    this.socket.on('booking:confirmed', (data) => {
      this.notifyListeners('booking:confirmed', data);
    });

    this.socket.on('booking:cancelled', (data) => {
      this.notifyListeners('booking:cancelled', data);
    });

    this.socket.on('booking:completed', (data) => {
      this.notifyListeners('booking:completed', data);
    });

    this.socket.on('booking:reminder', (data) => {
      this.notifyListeners('booking:reminder', data);
    });

    // Notification events
    this.socket.on('notification:new', (data) => {
      this.notifyListeners('notification:new', data);
    });

    this.socket.on('notification:read', (data) => {
      this.notifyListeners('notification:read', data);
    });

    // Message events
    this.socket.on('message:new', (data) => {
      this.notifyListeners('message:new', data);
    });

    // Booking-focused message events (from chat handler)
    this.socket.on('booking:message', (data) => {
      this.notifyListeners('message:new', {
        bookingId: data.bookingId,
        message: data.message,
        senderId: data.senderId,
        timestamp: data.timestamp
      });
    });

    // Chat room events
    this.socket.on('chat:room_joined', (data) => {
      this.notifyListeners('chat:room_joined', data);
    });

    this.socket.on('chat:room_left', (data) => {
      this.notifyListeners('chat:room_left', data);
    });

    this.socket.on('chat:new_message', (data) => {
      this.notifyListeners('message:new', data);
    });

    this.socket.on('chat:message_read', (data) => {
      this.notifyListeners('message:read', data);
    });

    // Typing events - FIX #9: Proper typing for typing events
    this.socket.on('typing:start', (data: TypingEvent) => {
      this.notifyListeners('typing:start', data);
    });

    this.socket.on('typing:stop', (data: TypingEvent) => {
      this.notifyListeners('typing:stop', data);
    });

    // Provider status events
    this.socket.on('provider:approved', (data) => {
      this.notifyListeners('provider:approved', data);
    });

    this.socket.on('provider:rejected', (data) => {
      this.notifyListeners('provider:rejected', data);
    });

    this.socket.on('provider:suspended', (data) => {
      this.notifyListeners('provider:suspended', data);
    });

    this.socket.on('provider:document_verified', (data) => {
      this.notifyListeners('provider:document_verified', data);
    });

    this.socket.on('provider:verification_complete', (data) => {
      this.notifyListeners('provider:verification_complete', data);
    });

    // Service status events
    this.socket.on('service:approved', (data) => {
      this.notifyListeners('service:approved', data);
    });

    this.socket.on('service:rejected', (data) => {
      this.notifyListeners('service:rejected', data);
    });

    // Review moderation events
    this.socket.on('review:moderated', (data) => {
      this.notifyListeners('review:moderated', data);
    });

    this.socket.on('service:status_changed', (data) => {
      this.notifyListeners('service:status_changed', data);
    });

    // Admin notification events
    this.socket.on('admin:new_provider_submission', (data) => {
      this.notifyListeners('admin:new_provider_submission', data);
    });

    this.socket.on('admin:new_service_pending', (data) => {
      this.notifyListeners('admin:new_service_pending', data);
    });

    // Dispute events
    this.socket.on('dispute:new', (data) => {
      this.notifyListeners('dispute:new', data);
    });

    this.socket.on('dispute:resolved', (data) => {
      this.notifyListeners('dispute:resolved', data);
    });

    // Withdrawal events - FIX #10: Consistent naming with providerId
    this.socket.on('admin:new_withdrawal_request', (data) => {
      this.notifyListeners('admin:new_withdrawal_request', data);
    });

    this.socket.on('withdrawal:pending', (data) => {
      this.notifyListeners('withdrawal:pending', data);
    });

    this.socket.on('withdrawal:approved', (data) => {
      this.notifyListeners('withdrawal:approved', data);
    });

    this.socket.on('withdrawal:rejected', (data) => {
      this.notifyListeners('withdrawal:rejected', data);
    });
  }

  // ---------------------------------------------------------------------------
  // Connection State
  // ---------------------------------------------------------------------------

  /**
   * Check if socket is currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get current socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get connection uptime in milliseconds
   */
  getConnectionUptime(): number {
    if (!this.connectionStartTime) return 0;
    return Date.now() - this.connectionStartTime;
  }

  /**
   * Get reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // ---------------------------------------------------------------------------
  // Convenience Event Subscribers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to new notifications
   */
  onNewNotification(callback: (data: NotificationEvent) => void): () => void {
    return this.on('notification:new', callback);
  }

  /**
   * Subscribe to booking status changes
   */
  onBookingStatusChanged(callback: (data: BookingEvent) => void): () => void {
    return this.on('booking:status_changed', callback);
  }

  // ---------------------------------------------------------------------------
  // Provider Event Subscribers
  // ---------------------------------------------------------------------------

  onProviderApproved(
    callback: (data: { providerId: string; verifiedAt: Date }) => void
  ): () => void {
    return this.on('provider:approved', callback);
  }

  onProviderRejected(
    callback: (data: { providerId: string; reason: string; canAppeal: boolean }) => void
  ): () => void {
    return this.on('provider:rejected', callback);
  }

  onProviderSuspended(
    callback: (data: { providerId: string; reason: string; until?: Date }) => void
  ): () => void {
    return this.on('provider:suspended', callback);
  }

  onDocumentVerified(
    callback: (data: {
      providerId: string;
      documentId: string;
      status: 'approved' | 'rejected';
      notes?: string;
    }) => void
  ): () => void {
    return this.on('provider:document_verified', callback);
  }

  onVerificationComplete(
    callback: (data: { providerId: string; kycLevel: number }) => void
  ): () => void {
    return this.on('provider:verification_complete', callback);
  }

  // ---------------------------------------------------------------------------
  // Service Event Subscribers
  // ---------------------------------------------------------------------------

  onServiceApproved(
    callback: (data: { serviceId: string; providerId: string }) => void
  ): () => void {
    return this.on('service:approved', callback);
  }

  onServiceRejected(
    callback: (data: { serviceId: string; providerId: string; reason: string }) => void
  ): () => void {
    return this.on('service:rejected', callback);
  }

  onServiceStatusChanged(
    callback: (data: {
      serviceId: string;
      providerId: string;
      serviceName: string;
      status: string;
    }) => void
  ): () => void {
    return this.on('service:status_changed', callback);
  }

  // ---------------------------------------------------------------------------
  // Admin Event Subscribers
  // ---------------------------------------------------------------------------

  onNewProviderSubmission(
    callback: (data: { providerId: string; providerName: string; submittedAt: Date }) => void
  ): () => void {
    return this.on('admin:new_provider_submission', callback);
  }

  onNewServicePending(
    callback: (data: { serviceId: string; providerId: string; serviceName: string }) => void
  ): () => void {
    return this.on('admin:new_service_pending', callback);
  }

  // ---------------------------------------------------------------------------
  // Dispute Event Subscribers
  // ---------------------------------------------------------------------------

  onNewDispute(
    callback: (data: {
      disputeId: string;
      bookingId: string;
      disputeNumber: string;
      category: string;
      priority: string;
    }) => void
  ): () => void {
    return this.on('dispute:new', callback);
  }

  onDisputeResolved(
    callback: (data: { disputeId: string; resolution: string; resolutionType: string }) => void
  ): () => void {
    return this.on('dispute:resolved', callback);
  }

  // ---------------------------------------------------------------------------
  // Withdrawal Event Subscribers
  // ---------------------------------------------------------------------------

  onNewWithdrawalRequest(
    callback: (data: {
      withdrawalId: string;
      providerId: string;
      providerName: string;
      amount: number;
      currency: string;
      requestedAt: Date;
    }) => void
  ): () => void {
    return this.on('admin:new_withdrawal_request', callback);
  }

  onWithdrawalApproved(
    callback: (data: {
      withdrawalId: string;
      providerId: string;
      amount: number;
      currency: string;
      status: string;
      processedAt: string;
    }) => void
  ): () => void {
    return this.on('withdrawal:approved', callback);
  }

  onWithdrawalRejected(
    callback: (data: {
      withdrawalId: string;
      providerId: string;
      amount: number;
      currency: string;
      status: string;
      reason: string;
      rejectedAt: string;
    }) => void
  ): () => void {
    return this.on('withdrawal:rejected', callback);
  }

  onWithdrawalPending(
    callback: (data: {
      withdrawalId: string;
      providerId: string;
      amount: number;
      currency: string;
      status: string;
    }) => void
  ): () => void {
    return this.on('withdrawal:pending', callback);
  }

  // ---------------------------------------------------------------------------
  // Message & Typing Event Subscribers
  // ---------------------------------------------------------------------------

  onNewMessage(callback: (data: MessageEvent) => void): () => void {
    return this.on('message:new', callback);
  }

  onTypingStart(callback: (data: TypingEvent) => void): () => void {
    return this.on('typing:start', callback);
  }

  onTypingStop(callback: (data: TypingEvent) => void): () => void {
    return this.on('typing:stop', callback);
  }

  // ---------------------------------------------------------------------------
  // Connection Lifecycle Event Subscribers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to successful connection
   */
  onConnect(callback: () => void): () => void {
    return this.on('connected', callback as never);
  }

  /**
   * Subscribe to connection errors
   * Note: 'connect_error' is a Socket.IO reserved event
   */
  onConnectError(callback: (data: { message: string }) => void): () => void {
    // connect_error is a reserved Socket.IO event, not in our custom interface
    // Use the internal listeners map directly
    const handler = (data: unknown) => {
      const errorData = data as { message?: string };
      callback({ message: errorData?.message || 'Connection error' });
    };

    if (!this.listeners.has('connect_error')) {
      this.listeners.set('connect_error', new Set());
    }
    this.listeners.get('connect_error')?.add(handler);

    return () => {
      this.listeners.get('connect_error')?.delete(handler);
    };
  }

  /**
   * Subscribe to unauthorized events (token expired)
   */
  onUnauthorized(callback: () => void): () => void {
    return this.on('unauthorized', callback as never);
  }

  /**
   * Subscribe to disconnection events
   *
   * FIX #3: Properly handling disconnect built-in event
   */
  onDisconnect(callback: (data: { reason: string }) => void): () => void {
    return this.on('disconnect', callback);
  }

  // ---------------------------------------------------------------------------
  // Aliases for Different Patterns
  // ---------------------------------------------------------------------------

  /**
   * Alias for on() - supports addEventListener pattern
   */
  addListener<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): () => void {
    return this.on(event, callback);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const socketService = new SocketService();

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook to access the socket service
 * @deprecated Use hooks from '@/hooks/useSocket' for React integration
 */
export const useSocket = () => {
  return socketService;
};

/**
 * Hook to subscribe to socket events in React components
 *
 * @deprecated Import from '@/hooks/useSocket' for proper React integration
 *
 * @example
 * ```typescript
 * // Preferred: Import from hooks/useSocket
 * import { useSocketEvent } from '@/hooks/useSocket';
 *
 * function MyComponent() {
 *   useSocketEvent('booking:status_changed', (data) => {
 *     console.log('Status changed:', data.status);
 *   });
 * }
 * ```
 */
export const useSocketEvent = <K extends keyof ServerToClientEvents>(
  _event: K,
  _callback: ServerToClientEvents[K]
): void => {
  console.warn('[useSocketEvent] Deprecated - import useSocketEvent from @/hooks/useSocket for proper React integration');
};

export default socketService;
