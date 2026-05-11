import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import type {
  ProviderResponse,
  ProvidersByCategoryResponse,
  ProvidersBySubcategoryResponse,
  FeaturedProvidersResponse,
} from '@/types/provider';

const api = axios.create({
  baseURL: `${API_BASE_URL}/providers`,
  timeout: 10000,
});

export interface GetProvidersOptions {
  page?: number;
  limit?: number;
  sortBy?: 'rating' | 'price' | 'price_desc' | 'newest' | 'popularity';
  minRating?: number;
}

export const providerApi = {
  /**
   * Get full provider profile by ID
   * GET /api/providers/:id
   */
  getProviderById: async (id: string): Promise<ProviderResponse> => {
    const response = await api.get(`/${id}`);
    return response.data;
  },

  /**
   * Get providers by category slug
   * GET /api/providers/category/:slug
   */
  getProvidersByCategory: async (
    categorySlug: string,
    options?: GetProvidersOptions
  ): Promise<ProvidersByCategoryResponse> => {
    const response = await api.get(`/category/${categorySlug}`, { params: options });
    return response.data;
  },

  /**
   * Get providers by subcategory
   * GET /api/providers/subcategory/:categorySlug/:subcategorySlug
   */
  getProvidersBySubcategory: async (
    categorySlug: string,
    subcategorySlug: string,
    options?: GetProvidersOptions
  ): Promise<ProvidersBySubcategoryResponse> => {
    const response = await api.get(`/subcategory/${categorySlug}/${subcategorySlug}`, {
      params: options,
    });
    return response.data;
  },

  /**
   * Get featured providers
   * GET /api/providers/featured
   */
  getFeaturedProviders: async (limit?: number): Promise<FeaturedProvidersResponse> => {
    const response = await api.get('/featured', { params: { limit } });
    return response.data;
  },
};

export default providerApi;
