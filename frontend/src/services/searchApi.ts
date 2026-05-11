import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import type { SearchFilters, Service, SearchResponse, Suggestion, SuggestionsResponse } from '@/types/search';

const api = axios.create({
  baseURL: `${API_BASE_URL}/search`,
  timeout: 10000,
});

// API Functions
export const searchApi = {
  // Main search function
  searchServices: async (filters: SearchFilters): Promise<SearchResponse> => {
    const response = await api.get('/services', { params: filters });
    return response.data;
  },

  // Get search suggestions/autocomplete
  getSearchSuggestions: async (query: string, limit = 5): Promise<SuggestionsResponse> => {
    const response = await api.get('/suggestions', { 
      params: { q: query, limit }
    });
    return response.data;
  },

  // Get trending services
  getTrendingServices: async (timeframe = '7d', limit = 10): Promise<SearchResponse> => {
    const response = await api.get('/trending', { 
      params: { timeframe, limit }
    });
    return response.data;
  },

  // Get search filters metadata
  getSearchFilters: async (location?: { lat: number; lng: number; radius: number }): Promise<any> => {
    const response = await api.get('/filters', { params: location });
    return response.data;
  },

  // Get popular services
  getPopularServices: async (category?: string, limit = 20): Promise<SearchResponse> => {
    const response = await api.get('/popular', { 
      params: { category, limit }
    });
    return response.data;
  },

  // Get services by category
  getServicesByCategory: async (category: string, filters: Omit<SearchFilters, 'category'>): Promise<SearchResponse> => {
    const response = await api.get(`/category/${category}`, { params: filters });
    return response.data;
  },

  // Get service details
  getServiceById: async (serviceId: string): Promise<{ success: boolean; data: { service: Service } }> => {
    const response = await api.get(`/service/${serviceId}`);
    return response.data;
  },

  // Track service click (analytics)
  trackServiceClick: async (serviceId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/service/${serviceId}/click`);
    return response.data;
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