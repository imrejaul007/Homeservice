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
  // Status
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

    // Get all commissions in the period
    const commissions = await Commission.find({
      providerId: providerObjectId,
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
    });

    // Calculate totals
    let totalGross = 0;
    let totalDiscounts = 0;
    let totalNet = 0;
    let totalCommission = 0;
    let totalPlatformFee = 0;
    let totalPaymentProcessingFee = 0;
    let totalTax = 0;
    let totalProviderEarnings = 0;
    let totalBookings = commissions.length;
    let completedBookings = 0;
    let cancelledBookings = 0;

    // Commission breakdown
    const ruleTypeMap = new Map<string, { count: number; amount: number }>();
    const tierMap = new Map<string, { tierName: string; minAmount: number; maxAmount: number; count: number; amount: number }>();

    // Category breakdown
    const categoryMap = new Map<
      string,
      {
        categoryId: Types.ObjectId;
        categoryName: string;
        count: number;
        grossAmount: number;
        commission: number;
        earnings: number;
      }
    >();

    // Monthly breakdown
    const monthlyMap = new Map<string, { count: number; grossAmount: number; commission: number; earnings: number }>();

    // Invoice numbers
    const invoiceNumbers: string[] = [];

    for (const comm of commissions) {
      totalGross += comm.grossAmount;
      totalDiscounts += comm.discountAmount;
      totalNet += comm.netAmount;
      totalCommission += comm.commissionAmount;
      totalPlatformFee += comm.platformFee;
      totalPaymentProcessingFee += comm.paymentProcessingFee;
      totalTax += comm.taxAmount;
      totalProviderEarnings += comm.providerEarnings;

      if (comm.status === 'calculated' || comm.status === 'pending' || comm.status === 'approved' || comm.status === 'paid') {
        completedBookings++;
      } else if (comm.status === 'reversed') {
        cancelledBookings++;
      }

      // By rule type
      const ruleTypeKey = comm.ruleType;
      const existingRuleType = ruleTypeMap.get(ruleTypeKey) || { count: 0, amount: 0 };
      ruleTypeMap.set(ruleTypeKey, {
        count: existingRuleType.count + 1,
        amount: existingRuleType.amount + comm.commissionAmount,
      });

      // By tier
      if (comm.tierApplied) {
        const tierKey = `${comm.tierApplied.minAmount}-${comm.tierApplied.maxAmount}`;
        const existingTier = tierMap.get(tierKey) || {
          tierName: tierKey,
          minAmount: comm.tierApplied.minAmount,
          maxAmount: comm.tierApplied.maxAmount,
          count: 0,
          amount: 0,
        };
        tierMap.set(tierKey, {
          ...existingTier,
          count: existingTier.count + 1,
          amount: existingTier.amount + comm.commissionAmount,
        });
      }

      // By category
      const categoryKey = comm.categoryId?.toString() || 'uncategorized';
      const existingCategory = categoryMap.get(categoryKey) || {
        categoryId: comm.categoryId || new Types.ObjectId(),
        categoryName: comm.metadata?.categoryName || 'Uncategorized',
        count: 0,
        grossAmount: 0,
        commission: 0,
        earnings: 0,
      };
      categoryMap.set(categoryKey, {
        ...existingCategory,
        count: existingCategory.count + 1,
        grossAmount: existingCategory.grossAmount + comm.grossAmount,
        commission: existingCategory.commission + comm.commissionAmount,
        earnings: existingCategory.earnings + comm.providerEarnings,
      });

      // By month
      const monthKey = new Date(comm.calculatedAt).toISOString().substring(0, 7);
      const existingMonth = monthlyMap.get(monthKey) || {
        count: 0,
        grossAmount: 0,
        commission: 0,
        earnings: 0,
      };
      monthlyMap.set(monthKey, {
        count: existingMonth.count + 1,
        grossAmount: existingMonth.grossAmount + comm.grossAmount,
        commission: existingMonth.commission + comm.commissionAmount,
        earnings: existingMonth.earnings + comm.providerEarnings,
      });

      // Collect invoice numbers
      if (comm.bookingNumber) {
        invoiceNumbers.push(comm.bookingNumber);
      }
    }

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
        byRuleType: Array.from(ruleTypeMap.entries()).map(([ruleType, data]) => ({
          ruleType,
          count: data.count,
          amount: data.amount,
        })),
        byTier: Array.from(tierMap.entries()).map(([, data]) => data),
      },
      categoryBreakdown: Array.from(categoryMap.entries()).map(([, data]) => ({
        ...data,
        categoryId: data.categoryId || new Types.ObjectId(),
      })),
      monthlyBreakdown: Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          ...data,
        })),
      taxInfo: {
        region,
        taxRate: taxConfig?.rate || 0,
        taxType: taxConfig?.type || 'vat',
        taxAmount: totalTax,
      },
      taxDocumentId,
      invoiceNumbers,
      status: 'generated',
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
   * Get dashboard summary with period comparison
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

    // Get current and previous period data
    const [currentCommissionsRaw, previousCommissionsRaw] = await Promise.all([
      Commission.find({
        providerId: providerObjectId,
        'metadata.bookingDate': { $gte: currentStart, $lte: currentEnd },
        status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
      }).lean(),
      Commission.find({
        providerId: providerObjectId,
        'metadata.bookingDate': { $gte: previousStart, $lte: previousEnd },
        status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
      }).lean(),
    ]);

    const currentCommissions = currentCommissionsRaw as unknown as ICommission[];
    const previousCommissions = previousCommissionsRaw as unknown as ICommission[];

    // Calculate current period stats
    const current = this.calculatePeriodStats(currentCommissions);

    // Calculate previous period stats
    const previous = this.calculatePeriodStats(previousCommissions);

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

    // Get top performing day of week
    const dayOfWeekMap = new Map<string, { count: number; earnings: number }>();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const comm of currentCommissions) {
      const dayName = days[new Date(comm.calculatedAt).getDay()];
      const existing = dayOfWeekMap.get(dayName) || { count: 0, earnings: 0 };
      dayOfWeekMap.set(dayName, {
        count: existing.count + 1,
        earnings: existing.earnings + comm.providerEarnings,
      });
    }

    let topDayOfWeek = { day: 'N/A', count: 0, earnings: 0 };
    for (const [day, data] of dayOfWeekMap) {
      if (data.earnings > topDayOfWeek.earnings) {
        topDayOfWeek = { day, ...data };
      }
    }

    // Get pending payments
    const pendingCommissions = await Commission.find({
      providerId: providerObjectId,
      status: 'pending',
    });

    const pendingPayments = {
      count: pendingCommissions.length,
      amount: pendingCommissions.reduce((sum, c) => sum + c.providerEarnings, 0),
    };

    // Calculate next payout (simplified - every 7 days)
    const daysUntilNextPayout = 7 - now.getDay();
    const nextPayoutDate = new Date(now.getTime() + daysUntilNextPayout * 24 * 60 * 60 * 1000);

    // Get approved commissions ready for payout
    const approvedCommissions = await Commission.find({
      providerId: providerObjectId,
      status: 'approved',
    });

    return {
      providerId: providerObjectId,
      currentPeriod: { start: currentStart, end: currentEnd },
      comparisonPeriod: { start: previousStart, end: previousEnd },
      current,
      previous,
      growth,
      topDayOfWeek,
      pendingPayments,
      nextPayout: {
        date: nextPayoutDate,
        amount: approvedCommissions.reduce((sum, c) => sum + c.providerEarnings, 0),
      },
    };
  }

  /**
   * Calculate stats for a period of commissions
   */
  private calculatePeriodStats(commissions: ICommission[]): EarningsDashboardSummary['current'] {
    let grossEarnings = 0;
    let netEarnings = 0;
    let totalCommission = 0;
    let totalBookings = 0;

    for (const comm of commissions) {
      grossEarnings += comm.grossAmount;
      netEarnings += comm.providerEarnings;
      totalCommission += comm.commissionAmount;
      totalBookings++;
    }

    return {
      grossEarnings,
      netEarnings,
      totalCommission,
      totalBookings,
      averageBookingValue: totalBookings > 0 ? grossEarnings / totalBookings : 0,
    };
  }

  /**
   * Get annual statement for tax purposes
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

    // Get all commissions for the year
    const commissions = await Commission.find({
      providerId: providerObjectId,
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
      status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
    });

    // Calculate totals
    let totalEarnings = 0;
    let totalCommission = 0;
    let totalTax = 0;

    // Quarterly breakdown
    const quarterlyMap = new Map<number, { count: number; earnings: number; tax: number }>();

    for (const comm of commissions) {
      totalEarnings += comm.providerEarnings;
      totalCommission += comm.commissionAmount;
      totalTax += comm.taxAmount;

      const quarter = Math.floor(new Date(comm.calculatedAt).getMonth() / 3) + 1;
      const existing = quarterlyMap.get(quarter) || { count: 0, earnings: 0, tax: 0 };

      quarterlyMap.set(quarter, {
        count: existing.count + 1,
        earnings: existing.earnings + comm.providerEarnings,
        tax: existing.tax + comm.taxAmount,
      });
    }

    // Get or generate tax document
    let taxDocument: TaxDocument | null = null;
    try {
      taxDocument = await taxService.generateAnnualTaxStatement(providerObjectId, year);
    } catch (error) {
      logger.warn('Failed to generate annual tax statement', { error, providerId: providerObjectId, year });
    }

    const quarterlyBreakdown = [1, 2, 3, 4].map((quarter) => ({
      quarter,
      ...(quarterlyMap.get(quarter) || { count: 0, earnings: 0, tax: 0 }),
    }));

    return {
      year,
      totalEarnings,
      totalCommission,
      totalTax,
      quarterlyBreakdown,
      taxDocument,
    };
  }

  /**
   * Export earnings data for external accounting systems
   */
  async exportEarningsData(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<{ data: string; filename: string; contentType: string }> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    // Get all commissions in the period
    const commissions = await Commission.find({
      providerId: providerObjectId,
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
      status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
    })
      .populate('bookingId')
      .populate('serviceId');

    // Get provider info
    const User = mongoose.model('User');
    const provider = await User.findById(providerObjectId);

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
        comm.bookingNumber,
        new Date(comm.calculatedAt).toISOString(),
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
          date: new Date(comm.calculatedAt).toISOString(),
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
          totalTransactions: commissions.length,
          totalGross: commissions.reduce((sum, c) => sum + c.grossAmount, 0),
          totalCommission: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
          totalTax: commissions.reduce((sum, c) => sum + c.taxAmount, 0),
          totalEarnings: commissions.reduce((sum, c) => sum + c.providerEarnings, 0),
        },
      };

      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `earnings_${provider?.firstName || 'provider'}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.json`,
        contentType: 'application/json',
      };
    }
  }
}

// Export singleton instance
export const earningsReportService = new EarningsReportService();

export default earningsReportService;
