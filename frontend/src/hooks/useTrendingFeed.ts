import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { homeTrendingApi } from '../services/homeTrendingApi';
import type { TrendingFeedItem, TrendingFeedItemType, TrendingFeedMetadata } from '../types/trendingFeed';
import { useLocationStore } from '../stores/locationStore';
import analytics from '../services/product/AnalyticsService';

export interface UseTrendingFeedOptions {
  limit?: number;
  minItems?: number;
  period?: '7d' | '30d';
  types?: TrendingFeedItemType[];
  autoFetch?: boolean;
}

export interface UseTrendingFeedReturn {
  items: TrendingFeedItem[];
  metadata: TrendingFeedMetadata | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTrendingFeed(options: UseTrendingFeedOptions = {}): UseTrendingFeedReturn {
  const {
    limit = 8,
    minItems = 4,
    period = '7d',
    types,
    autoFetch = true,
  } = options;

  const { selectedCity, currentLocation } = useLocationStore();
  const [items, setItems] = useState<TrendingFeedItem[]>([]);
  const [metadata, setMetadata] = useState<TrendingFeedMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFeed = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const lat = currentLocation?.coordinates?.latitude;
      const lng = currentLocation?.coordinates?.longitude;

      const response = await homeTrendingApi.getTrendingFeed({
        limit,
        minItems,
        period,
        types,
        city: selectedCity?.name,
        lat,
        lng,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setItems(response.data.items);
      setMetadata(response.data.metadata);

      analytics.track('trending_feed_loaded', {
        total: response.data.items.length,
        curated: response.data.metadata.counts.curated,
        experience: response.data.metadata.counts.experience,
        service: response.data.metadata.counts.service,
        fallback: response.data.metadata.counts.fallback,
        used_fallback: response.data.metadata.usedFallback,
      });

      if (response.data.items.length === 0) {
        analytics.track('trending_feed_empty', { city: selectedCity?.name || 'all' });
      }
    } catch (err) {
      if (axios.isCancel(err)) return;
      if (err instanceof Error && err.name === 'AbortError') return;

      const message = err instanceof Error ? err.message : 'Failed to load trending feed';
      setError(message);
      analytics.track('trending_feed_error', { message });
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [limit, minItems, period, types, selectedCity?.name, currentLocation?.coordinates?.latitude, currentLocation?.coordinates?.longitude]);

  useEffect(() => {
    if (!autoFetch) return undefined;

    fetchFeed();

    return () => {
      abortRef.current?.abort();
    };
  }, [autoFetch, fetchFeed]);

  return {
    items,
    metadata,
    isLoading,
    error,
    refresh: fetchFeed,
  };
}
