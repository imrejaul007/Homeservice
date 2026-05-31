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

// Request withdrawal - SECURITY FIX: Only providers and admins can withdraw
// Also requires 2FA verification for provider withdrawals
router.post(
  '/withdraw',
  authMiddleware.requireRole(['provider', 'admin']),
  authMiddleware.require2FAForProviderWithdrawal,
  walletController.requestWithdrawal
);

// Add money to wallet
router.post('/add-money', walletController.addMoney);

export default router;
