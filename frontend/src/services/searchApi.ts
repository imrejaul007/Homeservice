import axios, { AxiosError } from 'axios';
import type {
  SearchFilters,
  Service,
  SearchResponse,
  SuggestionsResponse,
  ProviderSearchResponse,
  TrendingSearch,
} from '@/types/search';
import { api } from './api';

// Error class for search API errors
export class SearchApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SearchApiError';
  }
}

function toSearchError(error: unknown, fallback: string, code: string): SearchApiError {
  const err = error as AxiosError;
  if (axios.isCancel(err)) {
    throw err;
  }
  const message =
    (err.response?.data as { message?: string })?.message || err.message || fallback;
  console.error(`[searchApi] ${code}:`, message, err.response?.status);
  return new SearchApiError(message, err.response?.status, code);
}

/**
 * Transform frontend coordinates {lat, lng} to backend GeoJSON [lng, lat] format
 */
export function transformCoordinatesForBackend(coords?: { lat: number; lng: number }): [number, number] | undefined {
  if (!coords) return undefined;
  return [coords.lng, coords.lat];
}

/**
 * Transform backend GeoJSON [lng, lat] to frontend {lat, lng} format
 */
export function transformCoordinatesFromBackend(coords?: [number, number]): { lat: number; lng: number } | undefined {
  if (!coords || !Array.isArray(coords)) return undefined;
  return { lat: coords[1], lng: coords[0] };
}

// API Functions — use centralized api (withCredentials + interceptors)
export const searchApi = {
  searchServices: async (filters: SearchFilters, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      const response = await api.get('/search/services', { params: filters, signal });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Search failed', 'SEARCH_FAILED');
    }
  },

  searchProviders: async (
    filters: SearchFilters & {
      tier?: 'elite' | 'premium' | 'standard';
      verified?: boolean;
    },
    signal?: AbortSignal
  ): Promise<ProviderSearchResponse> => {
    try {
      const response = await api.get('/search/providers', { params: filters, signal });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Provider search failed', 'PROVIDER_SEARCH_FAILED');
    }
  },

  getSearchSuggestions: async (query: string, limit = 5, signal?: AbortSignal): Promise<SuggestionsResponse> => {
    try {
      const response = await api.get('/search/suggestions', {
        params: { q: query, limit },
        signal,
      });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to get suggestions', 'SUGGESTIONS_FAILED');
    }
  },

  getTrendingServices: async (timeframe = '7d', limit = 10, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      const response = await api.get('/search/trending', {
        params: { timeframe, limit },
        signal,
      });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to get trending services', 'TRENDING_FAILED');
    }
  },

  getSearchFilters: async (location?: { lat: number; lng: number; radius: number }, signal?: AbortSignal): Promise<any> => {
    try {
      const params = location
        ? { lat: location.lat, lng: location.lng, radius: location.radius }
        : undefined;
      const response = await api.get('/search/filters', { params, signal });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to get filters', 'FILTERS_FAILED');
    }
  },

  getPopularServices: async (category?: string, limit = 20, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      const response = await api.get('/search/popular', {
        params: { category, limit },
        signal,
      });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to get popular services', 'POPULAR_FAILED');
    }
  },

  getTrendingSearches: async (limit = 10, signal?: AbortSignal): Promise<TrendingSearch[]> => {
    try {
      const response = await api.get('/search/trending', {
        params: { limit },
        signal,
      });
      const trendingServices = response.data?.data?.services || response.data?.services || [];
      return trendingServices.map((service: Service) => ({
        term: service.name,
        category: service.category,
        searchCount: service.rating?.searchMetadata?.searchCount || service.reviewCount || 0,
      }));
    } catch (error) {
      throw toSearchError(error, 'Failed to get trending searches', 'TRENDING_FAILED');
    }
  },

  getServicesByCategory: async (
    category: string,
    filters: Omit<SearchFilters, 'category'>,
    signal?: AbortSignal
  ): Promise<SearchResponse> => {
    try {
      const response = await api.get(`/search/category/${encodeURIComponent(category)}`, {
        params: filters,
        signal,
      });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to get category services', 'CATEGORY_SERVICES_FAILED');
    }
  },

  getServiceById: async (
    serviceId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; data: { service: Service } }> => {
    try {
      const response = await api.get(`/search/service/${serviceId}`, { signal });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to get service details', 'SERVICE_DETAILS_FAILED');
    }
  },

  trackServiceClick: async (
    serviceId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post(`/search/service/${serviceId}/click`, {}, { signal });
      return response.data;
    } catch (error) {
      throw toSearchError(error, 'Failed to track click', 'TRACK_CLICK_FAILED');
    }
  },
};

export const buildSearchQuery = (filters: SearchFilters): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });
  return params.toString();
};

export const parseLocation = (service: Service): string => {
  const { address } = service.location;
  return `${address.city}, ${address.state} ${address.zipCode}`;
};

export const formatPrice = (price: Service['price']): string => {
  const symbol = price.currency === 'USD' ? '$' : price.currency;
  const formatted = `${symbol}${price.amount.toFixed(2)}`;

  switch (price.type) {
    case 'hourly':
      return `${formatted}/hr`;
    case 'custom':
      return `${formatted} (custom)`;
    default:
      return formatted;
  }
};

export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default searchApi;
