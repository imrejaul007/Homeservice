import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { commissionService } from '../services/commission.service';
import { taxService } from '../services/taxService';
import { earningsReportService } from '../services/earningsReport.service';
import { Commission, CommissionRule } from '../models/commission.model';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

// Helper to send success response
const sendSuccess = (res: Response, data: any, message?: string, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

// Helper to send error response
const sendError = (res: Response, message: string, statusCode = 400, error?: any) => {
  logger.error(message, { error });
  res.status(statusCode).json({
    success: false,
    error: message,
    details: error?.message,
  });
};

// Parse date range from query params
const parseDateRange = (query: any): { startDate: Date; endDate: Date } => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  if (query.startDate) {
    startDate = new Date(query.startDate);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

// ============================================
// COMMISSION ENDPOINTS
// ============================================

/**
 * Get commissions for the authenticated provider
 * GET /api/earnings/commissions
 */
export const getCommissions = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const { startDate, endDate } = parseDateRange(req.query);
  const status = req.query.status as string;
  const categoryId = req.query.categoryId as string;

  const result = await commissionService.getProviderCommissions(providerId, {
    startDate,
    endDate,
    status: status as any,
    categoryId,
    page,
    limit,
  });

  sendSuccess(res, result);
});

/**
 * Get a single commission by ID
 * GET /api/earnings/commissions/:id
 */
export const getCommissionById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const commission = await commissionService.getCommissionById(id);

  if (!commission) {
    return sendError(res, 'Commission not found', 404);
  }

  // Verify the commission belongs to the authenticated provider
  if (commission.providerId.toString() !== (req.user?._id?.toString() ?? '') && req.user?.role !== 'admin') {
    return sendError(res, 'Access denied', 403);
  }

  sendSuccess(res, { commission });
});

/**
 * Get commission summary for a date range
 * GET /api/earnings/commissions/summary
 */
export const getCommissionSummary = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const { startDate, endDate } = parseDateRange(req.query);
  const summary = await commissionService.getProviderCommissionSummary(providerId, startDate, endDate);

  sendSuccess(res, summary);
});

/**
 * Adjust a commission
 * POST /api/earnings/commissions/:id/adjust
 */
export const adjustCommission = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, amount, reason } = req.body;

  if (!type || amount === undefined || !reason) {
    return sendError(res, 'Missing required fields: type, amount, reason', 400);
  }

  // Only admin can adjust commissions
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Only administrators can adjust commissions', 403);
  }

  const result = await commissionService.adjustCommission(
    id,
    { type, amount, reason },
    req.user._id,
    'admin'
  );

  if (!result.success) {
    return sendError(res, result.error || 'Failed to adjust commission', 400);
  }

  sendSuccess(res, { commission: result.commission }, 'Commission adjusted successfully');
});

/**
 * Update commission status
 * PATCH /api/earnings/commissions/:id/status
 */
export const updateCommissionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status) {
    return sendError(res, 'Status is required', 400);
  }

  // Only admin can update commission status
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Only administrators can update commission status', 403);
  }

  const result = await commissionService.updateCommissionStatus(
    id,
    status,
    req.user._id,
    'admin',
    reason
  );

  if (!result.success) {
    return sendError(res, result.error || 'Failed to update commission status', 400);
  }

  sendSuccess(res, { commission: result.commission }, 'Commission status updated successfully');
});

// ============================================
// TAX DOCUMENT ENDPOINTS
// ============================================

/**
 * Get tax documents for the authenticated provider
 * GET /api/earnings/tax-documents
 */
export const getTaxDocuments = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;
  const type = req.query.type as any;
  const status = req.query.status as any;

  const result = await taxService.getProviderTaxDocuments(providerId, {
    page,
    limit,
    year,
    type,
    status,
  });

  sendSuccess(res, result);
});

/**
 * Get a tax document by ID
 * GET /api/earnings/tax-documents/:id
 */
export const getTaxDocumentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const document = await taxService.getTaxDocumentById(id);

  if (!document) {
    return sendError(res, 'Tax document not found', 404);
  }

  // Verify the document belongs to the authenticated provider
  if (document.providerId.toString() !== (req.user?._id?.toString() ?? '') && req.user?.role !== 'admin') {
    return sendError(res, 'Access denied', 403);
  }

  sendSuccess(res, { document });
});

/**
 * Generate invoice for a period
 * POST /api/earnings/tax-documents/generate
 */
export const generateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const { startDate, endDate, customerInfo } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const document = await taxService.generateProviderInvoice(
    providerId,
    new Date(startDate),
    new Date(endDate),
    { customerInfo }
  );

  sendSuccess(res, { document }, 'Invoice generated successfully', 201);
});

/**
 * Download tax document
 * GET /api/earnings/tax-documents/:id/download
 */
export const downloadTaxDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const document = await taxService.getTaxDocumentById(id);

  if (!document) {
    return sendError(res, 'Tax document not found', 404);
  }

  // Verify access
  if (document.providerId.toString() !== (req.user?._id?.toString() ?? '') && req.user?.role !== 'admin') {
    return sendError(res, 'Access denied', 403);
  }

  // For now, return the document data as JSON
  // In production, this would generate a PDF
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${document.documentNumber}.json"`);
  res.json(document);
});

// ============================================
// EARNINGS REPORT ENDPOINTS
// ============================================

/**
 * Get earnings reports for the authenticated provider
 * GET /api/earnings/reports
 */
export const getEarningsReports = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;
  const status = req.query.status as any;

  const result = await earningsReportService.getProviderReports(providerId, {
    page,
    limit,
    year,
    status,
  });

  sendSuccess(res, result);
});

/**
 * Get an earnings report by ID
 * GET /api/earnings/reports/:id
 */
export const getEarningsReportById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const report = await earningsReportService.getReportById(id);

  if (!report) {
    return sendError(res, 'Earnings report not found', 404);
  }

  // Verify the report belongs to the authenticated provider
  if (report.providerId.toString() !== (req.user?._id?.toString() ?? '') && req.user?.role !== 'admin') {
    return sendError(res, 'Access denied', 403);
  }

  sendSuccess(res, { report });
});

/**
 * Generate a new earnings report
 * POST /api/earnings/reports/generate
 */
export const generateEarningsReport = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const { startDate, endDate, includeTaxDocument, region } = req.body;

  if (!startDate || !endDate) {
    return sendError(res, 'Start date and end date are required', 400);
  }

  const report = await earningsReportService.generateEarningsReport(
    providerId,
    new Date(startDate),
    new Date(endDate),
    { includeTaxDocument, region }
  );

  sendSuccess(res, { report }, 'Earnings report generated successfully', 201);
});

/**
 * Get dashboard summary
 * GET /api/earnings/dashboard
 */
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const period = (req.query.period as any) || 'month';
  const summary = await earningsReportService.getDashboardSummary(providerId, period);

  sendSuccess(res, summary);
});

/**
 * Get annual statement
 * GET /api/earnings/annual-statement/:year
 */
export const getAnnualStatement = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const year = parseInt(req.params.year);
  if (!year || isNaN(year)) {
    return sendError(res, 'Valid year is required', 400);
  }

  const statement = await earningsReportService.getAnnualStatement(providerId, year);
  sendSuccess(res, statement);
});

/**
 * Export earnings data
 * GET /api/earnings/export
 */
export const exportEarnings = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.user?._id;
  if (!providerId) {
    return sendError(res, 'Authentication required', 401);
  }

  const { format } = req.query;
  const { startDate, endDate } = parseDateRange(req.query);
  const exportFormat = (format as string) || 'json';

  const result = await earningsReportService.exportEarningsData(
    providerId,
    startDate,
    endDate,
    exportFormat as 'csv' | 'json'
  );

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get all commission rules (admin)
 * GET /api/admin/commission-rules
 * Added pagination with hard limit for security
 */
export const getCommissionRules = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  // Pagination params with hard limits
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  const skip = (page - 1) * limit;

  const [rules, total] = await Promise.all([
    CommissionRule.find({}).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    CommissionRule.countDocuments({})
  ]);

  const totalPages = Math.ceil(total / limit);

  sendSuccess(res, {
    rules,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  });
});

/**
 * Create commission rule (admin)
 * POST /api/admin/commission-rules
 */
export const createCommissionRule = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const rule = new CommissionRule(req.body);
  await rule.save();

  sendSuccess(res, { rule }, 'Commission rule created successfully', 201);
});

/**
 * Update commission rule (admin)
 * PATCH /api/admin/commission-rules/:id
 */
export const updateCommissionRule = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const { id } = req.params;
  const rule = await CommissionRule.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

  if (!rule) {
    return sendError(res, 'Commission rule not found', 404);
  }

  sendSuccess(res, { rule }, 'Commission rule updated successfully');
});

/**
 * Delete commission rule (admin)
 * DELETE /api/admin/commission-rules/:id
 */
export const deleteCommissionRule = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const { id } = req.params;
  const rule = await CommissionRule.findByIdAndDelete(id);

  if (!rule) {
    return sendError(res, 'Commission rule not found', 404);
  }

  sendSuccess(res, null, 'Commission rule deleted successfully');
});

/**
 * Get tax configurations (admin)
 * GET /api/admin/tax-configs
 * Added pagination with hard limit for security
 */
export const getTaxConfigs = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  // Pagination params with hard limits
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const skip = (page - 1) * limit;

  const { TaxConfigModel } = await import('../services/taxService');

  const [configs, total] = await Promise.all([
    TaxConfigModel.find({}).sort({ region: 1 }).skip(skip).limit(limit).lean(),
    TaxConfigModel.countDocuments({})
  ]);

  const totalPages = Math.ceil(total / limit);

  sendSuccess(res, {
    configs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  });
});

/**
 * Update tax configuration (admin)
 * PATCH /api/admin/tax-configs/:region
 */
export const updateTaxConfig = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const { region } = req.params;
  const config = await taxService.updateTaxConfig(region, req.body);

  sendSuccess(res, { config }, 'Tax configuration updated successfully');
});

/**
 * Batch calculate commissions (admin)
 * POST /api/admin/commissions/batch-calculate
 */
export const batchCalculateCommissions = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const { bookingIds } = req.body;

  if (!bookingIds || !Array.isArray(bookingIds)) {
    return sendError(res, 'Booking IDs array is required', 400);
  }

  const result = await commissionService.batchCalculateCommissions(bookingIds);
  sendSuccess(res, result, 'Batch commission calculation completed');
});

export default {
  // Commission endpoints
  getCommissions,
  getCommissionById,
  getCommissionSummary,
  adjustCommission,
  updateCommissionStatus,
  // Tax document endpoints
  getTaxDocuments,
  getTaxDocumentById,
  generateInvoice,
  downloadTaxDocument,
  // Earnings report endpoints
  getEarningsReports,
  getEarningsReportById,
  generateEarningsReport,
  getDashboardSummary,
  getAnnualStatement,
  exportEarnings,
  // Admin endpoints
  getCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  getTaxConfigs,
  updateTaxConfig,
  batchCalculateCommissions,
};
