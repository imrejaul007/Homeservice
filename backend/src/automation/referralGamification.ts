/**
 * Referral Gamification Automation
 *
 * Tracks referrals, awards badges, manages leaderboards:
 * - Referral tracking and attribution
 * - Achievement badge system
 * - Leaderboard rankings
 * - Reward milestones
 * - Viral coefficient calculation
 */

import mongoose, { Document, Schema } from 'mongoose';
import { randomBytes } from 'crypto';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import Coupon from '../models/coupon.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IReferralGamification extends Document {
  referrerId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  referralCode: string;
  status: 'pending' | 'completed' | 'rewarded' | 'expired';
  rewardType: 'discount' | 'credit' | 'free_service' | 'points';
  rewardValue: number;
  rewardSent: boolean;
  rewardSentAt?: Date;
  completedAt?: Date;
  metadata?: {
    referredUserFirstBooking?: mongoose.Types.ObjectId;
    referredUserFirstBookingValue?: number;
    referrerBonusAwarded?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IAchievementBadge extends Document {
  userId: mongoose.Types.ObjectId;
  badgeId: string;
  name: string;
  description: string;
  category: 'referral' | 'milestone' | 'engagement' | 'special';
  icon: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlockedAt: Date;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ILeaderboardEntry extends Document {
  userId: mongoose.Types.ObjectId;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  startDate: Date;
  endDate: Date;
  referralCount: number;
  totalRewardsEarned: number;
  rank: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReferralMilestone extends Document {
  userId: mongoose.Types.ObjectId;
  milestoneType: 'referrals' | 'successful_referrals' | 'total_rewards' | 'streak';
  threshold: number;
  currentValue: number;
  achieved: boolean;
  achievedAt?: Date;
  reward?: {
    type: 'discount' | 'credit' | 'points' | 'badge';
    value: number;
    description: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Schemas
const referralGamificationSchema = new Schema<IReferralGamification>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referralCode: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rewarded', 'expired'],
      default: 'pending',
      index: true,
    },
    rewardType: {
      type: String,
      enum: ['discount', 'credit', 'free_service', 'points'],
      default: 'discount',
    },
    rewardValue: { type: Number, default: 10 },
    rewardSent: { type: Boolean, default: false },
    rewardSentAt: Date,
    completedAt: Date,
    metadata: {
      referredUserFirstBooking: { type: Schema.Types.ObjectId, ref: 'Booking' },
      referredUserFirstBookingValue: Number,
      referrerBonusAwarded: Boolean,
    },
  },
  { timestamps: true }
);

// FIX: Add compound index for common query pattern (trackReferralConversion)
referralGamificationSchema.index({ referredUserId: 1, status: 1 });

const achievementBadgeSchema = new Schema<IAchievementBadge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    badgeId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['referral', 'milestone', 'engagement', 'special'],
      required: true,
    },
    icon: { type: String, required: true },
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'] },
    unlockedAt: { type: Date, default: Date.now },
    rarity: {
      type: String,
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

// Unique compound index to prevent duplicate badges (prevents race conditions)
achievementBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

const leaderboardEntrySchema = new Schema<ILeaderboardEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'all_time'],
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    referralCount: { type: Number, default: 0 },
    totalRewardsEarned: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const referralMilestoneSchema = new Schema<IReferralMilestone>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    milestoneType: {
      type: String,
      enum: ['referrals', 'successful_referrals', 'total_rewards', 'streak'],
      required: true,
    },
    threshold: { type: Number, required: true },
    currentValue: { type: Number, default: 0 },
    achieved: { type: Boolean, default: false },
    achievedAt: Date,
    reward: {
      type: {
        type: String,
        enum: ['discount', 'credit', 'points', 'badge'],
      },
      value: Number,
      description: String,
    },
  },
  { timestamps: true }
);

// Unique compound index to prevent duplicate milestones (prevents race conditions)
referralMilestoneSchema.index({ userId: 1, milestoneType: 1, threshold: 1 }, { unique: true });

// Models
const ReferralGamification = mongoose.model<IReferralGamification>('ReferralGamification', referralGamificationSchema);
const AchievementBadge = mongoose.model<IAchievementBadge>('AchievementBadge', achievementBadgeSchema);
const LeaderboardEntry = mongoose.model<ILeaderboardEntry>('LeaderboardEntry', leaderboardEntrySchema);
const ReferralMilestone = mongoose.model<IReferralMilestone>('ReferralMilestone', referralMilestoneSchema);

// Badge definitions
const BADGES = {
  first_referral: {
    id: 'first_referral',
    name: 'First Referral',
    description: 'Made your first successful referral',
    category: 'referral' as const,
    icon: '🎯',
    rarity: 'common' as const,
  },
  referral_champion_5: {
    id: 'referral_champion_5',
    name: 'Referral Champion',
    description: 'Referred 5 successful customers',
    category: 'referral' as const,
    icon: '🏆',
    tier: 'bronze' as const,
    rarity: 'uncommon' as const,
  },
  referral_master_10: {
    id: 'referral_master_10',
    name: 'Referral Master',
    description: 'Referred 10 successful customers',
    category: 'referral' as const,
    icon: '⭐',
    tier: 'silver' as const,
    rarity: 'rare' as const,
  },
  referral_legend_25: {
    id: 'referral_legend_25',
    name: 'Referral Legend',
    description: 'Referred 25 successful customers',
    category: 'referral' as const,
    icon: '💎',
    tier: 'gold' as const,
    rarity: 'epic' as const,
  },
  referral_royalty_50: {
    id: 'referral_royalty_50',
    name: 'Referral Royalty',
    description: 'Referred 50 successful customers',
    category: 'referral' as const,
    icon: '👑',
    tier: 'platinum' as const,
    rarity: 'legendary' as const,
  },
  early_adopter: {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined the referral program at launch',
    category: 'special' as const,
    icon: '🚀',
    rarity: 'rare' as const,
  },
  streak_starter: {
    id: 'streak_starter',
    name: 'Streak Starter',
    description: 'Maintained a 7-day referral streak',
    category: 'milestone' as const,
    icon: '🔥',
    rarity: 'uncommon' as const,
  },
};

// Milestone thresholds
const MILESTONE_THRESHOLDS = [
  { type: 'referrals' as const, threshold: 1, reward: { type: 'points' as const, value: 50, description: '50 bonus points' } },
  { type: 'referrals' as const, threshold: 5, reward: { type: 'discount' as const, value: 10, description: '10% discount coupon' } },
  { type: 'referrals' as const, threshold: 10, reward: { type: 'credit' as const, value: 50, description: 'AED 50 platform credit' } },
  { type: 'referrals' as const, threshold: 25, reward: { type: 'discount' as const, value: 20, description: '20% discount coupon' } },
  { type: 'referrals' as const, threshold: 50, reward: { type: 'points' as const, value: 500, description: '500 bonus points' } },
];

// Configuration
const CONFIG = {
  referralReward: {
    referrer: { type: 'discount' as const, value: 15, description: '15% off next booking' },
    referred: { type: 'discount' as const, value: 20, description: '20% off first booking' },
  },
  creditReward: {
    referrer: 25, // AED
    referred: 50, // AED
  },
  expiryDays: 30, // Referral code expires after 30 days
};

/**
 * Generate unique referral code using cryptographically secure random bytes.
 * Format: 8 alphanumeric characters (no user ID to prevent enumeration attacks).
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/**
 * Create referral record when user signs up with referral code
 */
export async function createReferralRecord(
  referrerId: mongoose.Types.ObjectId,
  referredUserId: mongoose.Types.ObjectId,
  referralCode: string
): Promise<IReferralGamification> {
  try {
    const referral = await ReferralGamification.create({
      referrerId,
      referredUserId,
      referralCode,
      status: 'pending',
      rewardType: CONFIG.referralReward.referrer.type,
      rewardValue: CONFIG.referralReward.referrer.value,
    });

    logger.info('Referral record created', {
      referrerId: referrerId.toString(),
      referredUserId: referredUserId.toString(),
      referralCode,
    });

    // Send welcome notification to referred user
    await addJob('notification-queue', 'send_notification', {
      userId: referredUserId.toString(),
      type: 'referral_signup',
      title: 'Welcome! You Were Referred',
      message: 'Thank you for signing up! Claim your referral reward on your first booking.',
      data: {
        referralId: referral._id.toString(),
        rewardValue: CONFIG.referralReward.referred.value,
      },
    });

    return referral;
  } catch (error) {
    logger.error('Failed to create referral record', {
      referrerId: referrerId.toString(),
      referredUserId: referredUserId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Track successful referral conversion
 */
export async function trackReferralConversion(
  referredUserId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    const referral = await ReferralGamification.findOne({
      referredUserId,
      status: 'pending',
    });

    if (!referral) {
      logger.debug('No pending referral found', { referredUserId: referredUserId.toString() });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    // Update referral status
    referral.status = 'completed';
    referral.completedAt = new Date();
    referral.metadata = {
      ...referral.metadata,
      referredUserFirstBooking: bookingId,
      referredUserFirstBookingValue: booking.pricing.totalAmount,
    };
    await referral.save();

    // Award rewards
    await awardReferralRewards(referral);

    // Check for badges
    await checkAndAwardBadges(referral.referrerId);

    // Update milestones
    await updateReferralMilestones(referral.referrerId);

    logger.info('Referral conversion tracked', {
      referralId: referral._id.toString(),
      bookingId: bookingId.toString(),
    });
  } catch (error) {
    logger.error('Failed to track referral conversion', {
      referredUserId: referredUserId.toString(),
      bookingId: bookingId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Award referral rewards to both parties
 */
async function awardReferralRewards(referral: IReferralGamification): Promise<void> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Award to referrer (use crypto for unpredictable codes)
    const referrerCouponCode = `REFER${randomBytes(8).toString('hex').toUpperCase()}`;
    await Coupon.create([{
      code: referrerCouponCode,
      type: CONFIG.referralReward.referrer.type,
      value: CONFIG.referralReward.referrer.value,
      maxDiscount: 100,
      minOrderValue: 0,
      maxUses: 1,
      maxUsesPerUser: 1,
      validFrom: new Date(),
      validUntil: expiresAt,
      isActive: true,
      targetType: 'specific_users',
      targetUsers: [referral.referrerId],
      title: 'Referral Reward',
      description: `Thank you for referring a friend! Get ${CONFIG.referralReward.referrer.value}% off your next booking.`,
      createdBy: referral.referrerId,
    }], { session });

    // Award to referred user
    const referredCouponCode = `WELCOME${randomBytes(8).toString('hex').toUpperCase()}`;
    await Coupon.create([{
      code: referredCouponCode,
      type: CONFIG.referralReward.referred.type,
      value: CONFIG.referralReward.referred.value,
      maxDiscount: 100,
      minOrderValue: 0,
      maxUses: 1,
      maxUsesPerUser: 1,
      validFrom: new Date(),
      validUntil: expiresAt,
      isActive: true,
      targetType: 'specific_users',
      targetUsers: [referral.referredUserId],
      title: 'Welcome Reward',
      description: `Welcome! Get ${CONFIG.referralReward.referred.value}% off your first booking.`,
      createdBy: referral.referredUserId,
    }], { session });

    // Update referral record
    referral.status = 'rewarded';
    referral.rewardSent = true;
    referral.rewardSentAt = new Date();
    referral.metadata = {
      ...referral.metadata,
      referrerBonusAwarded: true,
    };
    await referral.save({ session });

    // Commit transaction before sending notifications (non-critical)
    await session.commitTransaction();

    // Send notifications (non-critical, outside transaction)
    await addJob('notification-queue', 'send_notification', {
      userId: referral.referrerId.toString(),
      type: 'referral_reward',
      title: 'Referral Reward Earned!',
      message: `Congratulations! Your referral completed a booking. Claim your ${CONFIG.referralReward.referrer.value}% discount.`,
      data: { couponCode: referrerCouponCode },
    });

    await addJob('notification-queue', 'send_notification', {
      userId: referral.referredUserId.toString(),
      type: 'welcome_reward',
      title: 'Welcome Reward Unlocked!',
      message: `Use code ${referredCouponCode} for ${CONFIG.referralReward.referred.value}% off your first booking!`,
      data: { couponCode: referredCouponCode },
    });

    logger.info('Referral rewards awarded', {
      referralId: referral._id.toString(),
      referrerId: referral.referrerId.toString(),
      referredId: referral.referredUserId.toString(),
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to award referral rewards', {
      referralId: referral._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Check and award badges based on referral activity
 * Uses atomic findOneAndUpdate with upsert to prevent race conditions
 */
export async function checkAndAwardBadges(userId: mongoose.Types.ObjectId): Promise<IAchievementBadge[]> {
  const awardedBadges: IAchievementBadge[] = [];

  try {
    // Get referral count
    const referralCount = await ReferralGamification.countDocuments({
      referrerId: userId,
      status: { $in: ['completed', 'rewarded'] },
    });

    // Badge checks with atomic upsert operations
    const badgeChecks = [
      { condition: referralCount >= 1, badge: BADGES.first_referral, badgeId: 'first_referral' },
      { condition: referralCount >= 5, badge: BADGES.referral_champion_5, badgeId: 'referral_champion_5' },
      { condition: referralCount >= 10, badge: BADGES.referral_master_10, badgeId: 'referral_master_10' },
      { condition: referralCount >= 25, badge: BADGES.referral_legend_25, badgeId: 'referral_legend_25' },
      { condition: referralCount >= 50, badge: BADGES.referral_royalty_50, badgeId: 'referral_royalty_50' },
    ];

    for (const check of badgeChecks) {
      if (check.condition) {
        // Atomic upsert: only creates if badge doesn't exist, returns the doc (new or existing)
        // Use rawResult to detect if document was upserted
        const result = await AchievementBadge.findOneAndUpdate(
          { userId, badgeId: check.badgeId },
          {
            $setOnInsert: {
              userId,
              ...check.badge,
              unlockedAt: new Date(),
            },
          },
          { upsert: true, new: true, rawResult: true }
        ) as unknown as { lastErrorObject?: { upserted?: string }; value?: IAchievementBadge };

        // If result is new (upserted), it was created now
        if (result.lastErrorObject?.upserted) {
          awardedBadges.push(result.value as IAchievementBadge);
          await sendBadgeNotification(userId, check.badge);
        }
      }
    }

    logger.info('Badge check completed', {
      userId: userId.toString(),
      badgesAwarded: awardedBadges.length,
    });

    return awardedBadges;
  } catch (error) {
    logger.error('Failed to check/award badges', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send badge notification
 */
async function sendBadgeNotification(
  userId: mongoose.Types.ObjectId,
  badge: { name: string; description: string; icon: string }
): Promise<void> {
  await addJob('notification-queue', 'send_notification', {
    userId: userId.toString(),
    type: 'achievement_unlocked',
    title: `Badge Unlocked: ${badge.name}`,
    message: `${badge.icon} ${badge.description}`,
    data: { badgeName: badge.name },
  });
}

/**
 * Update referral milestones
 * Uses atomic findOneAndUpdate with upsert to prevent race conditions
 */
export async function updateReferralMilestones(userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    const referralCount = await ReferralGamification.countDocuments({
      referrerId: userId,
      status: { $in: ['completed', 'rewarded'] },
    });

    for (const milestone of MILESTONE_THRESHOLDS) {
      if (referralCount >= milestone.threshold) {
        // Atomic upsert: only creates milestone if it doesn't exist
        const result = await ReferralMilestone.findOneAndUpdate(
          {
            userId,
            milestoneType: milestone.type,
            threshold: milestone.threshold,
          },
          {
            $setOnInsert: {
              userId,
              milestoneType: milestone.type,
              threshold: milestone.threshold,
              currentValue: referralCount,
              achieved: true,
              achievedAt: new Date(),
              reward: milestone.reward,
            },
          },
          { upsert: true, new: true, rawResult: true }
        ) as unknown as { lastErrorObject?: { upserted?: string } };

        // If milestone was newly created (upserted), award rewards and notify
        if (result.lastErrorObject?.upserted) {
          // Award milestone reward
          if (milestone.reward.type === 'points') {
            await addJob('loyalty-queue', 'award_milestone_bonus', {
              userId: userId.toString(),
              bonusPoints: milestone.reward.value,
              description: milestone.reward.description,
            });
          }

          await addJob('notification-queue', 'send_notification', {
            userId: userId.toString(),
            type: 'milestone_achieved',
            title: 'Referral Milestone Reached!',
            message: milestone.reward.description,
            data: { threshold: milestone.threshold },
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to update referral milestones', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get leaderboard for a specific period
 */
export async function getLeaderboard(
  period: 'daily' | 'weekly' | 'monthly' | 'all_time',
  limit = 10
): Promise<Array<{
  rank: number;
  userId: string;
  userName: string;
  referralCount: number;
  totalRewardsEarned: number;
  score: number;
}>> {
  try {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'all_time':
        startDate = new Date(0);
        break;
    }

    const leaderboard = await ReferralGamification.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'rewarded'] },
        },
      },
      {
        $group: {
          _id: '$referrerId',
          referralCount: { $sum: 1 },
          totalRewardsEarned: { $sum: '$rewardValue' },
        },
      },
      {
        $addFields: {
          score: { $add: ['$referralCount', { $multiply: ['$totalRewardsEarned', 0.1] }] },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          referralCount: 1,
          totalRewardsEarned: 1,
          score: 1,
          userName: { $concat: ['$user.firstName', ' ', { $substr: ['$user.lastName', 0, 1] }, '.'] },
        },
      },
    ]);

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry._id.toString(),
      userName: entry.userName,
      referralCount: entry.referralCount,
      totalRewardsEarned: entry.totalRewardsEarned,
      score: Math.round(entry.score),
    }));
  } catch (error) {
    logger.error('Failed to get leaderboard', {
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get user's referral statistics
 */
export async function getUserReferralStats(userId: mongoose.Types.ObjectId): Promise<{
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
  badges: Array<{ badgeId: string; name: string; icon: string; rarity: string; unlockedAt: Date }>;
  milestones: Array<{ threshold: number; achieved: boolean; achievedAt?: Date }>;
  currentStreak: number;
  bestStreak: number;
}> {
  const [referrals, badges, milestones] = await Promise.all([
    ReferralGamification.aggregate([
      { $match: { referrerId: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRewardValue: { $sum: '$rewardValue' },
        },
      },
    ]),
    AchievementBadge.find({ userId, category: 'referral' }).sort({ unlockedAt: -1 }),
    ReferralMilestone.find({ userId }).sort({ threshold: 1 }),
  ]);

  const stats = {
    totalReferrals: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
    totalRewardsEarned: 0,
  };

  for (const r of referrals) {
    stats.totalReferrals += r.count;
    if (r._id === 'completed' || r._id === 'rewarded') {
      stats.successfulReferrals += r.count;
    }
    if (r._id === 'pending') {
      stats.pendingReferrals += r.count;
    }
    stats.totalRewardsEarned += r.totalRewardValue || 0;
  }

  return {
    ...stats,
    badges: badges.map(b => ({
      badgeId: b.badgeId,
      name: b.name,
      icon: b.icon,
      rarity: b.rarity,
      unlockedAt: b.unlockedAt,
    })),
    milestones: milestones.map(m => ({
      threshold: m.threshold,
      achieved: m.achieved,
      achievedAt: m.achievedAt,
    })),
    currentStreak: 0, // Would require daily tracking
    bestStreak: 0,
  };
}

/**
 * Calculate viral coefficient
 */
export async function calculateViralCoefficient(): Promise<{
  coefficient: number;
  referralsThisMonth: number;
  newUsersThisMonth: number;
  isViral: boolean;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [referralsThisMonth, newUsersThisMonth] = await Promise.all([
    ReferralGamification.countDocuments({
      createdAt: { $gte: startOfMonth },
      status: { $in: ['completed', 'rewarded'] },
    }),
    User.countDocuments({
      createdAt: { $gte: startOfMonth },
      role: 'customer',
    }),
  ]);

  const coefficient = newUsersThisMonth > 0 ? referralsThisMonth / newUsersThisMonth : 0;

  return {
    coefficient: Math.round(coefficient * 100) / 100,
    referralsThisMonth,
    newUsersThisMonth,
    isViral: coefficient >= 1,
  };
}

/**
 * Get referral gamification statistics
 */
export async function getReferralGamificationStats(): Promise<{
  totalReferrals: number;
  activeReferrers: number;
  totalRewardsDistributed: number;
  averageRewardsPerReferral: number;
  topReferrer: { userId: string; referralCount: number } | null;
  viralCoefficient: number;
  badgesAwarded: number;
  milestonesAchieved: number;
}> {
  const [stats, topReferrerAgg] = await Promise.all([
    ReferralGamification.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          activeReferrers: { $addToSet: '$referrerId' },
          totalRewards: { $sum: '$rewardValue' },
        },
      },
      {
        $project: {
          totalReferrals: 1,
          activeReferrers: { $size: '$activeReferrers' },
          totalRewards: 1,
          averageRewards: { $cond: [{ $gt: ['$totalReferrals', 0] }, { $divide: ['$totalRewards', '$totalReferrals'] }, 0] },
        },
      },
    ]),
    ReferralGamification.aggregate([
      { $match: { status: { $in: ['completed', 'rewarded'] } } },
      { $group: { _id: '$referrerId', referralCount: { $sum: 1 } } },
      { $sort: { referralCount: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const [badgesAwarded, milestonesAchieved] = await Promise.all([
    AchievementBadge.countDocuments(),
    ReferralMilestone.countDocuments({ achieved: true }),
  ]);

  const s = stats[0] || { totalReferrals: 0, activeReferrers: 0, totalRewards: 0, averageRewards: 0 };

  return {
    totalReferrals: s.totalReferrals,
    activeReferrers: s.activeReferrers,
    totalRewardsDistributed: s.totalRewards,
    averageRewardsPerReferral: Math.round(s.averageRewards),
    topReferrer: topReferrerAgg[0]
      ? { userId: topReferrerAgg[0]._id.toString(), referralCount: topReferrerAgg[0].referralCount }
      : null,
    viralCoefficient: 0,
    badgesAwarded,
    milestonesAchieved,
  };
}

export default {
  createReferralRecord,
  trackReferralConversion,
  checkAndAwardBadges,
  updateReferralMilestones,
  getLeaderboard,
  getUserReferralStats,
  calculateViralCoefficient,
  getReferralGamificationStats,
  ReferralGamification,
  AchievementBadge,
  LeaderboardEntry,
  ReferralMilestone,
};
