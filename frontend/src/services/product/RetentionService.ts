// Retention Service - Track user engagement and provide smart experiences
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentlyViewed {
  id: string;
  type: 'service' | 'provider';
  name: string;
  image?: string;
  timestamp: number;
}

interface SavedSearch {
  id: string;
  query: string;
  filters?: Record<string, string>;
  timestamp: number;
}

interface UserEngagement {
  lastVisit: number;
  visitCount: number;
  firstVisit: number;
  lastBooking?: number;
  favoriteServices: string[];
  recentSearches: string[];
}

interface RetentionState {
  recentlyViewed: RecentlyViewed[];
  savedSearches: SavedSearch[];
  engagement: UserEngagement;

  // Unfinished booking
  unfinishedBooking: {
    serviceId?: string;
    serviceName?: string;
    step: 'cart' | 'details' | 'payment';
    data?: Record<string, unknown>;
    savedAt: number;
  } | null;

  // Actions
  addRecentlyViewed: (item: Omit<RecentlyViewed, 'timestamp'>) => void;
  addSavedSearch: (search: Omit<SavedSearch, 'id' | 'timestamp'>) => void;
  removeSavedSearch: (id: string) => void;
  incrementVisit: () => void;
  recordBooking: () => void;
  addFavorite: (serviceId: string) => void;
  removeFavorite: (serviceId: string) => void;
  clearHistory: () => void;

  // Unfinished booking actions
  saveUnfinishedBooking: (booking: RetentionState['unfinishedBooking']) => void;
  getUnfinishedBooking: () => RetentionState['unfinishedBooking'];
  clearUnfinishedBooking: () => void;

  // Re-engagement
  shouldShowReengagement: () => boolean;
  getReengagementNudge: () => { title: string; message: string; action: string } | null;
  getDaysSinceActive: () => number;
}

export const useRetentionStore = create<RetentionState>()(
  persist(
    (set, get) => ({
      recentlyViewed: [],
      savedSearches: [],
      engagement: {
        lastVisit: Date.now(),
        visitCount: 1,
        firstVisit: Date.now(),
        favoriteServices: [],
        recentSearches: [],
      },
      unfinishedBooking: null,

      addRecentlyViewed: (item) => {
        const recentlyViewed = get().recentlyViewed;
        const existing = recentlyViewed.findIndex((i) => i.id === item.id);

        if (existing !== -1) {
          // Update timestamp
          recentlyViewed.splice(existing, 1);
        }

        set({
          recentlyViewed: [
            { ...item, timestamp: Date.now() },
            ...recentlyViewed,
          ].slice(0, 20), // Keep last 20
        });
      },

      addSavedSearch: (search) => {
        const savedSearches = get().savedSearches;
        const existing = savedSearches.find((s) => s.query === search.query);

        if (!existing) {
          set({
            savedSearches: [
              { ...search, id: Date.now().toString(), timestamp: Date.now() },
              ...savedSearches,
            ].slice(0, 10), // Keep last 10
          });
        }
      },

      removeSavedSearch: (id) => {
        set({
          savedSearches: get().savedSearches.filter((s) => s.id !== id),
        });
      },

      incrementVisit: () => {
        const engagement = get().engagement;
        set({
          engagement: {
            ...engagement,
            lastVisit: Date.now(),
            visitCount: engagement.visitCount + 1,
          },
        });
      },

      recordBooking: () => {
        const engagement = get().engagement;
        set({
          engagement: {
            ...engagement,
            lastBooking: Date.now(),
          },
        });
      },

      addFavorite: (serviceId) => {
        const engagement = get().engagement;
        if (!engagement.favoriteServices.includes(serviceId)) {
          set({
            engagement: {
              ...engagement,
              favoriteServices: [...engagement.favoriteServices, serviceId],
            },
          });
        }
      },

      removeFavorite: (serviceId) => {
        const engagement = get().engagement;
        set({
          engagement: {
            ...engagement,
            favoriteServices: engagement.favoriteServices.filter((id) => id !== serviceId),
          },
        });
      },

      clearHistory: () => {
        set({
          recentlyViewed: [],
          savedSearches: [],
        });
      },

      // Unfinished booking
      saveUnfinishedBooking: (booking) => {
        set({
          unfinishedBooking: {
            ...booking,
            savedAt: Date.now(),
          },
        });
      },

      getUnfinishedBooking: () => {
        const booking = get().unfinishedBooking;
        if (!booking) return null;

        // Expire after 24 hours
        const expiryTime = 24 * 60 * 60 * 1000;
        if (Date.now() - booking.savedAt > expiryTime) {
          set({ unfinishedBooking: null });
          return null;
        }

        return booking;
      },

      clearUnfinishedBooking: () => {
        set({ unfinishedBooking: null });
      },

      // Re-engagement
      shouldShowReengagement: () => {
        const daysSinceActive = get().getDaysSinceActive();
        return daysSinceActive >= 7; // 1 week inactive
      },

      getReengagementNudge: () => {
        const daysSinceActive = get().getDaysSinceActive();

        if (daysSinceActive < 7) return null;

        if (daysSinceActive < 14) {
          return {
            title: "We miss you!",
            message: `Your last cleaning was ${daysSinceActive} days ago. Time to book again?`,
            action: "book_cleaning",
          };
        }

        if (daysSinceActive < 30) {
          return {
            title: "It's been a while!",
            message: `We've missed you for ${daysSinceActive} days. Here's 10% off your next booking!`,
            action: "book_with_discount",
          };
        }

        return {
          title: "Welcome back!",
          message: `Long time no see! Your favorite services are waiting.`,
          action: "explore_services",
        };
      },

      getDaysSinceActive: () => {
        const engagement = get().engagement;
        const lastActive = engagement.lastBooking || engagement.lastVisit;

        if (!lastActive) return 999;

        const lastDate = new Date(lastActive);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
      },
    }),
    {
      name: 'nilin-retention',
    }
  )
);

// Standalone helper functions for re-engagement
export function getDaysSinceActiveStatic(lastVisit: number, lastBooking?: number): number {
  const lastActive = lastBooking || lastVisit;

  if (!lastActive) return 999;

  const lastDate = new Date(lastActive);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Hook for engagement tracking
export function useEngagement() {
  const store = useRetentionStore();
  const engagement = store.engagement;

  // Calculate user segment
  const getSegment = (): 'new' | 'active' | 'engaged' | 'loyal' | 'churned' => {
    const daysSinceFirstVisit = (Date.now() - engagement.firstVisit) / (1000 * 60 * 60 * 24);
    const daysSinceLastVisit = (Date.now() - engagement.lastVisit) / (1000 * 60 * 60 * 24);

    if (daysSinceFirstVisit < 7) return 'new';
    if (daysSinceLastVisit > 14) return 'churned';
    if (engagement.visitCount > 20 || engagement.lastBooking) return 'loyal';
    return 'active';
  };

  // Calculate retention day (1, 7, 30, etc.)
  const getRetentionDay = (): number => {
    const daysSinceFirstVisit = Math.floor(
      (Date.now() - engagement.firstVisit) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceFirstVisit === 0) return 0;
    if (daysSinceFirstVisit <= 1) return 1;
    if (daysSinceFirstVisit <= 7) return 7;
    if (daysSinceFirstVisit <= 30) return 30;
    return 60;
  };

  return {
    ...store,
    segment: getSegment(),
    retentionDay: getRetentionDay(),
    isFirstTimeUser: engagement.visitCount === 1,
    hasBooked: !!engagement.lastBooking,
    daysSinceLastVisit: Math.floor(
      (Date.now() - engagement.lastVisit) / (1000 * 60 * 60 * 24)
    ),
  };
}

// Hook for recently viewed
export function useRecentlyViewed(type?: 'service' | 'provider') {
  const recentlyViewed = useRetentionStore((state) => state.recentlyViewed);

  if (type) {
    return recentlyViewed.filter((item) => item.type === type);
  }
  return recentlyViewed;
}

// Hook for saved searches
export function useSavedSearches() {
  return useRetentionStore((state) => state.savedSearches);
}

// Hook for favorites
export function useFavorites() {
  const { engagement, addFavorite, removeFavorite } = useRetentionStore();
  return {
    favoriteServiceIds: engagement.favoriteServices,
    addFavorite,
    removeFavorite,
    isFavorite: (serviceId: string) => engagement.favoriteServices.includes(serviceId),
  };
}

export default useRetentionStore;
