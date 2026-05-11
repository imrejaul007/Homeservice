import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { searchApi } from '@/services/searchApi';
import type { SearchFilters, Service, Suggestion } from '@/types/search';

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
}

const initialFilters: SearchFilters = {
  q: '',
  category: undefined,
  subcategory: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  minRating: undefined,
  lat: undefined,
  lng: undefined,
  radius: 25,
  city: '',
  state: '',
  sortBy: 'popularity',
  page: 1,
  limit: 20,
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

      // Actions
      setFilters: (newFilters: Partial<SearchFilters>) => {
        set((state) => ({
          filters: {
            ...state.filters,
            ...newFilters,
            page: newFilters.page !== undefined ? newFilters.page : 1, // Reset to page 1 unless explicitly set
          },
        }));
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
        set({ isLoading: true, error: null });
        
        try {
          const response = await searchApi.searchServices(filters);
          
          if (response.success) {
            set({
              services: response.data.services,
              totalCount: response.data.pagination.total,
              currentPage: response.data.pagination.page,
              totalPages: response.data.pagination.pages,
              filters,
              isLoading: false,
            });

            // Add to search history if there's a query
            if (filters.q && filters.q.trim()) {
              get().addToSearchHistory(filters.q);
            }
          } else {
            throw new Error('Search failed');
          }
        } catch (error: any) {
          set({
            error: error.response?.data?.message || error.message || 'Search failed',
            isLoading: false,
          });
        }
      },

      getSearchSuggestions: async (query: string) => {
        if (!query || query.length < 2) {
          set({ suggestions: [] });
          return;
        }

        set({ isLoadingSuggestions: true });
        
        try {
          const response = await searchApi.getSearchSuggestions(query);
          
          if (response.success) {
            set({
              suggestions: response.data.suggestions,
              isLoadingSuggestions: false,
            });
          }
        } catch (error: any) {
          console.error('Failed to get suggestions:', error);
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
    }),
    {
      name: 'search-store',
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