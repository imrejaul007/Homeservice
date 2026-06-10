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
  autoTopupsThisMonth: number;
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
// Error Types
// ============================================

export class AutoTopupApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AutoTopupApiError';
  }
}

// ============================================
// API Service
// ============================================

export const autoTopupApi = {
  /**
   * Get auto-topup configuration
   */
  getConfig: async (): Promise<AutoTopupConfigResponse> => {
    try {
      const response = await api.get('/auto-topup/config');
      return response.data.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch auto-topup configuration';
      console.error('AutoTopup API Error - getConfig:', error);
      throw new AutoTopupApiError(message, 'GET_CONFIG_FAILED');
    }
  },

  /**
   * Update auto-topup configuration
   */
  updateConfig: async (config: AutoTopupConfig): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.put('/auto-topup/config', config);
      return response.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update auto-topup configuration';
      console.error('AutoTopup API Error - updateConfig:', error);
      throw new AutoTopupApiError(message, 'UPDATE_CONFIG_FAILED');
    }
  },

  /**
   * Toggle auto-topup on/off
   */
  toggle: async (enabled: boolean): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.post('/auto-topup/toggle', { enabled });
      return response.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to toggle auto-topup';
      console.error('AutoTopup API Error - toggle:', error);
      throw new AutoTopupApiError(message, 'TOGGLE_FAILED');
    }
  },

  /**
   * Get auto-topup transaction history
   */
  getHistory: async (options?: {
    page?: number;
    limit?: number;
  }): Promise<AutoTopupHistoryResponse> => {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const queryString = params.toString();
      const url = queryString ? `/auto-topup/history?${queryString}` : '/auto-topup/history';

      const response = await api.get(url);
      return response.data.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch auto-topup history';
      console.error('AutoTopup API Error - getHistory:', error);
      throw new AutoTopupApiError(message, 'GET_HISTORY_FAILED');
    }
  },

  /**
   * Preview next auto-topup
   */
  preview: async (): Promise<AutoTopupPreview> => {
    try {
      const response = await api.get('/auto-topup/preview');
      return response.data.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to preview auto-topup';
      console.error('AutoTopup API Error - preview:', error);
      throw new AutoTopupApiError(message, 'PREVIEW_FAILED');
    }
  },
};

export default autoTopupApi;
