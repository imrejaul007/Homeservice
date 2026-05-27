import Booking from '../../models/booking.model';
import User from '../../models/user.model';
import logger from '../../utils/logger';

export interface ChurnRisk {
  customerId: string;
  riskScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recommendedActions: string[];
  lastActivity?: Date;
  predictedChurnDate?: Date;
}

export interface EngagementMetrics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  lastBookingDate?: Date;
  daysSinceLastBooking: number;
  bookingFrequency: number; // bookings per month
}

class ChurnPredictionService {
  private readonly HIGH_CHURN_THRESHOLD = 0.7;
  private readonly MEDIUM_CHURN_THRESHOLD = 0.4;

  /**
   * Predict churn risk for a customer
   */
  async predictChurnRisk(customerId: string): Promise<ChurnRisk> {
    try {
      const metrics = await this.calculateEngagementMetrics(customerId);
      const riskFactors = this.identifyRiskFactors(metrics);
      const riskScore = this.calculateRiskScore(metrics, riskFactors);
      const riskLevel = this.determineRiskLevel(riskScore);
      const actions = this.generateRecommendations(riskLevel, metrics);

      logger.info('Churn prediction complete', { customerId, riskScore, riskLevel });

      return {
        customerId,
        riskScore,
        riskLevel,
        riskFactors,
        recommendedActions: actions,
        lastActivity: metrics.lastBookingDate,
        predictedChurnDate: this.predictChurnDate(riskScore, metrics.daysSinceLastBooking),
      };
    } catch (error) {
      logger.error('Churn prediction error', { error, customerId });
      return {
        customerId,
        riskScore: 0.5,
        riskLevel: 'medium',
        riskFactors: ['Unable to analyze'],
        recommendedActions: ['Review manually'],
      };
    }
  }

  /**
   * Get all at-risk customers
   */
  async getAtRiskCustomers(threshold: number = 0.5): Promise<ChurnRisk[]> {
    try {
      // Get active customers (logged in within 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activeCustomers = await User.find({
        role: 'customer',
        lastLogin: { $gte: thirtyDaysAgo },
      });

      const atRiskCustomers: ChurnRisk[] = [];

      // Check churn risk for each
      for (const customer of activeCustomers) {
        const risk = await this.predictChurnRisk(customer._id.toString());
        if (risk.riskScore >= threshold) {
          atRiskCustomers.push(risk);
        }
      }

      return atRiskCustomers.sort((a, b) => b.riskScore - a.riskScore);
    } catch (error) {
      logger.error('At-risk customer analysis error', { error });
      return [];
    }
  }

  /**
   * Get retention score for a customer
   */
  async getRetentionScore(customerId: string): Promise<number> {
    const metrics = await this.calculateEngagementMetrics(customerId);
    return this.calculateRetentionScore(metrics);
  }

  private async calculateEngagementMetrics(customerId: string): Promise<EngagementMetrics> {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      customerId,
      createdAt: { $gte: sixMonthsAgo },
    });

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

    // Calculate total spent
    const totalSpent = completedBookings.reduce(
      (sum, b) => sum + (b.pricing?.totalAmount || 0),
      0
    );

    // Calculate average rating (from booking rating if available)
    const ratings = completedBookings
      .filter(b => (b as any).rating)
      .map(b => (b as any).rating?.average || 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Get last booking date
    const sortedBookings = [...bookings].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const lastBookingDate = sortedBookings[0]?.createdAt;
    const daysSinceLastBooking = lastBookingDate
      ? Math.floor((Date.now() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Calculate booking frequency (bookings per month over last 3 months)
    const recentBookings = bookings.filter(b => b.createdAt >= threeMonthsAgo);
    const bookingFrequency = recentBookings.length / 3;

    return {
      totalBookings: bookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      totalSpent,
      averageRating,
      lastBookingDate,
      daysSinceLastBooking,
      bookingFrequency,
    };
  }

  private identifyRiskFactors(metrics: EngagementMetrics): string[] {
    const factors: string[] = [];

    // Inactive for long time
    if (metrics.daysSinceLastBooking > 30) {
      factors.push(`Inactive for ${metrics.daysSinceLastBooking} days`);
    }

    // Declining activity
    if (metrics.bookingFrequency < 0.3) {
      factors.push('Low booking frequency');
    }

    // High cancellation rate
    if (metrics.totalBookings > 3) {
      const cancelRate = metrics.cancelledBookings / metrics.totalBookings;
      if (cancelRate > 0.3) {
        factors.push('High cancellation rate');
      }
    }

    // Low engagement (never leaves reviews)
    if (metrics.completedBookings > 3 && metrics.averageRating === 0) {
      factors.push('Never leaves reviews');
    }

    // Low total spend
    if (metrics.totalSpent < 100) {
      factors.push('Low lifetime value');
    }

    return factors;
  }

  private calculateRiskScore(metrics: EngagementMetrics, factors: string[]): number {
    let score = 0;

    // Days since last booking (most important)
    if (metrics.daysSinceLastBooking > 60) score += 0.4;
    else if (metrics.daysSinceLastBooking > 30) score += 0.25;
    else if (metrics.daysSinceLastBooking > 14) score += 0.1;

    // Booking frequency
    if (metrics.bookingFrequency < 0.2) score += 0.25;
    else if (metrics.bookingFrequency < 0.5) score += 0.15;
    else if (metrics.bookingFrequency < 1) score += 0.05;

    // Cancellation rate
    if (metrics.totalBookings > 3) {
      const cancelRate = metrics.cancelledBookings / metrics.totalBookings;
      if (cancelRate > 0.4) score += 0.2;
      else if (cancelRate > 0.2) score += 0.1;
    }

    // Total bookings (new users are riskier)
    if (metrics.totalBookings === 0) score += 0.1;
    else if (metrics.totalBookings < 3) score += 0.05;

    // Low engagement signals
    if (metrics.averageRating === 0 && metrics.completedBookings > 3) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= this.HIGH_CHURN_THRESHOLD) return 'high';
    if (score >= this.MEDIUM_CHURN_THRESHOLD) return 'medium';
    return 'low';
  }

  private generateRecommendations(level: 'low' | 'medium' | 'high', metrics: EngagementMetrics): string[] {
    const recommendations: string[] = [];

    if (level === 'high') {
      recommendations.push('Send win-back offer with discount');
      recommendations.push('Personal outreach from customer success');
      recommendations.push('Offer free service or upgrade');
    }

    if (level === 'medium') {
      if (metrics.daysSinceLastBooking > 14) {
        recommendations.push('Send reminder about favorite services');
      }
      recommendations.push('Share new service or feature announcements');
      recommendations.push('Offer loyalty points bonus');
    }

    if (level === 'low') {
      recommendations.push('Continue engagement emails');
      recommendations.push('Share referral program');
    }

    // Always recommend for low-frequency users
    if (metrics.bookingFrequency < 0.5) {
      recommendations.push('Promote seasonal offers');
    }

    return recommendations;
  }

  private predictChurnDate(riskScore: number, daysSinceLastBooking: number): Date {
    if (riskScore < 0.3) {
      // Low risk - predict 6 months
      return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    } else if (riskScore < 0.6) {
      // Medium risk - predict 2-3 months
      const days = 60 + (1 - riskScore) * 60;
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      // High risk - predict within month
      const days = 14 + (1 - riskScore) * 14;
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  }

  private calculateRetentionScore(metrics: EngagementMetrics): number {
    let score = 1;

    // Decrease for inactivity
    score -= Math.min(metrics.daysSinceLastBooking / 100, 0.4);

    // Decrease for low frequency
    score -= Math.max(0, 0.5 - metrics.bookingFrequency * 0.3);

    // Decrease for cancellations
    if (metrics.totalBookings > 0) {
      const cancelRate = metrics.cancelledBookings / metrics.totalBookings;
      score -= cancelRate * 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }
}

export const churnPredictionService = new ChurnPredictionService();
