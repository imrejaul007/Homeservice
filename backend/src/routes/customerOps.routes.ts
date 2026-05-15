import express from 'express';
import {
  getCustomerList,
  getCustomerDetail,
  getTrustScoreBreakdown,
  refreshTrustScore,
  addAbuseFlag,
  resolveAbuseFlag,
  blockCustomer,
  unblockCustomer,
  adjustTier,
  runAbuseScan,
  getDashboardStats,
  syncCustomerMetrics,
  initializeAllMetrics,
} from '../controllers/customerOps.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = express.Router();

// All customer ops routes require admin authentication
router.use(authenticate);
router.use(requireRole('admin'));

// ========================================
// Customer List & Detail
// ========================================

router.get('/customers', getCustomerList);
router.get('/customers/stats', getDashboardStats);
router.get('/customers/:id', getCustomerDetail);
router.post('/customers/:id/sync-metrics', syncCustomerMetrics);

// ========================================
// Trust Score
// ========================================

router.get('/customers/:id/trust-score', getTrustScoreBreakdown);
router.post('/customers/:id/refresh-trust-score', refreshTrustScore);

// ========================================
// Abuse Flags
// ========================================

router.post('/customers/:id/flags', addAbuseFlag);
router.patch('/customers/:id/flags/:flagIndex/resolve', resolveAbuseFlag);

// ========================================
// Blocking/Unblocking
// ========================================

router.post('/customers/:id/block', blockCustomer);
router.post('/customers/:id/unblock', unblockCustomer);

// ========================================
// Tier Management
// ========================================

router.patch('/customers/:id/tier', adjustTier);

// ========================================
// Abuse Scan
// ========================================

router.post('/customers/:id/abuse-scan', runAbuseScan);

// ========================================
// Admin Actions
// ========================================

router.post('/customers/initialize-metrics', initializeAllMetrics);

export default router;
