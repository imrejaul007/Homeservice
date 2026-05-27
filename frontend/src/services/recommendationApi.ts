/**
 * Recommendation API Service
 * Calls backend recommendation endpoints
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAuthStore } from '../stores/authStore';

// =============================================================================
// Types
// =============================================================================

export interface ServiceRecommendation {
  service: {
    _id: string;
    name: string;
    category: string;
    subcategory?: string;
    description?: string;
    shortDescription?: string;
    price: {
      amount: number;
      currency: string;
      type: 'fixed' | 'hourly' | 'custom';
      discounts?: Array<{
        type: 'bulk' | 'seasonal' | 'loyalty' | 'first_time';
        percentage: number;
      }>;
    };
    duration: number;
    images: string[];
    rating: {
      average: number;
      count: number;
    };
    providerId: string;
    location: {
      address: {
        city: string;
        state: string;
      };
    };
    isFeatured?: boolean;
    isPopular?: boolean;
  };
  score: number;
  reasons: string[];
  personalized: boolean;
  matchFactors?: {
    categoryMatch: boolean;
    priceMatch: boolean;
    ratingMatch: boolean;
    locationMatch: boolean;
    historyMatch: boolean;
  };
}

export interface ProviderRecommendation {
  provider: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    rating: {
      average: number;
      count: number;
    };
    servicesCount: number;
    completedBookings: number;
    responseRate?: number;
    yearsExperience?: number;
    specialties?: string[];
    location?: {
      city?: string;
      state?: string;
    };
  };
  score: number;
  reasons: string[];
  commonServices: string[];
}

export interface TrendingService {
  service: {
    _id: string;
    name: string;
    category: string;
    price: {
      amount: number;
      currency: string;
    };
    image?: string;
    rating: {
      average: number;
      count: number;
    };
    bookingCount: number;
  };
  trendScore: number;
  growthRate: number;
  category: string;
}

export interface DemandPrediction {
  serviceId: string;
  serviceName: string;
  predictedDemand: 'low' | 'medium' | 'high' | 'surge';
  confidence: number;
  factors: {
    historicalVolume: number;
    seasonalFactor: number;
    dayOfWeek: string;
    timeOfDay: string;
    upcomingEvents: number;
  };
  recommendedActions: string[];
}

export interface PriceRecommendation {
  serviceId: string;
  currentPrice: number;
  recommendedPrice: number;
  priceChange: number;
  changePercent: number;
  confidence: number;
  strategy: 'aggressive' | 'moderate' | 'conservative';
  reasons: string[];
  validUntil: string;
}

export interface ChurnRisk {
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    name: string;
    weight: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  predictedChurnDate?: string;
  confidence: number;
  recommendedActions: Array<{
    type: 'offer' | 'outreach' | 'incentive' | 'reengagement' | 'feedback';
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    expectedImpact: number;
    channels: string[];
  }>;
  lastBookingDate?: string;
  daysSinceLastBooking?: number;
  totalBookings: number;
  lifetimeValue: number;
}

export interface RecommendationFeedback {
  serviceId: string;
  action: 'view' | 'click' | 'booking' | 'dismiss';
  metadata?: Record<string, any>;
}

// =============================================================================
// API Client
// =============================================================================

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// =============================================================================
// Recommendation API
// =============================================================================

export const recommendationApi = {
  /**
   * Get personalized service recommendations
   */
  getPersonalizedRecommendations: async (params: {
    userId?: string;
    limit?: number;
    category?: string;
    offset?: number;
  }): Promise<ServiceRecommendation[]> => {
    const response = await axios.get(`${API_BASE_URL}/recommendations/services`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data.data.recommendations || [];
  },

  /**
   * Get trending/popular service recommendations
   */
  getTrendingRecommendations: async (params: {
    limit?: number;
    category?: string;
  }): Promise<ServiceRecommendation[]> => {
    const response = await axios.get(`${API_BASE_URL}/recommendations/trending`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data.data.recommendations || [];
  },

  /**
   * Get recommended providers for a user
   */
  getProviderRecommendations: async (params: {
    userId?: string;
    limit?: number;
    category?: string;
    location?: { lat: number; lng: number; radius?: number };
  }): Promise<ProviderRecommendation[]> => {
    const response = await axios.get(`${API_BASE_URL}/recommendations/providers`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data.data.providers || [];
  },

  /**
   * Get demand prediction for a service
   */
  getDemandPrediction: async (
    serviceId: string,
    daysAhead: number = 7
  ): Promise<DemandPrediction> => {
    const response = await axios.get(
      `${API_BASE_URL}/recommendations/demand/${serviceId}`,
      {
        headers: getAuthHeader(),
        params: { daysAhead },
      }
    );
    return response.data.data;
  },

  /**
   * Get price recommendation for a service
   */
  getPriceRecommendation: async (
    serviceId: string,
    options?: {
      strategy?: 'aggressive' | 'moderate' | 'conservative';
    }
  ): Promise<PriceRecommendation> => {
    const response = await axios.get(
      `${API_BASE_URL}/recommendations/price/${serviceId}`,
      {
        headers: getAuthHeader(),
        params: options,
      }
    );
    return response.data.data;
  },

  /**
   * Get user churn risk analysis
   */
  getUserChurnRisk: async (userId?: string): Promise<ChurnRisk> => {
    const response = await axios.get(`${API_BASE_URL}/recommendations/churn/${userId || 'me'}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Record recommendation feedback
   */
  recordFeedback: async (feedback: RecommendationFeedback): Promise<void> => {
    await axios.post(`${API_BASE_URL}/recommendations/feedback`, feedback, {
      headers: getAuthHeader(),
    });
  },

  /**
   * Get offer targeting users
   */
  getOfferTargets: async (offerId: string): Promise<{
    targetUserIds: string[];
    estimatedReach: number;
    expectedConversionRate: number;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/recommendations/offer-targets/${offerId}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get recommendation analytics
   */
  getAnalytics: async (timeRange?: {
    start: string;
    end: string;
  }): Promise<{
    recommendationsServed: number;
    recommendationsBooked: number;
    conversionRate: number;
    revenueFromRecommendations: number;
    avgBookingValue: number;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/recommendations/analytics`, {
      headers: getAuthHeader(),
      params: timeRange,
    });
    return response.data.data;
  },
};

export default recommendationApi;
