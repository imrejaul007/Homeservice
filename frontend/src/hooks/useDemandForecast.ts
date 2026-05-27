// useDemandForecast Hook - AI-powered demand forecasting and smart pricing
import { useState, useEffect, useCallback } from 'react';
import { demandClient, DemandForecast, DemandPrediction, SmartPricing, AvailabilityForecast } from '../services/ai/demandClient';

interface UseDemandForecastOptions {
  serviceId?: string;
  providerId?: string;
  dateRange: {
    start: string;
    end: string;
  };
  granularity?: 'hour' | 'day' | 'week';
  autoFetch?: boolean;
}

interface UseDemandForecastReturn {
  forecast: DemandForecast | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<DemandForecast | undefined>;
  getDemandLevel: (timestamp: Date | string) => 'low' | 'medium' | 'high' | 'peak';
  getPeakHours: () => number[];
  getBestBookingWindows: () => { start: string; end: string }[];
  getRecommendation: () => string;
}

export function useDemandForecast(
  options: UseDemandForecastOptions
): UseDemandForecastReturn {
  const { serviceId, providerId, dateRange, granularity = 'day', autoFetch = true } = options;

  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await demandClient.forecast({
        serviceId,
        providerId,
        dateRange,
        granularity,
      });
      setForecast(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch demand forecast');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [serviceId, providerId, dateRange.start, dateRange.end, granularity]);

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  const getDemandLevel = useCallback(
    (timestamp: Date | string): 'low' | 'medium' | 'high' | 'peak' => {
      if (!forecast?.predictions) return 'medium';

      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const prediction = forecast.predictions.find(
        (p) => new Date(p.timestamp).getTime() === date.getTime()
      );

      return prediction?.demandLevel || 'medium';
    },
    [forecast]
  );

  const getPeakHours = useCallback((): number[] => {
    return forecast?.insights.peakHours || [];
  }, [forecast]);

  const getBestBookingWindows = useCallback(() => {
    return forecast?.insights.bestBookingWindows || [];
  }, [forecast]);

  const getRecommendation = useCallback((): string => {
    return forecast?.insights.recommendations?.[0] || 'No specific recommendation';
  }, [forecast]);

  return {
    forecast,
    isLoading,
    error,
    refetch: fetch,
    getDemandLevel,
    getPeakHours,
    getBestBookingWindows,
    getRecommendation,
  };
}

// =============================================================================
// useSmartPricing Hook
// =============================================================================

interface UseSmartPricingOptions {
  serviceId: string;
  bookingDate?: string;
  location?: { lat: number; lng: number };
  autoFetch?: boolean;
}

interface UseSmartPricingReturn {
  pricing: SmartPricing | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<SmartPricing | undefined>;
  getPriceRange: () => { min: number; max: number };
  getSavings: (originalPrice: number) => number;
  getDemandMultiplier: () => number;
  isGoodTimeToBook: () => boolean;
}

export function useSmartPricing(
  options: UseSmartPricingOptions
): UseSmartPricingReturn {
  const { serviceId, bookingDate, location, autoFetch = true } = options;

  const [pricing, setPricing] = useState<SmartPricing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!serviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const date = bookingDate || new Date().toISOString();
      const result = await demandClient.getSmartPricing(serviceId, date, location);
      setPricing(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch pricing');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [serviceId, bookingDate, location?.lat, location?.lng]);

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  const getPriceRange = useCallback(() => {
    return pricing?.priceRange || { min: 0, max: 0 };
  }, [pricing]);

  const getSavings = useCallback(
    (originalPrice: number): number => {
      if (!pricing) return 0;
      return Math.max(0, originalPrice - pricing.suggestedPrice);
    },
    [pricing]
  );

  const getDemandMultiplier = useCallback((): number => {
    return pricing?.demandMultiplier || 1;
  }, [pricing]);

  const isGoodTimeToBook = useCallback((): boolean => {
    if (!pricing) return true;
    return pricing.demandMultiplier <= 1.1;
  }, [pricing]);

  return {
    pricing,
    isLoading,
    error,
    refetch: fetch,
    getPriceRange,
    getSavings,
    getDemandMultiplier,
    isGoodTimeToBook,
  };
}

// =============================================================================
// useProviderAvailability Hook
// =============================================================================

interface UseProviderAvailabilityOptions {
  providerId: string;
  dateRange: {
    start: string;
    end: string;
  };
  serviceId?: string;
  autoFetch?: boolean;
}

interface UseProviderAvailabilityReturn {
  availability: AvailabilityForecast[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<AvailabilityForecast[] | undefined>;
  getBestSlots: (count?: number) => Promise<{ date: string; hour: number; confidence: number }[]>;
  getNextAvailable: () => Promise<{ date: string; hour: number } | null>;
  getHourlyAvailability: (date: string) => { hour: number; available: boolean; level: string }[];
}

export function useProviderAvailability(
  options: UseProviderAvailabilityOptions
): UseProviderAvailabilityReturn {
  const { providerId, dateRange, serviceId, autoFetch = true } = options;

  const [availability, setAvailability] = useState<AvailabilityForecast[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!providerId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await demandClient.getProviderAvailability(providerId, dateRange, serviceId);
      setAvailability(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch availability');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [providerId, dateRange.start, dateRange.end, serviceId]);

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  const getBestSlots = useCallback(
    async (count: number = 3) => {
      try {
        const slots = await demandClient.getBestSlots(providerId, dateRange, count);
        return slots.map((s) => ({ date: s.date, hour: s.hour, confidence: s.confidence }));
      } catch {
        return [];
      }
    },
    [providerId, dateRange]
  );

  const getNextAvailable = useCallback(async () => {
    try {
      const next = await demandClient.getNextAvailable(providerId);
      return next ? { date: next.date, hour: next.hour } : null;
    } catch {
      return null;
    }
  }, [providerId]);

  const getHourlyAvailability = useCallback(
    (date: string): { hour: number; available: boolean; level: string }[] => {
      const dayForecast = availability?.find((a) => a.date === date);
      if (!dayForecast) return [];

      return dayForecast.predictions.map((p) => ({
        hour: p.hour,
        available: p.isAvailable,
        level: p.availabilityLevel,
      }));
    },
    [availability]
  );

  return {
    availability,
    isLoading,
    error,
    refetch: fetch,
    getBestSlots,
    getNextAvailable,
    getHourlyAvailability,
  };
}

export default {
  useDemandForecast,
  useSmartPricing,
  useProviderAvailability,
};
