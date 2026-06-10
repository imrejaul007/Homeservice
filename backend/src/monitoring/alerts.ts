/**
 * Alert Configuration for NILIN AI Chat
 *
 * Defines alert rules for monitoring AI service health and performance.
 * These alerts can be integrated with Prometheus AlertManager, Grafana,
 * or used to trigger webhooks/notifications.
 */

import { getBreakerMetrics, getAllCircuitBreakerStats, CircuitState } from '../services/circuitBreaker.service';

// ============================================================
// ALERT TYPES
// ============================================================

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  WARNING = 'warning',
}

export enum AlertStatus {
  FIRING = 'firing',
  RESOLVED = 'resolved',
  PENDING = 'pending',
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  duration: number; // seconds
  labels: Record<string, string>;
  annotations: {
    summary: string;
    description: string;
    runbookUrl?: string;
  };
}

export interface AlertCondition {
  type: 'threshold' | 'circuit_breaker' | 'rate' | 'error_rate';
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
  window?: string; // e.g., '5m', '1h'
}

export interface AlertInstance {
  alertId: string;
  status: AlertStatus;
  firedAt?: Date;
  resolvedAt?: Date;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  currentValue?: number;
}

// ============================================================
// ALERT RULES CONFIGURATION
// ============================================================

export const ALERT_RULES: AlertRule[] = [
  // ---- AI Failure Rate > 5% in 5 minutes ----
  {
    id: 'ai_failure_rate_high',
    name: 'AI Failure Rate High',
    description: 'AI service is failing more than 5% of requests in the last 5 minutes',
    severity: AlertSeverity.CRITICAL,
    condition: {
      type: 'error_rate',
      metric: 'ai_errors_total / ai_messages_sent_total',
      operator: '>',
      value: 0.05, // 5%
      window: '5m',
    },
    duration: 60, // Must fire for 60 seconds
    labels: {
      service: 'ai-chat',
      component: 'ai-service',
    },
    annotations: {
      summary: 'AI failure rate exceeds 5%',
      description: 'AI service is experiencing high failure rate ({{ humanize $value }}) over the last 5 minutes. This may indicate API issues or service degradation.',
      runbookUrl: 'https://docs.nilin.com/runbooks/ai-failure-rate',
    },
  },

  // ---- Response Time P95 > 10 seconds ----
  {
    id: 'ai_response_time_p95_high',
    name: 'AI Response Time P95 High',
    description: '95th percentile response time exceeds 10 seconds',
    severity: AlertSeverity.HIGH,
    condition: {
      type: 'threshold',
      metric: 'histogram_quantile(0.95, ai_response_time_ms)',
      operator: '>',
      value: 10000, // 10 seconds in ms
      window: '5m',
    },
    duration: 180, // Must fire for 3 minutes
    labels: {
      service: 'ai-chat',
      component: 'ai-service',
    },
    annotations: {
      summary: 'AI response time P95 exceeds 10 seconds',
      description: 'The 95th percentile response time is {{ humanize $value }}ms, exceeding the10 second threshold. Users may experience slow chat responses.',
      runbookUrl: 'https://docs.nilin.com/runbooks/ai-response-time',
    },
  },

  // ---- Escalation Backlog > 50 ----
  {
    id: 'escalation_backlog_high',
    name: 'Escalation Backlog High',
    description: 'Number of pending escalations to human support exceeds 50',
    severity: AlertSeverity.HIGH,
    condition: {
      type: 'threshold',
      metric: 'ai_queue_depth',
      operator: '>',
      value: 50,
    },
    duration: 300, // Must fire for 5 minutes
    labels: {
      service: 'ai-chat',
      component: 'escalation-queue',
    },
    annotations: {
      summary: 'Escalation backlog exceeds 50',
      description: 'There are {{ $value }} pending escalations to human support. Consider scaling support staff or investigating root cause of high escalation rate.',
      runbookUrl: 'https://docs.nilin.com/runbooks/escalation-backlog',
    },
  },

  // ---- Error Rate > 1% ----
  {
    id: 'error_rate_high',
    name: 'Error Rate High',
    description: 'Overall error rate exceeds 1% of all requests',
    severity: AlertSeverity.HIGH,
    condition: {
      type: 'error_rate',
      metric: 'rate(ai_errors_total[5m]) / rate(ai_messages_sent_total[5m])',
      operator: '>',
      value: 0.01, // 1%
 window: '5m',
    },
    duration: 120, // Must fire for 2 minutes
    labels: {
      service: 'ai-chat',
      component: 'api',
    },
    annotations: {
      summary: 'Error rate exceeds 1%',
      description: 'The error rate is {{ humanize $value }}% over the last 5 minutes. Check logs for specific error types.',
      runbookUrl: 'https://docs.nilin.com/runbooks/error-rate',
    },
  },

  // ---- Circuit Breaker Open ----
  {
    id: 'circuit_breaker_open',
    name: 'Circuit Breaker Open',
    description: 'AI service circuit breaker is open, requests are failing fast',
    severity: AlertSeverity.CRITICAL,
    condition: {
      type: 'circuit_breaker',
      metric: 'ai_circuit_breaker_state',
      operator: '==',
      value: 2, // Open state
    },
    duration: 30, // Must fire for 30 seconds
    labels: {
      service: 'ai-chat',
      component: 'circuit-breaker',
    },
    annotations: {
      summary: 'AI circuit breaker is OPEN',
      description: 'The AI service circuit breaker has opened and is rejecting requests. All AI requests are using fallback responses. Check AI provider status.',
      runbookUrl: 'https://docs.nilin.com/runbooks/circuit-breaker',
    },
  },

  // ---- Fallback Rate > 20% ----
  {
    id: 'fallback_rate_high',
    name: 'Fallback Rate High',
    description: 'More than 20% of requests are using fallback responses',
    severity: AlertSeverity.MEDIUM,
    condition: {
      type: 'error_rate',
      metric: 'ai_fallback_responses_total / ai_messages_sent_total',
      operator: '>',
      value: 0.2, // 20%
      window: '5m',
    },
    duration: 300, // Must fire for 5 minutes
    labels: {
      service: 'ai-chat',
      component: 'ai-service',
    },
    annotations: {
      summary: 'Fallback response rate exceeds 20%',
      description: 'A high percentage ({{ humanize $value }}) of requests are using fallback responses. The AI service may be degraded.',
      runbookUrl: 'https://docs.nilin.com/runbooks/fallback-rate',
    },
  },

  // ---- No Active AI Provider ----
  {
    id: 'no_ai_provider',
    name: 'No Active AI Provider',
    description: 'No AI provider is currently available',
    severity: AlertSeverity.CRITICAL,
    condition: {
      type: 'threshold',
      metric: 'ai_service_availability',
      operator: '==',
      value: 0,
    },
    duration: 60, // Must fire for 60 seconds
    labels: {
      service: 'ai-chat',
      component: 'ai-service',
    },
    annotations: {
      summary: 'No AI provider is available',
      description: 'All AI providers are reporting as unavailable. Check API keys and provider status.',
      runbookUrl: 'https://docs.nilin.com/runbooks/no-ai-provider',
    },
  },

  // ---- Token Usage Rate High ----
  {
    id: 'token_usage_rate_high',
    name: 'Token Usage Rate High',
    description: 'Token usage rate is approaching rate limits',
    severity: AlertSeverity.MEDIUM,
    condition: {
      type: 'threshold',
      metric: 'ai_rate_limit_usage_percent',
      operator: '>',
      value: 80, // 80%
    },
    duration: 60, // Must fire for 60 seconds
    labels: {
      service: 'ai-chat',
      component: 'rate-limiter',
    },
    annotations: {
      summary: 'Token usage rate exceeds 80%',
      description: 'Token usage is at {{ humanize $value }}% of rate limit. Consider implementing stricter rate limiting or upgrading API plan.',
      runbookUrl: 'https://docs.nilin.com/runbooks/token-usage',
    },
  },
];

// ============================================================
// ALERT EVALUATOR
// ============================================================

// Track firing alerts
const firingAlerts: Map<string, AlertInstance> = new Map();

export interface AlertEvaluationResult {
  alertId: string;
  status: AlertStatus;
  currentValue?: number;
  message?: string;
}

/**
 * Evaluate all alert rules against current metrics
 * This would typically be called by a Prometheus AlertManager or custom scheduler
 */
export async function evaluateAlerts(metrics: Record<string, number>): Promise<AlertEvaluationResult[]> {
  const results: AlertEvaluationResult[] = [];

  for (const rule of ALERT_RULES) {
    const currentValue = metrics[rule.condition.metric];
    const shouldFire = evaluateCondition(currentValue, rule.condition);

    const existingAlert = firingAlerts.get(rule.id);

    if (shouldFire) {
      if (!existingAlert) {
        // New alert
        firingAlerts.set(rule.id, {
          alertId: rule.id,
          status: AlertStatus.FIRING,
          firedAt: new Date(),
          labels: rule.labels,
          annotations: rule.annotations,
          currentValue,
        });
      }
      results.push({
        alertId: rule.id,
        status: AlertStatus.FIRING,
        currentValue,
 message: rule.annotations.summary,
      });
    } else if (existingAlert) {
      // Alert resolved
      existingAlert.status = AlertStatus.RESOLVED;
      existingAlert.resolvedAt = new Date();
      firingAlerts.delete(rule.id);
      results.push({
        alertId: rule.id,
        status: AlertStatus.RESOLVED,
        currentValue,
      });
    }
  }

  return results;
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(value: number | undefined, condition: AlertCondition): boolean {
  if (value === undefined) return false;

  switch (condition.operator) {
    case '>':
      return value > condition.value;
    case '<':
      return value < condition.value;
    case '>=':
      return value >= condition.value;
    case '<=':
      return value <= condition.value;
    case '==':
      return value === condition.value;
    default:
      return false;
  }
}

/**
 * Get all currently firing alerts
 */
export function getFiringAlerts(): AlertInstance[] {
  return Array.from(firingAlerts.values());
}

/**
 * Get alert history (resolved alerts)
 */
export function getAlertHistory(): AlertInstance[] {
  // In production, this would query a database or time-series store
  return [];
}

/**
 * Check circuit breaker state for alerts
 */
export function checkCircuitBreakerAlert(): AlertEvaluationResult {
  try {
    const stats = getBreakerMetrics('ai_chat');
    if (!stats) {
      return { alertId: 'circuit_breaker_open', status: AlertStatus.RESOLVED };
    }

    const isOpen = stats.state === CircuitState.OPEN;
    const stateValue = stats.state === CircuitState.CLOSED ? 0 : stats.state === CircuitState.HALF_OPEN ? 1 : 2;

    if (isOpen) {
      const alert: AlertInstance = {
        alertId: 'circuit_breaker_open',
        status: AlertStatus.FIRING,
        firedAt: new Date(),
        labels: { service: 'ai-chat', component: 'circuit-breaker' },
        annotations: {
          summary: 'AI circuit breaker is OPEN',
          description: 'The AI service circuit breaker has opened.',
        },
        currentValue: stateValue,
      };
      firingAlerts.set('circuit_breaker_open', alert);

      return {
        alertId: 'circuit_breaker_open',
        status: AlertStatus.FIRING,
        currentValue: stateValue,
        message: 'Circuit breaker is open',
      };
    }

    // Check if we need to resolve the alert
    const existingAlert = firingAlerts.get('circuit_breaker_open');
    if (existingAlert) {
      existingAlert.status = AlertStatus.RESOLVED;
      existingAlert.resolvedAt = new Date();
      firingAlerts.delete('circuit_breaker_open');

      return {
        alertId: 'circuit_breaker_open',
        status: AlertStatus.RESOLVED,
        currentValue: stateValue,
      };
    }
  } catch {
    // Circuit breaker not initialized yet
  }

  return {
    alertId: 'circuit_breaker_open',
    status: AlertStatus.RESOLVED,
  };
}

/**
 * Format alert for notification
 */
export function formatAlertForNotification(alert: AlertInstance): string {
  return `
🚨 Alert: ${alert.annotations.summary || alert.alertId}

Severity: ${alert.status}
${alert.firedAt ? `Fired at: ${alert.firedAt.toISOString()}` : ''}
${alert.resolvedAt ? `Resolved at: ${alert.resolvedAt.toISOString()}` : ''}

${alert.annotations.description || ''}

Labels: ${JSON.stringify(alert.labels)}
 `.trim();
}

// ============================================================
// WEBHOOK NOTIFICATIONS
// ============================================================

export interface WebhookPayload {
  alertId: string;
  alertName: string;
  status: AlertStatus;
  severity: AlertSeverity;
  firedAt?: string;
  resolvedAt?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  currentValue?: number;
}

/**
 * Send alert to webhook (Slack, Discord, PagerDuty, etc.)
 */
export async function sendAlertWebhook(
  webhookUrl: string,
  alert: AlertInstance,
  rule: AlertRule
): Promise<void> {
  const payload: WebhookPayload = {
    alertId: alert.alertId,
    alertName: rule.name,
    status: alert.status,
    severity: rule.severity,
    firedAt: alert.firedAt?.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString(),
    labels: alert.labels,
    annotations: alert.annotations,
    currentValue: alert.currentValue,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Failed to send alert webhook: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send alert webhook:', error);
  }
}

export default {
  ALERT_RULES,
  AlertSeverity,
  AlertStatus,
  evaluateAlerts,
  getFiringAlerts,
  getAlertHistory,
  checkCircuitBreakerAlert,
  formatAlertForNotification,
  sendAlertWebhook,
};
