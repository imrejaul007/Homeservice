/**
 * Monitoring Index - Central export for all monitoring modules
 *
 * Usage:
 *   import { metrics, alerts, logger, health } from '../monitoring';
 */

export { aiMetricsRegistry } from './aiMetrics';
export * from './aiMetrics';
export { ALERT_RULES, getFiringAlerts, evaluateAlerts, checkCircuitBreakerAlert, AlertSeverity, AlertStatus, AlertInstance } from './alerts';
export * from './aiAuditLogger';
export { aiMonitoringMiddleware, aiResponseMiddleware, aiSecurityMiddleware, getAIServiceMonitoringSummary } from './aiMonitoringMiddleware';
export { sentry } from './sentry';
export * from './metrics';

// Re-export health controller functions
export {
  getAIHealth,
  getAIDetailedHealth,
  getAlerts,
  evaluateAlerts as evaluateAlertsEndpoint,
  getAIReadiness,
} from '../controllers/aiMonitoring.controller';

// ============================================================
// MONITORING CONFIGURATION
// ============================================================

export interface MonitoringConfig {
  metrics: {
    enabled: boolean;
    exportIntervalMs: number;
    prometheusPort: number;
  };
  alerts: {
    enabled: boolean;
    evaluationIntervalMs: number;
    webhookUrl?: string;
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
  };
  sentry: {
    enabled: boolean;
    dsn?: string;
    tracesSampleRate: number;
  };
}

export const monitoringConfig: MonitoringConfig = {
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    exportIntervalMs: parseInt(process.env.METRICS_EXPORT_INTERVAL_MS || '60000', 10),
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
  },
  alerts: {
    enabled: process.env.ALERTS_ENABLED !== 'false',
    evaluationIntervalMs: parseInt(process.env.ALERTS_EVALUATION_INTERVAL_MS || '60000', 10),
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  },
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10),
  },
  sentry: {
    enabled: !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  },
};

// ============================================================
// INITIALIZATION
// ============================================================

let alertEvaluationInterval: NodeJS.Timeout | null = null;
let metricsExportInterval: NodeJS.Timeout | null = null;

/**
 * Initialize all monitoring components
 */
export async function initializeMonitoring(): Promise<void> {
  console.log('[Monitoring] Initializing monitoring system...');

  // Initialize Sentry
  if (monitoringConfig.sentry.enabled) {
    console.log('[Monitoring] Sentry error tracking enabled');
  }

  // Start alert evaluation
  if (monitoringConfig.alerts.enabled) {
    startAlertEvaluation();
  }

  console.log('[Monitoring] Monitoring system initialized');
}

/**
 * Start periodic alert evaluation
 */
function startAlertEvaluation(): void {
  if (alertEvaluationInterval) {
    clearInterval(alertEvaluationInterval);
  }

  alertEvaluationInterval = setInterval(async () => {
    try {
      const { checkCircuitBreakerAlert, evaluateAlerts } = await import('./alerts');

      // Check circuit breaker
      const circuitResult = checkCircuitBreakerAlert();

      // Send alert notification if firing
      if (circuitResult.status === 'firing' && monitoringConfig.alerts.webhookUrl) {
        const { sendAlertWebhook, ALERT_RULES, AlertStatus } = await import('./alerts');
        const alert = {
          alertId: circuitResult.alertId,
          status: AlertStatus.FIRING,
          firedAt: new Date(),
          labels: { service: 'ai-chat' },
          annotations: { summary: circuitResult.message || 'Alert firing' },
          currentValue: circuitResult.currentValue,
        };
        const rule = ALERT_RULES.find(r => r.id === circuitResult.alertId);
        if (rule) {
          await sendAlertWebhook(monitoringConfig.alerts.webhookUrl!, alert, rule);
        }
      }
    } catch (error) {
      console.error('[Monitoring] Alert evaluation failed:', error);
    }
  }, monitoringConfig.alerts.evaluationIntervalMs);
}

/**
 * Shutdown monitoring components
 */
export function shutdownMonitoring(): void {
  if (alertEvaluationInterval) {
    clearInterval(alertEvaluationInterval);
    alertEvaluationInterval = null;
  }

  if (metricsExportInterval) {
    clearInterval(metricsExportInterval);
    metricsExportInterval = null;
  }

  console.log('[Monitoring] Monitoring system shut down');
}

export default {
  initializeMonitoring,
  shutdownMonitoring,
  monitoringConfig,
};