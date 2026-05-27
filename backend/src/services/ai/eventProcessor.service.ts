// AI Event Processor - ML-Ready Event Streaming and Feature Pipeline
import { Types } from 'mongoose';
import Booking from '../../models/booking.model';
import User from '../../models/user.model';
import Service from '../../models/service.model';
import ProviderProfile from '../../models/providerProfile.model';
import logger from '../../utils/logger';
import { circuitBreaker, CIRCUIT_NAMES } from '../../services/circuitBreaker.service';

// Types
export interface AIEvent {
  id: string;
  type: AIEventType;
  timestamp: Date;
  userId?: string;
  providerId?: string;
  serviceId?: string;
  bookingId?: string;
  properties: Record<string, any>;
  context: EventContext;
}

export type AIEventType =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.completed'
  | 'booking.cancelled'
  | 'booking.rated'
  | 'user.registered'
  | 'user.profile_updated'
  | 'user.login'
  | 'user.session_started'
  | 'user.session_ended'
  | 'service.viewed'
  | 'service.searched'
  | 'provider.viewed'
  | 'provider.booked'
  | 'wallet.debited'
  | 'wallet.refunded'
  | 'payment.failed'
  | 'notification.sent'
  | 'notification.opened'
  | 'notification.clicked'
  | 'search.query'
  | 'cart.added'
  | 'cart.removed'
  | 'favorite.added'
  | 'favorite.removed';

export interface EventContext {
  deviceType: string;
  platform: 'ios' | 'android' | 'web';
  sessionId: string;
  page?: string;
  referrer?: string;
  location?: { lat: number; lng: number };
  userAgent?: string;
}

export interface FeatureStoreUpdate {
  entityType: 'user' | 'service' | 'provider' | 'booking';
  entityId: string;
  features: Record<string, number | string | boolean>;
  timestamp: Date;
}

export interface EventStreamConfig {
  batchSize: number;
  flushIntervalMs: number;
  retryAttempts: number;
  deadLetterQueue: boolean;
}

// Feature Store Types
export interface UserFeatures {
  // Engagement Features
  engagementScore: number;
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  avgSessionDurationMinutes: number;
  lastSessionAt: Date | null;

  // Booking Features
  bookingsLast7Days: number;
  bookingsLast30Days: number;
  bookingsLast90Days: number;
  totalBookings: number;
  avgBookingValue: number;
  lastBookingAt: Date | null;
  daysSinceLastBooking: number;

  // Category Preferences
  topCategories: string[];
  categoryAffinity: Record<string, number>;

  // Behavioral Features
  cancellationRate: number;
  completionRate: number;
  avgRatingGiven: number;
  reviewsWritten: number;
  favoritesCount: number;

  // Temporal Patterns
  preferredTimeSlots: string[];
  preferredDays: number[];
  avgDaysBetweenBookings: number;

  // Risk Features
  fraudRiskScore: number;
  churnRiskScore: number;
  ltvTier: 'bronze' | 'silver' | 'gold' | 'platinum';

  // Wallet Features
  walletBalance: number;
  walletTransactionsLast30Days: number;
  avgWalletBalance: number;
}

export interface ServiceFeatures {
  // Popularity
  totalBookings: number;
  bookingsLast7Days: number;
  bookingsLast30Days: number;
  completionRate: number;
  cancellationRate: number;

  // Quality
  avgRating: number;
  ratingCount: number;
  ratingDistribution: Record<number, number>;

  // Demand
  demandScore: number;
  demandTrend: 'increasing' | 'stable' | 'decreasing';
  peakHours: number[];

  // Pricing
  avgPrice: number;
  priceRange: { min: number; max: number };
  priceVsMarket: number;

  // Provider Features
  providerCount: number;
  avgProviderRating: number;
  avgProviderCompletionRate: number;

  // Seasonality
  seasonalFactors: Record<string, number>;
}

export interface ProviderFeatures {
  // Reliability
  totalJobs: number;
  jobsLast30Days: number;
  completionRate: number;
  cancellationRate: number;
  acceptanceRate: number;
  avgResponseTimeMinutes: number;

  // Quality
  avgRating: number;
  ratingCount: number;
  isVerified: boolean;
  isTopRated: boolean;

  // Availability
  availableHours: number;
  avgAvailabilityScore: number;
  nextAvailableSlot: Date | null;

  // Performance
  avgEarningsPerJob: number;
  earningsLast30Days: number;
  repeatCustomerRate: number;

  // Demand
  bookingRequestsLast7Days: number;
  bookingConversionRate: number;
}

// Event Processing Pipeline
class EventProcessor {
  private eventBuffer: AIEvent[] = [];
  private featureStore: Map<string, UserFeatures | ServiceFeatures | ProviderFeatures> = new Map();
  private config: EventStreamConfig = {
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    deadLetterQueue: true,
  };
  private isProcessing = false;

  constructor() {
    // Start periodic flush
    setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  // Track an event
  async track(event: Omit<AIEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AIEvent = {
      ...event,
      id: new Types.ObjectId().toString(),
      timestamp: new Date(),
    };

    // Add to buffer
    this.eventBuffer.push(fullEvent);

    // Update feature store immediately for real-time features
    await this.updateFeatureStore(fullEvent);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      await this.flush();
    }

    logger.debug('Event tracked', {
      type: event.type,
      userId: event.userId,
    });
  }

  // Update feature store based on event
  private async updateFeatureStore(event: AIEvent): Promise<void> {
    const { type, userId, serviceId, providerId, bookingId, properties } = event;

    // User features update
    if (userId) {
      await this.updateUserFeatures(userId, type, properties);
    }

    // Service features update
    if (serviceId) {
      await this.updateServiceFeatures(serviceId, type, properties);
    }

    // Provider features update
    if (providerId) {
      await this.updateProviderFeatures(providerId, type, properties);
    }
  }

  private async updateUserFeatures(
    userId: string,
    eventType: AIEventType,
    properties: Record<string, any>
  ): Promise<void> {
    const key = `user:${userId}`;
    let features = this.featureStore.get(key) as UserFeatures | undefined;

    if (!features) {
      features = await this.computeUserFeatures(userId);
    }

    // Update based on event type
    switch (eventType) {
      case 'booking.completed':
        features.totalBookings++;
        features.bookingsLast30Days++;
        if (properties.value) {
          features.avgBookingValue =
            (features.avgBookingValue * (features.totalBookings - 1) + properties.value) /
            features.totalBookings;
        }
        features.lastBookingAt = new Date();
        features.daysSinceLastBooking = 0;
        break;

      case 'booking.cancelled':
        features.cancellationRate =
          (features.cancellationRate * features.totalBookings + 1) / (features.totalBookings + 1);
        break;

      case 'booking.rated':
        features.reviewsWritten++;
        features.avgRatingGiven =
          (features.avgRatingGiven * (features.reviewsWritten - 1) + properties.rating) /
          features.reviewsWritten;
        break;

      case 'user.session_started':
        features.sessionsLast30Days++;
        features.lastSessionAt = new Date();
        break;

      case 'service.viewed':
        if (properties.categoryId) {
          features.categoryAffinity[properties.categoryId] =
            (features.categoryAffinity[properties.categoryId] || 0) + 1;
        }
        break;
    }

    // Recalculate engagement score
    features.engagementScore = this.calculateEngagementScore(features);

    this.featureStore.set(key, features);
  }

  private async updateServiceFeatures(
    serviceId: string,
    eventType: AIEventType,
    properties: Record<string, any>
  ): Promise<void> {
    const key = `service:${serviceId}`;
    let features = this.featureStore.get(key) as ServiceFeatures | undefined;

    if (!features) {
      features = await this.computeServiceFeatures(serviceId);
    }

    switch (eventType) {
      case 'booking.completed':
        features.totalBookings++;
        features.bookingsLast30Days++;
        break;

      case 'booking.cancelled':
        features.cancellationRate =
          (features.cancellationRate * features.totalBookings + 1) /
          (features.totalBookings + 1);
        break;

      case 'service.viewed':
        features.demandScore = Math.min(100, features.demandScore + 1);
        break;

      case 'booking.rated':
        const newRating = properties.rating || 0;
        const count = features.ratingCount || 1;
        features.avgRating = (features.avgRating * count + newRating) / (count + 1);
        features.ratingCount++;
        break;
    }

    this.featureStore.set(key, features);
  }

  private async updateProviderFeatures(
    providerId: string,
    eventType: AIEventType,
    properties: Record<string, any>
  ): Promise<void> {
    const key = `provider:${providerId}`;
    let features = this.featureStore.get(key) as ProviderFeatures | undefined;

    if (!features) {
      features = await this.computeProviderFeatures(providerId);
    }

    switch (eventType) {
      case 'booking.completed':
        features.totalJobs++;
        features.jobsLast30Days++;
        features.completionRate =
          (features.completionRate * (features.totalJobs - 1) + 1) / features.totalJobs;
        break;

      case 'booking.cancelled':
        features.cancellationRate =
          (features.cancellationRate * features.totalJobs + 1) / features.totalJobs;
        break;

      case 'provider.booked':
        features.bookingRequestsLast7Days++;
        features.bookingConversionRate =
          (features.bookingConversionRate * features.totalJobs + 1) /
          (features.bookingRequestsLast7Days || 1);
        break;
    }

    this.featureStore.set(key, features);
  }

  private calculateEngagementScore(features: UserFeatures): number {
    const recencyScore = features.daysSinceLastBooking < 7 ? 100 :
                        features.daysSinceLastBooking < 30 ? 70 :
                        features.daysSinceLastBooking < 60 ? 40 : 10;

    const frequencyScore = Math.min(100, features.bookingsLast30Days * 20);

    const engagementScore = (recencyScore * 0.5) + (frequencyScore * 0.5);

    return Math.min(100, engagementScore);
  }

  // Compute features from database
  private async computeUserFeatures(userId: string): Promise<UserFeatures> {
    const userObjectId = new Types.ObjectId(userId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [bookings, reviews, user] = await Promise.all([
      Booking.find({ customerId: userObjectId }).lean(),
      // Review.find({ customerId: userObjectId }).lean(),
      Promise.resolve([]),
      User.findById(userObjectId).lean(),
    ]);

    const recentBookings = bookings.filter(b =>
      new Date(b.createdAt) >= thirtyDaysAgo
    );

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const cancelledBookings = bookings.filter(b =>
      b.status === 'cancelled' || b.status === 'no_show'
    );

    return {
      engagementScore: 50,
      sessionsLast7Days: 0,
      sessionsLast30Days: 0,
      avgSessionDurationMinutes: 0,
      lastSessionAt: null,
      bookingsLast7Days: recentBookings.filter(b =>
        new Date(b.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      bookingsLast30Days: recentBookings.length,
      bookingsLast90Days: bookings.length,
      totalBookings: bookings.length,
      avgBookingValue: completedBookings.length > 0
        ? completedBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0) /
          completedBookings.length
        : 0,
      lastBookingAt: bookings[0]?.createdAt || null,
      daysSinceLastBooking: bookings.length > 0
        ? Math.floor((Date.now() - new Date(bookings[0].createdAt).getTime()) /
            (1000 * 60 * 60 * 24))
        : 365,
      topCategories: [],
      categoryAffinity: {},
      cancellationRate: bookings.length > 0
        ? cancelledBookings.length / bookings.length
        : 0,
      completionRate: bookings.length > 0
        ? completedBookings.length / bookings.length
        : 1,
      avgRatingGiven: 0,
      reviewsWritten: reviews.length,
      favoritesCount: 0,
      preferredTimeSlots: [],
      preferredDays: [],
      avgDaysBetweenBookings: 30,
      fraudRiskScore: 0,
      churnRiskScore: 0.5,
      ltvTier: 'bronze',
      walletBalance: 0,
      walletTransactionsLast30Days: 0,
      avgWalletBalance: 0,
    };
  }

  private async computeServiceFeatures(serviceId: string): Promise<ServiceFeatures> {
    const serviceObjectId = new Types.ObjectId(serviceId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      serviceId: serviceObjectId,
      createdAt: { $gte: thirtyDaysAgo },
    }).lean();

    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');

    return {
      totalBookings: bookings.length,
      bookingsLast7Days: bookings.filter(b =>
        new Date(b.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      bookingsLast30Days: bookings.length,
      completionRate: bookings.length > 0 ? completed.length / bookings.length : 1,
      cancellationRate: bookings.length > 0 ? cancelled.length / bookings.length : 0,
      avgRating: 4.5,
      ratingCount: 0,
      ratingDistribution: {},
      demandScore: 50,
      demandTrend: 'stable',
      peakHours: [],
      avgPrice: 0,
      priceRange: { min: 0, max: 0 },
      priceVsMarket: 0,
      providerCount: 0,
      avgProviderRating: 0,
      avgProviderCompletionRate: 0,
      seasonalFactors: {},
    };
  }

  private async computeProviderFeatures(providerId: string): Promise<ProviderFeatures> {
    const providerObjectId = new Types.ObjectId(providerId);

    const [bookings, profile] = await Promise.all([
      Booking.find({ providerId: providerObjectId }).lean(),
      ProviderProfile.findOne({ userId: providerId }).lean(),
    ]);

    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');

    return {
      totalJobs: bookings.length,
      jobsLast30Days: bookings.filter(b =>
        new Date(b.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
      completionRate: bookings.length > 0 ? completed.length / bookings.length : 1,
      cancellationRate: bookings.length > 0 ? cancelled.length / bookings.length : 0,
      acceptanceRate: 0.95,
      avgResponseTimeMinutes: 0,
      avgRating: (profile as any)?.reviewsData?.averageRating || 4.5,
      ratingCount: (profile as any)?.reviewsData?.totalReviews || 0,
      isVerified: (profile as any)?.verificationStatus?.overall === 'approved',
      isTopRated: false,
      availableHours: 0,
      avgAvailabilityScore: 0,
      nextAvailableSlot: null,
      avgEarningsPerJob: 0,
      earningsLast30Days: 0,
      repeatCustomerRate: 0,
      bookingRequestsLast7Days: 0,
      bookingConversionRate: 0,
    };
  }

  // Flush event buffer
  async flush(): Promise<void> {
    if (this.isProcessing || this.eventBuffer.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // Process events in batch
      await this.processBatch(events);

      logger.info('Event batch processed', { count: events.length });
    } catch (error) {
      logger.error('Failed to process event batch', { error });
      // Re-add events to buffer for retry
      // this.eventBuffer.unshift(...events);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatch(events: AIEvent[]): Promise<void> {
    // Group events by type for efficient processing
    const eventsByType = new Map<AIEventType, AIEvent[]>();
    events.forEach(event => {
      const existing = eventsByType.get(event.type) || [];
      existing.push(event);
      eventsByType.set(event.type, existing);
    });

    // Process each type
    for (const [type, typeEvents] of eventsByType) {
      await this.processEventType(type, typeEvents);
    }
  }

  private async processEventType(type: AIEventType, events: AIEvent[]): Promise<void> {
    // This would typically send to a message queue or streaming platform
    // For now, we log the events
    logger.debug('Processing event type', {
      type,
      count: events.length,
    });
  }

  // Get features from store
  async getUserFeatures(userId: string): Promise<UserFeatures | null> {
    const key = `user:${userId}`;
    let features = this.featureStore.get(key) as UserFeatures | undefined;

    if (!features) {
      features = await this.computeUserFeatures(userId);
      this.featureStore.set(key, features);
    }

    return features;
  }

  async getServiceFeatures(serviceId: string): Promise<ServiceFeatures | null> {
    const key = `service:${serviceId}`;
    let features = this.featureStore.get(key) as ServiceFeatures | undefined;

    if (!features) {
      features = await this.computeServiceFeatures(serviceId);
      this.featureStore.set(key, features);
    }

    return features;
  }

  async getProviderFeatures(providerId: string): Promise<ProviderFeatures | null> {
    const key = `provider:${providerId}`;
    let features = this.featureStore.get(key) as ProviderFeatures | undefined;

    if (!features) {
      features = await this.computeProviderFeatures(providerId);
      this.featureStore.set(key, features);
    }

    return features;
  }
}

// Export singleton instance
export const eventProcessor = new EventProcessor();

// Convenience methods for tracking specific events
export const trackEvent = {
  bookingCreated: (userId: string, bookingId: string, serviceId: string, properties: Record<string, any>) =>
    eventProcessor.track({
      type: 'booking.created',
      userId,
      bookingId,
      serviceId,
      properties,
      context: properties.context || {},
    }),

  bookingCompleted: (userId: string, bookingId: string, serviceId: string, providerId: string, properties: Record<string, any>) =>
    eventProcessor.track({
      type: 'booking.completed',
      userId,
      bookingId,
      serviceId,
      providerId,
      properties,
      context: properties.context || {},
    }),

  serviceViewed: (userId: string, serviceId: string, properties: Record<string, any>) =>
    eventProcessor.track({
      type: 'service.viewed',
      userId,
      serviceId,
      properties,
      context: properties.context || {},
    }),

  searchPerformed: (userId: string, properties: Record<string, any>) =>
    eventProcessor.track({
      type: 'search.query',
      userId,
      properties,
      context: properties.context || {},
    }),

  sessionStarted: (userId: string, sessionId: string, properties: Record<string, any>) =>
    eventProcessor.track({
      type: 'user.session_started',
      userId,
      properties: { ...properties, sessionId },
      context: properties.context || {},
    }),

  notificationOpened: (userId: string, notificationId: string, properties: Record<string, any>) =>
    eventProcessor.track({
      type: 'notification.opened',
      userId,
      properties: { ...properties, notificationId },
      context: properties.context || {},
    }),
};

export default eventProcessor;
