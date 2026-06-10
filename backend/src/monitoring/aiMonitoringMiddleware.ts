/**
 * AI Monitoring Middleware - Express middleware for AI chat observability
 *
 * Integrates with existing logger, metrics, and audit systems to provide
 * comprehensive monitoring for AI chat endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  responseTimeMs,
  aiLatencyMs,
  messageLength,
  messagesSent,
  messagesReceived,
  aiErrorsTotal,
  fallbackResponsesTotal,
  recordAIInteraction,
} from './aiMetrics';
import {
  logAIInteraction,
  logSecurityEvent,
  AuditAction,
} from './aiAuditLogger';
import { checkCircuitBreakerAlert } from './alerts';
import { aiService } from '../services/ai.service';
import { getBreakerMetrics, CircuitState } from '../services/circuitBreaker.service';

// ============================================================
// TYPES
// ============================================================

export interface AIRequestContext {
  correlationId: string;
  userId?: string;
  conversationId?: string;
  agentId?: string;
  category?: string;
  startTime: number;
}

// Extend Express Request to include AI context
declare global {
  namespace Express {
    interface Request {
      aiContext?: AIRequestContext;
    }
  }
}

// ============================================================
// MIDDLEWARE
// ============================================================

/**
 * Middleware to track AI chat request metrics and logging
 */
export const aiMonitoringMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate AI-specific correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  const startTime = Date.now();

  // Extract user context from auth middleware
  const user = (req as any).user;
  const userId = user?._id?.toString?.();

  // Store AI context for use in controller
  req.aiContext = {
    correlationId,
    userId,
    startTime,
  };

  // Set correlation ID header for client reference
  res.setHeader('X-Correlation-ID', correlationId);

  // Log incoming request
  logAIInteraction({
    action: AuditAction.MESSAGE_SENT,
    userId,
    conversationId: req.body?.conversationId,
    message: req.body?.message,
    status: 'pending',
  });

  // Track message sent
  const category = req.body?.category || 'general';
  const intent = detectIntent(req.body?.message || '');
  messagesSent.inc({ category, intent });

  // Track message length
  messageLength.observe({ direction: 'inbound' }, (req.body?.message?.length || 0));

  // Handle response completion
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: Parameters<Response['end']>): ReturnType<Response['end']> {
    const duration = Date.now() - startTime;

    // Update context with conversation ID from response
    if (req.aiContext) {
      req.aiContext.conversationId = res.getHeader('X-Conversation-ID') as string || req.aiContext.conversationId;
    }

    // Record response time metric
    const status = res.statusCode < 400 ? 'success' : 'failure';
    responseTimeMs.observe({ provider: 'ai', status }, duration);

    // Check circuit breaker state
    checkCircuitBreakerAlert();

    return originalEnd.apply(this, args);
  } as typeof res.end;

  next();
};

/**
 * Middleware to track AI response metrics
 */
export const aiResponseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // This middleware should be used after the AI response is generated
  // It reads the response body to extract AI-specific metrics

  const originalJson = res.json;
  const startTime = req.aiContext?.startTime || Date.now();

  res.json = function(this: Response, body: any): Response {
    // Extract AI metrics from response
    if (body?.data) {
      const responseData = body.data;

      // Record AI interaction metrics
      const latencyMs = Date.now() - startTime;
      const provider = responseData.provider || 'unknown';
      const aiStatus = responseData.status || 'success';

      // Update counters
      messagesReceived.inc({ provider, status: aiStatus });

      // Record latency
      if (responseData.latencyMs) {
        aiLatencyMs.observe(
          { provider, model: responseData.model || 'unknown' },
          responseData.latencyMs
        );
      }

      // Record message length
      messageLength.observe(
        { direction: 'outbound' },
        (responseData.message?.length || responseData.content?.length || 0)
      );

      // Log successful AI response
      logAIInteraction({
        action: AuditAction.MESSAGE_RECEIVED,
        userId: req.aiContext?.userId,
        conversationId: req.aiContext?.conversationId || responseData.conversationId,
        response: responseData.message || responseData.content,
        provider,
        model: responseData.model,
        latencyMs: responseData.latencyMs || latencyMs,
        status: aiStatus === 'success' ? 'success' : 'failure',
      });

      // Record fallback if used
      if (aiStatus === 'fallback' || aiStatus === 'error') {
        fallbackResponsesTotal.inc({ reason: aiStatus });
      }

      // Record error if applicable
      if (aiStatus === 'error' || aiStatus === 'circuit_open') {
        aiErrorsTotal.inc({
          type: aiStatus,
          provider,
          severity: aiStatus === 'circuit_open' ? 'warning' : 'error',
        });

        if (aiStatus === 'error') {
          logAIInteraction({
            action: AuditAction.AI_ERROR,
            userId: req.aiContext?.userId,
            conversationId: req.aiContext?.conversationId,
            provider,
            latencyMs,
            status: 'failure',
            error: new Error(responseData.error || 'AI error'),
          });
        }
      }
    }

    return originalJson.call(this, body);
  } as typeof res.json;

  next();
};

/**
 * Security monitoring middleware for AI endpoints
 */
export const aiSecurityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Monitor for suspicious patterns

  // Check for rate limiting violations
  const rateLimitRemaining = parseInt(res.getHeader('X-RateLimit-Remaining') as string || '999', 10);
  if (rateLimitRemaining === 0) {
    logSecurityEvent({
      action: AuditAction.RATE_LIMIT_EXCEEDED,
      userId: req.aiContext?.userId,
      details: {
        endpoint: req.path,
        method: req.method,
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  next();
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Detect intent from user message for metrics
 */
function detectIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (/^(hi|hello|hey)/.test(lowerMessage)) return 'greeting';
  if (/book|appointment|schedule/.test(lowerMessage)) return 'booking';
  if (/cancel|change|reschedule/.test(lowerMessage)) return 'cancellation';
  if (/payment|refund|price|cost/.test(lowerMessage)) return 'payment';
  if (/track|status|where/.test(lowerMessage)) return 'tracking';
  if (/help|support|human|agent/.test(lowerMessage)) return 'support';
  if (/service|provider|stylist/.test(lowerMessage)) return 'discovery';
  if (/package|bundle|deal/.test(lowerMessage)) return 'packages';

  return 'general';
}

/**
 * Get comprehensive AI monitoring summary
 */
export function getAIServiceMonitoringSummary(): {
  health: 'healthy' | 'degraded' | 'down';
  metrics: {
    totalRequests: number;
    errorRate: number;
    averageLatency: number;
    circuitBreakerState: string;
  };
  alerts: {
    firing: number;
    critical: number;
  };
} {
  const metrics = aiService.getMetrics();
  const stats = getBreakerMetrics('ai_chat');
  const circuitState = stats?.state === CircuitState.OPEN ? 'open' : stats?.state === CircuitState.HALF_OPEN ? 'half-open' : 'closed';
  const alertResult = checkCircuitBreakerAlert();

  // Calculate error rate
  const errorRate = metrics.totalRequests > 0
    ? metrics.failedRequests / metrics.totalRequests
    : 0;

  // Determine health status
  let health: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (circuitState === 'open' || errorRate > 0.1) {
    health = 'down';
  } else if (errorRate > 0.05 || metrics.averageLatencyMs > 5000) {
    health = 'degraded';
  }

  return {
    health,
    metrics: {
      totalRequests: metrics.totalRequests,
      errorRate: Math.round(errorRate * 100 * 100) / 100,
      averageLatency: Math.round(metrics.averageLatencyMs),
      circuitBreakerState: circuitState,
    },
    alerts: {
      firing: alertResult.status === 'firing' ? 1 : 0,
      critical: alertResult.status === 'firing' && circuitState === 'open' ? 1 : 0,
    },
  };
}

export default {
  aiMonitoringMiddleware,
  aiResponseMiddleware,
  aiSecurityMiddleware,
  getAIServiceMonitoringSummary,
};
