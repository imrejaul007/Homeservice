import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/api';
import type {
  ProviderResponse,
  ProvidersByCategoryResponse,
  ProvidersBySubcategoryResponse,
  FeaturedProvidersResponse,
} from '@/types/provider';

const api = axios.create({
  baseURL: `${API_BASE_URL}/providers`,
  timeout: 10000,
});

// Analytics API base - uses a different endpoint structure
const analyticsApi = axios.create({
  baseURL: `${API_BASE_URL}/provider`,
  timeout: 10000,
  withCredentials: true,
});

// Generate correlation ID for request tracing
const generateCorrelationId = () => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Get auth tokens from sessionStorage
const getAuthTokens = () => {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const tokens = parsed?.state?.tokens;
    if (tokens?.accessToken && tokens?.refreshToken) {
      return tokens;
    }
    return null;
  } catch {
    return null;
  }
};

// Add auth interceptor to analyticsApi
analyticsApi.interceptors.request.use(
  (config) => {
    // Add correlation ID for request tracing
    config.headers['X-Correlation-ID'] = generateCorrelationId();

    // Add auth token if available
    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('Analytics API request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Types for analytics responses
export interface ServiceStats {
  total: number;
  active: number;
  draft: number;
  inactive: number;
  pending_review: number;
}

export interface PerformanceStats {
  totalViews: number;
  totalClicks: number;
  totalBookings: number;
  conversionRate: number;
  bookingRate: number;
}

export interface RatingStats {
  averageRating: number;
  totalReviews: number;
}

export interface BookingStats {
  newBookings: number;
  pendingRequests: number;
  todaySchedule: number;
  completedThisMonth: number;
}

export interface TopService {
  id: string;
  name: string;
  category: string;
  views: number;
  clicks: number;
  bookings: number;
  rating: number;
  popularityScore: number;
}

export interface ProviderAnalytics {
  serviceStats: ServiceStats;
  performanceStats: PerformanceStats;
  ratingStats: RatingStats;
  bookingStats: BookingStats;
  categories: string[];
  topServices: TopService[];
}

export interface ProviderAnalyticsResponse {
  success: boolean;
  data: {
    overview: ProviderAnalytics;
  };
}

export interface GetProvidersOptions {
  page?: number;
  limit?: number;
  sortBy?: 'rating' | 'price' | 'price_desc' | 'newest' | 'popularity';
  minRating?: number;
}

export const providerApi = {
  /**
   * Get full provider profile by ID
   * GET /api/providers/:id
   */
  getProviderById: async (id: string): Promise<ProviderResponse> => {
    const response = await api.get(`/${id}`);
    return response.data;
  },

  /**
   * Get providers by category slug
   * GET /api/providers/category/:slug
   */
  getProvidersByCategory: async (
    categorySlug: string,
    options?: GetProvidersOptions
  ): Promise<ProvidersByCategoryResponse> => {
    const response = await api.get(`/category/${categorySlug}`, { params: options });
    return response.data;
  },

  /**
   * Get providers by subcategory
   * GET /api/providers/subcategory/:categorySlug/:subcategorySlug
   */
  getProvidersBySubcategory: async (
    categorySlug: string,
    subcategorySlug: string,
    options?: GetProvidersOptions
  ): Promise<ProvidersBySubcategoryResponse> => {
    const response = await api.get(`/subcategory/${categorySlug}/${subcategorySlug}`, {
      params: options,
    });
    return response.data;
  },

  /**
   * Get featured providers
   * GET /api/providers/featured
   */
  getFeaturedProviders: async (limit?: number): Promise<FeaturedProvidersResponse> => {
    const response = await api.get('/featured', { params: { limit } });
    return response.data;
  },
};

/**
 * Provider analytics API - uses auth-protected /provider endpoints
 */
export interface ProviderInsightsAnalytics {
  overview: {
    totalViews: number;
    viewsTrend: number;
    profileViews: number;
    profileViewsTrend: number;
    bookingRequests: number;
    bookingRequestsTrend: number;
    conversionRate: number;
    conversionRateTrend: number;
  };
  earnings: {
    thisMonth: number;
    lastMonth: number;
    trend: number;
  };
  bookings: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
  topServices: Array<{
    name: string;
    bookings: number;
    revenue: number;
  }>;
  weeklyData: Array<{
    day: string;
    bookings: number;
    revenue: number;
  }>;
  ratings: {
    average: number;
    total: number;
    breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  };
}

export const providerAnalyticsApi = {
  /**
   * Get provider overview analytics (service management dashboard)
   * GET /api/provider/analytics
   */
  getProviderAnalytics: async (): Promise<ProviderAnalyticsResponse> => {
    const response = await analyticsApi.get('/analytics');
    return response.data;
  },

  /**
   * Get provider insights analytics page data
   * GET /api/provider/analytics/insights?period=7d|30d|90d
   */
  getProviderInsights: async (
    period: '7d' | '30d' | '90d' = '30d',
  ): Promise<{ success: boolean; data: ProviderInsightsAnalytics }> => {
    const response = await analyticsApi.get('/analytics/insights', {
      params: { period },
    });
    return response.data;
  },
};

export default providerApi;
