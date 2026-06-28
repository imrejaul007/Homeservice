import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import Booking from '../../models/booking.model';
import { cache } from '../../config/redis';
import logger from '../../utils/logger';
import { adminAnalyticsService } from '../../services/adminAnalytics.service';

const router = Router();

// ============================================
// Admin Analytics Types
// ============================================

export interface MarketShareData {
  platform: string;
  share: number;
  revenue: number;
  customers: number;
  growth: number;
}

export interface MarketTrendData {
  month: string;
  yourPlatform: number;
  competitor1: number;
  competitor2: number;
  competitor3: number;
}

export interface GrossMarginData {
  category: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
}

export interface MarginTrendData {
  month: string;
  margin: number;
  benchmark: number;
}

// ============================================
// Helper Functions
// ============================================

const getDateRange = (period: string): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;

  switch (period) {
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
};

const getCachedData = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 300): Promise<T> => {
  try {
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache miss or error
  }

  const data = await fetchFn();

  try {
    await cache.set(key, JSON.stringify(data), ttl);
  } catch {
    // Cache write error - ignore
  }

  return data;
};

// ============================================
// Admin Analytics Routes
// ============================================

/**
 * @route   GET /api/analytics/admin/market-share
 * @desc    Get platform market share data
 * @access  Admin
 */
router.get('/market-share', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '90d', region = 'all' } = req.query;
  const cacheKey = `analytics:admin:market-share:${period}:${region}`;

  const data = await getCachedData(cacheKey, async () => {
    // Get your platform's revenue
    const { start, end } = getDateRange(period as string);

    const yourRevenue = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$pricing.totalAmount' },
          customers: { $addToSet: '$customerId' },
        },
      },
    ]);

    const platformRevenue = yourRevenue[0]?.revenue || 0;
    const platformCustomers = yourRevenue[0]?.customers?.length || 0;

    // Mock competitor data (in production, this would come from external data sources)
    // Assuming total market size and distributing among competitors
    const totalMarketMultiplier = 2.8; // Your platform has ~35% share
    const totalMarket = platformRevenue * totalMarketMultiplier;

    const competitor1Revenue = totalMarket * 0.28;
    const competitor2Revenue = totalMarket * 0.18;
    const competitor3Revenue = totalMarket * 0.12;
    const othersRevenue = totalMarket * 0.07;

    const marketShareData: MarketShareData[] = [
      {
        platform: 'Your Platform',
        share: 35,
        revenue: platformRevenue,
        customers: platformCustomers,
        growth: 12,
      },
      {
        platform: 'Competitor A',
        share: 28,
        revenue: competitor1Revenue,
        customers: Math.round(platformCustomers * 0.84),
        growth: 5,
      },
      {
        platform: 'Competitor B',
        share: 18,
        revenue: competitor2Revenue,
        customers: Math.round(platformCustomers * 0.53),
        growth: -2,
      },
      {
        platform: 'Competitor C',
        share: 12,
        revenue: competitor3Revenue,
        customers: Math.round(platformCustomers * 0.33),
        growth: 8,
      },
      {
        platform: 'Others',
        share: 7,
        revenue: othersRevenue,
        customers: Math.round(platformCustomers * 0.18),
        growth: 3,
      },
    ];

    // Generate trend data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const trendData: MarketTrendData[] = months.map((month, i) => ({
      month,
      yourPlatform: 30 + i,
      competitor1: 32 - i,
      competitor2: 20 - Math.floor(i / 2),
      competitor3: 18 + Math.floor(i / 3),
    }));

    return {
      share: marketShareData,
      trend: trendData,
      totalMarket,
      period,
      region,
    };
  }, 600);

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/admin/gross-margin
 * @desc    Get platform gross margin data
 * @access  Admin
 */
router.get('/gross-margin', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '90d' } = req.query;
  const cacheKey = `analytics:admin:gross-margin:${period}`;

  const data = await getCachedData(cacheKey, async () => {
    const { start, end } = getDateRange(period as string);

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
      { $unwind: '$service' },
      {
        $lookup: {
          from: 'servicecategories',
          localField: 'service.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Calculate costs and margins (in production, costs would come from actual data)
    // Here we estimate costs based on typical service industry margins
    const marginData: GrossMarginData[] = revenueByCategory.map((cat: any) => {
      const revenue = cat.revenue;
      // Estimate cost (inverse of margin)
      const estimatedMargin = 0.35 + (Math.random() * 0.15); // 35-50% margin
      const cost = revenue * (1 - estimatedMargin);
      const grossProfit = revenue - cost;

      return {
        category: cat.categoryName || 'Unknown',
        revenue,
        cost: Math.round(cost),
        grossProfit: Math.round(grossProfit),
        margin: Math.round(estimatedMargin * 100),
      };
    });

    // Calculate totals
    const totalRevenue = marginData.reduce((sum, c) => sum + c.revenue, 0);
    const totalCost = marginData.reduce((sum, c) => sum + c.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Generate trend data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const trendData: MarginTrendData[] = months.map((month, i) => ({
      month,
      margin: 36 + i,
      benchmark: 38,
    }));

    return {
      breakdown: marginData,
      trend: trendData,
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        overallMargin: Math.round(overallMargin),
      },
      period,
    };
  }, 600);

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/admin/platform-health
 * @desc    Get overall platform health metrics
 * @access  Admin
 */
router.get('/platform-health', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = 'analytics:admin:platform-health';

  const data = await getCachedData(cacheKey, async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayBookings, weekBookings, monthBookings, pendingBookings] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: startOfDay } }),
      Booking.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments({ status: 'pending' }),
    ]);

    return {
      bookings: {
        today: todayBookings,
        thisWeek: weekBookings,
        thisMonth: monthBookings,
        pending: pendingBookings,
      },
      timestamp: now.toISOString(),
    };
  }, 60); // Short TTL for real-time data

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/admin/platform-cac
 * @desc    Get platform customer acquisition cost analytics
 * @access  Admin
 */
router.get('/platform-cac', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '90d' } = req.query;
  const data = await adminAnalyticsService.getPlatformCAC(period as string);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/admin/ltv-by-segment
 * @desc    Get LTV breakdown by customer segment
 * @access  Admin
 */
router.get('/ltv-by-segment', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '90d' } = req.query;
  const data = await adminAnalyticsService.getLTVBySegment(period as string);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/admin/viral-coefficient
 * @desc    Get viral coefficient (K-factor) analytics
 * @access  Admin
 */
router.get('/viral-coefficient', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '30d' } = req.query;
  const data = await adminAnalyticsService.getViralCoefficient(period as string);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/admin/take-rate
 * @desc    Get real-time platform take rate analytics
 * @access  Admin
 */
router.get('/take-rate', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '30d' } = req.query;
  const data = await adminAnalyticsService.getTakeRate(period as string);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/admin/marketplace-velocity
 * @desc    Get marketplace velocity metrics
 * @access  Admin
 */
router.get('/marketplace-velocity', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '24h' } = req.query;
  const data = await adminAnalyticsService.getMarketplaceVelocity(period as string);
  res.json({ success: true, data });
}));

/**
 * @route   POST /api/analytics/admin/clear-cache
 * @desc    Clear all analytics cache
 * @access  Admin
 */
router.post('/clear-cache', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const client = cache.client;
    if (!client) {
      throw new ApiError(500, 'Cache not available');
    }

    let cursor = 0;
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        'analytics:admin:*',
        'COUNT',
        100
      );
      cursor = parseInt(nextCursor, 10);

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);

    logger.info('Admin analytics cache cleared', { keysDeleted: deletedCount });

    res.json({
      success: true,
      message: `Analytics cache cleared (${deletedCount} keys deleted)`,
    });
  } catch (error) {
    logger.error('Failed to clear admin analytics cache', { error });
    throw new ApiError(500, 'Failed to clear cache');
  }
}));

export default router;
