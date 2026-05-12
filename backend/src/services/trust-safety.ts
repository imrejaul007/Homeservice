/**
 * Trust & Safety Scoring Service
 * Comprehensive trust algorithm for providers
 */

import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';

// ============================================
// Type Definitions
// ============================================

export type TrustBadge = 'new' | 'trusted' | 'premium' | 'elite';

export interface TrustScoreBreakdown {
  responseRate: { score: number; weight: number; maxPoints: number };
  completionRate: { score: number; weight: number; maxPoints: number };
  cancellationRate: { score: number; weight: number; maxPoints: number };
  reviewScore: { score: number; weight: number; maxPoints: number };
  verificationLevel: { score: number; weight: number; maxPoints: number };
}

export interface TrustScore {
  overall: number; // 0-100
  breakdown: TrustScoreBreakdown;
  badge: TrustBadge;
  factors: string[]; // List of positive/negative factors
  calculatedAt: Date;
  providerId: string;
}

export interface TrustMetrics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  pendingBookings: number;
  responseRate: number;
  completionRate: number;
  cancellationRate: number;
  averageRating: number;
  totalReviews: number;
  verificationStatus: {
    email: boolean;
    phone: boolean;
    identity: boolean;
    business: boolean;
    background: boolean;
  };
}

// ============================================
// Trust Thresholds Configuration
// ============================================

interface TrustThreshold {
  min: number;
  max: number;
  points: number;
}

const RESPONSE_RATE_THRESHOLDS: TrustThreshold[] = [
  { min: 90, max: 100, points: 25 },
  { min: 80, max: 89, points: 20 },
  { min: 70, max: 79, points: 15 },
  { min: 0, max: 69, points: 5 },
];

const COMPLETION_RATE_THRESHOLDS: TrustThreshold[] = [
  { min: 95, max: 100, points: 25 },
  { min: 90, max: 94, points: 20 },
  { min: 85, max: 89, points: 15 },
  { min: 0, max: 84, points: 5 },
];

const CANCELLATION_RATE_THRESHOLDS: TrustThreshold[] = [
  { min: 0, max: 4, points: 20 },
  { min: 5, max: 14, points: 15 },
  { min: 15, max: 24, points: 10 },
  { min: 25, max: 100, points: 0 },
];

const REVIEW_SCORE_THRESHOLDS: TrustThreshold[] = [
  { min: 4.8, max: 5.0, points: 20 },
  { min: 4.5, max: 4.79, points: 15 },
  { min: 4.0, max: 4.49, points: 10 },
  { min: 0, max: 3.99, points: 5 },
];

const VERIFICATION_POINTS = {
  fullyVerified: 10,    // All verifications complete
  emailPhone: 7,       // Email + Phone verified
  emailOnly: 3,         // Only email verified
  none: 0,              // No verification
};

// Trust weights (must sum to 100)
const TRUST_WEIGHTS = {
  responseRate: 20,
  completionRate: 20,
  cancellationRate: 20,
  reviewScore: 25,
  verificationLevel: 15,
};

// Badge thresholds
const BADGE_THRESHOLDS = {
  elite: 90,
  premium: 75,
  trusted: 50,
  new: 0,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get points based on rate and thresholds
 */
function getPointsForRate(rate: number, thresholds: TrustThreshold[]): number {
  for (const threshold of thresholds) {
    if (rate >= threshold.min && rate <= threshold.max) {
      return threshold.points;
    }
  }
  return 0;
}

/**
 * Determine trust badge based on overall score
 */
function determineBadge(score: number): TrustBadge {
  if (score > BADGE_THRESHOLDS.elite) return 'elite';
  if (score >= BADGE_THRESHOLDS.premium) return 'premium';
  if (score >= BADGE_THRESHOLDS.trusted) return 'trusted';
  return 'new';
}

/**
 * Calculate verification points
 */
function calculateVerificationPoints(
  emailVerified: boolean,
  phoneVerified: boolean,
  verificationStatus?: any
): number {
  if (!emailVerified) return VERIFICATION_POINTS.none;
  if (!phoneVerified) return VERIFICATION_POINTS.emailOnly;

  // Check if fully verified (identity, business, background)
  if (verificationStatus) {
    const { identity, business, background } = verificationStatus;
    if (
      identity?.status === 'approved' &&
      business?.status === 'approved' &&
      background?.status === 'approved'
    ) {
      return VERIFICATION_POINTS.fullyVerified;
    }
  }

  // At least email + phone
  return VERIFICATION_POINTS.emailPhone;
}

/**
 * Get trust factors (positive/negative factors affecting score)
 */
function generateTrustFactors(
  metrics: TrustMetrics,
  _breakdown: TrustScoreBreakdown
): string[] {
  const factors: string[] = [];

  // Response Rate factors
  if (metrics.responseRate >= 90) {
    factors.push('Excellent response rate (90%+)');
  } else if (metrics.responseRate < 70) {
    factors.push('Low response rate below 70%');
  }

  // Completion Rate factors
  if (metrics.completionRate >= 95) {
    factors.push('Exceptional completion rate (95%+)');
  } else if (metrics.completionRate < 85) {
    factors.push('Completion rate needs improvement');
  }

  // Cancellation Rate factors
  if (metrics.cancellationRate < 5) {
    factors.push('Minimal cancellations (less than 5%)');
  } else if (metrics.cancellationRate > 15) {
    factors.push('High cancellation rate affects trust');
  }

  // Review Score factors
  if (metrics.averageRating >= 4.8) {
    factors.push('Outstanding reviews (4.8+)');
  } else if (metrics.averageRating >= 4.5) {
    factors.push('Good review rating (4.5+)');
  } else if (metrics.averageRating < 4.0) {
    factors.push('Review score below expectations');
  }

  // Verification factors
  const { email, phone, identity, business, background } = metrics.verificationStatus;
  if (identity && business && background) {
    factors.push('Identity verified');
    factors.push('Business verified');
    factors.push('Background checked');
  } else if (email && phone) {
    factors.push('Contact information verified');
  } else if (email) {
    factors.push('Email verified');
  }

  // Activity factors
  if (metrics.totalBookings >= 100) {
    factors.push('Extensive track record (100+ bookings)');
  } else if (metrics.totalBookings >= 50) {
    factors.push('Established provider (50+ bookings)');
  } else if (metrics.totalBookings < 10 && metrics.totalBookings > 0) {
    factors.push('New to platform (less than 10 bookings)');
  }

  // No-show factors
  if (metrics.noShowBookings > 0) {
    factors.push(`Has ${metrics.noShowBookings} no-show record(s)`);
  }

  return factors;
}

/**
 * Fetch and calculate trust metrics for a provider
 */
async function getProviderTrustMetrics(providerId: string | Types.ObjectId): Promise<TrustMetrics> {
  const pid = providerId instanceof Types.ObjectId ? providerId : new Types.ObjectId(providerId);

  // Get all bookings for the provider
  const bookings = await Booking.find({ providerId: pid }).lean();

  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;
  const noShowBookings = bookings.filter((b) => b.status === 'no_show').length;
  const pendingBookings = bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed').length;

  // Calculate response rate (bookings accepted / total bookings received)
  const bookingsWithResponse = bookings.filter(
    (b) => b.providerResponse?.acceptedAt || b.status !== 'pending'
  );
  const responseRate = totalBookings > 0
    ? (bookingsWithResponse.length / totalBookings) * 100
    : 100;

  // Calculate completion rate (completed / accepted or non-cancelled)
  const nonCancelledBookings = totalBookings - cancelledBookings;
  const completionRate = nonCancelledBookings > 0
    ? (completedBookings / nonCancelledBookings) * 100
    : 0;

  // Calculate cancellation rate
  const cancellationRate = totalBookings > 0
    ? (cancelledBookings / totalBookings) * 100
    : 0;

  // Get provider profile for reviews
  const providerProfile = await ProviderProfile.findOne({ userId: pid }).lean();

  const averageRating = providerProfile?.reviewsData?.averageRating || 0;
  const totalReviews = providerProfile?.reviewsData?.totalReviews || 0;

  // Get user verification status
  const user = await User.findById(pid).lean();

  const verificationStatus = {
    email: user?.isEmailVerified || false,
    phone: user?.isPhoneVerified || false,
    identity: providerProfile?.verificationStatus?.identity?.status === 'approved',
    business: providerProfile?.verificationStatus?.business?.status === 'approved',
    background: providerProfile?.verificationStatus?.background?.status === 'approved',
  };

  return {
    totalBookings,
    completedBookings,
    cancelledBookings,
    noShowBookings,
    pendingBookings,
    responseRate: Math.round(responseRate * 10) / 10,
    completionRate: Math.round(completionRate * 10) / 10,
    cancellationRate: Math.round(cancellationRate * 10) / 10,
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    verificationStatus,
  };
}

// ============================================
// Main Service Functions
// ============================================

/**
 * Calculate the complete trust score for a provider
 */
export async function calculateTrustScore(providerId: string): Promise<TrustScore> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID');
  }

  const metrics = await getProviderTrustMetrics(providerId);

  // Calculate individual component scores
  const responseRateScore = getPointsForRate(metrics.responseRate, RESPONSE_RATE_THRESHOLDS);
  const completionRateScore = getPointsForRate(metrics.completionRate, COMPLETION_RATE_THRESHOLDS);
  const cancellationRateScore = getPointsForRate(100 - metrics.cancellationRate, CANCELLATION_RATE_THRESHOLDS);
  const reviewScorePoints = getPointsForRate(metrics.averageRating, REVIEW_SCORE_THRESHOLDS);

  // Get provider profile for detailed verification status
  const providerProfile = await ProviderProfile.findOne({ userId: providerId }).lean();
  const verificationScore = calculateVerificationPoints(
    metrics.verificationStatus.email,
    metrics.verificationStatus.phone,
    providerProfile?.verificationStatus
  );

  // Build breakdown
  const breakdown: TrustScoreBreakdown = {
    responseRate: {
      score: responseRateScore,
      weight: TRUST_WEIGHTS.responseRate,
      maxPoints: 25,
    },
    completionRate: {
      score: completionRateScore,
      weight: TRUST_WEIGHTS.completionRate,
      maxPoints: 25,
    },
    cancellationRate: {
      score: cancellationRateScore,
      weight: TRUST_WEIGHTS.cancellationRate,
      maxPoints: 20,
    },
    reviewScore: {
      score: reviewScorePoints,
      weight: TRUST_WEIGHTS.reviewScore,
      maxPoints: 20,
    },
    verificationLevel: {
      score: verificationScore,
      weight: TRUST_WEIGHTS.verificationLevel,
      maxPoints: 10,
    },
  };

  // Calculate overall score (weighted average scaled to 100)
  const maxPossibleScore =
    (TRUST_WEIGHTS.responseRate / 100) * breakdown.responseRate.maxPoints +
    (TRUST_WEIGHTS.completionRate / 100) * breakdown.completionRate.maxPoints +
    (TRUST_WEIGHTS.cancellationRate / 100) * breakdown.cancellationRate.maxPoints +
    (TRUST_WEIGHTS.reviewScore / 100) * breakdown.reviewScore.maxPoints +
    (TRUST_WEIGHTS.verificationLevel / 100) * breakdown.verificationLevel.maxPoints;

  const earnedScore =
    (TRUST_WEIGHTS.responseRate / 100) * breakdown.responseRate.score +
    (TRUST_WEIGHTS.completionRate / 100) * breakdown.completionRate.score +
    (TRUST_WEIGHTS.cancellationRate / 100) * breakdown.cancellationRate.score +
    (TRUST_WEIGHTS.reviewScore / 100) * breakdown.reviewScore.score +
    (TRUST_WEIGHTS.verificationLevel / 100) * breakdown.verificationLevel.score;

  // Scale to 0-100
  const overall = maxPossibleScore > 0
    ? Math.round((earnedScore / maxPossibleScore) * 100)
    : 50; // Default for new providers

  // Determine badge
  const badge = determineBadge(overall);

  // Generate factors
  const factors = generateTrustFactors(metrics, breakdown);

  return {
    overall,
    breakdown,
    badge,
    factors,
    calculatedAt: new Date(),
    providerId,
  };
}

/**
 * Get detailed breakdown of trust score components
 */
export async function getTrustBreakdown(providerId: string): Promise<{
  metrics: TrustMetrics;
  breakdown: TrustScoreBreakdown;
  thresholds: {
    responseRate: { range: string; points: number }[];
    completionRate: { range: string; points: number }[];
    cancellationRate: { range: string; points: number }[];
    reviewScore: { range: string; points: number }[];
    verification: { level: string; points: number }[];
  };
  recommendations: string[];
}> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID');
  }

  const metrics = await getProviderTrustMetrics(providerId);
  const trustScore = await calculateTrustScore(providerId);

  // Generate recommendations based on score gaps
  const recommendations: string[] = [];

  if (trustScore.breakdown.responseRate.score < 20) {
    recommendations.push('Improve response rate by accepting more booking requests');
  }

  if (trustScore.breakdown.completionRate.score < 20) {
    recommendations.push('Focus on completing more bookings to improve completion rate');
  }

  if (trustScore.breakdown.cancellationRate.score < 15) {
    recommendations.push('Reduce cancellations to build customer trust');
  }

  if (trustScore.breakdown.reviewScore.score < 15) {
    recommendations.push('Encourage satisfied customers to leave reviews');
  }

  if (trustScore.breakdown.verificationLevel.score < 7) {
    recommendations.push('Complete identity and background verification to increase trust');
  }

  if (metrics.totalBookings < 10) {
    recommendations.push('Build your track record by completing more bookings');
  }

  return {
    metrics,
    breakdown: trustScore.breakdown,
    thresholds: {
      responseRate: [
        { range: '>90%', points: 25 },
        { range: '80-90%', points: 20 },
        { range: '70-80%', points: 15 },
        { range: '<70%', points: 5 },
      ],
      completionRate: [
        { range: '>95%', points: 25 },
        { range: '90-95%', points: 20 },
        { range: '85-90%', points: 15 },
        { range: '<85%', points: 5 },
      ],
      cancellationRate: [
        { range: '<5%', points: 20 },
        { range: '5-15%', points: 15 },
        { range: '15-25%', points: 10 },
        { range: '>25%', points: 0 },
      ],
      reviewScore: [
        { range: '>4.8', points: 20 },
        { range: '4.5-4.8', points: 15 },
        { range: '4.0-4.5', points: 10 },
        { range: '<4.0', points: 5 },
      ],
      verification: [
        { level: 'Fully verified', points: 10 },
        { level: 'Email + Phone', points: 7 },
        { level: 'Email only', points: 3 },
        { level: 'None', points: 0 },
      ],
    },
    recommendations,
  };
}

/**
 * Update trust score in provider profile
 */
export async function updateTrustScore(providerId: string): Promise<TrustScore> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID');
  }

  // Calculate new trust score
  const trustScore = await calculateTrustScore(providerId);

  // Determine tier based on badge
  let tier: 'elite' | 'premium' | 'standard' = 'standard';
  switch (trustScore.badge) {
    case 'elite':
      tier = 'elite';
      break;
    case 'premium':
      tier = 'premium';
      break;
    default:
      tier = 'standard';
  }

  // Update provider profile
  await ProviderProfile.findOneAndUpdate(
    { userId: providerId },
    {
      $set: {
        tier,
        'analytics.performanceMetrics.qualityScore': trustScore.overall,
      },
    }
  );

  return trustScore;
}

/**
 * Get list of trust factors for a provider
 */
export async function getTrustFactors(providerId: string): Promise<{
  factors: string[];
  positiveFactors: string[];
  negativeFactors: string[];
  improvementAreas: string[];
}> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID');
  }

  const metrics = await getProviderTrustMetrics(providerId);
  const trustScore = await calculateTrustScore(providerId);

  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const improvementAreas: string[] = [];

  // Analyze each factor
  const factors = trustScore.factors;

  for (const factor of factors) {
    if (factor.includes('Excellent') || factor.includes('Exceptional') || factor.includes('Outstanding') ||
        factor.includes('Minimal') || factor.includes('verified') || factor.includes('Established') ||
        factor.includes('Extensive') || factor.includes('Good')) {
      positiveFactors.push(factor);
    } else if (factor.includes('Low') || factor.includes('High') || factor.includes('needs') ||
               factor.includes('affects') || factor.includes('New to') || factor.includes('no-show')) {
      negativeFactors.push(factor);
    }
  }

  // Generate improvement areas
  if (metrics.responseRate < 90) {
    improvementAreas.push('Response Rate - Accept more booking requests');
  }
  if (metrics.completionRate < 95) {
    improvementAreas.push('Completion Rate - Focus on finishing all accepted bookings');
  }
  if (metrics.cancellationRate > 5) {
    improvementAreas.push('Cancellation Rate - Reduce number of cancellations');
  }
  if (metrics.averageRating < 4.5) {
    improvementAreas.push('Review Score - Encourage happy customers to review');
  }
  if (!metrics.verificationStatus.identity) {
    improvementAreas.push('Identity Verification - Complete ID verification');
  }
  if (!metrics.verificationStatus.background) {
    improvementAreas.push('Background Check - Complete background verification');
  }
  if (metrics.totalBookings < 50) {
    improvementAreas.push('Track Record - Build experience with more bookings');
  }

  return {
    factors,
    positiveFactors,
    negativeFactors,
    improvementAreas,
  };
}

/**
 * Compare trust scores between providers
 */
export async function compareProvidersTrustScores(
  providerIds: string[]
): Promise<Array<{ providerId: string; trustScore: TrustScore; rank: number }>> {
  if (providerIds.length === 0) return [];
  if (providerIds.length > 10) {
    throw new ApiError(400, 'Cannot compare more than 10 providers at once');
  }

  const scores = await Promise.all(
    providerIds.map(async (pid) => {
      const trustScore = await calculateTrustScore(pid);
      return { providerId: pid, trustScore, rank: 0 };
    })
  );

  // Sort by overall score descending
  scores.sort((a, b) => b.trustScore.overall - a.trustScore.overall);

  // Assign ranks
  scores.forEach((score, index) => {
    score.rank = index + 1;
  });

  return scores;
}

/**
 * Get top trusted providers
 */
export async function getTopTrustedProviders(
  limit: number = 10,
  options?: {
    minBookings?: number;
    minRating?: number;
    category?: string;
  }
): Promise<Array<{ providerId: string; trustScore: TrustScore; metrics: TrustMetrics }>> {
  const limitClamped = Math.min(Math.max(1, limit), 50);

  // Build query for provider profiles
  const query: any = {
    isActive: true,
    isDeleted: false,
  };

  if (options?.minRating) {
    query['reviewsData.averageRating'] = { $gte: options.minRating };
  }

  const providerProfiles = await ProviderProfile.find(query)
    .select('userId reviewsData.analytics')
    .lean();

  // Filter by minimum bookings
  let filteredProfiles = providerProfiles;
  if (options?.minBookings) {
    filteredProfiles = providerProfiles.filter(
      (p) => (p.analytics?.bookingStats?.totalBookings || 0) >= options.minBookings!
    );
  }

  // Calculate trust scores and sort
  const providersWithScores = await Promise.all(
    filteredProfiles.map(async (profile) => {
      const trustScore = await calculateTrustScore(profile.userId.toString());
      const metrics = await getProviderTrustMetrics(profile.userId);
      return { providerId: profile.userId.toString(), trustScore, metrics };
    })
  );

  // Sort by trust score
  providersWithScores.sort((a, b) => b.trustScore.overall - a.trustScore.overall);

  return providersWithScores.slice(0, limitClamped);
}

/**
 * Get trust score thresholds (for reference)
 */
export function getTrustThresholds(): {
  badges: Record<TrustBadge, { minScore: number; maxScore: number }>;
  weights: Record<keyof typeof TRUST_WEIGHTS, number>;
  points: {
    responseRate: TrustThreshold[];
    completionRate: TrustThreshold[];
    cancellationRate: TrustThreshold[];
    reviewScore: TrustThreshold[];
    verification: Record<keyof typeof VERIFICATION_POINTS, number>;
  };
} {
  return {
    badges: {
      new: { minScore: 0, maxScore: 49 },
      trusted: { minScore: 50, maxScore: 74 },
      premium: { minScore: 75, maxScore: 89 },
      elite: { minScore: 90, maxScore: 100 },
    },
    weights: TRUST_WEIGHTS,
    points: {
      responseRate: RESPONSE_RATE_THRESHOLDS,
      completionRate: COMPLETION_RATE_THRESHOLDS,
      cancellationRate: CANCELLATION_RATE_THRESHOLDS,
      reviewScore: REVIEW_SCORE_THRESHOLDS,
      verification: VERIFICATION_POINTS,
    },
  };
}

// ============================================
// Service Export
// ============================================

export const trustSafetyService = {
  calculateTrustScore,
  getTrustBreakdown,
  updateTrustScore,
  getTrustFactors,
  compareProvidersTrustScores,
  getTopTrustedProviders,
  getTrustThresholds,
};

export default trustSafetyService;
