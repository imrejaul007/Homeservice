// AI Churn Prediction Client - Frontend API client for churn prediction
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Types
export interface ChurnRisk {
  customerId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: ChurnRiskFactor[];
  recommendedActions: ChurnAction[];
  engagementScore: number;
  predictedChurnDate?: string;
  lastBookingDate?: string;
  daysSinceLastBooking: number;
  lifetimeValue: number;
  metadata: ChurnMetadata;
}

export interface ChurnRiskFactor {
  factor: string;
  impact: number;
  description: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ChurnAction {
  action: string;
  actionType: 'notification' | 'offer' | 'reachout' | 'retention';
  priority: number;
  expectedLift: number;
  reason: string;
  channels: ('push' | 'email' | 'sms' | 'whatsapp')[];
}

export interface ChurnMetadata {
  modelVersion: string;
  calculatedAt: string;
  dataFreshness: 'real-time' | 'daily' | 'weekly';
  confidence: number;
  lastFeatureUpdate: string;
}

export interface ChurnPredictionRequest {
  customerId: string;
  includeActions?: boolean;
  channels?: ('push' | 'email' | 'sms' | 'whatsapp')[];
  urgency?: 'all' | 'high-only';
}

export interface AtRiskSummary {
  total: number;
  byLevel: Record<string, number>;
  avgRiskScore: number;
  topRiskFactors: string[];
  highPriorityActions: ChurnAction[];
}

export interface ReEngagementTriggers {
  triggers: string[];
  bestTime: string;
  bestChannel: string;
  personalizedMessage: string;
}

// API Client
export const churnClient = {
  /**
   * Get churn risk prediction for a customer
   */
  predictChurn: async (request: ChurnPredictionRequest): Promise<ChurnRisk> => {
    const response = await axios.post(`${API_BASE_URL}/ai/churn/predict`, request, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get current user's churn risk
   */
  getMyChurnRisk: async (): Promise<ChurnRisk> => {
    const response = await axios.get(`${API_BASE_URL}/ai/churn/me`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get at-risk customers summary (admin)
   */
  getAtRiskSummary: async (): Promise<AtRiskSummary> => {
    const response = await axios.get(`${API_BASE_URL}/ai/churn/at-risk-summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get batch churn predictions (admin)
   */
  batchPredict: async (
    customerIds: string[],
    options?: { priorityThreshold?: number; includeActions?: boolean }
  ): Promise<ChurnRisk[]> => {
    const response = await axios.post(
      `${API_BASE_URL}/ai/churn/batch`,
      { customerIds, ...options },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get re-engagement triggers for a customer
   */
  getReEngagementTriggers: async (customerId: string): Promise<ReEngagementTriggers> => {
    const response = await axios.get(`${API_BASE_URL}/ai/churn/${customerId}/triggers`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get recommended actions for a customer
   */
  getRecommendedActions: async (
    customerId: string,
    channels?: ('push' | 'email' | 'sms' | 'whatsapp')[]
  ): Promise<ChurnAction[]> => {
    const response = await axios.get(`${API_BASE_URL}/ai/churn/${customerId}/actions`, {
      params: { channels: channels?.join(',') },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Track intervention outcome
   */
  trackIntervention: async (
    customerId: string,
    action: string,
    outcome: 'success' | 'failed' | 'pending'
  ): Promise<void> => {
    await axios.post(
      `${API_BASE_URL}/ai/churn/intervention`,
      { customerId, action, outcome },
      { headers: getAuthHeader() }
    );
  },

  /**
   * Get churn risk distribution over time
   */
  getRiskTrend: async (
    days: number = 30
  ): Promise<{
    dates: string[];
    avgRiskScores: number[];
    byLevel: Record<string, number[]>;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/churn/trends`, {
      params: { days },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },
};

export default churnClient;
