import { api } from './api';
import type { TrendingFeedItemType, TrendingFeedResponse } from '../types/trendingFeed';

export interface GetTrendingFeedParams {
  limit?: number;
  minItems?: number;
  city?: string;
  lat?: number;
  lng?: number;
  period?: '7d' | '30d';
  types?: TrendingFeedItemType[];
  signal?: AbortSignal;
}

export const homeTrendingApi = {
  async getTrendingFeed(params: GetTrendingFeedParams = {}): Promise<TrendingFeedResponse> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.minItems) searchParams.set('minItems', String(params.minItems));
    if (params.city) searchParams.set('city', params.city);
    if (params.lat != null) searchParams.set('lat', String(params.lat));
    if (params.lng != null) searchParams.set('lng', String(params.lng));
    if (params.period) searchParams.set('period', params.period);
    if (params.types?.length) searchParams.set('types', params.types.join(','));

    const query = searchParams.toString();
    const url = query ? `/home/trending-feed?${query}` : '/home/trending-feed';
    const response = await api.get<TrendingFeedResponse>(url, { signal: params.signal });
    return response.data;
  },

  async trackClick(itemId: string): Promise<void> {
    await api.post(`/home/trending-feed/${encodeURIComponent(itemId)}/click`);
  },
};
