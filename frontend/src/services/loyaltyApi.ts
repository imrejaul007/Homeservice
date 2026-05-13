import { api } from './api';

export interface LoyaltyStatus {
  coins: number;
  totalEarned: number;
  totalSpent: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  streakDays: number;
  nextTier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  progressToNext: number;
  pointsToNextTier: number;
  benefits: string[];
  referralCode?: string;
  customerProfile?: {
    currentPoints: number;
    tierProgress: {
      currentTierPoints: number;
      nextTierRequirement: number;
      nextTier: string;
    };
    streakInfo: {
      currentStreak: number;
      longestStreak: number;
      lastBookingDate?: string;
    };
  };
}

export interface PointsHistoryEntry {
  amount: number;
  type: 'earned' | 'spent' | 'bonus' | 'referral';
  description: string;
  date: string;
  relatedBooking?: string;
}

export interface TierBenefits {
  name: string;
  minPoints: number;
  pointsMultiplier: number;
  benefits: string[];
  perks: string[];
}

interface LoyaltyStatusResponse {
  success: boolean;
  data: LoyaltyStatus;
}

interface PointsHistoryResponse {
  success: boolean;
  data: {
    history: PointsHistoryEntry[];
    total: number;
    page: number;
    limit: number;
    pages: number;
    monthlySummary: { [key: string]: { earned: number; spent: number } };
  };
}

interface TierBenefitsResponse {
  success: boolean;
  data: {
    bronze: TierBenefits;
    silver: TierBenefits;
    gold: TierBenefits;
    platinum: TierBenefits;
  };
}

class LoyaltyApiService {
  /**
   * Get current loyalty status
   */
  async getStatus(): Promise<LoyaltyStatusResponse> {
    const response = await api.get('/loyalty/status');
    return response.data;
  }

  /**
   * Get points history with optional filters
   */
  async getHistory(options?: {
    page?: number;
    limit?: number;
    type?: 'earned' | 'spent' | 'bonus' | 'referral';
  }): Promise<PointsHistoryResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);

    const queryString = params.toString();
    const url = queryString ? `/loyalty/history?${queryString}` : '/loyalty/history';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get tier benefits (public)
   */
  async getTierBenefits(): Promise<TierBenefitsResponse> {
    const response = await api.get('/loyalty/benefits');
    return response.data;
  }

  /**
   * Redeem points
   */
  async redeemPoints(points: number, couponCode?: string): Promise<any> {
    const response = await api.post('/loyalty/redeem', {
      points,
      couponCode,
    });
    return response.data;
  }
}

export const loyaltyApi = new LoyaltyApiService();
export default loyaltyApi;
