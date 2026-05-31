import { api } from './api';

// ============================================
// Types
// ============================================

export interface Voucher {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free_service';
  discountValue: number;
  maxDiscount?: number;
  currency: string;
  validFrom: string;
  validUntil: string;
  status: string;
  minimumOrderValue?: number;
}

export interface VoucherUsage {
  id: string;
  voucherId: string;
  voucherCode: string;
  usedAt: string;
  discountApplied: number;
  bookingId?: string;
}

export interface VoucherValidationResult {
  valid: boolean;
  voucher?: Voucher;
  discount?: number;
  error?: string;
}

export interface VoucherListResponse {
  vouchers: Voucher[];
  total: number;
  page: number;
  pages: number;
}

export interface VoucherUsageResponse {
  usages: VoucherUsage[];
  total: number;
  page: number;
  pages: number;
}

export interface ApplyVoucherResponse {
  success: boolean;
  message?: string;
  data: {
    discount: number;
    usageId: string;
  };
}

// ============================================
// API Service
// ============================================

export const voucherApi = {
  /**
   * Validate a voucher code
   */
  validate: async (
    code: string,
    orderAmount?: number
  ): Promise<VoucherValidationResult> => {
    const response = await api.post('/vouchers/validate', {
      code,
      orderAmount,
    });
    return response.data.data;
  },

  /**
   * Apply voucher to a booking
   */
  apply: async (code: string, bookingId: string): Promise<ApplyVoucherResponse> => {
    const response = await api.post('/vouchers/apply', {
      code,
      bookingId,
    });
    return response.data;
  },

  /**
   * Get available vouchers for the user
   */
  getAvailable: async (options?: {
    page?: number;
    limit?: number;
  }): Promise<VoucherListResponse> => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vouchers/available?${queryString}` : '/vouchers/available';

    const response = await api.get(url);
    return response.data.data;
  },

  /**
   * Get user's voucher usage history
   */
  getHistory: async (options?: {
    page?: number;
    limit?: number;
  }): Promise<VoucherUsageResponse> => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vouchers/history?${queryString}` : '/vouchers/history';

    const response = await api.get(url);
    return response.data.data;
  },

  /**
   * Get expiring voucher alerts
   */
  getExpiring: async (days: number = 7): Promise<Voucher[]> => {
    const response = await api.get(`/vouchers/expiring?days=${days}`);
    return response.data.data.vouchers;
  },
};

export default voucherApi;
