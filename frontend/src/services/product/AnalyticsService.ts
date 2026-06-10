// Analytics Service - Startup-grade event tracking
// Can integrate with Firebase Analytics, Mixpanel, or custom backend

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

class AnalyticsService {
  private isEnabled: boolean;
  private eventQueue: AnalyticsEvent[] = [];
  private sessionStart: number = Date.now();

  constructor() {
    this.isEnabled = import.meta.env.PROD;
  }

  // Track screen views
  trackScreen(name: string, params?: Record<string, string | number>) {
    this.track('screen_view', {
      screen_name: name,
      ...params,
    });
  }

  // Track any event
  track(name: string, params?: Record<string, string | number | boolean>) {
    if (!this.isEnabled) {
      if (import.meta.env.DEV) {
        console.log(`[Analytics] ${name}`, params);
      }
      return;
    }

    const event: AnalyticsEvent = { name, params };
    this.eventQueue.push(event);

    // In production, send to analytics provider
    // Example: firebase.analytics().logEvent(name, params);

    // For now, queue events for batch sending
    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

  // Track user actions
  trackAction(action: string, details?: Record<string, string | number>) {
    this.track(`action_${action}`, details);
  }

  // Track booking funnel
  trackBookingFunnel(step: 'start' | 'select_service' | 'select_provider' | 'confirm' | 'complete', details?: Record<string, string | number>) {
    this.track(`booking_${step}`, details);
  }

  // Track search
  trackSearch(query: string, resultsCount: number) {
    this.track('search', {
      query,
      results_count: resultsCount,
    });
  }

  // Track engagement
  trackEngagement(type: 'book' | 'favorite' | 'share' | 'review', itemId: string) {
    this.track(`engagement_${type}`, {
      item_id: itemId,
    });
  }

  // Track retention
  trackRetention(day: number) {
    this.track('retention', {
      day,
      session_duration: Date.now() - this.sessionStart,
    });
  }

  // Track performance
  trackPerformance(metric: string, value: number) {
    this.track(`performance_${metric}`, {
      value,
    });
  }

  // Track errors
  trackError(error: string, context?: Record<string, string>) {
    this.track('error', {
      error,
      ...context,
    });
  }

  // Track referral events (share, click, signup, reward)
  trackReferralEvent(event: string, data?: Record<string, string | number | boolean>) {
    this.track(`referral_${event}`, {
      source: 'share',
      ...data,
    });
  }

  // Track viral coefficient events for growth funnel analysis
  trackViralEvent(event: 'invite_sent' | 'invite_opened' | 'signup' | 'booking', data?: Record<string, string | number | boolean>) {
    this.track(`viral_${event}`, {
      timestamp: Date.now(),
      ...data,
    });
  }

  // Track social sharing events
  trackShareEvent(platform: string, itemTitle: string) {
    this.track('share', {
      platform,
      item_title: itemTitle,
      timestamp: Date.now(),
    });
  }

  // Funnel tracking
  trackFunnelStep(step: 'search' | 'view_service' | 'select_time' | 'add_details' | 'payment' | 'confirmed') {
    this.track('funnel_step', {
      step,
      timestamp: Date.now(),
    });
  }

  trackFunnelDropOff(step: string, reason?: string) {
    this.track('funnel_dropoff', {
      step,
      reason: reason || 'unknown',
      timestamp: Date.now(),
    });
  }

  // Conversion tracking
  trackConversion(type: 'booking' | 'signup' | 'referral', value?: number) {
    this.track('conversion', {
      type,
      value: value || 1,
      timestamp: Date.now(),
    });
  }

  // Flush queued events
  flush() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Send to analytics provider
    // Example: fetch('/api/analytics', { method: 'POST', body: JSON.stringify(events) });
  }

  // Set user properties
  setUserProperty(key: string, value: string | number) {
    if (!this.isEnabled) return;
    // firebase.analytics().setUserProperties({ [key]: value });
  }

  // Identify user
  identify(userId: string, traits?: Record<string, string | number>) {
    this.setUserProperty('user_id', userId);
    if (traits) {
      Object.entries(traits).forEach(([key, value]) => {
        this.setUserProperty(key, value);
      });
    }
  }

  // Session duration
  getSessionDuration(): number {
    return Date.now() - this.sessionStart;
  }
}

export const analytics = new AnalyticsService();

// Hook for tracking
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useAnalytics() {
  const location = useLocation();

  // Track screen views on route change
  useEffect(() => {
    analytics.trackScreen(location.pathname);
  }, [location.pathname]);

  return analytics;
}

export default analytics;
