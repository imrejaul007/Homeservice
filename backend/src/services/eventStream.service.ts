import mongoose from 'mongoose';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES, PlatformEvent } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type StreamEventType =
  | 'booking'
  | 'payment'
  | 'user'
  | 'provider'
  | 'analytics'
  | 'system'
  | 'notification';

export type AggregationWindow = '1m' | '5m' | '15m' | '1h' | '1d';

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  eventName: string;
  data: Record<string, any>;
  metadata?: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    source?: string;
  };
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
}

export interface StreamAggregation {
  window: AggregationWindow;
  eventType: string;
  count: number;
  uniqueUsers: number;
  startTime: Date;
  endTime: Date;
  metrics: Record<string, any>;
}

export interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  eventCategory: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  revenue?: number;
  conversionValue?: number;
}

export interface FunnelStep {
  name: string;
  eventName: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface FunnelAnalysis {
  funnelName: string;
  startDate: Date;
  endDate: Date;
  totalUsers: number;
  completedSteps: number;
  overallConversionRate: number;
  steps: FunnelStep[];
}

export interface StreamMetrics {
  eventsPerMinute: number;
  eventsPerHour: number;
  totalEvents: number;
  uniqueUsers: number;
  errorRate: number;
  lastEventAt: Date;
  topEvents: Array<{ eventName: string; count: number }>;
}

export interface StreamFilters {
  type?: StreamEventType;
  eventName?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

// ============================================
// Analytics Event Model (MongoDB)
// ============================================

interface IAnalyticsEventDocument extends mongoose.Document {
  eventId: string;
  eventType: string;
  eventCategory: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  revenue?: number;
  conversionValue?: number;
  processed: boolean;
}

const AnalyticsEventSchema = new mongoose.Schema<IAnalyticsEventDocument>({
  eventId: { type: String, required: true, unique: true, index: true },
  eventType: { type: String, required: true, index: true },
  eventCategory: { type: String, index: true },
  timestamp: { type: Date, required: true, index: true },
  userId: { type: String, index: true },
  sessionId: { type: String, index: true },
  properties: { type: mongoose.Schema.Types.Mixed, default: {} },
  revenue: Number,
  conversionValue: Number,
  processed: { type: Boolean, default: false },
});

// TTL index: auto-delete events older than 90 days
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound indexes for common queries
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ sessionId: 1, timestamp: -1 });

export const AnalyticsEventModel: mongoose.Model<IAnalyticsEventDocument> =
  mongoose.models.AnalyticsEvent || mongoose.model<IAnalyticsEventDocument>('AnalyticsEvent', AnalyticsEventSchema);

// ============================================
// Stream Event Model (MongoDB)
// ============================================

interface IStreamEventDocument extends mongoose.Document {
  type: StreamEventType;
  eventName: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
}

const StreamEventSchema = new mongoose.Schema<IStreamEventDocument>({
  type: { type: String, required: true, index: true },
  eventName: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  processed: { type: Boolean, default: false, index: true },
  processedAt: Date,
});

// TTL index for stream events
StreamEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days

export const StreamEventModel: mongoose.Model<IStreamEventDocument> =
  mongoose.models.StreamEvent || mongoose.model<IStreamEventDocument>('StreamEvent', StreamEventSchema);

// ============================================
// Event Stream Service
// ============================================

export class EventStreamService {
  private eventSubscriptionIds: string[] = [];
  private processingQueue: AnalyticsEvent[] = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 100;
  private readonly PROCESS_INTERVAL_MS = 5000; // 5 seconds

  // Event type mappings
  private readonly eventTypeMapping: Record<string, StreamEventType> = {
    'booking.created': 'booking',
    'booking.confirmed': 'booking',
    'booking.completed': 'booking',
    'booking.cancelled': 'booking',
    'booking.accepted': 'booking',
    'booking.rejected': 'booking',
    'payment.completed': 'payment',
    'payment.failed': 'payment',
    'payment.refunded': 'payment',
    'user.registered': 'user',
    'user.logged_in': 'user',
    'user.verified': 'user',
    'notification.created': 'notification',
    'analytics.page_view': 'analytics',
    'analytics.search': 'analytics',
  };

  // Analytics event categories
  private readonly eventCategories: Record<string, string> = {
    'booking.created': 'conversion',
    'booking.completed': 'conversion',
    'booking.cancelled': 'engagement',
    'payment.completed': 'revenue',
    'page_view': 'engagement',
    'search': 'engagement',
    'user.registered': 'acquisition',
    'user.logged_in': 'engagement',
  };

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize event stream subscriptions
   */
  async initialize(): Promise<void> {
    logger.info('EventStream: Initializing event subscriptions');

    // Subscribe to all events from the event bus
    const subscriptionId = eventBus.subscribe('*', async (event: PlatformEvent) => {
      await this.handleEvent(event);
    }, 1); // Low priority

    this.eventSubscriptionIds.push(subscriptionId);

    // Start batch processing
    this.startBatchProcessing();

    logger.info('EventStream: Event subscriptions initialized', {
      subscriptionCount: this.eventSubscriptionIds.length,
    });
  }

  /**
   * Cleanup event subscriptions
   */
  cleanup(): void {
    for (const subId of this.eventSubscriptionIds) {
      eventBus.unsubscribe(subId);
    }
    this.eventSubscriptionIds = [];
    this.stopBatchProcessing();
    logger.info('EventStream: Cleanup completed');
  }

  // ========================================
  // Event Handling
  // ========================================

  /**
   * Handle incoming event from event bus
   */
  private async handleEvent(event: PlatformEvent): Promise<void> {
    try {
      const streamEventType = this.getStreamEventType(event.eventType);

      // Create stream event
      const streamEvent: StreamEvent = {
        id: event.eventId,
        type: streamEventType,
        eventName: event.eventType,
        data: event.data as Record<string, any>,
        metadata: event.metadata,
        timestamp: event.timestamp,
        processed: false,
      };

      // Store in database
      await this.storeStreamEvent(streamEvent);

      // Create analytics event
      const analyticsEvent = this.createAnalyticsEvent(streamEvent);

      // Add to processing queue
      this.addToQueue(analyticsEvent);

    } catch (error) {
      logger.error('EventStream: Failed to handle event', {
        eventId: event.eventId,
        eventType: event.eventType,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Map event type to stream event type
   */
  private getStreamEventType(eventType: string): StreamEventType {
    for (const [prefix, type] of Object.entries(this.eventTypeMapping)) {
      if (eventType.startsWith(prefix) || eventType === prefix) {
        return type;
      }
    }
    return 'system';
  }

  /**
   * Create analytics event from stream event
   */
  private createAnalyticsEvent(streamEvent: StreamEvent): AnalyticsEvent {
    return {
      eventId: streamEvent.id,
      eventType: streamEvent.eventName,
      eventCategory: this.eventCategories[streamEvent.eventName] || 'other',
      timestamp: streamEvent.timestamp,
      userId: streamEvent.metadata?.userId,
      sessionId: streamEvent.metadata?.sessionId,
      properties: streamEvent.data,
      revenue: this.extractRevenue(streamEvent.data),
      conversionValue: this.extractConversionValue(streamEvent.data),
    };
  }

  /**
   * Extract revenue from event data
   */
  private extractRevenue(data: Record<string, any>): number | undefined {
    return data.totalAmount || data.amount || data.revenue || data.total;
  }

  /**
   * Extract conversion value from event data
   */
  private extractConversionValue(data: Record<string, any>): number | undefined {
    return data.conversionValue || data.orderValue || data.bookingValue;
  }

  /**
   * Store stream event in database
   */
  private async storeStreamEvent(event: StreamEvent): Promise<void> {
    try {
      await StreamEventModel.create({
        type: event.type,
        eventName: event.eventName,
        data: event.data,
        metadata: event.metadata,
        timestamp: event.timestamp,
        processed: false,
      });
    } catch (error) {
      // Ignore duplicate key errors
      if ((error as any).code !== 11000) {
        throw error;
      }
    }
  }

  /**
   * Add event to processing queue
   */
  private addToQueue(event: AnalyticsEvent): void {
    this.processingQueue.push(event);

    // Trigger processing if queue is large enough
    if (this.processingQueue.length >= this.BATCH_SIZE) {
      this.processBatch();
    }
  }

  // ========================================
  // Batch Processing
  // ========================================

  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Start batch processing
   */
  private startBatchProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processBatch();
    }, this.PROCESS_INTERVAL_MS);
  }

  /**
   * Stop batch processing
   */
  private stopBatchProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process queued events in batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.processingQueue.splice(0, this.BATCH_SIZE);

      if (batch.length > 0) {
        // Bulk insert analytics events
        const eventsToInsert = batch.map(event => ({
          eventId: event.eventId,
          eventType: event.eventType,
          eventCategory: event.eventCategory,
          timestamp: event.timestamp,
          userId: event.userId,
          sessionId: event.sessionId,
          properties: event.properties,
          revenue: event.revenue,
          conversionValue: event.conversionValue,
          processed: true,
        }));

        await AnalyticsEventModel.insertMany(eventsToInsert, { ordered: false });

        logger.debug('EventStream: Batch processed', {
          count: batch.length,
        });
      }
    } catch (error) {
      logger.error('EventStream: Batch processing failed', {
        error: (error as Error).message,
        queueSize: this.processingQueue.length,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // ========================================
  // Analytics Methods
  // ========================================

  /**
   * Record a custom analytics event
   */
  async recordEvent(
    eventName: string,
    properties: Record<string, any>,
    metadata?: {
      userId?: string;
      sessionId?: string;
      revenue?: number;
      conversionValue?: number;
    }
  ): Promise<string> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const analyticsEvent: AnalyticsEvent = {
      eventId,
      eventType: eventName,
      eventCategory: this.eventCategories[eventName] || 'custom',
      timestamp: new Date(),
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      properties,
      revenue: metadata?.revenue,
      conversionValue: metadata?.conversionValue,
    };

    // Add to queue
    this.addToQueue(analyticsEvent);

    // Also publish to event bus
    await eventBus.publish(`analytics.${eventName}`, properties, {
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
    });

    return eventId;
  }

  /**
   * Get aggregated metrics
   */
  async getMetrics(window: AggregationWindow): Promise<StreamMetrics> {
    const now = new Date();
    let startTime: Date;

    switch (window) {
      case '1m':
        startTime = new Date(now.getTime() - 60 * 1000);
        break;
      case '5m':
        startTime = new Date(now.getTime() - 5 * 60 * 1000);
        break;
      case '15m':
        startTime = new Date(now.getTime() - 15 * 60 * 1000);
        break;
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '1d':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Get counts
    const [totalEvents, eventsInWindow, uniqueUsers] = await Promise.all([
      AnalyticsEventModel.countDocuments({}),
      AnalyticsEventModel.countDocuments({ timestamp: { $gte: startTime } }),
      AnalyticsEventModel.distinct('userId', { timestamp: { $gte: startTime }, userId: { $ne: null } }),
    ]);

    // Get top events
    const topEvents = await AnalyticsEventModel.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      eventsPerMinute: window === '1m' ? eventsInWindow : eventsInWindow / this.getWindowMinutes(window),
      eventsPerHour: eventsInWindow / Math.max(1, this.getWindowMinutes(window) / 60),
      totalEvents,
      uniqueUsers: uniqueUsers.length,
      errorRate: 0, // Would need error tracking
      lastEventAt: now,
      topEvents: topEvents.map(e => ({ eventName: e._id, count: e.count })),
    };
  }

  private getWindowMinutes(window: AggregationWindow): number {
    switch (window) {
      case '1m': return 1;
      case '5m': return 5;
      case '15m': return 15;
      case '1h': return 60;
      case '1d': return 1440;
    }
  }

  /**
   * Get aggregated events over time
   */
  async getEventAggregation(
    eventType: string,
    window: AggregationWindow,
    startDate: Date,
    endDate: Date
  ): Promise<StreamAggregation[]> {
    const bucketSize = this.getBucketSize(window);

    const results = await AnalyticsEventModel.aggregate([
      {
        $match: {
          eventType,
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $bucket: {
          groupBy: '$timestamp',
          boundaries: this.generateBucketBoundaries(startDate, endDate, bucketSize),
          default: 'other',
          output: {
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
            avgConversionValue: { $avg: '$conversionValue' },
          },
        },
      },
    ]);

    return results.map(r => ({
      window,
      eventType,
      count: r.count,
      uniqueUsers: r.uniqueUsers?.length || 0,
      startTime: r._id,
      endTime: new Date(r._id.getTime() + bucketSize * 60 * 1000),
      metrics: {
        totalRevenue: r.totalRevenue || 0,
        avgConversionValue: r.avgConversionValue || 0,
      },
    }));
  }

  private getBucketSize(window: AggregationWindow): number {
    switch (window) {
      case '1m': return 1;
      case '5m': return 5;
      case '15m': return 15;
      case '1h': return 60;
      case '1d': return 1440;
    }
  }

  private generateBucketBoundaries(startDate: Date, endDate: Date, bucketSizeMinutes: number): Date[] {
    const boundaries: Date[] = [];
    let current = new Date(startDate);
    const bucketMs = bucketSizeMinutes * 60 * 1000;

    while (current <= endDate) {
      boundaries.push(new Date(current));
      current = new Date(current.getTime() + bucketMs);
    }

    boundaries.push(new Date(endDate));
    return boundaries;
  }

  /**
   * Analyze conversion funnel
   */
  async analyzeFunnel(
    funnelName: string,
    steps: string[],
    startDate: Date,
    endDate: Date
  ): Promise<FunnelAnalysis> {
    const funnelSteps: FunnelStep[] = [];
    let totalUsers = 0;
    let completedSteps = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const previousStepUsers = i === 0 ? totalUsers : await this.getUniqueUsersForEvent(steps[i - 1], startDate, endDate);

      const stepUsers = await this.getUniqueUsersForEvent(step, startDate, endDate);

      if (i === 0) {
        totalUsers = stepUsers;
      }

      const conversionRate = i === 0 ? 100 : previousStepUsers > 0 ? (stepUsers / previousStepUsers) * 100 : 0;
      const dropoffRate = 100 - conversionRate;

      funnelSteps.push({
        name: step,
        eventName: step,
        count: stepUsers,
        conversionRate,
        dropoffRate,
      });

      if (stepUsers > 0) {
        completedSteps++;
      }
    }

    return {
      funnelName,
      startDate,
      endDate,
      totalUsers,
      completedSteps,
      overallConversionRate: totalUsers > 0 ? (funnelSteps[funnelSteps.length - 1]?.count || 0) / totalUsers * 100 : 0,
      steps: funnelSteps,
    };
  }

  private async getUniqueUsersForEvent(eventName: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await AnalyticsEventModel.aggregate([
      {
        $match: {
          eventType: eventName,
          timestamp: { $gte: startDate, $lte: endDate },
          userId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$userId',
        },
      },
      {
        $count: 'uniqueUsers',
      },
    ]);

    return result[0]?.uniqueUsers || 0;
  }

  /**
   * Get user journey (events for a specific user)
   */
  async getUserJourney(userId: string, limit: number = 50): Promise<AnalyticsEvent[]> {
    const events = await AnalyticsEventModel.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);

    return events.map(e => ({
      eventId: e.eventId,
      eventType: e.eventType,
      eventCategory: e.eventCategory,
      timestamp: e.timestamp,
      userId: e.userId,
      sessionId: e.sessionId,
      properties: e.properties,
      revenue: e.revenue,
      conversionValue: e.conversionValue,
    }));
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    revenueByDay: Array<{ date: string; revenue: number }>;
    revenueByCategory: Array<{ category: string; revenue: number }>;
    averageOrderValue: number;
    conversionRate: number;
  }> {
    const [revenueResults, categoryResults, totalOrders, totalSessions] = await Promise.all([
      AnalyticsEventModel.aggregate([
        {
          $match: {
            revenue: { $exists: true, $ne: null },
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            revenue: { $sum: '$revenue' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AnalyticsEventModel.aggregate([
        {
          $match: {
            revenue: { $exists: true, $ne: null },
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$eventCategory',
            revenue: { $sum: '$revenue' },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      AnalyticsEventModel.countDocuments({
        eventType: 'booking.completed',
        timestamp: { $gte: startDate, $lte: endDate },
      }),
      AnalyticsEventModel.countDocuments({
        eventType: 'booking.created',
        timestamp: { $gte: startDate, $lte: endDate },
      }),
    ]);

    const totalRevenue = revenueResults.reduce((sum, r) => sum + r.revenue, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = totalSessions > 0 ? (totalOrders / totalSessions) * 100 : 0;

    return {
      totalRevenue,
      revenueByDay: revenueResults.map(r => ({ date: r._id, revenue: r.revenue })),
      revenueByCategory: categoryResults.map(r => ({ category: r._id, revenue: r.revenue })),
      averageOrderValue,
      conversionRate,
    };
  }

  /**
   * Query stream events with filters
   */
  async queryEvents(filters: StreamFilters): Promise<{
    data: StreamEvent[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.type) query.type = filters.type;
    if (filters.eventName) query.eventName = filters.eventName;
    if (filters.userId) query['metadata.userId'] = filters.userId;

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    const [events, total] = await Promise.all([
      StreamEventModel.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      StreamEventModel.countDocuments(query),
    ]);

    return {
      data: events.map(e => ({
        id: e._id.toString(),
        type: e.type,
        eventName: e.eventName,
        data: e.data,
        metadata: e.metadata,
        timestamp: e.timestamp,
        processed: e.processed,
        processedAt: e.processedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get real-time event stream (WebSocket/SSE compatible)
   */
  getEventStream(callback: (event: StreamEvent) => void): () => void {
    const subscriptionId = eventBus.subscribe('*', async (event: PlatformEvent) => {
      const streamEvent: StreamEvent = {
        id: event.eventId,
        type: this.getStreamEventType(event.eventType),
        eventName: event.eventType,
        data: event.data as Record<string, any>,
        metadata: event.metadata,
        timestamp: event.timestamp,
        processed: true,
        processedAt: new Date(),
      };

      callback(streamEvent);
    }, 10); // High priority for real-time

    // Return cleanup function
    return () => {
      eventBus.unsubscribe(subscriptionId);
    };
  }
}

// ============================================
// Service Instance
// ============================================

export const eventStreamService = new EventStreamService();
export default eventStreamService;
