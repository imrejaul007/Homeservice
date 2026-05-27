import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { reportService, ReportConfig, ScheduledReport } from '../services/report.service';

const router = Router();

/**
 * @route   POST /api/admin/reports
 * @desc    Create a new scheduled report
 * @access  Admin
 */
router.post('/admin/reports', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { name, type, frequency, format, recipients, filters, enabled } = req.body;

  // Validate required fields
  if (!name || !type || !frequency || !recipients || recipients.length === 0) {
    throw new ApiError(400, 'Name, type, frequency, and recipients are required');
  }

  // Validate type
  const validTypes = ['churn', 'revenue', 'booking', 'customer', 'provider', 'performance', 'custom'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate frequency
  const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
  if (!validFrequencies.includes(frequency)) {
    throw new ApiError(400, `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`);
  }

  // Validate format
  const validFormats = ['json', 'csv', 'pdf'];
  if (format && !validFormats.includes(format)) {
    throw new ApiError(400, `Invalid format. Must be one of: ${validFormats.join(', ')}`);
  }

  // Validate recipients are valid emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const recipient of recipients) {
    if (!emailRegex.test(recipient)) {
      throw new ApiError(400, `Invalid email address: ${recipient}`);
    }
  }

  const config: ReportConfig = {
    name,
    type,
    frequency,
    format: format || 'json',
    recipients,
    filters,
    enabled: enabled !== false,
  };

  const report = await reportService.createScheduledReport(config, user._id.toString());

  res.status(201).json({
    success: true,
    data: report,
  });
}));

/**
 * @route   GET /api/admin/reports
 * @desc    List all scheduled reports
 * @access  Admin
 */
router.get('/admin/reports', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { enabled, type, page = '1', limit = '20' } = req.query;

  const options: {
    enabled?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  } = {};

  if (enabled !== undefined) {
    options.enabled = enabled === 'true';
  }

  if (type) {
    options.type = type as string;
  }

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, 'Page must be a positive number');
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, 'Limit must be between 1 and 100');
  }

  options.page = pageNum;
  options.limit = limitNum;

  const result = await reportService.listScheduledReports(options);

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * @route   GET /api/admin/reports/:id
 * @desc    Get a specific scheduled report
 * @access  Admin
 */
router.get('/admin/reports/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const report = await reportService.getScheduledReport(id);

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * @route   PATCH /api/admin/reports/:id
 * @desc    Update a scheduled report
 * @access  Admin
 */
router.patch('/admin/reports/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, frequency, format, recipients, filters, enabled } = req.body;

  const updates: Partial<ReportConfig> = {};

  if (name) updates.name = name;
  if (type) {
    const validTypes = ['churn', 'revenue', 'booking', 'customer', 'provider', 'performance', 'custom'];
    if (!validTypes.includes(type)) {
      throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    updates.type = type;
  }
  if (frequency) {
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(frequency)) {
      throw new ApiError(400, `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`);
    }
    updates.frequency = frequency;
  }
  if (format) {
    const validFormats = ['json', 'csv', 'pdf'];
    if (!validFormats.includes(format)) {
      throw new ApiError(400, `Invalid format. Must be one of: ${validFormats.join(', ')}`);
    }
    updates.format = format;
  }
  if (recipients) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        throw new ApiError(400, `Invalid email address: ${recipient}`);
      }
    }
    updates.recipients = recipients;
  }
  if (filters) updates.filters = filters;
  if (enabled !== undefined) updates.enabled = enabled;

  const report = await reportService.updateScheduledReport(id, updates);

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * @route   DELETE /api/admin/reports/:id
 * @desc    Delete a scheduled report
 * @access  Admin
 */
router.delete('/admin/reports/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const deleted = await reportService.deleteScheduledReport(id);

  if (!deleted) {
    throw new ApiError(404, 'Report not found');
  }

  res.json({
    success: true,
    message: 'Report deleted successfully',
  });
}));

/**
 * @route   POST /api/admin/reports/:id/toggle
 * @desc    Toggle report enabled status
 * @access  Admin
 */
router.post('/admin/reports/:id/toggle', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;

  if (enabled === undefined) {
    throw new ApiError(400, 'Enabled status is required');
  }

  const report = await reportService.toggleReport(id, enabled);

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * @route   POST /api/admin/reports/:id/trigger
 * @desc    Trigger report generation
 * @access  Admin
 */
router.post('/admin/reports/:id/trigger', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await reportService.triggerReport(id);

  if (!result.success) {
    if (result.error === 'Report not found') {
      throw new ApiError(404, result.error);
    }
    throw new ApiError(500, result.error || 'Failed to generate report');
  }

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * @route   GET /api/admin/reports/due
 * @desc    Get all reports due for execution
 * @access  Admin
 */
router.get('/admin/reports/due', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const dueReports = await reportService.getDueReports();

  res.json({
    success: true,
    data: {
      count: dueReports.length,
      reports: dueReports,
    },
  });
}));

/**
 * @route   POST /api/admin/reports/run-due
 * @desc    Run all due reports
 * @access  Admin
 */
router.post('/admin/reports/run-due', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const results = await reportService.runDueReports();

  res.json({
    success: true,
    data: results,
  });
}));

export default router;
