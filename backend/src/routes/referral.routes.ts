import { Router, Request, Response } from 'express';
import User from '../models/user.model';
import authMiddleware from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { REFERRAL_REWARDS } from '../config/constants';

const router = Router();

// ============================================
// GET My Referral Code
// ============================================

const getMyReferralCode = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Sanitize referral code: only allow alphanumeric, underscore, and hyphen
  const code = String(userDoc.loyaltySystem.referralCode).replace(/[^a-zA-Z0-9_-]/g, '');

  // Enforce CLIENT_URL in production to prevent hardcoded fallback leaking
  const clientUrl = process.env.CLIENT_URL;
  if (!clientUrl && process.env.NODE_ENV === 'production') {
    throw new Error('CLIENT_URL environment variable is required in production');
  }
  const referralBaseUrl = process.env.NODE_ENV === 'production' ? clientUrl : 'http://localhost:5173';

  return res.json({
    success: true,
    data: {
      referralCode: code,
      referralUrl: `${referralBaseUrl}/register/customer?ref=${encodeURIComponent(code)}`,
      referrerReward: REFERRAL_REWARDS.REFERRER_REWARD,
      refereeReward: REFERRAL_REWARDS.REFEREE_REWARD,
      terms: 'Share your code with friends. When they sign up and complete their first booking, you both earn reward coins!',
    },
  });
});

// ============================================
// GET Referral Statistics
// ============================================

const getReferralStats = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Find all users referred by this user
  const referredUsers = await User.find({
    'loyaltySystem.referredBy': user._id,
  }).select('firstName lastName createdAt loyaltySystem.pointsHistory');

  // Calculate total rewards earned from referrals
  const totalReferralRewards = userDoc.loyaltySystem.pointsHistory
    .filter(entry => entry.type === 'referral')
    .reduce((sum, entry) => sum + entry.amount, 0);

  // Count successful referrals (users who completed at least one booking)
  const successfulReferrals = referredUsers.filter(u => {
    return u.loyaltySystem.pointsHistory.some(entry => entry.type === 'referral');
  }).length;

  return res.json({
    success: true,
    data: {
      totalReferrals: referredUsers.length,
      successfulReferrals,
      pendingReferrals: referredUsers.length - successfulReferrals,
      totalRewardsEarned: totalReferralRewards,
      recentReferrals: referredUsers.slice(0, 5).map(u => ({
        name: `${u.firstName} ${u.lastName?.[0] || ''}.`,
        joinedAt: u.createdAt,
      })),
    },
  });
});

// ============================================
// GET Referral Rewards History
// ============================================

const getReferralRewards = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Get referral-related points history
  const referralHistory = userDoc.loyaltySystem.pointsHistory
    .filter(entry => entry.type === 'referral')
    .map(entry => ({
      amount: entry.amount,
      description: entry.description,
      date: entry.date,
      relatedBooking: entry.relatedBooking,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return res.json({
    success: true,
    data: {
      referralRewards: referralHistory,
      totalReferralRewards: referralHistory.reduce((sum, entry) => sum + entry.amount, 0),
    },
  });
});

// ============================================
// Routes
// ============================================

router.get('/my-code',
  authMiddleware.authenticate,
  getMyReferralCode
);

router.get('/stats',
  authMiddleware.authenticate,
  getReferralStats
);

router.get('/rewards',
  authMiddleware.authenticate,
  getReferralRewards
);

export default router;
