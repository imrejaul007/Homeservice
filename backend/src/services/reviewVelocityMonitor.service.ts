/**
 * Review Velocity Monitor Service
 * Tracks review timing, detects burst patterns, and flags suspicious reviews
 */

import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

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

  // Same-IP detection
  sameIP: {
    maxSameIPReviews: 2,
    maxSameIPProviders: 3,
  },

  // Suspicious patterns
  patterns: {
    sameSessionReviews: 3,
    similarTextSimilarity: 0.8, // 80% similarity threshold
    minReviewsForPattern: 5,
  },

  // Risk scores
  riskScores: {
    timing: 20,
    burst: 30,
    sameIP: 25,
    pattern: 35,
  },
};

// ============================================
// ReviewVelocityMonitorService Class
// ============================================

export class ReviewVelocityMonitorService {
  // ========================================
  // Review Timing Analysis
  // ========================================

  /**
   * Analyze review timing
   */
  async analyzeReviewTiming(bookingId: string, reviewId: string): Promise<ReviewTiming> {
    const booking = await Booking.findById(bookingId).select('customerId providerId completedAt status');

    if (!booking) {
      throw new Error('Booking not found');
    }

    const review = await this.getReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const bookingCompletedAt = booking.completedAt || booking.updatedAt;
    const hoursAfterCompletion = (review.createdAt.getTime() - bookingCompletedAt.getTime()) / (1000 * 60 * 60);

    const suspiciousReasons: string[] = [];

    // Check for suspiciously fast reviews
    if (hoursAfterCompletion < REVIEW_VELOCITY_THRESHOLDS.timing.minHoursAfterCompletion) {
      suspiciousReasons.push('Review submitted almost immediately after booking completion');
    }

    if (hoursAfterCompletion < REVIEW_VELOCITY_THRESHOLDS.timing.suspiciousHours) {
      suspiciousReasons.push('Review submitted within suspicious time window (< 30 minutes)');
    }

    // Check for very fast reviews (could indicate template responses)
    if (hoursAfterCompletion < REVIEW_VELOCITY_THRESHOLDS.timing.fastReviewHours) {
      suspiciousReasons.push('Review submitted very quickly after service completion');
    }

    return {
      reviewId,
      bookingId,
      reviewerId: booking.customerId?.toString() ?? '',
      providerId: booking.providerId.toString(),
      createdAt: review.createdAt,
      bookingCompletedAt,
      hoursAfterCompletion: Math.round(hoursAfterCompletion * 100) / 100,
      isSuspicious: suspiciousReasons.length > 0,
      suspiciousReasons,
    };
  }

  /**
   * Get review by ID (simplified - would query actual review model)
   */
  private async getReviewById(reviewId: string): Promise<any> {
    // In production, query Review model
    // For now, return placeholder
    return {
      _id: reviewId,
      createdAt: new Date(),
      text: '',
      rating: 5,
    };
  }

  // ========================================
  // Velocity Checks
  // ========================================

  /**
   * Check for review velocity anomalies
   */
  async checkVelocity(reviewerId: string, options?: {
    providerId?: string;
    ip?: string;
    reviewId?: string;
  }): Promise<VelocityCheckResult> {
    const alerts: VelocityAlert[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // 1. Check for burst pattern
    const burstCheck = await this.checkBurstPattern(reviewerId);
    if (burstCheck.isSuspicious) {
      alerts.push(...burstCheck.alerts);
      riskScore += burstCheck.riskScore;
    }

    // 2. Check for same-IP reviews
    if (options?.ip) {
      const ipCheck = await this.checkSameIPReviews(reviewerId, options.ip, options.providerId);
      if (ipCheck.isSuspicious) {
        alerts.push(...ipCheck.alerts);
        riskScore += ipCheck.riskScore;
      }
    }

    // 3. Check timing anomalies
    if (options?.reviewId) {
      const reviews = await this.getRecentReviews(reviewerId, 24);
      const timingCheck = this.checkTimingAnomalies(reviews, options.reviewId);
      if (timingCheck.isSuspicious) {
        alerts.push(...timingCheck.alerts);
        riskScore += timingCheck.riskScore;
      }
    }

    // 4. Check for suspicious patterns
    const patternCheck = await this.checkSuspiciousPatterns(reviewerId);
    if (patternCheck.isSuspicious) {
      alerts.push(...patternCheck.alerts);
      riskScore += patternCheck.riskScore;
    }

    // Generate recommendations
    if (alerts.some((a) => a.severity === 'critical')) {
      recommendations.push('Block review submission pending manual review');
      recommendations.push('Flag reviewer account for investigation');
    } else if (alerts.some((a) => a.severity === 'high')) {
      recommendations.push('Require additional verification for review');
      recommendations.push('Consider flagging for manual review');
    } else if (alerts.some((a) => a.severity === 'medium')) {
      recommendations.push('Monitor reviewer activity closely');
    }

    if (alerts.length === 0) {
      recommendations.push('Review appears normal');
    }

    // Determine risk level
    let riskLevel: VelocityCheckResult['riskLevel'] = 'low';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    return {
      isSuspicious: alerts.length > 0,
      alerts,
      riskLevel,
      riskScore: Math.min(100, riskScore),
      recommendations,
    };
  }

  /**
   * Check for burst review patterns
   */
  private async checkBurstPattern(reviewerId: string): Promise<{
    isSuspicious: boolean;
    alerts: VelocityAlert[];
    riskScore: number;
  }> {
    const alerts: VelocityAlert[] = [];
    let riskScore = 0;

    // Get reviews from last 24 hours
    const recentReviews = await this.getRecentReviews(reviewerId, 24);

    if (recentReviews.length === 0) {
      return { isSuspicious: false, alerts: [], riskScore: 0 };
    }

    // Check reviews per hour
    const reviewsPerHour = recentReviews.length;
    if (reviewsPerHour > REVIEW_VELOCITY_THRESHOLDS.burst.maxReviewsPerHour) {
      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'burst',
        severity: 'high',
        message: `Reviewer submitted ${reviewsPerHour} reviews in 24 hours (max: ${REVIEW_VELOCITY_THRESHOLDS.burst.maxReviewsPerHour})`,
        reviewerId,
        detectedAt: new Date(),
        reviewsInvolved: recentReviews.map((r) => r._id.toString()),
      });
      riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.burst;
    }

    // Check for burst (many reviews in short time window)
    const burstWindowMinutes = REVIEW_VELOCITY_THRESHOLDS.burst.burstWindowMinutes;
    let burstCount = 0;
    let burstReviews: string[] = [];

    for (let i = 1; i < recentReviews.length; i++) {
      const timeDiff = recentReviews[i].createdAt.getTime() - recentReviews[i - 1].createdAt.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff <= burstWindowMinutes) {
        burstCount++;
        burstReviews.push(recentReviews[i]._id.toString());
      }
    }

    if (burstCount >= 2) {
      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'burst',
        severity: 'medium',
        message: `${burstCount} reviews submitted within ${burstWindowMinutes} minutes of each other`,
        reviewerId,
        detectedAt: new Date(),
        reviewsInvolved: burstReviews,
      });
      riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.burst / 2;
    }

    return {
      isSuspicious: alerts.length > 0,
      alerts,
      riskScore,
    };
  }

  /**
   * Check for same-IP reviews
   */
  private async checkSameIPReviews(
    reviewerId: string,
    ip: string,
    providerId?: string
  ): Promise<{
    isSuspicious: boolean;
    alerts: VelocityAlert[];
    riskScore: number;
  }> {
    const alerts: VelocityAlert[] = [];
    let riskScore = 0;

    // In production, query Review model with IP tracking
    // For now, simulate check

    // Check if multiple reviews from same IP
    // This would query the Review model for reviews with matching IP
    const sameIPCount = 0; // Placeholder

    if (sameIPCount > REVIEW_VELOCITY_THRESHOLDS.sameIP.maxSameIPReviews) {
      alerts.push({
        id: new Types.ObjectId().toString(),
        type: 'same_ip',
        severity: 'high',
        message: `${sameIPCount + 1} reviews submitted from same IP address`,
        reviewerId,
        providerId,
        detectedAt: new Date(),
        reviewsInvolved: [],
        metadata: { ip },
      });
      riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.sameIP;
    }

    return {
      isSuspicious: alerts.length > 0,
      alerts,
      riskScore,
    };
  }

  /**
   * Check timing anomalies
   */
  private checkTimingAnomalies(
    reviews: any[],
    currentReviewId: string
  ): {
    isSuspicious: boolean;
    alerts: VelocityAlert[];
    riskScore: number;
  } {
    const alerts: VelocityAlert[] = [];
    let riskScore = 0;

    if (reviews.length < 2) {
      return { isSuspicious: false, alerts: [], riskScore: 0 };
    }

    // Check for reviews submitted at same time (possible automation)
    for (let i = 1; i < reviews.length; i++) {
      const timeDiff = Math.abs(
        reviews[i].createdAt.getTime() - reviews[i - 1].createdAt.getTime()
      );
      const secondsDiff = timeDiff / 1000;

      if (secondsDiff < 30) {
        // Suspiciously consistent timing
        alerts.push({
          id: new Types.ObjectId().toString(),
          type: 'timing',
          severity: 'medium',
          message: `Reviews submitted with suspiciously consistent timing (${Math.round(secondsDiff)}s apart)`,
          reviewerId: reviews[i].reviewerId?.toString() || '',
          detectedAt: new Date(),
          reviewsInvolved: [reviews[i]._id.toString(), reviews[i - 1]._id.toString()],
        });
        riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.timing / 2;
      }
    }

    return {
      isSuspicious: alerts.length > 0,
      alerts,
      riskScore,
    };
  }

  /**
   * Check for suspicious review patterns
   */
  private async checkSuspiciousPatterns(reviewerId: string): Promise<{
    isSuspicious: boolean;
    alerts: VelocityAlert[];
    riskScore: number;
  }> {
    const alerts: VelocityAlert[] = [];
    let riskScore = 0;

    // Get user's recent reviews
    const reviews = await this.getRecentReviews(reviewerId, 168); // Last 7 days

    if (reviews.length < REVIEW_VELOCITY_THRESHOLDS.patterns.minReviewsForPattern) {
      return { isSuspicious: false, alerts: [], riskScore: 0 };
    }

    // Check for same provider reviews (could be legitimate for multiple services)
    const providerCounts: Record<string, number> = {};
    for (const review of reviews) {
      const providerId = review.providerId?.toString();
      if (providerId) {
        providerCounts[providerId] = (providerCounts[providerId] || 0) + 1;
      }
    }

    for (const [providerId, count] of Object.entries(providerCounts)) {
      if (count > REVIEW_VELOCITY_THRESHOLDS.sameIP.maxSameIPProviders) {
        alerts.push({
          id: new Types.ObjectId().toString(),
          type: 'pattern',
          severity: 'medium',
          message: `${count} reviews submitted for same provider`,
          reviewerId,
          providerId,
          detectedAt: new Date(),
          reviewsInvolved: reviews
            .filter((r) => r.providerId?.toString() === providerId)
            .map((r) => r._id.toString()),
        });
        riskScore += REVIEW_VELOCITY_THRESHOLDS.riskScores.pattern / 2;
      }
    }

    return {
      isSuspicious: alerts.length > 0,
      alerts,
      riskScore,
    };
  }

  /**
   * Get recent reviews for a reviewer
   */
  private async getRecentReviews(
    reviewerId: string,
    hoursBack: number
  ): Promise<any[]> {
    // In production, query Review model
    // For now, return empty array
    return [];
  }

  // ========================================
  // Pattern Analysis
  // ========================================

  /**
   * Perform comprehensive pattern analysis for a reviewer
   */
  async analyzeReviewPatterns(reviewerId: string): Promise<ReviewPatternAnalysis> {
    const reviews = await this.getRecentReviews(reviewerId, 720); // Last 30 days

    const patterns: string[] = [];
    let riskScore = 0;

    if (reviews.length === 0) {
      return {
        reviewerId,
        timeSpan: {
          firstReview: new Date(),
          lastReview: new Date(),
          totalDays: 0,
        },
        reviews: {
          total: 0,
          burstCount: 0,
          sameIpCount: 0,
          suspiciousCount: 0,
        },
        patterns: [],
        riskScore: 0,
        recommendations: ['No recent reviews to analyze'],
      };
    }

    const sortedReviews = reviews.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const firstReview = sortedReviews[0].createdAt;
    const lastReview = sortedReviews[sortedReviews.length - 1].createdAt;
    const totalDays = (lastReview.getTime() - firstReview.getAtime()) / (1000 * 60 * 60 * 24);

    // Check for burst patterns
    let burstCount = 0;
    for (let i = 1; i < sortedReviews.length; i++) {
      const timeDiff =
        sortedReviews[i].createdAt.getTime() - sortedReviews[i - 1].createdAt.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff <= REVIEW_VELOCITY_THRESHOLDS.burst.burstWindowMinutes) {
        burstCount++;
        patterns.push(`Burst: ${sortedReviews.length} reviews within ${minutesDiff} minutes`);
      }
    }

    if (burstCount > 0) {
      riskScore += 20;
    }

    // Check for high velocity
    const reviewsPerDay = reviews.length / Math.max(1, totalDays);
    if (reviewsPerDay > REVIEW_VELOCITY_THRESHOLDS.burst.maxReviewsPerDay) {
      patterns.push(`High velocity: ${reviewsPerDay.toFixed(1)} reviews/day average`);
      riskScore += 15;
    }

    // Count suspicious reviews
    const suspiciousCount = reviews.filter((r) => r.isSuspicious || r.flags?.length > 0).length;

    // Generate recommendations
    const recommendations: string[] = [];
    if (riskScore >= 50) {
      recommendations.push('Manual review recommended');
      recommendations.push('Consider limiting review privileges');
    } else if (riskScore >= 30) {
      recommendations.push('Continue monitoring');
    } else {
      recommendations.push('Activity appears normal');
    }

    return {
      reviewerId,
      timeSpan: {
        firstReview,
        lastReview,
        totalDays: Math.round(totalDays * 10) / 10,
      },
      reviews: {
        total: reviews.length,
        burstCount,
        sameIpCount: 0, // Would come from review data
        suspiciousCount,
      },
      patterns,
      riskScore: Math.min(100, riskScore),
      recommendations,
    };
  }

  // ========================================
  // Alert Management
  // ========================================

  /**
   * Create and store velocity alert
   */
  async createAlert(alert: Omit<VelocityAlert, 'id' | 'detectedAt'>): Promise<VelocityAlert> {
    const fullAlert: VelocityAlert = {
      ...alert,
      id: new Types.ObjectId().toString(),
      detectedAt: new Date(),
    };

    // In production, store in Alert model or append to review/user
    logger.info('Review velocity alert created', {
      alertId: fullAlert.id,
      type: fullAlert.type,
      severity: fullAlert.severity,
      reviewerId: fullAlert.reviewerId,
    });

    // Audit log
    await createAuditLog({
      userId: alert.reviewerId,
      action: 'REVIEW_VELOCITY_ALERT',
      resource: 'review',
      resourceId: alert.reviewerId,
      details: {
        alertType: alert.type,
        severity: alert.severity,
        reviews: alert.reviewsInvolved,
      },
      status: 'success',
    });

    return fullAlert;
  }

  /**
   * Get alerts for a reviewer
   */
  async getAlerts(reviewerId: string, options?: {
    severity?: VelocityAlert['severity'];
    limit?: number;
  }): Promise<VelocityAlert[]> {
    // In production, query Alert model
    // For now, return empty array
    return [];
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    logger.info('Review velocity alert resolved', {
      alertId,
      resolvedBy,
      resolution,
    });

    await createAuditLog({
      userId: resolvedBy,
      action: 'REVIEW_VELOCITY_ALERT_RESOLVED',
      resource: 'alert',
      resourceId: alertId,
      details: { resolution },
      status: 'success',
    });
  }

  // ========================================
  // Provider-Level Monitoring
  // ========================================

  /**
   * Monitor reviews for a specific provider
   */
  async monitorProviderReviews(providerId: string, hoursBack: number = 24): Promise<{
    totalReviews: number;
    suspiciousReviews: number;
    alertsGenerated: number;
    avgRating: number;
    ratingDistribution: Record<number, number>;
    sameIPReviews: number;
    burstReviews: number;
  }> {
    // Get provider's recent reviews
    // In production, query Review model
    const reviews: Array<{ isSuspicious?: boolean; flags?: unknown[]; rating?: number }> = [];

    const suspiciousReviews = reviews.filter(
      (r) => r.isSuspicious || (r.flags?.length ?? 0) > 0
    ).length;

    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of reviews) {
      const rating = Math.round(review.rating || 0);
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
      }
    }

    return {
      totalReviews: reviews.length,
      suspiciousReviews,
      alertsGenerated: 0,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDistribution,
      sameIPReviews: 0,
      burstReviews: 0,
    };
  }

  /**
   * Get provider review integrity score
   */
  async getProviderReviewIntegrity(providerId: string): Promise<{
    integrityScore: number;
    reviewAuthenticity: 'verified' | 'likely_authentic' | 'suspicious' | 'flagged';
    riskIndicators: string[];
    stats: {
      totalReviews: number;
      suspiciousReviews: number;
      sameIPReviews: number;
      burstReviews: number;
    };
  }> {
    const stats = await this.monitorProviderReviews(providerId, 720); // 30 days

    const riskIndicators: string[] = [];

    // Calculate integrity score
    let integrityScore = 100;

    if (stats.suspiciousReviews > 0) {
      integrityScore -= stats.suspiciousReviews * 10;
      riskIndicators.push(`${stats.suspiciousReviews} suspicious review(s) detected`);
    }

    integrityScore = Math.max(0, integrityScore);

    // Determine authenticity status
    let reviewAuthenticity: 'verified' | 'likely_authentic' | 'suspicious' | 'flagged';

    if (integrityScore >= 90) {
      reviewAuthenticity = 'verified';
    } else if (integrityScore >= 70) {
      reviewAuthenticity = 'likely_authentic';
    } else if (integrityScore >= 50) {
      reviewAuthenticity = 'suspicious';
    } else {
      reviewAuthenticity = 'flagged';
      riskIndicators.push('Provider flagged for review manipulation');
    }

    return {
      integrityScore,
      reviewAuthenticity,
      riskIndicators,
      stats: {
        totalReviews: stats.totalReviews,
        suspiciousReviews: stats.suspiciousReviews,
        sameIPReviews: stats.sameIPReviews,
        burstReviews: stats.burstReviews,
      },
    };
  }
}

// Export singleton instance
export const reviewVelocityMonitorService = new ReviewVelocityMonitorService();
export default reviewVelocityMonitorService;
