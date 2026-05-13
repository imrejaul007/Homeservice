import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
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

const router = Router();

/**
 * @route   GET /api/analytics/overview
 * @desc    Get analytics overview (all metrics)
 * @access  Admin
 */
router.get('/overview', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const { period = 'month' } = _req.query;

  const [bookings, providers, customers, revenue] = await Promise.all([
    getBookingAnalytics(period as string),
    getProviderAnalytics(),
    getCustomerAnalytics(),
    getRevenueAnalytics(period as string),
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
router.get('/bookings', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const { period = 'month' } = _req.query;

  const analytics = await getBookingAnalytics(period as string);

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
router.get('/providers', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await getProviderAnalytics();

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
router.get('/customers', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await getCustomerAnalytics();

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
router.get('/revenue', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const { period = 'month' } = _req.query;

  const analytics = await getRevenueAnalytics(period as string);

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
router.get('/services', authenticate, asyncHandler(async (_req: Request, res: Response) => {
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
router.post('/refresh', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  await clearAnalyticsCache();

  res.json({
    success: true,
    message: 'Analytics cache cleared',
  });
}));

/**
 * @route   GET /api/analytics/provider/:id
 * @desc    Get analytics for specific provider
 * @access  Provider (own) or Admin
 */
router.get('/provider/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as any;

  // Check if user is the provider or admin
  if (user.role !== 'admin' && user._id.toString() !== id) {
    throw new ApiError(403, 'Not authorized to view these analytics');
  }

  res.json({
    success: true,
    data: {
      providerId: id,
      message: 'Provider analytics endpoint - implement based on requirements',
    },
  });
}));

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard summary metrics
 * @access  Admin
 */
router.get('/dashboard', authenticate, asyncHandler(async (_req: Request, res: Response) => {
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
    ProviderProfile.countDocuments({ verificationStatus: 'pending' }),
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
router.get('/export/:type', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;
  const { startDate, endDate, format } = req.query;

  // Validate export type
  const validTypes = ['csv', 'json', 'pdf'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid export type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Build date range
  const dateRange: { startDate: Date; endDate: Date } = {
    startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: endDate ? new Date(endDate as string) : new Date()
  };

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

export default router;
