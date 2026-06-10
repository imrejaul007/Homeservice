import { api } from './api';
import type { BillingCycle } from '../types/subscription.types';

// ============================================
// Custom Error Class
// ============================================

export class CorporateWalletApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'CorporateWalletApiError';
  }
}

const handleApiError = (error: unknown, fallbackMessage: string): never => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
    const statusCode = axiosError.response?.status;
    const message = axiosError.response?.data?.message || fallbackMessage;

    if (statusCode === 401) {
      throw new CorporateWalletApiError(
        'Your session has expired. Please log in again.',
        'AUTH_EXPIRED',
        statusCode,
        error
      );
    }
    if (statusCode === 403) {
      throw new CorporateWalletApiError(
        'You do not have permission to access this feature.',
        'FORBIDDEN',
        statusCode,
        error
      );
    }
    if (statusCode === 404) {
      throw new CorporateWalletApiError(
        'Corporate wallet not found.',
        'NOT_FOUND',
        statusCode,
        error
      );
    }
    if (statusCode === 429) {
      throw new CorporateWalletApiError(
        'Too many requests. Please try again later.',
        'RATE_LIMITED',
        statusCode,
        error
      );
    }
    if (statusCode && statusCode >= 500) {
      throw new CorporateWalletApiError(
        'Server error. Please try again later.',
        'SERVER_ERROR',
        statusCode,
        error
      );
    }

    throw new CorporateWalletApiError(message, 'API_ERROR', statusCode, error);
  }

  if (error && typeof error === 'object' && 'request' in error) {
    throw new CorporateWalletApiError(
      'Network error. Please check your connection.',
      'NETWORK_ERROR',
      undefined,
      error
    );
  }

  throw new CorporateWalletApiError(fallbackMessage, 'UNKNOWN_ERROR', undefined, error);
};

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
  billingCycle: BillingCycle;
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
    try {
      const response = await api.get('/corporate-wallet/wallet');
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'Failed to load corporate wallet details.');
    }
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
    try {
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
    } catch (error) {
      handleApiError(error, 'Failed to load transaction history.');
    }
  },

  /**
   * Get employee spending breakdown
   */
  getSpending: async (): Promise<SpendingResponse> => {
    try {
      const response = await api.get('/corporate-wallet/spending');
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'Failed to load employee spending data.');
    }
  },

  /**
   * Get spending by category
   */
  getBreakdown: async (): Promise<BreakdownResponse> => {
    try {
      const response = await api.get('/corporate-wallet/breakdown');
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'Failed to load spending breakdown.');
    }
  },

  /**
   * Request limit increase
   */
  requestIncrease: async (
    requestedLimit: number,
    reason: string
  ): Promise<{ success: boolean; message?: string; data?: { requestId: string } }> => {
    try {
      const response = await api.post('/corporate-wallet/request-increase', {
        requestedLimit,
        reason,
      });
      return response.data;
    } catch (error) {
      handleApiError(error, 'Failed to submit limit increase request.');
    }
  },
};

export default corporateWalletApi;
