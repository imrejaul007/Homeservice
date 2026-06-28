import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

export const initializeSentry = () => {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  // Skip in local dev unless explicitly enabled (avoids ad-blocker noise on ingest URLs)
  const sentryEnabled =
    import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLED === 'true';
  if (!sentryEnabled) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Send PII data
    sendDefaultPii: true,

    // React integration
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Session replay
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,

    // Environment
    environment: import.meta.env.PROD ? 'production' : 'development',
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',

    // Filter out health check errors
    beforeSend(event) {
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },

    // Set user context
    initialScope: {
      tags: {
        app_name: import.meta.env.VITE_APP_NAME || 'NILIN-Frontend',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      },
    },
  });

  console.log('Sentry initialized for frontend');
};

// Capture error helper
export const captureError = (
  error: Error | unknown,
  context?: Record<string, unknown>
) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Capture message helper
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info'
) => {
  Sentry.captureMessage(message, level);
};

// Set user context
export const setUser = (user: {
  id: string;
  email?: string;
  role?: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    segment: user.role,
  });
};

// Clear user context (on logout)
export const clearUser = () => {
  Sentry.setUser(null);
};

// Add breadcrumb
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    timestamp: Date.now(),
  });
};

export default {
  initializeSentry,
  captureError,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
};
