import { EventEmitter } from 'events';
import logger from '../utils/logger';

export interface DomainEvent {
  id: string;
  type: string;
  payload: any;
  metadata: {
    timestamp: Date;
    correlationId?: string;
    userId?: string;
    tenantId?: string;
  };
  version: number;
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

interface Subscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  options?: {
    version?: number;
    retry?: number;
  };
}

class EventBus {
  private emitter = new EventEmitter();
  private subscriptions = new Map<string, Subscription[]>();
  private eventHistory: DomainEvent[] = [];
  private historyIndex = 0;
  private readonly MAX_HISTORY = 1000;
  private handlers = new Map<string, Set<EventHandler>>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publish(event: DomainEvent): void {
    // Store in history
    this.addToHistory(event);

    // Emit for direct listeners
    this.emitter.emit(event.type, event);

    // Log event
    logger.info('Event published', {
      type: event.type,
      id: event.id,
      metadata: event.metadata,
    });

    // Process async handlers
    this.processEvent(event);
  }

  subscribe(
    eventType: string,
    handler: EventHandler,
    options?: { retry?: number }
  ): () => void {
    const subscription: Subscription = {
      id: `${eventType}-${Date.now()}`,
      eventType,
      handler,
      options,
    };

    const subs = this.subscriptions.get(eventType) || [];
    subs.push(subscription);
    this.subscriptions.set(eventType, subs);

    // Also add to EventEmitter
    const handlers = this.handlers.get(eventType) || new Set();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);
    this.emitter.on(eventType, handler);

    return () => {
      // Unsubscribe
      const existing = this.subscriptions.get(eventType) || [];
      this.subscriptions.set(
        eventType,
        existing.filter(s => s.id !== subscription.id)
      );
      this.emitter.off(eventType, handler);
      handlers.delete(handler);
    };
  }

  subscribeOnce(eventType: string, handler: EventHandler): void {
    this.emitter.once(eventType, handler);
  }

  async publishAsync(event: DomainEvent): Promise<void> {
    // Non-blocking publish
    setImmediate(() => this.publish(event));
  }

  getHistory(limit = 100, eventType?: string): DomainEvent[] {
    let history = this.eventHistory;
    if (eventType) {
      history = history.filter(e => e.type === eventType);
    }
    return history.slice(-limit);
  }

  private addToHistory(event: DomainEvent): void {
    this.eventHistory[this.historyIndex] = event;
    this.historyIndex = (this.historyIndex + 1) % this.MAX_HISTORY;
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || new Set();
    const subscriptions = this.subscriptions.get(event.type) || [];

    const allHandlers = [
      ...Array.from(handlers),
      ...subscriptions.map(s => s.handler),
    ];

    await Promise.all(
      allHandlers.map(handler =>
        this.safeExecute(handler, event)
      )
    );
  }

  private async safeExecute(
    handler: EventHandler,
    event: DomainEvent,
    retryCount = 0
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Event handler failed', {
        error,
        eventType: event.type,
        retryCount,
      });

      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return this.safeExecute(handler, event, retryCount + 1);
      }
    }
  }
}

export const eventBus = new EventBus();

// Event types
export const EventTypes = {
  // Booking events
  BOOKING_CREATED: 'booking.created',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_COMPLETED: 'booking.completed',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_NO_SHOW: 'booking.no_show',

  // Payment events
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Notification events
  NOTIFICATION_EMAIL: 'notification.email',
  NOTIFICATION_PUSH: 'notification.push',
  NOTIFICATION_SMS: 'notification.sms',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_UPDATED: 'user.updated',

  // Provider events
  PROVIDER_APPROVED: 'provider.approved',
  PROVIDER_SUSPENDED: 'provider.suspended',

  // Loyalty events
  POINTS_EARNED: 'loyalty.points_earned',
  POINTS_REDEEMED: 'loyalty.points_redeemed',
  TIER_CHANGED: 'loyalty.tier_changed',

  // FIX: Offer events
  OFFER_VIEWED: 'offer.viewed',
  OFFER_CLAIMED: 'offer.claimed',
  OFFER_REDEEMED: 'offer.redeemed',
  OFFER_EXPIRED: 'offer.expired',
} as const;

// Alias for backward compatibility
export const EVENT_TYPES = EventTypes;
