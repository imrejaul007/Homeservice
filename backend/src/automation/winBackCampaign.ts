/**
 * Win-Back Campaign Automation
 *
 * Re-engage inactive users with personalized campaigns:
 * - Inactive user detection
 * - Personalized offers
 * - Multi-channel outreach
 * - Success tracking
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IWinBackCampaign extends Document {
  userId: mongoose.Types.ObjectId;
  campaignId: string;
  campaignType: 'dormant_30' | 'dormant_60' | 'dormant_90' | 'churn_risk' | 'win_back';
  status: 'pending' | 'engaged' | 'converted' | 'failed' | 'skipped';
  detectionDate: Date;
  channels: Array<{
    channel: 'email' | 'push' | 'sms';
    sentAt?: Date;
    status: 'pending' | 'sent' | 'opened' | 'clicked' | 'failed';
    metadata?: Record<string, unknown>;
  }>;
  offer?: {
    type: 'discount' | 'free_service' | 'loyalty_bonus';
    value: number;
    code?: string;
    expiresAt: Date;
  };
  conversion?: {
    convertedAt?: Date;
    bookingId?: mongoose.Types.ObjectId;
    revenue?: number;
  };
  lastActivity?: {
    type: 'login' | 'search' | 'booking' | 'review';
    date?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const winBackCampaignSchema = new Schema<IWinBackCampaign>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      required: true,
      index: true,
    },
    campaignType: {
      type: String,
      enum: ['dormant_30', 'dormant_60', 'dormant_90', 'churn_risk', 'win_back'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'engaged', 'converted', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    detectionDate: {
      type: Date,
      default: Date.now,
    },
    channels: [{
      channel: {
        type: String,
        enum: ['email', 'push', 'sms'],
        required: true,
      },
      sentAt: Date,
      status: {
        type: String,
        enum: ['pending', 'sent', 'opened', 'clicked', 'failed'],
        default: 'pending',
      },
      metadata: Schema.Types.Mixed,
    }],
    offer: {
      type: {
        type: String,
        enum: ['discount', 'free_service', 'loyalty_bonus'],
      },
      value: Number,
      code: String,
      expiresAt: Date,
    },
    conversion: {
      convertedAt: Date,
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
      },
      revenue: Number,
    },
    lastActivity: {
      type: {
        type: String,
        enum: ['login', 'search', 'booking', 'review'],
      },
      date: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
winBackCampaignSchema.index({ campaignType: 1, status: 1 });
winBackCampaignSchema.index({ status: 1, detectionDate: 1 });
winBackCampaignSchema.index({ 'channels.status': 1 });

const WinBackCampaign = mongoose.model<IWinBackCampaign>('WinBackCampaign', winBackCampaignSchema);

// Configuration
const CONFIG = {
  // Inactivity thresholds (in days)
  inactivityThresholds: {
    dormant30: 30,
    dormant60: 60,
    dormant90: 90,
  },

  // Churn risk scoring thresholds
  churnRisk: {
    // Factors that increase churn risk
    highRiskFactors: {
      noBookingHistory: 20,
      onlyOneBooking: 30,
      decliningEngagement: 40,
      recentComplaint: 50,
    },
    // Factors that decrease churn risk
    protectiveFactors: {
      multipleBookings: -20,
      highLoyaltyTier: -30,
      recentLogin: -10,
      referralActivity: -15,
    },
  },

  // Campaign offers by type
  offers: {
    dormant_30: {
      type: 'discount' as const,
      value: 10,
      code: 'WELCOME_BACK10',
    },
    dormant_60: {
      type: 'discount' as const,
      value: 15,
      code: 'WE_MISS_YOU15',
    },
    dormant_90: {
      type: 'discount' as const,
      value: 20,
      code: 'COME_BACK20',
    },
    churn_risk: {
      type: 'discount' as const,
      value: 25,
      code: 'STAY_WITH_US25',
    },
    win_back: {
      type: 'free_service' as const,
      value: 0,
      code: 'FREE_SERVICE',
    },
  },

  // Channel priority
  channelPriority: ['email', 'push', 'sms'] as const,

  // Offer validity (days)
  offerValidityDays: 7,

  // Re-campaign interval (days)
  recampaignInterval: 14,
};

interface UserActivityProfile {
  totalBookings: number;
  totalSpent: number;
  lastBookingDate?: Date;
  lastLoginDate?: Date;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  churnScore: number;
}

/**
 * Calculate churn risk score for a user
 */
async function calculateChurnRiskScore(userId: mongoose.Types.ObjectId): Promise<number> {
  let score = 0;

  const user = await User.findById(userId).select(
    'loyaltySystem.tier lastLogin sessions'
  );
  if (!user) return 100;

  // Get booking history
  const bookingStats = await Booking.aggregate([
    { $match: { customerId: userId, status: 'completed' } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' },
        lastBooking: { $max: '$completedAt' },
      },
    },
  ]);

  const stats = bookingStats[0] || { count: 0, totalSpent: 0, lastBooking: null };

  // Calculate risk factors
  if (stats.count === 0) {
    score += CONFIG.churnRisk.highRiskFactors.noBookingHistory;
  } else if (stats.count === 1) {
    score += CONFIG.churnRisk.highRiskFactors.onlyOneBooking;
  }

  // Check for declining engagement
  if (stats.count >= 2) {
    const recentBookings = await Booking.countDocuments({
      customerId: userId,
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    });
    const olderBookings = await Booking.countDocuments({
      customerId: userId,
      createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    });
    if (olderBookings > 0 && recentBookings < olderBookings * 0.3) {
      score += CONFIG.churnRisk.highRiskFactors.decliningEngagement;
    }
  }

  // Protective factors
  if (stats.count >= 5) {
    score += CONFIG.churnRisk.protectiveFactors.multipleBookings;
  }

  const tierScores: Record<string, number> = {
    platinum: CONFIG.churnRisk.protectiveFactors.highLoyaltyTier,
    gold: Math.round(CONFIG.churnRisk.protectiveFactors.highLoyaltyTier / 2),
    silver: 0,
    bronze: 0,
  };
  score += tierScores[user.loyaltySystem.tier] || 0;

  // Recent login check
  if (user.lastLogin) {
    const daysSinceLogin = Math.floor(
      (Date.now() - user.lastLogin.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceLogin <= 7) {
      score += CONFIG.churnRisk.protectiveFactors.recentLogin;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Detect inactive users and create win-back campaigns
 * Called hourly by scheduled job
 */
export async function detectInactiveUsers(): Promise<{
  detected: number;
  campaignsCreated: number;
}> {
  const result = {
    detected: 0,
    campaignsCreated: 0,
  };

  try {
    const now = new Date();

    // Find users who should be in campaigns but aren't
    for (const [thresholdKey, days] of Object.entries(CONFIG.inactivityThresholds)) {
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Find users with last activity before cutoff
      const inactiveUsers = await User.aggregate([
        {
          $match: {
            role: 'customer',
            isActive: true,
            isDeleted: false,
            accountStatus: 'active',
            lastLogin: { $lt: cutoffDate },
          },
        },
        {
          $lookup: {
            from: 'winbackcampaigns',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$userId', '$$userId'] },
                  campaignType: thresholdKey,
                  createdAt: { $gte: new Date(Date.now() - CONFIG.recampaignInterval * 24 * 60 * 60 * 1000) },
                },
              },
            ],
            as: 'recentCampaigns',
          },
        },
        {
          $match: {
            recentCampaigns: { $size: 0 },
          },
        },
        {
          $lookup: {
            from: 'bookings',
            pipeline: [
              { $match: { status: 'completed' } },
              { $sort: { completedAt: -1 } },
              { $limit: 1 },
            ],
            as: 'lastBooking',
          },
        },
        {
          $addFields: {
            lastBookingDate: { $arrayElemAt: ['$lastBooking.completedAt', 0] },
          },
        },
      ]);

      for (const user of inactiveUsers) {
        result.detected++;

        // Calculate churn risk
        const churnScore = await calculateChurnRiskScore(user._id);

        // Determine campaign type
        let campaignType: IWinBackCampaign['campaignType'] = thresholdKey as IWinBackCampaign['campaignType'];
        if (churnScore >= 60) {
          campaignType = 'churn_risk';
        }

        // Generate campaign
        const campaign = await createWinBackCampaign(
          user._id,
          campaignType,
          {
            lastActivityType: user.lastLogin ? 'login' : 'booking',
            lastActivityDate: user.lastBookingDate || user.lastLogin,
          }
        );

        if (campaign) {
          result.campaignsCreated++;
        }
      }
    }

    logger.info('detectInactiveUsers: Detection complete', result);
    return result;
  } catch (error) {
    logger.error('detectInactiveUsers: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Create a win-back campaign for a user
 */
export async function createWinBackCampaign(
  userId: mongoose.Types.ObjectId,
  campaignType: IWinBackCampaign['campaignType'],
  lastActivity?: {
    lastActivityType?: 'login' | 'search' | 'booking' | 'review';
    lastActivityDate?: Date;
  }
): Promise<IWinBackCampaign | null> {
  try {
    // Check if campaign already exists
    const existing = await WinBackCampaign.findOne({
      userId,
      campaignType,
      status: { $in: ['pending', 'engaged'] },
    });

    if (existing) {
      return existing;
    }

    const user = await User.findById(userId).select(
      'firstName email communicationPreferences'
    );
    if (!user) return null;

    const offerConfig = CONFIG.offers[campaignType];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CONFIG.offerValidityDays);

    const campaign = await WinBackCampaign.create({
      userId,
      campaignId: `WB-${campaignType}-${Date.now().toString(36)}-${userId.toString().slice(-4)}`,
      campaignType,
      status: 'pending',
      detectionDate: new Date(),
      channels: CONFIG.channelPriority.map(channel => ({
        channel,
        status: 'pending',
      })),
      offer: {
        type: offerConfig.type,
        value: offerConfig.value,
        code: offerConfig.code,
        expiresAt,
      },
      lastActivity: lastActivity ? {
        type: lastActivity.lastActivityType || 'login',
        date: lastActivity.lastActivityDate,
      } : undefined,
    });

    logger.info('createWinBackCampaign: Campaign created', {
      campaignId: campaign.campaignId,
      userId: userId.toString(),
      campaignType,
    });

    // Send first outreach (email)
    await sendCampaignMessage(campaign._id, 'email');

    return campaign;
  } catch (error) {
    logger.error('createWinBackCampaign: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send campaign message through specified channel
 */
export async function sendCampaignMessage(
  campaignId: mongoose.Types.ObjectId,
  channel: 'email' | 'push' | 'sms'
): Promise<void> {
  try {
    const campaign = await WinBackCampaign.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const user = await User.findById(campaign.userId).select(
      'firstName email phone deviceTokens communicationPreferences'
    );
    if (!user) {
      throw new Error(`User not found: ${campaign.userId}`);
    }

    // Check communication preferences
    const prefs = user.communicationPreferences;
    if (!prefs) {
      await campaign.updateOne({ status: 'skipped' });
      return;
    }

    const templateData = {
      customerName: user.firstName,
      campaignType: campaign.campaignType,
      offerValue: campaign.offer?.value,
      offerCode: campaign.offer?.code,
      expiresAt: campaign.offer?.expiresAt?.toISOString(),
      lastBookingDate: campaign.lastActivity?.date?.toISOString(),
    };

    switch (channel) {
      case 'email':
        if (!prefs.email?.marketing) {
          logger.debug('sendCampaignMessage: Email opt-out', { campaignId: campaignId.toString() });
          return;
        }
        await addJob('email-queue', 'send_winback_email', {
          to: user.email,
          subject: getEmailSubject(campaign.campaignType),
          template: 'winback_campaign',
          userId: user._id.toString(),
          data: templateData,
        });
        break;

      case 'push':
        if (!prefs.push?.promotions) {
          logger.debug('sendCampaignMessage: Push opt-out', { campaignId: campaignId.toString() });
          return;
        }
        if (user.deviceTokens && user.deviceTokens.length > 0) {
          for (const token of user.deviceTokens) {
            if (token.isActive) {
              await addJob('notification-queue', 'send_notification', {
                token: token.token,
                platform: token.platform,
                type: 'winback_campaign',
                title: 'We Miss You!',
                message: getPushMessage(campaign.campaignType, templateData),
                data: {
                  campaignId: campaign._id.toString(),
                  offerCode: campaign.offer?.code,
                },
              });
            }
          }
        }
        break;

      case 'sms':
        if (!prefs.sms?.promotions) {
          logger.debug('sendCampaignMessage: SMS opt-out', { campaignId: campaignId.toString() });
          return;
        }
        if (user.phone) {
          await addJob('sms-queue', 'send_sms', {
            to: user.phone,
            message: getSmsMessage(templateData),
          });
        }
        break;
    }

    // Update channel status
    const channelIndex = campaign.channels.findIndex(c => c.channel === channel);
    if (channelIndex >= 0) {
      campaign.channels[channelIndex].sentAt = new Date();
      campaign.channels[channelIndex].status = 'sent';
      await campaign.save();
    }

    logger.info('sendCampaignMessage: Message sent', {
      campaignId: campaignId.toString(),
      channel,
    });
  } catch (error) {
    logger.error('sendCampaignMessage: Failed', {
      campaignId: campaignId.toString(),
      channel,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Mark channel as failed
    await WinBackCampaign.updateOne(
      { _id: campaignId, 'channels.channel': channel },
      { $set: { 'channels.$.status': 'failed' } }
    );
  }
}

function getEmailSubject(campaignType: IWinBackCampaign['campaignType']): string {
  const subjects: Record<IWinBackCampaign['campaignType'], string> = {
    dormant_30: 'We noticed you\'ve been away - Here\'s 10% off!',
    dormant_60: 'It\'s been a while... We\'ve missed you!',
    dormant_90: 'We really miss you! Special offer inside',
    churn_risk: 'We don\'t want to lose you - Here\'s 25% off',
    win_back: 'Welcome back! Your free service awaits',
  };
  return subjects[campaignType];
}

function getPushMessage(campaignType: IWinBackCampaign['campaignType'], data: Record<string, unknown>): string {
  const messages: Record<IWinBackCampaign['campaignType'], string> = {
    dormant_30: `Hey ${data.customerName}! Use code ${data.offerCode} for ${data.offerValue}% off your next booking!`,
    dormant_60: `${data.customerName}, we miss you! Come back and save ${data.offerValue}% with code ${data.offerCode}`,
    dormant_90: `It's been too long, ${data.customerName}! ${data.offerValue}% off your return - code: ${data.offerCode}`,
    churn_risk: `Don't go! ${data.customerName} - Here's an exclusive ${data.offerValue}% discount just for you!`,
    win_back: `${data.customerName}, welcome back! Claim your free service with code ${data.offerCode}`,
  };
  return messages[campaignType];
}

function getSmsMessage(data: Record<string, unknown>): string {
  return `NILIN: Hey ${data.customerName}! We miss you! Use code ${data.offerCode} for ${data.offerValue}% off your next booking. Valid for 7 days.`;
}

/**
 * Track campaign engagement
 */
export async function trackCampaignEngagement(
  campaignId: string,
  action: 'open' | 'click'
): Promise<void> {
  try {
    const campaign = await WinBackCampaign.findById(campaignId);
    if (!campaign) return;

    if (campaign.status === 'pending') {
      campaign.status = 'engaged';
    }

    for (const channel of campaign.channels) {
      if (channel.status === 'sent') {
        channel.status = action === 'open' ? 'opened' : 'clicked';
      }
    }

    await campaign.save();

    logger.info('trackCampaignEngagement: Engagement tracked', {
      campaignId,
      action,
    });
  } catch (error) {
    logger.error('trackCampaignEngagement: Failed', {
      campaignId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Mark campaign as converted (user made a booking)
 */
export async function markCampaignConverted(
  campaignId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    const campaign = await WinBackCampaign.findById(campaignId);
    if (!campaign) return;

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    campaign.status = 'converted';
    campaign.conversion = {
      convertedAt: new Date(),
      bookingId,
      revenue: booking.pricing.totalAmount,
    };

    await campaign.save();

    // Award loyalty bonus for conversion
    await addJob('loyalty-queue', 'award_winback_bonus', {
      userId: campaign.userId.toString(),
      bonusPoints: 50,
      description: 'Win-back campaign conversion bonus',
    });

    logger.info('markCampaignConverted: Campaign converted', {
      campaignId: campaignId.toString(),
      bookingId: bookingId.toString(),
      revenue: booking.pricing.totalAmount,
    });
  } catch (error) {
    logger.error('markCampaignConverted: Failed', {
      campaignId: campaignId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get win-back campaign statistics
 */
export async function getWinBackStats(): Promise<{
  totalCampaigns: number;
  byStatus: Record<string, number>;
  byType: Record<string, { total: number; converted: number; conversionRate: number }>;
  averageConversionTime: number;
  totalRevenue: number;
  roi: number;
}> {
  const [statusStats, typeStats, conversionStats] = await Promise.all([
    WinBackCampaign.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    WinBackCampaign.aggregate([
      {
        $group: {
          _id: '$campaignType',
          total: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
          },
          revenue: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, '$conversion.revenue', 0] },
          },
        },
      },
    ]),
    WinBackCampaign.aggregate([
      {
        $match: {
          status: 'converted',
          'conversion.convertedAt': { $exists: true },
        },
      },
      {
        $project: {
          conversionTime: {
            $divide: [
              { $subtract: ['$conversion.convertedAt', '$createdAt'] },
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
  ]);

  const byStatus = statusStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const byType: Record<string, { total: number; converted: number; conversionRate: number }> = {};
  let totalRevenue = 0;
  for (const stat of typeStats) {
    totalRevenue += stat.revenue;
    byType[stat._id] = {
      total: stat.total,
      converted: stat.converted,
      conversionRate: stat.total > 0 ? (stat.converted / stat.total) * 100 : 0,
    };
  }

  return {
    totalCampaigns: (Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0),
    byStatus,
    byType,
    averageConversionTime: conversionStats[0]?.avgConversionTime || 0,
    totalRevenue,
    roi: totalRevenue > 0 ? totalRevenue / ((Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0) * 1) : 0,
  };
}

/**
 * Run the win-back campaign detection
 * Wrapper function for scheduler integration
 */
export async function runWinBackCampaign(): Promise<{
  detected: number;
  campaignsCreated: number;
}> {
  try {
    logger.info('Running win-back campaign via scheduler');
    const result = await detectInactiveUsers();
    logger.info('Win-back campaign completed via scheduler', result);
    return result;
  } catch (error) {
    logger.error('Win-back campaign failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export { WinBackCampaign };

export default {
  detectInactiveUsers,
  runWinBackCampaign,
  createWinBackCampaign,
  sendCampaignMessage,
  trackCampaignEngagement,
  markCampaignConverted,
  getWinBackStats,
  WinBackCampaign,
};
