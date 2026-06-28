import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Service } from '../types/service';

interface ViewedService {
  _id: string;
  title: string;
  image?: string;
  price: number | { amount: number; currency: string };
  viewedAt: number;
}

interface RecentlyViewedState {
  viewed: ViewedService[];
  addViewed: (service: Service) => void;
  clearViewed: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      viewed: [],
      addViewed: (service) => {
        const existing = get().viewed.filter(s => s._id !== service._id);
        const priceAmount = typeof service.price === 'number'
          ? service.price
          : service.price?.amount ?? 0;
        const updated = [
          {
            _id: service._id,
            title: service.title || service.name,
            image: service.image || service.images?.[0],
            price: priceAmount,
            viewedAt: Date.now()
          },
          ...existing
        ].slice(0, 10);
        set({ viewed: updated });
      },
      clearViewed: () => set({ viewed: [] }),
    }),
    { name: 'nilin-recently-viewed', version: 1 }
  )
);