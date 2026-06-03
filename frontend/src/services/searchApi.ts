import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '@/config/api';
import type { SearchFilters, Service, SearchResponse, Suggestion, SuggestionsResponse } from '@/types/search';

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

const api = axios.create({
  baseURL: `${API_BASE_URL}/search`,
  timeout: 10000,
});

/**
 * Transform frontend coordinates {lat, lng} to backend GeoJSON [lng, lat] format
 */
export function transformCoordinatesForBackend(coords?: { lat: number; lng: number }): [number, number] | undefined {
  if (!coords) return undefined;
  // Backend expects GeoJSON format: [longitude, latitude]
  return [coords.lng, coords.lat];
}

/**
 * Transform backend GeoJSON [lng, lat] to frontend {lat, lng} format
 */
export function transformCoordinatesFromBackend(coords?: [number, number]): { lat: number; lng: number } | undefined {
  if (!coords || !Array.isArray(coords)) return undefined;
  // GeoJSON format: [longitude, latitude] -> {lat, lng}
  return { lat: coords[1], lng: coords[0] };
}

// API Functions
export const searchApi = {
  // Main search function with AbortController support
  searchServices: async (filters: SearchFilters, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      // Transform coordinates if present (frontend {lat, lng} -> backend GeoJSON [lng, lat])
      const transformedFilters: Record<string, unknown> = { ...filters };
      if (filters.lat !== undefined && filters.lng !== undefined) {
        // Backend expects coordinates in GeoJSON format [lng, lat]
        transformedFilters.coordinates = [filters.lng, filters.lat];
        delete transformedFilters.lat;
        delete transformedFilters.lng;
      }
      const response = await api.get('/services', { params: transformedFilters, signal });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      if (axios.isCancel(err)) {
        throw err;
      }
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Search failed';
      console.error('[searchApi] searchServices error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'SEARCH_FAILED');
    }
  },

  // Get search suggestions/autocomplete
  getSearchSuggestions: async (query: string, limit = 5, signal?: AbortSignal): Promise<SuggestionsResponse> => {
    try {
      const response = await api.get('/suggestions', {
        params: { q: query, limit },
        signal
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get suggestions';
      console.error('[searchApi] getSearchSuggestions error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'SUGGESTIONS_FAILED');
    }
  },

  // Get trending services
  getTrendingServices: async (timeframe = '7d', limit = 10, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      const response = await api.get('/trending', {
        params: { timeframe, limit },
        signal
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get trending services';
      console.error('[searchApi] getTrendingServices error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'TRENDING_FAILED');
    }
  },

  // Get search filters metadata
  getSearchFilters: async (location?: { lat: number; lng: number; radius: number }, signal?: AbortSignal): Promise<any> => {
    try {
      const params = location ? transformCoordinatesForBackend({ lat: location.lat, lng: location.lng }) : undefined;
      const response = await api.get('/filters', { params: params, signal });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get filters';
      console.error('[searchApi] getSearchFilters error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'FILTERS_FAILED');
    }
  },

  // Get popular services
  getPopularServices: async (category?: string, limit = 20, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      const response = await api.get('/popular', {
        params: { category, limit },
        signal
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get popular services';
      console.error('[searchApi] getPopularServices error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'POPULAR_FAILED');
    }
  },

  // Get services by category
  getServicesByCategory: async (category: string, filters: Omit<SearchFilters, 'category'>, signal?: AbortSignal): Promise<SearchResponse> => {
    try {
      // Transform coordinates if present
      const transformedFilters: Record<string, unknown> = { ...filters };
      if (filters.lat !== undefined && filters.lng !== undefined) {
        transformedFilters.coordinates = [filters.lng, filters.lat];
        delete transformedFilters.lat;
        delete transformedFilters.lng;
      }
      const response = await api.get(`/category/${category}`, { params: transformedFilters, signal });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get category services';
      console.error('[searchApi] getServicesByCategory error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'CATEGORY_SERVICES_FAILED');
    }
  },

  // Get service details
  getServiceById: async (serviceId: string, signal?: AbortSignal): Promise<{ success: boolean; data: { service: Service } }> => {
    try {
      const response = await api.get(`/service/${serviceId}`, { signal });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get service details';
      console.error('[searchApi] getServiceById error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'SERVICE_DETAILS_FAILED');
    }
  },

  // Track service click (analytics)
  trackServiceClick: async (serviceId: string, signal?: AbortSignal): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post(`/service/${serviceId}/click`, {}, { signal });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to track click';
      console.error('[searchApi] trackServiceClick error:', message, err.response?.status);
      throw new SearchApiError(message, err.response?.status, 'TRACK_CLICK_FAILED');
    }
  },
};

// Utility functions
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
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default searchApi;