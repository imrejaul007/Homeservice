import { Request, Response } from 'express';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { creditWallet } from '../services/wallet.service';
import { getStreak } from '../services/streak.service';

// ============================================
// Helper Functions
// ============================================

const MAX_HISTORY = 100;
const POINTS_EXPIRY_MONTHS = 24;

/**
 * Truncate points history to prevent unbounded growth.
 * Called after every pointsHistory.push() operation.
 */
function truncatePointsHistory(loyaltySystem: any): void {
  if (loyaltySystem.pointsHistory && loyaltySystem.pointsHistory.length > MAX_HISTORY) {
    loyaltySystem.pointsHistory = loyaltySystem.pointsHistory.slice(-MAX_HISTORY);
  }
}

/**
 * Expire old points - callable by a scheduler (e.g., cron job).
 * This function removes expired points from user balances.
 */
export const expireOldPoints = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();

  // Find all users with expired points
  const usersWithExpiredPoints = await User.find({
    'loyaltySystem.pointsHistory': {
      $elemMatch: {
        expiresAt: { $lt: now },
        amount: { $gt: 0 } // Only expire positive entries (earned, not spent)
      }
    }
  });

  let totalExpiredPoints = 0;
  let usersProcessed = 0;

  for (const user of usersWithExpiredPoints) {
    const expiredEntries = user.loyaltySystem.pointsHistory.filter(
      (entry: any) => entry.expiresAt && entry.expiresAt < now && entry.amount > 0
    );

    if (expiredEntries.length > 0) {
      const expiredAmount = expiredEntries.reduce((sum: number, entry: any) => sum + entry.amount, 0);

      // Deduct expired points from balance
      user.loyaltySystem.coins = Math.max(0, user.loyaltySystem.coins - expiredAmount);

      // Add expiry record to history
      user.loyaltySystem.pointsHistory.push({
        amount: -expiredAmount,
        type: 'spent',
        description: `Points expired after ${POINTS_EXPIRY_MONTHS} months`,
        date: new Date(),
      });

      // Truncate if needed
      truncatePointsHistory(user.loyaltySystem);

      await user.save();
      totalExpiredPoints += expiredAmount;
      usersProcessed++;
    }
  }

  res.json({
    success: true,
    message: `Expired points cleanup completed`,
    data: {
      usersProcessed,
      totalExpiredPoints,
    },
  });
});

// ============================================
// Get Loyalty Status
// ============================================

export const getLoyaltyStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Calculate tier thresholds
  const tierThresholds = {
    bronze: { min: 0, max: 999 },
    silver: { min: 1000, max: 4999 },
    gold: { min: 5000, max: 9999 },
    platinum: { min: 10000, max: Infinity },
  };

  const currentTier = userDoc.loyaltySystem?.tier || 'bronze';
  const totalEarned = userDoc.loyaltySystem?.totalEarned || 0;
  const currentCoins = userDoc.loyaltySystem?.coins || 0;
  const nextTier = currentTier === 'bronze' ? 'silver'
    : currentTier === 'silver' ? 'gold'
    : currentTier === 'gold' ? 'platinum' : null;

  const currentThreshold = tierThresholds[currentTier as keyof typeof tierThresholds];
  const nextThreshold = nextTier ? tierThresholds[nextTier as keyof typeof tierThresholds] : null;

  const progressToNext = nextThreshold
    ? Math.round(((totalEarned - currentThreshold.min) / (nextThreshold.min - currentThreshold.min)) * 100)
    : 100;

  const streakData = await getStreak(user._id.toString());
  const pointsToNextTier = nextTier && nextThreshold
    ? Math.max(0, nextThreshold.min - totalEarned)
    : 0;

  // Tier benefits
  const tierBenefits = {
    bronze: ['Earn 1 point per AED 10 spent', 'Birthday bonus points', 'Access to member-only offers'],
    silver: ['Earn 1.5 points per AED 10 spent', 'Priority customer support', 'Early access to sales', '10% off on your birthday'],
    gold: ['Earn 2 points per AED 10 spent', 'Premium customer support', 'Exclusive Gold-only events', '15% off on your birthday', 'Free delivery on all bookings'],
    platinum: ['Earn 3 points per AED 10 spent', 'VIP concierge support', 'Platinum-exclusive experiences', '20% off on your birthday', 'Free premium services', 'Guaranteed availability'],
  };

  // Calculate tier progress
  const calculateTierProgress = (earned: number, tier: string) => {
    const thresholds: Record<string, { min: number; max: number }> = {
      bronze: { min: 0, max: 999 },
      silver: { min: 1000, max: 4999 },
      gold: { min: 5000, max: 9999 },
      platinum: { min: 10000, max: Infinity },
    };
    const current = thresholds[tier];
    const nextTierNames: Record<string, string | null> = {
      bronze: 'silver',
      silver: 'gold',
      gold: 'platinum',
      platinum: null,
    };
    const next = nextTierNames[tier];

    if (!next) {
      return { currentTierPoints: earned, nextTierRequirement: 0, nextTier: null, percentage: 100 };
    }

    const nextThresholdVal = thresholds[next];
    const progress = Math.round(((earned - current.min) / (nextThresholdVal.min - current.min)) * 100);

    return {
      currentTierPoints: earned,
      nextTierRequirement: nextThresholdVal.min,
      nextTier: next,
      percentage: Math.min(100, Math.max(0, progress)),
    };
  };

  res.json({
    success: true,
    data: {
      coins: currentCoins,
      totalEarned,
      totalSpent: userDoc.loyaltySystem?.totalSpent || 0,
      tier: currentTier,
      streakDays: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      lastCheckIn: streakData.lastCheckIn,
      totalCheckIns: streakData.totalCheckIns,
      nextTier,
      progressToNext: Math.min(100, Math.max(0, progressToNext)),
      pointsToNextTier,
      benefits: tierBenefits[currentTier as keyof typeof tierBenefits] || [],
      referralCode: userDoc.loyaltySystem?.referralCode,
      tierProgress: calculateTierProgress(totalEarned, currentTier),
    },
  });
});

// ============================================
// Get Points History
// ============================================

export const getPointsHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { page = 1, limit = 20, type } = req.query;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Get points history from user document
  let pointsHistory = userDoc.loyaltySystem?.pointsHistory || [];

  // Filter by type if specified
  if (type && typeof type === 'string') {
    pointsHistory = pointsHistory.filter((entry: any) => entry.type === type);
  }

  // Sort by date descending
  pointsHistory = pointsHistory.sort((a: any, b: any) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;

  const paginatedHistory = pointsHistory.slice(startIndex, endIndex);

  // Group by month for summary
  const monthlySummary: { [key: string]: { earned: number; spent: number } } = {};
  pointsHistory.forEach((entry: any) => {
    const month = new Date(entry.date).toISOString().slice(0, 7); // YYYY-MM
    if (!monthlySummary[month]) {
      monthlySummary[month] = { earned: 0, spent: 0 };
    }
    if (entry.amount > 0) {
      monthlySummary[month].earned += entry.amount;
    } else {
      monthlySummary[month].spent += Math.abs(entry.amount);
    }
  });

  res.json({
    success: true,
    data: {
      history: paginatedHistory,
      total: pointsHistory.length,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(pointsHistory.length / limitNum),
      monthlySummary,
    },
  });
});

// ============================================
// Get Tier Benefits
// ============================================

export const getTierBenefits = asyncHandler(async (_req: Request, res: Response) => {
  const benefits = {
    bronze: {
      name: 'Bronze',
      minPoints: 0,
      pointsMultiplier: 1,
      benefits: [
        'Earn 1 point per AED 10 spent',
        'Birthday bonus points',
        'Access to member-only offers',
        'Redeem points for discounts',
      ],
      perks: ['Basic support', 'Standard booking priority'],
    },
    silver: {
      name: 'Silver',
      minPoints: 1000,
      pointsMultiplier: 1.5,
      benefits: [
        'Earn 1.5 points per AED 10 spent',
        'Priority customer support',
        'Early access to sales and events',
        '10% off on your birthday',
        'Silver-exclusive promotions',
      ],
      perks: ['Priority support', 'Priority booking', 'Birthday reward'],
    },
    gold: {
      name: 'Gold',
      minPoints: 5000,
      pointsMultiplier: 2,
      benefits: [
        'Earn 2 points per AED 10 spent',
        'Premium customer support',
        'Exclusive Gold-only events',
        '15% off on your birthday',
        'Free delivery on all bookings',
        'Gold-exclusive promotions',
      ],
      perks: ['Premium support', 'Priority booking', 'Birthday reward', 'Free delivery'],
    },
    platinum: {
      name: 'Platinum',
      minPoints: 10000,
      pointsMultiplier: 3,
      benefits: [
        'Earn 3 points per AED 10 spent',
        'VIP concierge support',
        'Platinum-exclusive experiences',
        '20% off on your birthday',
        'Free premium services upgrade',
        'Guaranteed availability',
        'Platinum-exclusive promotions',
      ],
      perks: ['VIP concierge', 'Guaranteed booking', 'Birthday reward', 'Free upgrades', 'VIP events'],
    },
  };

  res.json({
    success: true,
    data: benefits,
  });
});

// ============================================
// Redeem Points
// ============================================

export const redeemPoints = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { points, couponCode } = req.body;

  // Validate redemption amount
  if (!points || typeof points !== 'number' || points <= 0) {
    throw new ApiError(400, 'Invalid points amount. Must be a positive number.');
  }

  // Check if points is a reasonable integer
  if (!Number.isInteger(points)) {
    throw new ApiError(400, 'Points must be a whole number.');
  }

  // Fetch user document
  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Initialize loyalty system if it doesn't exist
  if (!userDoc.loyaltySystem) {
    userDoc.loyaltySystem = {
      coins: 0,
      tier: 'bronze',
      referralCode: '',
      streakDays: 0,
      longestStreak: 0,
      totalEarned: 0,
      totalSpent: 0,
      pointsHistory: [],
      processedJobIds: [],
      firstBookingAwarded: false,
      pendingRewards: [],
    };
  }

  // FIX: Use atomic update with balance check to prevent race conditions
  const pointsConversionRate = 100;
  const aedValue = Math.round(points / pointsConversionRate * 100) / 100;
  const pointsHistoryEntry = {
    amount: -points,
    type: 'spent' as const,
    description: `Redeemed ${points} coins for AED ${aedValue.toFixed(2)} wallet credit`,
    date: new Date(),
  };

  // FIX: Wrap entire redemption in a transaction for full atomicity
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  let walletResult: any = null;

  try {
    session.startTransaction();

    // Atomic update: deduct points only if balance >= points (prevents race condition)
    // This is now part of the transaction
    const updateResult = await User.updateOne(
      {
        _id: user._id,
        'loyaltySystem.coins': { $gte: points }
      },
      {
        $inc: {
          'loyaltySystem.coins': -points,
          'loyaltySystem.totalSpent': points
        },
        $push: { 'loyaltySystem.pointsHistory': pointsHistoryEntry }
      },
      { session }
    );

    if (updateResult.matchedCount === 0) {
      // Either user doesn't exist or insufficient balance - abort transaction
      await session.abortTransaction();
      const currentUser = await User.findById(user._id).select('loyaltySystem.coins');
      const currentBalance = currentUser?.loyaltySystem?.coins || 0;
      throw new ApiError(400, `Insufficient points. You have ${currentBalance} points but tried to redeem ${points} points.`);
    }

    // Truncate history within transaction
    truncatePointsHistory((await User.findById(user._id).session(session))!.loyaltySystem);

    // Credit wallet with session for transactional safety
    walletResult = await creditWallet({
      userId: user._id.toString(),
      type: 'credit',
      amount: aedValue,
      description: `Coins redemption (${points.toLocaleString()} coins)`,
      reference: `coins-redeem-${Date.now()}`,
      referenceType: 'bonus',
      metadata: { pointsRedeemed: points, conversionRate: pointsConversionRate },
    }, req, undefined, session);

    await session.commitTransaction();
  } catch (walletError) {
    // Abort any partial transaction
    await session.abortTransaction().catch(() => {});
    throw walletError;
  } finally {
    session.endSession();
  }

  const updatedUser = await User.findById(user._id);
  const newBalance = updatedUser?.loyaltySystem.coins || 0;

  res.json({
    success: true,
    message: `${points} coins redeemed for AED ${aedValue.toFixed(2)} wallet credit`,
    data: {
      pointsRedeemed: points,
      newBalance,
      aedCredited: aedValue,
      walletSuccess: walletResult.success,
      newWalletBalance: walletResult.newBalance,
      tier: userDoc.loyaltySystem.tier,
    },
  });
});

// ============================================
// Export
// ============================================

export default {
  getLoyaltyStatus,
  getPointsHistory,
  getTierBenefits,
  redeemPoints,
  expireOldPoints,
};
