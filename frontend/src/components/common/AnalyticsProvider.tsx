import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { analyticsService } from '../../lib/AnalyticsService';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { UseAnalyticsOptions } from '../../hooks/useAnalytics';
import { useAuthStore } from '../../stores/authStore';

// =============================================================================
// Analytics Context Types
// =============================================================================

interface AnalyticsContextValue {
  /** Analytics initialized */
  isInitialized: boolean;
  /** Analytics initializing */
  isLoading: boolean;
  /** Current user ID */
  userId: string | null;
  /** Track a custom event */
  track: ReturnType<typeof useAnalytics>['track'];
  /** Track auth event */
  trackAuth: ReturnType<typeof useAnalytics>['trackAuth'];
  /** Track booking event */
  trackBooking: ReturnType<typeof useAnalytics>['trackBooking'];
  /** Track navigation event */
  trackNavigation: ReturnType<typeof useAnalytics>['trackNavigation'];
  /** Track performance event */
  trackPerformance: ReturnType<typeof useAnalytics>['trackPerformance'];
  /** Track search event */
  trackSearch: ReturnType<typeof useAnalytics>['trackSearch'];
  /** Track error */
  trackError: ReturnType<typeof useAnalytics>['trackError'];
  /** Track screen view */
  trackScreen: ReturnType<typeof useAnalytics>['trackScreen'];
  /** Track booking funnel step */
  trackBookingFunnelStep: ReturnType<typeof useAnalytics>['trackBookingFunnelStep'];
  /** Reset booking funnel */
  resetBookingFunnel: ReturnType<typeof useAnalytics>['resetBookingFunnel'];
  /** Set user properties */
  setUserProperties: ReturnType<typeof useAnalytics>['setUserProperties'];
  /** Clear user properties */
  clearUserProperties: ReturnType<typeof useAnalytics>['clearUserProperties'];
  /** Measure render time */
  measureRenderTime: ReturnType<typeof useAnalytics>['measureRenderTime'];
  /** Start API tracking */
  startApiTracking: ReturnType<typeof useAnalytics>['startApiTracking'];
  /** Record API latency */
  recordApiLatency: ReturnType<typeof useAnalytics>['recordApiLatency'];
}

interface AnalyticsProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Analytics options */
  options?: UseAnalyticsOptions;
  /** Callback when analytics is initialized */
  onInitialized?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

// =============================================================================
// Create Context
// =============================================================================

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

/**
 * AnalyticsProvider - Provides analytics tracking to all components
 *
 * Features:
 * - Auto-initializes analytics service on mount
 * - Integrates with Sentry for error tracking
 * - Auto-tracks user changes (login/logout)
 * - Auto-tracks screen views
 * - Provides typed analytics methods to children
 *
 * @example
 * // Wrap your app with AnalyticsProvider
 * <AnalyticsProvider>
 *   <App />
 * </AnalyticsProvider>
 *
 * @example
 * // With custom options
 * <AnalyticsProvider
 *   autoInitialize={true}
 *   options={{ autoScreenTracking: true, autoBookingTracking: true }}
 *   onInitialized={() => console.log('Analytics ready')}
 * >
 *   <App />
 * </AnalyticsProvider>
 *
 * @example
 * // Using analytics in a component
 * function MyComponent() {
 *   const { trackScreen, trackBooking } = useAnalytics();
 *
 *   useEffect(() => {
 *     trackScreen('my_component');
 *   }, []);
 *
 *   const handleBook = () => {
 *     trackBooking('booking_start', { serviceId: '123' });
 *   };
 * }
 */
export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  autoInitialize = true,
  options = {},
  onInitialized,
  onError,
}) => {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(autoInitialize);
  const [initError, setInitError] = useState<Error | null>(null);

  // Get user from auth store
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Get analytics methods
  const analytics = useAnalytics(options);

  // Initialize analytics
  useEffect(() => {
    if (!autoInitialize || isInitialized) return;

    const initialize = async () => {
      setIsLoading(true);
      setInitError(null);

      try {
        // Initialize analytics service
        await analyticsService.initialize();
        setIsInitialized(true);
        onInitialized?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Analytics initialization failed');
        setInitError(err);
        onError?.(err);
        console.error('[AnalyticsProvider] Initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [autoInitialize, isInitialized, onInitialized, onError]);

  // Sync user ID with analytics
  useEffect(() => {
    if (isInitialized && user?._id) {
      analytics.setUserProperties({
        userId: user._id,
        email: user.email,
        name: user.name || `${user.firstName} ${user.lastName}`,
        role: user.role,
        accountStatus: user.accountStatus,
      });
    } else if (isInitialized && !isAuthenticated) {
      analytics.clearUserProperties();
    }
  }, [isInitialized, user, isAuthenticated, analytics]);

  // Setup Sentry integration for error tracking
  useEffect(() => {
    if (!isInitialized) return;

    // Listen for analytics error events
    const handleAnalyticsError = (event: CustomEvent) => {
      const { errorType, errorMessage, stackTrace, context } = event.detail || {};
      console.error('[Analytics] Error event:', errorType, errorMessage);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('analytics-error', handleAnalyticsError as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('analytics-error', handleAnalyticsError as EventListener);
      }
    };
  }, [isInitialized]);

  // Handle Sentry integration
  useEffect(() => {
    if (!isInitialized) return;

    // In production, setup Sentry integration here
    // Example:
    // import * as Sentry from '@sentry/react';
    //
    // Sentry.init({
    //   dsn: import.meta.env.VITE_SENTRY_DSN,
    //   environment: import.meta.env.MODE,
    //   integrations: [
    //     Sentry.browserTracingIntegration(),
    //     Sentry.replayIntegration(),
    //   ],
    //   tracesSampleRate: 0.1,
    //   replaysSessionSampleRate: 0.1,
    //   replaysOnErrorSampleRate: 1.0,
    // });

    // Listen for analytics events and forward to Sentry
    const handleAnalyticsEvent = (event: CustomEvent) => {
      const { category, name, properties } = event.detail || {};

      // Forward error events to Sentry
      if (category === 'error') {
        // Sentry.captureMessage(`${category}/${name}`, {
        //   extra: properties,
        // });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('analytics-event', handleAnalyticsEvent as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('analytics-event', handleAnalyticsEvent as EventListener);
      }
    };
  }, [isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        analyticsService.destroy();
      }
    };
  }, [isInitialized]);

  // Build context value
  const contextValue: AnalyticsContextValue = {
    isInitialized,
    isLoading,
    userId: user?._id || null,
    track: analytics.track,
    trackAuth: analytics.trackAuth,
    trackBooking: analytics.trackBooking,
    trackNavigation: analytics.trackNavigation,
    trackPerformance: analytics.trackPerformance,
    trackSearch: analytics.trackSearch,
    trackError: analytics.trackError,
    trackScreen: analytics.trackScreen,
    trackBookingFunnelStep: analytics.trackBookingFunnelStep,
    resetBookingFunnel: analytics.resetBookingFunnel,
    setUserProperties: analytics.setUserProperties,
    clearUserProperties: analytics.clearUserProperties,
    measureRenderTime: analytics.measureRenderTime,
    startApiTracking: analytics.startApiTracking,
    recordApiLatency: analytics.recordApiLatency,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
};

// =============================================================================
// useAnalytics Hook (Consumer)
// =============================================================================

/**
 * useAnalytics - Access analytics from context
 *
 * Must be used within an AnalyticsProvider.
 *
 * @returns Analytics context value
 * @throws Error if used outside AnalyticsProvider
 *
 * @example
 * function MyComponent() {
 *   const { trackScreen, trackBooking } = useAnalytics();
 *
 *   useEffect(() => {
 *     trackScreen('my_component');
 *   }, []);
 *
 *   return <div>...</div>;
 * }
 */
export function useAnalyticsContext(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);

  if (!context) {
    throw new Error(
      'useAnalytics must be used within an AnalyticsProvider. ' +
      'Wrap your app with <AnalyticsProvider> to enable analytics tracking.'
    );
  }

  return context;
}

// =============================================================================
// withAnalytics HOC (for class components)
// =============================================================================

/**
 * withAnalytics - Higher-order component for class components
 *
 * @param Component - Class component to wrap
 * @param options - Analytics options
 * @returns Wrapped component with analytics
 *
 * @example
 * class MyClassComponent extends React.Component {
 *   render() {
 *     const { trackScreen } = this.props.analytics;
 *     return <div>...</div>;
 *   }
 * }
 *
 * export default withAnalytics(MyClassComponent);
 */
export function withAnalytics<P extends object>(
  Component: React.ComponentType<P>,
  options?: UseAnalyticsOptions
): React.FC<P> {
  const WithAnalytics: React.FC<P> = (props) => (
    <AnalyticsProvider options={options}>
      <ComponentWithAnalytics {...props} />
    </AnalyticsProvider>
  );

  const ComponentWithAnalytics: React.FC<P & { analytics?: AnalyticsContextValue }> = ({
    analytics: _analytics,
    ...props
  }) => {
    const context = useAnalyticsContext();
    return <Component {...(props as P)} analytics={context} />;
  };

  WithAnalytics.displayName = `WithAnalytics(${Component.displayName || Component.name})`;

  return WithAnalytics;
}

// =============================================================================
// Analytics Debug Panel Component
// =============================================================================

interface AnalyticsDebugPanelProps {
  /** Show panel */
  visible?: boolean;
  /** Position */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * AnalyticsDebugPanel - Debug panel for analytics events
 * Only renders in development mode
 */
export const AnalyticsDebugPanel: React.FC<AnalyticsDebugPanelProps> = ({
  visible = false,
  position = 'bottom-right',
}) => {
  const [events, setEvents] = useState<Array<{ id: string; name: string; time: string }>>([]);
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleEvent = (event: CustomEvent) => {
      const { name, category } = event.detail || {};
      setEvents((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${category}/${name}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9), // Keep last 10 events
      ]);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('analytics-event', handleEvent as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('analytics-event', handleEvent as EventListener);
      }
    };
  }, []);

  if (!import.meta.env.DEV || !isVisible) return null;

  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'bottom-right': { bottom: 16, right: 16 },
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        fontSize: 12,
        maxWidth: 300,
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>Analytics Events</span>
        <button
          onClick={() => setEvents([])}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ color: '#888' }}>No events tracked yet</div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid #333',
              }}
            >
              <span style={{ color: '#888' }}>{event.time}</span>{' '}
              <span style={{ color: '#8b5cf6' }}>{event.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export { AnalyticsProvider as default };
export { AnalyticsContext };
export type { AnalyticsProviderProps, AnalyticsContextValue };
