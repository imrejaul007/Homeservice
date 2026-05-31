/**
 * Circuit Breaker Module
 *
 * DEPRECATED: This file is kept for backward compatibility.
 * All circuit breaker functionality has been moved to circuitBreaker.service.ts.
 * New code should import directly from circuitBreaker.service.ts.
 *
 * @deprecated Use circuitBreaker.service.ts instead
 */

// Re-export everything from the service file for backward compatibility
export {
  CircuitBreaker,
  CircuitState,
  circuitBreakers,
  CIRCUIT_NAMES,
  createCircuitBreaker,
  withCircuitBreaker,
  circuitBreaker,
  getAllCircuitBreakerStats,
  getAllBreakerMetrics,
  getBreakerMetrics,
  getCircuitBreakerHealth,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
} from './circuitBreaker.service';

// Re-export types for backward compatibility
export type { CircuitBreakerConfig, CircuitBreakerStats, CircuitBreakerMetrics } from './circuitBreaker.service';
