/**
 * Off-Peak Promotion Suggester
 *
 * Identifies slow periods and generates promotional suggestions:
 * - Demand pattern analysis
 * - Off-peak time detection
 * - Promotion suggestion generation
 * - Auto-create targeted offers
 * - Effectiveness tracking
 */

import mongoose, { Document, Schema } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import Coupon from '../models/coupon.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IOffPeakPromotion extends Document {
  offerId?: mongoose.Types.ObjectId;
  promotionType: 'time_based' | 'day_based' | 'service_based' | 'combined';
  targetPeriod: {
    startTime: string; // HH:mm format
    endTime: string;
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    startDate: Date;
    endDate: Date;
  };
  discount: {
    type: 'percentage' | 'fixed';
    value: number;
    maxDiscount?: number;
  };
  targetCriteria: {
    serviceIds?: mongoose.Types.ObjectId[];
    categoryIds?: mongoose.Types.ObjectId[];
    providerIds?: mongoose.Types.ObjectId[];
    customerSegments?: string[];
  };
  status: 'suggested' | 'approved' | 'created' | 'active' | 'completed' | 'cancelled';
  suggestedBy: 'system' | 'admin';
  actualMetrics?: {
    bookingsGenerated: number;
    revenueGenerated: number;
    utilizationLift: number;
    roi: number;
  };
  metadata?: {
    historicalUtilization: number;
    projectedUtilization: number;
    averageBookingValue: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const offPeakPromotionSchema = new Schema<IOffPeakPromotion>(
  {
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    promotionType: {
      type: String,
      enum: ['time_based', 'day_based', 'service_based', 'combined'],
      required: true,
    },
    targetPeriod: {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      daysOfWeek: [Number],
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    discount: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
      },
      value: { type: Number, required: true },
      maxDiscount: Number,
    },
    targetCriteria: {
      serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
      categoryIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }],
      providerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      customerSegments: [String],
    },
    status: {
      type: String,
      enum: ['suggested', 'approved', 'created', 'active', 'completed', 'cancelled'],
      default: 'suggested',
      index: true,
    },
    suggestedBy: {
      type: String,
      enum: ['system', 'admin'],
      default: 'system',
    },
    actualMetrics: {
      bookingsGenerated: { type: Number, default: 0 },
      revenueGenerated: { type: Number, default: 0 },
      utilizationLift: { type: Number, default: 0 },
      roi: { type: Number, default: 0 },
    },
    metadata: {
      historicalUtilization: Number,
      projectedUtilization: Number,
      averageBookingValue: Number,
    },
  },
  { timestamps: true }
);

offPeakPromotionSchema.index({ status: 1, 'targetPeriod.startDate': 1 });
offPeakPromotionSchema.index({ promotionType: 1, status: 1 });

const OffPeakPromotion = mongoose.model<IOffPeakPromotion>('OffPeakPromotion', offPeakPromotionSchema);

// Configuration
const CONFIG = {
  // Utilization thresholds for off-peak detection
  offPeakThreshold: 0.3, // 30% utilization or below = off-peak
  moderatePeakThreshold: 0.6, // 60% utilization or below = moderate
  peakThreshold: 0.8, // 80%+ = peak

  // Discount recommendations by utilization gap
  discountRecommendations: {
    severe: { min: 25, max: 40 }, // Very low utilization
    moderate: { min: 15, max: 25 }, // Low utilization
    mild: { min: 10, max: 15 }, // Below peak
  },

  // Minimum sample size for analysis
  minBookingsForAnalysis: 20,

  // Time slots to analyze (hourly)
  timeSlots: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`),

  // Days of week names
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

/**
 * Analyze booking patterns to identify off-peak periods
 */
export async function analyzeDemandPatterns(
  daysToAnalyze = 30
): Promise<{
  hourlyPatterns: Array<{
    hour: number;
    dayOfWeek: number;
    utilization: number;
    avgBookings: number;
    avgRevenue: number;
    isOffPeak: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
  }>;
  dailyPatterns: Array<{
    dayOfWeek: number;
    utilization: number;
    avgBookings: number;
    avgRevenue: number;
    isOffPeak: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
  }>;
  overallUtilization: number;
  peakHours: number[];
  offPeakHours: number[];
  recommendations: string[];
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    // Get all bookings in the period
    const bookings = await Booking.find({
      createdAt: { $gte: startDate },
      status: { $in: ['completed', 'confirmed'] },
    }).populate('serviceId', 'pricing categoryId');

    if (bookings.length < CONFIG.minBookingsForAnalysis) {
      logger.warn('Insufficient booking data for analysis', {
        bookingsFound: bookings.length,
        required: CONFIG.minBookingsForAnalysis,
      });
      return {
        hourlyPatterns: [],
        dailyPatterns: [],
        overallUtilization: 0,
        peakHours: [],
        offPeakHours: [],
        recommendations: ['Insufficient data for analysis'],
      };
    }

    // Calculate hourly patterns
    const hourlyData: Record<string, { bookings: number; revenue: number }> = {};
    const dailyData: Record<number, { bookings: number; revenue: number }> = {};

    // Initialize data structures
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        hourlyData[`${day}-${hour}`] = { bookings: 0, revenue: 0 };
      }
    }
    for (let day = 0; day < 7; day++) {
      dailyData[day] = { bookings: 0, revenue: 0 };
    }

    // Process bookings
    let totalRevenue = 0;
    for (const booking of bookings) {
      const date = new Date(booking.createdAt);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const revenue = booking.pricing?.totalAmount || 0;

      hourlyData[`${dayOfWeek}-${hour}`].bookings++;
      hourlyData[`${dayOfWeek}-${hour}`].revenue += revenue;
      dailyData[dayOfWeek].bookings++;
      dailyData[dayOfWeek].revenue += revenue;
      totalRevenue += revenue;
    }

    // Calculate averages and determine thresholds
    const totalSlots = 24 * 7;
    const avgBookingsPerSlot = bookings.length / totalSlots;
    const avgRevenuePerSlot = totalRevenue / totalSlots;

    // Build hourly patterns
    const hourlyPatterns: Array<{
      hour: number;
      dayOfWeek: number;
      utilization: number;
      avgBookings: number;
      avgRevenue: number;
      isOffPeak: boolean;
      severity: 'none' | 'mild' | 'moderate' | 'severe';
    }> = [];

    let peakHours: number[] = [];
    let offPeakHours: number[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const data = hourlyData[`${day}-${hour}`];
        const utilization = data.bookings / (avgBookingsPerSlot * 3); // Normalized to 3x average

        let severity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
        if (utilization <= CONFIG.offPeakThreshold) {
          severity = 'severe';
          offPeakHours.push(hour);
        } else if (utilization <= CONFIG.moderatePeakThreshold) {
          severity = 'moderate';
        } else if (utilization <= CONFIG.peakThreshold) {
          severity = 'mild';
        }

        if (utilization >= CONFIG.peakThreshold) {
          peakHours.push(hour);
        }

        hourlyPatterns.push({
          hour,
          dayOfWeek: day,
          utilization: Math.min(1, utilization),
          avgBookings: data.bookings / daysToAnalyze * 7, // Weekly average
          avgRevenue: data.revenue / daysToAnalyze * 7,
          isOffPeak: utilization <= CONFIG.offPeakThreshold,
          severity,
        });
      }
    }

    // Remove duplicates from peak/off-peak hours
    peakHours = [...new Set(peakHours)];
    offPeakHours = [...new Set(offPeakHours)];

    // Build daily patterns
    const dailyPatterns: Array<{
      dayOfWeek: number;
      utilization: number;
      avgBookings: number;
      avgRevenue: number;
      isOffPeak: boolean;
      severity: 'none' | 'mild' | 'moderate' | 'severe';
    }> = [];

    const avgDailyBookings = bookings.length / daysToAnalyze;

    for (let day = 0; day < 7; day++) {
      const data = dailyData[day];
      const utilization = data.bookings / (avgDailyBookings * 2);

      let severity: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
      if (utilization <= CONFIG.offPeakThreshold) {
        severity = 'severe';
      } else if (utilization <= CONFIG.moderatePeakThreshold) {
        severity = 'moderate';
      } else if (utilization <= CONFIG.peakThreshold) {
        severity = 'mild';
      }

      dailyPatterns.push({
        dayOfWeek: day,
        utilization: Math.min(1, utilization),
        avgBookings: data.bookings / daysToAnalyze,
        avgRevenue: data.revenue / daysToAnalyze,
        isOffPeak: utilization <= CONFIG.offPeakThreshold,
        severity,
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (offPeakHours.length > 0) {
      recommendations.push(
        `Consider offering discounts during off-peak hours: ${offPeakHours.map(h => `${h}:00`).join(', ')}`
      );
    }
    const slowDays = dailyPatterns.filter(d => d.severity === 'severe' || d.severity === 'moderate');
    if (slowDays.length > 0) {
      recommendations.push(
        `Below-average days: ${slowDays.map(d => CONFIG.dayNames[d.dayOfWeek]).join(', ')}`
      );
    }

    logger.info('Demand pattern analysis completed', {
      totalBookings: bookings.length,
      peakHours: peakHours.length,
      offPeakHours: offPeakHours.length,
      recommendations: recommendations.length,
    });

    return {
      hourlyPatterns,
      dailyPatterns,
      overallUtilization: bookings.length / (daysToAnalyze * 24 * 0.5), // Rough utilization
      peakHours,
      offPeakHours,
      recommendations,
    };
  } catch (error) {
    logger.error('Failed to analyze demand patterns', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate promotion suggestions based on analysis
 */
export async function generatePromotionSuggestions(
  analysis?: Awaited<ReturnType<typeof analyzeDemandPatterns>>
): Promise<IOffPeakPromotion[]> {
  try {
    const patterns = analysis || await analyzeDemandPatterns();
    const suggestions: IOffPeakPromotion[] = [];

    if (patterns.hourlyPatterns.length === 0) {
      logger.info('No promotion suggestions - insufficient data');
      return suggestions;
    }

    // Find worst-performing time slots
    const offPeakSlots = patterns.hourlyPatterns
      .filter(p => p.severity === 'severe' || p.severity === 'moderate')
      .sort((a, b) => a.utilization - b.utilization);

    if (offPeakSlots.length === 0) {
      logger.info('No off-peak slots found');
      return suggestions;
    }

    // Group consecutive off-peak hours
    const hourGroups = groupConsecutiveHours(offPeakSlots.map(s => s.hour));

    for (const hours of hourGroups) {
      if (hours.length === 0) continue;

      const startHour = Math.min(...hours);
      const endHour = Math.max(...hours);

      // Determine discount based on severity
      const avgUtilization = offPeakSlots
        .filter(s => hours.includes(s.hour))
        .reduce((sum: number, s: { utilization: number }) => sum + s.utilization, 0) / hours.length;

      let discountConfig: { min: number; max: number };
      if (avgUtilization <= CONFIG.offPeakThreshold * 0.5) {
        discountConfig = CONFIG.discountRecommendations.severe;
      } else if (avgUtilization <= CONFIG.offPeakThreshold) {
        discountConfig = CONFIG.discountRecommendations.moderate;
      } else {
        discountConfig = CONFIG.discountRecommendations.mild;
      }

      const discountValue = Math.round(
        discountConfig.min + Math.random() * (discountConfig.max - discountConfig.min)
      );

      // Determine target days
      const targetDays = offPeakSlots
        .filter(s => hours.includes(s.hour))
        .map(s => s.dayOfWeek);

      const suggestion = await OffPeakPromotion.create({
        promotionType: 'time_based',
        targetPeriod: {
          startTime: `${startHour.toString().padStart(2, '0')}:00`,
          endTime: `${(endHour + 1).toString().padStart(2, '0')}:00`,
          daysOfWeek: [...new Set(targetDays)],
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        discount: {
          type: 'percentage',
          value: discountValue,
          maxDiscount: 100,
        },
        targetCriteria: {},
        status: 'suggested',
        suggestedBy: 'system',
        metadata: {
          historicalUtilization: avgUtilization,
          projectedUtilization: avgUtilization + 0.2,
          averageBookingValue: offPeakSlots[0]?.avgRevenue || 0,
        },
      });

      suggestions.push(suggestion);

      logger.info('Promotion suggestion generated', {
        suggestionId: suggestion._id.toString(),
        timeSlot: `${startHour}:00-${endHour + 1}:00`,
        discount: discountValue,
      });
    }

    // Check for slow days
    const slowDays = patterns.dailyPatterns.filter(d => d.severity === 'severe' || d.severity === 'moderate');
    if (slowDays.length > 0) {
      const avgUtilization = slowDays.reduce((sum: number, d: { utilization: number }) => sum + d.utilization, 0) / slowDays.length;
      const discountValue = Math.round(
        CONFIG.discountRecommendations.moderate.min +
        Math.random() * (CONFIG.discountRecommendations.moderate.max - CONFIG.discountRecommendations.moderate.min)
      );

      const daySuggestion = await OffPeakPromotion.create({
        promotionType: 'day_based',
        targetPeriod: {
          startTime: '00:00',
          endTime: '23:59',
          daysOfWeek: slowDays.map(d => d.dayOfWeek),
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        discount: {
          type: 'percentage',
          value: discountValue,
          maxDiscount: 100,
        },
        targetCriteria: {},
        status: 'suggested',
        suggestedBy: 'system',
        metadata: {
          historicalUtilization: avgUtilization,
          projectedUtilization: avgUtilization + 0.15,
          averageBookingValue: slowDays[0]?.avgRevenue || 0,
        },
      });

      suggestions.push(daySuggestion);
    }

    return suggestions;
  } catch (error) {
    logger.error('Failed to generate promotion suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Group consecutive hours
 */
function groupConsecutiveHours(hours: number[]): number[][] {
  if (hours.length === 0) return [];

  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const groups: number[][] = [];
  let currentGroup: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1 || sorted[i] === sorted[i - 1]) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  groups.push(currentGroup);

  return groups;
}

/**
 * Approve and create promotion offer
 */
export async function createPromotionOffer(
  promotionId: mongoose.Types.ObjectId,
  additionalConfig?: {
    customDiscount?: number;
    customStartDate?: Date;
    customEndDate?: Date;
    targetServiceIds?: mongoose.Types.ObjectId[];
    targetProviderIds?: mongoose.Types.ObjectId[];
  }
): Promise<IOffPeakPromotion> {
  try {
    const promotion = await OffPeakPromotion.findById(promotionId);
    if (!promotion) {
      throw new Error('Promotion not found');
    }

    if (promotion.status !== 'suggested') {
      throw new Error('Promotion has already been processed');
    }

    // Create the actual offer
    const couponCode = `OFFPEAK${Date.now().toString(36).toUpperCase()}`;
    const offerStartDate = additionalConfig?.customStartDate || promotion.targetPeriod.startDate;
    const offerEndDate = additionalConfig?.customEndDate || promotion.targetPeriod.endDate;
    const discountValue = additionalConfig?.customDiscount || promotion.discount.value;

    const offer = await Coupon.create({
      code: couponCode,
      title: `Off-Peak Promotion: ${promotion.targetPeriod.startTime} - ${promotion.targetPeriod.endTime}`,
      description: 'Special discount during off-peak hours',
      type: promotion.discount.type === 'percentage' ? 'percentage' : 'fixed',
      value: discountValue,
      maxDiscount: promotion.discount.maxDiscount,
      minOrderValue: 0,
      maxUses: 1000,
      maxUsesPerUser: 1,
      currentUses: 0,
      validFrom: offerStartDate,
      validUntil: offerEndDate,
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // Update promotion record
    promotion.offerId = offer._id;
    promotion.status = 'created';
    if (additionalConfig?.customDiscount) {
      promotion.discount.value = additionalConfig.customDiscount;
    }
    await promotion.save();

    logger.info('Promotion offer created', {
      promotionId: promotion._id.toString(),
      offerId: offer._id.toString(),
      couponCode,
    });

    // Send notifications to relevant providers
    if (additionalConfig?.targetProviderIds && additionalConfig.targetProviderIds.length > 0) {
      for (const providerId of additionalConfig.targetProviderIds) {
        await addJob('notification-queue', 'send_notification', {
          userId: providerId.toString(),
          type: 'off_peak_promotion',
          title: 'New Off-Peak Promotion',
          message: `A ${discountValue}% off-peak promotion has been created for your services.`,
          data: {
            promotionId: promotion._id.toString(),
            offerId: offer._id.toString(),
          },
        });
      }
    }

    return promotion;
  } catch (error) {
    logger.error('Failed to create promotion offer', {
      promotionId: promotionId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Track promotion effectiveness
 */
export async function trackPromotionEffectiveness(
  promotionId: mongoose.Types.ObjectId
): Promise<{
  bookingsGenerated: number;
  revenueGenerated: number;
  utilizationLift: number;
  roi: number;
}> {
  try {
    const promotion = await OffPeakPromotion.findById(promotionId);
    if (!promotion) {
      throw new Error('Promotion not found');
    }

    // Get bookings using this promotion during the promotion period
    const bookings = await Booking.find({
      createdAt: {
        $gte: promotion.targetPeriod.startDate,
        $lte: promotion.targetPeriod.endDate,
      },
      'appliedCoupons.code': { $regex: /^OFFPEAK/ },
      status: { $in: ['completed', 'confirmed'] },
    });

    const bookingsGenerated = bookings.length;
    const revenueGenerated = bookings.reduce((sum: number, b: { pricing?: { totalAmount?: number } }) => sum + (b.pricing?.totalAmount || 0), 0);

    // Calculate utilization lift
    const historicalUtilization = promotion.metadata?.historicalUtilization || 0;
    const currentUtilization = await calculateUtilizationDuringPeriod(
      promotion.targetPeriod.startTime,
      promotion.targetPeriod.endTime,
      promotion.targetPeriod.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]
    );
    const utilizationLift = currentUtilization - historicalUtilization;

    // Calculate ROI
    const discountCost = bookings.reduce((sum: number, b: { pricing?: { totalAmount?: number } }) => {
      // Estimate discount amount (simplified)
      const baseAmount = b.pricing?.totalAmount || 0;
      return sum + (baseAmount * (promotion.discount.value / 100));
    }, 0);
    const roi = discountCost > 0 ? (revenueGenerated - discountCost) / discountCost : 0;

    // Update promotion with metrics
    promotion.status = 'completed';
    promotion.actualMetrics = {
      bookingsGenerated,
      revenueGenerated,
      utilizationLift,
      roi,
    };
    await promotion.save();

    logger.info('Promotion effectiveness tracked', {
      promotionId: promotion._id.toString(),
      bookingsGenerated,
      revenueGenerated,
      utilizationLift,
      roi,
    });

    return { bookingsGenerated, revenueGenerated, utilizationLift, roi };
  } catch (error) {
    logger.error('Failed to track promotion effectiveness', {
      promotionId: promotionId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Calculate utilization during a specific period
 */
async function calculateUtilizationDuringPeriod(
  startTime: string,
  endTime: string,
  daysOfWeek: number[]
): Promise<number> {
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  const bookings = await Booking.find({
    status: { $in: ['completed', 'confirmed'] },
  });

  const relevantBookings = bookings.filter(booking => {
    const date = new Date(booking.createdAt);
    return daysOfWeek.includes(date.getDay()) &&
           date.getHours() >= startHour &&
           date.getHours() < endHour;
  });

  // Simplified utilization calculation
  const daysInPeriod = 30;
  const totalSlots = daysInPeriod * (endHour - startHour);
  return totalSlots > 0 ? relevantBookings.length / totalSlots : 0;
}

/**
 * Get off-peak promotion statistics
 */
export async function getOffPeakPromotionStats(): Promise<{
  totalPromotions: number;
  activePromotions: number;
  completedPromotions: number;
  totalBookingsGenerated: number;
  totalRevenueGenerated: number;
  averageUtilizationLift: number;
  averageRoi: number;
  topPerformingPromotion: IOffPeakPromotion | null;
}> {
  const stats = await OffPeakPromotion.aggregate([
    {
      $group: {
        _id: null,
        totalPromotions: { $sum: 1 },
        activePromotions: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        completedPromotions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        totalBookings: { $sum: '$actualMetrics.bookingsGenerated' },
        totalRevenue: { $sum: '$actualMetrics.revenueGenerated' },
        totalUtilizationLift: { $sum: '$actualMetrics.utilizationLift' },
        totalRoi: { $sum: '$actualMetrics.roi' },
      },
    },
  ]);

  const topPerforming = await OffPeakPromotion.findOne({
    status: 'completed',
    'actualMetrics.revenueGenerated': { $gt: 0 },
  }).sort({ 'actualMetrics.roi': -1 });

  const s = stats[0] || {
    totalPromotions: 0,
    activePromotions: 0,
    completedPromotions: 0,
    totalBookings: 0,
    totalRevenue: 0,
    totalUtilizationLift: 0,
    totalRoi: 0,
  };

  return {
    totalPromotions: s.totalPromotions,
    activePromotions: s.activePromotions,
    completedPromotions: s.completedPromotions,
    totalBookingsGenerated: s.totalBookings,
    totalRevenueGenerated: s.totalRevenue,
    averageUtilizationLift: s.completedPromotions > 0
      ? s.totalUtilizationLift / s.completedPromotions
      : 0,
    averageRoi: s.completedPromotions > 0
      ? s.totalRoi / s.completedPromotions
      : 0,
    topPerformingPromotion: topPerforming,
  };
}

/**
 * Run off-peak promotion analysis and generate suggestions
 * Called by scheduled job
 */
export async function runOffPeakPromotionAnalysis(): Promise<{
  analysisCompleted: boolean;
  suggestionsGenerated: number;
}> {
  try {
    logger.info('Starting off-peak promotion analysis...');

    // Analyze demand patterns
    const analysis = await analyzeDemandPatterns(30);

    // Generate suggestions
    const suggestions = await generatePromotionSuggestions(analysis);

    logger.info('Off-peak promotion analysis completed', {
      suggestionsGenerated: suggestions.length,
    });

    return {
      analysisCompleted: true,
      suggestionsGenerated: suggestions.length,
    };
  } catch (error) {
    logger.error('Off-peak promotion analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  analyzeDemandPatterns,
  generatePromotionSuggestions,
  createPromotionOffer,
  trackPromotionEffectiveness,
  getOffPeakPromotionStats,
  runOffPeakPromotionAnalysis,
  OffPeakPromotion,
};
