import CircuitBreaker from 'opossum';
import logger from '../utils/logger';

/**
 * Circuit Breaker Configuration
 * Provides resilience patterns for external service calls
 */

export interface CircuitBreakerConfig {
  timeout?: number; // Time in ms to wait before considering call failed
  errorThresholdPercentage?: number; // % of failures before opening circuit
  resetTimeout?: number; // Time in ms to wait before attempting recovery
  volumeThreshold?: number; // Minimum number of calls before calculating %
  enabled?: boolean; // Allow disabling circuit breakers
}

export interface CircuitBreakerMetrics {
  name: string;
  state: 'closed' | 'open' | 'halfOpen' | 'pendingClose';
  stats: {
    failures: number;
    successes: number;
    fallbacks: number;
    timeouts: number;
    cacheHits: number;
    cacheMisses: number;
    latencyMean: number;
    latencyPercentile99: number;
  };
}

type BreakerOptions = {
  name: string;
  config: Required<CircuitBreakerConfig>;
};

// Store for all circuit breakers
const circuitBreakers = new Map<string, CircuitBreaker>();

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10,
  enabled: process.env.NODE_ENV !== 'test', // Enable in all environments except test
};

/**
 * Get environment-specific circuit breaker configuration
 * Staging has relaxed thresholds to avoid false positives during testing
 */
function getEnvironmentConfig(): Partial<CircuitBreakerConfig> {
  const env = process.env.NODE_ENV;

  if (env === 'staging') {
    return {
      errorThresholdPercentage: 70, // Relaxed: allow more failures before opening
      resetTimeout: 60000, // Longer reset timeout for staging
      volumeThreshold: 5, // Lower volume threshold
      timeout: 10000, // Longer timeout for potentially slower staging services
    };
  }

  if (env === 'production') {
    return {
      errorThresholdPercentage: 50, // Strict: faster circuit opening
      resetTimeout: 30000, // Standard reset timeout
      volumeThreshold: 10, // Standard volume threshold
      timeout: 5000, // Shorter timeout for production responsiveness
    };
  }

  // Development defaults
  return {
    errorThresholdPercentage: 80,
    resetTimeout: 120000,
    volumeThreshold: 3,
    timeout: 15000,
  };
}

/**
 * Create a circuit breaker with the given options
 */
function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: BreakerOptions
): CircuitBreaker {
  const { name, config } = options;

  if (!config.enabled) {
    logger.debug(`Circuit breaker for ${name} is disabled, wrapping function directly`);
    // Return a mock breaker that just passes through
    return {
      fire: fn,
      on: () => {},
      close: () => {},
      status: 'closed',
    } as unknown as CircuitBreaker;
  }

  // Merge environment-specific config with provided config
  const envConfig = getEnvironmentConfig();

  const breakerOptions = {
    timeout: config.timeout || envConfig.timeout || DEFAULT_CONFIG.timeout,
    errorThresholdPercentage: config.errorThresholdPercentage || envConfig.errorThresholdPercentage || DEFAULT_CONFIG.errorThresholdPercentage,
    resetTimeout: config.resetTimeout || envConfig.resetTimeout || DEFAULT_CONFIG.resetTimeout,
    volumeThreshold: config.volumeThreshold || envConfig.volumeThreshold || DEFAULT_CONFIG.volumeThreshold,
    name,
  };

  const breaker = new CircuitBreaker(fn, breakerOptions);

  // Event handlers
  breaker.on('open', () => {
    logger.warn(`Circuit breaker [${name}] OPEN - Service unavailable`, {
      action: 'CIRCUIT_OPEN',
      service: name,
      resetTimeout: config.resetTimeout,
    });
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker [${name}] HALF-OPEN - Testing service`, {
      action: 'CIRCUIT_HALF_OPEN',
      service: name,
    });
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker [${name}] CLOSED - Service recovered`, {
      action: 'CIRCUIT_CLOSE',
      service: name,
    });
  });

  breaker.on('fallback', () => {
    logger.warn(`Circuit breaker [${name}] fallback triggered`, {
      action: 'CIRCUIT_FALLBACK',
      service: name,
    });
  });

  breaker.on('timeout', () => {
    logger.warn(`Circuit breaker [${name}] timeout`, {
      action: 'CIRCUIT_TIMEOUT',
      service: name,
    });
  });

  breaker.on('reject', () => {
    logger.warn(`Circuit breaker [${name}] rejected call`, {
      action: 'CIRCUIT_REJECT',
      service: name,
    });
  });

  breaker.on('failure', (err) => {
    logger.error(`Circuit breaker [${name}] failure`, {
      action: 'CIRCUIT_FAILURE',
      service: name,
      error: (err as Error)?.message,
    });
  });

  circuitBreakers.set(name, breaker);
  return breaker;
}

/**
 * Get the current state of a breaker
 */
function getBreakerState(breaker: CircuitBreaker): 'closed' | 'open' | 'halfOpen' | 'pendingClose' {
  if (breaker.opened) return 'open';
  if (breaker.halfOpen) return 'halfOpen';
  if (breaker.pendingClose) return 'pendingClose';
  return 'closed';
}

/**
 * Create a circuit breaker wrapper for Stripe operations
 */
export function createStripeBreaker<T extends (...args: any[]) => Promise<any>>(fn: T): CircuitBreaker {
  return createCircuitBreaker(fn, {
    name: 'stripe',
    config: {
      ...DEFAULT_CONFIG,
      timeout: parseInt(process.env.CIRCUIT_BREAKER_STRIPE_TIMEOUT || '5000'),
      errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_STRIPE_ERROR_THRESHOLD || '50'),
    },
  });
}

/**
 * Create a circuit breaker wrapper for email operations
 */
export function createEmailBreaker<T extends (...args: any[]) => Promise<any>>(fn: T): CircuitBreaker {
  return createCircuitBreaker(fn, {
    name: 'email',
    config: {
      ...DEFAULT_CONFIG,
      timeout: parseInt(process.env.CIRCUIT_BREAKER_EMAIL_TIMEOUT || '10000'),
      errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_EMAIL_ERROR_THRESHOLD || '30'),
    },
  });
}

/**
 * Create a circuit breaker wrapper for Cloudinary operations
 */
export function createCloudinaryBreaker<T extends (...args: any[]) => Promise<any>>(fn: T): CircuitBreaker {
  return createCircuitBreaker(fn, {
    name: 'cloudinary',
    config: {
      ...DEFAULT_CONFIG,
      timeout: parseInt(process.env.CIRCUIT_BREAKER_CLOUDINARY_TIMEOUT || '10000'),
      errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_CLOUDINARY_ERROR_THRESHOLD || '50'),
    },
  });
}

/**
 * Create a circuit breaker wrapper for MeiliSearch operations
 */
export function createSearchBreaker<T extends (...args: any[]) => Promise<any>>(fn: T): CircuitBreaker {
  return createCircuitBreaker(fn, {
    name: 'meilisearch',
    config: {
      ...DEFAULT_CONFIG,
      timeout: parseInt(process.env.CIRCUIT_BREAKER_SEARCH_TIMEOUT || '3000'),
      errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_SEARCH_ERROR_THRESHOLD || '50'),
    },
  });
}

/**
 * Create a circuit breaker wrapper for Redis operations
 */
export function createRedisBreaker<T extends (...args: any[]) => Promise<any>>(fn: T): CircuitBreaker {
  return createCircuitBreaker(fn, {
    name: 'redis',
    config: {
      ...DEFAULT_CONFIG,
      timeout: parseInt(process.env.CIRCUIT_BREAKER_REDIS_TIMEOUT || '1000'),
      errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_REDIS_ERROR_THRESHOLD || '50'),
    },
  });
}

/**
 * Create a circuit breaker wrapper for any external service
 */
export function createExternalServiceBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  serviceName: string
): CircuitBreaker {
  return createCircuitBreaker(fn, {
    name: serviceName,
    config: DEFAULT_CONFIG,
  });
}

/**
 * Get all circuit breaker metrics
 */
export function getAllBreakerMetrics(): CircuitBreakerMetrics[] {
  const metrics: CircuitBreakerMetrics[] = [];

  for (const [name, breaker] of circuitBreakers.entries()) {
    const stats = breaker.stats;
    metrics.push({
      name,
      state: getBreakerState(breaker),
      stats: {
        failures: stats.failures,
        successes: stats.successes,
        fallbacks: stats.fallbacks,
        timeouts: stats.timeouts,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        latencyMean: stats.latencyMean || 0,
        latencyPercentile99: stats.percentiles?.[99] || 0,
      },
    });
  }

  return metrics;
}

/**
 * Get metrics for a specific circuit breaker
 */
export function getBreakerMetrics(name: string): CircuitBreakerMetrics | null {
  const breaker = circuitBreakers.get(name);
  if (!breaker) return null;

  const stats = breaker.stats;
  return {
    name,
    state: getBreakerState(breaker),
    stats: {
      failures: stats.failures,
      successes: stats.successes,
      fallbacks: stats.fallbacks,
      timeouts: stats.timeouts,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      latencyMean: stats.latencyMean || 0,
      latencyPercentile99: stats.percentiles?.[99] || 0,
    },
  };
}

/**
 * Get health status of all circuit breakers
 */
export function getCircuitBreakerHealth(): {
  healthy: boolean;
  breakers: Array<{
    name: string;
    state: 'closed' | 'open' | 'halfOpen' | 'pendingClose';
    healthy: boolean;
  }>;
} {
  const breakers: Array<{
    name: string;
    state: 'closed' | 'open' | 'halfOpen' | 'pendingClose';
    healthy: boolean;
  }> = [];

  let healthy = true;

  for (const [name, breaker] of circuitBreakers.entries()) {
    const state = getBreakerState(breaker);
    const isHealthy = state !== 'open';
    breakers.push({
      name,
      state,
      healthy: isHealthy,
    });

    if (!isHealthy) healthy = false;
  }

  return { healthy, breakers };
}

/**
 * Reset a specific circuit breaker
 */
export function resetCircuitBreaker(name: string): boolean {
  const breaker = circuitBreakers.get(name);
  if (!breaker) return false;

  breaker.close();
  logger.info(`Circuit breaker [${name}] manually reset`, {
    action: 'CIRCUIT_RESET',
    service: name,
  });

  return true;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  for (const [name, breaker] of circuitBreakers.entries()) {
    breaker.close();
    logger.info(`Circuit breaker [${name}] reset`, {
      action: 'CIRCUIT_RESET',
      service: name,
    });
  }
}

export default {
  createStripeBreaker,
  createEmailBreaker,
  createCloudinaryBreaker,
  createSearchBreaker,
  createRedisBreaker,
  createExternalServiceBreaker,
  getAllBreakerMetrics,
  getBreakerMetrics,
  getCircuitBreakerHealth,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
};
