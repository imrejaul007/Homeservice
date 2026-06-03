import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import {
  getBookingAnalytics,
  getProviderAnalytics,
  getCustomerAnalytics,
  getRevenueAnalytics,
  getServiceAnalytics,
  clearAnalyticsCache,
} from '../services/analytics/analytics.service';
import {
  getProviderAnalyticsData,
  getBookingFunnel,
  getGeographicAnalytics,
  FunnelMetrics,
  GeographicAnalytics,
} from '../services/analytics.service';

const router = Router();

function parseAnalyticsDateRange(query: Request['query']): { start: Date; end: Date; period?: string } {
  const { startDate, endDate, period } = query;
  const end = endDate ? new Date(endDate as string) : new Date();

  if (isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid endDate format');
  }

  if (startDate) {
    const start = new Date(startDate as string);
    if (isNaN(start.getTime())) {
      throw new ApiError(400, 'Invalid startDate format');
    }
    if (start > end) {
      throw new ApiError(400, 'startDate must be before endDate');
    }
    return { start, end };
  }

  const periodValue = typeof period === 'string' ? period : '30d';
  const days =
    periodValue === '7d' ? 7 :
    periodValue === '90d' ? 90 :
    periodValue === '365d' || periodValue === '1y' ? 365 :
    30;

  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, period: periodValue };
}

/**
 * @route   GET /api/analytics/overview
 * @desc    Get analytics overview (all metrics)
 * @access  Admin
 */
router.get('/overview', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;

  const [bookings, providers, customers, revenue] = await Promise.all([
    getBookingAnalytics(period as string, req),
    getProviderAnalytics(period as string, req),
    getCustomerAnalytics(period as string, req),
    getRevenueAnalytics(period as string, req),
  ]);

  res.json({
    success: true,
    data: {
      bookings,
      providers,
      customers,
      revenue,
      period,
    },
  });
}));

/**
 * @route   GET /api/analytics/bookings
 * @desc    Get booking analytics
 * @access  Admin
 */
router.get('/bookings', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;

  const analytics = await getBookingAnalytics(period as string, req);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/providers
 * @desc    Get provider analytics
 * @access  Admin
 */
router.get('/providers', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;
  const analytics = await getProviderAnalytics(period as string, req);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/customers
 * @desc    Get customer analytics
 * @access  Admin
 */
router.get('/customers', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;
  const analytics = await getCustomerAnalytics(period as string, req);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Admin
 */
router.get('/revenue', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;

  const analytics = await getRevenueAnalytics(period as string, req);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/services
 * @desc    Get service analytics
 * @access  Admin
 */
router.get('/services', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await getServiceAnalytics();

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   POST /api/analytics/refresh
 * @desc    Force refresh analytics cache
 * @access  Admin
 */
router.post('/refresh', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  await clearAnalyticsCache();

  res.json({
    success: true,
    message: 'Analytics cache cleared',
  });
}));

/**
 * @route   GET /api/analytics/provider/:id
 * @desc    Get analytics for specific provider
 * @access  Admin only
 */
router.get('/provider/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { period = '30d' } = req.query;

  // Validate period parameter
  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period as string) ? period : '30d';

  const analytics = await getProviderAnalyticsData(id, periodValue as '7d' | '30d' | '90d');

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard summary metrics
 * @access  Admin
 */
router.get('/dashboard', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get quick stats
  const [todayBookings, weekBookings, monthBookings, pendingProviders] = await Promise.all([
    Booking.countDocuments({
      createdAt: { $gte: startOfToday },
    }),
    Booking.countDocuments({
      createdAt: { $gte: startOfWeek },
    }),
    Booking.countDocuments({
      createdAt: { $gte: startOfMonth },
    }),
    ProviderProfile.countDocuments({
      'verificationStatus.overall': { $in: ['pending', 'in_progress'] },
    }),
  ]);

  res.json({
    success: true,
    data: {
      todayBookings,
      weekBookings,
      monthBookings,
      pendingProviders,
      timestamp: new Date().toISOString(),
    },
  });
}));

/**
 * @route   GET /api/analytics/export/:type
 * @desc    Export analytics data in various formats
 * @access  Admin
 * @param   type - Export type: 'csv', 'json', 'pdf'
 */
router.get('/export/:type', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;
  const { period, startDate, endDate, format } = req.query;

  // Validate export type
  const validTypes = ['csv', 'json', 'pdf'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid export type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Build date range based on period or explicit dates
  const dateRange: { startDate: Date; endDate: Date } = (() => {
    // If explicit dates provided, use them
    if (startDate && endDate) {
      return {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }
    // Otherwise, calculate from period
    const now = new Date();
    const endDateCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let startDateCalc: Date;

    switch (period) {
      case 'today':
        startDateCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'week':
        startDateCalc = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDateCalc = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDateCalc = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDateCalc = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        startDateCalc = new Date(0);
        break;
    }
    return { startDate: startDateCalc, endDate: endDateCalc };
  })();

  // Fetch data based on format parameter or default
  const exportFormat = format as string || 'bookings';

  let data: any;
  let filename: string;

  switch (exportFormat) {
    case 'bookings':
      data = await Booking.find({
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      })
        .populate('customerId', 'firstName lastName email')
        .populate('providerId', 'firstName lastName email')
        .populate('serviceId', 'name category')
        .lean();
      filename = `bookings-export-${new Date().toISOString().split('T')[0]}`;
      break;

    case 'revenue':
      data = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'customerId',
            foreignField: '_id',
            as: 'customer'
          }
        },
        { $unwind: '$customer' },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalRevenue: { $sum: '$pricing.totalAmount' },
            totalBookings: { $sum: 1 },
            avgBookingValue: { $avg: '$pricing.totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      filename = `revenue-export-${new Date().toISOString().split('T')[0]}`;
      break;

    case 'providers':
      data = await ProviderProfile.find()
        .populate('userId', 'firstName lastName email accountStatus createdAt')
        .lean();
      filename = `providers-export-${new Date().toISOString().split('T')[0]}`;
      break;

    case 'services':
      data = await Service.find()
        .populate('providerId', 'firstName lastName email')
        .lean();
      filename = `services-export-${new Date().toISOString().split('T')[0]}`;
      break;

    default:
      data = [];
      filename = `export-${new Date().toISOString().split('T')[0]}`;
      break;
  }

  // Return data based on export type
  if (type === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json({
      success: true,
      data,
      metadata: {
        exportType: type,
        format: exportFormat,
        dateRange,
        recordCount: Array.isArray(data) ? data.length : 0,
        exportedAt: new Date().toISOString()
      }
    });
  }

  if (type === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.send('No data to export');
    }

    // Get headers from first record
    const headers = Object.keys(data[0]).filter(key => !key.startsWith('_'));

    // Build CSV content
    const csvRows: string[] = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        return String(value).replace(/"/g, '""');
      });
      csvRows.push(values.join(','));
    }

    return res.send(csvRows.join('\n'));
  }

  // For PDF, return a stub with instructions (actual PDF generation would require a library like pdfkit)
  if (type === 'pdf') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json({
      success: true,
      message: 'PDF export is not yet implemented. Data exported as JSON instead.',
      data,
      metadata: {
        exportType: 'pdf',
        format: exportFormat,
        dateRange,
        recordCount: Array.isArray(data) ? data.length : 0,
        exportedAt: new Date().toISOString()
      }
    });
  }

  // Fallback for unexpected types (should not reach here due to validation above)
  return res.status(400).json({
    success: false,
    error: 'Invalid export type'
  });
}));

/**
 * @route   GET /api/analytics/funnel
 * @desc    Canonical booking funnel metrics
 * @access  Admin
 * @query   startDate, endDate OR period (7d|30d|90d|365d)
 */
router.get('/funnel', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { start, end, period } = parseAnalyticsDateRange(req.query);
  const funnel: FunnelMetrics = await getBookingFunnel(start, end);

  res.json({
    success: true,
    data: funnel,
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      period: period || null,
    },
  });
}));

/**
 * @route   GET /api/analytics/geographic
 * @desc    Canonical geographic analytics (city-level)
 * @access  Admin
 * @query   startDate, endDate OR period (7d|30d|90d|365d)
 */
router.get('/geographic', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { start, end, period } = parseAnalyticsDateRange(req.query);
  const geographic: GeographicAnalytics = await getGeographicAnalytics(start, end);

  res.json({
    success: true,
    data: geographic,
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      period: period || null,
    },
  });
}));

export default router;
