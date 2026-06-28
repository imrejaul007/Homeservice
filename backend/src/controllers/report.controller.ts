import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { reportService } from '../services/report.service';
import logger from '../utils/logger';

export const generateCustomReport = asyncHandler(async (req: Request, res: Response) => {
  const { metrics, dateRange, grouping, chartType } = req.body;
  const adminUser = req.user as any;
  if (!metrics || !dateRange || !grouping || !chartType) {
    throw ApiError.badRequest('Missing required fields');
  }
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw ApiError.badRequest('Invalid date range');
  }
  if (startDate > endDate) {
    throw ApiError.badRequest('Start must be before end');
  }
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    throw ApiError.badRequest('Date range max 365 days');
  }
  const result = await reportService.generateReport({ metrics, dateRange: { startDate, endDate }, grouping, chartType });
  logger.info('Custom report generated', { action: 'CUSTOM_REPORT_GENERATED', adminId: adminUser._id });
  res.json({ success: true, data: result });
});

export const getReportTemplates = asyncHandler(async (req: Request, res: Response) => {
  const adminUser = req.user as any;
  const templates = await reportService.getTemplates(adminUser._id.toString());
  res.json({ success: true, data: templates });
});

export const createReportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, config } = req.body;
  const adminUser = req.user as any;
  if (!name || !config) {
    throw ApiError.badRequest('Name and config are required');
  }
  const template = await reportService.saveTemplate({ name, description, config, createdBy: adminUser._id });
  res.status(201).json({ success: true, data: template });
});

export const getReportTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminUser = req.user as any;
  const template = await reportService.getTemplateById(id);
  if (!template) { throw ApiError.notFound('Template not found'); }
  if ((template.createdBy as any)?.toString() !== adminUser._id.toString()) { throw ApiError.forbidden('Access denied'); }
  res.json({ success: true, data: template });
});

export const updateReportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, config } = req.body;
  const adminUser = req.user as any;
  const existing = await reportService.getTemplateById(id);
  if (!existing) { throw ApiError.notFound('Template not found'); }
  if ((existing.createdBy as any)?.toString() !== adminUser._id.toString()) { throw ApiError.forbidden('Access denied'); }
  const updates: any = {};
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (config) updates.config = config;
  const template = await reportService.updateTemplate(id, updates);
  res.json({ success: true, data: template });
});

export const deleteReportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminUser = req.user as any;
  const existing = await reportService.getTemplateById(id);
  if (!existing) { throw ApiError.notFound('Template not found'); }
  if ((existing.createdBy as any)?.toString() !== adminUser._id.toString()) { throw ApiError.forbidden('Access denied'); }
  await reportService.deleteTemplate(id);
  res.json({ success: true, message: 'Template deleted successfully' });
});

export const getScheduledReports = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', enabled } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
  const options: any = { page: pageNum, limit: limitNum };
  if (enabled !== undefined) { options.enabled = enabled === 'true'; }
  const result = await reportService.listScheduledReports(options);
  res.json({ success: true, data: result });
});

export const createScheduledReport = asyncHandler(async (req: Request, res: Response) => {
  const { name, type, frequency, format, recipients, filters, enabled = true } = req.body;
  const adminUser = req.user as any;
  if (!name || !type || !frequency || !recipients || recipients.length === 0) {
    throw ApiError.badRequest('Name, type, frequency, and recipients are required');
  }
  const validTypes = ['churn', 'revenue', 'booking', 'customer', 'provider', 'performance', 'custom'];
  if (!validTypes.includes(type)) { throw ApiError.badRequest('Invalid type'); }
  const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
  if (!validFrequencies.includes(frequency)) { throw ApiError.badRequest('Invalid frequency'); }
  const report = await reportService.createScheduledReport({ name, type, frequency, format: format || 'json', recipients, filters, enabled }, adminUser._id.toString());
  res.status(201).json({ success: true, data: report });
});

export const updateScheduledReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const report = await reportService.updateScheduledReport(id, updates);
  if (!report) { throw ApiError.notFound('Scheduled report not found'); }
  res.json({ success: true, data: report });
});

export const deleteScheduledReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await reportService.deleteScheduledReport(id);
  if (!deleted) { throw ApiError.notFound('Scheduled report not found'); }
  res.json({ success: true, message: 'Scheduled report deleted successfully' });
});

export const toggleScheduledReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') { throw ApiError.badRequest('Enabled must be boolean'); }
  const report = await reportService.toggleReport(id, enabled);
  if (!report) { throw ApiError.notFound('Scheduled report not found'); }
  res.json({ success: true, data: report });
});
