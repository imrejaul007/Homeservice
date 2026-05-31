/**
 * Birthday Reward Campaign Automation
 *
 * Celebrates user birthdays with special rewards:
 * - Birthday date tracking
 * - Pre-birthday outreach
 * - Special offer generation
 * - Post-birthday follow-up
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import Coupon from '../models/coupon.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IBirthdayReward extends Document {
  userId: mongoose.Types.ObjectId;
  birthdayMonth: number;
  birthdayDay: number;
  yearOfBirth?: number;
  campaignType: 'pre_birthday' | 'birthday' | 'post_birthday';
  status: 'pending' | 'offer_sent' | 'offer_used' | 'expired' | 'skipped';
  offer?: {
    couponCode: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    expiresAt: Date;
    usedAt?: Date;
    usedOnBooking?: mongoose.Types.ObjectId;
  };
  preBirthdaySentAt?: Date;
  birthdaySentAt?: Date;
  postBirthdaySentAt?: Date;
  metadata?: {
    emailOpened?: boolean;
    emailOpenedAt?: Date;
    pushSent?: boolean;
    pushOpened?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const birthdayRewardSchema = new Schema<IBirthdayReward>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    birthdayMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    birthdayDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    yearOfBirth: {
      type: Number,
    },
    campaignType: {
      type: String,
      enum: ['pre_birthday', 'birthday', 'post_birthday'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'offer_sent', 'offer_used', 'expired', 'skipped'],
      default: 'pending',
      index: true,
    },
    offer: {
      couponCode: String,
      discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
      },
      discountValue: Number,
      expiresAt: Date,
      usedAt: Date,
      usedOnBooking: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
      },
    },
    preBirthdaySentAt: Date,
    birthdaySentAt: Date,
    postBirthdaySentAt: Date,
    metadata: {
      emailOpened: Boolean,
      emailOpenedAt: Date,
      pushSent: Boolean,
      pushOpened: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
birthdayRewardSchema.index({ campaignType: 1, status: 1 });
birthdayRewardSchema.index({ status: 1, 'offer.expiresAt': 1 });
birthdayRewardSchema.index({ birthdayMonth: 1, birthdayDay: 1 });

const BirthdayReward = mongoose.model<IBirthdayReward>('BirthdayReward', birthdayRewardSchema);

// Configuration
const CONFIG = {
  // When to send pre-birthday outreach
  preBirthdayDays: 3, // 3 days before

  // When to send birthday wish
  birthdayDay: true, // Send on birthday

  // When to send post-birthday follow-up
  postBirthdayDays: 1, // 1 day after if no engagement

  // How long the offer is valid
  offerValidityDays: 7,

  // Discount configuration
  discount: {
    type: 'percentage' as const,
    value: 20,
    maxDiscount: 100,
    minOrderValue: 0,
  },

  // Bonus points for birthday bookings
  bonusPoints: 50,

  // Message templates
  templates: {
    preBirthday: {
      subject: 'Your Birthday is Coming Up!',
      pushTitle: 'Birthday Surprise!',
      pushMessage: 'Get ready for a special birthday treat coming your way!',
    },
    birthday: {
      subject: 'Happy Birthday! Enjoy Your Special Gift',
      pushTitle: 'Happy Birthday! 🎉',
      pushMessage: 'Happy Birthday! Claim your exclusive {discount}% discount now!',
    },
    postBirthday: {
      subject: "Don't Miss Your Birthday Treat!",
      pushTitle: 'Birthday Offer Ending Soon!',
      pushMessage: "Your birthday discount is still waiting! Use code {code} before it expires.",
    },
  },
};

type CampaignType = 'pre_birthday' | 'birthday' | 'post_birthday';

/**
 * Extract birthday from user profile
 */
async function extractUserBirthday(userId: mongoose.Types.ObjectId): Promise<{
  month: number;
  day: number;
  year?: number;
} | null> {
  const user = await User.findById(userId).select('dateOfBirth');
  if (!user?.dateOfBirth) {
    return null;
  }

  const birthday = new Date(user.dateOfBirth);
  return {
    month: birthday.getMonth() + 1, // Convert to 1-12
    day: birthday.getDate(),
    year: birthday.getFullYear(),
  };
}

/**
 * Update user birthday information
 */
export async function updateUserBirthday(
  userId: mongoose.Types.ObjectId,
  birthday: Date
): Promise<void> {
  try {
    await User.findByIdAndUpdate(userId, {
      dateOfBirth: birthday,
    });

    const birthdayDate = new Date(birthday);
    logger.info('updateUserBirthday: Birthday updated', {
      userId: userId.toString(),
      birthday: birthdayDate.toISOString(),
    });
  } catch (error) {
    logger.error('updateUserBirthday: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate birthday coupon
 */
async function generateBirthdayCoupon(userId: mongoose.Types.ObjectId): Promise<string> {
  const couponCode = `BDAY${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CONFIG.offerValidityDays);

  await Coupon.create({
    code: couponCode,
    type: CONFIG.discount.type,
    value: CONFIG.discount.value,
    maxDiscount: CONFIG.discount.maxDiscount,
    minOrderValue: CONFIG.discount.minOrderValue,
    maxUses: 1,
    maxUsesPerUser: 1,
    validFrom: new Date(),
    validUntil: expiresAt,
    isActive: true,
    targetType: 'specific_users',
    targetUsers: [userId],
    title: 'Birthday Special',
    description: 'Happy Birthday! Enjoy {discount}% off your booking.',
    createdBy: new mongoose.Types.ObjectId(),
  });

  return couponCode;
}

/**
 * Send birthday outreach
 */
async function sendBirthdayOutreach(
  reward: IBirthdayReward,
  campaignType: CampaignType,
  user: { firstName: string; email: string }
): Promise<void> {
  const templateKey =
    campaignType === 'pre_birthday'
      ? 'preBirthday'
      : campaignType === 'post_birthday'
        ? 'postBirthday'
        : 'birthday';
  const template = CONFIG.templates[templateKey];
  const discountValue = CONFIG.discount.value;

  try {
    // Send email
    if (campaignType === 'birthday' && reward.offer?.couponCode) {
      await addJob('email-queue', 'send_email', {
        to: user.email,
        subject: template.subject,
        template: 'birthday_campaign',
        userId: reward.userId.toString(),
        data: {
          customerName: user.firstName,
          couponCode: reward.offer.couponCode,
          discountValue,
          expiresAt: reward.offer.expiresAt?.toISOString(),
          campaignType,
        },
      });
    }

    // Send push notification
    await addJob('notification-queue', 'send_notification', {
      userId: reward.userId.toString(),
      type: 'birthday_campaign',
      title: template.pushTitle,
      message: template.pushMessage.replace('{discount}', discountValue.toString()).replace('{code}', reward.offer?.couponCode || ''),
      data: {
        rewardId: reward._id.toString(),
        campaignType,
        couponCode: reward.offer?.couponCode,
      },
    });

    // Update reward record
    const updateField = `${campaignType}SentAt` as 'preBirthdaySentAt' | 'birthdaySentAt' | 'postBirthdaySentAt';
    await reward.updateOne({
      [updateField]: new Date(),
      status: 'offer_sent',
      'metadata.pushSent': true,
    });

    logger.info('sendBirthdayOutreach: Outreach sent', {
      rewardId: reward._id.toString(),
      userId: reward.userId.toString(),
      campaignType,
    });
  } catch (error) {
    logger.error('sendBirthdayOutreach: Failed', {
      rewardId: reward._id.toString(),
      campaignType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Process daily birthday campaigns
 * Called daily by scheduled job
 */
export async function processBirthdayCampaigns(): Promise<{
  preBirthday: number;
  birthday: number;
  postBirthday: number;
}> {
  const result = {
    preBirthday: 0,
    birthday: 0,
    postBirthday: 0,
  };

  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Get tomorrow's date for post-birthday
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowMonth = tomorrow.getMonth() + 1;

    // Process pre-birthday (3 days before)
    const preBirthdayDay = new Date(today);
    preBirthdayDay.setDate(preBirthdayDay.getDate() + CONFIG.preBirthdayDays);
    const preBirthdayMonth = preBirthdayDay.getMonth() + 1;
    const preBirthdayDayNum = preBirthdayDay.getDate();

    // Find users with birthdays in 3 days
    const preBirthdayUsers = await User.find({
      'dateOfBirth': {
        $expr: {
          $and: [
            { $eq: [{ $month: '$dateOfBirth' }, preBirthdayMonth] },
            { $eq: [{ $dayOfMonth: '$dateOfBirth' }, preBirthdayDayNum] },
          ],
        },
      },
      'communicationPreferences.email.marketing': { $ne: false },
    }).select('firstName email communicationPreferences');

    for (const user of preBirthdayUsers) {
      // Check if already processed
      const existing = await BirthdayReward.findOne({
        userId: user._id,
        campaignType: 'pre_birthday',
        birthdayMonth: preBirthdayMonth,
        birthdayDay: preBirthdayDayNum,
      });

      if (existing) continue;

      // Create reward record
      const reward = await BirthdayReward.create({
        userId: user._id,
        birthdayMonth: preBirthdayMonth,
        birthdayDay: preBirthdayDayNum,
        campaignType: 'pre_birthday',
        status: 'pending',
      });

      await sendBirthdayOutreach(reward, 'pre_birthday', {
        firstName: user.firstName,
        email: user.email,
      });

      result.preBirthday++;
    }

    // Process birthday wishes (today)
    const birthdayUsers = await User.find({
      'dateOfBirth': {
        $expr: {
          $and: [
            { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
            { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] },
          ],
        },
      },
      'communicationPreferences.email.marketing': { $ne: false },
    }).select('firstName email communicationPreferences');

    for (const user of birthdayUsers) {
      // Check if already processed today
      const existing = await BirthdayReward.findOne({
        userId: user._id,
        campaignType: 'birthday',
        birthdayMonth: todayMonth,
        birthdayDay: todayDay,
      });

      if (existing) continue;

      // Generate coupon
      const couponCode = await generateBirthdayCoupon(user._id);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CONFIG.offerValidityDays);

      // Create reward record
      const reward = await BirthdayReward.create({
        userId: user._id,
        birthdayMonth: todayMonth,
        birthdayDay: todayDay,
        campaignType: 'birthday',
        status: 'pending',
        offer: {
          couponCode,
          discountType: CONFIG.discount.type,
          discountValue: CONFIG.discount.value,
          expiresAt,
        },
      });

      await sendBirthdayOutreach(reward, 'birthday', {
        firstName: user.firstName,
        email: user.email,
      });

      result.birthday++;

      // Award birthday bonus points
      await addJob('loyalty-queue', 'award_birthday_bonus', {
        userId: user._id.toString(),
        bonusPoints: CONFIG.bonusPoints,
        description: 'Happy Birthday bonus!',
      });
    }

    // Process post-birthday follow-up (day after birthday)
    const postBirthdayUsers = await User.find({
      'dateOfBirth': {
        $expr: {
          $and: [
            { $eq: [{ $month: '$dateOfBirth' }, tomorrowMonth] },
            { $eq: [{ $dayOfMonth: '$dateOfBirth' }, tomorrowDay] },
          ],
        },
      },
      'communicationPreferences.email.marketing': { $ne: false },
    }).select('firstName email communicationPreferences');

    for (const user of postBirthdayUsers) {
      // Find birthday reward that wasn't used
      const birthdayReward = await BirthdayReward.findOne({
        userId: user._id,
        campaignType: 'birthday',
        birthdayMonth: tomorrowMonth,
        birthdayDay: tomorrowDay,
        status: 'offer_sent',
      });

      if (!birthdayReward) continue;

      // Check if already sent post-birthday
      const existing = await BirthdayReward.findOne({
        userId: user._id,
        campaignType: 'post_birthday',
        birthdayMonth: tomorrowMonth,
        birthdayDay: tomorrowDay,
      });

      if (existing) continue;

      // Create post-birthday reminder
      const reward = await BirthdayReward.create({
        userId: user._id,
        birthdayMonth: tomorrowMonth,
        birthdayDay: tomorrowDay,
        campaignType: 'post_birthday',
        status: 'pending',
        offer: birthdayReward.offer,
      });

      await sendBirthdayOutreach(reward, 'post_birthday', {
        firstName: user.firstName,
        email: user.email,
      });

      result.postBirthday++;
    }

    logger.info('processBirthdayCampaigns: Campaigns processed', result);
    return result;
  } catch (error) {
    logger.error('processBirthdayCampaigns: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process expired birthday offers
 * Called daily by scheduled job
 */
export async function processExpiredOffers(): Promise<number> {
  try {
    const result = await BirthdayReward.updateMany(
      {
        status: 'offer_sent',
        'offer.expiresAt': { $lt: new Date() },
      },
      {
        status: 'expired',
      }
    );

    logger.info('processExpiredOffers: Expired offers processed', {
      expiredCount: result.modifiedCount,
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('processExpiredOffers: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get user's birthday reward status
 */
export async function getUserBirthdayReward(userId: mongoose.Types.ObjectId): Promise<{
  hasBirthday: boolean;
  currentOffer?: {
    couponCode: string;
    discountValue: number;
    expiresAt: Date;
    isValid: boolean;
  };
  rewardsThisYear: Array<{
    campaignType: CampaignType;
    status: string;
    sentAt?: Date;
  }>;
}> {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const rewards = await BirthdayReward.find({
    userId,
    birthdayMonth: currentMonth,
  }).sort({ createdAt: -1 });

  const activeOffer = rewards.find(r =>
    r.status === 'offer_sent' &&
    r.offer?.expiresAt &&
    r.offer.expiresAt > new Date()
  );

  return {
    hasBirthday: rewards.length > 0,
    currentOffer: activeOffer?.offer ? {
      couponCode: activeOffer.offer.couponCode,
      discountValue: activeOffer.offer.discountValue,
      expiresAt: activeOffer.offer.expiresAt,
      isValid: activeOffer.offer.expiresAt ? activeOffer.offer.expiresAt > new Date() : false,
    } : undefined,
    rewardsThisYear: rewards.map(r => ({
      campaignType: r.campaignType,
      status: r.status,
      sentAt: r.birthdaySentAt || r.preBirthdaySentAt || r.postBirthdaySentAt,
    })),
  };
}

/**
 * Get birthday campaign statistics
 */
export async function getBirthdayCampaignStats(): Promise<{
  totalRewards: number;
  sentThisMonth: number;
  usedThisMonth: number;
  usageRate: number;
  averageConversionTime: number;
  topBirthdayMonths: Array<{ month: number; count: number }>;
}> {
  const [totalStats, monthlyStats, conversionStats, topMonthsStats]: [
    Array<{ _id: string; count: number }>,
    Array<{ _id: string; count: number }>,
    Array<{ avgConversionTime?: number }>,
    Array<{ _id: number; count: number }>
  ] = await Promise.all([
    BirthdayReward.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    BirthdayReward.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().setDate(1)) },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    BirthdayReward.aggregate([
      {
        $match: {
          status: 'offer_used',
          'offer.usedAt': { $exists: true },
        },
      },
      {
        $project: {
          conversionTime: {
            $divide: [
              { $subtract: ['$offer.usedAt', '$birthdaySentAt'] },
              1000 * 60 * 60, // Hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgConversionTime: { $avg: '$conversionTime' },
        },
      },
    ]),
    BirthdayReward.aggregate([
      {
        $group: {
          _id: '$birthdayMonth',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  const byStatus: Record<string, number> = totalStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const monthlyByStatus: Record<string, number> = monthlyStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const totalSent = (byStatus['offer_sent'] || 0) + (byStatus['offer_used'] || 0);
  const totalUsed = byStatus['offer_used'] || 0;

  return {
    totalRewards: (Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0),
    sentThisMonth: (Object.values(monthlyByStatus) as number[]).reduce((sum, count) => sum + count, 0),
    usedThisMonth: monthlyByStatus['offer_used'] || 0,
    usageRate: totalSent > 0 ? (totalUsed / totalSent) * 100 : 0,
    averageConversionTime: conversionStats[0]?.avgConversionTime || 0,
    topBirthdayMonths: topMonthsStats.map((m: any) => ({ month: m._id, count: m.count })),
  };
}

/**
 * Send birthday rewards to eligible users
 * Wrapper function for scheduler integration
 */
export async function sendBirthdayRewards(): Promise<{
  preBirthday: number;
  birthday: number;
  postBirthday: number;
}> {
  try {
    logger.info('Sending birthday rewards via scheduler');

    // Process birthday campaigns
    const result = await processBirthdayCampaigns();
    logger.info('Birthday campaigns processed', result);

    // Process expired offers
    const expired = await processExpiredOffers();
    logger.info('Expired birthday offers processed', { count: expired });

    logger.info('Birthday rewards completed via scheduler', result);

    return result;
  } catch (error) {
    logger.error('Birthday rewards failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  updateUserBirthday,
  processBirthdayCampaigns,
  sendBirthdayRewards,
  processExpiredOffers,
  getUserBirthdayReward,
  getBirthdayCampaignStats,
  BirthdayReward,
};
