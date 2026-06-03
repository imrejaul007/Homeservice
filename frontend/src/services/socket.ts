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
 * Chat room typing event
 */
export interface ChatTypingEvent {
  chatRoomId: string;
  userId: string;
  userName?: string;
}

/**
 * Chat message event from server
 */
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

/**
 * Message read event
 */
export interface MessageReadEvent {
  chatRoomId: string;
  userId: string;
  messageIds?: string[];
  readAt: Date;
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

  /**
   * Provider location update during active booking
   * Emitted when a provider starts tracking to a booking location
   * NOTE: This event is emitted by backend when providerLocation tracking is enabled
   */
  'booking:provider_location': (data: {
    bookingId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    etaMinutes?: number;
    distanceRemaining?: number;
    timestamp?: Date;
  }) => void;

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

  // Chat events
  /** Chat room joined */
  'chat:room_joined': (data: { chatRoomId: string }) => void;

  /** Chat room left */
  'chat:room_left': (data: { chatRoomId: string }) => void;

  /** New chat message received */
  'chat:message:new': (data: ChatMessageEvent) => void;

  // FIX #3: Add type definition for chat:new_message event (alternative event name from backend)
  /** Alternative event for new chat message (backend may emit this) */
  'chat:new_message': (data: ChatMessageEvent) => void;

  /** Chat message delivered */
  'chat:message:delivered': (data: { messageId: string; chatRoomId: string; deliveredAt: Date }) => void;

  /** Chat message read */
  'chat:message:read': (data: MessageReadEvent) => void;

  /** Chat message deleted */
  'chat:message:deleted': (data: { chatRoomId: string; messageId: string }) => void;

  /** User started typing in chat */
  'chat:typing:start': (data: ChatTypingEvent) => void;

  /** User stopped typing in chat */
  'chat:typing:stop': (data: ChatTypingEvent) => void;

  /** User online status */
  'chat:presence:online': (data: { userId: string }) => void;

  /** User offline status */
  'chat:presence:offline': (data: { userId: string }) => void;

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

  /** Service submitted for review by provider */
  'service:pending_review': (data: { serviceId: string; serviceName: string; previousStatus: string; newStatus: string; timestamp: Date }) => void;

  /** Service category changed by admin */
  'service:category_changed': (data: { serviceId: string; providerId: string; serviceName: string; oldCategory: string; newCategory: string; timestamp: Date }) => void;

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

  /** New review submitted by customer */
  'review:new': (data: {
    reviewId: string;
    bookingId: string;
    bookingNumber: string;
    providerId: string;
    customerId: string;
    customerName: string;
    rating: number;
    comment?: string;
    serviceName?: string;
    timestamp: Date;
  }) => void;

  // FIX #8: Add type definition for review:visible event
  /** Review visibility changed by admin - notifies dashboard when review becomes visible */
  'review:visible': (data: {
    reviewId: string;
    customerId: string;
    providerId?: string;
    rating: number;
    visible: boolean;
    timestamp: Date;
  }) => void;

  // FIX #6: Add type definition for user:status_changed event
  /** User account status changed by admin */
  'user:status_changed': (data: {
    userId: string;
    status: 'active' | 'suspended' | 'banned';
    reason?: string;
    timestamp: Date;
  }) => void;

  // FIX #5: Add type definition for user:account_locked event
  /** User account locked by admin */
  'user:account_locked': (data: {
    userId: string;
    reason: string;
    until?: Date;
    timestamp: Date;
  }) => void;

  // FIX #6: Add type definition for booking:admin_updated event
  /** Booking updated by admin */
  'booking:admin_updated': (data: {
    bookingId: string;
    bookingNumber: string;
    status: string;
    updatedBy: 'admin';
    reason?: string;
    timestamp: Date;
  }) => void;

  // FIX #7: Add type definition for services:batch_completed event
  /** Batch service operation completed */
  'services:batch_completed': (data: {
    providerIds: string[];
    serviceIds: string[];
    affectedCount: number;
    action: 'approved' | 'rejected';
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

  // Payment events
  /** Payment completed - updates earnings in real-time for provider */
  'payment:completed': (data: {
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    transactionId: string;
    paidAt: Date;
    customerId: string;
    providerId: string;
  }) => void;

  /** Payment refunded */
  'payment:refunded': (data: {
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    refundedAt: Date;
    customerId: string;
  }) => void;

  /** Invoice status changed */
  'invoice:status_changed': (data: {
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    previousStatus: string;
    userId: string;
  }) => void;

  // Wallet events
  /** Wallet balance updated in real-time */
  'wallet:balance_updated': (data: {
    userId: string;
    balance: number;
    pendingBalance: number;
    totalEarned: number;
    currency: string;
    timestamp: Date;
  }) => void;

  // Earnings events
  /** Provider earnings credited - real-time update for provider wallet */
  'earnings:credited': (data: {
    earningsId: string;
    providerId: string;
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    type: 'service' | 'tip' | 'bonus' | 'adjustment';
    newBalance: number;
    previousBalance: number;
    creditedAt: Date;
  }) => void;

  // Ad status events
  /** Ad status changed */
  'ad:status_changed': (data: {
    adId: string;
    providerId: string;
    adName: string;
    previousStatus: string;
    newStatus: string;
    timestamp: Date;
  }) => void;

  /** Ad budget exhausted */
  'ad:budget_exhausted': (data: {
    adId: string;
    providerId: string;
    adName: string;
    reason: 'daily' | 'total' | 'monthly';
    timestamp: Date;
  }) => void;

  /** Ad approval status changed */
  'ad:approval_status_changed': (data: {
    adId: string;
    providerId: string;
    adName: string;
    previousStatus: string;
    newStatus: string;
    notes?: string;
    timestamp: Date;
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

  /** Join chat room */
  'join:chat_room': (chatRoomId: string) => void;

  /** Leave chat room */
  'leave:chat_room': (chatRoomId: string) => void;

  /** Send chat message */
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

  /** Mark messages as read */
  'mark:read': (data: { chatRoomId: string; messageIds?: string[] }) => void;

  /** Start typing indicator in booking chat */
  'typing:start': (data: { bookingId: string }) => void;

  /** Stop typing indicator in booking chat */
  'typing:stop': (data: { bookingId: string }) => void;

  /** Start typing in chat room */
  'chat:typing:start': (data: { chatRoomId: string }) => void;

  /** Stop typing in chat room */
  'chat:typing:stop': (data: { chatRoomId: string }) => void;
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

      // Use type assertion for built-in Socket.IO events
      (this.socket as unknown as { on: Function }).on('disconnect', (reason: string) => {
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
        // Issue #15: Implement automatic token refresh and reconnection when socket receives unauthorized
        this.disconnect();
        this.notifyListeners('unauthorized', {});

        // Trigger token refresh flow - the auth store should handle token refresh
        // Components listening to 'unauthorized' can redirect to login or refresh token
        const stored = secureStorage.getItem('auth-storage');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Emit a custom event that auth store or components can listen to for token refresh
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('socket:unauthorized', {
                detail: { shouldRefreshToken: true }
              }));
            }
          } catch {
            // Invalid stored data - user needs to re-login
          }
        }
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
  // Chat Room Methods
  // ---------------------------------------------------------------------------

  /**
   * Join a chat room to receive messages
   */
  joinChatRoom(chatRoomId: string): void {
    this.emit('join:chat_room', chatRoomId);
  }

  /**
   * Leave a chat room to stop receiving messages
   */
  leaveChatRoom(chatRoomId: string): void {
    this.emit('leave:chat_room', chatRoomId);
  }

  /**
   * Send a chat message
   */
  sendMessage(data: {
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
  }): void {
    this.emit('send:message', data);
  }

  /**
   * Mark messages as read in a chat room
   */
  markMessagesRead(chatRoomId: string, messageIds?: string[]): void {
    this.emit('mark:read', { chatRoomId, messageIds });
  }

  /**
   * Send typing indicator in chat room
   */
  startChatTyping(chatRoomId: string): void {
    this.emit('chat:typing:start', { chatRoomId });
  }

  /**
   * Stop typing indicator in chat room
   */
  stopChatTyping(chatRoomId: string): void {
    this.emit('chat:typing:stop', { chatRoomId });
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

    // Use type assertion for built-in Socket.IO events
    (this.socket as unknown as { on: Function }).on('disconnect', (reason: string) => {
      this.notifyListeners('disconnect', { reason });
    });

    (this.socket as unknown as { on: Function }).on('connect_error', (error: { message: string }) => {
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
      // Forward to generic status_changed for unified handling
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:confirmed', data);
    });

    this.socket.on('booking:cancelled', (data) => {
      // Forward to generic status_changed for unified handling
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:cancelled', data);
    });

    this.socket.on('booking:completed', (data) => {
      // Forward to generic status_changed for unified handling
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:completed', data);
    });

    // FIX: Add listeners for specific booking status events
    this.socket.on('booking:accepted', (data) => {
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:accepted', data);
    });

    this.socket.on('booking:rejected', (data) => {
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:rejected', data);
    });

    this.socket.on('booking:started', (data) => {
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:started', data);
    });

    this.socket.on('booking:rescheduled', (data) => {
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:rescheduled', data);
    });

    this.socket.on('booking:no_show', (data) => {
      this.notifyListeners('booking:status_changed', data);
      this.notifyListeners('booking:no_show', data);
    });

    this.socket.on('booking:reminder', (data) => {
      this.notifyListeners('booking:reminder', data);
    });

    // Provider location updates
    this.socket.on('booking:provider_location', (data) => {
      this.notifyListeners('booking:provider_location', data);
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

    // Chat message events - listen on correct event names
    this.socket.on('chat:message:new', (data) => {
      this.notifyListeners('chat:message:new', data);
    });

    this.socket.on('chat:message:read', (data) => {
      this.notifyListeners('chat:message:read', data);
    });

    // Typing events
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

    // FIX: Add listeners for new service events
    this.socket.on('service:pending_review', (data) => {
      this.notifyListeners('service:pending_review', data);
    });

    this.socket.on('service:category_changed', (data) => {
      this.notifyListeners('service:category_changed', data);
    });

    // Review moderation events
    this.socket.on('review:moderated', (data) => {
      this.notifyListeners('review:moderated', data);
    });

    // New review submitted event - notifies provider dashboard in real-time
    this.socket.on('review:new', (data) => {
      this.notifyListeners('review:new', data);
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

    // FIX #1: Add subscription for payment:refunded event
    this.socket.on('payment:refunded', (data) => {
      this.notifyListeners('payment:refunded', data);
    });

    // FIX #2: Add subscription for invoice:status_changed event
    this.socket.on('invoice:status_changed', (data) => {
      this.notifyListeners('invoice:status_changed', data);
    });

    // FIX #4: Add subscription for user:status_changed event
    this.socket.on('user:status_changed', (data) => {
      this.notifyListeners('user:status_changed', data);
    });

    // FIX #5: Add subscription for user:account_locked event
    this.socket.on('user:account_locked', (data) => {
      this.notifyListeners('user:account_locked', data);
    });

    // FIX #6: Add subscription for booking:admin_updated event
    this.socket.on('booking:admin_updated', (data) => {
      this.notifyListeners('booking:admin_updated', data);
    });

    // FIX #7: Add subscription for services:batch_completed event
    this.socket.on('services:batch_completed', (data) => {
      this.notifyListeners('services:batch_completed', data);
    });

    // FIX #8: Add subscription for review:visible event
    this.socket.on('review:visible', (data) => {
      this.notifyListeners('review:visible', data);
    });

    // FIX #3: Add subscription for chat:new_message event (backend emits this, also listening for chat:message:new)
    this.socket.on('chat:new_message', (data) => {
      this.notifyListeners('chat:new_message', data);
    });

    // FIX #16: Add subscription for review:reply event (notifies customer when provider replies)
    this.socket.on('review:reply', (data) => {
      this.notifyListeners('review:reply', data);
    });

    // FIX #17: Add subscription for payment:failed event (notifies users when payment fails)
    this.socket.on('payment:failed', (data) => {
      this.notifyListeners('payment:failed', data);
    });

    // FIX #2: Add subscription for wallet:balance_updated event
    this.socket.on('wallet:balance_updated', (data) => {
      this.notifyListeners('wallet:balance_updated', data);
    });

    // FIX #2: Add subscription for earnings:credited event
    this.socket.on('earnings:credited', (data) => {
      this.notifyListeners('earnings:credited', data);
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

  /**
   * Subscribe to new booking request - notifies provider when a new booking request is created
   */
  onNewBookingRequest(
    callback: (data: { booking: BookingEvent; providerId: string }) => void
  ): () => void {
    return this.on('booking:new_request', callback);
  }

  /**
   * Subscribe to provider location updates during active booking
   */
  onProviderLocation(callback: (data: {
    bookingId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    etaMinutes?: number;
    distanceRemaining?: number;
    timestamp?: Date;
  }) => void): () => void {
    return this.on('booking:provider_location', callback);
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

  onReviewModerated(
    callback: (data: {
      reviewId: string;
      providerId?: string;
      customerId?: string;
      action: 'approved' | 'hidden' | 'rejected';
      rating?: number;
      reason?: string;
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('review:moderated', callback);
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
  // Ad Event Subscribers
  // ---------------------------------------------------------------------------

  onAdStatusChanged(
    callback: (data: {
      adId: string;
      providerId: string;
      adName: string;
      previousStatus: string;
      newStatus: string;
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('ad:status_changed', callback);
  }

  onAdBudgetExhausted(
    callback: (data: {
      adId: string;
      providerId: string;
      adName: string;
      reason: 'daily' | 'total' | 'monthly';
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('ad:budget_exhausted', callback);
  }

  onAdApprovalStatusChanged(
    callback: (data: {
      adId: string;
      providerId: string;
      adName: string;
      previousStatus: string;
      newStatus: string;
      notes?: string;
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('ad:approval_status_changed', callback);
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
  // Payment Event Subscribers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to payment completed event - updates earnings in real-time
   */
  onPaymentCompleted(
    callback: (data: {
      bookingId: string;
      bookingNumber: string;
      amount: number;
      currency: string;
      transactionId: string;
      paidAt: Date;
      customerId: string;
      providerId: string;
    }) => void
  ): () => void {
    return this.on('payment:completed', callback);
  }

  /**
   * Subscribe to earnings credited event - real-time update for provider wallet
   * Notifies provider when earnings are added to their wallet balance
   */
  onEarningsCredited(
    callback: (data: {
      earningsId: string;
      providerId: string;
      bookingId: string;
      bookingNumber: string;
      amount: number;
      currency: string;
      type: 'service' | 'tip' | 'bonus' | 'adjustment';
      newBalance: number;
      previousBalance: number;
      creditedAt: Date;
    }) => void
  ): () => void {
    return this.on('earnings:credited', callback);
  }

  /**
   * Subscribe to payment refunded event - notifies customer when refund is processed
   * FIX #1: Added missing callback for payment:refunded event
   */
  onPaymentRefunded(
    callback: (data: {
      bookingId: string;
      bookingNumber: string;
      amount: number;
      currency: string;
      refundedAt: Date;
      customerId: string;
    }) => void
  ): () => void {
    return this.on('payment:refunded', callback);
  }

  /**
   * Subscribe to invoice status changed event
   * FIX #2: Added missing callback for invoice:status_changed event
   */
  onInvoiceStatusChanged(
    callback: (data: {
      invoiceId: string;
      invoiceNumber: string;
      status: string;
      previousStatus: string;
      userId: string;
    }) => void
  ): () => void {
    return this.on('invoice:status_changed', callback);
  }

  // ---------------------------------------------------------------------------
  // Wallet Event Subscribers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to wallet balance updated event - real-time update for user wallet
   */
  onWalletBalanceUpdated(
    callback: (data: {
      userId: string;
      balance: number;
      pendingBalance: number;
      totalEarned: number;
      currency: string;
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('wallet:balance_updated', callback);
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
  // User Status Event Subscribers
  // ---------------------------------------------------------------------------

  onUserStatusChanged(
    callback: (data: { userId: string; status: 'active' | 'suspended' | 'banned'; reason?: string; timestamp: Date }) => void
  ): () => void {
    return this.on('user:status_changed', callback);
  }

  onUserAccountLocked(
    callback: (data: { userId: string; reason: string; until?: Date; timestamp: Date }) => void
  ): () => void {
    return this.on('user:account_locked', callback);
  }

  // ---------------------------------------------------------------------------
  // Booking Admin Update Event Subscribers
  // ---------------------------------------------------------------------------

  onBookingAdminUpdated(
    callback: (data: { bookingId: string; bookingNumber: string; status: string; updatedBy: 'admin'; reason?: string; timestamp: Date }) => void
  ): () => void {
    return this.on('booking:admin_updated', callback);
  }

  // ---------------------------------------------------------------------------
  // Batch Service Operation Event Subscribers
  // ---------------------------------------------------------------------------

  onServicesBatchCompleted(
    callback: (data: { providerIds: string[]; serviceIds: string[]; affectedCount: number; action: 'approved' | 'rejected'; timestamp: Date }) => void
  ): () => void {
    return this.on('services:batch_completed', callback);
  }

  // ---------------------------------------------------------------------------
  // Review Visibility Event Subscribers
  // ---------------------------------------------------------------------------

  onReviewVisible(
    callback: (data: { reviewId: string; customerId: string; providerId?: string; rating: number; visible: boolean; timestamp: Date }) => void
  ): () => void {
    return this.on('review:visible', callback);
  }

  /**
   * Subscribe to new review received event - real-time update for provider dashboard
   * Notifies provider when a customer submits a new review
   */
  onReviewReceived(
    callback: (data: {
      reviewId: string;
      bookingId: string;
      bookingNumber: string;
      providerId: string;
      customerId: string;
      customerName: string;
      rating: number;
      comment?: string;
      serviceName?: string;
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('review:new', callback);
  }

  // ---------------------------------------------------------------------------
  // Insights Update Event Subscribers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to insights dashboard update events
   * Notifies provider when their insights data should be refreshed
   */
  onInsightsUpdated(
    callback: (data: {
      providerId: string;
      reason: 'booking_completed' | 'review_submitted' | 'withdrawal_processed' | 'booking_cancelled';
      affectedMetrics: string[];
      timestamp: Date;
    }) => void
  ): () => void {
    return this.on('insights:updated', callback);
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
  // Chat Event Subscribers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to chat room joined event
   */
  onChatRoomJoined(callback: (data: { chatRoomId: string }) => void): () => void {
    return this.on('chat:room_joined', callback);
  }

  /**
   * Subscribe to chat room left event
   */
  onChatRoomLeft(callback: (data: { chatRoomId: string }) => void): () => void {
    return this.on('chat:room_left', callback);
  }

  /**
   * Subscribe to new chat messages
   */
  onNewChatMessage(callback: (data: ChatMessageEvent) => void): () => void {
    return this.on('chat:message:new', callback);
  }

  /**
   * Subscribe to chat message delivered event
   */
  onChatMessageDelivered(callback: (data: { messageId: string; chatRoomId: string; deliveredAt: Date }) => void): () => void {
    return this.on('chat:message:delivered', callback);
  }

  /**
   * Subscribe to chat message read event
   */
  onChatMessageRead(callback: (data: MessageReadEvent) => void): () => void {
    return this.on('chat:message:read', callback);
  }

  /**
   * Subscribe to chat message deleted event
   */
  onChatMessageDeleted(callback: (data: { chatRoomId: string; messageId: string }) => void): () => void {
    return this.on('chat:message:deleted', callback);
  }

  /**
   * Subscribe to chat typing start event
   */
  onChatTypingStart(callback: (data: ChatTypingEvent) => void): () => void {
    return this.on('chat:typing:start', callback);
  }

  /**
   * Subscribe to chat typing stop event
   */
  onChatTypingStop(callback: (data: ChatTypingEvent) => void): () => void {
    return this.on('chat:typing:stop', callback);
  }

  /**
   * Subscribe to user online presence
   */
  onUserOnline(callback: (data: { userId: string }) => void): () => void {
    return this.on('chat:presence:online', callback);
  }

  /**
   * Subscribe to user offline presence
   */
  onUserOffline(callback: (data: { userId: string }) => void): () => void {
    return this.on('chat:presence:offline', callback);
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
   */
  onDisconnect(callback: (data: { reason: string }) => void): () => void {
    // Use type assertion for built-in Socket.IO events
    if (!this.listeners.has('disconnect')) {
      this.listeners.set('disconnect', new Set());
    }
    this.listeners.get('disconnect')?.add(callback as Function);
    return () => {
      this.listeners.get('disconnect')?.delete(callback as Function);
    };
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
