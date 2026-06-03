import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import Review from '../models/review.model';
import { ApiError } from '../utils/ApiError';

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
  services: Array<{ _id: string; name: string; duration: number; price: number }>;
  images: string[];
  includedItems: string[];
  addOns?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  providerName: string;
  providerId: mongoose.Types.ObjectId;
  averageRating: number;
  totalReviews: number;
  isPopular: boolean;
  isFeatured: boolean;
}

// ============================================
// Helper Functions
// ============================================

function formatBookingSummary(booking: any): BookingSummary {
  return {
    _id: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    duration: booking.duration,
    totalAmount: booking.pricing?.totalAmount || 0,
    currency: booking.pricing?.currency || 'AED',
    serviceName: booking.service?.name || 'Unknown Service',
    serviceCategory: booking.service?.category || 'General',
    providerName: booking.provider ? `${booking.provider.firstName} ${booking.provider.lastName || ''}`.trim() : 'Unknown Provider',
    providerId: booking.providerId,
    providerAvatar: booking.provider?.avatar,
    createdAt: booking.createdAt,
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
  }

  /**
   * Get recent bookings (last 5 bookings)
   */
  async getRecentBookings(customerId: string, tenantId: string, limit: number = 5): Promise<BookingSummary[]> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const bookings = await Booking.find({
      customerId: customerObjectId,
      tenantId: tenantObjectId,
      deletedAt: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('service', 'name category')
      .populate('providerId', 'firstName lastName avatar')
      .lean();

    return bookings.map(formatBookingSummary);
  }

  /**
   * Get upcoming bookings (next 3 confirmed/pending bookings)
   */
  async getUpcomingBookings(customerId: string, tenantId: string, limit: number = 3): Promise<BookingSummary[]> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const now = new Date();
    const bookings = await Booking.find({
      customerId: customerObjectId,
      tenantId: tenantObjectId,
      status: { $in: ['confirmed', 'pending'] },
      scheduledDate: { $gte: now },
      deletedAt: { $exists: false },
    })
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .limit(limit)
      .populate('service', 'name category')
      .populate('providerId', 'firstName lastName avatar')
      .lean();

    return bookings.map(formatBookingSummary);
  }

  /**
   * Get dashboard statistics
   */
  async getStats(customerId: string, tenantId: string): Promise<DashboardStats> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Aggregation pipeline for stats
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          customerId: customerObjectId,
          tenantId: tenantObjectId,
          scheduledDate: { $gte: thirtyDaysAgo },
          deletedAt: { $exists: false },
        },
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
    ]);

    // Get average rating from reviews given by customer
    const reviewStats = await Review.aggregate([
      {
        $match: {
          reviewerId: customerObjectId,
          tenantId: tenantObjectId,
          isHidden: false,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const stats = bookingStats[0] || {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalSpent: 0,
    };

    const reviews = reviewStats[0] || {
      averageRating: 0,
      totalReviews: 0,
    };

    return {
      totalBookings: stats.totalBookings || 0,
      completedBookings: stats.completedBookings || 0,
      cancelledBookings: stats.cancelledBookings || 0,
      totalSpent: Math.round((stats.totalSpent || 0) * 100) / 100,
      averageRating: Math.round((reviews.averageRating || 0) * 10) / 10,
      averageOrderValue: stats.completedCount > 0
        ? Math.round((stats.totalSpent / stats.completedCount) * 100) / 100
        : 0,
    };
  }

  /**
   * Get loyalty points data
   */
  async getLoyaltyData(customerId: string, tenantId: string): Promise<LoyaltyData> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
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
  }

  /**
   * Get streak data
   */
  async getStreakData(customerId: string, tenantId: string): Promise<StreakData> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
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

    const { streakDays, lastStreakDate } = user.loyaltySystem;

    // Calculate longest streak from booking history
    const bookingDates = await Booking.aggregate([
      {
        $match: {
          customerId: customerObjectId,
          tenantId: tenantObjectId,
          status: 'completed',
          deletedAt: { $exists: false },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$completedAt', '$createdAt'] } },
          },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    let longestStreak = streakDays || 0;
    let currentStreakCount = 0;
    let prevDate: Date | null = null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const entry of bookingDates) {
      const date = new Date(entry._id);

      if (!prevDate) {
        // First entry - start counting if it's today or yesterday
        const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) {
          currentStreakCount = 1;
        }
      } else {
        const daysDiff = Math.floor((prevDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          currentStreakCount++;
        } else {
          break; // Streak broken
        }
      }

      prevDate = date;
    }

    longestStreak = Math.max(longestStreak, currentStreakCount, bookingDates.length > 0 ? currentStreakCount : 0);

    return {
      currentStreak: currentStreakCount,
      longestStreak,
      lastActivityDate: lastStreakDate,
      totalActiveDays: bookingDates.length,
    };
  }

  /**
   * Get recent activity feed
   */
  async getActivityFeed(customerId: string, tenantId: string, limit: number = 20): Promise<ActivityItem[]> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
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
  }

  /**
   * Get recommended professionals based on user's booking history
   */
  async getRecommendedPros(customerId: string, tenantId: string, limit: number = 10): Promise<RecommendedPro[]> {
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Get user's preferred service categories from booking history
    const preferredCategories = await Booking.aggregate([
      {
        $match: {
          customerId: customerObjectId,
          tenantId: tenantObjectId,
          status: 'completed',
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
      { $limit: 3 },
    ]);

    const preferredCategoryNames = preferredCategories.map(c => c._id);

    // Get providers the user has booked before (for "book again" recommendations)
    const previouslyBookedProviders = await Booking.distinct('providerId', {
      customerId: customerObjectId,
      tenantId: tenantObjectId,
      deletedAt: { $exists: false },
    });

    // Get top-rated providers with matching categories
    const matchCondition = preferredCategoryNames.length > 0
      ? { 'services.category': { $in: preferredCategoryNames } }
      : {};

    const providers = await ProviderProfile.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          isActive: true,
          isDeleted: false,
          'verificationStatus.overall': 'approved',
          ...matchCondition,
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
          localField: 'userId',
          foreignField: 'providerId',
          as: 'servicesData',
        },
      },
      // Filter out providers user has already booked (unless we want "book again" suggestions)
      // For now, we'll include them but could filter with: userId: { $nin: previouslyBookedProviders }
      {
        $project: {
          _id: 1,
          userId: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          avatar: '$user.avatar',
          businessName: '$businessInfo.businessName',
          bio: '$instagramStyleProfile.bio',
          averageRating: '$reviewsData.averageRating',
          totalReviews: '$reviewsData.totalReviews',
          completedJobs: '$analytics.bookingStats.completedBookings',
          services: {
            $slice: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: '$servicesData',
                      as: 's',
                      cond: { $eq: ['$$s.isActive', true] },
                    },
                  },
                  as: 'service',
                  in: {
                    name: '$$service.name',
                    price: '$$service.price.amount',
                    category: '$$service.category',
                  },
                },
              },
              5,
            ],
          },
          isVerified: '$instagramStyleProfile.isVerified',
          tier: 1,
          score: {
            $add: [
              { $multiply: [{ $ifNull: ['$reviewsData.averageRating', 0] }, 20] }, // Rating weight
              { $multiply: [{ $cond: ['$instagramStyleProfile.isVerified', 10, 0] }] }, // Verified bonus
              { $multiply: ['$completionPercentage', 0.1] }, // Profile completion bonus
            ],
          },
        },
      },
      { $sort: { score: -1, averageRating: -1 } },
      { $limit: limit },
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
      services: p.services || [],
      isVerified: p.isVerified || false,
      tier: p.tier || 'standard',
    }));
  }

  /**
   * Get service packages (public packages for customers)
   */
  async getServicePackages(
    tenantId: string,
    options: {
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      sortBy?: 'price' | 'rating' | 'popularity';
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
    const {
      category,
      minPrice,
      maxPrice,
      sortBy = 'popularity',
      page = 1,
      limit = 20,
      isFeatured,
    } = options;

    const skip = (page - 1) * limit;

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Build query
    const query: any = {
      tenantId: tenantObjectId,
      isActive: true,
      'services.isActive': true,
    };

    if (category) {
      query['services.category'] = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query['services.price.amount'] = {};
      if (minPrice !== undefined) query['services.price.amount'].$gte = minPrice;
      if (maxPrice !== undefined) query['services.price.amount'].$lte = maxPrice;
    }

    if (isFeatured !== undefined) {
      query['services.isFeatured'] = isFeatured;
    }

    // Determine sort order
    let sort: any = {};
    switch (sortBy) {
      case 'price':
        sort = { 'services.price.amount': 1 };
        break;
      case 'rating':
        sort = { 'reviewsData.averageRating': -1 };
        break;
      case 'popularity':
      default:
        sort = { 'analytics.bookingStats.completedBookings': -1 };
        break;
    }

    // Fetch providers with their packages
    const [providers, total] = await Promise.all([
      ProviderProfile.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $unwind: '$services' },
        {
          $match: {
            'services.isActive': true,
            ...(category ? { 'services.category': category } : {}),
          },
        },
        {
          $project: {
            serviceId: '$services._id',
            name: '$services.name',
            description: '$services.description',
            category: '$services.category',
            basePrice: '$services.price.amount',
            duration: '$services.duration',
            durationLabel: {
              $switch: {
                branches: [
                  { case: { $lte: ['$services.duration', 30] }, then: '30 min' },
                  { case: { $lte: ['$services.duration', 60] }, then: '1 hour' },
                  { case: { $lte: ['$services.duration', 90] }, then: '1.5 hours' },
                  { case: { $lte: ['$services.duration', 120] }, then: '2 hours' },
                ],
                default: {
                  $concat: [
                    { $toString: { $divide: ['$services.duration', 60] } },
                    ' hours',
                  ],
                },
              },
            },
            images: '$services.images',
            includedItems: '$services.includedItems',
            addOns: '$services.addOns',
            discounts: '$services.price.discounts',
            providerName: {
              $concat: ['$user.firstName', ' ', { $ifNull: ['$user.lastName', ''] }],
            },
            providerId: '$userId',
            averageRating: '$reviewsData.averageRating',
            totalReviews: '$reviewsData.totalReviews',
            isPopular: '$services.isPopular',
            isFeatured: '$services.isFeatured',
          },
        },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
      ]),
      ProviderProfile.aggregate([
        { $match: query },
        { $unwind: '$services' },
        {
          $match: {
            'services.isActive': true,
            ...(category ? { 'services.category': category } : {}),
          },
        },
        { $count: 'total' },
      ]),
    ]);

    const packages = providers.map((p: any) => {
      const basePrice = p.basePrice || 0;
      const discountMultiplier = p.discounts?.find((d: any) => d.type === 'loyalty')?.percentage / 100 || 1;
      const discountedPrice = basePrice > 100 && discountMultiplier < 1
        ? Math.round(basePrice * discountMultiplier * 100) / 100
        : basePrice;
      return {
        _id: p.serviceId,
        name: p.name,
        description: p.description,
        category: p.category,
        basePrice,
        discountedPrice,
        pricing: {
          originalPrice: basePrice,
          currentPrice: discountedPrice,
          currency: 'AED',
          type: 'fixed' as const,
        },
        duration: {
          totalMinutes: p.duration || 0,
          formatted: p.durationLabel || `${p.duration || 0} min`,
        },
        durationLabel: p.durationLabel,
        features: (p.includedItems || []).map((item: string) => ({ name: item, included: true })),
        services: [],
        images: p.images || [],
        includedItems: p.includedItems || [],
        addOns: p.addOns || [],
        providerName: p.providerName?.trim() || 'Unknown',
        providerId: p.providerId,
        averageRating: Math.round((p.averageRating || 0) * 10) / 10,
        totalReviews: p.totalReviews || 0,
        isPopular: p.isPopular || false,
        isFeatured: p.isFeatured || false,
      };
    });

    return {
      packages,
      pagination: {
        page,
        limit,
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / limit),
      },
    };
  }

  /**
   * Get a single service package by ID
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
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const packageObjectId = new mongoose.Types.ObjectId(packageId);

      // Find the service (package)
      const service = await Service.findOne({
        _id: packageObjectId,
        tenantId: tenantObjectId,
        isActive: true,
      })
        .populate('providerId', 'firstName lastName avatar')
        .lean();

      if (!service) {
        return null;
      }

      // Get provider profile for additional info
      const providerProfile = await ProviderProfile.findOne({
        userId: service.providerId,
        tenantId: tenantObjectId,
      }).lean();

      // Get reviews for this service
      const reviews = await Review.find({
        serviceId: packageObjectId,
        tenantId: tenantObjectId,
        isHidden: false,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('reviewerId', 'firstName lastName avatar')
        .lean();

      const basePrice = service.price?.amount || 0;
      const loyaltyDiscount = service.price?.discounts?.find((d: any) => d.type === 'loyalty');
      const discountMultiplier = (loyaltyDiscount?.percentage ?? 0) / 100 || 1;
      const discountedPrice = basePrice > 100 && discountMultiplier < 1
        ? Math.round(basePrice * discountMultiplier * 100) / 100
        : basePrice;

      const formattedPackage: ServicePackage = {
        _id: service._id as mongoose.Types.ObjectId,
        name: service.name,
        description: service.description,
        category: service.category,
        basePrice,
        discountedPrice,
        pricing: {
          originalPrice: basePrice,
          currentPrice: discountedPrice,
          currency: service.price?.currency || 'AED',
          type: (service.price?.type as 'fixed' | 'hourly' | 'custom') || 'fixed',
        },
        duration: {
          totalMinutes: service.duration || 0,
          formatted: this.formatDuration(service.duration || 0),
        },
        durationLabel: this.formatDuration(service.duration || 0),
        features: (service.includedItems || []).map(item => ({ name: item, included: true })),
        services: [],
        images: service.images || [],
        includedItems: service.includedItems || [],
        addOns: service.addOns || [],
        providerName: service.providerId
          ? `${(service.providerId as any).firstName || ''} ${(service.providerId as any).lastName || ''}`.trim()
          : 'Unknown',
        providerId: service.providerId as mongoose.Types.ObjectId,
        averageRating: providerProfile?.reviewsData?.averageRating || 0,
        totalReviews: providerProfile?.reviewsData?.totalReviews || 0,
        isPopular: service.isPopular || false,
        isFeatured: service.isFeatured || false,
      };

      const formattedReviews = reviews.map(review => ({
        _id: review._id.toString(),
        user: {
          name: review.reviewerId
            ? `${(review.reviewerId as any).firstName || ''} ${(review.reviewerId as any).lastName || ''}`.trim()
            : 'Anonymous',
          avatar: (review.reviewerId as any)?.avatar,
        },
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      }));

      return {
        package: formattedPackage,
        reviews: formattedReviews,
      };
    } catch (error) {
      console.error('Error fetching package by ID:', error);
      return null;
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
