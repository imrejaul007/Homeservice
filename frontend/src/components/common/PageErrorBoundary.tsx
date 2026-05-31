import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  className?: string;
  /** Page name for error reporting */
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * PageErrorBoundary - Isolated error boundary for individual pages
 *
 * Provides graceful error recovery without crashing the entire app.
 * Shows a user-friendly error message with options to retry or navigate away.
 *
 * Usage:
 * <PageErrorBoundary pageName="SearchPage">
 *   <SearchPageContent />
 * </PageErrorBoundary>
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging (in production, send to error tracking service)
    console.error(`[PageErrorBoundary:${this.props.pageName || 'Unknown'}] Error caught:`, error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
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

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, className, pageName } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div
          className={cn(
            'min-h-[400px] flex items-center justify-center p-6',
            'bg-nilin-cream/50 rounded-xl border border-nilin-border/30',
            className
          )}
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
            <p className="text-nilin-warmGray mb-6">
              We encountered an error loading this page. Please try again.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="text-left bg-nilin-muted/30 rounded-lg p-3 mb-4 text-xs max-h-32 overflow-auto">
                <summary className="font-semibold cursor-pointer text-nilin-charcoal">
                  Error Details
                </summary>
                <pre className="mt-2 overflow-auto text-nilin-warmGray">
                  {error.toString()}
                  {'\n\n'}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'px-5 py-2.5 rounded-full',
                  'bg-nilin-coral text-white font-medium',
                  'hover:bg-nilin-rose transition-colors shadow-sm'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={this.handleGoBack}
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'px-5 py-2.5 rounded-full',
                  'bg-white text-nilin-charcoal font-medium',
                  'border border-nilin-border hover:bg-nilin-muted/50 transition-colors'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>

              <button
                onClick={this.handleGoHome}
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'px-5 py-2.5 rounded-full',
                  'bg-nilin-blush text-nilin-charcoal font-medium',
                  'hover:bg-nilin-peach transition-colors'
                )}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook to use error boundary reset programmatically
 */
export const useErrorBoundaryReset = () => {
  const errorBoundaryRef = React.useRef<PageErrorBoundary | null>(null);

  const setErrorBoundaryRef = React.useCallback((ref: PageErrorBoundary | null) => {
    errorBoundaryRef.current = ref;
  }, []);

  const resetErrorBoundary = React.useCallback(() => {
    errorBoundaryRef.current?.handleReset?.();
  }, []);

  return { setErrorBoundaryRef, resetErrorBoundary };
};

export default PageErrorBoundary;
