import { eventBus, EVENT_TYPES, PlatformEvent } from '../event-bus';
import logger from '../utils/logger';

// Type definitions for workflow payloads
interface PaymentPendingData {
  paymentId?: string;
  bookingId?: string;
  amount?: number;
  userId?: string;
  customerEmail?: string;
}

interface PaymentCompletedData {
  paymentId?: string;
  bookingId?: string;
  amount?: number;
  userId?: string;
  customerEmail?: string;
  walletCredit?: number;
  currency?: string;
}

interface PaymentFailedData {
  paymentId?: string;
  bookingId?: string;
  error?: string;
  userId?: string;
  customerEmail?: string;
  shouldAlert?: boolean;
}

interface PaymentRefundedData {
  paymentId?: string;
  bookingId?: string;
  refundedAmount?: number;
  customerEmail?: string;
  currency?: string;
}

class PaymentWorkflow {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for payment.pending
    eventBus.subscribe(EVENT_TYPES.PAYMENT_COMPLETED, async (event: PlatformEvent) => {
      await this.handlePaymentCompleted(event as PlatformEvent<PaymentCompletedData>);
    });

    eventBus.subscribe(EVENT_TYPES.PAYMENT_FAILED, async (event: PlatformEvent) => {
      await this.handlePaymentFailed(event as PlatformEvent<PaymentFailedData>);
    });

    eventBus.subscribe(EVENT_TYPES.PAYMENT_REFUNDED, async (event: PlatformEvent) => {
      await this.handlePaymentRefunded(event as PlatformEvent<PaymentRefundedData>);
    });

    logger.info('Payment workflow initialized', {
      action: 'WORKFLOW_INITIALIZED',
      workflows: ['payment.completed', 'payment.failed', 'payment.refunded'],
    });
  }

  private getPaymentId(data: PaymentPendingData | PaymentCompletedData | PaymentFailedData | PaymentRefundedData): string {
    return (data.paymentId || '') as string;
  }

  private async handlePaymentPending(event: PlatformEvent<PaymentPendingData>): Promise<void> {
    const data = event.data;
    const paymentId = this.getPaymentId(data);

    logger.info('Workflow: Payment pending', {
      paymentId,
      eventId: event.eventId,
    });

    try {
      const { addJob } = await import('../queue');

      // Log pending payment for audit
      await addJob('audit-queue', 'log_payment', {
        type: 'payment_pending',
        paymentId,
        bookingId: data.bookingId,
        amount: data.amount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Workflow: Payment pending handler failed', {
        paymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePaymentCompleted(event: PlatformEvent<PaymentCompletedData>): Promise<void> {
    const data = event.data;
    const paymentId = this.getPaymentId(data);

    logger.info('Workflow: Payment completed', {
      paymentId,
      eventId: event.eventId,
    });

    try {
      const { addJob } = await import('../queue');

      // Credit wallet if applicable
      if (data.walletCredit && data.userId) {
        await addJob('wallet-queue', 'credit', {
          userId: data.userId,
          amount: data.walletCredit,
          reference: paymentId,
          type: 'payment',
        });
      }

      // Update booking payment status to completed
      if (data.bookingId) {
        await addJob('booking-queue', 'update_status', {
          bookingId: data.bookingId,
          status: 'confirmed',
          paymentId,
        });
      }

      // Award loyalty points
      if (data.userId && data.amount) {
        const pointsEarned = Math.floor(data.amount / 10);
        if (pointsEarned > 0) {
          await addJob('loyalty-queue', 'award_points', {
            userId: data.userId,
            amount: pointsEarned,
            action: 'payment',
          });
        }
      }

      // Update analytics
      await addJob('analytics-queue', 'track_payment', {
        paymentId,
        amount: data.amount,
        currency: data.currency || 'AED',
      });

      // Send receipt
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'payment_receipt',
          metadata: {
            paymentId,
            amount: data.amount,
            bookingId: data.bookingId,
          },
        });
      }
    } catch (error) {
      logger.error('Workflow: Payment completed handler failed', {
        paymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePaymentFailed(event: PlatformEvent<PaymentFailedData>): Promise<void> {
    const data = event.data;
    const paymentId = this.getPaymentId(data);

    logger.warn('Workflow: Payment failed', {
      paymentId,
      error: data.error,
      eventId: event.eventId,
    });

    try {
      const { addJob } = await import('../queue');

      // Update booking status
      if (data.bookingId) {
        await addJob('booking-queue', 'update_status', {
          bookingId: data.bookingId,
          status: 'payment_failed',
        });
      }

      // Notify customer
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'payment_failed',
          metadata: {
            bookingId: data.bookingId,
            error: data.error,
          },
        });
      }

      // Alert on high failure rate
      if (data.shouldAlert) {
        await addJob('alert-queue', 'payment_failure', {
          paymentId,
          error: data.error,
        });
      }
    } catch (error) {
      logger.error('Workflow: Payment failed handler failed', {
        paymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePaymentRefunded(event: PlatformEvent<PaymentRefundedData>): Promise<void> {
    const data = event.data;
    const paymentId = this.getPaymentId(data);

    logger.info('Workflow: Payment refunded', {
      paymentId,
      refundedAmount: data.refundedAmount,
      eventId: event.eventId,
    });

    try {
      const { addJob } = await import('../queue');

      // Send refund confirmation
      if (data.customerEmail) {
        await addJob('email-queue', 'send_email', {
          to: data.customerEmail,
          type: 'refund_confirmation',
          metadata: {
            paymentId,
            refundedAmount: data.refundedAmount,
          },
        });
      }

      // Update analytics
      await addJob('analytics-queue', 'track_refund', {
        paymentId,
        amount: data.refundedAmount,
      });
    } catch (error) {
      logger.error('Workflow: Payment refunded handler failed', {
        paymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const paymentWorkflow = new PaymentWorkflow();
