import { Router } from 'express';
import cashbackController from '../controllers/cashback.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Get cashback balance
router.get('/balance', cashbackController.getBalance);

// Get cashback history with filters
router.get('/history', cashbackController.getHistory);

// Get expiring cashback alerts
router.get('/expiring', cashbackController.getExpiring);

// Get cashback statistics
router.get('/stats', cashbackController.getStats);

// Redeem cashback to wallet
router.post('/redeem', cashbackController.redeem);

export default router;
