import { useState, useEffect, useCallback } from 'react';
import { providerApi } from '@/services/providerApi';
import type { GetProvidersOptions } from '@/services/providerApi';
import type { Provider, ProviderCard } from '@/types/provider';
import { cacheManager } from '@/lib/CacheManager';

// ===================================
// Hook to fetch single provider by ID
// ===================================

interface UseProviderState {
  provider: Provider | null;
  isLoading: boolean;
  error: string | null;
}

// Cache TTL for provider data (2 minutes)
const PROVIDER_CACHE_TTL = 2 * 60 * 1000;

/** Bust cached provider profile (e.g. after provider updates their profile) */
export function invalidateProviderCache(id: string): void {
  cacheManager.delete(`provider:${id}`);
}

export function useProvider(id: string | undefined): UseProviderState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseProviderState>({
    provider: null,
    isLoading: true,
    error: null,
  });

  const fetchProvider = useCallback(async () => {
    if (!id) {
      setState({ provider: null, isLoading: false, error: null });
      return;
    }

    // Check client-side cache first (MAJOR PERFORMANCE FIX)
    const cacheKey = `provider:${id}`;
    const cachedProvider = cacheManager.get<Provider>(cacheKey);
    if (cachedProvider) {
      setState({
        provider: cachedProvider,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await providerApi.getProviderById(id);
      const normalizedProvider = {
        ...response.data.provider,
        _id: response.data.provider._id ?? (response.data.provider as { id?: string }).id ?? id,
      };
      cacheManager.set(cacheKey, normalizedProvider, PROVIDER_CACHE_TTL);
      setState({
        provider: normalizedProvider,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        provider: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch provider',
      });
    }
  }, [id]);

  useEffect(() => {
    fetchProvider();
  }, [fetchProvider]);

  return {
    ...state,
    refetch: fetchProvider,
  };
}

// ===================================
// Hook to fetch providers by category
// ===================================

interface UseProvidersByCategoryState {
  category: {
    _id: string;
    name: string;
    slug: string;
    description: string;
    icon: string;
    color: string;
  } | null;
  providers: ProviderCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export function useProvidersByCategory(
  categorySlug: string | undefined,
  options?: GetProvidersOptions
): UseProvidersByCategoryState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseProvidersByCategoryState>({
    category: null,
    providers: [],
    pagination: null,
    isLoading: true,
    error: null,
  });

  const fetchProviders = useCallback(async () => {
    if (!categorySlug) {
      setState({
        category: null,
        providers: [],
        pagination: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await providerApi.getProvidersByCategory(categorySlug, options);
      setState({
        category: response.data.category,
        providers: response.data.providers,
        pagination: response.data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        category: null,
        providers: [],
        pagination: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch providers',
      });
    }
  }, [categorySlug, options?.page, options?.limit, options?.sortBy, options?.minRating]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    ...state,
    refetch: fetchProviders,
  };
}

// ===================================
// Hook to fetch providers by subcategory
// ===================================

interface UseProvidersBySubcategoryState {
  category: {
    _id: string;
    name: string;
    slug: string;
  } | null;
  subcategory: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
  } | null;
  providers: ProviderCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export function useProvidersBySubcategory(
  categorySlug: string | undefined,
  subcategorySlug: string | undefined,
  options?: GetProvidersOptions
): UseProvidersBySubcategoryState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseProvidersBySubcategoryState>({
    category: null,
    subcategory: null,
    providers: [],
    pagination: null,
    isLoading: true,
    error: null,
  });

  const fetchProviders = useCallback(async () => {
    if (!categorySlug || !subcategorySlug) {
      setState({
        category: null,
        subcategory: null,
        providers: [],
        pagination: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await providerApi.getProvidersBySubcategory(
        categorySlug,
        subcategorySlug,
        options
      );
      setState({
        category: response.data.category,
        subcategory: response.data.subcategory,
        providers: response.data.providers,
        pagination: response.data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        category: null,
        subcategory: null,
        providers: [],
        pagination: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch providers',
      });
    }
  }, [categorySlug, subcategorySlug, options?.page, options?.limit, options?.sortBy]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    ...state,
    refetch: fetchProviders,
  };
}

// ===================================
// Hook to fetch featured providers
// ===================================

interface UseFeaturedProvidersState {
  providers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    businessName: string;
    tagline: string;
    profilePhoto: string;
    coverPhoto: string;
    isVerified: boolean;
    location: {
      city: string;
      state: string;
    } | null;
    rating: number;
    reviewCount: number;
    specializations: string[];
    servicesCount: number;
  }>;
  isLoading: boolean;
  error: string | null;
}

export function useFeaturedProviders(limit?: number): UseFeaturedProvidersState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseFeaturedProvidersState>({
    providers: [],
    isLoading: true,
    error: null,
  });

  const fetchProviders = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await providerApi.getFeaturedProviders(limit);
      // Normalize providers to ensure each has an 'id' property (API returns '_id')
      const normalizedProviders = response.data.providers.map((p: any) => ({
        ...p,
        id: p.id ?? p._id,
      }));
      setState({
        providers: normalizedProviders,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        providers: [],
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch featured providers',
      });
    }
  }, [limit]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    ...state,
    refetch: fetchProviders,
  };
}

export default useProvider;
