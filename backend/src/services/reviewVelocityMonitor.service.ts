/**
 * Review Velocity Monitor Service
 * Tracks review timing, detects burst patterns, and flags suspicious reviews
 *
 * FIX: Implemented working version that queries Review model
 */

import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

export interface ReviewTiming {
  reviewId: string;
  bookingId: string;
  reviewerId: string;
  providerId: string;
  createdAt: Date;
  bookingCompletedAt: Date;
  hoursAfterCompletion: number;
  isSuspicious: boolean;
  suspiciousReasons: string[];
}

export interface VelocityAlert {
  id: string;
  type: 'burst' | 'same_ip' | 'timing' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  reviewerId: string;
  providerId?: string;
  detectedAt: Date;
  reviewsInvolved: string[];
  metadata?: Record<string, unknown>;
}

export interface ReviewPatternAnalysis {
  reviewerId: string;
  providerId?: string;
  timeSpan: {
    firstReview: Date;
    lastReview: Date;
    totalDays: number;
  };
  reviews: {
    total: number;
    burstCount: number;
    sameIpCount: number;
    suspiciousCount: number;
  };
  patterns: string[];
  riskScore: number;
  recommendations: string[];
}

export interface VelocityCheckResult {
  isSuspicious: boolean;
  alerts: VelocityAlert[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  recommendations: string[];
}

// ============================================
// Thresholds
// ============================================

const REVIEW_VELOCITY_THRESHOLDS = {
  // Timing thresholds
  timing: {
    minHoursAfterCompletion: 0.1, // ~6 minutes (suspiciously fast)
    maxHoursAfterCompletion: 24 * 30, // 30 days
    suspiciousHours: 0.5, // 30 minutes (potentially automated)
    fastReviewHours: 2, // Reviews within 2 hours
  },

  // Velocity thresholds
  burst: {
    maxReviewsPerDay: 10,
    maxReviewsPerWeek: 30,
    maxReviewsPerHour: 3,
    burstWindowMinutes: 30,
  },

  // Risk scores for each pattern type
  riskScores: {
    timing: 15,
    burst: 20,
    pattern: 25,
    ip: 30,
  },
};

// ============================================
// Service Class
// ============================================

class ReviewVelocityMonitorService {
  /**
   * Check if a new review is suspicious based on velocity patterns
   */
  async checkReviewVelocity(
    reviewerId: string,
    providerId: string,
    bookingId?: string
  ): Promise<VelocityCheckResult> {
    const alerts: VelocityAlert[] = [];
    let riskScore = 0;

    // Get recent reviews by this reviewer
    const recentReviews = await this.getRecentReviews(reviewerId, 24); // Last 24 hours
    const recentProviderReviews = await this.getRecentProviderReviews(providerId, 24);

    // Check 1: Too many reviews in a short time
    const burstAlerts = this.checkBurstPattern(recentReviews);
    alerts.push(...burstAlerts);
    burstAlerts.forEach(() => { riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.burst; });

    // Check 2: Too many reviews for the same provider
    const sameProviderAlerts = this.checkSameProviderPattern(recentReviews, providerId);
    alerts.push(...sameProviderAlerts);
    sameProviderAlerts.forEach(() => { riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.pattern; });

    // Check 3: Too many reviews for any provider in recent time
    const highVelocityAlerts = this.checkHighVelocity(recentReviews);
    alerts.push(...highVelocityAlerts);
    highVelocityAlerts.forEach(() => { riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.burst; });

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 60) riskLevel = 'critical';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';

    // Generate recommendations
    const recommendations = this.generateRecommendations(alerts);

    return {
      isSuspicious: alerts.length > 0,
      alerts,
      riskLevel,
      riskScore: Math.min(riskScore, 100),
      recommendations,
    };
  }

  /**
   * Get recent reviews for a reviewer
   */
  async getRecentReviews(reviewerId: string, hoursBack: number): Promise<any[]> {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    return Review.find({
      reviewerId: new mongoose.Types.ObjectId(reviewerId),
      createdAt: { $gte: cutoffDate },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  /**
   * Get recent reviews for a provider
   */
  async getRecentProviderReviews(providerId: string, hoursBack: number): Promise<any[]> {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    return Review.find({
      revieweeId: new mongoose.Types.ObjectId(providerId),
      createdAt: { $gte: cutoffDate },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  /**
   * Check for burst pattern (too many reviews in short time)
   */
  private checkBurstPattern(reviews: any[]): VelocityAlert[] {
    const alerts: VelocityAlert[] = [];

    if (reviews.length === 0) return alerts;

    // Sort by creation time
    const sorted = [...reviews].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Check for reviews within burst window
    for (let i = 1; i < sorted.length; i++) {
      const timeDiff =
        new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff <= REVIEW_VELOCITY_THRESHOLDS.burst.burstWindowMinutes) {
        alerts.push({
          id: new mongoose.Types.ObjectId().toString(),
          type: 'burst',
          severity: minutesDiff <= 5 ? 'high' : 'medium',
          message: `${sorted.length} reviews submitted within ${minutesDiff.toFixed(1)} minutes`,
          reviewerId: sorted[i].reviewerId?.toString() || '',
          providerId: sorted[i].revieweeId?.toString(),
          detectedAt: new Date(),
          reviewsInvolved: sorted.slice(Math.max(0, i - 3), i + 1).map(r => r._id.toString()),
        });
        break; // Only report one burst per check
      }
    }

    return alerts;
  }

  /**
   * Check for same-provider pattern (too many reviews for one provider)
   */
  private checkSameProviderPattern(reviews: any[], providerId: string): VelocityAlert[] {
    const alerts: VelocityAlert[] = [];

    const sameProviderReviews = reviews.filter(
      r => r.revieweeId?.toString() === providerId
    );

    if (sameProviderReviews.length >= 3) {
      alerts.push({
        id: new mongoose.Types.ObjectId().toString(),
        type: 'pattern',
        severity: sameProviderReviews.length >= 5 ? 'high' : 'medium',
        message: `${sameProviderReviews.length} reviews submitted for the same provider in 24 hours`,
        reviewerId: reviews[0]?.reviewerId?.toString() || '',
        providerId,
        detectedAt: new Date(),
        reviewsInvolved: sameProviderReviews.slice(0, 5).map(r => r._id.toString()),
      });
    }

    return alerts;
  }

  /**
   * Check for high velocity (too many reviews overall)
   */
  private checkHighVelocity(reviews: any[]): VelocityAlert[] {
    const alerts: VelocityAlert[] = [];

    // Count reviews in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lastHourReviews = reviews.filter(
      r => new Date(r.createdAt) >= oneHourAgo
    );

    if (lastHourReviews.length >= REVIEW_VELOCITY_THRESHOLDS.burst.maxReviewsPerHour) {
      alerts.push({
        id: new mongoose.Types.ObjectId().toString(),
        type: 'burst',
        severity: 'high',
        message: `${lastHourReviews.length} reviews submitted in the last hour`,
        reviewerId: reviews[0]?.reviewerId?.toString() || '',
        detectedAt: new Date(),
        reviewsInvolved: lastHourReviews.slice(0, 10).map(r => r._id.toString()),
      });
    }

    return alerts;
  }

  /**
   * Generate recommendations based on detected patterns
   */
  private generateRecommendations(alerts: VelocityAlert[]): string[] {
    const recommendations: string[] = [];

    if (alerts.some(a => a.type === 'burst')) {
      recommendations.push('Review submission rate is unusually high');
    }
    if (alerts.some(a => a.type === 'pattern')) {
      recommendations.push('Multiple reviews for same provider detected');
    }
    if (alerts.some(a => a.type === 'timing')) {
      recommendations.push('Review submitted very quickly after service completion');
    }

    if (recommendations.length === 0) {
      recommendations.push('No suspicious patterns detected');
    }

    return recommendations;
  }

  /**
   * Flag a review as suspicious based on velocity analysis
   */
  async flagSuspiciousReview(reviewId: string, reason: string): Promise<void> {
    const review = await Review.findById(reviewId);
    if (review) {
      review.reportCount = (review.reportCount || 0) + 1;
      await review.save();

      logger.warn('Review flagged by velocity monitor', {
        context: 'ReviewVelocityMonitor',
        action: 'REVIEW_FLAGGED',
        reviewId,
        reason,
        newReportCount: review.reportCount,
      });
    }
  }

  /**
   * Get stats for admin dashboard
   */
  async getVelocityStats(hoursBack: number = 24): Promise<any> {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get review counts by hour
    const hourlyStats = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get unique reviewers in the time period
    const uniqueReviewers = await Review.distinct('reviewerId', {
      createdAt: { $gte: cutoffDate },
    });

    // Get reviews per reviewer
    const reviewsPerReviewer = await Review.aggregate([
      { $match: { createdAt: { $gte: cutoffDate } } },
      {
        $group: {
          _id: '$reviewerId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      periodHours: hoursBack,
      totalReviews: hourlyStats.reduce((sum, h) => sum + h.count, 0),
      uniqueReviewers: uniqueReviewers.length,
      peakHour: hourlyStats.length > 0
        ? hourlyStats.reduce((max, h) => (h.count > max.count ? h : max))
        : null,
      topReviewers: reviewsPerReviewer.slice(0, 5),
      hourlyData: hourlyStats,
    };
  }
}

// Export singleton instance
export const reviewVelocityMonitor = new ReviewVelocityMonitorService();
export default reviewVelocityMonitor;
