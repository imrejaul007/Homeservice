import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { favoritesApi } from '../services/favoritesApi';

const STORAGE_KEY = 'nilin-favorites';

interface FavoriteItem {
  providerId: string;
  addedAt: number;
}

interface FavoritesState {
  items: FavoriteItem[];
  isLoaded: boolean;
  isLoading: boolean;

  // Actions
  loadFavorites: () => Promise<void>;
  addFavorite: (providerId: string) => Promise<boolean>;
  removeFavorite: (providerId: string) => Promise<boolean>;
  toggleFavorite: (providerId: string) => Promise<boolean>;
  checkFavorite: (providerId: string) => boolean;
  clearAll: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoaded: false,
      isLoading: false,

      loadFavorites: async () => {
        // Skip if already loading or loaded
        if (get().isLoading || get().isLoaded) return;

        set({ isLoading: true });
        try {
          const response = await favoritesApi.getFavorites();
          if (response.success && response.data.favorites) {
            const items: FavoriteItem[] = response.data.favorites.map((fav) => ({
              providerId: fav.providerId,
              addedAt: fav.addedAt ? new Date(fav.addedAt).getTime() : Date.now(),
            }));
            set({ items, isLoaded: true });
          }
        } catch (error) {
          console.error('[favoritesStore] Failed to load favorites:', error);
          // Don't throw - just mark as loaded so we don't keep retrying
          set({ isLoaded: true });
        } finally {
          set({ isLoading: false });
        }
      },

      addFavorite: async (providerId: string): Promise<boolean> => {
        // Check if already favorited locally
        if (get().items.some((item) => item.providerId === providerId)) {
          return false;
        }

        // Optimistic update
        set({
          items: [...get().items, { providerId, addedAt: Date.now() }],
        });

        try {
          await favoritesApi.addFavorite(providerId);
          return true;
        } catch (error) {
          // Rollback on failure
          set({
            items: get().items.filter((item) => item.providerId !== providerId),
          });
          throw error;
        }
      },

      removeFavorite: async (providerId: string): Promise<boolean> => {
        // Check if exists locally
        const exists = get().items.some((item) => item.providerId === providerId);
        if (!exists) {
          return false;
        }

        // Optimistic update
        set({
          items: get().items.filter((item) => item.providerId !== providerId),
        });

        try {
          await favoritesApi.removeFavorite(providerId);
          return true;
        } catch (error) {
          // Rollback on failure
          set({
            items: [...get().items, { providerId, addedAt: Date.now() }],
          });
          throw error;
        }
      },

      toggleFavorite: async (providerId: string): Promise<boolean> => {
        const isFavorited = get().checkFavorite(providerId);
        if (isFavorited) {
          await get().removeFavorite(providerId);
          return false;
        } else {
          await get().addFavorite(providerId);
          return true;
        }
      },

      checkFavorite: (providerId: string): boolean => {
        return get().items.some((item) => item.providerId === providerId);
      },

      clearAll: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export default useFavoritesStore;