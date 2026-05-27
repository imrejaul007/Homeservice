/**
 * Notification Analytics Service
 *
 * Handles notification delivery tracking, click/open analytics,
 * and sends data to the analytics backend. Includes local caching
 * for offline scenarios with automatic sync when back online.
 */

import { notificationApi } from './notificationApi';

// =============================================================================
// Types
// =============================================================================

export interface NotificationAnalyticsData {
  channels: {
    in_app: ChannelStats;
    email: ChannelStats;
    sms: ChannelStats;
    push: ChannelStats;
  };
  recentActivity: {
    last7Days: number;
    last30Days: number;
  };
}

export interface ChannelStats {
  sent: number;
  delivered: number;
  clicked: number;
  rate: number;
}

export interface AnalyticsEvent {
  id: string;
  type: 'delivery' | 'click' | 'view' | 'dismiss';
  notificationId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  timestamp: string;
  metadata?: Record<string, unknown>;
  synced: boolean;
}

export interface NotificationEngagement {
  notificationId: string;
  deliveredAt?: string;
  viewedAt?: string;
  clickedAt?: string;
  dismissedAt?: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  engagementDuration?: number; // milliseconds from delivery to click
}

// =============================================================================
// Constants
// =============================================================================

const ANALYTICS_STORAGE_KEY = 'nilin_notification_analytics';
const ENGAGEMENT_STORAGE_KEY = 'nilin_notification_engagement';
const PENDING_EVENTS_KEY = 'nilin_notification_pending_events';
const SYNC_INTERVAL_MS = 30000; // 30 seconds
const BATCH_SIZE = 20; // Max events per batch sync
const MAX_STORAGE_EVENTS = 500; // Max events to keep in storage

// =============================================================================
// Utility Functions
// =============================================================================

const generateEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const getAuthTokens = (): { accessToken: string; refreshToken: string } | null => {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const tokens = parsed?.state?.tokens;

    if (tokens?.accessToken && tokens?.refreshToken) {
      return tokens;
    }
    return null;
  } catch {
    return null;
  }
};

// =============================================================================
// Analytics Service Class
// =============================================================================

class NotificationAnalyticsService {
  private analytics: NotificationAnalyticsData = {
    channels: {
      in_app: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
      email: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
      sms: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
      push: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
    },
    recentActivity: { last7Days: 0, last30Days: 0 },
  };

  private engagementMap: Map<string, NotificationEngagement> = new Map();
  private pendingEvents: AnalyticsEvent[] = [];
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(analytics: NotificationAnalyticsData) => void> = new Set();

  constructor() {
    this.loadAnalytics();
    this.loadEngagement();
    this.loadPendingEvents();
    this.startSyncInterval();
    this.setupNetworkListeners();
  }

  // ==========================================================================
  // Initialization & Storage
  // ==========================================================================

  /**
   * Load analytics from storage
   */
  private loadAnalytics(): void {
    try {
      const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.analytics = {
          channels: {
            in_app: { ...this.analytics.channels.in_app, ...parsed.channels?.in_app },
            email: { ...this.analytics.channels.email, ...parsed.channels?.email },
            sms: { ...this.analytics.channels.sms, ...parsed.channels?.sms },
            push: { ...this.analytics.channels.push, ...parsed.channels?.push },
          },
          recentActivity: parsed.recentActivity || { last7Days: 0, last30Days: 0 },
        };
      }
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to load analytics:', error);
    }
  }

  /**
   * Save analytics to storage
   */
  private saveAnalytics(): void {
    try {
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(this.analytics));

      // Prune old events if needed
      if (this.pendingEvents.length > MAX_STORAGE_EVENTS) {
        this.pendingEvents = this.pendingEvents.slice(-MAX_STORAGE_EVENTS);
        localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(this.pendingEvents));
      }
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to save analytics:', error);
    }
  }

  /**
   * Load engagement data from storage
   */
  private loadEngagement(): void {
    try {
      const stored = localStorage.getItem(ENGAGEMENT_STORAGE_KEY);
      if (stored) {
        const parsed: [string, NotificationEngagement][] = JSON.parse(stored);
        this.engagementMap = new Map(parsed);
      }
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to load engagement:', error);
    }
  }

  /**
   * Save engagement data to storage
   */
  private saveEngagement(): void {
    try {
      const entries = Array.from(this.engagementMap.entries());
      localStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to save engagement:', error);
    }
  }

  /**
   * Load pending events from storage
   */
  private loadPendingEvents(): void {
    try {
      const stored = localStorage.getItem(PENDING_EVENTS_KEY);
      if (stored) {
        this.pendingEvents = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to load pending events:', error);
      this.pendingEvents = [];
    }
  }

  /**
   * Save pending events to storage
   */
  private savePendingEvents(): void {
    try {
      localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(this.pendingEvents));
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to save pending events:', error);
    }
  }

  // ==========================================================================
  // Event Tracking
  // ==========================================================================

  /**
   * Track notification delivery
   */
  trackDelivery(notificationId: string, channel: 'in_app' | 'email' | 'sms' | 'push' = 'in_app'): void {
    const event: AnalyticsEvent = {
      id: generateEventId(),
      type: 'delivery',
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    this.addEvent(event);

    // Update engagement tracking
    this.updateEngagement(notificationId, channel, { deliveredAt: event.timestamp });

    // Update local analytics
    this.analytics.channels[channel].delivered++;
    this.updateChannelRate(channel);
    this.saveAnalytics();
    this.notifyListeners();
  }

  /**
   * Track notification click/action
   */
  trackClick(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push' = 'in_app',
    metadata?: Record<string, unknown>
  ): void {
    const event: AnalyticsEvent = {
      id: generateEventId(),
      type: 'click',
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
      metadata,
      synced: false,
    };

    this.addEvent(event);

    // Update engagement tracking
    this.updateEngagement(notificationId, channel, { clickedAt: event.timestamp });

    // Update local analytics
    this.analytics.channels[channel].clicked++;
    this.updateChannelRate(channel);
    this.saveAnalytics();
    this.notifyListeners();
  }

  /**
   * Track notification view (opened)
   */
  trackView(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push' = 'in_app'
  ): void {
    const event: AnalyticsEvent = {
      id: generateEventId(),
      type: 'view',
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    this.addEvent(event);

    // Update engagement tracking
    this.updateEngagement(notificationId, channel, { viewedAt: event.timestamp });
  }

  /**
   * Track notification dismiss
   */
  trackDismiss(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push' = 'in_app'
  ): void {
    const event: AnalyticsEvent = {
      id: generateEventId(),
      type: 'dismiss',
      notificationId,
      channel,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    this.addEvent(event);

    // Update engagement tracking
    this.updateEngagement(notificationId, channel, { dismissedAt: event.timestamp });
  }

  /**
   * Track bulk action (mark all read, etc.)
   */
  trackBulkAction(action: string): void {
    console.log('[NotificationAnalytics] Bulk action tracked:', action);
    // This is logged for debugging purposes
    // Could be extended to track in analytics backend
  }

  /**
   * Track notification delete
   */
  trackDelete(notificationId: string): void {
    // Remove from engagement tracking
    this.engagementMap.delete(notificationId);
    this.saveEngagement();
  }

  /**
   * Add event to pending queue
   */
  private addEvent(event: AnalyticsEvent): void {
    this.pendingEvents.push(event);

    // Keep only recent events in memory
    if (this.pendingEvents.length > MAX_STORAGE_EVENTS) {
      this.pendingEvents = this.pendingEvents.slice(-MAX_STORAGE_EVENTS);
    }

    this.savePendingEvents();
  }

  /**
   * Update engagement record for a notification
   */
  private updateEngagement(
    notificationId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push',
    update: Partial<NotificationEngagement>
  ): void {
    const existing = this.engagementMap.get(notificationId);

    if (existing) {
      // Update existing engagement
      Object.assign(existing, update);

      // Calculate engagement duration if both delivered and clicked
      if (existing.deliveredAt && existing.clickedAt) {
        const deliveredTime = new Date(existing.deliveredAt).getTime();
        const clickedTime = new Date(existing.clickedAt).getTime();
        existing.engagementDuration = clickedTime - deliveredTime;
      }
    } else {
      // Create new engagement record
      this.engagementMap.set(notificationId, {
        notificationId,
        channel,
        ...update,
      });
    }

    this.saveEngagement();
  }

  /**
   * Update click-through rate for a channel
   */
  private updateChannelRate(channel: keyof NotificationAnalyticsData['channels']): void {
    const stats = this.analytics.channels[channel];
    stats.rate = stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0;
  }

  // ==========================================================================
  // Analytics Retrieval
  // ==========================================================================

  /**
   * Get current analytics data
   */
  getAnalytics(): NotificationAnalyticsData {
    return { ...this.analytics };
  }

  /**
   * Get analytics for a specific channel
   */
  getChannelAnalytics(channel: keyof NotificationAnalyticsData['channels']): ChannelStats {
    return { ...this.analytics.channels[channel] };
  }

  /**
   * Get engagement data for a notification
   */
  getEngagement(notificationId: string): NotificationEngagement | undefined {
    return this.engagementMap.get(notificationId);
  }

  /**
   * Get all engagement data
   */
  getAllEngagement(): NotificationEngagement[] {
    return Array.from(this.engagementMap.values());
  }

  /**
   * Get analytics summary
   */
  getSummary(): {
    totalDelivered: number;
    totalClicked: number;
    overallRate: number;
    topChannel: string;
    averageEngagementTime: number;
  } {
    let totalDelivered = 0;
    let totalClicked = 0;
    let topChannel = 'in_app';
    let maxDelivered = 0;

    Object.entries(this.analytics.channels).forEach(([channel, stats]) => {
      totalDelivered += stats.delivered;
      totalClicked += stats.clicked;
      if (stats.delivered > maxDelivered) {
        maxDelivered = stats.delivered;
        topChannel = channel;
      }
    });

    // Calculate average engagement time
    const engagementTimes = Array.from(this.engagementMap.values())
      .filter(e => e.engagementDuration !== undefined)
      .map(e => e.engagementDuration!);

    const averageEngagementTime = engagementTimes.length > 0
      ? engagementTimes.reduce((a, b) => a + b, 0) / engagementTimes.length
      : 0;

    return {
      totalDelivered,
      totalClicked,
      overallRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
      topChannel,
      averageEngagementTime,
    };
  }

  // ==========================================================================
  // Backend Sync
  // ==========================================================================

  /**
   * Sync pending events to backend
   */
  async syncToBackend(): Promise<void> {
    const tokens = getAuthTokens();
    if (!tokens?.accessToken) {
      console.log('[NotificationAnalytics] Not authenticated, skipping sync');
      return;
    }

    // Get unsynced events
    const unsyncedEvents = this.pendingEvents.filter(e => !e.synced);
    if (unsyncedEvents.length === 0) {
      return;
    }

    // Batch sync
    const batches: AnalyticsEvent[][] = [];
    for (let i = 0; i < unsyncedEvents.length; i += BATCH_SIZE) {
      batches.push(unsyncedEvents.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      try {
        // Group events by type for efficient processing
        const eventsByType: Record<string, AnalyticsEvent[]> = {};
        batch.forEach(event => {
          if (!eventsByType[event.type]) {
            eventsByType[event.type] = [];
          }
          eventsByType[event.type].push(event);
        });

        // Sync each type
        await Promise.allSettled(
          Object.entries(eventsByType).map(([type, events]) =>
            this.syncEventBatch(type, events)
          )
        );

        // Mark events as synced
        const syncedIds = new Set(batch.map(e => e.id));
        this.pendingEvents.forEach(event => {
          if (syncedIds.has(event.id)) {
            event.synced = true;
          }
        });

        this.savePendingEvents();
      } catch (error) {
        console.error('[NotificationAnalytics] Failed to sync batch:', error);
      }
    }
  }

  /**
   * Sync a batch of events of the same type
   */
  private async syncEventBatch(
    type: string,
    events: AnalyticsEvent[]
  ): Promise<void> {
    switch (type) {
      case 'delivery':
        await notificationApi.trackDelivery(
          events[0].notificationId,
          events[0].channel
        );
        break;
      case 'click':
        await notificationApi.trackClick(
          events[0].notificationId,
          events[0].channel
        );
        break;
      case 'view':
        await notificationApi.trackView(
          events[0].notificationId,
          events[0].channel
        );
        break;
      // dismiss events can be synced similarly if needed
    }
  }

  /**
   * Fetch analytics from backend
   */
  async getAnalyticsFromBackend(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<NotificationAnalyticsData | null> {
    try {
      const response = await notificationApi.getAnalytics(params);
      if (response.success && response.data) {
        // Merge with local analytics
        this.mergeAnalytics(response.data);
        return this.analytics;
      }
      return null;
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to fetch from backend:', error);
      return null;
    }
  }

  /**
   * Merge backend analytics with local
   */
  private mergeAnalytics(backendData: NotificationAnalyticsData): void {
    // Backend data takes precedence for historical data
    // Local data is kept for current session
    Object.keys(this.analytics.channels).forEach(channel => {
      const local = this.analytics.channels[channel as keyof typeof this.analytics.channels];
      const backend = backendData.channels[channel as keyof typeof backendData.channels];

      if (backend) {
        // Keep max values from either source
        local.sent = Math.max(local.sent, backend.sent);
        local.delivered = Math.max(local.delivered, backend.delivered);
        local.clicked = Math.max(local.clicked, backend.clicked);
        this.updateChannelRate(channel as keyof NotificationAnalyticsData['channels']);
      }
    });

    this.saveAnalytics();
    this.notifyListeners();
  }

  // ==========================================================================
  // Sync Management
  // ==========================================================================

  /**
   * Start periodic sync interval
   */
  private startSyncInterval(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = setInterval(() => {
      this.syncToBackend();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stop sync interval
   */
  stopSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Setup network listeners for online/offline handling
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[NotificationAnalytics] Back online, syncing...');
      this.syncToBackend();
    });

    window.addEventListener('offline', () => {
      console.log('[NotificationAnalytics] Gone offline, events will be queued');
    });
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  /**
   * Subscribe to analytics changes
   */
  subscribe(callback: (analytics: NotificationAnalyticsData) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.analytics);
      } catch (error) {
        console.error('[NotificationAnalytics] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Reset & Cleanup
  // ==========================================================================

  /**
   * Reset all analytics data
   */
  reset(): void {
    this.analytics = {
      channels: {
        in_app: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
        email: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
        sms: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
        push: { sent: 0, delivered: 0, clicked: 0, rate: 0 },
      },
      recentActivity: { last7Days: 0, last30Days: 0 },
    };
    this.engagementMap.clear();
    this.pendingEvents = [];
    this.saveAnalytics();
    this.saveEngagement();
    this.savePendingEvents();
    this.notifyListeners();
  }

  /**
   * Clear data on logout
   */
  clearOnLogout(): void {
    this.reset();
    this.stopSync();
    console.log('[NotificationAnalytics] Cleared on logout');
  }

  /**
   * Get pending event count
   */
  getPendingEventCount(): number {
    return this.pendingEvents.filter(e => !e.synced).length;
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const notificationAnalyticsService = new NotificationAnalyticsService();
export default notificationAnalyticsService;
