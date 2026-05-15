import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import consentService from '../services/consent.service';
import dataExportService from '../services/dataExport.service';
import auditLogService from '../services/auditLog.service';

/**
 * Get all user consents
 * GET /api/gdpr/consents
 */
export const getUserConsents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const consents = await consentService.getUserConsents(userId);
  const summary = await consentService.getConsentSummary(userId);

  res.json({
    success: true,
    data: {
      consents,
      summary,
    },
  });
});

/**
 * Update user consent
 * POST /api/gdpr/consents
 */
export const updateConsent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { type, granted, version } = req.body;

  if (!type || typeof granted !== 'boolean') {
    throw new ApiError(400, 'Consent type and granted status are required');
  }

  const validTypes = ['terms', 'privacy', 'marketing', 'cookies', 'data_processing'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, 'Invalid consent type');
  }

  const consent = await consentService.recordConsent(userId, type, granted, {
    version,
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    purpose: req.body.purpose,
    legalBasis: req.body.legalBasis,
    method: req.body.method,
  });

  res.json({
    success: true,
    data: consent,
    message: granted ? 'Consent granted' : 'Consent withdrawn',
  });
});

/**
 * Get consent summary
 * GET /api/gdpr/consents/summary
 */
export const getConsentSummary = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const summary = await consentService.getConsentSummary(userId);

  res.json({
    success: true,
    data: summary,
  });
});

/**
 * Verify consent proof
 * GET /api/gdpr/consents/proof
 */
export const getConsentProof = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const type = req.query.type as string;

  if (!type) {
    throw new ApiError(400, 'Consent type is required');
  }

  const proof = await consentService.verifyConsentProof(userId, type as any);

  res.json({
    success: true,
    data: proof,
  });
});

/**
 * Request data export
 * POST /api/gdpr/export
 */
export const requestDataExport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { exportFormat, exportDataTypes } = req.body;

  // Create data request
  const dataRequest = await dataExportService.createDataRequest(userId, 'export', {
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    email: req.user.email,
    exportFormat: exportFormat || 'json',
    exportDataTypes: exportDataTypes || ['profile', 'bookings', 'payments', 'reviews', 'preferences'],
  });

  // Start processing in background (non-blocking)
  // In production, this would be handled by a job queue
  setImmediate(async () => {
    try {
      await dataExportService.processDataExport(dataRequest._id.toString());
    } catch (error) {
      console.error('Data export processing failed:', error);
    }
  });

  res.json({
    success: true,
    data: {
      requestId: dataRequest._id.toString(),
      status: dataRequest.status,
      message: 'Data export request submitted. You will be notified when ready.',
    },
  });
});

/**
 * Get export progress
 * GET /api/gdpr/export/:requestId/progress
 */
export const getExportProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { requestId } = req.params;

  const progress = await dataExportService.getExportProgress(requestId, userId);

  if (!progress) {
    throw new ApiError(404, 'Export request not found');
  }

  res.json({
    success: true,
    data: progress,
  });
});

/**
 * Download export file
 * GET /api/gdpr/export/:requestId/download
 */
export const downloadExport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { requestId } = req.params;

  const fileInfo = await dataExportService.getExportFilePath(requestId, userId);

  if (!fileInfo) {
    throw new ApiError(404, 'Export file not found or expired');
  }

  res.download(fileInfo.filePath, fileInfo.fileName);
});

/**
 * Get all user data requests
 * GET /api/gdpr/data-requests
 */
export const getUserDataRequests = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const type = req.query.type as string | undefined;

  const requests = await dataExportService.getUserDataRequests(userId, type as any);

  res.json({
    success: true,
    data: requests,
  });
});

/**
 * Cancel a data request
 * DELETE /api/gdpr/data-requests/:requestId
 */
export const cancelDataRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { requestId } = req.params;

  const cancelled = await dataExportService.cancelDataRequest(requestId, userId);

  if (!cancelled) {
    throw new ApiError(400, 'Cannot cancel this request. It may already be processed or cancelled.');
  }

  res.json({
    success: true,
    message: 'Data request cancelled',
  });
});

/**
 * Request account deletion
 * POST /api/gdpr/delete
 */
export const requestAccountDeletion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { deletionReason, confirmation } = req.body;

  if (!confirmation) {
    throw new ApiError(400, 'Deletion confirmation is required');
  }

  // Create deletion request
  const dataRequest = await dataExportService.createDataRequest(userId, 'deletion', {
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    email: req.user.email,
    deletionReason,
  });

  // Log the deletion request
  await auditLogService.logDataDeletionRequest(userId, {
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    reason: deletionReason,
  });

  res.json({
    success: true,
    data: {
      requestId: dataRequest._id.toString(),
      gracePeriodEnd: dataRequest.gracePeriodEnd,
      message: 'Account deletion scheduled. You have 14 days to cancel.',
    },
  });
});

/**
 * Cancel account deletion
 * DELETE /api/gdpr/delete
 */
export const cancelAccountDeletion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();

  // Find pending deletion request
  const requests = await dataExportService.getUserDataRequests(userId, 'deletion');
  const pendingRequest = requests.find(r => r.status === 'pending');

  if (!pendingRequest) {
    throw new ApiError(404, 'No pending deletion request found');
  }

  await dataExportService.cancelDataRequest(pendingRequest._id.toString(), userId);

  res.json({
    success: true,
    message: 'Account deletion cancelled',
  });
});

/**
 * Get audit logs
 * GET /api/gdpr/audit-logs
 */
export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { startDate, endDate, page, limit } = req.query;

  const result = await auditLogService.getUserAuditLogs(userId, {
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 50,
  });

  res.json({
    success: true,
    data: result.logs,
    pagination: result.pagination,
  });
});

/**
 * Get compliance report
 * GET /api/gdpr/compliance-report
 */
export const getComplianceReport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { startDate, endDate } = req.query;

  const report = await auditLogService.generateComplianceReport(userId, {
    start: startDate ? new Date(startDate as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate as string) : new Date(),
  });

  res.json({
    success: true,
    data: report,
  });
});

/**
 * Get consent versions (public)
 * GET /api/gdpr/versions
 */
export const getConsentVersions = asyncHandler(async (_req: Request, res: Response) => {
  const versions = consentService.getAllRequiredVersions();

  res.json({
    success: true,
    data: versions,
  });
});

/**
 * Bulk consent update
 * POST /api/gdpr/consents/bulk
 */
export const bulkUpdateConsents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const { consents } = req.body;

  if (!Array.isArray(consents)) {
    throw new ApiError(400, 'Consents must be an array');
  }

  const results = await consentService.recordBulkConsent(userId, consents, {
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    method: 'web',
  });

  res.json({
    success: true,
    data: results,
    message: 'Consents updated successfully',
  });
});

/**
 * Admin: Get GDPR statistics
 * GET /api/gdpr/admin/stats
 */
export const getGdprStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  const { startDate, endDate } = req.query;

  const [consentStats, auditStats, retentionStats] = await Promise.all([
    consentService.getConsentStatistics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    ),
    auditLogService.getGdprStatistics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    ),
    dataExportService.getDataRetentionStats(),
  ]);

  res.json({
    success: true,
    data: {
      consentStatistics: consentStats,
      auditStatistics: auditStats,
      retentionStatistics: retentionStats,
    },
  });
});

/**
 * Admin: Get pending compliance deadlines
 * GET /api/gdpr/admin/pending-deadlines
 */
export const getPendingDeadlines = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  const deadlines = await auditLogService.getPendingComplianceDeadlines();

  res.json({
    success: true,
    data: deadlines,
  });
});

export default {
  getUserConsents,
  updateConsent,
  getConsentSummary,
  getConsentProof,
  requestDataExport,
  getExportProgress,
  downloadExport,
  getUserDataRequests,
  cancelDataRequest,
  requestAccountDeletion,
  cancelAccountDeletion,
  getAuditLogs,
  getComplianceReport,
  getConsentVersions,
  bulkUpdateConsents,
  getGdprStats,
  getPendingDeadlines,
};
