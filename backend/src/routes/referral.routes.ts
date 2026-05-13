import { Router, Request, Response } from 'express';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import authMiddleware from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

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

  return res.json({
    success: true,
    data: {
      referralCode: userDoc.loyaltySystem.referralCode,
      referralUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/register/customer?ref=${userDoc.loyaltySystem.referralCode}`,
      referrerReward: 500, // Coins awarded to referrer
      refereeReward: 250, // Coins awarded to new user
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
