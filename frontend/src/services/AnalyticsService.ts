import { Capacitor } from '@capacitor/core';

export type EventName =
  | 'app_opened'
  | 'screen_viewed'
  | 'user_registered'
  | 'user_logged_in'
  | 'service_searched'
  | 'service_viewed'
  | 'booking_started'
  | 'booking_completed'
  | 'payment_completed'
  | 'review_submitted'
  | 'provider_contacted';

export interface AnalyticsEvent {
  name: EventName;
  properties?: Record<string, string | number | boolean>;
}

class AnalyticsService {
  private initialized = false;
  private eventQueue: AnalyticsEvent[] = [];

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[Analytics] Not running on native platform');
      return;
    }

    this.initialized = true;
    console.log('[Analytics] Initialized');

    // Flush any queued events
    this.flushQueue();
  }

  track(event: AnalyticsEvent): void {
    const enrichedEvent = {
      ...event,
      properties: {
        ...event.properties,
        platform: Capacitor.getPlatform(),
        timestamp: new Date().toISOString(),
      },
    };

    if (!this.initialized) {
      // Queue event for later
      this.eventQueue.push(enrichedEvent);
      return;
    }

    this.sendEvent(enrichedEvent);
  }

  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // In production, send to your analytics backend
      console.log('[Analytics] Event:', event.name, event.properties);

      // Example: Send to custom analytics endpoint
      // await fetch(`${API_URL}/analytics/track`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event),
      // });
    } catch (error) {
      console.error('[Analytics] Failed to send event:', error);
      // Re-queue failed events
      this.eventQueue.push(event);
    }
  }

  private async flushQueue(): Promise<void> {
    const queue = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of queue) {
      await this.sendEvent(event);
    }
  }

  // Convenience methods for common events
  trackScreen(name: string, params?: Record<string, string | number>): void {
    this.track({
      name: 'screen_viewed',
      properties: { screen_name: name, ...params },
    });
  }

  trackUserAction(action: string, details?: Record<string, string | number>): void {
    this.track({
      name: action as EventName,
      properties: details,
    });
  }
}

export const analyticsService = new AnalyticsService();

// React hook for tracking screens
export function useScreenTracking(screenName: string) {
  // Import useEffect dynamically to avoid circular dependencies
  import('react').then(({ useEffect }) => {
    useEffect(() => {
      analyticsService.trackScreen(screenName);
    }, [screenName]);
  });
}

export default analyticsService;
