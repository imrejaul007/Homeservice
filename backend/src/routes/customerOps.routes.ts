import express from 'express';
import {
  getCustomerList,
  getCustomerDetail,
  getCustomerBookings,
  searchCustomers,
  getUserAddresses,
  getUserPaymentMethods,
  getUserActivity,
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
  sendUserMessage,
  getUserMessages,
} from '../controllers/customerOps.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// All customer ops routes require admin authentication
router.use(authenticate);
router.use(requireRole('admin'));
router.use(adminLimiter);

// ========================================
// Customer List & Detail
// ========================================

router.get('/customers', getCustomerList);
router.get('/customers/search', searchCustomers);
router.get('/customers/stats', getDashboardStats);
router.get('/customers/:id', getCustomerDetail);
router.get('/customers/:id/bookings', getCustomerBookings);
router.get('/users/:id/addresses', getUserAddresses);
router.get('/users/:id/payment-methods', getUserPaymentMethods);
router.get('/users/:id/activity', getUserActivity);
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

// ========================================
// Admin User Messaging
// ========================================

router.get('/users/:id/messages', getUserMessages);
router.post('/users/:id/messages', sendUserMessage);

export default router;
