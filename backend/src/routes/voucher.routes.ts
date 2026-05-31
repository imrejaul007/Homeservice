import { Router } from 'express';
import voucherController from '../controllers/voucher.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

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

export default router;
