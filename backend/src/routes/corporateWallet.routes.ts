import { Router } from 'express';
import corporateWalletController from '../controllers/corporateWallet.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Get corporate wallet details
router.get('/wallet', corporateWalletController.getWallet);

// Get transaction history
router.get('/transactions', corporateWalletController.getTransactions);

// Get employee spending breakdown
router.get('/spending', corporateWalletController.getSpending);

// Get spending by category
router.get('/breakdown', corporateWalletController.getBreakdown);

// Request limit increase
router.post('/request-increase', corporateWalletController.requestIncrease);

export default router;
