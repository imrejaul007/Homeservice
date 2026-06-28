/**
 * Resilience Middleware for NILIN Platform
 *
 * Central middleware for applying resilience patterns across the API.
 * Includes:
 * - Request timeout handling
 * - Circuit breaker integration
 * - Rate limiting with fallback
 * - Health check endpoints
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { circuitBreaker, CircuitBreakerMetrics, CircuitState, CIRCUIT_NAMES } from '../services/circuitBreaker.service';
import { getFallbackHealthStatus, cleanupFallbackData } from '../services/fallback.service';
import { getDeadLetterStats } from '../utils/retry.util';
import { flushAnalyticsQueue } from '../services/fallback.service';
import { checkRedisConnection, isRedisAvailable } from '../config/redis';
import logger from '../utils/logger';
import mongoose from 'mongoose';

// ============================================
// Health Check Data Types
// ============================================

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastCheck?: Date;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Date;
  uptime: number;
  services: ServiceHealth[];
  circuitBreakers: CircuitBreakerMetrics[];
  queueDepth: {
    analytics: number;
    notifications: number;
    payments: number;
    emails: number;
  };
  cacheHitRate?: number;
  database: {
    status: 'healthy' | 'degraded' | 'down';
    connectionState: string;
    poolSize: number;
    checkedOut: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// ============================================
// Request Timeout Middleware
// ============================================

/**
 * Add timeout handling to requests
 */
export const requestTimeout = (timeoutMs: number = 30000): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout
    req.setTimeout(timeoutMs, () => {
      logger.warn('Request timeout', {
        path: req.path,
        method: req.method,
        timeout: timeoutMs,
        action: 'REQUEST_TIMEOUT',
      });

      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'Gateway Timeout',
          message: 'The request took too long to process',
          code: 'REQUEST_TIMEOUT',
        });
      }
    });

    next();
  };
};

// ============================================
// Circuit Breaker Status Middleware
// ============================================

/**
 * Add circuit breaker status to response headers
 */
export const circuitBreakerHeaders: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const healthStatus = circuitBreaker.getHealthStatus();

  // Add header with count of open circuits
  res.setHeader('X-Circuit-Breaker-Open', healthStatus.open);
  res.setHeader('X-Circuit-Breaker-Degraded', healthStatus.halfOpen);
  res.setHeader('X-Circuit-Breaker-Total', healthStatus.total);

  next();
};

// ============================================
// Degraded Mode Detection
// ============================================

/**
 * Check if the system is in degraded mode
 */
export function isDegradedMode(): boolean {
  const healthStatus = circuitBreaker.getHealthStatus();

  // System is degraded if more than 50% of circuits are down
  if (healthStatus.down.length > healthStatus.total / 2) {
    return true;
  }

  // Or if specific critical circuits are down (use actual circuit names from CIRCUIT_NAMES)
  const criticalCircuits = [
    CIRCUIT_NAMES.PAYMENT,
    CIRCUIT_NAMES.NOTIFICATION,
    CIRCUIT_NAMES.SMS,
  ];
  const criticalDown = criticalCircuits.filter(c => healthStatus.down.includes(c));

  return criticalDown.length > 0;
}

/**
 * Add degradation info to responses
 */
export const degradationMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (isDegradedMode()) {
    res.setHeader('X-System-Degraded', 'true');
    res.setHeader('X-Degraded-At', new Date().toISOString());

    logger.warn('System operating in degraded mode', {
      path: req.path,
      action: 'DEGRADED_MODE',
    });
  }

  next();
};

// ============================================
// Comprehensive Health Check
// ============================================

/**
 * Get comprehensive system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const startTime = Date.now();

  // Get memory info
  const memUsage = process.memoryUsage();
  const memTotal = memUsage.heapTotal;
  const memUsed = memUsage.heapUsed;
  const memPercentage = (memUsed / memTotal) * 100;

  // Get database status
  let dbStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
  let dbConnectionState = 'connected';
  let poolSize = 0;
  let checkedOut = 0;

  try {
    if (mongoose.connection.readyState === 1) {
      dbStatus = 'healthy';
      dbConnectionState = 'connected';
      const pool = (mongoose.connection as any).pool;
      poolSize = pool?.size() || 0;
      checkedOut = pool?.checkedOut?.length || 0;
    } else if (mongoose.connection.readyState === 2) {
      dbStatus = 'degraded';
      dbConnectionState = 'connecting';
    } else {
      dbStatus = 'down';
      dbConnectionState = 'disconnected';
    }
  } catch (error) {
    dbStatus = 'down';
    dbConnectionState = 'error';
  }

  // Get Redis status
  let redisStatus: ServiceHealth = {
    name: 'redis',
    status: 'healthy',
    lastCheck: new Date(),
  };

  try {
    const redisAvailable = await checkRedisConnection();
    redisStatus = {
      name: 'redis',
      status: redisAvailable ? 'healthy' : 'down',
      lastCheck: new Date(),
    };
  } catch (error) {
    redisStatus = {
      name: 'redis',
      status: 'down',
      lastCheck: new Date(),
      details: { error: (error as Error).message },
    };
  }

  // Get circuit breaker status
  const circuitMetrics = circuitBreaker.getAllMetrics();

  // Get fallback queue depths
  const fallbackStatus = getFallbackHealthStatus();

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

  if (dbStatus === 'down' || redisStatus.status === 'down') {
    overallStatus = 'degraded';
  }

  const healthStatus = circuitBreaker.getHealthStatus();
  if (healthStatus.down.length > healthStatus.total / 2) {
    overallStatus = 'degraded';
  }

  if (dbStatus === 'down' && redisStatus.status === 'down') {
    overallStatus = 'down';
  }

  return {
    status: overallStatus,
    timestamp: new Date(),
    uptime: process.uptime() * 1000,
    services: [
      {
        name: 'database',
        status: dbStatus,
        details: {
          connectionState: dbConnectionState,
          poolSize,
          checkedOut,
        },
      },
      redisStatus,
    ],
    circuitBreakers: circuitMetrics,
    queueDepth: {
      analytics: fallbackStatus.analyticsQueueSize,
      notifications: fallbackStatus.notificationQueueCount,
      payments: fallbackStatus.pendingPaymentsCount,
      emails: fallbackStatus.pendingEmailsCount,
    },
    database: {
      status: dbStatus,
      connectionState: dbConnectionState,
      poolSize,
      checkedOut,
    },
    memory: {
      used: memUsed,
      total: memTotal,
      percentage: memPercentage,
    },
  };
}

// ============================================
// Health Check Endpoint Handler
// ============================================

/**
 * Health check response handler
 */
export const healthCheckHandler = async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();

    // Determine HTTP status code
    let statusCode = 200;
    if (health.status === 'degraded') {
      statusCode = 200; // Still operational
    } else if (health.status === 'down') {
      statusCode = 503; // Service unavailable
    }

    res.status(statusCode).json({
      success: health.status !== 'down',
      status: health.status,
      timestamp: health.timestamp.toISOString(),
      uptime: health.uptime,
      data: health,
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: (error as Error).message,
      action: 'HEALTH_CHECK_FAILED',
    });

    res.status(503).json({
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
};

/**
 * Liveness probe (basic check)
 */
export const livenessProbe: RequestHandler = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe (full check)
 */
export const readinessProbe = async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();

    // Check if database is ready
    const isDbReady = mongoose.connection.readyState === 1;

    // Check if critical services are available (use actual circuit names from CIRCUIT_NAMES)
    // A circuit is healthy if it's CLOSED (working normally) or HALF_OPEN (recovering)
    // Unhealthy if OPEN (failing)
    const criticalHealthy = health.circuitBreakers
      .filter(cb => [CIRCUIT_NAMES.PAYMENT, CIRCUIT_NAMES.NOTIFICATION, CIRCUIT_NAMES.SMS].includes(cb.name as any))
      .every(cb => cb.state === CircuitState.CLOSED || cb.state === CircuitState.HALF_OPEN);

    // Check if system is ready: both DB and critical circuits must be healthy
    const isReady = isDbReady && criticalHealthy;

    if (isReady) {
      res.status(200).json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      const reasons: string[] = [];
      if (!isDbReady) reasons.push('Database not connected');
      if (!criticalHealthy) reasons.push('Critical circuits unhealthy');

      res.status(503).json({
        success: false,
        status: 'not_ready',
        reasons,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'not_ready',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
};

// ============================================
// Dead Letter Queue Management
// ============================================

/**
 * Get dead letter queue status
 */
export const getDLQStatus = async () => {
  const stats = await getDeadLetterStats();

  return {
    totalQueues: 1,
    queues: [stats],
    totalEntries: stats.totalEntries,
    recentEntries: stats.recentEntries,
    oldestEntry: stats.oldestEntry,
    newestEntry: stats.newestEntry,
  };
};

/**
 * DLQ status endpoint handler
 */
export const dlqStatusHandler = async (req: Request, res: Response) => {
  const status = await getDLQStatus();

  res.status(200).json({
    success: true,
    data: status,
  });
};

// ============================================
// Resilience Management
// ============================================

/**
 * Reset all circuit breakers
 */
export const resetCircuitBreakers: RequestHandler = (req: Request, res: Response) => {
  const { circuit } = req.query;

  if (circuit && typeof circuit === 'string') {
    circuitBreaker.reset(circuit);
    logger.info('Circuit breaker reset via API', {
      circuit,
      action: 'CIRCUIT_RESET_API',
    });

    res.status(200).json({
      success: true,
      message: `Circuit breaker '${circuit}' has been reset`,
    });
  } else {
    circuitBreaker.resetAll();
    logger.info('All circuit breakers reset via API', {
      action: 'CIRCUITS_RESET_API',
    });

    res.status(200).json({
      success: true,
      message: 'All circuit breakers have been reset',
    });
  }
};

/**
 * Flush analytics queue
 */
export const flushAnalyticsHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    const flushed = await flushAnalyticsQueue();

    res.status(200).json({
      success: true,
      message: `Flushed ${flushed} analytics events`,
      flushedCount: flushed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Cleanup expired fallback data
 */
export const cleanupHandler: RequestHandler = async (req: Request, res: Response) => {
  const result = await cleanupFallbackData();

  res.status(200).json({
    success: true,
    message: 'Fallback data cleaned up',
    result,
  });
};

// ============================================
// Error Handling Middleware
// ============================================

/**
 * Resilience error handler
 */
export const resilienceErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void | Response => {
  // Circuit breaker errors
  if (err.name === 'CircuitBreakerError') {
    logger.warn('Circuit breaker error', {
      path: req.path,
      error: err.message,
      action: 'CIRCUIT_BREAKER_ERROR',
    });

    return res.status(503).json({
      success: false,
      error: 'Service Temporarily Unavailable',
      message: 'A required service is temporarily unavailable. Please try again later.',
      code: 'SERVICE_UNAVAILABLE',
      retryAfter: 30,
    });
  }

  // Timeout errors
  if (err.message.includes('timeout') || err.message.includes('timed out')) {
    logger.warn('Request timeout error', {
      path: req.path,
      error: err.message,
      action: 'TIMEOUT_ERROR',
    });

    return res.status(504).json({
      success: false,
      error: 'Gateway Timeout',
      message: 'The request took too long to process',
      code: 'REQUEST_TIMEOUT',
    });
  }

  // Pass to next error handler
  next(err);
};

// ============================================
// Export all middleware
// ============================================

export const resilienceMiddleware = {
  requestTimeout,
  circuitBreakerHeaders,
  degradationMiddleware,
  healthCheck: healthCheckHandler,
  liveness: livenessProbe,
  readiness: readinessProbe,
  dlqStatus: dlqStatusHandler,
  resetCircuits: resetCircuitBreakers,
  flushAnalytics: flushAnalyticsHandler,
  cleanup: cleanupHandler,
  errorHandler: resilienceErrorHandler,
};

export default resilienceMiddleware;
