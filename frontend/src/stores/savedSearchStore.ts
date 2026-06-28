import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedSearch {
  id: string;
  query: string;
  filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sortBy?: string;
  };
  createdAt: number;
}

interface SavedSearchState {
  searches: SavedSearch[];
  addSearch: (search: Omit<SavedSearch, 'id' | 'createdAt'>) => void;
  removeSearch: (id: string) => void;
  clearAll: () => void;
}

export const useSavedSearchStore = create<SavedSearchState>()(
  persist(
    (set, get) => ({
      searches: [],
      addSearch: (search) => {
        const { searches } = get();
        // Deduplicate: if same query+filters exists, don't add
        const exists = searches.some(
          (s) => s.query === search.query &&
            JSON.stringify(s.filters) === JSON.stringify(search.filters)
        );
        if (exists) return;

        const newSearch: SavedSearch = {
          ...search,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
        };

        // Max 20 searches, remove oldest if at limit
        const updated = [newSearch, ...searches].slice(0, 20);
        set({ searches: updated });
      },
      removeSearch: (id) => {
        set({ searches: get().searches.filter((s) => s.id !== id) });
      },
      clearAll: () => set({ searches: [] }),
    }),
    {
      name: 'nilin-book-saved-searches',
      version: 1,
    }
  )
);
