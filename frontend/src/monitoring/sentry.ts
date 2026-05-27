import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/browser';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,

  integrations: [
    browserTracingIntegration(),
  ],

  tracesSampleRate: 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  beforeSend(event) {
    // Filter out user-identifiable data in production
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  },
});

export const sentry = Sentry;
