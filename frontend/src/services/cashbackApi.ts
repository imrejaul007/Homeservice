import { api } from './api';

// ============================================
// Types
// ============================================

export interface CashbackEntry {
  id: string;
  amount: number;
  currency: string;
  source: 'booking' | 'referral' | 'promotion' | 'refund' | 'loyalty';
  status: 'earned' | 'pending' | 'available' | 'redeemed' | 'expired';
  sourceDescription: string;
  percentage: number;
  earnedAt: string;
  expiresAt: string;
  isExpiringSoon?: boolean;
}

export interface CashbackBalance {
  balance: number;
  currency: string;
  breakdown: Record<string, number>;
}

export interface CashbackStats {
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  availableBalance: number;
  bySource: Record<string, { count: number; amount: number }>;
}

export interface CashbackHistoryResponse {
  cashbacks: CashbackEntry[];
  total: number;
  balance: number;
  page: number;
  pages: number;
}

export interface RedeemResponse {
  success: boolean;
  message: string;
  data: {
    totalRedeemed: number;
    transactionId: string;
  };
}

// ============================================
// API Service
// ============================================

export const cashbackApi = {
  /**
   * Get cashback balance
   */
  getBalance: async (): Promise<CashbackBalance> => {
    const response = await api.get('/cashback/balance');
    return response.data.data;
  },

  /**
   * Get cashback history with filters
   */
  getHistory: async (options?: {
    page?: number;
    limit?: number;
    source?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<CashbackHistoryResponse> => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.source) params.append('source', options.source);
    if (options?.status) params.append('status', options.status);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = queryString ? `/cashback/history?${queryString}` : '/cashback/history';

    const response = await api.get(url);
    return response.data.data;
  },

  /**
   * Get expiring cashback alerts
   */
  getExpiring: async (days: number = 7): Promise<CashbackEntry[]> => {
    const response = await api.get(`/cashback/expiring?days=${days}`);
    return response.data.data.cashbacks;
  },

  /**
   * Get cashback statistics
   */
  getStats: async (): Promise<CashbackStats> => {
    const response = await api.get('/cashback/stats');
    return response.data.data;
  },

  /**
   * Redeem cashback to wallet
   */
  redeem: async (cashbackIds: string[]): Promise<RedeemResponse> => {
    const response = await api.post('/cashback/redeem', { cashbackIds });
    return response.data;
  },
};

export default cashbackApi;
