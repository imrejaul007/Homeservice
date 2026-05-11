import AuditLog from '../models/auditLog.model';
import logger from '../utils/logger';

interface AuditLogData {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  try {
    await AuditLog.create({
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: data.status,
      errorMessage: data.errorMessage,
    });

    logger.debug('Audit log created', {
      auditAction: data.action,
      resource: data.resource,
      userId: data.userId,
      action: 'AUDIT_LOG_CREATED',
    });
  } catch (error: any) {
    logger.error('Failed to create audit log', {
      error: error.message,
      data,
    });
  }
};

/**
 * Get audit logs with pagination
 */
export const getAuditLogs = async (params: {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) => {
  const {
    userId,
    action,
    resource,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = params;

  const query: Record<string, unknown> = {};

  if (userId) query.userId = userId;
  if (action) query.action = action;
  if (resource) query.resource = resource;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) (query.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (query.createdAt as Record<string, Date>).$lte = endDate;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get audit logs for a specific resource
 */
export const getResourceAuditLogs = async (resource: string, resourceId: string) => {
  return AuditLog.find({ resource, resourceId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
};

/**
 * Get user activity summary
 */
export const getUserActivitySummary = async (userId: string, days: number = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await AuditLog.aggregate([
    {
      $match: {
        userId: userId as any,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  return logs;
};

export default {
  createAuditLog,
  getAuditLogs,
  getResourceAuditLogs,
  getUserActivitySummary,
};
