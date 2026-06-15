import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Service } from '../types/search';

const MAX_COMPARISON_ITEMS = 4;
const STORAGE_KEY = 'nilin-service-comparison';

interface ComparisonItem {
  id: string;
  service: Service;
  addedAt: number;
}

interface ComparisonState {
  items: ComparisonItem[];
  addService: (service: Service) => boolean;
  removeService: (id: string) => void;
  toggleService: (service: Service) => boolean;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
  canAdd: boolean;
}

export const useComparisonStore = create<ComparisonState>()(
  persist(
    (set, get) => ({
      items: [],

      addService: (service: Service): boolean => {
        const { items } = get();
        if (items.find((item) => item.id === service._id)) {
          return false; // Already added
        }
        if (items.length >= MAX_COMPARISON_ITEMS) {
          return false; // At capacity
        }
        set({
          items: [...items, { id: service._id, service, addedAt: Date.now() }],
        });
        return true;
      },

      removeService: (id: string) => {
        set({ items: get().items.filter((item) => item.id !== id) });
      },

      toggleService: (service: Service): boolean => {
        const { isSelected, addService, removeService } = get();
        if (isSelected(service._id)) {
          removeService(service._id);
          return false;
        }
        return addService(service);
      },

      clearAll: () => set({ items: [] }),

      isSelected: (id: string): boolean => {
        return get().items.some((item) => item.id === id);
      },

      get canAdd(): boolean {
        return get().items.length < MAX_COMPARISON_ITEMS;
      },
    }),
    {
      name: STORAGE_KEY,
      // Persist only IDs to avoid stale service data
      partialize: (state) => ({ items: state.items.map((i) => ({ id: i.id, service: i.service, addedAt: i.addedAt })) }),
    }
  )
);

export const COMPARISON_LIMIT = MAX_COMPARISON_ITEMS;
