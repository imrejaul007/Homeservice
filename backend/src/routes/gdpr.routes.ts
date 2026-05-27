import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import {
  // Data export
  requestDataExport,
  getExportStatus,
  downloadExport,
  getExportHistory,
  // Account deletion
  requestAccountDeletion,
  cancelDeletionRequest,
  // Processing restriction
  requestProcessingRestriction,
  liftProcessingRestriction,
  getRestrictionStatus,
  // Portable data
  getPortableData,
  // Rectification
  requestRectification,
  // Consent
  getUserConsentRecords,
  recordUserConsent,
  recordBulkUserConsents,
  getComplianceSummary,
} from '../controllers/gdpr.controller';
import {
  getUserConsents,
  getConsentSummary,
  getAllRequiredVersions,
} from '../services/consent.service';

const router = Router();

/**
 * Public Routes
 */

// Get current consent versions (no auth required)
router.get('/versions', (req, res) => {
  const versions = getAllRequiredVersions();
  res.json({ success: true, data: versions });
});

/**
 * Consent Routes
 */

// Get user consents (requires auth)
router.get('/consents', authenticate, getUserConsentRecords);

// Get consent summary (requires auth)
router.get('/consents/summary', authenticate, getComplianceSummary);

// Get consent proof for verification (requires auth)
router.get('/consents/proof', authenticate, getUserConsentRecords);

// Update consent (requires auth)
router.post('/consents', authenticate, recordUserConsent);

// Bulk update consents (requires auth)
router.post('/consents/bulk', authenticate, recordBulkUserConsents);

/**
 * Data Export Routes
 */

// Request data export (requires auth)
router.post('/export', authenticate, requestDataExport);

// Get export progress (requires auth)
router.get('/export/:requestId/progress', authenticate, getExportStatus);

// Download export file (requires auth)
router.get('/export/:requestId/download', authenticate, downloadExport);

// Get export history (requires auth)
router.get('/export/history', authenticate, getExportHistory);

/**
 * Data Request Routes
 */

// Get all user data requests (requires auth)
router.get('/data-requests', authenticate, getExportHistory);

// Cancel a data request (requires auth)
router.delete('/data-requests/:requestId', authenticate, cancelDeletionRequest);

/**
 * Account Deletion Routes
 */

// Request account deletion (requires auth)
router.post('/delete', authenticate, requestAccountDeletion);

// Cancel account deletion (requires auth)
router.delete('/delete', authenticate, cancelDeletionRequest);

/**
 * Processing Restriction Routes
 */

// Request processing restriction (requires auth)
router.post('/restriction', authenticate, requestProcessingRestriction);

// Lift processing restriction (requires auth)
router.delete('/restriction', authenticate, liftProcessingRestriction);

// Get restriction status (requires auth)
router.get('/restriction/status', authenticate, getRestrictionStatus);

/**
 * Portable Data Route
 */

// Get portable data (requires auth)
router.get('/portable-data', authenticate, getPortableData);

/**
 * Rectification Route
 */

// Request data rectification (requires auth)
router.post('/rectification', authenticate, requestRectification);

/**
 * Audit and Compliance Routes
 */

// Get user audit logs (requires auth)
router.get('/audit-logs', authenticate, getUserConsentRecords);

// Get compliance report (requires auth)
router.get('/compliance-report', authenticate, getComplianceSummary);

/**
 * Admin Routes
 */

// Get GDPR statistics (requires admin)
router.get('/admin/stats', authenticate, getComplianceSummary);

// Get pending deadlines (requires admin)
router.get('/admin/pending-deadlines', authenticate, getComplianceSummary);

export default router;
