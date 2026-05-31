import { useState, useEffect, useCallback, useRef } from 'react';
import { categoryApi } from '@/services/categoryApi';
import type { Category, CategoryWithServices, Subcategory } from '@/types/category';

interface UseCategoriesState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
}

interface UseCategoryState {
  category: CategoryWithServices | null;
  isLoading: boolean;
  error: string | null;
}

// In-memory cache for categories (MAJOR PERFORMANCE FIX)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CATEGORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const categoryCache = new Map<string, CacheEntry<unknown>>();

// Request deduplication map
const pendingRequests = new Map<string, Promise<unknown>>();

function getCacheKey(featured?: boolean, includeComingSoon?: boolean): string {
  return `categories:${featured}:${includeComingSoon}`;
}

function getCachedData<T>(key: string): T | null {
  const entry = categoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CATEGORY_CACHE_TTL) {
    categoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedData<T>(key: string, data: T): void {
  // Clean old entries if cache is too large
  if (categoryCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of categoryCache.entries()) {
      if (now - v.timestamp > CATEGORY_CACHE_TTL) {
        categoryCache.delete(k);
      }
    }
  }
  categoryCache.set(key, { data, timestamp: Date.now() });
}

// Hook to fetch all categories
export function useCategories(featured?: boolean, includeComingSoon?: boolean): UseCategoriesState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseCategoriesState>({
    categories: [],
    isLoading: true,
    error: null,
  });

  const cacheKey = getCacheKey(featured, includeComingSoon);
  const fetchCountRef = useRef(0);

  const fetchCategories = useCallback(async () => {
    const currentFetch = ++fetchCountRef.current;

    // Check cache first
    const cached = getCachedData<Category[]>(cacheKey);
    if (cached) {
      setState({
        categories: cached,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Request deduplication - wait for existing request if in progress
    const existingRequest = pendingRequests.get(cacheKey) as Promise<{ data: { categories: Category[] } }> | undefined;
    if (existingRequest) {
      try {
        const response = await existingRequest;
        if (currentFetch === fetchCountRef.current) {
          const categories = response.data.categories;
          setCachedData(cacheKey, categories);
          setState({
            categories,
            isLoading: false,
            error: null,
          });
        }
        return;
      } catch {
        // If existing request failed, continue to fetch
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const requestPromise = categoryApi.getCategories(featured, includeComingSoon) as Promise<{ data: { categories: Category[] } }>;
    pendingRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      if (currentFetch === fetchCountRef.current) {
        const categories = response.data.categories;
        setCachedData(cacheKey, categories);
        setState({
          categories,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      if (currentFetch === fetchCountRef.current) {
        setState({
          categories: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch categories',
        });
      }
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }, [featured, includeComingSoon]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    ...state,
    refetch: fetchCategories,
  };
}

// Hook to fetch a single category by slug
export function useCategory(slug: string | undefined): UseCategoryState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseCategoryState>({
    category: null,
    isLoading: true,
    error: null,
  });

  const fetchCategory = useCallback(async () => {
    if (!slug) {
      setState({ category: null, isLoading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await categoryApi.getCategoryBySlug(slug);
      setState({
        category: response.data.category,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        category: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch category',
      });
    }
  }, [slug]);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  return {
    ...state,
    refetch: fetchCategory,
  };
}

// Hook to fetch subcategories for a category
export function useSubcategories(categorySlug: string | undefined): {
  subcategories: Subcategory[];
  categoryName: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [state, setState] = useState<{
    subcategories: Subcategory[];
    categoryName: string;
    isLoading: boolean;
    error: string | null;
  }>({
    subcategories: [],
    categoryName: '',
    isLoading: true,
    error: null,
  });

  const fetchSubcategories = useCallback(async () => {
    if (!categorySlug) {
      setState({ subcategories: [], categoryName: '', isLoading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await categoryApi.getSubcategories(categorySlug);
      setState({
        subcategories: response.data.subcategories,
        categoryName: response.data.categoryName,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        subcategories: [],
        categoryName: '',
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch subcategories',
      });
    }
  }, [categorySlug]);

  useEffect(() => {
    fetchSubcategories();
  }, [fetchSubcategories]);

  return {
    ...state,
    refetch: fetchSubcategories,
  };
}

// Hook for category stats (with service counts)
export function useCategoryStats(): {
  stats: Array<{
    _id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
    serviceCount: number;
  }>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [state, setState] = useState<{
    stats: Array<{
      _id: string;
      name: string;
      slug: string;
      icon: string;
      color: string;
      serviceCount: number;
    }>;
    isLoading: boolean;
    error: string | null;
  }>({
    stats: [],
    isLoading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await categoryApi.getCategoryStats();
      setState({
        stats: response.data.categories,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        stats: [],
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch category stats',
      });
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    ...state,
    refetch: fetchStats,
  };
}

export default useCategories;
