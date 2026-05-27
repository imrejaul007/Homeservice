import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../lib/AnalyticsService';
import {
  EventCategory,
  AuthEvent,
  BookingEvent,
  NavigationEvent,
  PerformanceEvent,
  SearchEvent,
} from '../lib/eventTaxonomy';

// =============================================================================
// NILIN Analytics Hook
// Auto-tracks screen views, booking funnel, and performance metrics
// =============================================================================

// =============================================================================
// Types
// =============================================================================

interface UseAnalyticsOptions {
  /** Enable auto screen tracking (default: true) */
  autoScreenTracking?: boolean;
  /** Enable booking funnel tracking (default: true) */
  autoBookingTracking?: boolean;
  /** Enable performance tracking (default: true) */
  autoPerformanceTracking?: boolean;
  /** Custom screen name resolver */
  screenNameResolver?: (pathname: string) => string;
}

interface BookingFunnelState {
  step: number;
  providerId?: string;
  serviceId?: string;
  scheduledTime?: string;
  addressId?: string;
  addons?: string[];
  paymentMethod?: string;
  totalPrice?: number;
}

interface APILatencyResult {
  endpoint: string;
  latency: number;
  success: boolean;
  error?: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIONS: UseAnalyticsOptions = {
  autoScreenTracking: true,
  autoBookingTracking: true,
  autoPerformanceTracking: true,
};

// =============================================================================
// Default Screen Name Resolver
// =============================================================================

const DEFAULT_SCREEN_RESOLVER = (pathname: string): string => {
  // Remove leading slash and normalize
  const normalized = pathname.replace(/^\//, '').replace(/\/$/, '') || 'home';

  // Convert to readable screen name
  return normalized
    .split('/')
    .map((segment, index) => {
      // Keep dynamic segments as-is (e.g., booking/:id -> booking_123)
      if (segment.match(/^[a-f0-9]{24}$/i)) {
        return segment;
      }
      // Keep numeric IDs
      if (segment.match(/^\d+$/)) {
        return segment;
      }
      // Title case the segment
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join('_');
};

// =============================================================================
// useAnalytics Hook
// =============================================================================

/**
 * useAnalytics - Comprehensive analytics hook for NILIN app
 *
 * Features:
 * - Auto screen tracking on route changes
 * - Auto booking funnel tracking
 * - Auto performance metrics collection
 * - Manual event tracking helpers
 * - API latency tracking
 *
 * @param options - Configuration options
 * @returns Analytics methods and state
 *
 * @example
 * // Basic usage - auto tracks screen views
 * const { track, trackBooking, trackError } = useAnalytics();
 *
 * @example
 * // With custom options
 * const analytics = useAnalytics({
 *   autoScreenTracking: false,
 *   screenNameResolver: (path) => customResolver(path),
 * });
 *
 * @example
 * // Track API latency
 * const { withTracking } = useAnalytics();
 * const data = await withTracking('/api/services', () => fetchData());
 */
export function useAnalytics(options: UseAnalyticsOptions = DEFAULT_OPTIONS) {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  const previousScreenRef = useRef<string | null>(null);

  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Initialize analytics service
  useEffect(() => {
    if (!analyticsService.isInitialized()) {
      analyticsService.initialize();
    }
  }, []);

  // =========================================================================
  // Auto Screen Tracking
  // =========================================================================

  useEffect(() => {
    if (!config.autoScreenTracking) return;

    const currentPath = location.pathname;
    const screenName = config.screenNameResolver
      ? config.screenNameResolver(currentPath)
      : DEFAULT_SCREEN_RESOLVER(currentPath);

    // FIX #11: Handle first render properly - don't track SCREEN_LEFT for initial navigation
    const isFirstRender = previousPathRef.current === null;

    // Track screen view if path changed
    if (previousPathRef.current !== currentPath) {
      // FIX #11: Only track leaving previous screen if we have a previous screen
      // (i.e., this is not the first render)
      if (!isFirstRender && previousScreenRef.current) {
        analyticsService.trackNavigation(NavigationEvent.SCREEN_LEFT, {
          previousScreen: previousScreenRef.current,
          screenName: previousPathRef.current,
        });
      }

      // Track new screen
      analyticsService.trackScreen(screenName, {
        pathname: currentPath,
        search: location.search,
        hash: location.hash,
        isInitial: isFirstRender,
      });

      previousPathRef.current = currentPath;
      previousScreenRef.current = screenName;
    }
  }, [location, config.autoScreenTracking, config.screenNameResolver]);

  // =========================================================================
  // Track Methods
  // =========================================================================

  /**
   * Track a generic event
   */
  const track = useCallback(
    (category: EventCategory, name: string, properties?: Record<string, unknown>) => {
      analyticsService.track(category, name, properties);
    },
    []
  );

  /**
   * Track auth event
   */
  const trackAuth = useCallback(
    (event: AuthEvent, properties?: Record<string, unknown>) => {
      analyticsService.trackAuth(event, properties);
    },
    []
  );

  /**
   * Track booking event
   */
  const trackBooking = useCallback(
    (event: BookingEvent, properties?: Record<string, unknown>) => {
      analyticsService.trackBooking(event, properties);
    },
    []
  );

  /**
   * Track navigation event
   */
  const trackNavigation = useCallback(
    (event: NavigationEvent, properties?: Record<string, unknown>) => {
      analyticsService.trackNavigation(event, properties);
    },
    []
  );

  /**
   * Track performance event
   */
  const trackPerformance = useCallback(
    (event: PerformanceEvent, properties?: Record<string, unknown>) => {
      analyticsService.trackPerformance(event, properties);
    },
    []
  );

  /**
   * Track search event
   */
  const trackSearch = useCallback(
    (event: SearchEvent, properties?: Record<string, unknown>) => {
      analyticsService.trackSearch(event, properties);
    },
    []
  );

  /**
   * Track error
   */
  const trackError = useCallback(
    (errorType: string, message: string, context?: Record<string, unknown>) => {
      analyticsService.trackError(
        errorType as any,
        {
          errorType,
          errorMessage: message,
          context,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }
      );
    },
    []
  );

  // =========================================================================
  // API Latency Tracking
  // =========================================================================

  /**
   * Track API latency with automatic timing
   * Returns a function to call when the API call completes
   */
  const startApiTracking = useCallback((endpoint: string) => {
    return analyticsService.startApiTracking(endpoint);
  }, []);

  /**
   * Record API latency directly
   */
  const recordApiLatency = useCallback((endpoint: string, latency: number) => {
    analyticsService.recordApiLatency(endpoint, latency);
  }, []);

  /**
   * Track an API call with automatic timing
   * Wraps a promise and tracks its latency
   */
  const withApiTracking = useCallback(
    async <T>(
      endpoint: string,
      apiCall: () => Promise<T>
    ): Promise<T> => {
      const trackingResult = analyticsService.startApiTracking(endpoint);

      try {
        const result = await apiCall();
        // FIX #10: endTracking should only be called once - use the returned function
        trackingResult.endTracking();
        return result;
      } catch (error) {
        // FIX #10: Ensure endTracking is only called once even on error
        trackingResult.endTracking();
        throw error;
      }
    },
    []
  );

  // =========================================================================
  // Booking Funnel Helpers
  // =========================================================================

  const bookingFunnelRef = useRef<BookingFunnelState>({
    step: 0,
  });

  /**
   * Track booking funnel progression
   */
  const trackBookingFunnelStep = useCallback(
    (step: keyof typeof BOOKING_FUNNEL_STEPS, data?: Partial<BookingFunnelState>) => {
      const stepNumber = BOOKING_FUNNEL_STEPS[step];
      const previousStep = bookingFunnelRef.current.step;

      // Update funnel state
      bookingFunnelRef.current = {
        ...bookingFunnelRef.current,
        ...data,
        step: stepNumber,
      };

      // Track the step
      switch (step) {
        case 'start':
          analyticsService.trackBooking(BookingEvent.BOOKING_START, data);
          break;
        case 'providerSelected':
          analyticsService.trackBooking(BookingEvent.PROVIDER_SELECTED, data);
          break;
        case 'timeSelected':
          analyticsService.trackBooking(BookingEvent.TIME_SELECTED, data);
          break;
        case 'addressEntered':
          analyticsService.trackBooking(BookingEvent.ADDRESS_ENTERED, data);
          break;
        case 'paymentStarted':
          analyticsService.trackBooking(BookingEvent.PAYMENT_STARTED, data);
          break;
        case 'paymentCompleted':
          analyticsService.trackBooking(BookingEvent.PAYMENT_COMPLETED, data);
          break;
        case 'bookingConfirmed':
          analyticsService.trackBooking(BookingEvent.BOOKING_CONFIRMED, data);
          break;
        case 'bookingCancelled':
          analyticsService.trackBooking(BookingEvent.BOOKING_CANCELLED, data);
          break;
      }

      // Track funnel drop-off if step decreased
      if (stepNumber < previousStep && previousStep > 0) {
        analyticsService.trackBooking(BookingEvent.BOOKING_CANCELLED, {
          dropOffStep: previousStep,
          completedStep: stepNumber,
        });
      }
    },
    []
  );

  /**
   * Reset booking funnel tracking
   */
  const resetBookingFunnel = useCallback(() => {
    bookingFunnelRef.current = { step: 0 };
  }, []);

  // =========================================================================
  // Performance Metrics
  // =========================================================================

  /**
   * Track custom performance metric
   */
  const trackMetric = useCallback(
    (name: string, value: number, unit?: string) => {
      analyticsService.trackPerformance(PerformanceEvent.SCREEN_RENDER, {
        metricName: name,
        metricValue: value,
        metricUnit: unit,
      });
    },
    []
  );

  /**
   * Measure and track render time
   */
  const measureRenderTime = useCallback(
    (screenName: string, startTime: number) => {
      const renderTime = performance.now() - startTime;
      analyticsService.trackPerformance(PerformanceEvent.SCREEN_RENDER, {
        screenName,
        renderTime: Math.round(renderTime),
      });
      return renderTime;
    },
    []
  );

  // =========================================================================
  // User Properties
  // =========================================================================

  /**
   * Set user properties
   */
  const setUserProperties = useCallback(
    (properties: { userId?: string; [key: string]: unknown }) => {
      if (properties.userId) {
        analyticsService.setUserId(properties.userId);
      }
      analyticsService.setUserProperties(properties);
    },
    []
  );

  /**
   * Clear user properties (logout)
   */
  const clearUserProperties = useCallback(() => {
    analyticsService.clearUserProperties();
  }, []);

  // =========================================================================
  // Manual Screen Tracking
  // =========================================================================

  /**
   * Manually track a screen view
   */
  const trackScreen = useCallback(
    (screenName: string, properties?: Record<string, unknown>) => {
      analyticsService.trackScreen(screenName, properties);
    },
    []
  );

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // Track methods
    track,
    trackAuth,
    trackBooking,
    trackNavigation,
    trackPerformance,
    trackSearch,
    trackError,
    trackScreen,

    // API tracking
    startApiTracking,
    recordApiLatency,
    withApiTracking,

    // Booking funnel
    trackBookingFunnelStep,
    resetBookingFunnel,

    // Performance
    trackMetric,
    measureRenderTime,

    // User
    setUserProperties,
    clearUserProperties,

    // Direct access to service
    service: analyticsService,
  };
}

// =============================================================================
// Booking Funnel Steps
// =============================================================================

const BOOKING_FUNNEL_STEPS = {
  start: 1,
  providerSelected: 2,
  timeSelected: 3,
  addressEntered: 4,
  paymentStarted: 5,
  paymentCompleted: 6,
  bookingConfirmed: 7,
  bookingCancelled: 0,
} as const;

type BookingFunnelStep = keyof typeof BOOKING_FUNNEL_STEPS;

// =============================================================================
// Exports
// =============================================================================

export type { UseAnalyticsOptions, BookingFunnelState, APILatencyResult };
export default useAnalytics;
