/**
 * Package API Service
 * Calls backend package/endpoints for service packages
 */
import { api } from './api';
import type {
  ServicePackage,
  Feature,
  PackageFilters,
  PackageResponse,
  PackageStats,
} from '../types/subscription.types';
import {
  isFeatureObject,
  isFeatureString,
  getFeatureText,
  isFeatureIncluded,
  normalizeFeatures,
} from '../types/subscription.types';

// Re-export types for backwards compatibility
export type {
  ServicePackage,
  Feature,
  PackageFilters,
  PackageResponse,
  PackageStats,
};
export {
  isFeatureObject,
  isFeatureString,
  getFeatureText,
  isFeatureIncluded,
  normalizeFeatures,
};

// =============================================================================
// API Client
// =============================================================================

export const packageApi = {
  /**
   * Get all packages with optional filtering
   */
  getPackages: async (filters?: PackageFilters): Promise<{
    packages: ServicePackage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    try {
      const response = await api.get('/packages', { params: filters });
      const result = response.data.data;
      return {
        packages: result.packages || [],
        total: result.pagination?.total || 0,
        page: result.pagination?.page || 1,
        limit: result.pagination?.limit || 10,
        totalPages: result.pagination?.pages || 1,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch packages';
      console.error('[packageApi] getPackages error:', message);
      throw new Error(message);
    }
  },

  /**
   * Get a single package by ID
   */
  getPackage: async (packageId: string): Promise<{ package: ServicePackage }> => {
    try {
      const response = await api.get(`/packages/${packageId}`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch package';
      console.error('[packageApi] getPackage error:', message);
      throw new Error(message);
    }
  },

  /**
   * Get featured packages
   */
  getFeaturedPackages: async (limit: number = 6): Promise<ServicePackage[]> => {
    try {
      const response = await api.get('/packages/featured', { params: { limit } });
      return response.data.data.packages || [];
    } catch (error: unknown) {
      console.error('[packageApi] getFeaturedPackages error:', error);
      throw new Error('Failed to fetch featured packages');
    }
  },

  /**
   * Get package stats
   */
  getPackageStats: async (): Promise<PackageStats> => {
    try {
      const response = await api.get('/packages/stats');
      return response.data.data;
    } catch (error: unknown) {
      console.error('[packageApi] getPackageStats error:', error);
      throw new Error('Failed to fetch package stats');
    }
  },

  /**
   * Get packages by category
   */
  getPackagesByCategory: async (category: string, limit?: number): Promise<ServicePackage[]> => {
    try {
      const response = await api.get(`/packages/category/${category}`, { params: { limit } });
      return response.data.data.packages || [];
    } catch (error: unknown) {
      console.error('[packageApi] getPackagesByCategory error:', error);
      throw new Error(`Failed to fetch packages for category: ${category}`);
    }
  },

  /**
   * Search packages
   */
  searchPackages: async (query: string, filters?: PackageFilters): Promise<ServicePackage[]> => {
    try {
      const response = await api.get('/packages/search', {
        params: { q: query, ...filters },
      });
      return response.data.data.packages || [];
    } catch (error: unknown) {
      console.error('[packageApi] searchPackages error:', error);
      throw new Error(`Failed to search packages for query: ${query}`);
    }
  },
};

export default packageApi;
