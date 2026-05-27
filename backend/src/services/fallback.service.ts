/**
 * Fallback Service for NILIN Platform
 *
 * Provides graceful degradation strategies when external services fail.
 * Implements fallback mechanisms for:
 * - AI recommendations → Return popular services
 * - Analytics → Queue locally
 * - Notifications → Queue locally
 * - Image upload → Use placeholder
 * - Cache failures → Fall back to in-memory cache
 */

import logger from '../utils/logger';
import { getDeadLetterQueue, addToDeadLetterQueue, DeadLetterEntry } from '../utils/retry.util';

// Placeholder image URLs
const PLACEHOLDER_IMAGES = {
  avatar: 'https://api.dicebear.com/7.x/initials/svg?backgroundColor=E11D48&textColor=ffffff',
  service: 'https://via.placeholder.com/400x300/E11D48/ffffff?text=Service',
  provider: 'https://via.placeholder.com/400x400/E11D48/ffffff?text=Provider',
  general: 'https://via.placeholder.com/400x400/E11D48/ffffff?text=NILIN',
};

// In-memory cache for fallback data
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class InMemoryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly defaultTTL: number;
  public readonly name?: string;

  constructor(defaultTTLOrName: number | string = 300000) { // 5 minutes default
    if (typeof defaultTTLOrName === 'string') {
      this.defaultTTL = 300000;
      this.name = defaultTTLOrName;
    } else {
      this.defaultTTL = defaultTTLOrName;
    }
  }

  set(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    });

    return removed;
  }
}

// Global fallback caches
const popularServicesCache = new InMemoryCache<any[]>(300000);
const analyticsQueue = new InMemoryCache<any[]>(300000);
const notificationQueue = new InMemoryCache<any[]>(300000);

// Interface for fallback options
export interface FallbackOptions<T> {
  cacheKey?: string;
  ttl?: number;
  useLocalCache?: boolean;
}

// ============================================
// AI/Fraud Detection Fallbacks
// ============================================

/**
 * Fallback for AI/fraud detection service
 * Returns a low-risk prediction when AI is unavailable
 */
export function getAIFallbackPrediction(): {
  riskScore: number;
  recommendation: 'allow' | 'review' | 'block';
  signals: Array<{ type: string; message: string }>;
  isFallback: boolean;
} {
  logger.warn('AI service unavailable, using fallback prediction', {
    action: 'AI_FALLBACK_ACTIVATED',
  });

  return {
    riskScore: 0.1, // Low risk by default
    recommendation: 'allow',
    signals: [{
      type: 'service_unavailable',
      message: 'AI service temporarily unavailable, approved by default',
    }],
    isFallback: true,
  };
}

/**
 * Fallback for recommendation engine
 * Returns popular services when AI recommendations fail
 */
export async function getPopularServicesFallback(): Promise<any[]> {
  // Check cache first
  const cached = popularServicesCache.get('default');
  if (cached) {
    return cached;
  }

  logger.warn('Using cached popular services as fallback', {
    action: 'POPULAR_SERVICES_FALLBACK',
  });

  // Return default popular services
  const defaultPopularServices = [
    {
      _id: 'fallback_popular_1',
      name: 'Professional Cleaning',
      category: 'cleaning',
      rating: 4.8,
      reviewCount: 1250,
      isPopular: true,
      fallback: true,
    },
    {
      _id: 'fallback_popular_2',
      name: 'Electrical Repair',
      category: 'electrical',
      rating: 4.7,
      reviewCount: 890,
      isPopular: true,
      fallback: true,
    },
    {
      _id: 'fallback_popular_3',
      name: 'Plumbing Services',
      category: 'plumbing',
      rating: 4.6,
      reviewCount: 720,
      isPopular: true,
      fallback: true,
    },
    {
      _id: 'fallback_popular_4',
      name: 'AC Maintenance',
      category: 'ac_services',
      rating: 4.9,
      reviewCount: 1100,
      isPopular: true,
      fallback: true,
    },
    {
      _id: 'fallback_popular_5',
      name: 'Painting Services',
      category: 'painting',
      rating: 4.5,
      reviewCount: 450,
      isPopular: true,
      fallback: true,
    },
  ];

  // Cache for future use
  popularServicesCache.set('default', defaultPopularServices, 600000); // 10 minutes

  return defaultPopularServices;
}

// ============================================
// Analytics Fallbacks
// ============================================

/**
 * Queue analytics events locally when analytics service fails
 */
export async function queueAnalyticsLocally(
  event: string,
  data: Record<string, unknown>,
  options: FallbackOptions<any> = {}
): Promise<void> {
  const queueKey = options.cacheKey || 'analytics_queue';

  const queued = analyticsQueue.get(queueKey) || [];
  queued.push({
    event,
    data,
    timestamp: Date.now(),
    queuedAt: new Date().toISOString(),
  });

  // Limit queue size
  if (queued.length > 1000) {
    queued.shift();
  }

  analyticsQueue.set(queueKey, queued, 3600000); // 1 hour TTL

  logger.debug('Analytics event queued locally', {
    event,
    queueSize: queued.length,
    action: 'ANALYTICS_QUEUED_LOCALLY',
  });
}

/**
 * Flush queued analytics to a more permanent storage
 */
export async function flushAnalyticsQueue(): Promise<number> {
  const queue = analyticsQueue.get('analytics_queue') || [];

  let flushed = 0;

  for (const event of queue) {
    addToDeadLetterQueue(
      'analytics',
      new Error('Flushed from local queue'),
      0,
      { event }
    );
    flushed++;
  }

  // Clear the queue
  analyticsQueue.delete('analytics_queue');

  logger.info('Analytics queue flushed', {
    flushedCount: flushed,
    action: 'ANALYTICS_QUEUE_FLUSHED',
  });

  return flushed;
}

// ============================================
// Notification Fallbacks
// ============================================

/**
 * Queue notifications locally when notification service fails
 */
export async function queueNotificationLocally(
  notification: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  },
  options: FallbackOptions<any> = {}
): Promise<string> {
  const queueKey = `notification_queue_${notification.userId}`;
  // FIX: Use dedicated notificationQueue instead of analyticsQueue
  const queue = notificationQueue.get(queueKey) || [];

  const queuedNotification = {
    ...notification,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  queue.push(queuedNotification);
  notificationQueue.set(queueKey, queue, 86400000); // 24 hours TTL

  const queueId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.warn('Notification queued locally', {
    userId: notification.userId,
    type: notification.type,
    queueId,
    action: 'NOTIFICATION_QUEUED_LOCALLY',
  });

  return queueId;
}

/**
 * Get pending notifications for a user
 */
export function getPendingNotifications(userId: string): any[] {
  const queueKey = `notification_queue_${userId}`;
  return analyticsQueue.get(queueKey) || [];
}

/**
 * Mark notification as sent
 */
export function markNotificationSent(userId: string, notificationId: string): void {
  const queueKey = `notification_queue_${userId}`;
  const queue = analyticsQueue.get(queueKey) || [];

  const filtered = queue.filter((n: any) =>
    n.queuedAt !== notificationId
  );

  analyticsQueue.set(queueKey, filtered, 86400000);
}

// ============================================
// Image Upload Fallbacks
// ============================================

/**
 * Get a placeholder image URL
 */
export function getPlaceholderImage(
  type: keyof typeof PLACEHOLDER_IMAGES = 'general',
  customText?: string
): { url: string; publicId: string; isPlaceholder: boolean } {
  let url = PLACEHOLDER_IMAGES[type];

  if (customText) {
    url = `https://via.placeholder.com/400x400/E11D48/ffffff?text=${encodeURIComponent(customText)}`;
  }

  return {
    url,
    publicId: `fallback_${type}_${Date.now()}`,
    isPlaceholder: true,
  };
}

/**
 * Generate placeholder with initials for avatars
 */
export function getInitialsPlaceholder(
  name: string,
  backgroundColor: string = 'E11D48',
  textColor: string = 'ffffff'
): { url: string; publicId: string; isPlaceholder: boolean } {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const encoded = encodeURIComponent(initials);

  return {
    url: `https://api.dicebear.com/7.x/initials/svg?backgroundColor=${backgroundColor}&textColor=${textColor}&text=${encoded}`,
    publicId: `fallback_initials_${Date.now()}`,
    isPlaceholder: true,
  };
}

// ============================================
// Cache Fallbacks
// ============================================

/**
 * In-memory cache instance for when Redis is unavailable
 */
const memoryCache = new InMemoryCache<unknown>();

/**
 * Get from cache with fallback to memory
 */
export async function getWithFallback<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: FallbackOptions<T> & {
    redisCache?: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string, ttl?: number) => Promise<void>;
    };
  } = {}
): Promise<T> {
  // Try Redis first
  if (options.redisCache) {
    try {
      const cached = await options.redisCache.get(key);
      if (cached) {
        logger.debug('Cache hit (Redis)', { key, action: 'CACHE_HIT_REDIS' });
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      logger.warn('Redis cache read failed, falling back to memory', {
        key,
        error: (error as Error).message,
        action: 'CACHE_REDIS_FAILED',
      });
    }
  }

  // Try memory cache
  const memoryCached = memoryCache.get(key);
  if (memoryCached !== null) {
    logger.debug('Cache hit (memory)', { key, action: 'CACHE_HIT_MEMORY' });
    return memoryCached as T;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Store in both caches
  try {
    if (options.redisCache) {
      await options.redisCache.set(key, JSON.stringify(data), options.ttl);
    }
  } catch (error) {
    logger.warn('Redis cache write failed', {
      key,
      error: (error as Error).message,
      action: 'CACHE_WRITE_REDIS_FAILED',
    });
  }

  memoryCache.set(key, data, options.ttl);

  return data;
}

/**
 * Stale-while-revalidate pattern
 * Serves stale data immediately while refreshing in background
 */
export async function getWithStaleRefresh<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    staleTTL?: number;    // How long to serve stale data
    refreshTTL?: number;   // How often to refresh
    memoryCache?: InMemoryCache<T>;
  } = {}
): Promise<{ data: T; isStale: boolean; refreshedAt?: Date }> {
  const { staleTTL = 60000, refreshTTL = 300000 } = options;
  const cache = options.memoryCache || memoryCache as InMemoryCache<T>;

  const cached = cache.get(key);

  if (cached) {
    // Check if data is stale
    const entry = (cache as any).cache?.get(key);
    const age = entry ? Date.now() - entry.timestamp : Infinity;

    if (age < staleTTL) {
      // Data is fresh, return immediately
      return { data: cached, isStale: false };
    }

    // Data is stale but within refresh window, return stale and refresh in background
    if (age < refreshTTL) {
      // Refresh in background (don't await)
      fetchFn()
        .then(freshData => {
          cache.set(key, freshData, refreshTTL);
          logger.debug('Background refresh completed', { key, action: 'STALE_REFRESH_BACKGROUND' });
        })
        .catch(error => {
          logger.warn('Background refresh failed', {
            key,
            error: error.message,
            action: 'STALE_REFRESH_FAILED',
          });
        });

      return { data: cached, isStale: true };
    }

    // Data is too old, need fresh
    const data = await fetchFn();
    cache.set(key, data, refreshTTL);
    return { data, isStale: false };
  }

  // No cache, fetch fresh
  const data = await fetchFn();
  cache.set(key, data, refreshTTL);
  return { data, isStale: false };
}

// ============================================
// Payment Fallbacks
// ============================================

/**
 * Fallback payment state when Stripe is unavailable
 */
export function getPaymentFallbackState(): {
  status: 'pending' | 'processing' | 'failed';
  message: string;
  isFallback: boolean;
  retryAt?: Date;
} {
  return {
    status: 'pending',
    message: 'Payment processing is temporarily delayed. You will be notified when payment is confirmed.',
    isFallback: true,
    retryAt: new Date(Date.now() + 300000), // 5 minutes
  };
}

/**
 * Queue payment for retry
 */
export async function queuePaymentRetry(
  bookingId: string,
  paymentData: {
    amount: number;
    currency: string;
    customerId: string;
    providerId: string;
  }
): Promise<string> {
  const queueKey = 'payment_retry_queue';
  const queue = analyticsQueue.get(queueKey) || [];

  queue.push({
    bookingId,
    ...paymentData,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    nextRetry: new Date(Date.now() + 60000).toISOString(), // 1 minute
  });

  analyticsQueue.set(queueKey, queue, 3600000); // 1 hour TTL

  logger.warn('Payment queued for retry', {
    bookingId,
    action: 'PAYMENT_QUEUED_FOR_RETRY',
  });

  return bookingId;
}

// ============================================
// Email Fallbacks
// ============================================

/**
 * Queue email for retry when email service fails
 */
export async function queueEmailForRetry(
  email: {
    to: string;
    subject: string;
    html: string;
    type: string;
  },
  options: FallbackOptions<any> = {}
): Promise<string> {
  const queueKey = 'email_retry_queue';
  const queue = analyticsQueue.get(queueKey) || [];

  queue.push({
    ...email,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  });

  analyticsQueue.set(queueKey, queue, 86400000); // 24 hours TTL

  logger.warn('Email queued for retry', {
    to: email.to,
    type: email.type,
    action: 'EMAIL_QUEUED_FOR_RETRY',
  });

  return `email_${Date.now()}`;
}

/**
 * Get pending emails
 */
export function getPendingEmails(): any[] {
  return analyticsQueue.get('email_retry_queue') || [];
}

// ============================================
// Health & Status
// ============================================

/**
 * Get fallback service health status
 */
export function getFallbackHealthStatus(): {
  memoryCacheSize: number;
  analyticsQueueSize: number;
  notificationQueueCount: number;
  pendingPaymentsCount: number;
  pendingEmailsCount: number;
} {
  return {
    memoryCacheSize: memoryCache.size(),
    analyticsQueueSize: (analyticsQueue.get('analytics_queue') || []).length,
    // FIX: Read from correct notificationQueue instead of analyticsQueue
    notificationQueueCount: (notificationQueue.get('notification_queue_') || []).length,
    pendingPaymentsCount: (analyticsQueue.get('payment_retry_queue') || []).length,
    pendingEmailsCount: (analyticsQueue.get('email_retry_queue') || []).length,
  };
}

/**
 * Cleanup expired fallback data
 */
export function cleanupFallbackData(): {
  memoryCacheRemoved: number;
  analyticsQueueFlushed: number;
} {
  const memoryCacheRemoved = memoryCache.cleanup();

  logger.info('Fallback data cleaned up', {
    memoryCacheRemoved,
    action: 'FALLBACK_DATA_CLEANUP',
  });

  return {
    memoryCacheRemoved,
    analyticsQueueFlushed: 0,
  };
}

export default {
  // AI/Fraud
  getAIFallbackPrediction,
  getPopularServicesFallback,

  // Analytics
  queueAnalyticsLocally,
  flushAnalyticsQueue,

  // Notifications
  queueNotificationLocally,
  getPendingNotifications,
  markNotificationSent,

  // Images
  getPlaceholderImage,
  getInitialsPlaceholder,

  // Cache
  getWithFallback,
  getWithStaleRefresh,
  InMemoryCache,

  // Payments
  getPaymentFallbackState,
  queuePaymentRetry,

  // Email
  queueEmailForRetry,
  getPendingEmails,

  // Health
  getFallbackHealthStatus,
  cleanupFallbackData,

  // Exported constants
  PLACEHOLDER_IMAGES,
};
