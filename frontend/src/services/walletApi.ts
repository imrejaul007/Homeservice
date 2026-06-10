import axios, { AxiosInstance, AxiosError } from 'axios';
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

function createWalletClient(prefix: 'customer' | 'provider'): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_BASE_URL}/${prefix}`,
    withCredentials: true,
  });

  client.interceptors.request.use((config) => {
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

  return client;
}

// Note: Backend returns Date objects that serialize to ISO strings in JSON
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
  processedBy?: string;
  reason?: string;
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
  creditsAdded?: number;
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
    pendingBalance?: number;
    amount?: number;
  };
}

interface TopUpIntentResponse {
  success: boolean;
  data: {
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    simulated?: boolean;
  };
}

interface DeductCreditsResponse {
  success: boolean;
  message?: string;
  data: {
    transactionId: string;
    newBalance: number;
    amount: number;
  };
}

class WalletApiService {
  constructor(private readonly api: AxiosInstance) {}

  async getWallet(): Promise<WalletResponse> {
    try {
      const response = await this.api.get('/wallet');
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

      const response = await this.api.get(url);
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

  async getEarningsSummary(period: 'week' | 'month' | 'year' = 'month'): Promise<EarningsSummaryResponse> {
    try {
      const response = await this.api.get(`/earnings/summary?period=${period}`);
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

  async requestWithdrawal(data: {
    amount: number;
    bankAccount: {
      bankName: string;
      accountNumber: string;
      iban: string;
      accountHolder: string;
    };
  }): Promise<WithdrawalResponse> {
    const response = await this.api.post('/withdraw', data);
    return response.data;
  }

  async createTopUpIntent(data: {
    amount: number;
    idempotencyKey?: string;
  }): Promise<TopUpIntentResponse> {
    const response = await this.api.post('/add-money/intent', data);
    return response.data;
  }

  async addMoney(data: {
    amount: number;
    paymentIntentId?: string;
    idempotencyKey?: string;
  }): Promise<AddMoneyResponse> {
    const response = await this.api.post('/add-money', data);
    return response.data;
  }

  async deductCredits(data: {
    amount: number;
    reason: string;
    reference?: string;
    referenceType?: 'booking' | 'refund' | 'commission' | 'fee' | 'penalty' | 'other';
    idempotencyKey?: string;
  }): Promise<DeductCreditsResponse> {
    try {
      const response = await this.api.post('/deduct', data);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new WalletApiError(
          error.response?.data?.message || 'Failed to deduct credits',
          error.response?.status,
          'DEDUCT_CREDITS_ERROR'
        );
      }
      throw new WalletApiError('Network error while deducting credits', undefined, 'NETWORK_ERROR');
    }
  }
}

/** Customer wallet (GET /api/customer/wallet) */
export const customerWalletApi = new WalletApiService(createWalletClient('customer'));

/** Provider wallet (GET /api/provider/wallet) */
export const providerWalletApi = new WalletApiService(createWalletClient('provider'));

/** @deprecated Use customerWalletApi or providerWalletApi explicitly */
export const walletApi = customerWalletApi;
export default customerWalletApi;
