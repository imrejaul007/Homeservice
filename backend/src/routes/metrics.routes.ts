import { Router, Request, Response } from 'express';
import { register } from 'prom-client';
import { exportPrometheusMetrics, getPrometheusContentType } from '../monitoring/aiMetrics';
import { aiService } from '../services/ai.service';
import { getBreakerMetrics, CircuitState } from '../services/circuitBreaker.service';
import { getFiringAlerts } from '../monitoring/alerts';

const router = Router();

/**
 * GET /metrics
 * Returns all metrics in Prometheus format
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Set response headers for Prometheus
    res.set('Content-Type', getPrometheusContentType());

    // Get default metrics from prom-client
    const defaultMetrics = await register.metrics();

    // Get AI-specific metrics
    const aiMetrics = await exportPrometheusMetrics();

    // Add custom AI service metrics
    const aiServiceMetrics = aiService.getMetrics();
    const cbStats = getBreakerMetrics('ai_chat');
    const circuitState = cbStats?.state === CircuitState.OPEN ? 'open' : cbStats?.state === CircuitState.HALF_OPEN ? 'half-open' : 'closed';
    const firingAlerts = getFiringAlerts();

    // Add custom metrics as comments (for human readability)
    const customMetrics = `
# HELP ai_service_total_requests Total AI service requests
# TYPE ai_service_total_requests counter
ai_service_total_requests ${aiServiceMetrics.totalRequests}

# HELP ai_service_successful_requests Successful AI requests
# TYPE ai_service_successful_requests counter
ai_service_successful_requests ${aiServiceMetrics.successfulRequests}

# HELP ai_service_failed_requests Failed AI requests
# TYPE ai_service_failed_requests counter
ai_service_failed_requests ${aiServiceMetrics.failedRequests}

# HELP ai_service_fallback_requests Fallback response requests
# TYPE ai_service_fallback_requests counter
ai_service_fallback_requests ${aiServiceMetrics.fallbackRequests}

# HELP ai_service_average_latency_ms Average AI response latency
# TYPE ai_service_average_latency_ms gauge
ai_service_average_latency_ms ${aiServiceMetrics.averageLatencyMs}

# HELP ai_service_cache_hit_rate Cache hit rate percentage
# TYPE ai_service_cache_hit_rate gauge
ai_service_cache_hit_rate ${aiServiceMetrics.cacheHitRate}

# HELP ai_service_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)
# TYPE ai_service_circuit_breaker_state gauge
ai_service_circuit_breaker_state{name="ai_chat"} ${circuitState === 'closed' ? 0 : circuitState === 'half-open' ? 1 : 2}

# HELP ai_service_cost_total_usd Total AI service cost in USD
# TYPE ai_service_cost_total_usd gauge
ai_service_cost_total_usd ${aiServiceMetrics.costTracking?.totalCostUSD || 0}

# HELP ai_service_tokens_total Total tokens used
# TYPE ai_service_tokens_total counter
ai_service_tokens_total ${aiServiceMetrics.costTracking?.totalTokens || 0}

# HELP ai_alerts_firing Number of currently firing alerts
# TYPE ai_alerts_firing gauge
ai_alerts_firing ${firingAlerts.length}

# HELP ai_alerts_critical Number of critical alerts
# TYPE ai_alerts_critical gauge
ai_alerts_critical ${firingAlerts.filter(a => a.annotations.summary?.toLowerCase().includes('critical')).length}
`.trim();

    // Combine all metrics
    res.send(`${defaultMetrics}\n${aiMetrics}\n${customMetrics}`);
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).send('Error exporting metrics');
  }
});

/**
 * GET /metrics/summary
 * Returns a JSON summary of AI service metrics
 */
router.get('/metrics/summary', (req: Request, res: Response) => {
  try {
    const aiServiceMetrics = aiService.getMetrics();
    const cbStats = getBreakerMetrics('ai_chat');
    const circuitState = cbStats?.state === CircuitState.OPEN ? 'open' : cbStats?.state === CircuitState.HALF_OPEN ? 'half-open' : 'closed';
    const firingAlerts = getFiringAlerts();

    res.json({
      timestamp: new Date().toISOString(),
      service: 'ai-chat',
      metrics: {
        requests: {
          total: aiServiceMetrics.totalRequests,
          successful: aiServiceMetrics.successfulRequests,
          failed: aiServiceMetrics.failedRequests,
          fallback: aiServiceMetrics.fallbackRequests,
        },
        performance: {
          averageLatencyMs: aiServiceMetrics.averageLatencyMs,
          cacheHitRate: aiServiceMetrics.cacheHitRate,
        },
        cost: {
          totalUSD: aiServiceMetrics.costTracking?.totalCostUSD || 0,
          totalTokens: aiServiceMetrics.costTracking?.totalTokens || 0,
        },
      },
      health: {
        circuitBreaker: circuitState,
        alertsFiring: firingAlerts.length,
        criticalAlerts: firingAlerts.filter(a =>
          a.annotations.summary?.toLowerCase().includes('critical')
        ).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
