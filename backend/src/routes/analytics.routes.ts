import { Router, Request, Response } from 'express';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth.middleware';
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
import { ingestAnalyticsEventBatch } from '../services/analyticsEventsIngest.service';
import PDFDocument from 'pdfkit';
import { format as formatDate } from 'date-fns';

const router = Router();

/**
 * Get table headers based on export format
 */
function getTableHeaders(format: string): string[] {
  switch (format) {
    case 'bookings':
      return ['Date', 'Customer', 'Provider', 'Status'];
    case 'revenue':
      return ['Date', 'Revenue', 'Bookings', 'Avg Value'];
    case 'providers':
      return ['Name', 'Email', 'Status', 'Joined'];
    case 'services':
      return ['Name', 'Category', 'Status', 'Provider'];
    default:
      return ['ID', 'Name', 'Status', 'Date'];
  }
}

/**
 * Format a data row for the PDF table based on export format
 */
function formatTableRow(row: any, format: string): string[] {
  switch (format) {
    case 'bookings':
      return [
        row.createdAt ? formatDate(new Date(row.createdAt), 'MM/dd/yy') : 'N/A',
        row.customerId?.firstName ? `${row.customerId.firstName} ${row.customerId.lastName || ''}` : row.customerId?.email || 'N/A',
        row.providerId?.firstName ? `${row.providerId.firstName} ${row.providerId.lastName || ''}` : row.providerId?.email || 'N/A',
        row.status || 'N/A'
      ];
    case 'revenue':
      return [
        row._id || 'N/A',
        `$${(row.totalRevenue || 0).toFixed(2)}`,
        String(row.totalBookings || 0),
        `$${(row.avgBookingValue || 0).toFixed(2)}`
      ];
    case 'providers':
      return [
        row.userId?.firstName ? `${row.userId.firstName} ${row.userId.lastName || ''}` : 'N/A',
        row.userId?.email || 'N/A',
        row.userId?.accountStatus || row.verificationStatus?.overall || 'N/A',
        row.userId?.createdAt ? formatDate(new Date(row.userId.createdAt), 'MM/dd/yy') : 'N/A'
      ];
    case 'services':
      return [
        row.name || 'N/A',
        row.category || 'N/A',
        row.status || 'N/A',
        row.providerId?.firstName ? `${row.providerId.firstName} ${row.providerId.lastName || ''}` : 'N/A'
      ];
    default:
      return ['N/A', 'N/A', 'N/A', 'N/A'];
  }
}

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
 * @route   POST /api/analytics
 * @desc    Ingest batched frontend analytics events (provider funnel events)
 * @access  Public (optional auth enriches userId)
 */
router.post('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { events } = req.body || {};
  if (!Array.isArray(events)) {
    throw new ApiError(400, 'events array is required');
  }

  const user = req.user as { _id?: { toString(): string } } | undefined;
  const result = await ingestAnalyticsEventBatch(events, user?._id?.toString());

  res.status(202).json({
    success: true,
    data: result,
  });
}));

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
 * @desc    Get analytics for specific provider (admin only; MongoDB ObjectId only)
 * @access  Admin only
 * @note    :id is restricted to ObjectId so paths like "dashboard" are not captured here
 */
router.get('/provider/:id([0-9a-fA-F]{24})', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
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
  const { period, startDate, endDate, format: exportFormatQuery } = req.query;

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
  const exportFormat = (exportFormatQuery as string) || 'bookings';

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

  // For PDF export, generate a properly formatted PDF document
  if (type === 'pdf') {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);
      });

      // Helper function to check if we need a new page
      const checkPageBreak = (yPos: number, requiredSpace: number = 100) => {
        if (yPos + requiredSpace > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          return doc.y;
        }
        return yPos;
      };

      // Title
      doc.fontSize(24).font('Helvetica-Bold').text('Analytics Report', { align: 'center' });
      doc.moveDown(0.5);

      // Report metadata
      doc.fontSize(12).font('Helvetica').fillColor('#666666');
      doc.text(`Export Type: ${exportFormat.charAt(0).toUpperCase() + exportFormat.slice(1)}`, { align: 'center' });
      doc.text(`Period: ${formatDate(dateRange.startDate, 'MMM dd, yyyy')} - ${formatDate(dateRange.endDate, 'MMM dd, yyyy')}`, { align: 'center' });
      doc.text(`Generated: ${formatDate(new Date(), 'MMM dd, yyyy HH:mm')}`, { align: 'center' });
      doc.text(`Records: ${Array.isArray(data) ? data.length : 0}`, { align: 'center' });
      doc.moveDown(1);

      // Summary statistics
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Summary Statistics', { underline: true });
      doc.moveDown(0.5);

      let y = doc.y;
      if (exportFormat === 'bookings' && Array.isArray(data)) {
        const totalBookings = data.length;
        const completedBookings = data.filter((b: any) => b.status === 'completed').length;
        const pendingBookings = data.filter((b: any) => ['pending', 'confirmed'].includes(b.status)).length;
        const cancelledBookings = data.filter((b: any) => b.status === 'cancelled').length;
        const totalRevenue = data
          .filter((b: any) => b.pricing?.totalAmount)
          .reduce((sum: number, b: any) => sum + (b.pricing?.totalAmount || 0), 0);

        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Bookings: ${totalBookings}`);
        doc.text(`Completed: ${completedBookings}`);
        doc.text(`Pending/Confirmed: ${pendingBookings}`);
        doc.text(`Cancelled: ${cancelledBookings}`);
        doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`);
      } else if (exportFormat === 'revenue' && Array.isArray(data)) {
        const totalRevenue = data.reduce((sum: number, r: any) => sum + (r.totalRevenue || 0), 0);
        const totalBookings = data.reduce((sum: number, r: any) => sum + (r.totalBookings || 0), 0);
        const avgValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`);
        doc.text(`Total Bookings: ${totalBookings}`);
        doc.text(`Average Booking Value: $${avgValue.toFixed(2)}`);
      } else if (exportFormat === 'providers' && Array.isArray(data)) {
        const totalProviders = data.length;
        const activeProviders = data.filter((p: any) => p.userId?.accountStatus === 'active').length;

        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Providers: ${totalProviders}`);
        doc.text(`Active Providers: ${activeProviders}`);
      } else if (exportFormat === 'services' && Array.isArray(data)) {
        const totalServices = data.length;
        const activeServices = data.filter((s: any) => s.status === 'active').length;

        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Services: ${totalServices}`);
        doc.text(`Active Services: ${activeServices}`);
      }

      doc.moveDown(1);
      y = doc.y;

      // Data table
      if (Array.isArray(data) && data.length > 0) {
        // Section header
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#333333');
        y = checkPageBreak(doc.y, 60);
        doc.text('Data Table', { underline: true });
        doc.moveDown(0.5);

        // Table header
        y = checkPageBreak(doc.y, 30);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
        const tableTop = y;
        const colWidth = (doc.page.width - 100) / 4;

        // Draw header row background
        doc.rect(50, tableTop - 5, doc.page.width - 100, 20).fill('#333333');
        doc.fillColor('#ffffff');

        const headers = getTableHeaders(exportFormat);
        headers.forEach((header: string, i: number) => {
          doc.text(header, 55 + i * colWidth, tableTop, { width: colWidth - 10 });
        });

        y = tableTop + 25;
        doc.fontSize(8).font('Helvetica').fillColor('#333333');

        // Data rows (limit to first 50 rows for readability)
        const displayData = data.slice(0, 50);
        for (const row of displayData) {
          y = checkPageBreak(y, 25);

          // Alternate row background
          if (displayData.indexOf(row) % 2 === 0) {
            doc.rect(50, y - 5, doc.page.width - 100, 18).fill('#f5f5f5');
          }

          const rowData = formatTableRow(row, exportFormat);
          rowData.forEach((cell: string, i: number) => {
            doc.text(cell, 55 + i * colWidth, y, { width: colWidth - 10 });
          });
          y += 18;
        }

        if (data.length > 50) {
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666');
          doc.text(`... and ${data.length - 50} more records (showing first 50)`, { align: 'center' });
        }
      } else {
        doc.fontSize(12).font('Helvetica-Oblique').fillColor('#666666');
        doc.text('No data available for the selected criteria.', { align: 'center' });
      }

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('#999999');
      doc.text(
        'This report was automatically generated. For questions, contact support.',
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Fallback to JSON on error
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json({
        success: true,
        message: 'PDF generation failed. Data exported as JSON instead.',
        data,
        metadata: {
          exportType: 'pdf-fallback',
          format: exportFormat,
          dateRange,
          recordCount: Array.isArray(data) ? data.length : 0,
          exportedAt: new Date().toISOString()
        }
      });
    }
    return; // Response handled in doc.on('end')
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
