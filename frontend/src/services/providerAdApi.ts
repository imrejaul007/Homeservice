import { api } from './api';

// ============================================
// Provider Ad Types
// ============================================

export interface AdBudget {
  daily?: number;
  monthly?: number;
  total: number;
  spent: number;
  remaining: number;
}

export interface AdTargeting {
  categories?: Array<{
    _id: string;
    name: string;
    slug: string;
  }>;
  locations?: Array<{
    type: 'city' | 'region' | 'radius';
    value: string;
    coordinates?: { lat: number; lng: number };
    radiusKm?: number;
  }>;
  timeSchedule?: {
    daysOfWeek: number[];
    hoursStart: number;
    hoursEnd: number;
  };
  demographics?: {
    ageMin?: number;
    ageMax?: number;
  };
}

export interface AdContent {
  title: string;
  description: string;
  imageUrl?: string;
  ctaText?: string;
  landingUrl?: string;
}

export interface AdStatistics {
  views: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
  totalSpent: number;
  costPerClick: number;
  costPerConversion: number;
  dailyStats: Array<{
    date: string;
    views: number;
    clicks: number;
    conversions: number;
    spent: number;
  }>;
}

export interface ProviderAd {
  _id: string;
  name: string;
  description?: string;
  providerId: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  isActive: boolean;
  budget: AdBudget;
  bidAmount?: number;
  bidType: 'cpc' | 'cpm' | 'fixed';
  targeting: AdTargeting;
  startDate: string;
  endDate?: string;
  content: AdContent;
  statistics: AdStatistics;
  approvalStatus: 'pending' | 'pending_review' | 'approved' | 'rejected';
  scheduling: {
    runContinuously: boolean;
    scheduleType: 'immediate' | 'scheduled' | 'recurring';
  };
  priority: number;
  limits?: {
    maxViewsPerDay?: number;
    maxClicksPerDay?: number;
    maxBudgetPerDay?: number;
  };
  relatedServiceIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdStats {
  totalAds: number;
  activeAds: number;
  pausedAds: number;
  draftAds: number;
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  totalSpent: number;
  averageCtr: number;
  averageConversionRate: number;
  total?: number; // Backend may include total count
  topPerformingAds?: Array<{
    _id: string;
    name: string;
    status: string;
    statistics: AdStatistics;
  }>;
  last30Days?: Array<{
    date: string;
    views: number;
    clicks: number;
    conversions: number;
    spent: number;
  }>;
}

export interface AdAnalytics {
  adId: string;
  name: string;
  status: string;
  budget: AdBudget;
  statistics: AdStatistics;
  performance: {
    roas?: number;
    impressionShare?: number;
    avgPosition?: number;
    calculatedRoas?: number;
    effectiveCpm?: number;
    effectiveCpc?: number;
  };
  dailyStats: Array<{
    date: string;
    views: number;
    clicks: number;
    conversions: number;
    spent: number;
  }>;
  targeting: AdTargeting;
  content: AdContent;
  createdAt: string;
  startDate: string;
  endDate?: string;
}

export interface CategoryOption {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  subcategories?: Array<{
    _id: string;
    name: string;
    slug: string;
  }>;
}

export interface CreateAdInput {
  name: string;
  description?: string;
  budget: {
    daily?: number;
    monthly?: number;
    total: number;
  };
  bidAmount?: number;
  bidType?: 'cpc' | 'cpm' | 'fixed';
  targeting?: {
    categories?: string[];
    locations?: Array<{
      type: 'city' | 'region' | 'radius';
      value: string;
      coordinates?: { lat: number; lng: number };
      radiusKm?: number;
    }>;
    timeSchedule?: {
      daysOfWeek: number[];
      hoursStart: number;
      hoursEnd: number;
    };
    demographics?: {
      ageMin?: number;
      ageMax?: number;
    };
  };
  startDate?: string;
  endDate?: string;
  content: {
    title: string;
    description: string;
    imageUrl?: string;
    ctaText?: string;
    landingUrl?: string;
  };
  relatedServiceIds?: string[];
  limits?: {
    maxViewsPerDay?: number;
    maxClicksPerDay?: number;
    maxBudgetPerDay?: number;
  };
  scheduling?: {
    runContinuously?: boolean;
    scheduleType?: 'immediate' | 'scheduled' | 'recurring';
  };
  priority?: number;
}

export interface UpdateAdInput extends Partial<CreateAdInput> {}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================
// Provider Ad API Service
// ============================================

export const providerAdApi = {
  /**
   * Get all ads for the current provider
   */
  getMyAds: async (options?: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ ads: ProviderAd[]; pagination: PaginationInfo }> => {
    const response = await api.get('/provider/ads', { params: options });
    return response.data.data;
  },

  /**
   * Get a specific ad by ID
   */
  getAdById: async (adId: string): Promise<ProviderAd> => {
    const response = await api.get(`/provider/ads/${adId}`);
    return response.data.data.ad;
  },

  /**
   * Create a new ad campaign
   */
  createAd: async (adData: CreateAdInput): Promise<ProviderAd> => {
    const response = await api.post('/provider/ads', adData);
    return response.data.data.ad;
  },

  /**
   * Update an existing ad
   */
  updateAd: async (adId: string, adData: UpdateAdInput): Promise<ProviderAd> => {
    const response = await api.put(`/provider/ads/${adId}`, adData);
    return response.data.data.ad;
  },

  /**
   * Delete an ad
   */
  deleteAd: async (adId: string): Promise<void> => {
    await api.delete(`/provider/ads/${adId}`);
  },

  /**
   * Pause an active ad
   */
  pauseAd: async (adId: string): Promise<ProviderAd> => {
    const response = await api.post(`/provider/ads/${adId}/pause`);
    return response.data.data.ad;
  },

  /**
   * Resume a paused ad
   */
  resumeAd: async (adId: string): Promise<ProviderAd> => {
    const response = await api.post(`/provider/ads/${adId}/resume`);
    return response.data.data.ad;
  },

  /**
   * Launch a draft ad
   */
  launchAd: async (adId: string): Promise<ProviderAd> => {
    const response = await api.post(`/provider/ads/${adId}/launch`);
    return response.data.data.ad;
  },

  /**
   * Get provider's overall ad statistics
   */
  getAdStats: async (): Promise<AdStats> => {
    const response = await api.get('/provider/ads/stats');
    return response.data.data.stats;
  },

  /**
   * Get detailed analytics for a specific ad
   */
  getAdAnalytics: async (adId: string): Promise<AdAnalytics> => {
    const response = await api.get(`/provider/ads/${adId}/analytics`);
    return response.data.data.analytics;
  },

  /**
   * Get available categories for targeting (public endpoint)
   */
  getTargetingCategories: async (): Promise<CategoryOption[]> => {
    const response = await api.get('/ads/public/categories');
    // Backend returns { success, data: { categories: [...] } }
    const categories = response.data?.data?.categories;
    // Return array directly - backend may return nested or flat depending on version
    return Array.isArray(categories) ? categories : (response.data?.data || []);
  },

  /**
   * Bulk pause ads
   */
  bulkPauseAds: async (adIds: string[]): Promise<{ succeeded: number; failed: number }> => {
    const response = await api.post('/provider/ads/bulk/pause', { adIds });
    return response.data.data;
  },

  /**
   * Bulk resume ads
   */
  bulkResumeAds: async (adIds: string[]): Promise<{ succeeded: number; failed: number }> => {
    const response = await api.post('/provider/ads/bulk/resume', { adIds });
    return response.data.data;
  },

  /**
   * Bulk delete ads
   */
  bulkDeleteAds: async (adIds: string[]): Promise<{ succeeded: number; failed: number }> => {
    const response = await api.post('/provider/ads/bulk/delete', { adIds });
    return response.data.data;
  },
};

export default providerAdApi;
