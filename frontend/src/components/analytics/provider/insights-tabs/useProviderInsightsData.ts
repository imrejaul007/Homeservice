import { useState, useEffect, useRef, useCallback } from 'react';
import { providerInsightsApi } from '../../../../services/providerInsightsApi';
import type {
  Period,
  ProviderInsightsData,
  ScheduleOptimization,
  ProviderCancellationStats,
  BookingCancellationPrediction,
  RevenueOptimizationTip,
  PreventionRecommendation,
} from '../../../../services/providerInsightsApi';
import { socketService } from '../../../../services/socket';

export type InsightsRefreshMode = 'loading' | 'refreshing' | 'silent';

const MAX_POLL_COUNT = 10;
const POLL_INTERVAL = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

export interface UseProviderInsightsDataResult {
  insights: ProviderInsightsData | null;
  scheduleOptimization: ScheduleOptimization | null;
  cancellationStats: ProviderCancellationStats | null;
  upcomingCancellations: BookingCancellationPrediction[];
  optimizationTips: RevenueOptimizationTip[];
  preventionRecommendations: PreventionRecommendation[];
  loading: boolean;
  refreshing: boolean;
  loadError: string | null;
  refresh: (mode?: InsightsRefreshMode) => void;
}

export function useProviderInsightsData(
  period: Period,
  providerId?: string,
  options?: { enablePolling?: boolean },
): UseProviderInsightsDataResult {
  const enablePolling = options?.enablePolling ?? true;

  const [insights, setInsights] = useState<ProviderInsightsData | null>(null);
  const [scheduleOptimization, setScheduleOptimization] = useState<ScheduleOptimization | null>(null);
  const [cancellationStats, setCancellationStats] = useState<ProviderCancellationStats | null>(null);
  const [upcomingCancellations, setUpcomingCancellations] = useState<BookingCancellationPrediction[]>([]);
  const [optimizationTips, setOptimizationTips] = useState<RevenueOptimizationTip[]>([]);
  const [preventionRecommendations, setPreventionRecommendations] = useState<PreventionRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingCountRef = useRef(0);

  const fetchData = useCallback(
    async (refreshMode: InsightsRefreshMode = 'loading') => {
      if (refreshMode === 'refreshing') setRefreshing(true);
      else if (refreshMode === 'loading') setLoading(true);

      let retryCount = 0;

      const attemptFetch = async (): Promise<boolean> => {
        try {
          const results = await Promise.allSettled([
            providerInsightsApi.getInsights(period),
            providerInsightsApi.getOptimalSchedule(),
            providerInsightsApi.getCancellationStats(period),
            providerInsightsApi.getUpcomingCancellations(7),
            providerInsightsApi.getOptimizationTips(),
            providerInsightsApi.getPreventionRecommendations(),
          ]);

          const [
            insightsResult,
            scheduleResult,
            cancellationResult,
            upcomingResult,
            tipsResult,
            preventionResult,
          ] = results;

          if (insightsResult.status === 'fulfilled') {
            setInsights(insightsResult.value);
          }

          if (scheduleResult.status === 'fulfilled') {
            setScheduleOptimization(scheduleResult.value);
          }

          if (cancellationResult.status === 'fulfilled') {
            setCancellationStats(cancellationResult.value);
          }

          if (upcomingResult.status === 'fulfilled') {
            setUpcomingCancellations(upcomingResult.value);
          }

          if (tipsResult.status === 'fulfilled') {
            setOptimizationTips(tipsResult.value);
          }

          if (preventionResult.status === 'fulfilled') {
            setPreventionRecommendations(preventionResult.value);
          }

          const successCount = results.filter((r) => r.status === 'fulfilled').length;
          if (insightsResult.status === 'rejected') {
            setLoadError(
              insightsResult.reason instanceof Error
                ? insightsResult.reason.message
                : 'Failed to load insights',
            );
          } else {
            setLoadError(null);
          }

          return successCount > 0;
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load insights');
          return false;
        }
      };

      let success = await attemptFetch();
      while (!success && retryCount < MAX_RETRIES) {
        retryCount++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * retryCount));
        success = await attemptFetch();
      }

      if (!success) {
        setLoadError((prev) => prev || 'Unable to load insights. Please try again.');
      }

      pollingCountRef.current = 0;
      setLoading(false);
      setRefreshing(false);
    },
    [period],
  );

  const refresh = useCallback(
    (mode: InsightsRefreshMode = 'refreshing') => {
      void fetchData(mode);
    },
    [fetchData],
  );

  useEffect(() => {
    void fetchData('loading');

    const unsubscribers: (() => void)[] = [];

    const unsubInsightsUpdated = socketService.onInsightsUpdated((data) => {
      if (data.providerId === providerId) {
        void fetchData('silent');
      }
    });
    unsubscribers.push(unsubInsightsUpdated);

    const unsubBookingStatus = socketService.onBookingStatusChanged((data) => {
      if (data.status === 'completed') {
        void fetchData('silent');
      }
    });
    unsubscribers.push(unsubBookingStatus);

    const unsubReviewReceived = socketService.onReviewReceived(() => {
      void fetchData('silent');
    });
    unsubscribers.push(unsubReviewReceived);

    const unsubWithdrawalApproved = socketService.onWithdrawalApproved(() => {
      void fetchData('silent');
    });
    unsubscribers.push(unsubWithdrawalApproved);

    if (enablePolling) {
      pollingIntervalRef.current = setInterval(() => {
        if (pollingCountRef.current >= MAX_POLL_COUNT) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }
        pollingCountRef.current++;
        void fetchData('silent');
      }, POLL_INTERVAL);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [period, providerId, enablePolling, fetchData]);

  return {
    insights,
    scheduleOptimization,
    cancellationStats,
    upcomingCancellations,
    optimizationTips,
    preventionRecommendations,
    loading,
    refreshing,
    loadError,
    refresh,
  };
}
