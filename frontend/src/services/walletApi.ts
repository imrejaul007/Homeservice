import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '@/config/api';
import { secureStorage } from '@/lib/security';

export class WalletApiError extends Error {
  constructor(
    message: string,
    public statusCode: number | undefined,
    public code: string
  ) {
    super(message);
    this.name = 'WalletApiError';
  }
}

const api = axios.create({
  baseURL: `${API_BASE_URL}/provider`,
  withCredentials: true,
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const stored = secureStorage.getItem('auth-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.tokens?.accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[WalletApi] Failed to parse auth storage:', e);
      }
    }
  }
  return config;
});

// Note: Backend returns Date objects that serialize to ISO strings in JSON
// Frontend accepts both Date (backend response) and string (JSON serialization)
export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference: string;
  referenceType: 'booking' | 'refund' | 'bonus' | 'payout' | 'topup' | 'commission';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  balanceAfter: number;
  metadata?: Record<string, unknown>;
  updatedAt: string | Date;
  createdAt: string | Date;
  // Audit fields from backend model
  processedBy?: string; // Admin/system that processed (mongoose ObjectId as string)
  reason?: string; // Reason for transaction
}

export interface Wallet {
  _id?: string;
  balance: number;
  currency: string;
  pendingBalance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface EarningsSummary {
  period: 'week' | 'month' | 'year';
  earnings: number;
  withdrawals: number;
  netEarnings: number;
  transactionCount: number;
  startDate: string;
  endDate: string;
}

interface WalletResponse {
  success: boolean;
  data: Wallet;
}

interface TransactionsResponse {
  success: boolean;
  data: {
    transactions: WalletTransaction[];
    total: number;
    page: number;
    pages: number;
  };
}

interface EarningsSummaryResponse {
  success: boolean;
  data: EarningsSummary;
}

interface WithdrawalResponse {
  success: boolean;
  message: string;
  data: {
    transactionId: string;
    newBalance: number;
    estimatedProcessingTime: string;
  };
}

interface AddMoneyResponse {
  success: boolean;
  message?: string;
  data: {
    transactionId: string;
    newBalance: number;
  };
}

class WalletApiService {
  /**
   * Get wallet balance and summary
   */
  async getWallet(): Promise<WalletResponse> {
    try {
      const response = await api.get('/wallet');
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new WalletApiError(
          error.response?.data?.message || 'Failed to fetch wallet',
          error.response?.status,
          'GET_WALLET_ERROR'
        );
      }
      throw new WalletApiError('Network error while fetching wallet', undefined, 'NETWORK_ERROR');
    }
  }

  /**
   * Get wallet transactions
   */
  async getTransactions(options?: {
    page?: number;
    limit?: number;
    type?: 'credit' | 'debit';
  }): Promise<TransactionsResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.type) params.append('type', options.type);

      const queryString = params.toString();
      const url = queryString ? `/earnings/transactions?${queryString}` : '/earnings/transactions';

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new WalletApiError(
          error.response?.data?.message || 'Failed to fetch transactions',
          error.response?.status,
          'GET_TRANSACTIONS_ERROR'
        );
      }
      throw new WalletApiError('Network error while fetching transactions', undefined, 'NETWORK_ERROR');
    }
  }

  /**
   * Get earnings summary
   */
  async getEarningsSummary(period: 'week' | 'month' | 'year' = 'month'): Promise<EarningsSummaryResponse> {
    try {
      const response = await api.get(`/earnings/summary?period=${period}`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new WalletApiError(
          error.response?.data?.message || 'Failed to fetch earnings summary',
          error.response?.status,
          'GET_EARNINGS_SUMMARY_ERROR'
        );
      }
      throw new WalletApiError('Network error while fetching earnings summary', undefined, 'NETWORK_ERROR');
    }
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(data: {
    amount: number;
    bankAccount: {
      bankName: string;
      accountNumber: string;
      iban: string;
      accountHolder: string;
    };
  }): Promise<WithdrawalResponse> {
    const response = await api.post('/withdraw', data);
    return response.data;
  }

  /**
   * Add money to wallet (top up)
   */
  async addMoney(data: {
    amount: number;
    idempotencyKey: string;
  }): Promise<AddMoneyResponse> {
    const response = await api.post('/add-money', data);
    return response.data;
  }
}

export const walletApi = new WalletApiService();
export default walletApi;
