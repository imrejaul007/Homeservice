// AI Fraud Detection Client - Frontend API client for fraud detection
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Types
export interface FraudSignal {
  type: string;
  weight: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  data?: Record<string, any>;
}

export interface FraudRisk {
  score: number;
  signals: FraudSignal[];
  action: 'allow' | 'review' | 'block';
  factors: FraudFactors;
  metadata: FraudMetadata;
}

export interface FraudFactors {
  bookingVelocity: number;
  deviceFingerprintScore: number;
  locationAnomaly: boolean;
  paymentRisk: boolean;
  accountAge: number;
  cancellationPattern: number;
  walletAnomaly?: boolean;
  selfBookingRisk?: boolean;
  rapidCancellationRisk?: boolean;
}

export interface FraudMetadata {
  modelVersion: string;
  processingTimeMs: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  requiresReview: boolean;
  detectedAt: string;
}

export interface FraudCheckRequest {
  type: 'pre-booking' | 'post-booking' | 'wallet-activity' | 'full-assessment';
  userId?: string;
  bookingId?: string;
  amount?: number;
  providerId?: string;
  deviceFingerprint?: string;
  geolocation?: { lat: number; lng: number };
  isGuestBooking?: boolean;
  guestEmail?: string;
  guestPhone?: string;
  walletBalance?: number;
}

export interface FraudStats {
  totalAssessments: number;
  allowedCount: number;
  reviewCount: number;
  blockedCount: number;
  avgRiskScore: number;
  topRiskFactors: Array<{ type: string; count: number }>;
}

// API Client
export const fraudClient = {
  /**
   * Check fraud risk for a booking or activity
   */
  checkFraud: async (request: FraudCheckRequest): Promise<FraudRisk> => {
    const response = await axios.post(`${API_BASE_URL}/ai/fraud/check`, request, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Pre-booking fraud assessment
   */
  preBookingAssessment: async (
    customerId: string,
    providerId: string,
    amount: number,
    geolocation?: { lat: number; lng: number }
  ): Promise<FraudRisk> => {
    const response = await axios.post(
      `${API_BASE_URL}/ai/fraud/pre-booking`,
      { customerId, providerId, amount, geolocation },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Guest booking fraud assessment
   */
  guestBookingAssessment: async (
    email: string,
    phone: string,
    amount: number
  ): Promise<FraudRisk> => {
    const response = await axios.post(
      `${API_BASE_URL}/ai/fraud/guest-booking`,
      { email, phone, amount },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get user risk summary
   */
  getUserRiskSummary: async (userId: string): Promise<{
    currentRisk: FraudRisk;
    historicalRisk: number[];
    riskTrend: 'increasing' | 'stable' | 'decreasing';
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/fraud/user/${userId}/summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get fraud statistics
   */
  getStats: async (startDate?: string, endDate?: string): Promise<FraudStats> => {
    const response = await axios.get(`${API_BASE_URL}/ai/fraud/stats`, {
      params: { startDate, endDate },
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get fraud signals explanation
   */
  getSignalExplanation: async (signalType: string): Promise<{
    description: string;
    riskFactors: string[];
    recommendations: string[];
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/fraud/signals/${signalType}/explain`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Report false positive/negative
   */
  reportFeedback: async (
    fraudCheckId: string,
    feedback: 'false_positive' | 'false_negative' | 'accurate'
  ): Promise<void> => {
    await axios.post(
      `${API_BASE_URL}/ai/fraud/feedback`,
      { fraudCheckId, feedback },
      { headers: getAuthHeader() }
    );
  },
};

export default fraudClient;
