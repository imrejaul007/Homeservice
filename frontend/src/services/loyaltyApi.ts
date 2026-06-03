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
  tierProgress: {
    currentTierPoints: number;
    nextTierRequirement: number;
    nextTier: string | null;
    percentage: number;
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

export class LoyaltyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'LoyaltyApiError';
  }
}

class LoyaltyApiService {
  /**
   * Get current loyalty status
   */
  async getStatus(): Promise<LoyaltyStatusResponse> {
    try {
      const response = await api.get('/loyalty/status');
      return response.data;
    } catch (error) {
      console.error('[loyaltyApi] getStatus error:', error);
      const statusCode = (error as { response?: { status?: number } })?.response?.status;
      throw new LoyaltyApiError('Failed to fetch loyalty status', statusCode, error);
    }
  }

  /**
   * Get points history with optional filters
   */
  async getHistory(options?: {
    page?: number;
    limit?: number;
    type?: 'earned' | 'spent' | 'bonus' | 'referral';
  }): Promise<PointsHistoryResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.type) params.append('type', options.type);

      const queryString = params.toString();
      const url = queryString ? `/loyalty/history?${queryString}` : '/loyalty/history';

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('[loyaltyApi] getHistory error:', error);
      const statusCode = (error as { response?: { status?: number } })?.response?.status;
      throw new LoyaltyApiError('Failed to fetch points history', statusCode, error);
    }
  }

  /**
   * Get tier benefits (public)
   */
  async getTierBenefits(): Promise<TierBenefitsResponse> {
    try {
      const response = await api.get('/loyalty/benefits');
      return response.data;
    } catch (error) {
      console.error('[loyaltyApi] getTierBenefits error:', error);
      const statusCode = (error as { response?: { status?: number } })?.response?.status;
      throw new LoyaltyApiError('Failed to fetch tier benefits', statusCode, error);
    }
  }

  /**
   * Redeem points
   */
  async redeemPoints(points: number, couponCode?: string): Promise<any> {
    try {
      const response = await api.post('/loyalty/redeem', {
        points,
        couponCode,
      });
      return response.data;
    } catch (error) {
      console.error('[loyaltyApi] redeemPoints error:', error);
      const statusCode = (error as { response?: { status?: number } })?.response?.status;
      throw new LoyaltyApiError('Failed to redeem points', statusCode, error);
    }
  }
}

export const loyaltyApi = new LoyaltyApiService();
export default loyaltyApi;
