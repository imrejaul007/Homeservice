/**
 * Circuit Breaker Utility
 *
 * Prevents cascading failures when external services (payment gateways, notification APIs, etc.)
 * are experiencing issues. Uses a finite state machine with closed/open/half-open states.
 *
 * State transitions:
 * - CLOSED -> OPEN: After threshold consecutive failures
 * - OPEN -> HALF_OPEN: After timeout duration
 * - HALF_OPEN -> CLOSED: After successful call
 * - HALF_OPEN -> OPEN: After failed call
 */

import logger from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  threshold?: number;
  /** Time in ms before attempting to close circuit (default: 60000 = 1 minute) */
  timeout?: number;
  /** Number of successful calls needed to close circuit from half-open (default: 1) */
  successThreshold?: number;
  /** Monitor window in ms - resets failure count after this time (default: 30000) */
  monitorWindow?: number;
  /** Name for logging purposes */
  name?: string;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

const defaultOptions: Required<CircuitBreakerOptions> = {
  threshold: 5,
  timeout: 60000,
  successThreshold: 1,
  monitorWindow: 30000,
  name: 'CircuitBreaker',
};

/**
 * CircuitBreaker class for protecting external service calls
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;
  private totalCalls: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private halfOpenAttempts: number = 0;

  private readonly threshold: number;
  private readonly timeout: number;
  private readonly successThreshold: number;
  private readonly monitorWindow: number;
  private readonly name: string;

  private failureTimestamps: number[] = [];

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? defaultOptions.threshold;
    this.timeout = options.timeout ?? defaultOptions.timeout;
    this.successThreshold = options.successThreshold ?? defaultOptions.successThreshold;
    this.monitorWindow = options.monitorWindow ?? defaultOptions.monitorWindow;
    this.name = options.name ?? defaultOptions.name;
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - The async function to execute
   * @returns The result of the function
   * @throws Error with "Circuit breaker is open" message if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitOpenError(
          `Circuit breaker '${this.name}' is OPEN. Service unavailable.`,
          this.name
        );
      }
    }

    // Execute the function
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return true;
    return Date.now() - this.lastFailure >= this.timeout;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccess = Date.now();
    this.totalSuccesses++;

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.transitionToClosed();
        }
        break;

      case CircuitState.CLOSED:
        // Reset failure count on success in closed state
        this.failures = 0;
        this.failureTimestamps = [];
        break;
    }

    logger.debug(`[CircuitBreaker:${this.name}] Success. State: ${this.state}`);
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailure = Date.now();
    this.totalFailures++;
    this.failureTimestamps.push(Date.now());

    // Clean up old failure timestamps outside monitor window
    const cutoff = Date.now() - this.monitorWindow;
    this.failureTimestamps = this.failureTimestamps.filter(t => t > cutoff);

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        this.transitionToOpen();
        break;

      case CircuitState.CLOSED:
        this.failures = this.failureTimestamps.length;
        if (this.failures >= this.threshold) {
          this.transitionToOpen();
        }
        break;
    }

    logger.debug(`[CircuitBreaker:${this.name}] Failure. State: ${this.state}, Failures: ${this.failures}`);
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    if (this.state !== CircuitState.CLOSED) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.successes = 0;
      this.halfOpenAttempts = 0;
      this.failureTimestamps = [];
      logger.info(`[CircuitBreaker:${this.name}] Circuit CLOSED`);
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.successes = 0;
      this.halfOpenAttempts = 0;
      logger.warn(`[CircuitBreaker:${this.name}] Circuit OPEN after ${this.totalFailures} failures`);
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    if (this.state === CircuitState.OPEN) {
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenAttempts++;
      this.successes = 0;
      logger.info(`[CircuitBreaker:${this.name}] Circuit HALF_OPEN (attempt ${this.halfOpenAttempts})`);
    }
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.transitionToClosed();
    this.lastFailure = null;
    this.lastSuccess = null;
    logger.info(`[CircuitBreaker:${this.name}] Circuit manually reset`);
  }

  /**
   * Force the circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.transitionToOpen();
    logger.warn(`[CircuitBreaker:${this.name}] Circuit manually forced OPEN`);
  }

  /**
   * Force the circuit breaker to HALF_OPEN state
   */
  forceHalfOpen(): void {
    this.transitionToHalfOpen();
    logger.info(`[CircuitBreaker:${this.name}] Circuit manually set to HALF_OPEN`);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Check if circuit is currently allowing requests
   */
  isAllowingRequests(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.HALF_OPEN) return true;
    return this.shouldAttemptReset();
  }
}

/**
 * Custom error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  constructor(message: string, public readonly circuitName: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// =============================================================================
// Pre-configured Circuit Breakers
// =============================================================================

/**
 * Circuit breaker for payment processing (Stripe, etc.)
 */
export const paymentCircuitBreaker = new CircuitBreaker({
  threshold: 3,
  timeout: 30000,
  successThreshold: 1,
  name: 'PaymentService',
});

/**
 * Circuit breaker for notification services
 */
export const notificationCircuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 60000,
  successThreshold: 2,
  name: 'NotificationService',
});

/**
 * Circuit breaker for external AI/ML services
 */
export const aiCircuitBreaker = new CircuitBreaker({
  threshold: 3,
  timeout: 45000,
  successThreshold: 1,
  name: 'AIService',
});

/**
 * Circuit breaker for email services
 */
export const emailCircuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 30000,
  successThreshold: 1,
  name: 'EmailService',
});

/**
 * Circuit breaker for SMS services
 */
export const smsCircuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 30000,
  successThreshold: 1,
  name: 'SMSService',
});

/**
 * Circuit breaker for geo-location services
 */
export const geoCircuitBreaker = new CircuitBreaker({
  threshold: 3,
  timeout: 20000,
  successThreshold: 1,
  name: 'GeoService',
});

/**
 * Circuit breaker for storage/CDN services
 */
export const storageCircuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 30000,
  successThreshold: 1,
  name: 'StorageService',
});

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

const circuitBreakers: Map<string, CircuitBreaker> = new Map();

/**
 * Register a circuit breaker with a name
 */
export const registerCircuitBreaker = (name: string, breaker: CircuitBreaker): void => {
  circuitBreakers.set(name, breaker);
};

/**
 * Get a circuit breaker by name
 */
export const getCircuitBreaker = (name: string): CircuitBreaker | undefined => {
  return circuitBreakers.get(name);
};

/**
 * Get all registered circuit breakers' stats
 */
export const getAllCircuitBreakerStats = (): CircuitBreakerStats[] => {
  return Array.from(circuitBreakers.values()).map(cb => cb.getStats());
};

/**
 * Reset all circuit breakers
 */
export const resetAllCircuitBreakers = (): void => {
  circuitBreakers.forEach(cb => cb.reset());
  logger.info('[CircuitBreaker] All circuit breakers reset');
};

// Pre-register common circuit breakers
registerCircuitBreaker('PaymentService', paymentCircuitBreaker);
registerCircuitBreaker('NotificationService', notificationCircuitBreaker);
registerCircuitBreaker('AIService', aiCircuitBreaker);
registerCircuitBreaker('EmailService', emailCircuitBreaker);
registerCircuitBreaker('SMSService', smsCircuitBreaker);
registerCircuitBreaker('GeoService', geoCircuitBreaker);
registerCircuitBreaker('StorageService', storageCircuitBreaker);

export default CircuitBreaker;
