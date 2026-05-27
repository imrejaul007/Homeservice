/**
 * Payment Status Value Object
 *
 * Immutable value object representing payment status with state machine logic.
 * Encapsulates valid transitions and business rules.
 *
 * @module domain/value-objects/payment-status
 */

/**
 * Payment status enum
 */
export enum PaymentStatusValue {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

/**
 * Payment status display information
 */
const STATUS_INFO: Record<PaymentStatusValue, { label: string; color: string; icon: string; description: string }> = {
  [PaymentStatusValue.PENDING]: {
    label: 'Pending',
    color: 'yellow',
    icon: 'clock',
    description: 'Payment has not been initiated',
  },
  [PaymentStatusValue.PROCESSING]: {
    label: 'Processing',
    color: 'blue',
    icon: 'loader',
    description: 'Payment is being processed',
  },
  [PaymentStatusValue.COMPLETED]: {
    label: 'Completed',
    color: 'green',
    icon: 'check-circle',
    description: 'Payment has been successfully completed',
  },
  [PaymentStatusValue.FAILED]: {
    label: 'Failed',
    color: 'red',
    icon: 'x-circle',
    description: 'Payment failed',
  },
  [PaymentStatusValue.REFUNDED]: {
    label: 'Refunded',
    color: 'orange',
    icon: 'rotate-ccw',
    description: 'Full refund has been processed',
  },
  [PaymentStatusValue.PARTIALLY_REFUNDED]: {
    label: 'Partially Refunded',
    color: 'amber',
    icon: 'split',
    description: 'Partial refund has been processed',
  },
};

/**
 * Valid payment status transitions
 * Defines which status transitions are allowed
 */
const VALID_TRANSITIONS: Record<PaymentStatusValue, PaymentStatusValue[]> = {
  [PaymentStatusValue.PENDING]: [
    PaymentStatusValue.PROCESSING,
    PaymentStatusValue.FAILED,
  ],
  [PaymentStatusValue.PROCESSING]: [
    PaymentStatusValue.COMPLETED,
    PaymentStatusValue.FAILED,
  ],
  [PaymentStatusValue.COMPLETED]: [
    PaymentStatusValue.REFUNDED,
    PaymentStatusValue.PARTIALLY_REFUNDED,
  ],
  [PaymentStatusValue.FAILED]: [], // Terminal state for failed payments
  [PaymentStatusValue.REFUNDED]: [], // Terminal state
  [PaymentStatusValue.PARTIALLY_REFUNDED]: [
    PaymentStatusValue.REFUNDED, // Can transition to fully refunded
    PaymentStatusValue.PARTIALLY_REFUNDED, // Can have multiple partial refunds
  ],
};

/**
 * Payment status value object class
 */
export class PaymentStatusVO {
  private readonly _status: PaymentStatusValue;

  private constructor(status: PaymentStatusValue) {
    this._status = status;
  }

  /**
   * Create from string value
   */
  static fromString(value: string): PaymentStatusVO {
    const status = value as PaymentStatusValue;
    if (!Object.values(PaymentStatusValue).includes(status)) {
      throw new Error(`Invalid payment status: ${value}`);
    }
    return new PaymentStatusVO(status);
  }

  /**
   * Create pending status
   */
  static pending(): PaymentStatusVO {
    return new PaymentStatusVO(PaymentStatusValue.PENDING);
  }

  /**
   * Create processing status
   */
  static processing(): PaymentStatusVO {
    return new PaymentStatusVO(PaymentStatusValue.PROCESSING);
  }

  /**
   * Create completed status
   */
  static completed(): PaymentStatusVO {
    return new PaymentStatusVO(PaymentStatusValue.COMPLETED);
  }

  /**
   * Create failed status
   */
  static failed(): PaymentStatusVO {
    return new PaymentStatusVO(PaymentStatusValue.FAILED);
  }

  /**
   * Create refunded status
   */
  static refunded(): PaymentStatusVO {
    return new PaymentStatusVO(PaymentStatusValue.REFUNDED);
  }

  /**
   * Create partially refunded status
   */
  static partiallyRefunded(): PaymentStatusVO {
    return new PaymentStatusVO(PaymentStatusValue.PARTIALLY_REFUNDED);
  }

  // Getters
  get value(): PaymentStatusValue {
    return this._status;
  }

  get label(): string {
    return STATUS_INFO[this._status].label;
  }

  get color(): string {
    return STATUS_INFO[this._status].color;
  }

  get icon(): string {
    return STATUS_INFO[this._status].icon;
  }

  get description(): string {
    return STATUS_INFO[this._status].description;
  }

  /**
   * Check if status is terminal (no further transitions possible)
   */
  isTerminal(): boolean {
    return VALID_TRANSITIONS[this._status].length === 0;
  }

  /**
   * Check if transition to another status is valid
   */
  canTransitionTo(target: PaymentStatusVO): boolean {
    if (this.isTerminal()) {
      return false;
    }
    return VALID_TRANSITIONS[this._status].includes(target._status);
  }

  /**
   * Get list of valid transitions from current status
   */
  getValidTransitions(): PaymentStatusVO[] {
    return VALID_TRANSITIONS[this._status].map((s) => new PaymentStatusVO(s));
  }

  /**
   * Check if payment is successful (completed)
   */
  isSuccessful(): boolean {
    return this._status === PaymentStatusValue.COMPLETED;
  }

  /**
   * Check if payment is pending
   */
  isPending(): boolean {
    return this._status === PaymentStatusValue.PENDING;
  }

  /**
   * Check if payment is processing
   */
  isProcessing(): boolean {
    return this._status === PaymentStatusValue.PROCESSING;
  }

  /**
   * Check if payment failed
   */
  isFailed(): boolean {
    return this._status === PaymentStatusValue.FAILED;
  }

  /**
   * Check if fully refunded
   */
  isRefunded(): boolean {
    return this._status === PaymentStatusValue.REFUNDED;
  }

  /**
   * Check if partially refunded
   */
  isPartiallyRefunded(): boolean {
    return this._status === PaymentStatusValue.PARTIALLY_REFUNDED;
  }

  /**
   * Check if refund has been initiated
   */
  hasRefundInitiated(): boolean {
    return this._status === PaymentStatusValue.REFUNDED ||
           this._status === PaymentStatusValue.PARTIALLY_REFUNDED;
  }

  /**
   * Check if payment can be refunded
   */
  canBeRefunded(): boolean {
    return this._status === PaymentStatusValue.COMPLETED;
  }

  /**
   * Check if payment is active (can proceed with processing)
   */
  isActive(): boolean {
    return this._status === PaymentStatusValue.PENDING ||
           this._status === PaymentStatusValue.PROCESSING;
  }

  /**
   * Check equality
   */
  equals(other: PaymentStatusVO): boolean {
    return this._status === other._status;
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this._status;
  }

  /**
   * Convert to JSON
   */
  toJSON(): string {
    return this._status;
  }
}

/**
 * Get human-readable transition description
 */
export function getPaymentTransitionDescription(
  from: PaymentStatusValue,
  to: PaymentStatusValue
): string {
  const descriptions: Record<string, string> = {
    'pending_processing': 'Payment processing initiated',
    'pending_failed': 'Payment failed',
    'processing_completed': 'Payment completed successfully',
    'processing_failed': 'Payment processing failed',
    'completed_refunded': 'Full refund processed',
    'completed_partially_refunded': 'Partial refund processed',
    'partially_refunded_refunded': 'Remaining balance refunded',
  };

  const key = `${from}_${to}`;
  return descriptions[key] || `Payment status changed from ${from} to ${to}`;
}

/**
 * Check if a payment status transition is valid
 */
export function isValidPaymentTransition(
  from: PaymentStatusValue,
  to: PaymentStatusValue
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get all possible payment statuses
 */
export function getAllPaymentStatuses(): PaymentStatusValue[] {
  return Object.values(PaymentStatusValue);
}
