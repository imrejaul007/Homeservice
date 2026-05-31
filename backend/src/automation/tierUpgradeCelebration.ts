/**
 * Tier Upgrade Celebration Automation
 *
 * Celebrates loyalty tier upgrades:
 * - Tier upgrade detection
 * - Special offer generation
 * - Badge award
 * - Celebration email/push notification
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import Coupon from '../models/coupon.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface ITierUpgrade extends Document {
  userId: mongoose.Types.ObjectId;
  previousTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  newTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  triggerType: 'points_threshold' | 'manual' | 'admin_action';
  triggerValue?: number;
  celebrationStatus: 'pending' | 'sent' | 'completed' | 'failed';
  badgeAwarded: boolean;
  badgeAwardedAt?: Date;
  offer?: {
    couponCode: string;
    discountValue: number;
    expiresAt: Date;
    usedAt?: Date;
  };
  notificationSent: boolean;
  notificationSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tierUpgradeSchema = new Schema<ITierUpgrade>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    previousTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      required: true,
    },
    newTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      required: true,
    },
    triggerType: {
      type: String,
      enum: ['points_threshold', 'manual', 'admin_action'],
      required: true,
    },
    triggerValue: Number,
    celebrationStatus: {
      type: String,
      enum: ['pending', 'sent', 'completed', 'failed'],
      default: 'pending',
    },
    badgeAwarded: {
      type: Boolean,
      default: false,
    },
    badgeAwardedAt: Date,
    offer: {
      couponCode: String,
      discountValue: Number,
      expiresAt: Date,
      usedAt: Date,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    notificationSentAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
tierUpgradeSchema.index({ celebrationStatus: 1, createdAt: -1 });
tierUpgradeSchema.index({ userId: 1, newTier: 1 });

const TierUpgrade = mongoose.model<ITierUpgrade>('TierUpgrade', tierUpgradeSchema);

// Tier hierarchy
const TIER_HIERARCHY = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

// Tier upgrade rewards
const TIER_REWARDS = {
  silver: {
    bonusPoints: 100,
    discountValue: 10,
    badge: 'Silver Member',
  },
  gold: {
    bonusPoints: 250,
    discountValue: 15,
    badge: 'Gold Member',
  },
  platinum: {
    bonusPoints: 500,
    discountValue: 25,
    badge: 'Platinum Member',
  },
};

// Tier thresholds (coins required)
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 10000,
};

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Check for tier upgrades and trigger celebrations
 * Called when user earns points or by daily job
 */
export async function checkTierUpgrades(userId: mongoose.Types.ObjectId): Promise<ITierUpgrade | null> {
  try {
    const user = await User.findById(userId).select(
      'firstName email loyaltySystem.totalEarned loyaltySystem.tier communicationPreferences'
    );

    if (!user) {
      logger.error('checkTierUpgrades: User not found', { userId: userId.toString() });
      return null;
    }

    const currentTier = user.loyaltySystem.tier as Tier;
    const totalEarned = user.loyaltySystem.totalEarned;

    // Determine what tier the user should be at based on points
    let newTier: Tier = 'bronze';
    if (totalEarned >= TIER_THRESHOLDS.platinum) {
      newTier = 'platinum';
    } else if (totalEarned >= TIER_THRESHOLDS.gold) {
      newTier = 'gold';
    } else if (totalEarned >= TIER_THRESHOLDS.silver) {
      newTier = 'silver';
    }

    // Check if upgrade is needed
    if (TIER_HIERARCHY[newTier] <= TIER_HIERARCHY[currentTier]) {
      logger.debug('checkTierUpgrades: No upgrade needed', {
        userId: userId.toString(),
        currentTier,
        newTier,
        totalEarned,
      });
      return null;
    }

    // Check if upgrade was already celebrated recently
    const existingUpgrade = await TierUpgrade.findOne({
      userId,
      newTier,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (existingUpgrade) {
      logger.debug('checkTierUpgrades: Upgrade already celebrated', {
        userId: userId.toString(),
        newTier,
      });
      return existingUpgrade;
    }

    // Perform the upgrade
    const upgrade = await celebrateTierUpgrade(userId, currentTier, newTier, 'points_threshold', totalEarned);

    // Update user's tier
    await User.updateOne(
      { _id: userId },
      { 'loyaltySystem.tier': newTier }
    );

    logger.info('checkTierUpgrades: Tier upgrade celebrated', {
      userId: userId.toString(),
      previousTier: currentTier,
      newTier,
      totalEarned,
    });

    return upgrade;
  } catch (error) {
    logger.error('checkTierUpgrades: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Manually trigger tier upgrade celebration (admin action)
 */
export async function manualTierUpgrade(
  userId: mongoose.Types.ObjectId,
  newTier: Tier,
  reason?: string
): Promise<ITierUpgrade> {
  try {
    const user = await User.findById(userId).select('loyaltySystem.tier');
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const previousTier = user.loyaltySystem.tier as Tier;

    if (TIER_HIERARCHY[newTier] <= TIER_HIERARCHY[previousTier]) {
      throw new Error(`Cannot downgrade from ${previousTier} to ${newTier}`);
    }

    const upgrade = await celebrateTierUpgrade(userId, previousTier, newTier, 'admin_action');

    await User.updateOne(
      { _id: userId },
      { 'loyaltySystem.tier': newTier }
    );

    logger.info('manualTierUpgrade: Manual upgrade performed', {
      userId: userId.toString(),
      previousTier,
      newTier,
      reason,
    });

    return upgrade;
  } catch (error) {
    logger.error('manualTierUpgrade: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Celebrate a tier upgrade
 */
async function celebrateTierUpgrade(
  userId: mongoose.Types.ObjectId,
  previousTier: Tier,
  newTier: Tier,
  triggerType: 'points_threshold' | 'manual' | 'admin_action',
  triggerValue?: number
): Promise<ITierUpgrade> {
  let upgrade: ITierUpgrade | null = null;
  try {
    const user = await User.findById(userId).select(
      'firstName email communicationPreferences'
    );
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const rewards = TIER_REWARDS[newTier as keyof typeof TIER_REWARDS];

    // Create upgrade record
    upgrade = await TierUpgrade.create({
      userId,
      previousTier,
      newTier,
      triggerType,
      triggerValue,
      celebrationStatus: 'pending',
    });

    // Award bonus points
    await addJob('loyalty-queue', 'award_tier_bonus', {
      userId: userId.toString(),
      bonusPoints: rewards.bonusPoints,
      description: `${newTier.charAt(0).toUpperCase() + newTier.slice(1)} tier upgrade bonus`,
    });

    // Create special offer coupon
    const couponCode = `${newTier.toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    await Coupon.create({
      code: couponCode,
      type: 'percentage',
      value: rewards.discountValue,
      maxDiscount: 50,
      minOrderValue: 0,
      maxUses: 1,
      maxUsesPerUser: 1,
      validFrom: new Date(),
      validUntil: expiresAt,
      isActive: true,
      targetType: 'specific_users',
      targetUsers: [userId],
      title: `${newTier.charAt(0).toUpperCase() + newTier.slice(1)} Member Discount`,
      description: `Exclusive discount for our new ${newTier} members!`,
      createdBy: new mongoose.Types.ObjectId(), // System
    });

    upgrade.offer = {
      couponCode,
      discountValue: rewards.discountValue,
      expiresAt,
    };

    // Send celebration notification
    await sendCelebrationNotification(upgrade, user, rewards.badge);

    upgrade.celebrationStatus = 'sent';
    upgrade.notificationSent = true;
    upgrade.notificationSentAt = new Date();
    upgrade.badgeAwarded = true;
    upgrade.badgeAwardedAt = new Date();

    await upgrade.save();

    logger.info('celebrateTierUpgrade: Upgrade celebrated', {
      upgradeId: upgrade._id.toString(),
      userId: userId.toString(),
      newTier,
    });

    return upgrade;
  } catch (error) {
    logger.error('celebrateTierUpgrade: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    await TierUpgrade.findByIdAndDelete(upgrade?._id);
    throw error;
  }
}

/**
 * Send celebration notification to user
 */
async function sendCelebrationNotification(
  upgrade: ITierUpgrade,
  user: { firstName: string; email: string },
  badgeName: string
): Promise<void> {
  try {
    const tierEmojis: Record<Tier, string> = {
      bronze: '',
      silver: '',
      gold: '',
      platinum: '',
    };

    // Send push notification
    await addJob('notification-queue', 'send_notification', {
      userId: upgrade.userId.toString(),
      type: 'tier_upgrade',
      title: `Welcome to ${upgrade.newTier.charAt(0).toUpperCase() + upgrade.newTier.slice(1)}!`,
      message: `Congratulations ${user.firstName}! You've been upgraded to ${upgrade.newTier} member. ${tierEmojis[upgrade.newTier as Tier]} Claim your exclusive discount!`,
      data: {
        upgradeId: upgrade._id.toString(),
        previousTier: upgrade.previousTier,
        newTier: upgrade.newTier,
        couponCode: upgrade.offer?.couponCode,
        badgeName,
      },
    });

    // Send celebration email
    await addJob('email-queue', 'send_email', {
      to: user.email,
      subject: `Congratulations! You're Now a ${upgrade.newTier.charAt(0).toUpperCase() + upgrade.newTier.slice(1)} Member!`,
      template: 'tier_upgrade_celebration',
      userId: upgrade.userId.toString(),
      data: {
        customerName: user.firstName,
        previousTier: upgrade.previousTier,
        newTier: upgrade.newTier,
        tierEmoji: tierEmojis[upgrade.newTier as Tier],
        couponCode: upgrade.offer?.couponCode,
        discountValue: upgrade.offer?.discountValue,
        bonusPoints: TIER_REWARDS[upgrade.newTier as keyof typeof TIER_REWARDS]?.bonusPoints,
        badgeName,
        expiresAt: upgrade.offer?.expiresAt?.toISOString(),
      },
    });

    logger.info('sendCelebrationNotification: Notification sent', {
      upgradeId: upgrade._id.toString(),
      userId: upgrade.userId.toString(),
    });
  } catch (error) {
    logger.error('sendCelebrationNotification: Failed', {
      upgradeId: upgrade._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get user's current tier information
 */
export async function getTierInfo(userId: mongoose.Types.ObjectId): Promise<{
  currentTier: Tier;
  totalEarned: number;
  nextTier: Tier | null;
  pointsToNextTier: number;
  progressPercentage: number;
}> {
  const user = await User.findById(userId).select('loyaltySystem.tier loyaltySystem.totalEarned');
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const currentTier = user.loyaltySystem.tier as Tier;
  const totalEarned = user.loyaltySystem.totalEarned;

  // Find next tier
  const tiers: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(currentTier);
  const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;

  let pointsToNextTier = 0;
  if (nextTier) {
    pointsToNextTier = TIER_THRESHOLDS[nextTier] - totalEarned;
  }

  // Calculate progress to next tier
  let progressPercentage = 100; // Already at max
  if (nextTier) {
    const currentThreshold = TIER_THRESHOLDS[currentTier];
    const nextThreshold = TIER_THRESHOLDS[nextTier];
    progressPercentage = Math.round(
      ((totalEarned - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    );
  }

  return {
    currentTier,
    totalEarned,
    nextTier,
    pointsToNextTier: Math.max(0, pointsToNextTier),
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
  };
}

/**
 * Get all available tier badges
 */
export function getTierBadges(): Array<{
  tier: Tier;
  name: string;
  threshold: number;
  rewards: {
    bonusPoints: number;
    discountValue: number;
  };
}> {
  return [
    {
      tier: 'bronze',
      name: 'Bronze Member',
      threshold: TIER_THRESHOLDS.bronze,
      rewards: { bonusPoints: 0, discountValue: 0 },
    },
    {
      tier: 'silver',
      name: 'Silver Member',
      threshold: TIER_THRESHOLDS.silver,
      rewards: TIER_REWARDS.silver,
    },
    {
      tier: 'gold',
      name: 'Gold Member',
      threshold: TIER_THRESHOLDS.gold,
      rewards: TIER_REWARDS.gold,
    },
    {
      tier: 'platinum',
      name: 'Platinum Member',
      threshold: TIER_THRESHOLDS.platinum,
      rewards: TIER_REWARDS.platinum,
    },
  ];
}

/**
 * Get tier upgrade statistics
 */
export async function getTierUpgradeStats(): Promise<{
  totalUpgrades: number;
  byTier: Record<Tier, number>;
  upgradesThisMonth: number;
  mostCommonUpgrade: { from: Tier; to: Tier; count: number };
}> {
  const [totalStats, monthlyStats, upgradeCombos] = await Promise.all([
    TierUpgrade.aggregate([
      { $group: { _id: '$newTier', count: { $sum: 1 } } },
    ]),
    TierUpgrade.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().setDate(1)) },
        },
      },
      { $count: 'count' },
    ]),
    TierUpgrade.aggregate([
      {
        $group: {
          _id: { from: '$previousTier', to: '$newTier' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const byTier = {} as Record<Tier, number>;
  for (const stat of totalStats) {
    byTier[stat._id as Tier] = stat.count;
  }

  const mostCommonUpgrade = upgradeCombos[0]
    ? {
        from: upgradeCombos[0]._id.from as Tier,
        to: upgradeCombos[0]._id.to as Tier,
        count: upgradeCombos[0].count,
      }
    : { from: 'bronze' as Tier, to: 'silver' as Tier, count: 0 };

  return {
    totalUpgrades: (Object.values(byTier) as number[]).reduce((sum, count) => sum + count, 0),
    byTier,
    upgradesThisMonth: monthlyStats[0]?.count || 0,
    mostCommonUpgrade,
  };
}

/**
 * Send tier progress notifications to users approaching upgrade
 * Called daily by scheduled job
 */
export async function sendTierProgressNotifications(): Promise<number> {
  try {
    const users = await User.find({
      role: 'customer',
      isActive: true,
      isDeleted: false,
    }).select('loyaltySystem.tier loyaltySystem.totalEarned communicationPreferences');

    let notified = 0;

    for (const user of users) {
      const currentTier = user.loyaltySystem.tier as Tier;
      const totalEarned = user.loyaltySystem.totalEarned;

      // Check if user is within 100 points of next tier
      const tiers: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];
      const currentIndex = tiers.indexOf(currentTier);

      if (currentIndex >= tiers.length - 1) continue; // Already at max

      const nextTier = tiers[currentIndex + 1];
      const threshold = TIER_THRESHOLDS[nextTier];
      const pointsAway = threshold - totalEarned;

      if (pointsAway <= 100 && pointsAway > 0) {
        // Check if notification was sent recently
        const recentNotification = await TierUpgrade.findOne({
          userId: user._id,
          newTier: nextTier,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        });

        if (!recentNotification) {
          await addJob('notification-queue', 'send_notification', {
            userId: user._id.toString(),
            type: 'tier_progress',
            title: `Almost ${nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}!`,
            message: `Just ${pointsAway} more points to unlock ${nextTier} member benefits!`,
            data: {
              currentTier,
              nextTier,
              pointsAway,
              progressPercentage: Math.round(((totalEarned - TIER_THRESHOLDS[currentTier]) /
                (threshold - TIER_THRESHOLDS[currentTier])) * 100),
            },
          });
          notified++;
        }
      }
    }

    logger.info('sendTierProgressNotifications: Progress notifications sent', { count: notified });
    return notified;
  } catch (error) {
    logger.error('sendTierProgressNotifications: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Batch check tier upgrades for all active users (scheduler entry point)
 */
export async function checkAllTierUpgrades(): Promise<{ checked: number; upgraded: number }> {
  const users = await User.find({ isDeleted: { $ne: true }, role: 'customer' })
    .select('_id')
    .limit(500);
  let upgraded = 0;
  for (const user of users) {
    const result = await checkTierUpgrades(user._id);
    if (result) upgraded++;
  }
  return { checked: users.length, upgraded };
}

export default {
  checkTierUpgrades,
  checkAllTierUpgrades,
  manualTierUpgrade,
  getTierInfo,
  getTierBadges,
  getTierUpgradeStats,
  sendTierProgressNotifications,
  TierUpgrade,
};
