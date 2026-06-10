/**
 * AI Monitoring Controller - Enhanced health checks for AI Chat
 *
 * Provides comprehensive health endpoints including AI service status,
 * circuit breaker state, and monitoring summary.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { aiService } from '../services/ai.service';
import { getBreakerMetrics, CircuitState } from '../services/circuitBreaker.service';
import { getFiringAlerts, ALERT_RULES } from '../monitoring/alerts';
import { checkCircuitBreakerAlert } from '../monitoring/alerts';
import { aiMetricsRegistry } from '../monitoring/aiMetrics';
import logger from '../utils/logger';

/**
 * GET /health/ai
 * AI service health check
 */
export const getAIHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();

    // Get AI service metrics
    const metrics = aiService.getMetrics();
    const cbStats = getBreakerMetrics('ai_chat');
    const circuitState = cbStats?.state === CircuitState.CLOSED ? 'closed' : cbStats?.state === CircuitState.HALF_OPEN ? 'half-open' : 'open';

    // Calculate health indicators
    const errorRate = metrics.totalRequests > 0
      ? metrics.failedRequests / metrics.totalRequests
      : 0;

    const latencyHealth = metrics.averageLatencyMs < 5000 ? 'healthy' :
                          metrics.averageLatencyMs < 10000 ? 'degraded' : 'unhealthy';

    const circuitHealth = circuitState === 'closed' ? 'healthy' :
                         circuitState === 'half-open' ? 'degraded' : 'unhealthy';

    const overallHealth = errorRate < 0.05 && circuitState === 'closed'
      ? 'healthy'
      : errorRate < 0.1 && circuitState !== 'open'
        ? 'degraded'
        : 'unhealthy';

    res.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      components: {
        aiService: {
          status: errorRate < 0.1 ? 'operational' : 'degraded',
          metrics: {
            totalRequests: metrics.totalRequests,
            errorRate: Math.round(errorRate * 10000) / 100,
            averageLatencyMs: Math.round(metrics.averageLatencyMs),
            fallbackRate: metrics.totalRequests > 0
              ? Math.round((metrics.fallbackRequests / metrics.totalRequests) * 10000) / 100
              : 0,
          },
        },
        circuitBreaker: {
          status: circuitHealth,
          state: circuitState,
        },
        latency: {
          status: latencyHealth,
          value: Math.round(metrics.averageLatencyMs),
        },
      },
      cost: metrics.costTracking ? {
        totalUSD: Math.round(metrics.costTracking.totalCostUSD * 100) / 100,
        totalTokens: metrics.costTracking.totalTokens,
      } : null,
    });
  } catch (error) {
    logger.error('AI health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'AI health check failed',
    });
  }
};

/**
 * GET /health/ai/detailed
 * Detailed AI service metrics and status
 */
export const getAIDetailedHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const metrics = aiService.getMetrics();
    const cbStats = getBreakerMetrics('ai_chat');
    const circuitState = cbStats?.state === CircuitState.CLOSED ? 'closed' : cbStats?.state === CircuitState.HALF_OPEN ? 'half-open' : 'open';
    const firingAlerts = getFiringAlerts();

    // Check circuit breaker for any alerts
    checkCircuitBreakerAlert();

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      metrics: {
        requests: {
          total: metrics.totalRequests,
          successful: metrics.successfulRequests,
          failed: metrics.failedRequests,
          fallback: metrics.fallbackRequests,
          byProvider: metrics.costTracking?.byProvider || {},
        },
        performance: {
          averageLatencyMs: metrics.averageLatencyMs,
          cacheHitRate: metrics.cacheHitRate,
          cacheEnabled: process.env.AI_CACHE_ENABLED !== 'false',
        },
        cost: {
          totalUSD: metrics.costTracking?.totalCostUSD || 0,
          totalTokens: metrics.costTracking?.totalTokens || 0,
          byDay: metrics.costTracking?.byDay || {},
        },
      },
      circuitBreaker: {
        state: circuitState,
        stateValue: circuitState === 'closed' ? 0 : circuitState === 'half-open' ? 1 : 2,
      },
      alerts: {
        firing: firingAlerts.length,
        critical: firingAlerts.filter(a =>
          a.annotations.summary?.toLowerCase().includes('critical')
        ).length,
        details: firingAlerts.map(a => ({
          id: a.alertId,
          summary: a.annotations.summary,
          severity: a.annotations.summary?.toLowerCase().includes('critical') ? 'critical' : 'warning',
          firedAt: a.firedAt,
        })),
      },
      configuredAlerts: ALERT_RULES.map(rule => ({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        condition: `${rule.condition.metric} ${rule.condition.operator} ${rule.condition.value}`,
      })),
    });
  } catch (error) {
    logger.error('AI detailed health check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to get detailed AI health',
    });
  }
};

/**
 * GET /health/alerts
 * Get current firing alerts
 */
export const getAlerts = (req: Request, res: Response): void => {
  try {
    const firingAlerts = getFiringAlerts();

    res.json({
      timestamp: new Date().toISOString(),
      count: firingAlerts.length,
      alerts: firingAlerts.map(alert => ({
        id: alert.alertId,
        status: alert.status,
        firedAt: alert.firedAt,
        resolvedAt: alert.resolvedAt,
        labels: alert.labels,
        annotations: alert.annotations,
        currentValue: alert.currentValue,
      })),
    });
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    res.status(500).json({
      error: 'Failed to get alerts',
    });
  }
};

/**
 * POST /health/alerts/evaluate
 * Manually trigger alert evaluation (for testing/scheduled checks)
 */
export const evaluateAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get current metrics from registry
    const metricsOutput = await aiMetricsRegistry.metrics();

    // Parse metrics to get current values
    const metrics: Record<string, number> = {};

    // Extract error rate
    const errorTotalMatch = metricsOutput.match(/ai_errors_total_total (\d+)/);
    const messagesTotalMatch = metricsOutput.match(/ai_messages_sent_total_total (\d+)/);

    if (errorTotalMatch && messagesTotalMatch) {
      const errors = parseInt(errorTotalMatch[1], 10);
      const messages = parseInt(messagesTotalMatch[1], 10);
      metrics['error_rate'] = messages > 0 ? errors / messages : 0;
    }

    // Check circuit breaker
    const circuitResult = checkCircuitBreakerAlert();

    res.json({
      timestamp: new Date().toISOString(),
      metrics,
      circuitBreaker: circuitResult,
      alertStatus: circuitResult.status,
    });
  } catch (error) {
    logger.error('Alert evaluation failed', { error });
    res.status(500).json({
      error: 'Alert evaluation failed',
    });
  }
};

/**
 * GET /health/ready/ai
 * AI-specific readiness check (used in readiness probe)
 */
export const getAIReadiness = async (req: Request, res: Response): Promise<void> => {
  try {
    const metrics = aiService.getMetrics();
    const cbStats = getBreakerMetrics('ai_chat');
    const circuitState = cbStats?.state === CircuitState.CLOSED ? 'closed' : cbStats?.state === CircuitState.HALF_OPEN ? 'half-open' : 'open';

    // AI service is ready if:
    // 1. Circuit breaker is not open (or is half-open and accepting some requests)
    // 2. Error rate is below critical threshold
    const errorRate = metrics.totalRequests > 0
      ? metrics.failedRequests / metrics.totalRequests
      : 0;

    const isReady = circuitState !== 'open' && errorRate < 0.5;

    if (!isReady) {
      res.status(503).json({
        status: 'not_ready',
        ready: false,
        timestamp: new Date().toISOString(),
        reason: circuitState === 'open' ? 'Circuit breaker is open' : 'Error rate too high',
        metrics: {
          errorRate: Math.round(errorRate * 100),
          circuitBreaker: circuitState,
        },
      });
      return;
    }

    res.json({
      status: 'ready',
      ready: true,
      timestamp: new Date().toISOString(),
      metrics: {
        totalRequests: metrics.totalRequests,
        errorRate: Math.round(errorRate * 10000) / 100,
        circuitBreaker: circuitState,
      },
    });
  } catch (error) {
    logger.error('AI readiness check failed', { error });
    res.status(503).json({
      status: 'not_ready',
      ready: false,
      error: 'AI readiness check failed',
    });
  }
};

export default {
  getAIHealth,
  getAIDetailedHealth,
  getAlerts,
  evaluateAlerts,
  getAIReadiness,
};
