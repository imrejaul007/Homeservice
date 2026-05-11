// Sentry instrumentation file
// This should be imported at the very top of the application

const Sentry = require('@sentry/node');

// Initialize Sentry with your DSN
Sentry.init({
  dsn: 'https://41229a41e30887702c1119dabeda0b98@o4511370191175680.ingest.us.sentry.io/4511370213720064',

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release version
  release: process.env.APP_VERSION || '1.0.0',

  // Include app name in tags
  beforeSend(event) {
    // Don't send health check errors
    if (event.request?.url?.includes('/health')) {
      return null;
    }
    return event;
  },

  // Set default tags
  defaultTags: {
    app_name: 'NILIN-Backend',
    version: process.env.APP_VERSION || '1.0.0',
  },
});

module.exports = Sentry;
