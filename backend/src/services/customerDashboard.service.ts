import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Bundle from '../models/bundle.model';
import Review from '../models/review.model';
import { ApiError } from '../utils/ApiError';
import {
  applyTenantToBookingQuery,
  buildCustomerBookingAggregationMatch,
} from '../utils/tenantBookingQuery';
import { cache } from '../config/redis';
import logger from '../utils/logger';
import { RecommendedProsResponseDTO } from '../dto/customerDashboard.dto';
import { DEFAULT_CURRENCY } from '../utils/currency';

// Cache configuration for recommendations
const RECOMMENDATIONS_CACHE_TTL = 600; // 10 minutes TTL
const RECOMMENDATIONS_CACHE_PREFIX = 'recommendations';

// Cache configuration for service packages
const PACKAGES_CACHE_TTL = 600; // 10 minutes TTL
const PACKAGES_CACHE_PREFIX = 'packages';

// Cache configuration for featured packages
const FEATURED_PACKAGES_CACHE_TTL = 600; // 10 minutes TTL
const FEATURED_PACKAGES_CACHE_PREFIX = 'featured-packages';

// Generate cache key for service packages
const getPackagesCacheKey = (tenantId: string, options: object): string => {
  return `${PACKAGES_CACHE_PREFIX}:${tenantId}:${JSON.stringify(options)}`;
};

// Generate cache key for featured packages
const getFeaturedPackagesCacheKey = (tenantId: string, category?: string): string => {
  return `${FEATURED_PACKAGES_CACHE_PREFIX}:${tenantId}:${category || 'all'}`;
};

// Category limit for recommendations (configurable via environment variable)
const DEFAULT_CATEGORY_LIMIT = parseInt(process.env.RECOMMENDATIONS_CATEGORY_LIMIT || '5', 10);
const RECOMMENDATIONS_CATEGORY_LIMIT = Math.min(Math.max(DEFAULT_CATEGORY_LIMIT, 3), 10); // Clamp between 3-10

// Generate cache key for customer recommendations
const getRecommendationsCacheKey = (tenantId: string, customerId: string): string => {
  return `${RECOMMENDATIONS_CACHE_PREFIX}:${tenantId}:${customerId}`;
};

// ============================================
// Types & Interfaces
// ============================================

export interface DashboardStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  averageOrderValue: number;
  completedCount?: number;
  // Additional stats
  activeBookings?: number;
  inProgressBookings?: number;
  pendingBookings?: number;
  todayBookings?: number;
  totalProviders?: number;
  reviewsWritten?: number;
  pendingReviews?: number;
}

export interface LoyaltyData {
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalEarned: number;
  totalSpent: number;
  referralCode: string;
  nextTierPoints?: number;
  pointsToNextTier?: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: Date;
  totalActiveDays: number;
}

export interface BookingSummary {
  _id: mongoose.Types.ObjectId;
  bookingNumber: string;
  status: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  totalAmount: number;
  currency: string;
  serviceName: string;
  serviceCategory: string;
  providerName: string;
  providerId: mongoose.Types.ObjectId;
  providerAvatar?: string;
  createdAt: Date;
  canReview?: boolean;
}

export interface ActivityItem {
  type: 'booking' | 'payment' | 'review' | 'loyalty' | 'streak';
  action: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface RecommendedPro {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  avatar?: string;
  businessName?: string;
  bio?: string;
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
  score: number;
  services: Array<{
    name: string;
    price: number;
    category: string;
  }>;
  isVerified: boolean;
  tier: 'elite' | 'premium' | 'standard';
  distance?: number;
}

export interface ServicePackage {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  discountedPrice?: number;
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  durationLabel: string;
  features: Array<{ name: string; included: boolean }>;
  services: Array<{ _id?: string; name?: string; serviceName?: string; duration: number; price: number; originalPrice?: number }>;
  images: string[];
  includedItems: string[];
  addOns?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    isVerified?: boolean;
  };
  providerName: string;
  providerId: mongoose.Types.ObjectId | string;
  averageRating: number;
  totalReviews: number;
  isPopular: boolean;
  isFeatured: boolean;
  stats?: {
    rating: number;
    reviewCount: number;
    totalPurchases: number;
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Validates a string and converts it to a mongoose ObjectId.
 * Throws ApiError(400) if the string is not a valid ObjectId format.
 */
function toObjectId(id: string, fieldName: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${fieldName} format`);
  }
  return new mongoose.Types.ObjectId(id);
}

function resolvePopulatedProvider(booking: any): { firstName?: string; lastName?: string; avatar?: string } | null {
  // Handle populated provider object with firstName/lastName
  if (booking.provider?.firstName !== undefined || booking.provider?.lastName !== undefined) {
    return booking.provider;
  }
  // Handle providerId as populated object with firstName/lastName
  if (
    booking.providerId &&
    typeof booking.providerId === 'object' &&
    (booking.providerId.firstName !== undefined || booking.providerId.lastName !== undefined)
  ) {
    return booking.providerId;
  }
  // Return null if providerId is just a string reference (not populated)
  return null;
}

function resolvePopulatedService(booking: any): { name?: string; category?: string } | null {
  // Handle populated service object with name
  if (booking.service?.name) {
    return booking.service;
  }
  // Handle serviceId as populated object with name
  if (booking.serviceId && typeof booking.serviceId === 'object' && booking.serviceId.name) {
    return booking.serviceId;
  }
  // Handle case where service is a string reference - return placeholder
  if (booking.serviceId && typeof booking.serviceId === 'string') {
    return {
      name: booking.serviceName || 'Service',
      category: booking.serviceCategory || 'General'
    };
  }
  return null;
}

function formatBookingSummary(booking: any): BookingSummary {
  const provider = resolvePopulatedProvider(booking);
  const service = resolvePopulatedService(booking);

  return {
    _id: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    duration: booking.duration,
    totalAmount: booking.pricing?.totalAmount || 0,
    currency: booking.pricing?.currency || DEFAULT_CURRENCY,
    serviceName: service?.name || booking.serviceName || 'Unknown Service',
    serviceCategory: service?.category || booking.serviceCategory || 'General',
    providerName: provider
      ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim()
      : booking.providerName || 'Unknown Provider',
    providerId:
      booking.providerId?._id?.toString?.() ||
      booking.provider?._id?.toString?.() ||
      (typeof booking.providerId === 'object' && booking.providerId
        ? String(booking.providerId)
        : typeof booking.providerId === 'string'
          ? booking.providerId
          : ''),
    providerAvatar: provider?.avatar,
    createdAt: booking.createdAt,
    // Check multiple possible review field names for compatibility
    canReview:
      booking.status === 'completed' &&
      !booking.customerReview &&
      !booking.review &&
      !booking.customerReviewSubmitted,
  };
}

// ============================================
// Dashboard Service
// ============================================

export class CustomerDashboardService {

  /**
   * Get unified dashboard data for the customer
   */
  async getDashboardData(customerId: string, tenantId: string): Promise<{
    recentBookings: BookingSummary[];
    upcomingBookings: BookingSummary[];
    stats: DashboardStats;
    loyaltyPoints: LoyaltyData;
    currentStreak: StreakData;
  }> {
    try {
      // Fetch all data in parallel for performance
      const [
        recentBookings,
        upcomingBookings,
        stats,
        loyaltyPoints,
        currentStreak,
      ] = await Promise.all([
        this.getRecentBookings(customerId, tenantId, 5),
        this.getUpcomingBookings(customerId, tenantId, 3),
        this.getStats(customerId, tenantId),
        this.getLoyaltyData(customerId, tenantId),
        this.getStreakData(customerId, tenantId),
      ]);

      return {
        recentBookings,
        upcomingBookings,
        stats,
        loyaltyPoints,
        currentStreak,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch dashboard data', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get recent bookings (last 5 bookings)
   */
  async getRecentBookings(customerId: string, tenantId: string, limit: number = 5): Promise<BookingSummary[]> {
    try {
      const customerObjectId = toObjectId(customerId, 'customerId');
      const query: Record<string, unknown> = {
        customerId: customerObjectId,
        deletedAt: { $exists: false },
      };
      applyTenantToBookingQuery(query, tenantId);

      const bookings = await Booking.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('service', 'name category')
        .populate('provider', 'firstName lastName avatar')
        .lean();

      return bookings.map(formatBookingSummary);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch recent bookings', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get upcoming bookings (next 3 confirmed/pending bookings)
   */
  async getUpcomingBookings(customerId: string, tenantId: string, limit: number = 3): Promise<BookingSummary[]> {
    try {
      const customerObjectId = toObjectId(customerId, 'customerId');
      const now = new Date();
      const query: Record<string, unknown> = {
        customerId: customerObjectId,
        status: { $in: ['confirmed', 'pending'] },
        scheduledDate: { $gte: now },
        deletedAt: { $exists: false },
      };
      applyTenantToBookingQuery(query, tenantId);

      const bookings = await Booking.find(query)
        .sort({ scheduledDate: 1, scheduledTime: 1 })
        .limit(limit)
        .populate('service', 'name category')
        .populate('provider', 'firstName lastName avatar')
        .lean();

      return bookings.map(formatBookingSummary);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch upcoming bookings', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get dashboard statistics
   */
  async getStats(customerId: string, tenantId: string): Promise<DashboardStats> {
    try {
      const customerObjectId = toObjectId(customerId, 'customerId');
      const tenantObjectId = mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : null;
      const now = new Date();

      const bookingMatch = buildCustomerBookingAggregationMatch(customerId, tenantId);

      // Get today's bookings time range
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

      // Build query objects for parallel execution
      const providersQuery: Record<string, unknown> = {
        customerId: customerObjectId,
        deletedAt: { $exists: false },
      };
      applyTenantToBookingQuery(providersQuery, tenantId);

      const reviewMatch: Record<string, unknown> = {
        reviewerId: customerObjectId,
        isHidden: false,
      };
      if (tenantObjectId) {
        reviewMatch.$or = [
          { tenantId: tenantObjectId },
          { tenantId: { $exists: false } },
          { tenantId: null },
        ];
      }

      const pendingReviewMatch = {
        ...bookingMatch,
        status: 'completed',
        $or: [
          { customerReview: { $exists: false } },
          { customerReview: null },
        ],
      };

      // Execute all independent queries in parallel for improved performance
      const [
        bookingStats,
        todayStats,
        providersCount,
        reviewStats,
        pendingReviews,
      ] = await Promise.all([
        // 1. Aggregation pipeline for stats (all-time)
        Booking.aggregate([
          {
            $match: bookingMatch,
          },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              completedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
              cancelledBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
              },
              pendingBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
              },
              inProgressBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
              },
              confirmedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
              },
              totalSpent: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', 'completed'] },
                    { $ifNull: ['$pricing.totalAmount', 0] },
                    0,
                  ],
                },
              },
              completedCount: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
            },
          },
        ]),
        // 2. Get today's bookings count
        Booking.aggregate([
          {
            $match: buildCustomerBookingAggregationMatch(customerId, tenantId, {
              scheduledDate: { $gte: startOfToday, $lt: endOfToday },
            }),
          },
          {
            $group: {
              _id: null,
              todayBookings: { $sum: 1 },
            },
          },
        ]),
        // 3. Get total unique providers (customers served)
        Booking.distinct('providerId', providersQuery),
        // 4. Get average rating from reviews given by customer
        Review.aggregate([
          {
            $match: reviewMatch,
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              totalReviews: { $sum: 1 },
            },
          },
        ]),
        // 5. Count pending reviews
        Booking.countDocuments(pendingReviewMatch),
      ]);

      const stats = bookingStats[0] || {
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        pendingBookings: 0,
        inProgressBookings: 0,
        confirmedBookings: 0,
        totalSpent: 0,
      };

      const reviews = reviewStats[0] || {
        averageRating: 0,
        totalReviews: 0,
      };

      const todayData = todayStats[0] || { todayBookings: 0 };

      // Calculate active bookings (pending + confirmed + in_progress)
      const activeBookings = (stats.pendingBookings || 0) + (stats.confirmedBookings || 0) + (stats.inProgressBookings || 0);

      // Total unique providers served
      const totalProviders = providersCount ? providersCount.length : 0;

      return {
        totalBookings: stats.totalBookings || 0,
        completedBookings: stats.completedBookings || 0,
        cancelledBookings: stats.cancelledBookings || 0,
        totalSpent: Math.round((stats.totalSpent || 0) * 100) / 100,
        averageRating: Math.round((reviews.averageRating || 0) * 10) / 10,
        completedCount: stats.completedCount || 0,
        averageOrderValue: (stats.completedCount || 0) > 0
          ? Math.round((stats.totalSpent / stats.completedCount) * 100) / 100
          : 0,
        // Additional stats for dashboard
        activeBookings,
        inProgressBookings: stats.inProgressBookings || 0,
        pendingBookings: stats.pendingBookings || 0,
        todayBookings: todayData.todayBookings || 0,
        totalProviders,
        reviewsWritten: reviews.totalReviews || 0,
        pendingReviews,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch dashboard data', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get loyalty points data
   */
  async getLoyaltyData(customerId: string, tenantId: string): Promise<LoyaltyData> {
    try {
      const customerObjectId = toObjectId(customerId, 'customerId');
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const user = await User.findOne({ _id: customerObjectId, tenantId: tenantObjectId })
        .select('loyaltySystem')
        .lean();

      if (!user || !user.loyaltySystem) {
        return {
          points: 0,
          tier: 'bronze',
          totalEarned: 0,
          totalSpent: 0,
          referralCode: '',
        };
      }

      const { coins, tier, totalEarned, totalSpent, referralCode } = user.loyaltySystem;

      // Calculate points needed for next tier
      const tierThresholds: Record<string, number> = {
        bronze: 1000,
        silver: 5000,
        gold: 10000,
        platinum: Infinity,
      };

      const nextTier = tier === 'bronze' ? 'silver' : tier === 'silver' ? 'gold' : tier === 'gold' ? 'platinum' : null;
      const nextTierPoints = nextTier ? tierThresholds[nextTier] : undefined;
      const pointsToNextTier = nextTierPoints ? Math.max(0, nextTierPoints - totalEarned) : undefined;

      return {
        points: coins || 0,
        tier: tier || 'bronze',
        totalEarned: totalEarned || 0,
        totalSpent: totalSpent || 0,
        referralCode: referralCode || '',
        nextTierPoints,
        pointsToNextTier,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch dashboard data', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get streak data
   */
  async getStreakData(customerId: string, tenantId: string): Promise<StreakData> {
    try {
      const customerObjectId = toObjectId(customerId, 'customerId');
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const user = await User.findOne({ _id: customerObjectId, tenantId: tenantObjectId })
        .select('loyaltySystem')
        .lean();

      if (!user || !user.loyaltySystem) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalActiveDays: 0,
        };
      }

      const { streakDays, lastStreakDate, longestStreak: storedLongestStreak } = user.loyaltySystem;

      // Use stored streak values - no recalculation needed
      // currentStreak is valid if lastStreakDate is today or yesterday
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentStreakCount = streakDays || 0;

      if (lastStreakDate) {
        const lastDate = new Date(lastStreakDate);
        lastDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 1) {
          currentStreakCount = 0; // Streak broken
        }
      } else {
        currentStreakCount = 0;
      }

      return {
        currentStreak: currentStreakCount,
        longestStreak: storedLongestStreak || 0,
        lastActivityDate: lastStreakDate,
        totalActiveDays: 0, // Deprecated field - not calculated to avoid O(n) scan
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch dashboard data', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get recent activity feed
   */
  async getActivityFeed(customerId: string, tenantId: string, limit: number = 20): Promise<ActivityItem[]> {
    try {
      const customerObjectId = toObjectId(customerId, 'customerId');
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const activities: ActivityItem[] = [];

      // Get recent bookings using aggregation with $lookup (single query, no N+1)
      const recentBookings = await Booking.aggregate([
        { $match: { customerId: customerObjectId, tenantId: tenantObjectId, deletedAt: { $exists: false } } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'serviceData',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'providerId',
            foreignField: '_id',
            as: 'providerData',
          },
        },
        {
          $project: {
            _id: 1,
            bookingNumber: 1,
            status: 1,
            createdAt: 1,
            completedAt: 1,
            cancelledAt: 1,
            'pricing.totalAmount': 1,
            'serviceData.name': 1,
            'providerData.firstName': 1,
            'providerData.lastName': 1,
          },
        },
      ]);

      for (const booking of recentBookings) {
        const actionMap: Record<string, string> = {
          pending: 'Booking Created',
          confirmed: 'Booking Confirmed',
          in_progress: 'Service Started',
          completed: 'Service Completed',
          cancelled: 'Booking Cancelled',
          no_show: 'No Show Recorded',
        };
        const serviceName = booking.serviceData?.[0]?.name || 'Service';
        const providerName = booking.providerData?.[0]
          ? `${booking.providerData[0].firstName || ''} ${booking.providerData[0].lastName || ''}`.trim()
          : 'Provider';

        activities.push({
          type: 'booking',
          action: actionMap[booking.status] || booking.status,
          description: `${serviceName} with ${providerName}`,
          timestamp: booking.status === 'completed' && booking.completedAt
            ? booking.completedAt
            : booking.status === 'cancelled' && booking.cancelledAt
              ? booking.cancelledAt
              : booking.createdAt,
          metadata: {
            bookingId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            status: booking.status,
            amount: booking.pricing?.totalAmount,
          },
        });
      }

      // Get recent reviews using aggregation (single query)
      const recentReviews = await Review.aggregate([
        { $match: { reviewerId: customerObjectId, tenantId: tenantObjectId, isHidden: false } },
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        { $project: { _id: 1, rating: 1, createdAt: 1 } },
      ]);

      for (const review of recentReviews) {
        activities.push({
          type: 'review',
          action: 'Review Submitted',
          description: `You left a ${review.rating}-star review`,
          timestamp: review.createdAt,
          metadata: {
            reviewId: review._id.toString(),
            rating: review.rating,
          },
        });
      }

      // Get loyalty events from user (single query)
      const user = await User.findOne({ _id: customerObjectId, tenantId: tenantObjectId })
        .select('loyaltySystem')
        .lean();

      if (user?.loyaltySystem?.pointsHistory) {
        const loyaltyHistory = (user.loyaltySystem.pointsHistory as any[])
          .slice(-5)
          .reverse();

        for (const entry of loyaltyHistory) {
          const actionMap: Record<string, string> = {
            earned: 'Points Earned',
            spent: 'Points Redeemed',
            bonus: 'Bonus Awarded',
            referral: 'Referral Reward',
          };

          activities.push({
            type: 'loyalty',
            action: actionMap[entry.type] || entry.type,
            description: entry.description || `${entry.type === 'earned' ? '+' : '-'}${Math.abs(entry.amount)} points`,
            timestamp: entry.date,
            metadata: {
              points: entry.amount,
              type: entry.type,
            },
          });
        }
      }

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, limit);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch dashboard data', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Get recommended professionals based on user's booking history
   * Uses Redis caching with 10-minute TTL for performance
   * Supports optional geospatial filtering when latitude/longitude are provided
   */
  async getRecommendedPros(
    customerId: string,
    tenantId: string,
    limit: number = 10,
    options?: { latitude?: number; longitude?: number; maxDistanceKm?: number; category?: string }
  ): Promise<RecommendedProsResponseDTO> {
    try {
      // Validate inputs
      toObjectId(customerId, 'customerId');
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }

      // Validate geospatial parameters if provided
      if (options?.latitude !== undefined) {
        if (options.latitude < -90 || options.latitude > 90) {
          throw new ApiError(400, 'Invalid latitude: must be between -90 and 90');
        }
      }
      if (options?.longitude !== undefined) {
        if (options.longitude < -180 || options.longitude > 180) {
          throw new ApiError(400, 'Invalid longitude: must be between -180 and 180');
        }
      }
      if (options?.maxDistanceKm !== undefined && options.maxDistanceKm <= 0) {
        throw new ApiError(400, 'Invalid maxDistanceKm: must be a positive number');
      }

      // Include geo bucket and category in cache key so different contexts get separate caches
      const geoSuffix = options?.latitude !== undefined && options?.longitude !== undefined ? ':geo' : ':nogeo';
      const categorySuffix = options?.category ? `:cat:${options.category.toLowerCase()}` : '';
      const cacheKey = getRecommendationsCacheKey(tenantId, customerId) + geoSuffix + categorySuffix;

      // Try to get from cache first
      try {
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
          logger.debug('Cache hit for recommendations', { tenantId, customerId, cacheKey });
          const parsed = JSON.parse(cachedData);
          const slicedPros = (parsed.pros || []).slice(0, limit);
          // Return cached data with limit applied if needed
          return {
            recentlyUsed: (parsed.recentlyUsed || []).slice(0, limit),
            pros: slicedPros,
            pagination: {
              total: parsed.pagination?.total || slicedPros.length,
              hasMore: (parsed.pros || []).length > limit,
            },
          };
        }
      } catch (error) {
        logger.warn('Failed to get recommendations from cache', {
          tenantId,
          customerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.debug('Cache miss for recommendations, fetching from database', { tenantId, customerId });

      // Fetch from database
      const recommendations = await this.fetchRecommendationsFromDb(customerId, tenantId, limit, options);

      // Store in cache
      try {
        await cache.set(cacheKey, JSON.stringify(recommendations), RECOMMENDATIONS_CACHE_TTL);
        logger.debug('Recommendations cached', { tenantId, customerId, ttl: RECOMMENDATIONS_CACHE_TTL });
      } catch (error) {
        logger.warn('Failed to cache recommendations', {
          tenantId,
          customerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return recommendations;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch dashboard data', {
        customerId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Invalidate recommendations cache for a customer
   * Called when a new booking is completed
   */
  async invalidateRecommendationsCache(tenantId: string, customerId: string): Promise<void> {
    const cacheKey = getRecommendationsCacheKey(tenantId, customerId);
    try {
      await cache.del(cacheKey);
      logger.debug('Recommendations cache invalidated', { tenantId, customerId, cacheKey });
    } catch (error) {
      logger.warn('Failed to invalidate recommendations cache', {
        tenantId,
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fetch recommendations from database
   * Internal method used by getRecommendedPros for cache misses
   * Supports optional geospatial filtering for location-based recommendations
   */
  private async fetchRecommendationsFromDb(
    customerId: string,
    tenantId: string,
    limit: number = 10,
    options?: { latitude?: number; longitude?: number; maxDistanceKm?: number; category?: string }
  ): Promise<RecommendedProsResponseDTO> {
    const customerObjectId = toObjectId(customerId, 'customerId');
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const now = new Date();

    // Get user's preferred service categories and recently used providers in parallel
    // Include all non-cancelled bookings for preference analysis
    const [preferredCategories, recentBookings] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            customerId: customerObjectId,
            tenantId: tenantObjectId,
            status: { $in: ['completed', 'confirmed', 'in_progress'] }, // Include all non-cancelled bookings
            deletedAt: { $exists: false },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $match: { serviceId: { $exists: true, $ne: null } } },
        { $unwind: '$service' },
        {
          $group: {
            _id: '$service.category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: RECOMMENDATIONS_CATEGORY_LIMIT },
      ]),
      Booking.find({
        customerId: customerObjectId,
        tenantId: tenantObjectId,
        status: { $in: ['completed', 'confirmed', 'in_progress'] }, // Include all non-cancelled bookings
        deletedAt: { $exists: false },
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select('providerId')
        .lean(),
    ]);

    const preferredCategoryNames = preferredCategories.map(c => c._id);

    // Get unique recently used provider IDs
    const recentlyUsedProviderIds = [...new Set(recentBookings.map(b => b.providerId.toString()))];

    // Get top-rated providers with matching categories (excluding recently used).
    // If an explicit category filter was passed, use it directly (case-insensitive regex)
    // so the chip selection on the frontend actually narrows results server-side.
    const matchCondition = options?.category
      ? { 'services.category': { $regex: new RegExp(options.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
      : preferredCategoryNames.length > 0
        ? { 'services.category': { $in: preferredCategoryNames } }
        : {};

    // Build exclude condition for recently used providers
    const excludeProviderIds = recentlyUsedProviderIds.length > 0
      ? { userId: { $nin: recentlyUsedProviderIds.map(id => new mongoose.Types.ObjectId(id)) } }
      : {};

    // Build geospatial filter if location is provided
    const hasGeospatialQuery = options?.latitude !== undefined && options?.longitude !== undefined;

    const providers = await ProviderProfile.aggregate([
      // Use $geoNear for geospatial queries to sort by distance
      ...(hasGeospatialQuery
        ? [
            {
              $geoNear: {
                near: {
                  type: 'Point',
                  coordinates: [options.longitude!, options.latitude!],
                },
                distanceField: 'distance',
                maxDistance: (options.maxDistanceKm || 50) * 1000, // Convert km to meters
                spherical: true,
                query: {
                  tenantId: tenantObjectId,
                  isActive: true,
                  isDeleted: false,
                  'verificationStatus.overall': 'approved',
                  ...matchCondition,
                  ...excludeProviderIds,
                  // Only include providers with valid location data
                  'locationInfo.primaryAddress.coordinates': { $exists: true, $ne: null },
                },
              },
            } as any,
          ]
        : [
            {
              $match: {
                tenantId: tenantObjectId,
                isActive: true,
                isDeleted: false,
                'verificationStatus.overall': 'approved',
                ...matchCondition,
                ...excludeProviderIds,
              },
            },
          ]),
      // Add $geoWithin stage for secondary geospatial filtering if $geoNear was not used
      ...(!hasGeospatialQuery && options?.latitude !== undefined && options?.longitude !== undefined
        ? [
            {
              $geoWithin: {
                $centerSphere: [
                  [options.longitude!, options.latitude!],
                  (options.maxDistanceKm || 50) / 6378.1, // Convert km to radians
                ],
              },
            } as any,
          ]
        : []),
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $match: { userId: { $exists: true, $ne: null } } },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'services',
          let: { providerId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$providerId', '$$providerId'] },
                isActive: true,
                // Check price validity dates (validFrom/validTo)
                $and: [
                  {
                    $or: [
                      { validFrom: { $exists: false } },
                      { validFrom: null },
                      { validFrom: { $lte: now } },
                    ],
                  },
                  {
                    $or: [
                      { validTo: { $exists: false } },
                      { validTo: null },
                      { validTo: { $gte: now } },
                    ],
                  },
                ],
                // Ensure services have minimum required fields populated
                name: { $exists: true, $ne: '' },
                price: { $exists: true, $ne: null },
                ...(preferredCategoryNames.length > 0 && { category: { $in: preferredCategoryNames } }),
              },
            },
            { $sort: { category: 1 } },
            { $limit: 5 },
            { $project: { name: 1, price: 1, category: 1 } },
          ],
          as: 'servicesData',
        },
      },
      {
        $lookup: {
          from: 'reviews',
          let: { providerId: '$userId' },
          // TENANT ISOLATION REQUIRED: Reviews aggregation MUST filter by tenantId
          // to ensure data isolation between tenants. The tenantId filter prevents
          // cross-tenant data leakage in multi-tenant deployments.
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$revieweeId', '$$providerId'] },
                tenantId: tenantObjectId, // CRITICAL: Enforce tenant isolation
              },
            },
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
              },
            },
          ],
          as: 'reviewsData',
        },
      },
      { $unwind: { path: '$reviewsData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          avatar: '$user.avatar',
          businessName: '$businessInfo.businessName',
          bio: '$instagramStyleProfile.bio',
          averageRating: { $ifNull: ['$reviewsData.averageRating', 0] },
          totalReviews: { $ifNull: ['$reviewsData.totalReviews', 0] },
          completedJobs: '$analytics.bookingStats.completedBookings',
          services: '$servicesData',
          isVerified: '$instagramStyleProfile.isVerified',
          tier: 1,
          score: {
            $add: [
              { $multiply: [{ $ifNull: ['$reviewsData.averageRating', 0] }, 20] }, // Rating weight
              { $multiply: [{ $cond: ['$instagramStyleProfile.isVerified', 10, 0] }] }, // Verified bonus
              { $multiply: ['$completionPercentage', 0.1] }, // Profile completion bonus
            ],
          },
          // Include distance field if geospatial query was used
          ...(hasGeospatialQuery && { distance: { $ifNull: ['$distance', null] } }),
        },
      },
      // Sort by distance when geospatial query is used, otherwise by score
      { $sort: hasGeospatialQuery ? { distance: 1, score: -1, averageRating: -1 } : { score: -1, averageRating: -1 } },
      { $limit: limit },
    ]);

    const mappedProviders = providers.map(p => ({
      _id: p._id,
      userId: p.userId,
      firstName: p.firstName,
      lastName: p.lastName,
      avatar: p.avatar,
      businessName: p.businessName,
      bio: p.bio,
      averageRating: Math.round((p.averageRating || 0) * 10) / 10,
      totalReviews: p.totalReviews || 0,
      completedJobs: p.completedJobs || 0,
      score: Math.round((p.score || 0) * 100) / 100,
      services: p.services || [],
      isVerified: p.isVerified || false,
      tier: p.tier || 'standard',
      // Include distance in km if geospatial query was used
      ...(hasGeospatialQuery && p.distance !== undefined && {
        distance: Math.round((p.distance / 1000) * 10) / 10, // Convert meters to km
      }),
    }));

    // Get recently used providers
    const recentlyUsed = await this.getProvidersByIds(recentlyUsedProviderIds, tenantObjectId);

    // Calculate total count for pagination metadata
    const totalCount = providers.length + recentlyUsed.length;

    return {
      recentlyUsed,
      pros: mappedProviders,
      pagination: {
        total: totalCount,
        hasMore: totalCount > limit,
      },
    };
  }

  /**
   * Get provider profiles by their user IDs (for recently used providers)
   */
  private async getProvidersByIds(providerIds: string[], tenantObjectId: mongoose.Types.ObjectId): Promise<RecommendedPro[]> {
    if (providerIds.length === 0) return [];

    const objectIds = providerIds.map(id => new mongoose.Types.ObjectId(id));

    const providers = await ProviderProfile.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          userId: { $in: objectIds },
          isActive: true,
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $match: { userId: { $exists: true, $ne: null } } },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'services',
          let: { providerId: '$userId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$providerId', '$$providerId'] }, isActive: true } },
            { $limit: 5 },
            { $project: { name: 1, price: 1, category: 1 } },
          ],
          as: 'servicesData',
        },
      },
      {
        $lookup: {
          from: 'reviews',
          let: { providerId: '$userId' },
          // TENANT ISOLATION REQUIRED: Reviews aggregation MUST filter by tenantId
          // to ensure data isolation between tenants. The tenantId filter prevents
          // cross-tenant data leakage in multi-tenant deployments.
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$revieweeId', '$$providerId'] },
                tenantId: tenantObjectId, // CRITICAL: Enforce tenant isolation
              },
            },
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
              },
            },
          ],
          as: 'reviewsData',
        },
      },
      { $unwind: { path: '$reviewsData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          avatar: '$user.avatar',
          businessName: '$businessInfo.businessName',
          bio: '$instagramStyleProfile.bio',
          averageRating: { $ifNull: ['$reviewsData.averageRating', 0] },
          totalReviews: { $ifNull: ['$reviewsData.totalReviews', 0] },
          completedJobs: '$analytics.bookingStats.completedBookings',
          services: '$servicesData',
          isVerified: '$instagramStyleProfile.isVerified',
          tier: 1,
        },
      },
    ]);

    return providers.map(p => ({
      _id: p._id,
      userId: p.userId,
      firstName: p.firstName,
      lastName: p.lastName,
      avatar: p.avatar,
      businessName: p.businessName,
      bio: p.bio,
      averageRating: Math.round((p.averageRating || 0) * 10) / 10,
      totalReviews: p.totalReviews || 0,
      completedJobs: p.completedJobs || 0,
      score: 0, // Recently used providers don't need a score
      services: p.services || [],
      isVerified: p.isVerified || false,
      tier: p.tier || 'standard',
    }));
  }

  /**
   * Get service packages (public packages for customers)
   * Queries Bundle model and transforms data to match frontend expectations
   * Uses Redis caching with 10-minute TTL for performance
   */
  async getServicePackages(
    tenantId: string,
    options: {
      category?: string;
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      sortBy?: 'price' | 'price_desc' | 'rating' | 'popularity';
      page?: number;
      limit?: number;
      isFeatured?: boolean;
    } = {}
  ): Promise<{
    packages: ServicePackage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        category,
        search,
        minPrice,
        maxPrice,
        sortBy = 'popularity',
        page = 1,
        limit = 20,
        isFeatured,
      } = options;

      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }

      const normalizedSearch = search?.trim();

      // Create cache key from tenantId and normalized options (excluding page for base data)
      const cacheOptions = { category, search: normalizedSearch, minPrice, maxPrice, sortBy, limit, isFeatured };
      const cacheKey = getPackagesCacheKey(tenantId, cacheOptions);

      // Try to get from cache first
      try {
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
          logger.debug('Cache hit for service packages', { tenantId, cacheKey });
          const parsed = JSON.parse(cachedData);
          // Return cached data with page applied
          return {
            packages: parsed.packages || [],
            pagination: {
              ...parsed.pagination,
              page,
            },
          };
        }
      } catch (error) {
        logger.warn('Failed to get service packages from cache', {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.debug('Cache miss for service packages, fetching from Bundle database', { tenantId, cacheKey });

      const skip = (page - 1) * limit;
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Build query for Bundle model
      const query: any = {
        tenantId: tenantObjectId,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      };

      if (category) {
        // Filter by categoryId if it's a valid ObjectId, otherwise use tags
        if (mongoose.Types.ObjectId.isValid(category)) {
          query.categoryId = new mongoose.Types.ObjectId(category);
        } else {
          query.tags = new RegExp(category, 'i');
        }
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        query.bundlePrice = {};
        if (minPrice !== undefined) query.bundlePrice.$gte = minPrice;
        if (maxPrice !== undefined) query.bundlePrice.$lte = maxPrice;
      }

      if (isFeatured !== undefined) {
        query.isFeatured = isFeatured;
      }

      // Build sort order
      let sort: any = {};
      switch (sortBy) {
        case 'price':
          sort = { bundlePrice: 1 };
          break;
        case 'price_desc':
          sort = { bundlePrice: -1 };
          break;
        case 'rating':
          sort = { 'rating.average': -1 };
          break;
        case 'popularity':
        default:
          sort = { redemptionsUsed: -1 };
          break;
      }

      // Query Bundle collection directly with provider and category population
      const bundleQuery = Bundle.find(query)
        .populate({
          path: 'providerId',
          select: 'firstName lastName businessName avatar instagramStyleProfile verificationStatus',
        })
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const bundles = await bundleQuery.exec();
      const totalCount = await Bundle.countDocuments(query);

      // Transform Bundle data to match frontend ServicePackage format
      const packages = bundles.map((bundle: any) => {
        const serviceNames = (bundle.services || []).map((s: any) => s.serviceName).join(', ');

        // Extract provider data
        const providerData = bundle.providerId || {};
        const providerId = typeof bundle.providerId === 'object'
          ? providerData._id?.toString()
          : bundle.providerId?.toString() || bundle.createdBy?.toString();

        // Check if provider is verified (from populated provider profile or bundle createdBy)
        let isVerified = false;
        let providerFirstName = '';
        let providerLastName = '';
        let providerBusinessName = '';

        if (typeof bundle.providerId === 'object' && providerData) {
          // Provider profile is populated - extract real data
          providerFirstName = providerData.firstName || '';
          providerLastName = providerData.lastName || '';
          providerBusinessName = providerData.businessName || '';
          // Check verification status
          isVerified = providerData.instagramStyleProfile?.isVerified ||
            providerData.verificationStatus?.overall === 'approved' ||
            providerData.verificationStatus?.overall === 'verified';
        } else if (bundle.createdBy) {
          // Try to get provider info from createdBy
          providerFirstName = 'Provider';
        }

        // Get category name from tags or fallback to 'general'
        const categoryName = (Array.isArray(bundle.tags) && bundle.tags[0]) ||
          bundle.tags ||
          'general';

        return {
          _id: bundle._id.toString(),
          name: bundle.name,
          description: bundle.description,
          category: typeof categoryName === 'string' ? categoryName : 'general',
          basePrice: bundle.originalPrice,
          discountedPrice: bundle.bundlePrice,
          pricing: {
            originalPrice: bundle.originalPrice,
            currentPrice: bundle.bundlePrice,
            currency: DEFAULT_CURRENCY,
            type: 'fixed' as const,
          },
          duration: {
            totalMinutes: (bundle.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0),
            formatted: `${(bundle.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0)} min`,
          },
          durationLabel: `${(bundle.services || []).length} services`,
          features: (bundle.services || []).map((s: any) => ({ name: s.serviceName, included: true })),
          services: (bundle.services || []).map((s: any) => ({
            _id: s.serviceId,
            name: s.serviceName, // Map serviceName to name for frontend compatibility
            serviceName: s.serviceName, // Keep original for backward compatibility
            // Include duration if available, otherwise use default (60 min per service)
            duration: s.duration || 60,
            // Ensure price is available as both originalPrice and price for compatibility
            price: s.originalPrice || s.price || 0,
            originalPrice: s.originalPrice,
            description: s.description,
          })),
          images: bundle.images || (bundle.image ? [bundle.image] : []),
          includedItems: (bundle.services || []).map((s: any) => s.serviceName),
          addOns: [],
          provider: {
            _id: providerId || '',
            firstName: providerFirstName,
            lastName: providerLastName,
            businessName: providerBusinessName,
            isVerified: isVerified,
          },
          providerName: providerBusinessName || `${providerFirstName} ${providerLastName}`.trim() || 'Service Provider',
          providerId: providerId || '',
          stats: {
            rating: Math.round((bundle.rating?.average || 4.0) * 10) / 10,
            reviewCount: bundle.rating?.count || 0,
            totalPurchases: bundle.redemptionsUsed || 0,
          },
          averageRating: Math.round((bundle.rating?.average || 4.0) * 10) / 10,
          totalReviews: bundle.rating?.count || 0,
          isPopular: (bundle.redemptionsUsed || 0) > 10,
          isFeatured: bundle.isFeatured || false,
          isActive: bundle.isActive,
          validity: { days: 30 },
          savingsAmount: bundle.savingsAmount || 0,
          savingsPercentage: bundle.savingsPercentage || 0,
          serviceCount: (bundle.services || []).length,
          serviceNames: serviceNames,
          tags: bundle.tags || [],
          image: bundle.image,
          createdAt: bundle.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: bundle.updatedAt?.toISOString() || new Date().toISOString(),
        };
      });

      const result = {
        packages,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      };

      // Store in cache (only cache first page for efficient memory usage)
      if (page === 1) {
        try {
          await cache.set(cacheKey, JSON.stringify(result), PACKAGES_CACHE_TTL);
          logger.debug('Bundle packages cached', { tenantId, cacheKey, ttl: PACKAGES_CACHE_TTL });
        } catch (error) {
          logger.warn('Failed to cache bundle packages', {
            tenantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch bundle packages', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch service packages');
    }
  }

  /**
   * Get a single service package by ID (from Bundle collection)
   */
  async getPackageById(packageId: string, tenantId: string): Promise<{
    package: ServicePackage;
    reviews: Array<{
      _id: string;
      user: { name: string; avatar?: string };
      rating: number;
      comment: string;
      createdAt: Date;
    }>;
  } | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      if (!mongoose.Types.ObjectId.isValid(packageId)) {
        throw new ApiError(400, 'Invalid package ID format');
      }
      const packageObjectId = new mongoose.Types.ObjectId(packageId);

      // Query Bundle collection (where packages are actually stored)
      const bundle = await Bundle.findOne({
        _id: packageObjectId,
        tenantId: tenantObjectId,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      })
        .populate({
          path: 'providerId',
          select: 'firstName lastName businessName avatar instagramStyleProfile verificationStatus',
        })
        .exec();

      if (!bundle) {
        return null;
      }

      // Transform Bundle to ServicePackage format (aligned with getServicePackages)
      const serviceNames = (bundle.services || []).map((s: any) => s.serviceName).join(', ');
      const totalDuration = (bundle.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);

      // Extract provider data
      const providerData: any = bundle.providerId && typeof bundle.providerId === 'object' && '_id' in bundle.providerId
        ? bundle.providerId
        : {};
      const providerId = typeof bundle.providerId === 'object' && bundle.providerId !== null && '_id' in (bundle.providerId as object)
        ? (providerData._id as mongoose.Types.ObjectId)?.toString()
        : bundle.providerId?.toString() || bundle.createdBy?.toString() || '';

      // Check if provider is verified
      let isVerified = false;
      let providerFirstName = '';
      let providerLastName = '';
      let providerBusinessName = '';

      if (typeof bundle.providerId === 'object' && bundle.providerId !== null && '_id' in (bundle.providerId as object)) {
        providerFirstName = providerData.firstName || '';
        providerLastName = providerData.lastName || '';
        providerBusinessName = providerData.businessName || '';
        isVerified = providerData.instagramStyleProfile?.isVerified ||
          providerData.verificationStatus?.overall === 'approved' ||
          providerData.verificationStatus?.overall === 'verified';
      } else if (bundle.createdBy) {
        providerFirstName = 'Provider';
      }

      const providerName = providerBusinessName || `${providerFirstName} ${providerLastName}`.trim() || 'Service Provider';

      // Category from tags (same as list endpoint — categoryId ref was broken: no Category model)
      const categoryName = (Array.isArray(bundle.tags) && bundle.tags[0]) ||
        bundle.tags ||
        'general';

      const formattedPackage: ServicePackage = {
        _id: bundle._id as mongoose.Types.ObjectId,
        name: bundle.name,
        description: bundle.description,
        category: typeof categoryName === 'string' ? categoryName : 'general',
        basePrice: bundle.originalPrice,
        discountedPrice: bundle.bundlePrice,
        pricing: {
          originalPrice: bundle.originalPrice,
          currentPrice: bundle.bundlePrice,
          currency: bundle.currency || DEFAULT_CURRENCY,
          type: 'fixed' as const,
        },
        duration: {
          totalMinutes: totalDuration,
          formatted: this.formatDuration(totalDuration),
        },
        durationLabel: `${(bundle.services || []).length} services`,
        features: (bundle.services || []).map((s: any) => ({ name: s.serviceName, included: true })),
        services: (bundle.services || []).map((s: any) => {
          const sid = s.serviceId?.toString?.() || String(s.serviceId || '');
          return {
            _id: sid,
            serviceId: sid,
            name: s.serviceName,
            serviceName: s.serviceName,
            duration: s.duration || 60,
            price: s.originalPrice || s.price || 0,
            originalPrice: s.originalPrice,
            description: s.description,
          };
        }),
        images: bundle.images || (bundle.image ? [bundle.image] : []),
        includedItems: bundle.services?.map((s: any) => s.serviceName) || [],
        addOns: [],
        provider: {
          _id: providerId || '',
          firstName: providerFirstName,
          lastName: providerLastName,
          businessName: providerBusinessName,
          isVerified: isVerified,
        },
        providerName,
        providerId: providerId || '',
        averageRating: bundle.rating?.average
          ? Math.round(bundle.rating.average * 10) / 10
          : 0,
        totalReviews: bundle.rating?.count || 0,
        isPopular: (bundle.redemptionsUsed || 0) > 10,
        isFeatured: bundle.isFeatured || false,
      };

      const reviewDocs = await Review.find({
        serviceId: packageObjectId,
        moderationStatus: 'approved',
        isHidden: { $ne: true },
      })
        .populate('reviewerId', 'firstName lastName avatar name')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      const reviews = reviewDocs.map((r: any) => {
        const reviewer = r.reviewerId || {};
        const reviewerName =
          reviewer.name ||
          [reviewer.firstName, reviewer.lastName].filter(Boolean).join(' ') ||
          'Customer';
        return {
          _id: r._id.toString(),
          user: { name: reviewerName, avatar: reviewer.avatar },
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        };
      });

      if (reviews.length > 0) {
        formattedPackage.totalReviews = reviews.length;
        formattedPackage.averageRating =
          Math.round((reviews.reduce((sum, rv) => sum + rv.rating, 0) / reviews.length) * 10) / 10;
      }

      const packageWithExtras = {
        ...formattedPackage,
        providerAvatar: providerData.avatar || undefined,
        isActive: bundle.isActive,
        terms: bundle.terms,
        savingsAmount: bundle.savingsAmount,
        savingsPercentage: bundle.savingsPercentage,
      };

      return {
        package: packageWithExtras as ServicePackage,
        reviews,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching package by ID', {
        context: 'CustomerDashboard',
        packageId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch package details');
    }
  }

  /**
   * Get featured service packages for homepage carousel
   * Queries Bundle collection (where packages are actually stored)
   * Uses Redis caching with 10-minute TTL for performance
   */
  async getFeaturedPackages(
    tenantId: string,
    options: {
      limit?: number;
      category?: string;
    } = {}
  ): Promise<{
    packages: ServicePackage[];
    total: number;
  }> {
    try {
      const { limit = 10, category } = options;

      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        throw new ApiError(400, 'Invalid tenant ID format');
      }

      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Create cache key
      const cacheKey = getFeaturedPackagesCacheKey(tenantId, category);

      // Try to get from cache first
      try {
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
          logger.debug('Cache hit for featured packages', { tenantId, cacheKey });
          return JSON.parse(cachedData);
        }
      } catch (error) {
        logger.warn('Failed to get featured packages from cache', {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.debug('Cache miss for featured packages, fetching from Bundle database', { tenantId, cacheKey });

      // Build query for Bundle model - featured packages
      const query: any = {
        tenantId: tenantObjectId,
        isActive: true,
        isFeatured: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      };

      if (category) {
        // Filter by categoryId if it's a valid ObjectId, otherwise use tags
        if (mongoose.Types.ObjectId.isValid(category)) {
          query.categoryId = new mongoose.Types.ObjectId(category);
        } else {
          query.tags = new RegExp(category, 'i');
        }
      }

      // Query Bundle collection with populated provider and category data
      const bundles = await Bundle.find(query)
        .populate({
          path: 'providerId',
          select: 'firstName lastName businessName avatar instagramStyleProfile verificationStatus',
        })
        .sort({ 'rating.average': -1, redemptionsUsed: -1 })
        .limit(limit)
        .exec();

      // Transform Bundle data to match frontend ServicePackage format
      const packages = bundles.map((bundle: any) => {
        const serviceNames = (bundle.services || []).map((s: any) => s.serviceName).join(', ');

        // Extract provider data
        const providerData = bundle.providerId || {};
        const providerId = typeof bundle.providerId === 'object'
          ? providerData._id?.toString()
          : bundle.providerId?.toString() || bundle.createdBy?.toString();

        // Check if provider is verified
        let isVerified = false;
        let providerFirstName = '';
        let providerLastName = '';
        let providerBusinessName = '';

        if (typeof bundle.providerId === 'object' && providerData) {
          providerFirstName = providerData.firstName || '';
          providerLastName = providerData.lastName || '';
          providerBusinessName = providerData.businessName || '';
          isVerified = providerData.instagramStyleProfile?.isVerified ||
            providerData.verificationStatus?.overall === 'approved' ||
            providerData.verificationStatus?.overall === 'verified';
        } else if (bundle.createdBy) {
          providerFirstName = 'Provider';
        }

        // Get category name from tags or fallback
        const categoryName = (Array.isArray(bundle.tags) && bundle.tags[0]) ||
          bundle.tags ||
          'general';

        const totalDuration = (bundle.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);

        return {
          _id: bundle._id.toString(),
          name: bundle.name,
          description: bundle.description,
          category: typeof categoryName === 'string' ? categoryName : 'general',
          basePrice: bundle.originalPrice,
          discountedPrice: bundle.bundlePrice,
          pricing: {
            originalPrice: bundle.originalPrice,
            currentPrice: bundle.bundlePrice,
            currency: DEFAULT_CURRENCY,
            type: 'fixed' as const,
          },
          duration: {
            totalMinutes: totalDuration,
            formatted: this.formatDuration(totalDuration),
          },
          durationLabel: `${(bundle.services || []).length} services`,
          features: (bundle.services || []).map((s: any) => ({ name: s.serviceName, included: true })),
          services: (bundle.services || []).map((s: any) => ({
            _id: s.serviceId,
            name: s.serviceName,
            serviceName: s.serviceName,
            duration: s.duration || 60,
            price: s.originalPrice || s.price || 0,
            originalPrice: s.originalPrice,
            description: s.description,
          })),
          images: bundle.images || (bundle.image ? [bundle.image] : []),
          includedItems: (bundle.services || []).map((s: any) => s.serviceName),
          addOns: [],
          provider: {
            _id: providerId || '',
            firstName: providerFirstName,
            lastName: providerLastName,
            businessName: providerBusinessName,
            isVerified: isVerified,
          },
          providerName: providerBusinessName || `${providerFirstName} ${providerLastName}`.trim() || 'Service Provider',
          providerId: providerId || '',
          stats: {
            rating: Math.round((bundle.rating?.average || 4.0) * 10) / 10,
            reviewCount: bundle.rating?.count || 0,
            totalPurchases: bundle.redemptionsUsed || 0,
          },
          averageRating: Math.round((bundle.rating?.average || 4.0) * 10) / 10,
          totalReviews: bundle.rating?.count || 0,
          isPopular: (bundle.redemptionsUsed || 0) > 10,
          isFeatured: true,
          isActive: bundle.isActive,
          validity: { days: 30 },
          savingsAmount: bundle.savingsAmount || 0,
          savingsPercentage: bundle.savingsPercentage || 0,
          serviceCount: (bundle.services || []).length,
          serviceNames: serviceNames,
          tags: bundle.tags || [],
          image: bundle.image,
          createdAt: bundle.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: bundle.updatedAt?.toISOString() || new Date().toISOString(),
        };
      });

      const result = {
        packages,
        total: packages.length,
      };

      // Store in cache
      try {
        await cache.set(cacheKey, JSON.stringify(result), FEATURED_PACKAGES_CACHE_TTL);
        logger.debug('Featured packages cached', { tenantId, cacheKey, ttl: FEATURED_PACKAGES_CACHE_TTL });
      } catch (error) {
        logger.warn('Failed to cache featured packages', {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to fetch featured packages', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new ApiError(500, 'Failed to fetch featured packages');
    }
  }

  /**
   * Format duration in minutes to human-readable string
   */
  private formatDuration(minutes: number): string {
    if (minutes <= 30) return '30 min';
    if (minutes <= 60) return '1 hour';
    if (minutes <= 90) return '1.5 hours';
    if (minutes <= 120) return '2 hours';
    return `${Math.round(minutes / 60)} hours`;
  }
}

// Export singleton instance
export const customerDashboardService = new CustomerDashboardService();

export default customerDashboardService;
