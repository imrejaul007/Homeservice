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

  // Payment events
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_VERIFIED: 'user.verified',

  // Analytics events
  PAGE_VIEW: 'analytics.page_view',
  SEARCH: 'analytics.search',
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
// Event Subscriptions Setup
// ============================================

/**
 * Initialize event subscriptions
 * This should be called once when the application starts
 */
export const initializeEventSubscriptions = async (): Promise<void> => {
  const { addJob } = await import('../queue');

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
