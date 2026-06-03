import mongoose, { Types } from 'mongoose';
import { Commission, CommissionRule, ICommission } from '../models/commission.model';
import { taxService, TaxDocument } from './taxService';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';

// Earnings Report Interface
export interface EarningsReport {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  period: {
    start: Date;
    end: Date;
  };
  // Financial summary
  totalGross: number;
  totalDiscounts: number;
  totalNet: number;
  totalCommission: number;
  totalPlatformFee: number;
  totalPaymentProcessingFee: number;
  totalTax: number;
  totalProviderEarnings: number;
  // Booking statistics
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  // Commission breakdown
  commissionBreakdown: {
    byRuleType: {
      ruleType: string;
      count: number;
      amount: number;
    }[];
    byTier: {
      tierName: string;
      minAmount: number;
      maxAmount: number;
      count: number;
      amount: number;
    }[];
  };
  // Category breakdown
  categoryBreakdown: {
    categoryId: Types.ObjectId;
    categoryName: string;
    count: number;
    grossAmount: number;
    commission: number;
    earnings: number;
  }[];
  // Monthly breakdown
  monthlyBreakdown: {
    month: string; // YYYY-MM
    count: number;
    grossAmount: number;
    commission: number;
    earnings: number;
  }[];
  // Tax information
  taxInfo: {
    region: string;
    taxRate: number;
    taxType: string;
    taxAmount: number;
  };
  // Document references
  taxDocumentId?: Types.ObjectId;
  invoiceNumbers: string[];
  // Status - aligned with frontend and database schema
  status: 'draft' | 'generated' | 'sent' | 'archived';
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Provider Tax Summary
export interface ProviderTaxSummary {
  providerId: Types.ObjectId;
  year: number;
  totalEarnings: number;
  totalCommission: number;
  totalTaxWithheld: number;
  totalTaxRemitted: number;
  taxRate: number;
  taxType: string;
  documents: {
    documentId: Types.ObjectId;
    documentNumber: string;
    type: string;
    period: { start: Date; end: Date };
    amount: number;
    status: string;
  }[];
  createdAt: Date;
}

// Dashboard Summary Interface
export interface EarningsDashboardSummary {
  providerId: Types.ObjectId;
  currentPeriod: {
    start: Date;
    end: Date;
  };
  comparisonPeriod: {
    start: Date;
    end: Date;
  };
  // Current period stats
  current: {
    grossEarnings: number;
    netEarnings: number;
    totalCommission: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  // Previous period stats for comparison
  previous: {
    grossEarnings: number;
    netEarnings: number;
    totalCommission: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  // Growth metrics
  growth: {
    grossEarnings: number; // Percentage
    netEarnings: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  // Top performing period (day of week)
  topDayOfWeek: {
    day: string;
    count: number;
    earnings: number;
  };
  // Pending payments
  pendingPayments: {
    count: number;
    amount: number;
  };
  // Next payout
  nextPayout: {
    date: Date;
    amount: number;
  };
}

// Earnings Report Schema (for database storage)
const earningsReportSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    totalGross: { type: Number, default: 0 },
    totalDiscounts: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    totalCommission: { type: Number, default: 0 },
    totalPlatformFee: { type: Number, default: 0 },
    totalPaymentProcessingFee: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    totalProviderEarnings: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    commissionBreakdown: {
      byRuleType: [
        {
          ruleType: String,
          count: Number,
          amount: Number,
        },
      ],
      byTier: [
        {
          tierName: String,
          minAmount: Number,
          maxAmount: Number,
          count: Number,
          amount: Number,
        },
      ],
    },
    categoryBreakdown: [
      {
        categoryId: mongoose.Schema.Types.ObjectId,
        categoryName: String,
        count: Number,
        grossAmount: Number,
        commission: Number,
        earnings: Number,
      },
    ],
    monthlyBreakdown: [
      {
        month: String,
        count: Number,
        grossAmount: Number,
        commission: Number,
        earnings: Number,
      },
    ],
    taxInfo: {
      region: String,
      taxRate: Number,
      taxType: String,
      taxAmount: Number,
    },
    taxDocumentId: mongoose.Schema.Types.ObjectId,
    invoiceNumbers: [String],
    status: {
      type: String,
      enum: ['draft', 'generated', 'sent', 'archived'],
      default: 'draft',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'earnings_reports',
  }
);

// Indexes for earnings reports
earningsReportSchema.index({ providerId: 1, 'period.start': -1, 'period.end': -1 });
earningsReportSchema.index({ providerId: 1, status: 1 });
earningsReportSchema.index({ 'period.start': 1, 'period.end': 1 });

// Earnings Report Model
export const EarningsReportModel: mongoose.Model<EarningsReport> = mongoose.model<EarningsReport>(
  'EarningsReport',
  earningsReportSchema
);

// Earnings Report Service Class
export class EarningsReportService {
  /**
   * Generate comprehensive earnings report for a provider
   * PERFORMANCE FIX: Uses MongoDB aggregation pipeline instead of loading all records into memory
   */
  async generateEarningsReport(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date,
    options: {
      includeTaxDocument?: boolean;
      region?: string;
    } = {}
  ): Promise<EarningsReport> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;
    const region = options.region || 'AE';

    // Use aggregation pipeline for database-level computation
    const aggregationResult = await Commission.aggregate([
      // Match by provider and date range (check both bookingDate and completedAt)
      {
        $match: {
          providerId: providerObjectId,
          $or: [
            { 'metadata.bookingDate': { $gte: startDate, $lte: endDate } },
            { completedAt: { $gte: startDate, $lte: endDate } },
          ],
        },
      },
      // Facet to compute multiple aggregations in single pass
      {
        $facet: {
          // Overall totals
          totals: [
            {
              $group: {
                _id: null,
                totalGross: { $sum: '$grossAmount' },
                totalDiscounts: { $sum: '$discountAmount' },
                totalNet: { $sum: '$netAmount' },
                totalCommission: { $sum: '$commissionAmount' },
                totalPlatformFee: { $sum: '$platformFee' },
                totalPaymentProcessingFee: { $sum: '$paymentProcessingFee' },
                totalTax: { $sum: '$taxAmount' },
                totalProviderEarnings: { $sum: '$providerEarnings' },
                totalBookings: { $sum: 1 },
                completedBookings: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['calculated', 'pending', 'approved', 'paid']] },
                      1,
                      0,
                    ],
                  },
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ['$status', 'reversed'] }, 1, 0] },
                },
              },
            },
          ],
          // By rule type
          byRuleType: [
            {
              $group: {
                _id: '$ruleType',
                count: { $sum: 1 },
                amount: { $sum: '$commissionAmount' },
              },
            },
          ],
          // By tier
          byTier: [
            { $match: { tierApplied: { $exists: true } } },
            {
              $group: {
                _id: {
                  minAmount: '$tierApplied.minAmount',
                  maxAmount: '$tierApplied.maxAmount',
                },
                count: { $sum: 1 },
                amount: { $sum: '$commissionAmount' },
              },
            },
          ],
          // By category
          byCategory: [
            {
              $group: {
                _id: { $ifNull: ['$categoryId', null] },
                categoryName: { $first: { $ifNull: ['$metadata.categoryName', 'Uncategorized'] } },
                count: { $sum: 1 },
                grossAmount: { $sum: '$grossAmount' },
                commission: { $sum: '$commissionAmount' },
                earnings: { $sum: '$providerEarnings' },
              },
            },
          ],
          // By month
          byMonth: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$calculatedAt' } },
                count: { $sum: 1 },
                grossAmount: { $sum: '$grossAmount' },
                commission: { $sum: '$commissionAmount' },
                earnings: { $sum: '$providerEarnings' },
              },
            },
            { $sort: { _id: 1 } },
          ],
          // Invoice numbers
          invoiceNumbers: [{ $group: { _id: null, numbers: { $push: '$bookingNumber' } } }],
        },
      },
    ]);

    const result = aggregationResult[0] || {};
    const totals = result.totals?.[0] || {
      totalGross: 0,
      totalDiscounts: 0,
      totalNet: 0,
      totalCommission: 0,
      totalPlatformFee: 0,
      totalPaymentProcessingFee: 0,
      totalTax: 0,
      totalProviderEarnings: 0,
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
    };

    const totalGross = totals.totalGross;
    const totalDiscounts = totals.totalDiscounts;
    const totalNet = totals.totalNet;
    const totalCommission = totals.totalCommission;
    const totalPlatformFee = totals.totalPlatformFee;
    const totalPaymentProcessingFee = totals.totalPaymentProcessingFee;
    const totalTax = totals.totalTax;
    const totalProviderEarnings = totals.totalProviderEarnings;
    const totalBookings = totals.totalBookings;
    const completedBookings = totals.completedBookings;
    const cancelledBookings = totals.cancelledBookings;

    // Commission breakdown
    const byRuleType = (result.byRuleType || []).map((item: any) => ({
      ruleType: item._id,
      count: item.count,
      amount: item.amount,
    }));

    const byTier = (result.byTier || []).map((item: any) => ({
      tierName: `${item._id.minAmount}-${item._id.maxAmount}`,
      minAmount: item._id.minAmount,
      maxAmount: item._id.maxAmount,
      count: item.count,
      amount: item.amount,
    }));

    // Category breakdown
    const byCategory = (result.byCategory || []).map((item: any) => ({
      categoryId: item._id || new Types.ObjectId(),
      categoryName: item.categoryName,
      count: item.count,
      grossAmount: item.grossAmount,
      commission: item.commission,
      earnings: item.earnings,
    }));

    // Monthly breakdown
    const monthlyBreakdown = (result.byMonth || []).map((item: any) => ({
      month: item._id,
      count: item.count,
      grossAmount: item.grossAmount,
      commission: item.commission,
      earnings: item.earnings,
    }));

    // Invoice numbers
    const invoiceNumbers = result.invoiceNumbers?.[0]?.numbers || [];

    // Get tax info
    const taxConfig = await taxService.getTaxConfig(region);

    // Generate tax document if requested
    let taxDocumentId: Types.ObjectId | undefined;
    if (options.includeTaxDocument && totalProviderEarnings > 0) {
      try {
        const taxDoc = await taxService.generateProviderInvoice(providerObjectId, startDate, endDate);
        taxDocumentId = taxDoc._id as Types.ObjectId;
      } catch (error) {
        logger.warn('Failed to generate tax document', { error, providerId: providerObjectId });
      }
    }

    // Build report
    const report = new EarningsReportModel({
      providerId: providerObjectId,
      period: { start: startDate, end: endDate },
      totalGross,
      totalDiscounts,
      totalNet,
      totalCommission,
      totalPlatformFee,
      totalPaymentProcessingFee,
      totalTax,
      totalProviderEarnings,
      totalBookings,
      completedBookings,
      cancelledBookings,
      commissionBreakdown: {
        byRuleType,
        byTier,
      },
      categoryBreakdown: byCategory,
      monthlyBreakdown,
      taxInfo: {
        region,
        taxRate: taxConfig?.rate || 0,
        taxType: taxConfig?.type || 'vat',
        taxAmount: totalTax,
      },
      taxDocumentId,
      invoiceNumbers,
      status: 'generated', // Aligned with frontend and database schema
      generatedAt: new Date(),
    });

    await report.save();

    logger.info('Earnings report generated', {
      reportId: report._id,
      providerId: providerObjectId,
      period: { start: startDate, end: endDate },
      totalEarnings: totalProviderEarnings,
      totalBookings,
    });

    return report;
  }

  /**
   * Get earnings report by ID
   */
  async getReportById(reportId: string | Types.ObjectId): Promise<EarningsReport | null> {
    const objectId = typeof reportId === 'string' ? new Types.ObjectId(reportId) : reportId;
    return EarningsReportModel.findById(objectId);
  }

  /**
   * Get reports for a provider
   */
  async getProviderReports(
    providerId: string | Types.ObjectId,
    options: {
      year?: number;
      status?: EarningsReport['status'];
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ reports: EarningsReport[]; total: number; page: number; totalPages: number }> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { providerId: providerObjectId };

    if (options.year) {
      query['period.start'] = {
        $gte: new Date(options.year, 0, 1),
      };
      query['period.end'] = {
        $lte: new Date(options.year, 11, 31, 23, 59, 59),
      };
    }

    if (options.status) {
      query.status = options.status;
    }

    const [reports, total] = await Promise.all([
      EarningsReportModel.find(query).sort({ 'period.start': -1 }).skip(skip).limit(limit),
      EarningsReportModel.countDocuments(query),
    ]);

    return {
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Build aggregation pipeline for stats calculation
   * Helper method for getDashboardSummary
   */
  private buildStatsAggregation() {
    return [
      {
        $group: {
          _id: null,
          grossEarnings: { $sum: '$grossAmount' },
          netEarnings: { $sum: '$netAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalBookings: { $sum: 1 },
          averageBookingValue: { $avg: '$grossAmount' },
        },
      },
    ];
  }

  /**
   * Get dashboard summary with period comparison
   * PERFORMANCE FIX: Uses single aggregation with $facet instead of two separate queries
   */
  async getDashboardSummary(
    providerId: string | Types.ObjectId,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<EarningsDashboardSummary> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let previousStart: Date;
    let previousEnd: Date;

    // Calculate periods based on type
    switch (period) {
      case 'week':
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(currentStart.getTime() - 1);
        break;
      case 'month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        currentStart = new Date(now.getFullYear(), quarter * 3, 1);
        previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        previousEnd = new Date(currentStart.getTime() - 1);
        break;
      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
    }

    // Use single aggregation with $facet to get both periods in one query
    const result = await Commission.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
        },
      },
      {
        $facet: {
          currentPeriod: [
            {
              $match: {
                $or: [
                  { 'metadata.bookingDate': { $gte: currentStart, $lte: currentEnd } },
                  { completedAt: { $gte: currentStart, $lte: currentEnd } },
                ],
              },
            },
            {
              $group: {
                _id: null,
                grossEarnings: { $sum: '$grossAmount' },
                netEarnings: { $sum: '$providerEarnings' },
                totalCommission: { $sum: '$commissionAmount' },
                totalBookings: { $sum: 1 },
                averageBookingValue: { $avg: '$grossAmount' },
              },
            },
          ],
          previousPeriod: [
            {
              $match: {
                $or: [
                  { 'metadata.bookingDate': { $gte: previousStart, $lte: previousEnd } },
                  { completedAt: { $gte: previousStart, $lte: previousEnd } },
                ],
              },
            },
            {
              $group: {
                _id: null,
                grossEarnings: { $sum: '$grossAmount' },
                netEarnings: { $sum: '$providerEarnings' },
                totalCommission: { $sum: '$commissionAmount' },
                totalBookings: { $sum: 1 },
                averageBookingValue: { $avg: '$grossAmount' },
              },
            },
          ],
        },
      },
    ]);

    const facetResult = result[0] || { currentPeriod: [], previousPeriod: [] };
    const current = facetResult.currentPeriod[0] || {
      grossEarnings: 0,
      netEarnings: 0,
      totalCommission: 0,
      totalBookings: 0,
    };
    const previous = facetResult.previousPeriod[0] || {
      grossEarnings: 0,
      netEarnings: 0,
      totalCommission: 0,
      totalBookings: 0,
    };

    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const growth = {
      grossEarnings: calculateGrowth(current.grossEarnings, previous.grossEarnings),
      netEarnings: calculateGrowth(current.netEarnings, previous.netEarnings),
      totalBookings: calculateGrowth(current.totalBookings, previous.totalBookings),
      averageBookingValue: calculateGrowth(current.averageBookingValue, previous.averageBookingValue),
    };

    // Get top performing day of week using aggregation
    const dayOfWeekResult = await Commission.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
          $or: [
            { 'metadata.bookingDate': { $gte: currentStart, $lte: currentEnd } },
            { completedAt: { $gte: currentStart, $lte: currentEnd } },
          ],
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$calculatedAt' },
          count: { $sum: 1 },
          earnings: { $sum: '$providerEarnings' },
        },
      },
      { $sort: { earnings: -1 } },
      { $limit: 1 },
    ]);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const topDayOfWeek = dayOfWeekResult.length > 0
      ? { day: days[dayOfWeekResult[0]._id - 1] || 'N/A', count: dayOfWeekResult[0].count, earnings: dayOfWeekResult[0].earnings }
      : { day: 'N/A', count: 0, earnings: 0 };

    // Get pending and approved commissions using aggregation (single query)
    const statusResult = await Commission.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: { $in: ['pending', 'approved'] },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$providerEarnings' },
        },
      },
    ]);

    const pendingData = statusResult.find(r => r._id === 'pending') || { count: 0, amount: 0 };
    const approvedData = statusResult.find(r => r._id === 'approved') || { count: 0, amount: 0 };

    // Calculate next payout (simplified - every 7 days)
    const daysUntilNextPayout = 7 - now.getDay();
    const nextPayoutDate = new Date(now.getTime() + daysUntilNextPayout * 24 * 60 * 60 * 1000);

    return {
      providerId: providerObjectId,
      currentPeriod: { start: currentStart, end: currentEnd },
      comparisonPeriod: { start: previousStart, end: previousEnd },
      current,
      previous,
      growth,
      topDayOfWeek,
      pendingPayments: { count: pendingData.count, amount: pendingData.amount },
      nextPayout: { date: nextPayoutDate, amount: approvedData.amount },
    };
  }

  /**
   * Get annual statement for tax purposes
   * PERFORMANCE FIX: Uses MongoDB aggregation pipeline instead of loading all records into memory
   */
  async getAnnualStatement(
    providerId: string | Types.ObjectId,
    year: number
  ): Promise<{
    year: number;
    totalEarnings: number;
    totalCommission: number;
    totalTax: number;
    quarterlyBreakdown: {
      quarter: number;
      count: number;
      earnings: number;
      tax: number;
    }[];
    taxDocument: TaxDocument | null;
  }> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // Use aggregation pipeline to compute totals and quarterly breakdown at database level
    const aggregationResult = await Commission.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          'metadata.bookingDate': { $gte: startDate, $lte: endDate },
          status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
        },
      },
      {
        $facet: {
          // Overall totals
          totals: [
            {
              $group: {
                _id: null,
                totalEarnings: { $sum: '$providerEarnings' },
                totalCommission: { $sum: '$commissionAmount' },
                totalTax: { $sum: '$taxAmount' },
              },
            },
          ],
          // Quarterly breakdown
          quarterly: [
            {
              $group: {
                _id: {
                  $ceil: {
                    $divide: [{ $add: [{ $month: '$calculatedAt' }, 2] }, 3],
                  },
                },
                count: { $sum: 1 },
                earnings: { $sum: '$providerEarnings' },
                tax: { $sum: '$taxAmount' },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const result = aggregationResult[0] || {};
    const totals = result.totals?.[0] || {
      totalEarnings: 0,
      totalCommission: 0,
      totalTax: 0,
    };

    // Build quarterly breakdown with all quarters (fill missing with zeros)
    const quarterlyBreakdown = [1, 2, 3, 4].map((quarter) => {
      const quarterData = result.quarterly?.find((q: any) => q._id === quarter);
      return {
        quarter,
        count: quarterData?.count || 0,
        earnings: quarterData?.earnings || 0,
        tax: quarterData?.tax || 0,
      };
    });

    // Get or generate tax document
    let taxDocument: TaxDocument | null = null;
    try {
      taxDocument = await taxService.generateAnnualTaxStatement(providerObjectId, year);
    } catch (error) {
      logger.warn('Failed to generate annual tax statement', { error, providerId: providerObjectId, year });
    }

    return {
      year,
      totalEarnings: totals.totalEarnings,
      totalCommission: totals.totalCommission,
      totalTax: totals.totalTax,
      quarterlyBreakdown,
      taxDocument,
    };
  }

  /**
   * Export earnings data for external accounting systems
   * PERFORMANCE FIX: Uses cursor-based pagination with limit to prevent OutOfMemory
   */
  async exportEarningsData(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<{ data: string; filename: string; contentType: string; recordCount: number; truncated: boolean }> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    const MAX_EXPORT_RECORDS = 10000;
    let recordCount = 0;
    let truncated = false;

    // First, get provider info
    const User = mongoose.model('User');
    const provider = await User.findById(providerObjectId);

    // First pass: compute summary using aggregation (database-level)
    const summaryResult = await Commission.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          'metadata.bookingDate': { $gte: startDate, $lte: endDate },
          status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalTax: { $sum: '$taxAmount' },
          totalEarnings: { $sum: '$providerEarnings' },
        },
      },
    ]);

    const summary = summaryResult[0] || {
      totalTransactions: 0,
      totalGross: 0,
      totalCommission: 0,
      totalTax: 0,
      totalEarnings: 0,
    };

    // Check if we need to truncate
    if (summary.totalTransactions > MAX_EXPORT_RECORDS) {
      truncated = true;
      logger.warn('Export truncated due to large dataset', {
        providerId: providerObjectId,
        totalRecords: summary.totalTransactions,
        maxRecords: MAX_EXPORT_RECORDS,
      });
    }

    // Stream commissions using cursor-based pagination (fetch in batches)
    const commissions: any[] = [];
    let lastId: Types.ObjectId | null = null;
    const batchSize = 1000;

    while (commissions.length < MAX_EXPORT_RECORDS) {
      const query: any = {
        providerId: providerObjectId,
        'metadata.bookingDate': { $gte: startDate, $lte: endDate },
        status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
      };

      // Cursor-based pagination using _id
      if (lastId) {
        query._id = { $gt: lastId };
      }

      const batch = await Commission.find(query)
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean();

      if (batch.length === 0) {
        break;
      }

      commissions.push(...batch);
      lastId = batch[batch.length - 1]._id as Types.ObjectId;

      // Safety check - exit if no more records to fetch
      if (batch.length < batchSize) {
        break;
      }
    }

    recordCount = commissions.length;

    if (format === 'csv') {
      const headers = [
        'Booking Number',
        'Date',
        'Service',
        'Category',
        'Gross Amount',
        'Commission',
        'Platform Fee',
        'Processing Fee',
        'Tax',
        'Net Earnings',
        'Status',
      ];

      const rows = commissions.map((comm) => [
        comm.bookingNumber || '',
        comm.calculatedAt ? new Date(comm.calculatedAt).toISOString() : '',
        comm.metadata?.serviceTitle || '',
        comm.metadata?.categoryName || '',
        comm.grossAmount.toFixed(2),
        comm.commissionAmount.toFixed(2),
        comm.platformFee.toFixed(2),
        comm.paymentProcessingFee.toFixed(2),
        comm.taxAmount.toFixed(2),
        comm.providerEarnings.toFixed(2),
        comm.status,
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

      return {
        data: csvContent,
        filename: `earnings_${provider?.firstName || 'provider'}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`,
        contentType: 'text/csv',
        recordCount,
        truncated,
      };
    } else {
      const exportData = {
        exportDate: new Date().toISOString(),
        provider: {
          id: providerObjectId.toString(),
          name: `${provider?.firstName || ''} ${provider?.lastName || ''}`.trim(),
          email: provider?.email,
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        transactions: commissions.map((comm) => ({
          bookingNumber: comm.bookingNumber,
          date: comm.calculatedAt ? new Date(comm.calculatedAt).toISOString() : null,
          serviceTitle: comm.metadata?.serviceTitle,
          categoryName: comm.metadata?.categoryName,
          grossAmount: comm.grossAmount,
          discountAmount: comm.discountAmount,
          netAmount: comm.netAmount,
          commissionRate: comm.commissionRate,
          commissionAmount: comm.commissionAmount,
          platformFee: comm.platformFee,
          paymentProcessingFee: comm.paymentProcessingFee,
          taxAmount: comm.taxAmount,
          providerEarnings: comm.providerEarnings,
          status: comm.status,
          ruleName: comm.ruleName,
        })),
        summary: {
          totalTransactions: summary.totalTransactions,
          totalGross: summary.totalGross,
          totalCommission: summary.totalCommission,
          totalTax: summary.totalTax,
          totalEarnings: summary.totalEarnings,
          exportedRecords: recordCount,
          truncated,
        },
        warning: truncated
          ? `Export limited to ${MAX_EXPORT_RECORDS} records. Total records: ${summary.totalTransactions}`
          : undefined,
      };

      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `earnings_${provider?.firstName || 'provider'}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.json`,
        contentType: 'application/json',
        recordCount,
        truncated,
      };
    }
  }
}

// Export singleton instance
export const earningsReportService = new EarningsReportService();

export default earningsReportService;
