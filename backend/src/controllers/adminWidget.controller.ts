/**
 * Admin Widget Controller
 *
 * Handles all P1 and P2 admin widget API endpoints for real-time monitoring
 * and analytics dashboards.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Dispute from '../models/dispute.model';
import Review from '../models/review.model';
import { Commission, ICommission } from '../models/commission.model';
import Settlement from '../models/settlement.model';
import Refund, { IRefund } from '../models/refund.model';
import OnboardingProgress from '../models/onboardingProgress.model';
import Availability from '../models/availability.model';
import Service from '../models/service.model';
import BlockedTerm from '../models/blockedTerm.model';
import Incident from '../models/incident.model';
import ReportTemplate from '../models/reportTemplate.model';
import logger from '../utils/logger';
import { escapeRegex } from '../utils/security';
import { getWinBackStats } from '../automation/winBackCampaign';

// LTV segment thresholds (AED)
const LTV_THRESHOLDS = {
  platinum: 5000,
  gold: 2500,
  silver: 1000,
  regular: 0
};

// Helper function to safely parse and validate date
const parseDate = (dateStr: string | undefined, fieldName: string, res: Response): Date | null => {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    res.status(400).json({
      success: false,
      message: `Invalid ${fieldName} format. Expected ISO 8601 date string.`
    });
    return null;
  }
  return parsed;
};

// Helper to validate pagination params
const parsePagination = (req: Request) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * GET /api/admin/fake-booking-detection
 * Detect potentially fraudulent or fake bookings
 */
export const getFakeBookingDetection = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, threshold = 3 } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // Build date filter
  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // BLOCKER 2 FIX: Add $limit before $unwind to prevent memory exhaustion
  const suspiciousBookings = await Booking.aggregate([
    {
      $match: {
        createdAt: Object.keys(dateFilter).length ? dateFilter : undefined,
        status: { $in: ['pending', 'confirmed'] }
      }
    },
    {
      $group: {
        _id: '$customerId',
        bookingCount: { $sum: 1 },
        uniqueProviders: { $addToSet: '$providerId' },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        bookings: { $push: { _id: '$_id', createdAt: '$createdAt', pricing: '$pricing' } }
      }
    },
    {
      $match: {
        $or: [
          { bookingCount: { $gt: Number(threshold) } },
          { uniqueProviders: { $size: 1 }, bookingCount: { $gt: 2 } }
        ]
      }
    },
    // BLOCKER 4 FIX: Add $limit before unwind
    { $limit: 100 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'customer'
      }
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } }
  ]);

  // Calculate risk score based on patterns
  const detectedFraud = suspiciousBookings.map(booking => {
    let riskScore = 0;
    const riskFactors: string[] = [];

    if (booking.bookingCount > 5) {
      riskScore += 30;
      riskFactors.push('High booking volume');
    }
    if (booking.uniqueProviders.length === 1 && booking.bookingCount > 2) {
      riskScore += 25;
      riskFactors.push('Single provider focus');
    }
    if (booking.avgBookingValue < 50) {
      riskScore += 15;
      riskFactors.push('Low average booking value');
    }

    return {
      customerId: booking._id,
      customerName: booking.customer ? `${booking.customer.firstName} ${booking.customer.lastName}` : 'Unknown',
      customerEmail: booking.customer?.email,
      bookingCount: booking.bookingCount,
      uniqueProviders: booking.uniqueProviders.length,
      avgBookingValue: Math.round(booking.avgBookingValue || 0),
      riskScore,
      riskFactors,
      recentBookings: booking.bookings.slice(0, 5)
    };
  }).filter(b => b.riskScore >= 30).sort((a, b) => b.riskScore - a.riskScore);

  // Apply pagination to filtered results
  const paginatedResults = detectedFraud.slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      detected: paginatedResults,
      summary: {
        totalSuspected: detectedFraud.length,
        highRisk: detectedFraud.filter(d => d.riskScore >= 60).length,
        mediumRisk: detectedFraud.filter(d => d.riskScore >= 40 && d.riskScore < 60).length,
        lowRisk: detectedFraud.filter(d => d.riskScore < 40).length,
        totalFlaggedBookings: detectedFraud.reduce((sum, d) => sum + d.bookingCount, 0)
      },
      pagination: {
        page,
        limit,
        total: detectedFraud.length,
        pages: Math.ceil(detectedFraud.length / limit)
      }
    }
  });
});

/**
 * GET /api/admin/provider-abuse
 * Monitor provider abuse patterns
 */
export const getProviderAbuseMonitor = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // BLOCKER 2 FIX: Add pagination to all aggregation pipelines
  const [providerStats, disputeStats, reviewStats] = await Promise.all([
    // Provider booking patterns
    Booking.aggregate([
      { $match: { createdAt: Object.keys(dateFilter).length ? dateFilter : undefined } },
      {
        $group: {
          _id: '$providerId',
          totalBookings: { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
          totalRevenue: { $sum: '$pricing.totalAmount' }
        }
      },
      {
        $addFields: {
          cancellationRate: { $multiply: [{ $divide: ['$cancelled', { $max: ['$totalBookings', 1] }] }, 100] },
          noShowRate: { $multiply: [{ $divide: ['$noShow', { $max: ['$totalBookings', 1] }] }, 100] }
        }
      },
      { $limit: 1000 } // BLOCKER 2 FIX: Add limit
    ]),
    // Provider dispute rates
    Dispute.aggregate([
      { $match: { createdAt: Object.keys(dateFilter).length ? dateFilter : undefined } },
      {
        $group: {
          _id: '$providerId',
          totalDisputes: { $sum: 1 },
          resolvedInFavor: { $sum: { $cond: [{ $eq: ['$resolution', 'resolved_in_favor_customer'] }, 1, 0] } },
          escalated: { $sum: { $cond: [{ $eq: ['$escalated', true] }, 1, 0] } }
        }
      },
      { $limit: 1000 } // BLOCKER 2 FIX: Add limit
    ]),
    // Provider review patterns
    Review.aggregate([
      { $match: { createdAt: Object.keys(dateFilter).length ? dateFilter : undefined } },
      {
        $group: {
          _id: '$providerId',
          totalReviews: { $sum: 1 },
          oneStarReviews: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          flaggedReviews: { $sum: { $cond: [{ $eq: ['$isFlagged', true] }, 1, 0] } }
        }
      },
      { $limit: 1000 } // BLOCKER 2 FIX: Add limit
    ])
  ]);

  // Combine stats and calculate abuse score
  const abusePatterns = providerStats.map(provider => {
    const disputes = disputeStats.find(d => d._id.toString() === provider._id.toString()) || { totalDisputes: 0, resolvedInFavor: 0, escalated: 0 };
    const reviews = reviewStats.find(r => r._id.toString() === provider._id.toString()) || { totalReviews: 0, flaggedReviews: 0 };

    let abuseScore = 0;
    const abuseFactors: string[] = [];

    if (provider.cancellationRate > 20) {
      abuseScore += 40;
      abuseFactors.push(`High cancellation rate: ${provider.cancellationRate.toFixed(1)}%`);
    }
    if (disputes.totalDisputes > 3) {
      abuseScore += 30;
      abuseFactors.push(`High dispute count: ${disputes.totalDisputes}`);
    }
    if (disputes.resolvedInFavor > disputes.totalDisputes * 0.5) {
      abuseScore += 20;
      abuseFactors.push('Disputes favor customers');
    }
    if (reviews.flaggedReviews > 0) {
      abuseScore += 15;
      abuseFactors.push(`${reviews.flaggedReviews} flagged reviews`);
    }
    if (provider.noShowRate > 5) {
      abuseScore += 25;
      abuseFactors.push(`High no-show rate: ${provider.noShowRate.toFixed(1)}%`);
    }

    return {
      providerId: provider._id,
      totalBookings: provider.totalBookings,
      completedBookings: provider.completed,
      cancellationRate: Math.round(provider.cancellationRate * 10) / 10,
      noShowRate: Math.round(provider.noShowRate * 10) / 10,
      totalDisputes: disputes.totalDisputes,
      escalatedDisputes: disputes.escalated,
      totalReviews: reviews.totalReviews,
      flaggedReviews: reviews.flaggedReviews,
      abuseScore,
      abuseFactors
    };
  }).filter(p => p.abuseScore >= 40).sort((a, b) => b.abuseScore - a.abuseScore);

  // Apply pagination
  const paginatedResults = abusePatterns.slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      providers: paginatedResults,
      summary: {
        totalProviders: abusePatterns.length,
        highRisk: abusePatterns.filter(p => p.abuseScore >= 70).length,
        mediumRisk: abusePatterns.filter(p => p.abuseScore >= 50 && p.abuseScore < 70).length,
        underReview: abusePatterns.filter(p => p.abuseScore < 50).length
      },
      pagination: {
        page,
        limit,
        total: abusePatterns.length,
        pages: Math.ceil(abusePatterns.length / limit)
      }
    }
  });
});

/**
 * GET /api/admin/customer-abuse
 * Monitor customer abuse patterns
 */
export const getCustomerAbuseMonitor = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // BLOCKER 2 FIX: Add pagination with limits
  const customerStats = await Booking.aggregate([
    { $match: { createdAt: Object.keys(dateFilter).length ? dateFilter : undefined } },
    {
      $group: {
        _id: '$customerId',
        totalBookings: { $sum: 1 },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }
    },
    {
      $addFields: {
        cancellationRate: { $multiply: [{ $divide: ['$cancelled', { $max: ['$totalBookings', 1] }] }, 100] },
        noShowRate: { $multiply: [{ $divide: ['$noShow', { $max: ['$totalBookings', 1] }] }, 100] }
      }
    },
    { $limit: 1000 } // BLOCKER 2 FIX: Add limit
  ]);

  const abusePatterns = customerStats.map(customer => {
    let abuseScore = 0;
    const abuseFactors: string[] = [];

    if (customer.totalBookings > 10) {
      abuseScore += 20;
    }
    if (customer.cancellationRate > 30) {
      abuseScore += 50;
      abuseFactors.push(`High cancellation rate: ${customer.cancellationRate.toFixed(1)}%`);
    }
    if (customer.noShowRate > 10) {
      abuseScore += 40;
      abuseFactors.push(`High no-show rate: ${customer.noShowRate.toFixed(1)}%`);
    }
    if (customer.cancelled > 5) {
      abuseScore += 30;
      abuseFactors.push(`Multiple cancellations: ${customer.cancelled}`);
    }

    return {
      customerId: customer._id,
      totalBookings: customer.totalBookings,
      completedBookings: customer.completed,
      cancelledBookings: customer.cancelled,
      noShows: customer.noShow,
      cancellationRate: Math.round(customer.cancellationRate * 10) / 10,
      noShowRate: Math.round(customer.noShowRate * 10) / 10,
      abuseScore,
      abuseFactors
    };
  }).filter(c => c.abuseScore >= 40).sort((a, b) => b.abuseScore - a.abuseScore);

  // Apply pagination
  const paginatedResults = abusePatterns.slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      customers: paginatedResults,
      summary: {
        totalCustomers: abusePatterns.length,
        highRisk: abusePatterns.filter(c => c.abuseScore >= 70).length,
        mediumRisk: abusePatterns.filter(c => c.abuseScore >= 50 && c.abuseScore < 70).length
      },
      pagination: {
        page,
        limit,
        total: abusePatterns.length,
        pages: Math.ceil(abusePatterns.length / limit)
      }
    }
  });
});

/**
 * GET /api/admin/providers/risk
 * Calculate risk scores for all providers
 */
export const getProviderRiskScore = asyncHandler(async (req: Request, res: Response) => {
  // BLOCKER 3 FIX: Clamp numeric params
  const minScore = Math.max(0, Math.min(100, Number(req.query.minScore) || 0));
  const maxScore = Math.max(0, Math.min(100, Number(req.query.maxScore) || 100));
  const sortBy = req.query.sortBy as string || 'riskScore';

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // BLOCKER 2 FIX: Paginate provider lookup
  const totalProviders = await ProviderProfile.countDocuments({});
  const providers = await ProviderProfile.find({})
    .select('userId businessInfo')
    .skip(skip)
    .limit(limit)
    .lean();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [bookingStats, disputeStats, reviewStats] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$providerId',
          totalBookings: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      }
    ]),
    Dispute.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$providerId',
          disputeCount: { $sum: 1 },
          escalated: { $sum: { $cond: [{ $eq: ['$escalated', true] }, 1, 0] } }
        }
      }
    ]),
    Review.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$providerId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
          lowRatings: { $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] } }
        }
      }
    ])
  ]);

  const providerRisks = providers.map(provider => {
    const bookings = bookingStats.find(b => b._id.toString() === provider.userId.toString()) || { totalBookings: 0, completed: 0, cancelled: 0, revenue: 0 };
    const disputes = disputeStats.find(d => d._id.toString() === provider.userId.toString()) || { disputeCount: 0, escalated: 0 };
    const reviews = reviewStats.find(r => r._id.toString() === provider.userId.toString()) || { avgRating: 5, reviewCount: 0, lowRatings: 0 };

    let riskScore = 0;

    // Rating impact (lower rating = higher risk)
    if (reviews.avgRating < 3) riskScore += 30;
    else if (reviews.avgRating < 4) riskScore += 15;
    else riskScore -= 10; // Bonus for good rating

    // Dispute impact
    riskScore += Math.min(disputes.disputeCount * 10, 40);
    riskScore += disputes.escalated * 15;

    // Low rating reviews
    riskScore += Math.min(reviews.lowRatings * 5, 20);

    // Completion rate
    if (bookings.totalBookings > 0) {
      const completionRate = bookings.completed / bookings.totalBookings;
      if (completionRate < 0.7) riskScore += 25;
      else if (completionRate < 0.85) riskScore += 10;
    }

    // Normalize to 0-100
    riskScore = Math.max(0, Math.min(100, riskScore));

    // Risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      providerId: provider.userId,
      businessName: provider.businessInfo?.businessName || 'Unknown',
      riskScore,
      riskLevel,
      metrics: {
        avgRating: reviews.avgRating ? Math.round(reviews.avgRating * 10) / 10 : null,
        reviewCount: reviews.reviewCount,
        disputeCount: disputes.disputeCount,
        escalatedDisputes: disputes.escalated,
        completionRate: bookings.totalBookings > 0 ? Math.round((bookings.completed / bookings.totalBookings) * 100) : null,
        totalRevenue: bookings.revenue
      }
    };
  }).filter(p => p.riskScore >= minScore && p.riskScore <= maxScore);

  // Sort by specified field
  providerRisks.sort((a, b) => {
    if (sortBy === 'riskScore') return b.riskScore - a.riskScore;
    if (sortBy === 'metrics.avgRating') return (a.metrics.avgRating || 5) - (b.metrics.avgRating || 5);
    if (sortBy === 'metrics.disputeCount') return b.metrics.disputeCount - a.metrics.disputeCount;
    return 0;
  });

  res.json({
    success: true,
    data: {
      providers: providerRisks,
      summary: {
        total: providerRisks.length,
        critical: providerRisks.filter(p => p.riskLevel === 'critical').length,
        high: providerRisks.filter(p => p.riskLevel === 'high').length,
        medium: providerRisks.filter(p => p.riskLevel === 'medium').length,
        low: providerRisks.filter(p => p.riskLevel === 'low').length,
        avgRiskScore: providerRisks.length > 0 ? Math.round(providerRisks.reduce((sum, p) => sum + p.riskScore, 0) / providerRisks.length) : 0
      },
      pagination: {
        page,
        limit,
        total: totalProviders,
        pages: Math.ceil(totalProviders / limit)
      }
    }
  });
});

/**
 * GET /api/admin/revenue-by-city
 * Revenue analytics broken down by city
 */
export const getRevenueByCity = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, groupBy = 'city' } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  const matchStage: any = { status: 'completed' };
  if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;

  // Group by specified field (city, state, or area)
  const groupField = groupBy === 'state' ? '$location.address.state' :
                     groupBy === 'area' ? '$location.address.area' :
                     '$location.address.city';

  // BLOCKER 2 FIX: Add pagination to aggregation
  const revenueByRegion = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupField,
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalBookings: { $sum: 1 },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        totalTax: { $sum: '$pricing.tax' },
        uniqueCustomers: { $addToSet: '$customerId' },
        uniqueProviders: { $addToSet: '$providerId' }
      }
    },
    {
      $addFields: {
        customerCount: { $size: '$uniqueCustomers' },
        providerCount: { $size: '$uniqueProviders' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  // Get total count for pagination
  const totalCities = await Booking.aggregate([
    { $match: matchStage },
    { $group: { _id: groupField } },
    { $count: 'total' }
  ]);

  // Get trend data for top 5 cities
  const topCities = revenueByRegion.slice(0, 5).map(r => r._id);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [currentPeriod, previousPeriod] = await Promise.all([
    Booking.aggregate([
      { $match: { ...matchStage, createdAt: { $gte: thirtyDaysAgo }, [`location.address.city`]: { $in: topCities } } },
      {
        $group: {
          _id: `$location.address.city`,
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        }
      }
    ]),
    Booking.aggregate([
      { $match: { ...matchStage, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }, [`location.address.city`]: { $in: topCities } } },
      {
        $group: {
          _id: `$location.address.city`,
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        }
      }
    ])
  ]);

  // Calculate growth for top cities
  const cityTrends = topCities.map(city => {
    const current = currentPeriod.find(c => c._id === city) || { revenue: 0, bookings: 0 };
    const previous = previousPeriod.find(c => c._id === city) || { revenue: 0, bookings: 0 };
    const revenueGrowth = previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0;
    const bookingGrowth = previous.bookings > 0 ? ((current.bookings - previous.bookings) / previous.bookings) * 100 : 0;

    return {
      city,
      currentRevenue: current.revenue,
      previousRevenue: previous.revenue,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      currentBookings: current.bookings,
      previousBookings: previous.bookings,
      bookingGrowth: Math.round(bookingGrowth * 10) / 10
    };
  });

  const totalCount = totalCities[0]?.total || 0;

  res.json({
    success: true,
    data: {
      byRegion: revenueByRegion.map(r => ({
        region: r._id || 'Unknown',
        totalRevenue: Math.round(r.totalRevenue * 100) / 100,
        totalBookings: r.totalBookings,
        avgBookingValue: Math.round(r.avgBookingValue * 100) / 100,
        totalTax: Math.round(r.totalTax * 100) / 100,
        customerCount: r.customerCount,
        providerCount: r.providerCount
      })),
      topCityTrends: cityTrends,
      summary: {
        totalRevenue: revenueByRegion.reduce((sum, r) => sum + r.totalRevenue, 0),
        totalBookings: revenueByRegion.reduce((sum, r) => sum + r.totalBookings, 0),
        totalCities: totalCount,
        topCity: revenueByRegion[0]?._id || null
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    }
  });
});

/**
 * GET /api/admin/suspensions
 * Get all suspended accounts and suspension history
 */
export const getSuspensionCenter = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Find suspended users
  const userFilter: any = {};
  if (status) userFilter['accountStatus.status'] = status;

  const [suspendedUsers, total, auditLogs] = await Promise.all([
    User.find({ 'accountStatus.status': status || 'suspended' })
      .select('firstName lastName email phone role accountStatus createdAt')
      .populate('accountStatus.suspendedBy', 'firstName lastName')
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments({ 'accountStatus.status': status || 'suspended' }),
    // Get recent suspension-related audit logs
    mongoose.connection.collection('auditlogs').find({
      action: { $in: ['SUSPEND', 'UNSUSPEND', 'BAN', 'UNBAN', 'DEACTIVATE', 'REACTIVATE'] }
    }).sort({ createdAt: -1 }).limit(50).toArray()
  ]);

  // Group by type (provider, customer, admin)
  const byType = {
    provider: suspendedUsers.filter(u => u.role === 'provider').length,
    customer: suspendedUsers.filter(u => u.role === 'customer').length,
    admin: suspendedUsers.filter(u => u.role === 'admin').length
  };

  // Group by reason
  const byReason: Record<string, number> = {};
  suspendedUsers.forEach(u => {
    const reason = (u.accountStatus as any)?.reason || 'unknown';
    byReason[reason] = (byReason[reason] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      suspended: suspendedUsers.map(u => ({
        userId: u._id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        phone: u.phone,
        role: u.role,
        reason: (u.accountStatus as any)?.reason,
        suspendedAt: (u.accountStatus as any)?.suspendedAt,
        suspendedBy: (u.accountStatus as any)?.suspendedBy ?
          `${(u.accountStatus as any).suspendedBy.firstName} ${(u.accountStatus as any).suspendedBy.lastName}` : null,
        notes: (u.accountStatus as any)?.notes,
        appealStatus: (u.accountStatus as any)?.appealStatus
      })),
      auditLog: auditLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      summary: {
        totalSuspended: total,
        byType,
        byReason,
        pendingAppeals: suspendedUsers.filter(u => (u.accountStatus as any)?.appealStatus === 'pending').length
      }
    }
  });
});

/**
 * GET /api/admin/appeals
 * Get appeal center data
 */
export const getAppealCenter = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Find users with appeals
  const [appeals, total] = await Promise.all([
    User.find({ 'accountStatus.appealStatus': { $in: ['pending', 'approved', 'rejected'] } })
      .select('firstName lastName email phone role accountStatus createdAt')
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments({ 'accountStatus.appealStatus': { $in: ['pending', 'approved', 'rejected'] } })
  ]);

  const formattedAppeals = appeals
    .filter(u => (u.accountStatus as any)?.appealStatus !== undefined)
    .map(u => ({
      appealId: u._id,
      userId: u._id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
      originalReason: (u.accountStatus as any)?.reason,
      appealStatus: (u.accountStatus as any)?.appealStatus,
      appealReason: (u.accountStatus as any)?.appealReason,
      appealSubmittedAt: (u.accountStatus as any)?.appealSubmittedAt,
      appealReviewedAt: (u.accountStatus as any)?.appealReviewedAt,
      appealReviewedBy: (u.accountStatus as any)?.appealReviewedBy,
      decisionNotes: (u.accountStatus as any)?.decisionNotes
    }));

  res.json({
    success: true,
    data: {
      appeals: formattedAppeals,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      summary: {
        total: total,
        pending: formattedAppeals.filter(a => a.appealStatus === 'pending').length,
        approved: formattedAppeals.filter(a => a.appealStatus === 'approved').length,
        rejected: formattedAppeals.filter(a => a.appealStatus === 'rejected').length,
        avgReviewTime: '48 hours'
      }
    }
  });
});

/**
 * GET /api/admin/background-checks
 * Background check dashboard
 */
export const getBackgroundCheckDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Get providers with verification status
  const [providers, total] = await Promise.all([
    ProviderProfile.find({ 'verificationStatus.backgroundCheck': { $exists: true } })
      .populate('userId', 'firstName lastName email phone')
      .select('userId verificationStatus verificationDocuments verificationBadges createdAt')
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ProviderProfile.countDocuments({ 'verificationStatus.backgroundCheck': { $exists: true } })
  ]);

  const backgroundChecks = providers.map(p => ({
    providerId: p.userId?._id,
    name: p.userId ? `${(p.userId as any).firstName} ${(p.userId as any).lastName}` : 'Unknown',
    email: (p.userId as any)?.email,
    phone: (p.userId as any)?.phone,
    status: (p.verificationStatus as any)?.backgroundCheck?.status || 'pending',
    submittedAt: (p.verificationStatus as any)?.backgroundCheck?.submittedAt,
    completedAt: (p.verificationStatus as any)?.backgroundCheck?.completedAt,
    result: (p.verificationStatus as any)?.backgroundCheck?.result,
    documents: p.verificationDocuments?.length || 0,
    badges: p.verificationBadges?.filter((b: any) => b.type === 'background_check').length
  }));

  // Get status counts
  const statusCounts = await ProviderProfile.aggregate([
    { $match: { 'verificationStatus.backgroundCheck': { $exists: true } } },
    {
      $group: {
        _id: '$verificationStatus.backgroundCheck.status',
        count: { $sum: 1 }
      }
    }
  ]);

  const summary: Record<string, number> = { pending: 0, in_review: 0, approved: 0, rejected: 0, expired: 0 };
  statusCounts.forEach(s => {
    if (s._id && summary.hasOwnProperty(s._id)) {
      summary[s._id] = s.count;
    }
  });

  res.json({
    success: true,
    data: {
      backgroundChecks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      summary: {
        total: total,
        ...summary,
        expiringSoon: await ProviderProfile.countDocuments({
          'verificationStatus.backgroundCheck.expiresAt': {
            $gte: new Date(),
            $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        })
      }
    }
  });
});

/**
 * GET /api/admin/reconciliation
 * Financial reconciliation engine
 */
export const getReconciliationEngine = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  const matchStage: any = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  // Get booking financials
  const [bookingStats, settlementStats, commissionStats, refundStats] = await Promise.all([
    Booking.aggregate([
      { $match: { ...matchStage, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          totalTax: { $sum: '$pricing.tax' },
          totalDiscount: { $sum: '$pricing.couponDiscount' },
          bookingCount: { $sum: 1 }
        }
      }
    ]),
    Settlement.aggregate([
      { $match: { createdAt: Object.keys(dateFilter).length ? dateFilter : undefined } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]),
    Commission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$amount' },
          pendingCommission: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          paidCommission: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } }
        }
      }
    ]),
    Refund.aggregate([
      { $match: { createdAt: Object.keys(dateFilter).length ? dateFilter : undefined } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const bookings = bookingStats[0] || { totalRevenue: 0, totalTax: 0, totalDiscount: 0, bookingCount: 0 };
  const commissions = commissionStats[0] || { totalCommission: 0, pendingCommission: 0, paidCommission: 0 };

  const settlements = settlementStats.reduce((acc: Record<string, { amount: number; count: number }>, s: { _id: string; totalAmount: number; count: number }) => {
    acc[s._id] = { amount: s.totalAmount, count: s.count };
    return acc;
  }, {} as Record<string, { amount: number; count: number }>);

  const refunds = refundStats.reduce((acc: Record<string, { amount: number; count: number }>, r: { _id: string; totalAmount: number; count: number }) => {
    acc[r._id] = { amount: r.totalAmount, count: r.count };
    return acc;
  }, {} as Record<string, { amount: number; count: number }>);

  // Calculate discrepancies
  const expectedRevenue = bookings.totalRevenue - bookings.totalDiscount;
  const actualSettled = (settlements['completed']?.amount || 0) + (settlements['paid']?.amount || 0);
  const discrepancy = expectedRevenue - actualSettled - commissions.totalCommission;

  res.json({
    success: true,
    data: {
      financials: {
        grossRevenue: bookings.totalRevenue,
        totalDiscounts: bookings.totalDiscount,
        netRevenue: expectedRevenue,
        totalTax: bookings.totalTax,
        completedBookings: bookings.bookingCount
      },
      commissions,
      settlements,
      refunds,
      reconciliation: {
        expectedRevenue,
        actualSettled,
        discrepancy: Math.abs(discrepancy),
        isBalanced: Math.abs(discrepancy) < 1,
        status: Math.abs(discrepancy) < 1 ? 'balanced' : 'discrepancy'
      }
    }
  });
});

/**
 * GET /api/admin/commissions/reports
 * Commission reports and analytics
 */
export const getCommissionReports = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, status, providerId } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const matchFilter: any = {};
  if (parsedStartDate || parsedEndDate) {
    matchFilter.createdAt = {};
    if (parsedStartDate) matchFilter.createdAt.$gte = parsedStartDate;
    if (parsedEndDate) matchFilter.createdAt.$lte = parsedEndDate;
  }
  if (status) matchFilter.status = status;
  if (providerId) matchFilter.providerId = new mongoose.Types.ObjectId(providerId as string);

  const [commissions, summary] = await Promise.all([
    Commission.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $ifNull: ['$providerId', 'unassigned'] },
          totalCommission: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgCommission: { $avg: '$amount' }
        }
      },
      { $sort: { totalCommission: -1 } },
      { $limit: 50 }
    ]),
    Commission.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$amount' },
          pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          cancelledAmount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, '$amount', 0] } },
          transactionCount: { $sum: 1 }
        }
      }
    ])
  ]);

  // Get commission by booking category if available
  const byCategory = await Commission.aggregate([
    { $match: matchFilter },
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking'
      }
    },
    { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$booking.serviceCategory',
        totalCommission: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalCommission: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      topProviders: commissions,
      byCategory,
      summary: summary[0] ? {
        totalCommission: summary[0].totalCommission,
        pendingAmount: summary[0].pendingAmount,
        paidAmount: summary[0].paidAmount,
        cancelledAmount: summary[0].cancelledAmount,
        transactionCount: summary[0].transactionCount,
        avgCommissionPerTransaction: Math.round((summary[0].totalCommission / Math.max(summary[0].transactionCount, 1)) * 100) / 100
      } : null
    }
  });
});

/**
 * GET /api/admin/tax-reports
 * Tax reports and compliance data
 */
export const getTaxReports = asyncHandler(async (req: Request, res: Response) => {
  const { year, quarter, startDate, endDate } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Build date filter
  const dateFilter: any = {};
  if (year) {
    const start = new Date(Number(year), quarter ? (Number(quarter) - 1) * 3 : 0, 1);
    const end = quarter ? new Date(Number(year), Number(quarter) * 3, 0) : new Date(Number(year), 11, 31);
    dateFilter.$gte = start;
    dateFilter.$lte = end;
  } else if (parsedStartDate || parsedEndDate) {
    if (parsedStartDate) dateFilter.$gte = parsedStartDate;
    if (parsedEndDate) dateFilter.$lte = parsedEndDate;
  }

  // Get tax data from completed bookings
  const taxData = await Booking.aggregate([
    { $match: { status: 'completed', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalTax: { $sum: '$pricing.tax' },
        taxableAmount: { $sum: { $subtract: ['$pricing.subtotal', '$pricing.couponDiscount'] } },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Get total summary
  const summary = await Booking.aggregate([
    { $match: { status: 'completed', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalTax: { $sum: '$pricing.tax' },
        taxableAmount: { $sum: { $subtract: ['$pricing.subtotal', '$pricing.couponDiscount'] } },
        transactionCount: { $sum: 1 },
        avgTaxRate: { $avg: { $divide: ['$pricing.tax', { $max: ['$pricing.subtotal', 1] }] } }
      }
    }
  ]);

  // Get tax by location (for jurisdiction reporting)
  const byLocation = await Booking.aggregate([
    { $match: { status: 'completed', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) } },
    {
      $group: {
        _id: '$location.address.state',
        totalTax: { $sum: '$pricing.tax' },
        taxableAmount: { $sum: { $subtract: ['$pricing.subtotal', '$pricing.couponDiscount'] } },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { totalTax: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      monthlyData: taxData.map(t => ({
        year: t._id.year,
        month: t._id.month,
        totalRevenue: Math.round(t.totalRevenue * 100) / 100,
        taxableAmount: Math.round(t.taxableAmount * 100) / 100,
        totalTax: Math.round(t.totalTax * 100) / 100,
        transactionCount: t.transactionCount
      })),
      byLocation,
      summary: summary[0] ? {
        totalRevenue: Math.round(summary[0].totalRevenue * 100) / 100,
        totalTax: Math.round(summary[0].totalTax * 100) / 100,
        taxableAmount: Math.round(summary[0].taxableAmount * 100) / 100,
        transactionCount: summary[0].transactionCount,
        avgTaxRate: Math.round(summary[0].avgTaxRate * 10000) / 100
      } : null
    }
  });
});

/**
 * GET /api/admin/refunds/analytics
 * Refund analytics
 */
export const getRefundAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, status, reason } = req.query;

  // BLOCKER 1 FIX: Validate dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const matchFilter: any = {};
  if (parsedStartDate || parsedEndDate) {
    matchFilter.createdAt = {};
    if (parsedStartDate) matchFilter.createdAt.$gte = parsedStartDate;
    if (parsedEndDate) matchFilter.createdAt.$lte = parsedEndDate;
  }
  if (status) matchFilter.status = status;
  if (reason) matchFilter.reason = reason;

  const [refunds, summary, byReason, byProvider] = await Promise.all([
    Refund.find(matchFilter)
      .populate('bookingId', 'bookingNumber pricing totalAmount')
      .populate('customerId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Refund.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: '$amount' },
          refundCount: { $sum: 1 },
          avgRefundAmount: { $avg: '$amount' },
          pendingRefunds: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          approvedRefunds: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } },
          rejectedRefunds: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, '$amount', 0] } }
        }
      }
    ]),
    Refund.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$reason',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]),
    Refund.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$providerId',
          totalRefunds: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalRefunds: -1 } },
      { $limit: 20 }
    ])
  ]);

  res.json({
    success: true,
    data: {
      recentRefunds: refunds.map(r => ({
        refundId: r._id,
        amount: r.amount,
        status: r.status,
        reason: r.reason,
        description: r.description,
        bookingNumber: (r.bookingId as any)?.bookingNumber,
        customerName: (r.customerId as any) ? `${(r.customerId as any).firstName} ${(r.customerId as any).lastName}` : null,
        providerName: (r.providerId as any) ? `${(r.providerId as any).firstName} ${(r.providerId as any).lastName}` : null,
        createdAt: r.createdAt,
        processedAt: (r as any).processedAt
      })),
      byReason: byReason.map(r => ({
        reason: r._id || 'unknown',
        totalAmount: Math.round(r.totalAmount * 100) / 100,
        count: r.count
      })),
      topProvidersWithRefunds: byProvider,
      summary: summary[0] ? {
        totalRefunds: Math.round(summary[0].totalRefunds * 100) / 100,
        refundCount: summary[0].refundCount,
        avgRefundAmount: Math.round(summary[0].avgRefundAmount * 100) / 100,
        pendingRefunds: Math.round(summary[0].pendingRefunds * 100) / 100,
        approvedRefunds: Math.round(summary[0].approvedRefunds * 100) / 100,
        rejectedRefunds: Math.round(summary[0].rejectedRefunds * 100) / 100
      } : null
    }
  });
});

/**
 * GET /api/admin/verification-queue
 * Verification queue for providers
 */
export const getVerificationQueue = asyncHandler(async (req: Request, res: Response) => {
  const { status, priority, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Build filter based on verification status
  const matchFilter: any = {};

  if (status) {
    matchFilter['verificationStatus.overall'] = status;
  } else {
    // Default to pending items
    matchFilter['verificationStatus.overall'] = 'pending';
  }

  if (priority) {
    matchFilter['verificationStatus.priority'] = priority;
  }

  const [providers, total] = await Promise.all([
    ProviderProfile.find(matchFilter)
      .populate('userId', 'firstName lastName email phone avatar')
      .select('userId businessInfo verificationStatus verificationDocuments instagramStyleProfile createdAt updatedAt')
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ProviderProfile.countDocuments(matchFilter)
  ]);

  const queue = providers.map(p => {
    const verificationStatus = p.verificationStatus as any;
    const pendingItems: string[] = [];
    if (verificationStatus?.identity?.status === 'pending') pendingItems.push('identity');
    if (verificationStatus?.business?.status === 'pending') pendingItems.push('business');
    if (verificationStatus?.backgroundCheck?.status === 'pending') pendingItems.push('background_check');
    if (verificationStatus?.insurance?.status === 'pending') pendingItems.push('insurance');

    return {
      providerId: p.userId?._id,
      name: p.userId ? `${(p.userId as any).firstName} ${(p.userId as any).lastName}` : 'Unknown',
      email: (p.userId as any)?.email,
      phone: (p.userId as any)?.phone,
      avatar: (p.userId as any)?.avatar,
      businessName: p.businessInfo?.businessName,
      businessType: p.businessInfo?.businessType,
      verificationStatus: verificationStatus?.overall,
      pendingItems,
      priority: verificationStatus?.priority || 'normal',
      submittedAt: verificationStatus?.submittedAt,
      lastUpdated: p.updatedAt,
      documentsCount: p.verificationDocuments?.length || 0,
      isVerified: p.instagramStyleProfile?.isVerified || false
    };
  });

  // Get queue stats
  const queueStats = await ProviderProfile.aggregate([
    {
      $group: {
        _id: '$verificationStatus.overall',
        count: { $sum: 1 }
      }
    }
  ]);

  const stats: Record<string, number> = { pending: 0, in_review: 0, approved: 0, rejected: 0 };
  queueStats.forEach(s => {
    if (s._id && stats.hasOwnProperty(s._id)) {
      stats[s._id] = s.count;
    }
  });

  res.json({
    success: true,
    data: {
      queue,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      summary: {
        totalPending: total,
        ...stats,
        avgWaitTime: '24 hours',
        urgentCount: await ProviderProfile.countDocuments({ 'verificationStatus.priority': 'high', 'verificationStatus.overall': 'pending' })
      }
    }
  });
});

// ============================================
// P2 ADMIN WIDGET ENDPOINTS
// ============================================

/**
 * GET /api/admin/onboarding-funnel
 * Provider/customer onboarding completion rates
 */
export const getOnboardingFunnel = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, role } = req.query;

  // Parse dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // Build date filter
  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // Get all onboarding tasks with their completion stats
  const funnelStats = await OnboardingProgress.aggregate([
    {
      $match: Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}
    },
    {
      $group: {
        _id: {
          taskKey: '$taskKey',
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.taskKey',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        }
      }
    }
  ]);

  // Get total users by role for completion rate calculation
  const userMatch: any = {};
  if (role) userMatch.role = role;
  if (parsedStartDate || parsedEndDate) {
    userMatch.createdAt = {};
    if (parsedStartDate) userMatch.createdAt.$gte = parsedStartDate;
    if (parsedEndDate) userMatch.createdAt.$lte = parsedEndDate;
  }

  const userStats = await User.aggregate([
    { $match: userMatch },
    {
      $group: {
        _id: '$role',
        total: { $sum: 1 }
      }
    }
  ]);

  // Calculate completion rates per task
  const funnelData = funnelStats.map(task => {
    const totalUsers = userStats.find(u => u._id === 'provider')?.total ||
                       userStats.find(u => u._id === 'customer')?.total ||
                       userStats.reduce((sum, u) => sum + u.total, 0);

    const pending = task.statuses.find((s: any) => s.status === 'pending')?.count || 0;
    const inProgress = task.statuses.find((s: any) => s.status === 'in_progress')?.count || 0;
    const completed = task.statuses.find((s: any) => s.status === 'completed')?.count || 0;
    const skipped = task.statuses.find((s: any) => s.status === 'skipped')?.count || 0;

    const total = pending + inProgress + completed + skipped;

    return {
      step: task._id,
      total,
      pending,
      inProgress,
      completed,
      skipped,
      completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
      dropOffRate: total > 0 ? Math.round(((pending + skipped) / total) * 10000) / 100 : 0
    };
  });

  // Calculate average time to complete (for completed tasks)
  const timeToComplete = await OnboardingProgress.aggregate([
    { $match: { status: 'completed', completedAt: { $exists: true } } },
    {
      $addFields: {
        timeToComplete: { $subtract: ['$completedAt', '$createdAt'] }
      }
    },
    {
      $group: {
        _id: '$taskKey',
        avgTimeMs: { $avg: '$timeToComplete' },
        minTimeMs: { $min: '$timeToComplete' },
        maxTimeMs: { $max: '$timeToComplete' }
      }
    }
  ]);

  const timeData = timeToComplete.reduce((acc: Record<string, any>, t) => {
    acc[t._id] = {
      avgMinutes: Math.round(t.avgTimeMs / 60000),
      minMinutes: Math.round(t.minTimeMs / 60000),
      maxMinutes: Math.round(t.maxTimeMs / 60000)
    };
    return acc;
  }, {});

  // Summary
  const summary = {
    totalUsers: userStats.reduce((sum, u) => sum + u.total, 0),
    byRole: userStats.reduce((acc: Record<string, number>, u) => {
      acc[u._id || 'unknown'] = u.total;
      return acc;
    }, {}),
    avgCompletionRate: funnelData.length > 0
      ? Math.round(funnelData.reduce((sum, f) => sum + f.completionRate, 0) / funnelData.length)
      : 0,
    biggestDropOff: funnelData.length > 0
      ? funnelData.reduce((max, f) => f.dropOffRate > max.dropOffRate ? f : max, funnelData[0])?.step
      : null
  };

  res.json({
    success: true,
    data: {
      funnel: funnelData,
      timeToComplete: timeData,
      pagination: {
        page,
        limit,
        total: funnelData.length,
        pages: Math.ceil(funnelData.length / limit)
      },
      summary
    }
  });
});

/**
 * GET /api/admin/supply-demand
 * Provider availability vs booking demand by city/category
 */
export const getSupplyDemandRatio = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, city, category } = req.query;

  // Parse dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // Build filters
  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // Count active providers (with availability set up)
  const providerMatch: any = {};
  if (city) providerMatch['location.address.city'] = city;

  const activeProviders = await ProviderProfile.countDocuments({
    'availability.isSetupComplete': true,
    ...providerMatch
  });

  // Get booking demand
  const bookingMatch: any = {};
  if (Object.keys(dateFilter).length) bookingMatch.createdAt = dateFilter;
  if (city) bookingMatch['location.address.city'] = city;
  if (category) bookingMatch.serviceCategory = category;

  const [demandByCity, demandByCategory, peakHours] = await Promise.all([
    // Demand by city
    Booking.aggregate([
      { $match: { ...bookingMatch, status: { $in: ['pending', 'confirmed', 'in_progress'] } } },
      {
        $group: {
          _id: '$location.address.city',
          activeBookings: { $sum: 1 }
        }
      },
      { $sort: { activeBookings: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]),
    // Demand by category
    Booking.aggregate([
      { $match: { ...bookingMatch, status: { $in: ['pending', 'confirmed', 'in_progress'] } } },
      {
        $group: {
          _id: '$serviceCategory',
          activeBookings: { $sum: 1 }
        }
      },
      { $sort: { activeBookings: -1 } }
    ]),
    // Peak hours analysis (demand by hour)
    Booking.aggregate([
      { $match: bookingMatch },
      {
        $group: {
          _id: { $hour: '$scheduledDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  // Get provider count by city
  const providersByCity = await ProviderProfile.aggregate([
    { $match: providerMatch },
    {
      $group: {
        _id: '$location.address.city',
        providerCount: { $sum: 1 }
      }
    },
    { $sort: { providerCount: -1 } }
  ]);

  // Calculate supply-demand ratios
  const cityRatios = demandByCity.map(d => {
    const providers = providersByCity.find(p => p._id === d._id);
    const providerCount = providers?.providerCount || 0;
    const ratio = providerCount > 0 ? d.activeBookings / providerCount : 0;

    return {
      city: d._id || 'Unknown',
      activeBookings: d.activeBookings,
      availableProviders: providerCount,
      ratio: Math.round(ratio * 100) / 100,
      status: ratio > 2 ? 'underserved' : ratio > 0.5 ? 'balanced' : 'overserved'
    };
  });

  // Peak vs off-peak analysis
  const avgHourlyBookings = peakHours.length > 0
    ? peakHours.reduce((sum, h) => sum + h.count, 0) / peakHours.length
    : 0;

  const peakHoursData = peakHours.map(h => ({
    hour: h._id,
    bookings: h.count,
    isPeak: h.count > avgHourlyBookings * 1.5
  }));

  // Summary
  const summary = {
    totalActiveProviders: activeProviders,
    totalActiveBookings: demandByCity.reduce((sum, d) => sum + d.activeBookings, 0),
    overallRatio: activeProviders > 0
      ? Math.round((demandByCity.reduce((sum, d) => sum + d.activeBookings, 0) / activeProviders) * 100) / 100
      : 0,
    underservedCities: cityRatios.filter(c => c.status === 'underserved').length,
    balancedCities: cityRatios.filter(c => c.status === 'balanced').length,
    overservedCities: cityRatios.filter(c => c.status === 'overserved').length
  };

  res.json({
    success: true,
    data: {
      byCity: cityRatios,
      byCategory: demandByCategory.map(d => ({
        category: d._id || 'Unknown',
        activeBookings: d.activeBookings
      })),
      peakHours: peakHoursData,
      pagination: {
        page,
        limit,
        total: demandByCity.length,
        pages: Math.ceil(demandByCity.length / limit)
      },
      summary
    }
  });
});

/**
 * GET /api/admin/provider-utilization
 * Provider capacity utilization metrics
 */
export const getProviderUtilization = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, minUtilization, maxUtilization, sortBy = 'utilization' } = req.query;

  // Parse dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // Build date filter
  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // Calculate booked hours per provider
  const bookedHours = await Booking.aggregate([
    {
      $match: {
        ...dateFilter,
        status: { $in: ['completed', 'in_progress'] }
      }
    },
    {
      $group: {
        _id: '$providerId',
        totalBookings: { $sum: 1 },
        totalHours: { $sum: { $divide: ['$duration', 60] } }, // Convert minutes to hours
        completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }
    }
  ]);

  // Get all providers with their availability
  const providers = await ProviderProfile.find({})
    .select('userId businessInfo locationInfo')
    .skip(skip)
    .limit(limit)
    .lean();

  // Calculate available hours per provider (assume 40 hours/week * weeks in period)
  const totalProviders = await ProviderProfile.countDocuments({});

  // Estimate available hours based on date range (default to 1 week if no dates)
  let weeksInPeriod = 1;
  if (parsedStartDate && parsedEndDate) {
    weeksInPeriod = Math.max(1, Math.ceil((parsedEndDate.getTime() - parsedStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  }

  // Calculate utilization for each provider
  const utilizationData = providers.map(provider => {
    const bookings = bookedHours.find(b => b._id.toString() === provider.userId.toString());
    const bookedHoursVal = bookings?.totalHours || 0;
    const availableHours = 40 * weeksInPeriod; // Assume 40 hours/week standard
    const utilization = availableHours > 0 ? (bookedHoursVal / availableHours) * 100 : 0;

    return {
      providerId: provider.userId,
      businessName: provider.businessInfo?.businessName || 'Unknown',
      city: (provider.locationInfo as any)?.primaryAddress?.city || 'Unknown',
      totalBookings: bookings?.totalBookings || 0,
      completedBookings: bookings?.completedBookings || 0,
      bookedHours: Math.round(bookedHoursVal * 100) / 100,
      availableHours,
      utilization: Math.round(utilization * 100) / 100,
      performanceLevel: utilization >= 80 ? 'high' : utilization >= 50 ? 'medium' : 'low'
    };
  });

  // Filter by utilization range
  const minUtil = Number(minUtilization) || 0;
  const maxUtil = Number(maxUtilization) || 100;

  const filteredData = utilizationData.filter(p =>
    p.utilization >= minUtil && p.utilization <= maxUtil
  );

  // Sort
  filteredData.sort((a, b) => {
    if (sortBy === 'utilization') return b.utilization - a.utilization;
    if (sortBy === 'bookings') return b.totalBookings - a.totalBookings;
    if (sortBy === 'hours') return b.bookedHours - a.bookedHours;
    return 0;
  });

  // Summary stats
  const allUtilizations = utilizationData.map(p => p.utilization);
  const summary = {
    totalProviders,
    avgUtilization: allUtilizations.length > 0
      ? Math.round(allUtilizations.reduce((sum, u) => sum + u, 0) / allUtilizations.length * 100) / 100
      : 0,
    highPerformers: utilizationData.filter(p => p.performanceLevel === 'high').length,
    mediumPerformers: utilizationData.filter(p => p.performanceLevel === 'medium').length,
    lowPerformers: utilizationData.filter(p => p.performanceLevel === 'low').length,
    totalBookedHours: utilizationData.reduce((sum, p) => sum + p.bookedHours, 0),
    totalAvailableHours: utilizationData.reduce((sum, p) => sum + p.availableHours, 0)
  };

  res.json({
    success: true,
    data: {
      providers: filteredData,
      pagination: {
        page,
        limit,
        total: totalProviders,
        pages: Math.ceil(totalProviders / limit)
      },
      summary
    }
  });
});

/**
 * GET /api/admin/geographic/performance
 * Geographic performance heatmap data
 */
export const getCityPerformance = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, groupBy = 'city' } = req.query;

  // Parse dates
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // Build date filter
  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  // Grouping field
  const groupField = groupBy === 'state' ? '$location.address.state' :
                     groupBy === 'area' ? '$location.address.area' :
                     '$location.address.city';

  const matchStage: any = { status: 'completed' };
  if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;

  // Get current period stats
  const cityStats = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupField,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        uniqueCustomers: { $addToSet: '$customerId' },
        uniqueProviders: { $addToSet: '$providerId' }
      }
    },
    {
      $addFields: {
        customerCount: { $size: '$uniqueCustomers' },
        providerCount: { $size: '$uniqueProviders' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  // Get ratings for each city
  const cityRatings = await Booking.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'bookingId',
        as: 'review'
      }
    },
    { $unwind: { path: '$review', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$location.address.city',
        avgRating: { $avg: '$review.rating' },
        reviewCount: { $sum: { $cond: [{ $ne: ['$review', null] }, 1, 0] } }
      }
    }
  ]);

  // Calculate growth trends (compare with previous period)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [currentPeriod, previousPeriod] = await Promise.all([
    Booking.aggregate([
      { $match: { ...matchStage, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: groupField,
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        }
      }
    ]),
    Booking.aggregate([
      { $match: { ...matchStage, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
      {
        $group: {
          _id: groupField,
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        }
      }
    ])
  ]);

  // Combine data with growth calculations
  const performanceData = cityStats.map(city => {
    const ratings = cityRatings.find(r => r._id === city._id);
    const current = currentPeriod.find(c => c._id === city._id) || { revenue: 0, bookings: 0 };
    const previous = previousPeriod.find(c => c._id === city._id) || { revenue: 0, bookings: 0 };

    const revenueGrowth = previous.revenue > 0
      ? ((current.revenue - previous.revenue) / previous.revenue) * 100
      : current.revenue > 0 ? 100 : 0;
    const bookingGrowth = previous.bookings > 0
      ? ((current.bookings - previous.bookings) / previous.bookings) * 100
      : current.bookings > 0 ? 100 : 0;

    return {
      region: city._id || 'Unknown',
      totalBookings: city.totalBookings,
      totalRevenue: Math.round(city.totalRevenue * 100) / 100,
      avgBookingValue: Math.round(city.avgBookingValue * 100) / 100,
      customerCount: city.customerCount,
      providerCount: city.providerCount,
      avgRating: ratings?.avgRating ? Math.round(ratings.avgRating * 10) / 10 : null,
      reviewCount: ratings?.reviewCount || 0,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      bookingGrowth: Math.round(bookingGrowth * 100) / 100,
      performanceScore: calculatePerformanceScore(city.totalRevenue, revenueGrowth, ratings?.avgRating || 0)
    };
  });

  // Sort by performance score
  performanceData.sort((a, b) => b.performanceScore - a.performanceScore);

  // Get total count for pagination
  const totalCount = await Booking.aggregate([
    { $match: matchStage },
    { $group: { _id: groupField } },
    { $count: 'total' }
  ]);

  // Summary
  const summary = {
    totalRegions: totalCount[0]?.total || 0,
    totalRevenue: performanceData.reduce((sum, p) => sum + p.totalRevenue, 0),
    totalBookings: performanceData.reduce((sum, p) => sum + p.totalBookings, 0),
    topPerformer: performanceData[0]?.region || null,
    avgGrowthRate: performanceData.length > 0
      ? Math.round(performanceData.reduce((sum, p) => sum + p.revenueGrowth, 0) / performanceData.length * 100) / 100
      : 0
  };

  res.json({
    success: true,
    data: {
      regions: performanceData,
      pagination: {
        page,
        limit,
        total: totalCount[0]?.total || 0,
        pages: Math.ceil((totalCount[0]?.total || 0) / limit)
      },
      summary
    }
  });
});

// Helper function to calculate performance score
function calculatePerformanceScore(revenue: number, growth: number, rating: number): number {
  // Weighted score: 50% revenue, 30% growth, 20% rating
  const revenueScore = Math.min(revenue / 10000, 1) * 50;
  const growthScore = Math.min(Math.max(growth + 50, 0) / 100, 1) * 30;
  const ratingScore = (rating / 5) * 20;
  return Math.round((revenueScore + growthScore + ratingScore) * 100) / 100;
}

/**
 * GET /api/admin/safe-search
 * Content moderation / blocked search terms admin
 */
export const getSafeSearchControls = asyncHandler(async (req: Request, res: Response) => {
  const { category, severity, isActive, search } = req.query;

  // Pagination
  const { page, limit, skip } = parsePagination(req);

  // Build filter
  const filter: any = {};
  if (category) filter.category = category;
  if (severity) filter.severity = severity;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) filter.term = { $regex: escapeRegex(search as string), $options: 'i' };

  const [terms, total, stats] = await Promise.all([
    BlockedTerm.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BlockedTerm.countDocuments(filter),
    // Get stats by category
    BlockedTerm.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]),
    // Get stats by severity
    BlockedTerm.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  // Format terms
  const formattedTerms = terms.map(t => ({
    id: t._id,
    term: t.term,
    reason: t.reason,
    category: t.category,
    severity: t.severity,
    matchType: t.matchType,
    isActive: t.isActive,
    createdBy: (t.createdBy as any) ? `${(t.createdBy as any).firstName} ${(t.createdBy as any).lastName}` : 'System',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  }));

  // Build category and severity stats
  const categoryStats: Record<string, { total: number; active: number }> = {};
  stats.forEach(s => {
    categoryStats[s._id || 'custom'] = {
      total: s.count,
      active: s.active || 0
    };
  });

  const severityStats: Record<string, number> = {};
  stats.forEach(s => {
    severityStats[s._id || 'medium'] = s.count;
  });

  res.json({
    success: true,
    data: {
      terms: formattedTerms,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalBlocked: total,
        byCategory: categoryStats,
        bySeverity: severityStats
      }
    }
  });
});

// =============================================================================
// P2 ADMIN WIDGET APIs - Incident Management, Report Builder, Churn, Winback
// =============================================================================

/**
 * GET /api/admin/incidents
 * Get platform incidents with filtering and pagination
 * Updated to match frontend IncidentManagement.tsx expectations
 */
export const getIncidents = asyncHandler(async (req: Request, res: Response) => {
  const { status, severity, priority, type, startDate, endDate, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Build filter (support both old severity and new priority field)
  const filter: any = {};
  if (status) filter.status = status;
  // Support both severity (legacy) and priority (frontend)
  if (severity) filter.priority = severity;
  if (priority) filter.priority = priority;
  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate as string);
    if (endDate) filter.createdAt.$lte = new Date(endDate as string);
  }

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Incident.countDocuments(filter)
  ]);

  // Get stats
  const [statusStats, priorityStats, typeStats] = await Promise.all([
    Incident.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Incident.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]),
    Incident.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ])
  ]);

  const statusCounts: Record<string, number> = {};
  statusStats.forEach(s => { if (s._id) statusCounts[s._id] = s.count; });

  const priorityCounts: Record<string, number> = {};
  priorityStats.forEach(s => { if (s._id) priorityCounts[s._id] = s.count; });

  const typeCounts: Record<string, number> = {};
  typeStats.forEach(s => { if (s._id) typeCounts[s._id] = s.count; });

  // Format response to match frontend Incident interface
  res.json({
    success: true,
    data: {
      incidents: incidents.map(i => {
        const incident = i as any;
        return {
          id: (i._id as any).toString(),
          ticketNumber: incident.ticketNumber || `INC-${(i._id as any).toString()}`,
          type: incident.type || 'complaint',
          priority: incident.priority || incident.severity || 'medium',
          status: i.status,
          category: incident.category || 'general',
          subject: incident.subject || '',
          description: i.description,
          customerId: incident.customerId?.toString(),
          customerName: incident.customerName,
          providerId: incident.providerId?.toString(),
          providerName: incident.providerName,
          bookingId: incident.bookingId?.toString(),
          assignedTo: incident.assignedTo?.toString(),
          createdAt: i.createdAt,
          updatedAt: incident.updatedAt,
          resolvedAt: i.resolvedAt,
          messages: incident.messages || [],
          resolution: incident.resolution,
          tags: incident.tags || [],
          slaDeadline: incident.slaDeadline
        };
      }),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) < Math.ceil(total / Number(limit)),
        hasPrev: Number(page) > 1,
        nextPage: Number(page) < Math.ceil(total / Number(limit)) ? Number(page) + 1 : null,
        prevPage: Number(page) > 1 ? Number(page) - 1 : null
      },
      stats: {
        total: total,
        open: statusCounts['open'] || 0,
        inProgress: statusCounts['in_progress'] || statusCounts['investigating'] || 0,
        pendingCustomer: statusCounts['pending_customer'] || 0,
        resolved: statusCounts['resolved'] || 0,
        closed: statusCounts['closed'] || 0,
        byType: Object.entries(typeCounts).map(([type, count]) => ({
          type,
          count,
          color: getTypeColor(type)
        })),
        byPriority: {
          low: priorityCounts['low'] || 0,
          medium: priorityCounts['medium'] || 0,
          high: priorityCounts['high'] || 0,
          critical: priorityCounts['critical'] || 0
        }
      }
    }
  });
});

// Helper function to get color for incident type
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    complaint: '#F59E0B',
    dispute: '#EF4444',
    technical: '#3B82F6',
    billing: '#8B5CF6',
    safety: '#DC2626'
  };
  return colors[type] || '#6B7280';
}

/**
 * POST /api/admin/incidents
 * Create a new platform incident
 * Updated to support frontend IncidentManagement.tsx fields
 */
export const createIncident = asyncHandler(async (req: Request, res: Response) => {
  const {
    type = 'complaint',
    priority,
    subject,
    description,
    customerId,
    customerName,
    providerId,
    providerName,
    bookingId,
    category,
    tags,
    severity // Support legacy severity field
  } = req.body;
  const adminUser = (req as any).user;

  if (!subject || !description) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: subject, description'
    });
    return;
  }

  // Create initial message from the description
  const initialMessage = {
    id: `m${Date.now()}`,
    senderId: adminUser._id.toString(),
    senderName: `${adminUser.firstName} ${adminUser.lastName}`,
    senderRole: 'admin' as const,
    message: description,
    timestamp: new Date()
  };

  // Calculate SLA deadline (48 hours for high priority, 24 hours for critical)
  const slaDeadline = new Date();
  if (priority === 'critical') {
    slaDeadline.setHours(slaDeadline.getHours() + 24);
  } else if (priority === 'high') {
    slaDeadline.setHours(slaDeadline.getHours() + 48);
  }

  const incident = await Incident.create({
    type,
    priority: priority || severity || 'medium',
    subject,
    description,
    category: category || type,
    status: 'open',
    customerId,
    customerName,
    providerId,
    providerName,
    bookingId,
    tags: tags || [],
    messages: [initialMessage],
    slaDeadline,
    createdBy: adminUser._id,
    // Legacy fields
    severity: severity || priority,
    affectedSystems: [],
    timeline: [{
      status: 'open',
      message: 'Incident created',
      createdBy: adminUser._id,
      createdAt: new Date()
    }]
  });

  await incident.populate('createdBy', 'firstName lastName email');

  logger.info('Incident created', {
    incidentId: incident._id,
    ticketNumber: incident.ticketNumber,
    subject,
    priority: incident.priority,
    createdBy: adminUser._id
  });

  res.status(201).json({
    success: true,
    data: {
      ...incident.toObject(),
      id: (incident._id as any).toString()
    }
  });
});

/**
 * PATCH /api/admin/incidents/:id
 * Update an incident status
 * Updated to support frontend IncidentManagement.tsx fields
 */
export const updateIncident = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    status,
    priority,
    subject,
    description,
    category,
    assignedTo,
    tags,
    message,
    resolution,
    outreachStatus // Support frontend outreach status field
  } = req.body;
  const adminUser = (req as any).user;

  const incident = await Incident.findById(id);
  if (!incident) {
    res.status(404).json({
      success: false,
      error: 'Incident not found'
    });
    return;
  }

  // Update fields
  if (status) incident.status = status;
  if (priority) incident.priority = priority;
  if (subject) incident.subject = subject;
  if (description) incident.description = description;
  if (category) incident.category = category;
  if (assignedTo) incident.assignedTo = assignedTo;
  if (tags) incident.tags = tags;
  if (resolution) incident.resolution = resolution;

  // Handle status transitions
  if (status) {
    if (status === 'resolved' || status === 'closed') {
      incident.resolvedAt = new Date();
      incident.resolvedBy = adminUser._id;
    }
  }

  // Add message if provided
  if (message) {
    incident.messages.push({
      id: `m${Date.now()}`,
      senderId: adminUser._id.toString(),
      senderName: `${adminUser.firstName} ${adminUser.lastName}`,
      senderRole: 'admin',
      message,
      timestamp: new Date()
    });
  }

  // Add timeline entry
  if (status || message) {
    incident.timeline = incident.timeline || [];
    incident.timeline.push({
      status: incident.status,
      message: message || `Status updated to ${status}`,
      createdBy: adminUser._id,
      createdAt: new Date()
    });
  }

  await incident.save();

  logger.info('Incident updated', {
    incidentId: incident._id,
    status: incident.status,
    updatedBy: adminUser._id
  });

  res.json({
    success: true,
    data: {
      id: (incident._id as any).toString(),
      ticketNumber: incident.ticketNumber,
      status: incident.status,
      priority: incident.priority,
      updatedAt: (incident as any).updatedAt
    }
  });
});

/**
 * GET /api/admin/reports/templates
 * Get report templates with filtering and pagination
 */
export const getReportTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { isActive, isDefault, dataSource, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Build filter
  const filter: any = {};
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isDefault !== undefined) filter.isDefault = isDefault === 'true';
  if (dataSource) filter['queryConfig.dataSource'] = dataSource;

  const [templates, total] = await Promise.all([
    ReportTemplate.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ReportTemplate.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      templates,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) < Math.ceil(total / Number(limit)),
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * POST /api/admin/reports/templates
 * Create a new report template
 */
export const createReportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, queryConfig, schedule } = req.body;
  const adminUser = (req as any).user;

  if (!name || !description || !queryConfig) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, description, queryConfig'
    });
    return;
  }

  const template = await ReportTemplate.create({
    name,
    description,
    queryConfig,
    schedule: schedule || { enabled: false },
    createdBy: adminUser._id,
    isDefault: false,
    isActive: true
  });

  await template.populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    data: template
  });
});

/**
 * PUT /api/admin/reports/templates/:id
 * Update a report template
 */
export const updateReportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const template = await ReportTemplate.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!template) {
    res.status(404).json({
      success: false,
      error: 'Report template not found'
    });
    return;
  }

  res.json({
    success: true,
    data: template
  });
});

/**
 * DELETE /api/admin/reports/templates/:id
 * Delete a report template
 */
export const deleteReportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const template = await ReportTemplate.findById(id);
  if (!template) {
    res.status(404).json({
      success: false,
      error: 'Report template not found'
    });
    return;
  }

  if (template.isDefault) {
    res.status(400).json({
      success: false,
      error: 'Cannot delete default report templates'
    });
    return;
  }

  await ReportTemplate.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Report template deleted successfully'
  });
});

/**
 * GET /api/admin/churn/predictions
 * Get churn predictions with heuristic-based risk assessment
 */
export const getChurnPredictions = asyncHandler(async (req: Request, res: Response) => {
  const { minRiskLevel = 'low', maxResults = 100, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Get customers with booking history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Risk level order for filtering
  const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const minRiskOrder = riskOrder[minRiskLevel as keyof typeof riskOrder] || 0;

  // Aggregate customer data for churn prediction
  const customerRisks = await Booking.aggregate([
    {
      $group: {
        _id: '$customerId',
        totalBookings: { $sum: 1 },
        completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalSpent: { $sum: '$pricing.totalAmount' },
        lastBooking: { $max: '$completedAt' },
        recentBookings: {
          $sum: { $cond: [{ $gte: ['$completedAt', thirtyDaysAgo] }, 1, 0] }
        },
        mediumTermBookings: {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ['$completedAt', sixtyDaysAgo] },
                { $lt: ['$completedAt', thirtyDaysAgo] }
              ]},
              1, 0
            ]
          }
        }
      }
    },
    { $lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'user'
    }},
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'supporttickets',
      let: { customerId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$customerId', '$$customerId'] } } },
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $count: 'count' }
      ],
      as: 'recentTickets'
    }}
  ]);

  // Calculate risk scores
  const atRiskCustomers = customerRisks.map(c => {
    let riskScore = 0;
    const riskFactors: Array<{ name: string; severity: 'low' | 'medium' | 'high'; contribution: number }> = [];

    // Days since last booking
    const daysSinceLastBooking = c.lastBooking
      ? Math.floor((Date.now() - new Date(c.lastBooking).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceLastBooking > 90) {
      riskScore += 40;
      riskFactors.push({ name: 'No booking in 90+ days', severity: 'high', contribution: 40 });
    } else if (daysSinceLastBooking > 60) {
      riskScore += 25;
      riskFactors.push({ name: 'No booking in 60+ days', severity: 'medium', contribution: 25 });
    } else if (daysSinceLastBooking > 30) {
      riskScore += 10;
      riskFactors.push({ name: 'No booking in 30+ days', severity: 'low', contribution: 10 });
    }

    // Engagement score based on booking frequency
    const engagementRatio = c.mediumTermBookings > 0
      ? c.recentBookings / c.mediumTermBookings
      : 0;

    if (engagementRatio < 0.3 && c.totalBookings > 1) {
      riskScore += 25;
      riskFactors.push({ name: 'Declining engagement', severity: 'high', contribution: 25 });
    } else if (engagementRatio < 0.6 && c.totalBookings > 1) {
      riskScore += 15;
      riskFactors.push({ name: 'Decreasing engagement', severity: 'medium', contribution: 15 });
    }

    // Support tickets
    const ticketCount = c.recentTickets[0]?.count || 0;
    if (ticketCount >= 3) {
      riskScore += 20;
      riskFactors.push({ name: 'Multiple recent support tickets', severity: 'medium', contribution: 20 });
    }

    // Single booking customers
    if (c.totalBookings === 1) {
      riskScore += 15;
      riskFactors.push({ name: 'Single booking customer', severity: 'low', contribution: 15 });
    }

    // Calculate churn probability (0-100%)
    const churnProbability = Math.min(100, riskScore);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      customerId: c._id,
      customerName: c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Unknown',
      email: c.user?.email,
      phone: c.user?.phone,
      churnProbability,
      riskLevel,
      riskScore,
      riskFactors,
      metrics: {
        totalBookings: c.totalBookings,
        completedBookings: c.completedBookings,
        totalSpent: c.totalSpent,
        daysSinceLastBooking,
        recentTickets: ticketCount
      },
      recommendedActions: getRecommendedActions(riskLevel, riskFactors)
    };
  })
    .filter(c => riskOrder[c.riskLevel] >= minRiskOrder)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, Number(maxResults));

  // Paginate results
  const paginatedResults = atRiskCustomers.slice(skip, skip + Number(limit));
  const totalFiltered = atRiskCustomers.length;

  // Summary stats
  const summary = {
    totalAtRisk: atRiskCustomers.length,
    byRiskLevel: {
      critical: atRiskCustomers.filter(c => c.riskLevel === 'critical').length,
      high: atRiskCustomers.filter(c => c.riskLevel === 'high').length,
      medium: atRiskCustomers.filter(c => c.riskLevel === 'medium').length,
      low: atRiskCustomers.filter(c => c.riskLevel === 'low').length
    },
    averageChurnProbability: atRiskCustomers.length > 0
      ? Math.round(atRiskCustomers.reduce((sum, c) => sum + c.churnProbability, 0) / atRiskCustomers.length)
      : 0,
    totalLifetimeValueAtRisk: atRiskCustomers
      .filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical')
      .reduce((sum, c) => sum + c.metrics.totalSpent, 0)
  };

  res.json({
    success: true,
    data: {
      predictions: paginatedResults,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalFiltered,
        pages: Math.ceil(totalFiltered / Number(limit)),
        hasNext: Number(page) < Math.ceil(totalFiltered / Number(limit)),
        hasPrev: Number(page) > 1
      },
      summary
    }
  });
});

/**
 * Helper function to get recommended actions based on risk level
 */
function getRecommendedActions(
  riskLevel: string,
  riskFactors: Array<{ name: string; severity: string; contribution: number }>
): Array<{ type: string; title: string; priority: string }> {
  const actions: Array<{ type: string; title: string; priority: string }> = [];

  if (riskLevel === 'critical' || riskLevel === 'high') {
    actions.push({ type: 'winback', title: 'Trigger win-back campaign', priority: 'high' });
    actions.push({ type: 'personal_outreach', title: 'Personal outreach call', priority: 'high' });
  }

  if (riskLevel === 'high') {
    actions.push({ type: 'special_offer', title: 'Send special discount offer', priority: 'medium' });
  }

  if (riskFactors.some(f => f.name === 'Declining engagement')) {
    actions.push({ type: 'engagement', title: 'Send engagement email series', priority: 'medium' });
  }

  if (riskFactors.some(f => f.name === 'Multiple recent support tickets')) {
    actions.push({ type: 'cs_checkin', title: 'Post-resolution follow-up', priority: 'medium' });
  }

  actions.push({ type: 'monitor', title: 'Add to monitoring list', priority: 'low' });

  return actions;
}

/**
 * GET /api/admin/automation/winback
 * Get win-back campaign dashboard stats
 */
export const getWinBackDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Get winback stats from automation module
  const stats = await getWinBackStats();

  // Get recent campaigns
  const dateFilter: any = {};
  if (startDate) dateFilter.$gte = new Date(startDate as string);
  if (endDate) dateFilter.$lte = new Date(endDate as string);

  const matchStage = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  // Dynamic import to avoid circular dependency
  const { WinBackCampaign } = await import('../automation/winBackCampaign');

  const [recentCampaigns, trendStats] = await Promise.all([
    WinBackCampaign.find(matchStage)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    WinBackCampaign.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ])
  ]);

  // Calculate engagement rates
  const totalCampaigns = stats.totalCampaigns || 0;
  const engagedCampaigns = (stats.byStatus as any)?.engaged || 0;
  const convertedCampaigns = (stats.byStatus as any)?.converted || 0;
  const engagementRate = totalCampaigns > 0 ? (engagedCampaigns / totalCampaigns) * 100 : 0;
  const conversionRate = totalCampaigns > 0 ? (convertedCampaigns / totalCampaigns) * 100 : 0;

  // Calculate ROI (simplified: revenue / campaign cost)
  const estimatedCampaignCost = totalCampaigns * 0.50; // $0.50 per campaign
  const roi = estimatedCampaignCost > 0 ? ((stats.totalRevenue || 0) - estimatedCampaignCost) / estimatedCampaignCost * 100 : 0;

  res.json({
    success: true,
    data: {
      overview: {
        totalCampaigns,
        activeCampaigns: (stats.byStatus as any)?.pending || 0,
        engagedCampaigns,
        convertedCampaigns,
        failedCampaigns: (stats.byStatus as any)?.failed || 0,
        skippedCampaigns: (stats.byStatus as any)?.skipped || 0
      },
      performance: {
        engagementRate: Math.round(engagementRate * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageConversionTimeHours: Math.round((stats.averageConversionTime || 0) * 10) / 10,
        totalRevenue: stats.totalRevenue || 0,
        roi: Math.round(roi * 100) / 100
      },
      byCampaignType: stats.byType || {},
      recentCampaigns: recentCampaigns.map(c => ({
        _id: c._id,
        customerName: c.userId ? `${(c.userId as any).firstName} ${(c.userId as any).lastName}` : 'Unknown',
        customerEmail: (c.userId as any)?.email,
        campaignType: c.campaignType,
        status: c.status,
        offer: c.offer,
        createdAt: c.createdAt,
        convertedAt: (c as any).conversion?.convertedAt
      })),
      trendData: trendStats.map(t => ({
        date: t._id,
        total: t.total,
        converted: t.converted,
        rate: t.total > 0 ? Math.round((t.converted / t.total) * 100) : 0
      }))
    }
  });
});

// ============================================
// P2 WIDGET IMPLEMENTATIONS (VIP, Forecasting, P&L, UnitEcon, Journey, Funnel)
// ============================================

// LTV segment thresholds (AED)
const P2_LTV_THRESHOLDS = {
  platinum: 5000,
  gold: 2500,
  silver: 1000,
  regular: 0
};

/**
 * GET /api/admin/vip/segment
 * VIP Customer Segmentation based on Lifetime Value (LTV)
 */
export const getVIPSegment = asyncHandler(async (req: Request, res: Response) => {
  const { segment } = req.query;

  // Calculate LTV for each customer based on completed booking history
  const customerLTV = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        customerId: { $ne: null },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$customerId',
        totalSpent: { $sum: '$pricing.totalAmount' },
        bookingCount: { $sum: 1 },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        lastBookingDate: { $max: '$completedAt' },
        firstBookingDate: { $min: '$createdAt' }
      }
    },
    {
      $addFields: {
        daysSinceFirstBooking: {
          $divide: [
            { $subtract: [new Date(), '$firstBookingDate'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    }
  ]);

  // Segment customers based on LTV thresholds
  const segments = {
    platinum: customerLTV.filter(c => c.totalSpent >= P2_LTV_THRESHOLDS.platinum),
    gold: customerLTV.filter(c => c.totalSpent >= P2_LTV_THRESHOLDS.gold && c.totalSpent < P2_LTV_THRESHOLDS.platinum),
    silver: customerLTV.filter(c => c.totalSpent >= P2_LTV_THRESHOLDS.silver && c.totalSpent < P2_LTV_THRESHOLDS.gold),
    regular: customerLTV.filter(c => c.totalSpent < P2_LTV_THRESHOLDS.silver)
  };

  // Calculate segment stats
  const getSegmentStats = (customers: typeof customerLTV) => {
    if (customers.length === 0) {
      return { count: 0, avgLTV: 0, avgBookings: 0, avgBookingValue: 0 };
    }
    return {
      count: customers.length,
      avgLTV: customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length,
      avgBookings: customers.reduce((sum, c) => sum + c.bookingCount, 0) / customers.length,
      avgBookingValue: customers.reduce((sum, c) => sum + c.avgBookingValue, 0) / customers.length
    };
  };

  const segmentStats = {
    platinum: getSegmentStats(segments.platinum),
    gold: getSegmentStats(segments.gold),
    silver: getSegmentStats(segments.silver),
    regular: getSegmentStats(segments.regular)
  };

  // Get top customers per segment
  const getTopCustomers = (customers: typeof customerLTV, limit: number = 10) => {
    return customers
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  };

  // Return specific segment or all segments
  let result;
  if (segment && ['platinum', 'gold', 'silver', 'regular'].includes(segment as string)) {
    const seg = segment as keyof typeof segments;
    result = {
      segment: seg,
      ...segmentStats[seg],
      topCustomers: getTopCustomers(segments[seg], 50)
    };
  } else {
    result = {
      segments: segmentStats,
      totals: {
        totalCustomers: customerLTV.length,
        totalRevenue: customerLTV.reduce((sum, c) => sum + c.totalSpent, 0),
        overallAvgLTV: customerLTV.length > 0 ? customerLTV.reduce((sum, c) => sum + c.totalSpent, 0) / customerLTV.length : 0
      }
    };
  }

  res.json({ success: true, data: result });
});

/**
 * GET /api/admin/forecasting
 * Simple trend forecasting from historical booking data
 */
export const getForecasting = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'monthly', horizon = '3' } = req.query;
  const horizonMonths = Math.min(12, Math.max(1, parseInt(horizon as string) || 3));

  // Determine grouping based on period
  const groupFormat = period === 'weekly'
    ? { year: { $isoWeekYear: '$completedAt' }, week: { $isoWeek: '$completedAt' } }
    : { year: { $year: '$completedAt' }, month: { $month: '$completedAt' } };

  // Get historical data
  const historicalData = await Booking.aggregate([
    { $match: { status: 'completed', completedAt: { $ne: null }, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: groupFormat,
        revenue: { $sum: '$pricing.totalAmount' },
        bookings: { $sum: 1 },
        avgBookingValue: { $avg: '$pricing.totalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } },
    { $limit: 52 }
  ]);

  const revenueData = historicalData.map(d => d.revenue);
  const bookingData = historicalData.map(d => d.bookings);

  // Simple linear trend calculation
  const calculateTrend = (data: number[]) => {
    if (data.length < 2) return { slope: 0, intercept: data[0] || 0 };
    const n = data.length;
    const indices = data.map((_, i) => i);
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * data[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  };

  const revenueTrend = calculateTrend(revenueData);
  const bookingTrend = calculateTrend(bookingData);

  // Generate forecasts
  const forecasts = [];
  const lastPeriod = historicalData[historicalData.length - 1]?._id || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

  for (let i = 1; i <= horizonMonths; i++) {
    const forecastIndex = historicalData.length + i - 1;
    const revenueForecast = Math.max(0, revenueTrend.slope * forecastIndex + revenueTrend.intercept);
    const bookingForecast = Math.max(0, bookingTrend.slope * forecastIndex + bookingTrend.intercept);

    let periodLabel;
    if (period === 'weekly') {
      const weekNum = ((lastPeriod.week || 1) + i - 1) % 52 + 1;
      periodLabel = `${lastPeriod.year}W${String(weekNum).padStart(2, '0')}`;
    } else {
      const monthNum = ((lastPeriod.month || 1) + i - 1) % 12 + 1;
      const yearNum = (lastPeriod.year || 2024) + Math.floor(((lastPeriod.month || 1) + i - 1) / 12);
      periodLabel = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
    }

    forecasts.push({
      period: periodLabel,
      projectedRevenue: Math.round(revenueForecast * 100) / 100,
      projectedBookings: Math.round(bookingForecast * 10) / 10,
      projectedAvgValue: historicalData.length > 0 ? Math.round((revenueForecast / Math.max(bookingForecast, 1)) * 100) / 100 : 0
    });
  }

  const dataPoints = historicalData.length;
  const confidence = dataPoints >= 12 ? 'high' : dataPoints >= 6 ? 'medium' : 'low';
  const avgRevenue = revenueData.length > 0 ? revenueData.reduce((a, b) => a + b, 0) / revenueData.length : 0;
  const recentAvg = revenueData.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, revenueData.length);
  const trendDirection = recentAvg > avgRevenue * 1.05 ? 'up' : recentAvg < avgRevenue * 0.95 ? 'down' : 'stable';

  res.json({
    success: true,
    data: {
      historical: historicalData.map(d => ({
        period: period === 'weekly' ? `${d._id.year}W${String(d._id.week).padStart(2, '0')}` : `${d._id.year}-${String(d._id.month).padStart(2, '0')}`,
        revenue: Math.round(d.revenue * 100) / 100,
        bookings: d.bookings,
        avgBookingValue: Math.round(d.avgBookingValue * 100) / 100
      })),
      forecasts,
      summary: {
        dataPoints,
        confidence,
        trendDirection,
        avgRevenue: Math.round(avgRevenue * 100) / 100,
        avgBookings: historicalData.length > 0 ? Math.round((historicalData.reduce((sum, d) => sum + d.bookings, 0) / historicalData.length) * 10) / 10 : 0,
        totalHistoricalRevenue: Math.round(historicalData.reduce((sum, d) => sum + d.revenue, 0) * 100) / 100,
        projectedTotalRevenue: Math.round(forecasts.reduce((sum, f) => sum + f.projectedRevenue, 0) * 100) / 100
      }
    }
  });
});

/**
 * GET /api/admin/provider-pl
 * Provider Profit & Loss Report
 */
export const getProviderPLReport = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, providerId } = req.query;

  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  const matchFilter: any = { status: 'completed', isDeleted: { $ne: true } };
  if (Object.keys(dateFilter).length) matchFilter.completedAt = dateFilter;
  if (providerId) matchFilter.providerId = new mongoose.Types.ObjectId(providerId as string);

  // Get provider P&L data
  const providerPL = await Booking.aggregate([
    { $match: matchFilter },
    { $lookup: { from: 'commissions', localField: '_id', foreignField: 'bookingId', as: 'commission' } },
    { $unwind: { path: '$commission', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'refunds', localField: '_id', foreignField: 'bookingId', as: 'refund' } },
    { $unwind: { path: '$refund', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$providerId',
        totalRevenue: { $sum: '$pricing.totalAmount' },
        grossRevenue: { $sum: '$pricing.subtotal' },
        totalTax: { $sum: '$pricing.tax' },
        totalDiscount: { $sum: '$pricing.couponDiscount' },
        bookingCount: { $sum: 1 },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        totalCommission: { $sum: { $ifNull: ['$commission.commissionAmount', 0] } },
        totalPlatformFee: { $sum: { $ifNull: ['$commission.platformFee', 0] } },
        totalPaymentFee: { $sum: { $ifNull: ['$commission.paymentProcessingFee', 0] } },
        totalRefunds: { $sum: { $cond: [{ $eq: ['$refund.status', 'processed'] }, '$refund.amount', 0] } }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  const providerIds = providerPL.map(p => p._id);
  const providers = await User.find({ _id: { $in: providerIds } }).select('_id firstName lastName').lean();
  const providerMap = new Map(providers.map(p => [p._id.toString(), `${p.firstName} ${p.lastName}`]));

  const enrichedPL = providerPL.map(p => ({
    providerId: p._id,
    providerName: providerMap.get(p._id.toString()) || 'Unknown Provider',
    totalRevenue: Math.round(p.totalRevenue * 100) / 100,
    grossRevenue: Math.round(p.grossRevenue * 100) / 100,
    totalTax: Math.round(p.totalTax * 100) / 100,
    totalDiscount: Math.round(p.totalDiscount * 100) / 100,
    bookingCount: p.bookingCount,
    avgBookingValue: Math.round(p.avgBookingValue * 100) / 100,
    deductions: {
      commission: Math.round(p.totalCommission * 100) / 100,
      platformFee: Math.round(p.totalPlatformFee * 100) / 100,
      paymentFee: Math.round(p.totalPaymentFee * 100) / 100,
      refunds: Math.round(p.totalRefunds * 100) / 100,
      total: Math.round((p.totalCommission + p.totalPlatformFee + p.totalPaymentFee + p.totalRefunds) * 100) / 100
    },
    netProfit: Math.round((p.totalRevenue - p.totalCommission - p.totalPlatformFee - p.totalPaymentFee - p.totalRefunds) * 100) / 100,
    profitMargin: p.totalRevenue > 0 ? Math.round(((p.totalRevenue - p.totalCommission - p.totalPlatformFee - p.totalPaymentFee - p.totalRefunds) / p.totalRevenue) * 10000) / 100 : 0
  }));

  const totals = enrichedPL.reduce((acc, p) => ({
    totalRevenue: acc.totalRevenue + p.totalRevenue,
    totalDeductions: acc.totalDeductions + p.deductions.total,
    totalRefunds: acc.totalRefunds + p.deductions.refunds,
    totalBookings: acc.totalBookings + p.bookingCount
  }), { totalRevenue: 0, totalDeductions: 0, totalRefunds: 0, totalBookings: 0 });

  res.json({
    success: true,
    data: {
      providers: enrichedPL,
      totals: {
        ...totals,
        totalRevenue: Math.round(totals.totalRevenue * 100) / 100,
        totalDeductions: Math.round(totals.totalDeductions * 100) / 100,
        totalRefunds: Math.round(totals.totalRefunds * 100) / 100,
        netProfit: Math.round((totals.totalRevenue - totals.totalDeductions) * 100) / 100,
        avgProfitMargin: totals.totalRevenue > 0 ? Math.round(((totals.totalRevenue - totals.totalDeductions) / totals.totalRevenue) * 10000) / 100 : 0
      },
      summary: {
        totalProviders: enrichedPL.length,
        profitableProviders: enrichedPL.filter(p => p.netProfit > 0).length,
        unprofitableProviders: enrichedPL.filter(p => p.netProfit < 0).length,
        avgBookingValue: enrichedPL.length > 0 ? Math.round(enrichedPL.reduce((sum, p) => sum + p.avgBookingValue, 0) / enrichedPL.length * 100) / 100 : 0
      }
    }
  });
});

/**
 * GET /api/admin/unit-economics
 * Unit Economics Dashboard - CAC, LTV, Contribution Margin
 */
export const getUnitEconomics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;
  const matchFilter: any = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  // Get customer acquisition data
  const adSpendData = await Booking.aggregate([
    { $match: { ...matchFilter, 'attribution.source': 'ad', status: 'completed' } },
    { $group: { _id: null, adBookings: { $sum: 1 }, adRevenue: { $sum: '$pricing.totalAmount' } } }
  ]);

  const adBookings = adSpendData[0]?.adBookings || 0;
  const adRevenue = adSpendData[0]?.adRevenue || 0;
  const estimatedAdSpend = adRevenue * 0.3;
  const estimatedCAC = adBookings > 0 ? estimatedAdSpend / adBookings : 0;

  // Get customer LTV
  const customerLTV = await Booking.aggregate([
    { $match: { status: 'completed', customerId: { $ne: null }, isDeleted: { $ne: true } } },
    { $group: { _id: '$customerId', totalSpent: { $sum: '$pricing.totalAmount' }, bookingCount: { $sum: 1 } } }
  ]);

  const totalCustomers = customerLTV.length;
  const avgLTV = totalCustomers > 0 ? customerLTV.reduce((sum, c) => sum + c.totalSpent, 0) / totalCustomers : 0;
  const ltvCacRatio = estimatedCAC > 0 ? avgLTV / estimatedCAC : 0;

  // Get booking-level economics
  const bookingEconomics = await Booking.aggregate([
    { $match: { status: 'completed', isDeleted: { $ne: true }, ...(Object.keys(dateFilter).length ? { completedAt: dateFilter } : {}) } },
    { $lookup: { from: 'commissions', localField: '_id', foreignField: 'bookingId', as: 'commission' } },
    { $unwind: { path: '$commission', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        avgBookingValue: { $avg: '$pricing.totalAmount' },
        avgRevenuePerBooking: { $avg: '$pricing.subtotal' },
        avgCommission: { $avg: { $ifNull: ['$commission.commissionAmount', 0] } },
        avgPlatformFee: { $avg: { $ifNull: ['$commission.platformFee', 0] } },
        avgPaymentFee: { $avg: { $ifNull: ['$commission.paymentProcessingFee', 0] } },
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);

  const economics = bookingEconomics[0] || { avgBookingValue: 0, avgRevenuePerBooking: 0, avgCommission: 0, avgPlatformFee: 0, avgPaymentFee: 0, totalBookings: 0, totalRevenue: 0 };
  const avgVariableCost = economics.avgCommission + economics.avgPlatformFee + economics.avgPaymentFee;
  const contributionMargin = economics.avgRevenuePerBooking - avgVariableCost;
  const contributionMarginPercent = economics.avgRevenuePerBooking > 0 ? (contributionMargin / economics.avgRevenuePerBooking) * 100 : 0;

  res.json({
    success: true,
    data: {
      summary: {
        totalCustomers,
        totalBookings: economics.totalBookings,
        totalRevenue: Math.round(economics.totalRevenue * 100) / 100,
        avgLTV: Math.round(avgLTV * 100) / 100,
        estimatedCAC: Math.round(estimatedCAC * 100) / 100,
        ltvCacRatio: Math.round(ltvCacRatio * 10) / 10,
        paybackPeriodMonths: estimatedCAC > 0 && avgLTV > 0 ? Math.round((estimatedCAC / (avgLTV / 12)) * 10) / 10 : 0
      },
      perBookingMetrics: {
        avgBookingValue: Math.round(economics.avgBookingValue * 100) / 100,
        avgRevenuePerBooking: Math.round(economics.avgRevenuePerBooking * 100) / 100,
        avgVariableCost: Math.round(avgVariableCost * 100) / 100,
        contributionMargin: Math.round(contributionMargin * 100) / 100,
        contributionMarginPercent: Math.round(contributionMarginPercent * 100) / 100
      },
      insights: {
        healthStatus: ltvCacRatio >= 3 ? 'excellent' : ltvCacRatio >= 1 ? 'healthy' : 'concerning',
        recommendation: ltvCacRatio >= 3
          ? 'LTV/CAC ratio is excellent. Consider increasing acquisition spend.'
          : ltvCacRatio >= 1 ? 'LTV/CAC ratio is healthy. Focus on improving customer retention.'
          : 'LTV/CAC ratio needs improvement. Reduce acquisition costs or increase customer value.'
      }
    }
  });
});

/**
 * GET /api/admin/customer-journey
 * Customer Journey Funnel - Stage counts and conversion rates
 */
export const getCustomerJourney = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  const signupMatch: any = { isDeleted: { $ne: true } };
  if (Object.keys(dateFilter).length) signupMatch.createdAt = dateFilter;

  const [signupData, searchData, bookingData, completionData] = await Promise.all([
    User.aggregate([
      { $match: { ...signupMatch, role: 'customer' } },
      { $group: { _id: null, totalSignups: { $sum: 1 }, verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } } } }
    ]),
    Booking.aggregate([
      { $match: { ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}), isDeleted: { $ne: true } } },
      { $group: { _id: '$customerId' } },
      { $group: { _id: null, usersWhoSearched: { $sum: 1 } } }
    ]),
    Booking.aggregate([
      { $match: { isDeleted: { $ne: true }, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) } },
      {
        $group: {
          _id: null, totalBookings: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$customerId' },
          pendingBookings: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          confirmedBookings: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } }
        }
      },
      { $addFields: { uniqueCustomerCount: { $size: '$uniqueCustomers' } } }
    ]),
    Booking.aggregate([
      { $match: { status: 'completed', isDeleted: { $ne: true }, ...(Object.keys(dateFilter).length ? { completedAt: dateFilter } : {}) } },
      {
        $group: {
          _id: null, totalCompleted: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$customerId' },
          totalRevenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $addFields: { uniqueCustomerCount: { $size: '$uniqueCustomers' } } }
    ])
  ]);

  const signups = signupData[0]?.totalSignups || 0;
  const verifiedUsers = signupData[0]?.verifiedUsers || 0;
  const usersWhoSearched = searchData[0]?.usersWhoSearched || 0;
  const totalBookings = bookingData[0]?.totalBookings || 0;
  const bookingCustomers = bookingData[0]?.uniqueCustomerCount || 0;
  const completedBookings = completionData[0]?.totalCompleted || 0;
  const completedCustomers = completionData[0]?.uniqueCustomerCount || 0;
  const totalRevenue = completionData[0]?.totalRevenue || 0;

  const signupToSearch = signups > 0 ? (usersWhoSearched / signups) * 100 : 0;
  const searchToBooking = usersWhoSearched > 0 ? (bookingCustomers / usersWhoSearched) * 100 : 0;
  const bookingToComplete = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
  const overallConversion = signups > 0 ? (completedBookings / signups) * 100 : 0;

  res.json({
    success: true,
    data: {
      funnel: {
        signups: { count: signups, verified: verifiedUsers, percentage: 100 },
        searches: { count: usersWhoSearched, percentage: Math.round(signupToSearch * 100) / 100, dropoff: Math.round((100 - signupToSearch) * 100) / 100 },
        bookings: { count: totalBookings, uniqueCustomers: bookingCustomers, percentage: Math.round(searchToBooking * 100) / 100, dropoff: Math.round((100 - searchToBooking) * 100) / 100 },
        completions: { count: completedBookings, uniqueCustomers: completedCustomers, percentage: Math.round(bookingToComplete * 100) / 100, dropoff: Math.round((100 - bookingToComplete) * 100) / 100, revenue: Math.round(totalRevenue * 100) / 100 }
      },
      conversionRates: {
        signupToSearch: Math.round(signupToSearch * 100) / 100,
        searchToBooking: Math.round(searchToBooking * 100) / 100,
        bookingToComplete: Math.round(bookingToComplete * 100) / 100,
        overallConversion: Math.round(overallConversion * 100) / 100
      },
      insights: {
        biggestDropoff: signupToSearch < searchToBooking && signupToSearch < bookingToComplete ? 'signup_to_search' : searchToBooking < bookingToComplete ? 'search_to_booking' : 'booking_to_complete',
        recommendation: signupToSearch < 50 ? 'Low signup-to-search conversion. Improve onboarding and product discovery.' : searchToBooking < 30 ? 'Low search-to-booking conversion. Focus on service quality and pricing.' : bookingToComplete < 70 ? 'High booking abandonment. Improve booking experience and provider response time.' : 'Funnel is performing well. Focus on customer retention and upselling.'
      }
    }
  });
});

/**
 * GET /api/admin/funnel-dropoff
 * Funnel Drop-off Analysis - Where users abandon the booking process
 */
export const getFunnelDropOff = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  const dateFilter: any = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;
  const matchFilter = Object.keys(dateFilter).length ? dateFilter : {};

  const bookingStatuses = await Booking.aggregate([
    { $match: { isDeleted: { $ne: true }, ...(Object.keys(matchFilter).length ? { createdAt: matchFilter } : {}) } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$pricing.totalAmount' } } }
  ]);

  const cancellationDetails = await Booking.aggregate([
    { $match: { status: 'cancelled', isDeleted: { $ne: true }, ...(Object.keys(matchFilter).length ? { cancelledAt: matchFilter } : {}) } },
    { $group: { _id: { reason: '$cancellationReason' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  const statusMap = new Map(bookingStatuses.map(s => [s._id, s]));
  const totalBookings = bookingStatuses.reduce((sum, s) => sum + s.count, 0);
  const pending = statusMap.get('pending')?.count || 0;
  const confirmed = statusMap.get('confirmed')?.count || 0;
  const inProgress = statusMap.get('in_progress')?.count || 0;
  const completed = statusMap.get('completed')?.count || 0;
  const cancelled = statusMap.get('cancelled')?.count || 0;
  const noShow = statusMap.get('no_show')?.count || 0;
  const refunded = statusMap.get('refunded')?.count || 0;

  const reasonGroups = new Map<string, number>();
  cancellationDetails.forEach(c => {
    const reason = c._id.reason || 'unknown';
    reasonGroups.set(reason, (reasonGroups.get(reason) || 0) + c.count);
  });

  res.json({
    success: true,
    data: {
      funnelStages: {
        pending: { count: pending, percentage: totalBookings > 0 ? Math.round((pending / totalBookings) * 10000) / 100 : 0 },
        confirmed: { count: confirmed, percentage: pending > 0 ? Math.round((confirmed / pending) * 10000) / 100 : 0, dropoffFromPending: pending > 0 ? Math.round(((pending - confirmed) / pending) * 10000) / 100 : 0 },
        in_progress: { count: inProgress, percentage: confirmed > 0 ? Math.round((inProgress / confirmed) * 10000) / 100 : 0, dropoffFromConfirmed: confirmed > 0 ? Math.round(((confirmed - inProgress) / confirmed) * 10000) / 100 : 0 },
        completed: { count: completed, percentage: totalBookings > 0 ? Math.round((completed / totalBookings) * 10000) / 100 : 0, dropoffFromInProgress: inProgress > 0 ? Math.round(((inProgress - completed) / inProgress) * 10000) / 100 : 0, revenue: Math.round((statusMap.get('completed')?.totalAmount || 0) * 100) / 100 }
      },
      terminalStatuses: {
        cancelled: { count: cancelled, percentage: totalBookings > 0 ? Math.round((cancelled / totalBookings) * 10000) / 100 : 0, revenue: Math.round((statusMap.get('cancelled')?.totalAmount || 0) * 100) / 100 },
        no_show: { count: noShow, percentage: totalBookings > 0 ? Math.round((noShow / totalBookings) * 10000) / 100 : 0 },
        refunded: { count: refunded, percentage: totalBookings > 0 ? Math.round((refunded / totalBookings) * 10000) / 100 : 0, revenue: Math.round((statusMap.get('refunded')?.totalAmount || 0) * 100) / 100 }
      },
      dropoffReasons: Array.from(reasonGroups.entries()).map(([reason, count]) => ({ reason: reason || 'unknown', count, percentage: totalBookings > 0 ? Math.round((count / totalBookings) * 10000) / 100 : 0 })).sort((a, b) => b.count - a.count),
      summary: {
        totalBookings,
        completionRate: totalBookings > 0 ? Math.round((completed / totalBookings) * 10000) / 100 : 0,
        cancellationRate: totalBookings > 0 ? Math.round((cancelled / totalBookings) * 10000) / 100 : 0,
        biggestDropoffStage: confirmed > 0 && (pending - confirmed) / pending > 0.3 ? 'pending_to_confirmed' : inProgress > 0 && (confirmed - inProgress) / confirmed > 0.1 ? 'confirmed_to_in_progress' : 'completed'
      },
      insights: {
        criticalStage: confirmed > 0 && (pending - confirmed) / pending > 0.3 ? 'Provider confirmation - many bookings not confirmed' : inProgress > 0 && (confirmed - inProgress) / confirmed > 0.1 ? 'Service delivery - high dropout during service' : 'low_dropoff',
        recommendation: (pending - confirmed) / pending > 0.3 ? 'High drop-off at confirmation stage. Consider automatic confirmation or provider incentives.' : (confirmed - inProgress) / confirmed > 0.1 ? 'High drop-off before service. Improve scheduling and reminders.' : 'Funnel is healthy with good conversion rates.'
      }
    }
  });
});

// ============================================
// P3 ADMIN WIDGET APIs - WeatherImpact, TrainingAcademy, MagicNumber
// ============================================

// Import training academy service
import { trainingAcademyService } from '../services/trainingAcademy.service';

/**
 * GET /api/admin/weather-impact
 * Weather Impact Analysis - Weather data correlation with booking volume
 */
export const getWeatherImpact = asyncHandler(async (req: Request, res: Response) => {
  const { days = 30, city, latitude, longitude } = req.query;

  // Parse location parameters
  const lat = latitude ? parseFloat(latitude as string) : 25.2048; // Default Dubai
  const lon = longitude ? parseFloat(longitude as string) : 55.2708;
  const numDays = Math.min(365, Math.max(7, parseInt(days as string) || 30));

  // Dynamic import to avoid circular dependencies
  const { weatherService } = await import('../services/weather.service');

  // Get current weather and forecast
  const weatherData = await weatherService.getWeather(lat, lon);
  const alerts = await weatherService.getWeatherAlerts(lat, lon);

  // Calculate date range for historical correlation
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - numDays);

  // Fetch booking data for correlation analysis
  const dateFilter: any = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const bookingMatch: any = {
    status: { $in: ['completed', 'confirmed'] },
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {})
  };

  // Add city filter if provided
  if (city) {
    bookingMatch['location.address.city'] = city;
  }

  // Aggregate bookings by day
  const bookingsByDay = await Booking.aggregate([
    { $match: bookingMatch },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.totalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get historical weather data
  const historicalWeather = await weatherService.getHistoricalWeather(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0],
    lat, lon
  );

  // Calculate weather-booking correlations
  const weatherBookingsMap = new Map(bookingsByDay.map(b => [b._id, b]));
  const weatherCorrelation: Record<string, { condition: string; avgBookings: number; avgRevenue: number; days: number }> = {};

  historicalWeather.forEach(day => {
    const bookingData = weatherBookingsMap.get(day.date);
    const condition = day.temperatureMean > 35 ? 'hot' :
                      day.temperatureMean < 15 ? 'cold' :
                      day.precipitationSum > 5 ? 'rainy' : 'moderate';

    if (!weatherCorrelation[condition]) {
      weatherCorrelation[condition] = { condition, avgBookings: 0, avgRevenue: 0, days: 0 };
    }
    weatherCorrelation[condition].avgBookings += bookingData?.count || 0;
    weatherCorrelation[condition].avgRevenue += bookingData?.revenue || 0;
    weatherCorrelation[condition].days++;
  });

  // Calculate averages
  Object.keys(weatherCorrelation).forEach(condition => {
    const data = weatherCorrelation[condition];
    if (data.days > 0) {
      data.avgBookings = Math.round(data.avgBookings / data.days);
      data.avgRevenue = Math.round(data.avgRevenue);
    }
  });

  // Calculate overall statistics
  const totalBookings = bookingsByDay.reduce((sum, b) => sum + b.count, 0);
  const totalRevenue = bookingsByDay.reduce((sum, b) => sum + b.revenue, 0);
  const avgDailyBookings = bookingsByDay.length > 0 ? Math.round(totalBookings / bookingsByDay.length) : 0;

  // Get weather-based impact score
  const currentCondition = weatherData.current.condition;
  let impactMultiplier = 1.0;
  let impactDescription = 'Normal booking activity expected';

  if (currentCondition === 'rainy' || currentCondition === 'stormy') {
    impactMultiplier = 0.85;
    impactDescription = 'Reduced outdoor services due to precipitation';
  } else if (currentCondition === 'sunny' && weatherData.current.temperature < 35) {
    impactMultiplier = 1.15;
    impactDescription = 'Favorable weather for outdoor services';
  } else if (weatherData.current.temperature > 40) {
    impactMultiplier = 0.9;
    impactDescription = 'Extreme heat may reduce demand for outdoor services';
  }

  res.json({
    success: true,
    data: {
      currentWeather: {
        condition: weatherData.current.condition,
        temperature: weatherData.current.temperature,
        humidity: weatherData.current.humidity,
        windSpeed: weatherData.current.windSpeed,
        precipitation: weatherData.current.precipitation
      },
      forecast: weatherData.daily.slice(0, 7).map(d => ({
        date: d.date,
        condition: d.condition,
        temperatureHigh: d.temperatureMax,
        temperatureLow: d.temperatureMin,
        precipitationProbability: d.precipitationProbability,
        precipitationSum: d.precipitationSum
      })),
      alerts: alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message
      })),
      impactAnalysis: {
        currentImpact: {
          multiplier: impactMultiplier,
          description: impactDescription
        },
        weatherCorrelation: Object.values(weatherCorrelation).sort((a, b) => b.avgBookings - a.avgBookings),
        bookingImpact: {
          totalBookings,
          totalRevenue: Math.round(totalRevenue),
          avgDailyBookings,
          daysAnalyzed: bookingsByDay.length
        }
      },
      recommendations: generateWeatherRecommendations(weatherData, alerts)
    }
  });
});

/**
 * Generate weather-based operational recommendations
 */
function generateWeatherRecommendations(
  weatherData: any,
  alerts: any[]
): string[] {
  const recommendations: string[] = [];

  // Temperature-based recommendations
  if (weatherData.current.temperature > 42) {
    recommendations.push('Extreme heat advisory - promote indoor/AC services');
  } else if (weatherData.current.temperature > 38) {
    recommendations.push('High temperature expected - schedule outdoor services for early morning/evening');
  }

  // Rain-based recommendations
  const rainyDays = weatherData.daily.filter((d: any) => d.precipitationProbability > 60).length;
  if (rainyDays >= 3) {
    recommendations.push(`${rainyDays} days with high rain probability - promote weatherproof services`);
  }

  // Wind-based recommendations
  if (weatherData.current.windSpeed > 40) {
    recommendations.push('High winds - reschedule outdoor appointments if possible');
  }

  // Alert-based recommendations
  alerts.forEach(alert => {
    if (alert.severity === 'high') {
      recommendations.push(`ALERT: ${alert.message}`);
    }
  });

  // Favorable weather
  if (weatherData.current.condition === 'sunny' && weatherData.current.temperature < 35 && !alerts.length) {
    recommendations.push('Favorable weather - great time for outdoor service promotions');
  }

  return recommendations.length > 0 ? recommendations : ['Weather conditions are normal'];
}

/**
 * GET /api/admin/training-academy
 * Training Academy - Provider training progress and certification tracking
 */
export const getTrainingAcademy = asyncHandler(async (req: Request, res: Response) => {
  const { status, category, providerId, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Get all training courses with optional filters
  const courseQuery: any = {};
  if (status) courseQuery.status = status;
  if (category) courseQuery.category = category;

  const [courses, totalCourses, courseStats] = await Promise.all([
    trainingAcademyService.getAllCourses({ status: 'published' as any }),
    // Get total published courses count
    mongoose.model('TrainingCourse').countDocuments({ status: 'published' }),
    // Get course statistics
    mongoose.model('CourseProgress').aggregate([
      {
        $lookup: {
          from: 'training_courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      { $match: { 'course.status': 'published' } },
      {
        $group: {
          _id: '$courseId',
          enrollments: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          avgProgress: { $avg: '$progressPercentage' }
        }
      }
    ])
  ]);

  // Create lookup map for course stats
  const courseStatsMap = new Map(courseStats.map(s => [s._id.toString(), s]));

  // Get provider progress with pagination
  const progressQuery: any = {};
  if (providerId) progressQuery.providerId = new mongoose.Types.ObjectId(providerId as string);

  const [progressRecords, totalProgress] = await Promise.all([
    mongoose.model('CourseProgress').find(progressQuery)
      .populate('courseId', 'title category difficulty estimatedDuration certification')
      .populate('providerId', 'firstName lastName email')
      .sort({ lastAccessedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    mongoose.model('CourseProgress').countDocuments(progressQuery)
  ]);

  // Get all certifications
  const [certifications, totalCertifications] = await Promise.all([
    mongoose.model('Certification').find({})
      .populate('providerId', 'firstName lastName email')
      .sort({ issuedAt: -1 })
      .limit(100)
      .lean(),
    mongoose.model('Certification').countDocuments({})
  ]);

  // Calculate training summary statistics
  const trainingStats = await mongoose.model('CourseProgress').aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const statusCounts: Record<string, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    failed: 0
  };
  trainingStats.forEach(s => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  // Calculate completion rate
  const totalEnrollments = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const completionRate = totalEnrollments > 0
    ? Math.round((statusCounts.completed / totalEnrollments) * 10000) / 100
    : 0;

  // Format provider progress data
  const providerProgress = progressRecords.map(p => {
    const course = (p as any).courseId;
    const provider = (p as any).providerId;
    return {
      providerId: p.providerId?._id || p.providerId,
      providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
      providerEmail: provider?.email,
      courseId: course?._id,
      courseName: course?.title || 'Unknown Course',
      category: course?.category,
      status: p.status,
      progress: p.progressPercentage,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      lastAccessedAt: p.lastAccessedAt
    };
  });

  // Format certification data
  const formattedCertifications = certifications.map(c => ({
    certificationId: (c as any).certificateId,
    providerId: (c as any).providerId?._id || (c as any).providerId,
    providerName: (c as any).providerId ? `${(c as any).providerId.firstName} ${(c as any).providerId.lastName}` : 'Unknown',
    courseName: (c as any).courseName,
    status: (c as any).status,
    issuedAt: (c as any).issuedAt,
    expiresAt: (c as any).expiresAt,
    score: (c as any).score,
    verificationCode: (c as any).verificationCode
  }));

  // Calculate average score from certifications
  const avgScore = certifications.length > 0
    ? Math.round(certifications.reduce((sum, c) => sum + ((c as any).score || 0), 0) / certifications.length)
    : 0;

  res.json({
    success: true,
    data: {
      courses: courses.map(c => {
        const stats = courseStatsMap.get((c._id as any).toString());
        return {
          courseId: c._id,
          title: c.title,
          category: c.category,
          difficulty: c.difficulty,
          estimatedDuration: c.estimatedDuration,
          certification: c.certification ? {
            name: c.certification.name,
            validityMonths: c.certification.validityMonths
          } : null,
          stats: stats ? {
            enrollments: stats.enrollments,
            completed: stats.completed,
            inProgress: stats.inProgress,
            avgProgress: Math.round(stats.avgProgress)
          } : {
            enrollments: 0,
            completed: 0,
            inProgress: 0,
            avgProgress: 0
          }
        };
      }),
      providerProgress: {
        items: providerProgress,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalProgress,
          pages: Math.ceil(totalProgress / Number(limit))
        }
      },
      certifications: {
        items: formattedCertifications,
        total: totalCertifications,
        avgScore
      },
      summary: {
        totalCourses: totalCourses,
        totalEnrollments,
        completedEnrollments: statusCounts.completed,
        inProgressEnrollments: statusCounts.in_progress,
        notStartedEnrollments: statusCounts.not_started,
        completionRate,
        totalCertifications,
        avgProviderProgress: avgScore > 0 ? Math.round((statusCounts.in_progress * 50 + statusCounts.completed * 100) / Math.max(totalEnrollments, 1)) : 0
      }
    }
  });
});

/**
 * GET /api/admin/saas/magic-number
 * SaaS Magic Number - Investor reporting metrics (NRR-1)/CAC Payback
 */
export const getMagicNumber = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, period = 'quarterly' } = req.query;

  // Parse date range
  const parsedStartDate = parseDate(startDate as string | undefined, 'startDate', res);
  if (startDate !== undefined && parsedStartDate === null) return;
  const parsedEndDate = parseDate(endDate as string | undefined, 'endDate', res);
  if (endDate !== undefined && parsedEndDate === null) return;

  // Calculate date ranges based on period
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;
  let previousPeriodStart: Date;
  let previousPeriodEnd: Date;

  if (period === 'monthly') {
    periodEnd = parsedEndDate || new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periodStart = parsedStartDate || new Date(now.getFullYear(), now.getMonth(), 1);
    previousPeriodEnd = new Date(periodStart);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    previousPeriodStart = new Date(previousPeriodEnd.getFullYear(), previousPeriodEnd.getMonth(), 1);
  } else if (period === 'quarterly') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    periodEnd = parsedEndDate || new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
    periodStart = parsedStartDate || new Date(now.getFullYear(), currentQuarter * 3, 1);
    previousPeriodEnd = new Date(periodStart);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    const prevQuarter = Math.floor(previousPeriodEnd.getMonth() / 3);
    previousPeriodStart = new Date(previousPeriodEnd.getFullYear(), prevQuarter * 3, 1);
  } else {
    // Yearly
    periodEnd = parsedEndDate || new Date(now.getFullYear(), 11, 31);
    periodStart = parsedStartDate || new Date(now.getFullYear(), 0, 1);
    previousPeriodEnd = new Date(periodStart);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    previousPeriodStart = new Date(previousPeriodEnd.getFullYear(), 0, 1);
  }

  // Fetch current period data
  const [
    currentPeriodBookings,
    currentPeriodRevenue,
    previousPeriodBookings,
    previousPeriodRevenue,
    customerMetrics,
    refundData
  ] = await Promise.all([
    // Current period completed bookings
    Booking.find({
      status: 'completed',
      completedAt: { $gte: periodStart, $lte: periodEnd }
    }).select('customerId pricing.totalAmount pricing.subtotal pricing.couponDiscount').lean(),

    // Current period revenue aggregation
    Booking.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: periodStart, $lte: periodEnd } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          totalBookings: { $sum: 1 },
          avgBookingValue: { $avg: '$pricing.totalAmount' }
        }
      }
    ]),

    // Previous period completed bookings
    Booking.find({
      status: 'completed',
      completedAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd }
    }).select('customerId pricing.totalAmount').lean(),

    // Previous period revenue aggregation
    Booking.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          totalBookings: { $sum: 1 }
        }
      }
    ]),

    // Customer metrics for NRR calculation
    mongoose.model('CustomerMetrics').find({
      period: period as string
    }).lean(),

    // Refund data for net revenue calculation
    Booking.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: periodStart, $lte: periodEnd } } },
      { $group: { _id: null, totalRefunds: { $sum: '$pricing.couponDiscount' } } }
    ])
  ]);

  // Calculate MRR (Monthly Recurring Revenue) - using booking revenue as proxy
  const currentRevenue = currentPeriodRevenue[0]?.totalRevenue || 0;
  const previousRevenue = previousPeriodRevenue[0]?.totalRevenue || 0;
  const currentBookings = currentPeriodRevenue[0]?.totalBookings || 0;
  const previousBookings = previousPeriodRevenue[0]?.totalBookings || 0;

  // Calculate Customer counts
  const currentCustomerIds = new Set(currentPeriodBookings.map(b => b.customerId?.toString()).filter(Boolean));
  const previousCustomerIds = new Set(previousPeriodBookings.map(b => b.customerId?.toString()).filter(Boolean));
  const newCustomers = currentCustomerIds.size - previousCustomerIds.size;

  // Calculate NRR (Net Revenue Retention)
  // NRR = (Starting Revenue + Expansion - Contraction - Churn) / Starting Revenue
  // For simplicity, we'll calculate: NRR = Current Revenue / Previous Revenue
  let nrr = previousRevenue > 0 ? (currentRevenue / previousRevenue) * 100 : 100;

  // Calculate churn rate (customers who don't have bookings in current period)
  const retainedCustomers = currentCustomerIds.size;
  const churnedCustomers = previousCustomerIds.size - retainedCustomers;
  const churnRate = previousCustomerIds.size > 0
    ? Math.round((churnedCustomers / previousCustomerIds.size) * 10000) / 100
    : 0;

  // Calculate CAC (Customer Acquisition Cost)
  // Estimate based on marketing/advertising spend proxy: 20% of revenue goes to acquisition
  const estimatedAcquisitionSpend = currentRevenue * 0.2;
  const cac = newCustomers > 0 ? estimatedAcquisitionSpend / newCustomers : 0;

  // Calculate ARPU (Average Revenue Per User)
  const arpu = currentCustomerIds.size > 0 ? currentRevenue / currentCustomerIds.size : 0;

  // Calculate LTV (Lifetime Value)
  // LTV = ARPU * Gross Margin % * Average Customer Lifespan (months)
  const grossMargin = 0.7; // Estimated 70% gross margin
  const avgCustomerLifespan = 24; // 24 months average
  const ltv = arpu * grossMargin * avgCustomerLifespan;

  // Calculate CAC Payback Period (in months)
  // CAC Payback = CAC / (ARPU * Gross Margin)
  const monthlyArpu = arpu / 3; // Assuming quarterly period
  const cacPaybackPeriod = monthlyArpu > 0 && grossMargin > 0
    ? cac / (monthlyArpu * grossMargin)
    : 0;

  // Calculate Magic Number
  // Magic Number = (NRR - 1) / (CAC Payback Period / 12)
  // Simplified: Magic Number = (NRR - 1) * 12 / CAC Payback Period
  const magicNumber = cacPaybackPeriod > 0
    ? ((nrr - 100) / 100) * 12 / cacPaybackPeriod
    : 0;

  // Get revenue growth
  const revenueGrowth = previousRevenue > 0
    ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 10000) / 100
    : 0;

  res.json({
    success: true,
    data: {
      magicNumber: {
        value: Math.round(magicNumber * 100) / 100,
        interpretation: magicNumber >= 1 ? 'Excellent - Efficient growth' :
                       magicNumber >= 0.5 ? 'Good - Healthy growth efficiency' :
                       magicNumber >= 0 ? 'Fair - Room for improvement' :
                       'Poor - Losing money on growth',
        benchmark: '>1.0 = Excellent, 0.75-1.0 = Good, 0.5-0.75 = Fair, <0.5 = Needs Improvement'
      },
      metrics: {
        nrr: Math.round(nrr * 100) / 100,
        cac: Math.round(cac * 100) / 100,
        ltv: Math.round(ltv * 100) / 100,
        cacPaybackPeriod: Math.round(cacPaybackPeriod * 100) / 100,
        arpu: Math.round(arpu * 100) / 100,
        ltvToCacRatio: cac > 0 ? Math.round((ltv / cac) * 100) / 100 : 0
      },
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        type: period
      },
      revenue: {
        current: Math.round(currentRevenue * 100) / 100,
        previous: Math.round(previousRevenue * 100) / 100,
        growth: revenueGrowth
      },
      customers: {
        total: currentCustomerIds.size,
        previous: previousCustomerIds.size,
        new: newCustomers > 0 ? newCustomers : 0,
        churned: churnedCustomers > 0 ? churnedCustomers : 0,
        churnRate
      },
      bookings: {
        current: currentBookings,
        previous: previousBookings,
        avgValue: currentPeriodRevenue[0]?.avgBookingValue || 0
      },
      summary: {
        healthScore: calculateSaaSHealthScore({ nrr, ltv, cac, magicNumber, churnRate }),
        recommendation: generateSaaSRecommendations({ nrr, ltv, cac, magicNumber, churnRate }),
        investorHighlights: {
          burnRate: Math.round(currentRevenue * 0.3), // Estimated
          runway: 24, // Estimated months
          growthRate: revenueGrowth
        }
      }
    }
  });
});

/**
 * Calculate SaaS Health Score (0-100)
 */
function calculateSaaSHealthScore(metrics: {
  nrr: number;
  ltv: number;
  cac: number;
  magicNumber: number;
  churnRate: number;
}): number {
  let score = 0;

  // NRR contribution (40%)
  if (metrics.nrr >= 120) score += 40;
  else if (metrics.nrr >= 110) score += 35;
  else if (metrics.nrr >= 100) score += 30;
  else if (metrics.nrr >= 90) score += 20;
  else score += 10;

  // LTV:CAC ratio contribution (30%)
  const ltvCacRatio = metrics.cac > 0 ? metrics.ltv / metrics.cac : 0;
  if (ltvCacRatio >= 5) score += 30;
  else if (ltvCacRatio >= 3) score += 25;
  else if (ltvCacRatio >= 2) score += 20;
  else if (ltvCacRatio >= 1) score += 10;
  else score += 5;

  // Magic Number contribution (20%)
  if (metrics.magicNumber >= 1) score += 20;
  else if (metrics.magicNumber >= 0.75) score += 17;
  else if (metrics.magicNumber >= 0.5) score += 14;
  else if (metrics.magicNumber >= 0.25) score += 10;
  else score += 5;

  // Churn contribution (10%)
  if (metrics.churnRate <= 5) score += 10;
  else if (metrics.churnRate <= 10) score += 7;
  else if (metrics.churnRate <= 15) score += 4;
  else score += 1;

  return Math.min(100, Math.max(0, score));
}

/**
 * Generate SaaS recommendations based on metrics
 */
function generateSaaSRecommendations(metrics: {
  nrr: number;
  ltv: number;
  cac: number;
  magicNumber: number;
  churnRate: number;
}): string[] {
  const recommendations: string[] = [];

  if (metrics.nrr < 100) {
    recommendations.push('Focus on customer retention - NRR below 100% indicates revenue contraction');
  } else if (metrics.nrr >= 110) {
    recommendations.push('Strong net revenue retention - continue current expansion strategies');
  }

  if (metrics.churnRate > 10) {
    recommendations.push('High churn rate - implement proactive retention programs and exit surveys');
  }

  const ltvCacRatio = metrics.cac > 0 ? metrics.ltv / metrics.cac : 0;
  if (ltvCacRatio < 3) {
    recommendations.push('Improve LTV:CAC ratio by increasing customer lifetime value through upsells');
  }

  if (metrics.magicNumber < 0.5) {
    recommendations.push('Low magic number - reduce CAC or increase NRR to improve growth efficiency');
  }

  if (metrics.cac > 500) {
    recommendations.push('High CAC - explore more cost-effective acquisition channels');
  }

  if (recommendations.length === 0) {
    recommendations.push('Metrics are healthy - maintain current strategies');
  }

  return recommendations;
}
