import React, { Component, ErrorInfo, ReactNode, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, AlertCircle, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// NILIN Design System - Enhanced Error Boundary
// =============================================================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  className?: string;
  /** Page name for error reporting and user-friendly messages */
  pageName?: string;
  /** Enable retry functionality */
  enableRetry?: boolean;
  /** Show error details in development */
  showDevDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: 'generic' | 'network' | 'auth' | 'data' | 'unknown';
  errorId: string;
  retryCount: number;
  lastRetryTime: number | null;
}

const MAX_RETRIES = 3;
const RETRY_COOLDOWN_MS = 5000;

/**
 * EnhancedErrorBoundary - Production-ready error boundary with:
 * - Error categorization (network, auth, data, generic)
 * - Automatic retry with cooldown
 * - Detailed error logging
 * - Accessible error states
 * - Recovery actions
 */
export class EnhancedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'generic',
      errorId: this.generateErrorId(),
      retryCount: 0,
      lastRetryTime: null,
    };
  }

  private generateErrorId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorType = EnhancedErrorBoundary.categorizeError(error);
    return {
      hasError: true,
      error,
      errorType,
    };
  }

  static categorizeError(error: Error): State['errorType'] {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      name.includes('network') ||
      name.includes('fetch') ||
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return 'network';
    }

    // Auth errors
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('token') ||
      message.includes('authentication')
    ) {
      return 'auth';
    }

    // Data/validation errors
    if (
      message.includes('404') ||
      message.includes('not found') ||
      message.includes('invalid') ||
      message.includes('parse') ||
      message.includes('json')
    ) {
      return 'data';
    }

    return 'generic';
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { pageName, onError } = this.props;

    // Log to console in development
    if (import.meta.env.DEV) {
      console.group(`[ErrorBoundary:${pageName || 'Unknown'}]`);
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // Log to monitoring service in production
    if (import.meta.env.PROD) {
      // Send to error tracking (Sentry, etc.)
      this.logError(error, errorInfo);
    }

    // Call custom error handler
    onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  private logError(error: Error, errorInfo: ErrorInfo): void {
    const { errorId } = this.state;
    const errorLog = {
      id: errorId,
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    // Log to console for now (in production, send to error tracking service)
    console.error('[ErrorBoundary]', errorLog);
  }

  handleRetry = (): void => {
    const { retryCount, lastRetryTime } = this.state;

    // Check cooldown
    if (lastRetryTime && Date.now() - lastRetryTime < RETRY_COOLDOWN_MS) {
      const remainingTime = Math.ceil((RETRY_COOLDOWN_MS - (Date.now() - lastRetryTime)) / 1000);
      console.warn(`Retry cooldown: ${remainingTime}s remaining`);
      return;
    }

    // Check max retries
    if (retryCount >= MAX_RETRIES) {
      console.warn('Max retries reached');
      return;
    }

    // Perform retry
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'generic',
      errorId: this.generateErrorId(),
      retryCount: prev.retryCount + 1,
      lastRetryTime: Date.now(),
    }));

    // Call parent's reset handler
    this.props.onReset?.();
  };

  handleGoBack = (): void => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  canRetry(): boolean {
    const { retryCount } = this.state;
    return retryCount < MAX_RETRIES;
  }

  getRetryCooldownRemaining(): number {
    const { lastRetryTime } = this.state;
    if (!lastRetryTime) return 0;
    return Math.max(0, RETRY_COOLDOWN_MS - (Date.now() - lastRetryTime));
  }

  renderNetworkError(): ReactNode {
    return (
      <div
        className={cn(
          'min-h-[400px] flex items-center justify-center p-6',
          'bg-gradient-to-b from-nilin-cream/50 to-white rounded-xl border border-nilin-border/30',
          this.props.className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="max-w-md w-full text-center">
          {/* Error Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100/50 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-blue-500" />
          </div>

          {/* Error Message */}
          <h2 className="text-xl font-bold text-nilin-charcoal mb-2">
            Connection Lost
          </h2>
          <p className="text-nilin-warmGray mb-6">
            We couldn't connect to our servers. Please check your internet connection and try again.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleRetry}
              disabled={!this.canRetry()}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all',
                'bg-blue-500 text-white hover:bg-blue-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <button
              onClick={this.handleGoHome}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all',
                'bg-white text-nilin-charcoal border border-nilin-border hover:bg-nilin-muted/50'
              )}
            >
              <Home className="w-4 h-4" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderAuthError(): ReactNode {
    return (
      <div
        className={cn(
          'min-h-[400px] flex items-center justify-center p-6',
          'bg-gradient-to-b from-nilin-cream/50 to-white rounded-xl border border-nilin-border/30',
          this.props.className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="max-w-md w-full text-center">
          {/* Error Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-100/50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-yellow-600" />
          </div>

          {/* Error Message */}
          <h2 className="text-xl font-bold text-nilin-charcoal mb-2">
            Session Expired
          </h2>
          <p className="text-nilin-warmGray mb-6">
            Your session has expired. Please log in again to continue.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { window.location.href = '/login'; }}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all',
                'bg-yellow-500 text-white hover:bg-yellow-600'
              )}
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderGenericError(): ReactNode {
    const { error, errorInfo, retryCount, errorId } = this.state;
    const { pageName, enableRetry = true, showDevDetails = true } = this.props;
    const canRetry = this.canRetry();
    const cooldownRemaining = this.getRetryCooldownRemaining();

    return (
      <div
        className={cn(
          'min-h-[400px] flex items-center justify-center p-6',
          'bg-gradient-to-b from-nilin-cream/50 to-white rounded-xl border border-nilin-border/30',
          this.props.className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="max-w-md w-full text-center">
          {/* Error Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-nilin-coral/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-nilin-coral" />
          </div>

          {/* Error Message */}
          <h2 className="text-xl font-bold text-nilin-charcoal mb-2">
            {pageName ? `Something went wrong in ${pageName}` : 'Something went wrong'}
          </h2>
          <p className="text-nilin-warmGray mb-4">
            We encountered an error loading this content. Please try again.
          </p>

          {/* Error ID for support */}
          <p className="text-xs text-nilin-lightGray mb-4">
            Error ID: <code className="bg-nilin-muted px-1 rounded">{errorId}</code>
          </p>

          {/* Error Details (Development Only) */}
          {showDevDetails && import.meta.env.DEV && error && (
            <details className="text-left bg-nilin-muted/30 rounded-lg p-3 mb-4 text-xs max-h-48 overflow-auto">
              <summary className="font-semibold cursor-pointer text-nilin-charcoal">
                Error Details
              </summary>
              <pre className="mt-2 overflow-auto text-nilin-warmGray break-all">
                {error.toString()}
                {'\n\n'}
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {enableRetry && (
              <button
                onClick={this.handleRetry}
                disabled={!canRetry}
                className={cn(
                  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all',
                  'bg-nilin-coral text-white hover:bg-nilin-rose',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                aria-describedby={!canRetry ? 'retry-limit-message' : undefined}
              >
                <RefreshCw className="w-4 h-4" />
                {cooldownRemaining > 0
                  ? `Wait ${Math.ceil(cooldownRemaining / 1000)}s`
                  : `Try Again (${retryCount}/${MAX_RETRIES})`
                }
              </button>
            )}

            <button
              onClick={this.handleGoBack}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all',
                'bg-white text-nilin-charcoal border border-nilin-border hover:bg-nilin-muted/50'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>

            <button
              onClick={this.handleGoHome}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all',
                'bg-nilin-blush text-nilin-charcoal hover:bg-nilin-peach'
              )}
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>

          {/* Retry limit message for screen readers */}
          {!canRetry && (
            <p id="retry-limit-message" className="sr-only">
              Maximum retry attempts reached. Please refresh the page or navigate to a different page.
            </p>
          )}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { hasError, errorType } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      // Render specialized error UI based on error type
      switch (errorType) {
        case 'network':
          return this.renderNetworkError();
        case 'auth':
          return this.renderAuthError();
        case 'data':
        case 'generic':
        default:
          return this.renderGenericError();
      }
    }

    return children;
  }
}

// =============================================================================
// Hook version for functional components
// =============================================================================

interface UseErrorHandlerOptions {
  /** Called when an error is thrown */
  onError?: (error: Error) => void;
  /** Enable error boundary reset capability */
  enableReset?: boolean;
}

/**
 * Hook to throw errors in functional components
 * Use with ErrorBoundary for proper error handling
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { onError, enableReset = false } = options;

  const handleError = useCallback(
    (error: Error) => {
      // Log error
      console.error('[useErrorHandler]', error);

      // Call custom handler
      onError?.(error);

      // Throw to error boundary
      throw error;
    },
    [onError]
  );

  return { handleError };
}

// =============================================================================
// Exports
// =============================================================================

export default EnhancedErrorBoundary;
