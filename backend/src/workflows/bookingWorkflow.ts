import { eventBus, EventTypes, DomainEvent } from '../events/eventBus';
import { getQueue, addJob } from '../queue';
import logger from '../utils/logger';

class BookingWorkflow {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for booking.created
    eventBus.subscribe(EventTypes.BOOKING_CREATED, async (event) => {
      await this.handleBookingCreated(event);
    });

    // Listen for booking.confirmed
    eventBus.subscribe(EventTypes.BOOKING_CONFIRMED, async (event) => {
      await this.handleBookingConfirmed(event);
    });

    // Listen for booking.completed
    eventBus.subscribe(EventTypes.BOOKING_COMPLETED, async (event) => {
      await this.handleBookingCompleted(event);
    });

    // Listen for booking.cancelled
    eventBus.subscribe(EventTypes.BOOKING_CANCELLED, async (event) => {
      await this.handleBookingCancelled(event);
    });
  }

  private async handleBookingCreated(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Booking created', { bookingId: event.payload.bookingId });

    // Queue confirmation email to customer
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'booking-created',
      data: event.payload,
    });

    // Queue notification to provider
    await addJob('notifications', 'send-push', {
      userId: event.payload.providerId,
      title: 'New Booking Request',
      body: `New booking from ${event.payload.customerName}`,
    });

    // Queue analytics event
    await addJob('analytics', 'track-event', {
      event: 'booking_created',
      properties: {
        bookingId: event.payload.bookingId,
        serviceId: event.payload.serviceId,
        value: event.payload.totalAmount,
      },
    });

    // Check for fraud
    await addJob('fraud', 'check-booking', {
      bookingId: event.payload.bookingId,
      customerId: event.payload.customerId,
    });
  }

  private async handleBookingConfirmed(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Booking confirmed', { bookingId: event.payload.bookingId });

    // Send confirmation to customer
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'booking-confirmed',
      data: event.payload,
    });

    // Update analytics
    await addJob('analytics', 'track-event', {
      event: 'booking_confirmed',
      properties: { bookingId: event.payload.bookingId },
    });
  }

  private async handleBookingCompleted(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Booking completed', { bookingId: event.payload.bookingId });

    // Send review request
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'booking-completed',
      data: event.payload,
    });

    // Queue review request (delayed by 1 hour)
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'review-request',
      data: event.payload,
    }, { delay: 3600000 }); // 1 hour delay

    // Award loyalty points
    await addJob('loyalty', 'award-points', {
      customerId: event.payload.customerId,
      bookingId: event.payload.bookingId,
      amount: event.payload.totalAmount,
    });

    // Update analytics
    await addJob('analytics', 'track-event', {
      event: 'booking_completed',
      properties: {
        bookingId: event.payload.bookingId,
        value: event.payload.totalAmount,
      },
    });

    // Queue provider payout
    await addJob('payments', 'queue-payout', {
      providerId: event.payload.providerId,
      bookingId: event.payload.bookingId,
      amount: event.payload.providerPayout,
    });
  }

  private async handleBookingCancelled(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Booking cancelled', { bookingId: event.payload.bookingId });

    // Queue refund if payment was made
    if (event.payload.paymentId) {
      await addJob('payments', 'process-refund', {
        paymentId: event.payload.paymentId,
        bookingId: event.payload.bookingId,
        reason: event.payload.cancellationReason,
      });
    }

    // Send cancellation confirmation
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'booking-cancelled',
      data: event.payload,
    });

    // Notify provider
    await addJob('notifications', 'send-push', {
      userId: event.payload.providerId,
      title: 'Booking Cancelled',
      body: `Booking has been cancelled`,
    });

    // Update analytics
    await addJob('analytics', 'track-event', {
      event: 'booking_cancelled',
      properties: {
        bookingId: event.payload.bookingId,
        reason: event.payload.cancellationReason,
      },
    });
  }
}

export const bookingWorkflow = new BookingWorkflow();
