import { api } from './api';

// ============================================
// Types
// ============================================

export interface CorporateWallet {
  id: string;
  companyId: string;
  companyName: string;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  currency: string;
  dailySpendingLimit?: number;
  monthlySpendingLimit?: number;
  perTransactionLimit?: number;
  totalSpent: number;
  totalSpentThisMonth: number;
  status: 'active' | 'suspended' | 'frozen' | 'closed';
  billingCycle: 'monthly' | 'quarterly' | 'annually';
  billingDay: number;
  nextBillingDate: string;
}

export interface CorporateTransaction {
  id: string;
  type: 'charge' | 'refund' | 'credit' | 'limit_adjustment' | 'fee';
  amount: number;
  description: string;
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  balanceAfter: number;
  employeeName?: string;
  createdAt: string;
  completedAt?: string;
}

export interface EmployeeSpending {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department?: string;
  totalSpent: number;
  monthlyLimit?: number;
  usedThisMonth: number;
  bookingCount: number;
}

export interface SpendingBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  bookingCount: number;
}

export interface CorporateWalletResponse {
  hasCorporateWallet: boolean;
  wallet: CorporateWallet | null;
}

export interface TransactionHistoryResponse {
  transactions: CorporateTransaction[];
  total: number;
  page: number;
  pages: number;
}

export interface SpendingResponse {
  employees: EmployeeSpending[];
}

export interface BreakdownResponse {
  breakdown: SpendingBreakdown[];
}

// ============================================
// API Service
// ============================================

export const corporateWalletApi = {
  /**
   * Get corporate wallet details
   */
  getWallet: async (): Promise<CorporateWalletResponse> => {
    const response = await api.get('/corporate-wallet/wallet');
    return response.data.data;
  },

  /**
   * Get transaction history
   */
  getTransactions: async (options?: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TransactionHistoryResponse> => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = queryString ? `/corporate-wallet/transactions?${queryString}` : '/corporate-wallet/transactions';

    const response = await api.get(url);
    return response.data.data;
  },

  /**
   * Get employee spending breakdown
   */
  getSpending: async (): Promise<SpendingResponse> => {
    const response = await api.get('/corporate-wallet/spending');
    return response.data.data;
  },

  /**
   * Get spending by category
   */
  getBreakdown: async (): Promise<BreakdownResponse> => {
    const response = await api.get('/corporate-wallet/breakdown');
    return response.data.data;
  },

  /**
   * Request limit increase
   */
  requestIncrease: async (
    requestedLimit: number,
    reason: string
  ): Promise<{ success: boolean; message?: string; data?: { requestId: string } }> => {
    const response = await api.post('/corporate-wallet/request-increase', {
      requestedLimit,
      reason,
    });
    return response.data;
  },
};

export default corporateWalletApi;
