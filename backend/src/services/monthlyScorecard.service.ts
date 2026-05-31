import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type MetricCategory = 'bookings' | 'revenue' | 'ratings' | 'response' | 'satisfaction' | 'growth';
export type AchievementLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface MetricTarget {
  metricId: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  percentageAchieved: number;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: AchievementLevel;
  criteria: {
    metricId: string;
    minValue: number;
  };
  earnedAt?: Date;
  progress: number;
}

export interface AreaOfImprovement {
  area: string;
  description: string;
  currentValue: number;
  targetValue: number;
  suggestions: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface MonthlyScorecard {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  month: number;
  year: number;
  period: string; // e.g., "2026-05"
  metrics: {
    bookings: {
      totalBookings: number;
      completedBookings: number;
      cancelledBookings: number;
      noShowBookings: number;
      completionRate: number;
      target: number;
    };
    revenue: {
      totalRevenue: number;
      averageBookingValue: number;
      tipsReceived: number;
      target: number;
    };
    ratings: {
      averageRating: number;
      totalReviews: number;
      fiveStarReviews: number;
      responseRate: number;
      target: number;
    };
    response: {
      averageResponseTime: number; // in minutes
      firstResponseTime: number;
      quoteAcceptanceRate: number;
      target: number;
    };
    satisfaction: {
      customerSatisfactionScore: number;
      netPromoterScore: number;
      repeatCustomerRate: number;
      target: number;
    };
    growth: {
      newCustomers: number;
      returningCustomers: number;
      customerRetentionRate: number;
      target: number;
    };
  };
  targets: MetricTarget[];
  achievements: AchievementBadge[];
  areasOfImprovement: AreaOfImprovement[];
  overallScore: number;
  rank: number;
  percentile: number;
  generatedAt: Date;
  createdAt?: Date;
}

export interface ScorecardSummary {
  providerId: string;
  currentMonth: MonthlyScorecard | null;
  previousMonth: MonthlyScorecard | null;
  trend: {
    overallScoreChange: number;
    bookingsChange: number;
    revenueChange: number;
    ratingChange: number;
  };
  recentAchievements: AchievementBadge[];
}

// ============================================
// Mongoose Interface
// ============================================

interface IMonthlyScorecard extends Document, Omit<MonthlyScorecard, '_id'> {}

// ============================================
// Mongoose Schema
// ============================================

const BookingsMetricsSchema = new mongoose.Schema({
  totalBookings: { type: Number, default: 0 },
  completedBookings: { type: Number, default: 0 },
  cancelledBookings: { type: Number, default: 0 },
  noShowBookings: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
}, { _id: false });

const RevenueMetricsSchema = new mongoose.Schema({
  totalRevenue: { type: Number, default: 0 },
  averageBookingValue: { type: Number, default: 0 },
  tipsReceived: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
}, { _id: false });

const RatingsMetricsSchema = new mongoose.Schema({
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  fiveStarReviews: { type: Number, default: 0 },
  responseRate: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
}, { _id: false });

const ResponseMetricsSchema = new mongoose.Schema({
  averageResponseTime: { type: Number, default: 0 },
  firstResponseTime: { type: Number, default: 0 },
  quoteAcceptanceRate: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
}, { _id: false });

const SatisfactionMetricsSchema = new mongoose.Schema({
  customerSatisfactionScore: { type: Number, default: 0 },
  netPromoterScore: { type: Number, default: 0 },
  repeatCustomerRate: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
}, { _id: false });

const GrowthMetricsSchema = new mongoose.Schema({
  newCustomers: { type: Number, default: 0 },
  returningCustomers: { type: Number, default: 0 },
  customerRetentionRate: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
}, { _id: false });

const MetricsSchema = new mongoose.Schema({
  bookings: { type: BookingsMetricsSchema, default: () => ({}) },
  revenue: { type: RevenueMetricsSchema, default: () => ({}) },
  ratings: { type: RatingsMetricsSchema, default: () => ({}) },
  response: { type: ResponseMetricsSchema, default: () => ({}) },
  satisfaction: { type: SatisfactionMetricsSchema, default: () => ({}) },
  growth: { type: GrowthMetricsSchema, default: () => ({}) },
}, { _id: false });

const AchievementBadgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, required: true },
  level: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], required: true },
  criteria: {
    metricId: { type: String, required: true },
    minValue: { type: Number, required: true },
  },
  earnedAt: { type: Date },
  progress: { type: Number, default: 0 },
}, { _id: false });

const AreaOfImprovementSchema = new mongoose.Schema({
  area: { type: String, required: true },
  description: { type: String, required: true },
  currentValue: { type: Number, required: true },
  targetValue: { type: Number, required: true },
  suggestions: [{ type: String }],
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
}, { _id: false });

const MonthlyScorecardSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  period: { type: String, required: true },
  metrics: { type: MetricsSchema, required: true },
  targets: [{
    metricId: { type: String, required: true },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    unit: { type: String, required: true },
    percentageAchieved: { type: Number, default: 0 },
  }],
  achievements: { type: [AchievementBadgeSchema], default: [] },
  areasOfImprovement: { type: [AreaOfImprovementSchema], default: [] },
  overallScore: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
  percentile: { type: Number, default: 0 },
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'monthly_scorecards',
});

MonthlyScorecardSchema.index({ providerId: 1, period: 1 }, { unique: true });
MonthlyScorecardSchema.index({ period: 1, overallScore: -1 });
MonthlyScorecardSchema.index({ providerId: 1, generatedAt: -1 });

// ============================================
// Model Registration
// ============================================

export const MonthlyScorecardModel = mongoose.models.MonthlyScorecard ||
  mongoose.model<IMonthlyScorecard>('MonthlyScorecard', MonthlyScorecardSchema);

// ============================================
// Achievement Definitions
// ============================================

const ACHIEVEMENT_DEFINITIONS: Omit<AchievementBadge, 'earnedAt' | 'progress'>[] = [
  // Booking achievements
  { id: 'booking_streak_bronze', name: 'Booking Streak', description: 'Complete 10 bookings in a month', icon: 'fire', level: 'bronze', criteria: { metricId: 'completedBookings', minValue: 10 } },
  { id: 'booking_streak_silver', name: 'Booking Streak', description: 'Complete 25 bookings in a month', icon: 'fire', level: 'silver', criteria: { metricId: 'completedBookings', minValue: 25 } },
  { id: 'booking_streak_gold', name: 'Booking Streak', description: 'Complete 50 bookings in a month', icon: 'fire', level: 'gold', criteria: { metricId: 'completedBookings', minValue: 50 } },
  { id: 'booking_streak_platinum', name: 'Booking Streak', description: 'Complete 100 bookings in a month', icon: 'fire', level: 'platinum', criteria: { metricId: 'completedBookings', minValue: 100 } },

  // Revenue achievements
  { id: 'revenue_bronze', name: 'Revenue Rookie', description: 'Earn AED 1,000 in a month', icon: 'dollar', level: 'bronze', criteria: { metricId: 'totalRevenue', minValue: 1000 } },
  { id: 'revenue_silver', name: 'Revenue Pro', description: 'Earn AED 5,000 in a month', icon: 'dollar', level: 'silver', criteria: { metricId: 'totalRevenue', minValue: 5000 } },
  { id: 'revenue_gold', name: 'Revenue Expert', description: 'Earn AED 10,000 in a month', icon: 'dollar', level: 'gold', criteria: { metricId: 'totalRevenue', minValue: 10000 } },
  { id: 'revenue_platinum', name: 'Revenue Master', description: 'Earn AED 25,000 in a month', icon: 'dollar', level: 'platinum', criteria: { metricId: 'totalRevenue', minValue: 25000 } },

  // Rating achievements
  { id: 'rating_bronze', name: 'Rising Star', description: 'Achieve 4.0 average rating', icon: 'star', level: 'bronze', criteria: { metricId: 'averageRating', minValue: 4.0 } },
  { id: 'rating_silver', name: 'Top Rated', description: 'Achieve 4.5 average rating', icon: 'star', level: 'silver', criteria: { metricId: 'averageRating', minValue: 4.5 } },
  { id: 'rating_gold', name: 'Superstar', description: 'Achieve 4.8 average rating', icon: 'star', level: 'gold', criteria: { metricId: 'averageRating', minValue: 4.8 } },
  { id: 'rating_platinum', name: 'Legend', description: 'Achieve and maintain 5.0 rating', icon: 'star', level: 'platinum', criteria: { metricId: 'averageRating', minValue: 5.0 } },

  // Response achievements
  { id: 'response_bronze', name: 'Quick Responder', description: 'Respond within 2 hours on average', icon: 'clock', level: 'bronze', criteria: { metricId: 'averageResponseTime', minValue: 120 } },
  { id: 'response_silver', name: 'Fast Responder', description: 'Respond within 1 hour on average', icon: 'clock', level: 'silver', criteria: { metricId: 'averageResponseTime', minValue: 60 } },
  { id: 'response_gold', name: 'Instant Responder', description: 'Respond within 30 minutes on average', icon: 'clock', level: 'gold', criteria: { metricId: 'averageResponseTime', minValue: 30 } },

  // Completion rate achievements
  { id: 'completion_bronze', name: 'Reliable', description: '95% completion rate', icon: 'check', level: 'bronze', criteria: { metricId: 'completionRate', minValue: 95 } },
  { id: 'completion_silver', name: 'Dependable', description: '98% completion rate', icon: 'check', level: 'silver', criteria: { metricId: 'completionRate', minValue: 98 } },
  { id: 'completion_gold', name: 'Unstoppable', description: '100% completion rate', icon: 'check', level: 'gold', criteria: { metricId: 'completionRate', minValue: 100 } },
];

// ============================================
// Service Class
// ============================================

export class MonthlyScorecardService {

  // ========================================
  // Scorecard Generation
  // ========================================

  /**
   * Generate monthly scorecard for a provider
   */
  async generateScorecard(
    providerId: string,
    month: number,
    year: number
  ): Promise<IMonthlyScorecard> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const period = `${year}-${String(month).padStart(2, '0')}`;

    // Check if scorecard already exists
    const existing = await MonthlyScorecardModel.findOne({
      providerId: new Types.ObjectId(providerId),
      period,
    });

    if (existing) {
      throw ApiError.conflict('Scorecard already exists for this period');
    }

    // Gather metrics from various sources
    const metrics = await this.gatherMetrics(providerId, month, year);

    // Calculate targets and progress
    const targets = this.calculateTargets(metrics);

    // Check for achievements
    const achievements = this.calculateAchievements(metrics);

    // Identify areas of improvement
    const areasOfImprovement = this.identifyImprovementAreas(metrics);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics);

    const scorecard = new MonthlyScorecardModel({
      providerId: new Types.ObjectId(providerId),
      month,
      year,
      period,
      metrics,
      targets,
      achievements,
      areasOfImprovement,
      overallScore,
      generatedAt: new Date(),
    });

    await scorecard.save();

    // Update rankings
    await this.updateRankings(period);

    logger.info('Monthly scorecard generated', {
      context: 'MonthlyScorecardService',
      action: 'SCORECARD_GENERATED',
      providerId,
      period,
      overallScore,
    });

    eventBus.publish(EVENT_TYPES.SCORECARD_GENERATED, {
      scorecardId: scorecard._id,
      providerId,
      period,
      overallScore,
    });

    return scorecard;
  }

  /**
   * Gather metrics for a provider for a specific month
   */
  private async gatherMetrics(
    providerId: string,
    month: number,
    year: number
  ): Promise<MonthlyScorecard['metrics']> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const providerObjectId = new Types.ObjectId(providerId);

    // Booking metrics
    const Booking = mongoose.models.Booking;
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const bookingCounts: Record<string, number> = {};
    for (const stat of bookingStats) {
      bookingCounts[stat._id] = stat.count;
    }

    const totalBookings = Object.values(bookingCounts).reduce((a, b) => a + b, 0);
    const completedBookings = bookingCounts['completed'] || 0;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    // Revenue metrics
    const revenueStats = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'completed',
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          averageValue: { $avg: '$pricing.totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const revenueData = revenueStats[0] || { totalRevenue: 0, averageValue: 0, count: 0 };

    // Rating metrics
    const Review = mongoose.models.Review;
    const ratingStats = await Review.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          fiveStarCount: {
            $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] },
          },
        },
      },
    ]);

    const ratingData = ratingStats[0] || { averageRating: 0, totalReviews: 0, fiveStarCount: 0 };

    return {
      bookings: {
        totalBookings,
        completedBookings,
        cancelledBookings: bookingCounts['cancelled'] || 0,
        noShowBookings: bookingCounts['no_show'] || 0,
        completionRate: Math.round(completionRate * 100) / 100,
        target: 50, // Default target
      },
      revenue: {
        totalRevenue: Math.round(revenueData.totalRevenue * 100) / 100,
        averageBookingValue: Math.round(revenueData.averageValue * 100) / 100,
        tipsReceived: 0, // Would come from tipping service
        target: 5000, // Default target
      },
      ratings: {
        averageRating: Math.round((ratingData.averageRating || 0) * 100) / 100,
        totalReviews: ratingData.totalReviews,
        fiveStarReviews: ratingData.fiveStarCount,
        responseRate: 0, // Would come from messaging data
        target: 4.5, // Default target
      },
      response: {
        averageResponseTime: 0, // Would come from messaging data
        firstResponseTime: 0,
        quoteAcceptanceRate: 0,
        target: 60, // 60 minutes default
      },
      satisfaction: {
        customerSatisfactionScore: Math.round((ratingData.averageRating || 0) * 20), // Convert to 0-100
        netPromoterScore: 0, // Would come from NPS survey
        repeatCustomerRate: 0, // Would come from analytics
        target: 80,
      },
      growth: {
        newCustomers: 0, // Would come from customer analytics
        returningCustomers: 0,
        customerRetentionRate: 0,
        target: 10, // Default target
      },
    };
  }

  /**
   * Calculate targets and progress
   */
  private calculateTargets(metrics: MonthlyScorecard['metrics']): MetricTarget[] {
    const targets: MetricTarget[] = [];

    // Booking targets
    targets.push({
      metricId: 'completedBookings',
      targetValue: metrics.bookings.target,
      currentValue: metrics.bookings.completedBookings,
      unit: 'bookings',
      percentageAchieved: metrics.bookings.target > 0
        ? Math.round((metrics.bookings.completedBookings / metrics.bookings.target) * 100)
        : 0,
    });

    // Revenue targets
    targets.push({
      metricId: 'totalRevenue',
      targetValue: metrics.revenue.target,
      currentValue: metrics.revenue.totalRevenue,
      unit: 'AED',
      percentageAchieved: metrics.revenue.target > 0
        ? Math.round((metrics.revenue.totalRevenue / metrics.revenue.target) * 100)
        : 0,
    });

    // Rating targets
    targets.push({
      metricId: 'averageRating',
      targetValue: metrics.ratings.target,
      currentValue: metrics.ratings.averageRating,
      unit: 'stars',
      percentageAchieved: metrics.ratings.target > 0
        ? Math.round((metrics.ratings.averageRating / metrics.ratings.target) * 100)
        : 0,
    });

    // Response time targets (inverse - lower is better)
    targets.push({
      metricId: 'averageResponseTime',
      targetValue: metrics.response.target,
      currentValue: metrics.response.averageResponseTime,
      unit: 'minutes',
      percentageAchieved: metrics.response.averageResponseTime > 0 && metrics.response.target > 0
        ? Math.round((metrics.response.target / metrics.response.averageResponseTime) * 100)
        : 100,
    });

    return targets;
  }

  /**
   * Calculate achievements
   */
  private calculateAchievements(metrics: MonthlyScorecard['metrics']): AchievementBadge[] {
    const earned: AchievementBadge[] = [];

    for (const achievement of ACHIEVEMENT_DEFINITIONS) {
      let currentValue = 0;

      switch (achievement.criteria.metricId) {
        case 'completedBookings':
          currentValue = metrics.bookings.completedBookings;
          break;
        case 'totalRevenue':
          currentValue = metrics.revenue.totalRevenue;
          break;
        case 'averageRating':
          currentValue = metrics.ratings.averageRating;
          break;
        case 'averageResponseTime':
          // For response time, lower is better
          currentValue = metrics.response.averageResponseTime;
          break;
        case 'completionRate':
          currentValue = metrics.bookings.completionRate;
          break;
        default:
          continue;
      }

      const progress = achievement.criteria.metricId === 'averageResponseTime'
        ? Math.min(100, (achievement.criteria.minValue / Math.max(currentValue, 1)) * 100)
        : Math.min(100, (currentValue / achievement.criteria.minValue) * 100);

      if (currentValue >= achievement.criteria.minValue ||
          (achievement.criteria.metricId === 'averageResponseTime' && currentValue <= achievement.criteria.minValue)) {
        earned.push({
          ...achievement,
          earnedAt: new Date(),
          progress: 100,
        });
      } else {
        earned.push({
          ...achievement,
          progress: Math.round(progress),
        });
      }
    }

    return earned;
  }

  /**
   * Identify areas of improvement
   */
  private identifyImprovementAreas(metrics: MonthlyScorecard['metrics']): AreaOfImprovement[] {
    const areas: AreaOfImprovement[] = [];

    // Check completion rate
    if (metrics.bookings.completionRate < 95) {
      areas.push({
        area: 'Completion Rate',
        description: `Your completion rate is ${metrics.bookings.completionRate.toFixed(1)}%. Aim for 95%+ to build customer trust.`,
        currentValue: metrics.bookings.completionRate,
        targetValue: 95,
        suggestions: [
          'Send reminders to customers before appointments',
          'Implement a cancellation policy',
          'Block time slots you cannot fulfill',
        ],
        priority: metrics.bookings.completionRate < 90 ? 'high' : 'medium',
      });
    }

    // Check response time
    if (metrics.response.averageResponseTime > 60) {
      areas.push({
        area: 'Response Time',
        description: `Your average response time is ${metrics.response.averageResponseTime.toFixed(0)} minutes. Faster responses lead to more bookings.`,
        currentValue: metrics.response.averageResponseTime,
        targetValue: 60,
        suggestions: [
          'Enable push notifications',
          'Use quick reply templates',
          'Set specific times for checking messages',
        ],
        priority: metrics.response.averageResponseTime > 120 ? 'high' : 'medium',
      });
    }

    // Check ratings
    if (metrics.ratings.averageRating < 4.5) {
      areas.push({
        area: 'Customer Ratings',
        description: `Your average rating is ${metrics.ratings.averageRating.toFixed(1)} stars. Improve to 4.5+ for better visibility.`,
        currentValue: metrics.ratings.averageRating,
        targetValue: 4.5,
        suggestions: [
          'Follow up after each booking',
          'Address customer concerns promptly',
          'Ask satisfied customers to leave reviews',
        ],
        priority: metrics.ratings.averageRating < 4.0 ? 'high' : 'medium',
      });
    }

    // Check revenue
    if (metrics.revenue.totalRevenue < metrics.revenue.target * 0.7) {
      areas.push({
        area: 'Revenue',
        description: `You're at ${Math.round((metrics.revenue.totalRevenue / metrics.revenue.target) * 100)}% of your revenue target.`,
        currentValue: metrics.revenue.totalRevenue,
        targetValue: metrics.revenue.target,
        suggestions: [
          'Offer additional services to existing customers',
          'Update your service pricing',
          'Promote your profile to new customers',
        ],
        priority: 'medium',
      });
    }

    return areas;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(metrics: MonthlyScorecard['metrics']): number {
    // Weighted average of different metrics
    const weights = {
      bookings: 0.20,
      revenue: 0.25,
      ratings: 0.25,
      response: 0.15,
      satisfaction: 0.10,
      growth: 0.05,
    };

    // Calculate component scores (0-100)
    const bookingScore = metrics.bookings.completionRate;
    const revenueScore = metrics.revenue.target > 0
      ? Math.min(100, (metrics.revenue.totalRevenue / metrics.revenue.target) * 100)
      : 0;
    const ratingScore = (metrics.ratings.averageRating / 5) * 100;
    const responseScore = metrics.response.target > 0 && metrics.response.averageResponseTime > 0
      ? Math.min(100, (metrics.response.target / metrics.response.averageResponseTime) * 100)
      : 100;
    const satisfactionScore = metrics.satisfaction.customerSatisfactionScore;
    const growthScore = Math.min(100, (metrics.growth.newCustomers / metrics.growth.target) * 100);

    const overallScore = (
      weights.bookings * bookingScore +
      weights.revenue * revenueScore +
      weights.ratings * ratingScore +
      weights.response * responseScore +
      weights.satisfaction * satisfactionScore +
      weights.growth * growthScore
    );

    return Math.round(overallScore * 100) / 100;
  }

  // ========================================
  // Rankings
  // ========================================

  /**
   * Update rankings for a period
   */
  private async updateRankings(period: string): Promise<void> {
    const scorecards = await MonthlyScorecardModel.find({ period })
      .sort({ overallScore: -1 });

    for (let i = 0; i < scorecards.length; i++) {
      const scorecard = scorecards[i];
      const percentile = Math.round(((scorecards.length - i) / scorecards.length) * 100);

      scorecard.rank = i + 1;
      scorecard.percentile = percentile;
      await scorecard.save();
    }
  }

  // ========================================
  // Scorecard Queries
  // ========================================

  /**
   * Get scorecard for a specific month
   */
  async getScorecard(providerId: string, month: number, year: number): Promise<IMonthlyScorecard | null> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const period = `${year}-${String(month).padStart(2, '0')}`;

    return MonthlyScorecardModel.findOne({
      providerId: new Types.ObjectId(providerId),
      period,
    });
  }

  /**
   * Get latest scorecard for a provider
   */
  async getLatestScorecard(providerId: string): Promise<IMonthlyScorecard | null> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    return MonthlyScorecardModel.findOne({
      providerId: new Types.ObjectId(providerId),
    }).sort({ generatedAt: -1 });
  }

  /**
   * Get scorecard summary with trends
   */
  async getScorecardSummary(providerId: string): Promise<ScorecardSummary> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [current, previous] = await Promise.all([
      this.getScorecard(providerId, currentMonth, currentYear),
      this.getScorecard(providerId, currentMonth - 1 || 12, currentMonth - 1 > 0 ? currentYear : currentYear - 1),
    ]);

    const trend = {
      overallScoreChange: current && previous
        ? current.overallScore - previous.overallScore
        : 0,
      bookingsChange: current && previous
        ? current.metrics.bookings.completedBookings - previous.metrics.bookings.completedBookings
        : 0,
      revenueChange: current && previous
        ? current.metrics.revenue.totalRevenue - previous.metrics.revenue.totalRevenue
        : 0,
      ratingChange: current && previous
        ? current.metrics.ratings.averageRating - previous.metrics.ratings.averageRating
        : 0,
    };

    // Get recent achievements from current or previous scorecard
    const recentScorecard = current || previous;
    const recentAchievements = recentScorecard?.achievements.filter(a => a.earnedAt) || [];

    return {
      providerId,
      currentMonth: current,
      previousMonth: previous,
      trend,
      recentAchievements,
    };
  }

  /**
   * Get scorecard history for a provider
   */
  async getScorecardHistory(
    providerId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ scorecards: IMonthlyScorecard[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { page = 1, limit = 12 } = options;
    const skip = (page - 1) * limit;

    const [scorecards, total] = await Promise.all([
      MonthlyScorecardModel.find({ providerId: new Types.ObjectId(providerId) })
        .sort({ period: -1 })
        .skip(skip)
        .limit(limit),
      MonthlyScorecardModel.countDocuments({ providerId: new Types.ObjectId(providerId) }),
    ]);

    return {
      scorecards,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get leaderboard for a period
   */
  async getLeaderboard(
    period?: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ scorecards: IMonthlyScorecard[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (period) query.period = period;

    const [scorecards, total] = await Promise.all([
      MonthlyScorecardModel.find(query)
        .populate('providerId', 'firstName lastName avatar')
        .sort({ overallScore: -1, rank: 1 })
        .skip(skip)
        .limit(limit),
      MonthlyScorecardModel.countDocuments(query),
    ]);

    return {
      scorecards,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}

// ============================================
// Export Singleton
// ============================================

export const monthlyScorecardService = new MonthlyScorecardService();
export default monthlyScorecardService;
