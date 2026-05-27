import { api } from './api';

// ===================================
// TYPES & INTERFACES
// ===================================

export interface Payout {
  _id: string;
  payoutNumber: string;
  providerId: string;
  settlementId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  method: 'bank_transfer' | 'wallet';
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    iban?: string;
    swiftCode?: string;
  };
  stripePayoutId?: string;
  scheduledDate: string;
  processedDate?: string;
  failures: Array<{
    reason: string;
    errorCode?: string;
    date: string;
    retryAttempt: number;
  }>;
  earningsBreakdown: {
    grossAmount: number;
    commission: number;
    platformFee: number;
    deductions: number;
    netAmount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  _id: string;
  settlementNumber: string;
  providerId: string;
  payoutId?: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  commission: number;
  platformFee: number;
  netAmount: number;
  deductions: Array<{
    type: string;
    amount: number;
    description: string;
    reference?: string;
  }>;
  lineItems: Array<{
    bookingId: string;
    bookingNumber: string;
    date: string;
    grossAmount: number;
    commissionAmount: number;
    platformFeeAmount: number;
    netAmount: number;
    status: 'pending' | 'included' | 'disputed';
  }>;
  status: 'pending' | 'approved' | 'paid' | 'disputed' | 'cancelled';
  currency: string;
  reconciliation: {
    isReconciled: boolean;
    reconciledAt?: string;
    discrepancies?: Array<{
      field: string;
      expected: number;
      actual: number;
      resolved: boolean;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  paidAt?: string;
}

export interface EarningsBreakdown {
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  completedBookings: number;
  refundedAmount: number;
  chargebackAmount: number;
  commission: number;
  platformFee: number;
  otherDeductions: number;
  netPayable: number;
}

export interface EarningsSummary {
  breakdown: EarningsBreakdown;
  pendingAmount: number;
  totalPaid: number;
  upcomingPayouts: Payout[];
}

export interface PayoutStats {
  totalPaid: number;
  pendingAmount: number;
  failedAmount: number;
  payoutCount: number;
  avgPayoutAmount: number;
}

export interface PayoutConfig {
  schedule: {
    frequency: 'weekly' | 'bi-weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    minPayoutAmount: number;
    maxPayoutAmount?: number;
  };
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    iban?: string;
    swiftCode?: string;
  };
  enabled: boolean;
}

export interface SettlementSummary {
  totalGross: number;
  totalCommission: number;
  totalPlatformFee: number;
  totalNet: number;
  settlementCount: number;
  pendingCount: number;
  paidCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

// ===================================
// API SERVICE
// ===================================

class PayoutApiService {
  /**
   * Get payout history for the authenticated provider
   */
  async getPayouts(options?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Payout>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = queryString ? `/payout/payouts?${queryString}` : '/payout/payouts';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get upcoming payouts for the authenticated provider
   */
  async getUpcomingPayouts(): Promise<ApiResponse<Payout[]>> {
    const response = await api.get('/payout/payouts/upcoming');
    return response.data;
  }

  /**
   * Get payout statistics for the authenticated provider
   */
  async getPayoutStats(period: 'week' | 'month' | 'year' = 'month'): Promise<ApiResponse<PayoutStats>> {
    const response = await api.get(`/payout/payouts/stats?period=${period}`);
    return response.data;
  }

  /**
   * Get specific payout details
   */
  async getPayout(payoutId: string): Promise<ApiResponse<Payout>> {
    const response = await api.get(`/payout/payouts/${payoutId}`);
    return response.data;
  }

  /**
   * Cancel a payout
   */
  async cancelPayout(payoutId: string, reason: string): Promise<ApiResponse<null>> {
    const response = await api.post(`/payout/payouts/${payoutId}/cancel`, { reason });
    return response.data;
  }

  /**
   * Get earnings breakdown for the authenticated provider
   */
  async getEarnings(options?: {
    periodStart?: string;
    periodEnd?: string;
  }): Promise<ApiResponse<EarningsSummary>> {
    const params = new URLSearchParams();
    if (options?.periodStart) params.append('periodStart', options.periodStart);
    if (options?.periodEnd) params.append('periodEnd', options.periodEnd);

    const queryString = params.toString();
    const url = queryString ? `/payout/earnings?${queryString}` : '/payout/earnings';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get earnings summary for the authenticated provider
   */
  async getEarningsSummary(period: 'week' | 'month' | 'year' = 'month'): Promise<ApiResponse<{
    period: string;
    payouts: PayoutStats;
    settlements: SettlementSummary;
  }>> {
    const response = await api.get(`/payout/earnings/summary?period=${period}`);
    return response.data;
  }

  /**
   * Get settlement history for the authenticated provider
   */
  async getSettlements(options?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Settlement>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = queryString ? `/payout/settlements?${queryString}` : '/payout/settlements';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get specific settlement details
   */
  async getSettlement(settlementId: string): Promise<ApiResponse<Settlement>> {
    const response = await api.get(`/payout/settlements/${settlementId}`);
    return response.data;
  }

  /**
   * Dispute a settlement
   */
  async disputeSettlement(settlementId: string, reason: string): Promise<ApiResponse<null>> {
    const response = await api.post(`/payout/settlements/${settlementId}/dispute`, { reason });
    return response.data;
  }

  /**
   * Get settlement summary for the authenticated provider
   */
  async getSettlementSummary(period: 'week' | 'month' | 'year' = 'month'): Promise<ApiResponse<SettlementSummary>> {
    const response = await api.get(`/payout/settlements/summary?period=${period}`);
    return response.data;
  }

  /**
   * Get payout configuration for the authenticated provider
   */
  async getPayoutConfig(): Promise<ApiResponse<PayoutConfig>> {
    const response = await api.get('/payout/config');
    return response.data;
  }

  /**
   * Update payout configuration for the authenticated provider
   */
  async updatePayoutConfig(config: Partial<PayoutConfig>): Promise<ApiResponse<PayoutConfig>> {
    const response = await api.put('/payout/config', config);
    return response.data;
  }
}

export const payoutApi = new PayoutApiService();
export default payoutApi;
