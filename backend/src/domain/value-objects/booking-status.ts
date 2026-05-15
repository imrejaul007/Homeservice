/**
 * Booking Status Value Object
 *
 * Immutable value object representing booking status with state machine logic.
 * Encapsulates valid transitions and business rules.
 *
 * @module domain/value-objects/booking-status
 */

/**
 * Booking status enum
 */
export enum BookingStatusValue {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/**
 * Status update actor
 */
export enum StatusActor {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<BookingStatusValue, BookingStatusValue[]> = {
  [BookingStatusValue.PENDING]: [
    BookingStatusValue.CONFIRMED,
    BookingStatusValue.CANCELLED,
  ],
  [BookingStatusValue.CONFIRMED]: [
    BookingStatusValue.IN_PROGRESS,
    BookingStatusValue.CANCELLED,
    BookingStatusValue.NO_SHOW,
  ],
  [BookingStatusValue.IN_PROGRESS]: [
    BookingStatusValue.COMPLETED,
    BookingStatusValue.CANCELLED,
  ],
  [BookingStatusValue.COMPLETED]: [], // Terminal state
  [BookingStatusValue.CANCELLED]: [], // Terminal state
  [BookingStatusValue.NO_SHOW]: [], // Terminal state
};

/**
 * Status display information
 */
const STATUS_INFO: Record<BookingStatusValue, { label: string; color: string; icon: string }> = {
  [BookingStatusValue.PENDING]: {
    label: 'Pending',
    color: 'yellow',
    icon: 'clock',
  },
  [BookingStatusValue.CONFIRMED]: {
    label: 'Confirmed',
    color: 'blue',
    icon: 'check-circle',
  },
  [BookingStatusValue.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'purple',
    icon: 'play-circle',
  },
  [BookingStatusValue.COMPLETED]: {
    label: 'Completed',
    color: 'green',
    icon: 'check-square',
  },
  [BookingStatusValue.CANCELLED]: {
    label: 'Cancelled',
    color: 'red',
    icon: 'x-circle',
  },
  [BookingStatusValue.NO_SHOW]: {
    label: 'No Show',
    color: 'gray',
    icon: 'user-x',
  },
};

/**
 * Booking status value object class
 */
export class BookingStatusVO {
  private readonly _status: BookingStatusValue;

  private constructor(status: BookingStatusValue) {
    this._status = status;
  }

  /**
   * Create from string value
   */
  static fromString(value: string): BookingStatusVO {
    const status = value as BookingStatusValue;
    if (!Object.values(BookingStatusValue).includes(status)) {
      throw new Error(`Invalid booking status: ${value}`);
    }
    return new BookingStatusVO(status);
  }

  /**
   * Create pending status
   */
  static pending(): BookingStatusVO {
    return new BookingStatusVO(BookingStatusValue.PENDING);
  }

  /**
   * Create confirmed status
   */
  static confirmed(): BookingStatusVO {
    return new BookingStatusVO(BookingStatusValue.CONFIRMED);
  }

  /**
   * Create in-progress status
   */
  static inProgress(): BookingStatusVO {
    return new BookingStatusVO(BookingStatusValue.IN_PROGRESS);
  }

  /**
   * Create completed status
   */
  static completed(): BookingStatusVO {
    return new BookingStatusVO(BookingStatusValue.COMPLETED);
  }

  /**
   * Create cancelled status
   */
  static cancelled(): BookingStatusVO {
    return new BookingStatusVO(BookingStatusValue.CANCELLED);
  }

  /**
   * Create no-show status
   */
  static noShow(): BookingStatusVO {
    return new BookingStatusVO(BookingStatusValue.NO_SHOW);
  }

  // Getters
  get value(): BookingStatusValue {
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

  /**
   * Check if status is terminal (no further transitions possible)
   */
  isTerminal(): boolean {
    return VALID_TRANSITIONS[this._status].length === 0;
  }

  /**
   * Check if transition to another status is valid
   */
  canTransitionTo(target: BookingStatusVO): boolean {
    if (this.isTerminal()) {
      return false;
    }
    return VALID_TRANSITIONS[this._status].includes(target._status);
  }

  /**
   * Get list of valid transitions from current status
   */
  getValidTransitions(): BookingStatusVO[] {
    return VALID_TRANSITIONS[this._status].map((s) => new BookingStatusVO(s));
  }

  /**
   * Check if customer can perform action
   */
  canCustomerAction(): boolean {
    return [BookingStatusValue.PENDING, BookingStatusValue.CONFIRMED].includes(this._status);
  }

  /**
   * Check if provider can perform action
   */
  canProviderAction(): boolean {
    return [
      BookingStatusValue.PENDING,
      BookingStatusValue.CONFIRMED,
      BookingStatusValue.IN_PROGRESS,
    ].includes(this._status);
  }

  /**
   * Check if booking is active (not terminal)
   */
  isActive(): boolean {
    return !this.isTerminal();
  }

  /**
   * Check if booking is completed
   */
  isCompleted(): boolean {
    return this._status === BookingStatusValue.COMPLETED;
  }

  /**
   * Check if booking is cancelled
   */
  isCancelled(): boolean {
    return this._status === BookingStatusValue.CANCELLED;
  }

  /**
   * Check equality
   */
  equals(other: BookingStatusVO): boolean {
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
 * Check if actor can perform transition
 */
export function canActorTransition(
  status: BookingStatusValue,
  targetStatus: BookingStatusValue,
  actor: StatusActor
): boolean {
  // Define allowed transitions per actor
  const actorTransitions: Record<StatusActor, Record<BookingStatusValue, BookingStatusValue[]>> = {
    [StatusActor.CUSTOMER]: {
      [BookingStatusValue.PENDING]: [BookingStatusValue.CANCELLED],
      [BookingStatusValue.CONFIRMED]: [BookingStatusValue.CANCELLED],
      [BookingStatusValue.IN_PROGRESS]: [],
      [BookingStatusValue.COMPLETED]: [],
      [BookingStatusValue.CANCELLED]: [],
      [BookingStatusValue.NO_SHOW]: [],
    },
    [StatusActor.PROVIDER]: {
      [BookingStatusValue.PENDING]: [BookingStatusValue.CONFIRMED, BookingStatusValue.CANCELLED],
      [BookingStatusValue.CONFIRMED]: [BookingStatusValue.IN_PROGRESS, BookingStatusValue.CANCELLED, BookingStatusValue.NO_SHOW],
      [BookingStatusValue.IN_PROGRESS]: [BookingStatusValue.COMPLETED],
      [BookingStatusValue.COMPLETED]: [],
      [BookingStatusValue.CANCELLED]: [],
      [BookingStatusValue.NO_SHOW]: [],
    },
    [StatusActor.SYSTEM]: {
      [BookingStatusValue.PENDING]: [BookingStatusValue.CONFIRMED, BookingStatusValue.CANCELLED],
      [BookingStatusValue.CONFIRMED]: [BookingStatusValue.CANCELLED, BookingStatusValue.NO_SHOW],
      [BookingStatusValue.IN_PROGRESS]: [BookingStatusValue.COMPLETED],
      [BookingStatusValue.COMPLETED]: [],
      [BookingStatusValue.CANCELLED]: [],
      [BookingStatusValue.NO_SHOW]: [],
    },
    [StatusActor.ADMIN]: {
      [BookingStatusValue.PENDING]: Object.values(BookingStatusValue) as BookingStatusValue[],
      [BookingStatusValue.CONFIRMED]: Object.values(BookingStatusValue) as BookingStatusValue[],
      [BookingStatusValue.IN_PROGRESS]: Object.values(BookingStatusValue) as BookingStatusValue[],
      [BookingStatusValue.COMPLETED]: [], // Admin cannot change completed
      [BookingStatusValue.CANCELLED]: [], // Admin cannot change cancelled
      [BookingStatusValue.NO_SHOW]: [], // Admin cannot change no-show
    },
  };

  return actorTransitions[actor][status].includes(targetStatus);
}

/**
 * Get human-readable transition description
 */
export function getTransitionDescription(
  from: BookingStatusValue,
  to: BookingStatusValue,
  actor: StatusActor
): string {
  const descriptions: Record<string, string> = {
    'pending_confirmed_provider': 'Provider accepted the booking',
    'pending_cancelled_customer': 'Customer cancelled the booking',
    'pending_cancelled_provider': 'Provider declined the booking',
    'confirmed_in_progress_provider': 'Provider started the service',
    'confirmed_cancelled_customer': 'Customer cancelled the booking',
    'confirmed_cancelled_provider': 'Provider cancelled the booking',
    'confirmed_no_show_provider': 'Customer did not show up',
    'in_progress_completed_provider': 'Provider completed the service',
    'in_progress_cancelled_provider': 'Provider cancelled the booking',
  };

  const key = `${from}_${to}_${actor}`;
  return descriptions[key] || `Booking status changed from ${from} to ${to}`;
}
