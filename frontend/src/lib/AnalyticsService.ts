import { Capacitor } from '@capacitor/core';
import {
  track,
  trackAuth,
  trackBooking,
  trackPayment,
  trackNavigation,
  trackPerformance,
  trackSearch,
  trackError,
  setUserProperties,
  clearUserProperties,
  EventCategory,
  AuthEvent,
  BookingEvent,
  PaymentEvent,
  NavigationEvent,
  PerformanceEvent,
  SearchEvent,
  ErrorEvent,
} from './eventTaxonomy';
import type { UserProperties } from './eventTaxonomy';

// =============================================================================
// NILIN Unified Analytics Service
// Singleton pattern with event queue and automatic batching
// Package: com.nilin.app
// =============================================================================

// =============================================================================
// Configuration
// =============================================================================

interface AnalyticsConfig {
  /** Flush events after this many events (default: 10) */
  batchSize: number;
  /** Flush events after this interval in ms (default: 5000) */
  flushInterval: number;
  /** Enable debug logging */
  debug: boolean;
  /** Analytics endpoint URL */
  endpoint: string;
  /** Enable Sentry integration */
  sentryEnabled: boolean;
  /** Enable Firebase integration */
  firebaseEnabled: boolean;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  batchSize: 20,        // Increased from 10
  flushInterval: 30000, // Changed from 5000 (5s to 30s)
  debug: import.meta.env.DEV,
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/analytics',
  sentryEnabled: !import.meta.env.DEV,
  firebaseEnabled: !import.meta.env.DEV,
};

// =============================================================================
// Analytics Event Interface
// =============================================================================

interface AnalyticsEvent {
  id: string;
  category: EventCategory;
  name: string;
  timestamp: string;
  properties?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  platform: string;
  appVersion?: string;
}

// =============================================================================
// Analytics Service Class
// =============================================================================

class AnalyticsService {
  private static instance: AnalyticsService;

  // Configuration
  private config: AnalyticsConfig;

  // State
  private initialized = false;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private isOnline = true;

  // Performance tracking
  private performanceObserver: PerformanceObserver | null = null;
  private apiLatencyMetrics: Map<string, number[]> = new Map();

  // Private constructor - singleton pattern
  private constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<AnalyticsConfig>): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService(config);
    }
    return AnalyticsService.instance;
  }

  /**
   * Initialize analytics service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Generate session ID
    this.sessionId = this.getOrCreateSessionId();

    // Setup online/offline listeners
    this.setupNetworkListeners();

    // Setup performance observer
    this.setupPerformanceObserver();

    // Start flush timer
    this.startFlushTimer();

    // Flush any queued events
    await this.flushQueue();

    this.initialized = true;
  }

  /**
   * Check if analytics is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  // =========================================================================
  // Configuration Methods
  // =========================================================================

  /**
   * Update configuration
   */
  public configure(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  // =========================================================================
  // User Methods
  // =========================================================================

  /**
   * Set user ID for current session
   */
  public setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Get current user ID
   */
  public getUserId(): string | null {
    return this.userId;
  }

  /**
   * Set user properties (for Firebase, Amplitude, etc.)
   */
  public setUserProperties(properties: UserProperties): void {
    setUserProperties(properties);
  }

  /**
   * Clear user properties (on logout)
   */
  public clearUserProperties(): void {
    this.userId = null;
    clearUserProperties();
  }

  // =========================================================================
  // Event Tracking Methods
  // =========================================================================

  /**
   * Track a generic event
   */
  public track(
    category: EventCategory,
    name: string,
    properties?: Record<string, unknown>
  ): void {
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      category,
      name,
      timestamp: new Date().toISOString(),
      properties,
      userId: this.userId ?? undefined,
      sessionId: this.sessionId ?? undefined,
      platform: Capacitor.getPlatform(),
      appVersion: this.getAppVersion(),
    };

    // Add to queue
    this.eventQueue.push(event);

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushQueue();
    }

    // Also call the taxonomy track function
    track(category, name, properties as any);
  }

  /**
   * Track auth event
   */
  public trackAuth(event: AuthEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.AUTH, event, properties);
  }

  /**
   * Track booking event
   */
  public trackBooking(event: BookingEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.BOOKING, event, properties);
  }

  /**
   * Track payment event
   */
  public trackPayment(event: PaymentEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.PAYMENT, event, properties);
  }

  /**
   * Track navigation event
   */
  public trackNavigation(event: NavigationEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.NAVIGATION, event, properties);
  }

  /**
   * Track performance event
   */
  public trackPerformance(event: PerformanceEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.PERFORMANCE, event, properties);
  }

  /**
   * Track search event
   */
  public trackSearch(event: SearchEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.SEARCH, event, properties);
  }

  /**
   * Track error event
   */
  public trackError(event: ErrorEvent, properties?: Record<string, unknown>): void {
    this.track(EventCategory.ERROR, event, properties);
  }

  // =========================================================================
  // Screen Tracking
  // =========================================================================

  /**
   * Track screen view
   */
  public trackScreen(screenName: string, properties?: Record<string, unknown>): void {
    this.trackNavigation(NavigationEvent.SCREEN_VIEWED, {
      screenName,
      ...properties,
    });
  }

  // =========================================================================
  // API Latency Tracking
  // =========================================================================

  /**
   * Start tracking API latency
   */
  public startApiTracking(endpoint: string): { endTracking: () => void } {
    const startTime = performance.now();

    // Return object with endTracking method that records the latency
    return {
      endTracking: () => {
        const latency = performance.now() - startTime;
        this.recordApiLatency(endpoint, latency);
      }
    };
  }

  /**
   * Record API latency metric
   */
  public recordApiLatency(endpoint: string, latency: number): void {
    // Store in memory
    if (!this.apiLatencyMetrics.has(endpoint)) {
      this.apiLatencyMetrics.set(endpoint, []);
    }
    const metrics = this.apiLatencyMetrics.get(endpoint)!;
    metrics.push(latency);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Track as performance event
    this.trackPerformance(PerformanceEvent.API_LATENCY, {
      apiEndpoint: endpoint,
      latency: Math.round(latency),
    });

    // Warn if slow (> 1000ms)
    if (latency > 1000) {
      console.warn(`[Analytics] Slow API call detected: ${endpoint} took ${Math.round(latency)}ms`);
    }
  }

  /**
   * Get average latency for an endpoint
   */
  public getAverageLatency(endpoint: string): number | null {
    const metrics = this.apiLatencyMetrics.get(endpoint);
    if (!metrics || metrics.length === 0) return null;
    return metrics.reduce((a, b) => a + b, 0) / metrics.length;
  }

  // =========================================================================
  // Queue Management
  // =========================================================================

  /**
   * Flush events using batch processing (splice pattern for efficiency)
   * Flushes when batch is full OR interval expires
   */
  private flush(): void {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.config.batchSize);
    this.sendEvents(events).catch(err => {
      console.error('[Analytics] Flush failed:', err);
      // Re-add failed events to queue
      this.eventQueue.unshift(...events);
    });
  }

  /**
   * Flush event queue to backend
   */
  public async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to analytics backend
      await this.sendEvents(eventsToFlush);

      // Also send to Firebase if enabled
      if (this.config.firebaseEnabled) {
        this.sendToFirebase(eventsToFlush);
      }

      // Also send to Sentry if enabled
      if (this.config.sentryEnabled) {
        this.sendToSentry(eventsToFlush);
      }
    } catch (error) {
      // Re-queue failed events
      this.eventQueue = [...eventsToFlush, ...this.eventQueue];
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushQueue();
      }
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // =========================================================================
  // Network Listeners
  // =========================================================================

  /**
   * Setup online/offline listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // =========================================================================
  // Performance Observer
  // =========================================================================

  /**
   * Setup performance observer for web vitals
   */
  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Observe layout shifts
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            const layoutShift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!layoutShift.hadRecentInput && layoutShift.value > 0.1) {
              console.warn(`[Analytics] CLS detected: ${layoutShift.value}`);
            }
          }
        }
      });

      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.trackPerformance(PerformanceEvent.SLOW_QUERY, {
            duration: entry.duration,
            type: 'long-task',
          });
        }
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch {
      // Performance observer setup failed - non-critical
    }
  }

  // =========================================================================
  // Send to External Services
  // =========================================================================

  /**
   * Send events to analytics backend
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    if (this.config.debug) {
      console.log('[Analytics] Sending events:', events);
    }

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('[Analytics] Failed to send events to backend:', error);
      throw error;
    }
  }

  /**
   * Send events to Firebase Analytics
   */
  private sendToFirebase(events: AnalyticsEvent[]): void {
    // In production, integrate with Firebase
    // Example:
    // if (typeof firebase !== 'undefined') {
    //   events.forEach(event => {
    //     firebase.analytics().logEvent(event.name, event.properties);
    //   });
    // }
  }

  /**
   * Send events to Sentry for error tracking
   */
  private sendToSentry(events: AnalyticsEvent[]): void {
    // In production, integrate with Sentry
    // Example:
    // import * as Sentry from '@sentry/react';
    // events.filter(e => e.category === EventCategory.ERROR).forEach(event => {
    //   Sentry.captureMessage(event.name, {
    //     extra: event.properties,
    //   });
    // });
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    if (typeof sessionStorage === 'undefined') {
      return `session-${Date.now()}`;
    }

    let sessionId = sessionStorage.getItem('nilin_analytics_session');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('nilin_analytics_session', sessionId);
    }
    return sessionId;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get app version
   */
  private getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '1.0.0';
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Cleanup and stop all timers
   */
  public destroy(): void {
    // Flush remaining events
    this.flushQueue();

    // Stop timers
    this.stopFlushTimer();

    // Disconnect performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // Clear metrics
    this.apiLatencyMetrics.clear();

    this.initialized = false;
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const analyticsService = AnalyticsService.getInstance();

// =============================================================================
// Export Class for Testing
// =============================================================================

export { AnalyticsService };
export default analyticsService;
