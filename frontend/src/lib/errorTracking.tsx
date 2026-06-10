/**
 * Frontend Error Tracking for NILIN AI Chat
 *
 * Captures React errors, API failures, and user session information
 * for monitoring and debugging. Supports multiple backends (Sentry, custom endpoint).
 */

// Sentry imports with fallback for when not configured
import * as Sentry from '@sentry/react';

// ============================================================
// UTILITIES
// ============================================================

/** Generate a correlation ID for tracking requests across services */
const generateCorrelationId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;
};

/** Get correlation ID from session storage or generate new one */
const getCorrelationId = (): string => {
  if (typeof window === 'undefined') return 'server';
  const stored = sessionStorage.getItem('nilin-correlation-id');
  if (stored) return stored;
  const newId = generateCorrelationId();
  sessionStorage.setItem('nilin-correlation-id', newId);
  return newId;
};

// ============================================================
// TYPES
// ============================================================

export interface ErrorContext {
  type?: string;
  componentStack?: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  userAgent?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorPayload {
  type: 'error' | 'warning' | 'info';
  name: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  tags?: Record<string, string>;
  level: 'error' | 'warning' | 'info';
}

export interface FrontendMetrics {
  messagesSent: number;
  messagesReceived: number;
  errorsEncountered: number;
  averageResponseTime: number;
  sessionStartTime: string;
}

// ============================================================
// CONFIGURATION
// ============================================================

interface ErrorTrackingConfig {
  enabled: boolean;
  endpoint?: string;
  environment: string;
  release: string;
  sampleRate: number;
  maxErrors: number;
  ignoreErrors: RegExp[];
  tags: Record<string, string>;
}

const defaultConfig: ErrorTrackingConfig = {
  enabled: import.meta.env.PROD,
  endpoint: '/api/errors',
  environment: import.meta.env.MODE || 'development',
  release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  sampleRate: 0.1,
  maxErrors: 50,
  ignoreErrors: [
    /Failed to fetch/i,
    /Network request failed/i,
    /Navigator online/i,
  ],
  tags: {
    app: 'nilin-chatbot',
    platform: 'web',
  },
};

let config = { ...defaultConfig };
const errorBuffer: ErrorPayload[] = [];
let metrics: FrontendMetrics = {
  messagesSent: 0,
  messagesReceived: 0,
  errorsEncountered: 0,
  averageResponseTime: 0,
  sessionStartTime: new Date().toISOString(),
};

// ============================================================
// INITIALIZATION
// ============================================================

export interface InitOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  endpoint?: string;
  enabled?: boolean;
}

export async function initErrorTracking(options: InitOptions = {}): Promise<void> {
  config = { ...defaultConfig, ...options };

  const dsn = options.dsn || import.meta.env.VITE_SENTRY_DSN;
  if (config.enabled && dsn) {
    try {
      Sentry.init({
        dsn,
        environment: config.environment,
        release: config.release,
        sampleRate: config.sampleRate,
      });
      console.log('[ErrorTracking] Sentry initialized');
    } catch (error) {
      console.warn('[ErrorTracking] Failed to initialize Sentry:', error);
    }
  }

  // Setup global error handlers
  if (typeof window !== 'undefined') {
    window.onerror = (message, source, lineno, colno, error) => {
      trackError(error || new Error(String(message)), {
        metadata: { source, lineno, colno },
      });
    };

    window.onunhandledrejection = (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      trackError(error, { type: 'unhandled_promise_rejection' });
    };
  }
}

export async function initSentry(options: InitOptions = {}): Promise<void> {
  return initErrorTracking(options);
}

// ============================================================
// ERROR TRACKING
// ============================================================

export function trackError(
  error: Error,
  additionalContext?: Partial<ErrorContext> & { type?: string }
): void {
  const context: ErrorContext = {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    ...additionalContext,
  };

  // Build error payload
  const payload: ErrorPayload = {
    type: 'error',
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack,
    context,
    level: 'error',
  };

  // Check if error should be ignored
  const shouldIgnore = config.ignoreErrors.some((pattern) =>
    pattern.test(payload.message)
  );
  if (shouldIgnore) return;

  // Buffer error for batch sending
  if (errorBuffer.length < config.maxErrors) {
    errorBuffer.push(payload);
  }

  // Track metrics
  metrics.errorsEncountered++;

  // Send to Sentry
  if (config.enabled) {
    try {
      Sentry.captureException(error);
    } catch {
      // Sentry may not be initialized
    }
  }

  // Send to backend endpoint
  if (config.endpoint) {
    sendErrorsToBackend([payload]).catch(() => {
      // Ignore network errors
    });
  }

  // Console log in development
  if (!import.meta.env.PROD) {
    console.error('[ErrorTracking]', payload);
  }
}

export function trackWarning(message: string, context?: Partial<ErrorContext>): void {
  const payload: ErrorPayload = {
    type: 'warning',
    name: 'Warning',
    message,
    context: {
      timestamp: new Date().toISOString(),
      ...context,
    },
    level: 'warning',
  };

  if (config.enabled) {
    try {
      Sentry.captureMessage(message, 'warning');
    } catch {
      // Sentry may not be initialized
    }
  }
}

export function trackInfo(message: string, context?: Partial<ErrorContext>): void {
  const payload: ErrorPayload = {
    type: 'info',
    name: 'Info',
    message,
    context: {
      timestamp: new Date().toISOString(),
      ...context,
    },
    level: 'info',
  };

  if (!import.meta.env.PROD) {
    console.info('[ErrorTracking]', payload);
  }
}

export function trackAPIError(
  error: Error,
  endpoint: string,
  statusCode?: number
): void {
  trackError(error, {
    type: 'api_error',
    metadata: {
      endpoint,
      statusCode,
    },
  });
}

// ============================================================
// SESSION TRACKING
// ============================================================

export function setUserContext(userId: string, email?: string): void {
  if (config.enabled) {
    try {
      Sentry.setUser({
        id: userId,
        email,
      });
    } catch {
      // Sentry may not be initialized
    }
  }
}

export function setTag(key: string, value: string): void {
  if (config.enabled) {
    try {
      Sentry.setTag(key, value);
    } catch {
      // Sentry may not be initialized
    }
  }
}

export function setConversationContext(conversationId: string): void {
  if (config.enabled) {
    try {
      Sentry.setTag('conversation_id', conversationId);
    } catch {
      // Sentry may not be initialized
    }
  }
}

// ============================================================
// METRICS
// ============================================================

export function trackMessageSent(responseTimeMs?: number): void {
  metrics.messagesSent++;
  if (responseTimeMs) {
    updateAverageResponseTime(responseTimeMs);
  }
}

export function trackMessageReceived(responseTimeMs?: number): void {
  metrics.messagesReceived++;
  if (responseTimeMs) {
    updateAverageResponseTime(responseTimeMs);
  }
}

function updateAverageResponseTime(newTime: number): void {
  const totalTime = metrics.averageResponseTime * (metrics.messagesSent - 1) + newTime;
  metrics.averageResponseTime = totalTime / metrics.messagesSent;
}

export function getMetrics(): FrontendMetrics {
  return { ...metrics };
}

export function resetMetrics(): void {
  metrics = {
    messagesSent: 0,
    messagesReceived: 0,
    errorsEncountered: 0,
    averageResponseTime: 0,
    sessionStartTime: new Date().toISOString(),
  };
}

// ============================================================
// BACKEND COMMUNICATION
// ============================================================

async function sendErrorsToBackend(errors: ErrorPayload[]): Promise<void> {
  if (!config.endpoint) return;

  const correlationId = getCorrelationId();

  await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
    },
    body: JSON.stringify({ errors }),
    keepalive: true, // Ensure request completes even if page unloads
  });
}

export async function flushErrors(): Promise<void> {
  if (errorBuffer.length === 0) return;

  const errors = [...errorBuffer];
  errorBuffer.length = 0;

  await sendErrorsToBackend(errors);
}

// ============================================================
// CONFIGURATION
// ============================================================

export function updateConfig(newConfig: Partial<ErrorTrackingConfig>): void {
  config = { ...config, ...newConfig };
}

export function getConfig(): ErrorTrackingConfig {
  return { ...config };
}

// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ChatAnalyticsErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    trackError(error, {
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-semibold">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">
            We apologize for the inconvenience. Please try refreshing the page.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  initErrorTracking,
  initSentry,
  trackError,
  trackWarning,
  trackInfo,
  trackAPIError,
  trackMessageSent,
  trackMessageReceived,
  setUserContext,
  setTag,
  setConversationContext,
  getMetrics,
  resetMetrics,
  updateConfig,
  getConfig,
  flushErrors,
  ChatAnalyticsErrorBoundary,
};
