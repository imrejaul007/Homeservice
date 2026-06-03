/**
 * Package API Service
 * Calls backend package/endpoints for service packages
 */
import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export interface ServicePackage {
  _id: string;
  id?: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
    discounts?: Array<{
      code: string;
      amount: number;
      type: 'fixed' | 'percentage';
    }>;
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  /** Backend returns includedItems; frontend maps to features for consistency */
  features?: Array<{
    name: string;
    included: boolean;
  }>;
  /** Raw backend field - may be present instead of features */
  includedItems?: Array<{
    name: string;
    included: boolean;
  }>;
  services: Array<{
    _id: string;
    name: string;
    duration: number;
    price: number;
  }>;
  images?: string[];
  isActive: boolean;
  isFeatured: boolean;
  validity: {
    days: number;
    startDate?: string;
    endDate?: string;
  };
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    avatar?: string;
    rating?: number;
    isVerified?: boolean;
  };
  stats?: {
    totalPurchases: number;
    rating: number;
    reviewCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PackageFilters {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  minDuration?: number;
  maxDuration?: number;
  featured?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'duration' | 'popularity' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface PackageResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore?: boolean;
  };
}

export interface PackageStats {
  totalPackages: number;
  totalSavings: number;
  averageRating: number;
  popularCategories: Array<{ category: string; count: number }>;
}

// =============================================================================
// API Client
// =============================================================================

export const packageApi = {
  /**
   * Get all packages with optional filtering
   */
  getPackages: async (filters?: PackageFilters): Promise<{
    packages: ServicePackage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    try {
      const response = await api.get('/packages', { params: filters });
      const result = response.data.data;
      return {
        packages: result.packages || [],
        total: result.pagination?.total || 0,
        page: result.pagination?.page || 1,
        limit: result.pagination?.limit || 10,
        totalPages: result.pagination?.pages || 1,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch packages';
      console.error('[packageApi] getPackages error:', message);
      throw new Error(message);
    }
  },

  /**
   * Get a single package by ID
   */
  getPackage: async (packageId: string): Promise<{ package: ServicePackage }> => {
    try {
      const response = await api.get(`/packages/${packageId}`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch package';
      console.error('[packageApi] getPackage error:', message);
      throw new Error(message);
    }
  },

  /**
   * Get featured packages
   */
  getFeaturedPackages: async (limit: number = 6): Promise<ServicePackage[]> => {
    try {
      const response = await api.get('/packages/featured', { params: { limit } });
      return response.data.data.packages || [];
    } catch (error: unknown) {
      console.error('[packageApi] getFeaturedPackages error:', error);
      throw new Error('Failed to fetch featured packages');
    }
  },

  /**
   * Get package stats
   */
  getPackageStats: async (): Promise<PackageStats> => {
    try {
      const response = await api.get('/packages/stats');
      return response.data.data;
    } catch (error: unknown) {
      console.error('[packageApi] getPackageStats error:', error);
      throw new Error('Failed to fetch package stats');
    }
  },

  /**
   * Get packages by category
   */
  getPackagesByCategory: async (category: string, limit?: number): Promise<ServicePackage[]> => {
    try {
      const response = await api.get(`/packages/category/${category}`, { params: { limit } });
      return response.data.data.packages || [];
    } catch (error: unknown) {
      console.error('[packageApi] getPackagesByCategory error:', error);
      throw new Error(`Failed to fetch packages for category: ${category}`);
    }
  },

  /**
   * Search packages
   */
  searchPackages: async (query: string, filters?: PackageFilters): Promise<ServicePackage[]> => {
    try {
      const response = await api.get('/packages/search', {
        params: { q: query, ...filters },
      });
      return response.data.data.packages || [];
    } catch (error: unknown) {
      console.error('[packageApi] searchPackages error:', error);
      throw new Error(`Failed to search packages for query: ${query}`);
    }
  },
};

export default packageApi;
