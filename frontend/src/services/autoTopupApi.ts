import { api } from './api';

// ============================================
// Types
// ============================================

export interface AutoTopupConfig {
  enabled: boolean;
  thresholdAmount: number;
  topupAmount: number;
  paymentMethodId: string;
  paymentMethodType: 'card' | 'bank_account' | 'wallet';
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  maxAutoTopupsPerMonth: number;
  maxAutoTopupAmount: number;
}

export interface AutoTopupLog {
  id: string;
  topupAmount: number;
  triggerBalance: number;
  status: 'success' | 'failed' | 'skipped';
  failureReason?: string;
  triggeredAt: string;
  completedAt?: string;
}

export interface AutoTopupPreview {
  willTrigger: boolean;
  currentBalance: number;
  thresholdAmount: number;
  topupAmount: number;
  projectedBalance: number;
  reason?: string;
}

export interface AutoTopupConfigResponse {
  configured: boolean;
  config: AutoTopupConfig | null;
}

export interface AutoTopupHistoryResponse {
  logs: AutoTopupLog[];
  total: number;
  page: number;
  pages: number;
}

// ============================================
// API Service
// ============================================

export const autoTopupApi = {
  /**
   * Get auto-topup configuration
   */
  getConfig: async (): Promise<AutoTopupConfigResponse> => {
    const response = await api.get('/auto-topup/config');
    return response.data.data;
  },

  /**
   * Update auto-topup configuration
   */
  updateConfig: async (config: AutoTopupConfig): Promise<{ success: boolean; message?: string }> => {
    const response = await api.put('/auto-topup/config', config);
    return response.data;
  },

  /**
   * Toggle auto-topup on/off
   */
  toggle: async (enabled: boolean): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post('/auto-topup/toggle', { enabled });
    return response.data;
  },

  /**
   * Get auto-topup transaction history
   */
  getHistory: async (options?: {
    page?: number;
    limit?: number;
  }): Promise<AutoTopupHistoryResponse> => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/auto-topup/history?${queryString}` : '/auto-topup/history';

    const response = await api.get(url);
    return response.data.data;
  },

  /**
   * Preview next auto-topup
   */
  preview: async (): Promise<AutoTopupPreview> => {
    const response = await api.get('/auto-topup/preview');
    return response.data.data;
  },
};

export default autoTopupApi;
