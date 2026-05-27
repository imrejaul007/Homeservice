import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { recommendationApi } from '@/services/recommendationApi';
import { useAuthStore } from '@/stores/authStore';

// =============================================================================
// NILIN Recommendations Hook
// React hook for fetching and managing service recommendations
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface UseRecommendationsOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Refresh interval in milliseconds (default: 5 minutes) */
  refreshInterval?: number;
  /** Number of recommendations to fetch */
  limit?: number;
  /** Category filter */
  category?: string;
  /** Enable trending recommendations fallback (default: true) */
  enableTrending?: boolean;
  /** Cache recommendations in state */
  cacheResults?: boolean;
}

export interface UseRecommendationsReturn {
  // State
  recommendations: ServiceRecommendation[];
  providerRecommendations: ProviderRecommendation[];
  trendingRecommendations: ServiceRecommendation[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  fetchRecommendations: () => Promise<ServiceRecommendation[] | undefined>;
  refreshRecommendations: () => Promise<void>;
  invalidateCache: () => void;
  loadMore: () => Promise<void>;

  // Computed
  hasMore: boolean;
  totalCount: number;
}

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

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIONS: UseRecommendationsOptions = {
  autoFetch: true,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  limit: 10,
  category: undefined,
  enableTrending: true,
  cacheResults: true,
};

const MAX_CACHED_RECOMMENDATIONS = 50;

// =============================================================================
// useRecommendations Hook
// =============================================================================

/**
 * useRecommendations - Hook for fetching and managing personalized recommendations
 *
 * Features:
 * - Personalized service recommendations based on user preferences
 * - Provider recommendations
 * - Trending services fallback
 * - Automatic refresh with configurable interval
 * - Caching to prevent redundant API calls
 * - Error handling and retry logic
 *
 * @param options - Configuration options
 * @returns Recommendation state and actions
 *
 * @example
 * const {
 *   recommendations,
 *   isLoading,
 *   error,
 *   refreshRecommendations
 * } = useRecommendations({ limit: 10, category: 'beauty' });
 */
export function useRecommendations(
  options: UseRecommendationsOptions = {}
): UseRecommendationsReturn {
  // Merge with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [recommendations, setRecommendations] = useState<ServiceRecommendation[]>([]);
  const [providerRecommendations, setProviderRecommendations] = useState<ProviderRecommendation[]>([]);
  const [trendingRecommendations, setTrendingRecommendations] = useState<ServiceRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);

  // =============================================================================
  // Fetch Recommendations
  // =============================================================================

  /**
   * Fetch personalized recommendations
   */
  const fetchRecommendations = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const results = await recommendationApi.getPersonalizedRecommendations({
        userId,
        limit: config.limit || 10,
        category: config.category,
      });

      setRecommendations(results);
      setLastUpdated(new Date());
      setTotalCount(results.length);
      setHasMore(results.length >= (config.limit || 10));

      return results;
    } catch (err: any) {
      // Handle abort error
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch recommendations';
      setError(errorMessage);

      // If personalized fetch fails, try trending
      if (config.enableTrending && recommendations.length === 0) {
        try {
          const trending = await recommendationApi.getTrendingRecommendations({
            limit: config.limit || 10,
            category: config.category,
          });
          setTrendingRecommendations(trending);
        } catch (trendingErr) {
          console.error('Failed to fetch trending recommendations:', trendingErr);
        }
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, config.limit, config.category, config.enableTrending]);

  /**
   * Refresh recommendations (shows loading indicator)
   */
  const refreshRecommendations = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchRecommendations();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRecommendations, isRefreshing]);

  /**
   * Invalidate cache and refetch
   */
  const invalidateCache = useCallback(() => {
    setRecommendations([]);
    setProviderRecommendations([]);
    setTrendingRecommendations([]);
    setLastUpdated(null);
    fetchRecommendations();
  }, [fetchRecommendations]);

  /**
   * Load more recommendations
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    try {
      const moreResults = await recommendationApi.getPersonalizedRecommendations({
        userId,
        limit: config.limit || 10,
        category: config.category,
        offset: recommendations.length,
      });

      if (moreResults.length > 0) {
        setRecommendations((prev) => {
          const combined = [...prev, ...moreResults];
          // Keep only the latest MAX_CACHED_RECOMMENDATIONS
          return combined.slice(0, MAX_CACHED_RECOMMENDATIONS);
        });
        setTotalCount((prev) => prev + moreResults.length);
        setHasMore(moreResults.length >= (config.limit || 10));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more recommendations:', err);
    }
  }, [isLoading, hasMore, userId, config.limit, config.category, recommendations.length]);

  // =============================================================================
  // Auto-fetch on Mount
  // =============================================================================

  useEffect(() => {
    if (config.autoFetch) {
      fetchRecommendations();
    }

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [config.autoFetch, fetchRecommendations]);

  // =============================================================================
  // Auto-refresh Interval
  // =============================================================================

  useEffect(() => {
    if (config.refreshInterval && config.refreshInterval > 0 && isAuthenticated) {
      refreshIntervalRef.current = setInterval(() => {
        refreshRecommendations();
      }, config.refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [config.refreshInterval, isAuthenticated, refreshRecommendations]);

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // State
    recommendations,
    providerRecommendations,
    trendingRecommendations,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,

    // Actions
    fetchRecommendations,
    refreshRecommendations,
    invalidateCache,
    loadMore,

    // Computed
    hasMore,
    totalCount,
  };
}

// =============================================================================
// useTrendingRecommendations Hook
// Simplified hook for trending/popular services
// =============================================================================

export interface UseTrendingOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Number of recommendations to fetch (default: 10) */
  limit?: number;
  /** Category filter */
  category?: string;
}

export interface UseTrendingReturn {
  trending: ServiceRecommendation[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * useTrendingRecommendations - Hook for fetching trending/popular services
 *
 * @param options - Configuration options
 * @returns Trending services state and actions
 */
export function useTrendingRecommendations(options: UseTrendingOptions = {}): UseTrendingReturn {
  const config = {
    autoFetch: options.autoFetch ?? true,
    limit: options.limit ?? 10,
    category: options.category,
  };

  const [trending, setTrending] = useState<ServiceRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await recommendationApi.getTrendingRecommendations({
        limit: config.limit,
        category: config.category,
      });
      setTrending(results);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trending services');
    } finally {
      setIsLoading(false);
    }
  }, [config.limit, config.category]);

  useEffect(() => {
    if (config.autoFetch) {
      fetchTrending();
    }
  }, [config.autoFetch, fetchTrending]);

  return {
    trending,
    isLoading,
    error,
    refresh: fetchTrending,
  };
}

// =============================================================================
// useProviderRecommendations Hook
// Hook for fetching provider recommendations
// =============================================================================

export interface UseProviderRecommendationsOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Number of recommendations (default: 5) */
  limit?: number;
  /** Category filter */
  category?: string;
  /** Location filter */
  location?: { lat: number; lng: number; radius?: number };
}

export interface UseProviderRecommendationsReturn {
  providers: ProviderRecommendation[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * useProviderRecommendations - Hook for fetching recommended providers
 *
 * @param options - Configuration options
 * @returns Provider recommendations state and actions
 */
export function useProviderRecommendations(
  options: UseProviderRecommendationsOptions = {}
): UseProviderRecommendationsReturn {
  const config = {
    autoFetch: options.autoFetch ?? true,
    limit: options.limit ?? 5,
    category: options.category,
    location: options.location,
  };

  const userId = useAuthStore((state) => state.user?.id);

  const [providers, setProviders] = useState<ProviderRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await recommendationApi.getProviderRecommendations({
        userId,
        limit: config.limit,
        category: config.category,
        location: config.location,
      });
      setProviders(results);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch provider recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [userId, config.limit, config.category, config.location]);

  useEffect(() => {
    if (config.autoFetch) {
      fetchProviders();
    }
  }, [config.autoFetch, fetchProviders]);

  return {
    providers,
    isLoading,
    error,
    refresh: fetchProviders,
  };
}

// =============================================================================
// useRecommendationFeedback Hook
// Hook for tracking recommendation interactions
// =============================================================================

export type RecommendationAction = 'view' | 'click' | 'booking' | 'dismiss';

/**
 * useRecommendationFeedback - Hook for tracking recommendation interactions
 *
 * @returns Feedback tracking functions
 */
export function useRecommendationFeedback() {
  const [isTracking, setIsTracking] = useState(false);

  /**
   * Track a recommendation interaction
   */
  const trackFeedback = useCallback(
    async (serviceId: string, action: RecommendationAction, metadata?: Record<string, any>) => {
      setIsTracking(true);
      try {
        await recommendationApi.recordFeedback({
          serviceId,
          action,
          metadata,
        });
      } catch (err) {
        console.error('Failed to track recommendation feedback:', err);
      } finally {
        setIsTracking(false);
      }
    },
    []
  );

  /**
   * Track a click on a recommendation
   */
  const trackClick = useCallback(
    (serviceId: string, position?: number) => {
      return trackFeedback(serviceId, 'click', { position });
    },
    [trackFeedback]
  );

  /**
   * Track a booking from a recommendation
   */
  const trackBooking = useCallback(
    (serviceId: string, bookingId?: string) => {
      return trackFeedback(serviceId, 'booking', { bookingId });
    },
    [trackFeedback]
  );

  /**
   * Track dismissing a recommendation
   */
  const trackDismiss = useCallback(
    (serviceId: string, reason?: string) => {
      return trackFeedback(serviceId, 'dismiss', { reason });
    },
    [trackFeedback]
  );

  return {
    trackFeedback,
    trackClick,
    trackBooking,
    trackDismiss,
    isTracking,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default useRecommendations;
