import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  subscriptionApi,
  type Subscription,
  type Membership,
  type SubscriptionPlan,
  type PlanType,
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
  changePlan: (plan: PlanType, billingCycle?: 'monthly' | 'yearly') => Promise<boolean>;
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
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch subscription';
          set({ error: message, isLoading: false });
        }
      },

      subscribe: async (tier: string) => {
        set({ isLoading: true, error: null });
        try {
          await subscribe(tier);
          await get().fetchSubscription();
          return true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to subscribe';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      cancelSubscription: async () => {
        set({ isLoading: true, error: null });
        try {
          await cancelSubscriptionSimple();
          await get().fetchSubscription();
          return true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      upgrade: async (tier: string) => {
        set({ isLoading: true, error: null });
        try {
          await upgradeSubscription(tier);
          await get().fetchSubscription();
          return true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to upgrade subscription';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      // Extended actions
      fetchMembership: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await subscriptionApi.getMembership();
          set({ membership: response.data, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch membership';
          set({ error: message, isLoading: false });
        }
      },

      fetchPlans: async () => {
        try {
          const response = await subscriptionApi.getPlans();
          set({ availablePlans: response.data });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch plans';
          set({ error: message });
        }
      },

      changePlan: async (plan: string, billingCycle = 'monthly') => {
        set({ isLoading: true, error: null });
        try {
          // Validate plan is one of the allowed PlanType values
          const validPlans: PlanType[] = ['free', 'basic', 'premium', 'enterprise'];
          if (!validPlans.includes(plan as PlanType)) {
            throw new Error(`Invalid plan: ${plan}. Must be one of: ${validPlans.join(', ')}`);
          }
          const response = await subscriptionApi.changePlan(plan as PlanType, { billingCycle });
          set({ subscription: response.data, isLoading: false });
          return true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to change plan';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      reactivateSubscription: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await subscriptionApi.reactivateSubscription();
          set({ subscription: response.data, isLoading: false });
          return true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to reactivate subscription';
          set({ error: message, isLoading: false });
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
