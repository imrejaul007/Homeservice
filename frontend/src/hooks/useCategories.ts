import { useState, useEffect, useCallback } from 'react';
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

// Hook to fetch all categories
export function useCategories(featured?: boolean, includeComingSoon?: boolean) {
  const [state, setState] = useState<UseCategoriesState>({
    categories: [],
    isLoading: true,
    error: null,
  });

  const fetchCategories = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await categoryApi.getCategories(featured, includeComingSoon);
      setState({
        categories: response.data.categories,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        categories: [],
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch categories',
      });
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
export function useCategory(slug: string | undefined) {
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
export function useSubcategories(categorySlug: string | undefined) {
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
export function useCategoryStats() {
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
