import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import type {
  CategoriesResponse,
  CategoryResponse,
  SubcategoriesResponse,
  CategoryStatsResponse,
  CategorySearchResponse,
} from '@/types/category';

const api = axios.create({
  baseURL: `${API_BASE_URL}/categories`,
  timeout: 10000,
});

export const categoryApi = {
  // Get all master categories (with optional featured filter)
  getCategories: async (featured?: boolean, includeComingSoon?: boolean): Promise<CategoriesResponse> => {
    const params: Record<string, string> = {};
    if (featured !== undefined) params.featured = String(featured);
    if (includeComingSoon) params.includeComingSoon = 'true';
    const response = await api.get('/', { params });
    return response.data;
  },

  // Get featured categories only
  getFeaturedCategories: async (): Promise<CategoriesResponse> => {
    return categoryApi.getCategories(true);
  },

  // Get category by slug with full details
  getCategoryBySlug: async (slug: string): Promise<CategoryResponse> => {
    const response = await api.get(`/${slug}`);
    return response.data;
  },

  // Get subcategories for a category
  getSubcategories: async (categorySlug: string): Promise<SubcategoriesResponse> => {
    const response = await api.get(`/${categorySlug}/subcategories`);
    return response.data;
  },

  // Get services under a category
  getCategoryServices: async (
    categorySlug: string,
    options?: {
      subcategory?: string;
      page?: number;
      limit?: number;
      sortBy?: 'popularity' | 'price' | 'price_desc' | 'rating' | 'newest';
    }
  ): Promise<any> => {
    const response = await api.get(`/${categorySlug}/services`, { params: options });
    return response.data;
  },

  // Get categories with service counts (for filtering UI)
  getCategoryStats: async (): Promise<CategoryStatsResponse> => {
    const response = await api.get('/stats');
    return response.data;
  },

  // Search categories and subcategories
  searchCategories: async (query: string): Promise<CategorySearchResponse> => {
    const response = await api.get('/search', { params: { q: query } });
    return response.data;
  },
};

export default categoryApi;
