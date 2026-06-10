import { Router } from 'express';
import voucherController from '../controllers/voucher.controller';
import voucherAdminController from '../controllers/voucher.admin.controller';
import authMiddleware from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// ============================================
// USER ROUTES
// ============================================

// Validate voucher code
router.post('/validate', voucherController.validate);

// Apply voucher to booking
router.post('/apply', voucherController.apply);

// Get available vouchers
router.get('/available', voucherController.listAvailable);

// Get voucher usage history
router.get('/history', voucherController.history);

// Get expiring voucher alerts
router.get('/expiring', voucherController.expiring);

// ============================================
// ADMIN ROUTES
// ============================================

// Apply admin middleware and rate limiting
router.use('/admin', authMiddleware.requireRole('admin'));
router.use('/admin', adminLimiter);

// List all vouchers (admin)
router.get('/admin/all', voucherAdminController.listAll);

// Get voucher by ID (admin)
router.get('/admin/:id', voucherAdminController.getById);

// Create voucher (admin)
router.post('/admin', voucherAdminController.create);

// Update voucher (admin)
router.put('/admin/:id', voucherAdminController.update);

// Delete voucher (admin)
router.delete('/admin/:id', voucherAdminController.delete);

// Get voucher stats (admin)
router.get('/admin/stats', voucherAdminController.getStats);

export default router;
