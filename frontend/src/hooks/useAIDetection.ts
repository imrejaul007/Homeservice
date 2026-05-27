// useAIDetection Hook - AI-powered fraud detection and churn prediction
import { useState, useEffect, useCallback } from 'react';
import { fraudClient, FraudRisk, FraudCheckRequest } from '../services/ai/fraudClient';
import { churnClient, ChurnRisk, ChurnPredictionRequest } from '../services/ai/churnClient';
import { useAuthStore } from '../stores/authStore';

// =============================================================================
// useFraudDetection Hook
// =============================================================================

interface UseFraudDetectionOptions {
  type: 'pre-booking' | 'post-booking' | 'wallet-activity' | 'full-assessment';
  autoFetch?: boolean;
}

interface UseFraudDetectionReturn {
  risk: FraudRisk | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<FraudRisk | undefined>;
  getRiskLevel: () => 'low' | 'medium' | 'high' | 'critical';
  getRiskColor: () => string;
  shouldBlock: () => boolean;
  shouldReview: () => boolean;
}

export function useFraudDetection(
  options: UseFraudDetectionOptions
): UseFraudDetectionReturn {
  const { type, autoFetch = false } = options;

  const [risk, setRisk] = useState<FraudRisk | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRisk = useCallback(async (request?: FraudCheckRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fraudClient.checkFraud(request || { type });
      setRisk(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to check fraud risk');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (autoFetch) {
      fetchRisk();
    }
  }, [autoFetch, fetchRisk]);

  const getRiskLevel = useCallback(() => {
    return risk?.metadata.riskLevel || 'low';
  }, [risk]);

  const getRiskColor = useCallback(() => {
    const level = getRiskLevel();
    switch (level) {
      case 'critical':
      case 'high':
        return '#dc2626';
      case 'medium':
        return '#f59e0b';
      case 'low':
      default:
        return '#22c55e';
    }
  }, [getRiskLevel]);

  const shouldBlock = useCallback(() => {
    return risk?.action === 'block';
  }, [risk]);

  const shouldReview = useCallback(() => {
    return risk?.action === 'review';
  }, [risk]);

  return {
    risk,
    isLoading,
    error,
    refetch: fetchRisk,
    getRiskLevel,
    getRiskColor,
    shouldBlock,
    shouldReview,
  };
}

// =============================================================================
// useChurnPrediction Hook
// =============================================================================

interface UseChurnPredictionOptions {
  customerId?: string;
  includeActions?: boolean;
  channels?: ('push' | 'email' | 'sms' | 'whatsapp')[];
  autoFetch?: boolean;
}

interface UseChurnPredictionReturn {
  churnRisk: ChurnRisk | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<ChurnRisk | null>;
  getRiskLevel: () => 'low' | 'medium' | 'high' | 'critical';
  getRiskColor: () => string;
  getTopFactors: () => { factor: string; impact: number }[];
  getRecommendedActions: () => { action: string; priority: number }[];
  isAtRisk: () => boolean;
}

export function useChurnPrediction(
  options: UseChurnPredictionOptions = {}
): UseChurnPredictionReturn {
  const { customerId, includeActions = true, channels, autoFetch = false } = options;

  const user = useAuthStore((state) => state.user);
  const targetCustomerId = customerId || user?._id;

  const [churnRisk, setChurnRisk] = useState<ChurnRisk | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchChurnRisk = useCallback(async () => {
    if (!targetCustomerId) {
      setChurnRisk(null);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: ChurnPredictionRequest = {
        customerId: targetCustomerId,
        includeActions,
        channels,
      };

      const result = await churnClient.predictChurn(request);
      setChurnRisk(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to predict churn');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [targetCustomerId, includeActions, channels]);

  useEffect(() => {
    if (autoFetch && targetCustomerId) {
      fetchChurnRisk();
    }
  }, [autoFetch, targetCustomerId, fetchChurnRisk]);

  const getRiskLevel = useCallback(() => {
    return churnRisk?.riskLevel || 'low';
  }, [churnRisk]);

  const getRiskColor = useCallback(() => {
    const level = getRiskLevel();
    switch (level) {
      case 'critical':
      case 'high':
        return '#dc2626';
      case 'medium':
        return '#f59e0b';
      case 'low':
      default:
        return '#22c55e';
    }
  }, [getRiskLevel]);

  const getTopFactors = useCallback(() => {
    if (!churnRisk?.riskFactors) return [];
    return churnRisk.riskFactors
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3)
      .map((f) => ({ factor: f.factor, impact: f.impact }));
  }, [churnRisk]);

  const getRecommendedActions = useCallback(() => {
    if (!churnRisk?.recommendedActions) return [];
    return churnRisk.recommendedActions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map((a) => ({ action: a.action, priority: a.priority }));
  }, [churnRisk]);

  const isAtRisk = useCallback(() => {
    return churnRisk ? churnRisk.riskScore >= 0.4 : false;
  }, [churnRisk]);

  return {
    churnRisk,
    isLoading,
    error,
    refetch: fetchChurnRisk,
    getRiskLevel,
    getRiskColor,
    getTopFactors,
    getRecommendedActions,
    isAtRisk,
  };
}

// =============================================================================
// useMyChurnRisk Hook - For current user
// =============================================================================

interface UseMyChurnRiskReturn {
  churnRisk: ChurnRisk | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<ChurnRisk | null>;
  engagementScore: number;
  daysSinceLastBooking: number;
  isAtRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export function useMyChurnRisk(): UseMyChurnRiskReturn {
  const { churnRisk, isLoading, error, refetch, isAtRisk } = useChurnPrediction({
    autoFetch: true,
  });

  return {
    churnRisk,
    isLoading,
    error,
    refetch,
    engagementScore: churnRisk?.engagementScore || 0,
    daysSinceLastBooking: churnRisk?.daysSinceLastBooking || 0,
    isAtRisk: isAtRisk(),
    riskLevel: churnRisk?.riskLevel || 'low',
  };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  useFraudDetection,
  useChurnPrediction,
  useMyChurnRisk,
};
