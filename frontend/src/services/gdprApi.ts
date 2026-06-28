import { api } from './api';

// ============================================
// GDPR API Service
// ============================================

export interface DataExportRequest {
  requestId: string;
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'failed';
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  fileSize?: number;
}

export interface ExportHistoryItem {
  requestId: string;
  status: DataExportRequest['status'];
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
}

export interface UserConsent {
  consentType: string;
  version: string;
  granted: boolean;
  grantedAt: string;
  withdrawnAt?: string;
}

export interface GDPRStats {
  totalExports: number;
  pendingExports: number;
  completedExports: number;
  latestExport?: DataExportRequest;
}

export interface GDPRApi {
  /**
   * Request a data export
   */
  requestExport: () => Promise<DataExportRequest>;

  /**
   * Get export status/progress
   */
  getExportStatus: (requestId: string) => Promise<DataExportRequest>;

  /**
   * Download exported data
   */
  downloadExport: (requestId: string) => Promise<Blob>;

  /**
   * Get export history
   */
  getExportHistory: () => Promise<ExportHistoryItem[]>;

  /**
   * Get all user data requests (export/deletion history)
   */
  getDataRequests: () => Promise<ExportHistoryItem[]>;

  /**
   * Request export with format and data type options
   */
  requestExportWithOptions: (options: {
    exportFormat?: 'json' | 'csv' | 'pdf';
    exportDataTypes?: string[];
  }) => Promise<DataExportRequest>;

  /**
   * Record consent with version metadata
   */
  recordConsentDetailed: (payload: {
    type: string;
    granted: boolean;
    version?: string;
    method?: string;
  }) => Promise<void>;

  /**
   * Get user's consent records
   */
  getConsents: () => Promise<UserConsent[]>;

  /**
   * Get consent summary
   */
  getConsentSummary: () => Promise<{
    total: number;
    granted: number;
    withdrawn: number;
    pending: number;
  }>;

  /**
   * Record a consent decision
   */
  recordConsent: (consentType: string, granted: boolean) => Promise<void>;

  /**
   * Bulk update consents
   */
  recordBulkConsents: (consents: Array<{ consentType: string; granted: boolean }>) => Promise<void>;

  /**
   * Get portable data (all user data in portable format)
   */
  getPortableData: () => Promise<{
    profile: Record<string, unknown>;
    bookings: Record<string, unknown>[];
    payments: Record<string, unknown>[];
    reviews: Record<string, unknown>[];
    preferences: Record<string, unknown>;
    exportedAt: string;
  }>;

  /**
   * Request data rectification
   */
  requestRectification: (data: Record<string, unknown>) => Promise<void>;

  /**
   * Get GDPR compliance stats (admin)
   */
  getStats: () => Promise<GDPRStats>;

  /**
   * Request account deletion
   */
  requestAccountDeletion: (payload: { deletionReason: string; confirmation: boolean }) => Promise<void>;

  /**
   * Cancel a pending data request
   */
  cancelDataRequest: (requestId: string) => Promise<void>;
}

export const gdprApi: GDPRApi = {
  requestExport: async () => {
    const response = await api.post('/gdpr/export');
    return response.data.data;
  },

  getExportStatus: async (requestId: string) => {
    const response = await api.get(`/gdpr/export/${requestId}/progress`);
    return response.data.data;
  },

  downloadExport: async (requestId: string) => {
    const response = await api.get(`/gdpr/export/${requestId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getExportHistory: async () => {
    const response = await api.get('/gdpr/export/history');
    const items = Array.isArray(response.data.data) ? response.data.data : [];
    return items.map((item: Record<string, unknown>) => ({
      requestId: String(item.requestId ?? item.id ?? item._id ?? ''),
      status: item.status as ExportHistoryItem['status'],
      requestedAt: String(item.requestedAt ?? ''),
      completedAt: item.completedAt as string | undefined,
      expiresAt: item.expiresAt as string | undefined,
    }));
  },

  getDataRequests: async () => {
    const response = await api.get('/gdpr/data-requests');
    const items = Array.isArray(response.data.data) ? response.data.data : [];
    return items.map((item: Record<string, unknown>) => ({
      requestId: String(item.requestId ?? item.id ?? item._id ?? ''),
      status: item.status as ExportHistoryItem['status'],
      requestedAt: String(item.requestedAt ?? ''),
      completedAt: item.completedAt as string | undefined,
      expiresAt: item.expiresAt as string | undefined,
    }));
  },

  requestExportWithOptions: async (options) => {
    const response = await api.post('/gdpr/export', options);
    return response.data.data;
  },

  recordConsentDetailed: async (payload) => {
    await api.post('/gdpr/consents', payload);
  },

  getConsents: async () => {
    const response = await api.get('/gdpr/consents');
    return response.data.data ?? [];
  },

  getConsentSummary: async () => {
    const response = await api.get('/gdpr/consents/summary');
    return response.data.data ?? { total: 0, granted: 0, withdrawn: 0, pending: 0 };
  },

  recordConsent: async (consentType: string, granted: boolean) => {
    await api.post('/gdpr/consents', { type: consentType, granted });
  },

  recordBulkConsents: async (consents) => {
    await api.post('/gdpr/consents/bulk', { consents });
  },

  getPortableData: async () => {
    const response = await api.get('/gdpr/portable-data');
    return response.data.data;
  },

  requestRectification: async (data) => {
    await api.post('/gdpr/rectification', { data });
  },

  getStats: async () => {
    const response = await api.get('/gdpr/admin/stats');
    return response.data.data;
  },

  requestAccountDeletion: async (payload) => {
    await api.post('/gdpr/delete', payload);
  },

  cancelDataRequest: async (requestId: string) => {
    await api.delete(`/gdpr/data-requests/${requestId}`);
  },
};

export default gdprApi;
