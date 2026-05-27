// Engagement & LTV Scoring Engine
// Behavioral scoring for user segmentation and churn prediction

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EngagementScore {
  // Components
  recencyScore: number; // 0-25
  frequencyScore: number; // 0-25
  monetaryScore: number; // 0-25
  engagementScore: number; // 0-25

  // Total
  totalScore: number; // 0-100

  // Segments
  segment: 'churned' | 'at_risk' | 'active' | 'engaged' | 'champion';
  churnRisk: 'low' | 'medium' | 'high' | 'critical';
  ltvTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

  // Predictions
  predictedLTV: number;
  daysUntilChurn: number | null;
  upsellProbability: number;
  referralProbability: number;

  // Metadata
  calculatedAt: number;
  factors: string[]; // Reasons for score
}

interface EngagementState {
  scores: Record<string, EngagementScore>;
  lastCalculated: number;

  // Actions
  calculateScore: (userId: string, data: UserEngagementData) => EngagementScore;
  getScore: (userId: string) => EngagementScore | null;
  updateScore: (userId: string, score: EngagementScore) => void;
}

export interface UserEngagementData {
  userId: string;
  lastActive: number;
  lastBooking: number;
  totalBookings: number;
  totalSpent: number;
  averageBookingValue: number;
  completedReviews: number;
  referralsMade: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  favoriteCategories: string[];
  favoriteProviders: string[];
  notificationOptIn: boolean;
  appOpensThisMonth: number;
}

class EngagementEngine {
  calculate(data: UserEngagementData): EngagementScore {
    const factors: string[] = [];

    // Recency Score (0-25)
    const daysSinceActive = Math.floor((Date.now() - data.lastActive) / (1000 * 60 * 60 * 24));
    const recencyScore = Math.max(0, 25 - (daysSinceActive * 2));
    if (daysSinceActive <= 1) factors.push('Active today');
    else if (daysSinceActive <= 3) factors.push('Recent activity');

    // Frequency Score (0-25)
    const sessionsRatio = data.sessionsThisWeek / Math.max(data.sessionsLastWeek, 1);
    const frequencyScore = Math.min(25, sessionsRatio * 12.5 + (data.totalBookings > 0 ? 12.5 : 0));
    if (data.sessionsThisWeek >= 5) factors.push('Power user');
    if (data.totalBookings >= 10) factors.push('Frequent booker');

    // Monetary Score (0-25)
    const avgSpendNorm = Math.min(25, (data.totalSpent / 10000) * 25);
    const monetaryScore = avgSpendNorm;
    if (data.totalSpent >= 5000) factors.push('High value');
    if (data.averageBookingValue >= 1000) factors.push('Premium spender');

    // Engagement Score (0-25)
    let engagementScore = 0;
    if (data.notificationOptIn) engagementScore += 5;
    if (data.completedReviews >= 3) engagementScore += 5;
    if (data.referralsMade >= 1) engagementScore += 5;
    if (data.favoriteCategories.length >= 3) engagementScore += 5;
    if (data.favoriteProviders.length >= 2) engagementScore += 5;

    if (data.notificationOptIn) factors.push('Notifications enabled');
    if (data.completedReviews >= 3) factors.push('Active reviewer');
    if (data.referralsMade >= 1) factors.push('Brand advocate');

    // Total Score
    const totalScore = Math.round(recencyScore + frequencyScore + monetaryScore + engagementScore);

    // Segment
    let segment: EngagementScore['segment'];
    if (totalScore >= 80) segment = 'champion';
    else if (totalScore >= 60) segment = 'engaged';
    else if (totalScore >= 40) segment = 'active';
    else if (totalScore >= 20) segment = 'at_risk';
    else segment = 'churned';

    // Churn Risk
    let churnRisk: EngagementScore['churnRisk'];
    if (daysSinceActive <= 7) churnRisk = 'low';
    else if (daysSinceActive <= 14) churnRisk = 'medium';
    else if (daysSinceActive <= 30) churnRisk = 'high';
    else churnRisk = 'critical';

    // LTV Tier
    let ltvTier: EngagementScore['ltvTier'];
    if (data.totalSpent >= 50000) ltvTier = 'diamond';
    else if (data.totalSpent >= 20000) ltvTier = 'platinum';
    else if (data.totalSpent >= 10000) ltvTier = 'gold';
    else if (data.totalSpent >= 5000) ltvTier = 'silver';
    else ltvTier = 'bronze';

    // Predictions
    const predictedLTV = data.totalSpent * (1 + (data.totalBookings * 0.1));
    const daysUntilChurn = daysSinceActive <= 30 ? 30 - daysSinceActive : null;
    const upsellProbability = data.averageBookingValue >= 500 ? 0.7 : 0.4;
    const referralProbability = data.referralsMade > 0 ? 0.8 : 0.3;

    return {
      recencyScore,
      frequencyScore,
      monetaryScore,
      engagementScore,
      totalScore,
      segment,
      churnRisk,
      ltvTier,
      predictedLTV,
      daysUntilChurn,
      upsellProbability,
      referralProbability,
      calculatedAt: Date.now(),
      factors,
    };
  }
}

export const engagementEngine = new EngagementEngine();

// Store
export const useEngagementStore = create<EngagementState>()(
  persist(
    (set, get) => ({
      scores: {},
      lastCalculated: 0,

      calculateScore: (userId, data) => {
        const score = engagementEngine.calculate(data);
        set((state) => ({
          scores: { ...state.scores, [userId]: score },
          lastCalculated: Date.now(),
        }));
        return score;
      },

      getScore: (userId) => get().scores[userId] || null,

      updateScore: (userId, score) =>
        set((state) => ({
          scores: { ...state.scores, [userId]: score },
        })),
    }),
    { name: 'nilin-engagement' }
  )
);

// Hook for engagement score
export function useEngagementScore(userId: string, data?: UserEngagementData) {
  const { scores, calculateScore } = useEngagementStore();

  if (data && (!scores[userId] || Date.now() - (scores[userId]?.calculatedAt || 0) > 3600000)) {
    // Recalculate if data changed or score is stale (1 hour)
    return calculateScore(userId, data);
  }

  return scores[userId] || null;
}

// Hook for segment-based UI
export function useUserSegment(userId: string) {
  const score = useEngagementStore((state) => state.scores[userId]);

  return {
    segment: score?.segment || 'churned',
    churnRisk: score?.churnRisk || 'critical',
    ltvTier: score?.ltvTier || 'bronze',
    isChampion: score?.segment === 'champion',
    isAtRisk: score?.segment === 'at_risk' || score?.segment === 'churned',
    needsReengagement: score?.churnRisk === 'high' || score?.churnRisk === 'critical',
    factors: score?.factors || [],
  };
}

export default useEngagementStore;
