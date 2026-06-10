/**
 * AI Service Metrics - Prometheus-compatible metrics for NILIN AI Chat
 *
 * Counters: messages_sent, messages_received, escalations, errors
 * Histograms: response_time_ms, ai_latency_ms, message_length
 * Gauges: active_conversations, queue_depth
 */

import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

// Circuit state enum values (avoid circular import with circuitBreaker.service)
enum LocalCircuitState {
  CLOSED = 'CLOSED',
  HALF_OPEN = 'HALF_OPEN',
  OPEN = 'OPEN'
}

// Create a custom registry for AI metrics
export const aiMetricsRegistry = new Registry();

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: aiMetricsRegistry });

// ============================================================
// COUNTERS
// ============================================================

/** Total messages sent by users */
export const messagesSent = new Counter({
  name: 'ai_messages_sent_total',
  help: 'Total number of messages sent by users to AI chat',
  labelNames: ['category', 'intent'],
  registers: [aiMetricsRegistry],
});

/** Total messages received from AI */
export const messagesReceived = new Counter({
  name: 'ai_messages_received_total',
  help: 'Total number of responses received from AI',
  labelNames: ['provider', 'status'],
  registers: [aiMetricsRegistry],
});

/** Total escalations to human support */
export const escalationsTotal = new Counter({
  name: 'ai_escalations_total',
  help: 'Total number of escalations to human support',
  labelNames: ['reason', 'category'],
  registers: [aiMetricsRegistry],
});

/** Total errors encountered */
export const aiErrorsTotal = new Counter({
  name: 'ai_errors_total',
  help: 'Total number of AI-related errors',
  labelNames: ['type', 'provider', 'severity'],
  registers: [aiMetricsRegistry],
});

/** Total fallback responses used */
export const fallbackResponsesTotal = new Counter({
  name: 'ai_fallback_responses_total',
  help: 'Total number of fallback/rule-based responses used',
  labelNames: ['reason'],
  registers: [aiMetricsRegistry],
});

/** Circuit breaker state changes */
export const circuitBreakerChanges = new Counter({
  name: 'ai_circuit_breaker_changes_total',
  help: 'Total number of circuit breaker state changes',
  labelNames: ['from_state', 'to_state'],
  registers: [aiMetricsRegistry],
});

// ============================================================
// HISTOGRAMS
// ============================================================

/** End-to-end response time for AI chat requests */
export const responseTimeMs = new Histogram({
  name: 'ai_response_time_ms',
  help: 'End-to-end response time in milliseconds',
  labelNames: ['provider', 'status'],
  buckets: [100, 250, 500, 1000, 2000, 5000, 10000, 30000],
  registers: [aiMetricsRegistry],
});

/** AI provider latency (time to get response from AI) */
export const aiLatencyMs = new Histogram({
  name: 'ai_latency_ms',
  help: 'AI provider latency in milliseconds',
  labelNames: ['provider', 'model'],
  buckets: [100, 250, 500, 1000, 2000, 5000, 10000, 30000],
  registers: [aiMetricsRegistry],
});

/** Message length (in characters) */
export const messageLength = new Histogram({
  name: 'ai_message_length',
  help: 'Message length in characters',
  labelNames: ['direction'], // 'inbound' or 'outbound'
  buckets: [10, 50, 100, 200, 500, 1000, 2000],
  registers: [aiMetricsRegistry],
});

/** Token usage per request */
export const tokenUsage = new Histogram({
  name: 'ai_token_usage',
  help: 'Token usage per request',
  labelNames: ['type'], // 'input', 'output', 'total'
  buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
  registers: [aiMetricsRegistry],
});

/** Knowledge base retrieval time */
export const knowledgeBaseRetrievalMs = new Histogram({
  name: 'ai_knowledge_base_retrieval_ms',
  help: 'Time to retrieve from knowledge base in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250],
  registers: [aiMetricsRegistry],
});

// ============================================================
// GAUGES
// ============================================================

/** Current number of active conversations */
export const activeConversations = new Gauge({
  name: 'ai_active_conversations',
  help: 'Current number of active AI conversations',
  registers: [aiMetricsRegistry],
});

/** Current queue depth (pending requests) */
export const queueDepth = new Gauge({
  name: 'ai_queue_depth',
  help: 'Current number of pending AI requests in queue',
  registers: [aiMetricsRegistry],
});

/** Circuit breaker state (0=closed, 1=half-open, 2=open) */
export const circuitBreakerState = new Gauge({
  name: 'ai_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['name'],
  registers: [aiMetricsRegistry],
});

/** AI service availability (1=available, 0=unavailable) */
export const aiServiceAvailability = new Gauge({
  name: 'ai_service_availability',
  help: 'AI service availability (1=available, 0=unavailable)',
  labelNames: ['provider'],
  registers: [aiMetricsRegistry],
});

/** Current rate limit usage percentage */
export const rateLimitUsage = new Gauge({
  name: 'ai_rate_limit_usage_percent',
  help: 'Current rate limit usage as percentage',
  labelNames: ['window'], // 'minute', 'hour'
  registers: [aiMetricsRegistry],
});

// ============================================================
// PROMETHEUS EXPORT
// ============================================================

/**
 * Export all metrics in Prometheus format
 */
export async function exportPrometheusMetrics(): Promise<string> {
  return aiMetricsRegistry.metrics();
}

/**
 * Get content type for Prometheus metrics endpoint
 */
export function getPrometheusContentType(): string {
  return aiMetricsRegistry.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  aiMetricsRegistry.resetMetrics();
}

// ============================================================
// CONVENIENCE HELPER FUNCTIONS
// ============================================================

/**
 * Record an AI chat interaction with all relevant metrics
 */
export function recordAIInteraction(params: {
  userMessage: string;
  aiResponse: string;
  provider: string;
  model?: string;
  status: 'success' | 'fallback' | 'timeout' | 'error' | 'circuit_open';
  latencyMs: number;
  tokensUsed?: { input: number; output: number; total: number };
  category?: string;
  intent?: string;
}): void {
  const { userMessage, aiResponse, provider, model, status, latencyMs, tokensUsed, category, intent } = params;

  // Pre-compute label values to avoid type inference issues
  const cat = category || 'general';
  const itent = intent || 'unknown';
  const modelLabel = model || 'unknown';

  // Record message counts
  messagesSent.inc({ category: cat, intent: itent });
  messagesReceived.inc({ provider, status });

  // Record response time
  responseTimeMs.observe({ provider, status }, latencyMs);
  aiLatencyMs.observe({ provider, model: modelLabel }, latencyMs);

  // Record message lengths
  messageLength.observe({ direction: 'inbound' }, userMessage.length);
  messageLength.observe({ direction: 'outbound' }, aiResponse.length);

  // Record token usage
  if (tokensUsed) {
    tokenUsage.observe({ type: 'input' }, tokensUsed.input);
    tokenUsage.observe({ type: 'output' }, tokensUsed.output);
    tokenUsage.observe({ type: 'total' }, tokensUsed.total);
  }

  // Record errors
  if (status === 'error' || status === 'timeout' || status === 'circuit_open') {
    const severity = status === 'circuit_open' ? 'warning' : 'error';
    aiErrorsTotal.inc({
      type: status,
      provider,
      severity,
    });
  }

  // Record fallback usage
  if (status === 'fallback') {
    fallbackResponsesTotal.inc({ reason: 'ai_unavailable' });
  }
}

/**
 * Record an escalation to human support
 */
export function recordEscalation(params: {
  reason: string;
  category?: string;
}): void {
  escalationsTotal.inc({
    reason: params.reason,
    category: params.category || 'general',
  });
}

/**
 * Update active conversation count
 */
export function setActiveConversations(count: number): void {
  activeConversations.set(count);
}

/**
 * Update queue depth
 */
export function setQueueDepth(depth: number): void {
  queueDepth.set(depth);
}

/**
 * Update circuit breaker state
 */
export function setCircuitBreakerState(name: string, state: 'closed' | 'half-open' | 'open'): void {
  let stateValue: number;
  if (state === 'closed') {
    stateValue = 0;
  } else if (state === 'half-open') {
    stateValue = 1;
  } else {
    stateValue = 2;
  }
  circuitBreakerState.set({ name }, stateValue);
}

/**
 * Update AI service availability
 */
export function setAIServiceAvailability(provider: string, available: boolean): void {
  aiServiceAvailability.set({ provider }, available ? 1 : 0);
}

/**
 * Update rate limit usage
 */
export function setRateLimitUsage(window: 'minute' | 'hour', usagePercent: number): void {
  rateLimitUsage.set({ window }, usagePercent);
}

export default {
  // Registry
  aiMetricsRegistry,
  exportPrometheusMetrics,
  getPrometheusContentType,
  resetMetrics,

  // Counters
  messagesSent,
  messagesReceived,
  escalationsTotal,
  aiErrorsTotal,
  fallbackResponsesTotal,
  circuitBreakerChanges,

  // Histograms
  responseTimeMs,
  aiLatencyMs,
  messageLength,
  tokenUsage,
  knowledgeBaseRetrievalMs,

  // Gauges
  activeConversations,
  queueDepth,
  circuitBreakerState,
  aiServiceAvailability,
  rateLimitUsage,

  // Helpers
  recordAIInteraction,
  recordEscalation,
  setActiveConversations,
  setQueueDepth,
  setCircuitBreakerState,
  setAIServiceAvailability,
  setRateLimitUsage,
};
