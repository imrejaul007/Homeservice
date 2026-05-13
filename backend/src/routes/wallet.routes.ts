import { Router } from 'express';
import walletController from '../controllers/wallet.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Get wallet balance and summary
router.get('/wallet', walletController.getWallet);

// Get wallet transactions
router.get('/earnings/transactions', walletController.getTransactions);

// Get earnings summary
router.get('/earnings/summary', walletController.getEarningsSummary);

// Request withdrawal
router.post('/withdraw', walletController.requestWithdrawal);

export default router;
