import { api } from './api';
import type { CuratedTrend } from '../types/trendingFeed';

export interface CuratedTrendInput {
  title: string;
  subtitle: string;
  imageUrl: string;
  videoUrl?: string;
  linkType: CuratedTrend['linkType'];
  linkTarget: string;
  categoryLabel: string;
  metricOverride?: string;
  sortOrder?: number;
  isActive?: boolean;
  isPinned?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface CuratedTrendsListResponse {
  success: boolean;
  data: {
    items: CuratedTrend[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const curatedTrendApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<CuratedTrendsListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));

    const query = searchParams.toString();
    const url = query ? `/admin/curated-trends?${query}` : '/admin/curated-trends';
    const response = await api.get<CuratedTrendsListResponse>(url);
    return response.data;
  },

  async create(data: CuratedTrendInput) {
    const response = await api.post('/admin/curated-trends', data);
    return response.data;
  },

  async update(id: string, data: Partial<CuratedTrendInput>) {
    const response = await api.put(`/admin/curated-trends/${id}`, data);
    return response.data;
  },

  async remove(id: string) {
    const response = await api.delete(`/admin/curated-trends/${id}`);
    return response.data;
  },

  async reorder(items: Array<{ id: string; sortOrder: number }>) {
    const response = await api.patch('/admin/curated-trends/reorder', { items });
    return response.data;
  },
};
