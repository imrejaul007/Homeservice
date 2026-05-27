/**
 * GDPR Data Subject Rights Controller
 * 
 * GDPR Compliance: Articles 15-21
 * Implements data subject rights endpoints
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  createDataRequest,
  processDataExport,
  getExportProgress,
  getUserDataRequests,
  cancelDataRequest,
  getExportFilePath,
  deleteUserData,
  collectUserData,
  ExportDataType,
} from '../services/dataExport.service';
import { 
  recordConsent,
  getUserConsents,
  getConsentSummary,
  recordBulkConsent,
} from '../services/consent.service';
import { 
  restrictUserProcessing,
  liftUserRestriction,
  getRestrictionDetails,
  isUserProcessingRestricted,
} from '../services/restriction.service';
import Consent from '../models/consent.model';
import DataRequest from '../models/dataRequest.model';
import User from '../models/user.model';
import logger from '../utils/logger';

// ============================================
// RIGHT TO ACCESS (Article 15)
// ============================================

/**
 * @route   POST /api/gdpr/export
 * @desc    Request data export (right to access)
 * @access  Private
 */
export const requestDataExport = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { 
    exportFormat = 'json',
    exportDataTypes,
    email,
  } = req.body;
  
  // Validate export format
  if (!['json', 'csv', 'pdf'].includes(exportFormat)) {
    throw new ApiError(400, 'Invalid export format. Must be json, csv, or pdf');
  }
  
  // Create data request
  const dataRequest = await createDataRequest(userId, 'export', {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    email: email || req.user?.email,
    exportFormat,
    exportDataTypes: exportDataTypes || [
      'profile',
      'bookings',
      'payments',
      'reviews',
      'preferences',
      'consents',
      'loyalty',
      'sessions',
      'ai_personalization',
    ],
  });
  
  res.status(202).json({
    success: true,
    message: 'Data export request accepted. Processing may take up to 30 days.',
    data: {
      requestId: dataRequest._id.toString(),
      status: dataRequest.status,
      requestedAt: dataRequest.requestedAt,
      estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
});

/**
 * @route   GET /api/gdpr/export/:requestId
 * @desc    Get export progress
 * @access  Private
 */
export const getExportStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { requestId } = req.params;
  
  const progress = await getExportProgress(requestId, userId);
  if (!progress) {
    throw new ApiError(404, 'Export request not found');
  }
  
  res.json({
    success: true,
    data: progress,
  });
});

/**
 * @route   GET /api/gdpr/export/:requestId/download
 * @desc    Download exported data
 * @access  Private
 */
export const downloadExport = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { requestId } = req.params;
  
  const fileInfo = await getExportFilePath(requestId, userId);
  if (!fileInfo) {
    throw new ApiError(404, 'Export file not found or expired');
  }
  
  res.download(fileInfo.filePath, fileInfo.fileName);
});

/**
 * @route   GET /api/gdpr/export/history
 * @desc    Get user's export requests
 * @access  Private
 */
export const getExportHistory = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const requests = await getUserDataRequests(userId, 'export');
  
  res.json({
    success: true,
    data: requests,
  });
});

// ============================================
// RIGHT TO ERASURE (Article 17)
// ============================================

/**
 * @route   POST /api/gdpr/delete
 * @desc    Request account deletion (right to erasure)
 * @access  Private
 */
export const requestAccountDeletion = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { 
    deletionReason,
    confirmDeletion = true,
    anonymizeInstead = false,
  } = req.body;
  
  if (!confirmDeletion) {
    throw new ApiError(400, 'Deletion must be explicitly confirmed');
  }
  
  // Create deletion request
  const dataRequest = await createDataRequest(userId, 'deletion', {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    deletionReason,
  });
  
  // For immediate deletion (not anonymization)
  if (!anonymizeInstead) {
    // Check if user wants immediate or scheduled deletion
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Apply soft delete
    await User.findByIdAndUpdate(userId, {
      isDeleted: true,
      isActive: false,
      accountStatus: 'deactivated',
      email: `deleted_${userId}_${user.email}`,
    });
  }
  
  res.status(202).json({
    success: true,
    message: 'Deletion request accepted. Your data will be permanently deleted after a 90-day grace period.',
    data: {
      requestId: dataRequest._id.toString(),
      status: dataRequest.status,
      gracePeriodEnd: dataRequest.gracePeriodEnd,
      note: 'Your data is protected during the grace period. Contact support to cancel.',
    },
  });
});

/**
 * @route   DELETE /api/gdpr/delete/immediate
 * @desc    Request immediate account deletion (full erasure)
 * @access  Private
 */
export const requestImmediateDeletion = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { 
    deletionReason,
    confirmDeletion = true,
    understandDataLoss = false,
  } = req.body;
  
  if (!confirmDeletion || !understandDataLoss) {
    throw new ApiError(400, 'Both confirmDeletion and understandDataLoss must be true');
  }
  
  // Perform full deletion
  const result = await deleteUserData(userId, {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    deletionReason,
    anonymizeInstead: false,
  });
  
  // Audit log
  logger.info('Immediate deletion completed via GDPR request', {
    userId,
    result,
    action: 'IMMEDIATE_DELETION_COMPLETED',
  });
  
  res.json({
    success: true,
    message: 'Your account has been permanently deleted.',
    data: {
      deleted: result.deleted,
      deletedRecords: result.deletedRecords,
    },
  });
});

/**
 * @route   POST /api/gdpr/delete/cancel
 * @desc    Cancel deletion request
 * @access  Private
 */
export const cancelDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { requestId } = req.body;
  
  if (!requestId) {
    throw new ApiError(400, 'Request ID is required');
  }
  
  const cancelled = await cancelDataRequest(requestId, userId);
  if (!cancelled) {
    throw new ApiError(404, 'Deletion request not found or already processed');
  }
  
  // Restore account if it was soft-deleted
  const user = await User.findById(userId);
  if (user && user.isDeleted) {
    await User.findByIdAndUpdate(userId, {
      isDeleted: false,
      isActive: true,
      accountStatus: 'active',
      email: user.email.replace(/^deleted_[^_]+_/, ''),
    });
  }
  
  res.json({
    success: true,
    message: 'Deletion request cancelled. Your account has been restored.',
  });
});

// ============================================
// RIGHT TO RECTIFICATION (Article 16)
// ============================================

/**
 * @route   PATCH /api/gdpr/rectify
 * @desc    Request data rectification
 * @access  Private
 */
export const requestRectification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { rectificationData, description } = req.body;
  
  if (!rectificationData || typeof rectificationData !== 'object') {
    throw new ApiError(400, 'Rectification data is required');
  }
  
  // Create rectification request
  const dataRequest = await createDataRequest(userId, 'rectification', {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    metadata: {
      rectificationData,
      description,
    },
  });
  
  res.status(202).json({
    success: true,
    message: 'Rectification request submitted. We will process it within 30 days.',
    data: {
      requestId: dataRequest._id.toString(),
      status: dataRequest.status,
      note: 'For urgent corrections, please use the profile update endpoints directly.',
    },
  });
});

// ============================================
// RIGHT TO RESTRICTION (Article 18)
// ============================================

/**
 * @route   POST /api/gdpr/restrict
 * @desc    Request restriction of processing
 * @access  Private
 */
export const requestProcessingRestriction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { reason, notes } = req.body;
  
  if (!reason) {
    throw new ApiError(400, 'Restriction reason is required');
  }
  
  // Check if already restricted
  const isRestricted = await isUserProcessingRestricted(userId);
  if (isRestricted) {
    throw new ApiError(400, 'Processing is already restricted for this account');
  }
  
  // Apply restriction
  await restrictUserProcessing(userId, reason, {
    requestedBy: 'user',
    notes,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.json({
    success: true,
    message: 'Processing restriction has been applied to your account.',
    data: {
      restrictedAt: new Date(),
      note: 'We will not process your data until the restriction is lifted. Contact support for assistance.',
    },
  });
});

/**
 * @route   DELETE /api/gdpr/restrict
 * @desc    Lift restriction of processing
 * @access  Private
 */
export const liftProcessingRestriction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { reason } = req.body;
  
  const isRestricted = await isUserProcessingRestricted(userId);
  if (!isRestricted) {
    throw new ApiError(400, 'Processing restriction is not active for this account');
  }
  
  // Lift restriction
  await liftUserRestriction(userId, {
    requestedBy: 'user',
    reason: reason || 'User requested',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.json({
    success: true,
    message: 'Processing restriction has been lifted. Your data processing will resume.',
  });
});

/**
 * @route   GET /api/gdpr/restrict
 * @desc    Get restriction status
 * @access  Private
 */
export const getRestrictionStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const isRestricted = await isUserProcessingRestricted(userId);
  
  if (isRestricted) {
    const details = await getRestrictionDetails(userId);
    res.json({
      success: true,
      data: {
        isRestricted: true,
        details,
      },
    });
  } else {
    res.json({
      success: true,
      data: {
        isRestricted: false,
      },
    });
  }
});

// ============================================
// RIGHT TO DATA PORTABILITY (Article 20)
// ============================================

/**
 * @route   GET /api/gdpr/portability
 * @desc    Get portable data in different formats
 * @access  Private
 */
export const getPortableData = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { format = 'json' } = req.query;

  const dataTypes: ExportDataType[] = [
    'profile',
    'bookings',
    'payments',
    'reviews',
    'preferences',
    'loyalty',
    'sessions',
    'consents',
  ];

  const data = await collectUserData(userId, dataTypes);
  
  switch (format) {
    case 'json':
      res.json({
        success: true,
        data,
        format: 'json',
      });
      break;
      
    case 'csv':
      // Convert to CSV
      const csvData = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="nilin-data-${Date.now()}.csv"`);
      res.send(csvData);
      break;
      
    default:
      throw new ApiError(400, 'Invalid format. Use json or csv');
  }
});

/**
 * Helper: Convert data object to CSV
 */
function convertToCSV(data: any): string {
  const rows: string[] = [];
  
  // Profile data
  rows.push('=== PROFILE DATA ===');
  if (data.profile) {
    for (const [key, value] of Object.entries(data.profile)) {
      rows.push(`${key},${JSON.stringify(value)}`);
    }
  }
  
  // Bookings
  if (data.bookings && data.bookings.length > 0) {
    rows.push('');
    rows.push('=== BOOKINGS ===');
    rows.push(Object.keys(data.bookings[0]).join(','));
    for (const booking of data.bookings) {
      rows.push(Object.values(booking).map(v => JSON.stringify(v)).join(','));
    }
  }
  
  return rows.join('\n');
}

// ============================================
// CONSENT MANAGEMENT
// ============================================

/**
 * @route   GET /api/gdpr/consents
 * @desc    Get user's consent records
 * @access  Private
 */
export const getUserConsentRecords = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const consents = await getUserConsents(userId);
  const summary = await getConsentSummary(userId);
  
  res.json({
    success: true,
    data: {
      consents,
      summary,
    },
  });
});

/**
 * @route   POST /api/gdpr/consents
 * @desc    Record user consent
 * @access  Private
 */
export const recordUserConsent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { 
    type,
    granted,
    version,
    purpose,
    legalBasis,
  } = req.body;
  
  if (!type || typeof granted !== 'boolean') {
    throw new ApiError(400, 'Consent type and granted status are required');
  }
  
  const consent = await recordConsent(userId, type, granted, {
    version,
    purpose,
    legalBasis,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    method: 'web',
  });
  
  res.json({
    success: true,
    message: granted ? 'Consent recorded' : 'Consent withdrawn',
    data: consent,
  });
});

/**
 * @route   POST /api/gdpr/consents/bulk
 * @desc    Record multiple consents at once
 * @access  Private
 */
export const recordBulkUserConsents = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  const { consents } = req.body;
  
  if (!consents || !Array.isArray(consents)) {
    throw new ApiError(400, 'Consents array is required');
  }
  
  const results = await recordBulkConsent(userId, consents, {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    method: 'web',
  });
  
  res.json({
    success: true,
    message: 'Consents recorded successfully',
    data: results,
  });
});

// ============================================
// COMPLIANCE & REPORTING
// ============================================

/**
 * @route   GET /api/gdpr/compliance
 * @desc    Get GDPR compliance summary
 * @access  Private
 */
export const getComplianceSummary = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }
  
  // Gather compliance information
  const [consents, isRestricted, dataRequests] = await Promise.all([
    getConsentSummary(userId),
    isUserProcessingRestricted(userId),
    getUserDataRequests(userId),
  ]);
  
  const activeRequests = dataRequests.filter(
    r => r.status === 'pending' || r.status === 'processing'
  );
  
  res.json({
    success: true,
    data: {
      consents,
      processingRestricted: isRestricted,
      activeRequests: activeRequests.length,
      totalRequests: dataRequests.length,
      lastRequest: dataRequests[0]?.requestedAt,
    },
  });
});

export default {
  requestDataExport,
  getExportStatus,
  downloadExport,
  getExportHistory,
  requestAccountDeletion,
  requestImmediateDeletion,
  cancelDeletionRequest,
  requestRectification,
  requestProcessingRestriction,
  liftProcessingRestriction,
  getRestrictionStatus,
  getPortableData,
  getUserConsentRecords,
  recordUserConsent,
  recordBulkUserConsents,
  getComplianceSummary,
};
