import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { slaService, SLAThresholds, SLAMetrics, SLAReport } from '../services/sla.service';

const router = Router();

/**
 * @route   GET /api/sla/metrics
 * @desc    Get SLA metrics for a date range
 * @access  Admin
 */
router.get('/metrics', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format.');
  }

  if (start > end) {
    throw new ApiError(400, 'startDate must be before endDate');
  }

  const metrics: SLAMetrics = await slaService.calculateCompliance(start, end);

  res.json({
    success: true,
    data: metrics,
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalBookings: metrics.totalBookings,
    },
  });
}));

/**
 * @route   GET /api/sla/report
 * @desc    Generate comprehensive SLA report
 * @access  Admin
 */
router.get('/report', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format.');
  }

  if (start > end) {
    throw new ApiError(400, 'startDate must be before endDate');
  }

  const report: SLAReport = await slaService.generateReport(start, end);

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * @route   GET /api/sla/overview
 * @desc    Get SLA overview for dashboard
 * @access  Admin
 */
router.get('/overview', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const overview = await slaService.getOverview();

  res.json({
    success: true,
    data: overview,
  });
}));

/**
 * @route   GET /api/sla/thresholds
 * @desc    Get current SLA thresholds
 * @access  Admin
 */
router.get('/thresholds', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const thresholds: SLAThresholds = slaService.getThresholds();

  res.json({
    success: true,
    data: thresholds,
  });
}));

/**
 * @route   PUT /api/sla/thresholds
 * @desc    Update SLA thresholds
 * @access  Admin
 */
router.put('/thresholds', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingResponseTime, bookingConfirmationTime, serviceCompletionTime, providerResponseTime, cancellationWindow } = req.body;

  const newThresholds: Partial<SLAThresholds> = {};

  if (bookingResponseTime !== undefined) {
    if (typeof bookingResponseTime !== 'number' || bookingResponseTime < 1) {
      throw new ApiError(400, 'bookingResponseTime must be a positive number');
    }
    newThresholds.bookingResponseTime = bookingResponseTime;
  }

  if (bookingConfirmationTime !== undefined) {
    if (typeof bookingConfirmationTime !== 'number' || bookingConfirmationTime < 1) {
      throw new ApiError(400, 'bookingConfirmationTime must be a positive number');
    }
    newThresholds.bookingConfirmationTime = bookingConfirmationTime;
  }

  if (serviceCompletionTime !== undefined) {
    if (typeof serviceCompletionTime !== 'number' || serviceCompletionTime < 1) {
      throw new ApiError(400, 'serviceCompletionTime must be a positive number');
    }
    newThresholds.serviceCompletionTime = serviceCompletionTime;
  }

  if (providerResponseTime !== undefined) {
    if (typeof providerResponseTime !== 'number' || providerResponseTime < 1) {
      throw new ApiError(400, 'providerResponseTime must be a positive number');
    }
    newThresholds.providerResponseTime = providerResponseTime;
  }

  if (cancellationWindow !== undefined) {
    if (typeof cancellationWindow !== 'number' || cancellationWindow < 0) {
      throw new ApiError(400, 'cancellationWindow must be a non-negative number');
    }
    newThresholds.cancellationWindow = cancellationWindow;
  }

  slaService.setThresholds(newThresholds);

  res.json({
    success: true,
    message: 'SLA thresholds updated successfully',
    data: slaService.getThresholds(),
  });
}));

/**
 * @route   GET /api/sla/breaches
 * @desc    Get SLA breaches
 * @access  Admin
 */
router.get('/breaches', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, severity, type, page = '1', limit = '50' } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Build query (simplified - in production would have a dedicated breaches collection)
  const query: any = {
    createdAt: { $gte: start, $lte: end },
  };

  if (severity) {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity as string)) {
      throw new ApiError(400, `Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
    }
  }

  if (type) {
    const validTypes = ['response_time', 'confirmation_time', 'completion_time', 'cancellation'];
    if (!validTypes.includes(type as string)) {
      throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  const parsedLimit = Math.min(parseInt(limit as string, 10), 100);
  const parsedPage = Math.max(parseInt(page as string, 10), 1);
  const skip = (parsedPage - 1) * parsedLimit;

  // For now, return mock breach data based on compliance calculation
  // In production, this would query a dedicated breaches collection
  const metrics = await slaService.calculateCompliance(start, end);

  res.json({
    success: true,
    data: {
      breaches: [],
      total: metrics.breachedSLA,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(metrics.breachedSLA / parsedLimit),
    },
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      severity,
      type,
    },
  });
}));

/**
 * @route   GET /api/sla/trends
 * @desc    Get SLA compliance trends
 * @access  Admin
 */
router.get('/trends', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, granularity = 'day' } = req.query;

  // Default to last 90 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format.');
  }

  const metrics = await slaService.calculateCompliance(start, end);

  res.json({
    success: true,
    data: {
      trends: metrics.trends,
      summary: {
        averageCompliance: metrics.complianceRate,
        totalBookings: metrics.totalBookings,
        totalBreaches: metrics.breachedSLA,
      },
    },
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      granularity,
    },
  });
}));

/**
 * @route   GET /api/sla/providers
 * @desc    Get SLA compliance by provider
 * @access  Admin
 */
router.get('/providers', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, minCompliance, sortBy = 'totalBookings' } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const metrics = await slaService.calculateCompliance(start, end);
  let providers = metrics.byProvider;

  // Filter by minimum compliance if specified
  if (minCompliance) {
    const threshold = parseFloat(minCompliance as string);
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      providers = providers.filter(p => p.complianceRate >= threshold);
    }
  }

  // Sort
  if (sortBy === 'complianceRate') {
    providers.sort((a, b) => a.complianceRate - b.complianceRate);
  } else {
    providers.sort((a, b) => b.totalBookings - a.totalBookings);
  }

  res.json({
    success: true,
    data: providers,
    meta: {
      totalProviders: providers.length,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
  });
}));

/**
 * @route   GET /api/sla/categories
 * @desc    Get SLA compliance by category
 * @access  Admin
 */
router.get('/categories', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, minCompliance, sortBy = 'totalBookings' } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const metrics = await slaService.calculateCompliance(start, end);
  let categories = metrics.byCategory;

  // Filter by minimum compliance if specified
  if (minCompliance) {
    const threshold = parseFloat(minCompliance as string);
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      categories = categories.filter(c => c.complianceRate >= threshold);
    }
  }

  // Sort
  if (sortBy === 'complianceRate') {
    categories.sort((a, b) => a.complianceRate - b.complianceRate);
  } else {
    categories.sort((a, b) => b.totalBookings - a.totalBookings);
  }

  res.json({
    success: true,
    data: categories,
    meta: {
      totalCategories: categories.length,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
  });
}));

export default router;
