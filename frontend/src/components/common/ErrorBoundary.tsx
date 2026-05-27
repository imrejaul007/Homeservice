import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, Home, WifiOff, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: 'generic' | 'network' | 'auth';
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'generic',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type for appropriate fallback UI
    let errorType: State['errorType'] = 'generic';

    if (error.name === 'NetworkError' || error.message.includes('network')) {
      errorType = 'network';
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      errorType = 'auth';
    }

    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to monitoring service
    if (import.meta.env.PROD) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
      // TODO: Send to Sentry
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorType: 'generic' });
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorType: 'generic' });
    window.location.href = '/';
  };

  renderNetworkError = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-nilin-cream to-white px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8 text-center border border-nilin-border">
        <div className="w-20 h-20 bg-nilin-coral/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-nilin-coral" />
        </div>

        <h1 className="text-2xl font-serif font-bold text-nilin-charcoal mb-3">
          Connection Lost
        </h1>

        <p className="text-nilin-warmGray mb-6">
          We couldn't connect to our servers. Please check your internet connection and try again.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={this.handleReload}
            className="w-full px-6 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium rounded-xl hover:shadow-nilin-warm transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <button
            onClick={this.handleGoHome}
            className="w-full px-6 py-3 border border-nilin-border text-nilin-charcoal font-medium rounded-xl hover:bg-nilin-muted transition-all"
          >
            Go to Homepage
          </button>
        </div>

        <p className="text-xs text-nilin-lightGray mt-6">
          If this problem persists, please contact support
        </p>
      </div>
    </div>
  );

  renderAuthError = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-nilin-cream to-white px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8 text-center border border-nilin-border">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-yellow-600" />
        </div>

        <h1 className="text-2xl font-serif font-bold text-nilin-charcoal mb-3">
          Session Expired
        </h1>

        <p className="text-nilin-warmGray mb-6">
          Your session has expired. Please log in again to continue.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              window.location.href = '/login';
            }}
            className="w-full px-6 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium rounded-xl hover:shadow-nilin-warm transition-all"
          >
            Log In Again
          </button>
        </div>
      </div>
    </div>
  );

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render specialized error UI based on error type
      if (this.state.errorType === 'network') {
        return this.renderNetworkError();
      }

      if (this.state.errorType === 'auth') {
        return this.renderAuthError();
      }

      // Generic error fallback
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-nilin-cream to-white px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8 text-center border border-nilin-border">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h1 className="text-2xl font-serif font-bold text-nilin-charcoal mb-3">
              Something went wrong
            </h1>

            <p className="text-nilin-warmGray mb-6">
              We encountered an unexpected error. Please try refreshing the page or go back to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 rounded-xl text-left">
                <p className="text-sm font-mono text-red-600 break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleGoHome}
                className="flex-1 px-4 py-3 border border-nilin-border text-nilin-charcoal font-medium rounded-xl hover:bg-nilin-muted transition-all flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium rounded-xl hover:shadow-nilin-warm transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
            </div>

            <p className="text-xs text-nilin-lightGray mt-6">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for easier usage
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  if (error) {
    throw error;
  }

  return setError;
}

export default ErrorBoundary;
