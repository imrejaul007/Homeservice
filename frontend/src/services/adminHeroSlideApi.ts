import { api } from './api';

export interface HeroSlideFormPayload {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaLink: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface HeroSlide {
  _id: string;
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaLink: string;
  sortOrder: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminHeroSlideListResult {
  slides: HeroSlide[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ReorderPayload {
  slides: Array<{ id: string; sortOrder: number }>;
}

export const adminHeroSlideApi = {
  /**
   * Get all hero slides for admin management
   */
  list: async (params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<AdminHeroSlideListResult> => {
    const response = await api.get('/admin/hero-slides', {
      params: { page: 1, limit: 100, ...params },
    });
    return response.data.data;
  },

  /**
   * Get a single hero slide by ID
   */
  getById: async (id: string): Promise<HeroSlide> => {
    const response = await api.get(`/admin/hero-slides/${id}`);
    return response.data.data;
  },

  /**
   * Create a new hero slide
   */
  create: async (payload: HeroSlideFormPayload): Promise<HeroSlide> => {
    const response = await api.post('/admin/hero-slides', payload);
    return response.data.data;
  },

  /**
   * Update an existing hero slide
   */
  update: async (id: string, payload: Partial<HeroSlideFormPayload>): Promise<HeroSlide> => {
    const response = await api.put(`/admin/hero-slides/${id}`, payload);
    return response.data.data;
  },

  /**
   * Delete a hero slide
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/hero-slides/${id}`);
  },

  /**
   * Reorder hero slides (change sort order) - uses batch reorder endpoint
   */
  reorder: async (payload: ReorderPayload): Promise<void> => {
    await api.post('/admin/hero-slides/reorder-all', payload);
  },

  /**
   * Toggle hero slide active status
   */
  toggleActive: async (id: string): Promise<HeroSlide> => {
    const response = await api.patch(`/admin/hero-slides/${id}/toggle`);
    return response.data.data;
  },
};

export default adminHeroSlideApi;
