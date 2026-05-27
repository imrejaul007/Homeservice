import Booking from '../models/booking.model';
import User from '../models/user.model';
import logger from '../utils/logger';

export interface FunnelMetrics {
  signup_started: number;
  signup_completed: number;
  first_booking: number;
  second_booking: number;
  referral_sent: number;
  activation_rate: number;
  retention_day_1: number;
  retention_day_7: number;
  retention_day_30: number;
}

export interface CohortData {
  cohortDate: string;
  cohortSize: number;
  retention: { day: number; rate: number }[];
}

export interface GrowthMetrics {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
  };
  conversion: {
    visitorsToSignups: number;
    signupsToBookings: number;
    bookingsToRepeat: number;
  };
}

class GrowthAnalyticsService {
  async getFunnelMetrics(dateRange?: { start: Date; end: Date }): Promise<FunnelMetrics> {
    const start = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = dateRange?.end || new Date();

    // Count signups
    const signups = await User.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    // Count customers with verified emails
    const signupsCompleted = await User.countDocuments({
      createdAt: { $gte: start, $lte: end },
      role: 'customer',
      isEmailVerified: true,
    });

    // Count first bookings
    const firstBookings = await Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
      { $match: { count: 1 } },
      { $count: 'count' },
    ]);

    // Count second bookings
    const secondBookings = await Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
      { $match: { count: { $gte: 2 } } },
      { $count: 'count' },
    ]);

    // Count referrals sent
    const referralsSent = await User.countDocuments({
      createdAt: { $gte: start, $lte: end },
      'loyaltySystem.referredBy': { $exists: true, $ne: null },
    });

    const firstBookingCount = firstBookings[0]?.count || 0;
    const secondBookingCount = secondBookings[0]?.count || 0;

    return {
      signup_started: signups,
      signup_completed: signupsCompleted,
      first_booking: firstBookingCount,
      second_booking: secondBookingCount,
      referral_sent: referralsSent,
      activation_rate: signups > 0 ? (firstBookingCount / signups) * 100 : 0,
      retention_day_1: await this.calculateRetention(1),
      retention_day_7: await this.calculateRetention(7),
      retention_day_30: await this.calculateRetention(30),
    };
  }

  private async calculateRetention(day: number): Promise<number> {
    const cohortDate = new Date();
    cohortDate.setDate(cohortDate.getDate() - day);
    cohortDate.setHours(0, 0, 0, 0);

    const cohortEnd = new Date(cohortDate);
    cohortEnd.setDate(cohortEnd.getDate() + 1);

    const activityDate = new Date(cohortDate);
    activityDate.setDate(activityDate.getDate() + day);

    const cohortSize = await User.countDocuments({
      createdAt: { $gte: cohortDate, $lt: cohortEnd },
      role: 'customer',
    });

    if (cohortSize === 0) return 0;

    const retained = await Booking.distinct('customerId', {
      createdAt: { $gte: activityDate, $lt: new Date(activityDate.getTime() + 24 * 60 * 60 * 1000) },
    });

    return (retained.length / cohortSize) * 100;
  }

  async getGrowthMetrics(dateRange?: { start: Date; end: Date }): Promise<GrowthMetrics> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [
      totalUsers,
      activeDaily,
      activeWeekly,
      activeMonthly,
      bookingsTotal,
      bookingsCompleted,
      bookingsCancelled,
      revenueTotal,
      revenueThisMonth,
      revenueLastMonth,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } }),
      User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } }),
      Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'completed' }),
      Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'cancelled' }),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
    ]);

    const signups = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const bookings = await Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const uniqueBookers = await Booking.distinct('customerId', { createdAt: { $gte: thirtyDaysAgo } });

    return {
      totalUsers,
      activeUsers: {
        daily: activeDaily,
        weekly: activeWeekly,
        monthly: activeMonthly,
      },
      bookings: {
        total: bookingsTotal,
        completed: bookingsCompleted,
        cancelled: bookingsCancelled,
      },
      revenue: {
        total: revenueTotal[0]?.total || 0,
        thisMonth: revenueThisMonth[0]?.total || 0,
        lastMonth: revenueLastMonth[0]?.total || 0,
      },
      conversion: {
        visitorsToSignups: signups > 0 ? (signups / signups) * 100 : 0, // Would need visitor data
        signupsToBookings: signups > 0 ? (bookings / signups) * 100 : 0,
        bookingsToRepeat: uniqueBookers.length > 0
          ? ((bookings - uniqueBookers.length) / bookings) * 100
          : 0,
      },
    };
  }

  async trackEvent(event: string, userId: string, properties?: Record<string, any>): Promise<void> {
    logger.info('Growth event tracked', { event, userId, properties });
    // In production, this would send to analytics platform
    // e.g., mixpanel.track(event, { distinct_id: userId, ...properties });
  }
}

export const growthAnalyticsService = new GrowthAnalyticsService();
