import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import {
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
} from '../controllers/gdpr.controller';

const router = Router();

/**
 * Public Routes
 */

// Get current consent versions (no auth required)
router.get('/versions', getConsentVersions);

/**
 * Consent Routes
 */

// Get user consents (requires auth)
router.get('/consents', authenticate, getUserConsents);

// Get consent summary (requires auth)
router.get('/consents/summary', authenticate, getConsentSummary);

// Get consent proof for verification (requires auth)
router.get('/consents/proof', authenticate, getConsentProof);

// Update consent (requires auth)
router.post('/consents', authenticate, updateConsent);

// Bulk update consents (requires auth)
router.post('/consents/bulk', authenticate, bulkUpdateConsents);

/**
 * Data Export Routes
 */

// Request data export (requires auth)
router.post('/export', authenticate, requestDataExport);

// Get export progress (requires auth)
router.get('/export/:requestId/progress', authenticate, getExportProgress);

// Download export file (requires auth)
router.get('/export/:requestId/download', authenticate, downloadExport);

/**
 * Data Request Routes
 */

// Get all user data requests (requires auth)
router.get('/data-requests', authenticate, getUserDataRequests);

// Cancel a data request (requires auth)
router.delete('/data-requests/:requestId', authenticate, cancelDataRequest);

/**
 * Account Deletion Routes
 */

// Request account deletion (requires auth)
router.post('/delete', authenticate, requestAccountDeletion);

// Cancel account deletion (requires auth)
router.delete('/delete', authenticate, cancelAccountDeletion);

/**
 * Audit and Compliance Routes
 */

// Get user audit logs (requires auth)
router.get('/audit-logs', authenticate, getAuditLogs);

// Get compliance report (requires auth)
router.get('/compliance-report', authenticate, getComplianceReport);

/**
 * Admin Routes
 */

// Get GDPR statistics (requires admin)
router.get('/admin/stats', authenticate, getGdprStats);

// Get pending compliance deadlines (requires admin)
router.get('/admin/pending-deadlines', authenticate, getPendingDeadlines);

export default router;
