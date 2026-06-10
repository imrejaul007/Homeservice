import { Router } from 'express';
import walletController from '../controllers/wallet.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';

const router = Router();

// Withdrawal validation schema
const withdrawalSchema = Joi.object({
  amount: Joi.number()
    .positive()
    .min(1)
    .required()
    .messages({
      'number.positive': 'Withdrawal amount must be positive',
      'number.min': 'Minimum withdrawal amount is AED 1',
      'any.required': 'Withdrawal amount is required'
    }),
  bankAccount: Joi.object({
    bankName: Joi.string()
      .required()
      .min(2)
      .max(100)
      .messages({
        'string.min': 'Bank name must be at least 2 characters',
        'any.required': 'Bank name is required'
      }),
    accountNumber: Joi.string()
      .required()
      .min(4)
      .max(34)  // IBAN can be up to 34 chars
      .messages({
        'string.min': 'Account number must be at least 4 characters',
        'any.required': 'Account number is required'
      }),
    iban: Joi.string()
      .required()
      .pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/)  // Standard IBAN format
      .messages({
        'string.pattern.base': 'IBAN must be in valid format (e.g., AE123456789012345678)',
        'any.required': 'IBAN is required'
      }),
    accountHolder: Joi.string()
      .required()
      .min(2)
      .max(200)
      .messages({
        'string.min': 'Account holder name must be at least 2 characters',
        'any.required': 'Account holder name is required'
      }),
  }).required().messages({
    'any.required': 'Bank account details are required'
  }),
});

// Maximum withdrawal amount limit (AED 50,000)
const MAX_WITHDRAWAL_AMOUNT = 50000;

// Validation middleware for withdrawal
const validateWithdrawal = (req: any, res: any, next: any) => {
  const { error, value } = withdrawalSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Additional check for maximum withdrawal amount
  if (value.amount > MAX_WITHDRAWAL_AMOUNT) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: [{
        field: 'amount',
        message: `Withdrawal amount exceeds maximum limit of AED ${MAX_WITHDRAWAL_AMOUNT}`
      }]
    });
  }

  next();
};

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
// Added validation for amount limits and bank account format
router.post(
  '/withdraw',
  authMiddleware.requireRole(['provider', 'admin']),
  authMiddleware.require2FAForProviderWithdrawal,
  validateWithdrawal,
  walletController.requestWithdrawal
);

// Create payment intent for wallet top-up
router.post('/add-money/intent', walletController.createTopUpIntent);

// Add money to wallet (requires verified payment)
router.post('/add-money', walletController.addMoney);

// Deduct credits from wallet
router.post('/deduct', walletController.deductCredits);

export default router;
