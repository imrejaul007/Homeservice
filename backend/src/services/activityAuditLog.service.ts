import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

export type ActivityCategory =
  | 'authentication'
  | 'booking'
  | 'payment'
  | 'profile'
  | 'service'
  | 'review'
  | 'messaging'
  | 'settings'
  | 'admin';

export type ActivitySeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ActivityLog {
  _id?: Types.ObjectId;
  userId?: Types.ObjectId | string;
  userType: 'customer' | 'provider' | 'admin' | 'system';
  category: ActivityCategory;
  action: string;
  description: string;
  severity: ActivitySeverity;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
    os?: string;
    browser?: string;
  };
  location?: {
    country?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  relatedResources?: Array<{
    type: string;
    id: string;
  }>;
  sessionId?: string;
  requestId?: string;
  duration?: number; // in milliseconds
  status: 'success' | 'failed';
  errorMessage?: string;
  createdAt?: Date;
}

export interface ActivityQuery {
  userId?: string;
  userType?: ActivityLog['userType'];
  category?: ActivityCategory;
  action?: string;
  severity?: ActivitySeverity;
  status?: ActivityLog['status'];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface ActivityExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: ActivityQuery;
  includeMetadata?: boolean;
}

// ============================================
// Mongoose Interface
// ============================================

interface IActivityLog extends Document, Omit<ActivityLog, '_id'> {}

// ============================================
// Mongoose Schema
// ============================================

const DeviceInfoSchema = new mongoose.Schema({
  type: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
  os: { type: String },
  browser: { type: String },
}, { _id: false });

const LocationSchema = new mongoose.Schema({
  country: { type: String },
  city: { type: String },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
}, { _id: false });

const RelatedResourceSchema = new mongoose.Schema({
  type: { type: String, required: true },
  id: { type: String, required: true },
}, { _id: false });

const ActivityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  userType: {
    type: String,
    enum: ['customer', 'provider', 'admin', 'system'],
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: ['authentication', 'booking', 'payment', 'profile', 'service', 'review', 'messaging', 'settings', 'admin'],
    required: true,
    index: true,
  },
  action: { type: String, required: true, index: true },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceInfo: { type: DeviceInfoSchema },
  location: { type: LocationSchema },
  relatedResources: { type: [RelatedResourceSchema] },
  sessionId: { type: String, index: true },
  requestId: { type: String, index: true },
  duration: { type: Number },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
    index: true,
  },
  errorMessage: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'activity_logs',
  expires: undefined, // Set dynamically based on retention policy
});

// Compound indexes for common query patterns
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ category: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ severity: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });

// Text index for search
ActivityLogSchema.index({ description: 'text', action: 'text' });

// ============================================
// Model Registration
// ============================================

export const ActivityLogModel = mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);

// ============================================
// Retention Policies
// ============================================

const RETENTION_POLICIES: Record<ActivityCategory | 'all', number> = {
  authentication: 365, // 1 year
  booking: 90, // 90 days
  payment: 2555, // 7 years (financial records)
  profile: 365, // 1 year
  service: 365, // 1 year
  review: 365, // 1 year
  messaging: 90, // 90 days
  settings: 180, // 6 months
  admin: 730, // 2 years
  all: 365, // Default: 1 year
};

// ============================================
// Service Class
// ============================================

export class ActivityAuditLogService {

  // ========================================
  // Activity Logging
  // ========================================

  /**
   * Log an activity
   */
  async logActivity(input: Omit<ActivityLog, '_id' | 'createdAt'>): Promise<IActivityLog> {
    const {
      userId,
      userType,
      category,
      action,
      description,
      severity,
      metadata,
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      relatedResources,
      sessionId,
      requestId,
      duration,
      status,
      errorMessage,
    } = input;

    const activity = new ActivityLogModel({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      userType,
      category,
      action,
      description,
      severity: severity || 'info',
      metadata,
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      relatedResources,
      sessionId,
      requestId,
      duration,
      status,
      errorMessage,
    });

    await activity.save();

    logger.debug('Activity logged', {
      context: 'ActivityAuditLogService',
      event: 'ACTIVITY_LOGGED',
      activityId: activity._id.toString(),
      userId,
      category,
      action,
    });

    return activity;
  }

  /**
   * Log authentication activity
   */
  async logAuthActivity(
    userId: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_reset' | '2fa_enabled' | '2fa_disabled',
    metadata?: Record<string, unknown>
  ): Promise<IActivityLog> {
    return this.logActivity({
      userId,
      userType: 'customer',
      category: 'authentication',
      action,
      description: this.getAuthDescription(action),
      metadata,
      severity: action.includes('failed') ? 'warning' : 'info',
      status: action.includes('failed') ? 'failed' : 'success',
    });
  }

  /**
   * Get authentication activity description
   */
  private getAuthDescription(action: string): string {
    const descriptions: Record<string, string> = {
      login: 'User logged in',
      logout: 'User logged out',
      login_failed: 'Failed login attempt',
      password_reset: 'Password reset requested',
      '2fa_enabled': 'Two-factor authentication enabled',
      '2fa_disabled': 'Two-factor authentication disabled',
    };
    return descriptions[action] || action;
  }

  // ========================================
  // Query Methods
  // ========================================

  /**
   * Query activities with filters
   */
  async queryActivities(
    query: ActivityQuery,
    options: { page?: number; limit?: number; sortOrder?: 'asc' | 'desc' } = {}
  ): Promise<{ activities: IActivityLog[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 50, sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.userType) filter.userType = query.userType;
    if (query.category) filter.category = query.category;
    if (query.action) filter.action = query.action;
    if (query.severity) filter.severity = query.severity;
    if (query.status) filter.status = query.status;

    // Date range
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) (filter.createdAt as Record<string, Date>).$gte = query.startDate;
      if (query.endDate) (filter.createdAt as Record<string, Date>).$lte = query.endDate;
    }

    // Text search
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    // Related resources
    if (query.resourceType && query.resourceId) {
      filter.relatedResources = {
        $elemMatch: { type: query.resourceType, id: query.resourceId },
      };
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [activities, total] = await Promise.all([
      ActivityLogModel.find(filter)
        .sort({ createdAt: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLogModel.countDocuments(filter),
    ]);

    return {
      activities: activities as unknown as IActivityLog[],
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user activity history
   */
  async getUserActivityHistory(
    userId: string,
    options: {
      category?: ActivityCategory;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ activities: IActivityLog[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    return this.queryActivities(
      { userId },
      options
    );
  }

  /**
   * Get activities by resource
   */
  async getActivitiesByResource(
    resourceType: string,
    resourceId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ activities: IActivityLog[]; total: number; page: number; pages: number }> {
    return this.queryActivities(
      { resourceType, resourceId },
      options
    );
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(
    limit: number = 10
  ): Promise<IActivityLog[]> {
    return ActivityLogModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean() as unknown as IActivityLog[];
  }

  /**
   * Get activities by session
   */
  async getSessionActivities(sessionId: string): Promise<IActivityLog[]> {
    return ActivityLogModel.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean() as unknown as IActivityLog[];
  }

  // ========================================
  // Export Functionality
  // ========================================

  /**
   * Export activities
   */
  async exportActivities(options: ActivityExportOptions): Promise<{
    data: string | Buffer;
    contentType: string;
    filename: string;
  }> {
    const { format, dateRange, filters, includeMetadata } = options;

    const queryFilters: ActivityQuery = {
      ...filters,
      startDate: dateRange.start,
      endDate: dateRange.end,
    };

    // Get all matching activities (with limit for safety)
    const result = await this.queryActivities(queryFilters, { page: 1, limit: 10000 });

    // Format data based on export type
    switch (format) {
      case 'json':
        return this.exportAsJson(result.activities, includeMetadata);

      case 'csv':
        return this.exportAsCsv(result.activities, includeMetadata);

      case 'xlsx':
        // For xlsx, we'd use a library like 'xlsx' in production
        // For now, fall back to CSV
        return this.exportAsCsv(result.activities, includeMetadata);

      default:
        throw ApiError.badRequest('Unsupported export format');
    }
  }

  /**
   * Export as JSON
   */
  private exportAsJson(activities: IActivityLog[], includeMetadata?: boolean): {
    data: string;
    contentType: string;
    filename: string;
  } {
    let exportData = activities;

    if (!includeMetadata) {
      exportData = activities.map(a => {
        const { metadata, ...rest } = a;
        return rest;
      }) as unknown as IActivityLog[];
    }

    return {
      data: JSON.stringify(exportData, null, 2),
      contentType: 'application/json',
      filename: `activity_export_${Date.now()}.json`,
    };
  }

  /**
   * Export as CSV
   */
  private exportAsCsv(activities: IActivityLog[], _includeMetadata?: boolean): {
    data: string;
    contentType: string;
    filename: string;
  } {
    const headers = [
      'ID',
      'User ID',
      'User Type',
      'Category',
      'Action',
      'Description',
      'Severity',
      'Status',
      'IP Address',
      'Created At',
    ];

    const rows = activities.map(a => [
      a._id?.toString() || '',
      a.userId?.toString() || '',
      a.userType || '',
      a.category || '',
      a.action || '',
      `"${(a.description || '').replace(/"/g, '""')}"`,
      a.severity || '',
      a.status || '',
      a.ipAddress || '',
      a.createdAt ? a.createdAt.toISOString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return {
      data: csv,
      contentType: 'text/csv',
      filename: `activity_export_${Date.now()}.csv`,
    };
  }

  // ========================================
  // Retention Policies
  // ========================================

  /**
   * Get retention period for a category
   */
  getRetentionPeriod(category?: ActivityCategory): number {
    if (category) {
      return RETENTION_POLICIES[category] || RETENTION_POLICIES.all;
    }
    return RETENTION_POLICIES.all;
  }

  /**
   * Clean up old activities based on retention policy
   */
  async cleanupOldActivities(): Promise<{ deleted: number }> {
    let totalDeleted = 0;

    for (const [category, retentionDays] of Object.entries(RETENTION_POLICIES)) {
      if (category === 'all') continue;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await ActivityLogModel.deleteMany({
        category: category as ActivityCategory,
        createdAt: { $lt: cutoffDate },
      });

      totalDeleted += result.deletedCount;
    }

    logger.info('Activity logs cleaned up', {
      context: 'ActivityAuditLogService',
      action: 'CLEANUP_COMPLETED',
      deletedCount: totalDeleted,
    });

    return { deleted: totalDeleted };
  }

  /**
   * Set TTL index for automatic expiration
   */
  async setExpirationIndex(category: ActivityCategory): Promise<void> {
    const retentionDays = RETENTION_POLICIES[category] || RETENTION_POLICIES.all;
    const expireAfterSeconds = retentionDays * 24 * 60 * 60;

    // MongoDB TTL indexes work on a specific field
    // Since we use 'createdAt', we'll create the index
    try {
      await ActivityLogModel.collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds, partialFilterExpression: { category } }
      );
      logger.info('TTL index created', {
        context: 'ActivityAuditLogService',
        action: 'TTL_INDEX_CREATED',
        category,
        expireAfterSeconds,
      });
    } catch (error) {
      logger.warn('TTL index creation failed', {
        context: 'ActivityAuditLogService',
        action: 'TTL_INDEX_FAILED',
        category,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ========================================
  // Analytics & Reporting
  // ========================================

  /**
   * Get activity statistics
   */
  async getActivityStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActivities: number;
    activitiesByCategory: Record<ActivityCategory, number>;
    activitiesBySeverity: Record<ActivitySeverity, number>;
    failedActivities: number;
    topActions: Array<{ action: string; count: number }>;
    activeUsers: number;
  }> {
    const matchStage: Record<string, unknown> = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [categoryStats, severityStats, actionStats, failedCount, activeUsers] = await Promise.all([
      ActivityLogModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      ActivityLogModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      ActivityLogModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      ActivityLogModel.countDocuments({ ...matchStage, status: 'failed' }),
      ActivityLogModel.distinct('userId', { ...matchStage, userId: { $exists: true } }),
    ]);

    const categoryMap: Record<string, number> = {};
    for (const s of categoryStats) {
      categoryMap[s._id] = s.count;
    }

    const severityMap: Record<string, number> = {};
    for (const s of severityStats) {
      severityMap[s._id] = s.count;
    }

    const totalActivities = categoryStats.reduce((sum, s) => sum + s.count, 0);

    return {
      totalActivities,
      activitiesByCategory: categoryMap as Record<ActivityCategory, number>,
      activitiesBySeverity: severityMap as Record<ActivitySeverity, number>,
      failedActivities: failedCount,
      topActions: actionStats.map(s => ({ action: s._id, count: s.count })),
      activeUsers: activeUsers.length,
    };
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string): Promise<{
    totalActivities: number;
    lastActivity: Date | null;
    activitiesByCategory: Record<ActivityCategory, number>;
    recentActions: Array<{ action: string; createdAt: Date }>;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const [categoryStats, recentActions] = await Promise.all([
      ActivityLogModel.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      ActivityLogModel.find({ userId: userObjectId })
        .select('action createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const categoryMap: Record<string, number> = {};
    for (const s of categoryStats) {
      categoryMap[s._id] = s.count;
    }

    const totalActivities = categoryStats.reduce((sum, s) => sum + s.count, 0);

    return {
      totalActivities,
      lastActivity: recentActions[0]?.createdAt || null,
      activitiesByCategory: categoryMap as Record<ActivityCategory, number>,
      recentActions: recentActions.map(a => ({
        action: a.action,
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Get security-relevant activities
   */
  async getSecurityActivities(
    options: { page?: number; limit?: number } = {}
  ): Promise<{ activities: IActivityLog[]; total: number }> {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { category: 'authentication' as ActivityCategory },
        { severity: { $in: ['error', 'critical'] as ActivitySeverity[] } },
        { action: /failed/i },
        { status: 'failed' as const },
      ],
    };

    const [activities, total] = await Promise.all([
      ActivityLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLogModel.countDocuments(query),
    ]);

    return {
      activities: activities as unknown as IActivityLog[],
      total,
    };
  }

  // ========================================
  // Aggregation Pipeline Helpers
  // ========================================

  /**
   * Build aggregation pipeline for activity analysis
   */
  buildAggregationPipeline(
    groupBy: string[],
    filters?: ActivityQuery
  ): mongoose.PipelineStage[] {
    const pipeline: mongoose.PipelineStage[] = [];

    // Match stage
    const match: Record<string, unknown> = {};

    if (filters?.userId) match.userId = new Types.ObjectId(filters.userId);
    if (filters?.userType) match.userType = filters.userType;
    if (filters?.category) match.category = filters.category;
    if (filters?.action) match.action = filters.action;
    if (filters?.severity) match.severity = filters.severity;
    if (filters?.status) match.status = filters.status;

    if (filters?.startDate || filters?.endDate) {
      match.createdAt = {};
      if (filters.startDate) (match.createdAt as Record<string, Date>).$gte = filters.startDate;
      if (filters.endDate) (match.createdAt as Record<string, Date>).$lte = filters.endDate;
    }

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // Group stage
    const groupId: Record<string, unknown> = {};
    for (const field of groupBy) {
      groupId[field] = `$${field}`;
    }

    pipeline.push({
      $group: {
        _id: groupId,
        count: { $sum: 1 },
        firstActivity: { $min: '$createdAt' },
        lastActivity: { $max: '$createdAt' },
      },
    });

    // Sort
    pipeline.push({ $sort: { count: -1 } });

    return pipeline;
  }
}

// ============================================
// Export Singleton
// ============================================

export const activityAuditLogService = new ActivityAuditLogService();
export default activityAuditLogService;
