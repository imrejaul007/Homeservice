import { api } from './api';

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

class WalletApiService {
  /**
   * Get wallet balance and summary
   */
  async getWallet(): Promise<WalletResponse> {
    const response = await api.get('/provider/wallet');
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
    const url = queryString ? `/provider/earnings/transactions?${queryString}` : '/provider/earnings/transactions';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get earnings summary
   */
  async getEarningsSummary(period: 'week' | 'month' | 'year' = 'month'): Promise<EarningsSummaryResponse> {
    const response = await api.get(`/provider/earnings/summary?period=${period}`);
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
    const response = await api.post('/provider/withdraw', data);
    return response.data;
  }
}

export const walletApi = new WalletApiService();
export default walletApi;
