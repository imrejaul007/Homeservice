import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/api';
import { secureStorage } from '@/lib/security';
import type {
  ProviderResponse,
  ProvidersByCategoryResponse,
  ProvidersBySubcategoryResponse,
  FeaturedProvidersResponse,
} from '@/types/provider';

export class ProviderApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ProviderApiError';
  }
}

function toProviderError(error: unknown, fallback: string, code: string): ProviderApiError {
  const err = error as AxiosError;
  const message =
    (err.response?.data as { message?: string })?.message || err.message || fallback;
  console.error(`[providerApi] ${code}:`, message, err.response?.status);
  return new ProviderApiError(message, err.response?.status, code);
}

const api = axios.create({
  baseURL: `${API_BASE_URL}/providers`,
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    config.headers['X-Correlation-ID'] = generateCorrelationId();
    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Analytics API base - uses a different endpoint structure
const analyticsApi = axios.create({
  baseURL: `${API_BASE_URL}/provider`,
  timeout: 10000,
  withCredentials: true,
});

// Request deduplication map (MAJOR PERFORMANCE FIX)
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Get deduplicated request - returns existing promise if request is in progress
 */
function getDeduplicatedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  }) as Promise<T>;

  pendingRequests.set(key, promise);
  return promise;
}

// Generate correlation ID for request tracing
const generateCorrelationId = () => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Match main api.ts — tokens live in secureStorage, not raw sessionStorage
const getAuthTokens = () => {
  try {
    const stored = secureStorage.getItem('auth-storage');
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
  rejected?: number;
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

export interface RevenueStats {
  monthlyRevenue?: number;
  monthlyGrossEarnings?: number;
  monthlyNetEarnings?: number;
  avgBookingValue?: number;
}

export interface CustomerMetrics {
  repeatCustomers: number;
  totalCustomers: number;
}

export interface TopService {
  id: string;
  name: string;
  category: string;
  views: number;
  clicks: number;
  bookings: number;
  revenue?: number;
  rating: number;
  popularityScore: number;
}

export interface StatusCounts {
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

export interface CategoryStats {
  name: string;
  bookingCount: number;
}

export interface ProviderAnalytics {
  serviceStats: ServiceStats;
  performanceStats: PerformanceStats;
  ratingStats: RatingStats;
  bookingStats: BookingStats;
  revenueStats?: RevenueStats;
  customerMetrics?: CustomerMetrics;
  categories: string[];
  topServices: TopService[];
  /** Service listing status counts (active, draft, etc.) — not booking funnel */
  statusCounts?: StatusCounts & Record<string, number>;
  /** Booking status funnel counts */
  statusBreakdown?: StatusCounts;
  categoryStats?: CategoryStats[];
  trendStats?: {
    earningsChangePercent: number | null;
    bookingsChangePercent: number | null;
  };
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
   * Uses request deduplication to prevent multiple simultaneous requests
   */
  getProviderById: async (id: string): Promise<ProviderResponse> => {
    const requestKey = `provider:${id}`;
    return getDeduplicatedRequest(requestKey, async () => {
      try {
        const response = await api.get(`/${id}`);
        return response.data as ProviderResponse;
      } catch (error) {
        throw toProviderError(error, 'Failed to fetch provider', 'GET_PROVIDER_FAILED');
      }
    });
  },

  /**
   * Get providers by category slug
   * GET /api/providers/category/:slug
   * Uses request deduplication to prevent multiple simultaneous requests
   */
  getProvidersByCategory: async (
    categorySlug: string,
    options?: GetProvidersOptions
  ): Promise<ProvidersByCategoryResponse> => {
    const requestKey = `providers:category:${categorySlug}:${JSON.stringify(options || {})}`;
    return getDeduplicatedRequest(requestKey, async () => {
      try {
        const response = await api.get(`/category/${categorySlug}`, { params: options });
        return response.data as ProvidersByCategoryResponse;
      } catch (error) {
        throw toProviderError(error, 'Failed to fetch providers by category', 'GET_PROVIDERS_BY_CATEGORY_FAILED');
      }
    });
  },

  /**
   * Get providers by subcategory
   * GET /api/providers/subcategory/:categorySlug/:subcategorySlug
   * Uses request deduplication to prevent multiple simultaneous requests
   */
  getProvidersBySubcategory: async (
    categorySlug: string,
    subcategorySlug: string,
    options?: GetProvidersOptions
  ): Promise<ProvidersBySubcategoryResponse> => {
    const requestKey = `providers:subcategory:${categorySlug}:${subcategorySlug}:${JSON.stringify(options || {})}`;
    return getDeduplicatedRequest(requestKey, async () => {
      try {
        const response = await api.get(`/subcategory/${categorySlug}/${subcategorySlug}`, {
          params: options,
        });
        return response.data as ProvidersBySubcategoryResponse;
      } catch (error) {
        throw toProviderError(error, 'Failed to fetch providers by subcategory', 'GET_PROVIDERS_BY_SUBCATEGORY_FAILED');
      }
    });
  },

  /**
   * Get featured providers
   * GET /api/providers/featured
   * Uses request deduplication to prevent multiple simultaneous requests
   */
  getFeaturedProviders: async (limit?: number): Promise<FeaturedProvidersResponse> => {
    const requestKey = `providers:featured:${limit || 'all'}`;
    return getDeduplicatedRequest(requestKey, async () => {
      try {
        const response = await api.get('/featured', { params: { limit } });
        return response.data as FeaturedProvidersResponse;
      } catch (error) {
        throw toProviderError(error, 'Failed to fetch featured providers', 'GET_FEATURED_PROVIDERS_FAILED');
      }
    });
  },
};

export type TrendResult = {
  value: number | null;
  label: 'percent' | 'new' | 'none';
};

/**
 * Provider analytics API - uses auth-protected /provider endpoints
 */
export interface ProviderInsightsAnalytics {
  overview: {
    totalViews: number;
    totalViewsAllTime?: number;
    viewsTrend: TrendResult;
    profileViews: number;
    profileViewsTrend: TrendResult;
    bookingRequests: number;
    bookingRequestsTrend: TrendResult;
    conversionRate: number;
    conversionRateTrend: TrendResult;
    confirmedBookingRate?: number;
    confirmedBookingRateTrend?: TrendResult;
    conversionRateConfirmed?: number;
    conversionRateConfirmedTrend?: TrendResult;
    dataQuality?: {
      trackingSince: string | null;
      level: 'full' | 'bookings_only';
    };
  };
  earnings: {
    thisMonth: number;
    lastMonth: number;
    trend: TrendResult;
    grossEarnings?: { thisMonth: number; lastMonth: number };
    platformFees?: { thisMonth: number; lastMonth: number };
    revenueMode?: 'net' | 'gross';
  };
  bookings: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    no_show?: number;
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
  timeSeries: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  timeSeriesPrevious?: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  metadata?: {
    dateFields?: Record<string, string>;
  };
  ratings: {
    average: number;
    total: number;
    breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  };
  experiments?: Array<{
    experimentId: string;
    variant: string;
    exposures: number;
    bookings: number;
    revenue: number;
    conversionRate: number;
  }>;
}

export const providerAnalyticsApi = {
  /**
   * Get provider overview analytics (service management dashboard)
   * GET /api/provider/analytics
   */
  getProviderAnalytics: async (city?: string): Promise<ProviderAnalyticsResponse> => {
    const response = await analyticsApi.get('/analytics', {
      params: city ? { city } : undefined,
    });
    return response.data;
  },

  /**
   * Get provider insights analytics page data
   * GET /api/provider/analytics/insights?period=7d|30d|90d
   */
  getProviderInsights: async (
    period: '7d' | '30d' | '90d' = '30d',
    options: { revenue?: 'net' | 'gross'; city?: string } = {},
  ): Promise<{ success: boolean; data: ProviderInsightsAnalytics }> => {
    const response = await analyticsApi.get('/analytics/insights', {
      params: {
        period,
        revenue: options.revenue ?? 'net',
        ...(options.city ? { city: options.city } : {}),
      },
      timeout: 45000,
    });
    return response.data;
  },
};

export default providerApi;
