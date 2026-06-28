import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { searchApi } from '../services/searchApi';
import type { SearchFilters, Service, Suggestion } from '../types/search';

/**
 * FIX P1: Sync filter state to URL for persistence across page refresh
 */
const syncFiltersToUrl = (filters: Partial<SearchFilters>) => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const params = url.searchParams;

  // Map filter keys to URL param names
  const paramMapping: Record<string, string> = {
    q: 'q',
    category: 'category',
    subcategory: 'subcategory',
    minPrice: 'minPrice',
    maxPrice: 'maxPrice',
    minRating: 'minRating',
    sortBy: 'sort',
    page: 'page',
    limit: 'limit',
  };

  // Update URL params for each filter
  Object.entries(filters).forEach(([key, value]) => {
    const paramName = paramMapping[key] || key;
    if (value !== undefined && value !== null && value !== '') {
      params.set(paramName, String(value));
    } else {
      params.delete(paramName);
    }
  });

  // Replace URL without navigation
  window.history.replaceState({}, '', url.toString());
};

/**
 * FIX P1: Initialize filters from URL params on load
 */
const getFiltersFromUrl = (): Partial<SearchFilters> => {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const filters: Partial<SearchFilters> = {};

  const urlParamMapping: Record<string, keyof SearchFilters> = {
    q: 'q',
    category: 'category',
    subcategory: 'subcategory',
    minPrice: 'minPrice',
    maxPrice: 'maxPrice',
    minRating: 'minRating',
    sort: 'sortBy',
    page: 'page',
    limit: 'limit',
  };

  Object.entries(urlParamMapping).forEach(([param, filterKey]) => {
    const value = params.get(param);
    if (value !== null) {
      // Parse numbers
      if (filterKey === 'minPrice' || filterKey === 'maxPrice' || filterKey === 'minRating' || filterKey === 'page' || filterKey === 'limit') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          (filters as any)[filterKey] = num;
        }
      } else {
        (filters as any)[filterKey] = value;
      }
    }
  });

  return filters;
};

interface SearchState {
  // Search data
  services: Service[];
  totalCount: number;
  currentPage: number;
  totalPages: number;

  // Search filters
  filters: SearchFilters;
  suggestions: Suggestion[];

  // UI state
  isLoading: boolean;
  isLoadingSuggestions: boolean;
  error: string | null;

  // Search history
  searchHistory: string[];
  recentSearches: string[];

  // Trending/Popular data
  trendingServices: Service[];
  popularServices: Service[];

  // FIX P2: Abort controller for cancelling requests
  abortController: AbortController | null;

  // Actions
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  performSearch: () => Promise<void>;
  searchServices: (filters: SearchFilters) => Promise<void>;
  getSearchSuggestions: (query: string) => Promise<void>;
  getTrendingServices: (timeframe?: string) => Promise<void>;
  getPopularServices: (category?: string) => Promise<void>;
  getServicesByCategory: (category: string, additionalFilters?: Partial<SearchFilters>) => Promise<void>;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  invalidateProviderCache: (providerId?: string) => void;
  invalidateServiceCache: (serviceId?: string) => void;
  cancelCurrentRequest: () => void;
}

// FIX P1: Initialize filters from URL params if available
const urlFilters = getFiltersFromUrl();

const initialFilters: SearchFilters = {
  q: urlFilters.q ?? '',
  category: urlFilters.category,
  subcategory: urlFilters.subcategory,
  minPrice: urlFilters.minPrice,
  maxPrice: urlFilters.maxPrice,
  minRating: urlFilters.minRating,
  lat: undefined,
  lng: undefined,
  radius: 25,
  city: '',
  state: '',
  sortBy: urlFilters.sortBy ?? 'popularity',
  page: urlFilters.page ?? 1,
  limit: urlFilters.limit ?? 20,
};

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      // Initial state
      services: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      filters: initialFilters,
      suggestions: [],
      isLoading: false,
      isLoadingSuggestions: false,
      error: null,
      searchHistory: [],
      recentSearches: [],
      trendingServices: [],
      popularServices: [],
      abortController: null, // FIX P2: Initialize abort controller

      // Actions
      setFilters: (newFilters: Partial<SearchFilters>) => {
        set((state) => ({
          filters: {
            ...state.filters,
            ...newFilters,
            page: newFilters.page !== undefined ? newFilters.page : 1, // Reset to page 1 unless explicitly set
          },
        }));
        // FIX P1: Sync filter state to URL for persistence across page refresh
        syncFiltersToUrl(newFilters);
      },

      clearFilters: () => {
        set({
          filters: initialFilters,
          services: [],
          totalCount: 0,
          currentPage: 1,
          totalPages: 1,
          error: null,
        });
      },

      performSearch: async () => {
        const { filters, searchServices } = get();
        await searchServices(filters);
      },

      searchServices: async (filters: SearchFilters) => {
        // FIX P2: Cancel any existing request before starting new one
        const { cancelCurrentRequest } = get();
        cancelCurrentRequest();

        const abortController = new AbortController();
        set({ isLoading: true, error: null, abortController });

        try {
          const response = await searchApi.searchServices(filters, abortController.signal);

          if (response.success) {
            set({
              services: response.data.services,
              totalCount: response.data.pagination.total,
              currentPage: response.data.pagination.page,
              totalPages: response.data.pagination.pages,
              filters,
              isLoading: false,
              abortController: null,
            });

            // Add to search history if there's a query
            if (filters.q && filters.q.trim()) {
              get().addToSearchHistory(filters.q);
            }
          } else {
            throw new Error('Search failed');
          }
        } catch (err: unknown) {
          // Ignore abort errors
          if ((err as any)?.name === 'AbortError' || axios.isCancel(err)) {
            return;
          }
          const message = err instanceof Error ? err.message : 'Search failed';
          set({
            error: message,
            isLoading: false,
            abortController: null,
          });
        }
      },

      getSearchSuggestions: async (query: string) => {
        if (!query || query.length < 2) {
          set({ suggestions: [] });
          return;
        }

        // FIX P2: Use AbortController to cancel previous suggestion requests
        const abortController = new AbortController();
        set({ isLoadingSuggestions: true });

        try {
          const response = await searchApi.getSearchSuggestions(query, 5, abortController.signal);

          if (response.success) {
            set({
              suggestions: response.data.suggestions,
              isLoadingSuggestions: false,
            });
          }
        } catch (err: unknown) {
          // Ignore abort errors
          if ((err as any)?.name === 'AbortError' || axios.isCancel(err)) {
            return;
          }
          console.error('Failed to get suggestions:', err);
          set({
            suggestions: [],
            isLoadingSuggestions: false,
          });
        }
      },

      getTrendingServices: async (timeframe = '7d') => {
        try {
          const response = await searchApi.getTrendingServices(timeframe);

          if (response.success) {
            set({ trendingServices: response.data.services });
          }
        } catch (error: any) {
          console.error('Failed to get trending services:', error);
        }
      },

      getPopularServices: async (category?: string) => {
        try {
          const response = await searchApi.getPopularServices(category);

          if (response.success) {
            set({ popularServices: response.data.services });
          }
        } catch (error: any) {
          console.error('Failed to get popular services:', error);
        }
      },

      getServicesByCategory: async (category: string, additionalFilters?: Partial<SearchFilters>) => {
        const filters = {
          ...get().filters,
          ...additionalFilters,
          category,
          page: 1, // Reset to first page for new category
        };

        await get().searchServices(filters);
      },

      addToSearchHistory: (query: string) => {
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery) return;

        set((state) => {
          const newHistory = [trimmedQuery, ...state.searchHistory.filter(q => q !== trimmedQuery)];
          const newRecent = [trimmedQuery, ...state.recentSearches.filter(q => q !== trimmedQuery)];

          return {
            searchHistory: newHistory.slice(0, 50), // Keep last 50 searches
            recentSearches: newRecent.slice(0, 10),  // Keep last 10 recent searches
          };
        });
      },

      clearSearchHistory: () => {
        set({ searchHistory: [], recentSearches: [] });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      invalidateProviderCache: (providerId?: string) => {
        set((state) => {
          // If providerId is provided, remove only that provider's services from cache
          if (providerId) {
            return {
              services: state.services.filter(s => s.providerId !== providerId),
              trendingServices: state.trendingServices.filter(s => s.providerId !== providerId),
              popularServices: state.popularServices.filter(s => s.providerId !== providerId),
            };
          }
          // Otherwise clear all cached service data
          return {
            services: [],
            trendingServices: [],
            popularServices: [],
            totalCount: 0,
            currentPage: 1,
            totalPages: 1,
          };
        });
      },

      invalidateServiceCache: (serviceId?: string) => {
        set((state) => {
          // If serviceId is provided, remove only that service from cache
          if (serviceId) {
            return {
              services: state.services.filter(s => s._id !== serviceId),
              trendingServices: state.trendingServices.filter(s => s._id !== serviceId),
              popularServices: state.popularServices.filter(s => s._id !== serviceId),
            };
          }
          // Clear all service caches
          return {
            services: [],
            trendingServices: [],
            popularServices: [],
            totalCount: 0,
            currentPage: 1,
            totalPages: 1,
          };
        });
      },

      // FIX P2: Cancel any ongoing request
      cancelCurrentRequest: () => {
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
        }
      },
    }),
    {
      name: 'search-store',
      version: 1,
      partialize: (state) => ({
        // Only persist certain parts of the state
        searchHistory: state.searchHistory,
        recentSearches: state.recentSearches,
        filters: {
          ...initialFilters,
          sortBy: state.filters.sortBy,
          radius: state.filters.radius,
          limit: state.filters.limit,
        },
      }),
    }
  )
);

// Selectors for easier access
export const searchSelectors = {
  isSearching: (state: SearchState) => state.isLoading,
  hasResults: (state: SearchState) => state.services.length > 0,
  hasError: (state: SearchState) => !!state.error,
  hasFilters: (state: SearchState) => {
    const { filters } = state;
    return !!(
      filters.q ||
      filters.category ||
      filters.subcategory ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.minRating ||
      filters.city ||
      filters.state
    );
  },
  currentQuery: (state: SearchState) => state.filters.q || '',
  isEmpty: (state: SearchState) => !state.isLoading && state.services.length === 0,
};
