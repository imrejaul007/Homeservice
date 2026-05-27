import { eventBus, EventTypes, DomainEvent } from '../events/eventBus';
import { addJob } from '../queue';
import logger from '../utils/logger';

class PaymentWorkflow {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.subscribe(EventTypes.PAYMENT_PENDING, async (event) => {
      await this.handlePaymentPending(event);
    });

    eventBus.subscribe(EventTypes.PAYMENT_COMPLETED, async (event) => {
      await this.handlePaymentCompleted(event);
    });

    eventBus.subscribe(EventTypes.PAYMENT_FAILED, async (event) => {
      await this.handlePaymentFailed(event);
    });

    eventBus.subscribe(EventTypes.PAYMENT_REFUNDED, async (event) => {
      await this.handlePaymentRefunded(event);
    });
  }

  private async handlePaymentPending(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Payment pending', { paymentId: event.payload.paymentId });

    // Log pending payment for audit
    await addJob('audit', 'log-payment', {
      type: 'payment_pending',
      paymentId: event.payload.paymentId,
      bookingId: event.payload.bookingId,
      amount: event.payload.amount,
      timestamp: new Date().toISOString(),
    });
  }

  private async handlePaymentCompleted(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Payment completed', { paymentId: event.payload.paymentId });

    // Credit wallet
    if (event.payload.walletCredit) {
      await addJob('wallet', 'credit', {
        userId: event.payload.userId,
        amount: event.payload.walletCredit,
        reference: event.payload.paymentId,
        type: 'payment',
      });
    }

    // Update booking payment status to completed
    await addJob('bookings', 'update-status', {
      bookingId: event.payload.bookingId,
      status: 'completed',
      paymentId: event.payload.paymentId,
    });

    // Award loyalty points
    await addJob('loyalty', 'award-points', {
      customerId: event.payload.userId,
      amount: event.payload.amount,
      action: 'payment',
    });

    // Update analytics
    await addJob('analytics', 'track-payment', {
      paymentId: event.payload.paymentId,
      amount: event.payload.amount,
      currency: event.payload.currency || 'AED',
    });

    // Send receipt
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'payment-receipt',
      data: {
        paymentId: event.payload.paymentId,
        amount: event.payload.amount,
        bookingId: event.payload.bookingId,
      },
    });
  }

  private async handlePaymentFailed(event: DomainEvent): Promise<void> {
    logger.warn('Workflow: Payment failed', {
      paymentId: event.payload.paymentId,
      error: event.payload.error,
    });

    // Update booking status
    await addJob('bookings', 'update-status', {
      bookingId: event.payload.bookingId,
      status: 'payment_failed',
    });

    // Notify customer
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'payment-failed',
      data: {
        bookingId: event.payload.bookingId,
        error: event.payload.error,
      },
    });

    // Alert on high failure rate
    if (event.payload.shouldAlert) {
      await addJob('alerts', 'payment-failure', {
        paymentId: event.payload.paymentId,
        error: event.payload.error,
      });
    }
  }

  private async handlePaymentRefunded(event: DomainEvent): Promise<void> {
    logger.info('Workflow: Payment refunded', { paymentId: event.payload.paymentId });

    // Send refund confirmation
    await addJob('notifications', 'send-email', {
      to: event.payload.customerEmail,
      template: 'refund-confirmation',
      data: {
        paymentId: event.payload.paymentId,
        amount: event.payload.refundedAmount,
      },
    });

    // Update analytics
    await addJob('analytics', 'track-refund', {
      paymentId: event.payload.paymentId,
      amount: event.payload.refundedAmount,
    });
  }
}

export const paymentWorkflow = new PaymentWorkflow();
