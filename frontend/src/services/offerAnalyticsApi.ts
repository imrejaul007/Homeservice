import { api } from './api';

// ============================================
// Types
// ============================================

export interface OfferPerformance {
  offerId: string;
  name: string;
  code: string;
  claims: number;
  redemptions: number;
  discountGiven: number;
  conversionRate: number;
  revenue: number;
  averageOrderValue: number;
}

export interface OfferTrend {
  date: string;
  claims: number;
  redemptions: number;
  revenue: number;
}

export interface GlobalOfferAnalytics {
  totalOffers: number;
  activeOffers: number;
  totalClaims: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  averageConversionRate: number;
  topOffers: OfferPerformance[];
  offersByType: Record<string, number>;
  offersByStatus: Record<string, number>;
}

export interface SingleOfferAnalytics {
  totalClaims: number;
  totalRedemptions: number;
  redemptionRate: number;
  averageDiscount: number;
  totalDiscountGiven: number;
  popularDays: Array<{ day: string; count: number }>;
  popularHours: Array<{ hour: number; count: number }>;
  trends: OfferTrend[];
}

export interface ProviderOfferAnalytics {
  totalOffers: number;
  activeOffers: number;
  totalClaims: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  avgConversionRate: number;
  avgOrderValue: number;
}

export interface UserOfferAnalytics {
  totalClaims: number;
  totalRedemptions: number;
  totalDiscountUsed: number;
  activeClaims: number;
  expiredClaims: number;
  averageSavings: number;
  favoriteCategories: string[];
}

export interface AdminOfferDashboard {
  summary: {
    totalOffers: number;
    activeOffers: number;
    totalClaims: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
    avgConversionRate: number;
  };
  topPerformers: OfferPerformance[];
  recentActivity: Array<{
    type: 'claim' | 'redemption';
    offerCode: string;
    userId: string;
    timestamp: string;
    discount: number;
  }>;
  expiringSoon: Array<{
    offerId: string;
    code: string;
    name: string;
    expiresAt: string;
    remainingUses: number;
  }>;
}

export interface OffersRequiringAttention {
  underperforming: Array<{
    offerId: string;
    code: string;
    name: string;
    claims: number;
  }>;
  expiringSoon: Array<{
    offerId: string;
    code: string;
    name: string;
    daysRemaining: number;
  }>;
  nearlyExhausted: Array<{
    offerId: string;
    code: string;
    name: string;
    remainingUses: number;
  }>;
}

// ============================================
// Offer Analytics API Service
// ============================================

class OfferAnalyticsApiService {
  // ========================================
  // Public Endpoints
  // ========================================

  /**
   * Get basic offer summary for display
   */
  async getOfferSummary(offerId: string): Promise<{
    success: boolean;
    data: {
      totalClaims: number;
      totalRedemptions: number;
      redemptionRate: number;
    };
  }> {
    const response = await api.get(`/offers-analytics/offer/${offerId}/summary`);
    return response.data;
  }

  // ========================================
  // Protected Endpoints (Admin)
  // ========================================

  /**
   * Get platform-wide offer analytics
   */
  async getGlobalAnalytics(dateRange?: {
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; data: GlobalOfferAnalytics }> {
    const params = new URLSearchParams();
    if (dateRange) {
      params.append('startDate', dateRange.startDate);
      params.append('endDate', dateRange.endDate);
    }

    const queryString = params.toString();
    const url = `/offers-analytics/global${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get offer trend data
   */
  async getTrends(
    period: 'day' | 'week' | 'month' = 'month',
    days = 30
  ): Promise<{ success: boolean; data: OfferTrend[] }> {
    const response = await api.get(`/offers-analytics/trends?period=${period}&days=${days}`);
    return response.data;
  }

  /**
   * Get detailed analytics for a specific offer
   */
  async getOfferAnalytics(offerId: string): Promise<{ success: boolean; data: SingleOfferAnalytics }> {
    const response = await api.get(`/offers-analytics/offer/${offerId}`);
    return response.data;
  }

  /**
   * Get admin dashboard summary
   */
  async getAdminDashboard(): Promise<{ success: boolean; data: AdminOfferDashboard }> {
    const response = await api.get('/offers-analytics/dashboard');
    return response.data;
  }

  /**
   * Get offers requiring attention
   */
  async getOffersRequiringAttention(): Promise<{
    success: boolean;
    data: OffersRequiringAttention;
  }> {
    const response = await api.get('/offers-analytics/attention-required');
    return response.data;
  }

  // ========================================
  // Provider Endpoints
  // ========================================

  /**
   * Get analytics for a provider's offers
   */
  async getProviderAnalytics(providerId: string): Promise<{
    success: boolean;
    data: ProviderOfferAnalytics;
  }> {
    const response = await api.get(`/offers-analytics/provider/${providerId}`);
    return response.data;
  }

  // ========================================
  // User Endpoints
  // ========================================

  /**
   * Get current user's offer activity analytics
   */
  async getUserAnalytics(): Promise<{ success: boolean; data: UserOfferAnalytics }> {
    const response = await api.get('/offers-analytics/user/me');
    return response.data;
  }

  // ========================================
  // Export Endpoints (Admin)
  // ========================================

  /**
   * Export offers as CSV or JSON
   */
  async exportOffers(options: {
    format?: 'csv' | 'json';
    isActive?: boolean;
    type?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (options.format) params.append('format', options.format);
    if (options.isActive !== undefined) params.append('isActive', String(options.isActive));
    if (options.type) params.append('type', options.type);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = `/offers-analytics/export${queryString ? `?${queryString}` : ''}`;

    // Use fetch to download file
    const token = localStorage.getItem('accessToken');
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${apiUrl}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
      : `offers-export.${options.format || 'csv'}`;

    // Trigger download
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

// ============================================
// Export singleton instance
// ============================================

export const offerAnalyticsApi = new OfferAnalyticsApiService();
export default offerAnalyticsApi;
