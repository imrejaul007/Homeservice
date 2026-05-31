import { api } from './api';

// ============================================
// Trending Types
// ============================================

export interface TrendingService {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  basePrice: number;
  priceUnit: string;
  images: string[];
  thumbnail?: string;
  categoryId: string;
  categoryName: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  bookingsThisMonth: number;
  growthPercent: number;
  trendingScore: number;
  isAvailable: boolean;
  tags: string[];
}

export interface TrendingCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image?: string;
  serviceCount: number;
  totalBookings: number;
  bookingsThisMonth: number;
  growthPercent: number;
  trendingScore: number;
  topServices: Array<{
    id: string;
    name: string;
    thumbnail?: string;
    bookings: number;
  }>;
}

export interface TrendingProvider {
  id: string;
  name: string;
  avatar?: string;
  coverImage?: string;
  bio?: string;
  services: string[];
  categories: string[];
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  bookingsThisMonth: number;
  growthPercent: number;
  trendingScore: number;
  isVerified: boolean;
  isTopRated: boolean;
  joinedAt: string;
}

export interface TrendingLocation {
  id: string;
  name: string;
  type: 'city' | 'region' | 'area';
  serviceCount: number;
  providerCount: number;
  totalBookings: number;
  bookingsThisMonth: number;
  growthPercent: number;
  trendingScore: number;
  topCategories: string[];
}

export interface GetTrendingServicesOptions {
  page?: number;
  limit?: number;
  categoryId?: string;
  minRating?: number;
  sortBy?: 'popularity' | 'growth' | 'rating' | 'recent';
  timeRange?: '7d' | '30d' | '90d';
}

export interface TrendingOverview {
  totalTrendingServices: number;
  totalTrendingCategories: number;
  totalTrendingProviders: number;
  topGainingService: {
    id: string;
    name: string;
    growthPercent: number;
  };
  topGainingCategory: {
    id: string;
    name: string;
    growthPercent: number;
  };
  topGainingProvider: {
    id: string;
    name: string;
    growthPercent: number;
  };
  lastUpdated: string;
}

// ============================================
// Trending API Service
// ============================================

export interface TrendingApi {
  /**
   * Get trending services
   */
  getTrendingServices: (options?: GetTrendingServicesOptions) => Promise<{
    services: TrendingService[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single trending service by ID
   */
  getTrendingService: (id: string) => Promise<TrendingService>;

  /**
   * Get trending categories
   */
  getTrendingCategories: (options?: {
    limit?: number;
    minServices?: number;
  }) => Promise<{
    categories: TrendingCategory[];
    total: number;
  }>;

  /**
   * Get a single trending category by ID
   */
  getTrendingCategory: (id: string) => Promise<TrendingCategory>;

  /**
   * Get trending providers
   */
  getTrendingProviders: (options?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    minRating?: number;
    sortBy?: 'popularity' | 'growth' | 'rating' | 'recent';
  }) => Promise<{
    providers: TrendingProvider[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get trending locations
   */
  getTrendingLocations: (options?: {
    limit?: number;
    type?: 'city' | 'region' | 'area';
  }) => Promise<{
    locations: TrendingLocation[];
    total: number;
  }>;

  /**
   * Get trending overview/dashboard
   */
  getTrendingOverview: () => Promise<TrendingOverview>;

  /**
   * Get what's trending right now (real-time)
   */
  getNowTrending: (options?: {
    limit?: number;
  }) => Promise<{
    services: TrendingService[];
    categories: TrendingCategory[];
    providers: TrendingProvider[];
  }>;

  /**
   * Search within trending items
   */
  searchTrending: (
    query: string,
    type?: 'services' | 'categories' | 'providers' | 'all'
  ) => Promise<{
    services: TrendingService[];
    categories: TrendingCategory[];
    providers: TrendingProvider[];
  }>;

  /**
   * Get trending insights
   */
  getTrendingInsights: (options?: {
    period?: '7d' | '30d' | '90d';
  }) => Promise<{
    trends: Array<{
      type: 'service' | 'category' | 'provider';
      id: string;
      name: string;
      direction: 'up' | 'down' | 'stable';
      changePercent: number;
      reason: string;
    }>;
    predictions: Array<{
      type: 'service' | 'category' | 'provider';
      id: string;
      name: string;
      predictedGrowth: number;
      confidence: number;
    }>;
  }>;
}

export const trendingApi: TrendingApi = {
  /**
   * Get trending services with filtering and pagination
   * @param options - Query options including filters and sorting
   */
  getTrendingServices: async (options = {}) => {
    const response = await api.get('/trending/services', { params: options });
    return response.data.data;
  },

  /**
   * Get a single trending service by ID
   * @param id - The service ID
   */
  getTrendingService: async (id: string) => {
    const response = await api.get(`/trending/services/${id}`);
    return response.data.data;
  },

  /**
   * Get trending categories
   * @param options - Filter options including limit and minimum services
   */
  getTrendingCategories: async (options = {}) => {
    const response = await api.get('/trending/categories', { params: options });
    return response.data.data;
  },

  /**
   * Get a single trending category by ID
   * @param id - The category ID
   */
  getTrendingCategory: async (id: string) => {
    const response = await api.get(`/trending/categories/${id}`);
    return response.data.data;
  },

  /**
   * Get trending providers with filtering and pagination
   * @param options - Query options including filters and sorting
   */
  getTrendingProviders: async (options = {}) => {
    const response = await api.get('/trending/providers', { params: options });
    return response.data.data;
  },

  /**
   * Get trending locations
   * @param options - Filter options including limit and type
   */
  getTrendingLocations: async (options = {}) => {
    const response = await api.get('/trending/locations', { params: options });
    return response.data.data;
  },

  /**
   * Get trending overview for dashboard
   */
  getTrendingOverview: async () => {
    const response = await api.get('/trending/overview');
    return response.data.data;
  },

  /**
   * Get what's trending right now (real-time data)
   * @param options - Limit options
   */
  getNowTrending: async (options = {}) => {
    const response = await api.get('/trending/now', { params: options });
    return response.data.data;
  },

  /**
   * Search within trending items
   * @param query - Search query string
   * @param type - Filter by type (default: all)
   */
  searchTrending: async (query: string, type = 'all') => {
    const response = await api.get('/trending/search', {
      params: { query, type },
    });
    return response.data.data;
  },

  /**
   * Get trending insights and predictions
   * @param options - Period options
   */
  getTrendingInsights: async (options = {}) => {
    const response = await api.get('/trending/insights', { params: options });
    return response.data.data;
  },
};

export default trendingApi;
