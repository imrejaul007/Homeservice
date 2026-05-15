import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// ============================================
// INTERFACES
// ============================================

export interface CancellationRisk {
  bookingId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: CancellationFactor[];
  probability: number; // 0-1
  recommendedActions: string[];
  predictedAt: Date;
}

export interface CancellationFactor {
  type: string;
  weight: number;
  description: string;
  riskContribution: number;
}

export interface BookingCancellationPrediction {
  bookingId: string;
  customerId?: string;
  customerName: string;
  scheduledDate: Date;
  scheduledTime: string;
  serviceName: string;
  totalAmount: number;
  riskAssessment: CancellationRisk;
}

export interface ProviderCancellationStats {
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  customerInitiatedCancellations: number;
  providerInitiatedCancellations: number;
  systemCancellations: number;
  averageCancellationTime: number; // hours before scheduled time
  commonReasons: Array<{ reason: string; count: number; percentage: number }>;
  highRiskBookings: BookingCancellationPrediction[];
  trend: 'improving' | 'stable' | 'worsening';
  period: string;
}

export interface CustomerCancellationProfile {
  customerId: string;
  customerName: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  averageBookingValue: number;
  repeatCustomer: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  factors: Array<{
    type: string;
    value: any;
    riskImpact: number;
  }>;
  lastBookingDate?: Date;
  lastCancellationDate?: Date;
  accountAge: number; // days
}

// ============================================
// RISK WEIGHTS CONFIGURATION
// ============================================

const RISK_CONFIG = {
  // Time-based factors
  SHORT_NOTICE_THRESHOLD_HOURS: 24,
  VERY_SHORT_NOTICE_THRESHOLD_HOURS: 4,

  // Customer history factors
  HIGH_CANCELLATION_RATE_THRESHOLD: 0.25,
  MODERATE_CANCELLATION_RATE_THRESHOLD: 0.15,

  // Booking factors
  HIGH_VALUE_THRESHOLD_AED: 500,
  GUEST_BOOKING_PENALTY: 15,
  NEW_CUSTOMER_PENALTY: 10,

  // Recency factors (in days)
  RECENT_CANCELLATION_WINDOW: 30,
  RECENCY_PENALTY: 10,

  // Provider factors
  HIGH_PROVIDER_CANCELLATION_RATE: 0.15,

  // Weather/workload factors (placeholder for future integration)
  HOLIDAY_BOOST_DEMAND: true,

  // ML model weights (simplified rule-based for now)
  WEIGHTS: {
    customerHistory: 0.30,
    bookingTiming: 0.25,
    bookingValue: 0.15,
    customerType: 0.10,
    providerHistory: 0.10,
    recency: 0.10
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getCached = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 300): Promise<T> => {
  try {
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache miss
  }

  const data = await fetchFn();

  try {
    await cache.set(key, JSON.stringify(data), ttl);
  } catch {
    // Cache write error
  }

  return data;
};

const calculateHoursUntilService = (scheduledDate: Date, scheduledTime: string): number => {
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const serviceTime = new Date(scheduledDate);
  serviceTime.setHours(hours, minutes, 0, 0);

  const now = new Date();
  return (serviceTime.getTime() - now.getTime()) / (1000 * 60 * 60);
};

// ============================================
// CUSTOMER CANCELLATION PROFILE
// ============================================

export const getCustomerCancellationProfile = async (
  customerId: string
): Promise<CustomerCancellationProfile> => {
  const cacheKey = `cancellation:customer-profile:${customerId}`;
  const ttl = 600;

  return getCached(cacheKey, async () => {
    const customerObjectId = new Types.ObjectId(customerId);

    // Get customer info
    const customer = await User.findById(customerObjectId).select('firstName lastName createdAt').lean();

    // Get booking history
    const bookings = await Booking.find({
      customerId: customerObjectId,
      status: { $in: ['completed', 'cancelled', 'no_show'] }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const noShows = bookings.filter(b => b.status === 'no_show').length;

    const cancellationRate = totalBookings > 0
      ? (cancelledBookings + noShows) / totalBookings
      : 0;

    const totalSpent = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + b.pricing.totalAmount, 0);

    const averageBookingValue = completedBookings > 0
      ? totalSpent / completedBookings
      : 0;

    // Calculate account age
    const accountAge = customer
      ? Math.floor((Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Check for recent cancellations
    const recentCancellations = bookings.filter(b =>
      b.status === 'cancelled' &&
      b.cancelledAt &&
      (Date.now() - b.cancelledAt.getTime()) < RISK_CONFIG.RECENT_CANCELLATION_WINDOW * 24 * 60 * 60 * 1000
    );

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (cancellationRate > RISK_CONFIG.HIGH_CANCELLATION_RATE_THRESHOLD) {
      riskLevel = 'high';
    } else if (cancellationRate > RISK_CONFIG.MODERATE_CANCELLATION_RATE_THRESHOLD) {
      riskLevel = 'medium';
    }

    // Build risk factors
    const factors: Array<{ type: string; value: any; riskImpact: number }> = [];

    if (cancellationRate > 0.25) {
      factors.push({
        type: 'high_cancellation_rate',
        value: `${(cancellationRate * 100).toFixed(0)}%`,
        riskImpact: 30
      });
    }

    if (accountAge < 7) {
      factors.push({
        type: 'new_customer',
        value: `${accountAge} days`,
        riskImpact: RISK_CONFIG.NEW_CUSTOMER_PENALTY
      });
    }

    if (recentCancellations.length > 0) {
      factors.push({
        type: 'recent_cancellation',
        value: `${recentCancellations.length} in last ${RISK_CONFIG.RECENT_CANCELLATION_WINDOW} days`,
        riskImpact: RISK_CONFIG.RECENCY_PENALTY
      });
    }

    if (totalBookings === 0) {
      factors.push({
        type: 'no_history',
        value: 'First-time customer',
        riskImpact: 5
      });
    }

    return {
      customerId,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
      totalBookings,
      completedBookings,
      cancelledBookings,
      cancellationRate,
      averageBookingValue,
      repeatCustomer: completedBookings > 1,
      riskLevel,
      factors,
      lastBookingDate: bookings[0]?.createdAt,
      lastCancellationDate: cancelledBookings > 0
        ? bookings.find(b => b.status === 'cancelled')?.cancelledAt
        : undefined,
      accountAge
    };
  }, ttl);
};

// ============================================
// BOOKING CANCELLATION PREDICTION
// ============================================

export const predictBookingCancellation = async (
  bookingId: string
): Promise<CancellationRisk> => {
  const cacheKey = `cancellation:prediction:${bookingId}`;
  const ttl = 60; // Short TTL for real-time predictions

  return getCached(cacheKey, async () => {
    const booking = await Booking.findById(bookingId)
      .populate('serviceId', 'name')
      .populate('customerId', 'firstName lastName createdAt')
      .lean();

    if (!booking) {
      throw new Error('Booking not found');
    }

    const factors: CancellationFactor[] = [];
    let totalRiskScore = 0;

    // 1. Time-based factors
    const hoursUntilService = calculateHoursUntilService(
      booking.scheduledDate,
      booking.scheduledTime
    );

    if (hoursUntilService < RISK_CONFIG.VERY_SHORT_NOTICE_THRESHOLD_HOURS) {
      factors.push({
        type: 'very_short_notice',
        weight: RISK_CONFIG.WEIGHTS.bookingTiming,
        description: `Booking is within ${RISK_CONFIG.VERY_SHORT_NOTICE_THRESHOLD_HOURS} hours of service time`,
        riskContribution: 25
      });
      totalRiskScore += 25;
    } else if (hoursUntilService < RISK_CONFIG.SHORT_NOTICE_THRESHOLD_HOURS) {
      factors.push({
        type: 'short_notice',
        weight: RISK_CONFIG.WEIGHTS.bookingTiming,
        description: `Booking is within ${RISK_CONFIG.SHORT_NOTICE_THRESHOLD_HOURS} hours of service time`,
        riskContribution: 15
      });
      totalRiskScore += 15;
    }

    // 2. Customer history factors
    if (booking.customerId) {
      const customerProfile = await getCustomerCancellationProfile(booking.customerId.toString());

      if (customerProfile.cancellationRate > RISK_CONFIG.HIGH_CANCELLATION_RATE_THRESHOLD) {
        factors.push({
          type: 'customer_high_cancellation_history',
          weight: RISK_CONFIG.WEIGHTS.customerHistory,
          description: `Customer has ${(customerProfile.cancellationRate * 100).toFixed(0)}% cancellation rate`,
          riskContribution: 30
        });
        totalRiskScore += 30;
      } else if (customerProfile.cancellationRate > RISK_CONFIG.MODERATE_CANCELLATION_RATE_THRESHOLD) {
        factors.push({
          type: 'customer_moderate_cancellation_history',
          weight: RISK_CONFIG.WEIGHTS.customerHistory,
          description: `Customer has ${(customerProfile.cancellationRate * 100).toFixed(0)}% cancellation rate`,
          riskContribution: 15
        });
        totalRiskScore += 15;
      }

      // New customer
      if (customerProfile.accountAge < 7) {
        factors.push({
          type: 'new_customer',
          weight: RISK_CONFIG.WEIGHTS.customerType,
          description: `Customer account is ${customerProfile.accountAge} days old`,
          riskContribution: RISK_CONFIG.NEW_CUSTOMER_PENALTY
        });
        totalRiskScore += RISK_CONFIG.NEW_CUSTOMER_PENALTY;
      }

      // First booking
      if (customerProfile.totalBookings === 0) {
        factors.push({
          type: 'first_booking',
          weight: RISK_CONFIG.WEIGHTS.customerType,
          description: 'Customer has no booking history',
          riskContribution: 10
        });
        totalRiskScore += 10;
      }

      // Recent cancellation
      if (customerProfile.lastCancellationDate) {
        const daysSinceCancellation = Math.floor(
          (Date.now() - customerProfile.lastCancellationDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCancellation < RISK_CONFIG.RECENT_CANCELLATION_WINDOW) {
          factors.push({
            type: 'recent_cancellation',
            weight: RISK_CONFIG.WEIGHTS.recency,
            description: `Customer cancelled ${daysSinceCancellation} days ago`,
            riskContribution: RISK_CONFIG.RECENCY_PENALTY
          });
          totalRiskScore += RISK_CONFIG.RECENCY_PENALTY;
        }
      }
    }

    // 3. Booking value factors
    if (booking.pricing.totalAmount > RISK_CONFIG.HIGH_VALUE_THRESHOLD_AED) {
      factors.push({
        type: 'high_value_booking',
        weight: RISK_CONFIG.WEIGHTS.bookingValue,
        description: `Booking value is ${booking.pricing.totalAmount} AED (threshold: ${RISK_CONFIG.HIGH_VALUE_THRESHOLD_AED} AED)`,
        riskContribution: 10
      });
      totalRiskScore += 10;
    }

    // 4. Guest booking
    if (booking.isGuestBooking) {
      factors.push({
        type: 'guest_booking',
        weight: RISK_CONFIG.WEIGHTS.customerType,
        description: 'Guest booking without registered account',
        riskContribution: RISK_CONFIG.GUEST_BOOKING_PENALTY
      });
      totalRiskScore += RISK_CONFIG.GUEST_BOOKING_PENALTY;
    }

    // 5. Provider history (optional - for future implementation)
    // This would check the provider's cancellation rate

    // Normalize risk score to 0-100
    const normalizedScore = Math.min(100, Math.max(0, totalRiskScore));

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (normalizedScore >= 75) {
      riskLevel = 'critical';
    } else if (normalizedScore >= 50) {
      riskLevel = 'high';
    } else if (normalizedScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Generate recommended actions
    const recommendedActions: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendedActions.push('Consider requiring a deposit or prepayment');
      recommendedActions.push('Send confirmation message to customer');
      recommendedActions.push('Have backup availability ready');
    }

    if (factors.some(f => f.type.includes('short_notice'))) {
      recommendedActions.push('Send reminder 24 hours before appointment');
      recommendedActions.push('Confirm availability with customer');
    }

    if (factors.some(f => f.type.includes('new_customer') || f.type.includes('first_booking'))) {
      recommendedActions.push('Provide excellent service to encourage repeat booking');
      recommendedActions.push('Consider offering a loyalty discount for future bookings');
    }

    if (factors.some(f => f.type.includes('guest'))) {
      recommendedActions.push('Collect additional contact information');
      recommendedActions.push('Request phone number for SMS reminders');
    }

    if (normalizedScore < 25) {
      recommendedActions.push('Standard booking - no special action required');
    }

    return {
      bookingId,
      riskScore: normalizedScore,
      riskLevel,
      factors,
      probability: normalizedScore / 100,
      recommendedActions,
      predictedAt: new Date()
    };
  }, ttl);
};

// ============================================
// PROVIDER CANCELLATION STATISTICS
// ============================================

export const getProviderCancellationStats = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<ProviderCancellationStats> => {
  const cacheKey = `cancellation:provider-stats:${providerId}:${period}`;
  const ttl = 600;

  return getCached(cacheKey, async () => {
    const providerObjectId = new Types.ObjectId(providerId);
    const now = new Date();

    let startDate: Date;
    let previousStartDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
        break;
    }

    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Get cancellation stats
    const cancellationStats = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get cancellation details
    const cancellationDetails = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'cancelled',
          cancelledAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$cancellationDetails.cancelledBy',
          count: { $sum: 1 },
          avgTimeBeforeService: {
            $avg: {
              $divide: [
                { $subtract: ['$scheduledDate', '$cancelledAt'] },
                3600000 // Convert to hours
              ]
            }
          }
        }
      }
    ]);

    // Get common cancellation reasons
    const cancellationReasons = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'cancelled',
          'cancellationDetails.reason': { $exists: true, $ne: '' },
          cancelledAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$cancellationDetails.reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get previous period stats for trend
    const previousPeriodStats = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: previousStartDate, $lt: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Identify high-risk upcoming bookings
    const upcomingBookings = await Booking.find({
      providerId: providerObjectId,
      scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      status: { $in: ['pending', 'confirmed'] }
    })
      .populate('serviceId', 'name')
      .populate('customerId', 'firstName lastName')
      .limit(20)
      .lean();

    const highRiskBookings: BookingCancellationPrediction[] = [];

    for (const booking of upcomingBookings) {
      try {
        const risk = await predictBookingCancellation(booking._id.toString());
        if (risk.riskLevel === 'high' || risk.riskLevel === 'critical') {
          highRiskBookings.push({
            bookingId: booking._id.toString(),
            customerId: booking.customerId?.toString(),
            customerName: booking.customerId
              ? `${(booking.customerId as any).firstName} ${(booking.customerId as any).lastName}`
              : (booking.guestInfo?.name || 'Guest'),
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
            serviceName: (booking.serviceId as any)?.name || 'Unknown Service',
            totalAmount: booking.pricing.totalAmount,
            riskAssessment: risk
          });
        }
      } catch {
        // Skip if prediction fails
      }
    }

    // Process stats
    const statsMap = new Map<string, number>();
    cancellationStats.forEach((s: any) => statsMap.set(s._id, s.count));

    const previousStatsMap = new Map<string, number>();
    previousPeriodStats.forEach((s: any) => previousStatsMap.set(s._id, s.count));

    const totalBookings = Array.from(statsMap.values()).reduce((sum, count) => sum + count, 0);
    const cancelledBookings = statsMap.get('cancelled') || 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

    const previousTotal = Array.from(previousStatsMap.values()).reduce((sum, count) => sum + count, 0);
    const previousCancelled = previousStatsMap.get('cancelled') || 0;
    const previousRate = previousTotal > 0 ? (previousCancelled / previousTotal) * 100 : 0;

    // Determine trend
    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    if (cancellationRate < previousRate - 2) {
      trend = 'improving';
    } else if (cancellationRate > previousRate + 2) {
      trend = 'worsening';
    }

    // Process cancellation details
    const detailsMap = new Map<string, any>();
    cancellationDetails.forEach((d: any) => detailsMap.set(d._id, d));

    const totalCancellations = cancelledBookings;
    const customerInitiated = detailsMap.get('customer')?.count || 0;
    const providerInitiated = detailsMap.get('provider')?.count || 0;
    const systemCancellations = detailsMap.get('system')?.count || 0;

    const avgCancellationTime = cancellationDetails.length > 0
      ? cancellationDetails.reduce((sum: number, d: any) => sum + (d.avgTimeBeforeService || 0), 0) / cancellationDetails.length
      : 0;

    // Process reasons
    const commonReasons = cancellationReasons.map((r: any) => ({
      reason: r._id || 'No reason provided',
      count: r.count,
      percentage: totalCancellations > 0 ? (r.count / totalCancellations) * 100 : 0
    }));

    return {
      totalBookings,
      cancelledBookings,
      cancellationRate,
      customerInitiatedCancellations: customerInitiated,
      providerInitiatedCancellations: providerInitiated,
      systemCancellations,
      averageCancellationTime: avgCancellationTime,
      commonReasons,
      highRiskBookings,
      trend,
      period
    };
  }, ttl);
};

// ============================================
// BATCH PREDICTION
// ============================================

export const predictUpcomingCancellations = async (
  providerId: string,
  days: number = 7
): Promise<BookingCancellationPrediction[]> => {
  const cacheKey = `cancellation:upcoming:${providerId}:${days}`;
  const ttl = 300;

  return getCached(cacheKey, async () => {
    const providerObjectId = new Types.ObjectId(providerId);
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcomingBookings = await Booking.find({
      providerId: providerObjectId,
      scheduledDate: { $gte: now, $lte: futureDate },
      status: { $in: ['pending', 'confirmed'] }
    })
      .populate('serviceId', 'name')
      .populate('customerId', 'firstName lastName')
      .lean();

    const predictions: BookingCancellationPrediction[] = [];

    for (const booking of upcomingBookings) {
      try {
        const risk = await predictBookingCancellation(booking._id.toString());
        predictions.push({
          bookingId: booking._id.toString(),
          customerId: booking.customerId?.toString(),
          customerName: booking.customerId
            ? `${(booking.customerId as any).firstName} ${(booking.customerId as any).lastName}`
            : (booking.guestInfo?.name || 'Guest'),
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          serviceName: (booking.serviceId as any)?.name || 'Unknown Service',
          totalAmount: booking.pricing.totalAmount,
          riskAssessment: risk
        });
      } catch {
        // Skip failed predictions
      }
    }

    // Sort by risk score descending
    predictions.sort((a, b) => b.riskAssessment.riskScore - a.riskAssessment.riskScore);

    return predictions;
  }, ttl);
};

// ============================================
// NO-SHOW PREDICTION
// ============================================

export interface NoShowRisk {
  bookingId: string;
  customerName: string;
  scheduledDate: Date;
  scheduledTime: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
}

export const predictNoShows = async (
  providerId: string,
  date: Date
): Promise<NoShowRisk[]> => {
  const providerObjectId = new Types.ObjectId(providerId);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const bookings = await Booking.find({
    providerId: providerObjectId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: 'confirmed'
  })
    .populate('customerId', 'firstName lastName')
    .lean();

  const noShowRisks: NoShowRisk[] = [];

  for (const booking of bookings) {
    const factors: string[] = [];
    let riskScore = 0;

    // Check customer history
    if (booking.customerId) {
      const customerProfile = await getCustomerCancellationProfile(booking.customerId.toString());

      // No-show history
      const noShowHistory = await Booking.countDocuments({
        customerId: booking.customerId,
        status: 'no_show'
      });

      if (noShowHistory > 0) {
        factors.push(`Previous no-shows: ${noShowHistory}`);
        riskScore += 25 * Math.min(noShowHistory, 3);
      }

      // New customer
      if (customerProfile.accountAge < 7) {
        factors.push('New customer');
        riskScore += 10;
      }

      // First booking
      if (customerProfile.totalBookings <= 1) {
        factors.push('First-time customer');
        riskScore += 15;
      }
    }

    // Guest booking
    if (booking.isGuestBooking) {
      factors.push('Guest booking');
      riskScore += 20;
    }

    // Early morning appointments
    const hour = parseInt(booking.scheduledTime.split(':')[0]);
    if (hour < 9) {
      factors.push('Early morning appointment');
      riskScore += 10;
    }

    // Late afternoon (after 6 PM)
    if (hour >= 18) {
      factors.push('Evening appointment');
      riskScore += 5;
    }

    const normalizedScore = Math.min(100, riskScore);
    const riskLevel: 'low' | 'medium' | 'high' =
      normalizedScore >= 50 ? 'high' :
      normalizedScore >= 25 ? 'medium' : 'low';

    if (riskLevel !== 'low') {
      noShowRisks.push({
        bookingId: booking._id.toString(),
        customerName: booking.customerId
          ? `${(booking.customerId as any).firstName} ${(booking.customerId as any).lastName}`
          : (booking.guestInfo?.name || 'Guest'),
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        riskScore: normalizedScore,
        riskLevel,
        factors
      });
    }
  }

  return noShowRisks.sort((a, b) => b.riskScore - a.riskScore);
};

// ============================================
// PREVENTION RECOMMENDATIONS
// ============================================

export interface PreventionRecommendation {
  type: 'reminder' | 'confirmation' | 'deposit' | 'follow_up';
  priority: 'high' | 'medium' | 'low';
  targetBookings: string[];
  message: string;
  estimatedImpact: number; // Percentage reduction in cancellations
}

export const getCancellationPreventionRecommendations = async (
  providerId: string
): Promise<PreventionRecommendation[]> => {
  const stats = await getProviderCancellationStats(providerId, 'month');
  const recommendations: PreventionRecommendation[] = [];

  // High cancellation rate recommendations
  if (stats.cancellationRate > 15) {
    recommendations.push({
      type: 'reminder',
      priority: 'high',
      targetBookings: stats.highRiskBookings.map(b => b.bookingId),
      message: 'Send reminder SMS 24 hours before appointment',
      estimatedImpact: 15
    });

    recommendations.push({
      type: 'confirmation',
      priority: 'high',
      targetBookings: stats.highRiskBookings.map(b => b.bookingId),
      message: 'Request booking confirmation 2 hours before service time',
      estimatedImpact: 20
    });
  }

  // Short-notice cancellation recommendations
  const shortNoticeReasons = stats.commonReasons.filter(r =>
    r.reason.toLowerCase().includes('schedule') ||
    r.reason.toLowerCase().includes('conflict') ||
    r.reason.toLowerCase().includes('busy')
  );

  if (shortNoticeReasons.length > 0) {
    recommendations.push({
      type: 'deposit',
      priority: 'medium',
      targetBookings: [],
      message: 'Require prepayment or deposit for bookings within 48 hours',
      estimatedImpact: 25
    });
  }

  // New customer recommendations
  recommendations.push({
    type: 'follow_up',
    priority: 'medium',
    targetBookings: [],
    message: 'Follow up with new customers after their first service to reduce future cancellations',
    estimatedImpact: 10
  });

  // Sort by priority and impact
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    b.estimatedImpact - a.estimatedImpact
  );

  return recommendations;
};

// ============================================
// CLEAR CACHE
// ============================================

export const clearCancellationCache = async (providerId: string): Promise<void> => {
  try {
    const patterns = [
      `cancellation:customer-profile:*`,
      `cancellation:provider-stats:${providerId}:*`,
      `cancellation:upcoming:${providerId}:*`,
      `cancellation:prediction:*`
    ];

    for (const pattern of patterns) {
      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        await cache.del(...keys);
      }
    }

    logger.info('Cancellation cache cleared', { providerId });
  } catch (error) {
    logger.error('Failed to clear cancellation cache', { error, providerId });
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  getCustomerCancellationProfile,
  predictBookingCancellation,
  getProviderCancellationStats,
  predictUpcomingCancellations,
  predictNoShows,
  getCancellationPreventionRecommendations,
  clearCancellationCache
};
