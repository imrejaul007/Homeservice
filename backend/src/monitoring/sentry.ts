import * as Sentry from '@sentry/node';

// Inline RewriteFrames integration for Node.js
class RewriteFramesIntegration {
  private readonly root?: string;

  constructor(options: { root?: string } = {}) {
    this.root = options.root;
  }

  public name: string = 'RewriteFramesIntegration';

  public setupOnce(): void {
    // Rewrite stack frames to point to compiled source maps
    Sentry.addEventProcessor((event: Sentry.Event) => {
      const self = this;
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          if (exception.stacktrace?.frames) {
            exception.stacktrace.frames = exception.stacktrace.frames.reverse().map((frame: { filename?: string }) => {
              if (frame.filename) {
                frame.filename = self._iterateFrame(frame.filename);
              }
              return frame;
            }).reverse();
          }
        }
      }
      return event;
    });
  }

  private _iterateFrame(filename: string): string {
    const base = this.root ?? process.cwd();
    // Replace Windows and Unix path separators, and strip file:// prefix
    const stripped = filename
      .replace(`file://${base}`, '')
      .replace(base, '')
      .replace(/\\/g, '/');

    return `app:///${stripped.startsWith('/') ? stripped.slice(1) : stripped}`;
  }
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  integrations: [
    new RewriteFramesIntegration({
      root: process.cwd(),
    }),
  ],

  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

  attachStacktrace: true,
  maxBreadcrumbs: 50,

  beforeSend(event) {
    // Filter out health check errors
    if (event.request?.url?.includes('/health')) {
      return null;
    }
    return event;
  },

  beforeSendTransaction(transaction) {
    // Don't send health check transactions
    const httpResponse = transaction.contexts?.http?.response as Record<string, unknown> | undefined;
    if (httpResponse && 'statusCode' in httpResponse) {
      const statusCode = httpResponse.statusCode as number;
      if (statusCode === 200) {
        const path = transaction.contexts?.http?.url;
        if (typeof path === 'string' && (path.includes('/health') || path.includes('/metrics'))) {
          return null;
        }
      }
    }
    return transaction;
  },
});

// Export sentry instance
export const sentry = Sentry;
