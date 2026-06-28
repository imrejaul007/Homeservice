/**
 * Business Intelligence Routes
 *
 * BI endpoints for customer analytics, CAC, retention, RFM, revenue breakdown, and health scores.
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';

const router = Router();

// ============================================
// Types
// ============================================

interface CustomerLTV {
  customerId: string;
  customerName: string;
  email: string;
  totalBookings: number;
  totalSpent: number;
  averageBookingValue: number;
  firstBookingDate: string;
  lastBookingDate: string;
  lifetimeDays: number;
  predictedLTV: number;
  segment: 'low' | 'medium' | 'high' | 'vip';
}

interface CACMetrics {
  period: string;
  totalMarketingSpend: number;
  newCustomersAcquired: number;
  averageCAC: number;
  byChannel: Array<{
    channel: string;
    spend: number;
    customers: number;
    cac: number;
  }>;
}

interface RetentionMetrics {
  period: string;
  startingCustomers: number;
  retainedCustomers: number;
  churnedCustomers: number;
  retentionRate: number;
  churnRate: number;
  netRetention: number;
}

interface RFMAnalysis {
  customerId: string;
  customerName: string;
  email: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: string;
  segment: 'champions' | 'loyal' | 'potential' | 'at_risk' | 'lost';
}

interface RevenueBreakdown {
  period: string;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  platformFees: number;
  paymentFees: number;
  taxes: number;
  providerPayouts: number;
  platformProfit: number;
}

interface BusinessHealthScore {
  overall: number;
  categories: Array<{
    name: string;
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    metrics: Record<string, number>;
  }>;
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metric?: string;
  }>;
}

// ============================================
// Helper Functions
// ============================================

const getDateRange = (startDate?: string, endDate?: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  return { startDate: start, endDate: end };
};

const calculateRFMScore = (recency: number, frequency: number, monetary: number): { score: string; segment: RFMAnalysis['segment'] } => {
  // RFM scoring: 1-5 scale for each dimension
  const rScore = recency <= 7 ? 5 : recency <= 30 ? 4 : recency <= 60 ? 3 : recency <= 90 ? 2 : 1;
  const fScore = frequency >= 10 ? 5 : frequency >= 7 ? 4 : frequency >= 5 ? 3 : frequency >= 3 ? 2 : 1;
  const mScore = monetary >= 1000 ? 5 : monetary >= 700 ? 4 : monetary >= 400 ? 3 : monetary >= 200 ? 2 : 1;

  const totalScore = rScore + fScore + mScore;
  const scoreString = `${rScore}${fScore}${mScore}`;

  // Determine segment based on RFM combination
  let segment: RFMAnalysis['segment'];
  if (rScore >= 4 && fScore >= 4) {
    segment = 'champions';
  } else if (fScore >= 3 && mScore >= 3) {
    segment = 'loyal';
  } else if (rScore >= 3 && fScore <= 2) {
    segment = 'potential';
  } else if (rScore <= 2 && fScore >= 3) {
    segment = 'at_risk';
  } else {
    segment = 'lost';
  }

  return { score: scoreString, segment };
};

const predictLTV = (totalSpent: number, lifetimeDays: number, totalBookings: number): number => {
  if (lifetimeDays === 0) return totalSpent;

  // Simple prediction: current value + projected value based on booking rate
  const dailyRate = totalSpent / lifetimeDays;
  const projectedDays = 365; // Project for 1 year
  const projectedValue = dailyRate * projectedDays;

  // Weight: 70% actual, 30% projected
  return Math.round((totalSpent * 0.7) + (projectedValue * 0.3));
};

const getLTVSegment = (ltv: number): 'low' | 'medium' | 'high' | 'vip' => {
  if (ltv >= 5000) return 'vip';
  if (ltv >= 2000) return 'high';
  if (ltv >= 500) return 'medium';
  return 'low';
};

// ============================================
// Routes
// ============================================

/**
 * @route   GET /api/bi/ltv
 * @desc    Get Customer Lifetime Value analysis
 * @access  Admin
 */
router.get('/ltv', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, limit = 100 } = req.query;
  const { startDate: start, endDate: end } = getDateRange(startDate as string, endDate as string);
  const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

  // Aggregate customer LTV data
  const customerLTVData = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$customerId',
        totalBookings: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' },
        firstBookingDate: { $min: '$createdAt' },
        lastBookingDate: { $max: '$createdAt' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        customerId: '$_id',
        customerName: {
          $cond: {
            if: '$customer',
            then: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] },
            else: 'Unknown',
          },
        },
        email: { $ifNull: ['$customer.email', ''] },
        totalBookings: 1,
        totalSpent: 1,
        firstBookingDate: 1,
        lastBookingDate: 1,
        lifetimeDays: {
          $divide: [
            { $subtract: ['$lastBookingDate', '$firstBookingDate'] },
            1000 * 60 * 60 * 24,
          ],
        },
        averageBookingValue: { $divide: ['$totalSpent', '$totalBookings'] },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limitNum },
  ]);

  // Calculate predicted LTV and segments
  const customerLTV: CustomerLTV[] = customerLTVData.map((customer) => {
    const lifetimeDays = customer.lifetimeDays || 1;
    const predictedLTV = predictLTV(customer.totalSpent, lifetimeDays, customer.totalBookings);

    return {
      customerId: customer.customerId?.toString() || '',
      customerName: customer.customerName,
      email: customer.email,
      totalBookings: customer.totalBookings,
      totalSpent: customer.totalSpent,
      averageBookingValue: customer.averageBookingValue,
      firstBookingDate: customer.firstBookingDate?.toISOString() || '',
      lastBookingDate: customer.lastBookingDate?.toISOString() || '',
      lifetimeDays: Math.round(lifetimeDays),
      predictedLTV,
      segment: getLTVSegment(predictedLTV),
    };
  });

  // Calculate summary statistics
  const summary = {
    totalCustomers: customerLTV.length,
    totalLTV: customerLTV.reduce((sum, c) => sum + c.predictedLTV, 0),
    averageLTV: customerLTV.length > 0
      ? Math.round(customerLTV.reduce((sum, c) => sum + c.predictedLTV, 0) / customerLTV.length)
      : 0,
    bySegment: {
      vip: customerLTV.filter(c => c.segment === 'vip').length,
      high: customerLTV.filter(c => c.segment === 'high').length,
      medium: customerLTV.filter(c => c.segment === 'medium').length,
      low: customerLTV.filter(c => c.segment === 'low').length,
    },
  };

  res.json({
    success: true,
    data: {
      customers: customerLTV,
      summary,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
    },
  });
}));

/**
 * @route   GET /api/bi/cac
 * @desc    Get Customer Acquisition Cost metrics
 * @access  Admin
 */
router.get('/cac', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const { startDate: start, endDate: end } = getDateRange(startDate as string, endDate as string);

  // Get all customers who made their first booking in the period
  const firstTimeCustomers = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$customerId',
        firstBookingDate: { $min: '$createdAt' },
        totalSpent: { $sum: '$pricing.totalAmount' },
      },
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ['$firstBookingDate', start] },
            { $lte: ['$firstBookingDate', end] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        customerId: '$_id',
        firstBookingDate: 1,
        referralSource: { $ifNull: ['$customer.referralSource', 'direct'] },
      },
    },
  ]);

  // Group by channel/referral source
  const byChannelMap = new Map<string, { spend: number; customers: number }>();
  let totalNewCustomers = firstTimeCustomers.length;

  // Calculate estimated marketing spend per channel
  // In production, this would come from actual marketing spend data
  const estimatedSpendByChannel = {
    direct: totalNewCustomers * 50,
    organic: totalNewCustomers * 10,
    referral: totalNewCustomers * 30,
    social: totalNewCustomers * 80,
    paid_ads: totalNewCustomers * 100,
    unknown: totalNewCustomers * 60,
  };

  for (const customer of firstTimeCustomers) {
    const channel = (customer.referralSource as string) || 'unknown';
    const existing = byChannelMap.get(channel) || { spend: 0, customers: 0 };
    existing.customers += 1;
    existing.spend = estimatedSpendByChannel[channel as keyof typeof estimatedSpendByChannel] || estimatedSpendByChannel.unknown;
    byChannelMap.set(channel, existing);
  }

  // If no customers, use default channels
  if (byChannelMap.size === 0) {
    const defaultChannels = ['direct', 'organic', 'referral', 'social', 'paid_ads'];
    for (const channel of defaultChannels) {
      byChannelMap.set(channel, { spend: 0, customers: 0 });
    }
  }

  const byChannel = Array.from(byChannelMap.entries()).map(([channel, data]) => ({
    channel,
    spend: data.spend,
    customers: data.customers,
    cac: data.customers > 0 ? Math.round(data.spend / data.customers) : 0,
  }));

  const totalSpend = byChannel.reduce((sum, c) => sum + c.spend, 0);
  const totalMarketingSpend = totalNewCustomers > 0 ? totalSpend : 0;

  const cacMetrics: CACMetrics = {
    period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
    totalMarketingSpend,
    newCustomersAcquired: totalNewCustomers,
    averageCAC: totalNewCustomers > 0 ? Math.round(totalMarketingSpend / totalNewCustomers) : 0,
    byChannel,
  };

  res.json({
    success: true,
    data: cacMetrics,
  });
}));

/**
 * @route   GET /api/bi/retention
 * @desc    Get Retention metrics
 * @access  Admin
 */
router.get('/retention', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const { startDate: start, endDate: end } = getDateRange(startDate as string, endDate as string);

  // Get unique customers by period
  const periodInDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Get customers active at start of period
  const startCustomers = await Booking.distinct('customerId', {
    createdAt: { $lt: start },
    status: 'completed',
  });

  // Get customers active in period
  const periodCustomers = await Booking.distinct('customerId', {
    createdAt: { $gte: start, $lte: end },
    status: 'completed',
  });

  // Get customers active after period
  const endCustomers = await Booking.distinct('customerId', {
    createdAt: { $gt: end },
    status: 'completed',
  });

  const startingCustomers = startCustomers.length;
  const activeInPeriod = periodCustomers.length;
  const activeAfterPeriod = endCustomers.length;

  // Calculate retained (customers who were active before AND in period)
  const retainedSet = new Set(startCustomers.filter(id => periodCustomers.some(pid => pid.toString() === id.toString())));
  const retainedCustomers = retainedSet.size;

  // Calculate churned (customers who were active before but NOT in period or after)
  const churnedCustomers = startingCustomers - retainedCustomers;

  // Calculate retention rate
  const retentionRate = startingCustomers > 0 ? (retainedCustomers / startingCustomers) * 100 : 0;
  const churnRate = startingCustomers > 0 ? (churnedCustomers / startingCustomers) * 100 : 0;

  // Net retention: customers who continued from period to next period
  const netRetention = activeInPeriod > 0 ? (retainedCustomers / activeInPeriod) * 100 : 0;

  const retentionMetrics: RetentionMetrics = {
    period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
    startingCustomers,
    retainedCustomers,
    churnedCustomers,
    retentionRate: Math.round(retentionRate * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    netRetention: Math.round(netRetention * 100) / 100,
  };

  // Get cohort retention data
  const cohortRetention = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
      },
    },
    {
      $group: {
        _id: {
          customerId: '$customerId',
          cohortMonth: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        },
        firstBooking: { $min: '$createdAt' },
        lastBooking: { $max: '$createdAt' },
        totalBookings: { $sum: 1 },
      },
    },
    { $sort: { '_id.cohortMonth': -1 } },
    { $limit: 50 },
  ]);

  res.json({
    success: true,
    data: {
      ...retentionMetrics,
      cohortData: cohortRetention.slice(0, 12),
    },
  });
}));

/**
 * @route   GET /api/bi/rfm
 * @desc    Get RFM (Recency, Frequency, Monetary) analysis
 * @access  Admin
 */
router.get('/rfm', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { limit = 1000 } = req.query;
  const limitNum = Math.min(parseInt(limit as string) || 1000, 5000);
  const now = new Date();

  // Get RFM data for all customers
  const rfmData = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
      },
    },
    {
      $group: {
        _id: '$customerId',
        totalBookings: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' },
        lastBookingDate: { $max: '$createdAt' },
        firstBookingDate: { $min: '$createdAt' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        customerId: '$_id',
        customerName: {
          $cond: {
            if: '$customer',
            then: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] },
            else: 'Unknown',
          },
        },
        email: { $ifNull: ['$customer.email', ''] },
        frequency: '$totalBookings',
        monetary: '$totalSpent',
        lastBookingDate: 1,
        daysSinceLastBooking: {
          $divide: [
            { $subtract: [now, '$lastBookingDate'] },
            1000 * 60 * 60 * 24,
          ],
        },
      },
    },
    {
      $project: {
        customerId: 1,
        customerName: 1,
        email: 1,
        frequency: 1,
        monetary: 1,
        recency: { $ceil: '$daysSinceLastBooking' },
        lastBookingDate: 1,
      },
    },
    { $sort: { monetary: -1 } },
    { $limit: limitNum },
  ]);

  // Calculate RFM scores
  const rfmAnalysis: RFMAnalysis[] = rfmData.map((customer) => {
    const { score, segment } = calculateRFMScore(customer.recency, customer.frequency, customer.monetary);

    return {
      customerId: customer.customerId?.toString() || '',
      customerName: customer.customerName,
      email: customer.email,
      recency: customer.recency,
      frequency: customer.frequency,
      monetary: customer.monetary,
      rfmScore: score,
      segment,
    };
  });

  // Calculate segment summary
  const segmentSummary = {
    champions: rfmAnalysis.filter(c => c.segment === 'champions').length,
    loyal: rfmAnalysis.filter(c => c.segment === 'loyal').length,
    potential: rfmAnalysis.filter(c => c.segment === 'potential').length,
    at_risk: rfmAnalysis.filter(c => c.segment === 'at_risk').length,
    lost: rfmAnalysis.filter(c => c.segment === 'lost').length,
  };

  res.json({
    success: true,
    data: {
      customers: rfmAnalysis,
      summary: {
        totalCustomers: rfmAnalysis.length,
        ...segmentSummary,
      },
    },
  });
}));

/**
 * @route   GET /api/bi/revenue
 * @desc    Get Revenue Breakdown
 * @access  Admin
 */
router.get('/revenue', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const { startDate: start, endDate: end } = getDateRange(startDate as string, endDate as string);

  // Platform fee percentage (typically 10-15%)
  const PLATFORM_FEE_PERCENT = 0.10;
  const PAYMENT_PROCESSING_FEE_PERCENT = 0.029 + 0.30; // Stripe 2.9% + $0.30 per transaction

  // Aggregate revenue data
  const revenueData = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: '$pricing.totalAmount' },
        totalTax: { $sum: '$pricing.tax' },
        totalDiscounts: { $sum: { $sum: '$pricing.discounts.amount' } },
        totalBookings: { $sum: 1 },
        avgBookingValue: { $avg: '$pricing.totalAmount' },
      },
    },
  ]);

  const data = revenueData[0] || {
    grossRevenue: 0,
    totalTax: 0,
    totalDiscounts: 0,
    totalBookings: 0,
    avgBookingValue: 0,
  };

  const grossRevenue = data.grossRevenue;
  const discounts = data.totalDiscounts;
  const taxes = data.totalTax;
  const refunds = 0; // Would come from refund records

  // Calculate fees based on gross revenue
  const platformFees = grossRevenue * PLATFORM_FEE_PERCENT;
  const paymentFees = grossRevenue * PAYMENT_PROCESSING_FEE_PERCENT;

  // Net revenue after discounts and refunds
  const netRevenue = grossRevenue - discounts - refunds;

  // Provider payouts (gross - platform fees)
  const providerPayouts = grossRevenue - platformFees;

  // Platform profit (net revenue - all fees - taxes)
  const platformProfit = netRevenue - platformFees - paymentFees - taxes;

  const revenueBreakdown: RevenueBreakdown = {
    period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    discounts: Math.round(discounts * 100) / 100,
    refunds: Math.round(refunds * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    platformFees: Math.round(platformFees * 100) / 100,
    paymentFees: Math.round(paymentFees * 100) / 100,
    taxes: Math.round(taxes * 100) / 100,
    providerPayouts: Math.round(providerPayouts * 100) / 100,
    platformProfit: Math.round(platformProfit * 100) / 100,
  };

  // Get revenue by category
  const revenueByCategory = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
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
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'servicecategories',
        localField: 'service.categoryId',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$service.categoryId',
        categoryName: { $first: '$category.name' },
        revenue: { $sum: '$pricing.totalAmount' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  res.json({
    success: true,
    data: {
      ...revenueBreakdown,
      totalBookings: data.totalBookings,
      averageBookingValue: Math.round(data.avgBookingValue * 100) / 100,
      byCategory: revenueByCategory,
    },
  });
}));

/**
 * @route   GET /api/bi/health
 * @desc    Get Business Health Score
 * @access  Admin
 */
router.get('/health', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get key metrics
  const [bookingsThisMonth, bookingsLastMonth, revenueThisMonth, revenueLastMonth] = await Promise.all([
    Booking.countDocuments({ status: 'completed', createdAt: { $gte: thirtyDaysAgo } }),
    Booking.countDocuments({ status: 'completed', createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
    Booking.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
  ]);

  const revenueCurrent = revenueThisMonth[0]?.total || 0;
  const revenuePrevious = revenueLastMonth[0]?.total || 0;

  // Calculate booking health score
  const bookingTrend = bookingsLastMonth > 0
    ? ((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100
    : 0;

  // Calculate revenue health score
  const revenueTrend = revenuePrevious > 0
    ? ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100
    : 0;

  // Get customer metrics
  const [activeCustomers, totalCustomers] = await Promise.all([
    User.countDocuments({ role: 'customer', lastActiveAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ role: 'customer' }),
  ]);

  const customerHealth = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

  // Get provider metrics
  const ProviderProfile = require('../models/providerProfile.model').default;

  const [canonicalActiveProviders, recentlyBookedProviders, totalProviders] = await Promise.all([
    // Canonical definition: verified + active + not deleted
    ProviderProfile.countDocuments({
      'verificationStatus.overall': 'approved',
      isActive: true,
      isDeleted: { $ne: true },
    }),
    // Recently booked: providers who completed bookings in last 30 days (for health metric)
    Booking.distinct('providerId', { status: 'completed', createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ role: 'provider' }),
  ]);

  const providerHealth = totalProviders > 0 ? (recentlyBookedProviders.length / totalProviders) * 100 : 0;

  // Calculate overall health score (weighted average)
  const bookingScore = Math.min(100, Math.max(0, 50 + bookingTrend * 2));
  const revenueScore = Math.min(100, Math.max(0, 50 + revenueTrend * 2));
  const customerScore = customerHealth;
  const providerScore = providerHealth;

  const overallScore = Math.round(
    (bookingScore * 0.25) +
    (revenueScore * 0.30) +
    (customerScore * 0.25) +
    (providerScore * 0.20)
  );

  // Determine trends
  const getTrend = (current: number, previous: number): 'improving' | 'stable' | 'declining' => {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  };

  // Generate alerts
  const alerts: BusinessHealthScore['alerts'] = [];

  if (bookingTrend < -10) {
    alerts.push({
      severity: 'critical',
      message: 'Booking volume dropped significantly this month',
      metric: 'bookings',
    });
  }

  if (revenueTrend < -10) {
    alerts.push({
      severity: 'critical',
      message: 'Revenue declined significantly this month',
      metric: 'revenue',
    });
  }

  if (customerHealth < 30) {
    alerts.push({
      severity: 'warning',
      message: 'Low customer activity rate',
      metric: 'customers',
    });
  }

  if (providerHealth < 30) {
    alerts.push({
      severity: 'warning',
      message: 'Low provider engagement',
      metric: 'providers',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      severity: 'info',
      message: 'All business metrics are healthy',
    });
  }

  const healthScore: BusinessHealthScore = {
    overall: overallScore,
    categories: [
      {
        name: 'Bookings',
        score: Math.round(bookingScore),
        trend: bookingTrend > 5 ? 'improving' : bookingTrend < -5 ? 'declining' : 'stable',
        metrics: {
          current: bookingsThisMonth,
          previous: bookingsLastMonth,
          changePercent: Math.round(bookingTrend * 10) / 10,
        },
      },
      {
        name: 'Revenue',
        score: Math.round(revenueScore),
        trend: getTrend(revenueCurrent, revenuePrevious),
        metrics: {
          current: Math.round(revenueCurrent),
          previous: Math.round(revenuePrevious),
          changePercent: Math.round(revenueTrend * 10) / 10,
        },
      },
      {
        name: 'Customers',
        score: Math.round(customerScore),
        trend: customerHealth > 50 ? 'improving' : customerHealth < 30 ? 'declining' : 'stable',
        metrics: {
          active: activeCustomers,
          total: totalCustomers,
          activityRate: Math.round(customerHealth * 10) / 10,
        },
      },
      {
        name: 'Providers',
        score: Math.round(providerScore),
        trend: providerHealth > 50 ? 'improving' : providerHealth < 30 ? 'declining' : 'stable',
        metrics: {
          active: canonicalActiveProviders,
          total: totalProviders,
          engagementRate: Math.round(providerHealth * 10) / 10,
        },
      },
    ],
    alerts,
  };

  res.json({
    success: true,
    data: healthScore,
  });
}));

export default router;
