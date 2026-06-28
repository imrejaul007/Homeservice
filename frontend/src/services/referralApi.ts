import { api } from './api';
import type { ApiResponse } from '../types/api';

export interface ReferralCodeData {
  referralCode: string;
  referralUrl: string;
  referrerReward: number;
  refereeReward: number;
  terms?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals?: number;
  totalRewardsEarned: number;
  recentReferrals?: Array<{
    name: string;
    joinedAt: string;
  }>;
}

export interface ReferralRewardEntry {
  amount: number;
  description: string;
  date: string;
  relatedBooking?: string;
}

class ReferralApiService {
  async getMyCode(): Promise<ApiResponse<ReferralCodeData>> {
    const response = await api.get<ApiResponse<ReferralCodeData>>('/referrals/my-code');
    return response.data;
  }

  async getStats(): Promise<ApiResponse<ReferralStats>> {
    const response = await api.get<ApiResponse<ReferralStats>>('/referrals/stats');
    return response.data;
  }

  async getRewards(): Promise<ApiResponse<{ referralRewards: ReferralRewardEntry[]; totalReferralRewards: number }>> {
    const response = await api.get('/referrals/rewards');
    return response.data;
  }
}

export const referralApi = new ReferralApiService();
export default referralApi;
