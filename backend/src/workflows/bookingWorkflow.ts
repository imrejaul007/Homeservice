import { eventBus, EVENT_TYPES, PlatformEvent } from '../event-bus';
import logger from '../utils/logger';

// Type definitions for workflow payloads
interface BookingCreatedData {
  bookingId?: string;
  _id?: string;
  id?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  providerId?: string;
  serviceId?: string;
  totalAmount?: number;
  providerPayout?: number;
}

interface BookingConfirmedData {
  bookingId?: string;
  _id?: string;
  id?: string;
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
}

interface BookingCompletedData {
  bookingId?: string;
  _id?: string;
  id?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  providerId?: string;
  providerPayout?: number;
  totalAmount?: number;
}

interface BookingCancelledData {
  bookingId?: string;
  _id?: string;
  id?: string;
  customerEmail?: string;
  customerName?: string;
  providerId?: string;
  paymentId?: string;
  paymentTransactionId?: string;
  cancellationReason?: string;
}

class BookingWorkflow {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for booking.created
    eventBus.subscribe(EVENT_TYPES.BOOKING_CREATED, async (event: PlatformEvent) => {
      await this.handleBookingCreated(event as PlatformEvent<BookingCreatedData>);
    });

    // Listen for booking.confirmed
    eventBus.subscribe(EVENT_TYPES.BOOKING_CONFIRMED, async (event: PlatformEvent) => {
      await this.handleBookingConfirmed(event as PlatformEvent<BookingConfirmedData>);
    });

    // Listen for booking.completed
    eventBus.subscribe(EVENT_TYPES.BOOKING_COMPLETED, async (event: PlatformEvent) => {
      await this.handleBookingCompleted(event as PlatformEvent<BookingCompletedData>);
    });

    // Listen for booking.cancelled
    eventBus.subscribe(EVENT_TYPES.BOOKING_CANCELLED, async (event: PlatformEvent) => {
      await this.handleBookingCancelled(event as PlatformEvent<BookingCancelledData>);
    });

    logger.info('Booking workflow initialized', {
      action: 'WORKFLOW_INITIALIZED',
      workflows: ['booking.created', 'booking.confirmed', 'booking.completed', 'booking.cancelled'],
    });
  }

  private getBookingId(data: BookingCreatedData | BookingConfirmedData | BookingCompletedData | BookingCancelledData): string {
    return (data.bookingId || data._id || data.id || '') as string;
  }

  private async handleBookingCreated(event: PlatformEvent<BookingCreatedData>): Promise<void> {
    const data = event.data;
    const bookingId = this.getBookingId(data);

    logger.info('Workflow: Booking created', {
      bookingId,
      eventId: event.eventId
    });

    // Import queue service dynamically to avoid circular dependencies
    try {
      const { addJob } = await import('../queue');

      // Queue confirmation email to customer
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_confirmation',
          metadata: {
            bookingId,
            customerName: data.customerName,
          },
        });
      }

      // Queue notification to provider
      if (data.providerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.providerId,
          type: 'booking_new',
          title: 'New Booking Request',
          message: `New booking from ${data.customerName || 'a customer'}`,
          data: { bookingId },
        });
      }

      // Queue analytics event
      await addJob('analytics-queue', 'track_event', {
        event: 'booking_created',
        properties: {
          bookingId,
          serviceId: data.serviceId,
          value: data.totalAmount,
        },
      });

      // Check for fraud
      if (data.customerId) {
        await addJob('fraud-queue', 'check_booking', {
          bookingId,
          customerId: data.customerId,
        });
      }
    } catch (error) {
      logger.error('Workflow: Booking created handler failed', {
        bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleBookingConfirmed(event: PlatformEvent<BookingConfirmedData>): Promise<void> {
    const data = event.data;
    const bookingId = this.getBookingId(data);

    logger.info('Workflow: Booking confirmed', {
      bookingId,
      eventId: event.eventId
    });

    try {
      const { addJob } = await import('../queue');

      // Send confirmation to customer
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_accepted',
          metadata: {
            bookingId,
            customerName: data.customerName,
          },
        });
      }

      // Update analytics
      await addJob('analytics-queue', 'track_event', {
        event: 'booking_confirmed',
        properties: { bookingId },
      });
    } catch (error) {
      logger.error('Workflow: Booking confirmed handler failed', {
        bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleBookingCompleted(event: PlatformEvent<BookingCompletedData>): Promise<void> {
    const data = event.data;
    const bookingId = this.getBookingId(data);

    logger.info('Workflow: Booking completed', {
      bookingId,
      eventId: event.eventId
    });

    try {
      const { addJob } = await import('../queue');

      // Send completion email to customer
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_completed',
          metadata: {
            bookingId,
            customerName: data.customerName,
          },
        });

        // Queue review request (delayed by 1 hour)
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'review_request',
          metadata: {
            bookingId,
            customerName: data.customerName,
          },
        }, { delay: 3600000 }); // 1 hour delay
      }

      // Award loyalty points to customer
      if (data.customerId && data.totalAmount) {
        const pointsEarned = Math.floor(data.totalAmount / 10);
        if (pointsEarned > 0) {
          await addJob('loyalty-queue', 'award_booking_points', {
            userId: data.customerId,
            amount: pointsEarned,
            type: 'earned',
            description: `Booking #${bookingId} completed`,
            relatedBooking: bookingId,
          });
        }
      }

      // Update analytics
      await addJob('analytics-queue', 'track_event', {
        event: 'booking_completed',
        properties: {
          bookingId,
          value: data.totalAmount,
        },
      });

      // Queue provider payout calculation
      if (data.providerId) {
        await addJob('settlement-queue', 'process_settlement', {
          bookingId,
          providerId: data.providerId,
          amount: data.providerPayout,
        });
      }
    } catch (error) {
      logger.error('Workflow: Booking completed handler failed', {
        bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleBookingCancelled(event: PlatformEvent<BookingCancelledData>): Promise<void> {
    const data = event.data;
    const bookingId = this.getBookingId(data);

    logger.info('Workflow: Booking cancelled', {
      bookingId,
      eventId: event.eventId
    });

    try {
      const { addJob } = await import('../queue');

      // Queue refund if payment was made
      const paymentId = data.paymentId || data.paymentTransactionId;
      if (paymentId) {
        await addJob('payment-queue', 'process_refund', {
          bookingId,
          paymentId,
          reason: data.cancellationReason,
        });
      }

      // Send cancellation confirmation to customer
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'booking_cancelled',
          metadata: {
            bookingId,
            customerName: data.customerName,
            reason: data.cancellationReason,
          },
        });
      }

      // Notify provider
      if (data.providerId) {
        await addJob('notification-queue', 'send_notification', {
          userId: data.providerId,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Booking #${bookingId} has been cancelled`,
          data: { bookingId },
        });
      }

      // Update analytics
      await addJob('analytics-queue', 'track_event', {
        event: 'booking_cancelled',
        properties: {
          bookingId,
          reason: data.cancellationReason,
        },
      });
    } catch (error) {
      logger.error('Workflow: Booking cancelled handler failed', {
        bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const bookingWorkflow = new BookingWorkflow();
