/**
 * useAdminData - Shared hook for admin dashboard data fetching
 *
 * Provides common patterns used across admin components:
 * - Loading states
 * - Error handling
 * - Data refresh
 * - Search/filter support
 *
 * @example
 * ```tsx
 * const { data, loading, error, refresh } = useAdminData<Stats>(
 *   '/admin/stats',
 *   { initialLoading: true }
 * );
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface UseAdminDataOptions {
  /** Show loading state on initial mount */
  initialLoading?: boolean;
  /** Auto-refresh interval in ms (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Transform data before setting state */
  transform?: (data: unknown) => unknown;
}

export interface UseAdminDataResult<T> {
  /** Fetched data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data manually */
  refresh: () => Promise<void>;
  /** Set data directly */
  setData: (data: T | null) => void;
}

/**
 * Hook for fetching admin data with common patterns
 */
export function useAdminData<T>(
  endpoint: string,
  options: UseAdminDataOptions = {}
): UseAdminDataResult<T> {
  const { initialLoading = true, refreshInterval = 0, transform } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      // api.get returns the unwrapped response data
      const response = await api.get(endpoint);
      setData(transform ? (transform(response) as T) : (response as T));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error(`Admin data fetch error [${endpoint}]:`, err);
    }
  }, [endpoint, transform]);

  // Initial fetch
  useEffect(() => {
    if (initialLoading) {
      fetchData();
    }
  }, [fetchData, initialLoading]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
    setData,
  };
}

/**
 * useAdminStats - Hook specifically for admin dashboard stats
 */
export function useAdminStats<T>(endpoint: string, refreshInterval = 30000) {
  return useAdminData<T>(endpoint, { refreshInterval });
}
