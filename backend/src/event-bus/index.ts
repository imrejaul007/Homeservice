// Event Bus - Platform-wide event system with subscriptions

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Event Types
export const EVENT_TYPES = {
  // Booking events
  BOOKING_CREATED: 'booking.created',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_COMPLETED: 'booking.completed',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_ACCEPTED: 'booking.accepted',
  BOOKING_REJECTED: 'booking.rejected',
  BOOKING_STARTED: 'booking.started',
  BOOKING_RESCHEDULED: 'booking.rescheduled',

  // Payment events
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_VERIFIED: 'user.verified',

  // Notification events
  NOTIFICATION_CREATED: 'notification.created',

  // Analytics events
  PAGE_VIEW: 'analytics.page_view',
  SEARCH: 'analytics.search',

  // Dispute events
  DISPUTE_CREATED: 'dispute.created',
  DISPUTE_EVIDENCE_ADDED: 'dispute.evidence_added',
  DISPUTE_MESSAGE_ADDED: 'dispute.message_added',
  DISPUTE_ASSIGNED: 'dispute.assigned',
  DISPUTE_ESCALATED: 'dispute.escalated',
  DISPUTE_STATUS_CHANGED: 'dispute.status_changed',
  DISPUTE_RESOLVED: 'dispute.resolved',
  DISPUTE_CLOSED: 'dispute.closed',

  // Refund events
  REFUND_CREATED: 'refund.created',
  REFUND_TRIGGERED: 'refund.triggered',
  REFUND_PROCESSED: 'refund.processed',
  REFUND_COMPLETED: 'refund.completed',
  REFUND_FAILED: 'refund.failed',
  REFUND_CANCELLED: 'refund.cancelled',
  CHARGEBACK_CREATED: 'chargeback.created',

  // Anomaly Detection events
  ANOMALY_DETECTED: 'anomaly.detected',
  ANOMALY_STATUS_CHANGED: 'anomaly.status_changed',
  ANOMALY_RESOLVED: 'anomaly.resolved',

  // Support Ticket events
  TICKET_CREATED: 'support.ticket_created',
  TICKET_ASSIGNED: 'support.ticket_assigned',
  TICKET_STATUS_CHANGED: 'support.ticket_status_changed',
  TICKET_MESSAGE_ADDED: 'support.ticket_message_added',

  // Membership events
  MEMBERSHIP_CREATED: 'membership.created',
  MEMBERSHIP_UPDATED: 'membership.updated',
  MEMBERSHIP_UPGRADE_SUGGESTED: 'membership.upgrade_suggested',
  FEATURED_LISTING_ADDED: 'membership.featured_listing_added',
  FEATURED_LISTING_CANCELLED: 'membership.featured_listing_cancelled',
  BOOKING_PRIORITY_ADDED: 'membership.booking_priority_added',
  CASHBACK_CREDITED: 'membership.cashback_credited',
  DISCOUNT_APPLIED: 'membership.discount_applied',
  REFERRAL_COMPLETED: 'membership.referral_completed',
  CONCIERGE_REQUEST: 'membership.concierge_request',

  // Payout events
  PAYOUT_COMPLETED: 'payout.completed',
  PAYOUT_FAILED: 'payout.failed',

  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',

  // Stream/Analytics events
  STREAM_EVENT: 'stream.event',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// Platform Event interface
export interface PlatformEvent<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: Date;
  data: T;
  metadata?: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

// Event subscription handler
export interface EventSubscription {
  id: string;
  eventType: string | '*';
  handler: (event: PlatformEvent) => Promise<void> | void;
  priority: number;
  createdAt: Date;
}

// Dead letter queue entry
export interface DeadLetterEntry {
  event: PlatformEvent;
  error: string;
  failedAt: Date;
  retryCount: number;
}

class EventBus extends EventEmitter {
  private history: PlatformEvent[] = [];
  private subscriptions: Map<string, EventSubscription> = new Map();
  private deadLetterQueue: DeadLetterEntry[] = [];
  private maxHistorySize = 1000;
  private maxDeadLetterSize = 100;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Publish an event to the bus
   */
  async publish<T>(eventType: string, data: T, metadata?: PlatformEvent['metadata']): Promise<string> {
    const eventId = uuidv4();
    const event: PlatformEvent<T> = {
      eventId,
      eventType,
      timestamp: new Date(),
      data,
      metadata,
    };

    // Store in history
    this.history.push(event as PlatformEvent);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Emit to specific event listeners
    this.emit(eventType, event);

    // Emit to wildcard listeners
    this.emit('*', event);

    // Log the event
    logger.info('Event published', {
      eventId,
      eventType,
      timestamp: event.timestamp,
      action: 'EVENT_PUBLISHED',
    });

    // Process any matching subscriptions asynchronously
    this.processSubscriptions(event).catch((error) => {
      logger.error('Subscription processing failed', {
        eventId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return eventId;
  }

  /**
   * Subscribe to an event type
   */
  subscribe(
    eventType: string | '*',
    handler: (event: PlatformEvent) => Promise<void> | void,
    priority: number = 0
  ): string {
    const subscriptionId = uuidv4();

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      priority,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Sort subscriptions by priority (higher first)
    const sortedSubscriptions = Array.from(this.subscriptions.values())
      .filter((sub) => sub.eventType === eventType || sub.eventType === '*')
      .sort((a, b) => b.priority - a.priority);

    logger.info('Event subscription created', {
      subscriptionId,
      eventType,
      priority,
      totalSubscriptions: sortedSubscriptions.length,
      action: 'SUBSCRIPTION_CREATED',
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);

    if (subscription) {
      this.subscriptions.delete(subscriptionId);

      logger.info('Event subscription removed', {
        subscriptionId,
        eventType: subscription.eventType,
        action: 'SUBSCRIPTION_REMOVED',
      });

      return true;
    }

    return false;
  }

  /**
   * Process event through subscriptions
   */
  private async processSubscriptions(event: PlatformEvent): Promise<void> {
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(
        (sub) =>
          sub.eventType === event.eventType ||
          sub.eventType === '*'
      )
      .sort((a, b) => b.priority - a.priority);

    const errors: Array<{ subscriptionId: string; error: string }> = [];

    for (const subscription of matchingSubscriptions) {
      try {
        await subscription.handler(event);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        errors.push({
          subscriptionId: subscription.id,
          error: errorMessage,
        });

        logger.error('Event subscription handler failed', {
          eventId: event.eventId,
          eventType: event.eventType,
          subscriptionId: subscription.id,
          error: errorMessage,
          action: 'SUBSCRIPTION_HANDLER_FAILED',
        });
      }
    }

    // If all handlers failed, add to dead letter queue
    if (errors.length > 0 && errors.length === matchingSubscriptions.length) {
      this.addToDeadLetterQueue(event, 'All handlers failed');
    }
  }

  /**
   * Add failed event to dead letter queue
   */
  private addToDeadLetterQueue(event: PlatformEvent, error: string): void {
    const entry: DeadLetterEntry = {
      event,
      error,
      failedAt: new Date(),
      retryCount: 0,
    };

    this.deadLetterQueue.push(entry);

    if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
      this.deadLetterQueue.shift();
    }

    logger.warn('Event added to dead letter queue', {
      eventId: event.eventId,
      eventType: event.eventType,
      error,
      deadLetterQueueSize: this.deadLetterQueue.length,
      action: 'DEAD_LETTER_QUEUE_ADDED',
    });
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): PlatformEvent[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string, limit?: number): PlatformEvent[] {
    const events = this.history.filter((e) => e.eventType === eventType);
    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry a dead letter entry
   */
  async retryDeadLetter(entryIndex: number): Promise<boolean> {
    if (entryIndex < 0 || entryIndex >= this.deadLetterQueue.length) {
      return false;
    }

    const entry = this.deadLetterQueue[entryIndex];

    try {
      await this.publish(
        entry.event.eventType,
        entry.event.data,
        entry.event.metadata
      );

      // Remove from dead letter queue
      this.deadLetterQueue.splice(entryIndex, 1);

      logger.info('Dead letter entry retried successfully', {
        eventId: entry.event.eventId,
        eventType: entry.event.eventType,
        action: 'DEAD_LETTER_RETRY_SUCCESS',
      });

      return true;
    } catch (error) {
      entry.retryCount++;
      entry.error = error instanceof Error ? error.message : String(error);
      entry.failedAt = new Date();

      logger.error('Dead letter retry failed', {
        eventId: entry.event.eventId,
        eventType: entry.event.eventType,
        retryCount: entry.retryCount,
        error: entry.error,
        action: 'DEAD_LETTER_RETRY_FAILED',
      });

      return false;
    }
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    const size = this.deadLetterQueue.length;
    this.deadLetterQueue = [];

    logger.info('Dead letter queue cleared', {
      entriesRemoved: size,
      action: 'DEAD_LETTER_QUEUE_CLEARED',
    });
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): { total: number; byEventType: Record<string, number> } {
    const byEventType: Record<string, number> = {};

    for (const subscription of this.subscriptions.values()) {
      byEventType[subscription.eventType] = (byEventType[subscription.eventType] || 0) + 1;
    }

    return {
      total: this.subscriptions.size,
      byEventType,
    };
  }
}

// Create singleton instance
export const eventBus = new EventBus();
export default eventBus;

// ============================================
// Socket Server Integration
// ============================================

/**
 * Get socket emitter functions with lazy loading to avoid circular dependency
 */
async function getSocketEmitter() {
  const socketModule = await import('../socket');
  return {
    getSocketServer: socketModule.getSocketServer,
    emitBookingStatusChange: (data: unknown) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitBookingStatusChange(data as Parameters<typeof socket.emitBookingStatusChange>[0]);
      }
    },
    emitNewBookingRequest: (data: unknown) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitNewBookingRequest(data as Parameters<typeof socket.emitNewBookingRequest>[0]);
      }
    },
    emitNotification: (data: unknown) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitNotification(data as Parameters<typeof socket.emitNotification>[0]);
      }
    },
  };
}

/**
 * Emit socket event safely, handling cases where socket might not be initialized
 */
async function emitSocketSafely<T>(
  emitter: (data: T) => void,
  data: T,
  eventType: string,
  target: string
): Promise<void> {
  try {
    emitter(data);
  } catch (error) {
    logger.warn('Socket emission failed', {
      eventType,
      target,
      error: error instanceof Error ? error.message : String(error),
      action: 'SOCKET_EMISSION_FAILED',
    });
  }
}

// ============================================
// Event Subscriptions Setup
// ============================================

/**
 * Initialize event subscriptions
 * This should be called once when the application starts
 */
export const initializeEventSubscriptions = async (): Promise<void> => {
  const { addJob } = await import('../queue');
  const socketEmitter = await getSocketEmitter();

  // ============================================
  // Analytics Subscription
  // Listen to ALL events and queue for analytics processing
  // ============================================
  eventBus.subscribe('*', async (event) => {
    try {
      // Map platform events to analytics event types
      let analyticsEventType = event.eventType;

      // Convert booking.created -> booking_created for analytics
      analyticsEventType = event.eventType.replace('.', '_');

      await addJob(
        'analytics-queue',
        'process_event',
        {
          eventType: analyticsEventType,
          eventData: event.data as Record<string, unknown>,
          timestamp: event.timestamp.toISOString(),
          sessionId: event.metadata?.sessionId,
          userId: event.metadata?.userId,
        },
        { priority: 10 }
      );
    } catch (error) {
      logger.error('Failed to queue analytics event', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5); // Lower priority - processed after other handlers

  // ============================================
  // Notification Subscription
  // Listen to booking.* events and send push notifications
  // ============================================
  eventBus.subscribe('booking.created', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        customerId?: string;
        providerId?: string;
        bookingNumber?: string;
      };

      // Notify provider about new booking
      if (data.providerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.providerId,
          type: 'booking_new',
          title: 'New Booking Request',
          message: `You have a new booking request #${data.bookingNumber || 'Unknown'}`,
          data: { bookingId: data.bookingId },
        });
      }

      // Notify customer about booking created
      if (data.customerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.customerId,
          type: 'booking_created',
          title: 'Booking Submitted',
          message: `Your booking #${data.bookingNumber || 'Unknown'} has been submitted`,
          data: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      logger.error('Failed to send booking.created notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10); // Higher priority - send immediately

  eventBus.subscribe('booking.confirmed', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        customerId?: string;
        bookingNumber?: string;
      };

      if (data.customerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.customerId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: `Your booking #${data.bookingNumber || 'Unknown'} has been confirmed`,
          data: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      logger.error('Failed to send booking.confirmed notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10);

  eventBus.subscribe('booking.completed', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        customerId?: string;
        providerId?: string;
        bookingNumber?: string;
        totalAmount?: number;
      };

      // Notify customer
      if (data.customerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.customerId,
          type: 'booking_completed',
          title: 'Booking Completed',
          message: `Your booking #${data.bookingNumber || 'Unknown'} has been completed`,
          data: { bookingId: data.bookingId },
        });

        // Award loyalty points to customer (1 point per AED 10 spent)
        if (data.customerId && data.totalAmount) {
          const pointsEarned = Math.floor(data.totalAmount / 10);
          if (pointsEarned > 0) {
            await addJob('loyalty-queue', 'award_points', {
              userId: data.customerId,
              amount: pointsEarned,
              type: 'earned',
              description: `Booking #${data.bookingNumber || data.bookingId} completed`,
              relatedBooking: data.bookingId,
            });

            logger.info('Loyalty points awarded for booking completion', {
              customerId: data.customerId,
              bookingId: data.bookingId,
              pointsEarned,
              totalAmount: data.totalAmount,
            });
          }
        }
      }

      // Notify provider
      if (data.providerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.providerId,
          type: 'booking_completed',
          title: 'Booking Completed',
          message: `Booking #${data.bookingNumber || 'Unknown'} has been marked as completed`,
          data: { bookingId: data.bookingId },
        });
      }
    } catch (error) {
      logger.error('Failed to send booking.completed notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10);

  eventBus.subscribe('booking.cancelled', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        customerId?: string;
        providerId?: string;
        bookingNumber?: string;
        cancelledBy?: string;
      };

      // Notify the other party
      const recipientId = data.cancelledBy === data.customerId ? data.providerId : data.customerId;
      if (recipientId) {
        await addJob('notification-queue', 'send_notification', {
          userId: recipientId,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Booking #${data.bookingNumber || 'Unknown'} has been cancelled`,
          data: { bookingId: data.bookingId, cancelledBy: data.cancelledBy },
        });
      }
    } catch (error) {
      logger.error('Failed to send booking.cancelled notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10);

  eventBus.subscribe('booking.rejected', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        customerId?: string;
        bookingNumber?: string;
        reason?: string;
      };

      if (data.customerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.customerId,
          type: 'booking_rejected',
          title: 'Booking Declined',
          message: `Your booking request #${data.bookingNumber || 'Unknown'} has been declined${data.reason ? `: ${data.reason}` : ''}`,
          data: { bookingId: data.bookingId, reason: data.reason },
        });
      }
    } catch (error) {
      logger.error('Failed to send booking.rejected notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10);

  // ============================================
  // Email Subscription
  // Listen to booking.* events and send email confirmations
  // ============================================
  eventBus.subscribe('booking.created', async (event) => {
    try {
      const data = event.data as {
        customerId?: string;
        customerEmail?: string;
        customerName?: string;
        bookingNumber?: string;
        bookingDetails?: Record<string, unknown>;
      };

      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_confirmation',
          metadata: {
            firstName: data.customerName || 'Customer',
            bookingDetails: data.bookingDetails,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to queue booking.created email', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5);

  eventBus.subscribe('booking.confirmed', async (event) => {
    try {
      const data = event.data as {
        customerId?: string;
        customerEmail?: string;
        customerName?: string;
        bookingNumber?: string;
        bookingDetails?: Record<string, unknown>;
      };

      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_accepted',
          metadata: {
            firstName: data.customerName || 'Customer',
            bookingDetails: data.bookingDetails,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to queue booking.confirmed email', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5);

  eventBus.subscribe('booking.completed', async (event) => {
    try {
      const data = event.data as {
        customerId?: string;
        customerEmail?: string;
        customerName?: string;
        bookingNumber?: string;
        bookingDetails?: Record<string, unknown>;
      };

      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_completed',
          metadata: {
            firstName: data.customerName || 'Customer',
            bookingDetails: data.bookingDetails,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to queue booking.completed email', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5);

  eventBus.subscribe('booking.cancelled', async (event) => {
    try {
      const data = event.data as {
        customerId?: string;
        customerEmail?: string;
        customerName?: string;
        bookingNumber?: string;
        bookingDetails?: Record<string, unknown>;
      };

      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_cancelled',
          metadata: {
            firstName: data.customerName || 'Customer',
            bookingDetails: data.bookingDetails,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to queue booking.cancelled email', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5);

  eventBus.subscribe('booking.rejected', async (event) => {
    try {
      const data = event.data as {
        customerEmail?: string;
        customerName?: string;
        bookingNumber?: string;
        reason?: string;
        bookingDetails?: Record<string, unknown>;
      };

      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_rejected',
          metadata: {
            firstName: data.customerName || 'Customer',
            bookingDetails: data.bookingDetails,
            reason: data.reason,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to queue booking.rejected email', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5);

  // ============================================
  // Search Index Subscription
  // Listen to service/provider changes and update search index
  // ============================================
  eventBus.subscribe('booking.completed', async (event) => {
    try {
      const data = event.data as {
        serviceId?: string;
        providerId?: string;
      };

      // Update search index weights for popular services
      if (data.serviceId) {
        await addJob('search-index-queue', 'update_service', {
          action: 'update',
          entityType: 'service',
          entityId: data.serviceId,
          data: { incrementBookings: true },
        });
      }
    } catch (error) {
      logger.error('Failed to queue search index update', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 3); // Lower priority - not critical

  // ============================================
  // Socket Emission Subscriptions
  // Real-time WebSocket events for connected clients
  // ============================================

  // Socket: Emit new booking request to provider
  eventBus.subscribe('booking.created', async (event) => {
    try {
      const data = event.data as {
        _id?: string;
        id?: string;
        bookingNumber?: string;
        status?: string;
        providerId?: string;
      };

      // Transform data to match socket method signature
      const bookingData = {
        _id: (data._id || data.id) as string,
        bookingNumber: data.bookingNumber || '',
        status: data.status || 'pending',
        providerId: data.providerId as string,
      };

      if (bookingData._id && bookingData.providerId) {
        socketEmitter.emitNewBookingRequest(bookingData);
        logger.debug('Socket: Emitted new booking request', {
          bookingId: bookingData._id,
          providerId: bookingData.providerId,
          action: 'SOCKET_BOOKING_CREATED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit new booking request', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15); // Higher priority - immediate real-time delivery

  // Socket: Emit booking status change to customer and provider
  const statusChangeEvents = [
    'booking.confirmed',
    'booking.completed',
    'booking.cancelled',
    'booking.accepted',
    'booking.rejected',
    'booking.started',
    'booking.rescheduled',
  ];

  for (const statusEvent of statusChangeEvents) {
    eventBus.subscribe(statusEvent, async (event) => {
      try {
        const data = event.data as {
          _id?: string;
          id?: string;
          bookingNumber?: string;
          status?: string;
          customerId?: string;
          providerId?: string;
        };

        // Transform data to match socket method signature
        const bookingData = {
          _id: (data._id || data.id) as string,
          bookingNumber: data.bookingNumber || '',
          status: data.status || statusEvent.replace('booking.', ''),
          customerId: data.customerId as string | undefined,
          providerId: data.providerId as string | undefined,
        };

        if (bookingData._id) {
          socketEmitter.emitBookingStatusChange(bookingData);
          logger.debug('Socket: Emitted booking status change', {
            bookingId: bookingData._id,
            status: bookingData.status,
            action: 'SOCKET_BOOKING_STATUS_CHANGED',
          });
        }
      } catch (error) {
        logger.error('Socket: Failed to emit booking status change', {
          eventId: event.eventId,
          eventType: statusEvent,
          error: error instanceof Error ? error.message : String(error),
          action: 'SOCKET_EMISSION_FAILED',
        });
      }
    }, 15); // Higher priority - immediate real-time delivery
  }

  // Socket: Emit notifications to users
  // Note: This requires NOTIFICATION_CREATED to be published via eventBus.publish()
  // If your notification service publishes events, add this subscription
  eventBus.subscribe('notification.created', async (event) => {
    try {
      const data = event.data as {
        id?: string;
        type?: 'booking' | 'message' | 'system' | 'promotion';
        title?: string;
        message?: string;
        data?: Record<string, unknown>;
        userId?: string;
        read?: boolean;
      };

      // Transform data to match socket method signature
      const notificationData = {
        id: data.id as string,
        type: (data.type || 'system') as 'booking' | 'message' | 'system' | 'promotion',
        title: data.title || '',
        message: data.message || '',
        data: data.data,
        userId: data.userId as string,
        timestamp: event.timestamp,
        read: data.read ?? false,
      };

      if (notificationData.id && notificationData.userId) {
        socketEmitter.emitNotification(notificationData);
        logger.debug('Socket: Emitted notification', {
          notificationId: notificationData.id,
          userId: notificationData.userId,
          action: 'SOCKET_NOTIFICATION',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit notification', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15); // Higher priority - immediate real-time delivery

  logger.info('Event subscriptions initialized', {
    subscriptionCount: eventBus.getSubscriptionCount(),
    action: 'EVENT_SUBSCRIPTIONS_INITIALIZED',
  });
};

/**
 * Get event bus stats for monitoring
 */
export const getEventBusStats = (): {
  historySize: number;
  subscriptionCount: { total: number; byEventType: Record<string, number> };
  deadLetterQueueSize: number;
} => {
  return {
    historySize: eventBus.getHistory().length,
    subscriptionCount: eventBus.getSubscriptionCount(),
    deadLetterQueueSize: eventBus.getDeadLetterQueue().length,
  };
};
