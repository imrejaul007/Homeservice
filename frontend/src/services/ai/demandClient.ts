// AI Demand Forecasting Client - Frontend API client for demand forecasting
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Types
export interface DemandForecast {
  serviceId?: string;
  providerId?: string;
  predictions: DemandPrediction[];
  insights: DemandInsights;
  metadata: DemandMetadata;
}

export interface DemandPrediction {
  timestamp: string;
  predicted: number;
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  confidence: {
    lower: number;
    upper: number;
  };
  features: {
    isWeekend: boolean;
    isHoliday: boolean;
    isPeakHour: boolean;
  };
}

export interface DemandInsights {
  peakHours: number[];
  bestBookingWindows: TimeSlot[];
  lowDemandPeriods: TimeSlot[];
  recommendations: string[];
  demandTrend: 'increasing' | 'stable' | 'decreasing';
  seasonalityFactor: number;
}

export interface TimeSlot {
  start: string;
  end: string;
  avgDemand: number;
  availability: 'high' | 'medium' | 'low';
}

export interface DemandMetadata {
  modelVersion: string;
  calculatedAt: string;
  forecastHorizon: number;
  dataPointsUsed: number;
  accuracy?: number;
}

export interface DemandForecastRequest {
  serviceId?: string;
  providerId?: string;
  location?: { lat: number; lng: number };
  dateRange: {
    start: string;
    end: string;
  };
  granularity: 'hour' | 'day' | 'week';
  includeWeather?: boolean;
}

export interface PeakHoursResponse {
  peakHours: { hour: number; demand: number }[];
  offPeakHours: { hour: number; demand: number }[];
  bestTimeToBook: string;
}

export interface SmartPricing {
  serviceId: string;
  basePrice: number;
  suggestedPrice: number;
  priceRange: {
    min: number;
    max: number;
    optimal: number;
  };
  factors: PricingFactor[];
  demandMultiplier: number;
  competitionMultiplier: number;
  seasonMultiplier: number;
  urgencyMultiplier: number;
  finalPrice: number;
  confidence: number;
  validUntil: string;
}

export interface PricingFactor {
  type: 'demand' | 'competition' | 'seasonal' | 'urgency' | 'location' | 'quality';
  name: string;
  multiplier: number;
  impact: 'increase' | 'decrease' | 'neutral';
  description: string;
}

export interface AvailabilityForecast {
  providerId: string;
  date: string;
  predictions: HourlyAvailability[];
  summary: AvailabilitySummary;
  metadata: AvailabilityMetadata;
}

export interface HourlyAvailability {
  hour: number;
  isAvailable: boolean;
  confidence: number;
  bookedSlots: number;
  totalSlots: number;
  availabilityLevel: 'high' | 'medium' | 'low' | 'full';
  waitlistProbability: number;
}

export interface AvailabilitySummary {
  mostAvailableHour: number;
  leastAvailableHour: number;
  totalAvailableSlots: number;
  peakHours: number[];
  offPeakHours: number[];
  recommendation: string;
}

export interface AvailabilityMetadata {
  modelVersion: string;
  calculatedAt: string;
  historicalDataDays: number;
}

// API Client
export const demandClient = {
  /**
   * Get demand forecast for a service
   */
  forecast: async (request: DemandForecastRequest): Promise<DemandForecast> => {
    const response = await axios.post(`${API_BASE_URL}/ai/demand/forecast`, request, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get peak hours for a service or provider
   */
  getPeakHours: async (
    serviceId?: string,
    providerId?: string
  ): Promise<PeakHoursResponse> => {
    const response = await axios.get(`${API_BASE_URL}/ai/demand/peak-hours`, {
      params: { serviceId, providerId },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get best booking times
   */
  getBestBookingTimes: async (
    serviceId?: string,
    providerId?: string,
    date?: string
  ): Promise<{
    bestTimes: TimeSlot[];
    avoidTimes: TimeSlot[];
    reason: string;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/demand/best-times`, {
      params: { serviceId, providerId, date },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get smart pricing for a service
   */
  getSmartPricing: async (
    serviceId: string,
    bookingDate: string,
    location?: { lat: number; lng: number }
  ): Promise<SmartPricing> => {
    const response = await axios.get(`${API_BASE_URL}/ai/pricing/optimal`, {
      params: { serviceId, bookingDate, ...location },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get competitive analysis for a service
   */
  getCompetitiveAnalysis: async (
    serviceId: string,
    location?: { lat: number; lng: number }
  ): Promise<{
    marketAverage: number;
    yourPrice: number;
    pricePosition: 'undercut' | 'competitive' | 'premium' | 'luxury';
    competitors: Array<{
      providerId: string;
      providerName: string;
      price: number;
      rating: number;
      distance: number;
    }>;
    recommendations: string[];
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/pricing/competition`, {
      params: { serviceId, ...location },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get provider availability forecast
   */
  getProviderAvailability: async (
    providerId: string,
    dateRange: { start: string; end: string },
    serviceId?: string
  ): Promise<AvailabilityForecast[]> => {
    const response = await axios.get(`${API_BASE_URL}/ai/availability/provider/${providerId}`, {
      params: {
        start: dateRange.start,
        end: dateRange.end,
        serviceId,
      },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get best available slots for a provider
   */
  getBestSlots: async (
    providerId: string,
    dateRange: { start: string; end: string },
    count: number = 3
  ): Promise<Array<{
    date: string;
    hour: number;
    confidence: number;
    reason: string;
    alternatives: Array<{ date: string; hour: number; confidence: number }>;
  }>> => {
    const response = await axios.get(`${API_BASE_URL}/ai/availability/best-slots`, {
      params: {
        providerId,
        start: dateRange.start,
        end: dateRange.end,
        count,
      },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get next available slot for a provider
   */
  getNextAvailable: async (
    providerId: string,
    afterDate?: string
  ): Promise<{ date: string; hour: number; confidence: number } | null> => {
    const response = await axios.get(`${API_BASE_URL}/ai/availability/next`, {
      params: { providerId, afterDate },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get demand by category
   */
  getCategoryDemand: async (
    categoryId: string,
    dateRange: { start: string; end: string }
  ): Promise<{
    categoryId: string;
    totalDemand: number;
    demandByDay: Array<{ date: string; demand: number }>;
    topServices: Array<{ serviceId: string; serviceName: string; demand: number }>;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/demand/category/${categoryId}`, {
      params: { start: dateRange.start, end: dateRange.end },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },
};

export default demandClient;
