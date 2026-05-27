import { api } from './api';

// ============================================
// Types
// ============================================

export type BundleStatus = 'draft' | 'active' | 'paused' | 'archived';
export type BundleType = 'subscription' | 'one-time' | 'promotional';
export type DiscountType = 'percentage' | 'fixed' | 'free_service';

export interface BundleService {
  serviceId: string;
  name: string;
  originalPrice: number;
  discountedPrice: number;
  duration: number;
  category?: string;
}

export interface BundlePricing {
  originalTotal: number;
  discountedTotal: number;
  discountAmount: number;
  discountPercentage: number;
  currency: string;
}

export interface BundleLimits {
  maxRedemptions?: number;
  maxRedemptionsPerUser: number;
  minOrderValue?: number;
  validFrom?: string;
  validUntil?: string;
}

export interface Bundle {
  _id: string;
  bundleId: string;
  name: string;
  description?: string;
  provider: any;
  bundleType: BundleType;
  status: BundleStatus;
  services: BundleService[];
  pricing: BundlePricing;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  limits: BundleLimits;
  imageUrl?: string;
  displayColor?: string;
  featured: boolean;
  totalRedemptions: number;
  totalRevenue?: number;
  averageRating?: number;
  reviewCount?: number;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreateBundleDTO {
  name: string;
  description?: string;
  bundleType?: BundleType;
  serviceIds: string[];
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  imageUrl?: string;
  displayColor?: string;
  featured?: boolean;
  displayOrder?: number;
  tags?: string[];
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  minOrderValue?: number;
}

export interface BundleAnalytics {
  totalRedemptions: number;
  totalRevenue: number;
  averageOrderValue: number;
  topServices: Array<{ serviceId: string; name: string; count: number }>;
  redemptionTrend: Array<{ date: string; count: number; revenue: number }>;
}

export interface ProviderBundleStats {
  totalBundles: number;
  activeBundles: number;
  totalRedemptions: number;
  totalRevenue: number;
  avgDiscount: number;
}

// ============================================
// Bundle API Service
// ============================================

class BundleApiService {
  // ========================================
  // Public Endpoints
  // ========================================

  /**
   * Get all active bundles
   */
  async getBundles(options?: {
    page?: number;
    limit?: number;
    type?: BundleType;
    featured?: boolean;
    search?: string;
  }): Promise<{
    success: boolean;
    data: {
      bundles: Bundle[];
      pagination: { page: number; pages: number; total: number };
    };
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.featured !== undefined) params.append('featured', options.featured.toString());
    if (options?.search) params.append('search', options.search);

    const queryString = params.toString();
    const url = `/bundles${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get featured bundles
   */
  async getFeaturedBundles(limit = 10): Promise<{ success: boolean; data: Bundle[] }> {
    const response = await api.get(`/bundles/featured?limit=${limit}`);
    return response.data;
  }

  /**
   * Get bundle by ID
   */
  async getBundleById(bundleId: string): Promise<{ success: boolean; data: Bundle }> {
    const response = await api.get(`/bundles/${bundleId}`);
    return response.data;
  }

  /**
   * Get bundles by provider
   */
  async getProviderBundles(providerId: string, status?: BundleStatus): Promise<{
    success: boolean;
    data: Bundle[];
  }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const queryString = params.toString();
    const url = `/bundles/provider/${providerId}${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get bundles for a service
   */
  async getBundlesForService(serviceId: string): Promise<{ success: boolean; data: Bundle[] }> {
    const response = await api.get(`/bundles/service/${serviceId}`);
    return response.data;
  }

  // ========================================
  // Provider Endpoints
  // ========================================

  /**
   * Create a new bundle
   */
  async createBundle(data: CreateBundleDTO): Promise<{ success: boolean; data: Bundle; message: string }> {
    const response = await api.post('/bundles', data);
    return response.data;
  }

  /**
   * Update a bundle
   */
  async updateBundle(bundleId: string, data: Partial<CreateBundleDTO>): Promise<{
    success: boolean;
    data: Bundle;
    message: string;
  }> {
    const response = await api.put(`/bundles/${bundleId}`, data);
    return response.data;
  }

  /**
   * Change bundle status
   */
  async changeBundleStatus(
    bundleId: string,
    status: BundleStatus
  ): Promise<{ success: boolean; data: Bundle; message: string }> {
    const response = await api.patch(`/bundles/${bundleId}/status`, { status });
    return response.data;
  }

  /**
   * Get provider's bundles
   */
  async getMyBundles(status?: BundleStatus): Promise<{ success: boolean; data: Bundle[] }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const queryString = params.toString();
    const url = `/bundles/my/list${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get provider bundle statistics
   */
  async getMyStats(): Promise<{ success: boolean; data: ProviderBundleStats }> {
    const response = await api.get('/bundles/my/stats');
    return response.data;
  }

  /**
   * Get bundle analytics
   */
  async getBundleAnalytics(bundleId: string): Promise<{ success: boolean; data: BundleAnalytics }> {
    const response = await api.get(`/bundles/${bundleId}/analytics`);
    return response.data;
  }

  /**
   * Delete a bundle
   */
  async deleteBundle(bundleId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/bundles/${bundleId}`);
    return response.data;
  }

  // ========================================
  // Redemption
  // ========================================

  /**
   * Validate bundle for redemption
   */
  async validateBundle(
    bundleId: string,
    orderValue?: number
  ): Promise<{ success: boolean; data: { valid: boolean; reason?: string; bundle?: Bundle } }> {
    const response = await api.post(`/bundles/${bundleId}/validate`, { orderValue });
    return response.data;
  }

  /**
   * Redeem a bundle
   */
  async redeemBundle(
    bundleId: string,
    revenue: number,
    bookingId?: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/bundles/${bundleId}/redeem`, { revenue, bookingId });
    return response.data;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const bundleApi = new BundleApiService();
export default bundleApi;
