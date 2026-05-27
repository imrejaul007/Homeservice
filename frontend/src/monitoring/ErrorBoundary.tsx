import { ReactNode, ReactElement } from 'react';
import { ErrorBoundary as SentryErrorBoundary, showReportDialog } from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactElement;
}

export function ErrorBoundary({ children, fallback }: Props) {
  return (
    <SentryErrorBoundary
      fallback={({ eventId }) => (
        fallback || (
          <div className="error-boundary p-4">
            <h2>Something went wrong</h2>
            <p className="text-sm text-gray-600">
              We're working on fixing this issue.
            </p>
            <button
              onClick={() => showReportDialog({ eventId })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
            >
              Report feedback
            </button>
          </div>
        )
      )}
    >
      {children}
    </SentryErrorBoundary>
  );
}
