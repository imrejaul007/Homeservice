/**
 * AI Service - Calls backend AI endpoints
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAuthStore } from '../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface AIInsights {
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    completionRate: number;
    cancellationRate: number;
    totalRevenue: number;
  };
  topServices: Array<{
    service: string;
    category: string;
    bookings: number;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    title: string;
    description: string;
    recommendation: string;
  }>;
  recentBookings: Array<{
    id: string;
    service: string;
    status: string;
    createdAt: string;
  }>;
}

export interface ProviderScore {
  providerId: string;
  score: number;
  grade: string;
  totalBookings: number;
  completionRate: number;
  rating: number;
  responseRate: number;
  recentBookings: number;
  recommendation: string;
}

export interface ChurnRisk {
  userId: string;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  factors: string[];
  lastBookingDate: string | null;
  daysSinceLastBooking: number | null;
  totalBookings: number;
  recommendation: string;
}

export const aiApi = {
  /**
   * Get business insights and analytics
   */
  getInsights: async (): Promise<AIInsights> => {
    const response = await axios.get(`${API_BASE_URL}/ai/insights`, {
      headers: getAuthHeader()
    });
    return response.data.data;
  },

  /**
   * Get provider performance score
   */
  getProviderScore: async (providerId: string): Promise<ProviderScore> => {
    const response = await axios.get(`${API_BASE_URL}/ai/provider/${providerId}/score`, {
      headers: getAuthHeader()
    });
    return response.data.data;
  },

  /**
   * Get user churn risk analysis
   */
  getUserChurnRisk: async (userId: string): Promise<ChurnRisk> => {
    const response = await axios.get(`${API_BASE_URL}/ai/user/${userId}/churn-risk`, {
      headers: getAuthHeader()
    });
    return response.data.data;
  }
};

export default aiApi;
