import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import Joi from 'joi';
import { commissionService } from '../services/commission.service';
import { taxService } from '../services/taxService';
import { earningsReportService } from '../services/earningsReport.service';
import { Commission, CommissionRule } from '../models/commission.model';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

// Helper to serialize dates in an object (convert Date to ISO string)
const serializeDates = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj !== 'object') return obj;

  const serialized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      serialized[key] = (value as Date).toISOString();
    } else if (Array.isArray(value)) {
      serialized[key] = value.map(serializeDates);
    } else if (value !== null && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)) {
      serialized[key] = serializeDates(value);
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
};

// Helper to send success response
const sendSuccess = (res: Response, data: any, message?: string, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data: serializeDates(data),
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
const parseDateRange = (query: any): { startDate: Date; endDate: Date } | null => {
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

  // Validate dates: check if they are valid Date objects
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null;
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
  const dateRange = parseDateRange(req.query);
  if (!dateRange) {
    return sendError(res, 'Invalid date format', 400);
  }
  const { startDate, endDate } = dateRange;
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

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid commission ID format', 400);
  }

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

  const dateRange = parseDateRange(req.query);
  if (!dateRange) {
    return sendError(res, 'Invalid date format', 400);
  }
  const { startDate, endDate } = dateRange;
  const summary = await commissionService.getProviderCommissionSummary(providerId, startDate, endDate);

  sendSuccess(res, summary);
});

// ============================================
// COMMISSION VALIDATION SCHEMAS
// ============================================

const adjustCommissionSchema = Joi.object({
  type: Joi.string().valid('bonus', 'penalty', 'correction', 'promotion').required().messages({
    'any.only': 'Type must be one of: bonus, penalty, correction, promotion',
    'any.required': 'Type is required',
  }),
  amount: Joi.number().min(-10000).max(10000).required().messages({
    'number.min': 'Amount cannot be less than -10000',
    'number.max': 'Amount cannot exceed 10000',
    'any.required': 'Amount is required',
  }),
  reason: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Reason must be at least 10 characters',
    'string.max': 'Reason cannot exceed 500 characters',
    'any.required': 'Reason is required',
  }),
});

const updateCommissionStatusSchema = Joi.object({
  status: Joi.string()
    .valid('calculated', 'pending', 'approved', 'paid', 'disputed', 'reversed')
    .required()
    .messages({
      'any.only': 'Status must be one of: calculated, pending, approved, paid, disputed, reversed',
      'any.required': 'Status is required',
    }),
  reason: Joi.string().max(500).optional(),
});

/**
 * Adjust a commission
 * POST /api/earnings/commissions/:id/adjust
 */
export const adjustCommission = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid commission ID format', 400);
  }

  // Validate request body with Joi schema
  const { error, value } = adjustCommissionSchema.validate(req.body);
  if (error) {
    return sendError(res, error.details[0].message, 400);
  }

  const { type, amount, reason } = value;

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

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid commission ID format', 400);
  }

  // Validate request body with Joi schema
  const { error, value } = updateCommissionStatusSchema.validate(req.body);
  if (error) {
    return sendError(res, error.details[0].message, 400);
  }

  const { status, reason } = value;

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

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid document ID format', 400);
  }

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

  // Serialize Date objects to ISO strings for frontend compatibility
  const serializedReports = result.reports.map((report: any) => ({
    ...report,
    period: {
      start: report.period.start instanceof Date ? report.period.start.toISOString() : report.period.start,
      end: report.period.end instanceof Date ? report.period.end.toISOString() : report.period.end,
    },
    generatedAt: report.generatedAt instanceof Date ? report.generatedAt.toISOString() : report.generatedAt,
    createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt,
    updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : report.updatedAt,
  }));

  sendSuccess(res, {
    ...result,
    reports: serializedReports,
  });
});

/**
 * Get an earnings report by ID
 * GET /api/earnings/reports/:id
 */
export const getEarningsReportById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid report ID format', 400);
  }

  const report = await earningsReportService.getReportById(id);

  if (!report) {
    return sendError(res, 'Earnings report not found', 404);
  }

  // Verify the report belongs to the authenticated provider
  if (report.providerId.toString() !== (req.user?._id?.toString() ?? '') && req.user?.role !== 'admin') {
    return sendError(res, 'Access denied', 403);
  }

  // Serialize Date objects to ISO strings for frontend compatibility
  const serializedReport = {
    ...report,
    period: {
      start: report.period.start instanceof Date ? report.period.start.toISOString() : report.period.start,
      end: report.period.end instanceof Date ? report.period.end.toISOString() : report.period.end,
    },
    generatedAt: report.generatedAt instanceof Date ? report.generatedAt.toISOString() : report.generatedAt,
    createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt,
    updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : report.updatedAt,
  };

  sendSuccess(res, { report: serializedReport });
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

  const report: any = await earningsReportService.generateEarningsReport(
    providerId,
    new Date(startDate),
    new Date(endDate),
    { includeTaxDocument, region }
  );

  // Serialize Date objects to ISO strings for frontend compatibility
  const serializedReport = {
    ...report,
    period: {
      start: report.period.start instanceof Date ? report.period.start.toISOString() : report.period.start,
      end: report.period.end instanceof Date ? report.period.end.toISOString() : report.period.end,
    },
    generatedAt: report.generatedAt instanceof Date ? report.generatedAt.toISOString() : report.generatedAt,
    createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt,
    updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : report.updatedAt,
  };

  sendSuccess(res, { report: serializedReport }, 'Earnings report generated successfully', 201);
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
  if (isNaN(year)) {
    return sendError(res, 'Valid year is required', 400);
  }

  const currentYear = new Date().getFullYear();
  if (year < 2000 || year > currentYear + 1) {
    return sendError(res, `Year must be between 2000 and ${currentYear + 1}`, 400);
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
  const dateRange = parseDateRange(req.query);
  if (!dateRange) {
    return sendError(res, 'Invalid date format', 400);
  }
  const { startDate, endDate } = dateRange;
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

// ============================================
// ADMIN PROVIDER EARNINGS ENDPOINT
// ============================================

/**
 * Get comprehensive earnings breakdown for a specific provider
 * GET /api/admin/providers/:id/earnings
 */
export const getProviderEarnings = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { period = 'month', startDate, endDate } = req.query;

  // Validate provider ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid provider ID format', 400);
  }

  // Verify provider exists and is actually a provider
  const User = mongoose.model('User');
  const provider = await User.findById(id).select('_id role firstName lastName email');

  if (!provider) {
    return sendError(res, 'Provider not found', 404);
  }

  if (provider.role !== 'provider') {
    return sendError(res, 'User is not a provider', 400);
  }

  // Determine date range based on period or explicit dates
  const now = new Date();
  let queryStartDate: Date;
  let queryEndDate: Date = now;

  if (startDate && endDate) {
    queryStartDate = new Date(startDate as string);
    queryEndDate = new Date(endDate as string);
    queryEndDate.setHours(23, 59, 59, 999);
  } else {
    switch (period) {
      case 'week':
        queryStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        queryStartDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        // Set to epoch for "all time" - but limit to earliest booking
        queryStartDate = new Date('2020-01-01');
        break;
      default:
        queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  // Validate dates
  if (isNaN(queryStartDate.getTime()) || isNaN(queryEndDate.getTime())) {
    return sendError(res, 'Invalid date format', 400);
  }

  const providerId = new Types.ObjectId(id);

  // Import models for aggregation
  const Booking = mongoose.model('Booking');
  const Dispute = mongoose.model('Dispute');
  const Service = mongoose.model('Service');

  // Get completed bookings in the period
  const bookingsAggregation = await Booking.aggregate([
    {
      $match: {
        providerId,
        status: 'completed',
        completedAt: { $gte: queryStartDate, $lte: queryEndDate },
      },
    },
    {
      $facet: {
        // Total earnings aggregation
        totalEarnings: [
          {
            $group: {
              _id: null,
              total: { $sum: '$pricing.totalAmount' },
              count: { $sum: 1 },
            },
          },
        ],
        // Earnings by period (day/week/month depending on range)
        byPeriod: [
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
              },
              amount: { $sum: '$pricing.totalAmount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        // Earnings by service
        byService: [
          {
            $group: {
              _id: '$serviceId',
              amount: { $sum: '$pricing.totalAmount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { amount: -1 } },
          { $limit: 50 }, // Top 50 services
        ],
      },
    },
  ]);

  // Get refunds from cancelled/refunded bookings in the period
  const refundsAggregation = await Booking.aggregate([
    {
      $match: {
        providerId,
        'cancellationDetails.refundStatus': 'processed',
        'cancellationDetails.cancelledAt': { $gte: queryStartDate, $lte: queryEndDate },
      },
    },
    {
      $group: {
        _id: null,
        totalRefunds: { $sum: '$cancellationDetails.refundAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Get disputes with financial impact (resolved refunds affecting provider)
  const disputesAggregation = await Dispute.aggregate([
    {
      $match: {
        'respondent.userId': providerId,
        status: { $in: ['resolved', 'closed'] },
        'resolution.resolvedAt': { $gte: queryStartDate, $lte: queryEndDate },
        'resolution.amount': { $exists: true, $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalDisputeAmount: { $sum: '$resolution.amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Get service names for the byService breakdown
  const serviceIds = (bookingsAggregation[0]?.byService || []).map((s: any) => s._id);
  const services = await Service.find({ _id: { $in: serviceIds } })
    .select('_id name')
    .lean();

  const serviceNameMap = new Map(services.map((s: any) => [s._id.toString(), s.name]));

  // Build response data
  const totalData = bookingsAggregation[0]?.totalEarnings[0] || { total: 0, count: 0 };
  const refundsData = refundsAggregation[0] || { totalRefunds: 0, count: 0 };
  const disputesData = disputesAggregation[0] || { totalDisputeAmount: 0, count: 0 };

  const total = totalData.total;
  const refunds = refundsData.totalRefunds;
  const disputes = disputesData.totalDisputeAmount;
  const net = Math.max(0, total - refunds - disputes);

  // Format byPeriod response
  const byPeriod = (bookingsAggregation[0]?.byPeriod || []).map((p: any) => ({
    date: p._id,
    amount: p.amount,
    count: p.count,
  }));

  // Format byService response
  const byService = (bookingsAggregation[0]?.byService || []).map((s: any) => ({
    serviceId: s._id?.toString() || 'unknown',
    name: serviceNameMap.get(s._id?.toString()) || 'Unknown Service',
    amount: s.amount,
    count: s.count,
  }));

  // Build the response
  const responseData = {
    provider: {
      id: provider._id.toString(),
      name: `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.email,
      email: provider.email,
    },
    period: {
      type: period as string,
      startDate: queryStartDate.toISOString(),
      endDate: queryEndDate.toISOString(),
    },
    summary: {
      total,
      refunds,
      disputes,
      net,
      completedBookings: totalData.count,
      refundedBookings: refundsData.count,
      disputedBookings: disputesData.count,
    },
    byPeriod,
    byService,
  };

  sendSuccess(res, responseData);
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
  // Admin provider earnings
  getProviderEarnings,
};
