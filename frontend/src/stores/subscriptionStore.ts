import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  subscriptionApi,
  type Subscription,
  type Membership,
  type SubscriptionPlan,
  getSubscription,
  subscribe,
  cancelSubscriptionSimple,
  upgradeSubscription,
} from '../services/subscriptionApi';

interface SubscriptionState {
  subscription: Subscription | null;
  membership: Membership | null;
  availablePlans: SubscriptionPlan[];
  isLoading: boolean;
  error: string | null;

  // Simple actions
  fetchSubscription: () => Promise<void>;
  subscribe: (tier: string) => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  upgrade: (tier: string) => Promise<boolean>;

  // Extended actions
  fetchMembership: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  changePlan: (plan: string, billingCycle?: 'monthly' | 'yearly') => Promise<boolean>;
  reactivateSubscription: () => Promise<boolean>;
  checkPermission: (action: 'booking' | 'featuredListing') => Promise<boolean>;
  clearError: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscription: null,
      membership: null,
      availablePlans: [],
      isLoading: false,
      error: null,

      // Simple actions (Nilin)
      fetchSubscription: async () => {
        set({ isLoading: true, error: null });
        try {
          const sub = await getSubscription();
          set({ subscription: sub, isLoading: false });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch subscription', isLoading: false });
        }
      },

      subscribe: async (tier: string) => {
        set({ isLoading: true, error: null });
        try {
          await subscribe(tier);
          await get().fetchSubscription();
          return true;
        } catch (err: any) {
          set({ error: err.message || 'Failed to subscribe', isLoading: false });
          return false;
        }
      },

      cancelSubscription: async () => {
        set({ isLoading: true, error: null });
        try {
          await cancelSubscriptionSimple();
          await get().fetchSubscription();
          return true;
        } catch (err: any) {
          set({ error: err.message || 'Failed to cancel subscription', isLoading: false });
          return false;
        }
      },

      upgrade: async (tier: string) => {
        set({ isLoading: true, error: null });
        try {
          await upgradeSubscription(tier);
          await get().fetchSubscription();
          return true;
        } catch (err: any) {
          set({ error: err.message || 'Failed to upgrade subscription', isLoading: false });
          return false;
        }
      },

      // Extended actions
      fetchMembership: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await subscriptionApi.getMembership();
          set({ membership: response.data, isLoading: false });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch membership', isLoading: false });
        }
      },

      fetchPlans: async () => {
        try {
          const response = await subscriptionApi.getPlans();
          set({ availablePlans: response.data });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch plans' });
        }
      },

      changePlan: async (plan: string, billingCycle = 'monthly') => {
        set({ isLoading: true, error: null });
        try {
          const response = await subscriptionApi.changePlan(plan as any, { billingCycle });
          set({ subscription: response.data, isLoading: false });
          return true;
        } catch (err: any) {
          set({ error: err.message || 'Failed to change plan', isLoading: false });
          return false;
        }
      },

      reactivateSubscription: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await subscriptionApi.reactivateSubscription();
          set({ subscription: response.data, isLoading: false });
          return true;
        } catch (err: any) {
          set({ error: err.message || 'Failed to reactivate subscription', isLoading: false });
          return false;
        }
      },

      checkPermission: async (action: 'booking' | 'featuredListing') => {
        try {
          const response = await subscriptionApi.checkPermission(action);
          return response.data.allowed;
        } catch {
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'nilin-subscription',
      partialize: (state) => ({
        subscription: state.subscription,
        membership: state.membership,
      }),
    }
  )
);

// Selectors
export const selectSubscription = (state: SubscriptionState) => state.subscription;
export const selectMembership = (state: SubscriptionState) => state.membership;
export const selectIsActive = (state: SubscriptionState) =>
  state.subscription?.status === 'active';
export const selectCurrentTier = (state: SubscriptionState) =>
  state.subscription?.plan || 'free';
export const selectIsLoading = (state: SubscriptionState) => state.isLoading;
export const selectError = (state: SubscriptionState) => state.error;
