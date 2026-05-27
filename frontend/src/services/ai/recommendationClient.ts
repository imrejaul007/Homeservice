// AI Recommendation Client - Frontend API client for recommendations
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Types
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RecommendationContext {
  location?: GeoPoint;
  category?: string;
  browsingHistory?: string[];
  favorites?: string[];
  searchQuery?: string;
  sessionId?: string;
}

export interface RecommendedItem {
  id: string;
  type: 'service' | 'provider';
  score: number;
  reason: string;
  explanation: string;
  metadata: {
    name?: string;
    image?: string;
    rating?: number;
    price?: number;
    distance?: number;
    availability?: string;
  };
}

export interface Recommendation {
  type: 'service' | 'provider' | 'complementary';
  items: RecommendedItem[];
  confidence: number;
  explanation: string;
  modelVersion: string;
}

export interface RecommendationRequest {
  userId?: string;
  context: RecommendationContext;
  types: ('service' | 'provider' | 'complementary')[];
  limit?: number;
  filters?: {
    priceRange?: { min: number; max: number };
    rating?: number;
    category?: string;
    availability?: { date: string; time?: string };
  };
}

export interface SimilarServicesRequest {
  serviceId: string;
  limit?: number;
}

export interface ProviderMatchesRequest {
  serviceId: string;
  location: GeoPoint;
  limit?: number;
}

// API Client
export const recommendationClient = {
  /**
   * Get personalized recommendations
   */
  getRecommendations: async (request: RecommendationRequest): Promise<Recommendation[]> => {
    const response = await axios.post(`${API_BASE_URL}/ai/recommendations`, request, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get similar services to a given service
   */
  getSimilarServices: async (request: SimilarServicesRequest): Promise<RecommendedItem[]> => {
    const response = await axios.get(`${API_BASE_URL}/ai/services/${request.serviceId}/similar`, {
      params: { limit: request.limit || 10 },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get provider matches for a service
   */
  getProviderMatches: async (request: ProviderMatchesRequest): Promise<RecommendedItem[]> => {
    const response = await axios.get(`${API_BASE_URL}/ai/services/${request.serviceId}/providers`, {
      params: {
        lat: request.location.lat,
        lng: request.location.lng,
        limit: request.limit || 5,
      },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get "users also booked" recommendations
   */
  getUsersAlsoBooked: async (
    userId: string,
    currentServiceIds: string[],
    limit: number = 10
  ): Promise<RecommendedItem[]> => {
    const response = await axios.post(
      `${API_BASE_URL}/ai/recommendations/users-also-booked`,
      { userId, serviceIds: currentServiceIds, limit },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get trending services
   */
  getTrending: async (category?: string, limit: number = 10): Promise<RecommendedItem[]> => {
    const response = await axios.get(`${API_BASE_URL}/ai/recommendations/trending`, {
      params: { category, limit },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get personalized home feed
   */
  getHomeFeed: async (location?: GeoPoint): Promise<{
    forYou: RecommendedItem[];
    trending: RecommendedItem[];
    nearYou: RecommendedItem[];
    categories: { name: string; items: RecommendedItem[] }[];
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/recommendations/home`, {
      params: location ? { lat: location.lat, lng: location.lng } : {},
      headers: getAuthHeader(),
    });
    return response.data.data;
  },
};

export default recommendationClient;
