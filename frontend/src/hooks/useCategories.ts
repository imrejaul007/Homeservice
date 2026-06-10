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

// Subcategory cache (separate from main category cache)
const subcategoryCache = new Map<string, CacheEntry<unknown>>();

// Stats cache
const statsCache = new Map<string, CacheEntry<unknown>>();

// Request deduplication maps
const pendingRequests = new Map<string, Promise<unknown>>();
const pendingSubcategoryRequests = new Map<string, Promise<unknown>>();
const pendingStatsRequests = new Map<string, Promise<unknown>>();

function getCacheKey(featured?: boolean, includeComingSoon?: boolean): string {
  return `categories:${featured}:${includeComingSoon}`;
}

function getSubcategoryCacheKey(categorySlug: string): string {
  return `subcategories:${categorySlug}`;
}

function getStatsCacheKey(): string {
  return 'category-stats';
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

function getSubcategoryCachedData<T>(key: string): T | null {
  const entry = subcategoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CATEGORY_CACHE_TTL) {
    subcategoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setSubcategoryCachedData<T>(key: string, data: T): void {
  // Clean old entries if cache is too large
  if (subcategoryCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of subcategoryCache.entries()) {
      if (now - v.timestamp > CATEGORY_CACHE_TTL) {
        subcategoryCache.delete(k);
      }
    }
  }
  subcategoryCache.set(key, { data, timestamp: Date.now() });
}

function getStatsCachedData<T>(key: string): T | null {
  const entry = statsCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CATEGORY_CACHE_TTL) {
    statsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setStatsCachedData<T>(key: string, data: T): void {
  // Clean old entries if cache is too large
  if (statsCache.size > 10) {
    const now = Date.now();
    for (const [k, v] of statsCache.entries()) {
      if (now - v.timestamp > CATEGORY_CACHE_TTL) {
        statsCache.delete(k);
      }
    }
  }
  statsCache.set(key, { data, timestamp: Date.now() });
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

  const cacheKey = getSubcategoryCacheKey(categorySlug || '');
  const fetchCountRef = useRef(0);

  const fetchSubcategories = useCallback(async () => {
    if (!categorySlug) {
      setState({ subcategories: [], categoryName: '', isLoading: false, error: null });
      return;
    }

    const currentFetch = ++fetchCountRef.current;
    const key = getSubcategoryCacheKey(categorySlug);

    // Check cache first
    const cached = getSubcategoryCachedData<{ subcategories: Subcategory[]; categoryName: string }>(key);
    if (cached) {
      setState({
        subcategories: cached.subcategories,
        categoryName: cached.categoryName,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Request deduplication - wait for existing request if in progress
    const existingRequest = pendingSubcategoryRequests.get(key) as Promise<{ data: { subcategories: Subcategory[]; categoryName: string } }> | undefined;
    if (existingRequest) {
      try {
        const response = await existingRequest;
        if (currentFetch === fetchCountRef.current) {
          const data = { subcategories: response.data.subcategories, categoryName: response.data.categoryName };
          setSubcategoryCachedData(key, data);
          setState({
            subcategories: response.data.subcategories,
            categoryName: response.data.categoryName,
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

    const requestPromise = categoryApi.getSubcategories(categorySlug) as Promise<{ data: { subcategories: Subcategory[]; categoryName: string } }>;
    pendingSubcategoryRequests.set(key, requestPromise);

    try {
      const response = await requestPromise;
      if (currentFetch === fetchCountRef.current) {
        const data = { subcategories: response.data.subcategories, categoryName: response.data.categoryName };
        setSubcategoryCachedData(key, data);
        setState({
          subcategories: response.data.subcategories,
          categoryName: response.data.categoryName,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      if (currentFetch === fetchCountRef.current) {
        setState({
          subcategories: [],
          categoryName: '',
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch subcategories',
        });
      }
    } finally {
      pendingSubcategoryRequests.delete(key);
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
  type StatsItem = {
    _id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
    serviceCount: number;
  };

  const [state, setState] = useState<{
    stats: StatsItem[];
    isLoading: boolean;
    error: string | null;
  }>({
    stats: [],
    isLoading: true,
    error: null,
  });

  const cacheKey = getStatsCacheKey();
  const fetchCountRef = useRef(0);

  const fetchStats = useCallback(async () => {
    const currentFetch = ++fetchCountRef.current;

    // Check cache first
    const cached = getStatsCachedData<StatsItem[]>(cacheKey);
    if (cached) {
      setState({
        stats: cached,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Request deduplication - wait for existing request if in progress
    const existingRequest = pendingStatsRequests.get(cacheKey) as Promise<{ data: { categories: StatsItem[] } }> | undefined;
    if (existingRequest) {
      try {
        const response = await existingRequest;
        if (currentFetch === fetchCountRef.current) {
          const stats = response.data.categories;
          setStatsCachedData(cacheKey, stats);
          setState({
            stats,
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

    const requestPromise = categoryApi.getCategoryStats() as Promise<{ data: { categories: StatsItem[] } }>;
    pendingStatsRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      if (currentFetch === fetchCountRef.current) {
        const stats = response.data.categories;
        setStatsCachedData(cacheKey, stats);
        setState({
          stats,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      if (currentFetch === fetchCountRef.current) {
        setState({
          stats: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch category stats',
        });
      }
    } finally {
      pendingStatsRequests.delete(cacheKey);
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
