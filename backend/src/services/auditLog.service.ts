import mongoose from 'mongoose';
import GdprAuditLog, { IGdprAuditLog, GdprAction, GdprResource } from '../models/gdprAuditLog.model';
import logger from '../utils/logger';

export interface AuditLogEntry {
  userId?: string;
  action: GdprAction;
  resource: GdprResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  legalBasis?: string;
  purpose?: string;
  dataCategory?: string[];
  retentionPeriod?: string;
  thirdParties?: Array<{
    name: string;
    purpose: string;
    legalBasis: string;
  }>;
  complianceId?: string;
  regulation?: 'gdpr' | 'ccpa' | 'both';
  jurisdiction?: string;
  proofOfConsent?: string;
  requestId?: string;
  requestType?: 'access' | 'deletion' | 'portability' | 'rectification';
  responseDeadline?: Date;
}

export interface AuditLogQuery {
  userId?: string;
  action?: GdprAction | GdprAction[];
  resource?: GdprResource | GdprResource[];
  startDate?: Date;
  endDate?: Date;
  complianceId?: string;
  regulation?: 'gdpr' | 'ccpa' | 'both';
  requestId?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  logs: IGdprAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ComplianceReport {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalActions: number;
    consentActions: number;
    dataRequests: number;
    accessLogs: number;
  };
  consentHistory: IGdprAuditLog[];
  dataRequests: IGdprAuditLog[];
  allLogs: IGdprAuditLog[];
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (entry: AuditLogEntry): Promise<IGdprAuditLog> => {
  const log = await GdprAuditLog.create({
    userId: entry.userId ? new mongoose.Types.ObjectId(entry.userId) : undefined,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    details: entry.details,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    timestamp: new Date(),
    legalBasis: entry.legalBasis,
    purpose: entry.purpose,
    dataCategory: entry.dataCategory,
    retentionPeriod: entry.retentionPeriod,
    thirdParties: entry.thirdParties,
    complianceId: entry.complianceId || `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    regulation: entry.regulation || 'gdpr',
    jurisdiction: entry.jurisdiction,
    proofOfConsent: entry.proofOfConsent,
    requestId: entry.requestId ? new mongoose.Types.ObjectId(entry.requestId) : undefined,
    requestType: entry.requestType,
    responseDeadline: entry.responseDeadline,
  });

  logger.debug('GDPR audit log created', {
    action: entry.action,
    resource: entry.resource,
    userId: entry.userId,
    complianceId: log.complianceId,
    actionType: 'GDPR_AUDIT_LOG_CREATED',
  });

  return log;
};

/**
 * Log consent action (given or withdrawn)
 */
export const logConsentAction = async (
  userId: string,
  action: 'consent_given' | 'consent_withdrawn',
  consentType: string,
  options: {
    version?: string;
    ipAddress?: string;
    userAgent?: string;
    legalBasis?: string;
    purpose?: string;
    method?: string;
  } = {}
): Promise<IGdprAuditLog> => {
  return createAuditLog({
    userId,
    action,
    resource: 'consent',
    details: {
      consentType,
      version: options.version,
      method: options.method,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    legalBasis: options.legalBasis || 'consent',
    purpose: options.purpose,
    dataCategory: [consentType],
    complianceId: `consent-${userId}-${consentType}-${Date.now()}`,
    regulation: 'gdpr',
  });
};

/**
 * Log data access request
 */
export const logDataAccessRequest = async (
  userId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    dataTypes?: string[];
    format?: string;
  } = {}
): Promise<IGdprAuditLog> => {
  return createAuditLog({
    userId,
    action: 'data_access_requested',
    resource: 'data_request',
    details: {
      dataTypes: options.dataTypes,
      format: options.format,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    requestType: 'access',
    responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    complianceId: `access-request-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });
};

/**
 * Log data deletion request
 */
export const logDataDeletionRequest = async (
  userId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
    gracePeriodEnd?: Date;
  } = {}
): Promise<IGdprAuditLog> => {
  return createAuditLog({
    userId,
    action: 'data_deletion_requested',
    resource: 'data_request',
    details: {
      reason: options.reason,
      gracePeriodEnd: options.gracePeriodEnd,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    requestType: 'deletion',
    responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    complianceId: `deletion-request-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });
};

/**
 * Log data portability request
 */
export const logDataPortabilityRequest = async (
  userId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    dataTypes?: string[];
    format?: string;
  } = {}
): Promise<IGdprAuditLog> => {
  return createAuditLog({
    userId,
    action: 'data_portability_requested',
    resource: 'data_request',
    details: {
      dataTypes: options.dataTypes,
      format: options.format,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    requestType: 'portability',
    responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    complianceId: `portability-request-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });
};

/**
 * Query audit logs with filters
 */
export const queryAuditLogs = async (params: AuditLogQuery): Promise<AuditLogResponse> => {
  const {
    userId,
    action,
    resource,
    startDate,
    endDate,
    complianceId,
    regulation,
    requestId,
    page = 1,
    limit = 50,
  } = params;

  const query: Record<string, unknown> = {};

  if (userId) query.userId = new mongoose.Types.ObjectId(userId);
  if (action) {
    query.action = Array.isArray(action) ? { $in: action } : action;
  }
  if (resource) {
    query.resource = Array.isArray(resource) ? { $in: resource } : resource;
  }
  if (complianceId) query.complianceId = complianceId;
  if (regulation) query.regulation = regulation;
  if (requestId) query.requestId = new mongoose.Types.ObjectId(requestId);

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) (query.timestamp as Record<string, Date>).$gte = startDate;
    if (endDate) (query.timestamp as Record<string, Date>).$lte = endDate;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    GdprAuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as IGdprAuditLog[],
    GdprAuditLog.countDocuments(query),
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
 * Get audit logs for a specific user
 */
export const getUserAuditLogs = async (
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {}
): Promise<AuditLogResponse> => {
  return queryAuditLogs({
    userId,
    startDate: options.startDate,
    endDate: options.endDate,
    page: options.page,
    limit: options.limit,
  });
};

/**
 * Get audit logs for a specific data request
 */
export const getRequestAuditLogs = async (requestId: string): Promise<IGdprAuditLog[]> => {
  const logs = await GdprAuditLog.find({ requestId: new mongoose.Types.ObjectId(requestId) })
    .sort({ timestamp: -1 })
    .lean();
  return logs as unknown as IGdprAuditLog[];
};

/**
 * Get audit logs for a specific resource
 */
export const getResourceAuditLogs = async (
  resource: GdprResource,
  resourceId?: string
): Promise<IGdprAuditLog[]> => {
  const query: Record<string, unknown> = { resource };
  if (resourceId) query.resourceId = resourceId;

  const logs = await GdprAuditLog.find(query)
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();
  return logs as unknown as IGdprAuditLog[];
};

/**
 * Generate compliance report for a user (GDPR Article 15/17/20)
 */
export const generateComplianceReport = async (
  userId: string,
  period?: {
    start: Date;
    end: Date;
  }
): Promise<ComplianceReport> => {
  const startDate = period?.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default: 1 year
  const endDate = period?.end || new Date();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Query all logs for the user in the period
  const allLogsRaw = await GdprAuditLog.find({
    userId: userObjectId,
    timestamp: { $gte: startDate, $lte: endDate },
  })
    .sort({ timestamp: -1 })
    .lean();
  const allLogs = allLogsRaw as unknown as IGdprAuditLog[];

  // Categorize logs
  const consentActions: IGdprAuditLog[] = [];
  const dataRequests: IGdprAuditLog[] = [];
  const accessLogs: IGdprAuditLog[] = [];

  for (const log of allLogs) {
    if (['consent_given', 'consent_withdrawn'].includes(log.action)) {
      consentActions.push(log);
    } else if (['data_access_requested', 'data_deletion_requested', 'data_portability_requested'].includes(log.action)) {
      dataRequests.push(log);
    } else {
      accessLogs.push(log);
    }
  }

  return {
    userId,
    period: { start: startDate, end: endDate },
    summary: {
      totalActions: allLogs.length,
      consentActions: consentActions.length,
      dataRequests: dataRequests.length,
      accessLogs: accessLogs.length,
    },
    consentHistory: consentActions,
    dataRequests,
    allLogs,
  };
};

/**
 * Get consent history for a user
 */
export const getConsentHistory = async (userId: string): Promise<IGdprAuditLog[]> => {
  const logs = await GdprAuditLog.find({
    userId: new mongoose.Types.ObjectId(userId),
    action: { $in: ['consent_given', 'consent_withdrawn'] },
  })
    .sort({ timestamp: -1 })
    .lean();
  return logs as unknown as IGdprAuditLog[];
};

/**
 * Get data request history for a user
 */
export const getDataRequestHistory = async (userId: string): Promise<IGdprAuditLog[]> => {
  const logs = await GdprAuditLog.find({
    userId: new mongoose.Types.ObjectId(userId),
    action: {
      $in: [
        'data_access_requested',
        'data_access_completed',
        'data_deletion_requested',
        'data_deletion_initiated',
        'data_deletion_completed',
        'data_portability_requested',
        'data_portability_completed',
        'data_rectification_requested',
        'data_rectification_completed',
      ],
    },
  })
    .sort({ timestamp: -1 })
    .lean();
  return logs as unknown as IGdprAuditLog[];
};

/**
 * Check for pending compliance deadlines
 */
export const getPendingComplianceDeadlines = async (): Promise<IGdprAuditLog[]> => {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const logs = await GdprAuditLog.find({
    responseDeadline: {
      $gte: now,
      $lte: thirtyDaysFromNow,
    },
    responseSentAt: { $exists: false },
  })
    .sort({ responseDeadline: 1 })
    .lean();
  return logs as unknown as IGdprAuditLog[];
};

/**
 * Mark request as responded
 */
export const markRequestResponded = async (
  auditLogId: string,
  adminId: string
): Promise<void> => {
  await GdprAuditLog.findByIdAndUpdate(auditLogId, {
    responseSentAt: new Date(),
  });

  logger.info('Compliance request marked as responded', {
    auditLogId,
    adminId,
    action: 'COMPLIANCE_REQUEST_RESPONDED',
  });
};

/**
 * Get GDPR statistics for admin dashboard
 */
export const getGdprStatistics = async (startDate?: Date, endDate?: Date): Promise<{
  totalLogs: number;
  actionCounts: Record<string, number>;
  resourceCounts: Record<string, number>;
  pendingRequests: number;
  completedRequests: number;
  recentActivity: IGdprAuditLog[];
}> => {
  const matchStage: Record<string, unknown> = {};

  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) (matchStage.timestamp as Record<string, Date>).$gte = startDate;
    if (endDate) (matchStage.timestamp as Record<string, Date>).$lte = endDate;
  }

  // Count by action
  const actionCounts = await GdprAuditLog.aggregate([
    { $match: matchStage },
    { $group: { _id: '$action', count: { $sum: 1 } } },
  ]);

  // Count by resource
  const resourceCounts = await GdprAuditLog.aggregate([
    { $match: matchStage },
    { $group: { _id: '$resource', count: { $sum: 1 } } },
  ]);

  // Count pending requests
  const pendingRequests = await GdprAuditLog.countDocuments({
    ...matchStage,
    responseDeadline: { $exists: true, $ne: null },
    responseSentAt: { $exists: false },
  });

  // Count completed requests
  const completedRequests = await GdprAuditLog.countDocuments({
    ...matchStage,
    responseSentAt: { $exists: true },
  });

  // Recent activity
  const recentActivityRaw = await GdprAuditLog.find(matchStage)
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();
  const recentActivity = recentActivityRaw as unknown as IGdprAuditLog[];

  // Format counts
  const actionCountMap: Record<string, number> = {};
  for (const item of actionCounts) {
    actionCountMap[item._id] = item.count;
  }

  const resourceCountMap: Record<string, number> = {};
  for (const item of resourceCounts) {
    resourceCountMap[item._id] = item.count;
  }

  return {
    totalLogs: actionCounts.reduce((sum, item) => sum + item.count, 0),
    actionCounts: actionCountMap,
    resourceCounts: resourceCountMap,
    pendingRequests,
    completedRequests,
    recentActivity,
  };
};

/**
 * Delete audit logs for a user (only if legally required)
 * Note: GDPR audit logs should generally be retained for compliance
 */
export const deleteUserAuditLogs = async (userId: string): Promise<number> => {
  // This is generally NOT recommended for GDPR compliance
  // Audit logs serve as proof of compliance
  // Only call this if there's a specific legal requirement

  logger.warn('Attempting to delete user audit logs', {
    userId,
    action: 'AUDIT_LOG_DELETION_REQUESTED',
  });

  const result = await GdprAuditLog.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
  });

  logger.info('User audit logs deleted', {
    userId,
    deletedCount: result.deletedCount,
    action: 'USER_AUDIT_LOGS_DELETED',
  });

  return result.deletedCount;
};

export default {
  createAuditLog,
  logConsentAction,
  logDataAccessRequest,
  logDataDeletionRequest,
  logDataPortabilityRequest,
  queryAuditLogs,
  getUserAuditLogs,
  getRequestAuditLogs,
  getResourceAuditLogs,
  generateComplianceReport,
  getConsentHistory,
  getDataRequestHistory,
  getPendingComplianceDeadlines,
  markRequestResponded,
  getGdprStatistics,
  deleteUserAuditLogs,
};
