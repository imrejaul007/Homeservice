/**
 * Package Comparison API Service
 *
 * Provides functionality to compare multiple packages side-by-side
 * and get recommendations for comparison.
 */
import { api } from './api';
import type { ServicePackage } from '../types/subscription.types';
import { normalizeFeatures } from '../types/subscription.types';

// Re-export normalizeFeatures for use in components
export { normalizeFeatures } from '../types/subscription.types';

// =============================================================================
// Types
// =============================================================================

export interface ComparisonPackage {
  _id: string;
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
    hasDiscount: boolean;
    discountPercentage: number;
    savings: number;
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  durationOptions?: Array<{
    duration: number;
    price: number;
    label: string;
  }>;
  includedItems: Array<string | { name: string; included?: boolean }>;
  requirements?: string[];
  addOns?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  tags?: string[];
  provider: {
    _id: string;
    name: string;
    avatar?: string;
    isVerified: boolean;
    tier: string;
  };
  stats: {
    rating: number;
    reviewCount: number;
    bookingCount: number;
    popularityScore: number;
  };
  isFeatured: boolean;
  isPopular: boolean;
  location: {
    city: string;
    state: string;
    serviceArea: any;
  };
  availability: {
    instantBooking: boolean;
    advanceBookingDays: number;
  };
  images: string[];
  createdAt: string;
}

export interface ComparisonMetrics {
  priceRange: {
    min: number;
    max: number;
  };
  ratingRange: {
    max: number;
    hasRated: boolean;
  };
  durationRange: {
    min: number;
    max: number;
  };
  inclusionsRange: {
    max: number;
  };
  bestValue: ComparisonPackage;
  highestRated: ComparisonPackage;
  shortestDuration: ComparisonPackage;
  mostPopular: ComparisonPackage;
}

export interface CompareResponse {
  packages: ComparisonPackage[];
  comparisonMetrics: ComparisonMetrics;
  meta: {
    count: number;
    requestedCount: number;
    comparedAt: string;
  };
}

export interface RecommendedPackage {
  _id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  rating: number;
  includedItemsCount: number;
  isFeatured: boolean;
  isPopular: boolean;
  providerId: string;
  providerName: string;
}

export interface RecommendedResponse {
  packages: RecommendedPackage[];
  count: number;
}

// =============================================================================
// API Client
// =============================================================================

export const packageComparisonApi = {
  /**
   * Compare multiple packages side-by-side
   * @param packageIds Array of package IDs to compare (2-5 packages)
   */
  compare: async (packageIds: string[]): Promise<CompareResponse> => {
    if (packageIds.length < 2) {
      throw new Error('At least 2 packages are required for comparison');
    }
    if (packageIds.length > 5) {
      throw new Error('Maximum 5 packages can be compared at once');
    }

    try {
      const idsParam = packageIds.join(',');
      const response = await api.get(`/packages/compare?packageIds=${encodeURIComponent(idsParam)}`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to compare packages';
      console.error('[packageComparisonApi] compare error:', message);
      throw new Error(message);
    }
  },

  /**
   * Get recommended packages for comparison
   * @param options Filter options
   */
  getRecommended: async (options?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    excludeIds?: string[];
  }): Promise<RecommendedResponse> => {
    try {
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.minPrice !== undefined) params.append('minPrice', String(options.minPrice));
      if (options?.maxPrice !== undefined) params.append('maxPrice', String(options.maxPrice));
      if (options?.excludeIds?.length) {
        params.append('excludeIds', options.excludeIds.join(','));
      }

      const queryString = params.toString();
      const url = `/packages/compare/recommended${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch recommendations';
      console.error('[packageComparisonApi] getRecommended error:', message);
      throw new Error(message);
    }
  },
};

export default packageComparisonApi;
