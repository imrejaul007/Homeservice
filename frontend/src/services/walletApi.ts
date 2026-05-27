import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const walletApi = axios.create({
  baseURL: `${API_BASE_URL}/provider`,
  withCredentials: true,
});

// Add auth token interceptor
walletApi.interceptors.request.use((config) => {
  const stored = sessionStorage.getItem('auth-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.tokens?.accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
  }
  return config;
});

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference: string;
  referenceType: 'booking' | 'refund' | 'bonus' | 'payout' | 'topup' | 'commission';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  balanceAfter: number;
  createdAt: string;
}

export interface Wallet {
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
    const response = await walletApi.get('/wallet');
    return response.data;
  }

  /**
   * Get wallet transactions
   */
  async getTransactions(options?: {
    page?: number;
    limit?: number;
    type?: 'credit' | 'debit';
  }): Promise<TransactionsResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);

    const queryString = params.toString();
    const url = queryString ? `/earnings/transactions?${queryString}` : '/earnings/transactions';

    const response = await walletApi.get(url);
    return response.data;
  }

  /**
   * Get earnings summary
   */
  async getEarningsSummary(period: 'week' | 'month' | 'year' = 'month'): Promise<EarningsSummaryResponse> {
    const response = await walletApi.get(`/earnings/summary?period=${period}`);
    return response.data;
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
    const response = await walletApi.post('/withdraw', data);
    return response.data;
  }

  /**
   * Add money to wallet (top up)
   */
  async addMoney(data: {
    amount: number;
    idempotencyKey: string;
  }): Promise<AddMoneyResponse> {
    const response = await walletApi.post('/add-money', data);
    return response.data;
  }
}

export const walletApi = new WalletApiService();
export default walletApi;
