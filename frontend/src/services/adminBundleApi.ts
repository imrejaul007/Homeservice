import { api } from './api';

// ============================================
// Admin Bundle Types
// ============================================

export interface AdminBundleService {
  serviceId: string;
  serviceName: string;
  quantity: number;
  originalPrice: number;
  description?: string;
}

export interface AdminBundle {
  _id: string;
  name: string;
  description: string;
  services: AdminBundleService[];
  originalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercentage: number;
  currency: string;
  validFrom: string;
  validUntil: string;
  validityPeriodDays?: number;
  maxRedemptions?: number;
  redemptionsUsed: number;
  maxPurchasesPerCustomer?: number;
  bookingCount: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  isActive: boolean;
  isFeatured: boolean;
  image?: string;
  images?: string[];
  tags?: string[];
  terms?: string;
  rating?: {
    average: number;
    count: number;
  };
  providerId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    businessName?: string;
  };
  categoryId?: {
    _id: string;
    name: string;
  };
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BundleStats {
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    featured: number;
  };
  revenue: {
    totalRevenue: number;
    totalOriginalValue: number;
    totalSavings: number;
    totalBookings: number;
    totalRedemptions: number;
    avgSavingsPercentage: number;
  };
}

export interface BundleListParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected';
  search?: string;
  providerId?: string;
}

export interface BundleEditPayload {
  name?: string;
  description?: string;
  services?: AdminBundleService[];
  originalPrice?: number;
  bundlePrice?: number;
  savingsPercentage?: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  categoryId?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  tags?: string[];
  terms?: string;
  image?: string;
  images?: string[];
  maxPurchasesPerCustomer?: number;
}

// ============================================
// Admin Bundle API Service
// ============================================

export const adminBundleApi = {
  /**
   * List all bundles with filters
   */
  list: async (params: BundleListParams = {}) => {
    const response = await api.get('/admin/bundles', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.status ? { status: params.status } : {}),
        ...(params.search ? { search: params.search } : {}),
        ...(params.providerId ? { providerId: params.providerId } : {}),
      },
    });
    return response.data.data as {
      bundles: AdminBundle[];
      pagination: { page: number; limit: number; total: number; pages: number };
    };
  },

  /**
   * Get pending bundles
   */
  getPending: async (params: { page?: number; limit?: number } = {}) => {
    const response = await api.get('/admin/bundles/pending', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    });
    return response.data.data as {
      count: number;
      bundles: AdminBundle[];
      pagination: { page: number; limit: number; total: number; pages: number };
    };
  },

  /**
   * Get single bundle by ID
   */
  getById: async (id: string) => {
    const response = await api.get(`/admin/bundles/${id}`);
    return response.data.data as AdminBundle;
  },

  /**
   * Approve a bundle
   */
  approve: async (id: string) => {
    const response = await api.put(`/admin/bundles/${id}/approve`);
    return response.data;
  },

  /**
   * Reject a bundle
   */
  reject: async (id: string, reason: string) => {
    const response = await api.put(`/admin/bundles/${id}/reject`, { reason });
    return response.data;
  },

  /**
   * Update a bundle
   */
  update: async (id: string, payload: BundleEditPayload) => {
    const response = await api.put(`/admin/bundles/${id}`, payload);
    return response.data;
  },

  /**
   * Delete a bundle
   */
  delete: async (id: string, hard = false) => {
    const response = await api.delete(`/admin/bundles/${id}`, {
      params: { hard },
    });
    return response.data;
  },

  /**
   * Toggle featured status
   */
  toggleFeatured: async (id: string) => {
    const response = await api.post(`/admin/bundles/${id}/toggle-featured`);
    return response.data;
  },

  /**
   * Get bundle statistics
   */
  stats: async (): Promise<BundleStats> => {
    const response = await api.get('/admin/bundles/stats');
    return response.data.data as BundleStats;
  },
};

export default adminBundleApi;
