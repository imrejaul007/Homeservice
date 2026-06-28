// Event Bus - Platform-wide event system with subscriptions

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Stripe from 'stripe';
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
  BOOKING_NO_SHOW: 'booking.no_show',
  BOOKING_REMINDER: 'booking.reminder',

  // Payment events
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_VERIFIED: 'user.verified',

  // Review events
  REVIEW_RECEIVED: 'review.received',
  REVIEW_REPLY_RECEIVED: 'review.reply_received',

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
  DISPUTE_REOPENED: 'dispute.reopened',
  DISPUTE_CLOSED: 'dispute.closed',

  // Refund events
  REFUND_CREATED: 'refund.created',
  REFUND_TRIGGERED: 'refund.triggered',
  REFUND_PENDING: 'refund.pending',
  REFUND_PROCESSED: 'refund.processed',
  REFUND_COMPLETED: 'refund.completed',
  REFUND_FAILED: 'refund.failed',
  REFUND_CANCELLED: 'refund.cancelled',
  REFUND_ESCALATED: 'refund.escalated',
  CHARGEBACK_CREATED: 'chargeback.created',

  // Anomaly Detection events
  ANOMALY_DETECTED: 'anomaly.detected',
  ANOMALY_STATUS_CHANGED: 'anomaly.status_changed',
  ANOMALY_RESOLVED: 'anomaly.resolved',

  // Contact form events
  CONTACT_SUBMISSION_CREATED: 'contact.submission_created',
  CONTACT_PAGE_VIEWED: 'contact.page_viewed',
  CONTACT_FORM_STARTED: 'contact.form_started',
  CONTACT_FORM_SUBMITTED: 'contact.form_submitted',

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
  PAYOUT_APPROVED: 'payout.approved',
  PAYOUT_REJECTED: 'payout.rejected',
  WITHDRAWAL_REQUESTED: 'withdrawal.requested',
  WITHDRAWAL_APPROVED: 'withdrawal.approved',
  WITHDRAWAL_REJECTED: 'withdrawal.rejected',

  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',

  // Bundle events
  BUNDLE_CREATED: 'bundle.created',
  BUNDLE_UPDATED: 'bundle.updated',
  BUNDLE_REDEEMED: 'bundle.redeemed',
  BUNDLE_ACTIVATED: 'bundle.activated',
  BUNDLE_PAUSED: 'bundle.paused',
  BUNDLE_ARCHIVED: 'bundle.archived',

  // Rush Booking events
  RUSH_BOOKING_APPLIED: 'rush_booking.applied',

  // Equipment Rental events
  EQUIPMENT_RENTAL_CREATED: 'equipment_rental.created',

  // Extended Warranty events
  EXTENDED_WARRANTY_PURCHASED: 'extended_warranty.purchased',
  EXTENDED_WARRANTY_CLAIM_SUBMITTED: 'extended_warranty.claim_submitted',
  EXTENDED_WARRANTY_CLAIM_PROCESSED: 'extended_warranty.claim_processed',

  // White Label License events
  WHITE_LABEL_LICENSE_CREATED: 'white_label.license_created',

  // Bulk Discount events
  BULK_DISCOUNT_APPLIED: 'bulk_discount.applied',

  // Long Term Contract events
  LONG_TERM_CONTRACT_CREATED: 'long_term_contract.created',

  // Stream/Analytics events
  STREAM_EVENT: 'stream.event',

  // API & billing events
  API_SUBSCRIPTION_CREATED: 'api.subscription_created',
  INVOICE_SENT: 'invoice.sent',

  // Beta features events
  BETA_FEATURE_CREATED: 'beta.feature_created',
  BETA_FEATURE_GRADUATED: 'beta.feature_graduated',
  BETA_FEEDBACK_SUBMITTED: 'beta.feedback_submitted',

  // Deposit events
  DEPOSIT_CREATED: 'deposit.created',
  DEPOSIT_RELEASED: 'deposit.released',
  DEPOSIT_FORFEITED: 'deposit.forfeited',

  // Bundle booking events
  BUNDLE_BOOKED: 'bundle.booked',

  // Insurance events
  INSURANCE_PURCHASED: 'insurance.purchased',
  INSURANCE_CLAIM_SUBMITTED: 'insurance.claim_submitted',
  INSURANCE_CLAIM_PROCESSED: 'insurance.claim_processed',

  // Corporate events
  CORPORATE_ACCOUNT_REGISTERED: 'corporate.account_registered',

  // Account recovery events
  ACCOUNT_RECOVERY_REQUESTED: 'account.recovery_requested',
  ACCOUNT_RECOVERY_ESCALATED: 'account.recovery_escalated',
  ACCOUNT_RECOVERY_COMPLETED: 'account.recovery_completed',

  // Featured boost events
  FEATURED_BOOST_PURCHASED: 'featured_boost.purchased',

  // Instant booking events
  INSTANT_BOOKING_COMMISSION_CALCULATED: 'instant_booking.commission_calculated',

  // Lead generation events
  LEAD_CREDITS_REFUNDED: 'lead.credits_refunded',

  // Scorecard events
  SCORECARD_GENERATED: 'scorecard.generated',

  // Photo sharing events
  PHOTO_UPLOADED: 'photo.uploaded',

  // Policy events
  POLICY_CHANGE_CREATED: 'policy.change_created',
  POLICY_NOTIFICATIONS_SENT: 'policy.notifications_sent',
  POLICY_ACKNOWLEDGED: 'policy.acknowledged',
  POLICY_REMINDER_SENT: 'policy.reminder_sent',

  // Priority match events
  PRIORITY_MATCH_CREATED: 'priority_match.created',

  // Quote events
  QUOTE_REQUEST_CREATED: 'quote.request_created',
  QUOTE_SENT: 'quote.sent',
  QUOTE_ACCEPTED: 'quote.accepted',

  // Review events
  REVIEW_SUBMITTED: 'review.submitted',
  REVIEW_VISIBLE: 'review.visible',

  // Package events
  PACKAGE_CREATED: 'package.created',

  // Tipping events
  TIP_CREATED: 'tip.created',
  TIP_COMPLETED: 'tip.completed',
  TIP_REFUNDED: 'tip.refunded',

  // Training events
  TRAINING_COURSE_CREATED: 'training.course_created',
  CERTIFICATION_ISSUED: 'certification.issued',

  // Verified badge events
  VERIFIED_BADGE_PURCHASED: 'verified_badge.purchased',

  // Admin notification events
  ADMIN_NOTIFICATION: 'admin.notification',
  ADMIN_DISPUTE_CREATED: 'admin.dispute_created',
  ADMIN_REFUND_REQUESTED: 'admin.refund_requested',
  ADMIN_PROVIDER_SUSPENDED: 'admin.provider_suspended',
  ADMIN_SLA_VIOLATION: 'admin.sla_violation',
  ADMIN_NEW_PROVIDER_SUBMISSION: 'admin.new_provider_submission',
  ADMIN_NEW_SERVICE_PENDING: 'admin.new_service_pending',
  ADMIN_NEW_WITHDRAWAL_REQUEST: 'admin.new_withdrawal_request',

  // Dispute appeal events
  DISPUTE_APPEAL_SUBMITTED: 'dispute.appeal_submitted',
  DISPUTE_APPEAL_APPROVED: 'dispute.appeal_approved',
  DISPUTE_APPEAL_REJECTED: 'dispute.appeal_rejected',
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
  nextRetryAt?: Date;
}

// DLQ retry configuration
const DLQ_RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes max
  backoffMultiplier: 2,
};

// MongoDB collection for persistent DLQ storage
let dlqCollection: mongoose.mongo.Collection | null = null;

function getDLQCollection(): mongoose.mongo.Collection | null {
  if (!dlqCollection && mongoose.connection.readyState === 1) {
    try {
      dlqCollection = mongoose.connection.collection('event_dlq');
    } catch (error) {
      logger.warn('Failed to get DLQ collection', {
        error: error instanceof Error ? error.message : String(error),
        action: 'DLQ_COLLECTION_ERROR',
      });
    }
  }
  return dlqCollection;
}

// HIGH SEVERITY FIX: Persist DLQ to MongoDB for durability across restarts
async function addToPersistentDLQ(entry: DeadLetterEntry): Promise<void> {
  const collection = getDLQCollection();
  if (!collection) {
    logger.warn('DLQ collection not available, DLQ entry not persisted', {
      eventId: entry.event.eventId,
      eventType: entry.event.eventType,
      action: 'DLQ_PERSISTENCE_SKIPPED',
    });
    return;
  }

  try {
    await collection.insertOne({
      event: entry.event,
      error: entry.error,
      retryCount: entry.retryCount,
      failedAt: entry.failedAt,
      nextRetryAt: entry.nextRetryAt,
      processed: false,
    });

    logger.debug('DLQ entry persisted to MongoDB', {
      eventId: entry.event.eventId,
      eventType: entry.event.eventType,
      action: 'DLQ_PERSISTED',
    });
  } catch (error) {
    logger.error('Failed to persist DLQ entry to MongoDB', {
      eventId: entry.event.eventId,
      eventType: entry.event.eventType,
      error: error instanceof Error ? error.message : String(error),
      action: 'DLQ_PERSISTENCE_ERROR',
    });
  }
}

class EventBus extends EventEmitter {
  private history: PlatformEvent[] = [];
  private subscriptions: Map<string, EventSubscription> = new Map();
  private deadLetterQueue: DeadLetterEntry[] = [];
  private maxHistorySize = 1000;
  private maxDeadLetterSize = 100;
  private historyHead = 0; // Circular buffer head pointer

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

    // Store in history using circular buffer for O(1) operations
    if (this.history.length < this.maxHistorySize) {
      // Buffer not full, just append
      this.history.push(event as PlatformEvent);
    } else {
      // Buffer full, overwrite oldest using circular buffer
      this.history[this.historyHead] = event as PlatformEvent;
      this.historyHead = (this.historyHead + 1) % this.maxHistorySize;
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
      // Await the async DLQ add to ensure proper error handling
      await this.addToDeadLetterQueue(event, 'All handlers failed');
    }
  }

  /**
   * Add failed event to dead letter queue
   * HIGH SEVERITY FIX: Persists to MongoDB for durability across restarts
   */
  private async addToDeadLetterQueue(event: PlatformEvent, error: string): Promise<void> {
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

    // Persist to MongoDB for durability (fire and forget, don't block on failure)
    addToPersistentDLQ(entry).catch((persistError) => {
      logger.error('Background DLQ persistence failed', {
        eventId: event.eventId,
        error: persistError instanceof Error ? persistError.message : String(persistError),
        action: 'DLQ_BACKGROUND_PERSIST_ERROR',
      });
    });
  }

  /**
   * Get event history
   * Returns events in chronological order (oldest first)
   */
  getHistory(limit?: number): PlatformEvent[] {
    let events: PlatformEvent[];

    if (this.history.length < this.maxHistorySize) {
      // Buffer not full, history is already in order
      events = [...this.history];
    } else {
      // Buffer is full, need to reorder from head
      events = [
        ...this.history.slice(this.historyHead),
        ...this.history.slice(0, this.historyHead),
      ];
    }

    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }

  /**
   * Get events by type
   * Returns events in chronological order (oldest first)
   */
  getEventsByType(eventType: string, limit?: number): PlatformEvent[] {
    // Get full history in chronological order first
    const history = this.getHistory();
    const events = history.filter((e) => e.eventType === eventType);
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
   * Get detailed DLQ status including backoff information
   */
  getDeadLetterQueueStatus(): {
    total: number;
    entries: Array<{
      eventId: string;
      eventType: string;
      retryCount: number;
      maxRetries: number;
      failedAt: Date;
      nextRetryAt?: Date;
      isInBackoff: boolean;
      remainingBackoffMs?: number;
    }>;
  } {
    const now = Date.now();
    return {
      total: this.deadLetterQueue.length,
      entries: this.deadLetterQueue.map(entry => ({
        eventId: entry.event.eventId,
        eventType: entry.event.eventType,
        retryCount: entry.retryCount,
        maxRetries: DLQ_RETRY_CONFIG.maxRetries,
        failedAt: entry.failedAt,
        nextRetryAt: entry.nextRetryAt,
        isInBackoff: entry.nextRetryAt ? now < entry.nextRetryAt.getTime() : false,
        remainingBackoffMs: entry.nextRetryAt ? Math.max(0, entry.nextRetryAt.getTime() - now) : undefined,
      })),
    };
  }

  /**
   * Calculate exponential backoff delay for DLQ retry
   */
  private calculateDLQBackoffDelay(retryCount: number): number {
    const delay = Math.min(
      DLQ_RETRY_CONFIG.initialDelayMs * Math.pow(DLQ_RETRY_CONFIG.backoffMultiplier, retryCount),
      DLQ_RETRY_CONFIG.maxDelayMs
    );
    return delay;
  }

  /**
   * Check if DLQ entry is ready for retry based on backoff
   */
  isDLQEntryReadyForRetry(entryIndex: number): { ready: boolean; nextRetryAt?: Date; retryCount: number } {
    if (entryIndex < 0 || entryIndex >= this.deadLetterQueue.length) {
      return { ready: false, retryCount: 0 };
    }

    const entry = this.deadLetterQueue[entryIndex];

    // If no scheduled retry time, it's ready
    if (!entry.nextRetryAt) {
      return { ready: true, retryCount: entry.retryCount };
    }

    // Check if the scheduled retry time has passed
    const now = Date.now();
    if (now >= entry.nextRetryAt.getTime()) {
      return { ready: true, nextRetryAt: entry.nextRetryAt, retryCount: entry.retryCount };
    }

    return { ready: false, nextRetryAt: entry.nextRetryAt, retryCount: entry.retryCount };
  }

  /**
   * Retry a dead letter entry with exponential backoff
   */
  async retryDeadLetter(entryIndex: number, force: boolean = false): Promise<boolean> {
    if (entryIndex < 0 || entryIndex >= this.deadLetterQueue.length) {
      return false;
    }

    const entry = this.deadLetterQueue[entryIndex];

    // Check if entry is in backoff period (unless forced)
    if (!force && entry.nextRetryAt && Date.now() < entry.nextRetryAt.getTime()) {
      logger.debug('DLQ retry skipped - still in backoff period', {
        eventId: entry.event.eventId,
        eventType: entry.event.eventType,
        retryCount: entry.retryCount,
        nextRetryAt: entry.nextRetryAt,
        action: 'DEAD_LETTER_IN_BACKOFF',
      });
      return false;
    }

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

      // Check if max retries exceeded
      if (entry.retryCount >= DLQ_RETRY_CONFIG.maxRetries) {
        logger.error('Dead letter entry permanently failed after max retries', {
          eventId: entry.event.eventId,
          eventType: entry.event.eventType,
          retryCount: entry.retryCount,
          maxRetries: DLQ_RETRY_CONFIG.maxRetries,
          error: entry.error,
          action: 'DEAD_LETTER_MAX_RETRIES_EXCEEDED',
        });
        // Remove from queue after max retries
        this.deadLetterQueue.splice(entryIndex, 1);
        return false;
      }

      // Calculate next retry time with exponential backoff
      const delay = this.calculateDLQBackoffDelay(entry.retryCount);
      entry.nextRetryAt = new Date(Date.now() + delay);

      logger.warn('Dead letter retry failed, scheduled for retry with backoff', {
        eventId: entry.event.eventId,
        eventType: entry.event.eventType,
        retryCount: entry.retryCount,
        nextRetryAt: entry.nextRetryAt,
        backoffDelayMs: delay,
        error: entry.error,
        action: 'DEAD_LETTER_RETRY_FAILED_WITH_BACKOFF',
      });

      return false;
    }
  }

  /**
   * Retry all dead letter entries that are ready (past their backoff period)
   */
  async retryDeadLetterQueue(): Promise<{ retried: number; failed: number; pending: number }> {
    let retried = 0;
    let failed = 0;
    const pending: number[] = [];

    for (let i = this.deadLetterQueue.length - 1; i >= 0; i--) {
      const status = this.isDLQEntryReadyForRetry(i);
      if (status.ready) {
        const success = await this.retryDeadLetter(i);
        if (success) {
          retried++;
        } else {
          // Check if it was removed due to max retries
          if (i >= this.deadLetterQueue.length) {
            failed++;
          } else {
            pending.push(i);
          }
        }
      } else {
        pending.push(i);
      }
    }

    return { retried, failed, pending: pending.length };
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
    emitDisputeNew: (disputeId: string, bookingId: string, disputeNumber: string, category: string, priority: string) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitDisputeNew(disputeId, bookingId, disputeNumber, category, priority);
      }
    },
    emitDisputeResolved: (customerId: string, providerId: string, disputeId: string, resolution: string, resolutionType: string) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitDisputeResolved(customerId, providerId, disputeId, resolution, resolutionType);
      }
    },
    // SECURITY FIX: Added withdrawal emitter methods
    emitWithdrawalApproved: (providerId: string, withdrawalId: string, amount: number, currency: string) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitWithdrawalApproved(providerId, withdrawalId, amount, currency);
      }
    },
    emitWithdrawalRejected: (providerId: string, withdrawalId: string, amount: number, currency: string, reason: string) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitWithdrawalRejected(providerId, withdrawalId, amount, currency, reason);
      }
    },
    // FIX #8: Added review visibility emitter methods
    emitReviewVisibleToCustomer: (customerId: string, reviewId: string, rating: number) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitReviewVisibleToCustomer(customerId, reviewId, rating);
      }
    },
    emitReviewVisibleToProvider: (providerId: string, reviewId: string, customerId: string, rating: number) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitReviewVisibleToProvider(providerId, reviewId, customerId, rating);
      }
    },
    // FIX #1: Added payment refunded emitter method
    emitPaymentRefunded: (payment: { bookingId: string; bookingNumber: string; amount: number; currency: string; customerId: string }) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitPaymentRefunded(payment);
      }
    },
    // MEDIUM PRIORITY FIX: Added review reply emitter method
    emitReviewReply: (customerId: string, reviewId: string, bookingId: string, providerId: string, providerName: string, reply: string) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitReviewReply(customerId, reviewId, bookingId, providerId, providerName, reply);
      }
    },
    // LOW PRIORITY FIX: Added booking reminder emitter method
    emitBookingReminder: (customerId: string, bookingId: string, minutesUntil: number) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitToUser(customerId, 'booking:reminder', {
          bookingId,
          minutesUntil,
        });
      }
    },
    // MEDIUM PRIORITY FIX: Added insights update emitter method
    emitInsightsUpdated: (providerId: string, reason: 'booking_completed' | 'review_submitted' | 'withdrawal_processed' | 'booking_cancelled', affectedMetrics: string[]) => {
      const socket = socketModule.getSocketServer();
      if (socket) {
        socket.emitInsightsUpdated(providerId, reason, affectedMetrics);
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
  // Analytics Cache Invalidation
  // Clear analytics cache when booking data changes
  // ============================================
  const invalidateAnalyticsCache = async () => {
    try {
      const { analyticsService } = await import('../services/analytics.service');
      await analyticsService.clearCache();
      logger.info('Analytics cache invalidated due to booking data change');
    } catch (error) {
      logger.error('Failed to invalidate analytics cache', { error });
    }
  };

  // Listen to booking completion/cancellation for cache invalidation
  eventBus.subscribe('booking.completed', async () => {
    await invalidateAnalyticsCache();
  }, 8);

  eventBus.subscribe('booking.cancelled', async () => {
    await invalidateAnalyticsCache();
  }, 8);

  eventBus.subscribe('booking.confirmed', async () => {
    await invalidateAnalyticsCache();
  }, 8);

  // ============================================
  // Notification Subscription
  // Listen to booking.* events and send push notifications
  // ============================================
  // booking.created in-app notifications are handled in booking.service.createBookingNotifications.
  // Socket events (booking:new_request) are emitted separately — no duplicate queue jobs here.

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
            await addJob('loyalty-queue', 'award_booking_points', {
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

          // FIX: Award first booking bonus (100 points) - only if not already awarded
          // The loyalty job handler will check firstBookingAwarded flag
          await addJob('loyalty-queue', 'award_first_booking_bonus', {
            userId: data.customerId,
            type: 'bonus',
            description: `First booking #${data.bookingNumber || data.bookingId} completed - Welcome bonus!`,
            relatedBooking: data.bookingId,
          });

          logger.info('First booking bonus job queued', {
            customerId: data.customerId,
            bookingId: data.bookingId,
          });

          // Award cashback on completed booking (5% default)
          try {
            const { earnCashback } = await import('../services/cashback.service');
            await earnCashback(
              data.customerId,
              data.totalAmount,
              'booking',
              `Cashback for booking #${data.bookingNumber || data.bookingId}`,
              data.bookingId
            );
          } catch (cashbackError) {
            logger.error('Failed to award booking cashback', {
              customerId: data.customerId,
              bookingId: data.bookingId,
              error: cashbackError instanceof Error ? cashbackError.message : String(cashbackError),
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
  // Review Event Subscriptions
  // ============================================
  eventBus.subscribe(EVENT_TYPES.REVIEW_RECEIVED, async (event) => {
    try {
      const data = event.data as {
        reviewId?: string;
        providerId?: string;
        bookingId?: string;
        bookingNumber?: string;
        customerId?: string;
        customerName?: string;
        rating?: number;
        comment?: string;
        serviceName?: string;
      };

      if (data.providerId) {
        // Send notification via job queue
        await addJob('notification-queue', 'send_notification', {
          userId: data.providerId,
          type: 'review_received',
          title: 'New Review Received',
          message: (data.customerName || 'A customer') + ' left you a ' + (data.rating || 0) + '-star review',
          data: { reviewId: data.reviewId, bookingId: data.bookingId },
        });

        // FIX: Emit socket event to provider for real-time notification
        // Import getSocketServer dynamically to avoid circular dependency
        const { getSocketServer } = require('../socket');
        const socketServer = getSocketServer();
        if (socketServer && data.providerId && data.reviewId) {
          socketServer.emitNewReview(
            data.providerId,
            data.reviewId,
            data.bookingId || '',
            data.bookingNumber || '',
            data.customerId || '', // Required field - customer who submitted the review
            data.customerName || 'A customer',
            data.rating || 0,
            data.comment,
            data.serviceName
          );
        }
      }
    } catch (error) {
      logger.error('Failed to send review.received notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10);

  eventBus.subscribe(EVENT_TYPES.REVIEW_REPLY_RECEIVED, async (event) => {
    try {
      const data = event.data as {
        reviewId?: string;
        customerId?: string;
        providerId?: string;
        providerName?: string;
        bookingId?: string;
        reply?: string;
      };

      if (data.customerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.customerId,
          type: 'review_received',
          title: 'Review Reply Received',
          message: (data.providerName || 'Your service provider') + ' replied to your review',
          data: { reviewId: data.reviewId, bookingId: data.bookingId },
        });
      }

      // MEDIUM PRIORITY FIX: Emit socket event to notify customer when provider replies to their review
      if (data.customerId && data.reviewId && data.bookingId && data.providerId) {
        try {
          const socketEmitter = await getSocketEmitter();
          socketEmitter.emitReviewReply(
            data.customerId,
            data.reviewId,
            data.bookingId,
            data.providerId,
            data.providerName || 'Your service provider',
            data.reply || ''
          );
        } catch (socketError) {
          logger.error('Failed to emit review:reply socket event', {
            eventId: event.eventId,
            error: socketError instanceof Error ? socketError.message : String(socketError),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to send review.reply_received notifications', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 10);

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

  // Socket: Emit booking reminder to customer
  // LOW PRIORITY FIX: Added subscription for 'booking.reminder' event that emits 'booking:reminder' socket event
  eventBus.subscribe('booking.reminder', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        customerId?: string;
        minutesUntil?: number;
      };

      if (data.bookingId && data.customerId) {
        socketEmitter.emitBookingReminder(
          data.customerId,
          data.bookingId,
          data.minutesUntil ?? 30
        );
        logger.debug('Socket: Emitted booking reminder to customer', {
          bookingId: data.bookingId,
          customerId: data.customerId,
          minutesUntil: data.minutesUntil ?? 30,
          action: 'SOCKET_BOOKING_REMINDER',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit booking:reminder', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15); // Higher priority - immediate real-time delivery

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

  // ============================================
  // Dispute Socket Events
  // ============================================

  // Socket: Emit new dispute to admins
  eventBus.subscribe('dispute.created', async (event) => {
    try {
      const data = event.data as {
        disputeId?: string;
        disputeNumber?: string;
        bookingId?: string;
        category?: string;
        priority?: string;
      };

      if (data.disputeId && data.bookingId) {
        socketEmitter.emitDisputeNew(
          data.disputeId,
          data.bookingId,
          data.disputeNumber || '',
          data.category || '',
          data.priority || 'medium'
        );
        logger.debug('Socket: Emitted new dispute to admins', {
          disputeId: data.disputeId,
          disputeNumber: data.disputeNumber,
          action: 'SOCKET_DISPUTE_CREATED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit dispute:new', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15); // Higher priority - immediate real-time delivery

  // Socket: Emit dispute resolved to customer and provider
  eventBus.subscribe('dispute.resolved', async (event) => {
    try {
      const data = event.data as {
        disputeId?: string;
        disputeNumber?: string;
        resolutionType?: string;
        bookingId?: string;
        customerId?: string;
        providerId?: string;
        reason?: string;
      };

      if (data.disputeId) {
        // Get dispute to find customer and provider IDs
        const dispute = await import('../models/dispute.model').then(m => m.default?.findById(data.disputeId).populate('bookingId'));
        const booking = dispute?.bookingId as { customerId?: string; providerId?: string } | undefined;

        const customerId = booking?.customerId?.toString() || data.customerId || '';
        const providerId = booking?.providerId?.toString() || data.providerId || '';
        const resolution = data.reason || 'Dispute has been resolved';

        socketEmitter.emitDisputeResolved(
          customerId,
          providerId,
          data.disputeId,
          resolution,
          data.resolutionType || 'unknown'
        );
        logger.debug('Socket: Emitted dispute resolved to parties', {
          disputeId: data.disputeId,
          disputeNumber: data.disputeNumber,
          action: 'SOCKET_DISPUTE_RESOLVED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit dispute:resolved', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15); // Higher priority - immediate real-time delivery

  // Socket: Emit payout completed to provider
  // SECURITY FIX: Added subscriber for payout events
  eventBus.subscribe('payout.completed', async (event) => {
    try {
      const data = event.data as {
        payoutId?: string;
        providerId?: string;
        amount?: number;
        stripePayoutId?: string;
      };

      if (data.payoutId && data.providerId) {
        socketEmitter.emitWithdrawalApproved(
          data.providerId,
          data.payoutId,
          data.amount || 0,
          'AED'
        );
        logger.debug('Socket: Emitted payout completed to provider', {
          payoutId: data.payoutId,
          providerId: data.providerId,
          action: 'SOCKET_PAYOUT_COMPLETED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit payout:completed', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // Socket: Emit payout failed to provider
  eventBus.subscribe('payout.failed', async (event) => {
    try {
      const data = event.data as {
        payoutId?: string;
        providerId?: string;
        amount?: number;
        reason?: string;
      };

      if (data.payoutId && data.providerId) {
        socketEmitter.emitWithdrawalRejected(
          data.providerId,
          data.payoutId,
          data.amount || 0,
          'AED',
          data.reason || 'Payout processing failed'
        );
        logger.debug('Socket: Emitted payout failed to provider', {
          payoutId: data.payoutId,
          providerId: data.providerId,
          action: 'SOCKET_PAYOUT_FAILED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit payout:failed', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // Socket: Emit withdrawal approved to provider
  // SECURITY FIX: Added subscriber for withdrawal.approved event (published by admin.controller.ts)
  eventBus.subscribe('withdrawal.approved', async (event) => {
    try {
      const data = event.data as {
        withdrawalId?: string;
        providerId?: string;
        amount?: number;
        currency?: string;
      };

      if (data.withdrawalId && data.providerId) {
        socketEmitter.emitWithdrawalApproved(
          data.providerId,
          data.withdrawalId,
          data.amount || 0,
          data.currency || 'AED'
        );
        logger.debug('Socket: Emitted withdrawal approved to provider', {
          withdrawalId: data.withdrawalId,
          providerId: data.providerId,
          action: 'SOCKET_WITHDRAWAL_APPROVED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit withdrawal:approved', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // Socket: Emit withdrawal rejected to provider
  // SECURITY FIX: Added subscriber for withdrawal.rejected event (published by admin.controller.ts)
  eventBus.subscribe('withdrawal.rejected', async (event) => {
    try {
      const data = event.data as {
        withdrawalId?: string;
        providerId?: string;
        amount?: number;
        currency?: string;
        reason?: string;
      };

      if (data.withdrawalId && data.providerId) {
        socketEmitter.emitWithdrawalRejected(
          data.providerId,
          data.withdrawalId,
          data.amount || 0,
          data.currency || 'AED',
          data.reason || 'Withdrawal rejected'
        );
        logger.debug('Socket: Emitted withdrawal rejected to provider', {
          withdrawalId: data.withdrawalId,
          providerId: data.providerId,
          action: 'SOCKET_WITHDRAWAL_REJECTED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit withdrawal:rejected', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // FIX #1: Socket: Emit payment refunded to customer
  eventBus.subscribe('payment.refunded', async (event) => {
    try {
      const data = event.data as {
        bookingId?: string;
        bookingNumber?: string;
        amount?: number;
        currency?: string;
        customerId?: string;
        providerId?: string;
      };

      if (data.bookingId && data.customerId) {
        socketEmitter.emitPaymentRefunded({
          bookingId: data.bookingId,
          bookingNumber: data.bookingNumber || '',
          amount: data.amount || 0,
          currency: data.currency || 'AED',
          customerId: data.customerId,
        });
        logger.debug('Socket: Emitted payment refunded to customer', {
          bookingId: data.bookingId,
          customerId: data.customerId,
          action: 'SOCKET_PAYMENT_REFUNDED',
        });
      }

      // FIX [MEDIUM-3]: When a booking is refunded, create settlement deduction to reverse provider payout
      if (data.bookingId && data.providerId && data.amount) {
        try {
          const mongoose = require('mongoose');
          const Settlement = mongoose.model('Settlement');

          const settlement = await Settlement.findOne({
            'lineItems.bookingId': new mongoose.Types.ObjectId(data.bookingId)
          });

          if (settlement) {
            const lineItem = settlement.lineItems.find(
              (item: any) => item.bookingId?.toString() === data.bookingId
            );

            if (lineItem) {
              // Add deduction for the refund amount (up to the net amount)
              const deductionAmount = Math.min(data.amount, lineItem.netAmount);

              (settlement as any).addDeduction(
                'refund_reversal',
                deductionAmount,
                `Refund processed for booking ${data.bookingNumber || data.bookingId}. Amount: ${data.amount} ${data.currency || 'AED'}`,
                data.bookingId
              );
              await settlement.save();

              logger.info('Settlement deduction added for refund', {
                action: 'SETTLEMENT_REFUND_REVERSAL',
                settlementId: settlement._id.toString(),
                settlementNumber: settlement.settlementNumber,
                bookingId: data.bookingId,
                deductionAmount,
                refundAmount: data.amount,
              });
            }
          }
        } catch (settlementError) {
          logger.error('Failed to add settlement deduction for refund', {
            eventId: event.eventId,
            bookingId: data.bookingId,
            error: settlementError instanceof Error ? settlementError.message : String(settlementError),
            action: 'SETTLEMENT_REFUND_ERROR',
          });
        }
      }
    } catch (error) {
      logger.error('Socket: Failed to emit payment:refunded', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // FIX #8: Socket: Emit review visible to customer and provider
  eventBus.subscribe('review.visible', async (event) => {
    try {
      const data = event.data as {
        reviewId?: string;
        customerId?: string;
        providerId?: string;
        rating?: number;
        isPublic?: boolean;
      };

      if (data.reviewId) {
        // Emit to customer (reviewer)
        if (data.customerId) {
          socketEmitter.emitReviewVisibleToCustomer(
            data.customerId,
            data.reviewId,
            data.rating || 0
          );
          logger.debug('Socket: Emitted review visible to customer', {
            reviewId: data.reviewId,
            customerId: data.customerId,
            action: 'SOCKET_REVIEW_VISIBLE_CUSTOMER',
          });
        }

        // Emit to provider
        if (data.providerId && data.customerId) {
          socketEmitter.emitReviewVisibleToProvider(
            data.providerId,
            data.reviewId,
            data.customerId,
            data.rating || 0
          );
          logger.debug('Socket: Emitted review visible to provider', {
            reviewId: data.reviewId,
            providerId: data.providerId,
            action: 'SOCKET_REVIEW_VISIBLE_PROVIDER',
          });
        }
      }
    } catch (error) {
      logger.error('Socket: Failed to emit review:visible', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // ============================================
  // Insights Update Subscriptions
  // Emit insights:updated socket events to trigger dashboard refresh
  // ============================================

  // Socket: Emit insights:updated when booking is completed
  eventBus.subscribe('booking.completed', async (event) => {
    try {
      const data = event.data as {
        providerId?: string;
      };

      if (data.providerId) {
        socketEmitter.emitInsightsUpdated(
          data.providerId,
          'booking_completed',
          ['performance', 'revenue', 'customerSatisfaction']
        );
        logger.debug('Socket: Emitted insights:updated for booking_completed', {
          providerId: data.providerId,
          action: 'SOCKET_INSIGHTS_UPDATED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit insights:updated for booking.completed', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // Socket: Emit insights:updated when booking is cancelled
  eventBus.subscribe('booking.cancelled', async (event) => {
    try {
      const data = event.data as {
        providerId?: string;
      };

      if (data.providerId) {
        socketEmitter.emitInsightsUpdated(
          data.providerId,
          'booking_cancelled',
          ['performance']
        );
        logger.debug('Socket: Emitted insights:updated for booking_cancelled', {
          providerId: data.providerId,
          action: 'SOCKET_INSIGHTS_UPDATED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit insights:updated for booking.cancelled', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // Socket: Emit insights:updated when new review is received
  eventBus.subscribe(EVENT_TYPES.REVIEW_RECEIVED, async (event) => {
    try {
      const data = event.data as {
        providerId?: string;
      };

      if (data.providerId) {
        socketEmitter.emitInsightsUpdated(
          data.providerId,
          'review_submitted',
          ['customerSatisfaction']
        );
        logger.debug('Socket: Emitted insights:updated for review_submitted', {
          providerId: data.providerId,
          action: 'SOCKET_INSIGHTS_UPDATED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit insights:updated for review.received', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // Socket: Emit insights:updated when withdrawal is processed
  eventBus.subscribe('withdrawal.approved', async (event) => {
    try {
      const data = event.data as {
        providerId?: string;
      };

      if (data.providerId) {
        socketEmitter.emitInsightsUpdated(
          data.providerId,
          'withdrawal_processed',
          ['revenue']
        );
        logger.debug('Socket: Emitted insights:updated for withdrawal_processed', {
          providerId: data.providerId,
          action: 'SOCKET_INSIGHTS_UPDATED',
        });
      }
    } catch (error) {
      logger.error('Socket: Failed to emit insights:updated for withdrawal.approved', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'SOCKET_EMISSION_FAILED',
      });
    }
  }, 15);

  // ============================================
  // Stripe Payout Webhook Event Handlers
  // These handlers update withdrawal (payout) status when Stripe reports payout completion/failure
  // ============================================

  // HIGH SEVERITY FIX: Handle payout.paid webhook - update withdrawal status to completed
  eventBus.subscribe('payout.paid', async (event) => {
    try {
      const stripeEvent = event.data as Stripe.Event;
      const payoutData = stripeEvent.data.object as Stripe.Payout;

      logger.info('Processing payout.paid webhook', {
        stripePayoutId: payoutData.id,
        amount: payoutData.amount,
        currency: payoutData.currency,
        action: 'PAYOUT_PAID_WEBHOOK',
      });

      // Find the payout by Stripe payout ID
      const Payout = mongoose.model('Payout');
      const payout = await Payout.findOne({ stripePayoutId: payoutData.id });

      if (!payout) {
        logger.warn('Payout not found by Stripe payout ID - may be a direct Stripe payout', {
          stripePayoutId: payoutData.id,
          action: 'PAYOUT_NOT_FOUND_WEBHOOK',
        });
        return;
      }

      // Update payout status to completed
      payout.status = 'completed';
      payout.processedDate = new Date();
      await payout.save();

      logger.info('Withdrawal status updated to completed via Stripe webhook', {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        stripePayoutId: payoutData.id,
        action: 'WITHDRAWAL_COMPLETED_WEBHOOK',
      });

      // Emit socket event for real-time update
      socketEmitter.emitWithdrawalApproved(
        payout.providerId.toString(),
        payout._id.toString(),
        payout.amount,
        payout.currency || 'AED'
      );

      // Send notification to provider
      await addJob('notification-queue', 'send_notification', {
        userId: payout.providerId.toString(),
        type: 'withdrawal_approved',
        title: 'Payout Completed',
        message: `Your payout of ${payout.amount} ${payout.currency} has been completed via bank transfer.`,
        data: {
          payoutId: payout._id.toString(),
          payoutNumber: payout.payoutNumber,
          stripePayoutId: payoutData.id,
        },
      });

    } catch (error) {
      logger.error('Failed to process payout.paid webhook', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'PAYOUT_PAID_WEBHOOK_ERROR',
      });
    }
  }, 15);

  // HIGH SEVERITY FIX: Handle payout.failed webhook - update withdrawal status to failed
  eventBus.subscribe('payout.failed', async (event) => {
    try {
      const stripeEvent = event.data as Stripe.Event;
      const payoutData = stripeEvent.data.object as Stripe.Payout;

      logger.info('Processing payout.failed webhook', {
        stripePayoutId: payoutData.id,
        amount: payoutData.amount,
        currency: payoutData.currency,
        failureMessage: payoutData.failure_message,
        action: 'PAYOUT_FAILED_WEBHOOK',
      });

      // Find the payout by Stripe payout ID
      const Payout = mongoose.model('Payout');
      const payout = await Payout.findOne({ stripePayoutId: payoutData.id });

      if (!payout) {
        logger.warn('Payout not found by Stripe payout ID - may be a direct Stripe payout', {
          stripePayoutId: payoutData.id,
          action: 'PAYOUT_NOT_FOUND_WEBHOOK',
        });
        return;
      }

      // Record failure
      payout.currentRetryCount += 1;
      payout.failures.push({
        reason: payoutData.failure_message || 'Stripe payout failed',
        errorCode: payoutData.failure_code || 'STRIPE_FAILED',
        date: new Date(),
        retryAttempt: payout.currentRetryCount,
      });

      // Check if we should mark as permanently failed or schedule retry
      if (payout.currentRetryCount >= payout.maxRetries) {
        payout.status = 'failed';
        logger.info('Payout marked as permanently failed after max retries', {
          payoutId: payout._id.toString(),
          payoutNumber: payout.payoutNumber,
          retryCount: payout.currentRetryCount,
          action: 'PAYOUT_PERMANENTLY_FAILED',
        });
      } else {
        // Schedule retry with exponential backoff
        payout.status = 'failed';
        const baseDelayHours = 24;
        const delayMultiplier = Math.pow(2, payout.currentRetryCount - 1);
        const nextRetry = new Date();
        nextRetry.setHours(nextRetry.getHours() + baseDelayHours * delayMultiplier);
        payout.nextRetryDate = nextRetry;

        logger.info('Payout retry scheduled', {
          payoutId: payout._id.toString(),
          payoutNumber: payout.payoutNumber,
          retryCount: payout.currentRetryCount,
          nextRetryDate: nextRetry,
          action: 'PAYOUT_RETRY_SCHEDULED',
        });
      }

      await payout.save();

      // Emit socket event for real-time update
      socketEmitter.emitWithdrawalRejected(
        payout.providerId.toString(),
        payout._id.toString(),
        payout.amount,
        payout.currency || 'AED',
        payoutData.failure_message || 'Payout processing failed'
      );

      // Send notification to provider
      await addJob('notification-queue', 'send_notification', {
        userId: payout.providerId.toString(),
        type: 'withdrawal_rejected',
        title: 'Payout Failed',
        message: `Your payout of ${payout.amount} ${payout.currency} could not be processed. Reason: ${payoutData.failure_message || 'Stripe payout failed'}`,
        data: {
          payoutId: payout._id.toString(),
          payoutNumber: payout.payoutNumber,
          failureReason: payoutData.failure_message,
          retryable: payout.currentRetryCount < payout.maxRetries,
          nextRetryDate: payout.nextRetryDate,
        },
      });

    } catch (error) {
      logger.error('Failed to process payout.failed webhook', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'PAYOUT_FAILED_WEBHOOK_ERROR',
      });
    }
  }, 15);

  // HIGH SEVERITY FIX: Handle payout.canceled webhook - update withdrawal status to cancelled
  eventBus.subscribe('payout.canceled', async (event) => {
    try {
      const stripeEvent = event.data as Stripe.Event;
      const payoutData = stripeEvent.data.object as Stripe.Payout;

      logger.info('Processing payout.canceled webhook', {
        stripePayoutId: payoutData.id,
        amount: payoutData.amount,
        currency: payoutData.currency,
        action: 'PAYOUT_CANCELED_WEBHOOK',
      });

      // Find the payout by Stripe payout ID
      const Payout = mongoose.model('Payout');
      const payout = await Payout.findOne({ stripePayoutId: payoutData.id });

      if (!payout) {
        logger.warn('Payout not found by Stripe payout ID - may be a direct Stripe payout', {
          stripePayoutId: payoutData.id,
          action: 'PAYOUT_NOT_FOUND_WEBHOOK',
        });
        return;
      }

      // Cancel the payout
      payout.status = 'cancelled';
      payout.notes = `Canceled by Stripe: ${payoutData.failure_message || 'No reason provided'}`;
      await payout.save();

      // Refund the amount back to available balance
      const Wallet = mongoose.model('Wallet');
      await Wallet.findOneAndUpdate(
        { userId: payout.providerId },
        {
          $inc: {
            balance: payout.amount,
            pendingBalance: payout.amount,
          },
        }
      );

      logger.info('Payout canceled via Stripe webhook, amount refunded to balance', {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        stripePayoutId: payoutData.id,
        amountRefunded: payout.amount,
        action: 'PAYOUT_CANCELED_REFUNDED',
      });

      // Emit socket event for real-time update
      socketEmitter.emitWithdrawalRejected(
        payout.providerId.toString(),
        payout._id.toString(),
        payout.amount,
        payout.currency || 'AED',
        'Payout was canceled and amount has been returned to your balance'
      );

      // Send notification to provider
      await addJob('notification-queue', 'send_notification', {
        userId: payout.providerId.toString(),
        type: 'withdrawal_rejected',
        title: 'Payout Canceled',
        message: `Your payout of ${payout.amount} ${payout.currency} was canceled and the amount has been returned to your balance.`,
        data: {
          payoutId: payout._id.toString(),
          payoutNumber: payout.payoutNumber,
          refundedAmount: payout.amount,
        },
      });

    } catch (error) {
      logger.error('Failed to process payout.canceled webhook', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'PAYOUT_CANCELED_WEBHOOK_ERROR',
      });
    }
  }, 15);

  // ============================================
  // Recommendations Cache Invalidation
  // Invalidate customer recommendations cache when booking is completed
  // ============================================
  eventBus.subscribe('booking.completed', async (event) => {
    try {
      const data = event.data as {
        customerId?: string;
        tenantId?: string;
      };

      if (data.customerId && data.tenantId) {
        // Lazy import to avoid circular dependency
        const { customerDashboardService } = require('../services/customerDashboard.service');
        await customerDashboardService.invalidateRecommendationsCache(data.tenantId, data.customerId);
        logger.debug('Recommendations cache invalidated on booking completion', {
          customerId: data.customerId,
          tenantId: data.tenantId,
          action: 'RECOMMENDATIONS_CACHE_INVALIDATED',
        });
      }
    } catch (error) {
      logger.error('Failed to invalidate recommendations cache on booking completion', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        action: 'RECOMMENDATIONS_CACHE_INVALIDATION_FAILED',
      });
    }
  }, 5); // Lower priority - not critical path

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
