import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
  name: string;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  lastStateChange: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private lastStateChange = new Date();
  private halfOpenAttempts = 0;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // Check if circuit allows request
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        logger.warn(`Circuit [${this.config.name}] is OPEN, using fallback`);
        if (fallback) return fallback();
        throw new ApiError(503, `Circuit [${this.config.name}] is OPEN`, [], ERROR_CODES.EXTERNAL_SERVICE_ERROR);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        logger.warn(`Circuit [${this.config.name}] failed, using fallback`);
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    this.lastSuccess = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    logger.debug(`Circuit [${this.config.name}] success`, {
      state: this.state,
      successCount: this.successCount
    });
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailure = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }

    logger.warn(`Circuit [${this.config.name}] failure`, {
      state: this.state,
      failureCount: this.failureCount
    });
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return true;
    const elapsed = Date.now() - this.lastFailure.getTime();
    return elapsed >= this.config.resetTimeout;
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();
    this.halfOpenAttempts = 0;

    if (newState === CircuitState.OPEN) {
      this.scheduleReset();
    }

    logger.info(`Circuit [${this.config.name}] state change`, {
      from: oldState,
      to: newState
    });
  }

  private scheduleReset(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }, this.config.resetTimeout);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      lastStateChange: this.lastStateChange,
      totalRequests: this.failureCount + this.successCount,
      totalFailures: this.failureCount,
      totalSuccesses: this.successCount,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.lastStateChange = new Date();
    this.halfOpenAttempts = 0;
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
}

// Pre-configured circuit breakers for different services
export const circuitBreakers = new Map<string, CircuitBreaker>();

// Circuit names enum for type-safe references
export const CIRCUIT_NAMES = {
  PAYMENT: 'payment',
  AI_PREDICTION: 'ai_prediction',
  AI_RECOMMENDATION: 'ai_recommendation',
  AI_CHURN: 'ai_churn',
  AI_DEMAND: 'ai_demand',
  AI_SMART_PRICING: 'ai_smart_pricing',
  NOTIFICATION: 'notification',
  EMAIL: 'email',
  SMS: 'sms',
  EXTERNAL_API: 'external_api',
} as const;

export type CircuitName = typeof CIRCUIT_NAMES[keyof typeof CIRCUIT_NAMES];

// CircuitBreakerMetrics is an alias for CircuitBreakerStats
export type CircuitBreakerMetrics = CircuitBreakerStats;

// Placeholder for circuitBreaker - will be defined after getAllCircuitBreakerStats
export const circuitBreaker = {
  execute: async <T>(name: string, fn: () => Promise<T>, fallback?: () => Promise<T>) => {
    return withCircuitBreaker(name, fn, fallback);
  },
  getStats: (): CircuitBreakerStats[] => getAllCircuitBreakerStats(),
  getHealthStatus: () => {
    const stats = getAllCircuitBreakerStats();
    const allClosed = stats.every(s => s.state === CircuitState.CLOSED);
    const anyOpen = stats.some(s => s.state === CircuitState.OPEN);
    const openCircuits = stats.filter(s => s.state === CircuitState.OPEN);
    const halfOpenCircuits = stats.filter(s => s.state === CircuitState.HALF_OPEN);
    return {
      healthy: allClosed,
      degraded: anyOpen || halfOpenCircuits.length > 0,
      down: openCircuits.map(s => s.name),
      circuitStates: stats.map(s => ({ name: s.name, state: s.state })),
      total: stats.length,
      open: openCircuits.length,
      halfOpen: halfOpenCircuits.length,
    };
  },
  getAllMetrics: (): CircuitBreakerStats[] => getAllCircuitBreakerStats(),
  reset: (name?: string) => {
    if (name) {
      const cb = circuitBreakers.get(name);
      if (cb) cb.reset();
    } else {
      circuitBreakers.forEach(cb => cb.reset());
    }
  },
  resetAll: () => {
    circuitBreakers.forEach(cb => cb.reset());
  }
};

export const createCircuitBreaker = (name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker => {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenMaxAttempts: 2,
    name,
  };

  const circuit = new CircuitBreaker({ ...defaultConfig, ...config, name });
  circuitBreakers.set(name, circuit);
  return circuit;
};

// Helper to wrap functions with circuit breaker
export const withCircuitBreaker = <T>(
  name: string,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> => {
  let circuit = circuitBreakers.get(name);
  if (!circuit) {
    circuit = createCircuitBreaker(name, config);
  }
  return circuit.execute(fn, fallback);
};

// Get all circuit breaker stats
export const getAllCircuitBreakerStats = (): CircuitBreakerStats[] => {
  return Array.from(circuitBreakers.values()).map(cb => cb.getStats());
};
