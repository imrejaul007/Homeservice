import { api } from './api';
import type { Category, Subcategory } from '../types/category';

export interface CategoryFormPayload {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  isFeatured: boolean;
  comingSoon: boolean;
  imageUrl?: string;
  isActive?: boolean;
}

export interface SubcategoryFormPayload {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface AdminCategoryListResult {
  categories: Category[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface AdminCategoryStats {
  stats: {
    total: number;
    active: number;
    featured: number;
    withSubcategories: number;
    inactive: number;
  };
  topCategories: Array<{ name: string; serviceCount: number }>;
}

function normalizeCategory(raw: Record<string, unknown>): Category {
  const subs = (raw.subcategories as Subcategory[] | undefined) ?? [];
  return {
    ...(raw as unknown as Category),
    subcategories: subs,
    subcategoryCount:
      typeof raw.subcategoryCount === 'number' ? raw.subcategoryCount : subs.length,
  };
}

export const adminCategoryApi = {
  list: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    isFeatured?: boolean;
  }): Promise<AdminCategoryListResult> => {
    const response = await api.get('/admin/categories', {
      params: { page: 1, limit: 200, ...params },
    });
    const data = response.data.data;
    const categories = (data.categories ?? []).map((c: Record<string, unknown>) =>
      normalizeCategory(c)
    );
    return { categories, pagination: data.pagination };
  },

  getStats: async (): Promise<AdminCategoryStats> => {
    const response = await api.get('/admin/categories/stats');
    return response.data.data;
  },

  getById: async (id: string): Promise<Category> => {
    const response = await api.get(`/admin/categories/${id}`);
    return normalizeCategory(response.data.data.category);
  },

  create: async (payload: CategoryFormPayload) => {
    const response = await api.post('/admin/categories', payload);
    return response.data;
  },

  update: async (id: string, payload: Partial<CategoryFormPayload>) => {
    const response = await api.patch(`/admin/categories/${id}`, payload);
    return response.data;
  },

  delete: async (id: string, reason?: string) => {
    const response = await api.delete(`/admin/categories/${id}`, {
      data: reason ? { reason } : undefined,
    });
    return response.data;
  },

  toggleFeatured: async (id: string) => {
    const response = await api.post(`/admin/categories/${id}/featured`);
    return response.data;
  },

  addSubcategory: async (categoryId: string, payload: SubcategoryFormPayload) => {
    const response = await api.post(`/admin/categories/${categoryId}/subcategories`, payload);
    return response.data;
  },

  updateSubcategory: async (
    categorySlug: string,
    subSlug: string,
    payload: SubcategoryFormPayload
  ) => {
    const response = await api.put(
      `/categories/${categorySlug}/subcategories/${subSlug}`,
      payload
    );
    return response.data;
  },

  deleteSubcategory: async (categorySlug: string, subSlug: string) => {
    const response = await api.delete(
      `/categories/${categorySlug}/subcategories/${subSlug}`
    );
    return response.data;
  },
};
