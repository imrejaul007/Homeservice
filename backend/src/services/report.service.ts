import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// =============================================================================
// Scheduled Report Service
// Manages automated report generation and delivery
// =============================================================================

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ReportConfig {
  name: string;
  type: 'churn' | 'revenue' | 'booking' | 'customer' | 'provider' | 'performance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'json' | 'csv' | 'pdf';
  recipients: string[]; // Email addresses
  filters?: {
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    providers?: string[];
    regions?: string[];
  };
  enabled: boolean;
  nextRunDate?: Date;
}

export interface ScheduledReport {
  _id: Types.ObjectId;
  name: string;
  type: 'churn' | 'revenue' | 'booking' | 'customer' | 'provider' | 'performance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'json' | 'csv' | 'pdf';
  recipients: string[];
  filters?: {
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    providers?: string[];
    regions?: string[];
  };
  enabled: boolean;
  lastRunDate?: Date;
  lastRunStatus?: 'success' | 'failed';
  lastRunError?: string;
  nextRunDate: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportData {
  generatedAt: Date;
  reportType: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary?: Record<string, any>;
  data: Record<string, any>;
}

// =============================================================================
// Scheduled Report Model
// =============================================================================

const scheduledReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['churn', 'revenue', 'booking', 'customer', 'provider', 'performance', 'custom'],
    required: true,
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly'],
    required: true,
  },
  format: {
    type: String,
    enum: ['json', 'csv', 'pdf'],
    default: 'json',
  },
  recipients: [{
    type: String,
    required: true,
  }],
  filters: {
    startDate: Date,
    endDate: Date,
    categories: [String],
    providers: [String],
    regions: [String],
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  lastRunDate: Date,
  lastRunStatus: {
    type: String,
    enum: ['success', 'failed', null],
  },
  lastRunError: String,
  nextRunDate: {
    type: Date,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for finding reports to run
scheduledReportSchema.index({ nextRunDate: 1, enabled: 1 });

const ScheduledReportModel = mongoose.model<ScheduledReport>('ScheduledReport', scheduledReportSchema);

// =============================================================================
// Scheduled Report Service Class
// =============================================================================

class ReportService {
  private readonly CACHE_PREFIX = 'report:';
  private readonly CACHE_TTL = 3600; // 1 hour

  // =============================================================================
  // Create Scheduled Report
  // =============================================================================

  /**
   * Create a new scheduled report
   */
  async createScheduledReport(config: ReportConfig, createdBy: string): Promise<ScheduledReport> {
    const now = new Date();
    const nextRunDate = this.calculateNextRunDate(now, config.frequency);

    const report = new ScheduledReportModel({
      ...config,
      nextRunDate,
      createdBy: new Types.ObjectId(createdBy),
    });

    await report.save();

    logger.info('Scheduled report created', {
      reportId: report._id.toString(),
      name: report.name,
      type: report.type,
      frequency: report.frequency,
    });

    return report.toObject();
  }

  /**
   * Calculate the next run date based on frequency
   */
  private calculateNextRunDate(fromDate: Date, frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Date {
    const next = new Date(fromDate);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(6, 0, 0, 0); // Run at 6 AM
        break;

      case 'weekly':
        // Run on Monday
        const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
        next.setDate(next.getDate() + daysUntilMonday);
        next.setHours(6, 0, 0, 0);
        break;

      case 'monthly':
        // Run on 1st of next month
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(6, 0, 0, 0);
        break;

      case 'quarterly':
        // Run on 1st of next quarter month
        const currentQuarter = Math.floor(next.getMonth() / 3);
        const nextQuarterMonth = (currentQuarter + 1) * 3;
        next.setMonth(nextQuarterMonth);
        if (nextQuarterMonth > 11) {
          next.setFullYear(next.getFullYear() + 1);
          next.setMonth(0);
        }
        next.setDate(1);
        next.setHours(6, 0, 0, 0);
        break;
    }

    return next;
  }

  // =============================================================================
  // List Scheduled Reports
  // =============================================================================

  /**
   * Get all scheduled reports
   */
  async listScheduledReports(options: {
    enabled?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    reports: ScheduledReport[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (options.enabled !== undefined) {
      filter.enabled = options.enabled;
    }
    if (options.type) {
      filter.type = options.type;
    }

    const [reports, total] = await Promise.all([
      ScheduledReportModel
        .find(filter)
        .sort({ nextRunDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ScheduledReportModel.countDocuments(filter),
    ]);

    return {
      reports: reports as ScheduledReport[],
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single scheduled report by ID
   */
  async getScheduledReport(reportId: string): Promise<ScheduledReport | null> {
    const report = await ScheduledReportModel
      .findById(reportId)
      .lean();

    return report as ScheduledReport | null;
  }

  /**
   * Update a scheduled report
   */
  async updateScheduledReport(reportId: string, updates: Partial<ReportConfig>): Promise<ScheduledReport | null> {
    const updateData: Record<string, any> = { ...updates };

    // Recalculate next run date if frequency changed
    if (updates.frequency) {
      updateData.nextRunDate = this.calculateNextRunDate(new Date(), updates.frequency);
    }

    const report = await ScheduledReportModel
      .findByIdAndUpdate(
        reportId,
        { $set: updateData },
        { new: true }
      )
      .lean();

    return report as ScheduledReport | null;
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(reportId: string): Promise<boolean> {
    const result = await ScheduledReportModel.findByIdAndDelete(reportId);
    return !!result;
  }

  /**
   * Toggle report enabled status
   */
  async toggleReport(reportId: string, enabled: boolean): Promise<ScheduledReport | null> {
    const report = await ScheduledReportModel
      .findByIdAndUpdate(
        reportId,
        { $set: { enabled } },
        { new: true }
      )
      .lean();

    return report as ScheduledReport | null;
  }

  // =============================================================================
  // Trigger Report Generation
  // =============================================================================

  /**
   * Trigger report generation for a specific report
   */
  async triggerReport(reportId: string): Promise<{
    success: boolean;
    reportId: string;
    data?: ReportData;
    error?: string;
  }> {
    const report = await ScheduledReportModel.findById(reportId);

    if (!report) {
      return {
        success: false,
        reportId,
        error: 'Report not found',
      };
    }

    try {
      // Generate report data
      const data = await this.generateReportData(report);

      // Update last run info
      report.lastRunDate = new Date();
      report.lastRunStatus = 'success';
      report.lastRunError = undefined;
      report.nextRunDate = this.calculateNextRunDate(new Date(), report.frequency);
      await report.save();

      // In a real implementation, this would:
      // 1. Format the report based on report.format
      // 2. Send email to recipients
      // 3. Store the generated report

      logger.info('Report generated successfully', {
        reportId: report._id.toString(),
        name: report.name,
        type: report.type,
      });

      return {
        success: true,
        reportId,
        data,
      };
    } catch (error) {
      // Update failure info
      report.lastRunDate = new Date();
      report.lastRunStatus = 'failed';
      report.lastRunError = error instanceof Error ? error.message : String(error);
      await report.save();

      logger.error('Report generation failed', {
        reportId: report._id.toString(),
        name: report.name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        reportId,
        error: report.lastRunError,
      };
    }
  }

  /**
   * Generate report data based on report type
   */
  private async generateReportData(report: any): Promise<ReportData> {
    const now = new Date();
    const periodStart = this.getPeriodStartDate(now, report.frequency);

    switch (report.type) {
      case 'churn':
        return this.generateChurnReport(report, periodStart, now);

      case 'revenue':
        return this.generateRevenueReport(report, periodStart, now);

      case 'booking':
        return this.generateBookingReport(report, periodStart, now);

      case 'customer':
        return this.generateCustomerReport(report, periodStart, now);

      case 'provider':
        return this.generateProviderReport(report, periodStart, now);

      case 'performance':
        return this.generatePerformanceReport(report, periodStart, now);

      default:
        return this.generateCustomReport(report, periodStart, now);
    }
  }

  /**
   * Get period start date based on frequency
   */
  private getPeriodStartDate(date: Date, frequency: string): Date {
    const start = new Date(date);

    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
    }

    return start;
  }

  /**
   * Generate churn report
   */
  private async generateChurnReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    const thirtyDaysAgo = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get customer counts
    const [totalCustomers, activeCustomers, previousActiveCustomers] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: startDate, $lt: thirtyDaysAgo },
      }),
    ]);

    const churnRate = previousActiveCustomers > 0
      ? ((previousActiveCustomers - activeCustomers) / previousActiveCustomers) * 100
      : 0;

    return {
      generatedAt: new Date(),
      reportType: 'churn',
      period: { startDate, endDate },
      summary: {
        totalCustomers,
        activeCustomers,
        churnRate: Math.max(0, churnRate),
      },
      data: {
        customerMetrics: {
          total: totalCustomers,
          active: activeCustomers,
          inactive: totalCustomers - activeCustomers,
        },
      },
    };
  }

  /**
   * Generate revenue report
   */
  private async generateRevenueReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    const revenueData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          totalBookings: { $sum: 1 },
          avgBookingValue: { $avg: '$pricing.totalAmount' },
        },
      },
    ]);

    const byDay = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const summary = revenueData[0] || { totalRevenue: 0, totalBookings: 0, avgBookingValue: 0 };

    return {
      generatedAt: new Date(),
      reportType: 'revenue',
      period: { startDate, endDate },
      summary,
      data: {
        dailyRevenue: byDay.map(d => ({
          date: d._id,
          revenue: d.revenue,
          bookings: d.bookings,
        })),
      },
    };
  }

  /**
   * Generate booking report
   */
  private async generateBookingReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = new Map(bookingStats.map(s => [s._id, s.count]));
    const total = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);

    return {
      generatedAt: new Date(),
      reportType: 'booking',
      period: { startDate, endDate },
      summary: {
        total,
        byStatus: Object.fromEntries(statusMap),
      },
      data: {
        bookingMetrics: {
          total,
          pending: statusMap.get('pending') || 0,
          confirmed: statusMap.get('confirmed') || 0,
          inProgress: statusMap.get('in_progress') || 0,
          completed: statusMap.get('completed') || 0,
          cancelled: statusMap.get('cancelled') || 0,
        },
      },
    };
  }

  /**
   * Generate customer report
   */
  private async generateCustomerReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    const [totalCustomers, newCustomers] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        createdAt: { $gte: startDate, $lte: endDate },
      }),
    ]);

    const topCustomers = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$customerId',
          totalSpent: { $sum: '$pricing.totalAmount' },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]);

    return {
      generatedAt: new Date(),
      reportType: 'customer',
      period: { startDate, endDate },
      summary: {
        totalCustomers,
        newCustomers,
      },
      data: {
        topCustomers: topCustomers.map(c => ({
          customerId: c._id.toString(),
          name: `${c.user.firstName} ${c.user.lastName}`,
          email: c.user.email,
          totalSpent: c.totalSpent,
          bookingCount: c.bookingCount,
        })),
      },
    };
  }

  /**
   * Generate provider report
   */
  private async generateProviderReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    const [totalProviders, newProviders] = await Promise.all([
      User.countDocuments({ role: 'provider' }),
      User.countDocuments({
        role: 'provider',
        createdAt: { $gte: startDate, $lte: endDate },
      }),
    ]);

    const topProviders = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$providerId',
          totalRevenue: { $sum: '$pricing.totalAmount' },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]);

    return {
      generatedAt: new Date(),
      reportType: 'provider',
      period: { startDate, endDate },
      summary: {
        totalProviders,
        newProviders,
      },
      data: {
        topProviders: topProviders.map(p => ({
          providerId: p._id.toString(),
          name: `${p.user.firstName} ${p.user.lastName}`,
          email: p.user.email,
          totalRevenue: p.totalRevenue,
          bookingCount: p.bookingCount,
        })),
      },
    };
  }

  /**
   * Generate performance report
   */
  private async generatePerformanceReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      revenueData,
    ] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Booking.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' }),
      Booking.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, status: 'cancelled' }),
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$pricing.totalAmount' } } },
      ]),
    ]);

    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    return {
      generatedAt: new Date(),
      reportType: 'performance',
      period: { startDate, endDate },
      summary: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        completionRate,
        cancellationRate,
        totalRevenue,
      },
      data: {
        performanceMetrics: {
          completionRate: Math.round(completionRate * 10) / 10,
          cancellationRate: Math.round(cancellationRate * 10) / 10,
          averageBookingValue: completedBookings > 0 ? totalRevenue / completedBookings : 0,
        },
      },
    };
  }

  /**
   * Generate custom report
   */
  private async generateCustomReport(report: any, startDate: Date, endDate: Date): Promise<ReportData> {
    return {
      generatedAt: new Date(),
      reportType: 'custom',
      period: { startDate, endDate },
      summary: {},
      data: {},
    };
  }

  // =============================================================================
  // Run Due Reports
  // =============================================================================

  /**
   * Get all reports due for execution
   */
  async getDueReports(): Promise<ScheduledReport[]> {
    const now = new Date();

    const reports = await ScheduledReportModel
      .find({
        enabled: true,
        nextRunDate: { $lte: now },
      })
      .lean();

    return reports as ScheduledReport[];
  }

  /**
   * Run all due reports
   */
  async runDueReports(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: Array<{ reportId: string; success: boolean; error?: string }>;
  }> {
    const dueReports = await this.getDueReports();
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [] as Array<{ reportId: string; success: boolean; error?: string }>,
    };

    for (const report of dueReports) {
      results.processed++;
      const result = await this.triggerReport(report._id.toString());

      if (result.success) {
        results.succeeded++;
        results.results.push({ reportId: result.reportId, success: true });
      } else {
        results.failed++;
        results.results.push({ reportId: result.reportId, success: false, error: result.error });
      }
    }

    logger.info('Due reports processed', {
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
    });

    return results;
  }

  // =============================================================================
  // Cache Management
  // =============================================================================

  /**
   * Clear report cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await cache.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await cache.del(...keys);
      }
      logger.info('Report cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Failed to clear report cache', { error });
    }
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const reportService = new ReportService();

// =============================================================================
// Export Class for Testing
// =============================================================================

export { ReportService };
export default reportService;
