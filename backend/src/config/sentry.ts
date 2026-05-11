import * as Sentry from '@sentry/node';
import logger from '../utils/logger';

// Sentry configuration
export const initializeSentry = () => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',

    // Set user context in preprocessing
    beforeSend(event) {
      // Filter out health check errors
      if (event.request?.url?.includes('/health')) {
        return null;
      }

      // Log to our internal logger as well
      logger.error('Sentry event captured', {
        eventId: event.event_id,
        platform: event.platform,
        action: 'SENTRY_CAPTURE',
      });

      return event;
    },

    // Add custom tags
    initialScope: {
      tags: {
        app_name: process.env.APP_NAME || 'HomeService',
        version: process.env.APP_VERSION || '1.0.0',
      },
    },
  });

  logger.info('Sentry initialized', {
    environment: process.env.NODE_ENV,
    action: 'SENTRY_INIT',
  });
};

// Capture exception helper
export const captureException = (
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
export const setUserContext = (user: {
  id: string;
  email?: string;
  role?: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
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

// Set context
export const setContext = (name: string, context: Record<string, unknown>) => {
  Sentry.setContext(name, context);
};

// Express middleware (manual integration for v10)
export const sentryRequestHandler = (req: any, _res: any, next: any) => {
  Sentry.getCurrentScope().setTransactionName(`${req.method} ${req.path}`);
  next();
};

// Express error handler
export const sentryErrorHandler = (err: any, _req: any, _res: any, next: any) => {
  Sentry.captureException(err);
  next(err);
};

export default {
  initializeSentry,
  captureException,
  captureMessage,
  setUserContext,
  addBreadcrumb,
  setContext,
  sentryRequestHandler,
  sentryErrorHandler,
};
