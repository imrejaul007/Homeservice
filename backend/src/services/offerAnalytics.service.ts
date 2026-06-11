import mongoose, { Types } from 'mongoose';
import Coupon from '../models/coupon.model';
import OfferClaim from '../models/offerClaim.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Timezone utility for analytics
// Default to UTC, can be overridden via environment or request header
const getAnalyticsTimezone = (timezoneHeader?: string): number => {
  // Check if timezone header is provided (from request)
  if (timezoneHeader) {
    const offset = parseInt(timezoneHeader, 10);
    if (!isNaN(offset) && offset >= -12 && offset <= 14) {
      return offset; // Return hours offset
    }
  }
  // Fall back to environment variable or UTC
  return parseInt(process.env.OFFER_ANALYTICS_TIMEZONE || '0', 10);
};

// Helper to convert UTC date to local in aggregation
const toLocalDate = (dateField: string, timezoneOffset: number): any => {
  // MongoDB $add can add hours to convert UTC to local
  return {
    $add: [
      `$${dateField}`,
      { $multiply: [timezoneOffset * 60, 60 * 1000] } // Convert hours to milliseconds
    ]
  };
};

// ============================================
// Types
// ============================================

export interface OfferAnalytics {
  totalOffers: number;
  activeOffers: number;
  totalClaims: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  averageConversionRate: number;
  topOffers: OfferPerformance[];
  offersByType: Record<string, number>;
  offersByStatus: Record<string, number>;
}

export interface OfferPerformance {
  offerId: string;
  name: string;
  code: string;
  claims: number;
  redemptions: number;
  discountGiven: number;
  conversionRate: number;
  revenue: number;
  averageOrderValue: number;
}

export interface OfferTrend {
  date: string;
  claims: number;
  redemptions: number;
  revenue: number;
}

export interface ProviderOfferAnalytics {
  totalOffers: number;
  activeOffers: number;
  totalClaims: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  avgConversionRate: number;
  avgOrderValue: number;
}

export interface UserOfferAnalytics {
  totalClaims: number;
  totalRedemptions: number;
  totalDiscountUsed: number;
  activeClaims: number;
  expiredClaims: number;
  averageSavings: number;
  favoriteCategories: string[];
}

// ============================================
// Offer Analytics Service
// ============================================

export class OfferAnalyticsService {
  // ========================================
  // Global Analytics
  // ========================================

  /**
   * Get platform-wide offer analytics
   */
  async getGlobalAnalytics(dateRange?: {
    startDate: Date;
    endDate: Date;
  }): Promise<OfferAnalytics> {
    const matchStage: any = {};

    if (dateRange) {
      matchStage.createdAt = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    // Get offer counts
    const offerStats = await Coupon.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOffers: { $sum: 1 },
          activeOffers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
          avgConversion: { $avg: { $cond: [{ $gt: ['$maxUses', 0] }, { $divide: ['$currentUses', '$maxUses'] }, 0] } },
        },
      },
    ]);

    // Get claim statistics
    const claimMatch: any = {};
    if (dateRange) {
      claimMatch.claimedAt = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const claimStats = await OfferClaim.aggregate([
      { $match: claimMatch },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalRedemptions: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
          },
          totalDiscount: { $sum: '$discountAmount' },
        },
      },
    ]);

    // Get offers by type
    const offersByType = await Coupon.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get offers by status
    const offersByStatus = await Coupon.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$isActive',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get top performing offers with revenue calculation
    const topOffers = await Coupon.aggregate([
      { $match: { ...matchStage, isActive: true } },
      {
        $lookup: {
          from: 'offerclaims',
          localField: '_id',
          foreignField: 'offerId',
          as: 'claims',
        },
      },
      // Lookup bookings for revenue calculation
      {
        $lookup: {
          from: 'bookings',
          let: { couponCode: '$code' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$couponReservation.couponCode', '$$couponCode'] },
                    { $eq: ['$couponReservation.usedAt', { $type: 'date' }] },
                  ],
                },
              },
            },
            { $project: { 'pricing.totalAmount': 1, 'pricing.basePrice': 1 } },
          ],
          as: 'bookings',
        },
      },
      {
        $project: {
          offerId: '$_id',
          name: '$displayTitle',
          code: 1,
          claims: { $size: '$claims' },
          redemptions: {
            $size: {
              $filter: {
                input: '$claims',
                as: 'claim',
                cond: { $eq: ['$$claim.status', 'applied'] },
              },
            },
          },
          // FIX: Calculate discount from claims
          discountGiven: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$claims',
                    as: 'claim',
                    cond: { $eq: ['$$claim.status', 'applied'] },
                  },
                },
                as: 'claim',
                in: { $ifNull: ['$$claim.discountAmount', 0] },
              },
            },
          },
          // FIX: Calculate revenue from bookings
          totalRevenue: {
            $sum: {
              $map: {
                input: '$bookings',
                as: 'booking',
                in: { $ifNull: ['$$booking.pricing.totalAmount', 0] },
              },
            },
          },
          averageOrderValue: {
            $cond: [
              { $gt: [{ $size: '$bookings' }, 0] },
              {
                $divide: [
                  {
                    $sum: {
                      $map: {
                        input: '$bookings',
                        as: 'booking',
                        in: { $ifNull: ['$$booking.pricing.totalAmount', 0] },
                      },
                    },
                  },
                  { $size: '$bookings' },
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $gt: ['$claims', 0] },
              { $multiply: [{ $divide: ['$redemptions', '$claims'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { redemptions: -1 } },
      { $limit: 10 },
    ]);

    return {
      totalOffers: offerStats[0]?.totalOffers || 0,
      activeOffers: offerStats[0]?.activeOffers || 0,
      totalClaims: claimStats[0]?.totalClaims || 0,
      totalRedemptions: claimStats[0]?.totalRedemptions || 0,
      // FIX: Calculate total discount from all applied claims
      totalDiscountGiven: claimStats[0]?.totalDiscount || topOffers.reduce((sum, o) => sum + (o.discountGiven || 0), 0),
      averageConversionRate: offerStats[0]?.avgConversion || 0,
      topOffers: topOffers.map((o) => ({
        offerId: o.offerId.toString(),
        name: o.name || o.code,
        code: o.code,
        claims: o.claims,
        redemptions: o.redemptions,
        discountGiven: o.discountGiven || 0,
        conversionRate: o.conversionRate || 0,
        // FIX: Now properly calculated from booking data
        revenue: o.totalRevenue || 0,
        averageOrderValue: o.averageOrderValue || 0,
      })),
      offersByType: offersByType.reduce((acc, o) => {
        acc[o._id || 'unknown'] = o.count;
        return acc;
      }, {} as Record<string, number>),
      offersByStatus: {
        active: offersByStatus.find((o) => o._id === true)?.count || 0,
        inactive: offersByStatus.find((o) => o._id === false)?.count || 0,
      },
    };
  }

  /**
   * Get offer trend over time
   */
  async getOfferTrends(
    period: 'day' | 'week' | 'month' = 'month',
    days = 30
  ): Promise<OfferTrend[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let groupFormat: string;
    switch (period) {
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-W%V';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
    }

    const trends = await OfferClaim.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$claimedAt' } },
          claims: { $sum: 1 },
          redemptions: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
          },
          revenue: { $sum: '$discountAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return trends.map((t) => ({
      date: t._id,
      claims: t.claims,
      redemptions: t.redemptions,
      revenue: t.revenue || 0,
    }));
  }

  // ========================================
  // Single Offer Analytics
  // ========================================

  /**
   * Get analytics for a single offer
   */
  async getOfferAnalytics(offerId: string): Promise<{
    totalClaims: number;
    totalRedemptions: number;
    redemptionRate: number;
    averageDiscount: number;
    totalDiscountGiven: number;
    popularDays: Array<{ day: string; count: number }>;
    popularHours: Array<{ hour: number; count: number }>;
    trends: OfferTrend[];
  }> {
    // FIX: Validate ObjectId format before using in aggregation
    if (!Types.ObjectId.isValid(offerId)) {
      throw ApiError.badRequest('Invalid offer ID');
    }

    const offer = await Coupon.findById(offerId);
    if (!offer) {
      throw ApiError.notFound('Offer not found');
    }

    // Get claim stats
    const claimStats = await OfferClaim.aggregate([
      { $match: { offerId: new Types.ObjectId(offerId) } },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalRedemptions: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
          },
          totalDiscount: { $sum: '$discountAmount' },
          avgDiscount: { $avg: '$discountAmount' },
        },
      },
    ]);

    // Get popular days with timezone awareness
    const timezoneOffset = getAnalyticsTimezone();
    const popularDays = await OfferClaim.aggregate([
      { $match: { offerId: new Types.ObjectId(offerId) } },
      {
        $group: {
          _id: { $dayOfWeek: { $add: ['$claimedAt', timezoneOffset * 60 * 60 * 1000] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formattedDays = popularDays.map((d) => ({
      day: dayNames[d._id - 1] || 'Unknown',
      count: d.count,
    }));

    // Get popular hours with timezone awareness
    const popularHours = await OfferClaim.aggregate([
      { $match: { offerId: new Types.ObjectId(offerId) } },
      {
        $group: {
          _id: { $hour: { $add: ['$claimedAt', timezoneOffset * 60 * 60 * 1000] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get trends
    const trends = await OfferClaim.aggregate([
      {
        $match: {
          offerId: new Types.ObjectId(offerId),
          claimedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$claimedAt' } },
          claims: { $sum: 1 },
          redemptions: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
          },
          revenue: { $sum: '$discountAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const stats = claimStats[0] || { totalClaims: 0, totalRedemptions: 0, totalDiscount: 0, avgDiscount: 0 };

    return {
      totalClaims: stats.totalClaims,
      totalRedemptions: stats.totalRedemptions,
      redemptionRate: stats.totalClaims > 0 ? (stats.totalRedemptions / stats.totalClaims) * 100 : 0,
      averageDiscount: stats.avgDiscount || 0,
      totalDiscountGiven: stats.totalDiscount || 0,
      popularDays: formattedDays,
      popularHours: popularHours.map((h) => ({ hour: h._id, count: h.count })),
      trends: trends.map((t) => ({
        date: t._id,
        claims: t.claims,
        redemptions: t.redemptions,
        revenue: t.revenue || 0,
      })),
    };
  }

  // ========================================
  // Provider Analytics
  // ========================================

  /**
   * Get analytics for a provider's offers
   */
  async getProviderAnalytics(providerId: string): Promise<ProviderOfferAnalytics> {
    // Get offers by this provider
    const providerOffers = await Coupon.find({
      createdBy: new Types.ObjectId(providerId),
    }).select('_id');

    const offerIds = providerOffers.map((o) => o._id);

    if (offerIds.length === 0) {
      return {
        totalOffers: 0,
        activeOffers: 0,
        totalClaims: 0,
        totalRedemptions: 0,
        totalDiscountGiven: 0,
        avgConversionRate: 0,
        avgOrderValue: 0,
      };
    }

    // Get claim statistics
    const claimStats = await OfferClaim.aggregate([
      { $match: { offerId: { $in: offerIds } } },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalRedemptions: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
          },
          totalDiscount: { $sum: '$discountAmount' },
        },
      },
    ]);

    // Get offer stats
    const offerStats = await Coupon.aggregate([
      { $match: { _id: { $in: offerIds } } },
      {
        $group: {
          _id: null,
          totalOffers: { $sum: 1 },
          activeOffers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = claimStats[0] || { totalClaims: 0, totalRedemptions: 0, totalDiscount: 0 };
    const offerData = offerStats[0] || { totalOffers: 0, activeOffers: 0 };

    return {
      totalOffers: offerData.totalOffers,
      activeOffers: offerData.activeOffers,
      totalClaims: stats.totalClaims,
      totalRedemptions: stats.totalRedemptions,
      totalDiscountGiven: stats.totalDiscount || 0,
      avgConversionRate: stats.totalClaims > 0 ? (stats.totalRedemptions / stats.totalClaims) * 100 : 0,
      avgOrderValue: stats.totalRedemptions > 0 ? 0 : 0, // Would need booking data
    };
  }

  // ========================================
  // User Analytics
  // ========================================

  /**
   * Get analytics for a user's offer activity
   */
  async getUserAnalytics(userId: string): Promise<UserOfferAnalytics> {
    const userObjectId = new Types.ObjectId(userId);

    // Get user claims
    const claims = await OfferClaim.find({ userId: userObjectId }).populate('offerId');

    const now = new Date();

    const activeClaims = claims.filter(
      (c) => c.status === 'claimed' && c.expiresAt && c.expiresAt > now
    );
    const expiredClaims = claims.filter(
      (c) => c.status === 'claimed' && c.expiresAt && c.expiresAt <= now
    );
    const redeemedClaims = claims.filter((c) => c.status === 'applied');

    // Calculate total discount
    const totalDiscountUsed = redeemedClaims.reduce((sum, c) => sum + ((c as any).discountAmount || 0), 0);

    // Get favorite categories
    const categoryCounts: Record<string, number> = {};
    claims.forEach((claim) => {
      if ((claim.offerId as any)?.category) {
        const category = (claim.offerId as any).category;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });

    const favoriteCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    return {
      totalClaims: claims.length,
      totalRedemptions: redeemedClaims.length,
      totalDiscountUsed,
      activeClaims: activeClaims.length,
      expiredClaims: expiredClaims.length,
      averageSavings: redeemedClaims.length > 0 ? totalDiscountUsed / redeemedClaims.length : 0,
      favoriteCategories,
    };
  }

  // ========================================
  // Admin Analytics
  // ========================================

  /**
   * Get dashboard summary for admin
   */
  async getAdminDashboard(): Promise<{
    summary: {
      totalOffers: number;
      activeOffers: number;
      totalClaims: number;
      totalRedemptions: number;
      totalDiscountGiven: number;
      avgConversionRate: number;
    };
    topPerformers: OfferPerformance[];
    recentActivity: Array<{
      type: string;
      offerCode: string;
      userId: string;
      timestamp: Date;
      discount: number;
    }>;
    expiringSoon: Array<{
      offerId: string;
      code: string;
      name: string;
      expiresAt: Date;
      remainingUses: number;
    }>;
  }> {
    // Get summary
    const analytics = await this.getGlobalAnalytics();

    // Get top performers
    const topPerformers = analytics.topOffers;

    // Get recent activity
    const recentClaims = await OfferClaim.find()
      .sort({ claimedAt: -1 })
      .limit(10)
      .populate('offerId', 'code displayTitle');

    const recentActivity = recentClaims.map((claim) => ({
      type: claim.status === 'applied' ? 'redemption' : 'claim',
      offerCode: (claim.offerId as any)?.code || claim.couponCode,
      userId: claim.userId.toString(),
      timestamp: claim.claimedAt,
      discount: (claim as any).discountAmount || 0,
    }));

    // Get offers expiring soon (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringSoon = await Coupon.find({
      isActive: true,
      validUntil: {
        $gte: new Date(),
        $lte: sevenDaysFromNow,
      },
    })
      .select('code displayTitle validUntil maxUses currentUses')
      .sort({ validUntil: 1 })
      .limit(5);

    const expiringOffers = expiringSoon.map((offer) => ({
      offerId: offer._id.toString(),
      code: offer.code,
      name: offer.displayTitle || offer.code,
      expiresAt: offer.validUntil!,
      remainingUses: offer.maxUses - offer.currentUses,
    }));

    return {
      summary: {
        totalOffers: analytics.totalOffers,
        activeOffers: analytics.activeOffers,
        totalClaims: analytics.totalClaims,
        totalRedemptions: analytics.totalRedemptions,
        totalDiscountGiven: analytics.totalDiscountGiven,
        avgConversionRate: analytics.averageConversionRate,
      },
      topPerformers,
      recentActivity,
      expiringSoon: expiringOffers,
    };
  }

  /**
   * Get offers requiring attention (low usage, expiring, etc.)
   */
  async getOffersRequiringAttention(): Promise<{
    underperforming: Array<{ offerId: string; code: string; name: string; claims: number }>;
    expiringSoon: Array<{ offerId: string; code: string; name: string; daysRemaining: number }>;
    nearlyExhausted: Array<{ offerId: string; code: string; name: string; remainingUses: number }>;
  }> {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Get all active offers
    const activeOffers = await Coupon.find({ isActive: true });

    const offerAnalytics = await Promise.all(
      activeOffers.map(async (offer) => {
        const claims = await OfferClaim.countDocuments({ offerId: offer._id });
        return {
          offerId: offer._id.toString(),
          code: offer.code,
          name: offer.displayTitle || offer.code,
          claims,
          daysRemaining: offer.validUntil
            ? Math.ceil((offer.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 999,
          remainingUses: offer.maxUses - offer.currentUses,
          totalUses: offer.maxUses,
        };
      })
    );

    return {
      underperforming: offerAnalytics
        .filter((o) => o.claims < 5)
        .sort((a, b) => a.claims - b.claims)
        .slice(0, 5)
        .map((o) => ({
          offerId: o.offerId,
          code: o.code,
          name: o.name,
          claims: o.claims,
        })),
      expiringSoon: offerAnalytics
        .filter((o) => o.daysRemaining > 0 && o.daysRemaining <= 30)
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 5)
        .map((o) => ({
          offerId: o.offerId,
          code: o.code,
          name: o.name,
          daysRemaining: o.daysRemaining,
        })),
      nearlyExhausted: offerAnalytics
        .filter((o) => o.remainingUses <= 10 && o.remainingUses > 0)
        .sort((a, b) => a.remainingUses - b.remainingUses)
        .slice(0, 5)
        .map((o) => ({
          offerId: o.offerId,
          code: o.code,
          name: o.name,
          remainingUses: o.remainingUses,
        })),
    };
  }

  // FIX: Export functionality for CSV/Excel with pagination
  async exportCoupons(options: {
    format: 'csv' | 'json';
    filters?: {
      isActive?: boolean;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    };
    fields?: string[];
    // FIX: Add pagination support
    page?: number;
    limit?: number;
    // FIX: Add total count for progress tracking
    includeStats?: boolean;
  }): Promise<{
    data: string;
    filename: string;
    contentType: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    stats?: {
      totalOffers: number;
      totalClaims: number;
      totalRedemptions: number;
      totalDiscountGiven: number;
    };
  }> {
    const { format, filters = {}, fields, page = 1, limit = 1000, includeStats = false } = options;
    const now = new Date();

    // Build query
    const query: any = {};
    query.isDeleted = { $ne: true }; // Always exclude soft-deleted

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    // FIX: Get total count for pagination
    const totalCount = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    // FIX: Apply pagination to query
    const coupons = await Coupon.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch claims data for all matching coupons (batch query)
    const couponIds = coupons.map(c => c._id);
    const claims = await OfferClaim.aggregate([
      { $match: { offerId: { $in: couponIds } } },
      {
        $group: {
          _id: '$offerId',
          totalClaims: { $sum: 1 },
          usedClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
          },
          expiredClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] },
          },
          totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
        },
      },
    ]);

    // Create claims map
    const claimsMap = new Map(claims.map(c => [c._id.toString(), c]));

    // FIX: Calculate aggregate stats if requested
    let stats: any = undefined;
    if (includeStats) {
      const allClaims = await OfferClaim.aggregate([
        { $match: { offerId: { $in: couponIds } } },
        {
          $group: {
            _id: null,
            totalClaims: { $sum: 1 },
            totalRedemptions: {
              $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
            },
            totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
          },
        },
      ]);
      stats = {
        totalOffers: totalCount,
        totalClaims: allClaims[0]?.totalClaims || 0,
        totalRedemptions: allClaims[0]?.totalRedemptions || 0,
        totalDiscountGiven: allClaims[0]?.totalDiscount || 0,
      };
    }

    // Default fields for export
    const defaultFields = [
      'code',
      'title',
      'type',
      'value',
      'maxDiscount',
      'minOrderValue',
      'isActive',
      'validFrom',
      'validUntil',
      'maxUses',
      'currentUses',
      'totalClaims',
      'redemptions',
      'conversionRate',
      'createdBy',
      'createdAt',
    ];

    const exportFields = fields || defaultFields;

    // Format data for export
    const exportData = coupons.map(coupon => {
      const couponClaims = claimsMap.get(coupon._id.toString()) || {
        totalClaims: 0,
        usedClaims: 0,
        expiredClaims: 0,
      };

      const row: Record<string, any> = {
        code: coupon.code,
        title: coupon.title || coupon.displayTitle,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount || '',
        minOrderValue: coupon.minOrderValue,
        isActive: coupon.isActive ? 'Yes' : 'No',
        validFrom: new Date(coupon.validFrom).toISOString().split('T')[0],
        validUntil: new Date(coupon.validUntil).toISOString().split('T')[0],
        maxUses: coupon.maxUses,
        currentUses: coupon.currentUses,
        totalClaims: couponClaims.totalClaims,
        redemptions: couponClaims.usedClaims,
        conversionRate: couponClaims.totalClaims > 0
          ? ((couponClaims.usedClaims / couponClaims.totalClaims) * 100).toFixed(2) + '%'
          : '0%',
        createdBy: (coupon.createdBy as any)?.email || '',
        createdAt: new Date(coupon.createdAt).toISOString(),
      };

      // Filter to requested fields
      if (exportFields !== defaultFields) {
        const filteredRow: Record<string, any> = {};
        exportFields.forEach(field => {
          if (row[field] !== undefined) {
            filteredRow[field] = row[field];
          }
        });
        return filteredRow;
      }

      return row;
    });

    if (format === 'json') {
      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `offers-export-${now.toISOString().split('T')[0]}.json`,
        contentType: 'application/json',
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
        },
        stats,
      };
    }

    // CSV format
    const headers = Object.keys(exportData[0] || {});
    const csvRows = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(h => {
          const val = row[h];
          // Escape quotes and wrap in quotes if contains comma
          const str = String(val ?? '');
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      ),
    ];

    return {
      data: csvRows.join('\n'),
      filename: `offers-export-${now.toISOString().split('T')[0]}-page${page}.csv`,
      contentType: 'text/csv',
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
      stats,
    };
  }
}

// ============================================
// Export
// ============================================

export const offerAnalyticsService = new OfferAnalyticsService();
export default offerAnalyticsService;
