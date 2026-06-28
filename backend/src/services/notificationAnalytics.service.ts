/**
 * Notification Analytics Service
 *
 * Tracks notification delivery rates, click-through rates, and engagement metrics.
 * Stores analytics data in Redis for fast access and MongoDB for persistence.
 */

import BookingNotification from '../models/bookingNotification.model';
import User from '../models/user.model';
import { cache } from '../config/redis';
import logger from '../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalClicked: number;
  totalViewed: number;
  clickThroughRate: number;
  viewRate: number;
  byChannel: {
    in_app: ChannelAnalytics;
    email: ChannelAnalytics;
    sms: ChannelAnalytics;
    push: ChannelAnalytics;
  };
  byType: Record<string, TypeAnalytics>;
}

export interface ChannelAnalytics {
  sent: number;
  delivered: number;
  clicked: number;
  viewed: number;
  rate: number;
}

export interface TypeAnalytics {
  count: number;
  clicked: number;
  rate: number;
}

export interface DeliveryEvent {
  notificationId: string;
  userId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  timestamp: Date;
  success: boolean;
}

export interface ClickEvent {
  notificationId: string;
  userId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ViewEvent {
  notificationId: string;
  userId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  timestamp: Date;
}

// =============================================================================
// Constants
// =============================================================================

const ANALYTICS_CACHE_KEY = 'notification:analytics:user:';
const ANALYTICS_TTL_SECONDS = 3600; // 1 hour
const EVENTS_REDIS_KEY = 'notification:events:';
const EVENTS_TTL_SECONDS = 86400 * 7; // 7 days

// =============================================================================
// Rate Limiting (In-Memory with LRU Eviction)
// =============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory rate limit cache with LRU eviction
const RATE_LIMIT_CACHE_MAX_SIZE = 1000;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete first to refresh position if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict oldest if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Rate limit cache - bounded to prevent memory leaks
const rateLimitCache = new LRUCache<string, RateLimitEntry>(RATE_LIMIT_CACHE_MAX_SIZE);

/**
 * Check rate limit for analytics endpoint
 * Returns true if allowed, false if rate limited
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `analytics:${userId}`;
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  // If no entry or window expired, start new window
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitCache.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  // Check if under limit
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetIn: Math.max(0, resetIn) };
  }

  // Increment count
  entry.count++;
  rateLimitCache.set(key, entry);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetIn: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart) };
}

// =============================================================================
// Notification Analytics Service Class
// =============================================================================

export class NotificationAnalyticsService {
  // ==========================================================================
  // Track Events
  // ==========================================================================

  /**
   * Track notification delivery
   */
  async trackDelivery(
    notificationId: string,
    userId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push',
    success: boolean = true
  ): Promise<void> {
    // Rate limiting check
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for analytics delivery', {
        context: 'NotificationAnalytics',
        action: 'RATE_LIMIT_EXCEEDED',
        userId,
        resetIn: rateLimit.resetIn,
      });
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`);
    }

    const event: DeliveryEvent = {
      notificationId,
      userId,
      channel,
      timestamp: new Date(),
      success,
    };

    // Store in Redis for fast access
    await this.storeEvent('delivery', event);

    // Update notification document
    try {
      const updateField = `channels.${channel}.sent`;
      const updateData: Record<string, unknown> = {
        [updateField]: true,
        [`channels.${channel}.sentAt`]: new Date(),
      };

      if (channel === 'sms' && success) {
        updateData[`channels.${channel}.deliveryStatus`] = 'delivered';
      }

      await BookingNotification.findByIdAndUpdate(notificationId, {
        $set: updateData,
        $addToSet: {
          interactions: {
            type: 'delivered',
            channel,
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification delivery', {
        context: 'NotificationAnalytics',
        action: 'TRACK_DELIVERY_UPDATE_FAILED',
        notificationId,
        error: (error as Error).message,
      });
    }

    // Update user analytics
    await this.updateUserAnalytics(userId, 'delivered', channel);

    logger.debug('Notification delivery tracked', {
      context: 'NotificationAnalytics',
      action: 'DELIVERY_TRACKED',
      notificationId,
      userId,
      channel,
      success,
    });
  }

  /**
   * Track notification click/open
   */
  async trackClick(
    notificationId: string,
    userId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Rate limiting check
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for analytics click', {
        context: 'NotificationAnalytics',
        action: 'RATE_LIMIT_EXCEEDED',
        userId,
        resetIn: rateLimit.resetIn,
      });
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`);
    }

    const event: ClickEvent = {
      notificationId,
      userId,
      channel,
      timestamp: new Date(),
      metadata,
    };

    // Store in Redis
    await this.storeEvent('click', event);

    // Update notification document
    try {
      await BookingNotification.findByIdAndUpdate(notificationId, {
        $inc: {
          [`channels.${channel}.clickCount`]: 1,
        },
        $addToSet: {
          interactions: {
            type: 'clicked',
            channel,
            timestamp: new Date(),
            metadata,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification click', {
        context: 'NotificationAnalytics',
        action: 'TRACK_CLICK_UPDATE_FAILED',
        notificationId,
        error: (error as Error).message,
      });
    }

    // Update user analytics
    await this.updateUserAnalytics(userId, 'clicked', channel);

    logger.debug('Notification click tracked', {
      context: 'NotificationAnalytics',
      action: 'CLICK_TRACKED',
      notificationId,
      userId,
      channel,
    });
  }

  /**
   * Track notification view
   */
  async trackView(
    notificationId: string,
    userId: string,
    channel: 'in_app' | 'email' | 'sms' | 'push'
  ): Promise<void> {
    // Rate limiting check
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for analytics view', {
        context: 'NotificationAnalytics',
        action: 'RATE_LIMIT_EXCEEDED',
        userId,
        resetIn: rateLimit.resetIn,
      });
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`);
    }

    const event: ViewEvent = {
      notificationId,
      userId,
      channel,
      timestamp: new Date(),
    };

    // Store in Redis
    await this.storeEvent('view', event);

    // Update notification document
    try {
      if (channel === 'email') {
        await BookingNotification.findByIdAndUpdate(notificationId, {
          $inc: {
            'channels.email.openCount': 1,
          },
          $addToSet: {
            interactions: {
              type: 'opened',
              channel,
              timestamp: new Date(),
            },
          },
        });
      }
    } catch (error) {
      logger.error('Failed to update notification view', {
        context: 'NotificationAnalytics',
        action: 'TRACK_VIEW_UPDATE_FAILED',
        notificationId,
        error: (error as Error).message,
      });
    }

    // Update user analytics
    await this.updateUserAnalytics(userId, 'viewed', channel);

    logger.debug('Notification view tracked', {
      context: 'NotificationAnalytics',
      action: 'VIEW_TRACKED',
      notificationId,
      userId,
      channel,
    });
  }

  // ==========================================================================
  // Get Analytics
  // ==========================================================================

  /**
   * Get analytics summary for a user
   */
  async getUserAnalytics(userId: string): Promise<NotificationAnalytics> {
    const cacheKey = `${ANALYTICS_CACHE_KEY}${userId}`;

    // Try cache first
    try {
      const redisClient = (cache as any).client;
      if (redisClient) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (error) {
      logger.warn('Failed to get analytics from cache', {
        context: 'NotificationAnalytics',
        error: (error as Error).message,
      });
    }

    // Calculate from MongoDB
    const analytics = await this.calculateAnalytics(userId);

    // Cache the result
    try {
      const redisClient = (cache as any).client;
      if (redisClient) {
        await redisClient.setex(cacheKey, ANALYTICS_TTL_SECONDS, JSON.stringify(analytics));
      }
    } catch (error) {
      logger.warn('Failed to cache analytics', {
        context: 'NotificationAnalytics',
        error: (error as Error).message,
      });
    }

    return analytics;
  }

  /**
   * Calculate analytics from MongoDB
   */
  private async calculateAnalytics(userId: string): Promise<NotificationAnalytics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all notifications for the user in the last 30 days
    const notifications = await BookingNotification.find({
      recipientId: userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Calculate totals
    let totalSent = 0;
    let totalDelivered = 0;
    let totalClicked = 0;
    let totalViewed = 0;

    const byChannel = {
      in_app: { sent: 0, delivered: 0, clicked: 0, viewed: 0, rate: 0 },
      email: { sent: 0, delivered: 0, clicked: 0, viewed: 0, rate: 0 },
      sms: { sent: 0, delivered: 0, clicked: 0, viewed: 0, rate: 0 },
      push: { sent: 0, delivered: 0, clicked: 0, viewed: 0, rate: 0 },
    };

    const byType: Record<string, TypeAnalytics> = {};

    for (const notification of notifications) {
      // Count interactions
      const interactionTypes = new Set(
        notification.interactions?.map(i => i.type) || []
      );

      // Update channel stats
      const channels = notification.channels;
      if (channels) {
        if (channels.inApp?.sent) {
          byChannel.in_app.sent++;
          totalSent++;
          if (channels.inApp?.read) {
            byChannel.in_app.viewed++;
            totalViewed++;
          }
        }

        if (channels.email?.sent) {
          byChannel.email.sent++;
          totalSent++;
          byChannel.email.viewed += channels.email.openCount || 0;
          totalViewed += channels.email.openCount || 0;
          byChannel.email.clicked += channels.email.clickCount || 0;
          totalClicked += channels.email.clickCount || 0;
        }

        if (channels.sms?.sent) {
          byChannel.sms.sent++;
          totalSent++;
          if (channels.sms.deliveryStatus === 'delivered') {
            byChannel.sms.delivered++;
            totalDelivered++;
          }
        }

        if (channels.push?.sent) {
          byChannel.push.sent++;
          totalSent++;
          byChannel.push.clicked += channels.push.clickCount || 0;
          totalClicked += channels.push.clickCount || 0;
        }
      }

      // Update type stats
      const type = notification.type;
      if (!byType[type]) {
        byType[type] = { count: 0, clicked: 0, rate: 0 };
      }
      byType[type].count++;
    }

    // Calculate rates
    for (const channel of Object.keys(byChannel) as Array<keyof typeof byChannel>) {
      const stats = byChannel[channel];
      stats.rate = stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0;
    }

    for (const type of Object.keys(byType)) {
      byType[type].rate = byType[type].count > 0
        ? (byType[type].clicked / byType[type].count) * 100
        : 0;
    }

    return {
      totalSent,
      totalDelivered,
      totalClicked,
      totalViewed,
      clickThroughRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      viewRate: totalSent > 0 ? (totalViewed / totalSent) * 100 : 0,
      byChannel: {
        in_app: byChannel.in_app,
        email: byChannel.email,
        sms: byChannel.sms,
        push: byChannel.push,
      },
      byType,
    };
  }

  /**
   * Get global analytics (admin)
   */
  async getGlobalAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalNotifications: number;
    totalUsers: number;
    averageDeliveryRate: number;
    averageClickRate: number;
    topNotificationTypes: Array<{ type: string; count: number }>;
    channelBreakdown: Record<string, number>;
  }> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Aggregate from MongoDB
    const aggregation = await BookingNotification.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          totalSent: {
            $sum: {
              $add: [
                { $cond: ['$channels.inApp.sent', 1, 0] },
                { $cond: ['$channels.email.sent', 1, 0] },
                { $cond: ['$channels.sms.sent', 1, 0] },
                { $cond: ['$channels.push.sent', 1, 0] },
              ],
            },
          },
          totalClicked: {
            $sum: {
              $add: [
                { $ifNull: ['$channels.in_app.clickCount', 0] },
                { $ifNull: ['$channels.email.clickCount', 0] },
                { $ifNull: ['$channels.push.clickCount', 0] },
              ],
            },
          },
          byType: { $push: '$type' },
        },
      },
      {
        $project: {
          totalNotifications: 1,
          totalSent: 1,
          totalClicked: 1,
          clickRate: {
            $cond: [
              { $gt: ['$totalSent', 0] },
              { $multiply: [{ $divide: ['$totalClicked', '$totalSent'] }, 100] },
              0,
            ],
          },
        },
      },
    ]);

    // Get unique users count
    const uniqueUsers = await BookingNotification.distinct('recipientId', {
      createdAt: { $gte: start, $lte: end },
    });

    // Get type breakdown
    const typeBreakdown = await BookingNotification.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const result = aggregation[0] || {
      totalNotifications: 0,
      totalSent: 0,
      totalClicked: 0,
      clickRate: 0,
    };

    return {
      totalNotifications: result.totalNotifications || 0,
      totalUsers: uniqueUsers.length,
      averageDeliveryRate: 0, // Would need more complex query
      averageClickRate: result.clickRate || 0,
      topNotificationTypes: typeBreakdown.map(t => ({ type: t._id, count: t.count })),
      channelBreakdown: {}, // Would need more complex query
    };
  }

  // ==========================================================================
  // Event Storage (Redis)
  // ==========================================================================

  /**
   * Store event in Redis
   */
  private async storeEvent(
    type: 'delivery' | 'click' | 'view',
    event: DeliveryEvent | ClickEvent | ViewEvent
  ): Promise<void> {
    try {
      const redisClient = (cache as any).client;
      if (!redisClient) return;

      const key = `${EVENTS_REDIS_KEY}${type}:${event.userId}`;
      const eventData = JSON.stringify({
        type,
        ...event,
        timestamp: event.timestamp.toISOString(),
      });

      // Add to sorted set with timestamp as score for time-based queries
      await redisClient.zadd(key, Date.now(), eventData);

      // Set expiration
      await redisClient.expire(key, EVENTS_TTL_SECONDS);

      // Prune old events (keep only last 1000)
      const count = await redisClient.zcard(key);
      if (count > 1000) {
        await redisClient.zremrangebyrank(key, 0, count - 1001);
      }
    } catch (error) {
      logger.error('Failed to store event in Redis', {
        context: 'NotificationAnalytics',
        action: 'STORE_EVENT_FAILED',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user analytics counters
   */
  private async updateUserAnalytics(
    userId: string,
    action: 'delivered' | 'clicked' | 'viewed',
    channel: 'in_app' | 'email' | 'sms' | 'push'
  ): Promise<void> {
    try {
      const redisClient = (cache as any).client;
      if (!redisClient) return;

      const key = `notification:user:${userId}:counters`;

      // Increment counters
      await redisClient.hincrby(key, `total_${action}`, 1);
      await redisClient.hincrby(key, `${channel}_${action}`, 1);

      // Set expiration
      await redisClient.expire(key, ANALYTICS_TTL_SECONDS);

      // Invalidate analytics cache
      await redisClient.del(`${ANALYTICS_CACHE_KEY}${userId}`);
    } catch (error) {
      logger.error('Failed to update user analytics', {
        context: 'NotificationAnalytics',
        action: 'UPDATE_USER_ANALYTICS_FAILED',
        error: (error as Error).message,
      });
    }
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Invalidate user's analytics cache
   */
  async invalidateCache(userId: string): Promise<void> {
    try {
      const redisClient = (cache as any).client;
      if (redisClient) {
        await redisClient.del(`${ANALYTICS_CACHE_KEY}${userId}`);
      }
    } catch (error) {
      logger.error('Failed to invalidate analytics cache', {
        context: 'NotificationAnalytics',
        action: 'INVALIDATE_CACHE_FAILED',
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Clear all analytics caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      const redisClient = (cache as any).client;
      if (redisClient) {
        const stream = redisClient.scanStream({ match: `${ANALYTICS_CACHE_KEY}*`, count: 100 });
        const keys: string[] = [];
        for await (const result of stream) {
          keys.push(...result);
        }
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }
    } catch (error) {
      logger.error('Failed to clear analytics caches', {
        context: 'NotificationAnalytics',
        action: 'CLEAR_CACHES_FAILED',
        error: (error as Error).message,
      });
    }
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const notificationAnalyticsService = new NotificationAnalyticsService();
export default notificationAnalyticsService;
