// Revenue & Subscription Service
// Monetization infrastructure - Real backend integration
// SECURITY: Wallet balance ONLY comes from backend API, never localStorage

import React from 'react';
import { create } from 'zustand';
import { customerWalletApi, providerWalletApi } from '../walletApi';

export type WalletContext = 'customer' | 'provider';

function getWalletApi(context: WalletContext) {
  return context === 'provider' ? providerWalletApi : customerWalletApi;
}

export interface Subscription {
  id: string;
  tier: 'free' | 'premium' | 'pro';
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  bookingId?: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  transactions: WalletTransaction[];
  pendingCredits: number;
  currency: string;
  totalEarned: number;
  totalSpent: number;
}

export interface PromoCode {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  expiresAt?: string;
  usedCount: number;
  maxUses?: number;
}

interface RevenueState {
  // Wallet state (from backend only - NEVER persisted locally)
  wallet: Wallet;
  walletContext: WalletContext;
  monthlyEarnings: number;
  walletLoading: boolean;
  walletError: string | null;
  lastWalletFetch: number | null;

  // Subscription state (from backend)
  subscription: Subscription | null;
  subscriptionLoading: boolean;

  // UI preferences ONLY (this is safe to persist)
  promoCodes: PromoCode[];
  selectedPaymentMethod: 'wallet' | 'card' | 'upi' | null;
  autoApplyReferralCredits: boolean;

  // Actions
  setWalletContext: (context: WalletContext) => void;
  fetchWallet: (options?: { force?: boolean; context?: WalletContext }) => Promise<void>;
  fetchTransactions: (options?: { page?: number; limit?: number; type?: 'credit' | 'debit'; context?: WalletContext }) => Promise<WalletTransaction[]>;
  updateWalletBalance: (balance: number, pendingCredits?: number) => void;
  addCredits: (amount: number, reason: string, idempotencyKey?: string) => Promise<{ success: boolean; newBalance: number; error?: string }>;
  deductCredits: (amount: number, reason: string, bookingId?: string) => Promise<{ success: boolean; newBalance: number; error?: string }>;
  applyPromoCode: (code: string, orderValue: number) => Promise<{ valid: boolean; discount: number; message: string }>;
  setSubscription: (sub: Subscription) => void;
  cancelSubscription: () => void;
  addPromoCode: (promo: PromoCode) => void;
  setSelectedPaymentMethod: (method: 'wallet' | 'card' | 'upi' | null) => void;
  setAutoApplyReferralCredits: (enabled: boolean) => void;
  clearWalletError: () => void;
}

// Optimistic update tracking for rollback
interface OptimisticUpdate {
  id: string;
  type: 'add' | 'deduct';
  amount: number;
  previousBalance: number;
  timestamp: number;
}

// Clean up stale optimistic updates (older than 5 minutes)
const CLEANUP_THRESHOLD_MS = 5 * 60 * 1000;
const pendingOptimisticUpdates = new Map<string, OptimisticUpdate>();

export const useRevenueStore = create<RevenueState>()(
  (set, get) => ({
    // Initial state - wallet balance is 0 until fetched from backend
    wallet: {
      balance: 0,
      transactions: [],
      pendingCredits: 0,
      currency: 'AED',
      totalEarned: 0,
      totalSpent: 0,
    },
    walletContext: 'customer',
    monthlyEarnings: 0,
    walletLoading: false,
    walletError: null,
    lastWalletFetch: null,

    subscription: null,
    subscriptionLoading: false,

    // UI preferences ONLY - safe to persist
    promoCodes: [],
    selectedPaymentMethod: null,
    autoApplyReferralCredits: true,

    setWalletContext: (context) => {
      const current = get().walletContext;
      if (current !== context) {
        set({ walletContext: context, lastWalletFetch: null });
      } else {
        set({ walletContext: context });
      }
    },

    updateWalletBalance: (balance, pendingCredits) => {
      set((state) => ({
        wallet: {
          ...state.wallet,
          balance,
          ...(pendingCredits !== undefined ? { pendingCredits } : {}),
        },
      }));
    },

    /**
     * Fetch wallet balance AND transactions from backend API
     * This is the ONLY source of truth for wallet balance
     */
    fetchWallet: async (options) => {
      const state = get();
      const context = options?.context ?? state.walletContext;
      const walletApi = getWalletApi(context);

      // Prevent duplicate fetches within 5 seconds (debounce) unless forced
      if (!options?.force && state.lastWalletFetch && Date.now() - state.lastWalletFetch < 5000) {
        return;
      }

      set({ walletLoading: true, walletError: null, walletContext: context });

      try {
        // Fetch wallet balance, transactions, and monthly summary in parallel
        const [walletResponse, transactionsResponse, summaryResponse] = await Promise.all([
          walletApi.getWallet(),
          walletApi.getTransactions({ limit: 10 }),
          walletApi.getEarningsSummary('month').catch(() => null),
        ]);

        if (walletResponse.success && walletResponse.data) {
          // Transform backend wallet to frontend format
          const backendWallet = walletResponse.data;

          // Transform transactions if available
          let transactions: WalletTransaction[] = [];
          if (transactionsResponse.success && transactionsResponse.data?.transactions) {
            transactions = transactionsResponse.data.transactions.map((t) => ({
              id: t.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type: t.type as 'credit' | 'debit',
              amount: t.amount,
              reason: t.description || t.reference || 'Transaction',
              bookingId: t.referenceType === 'booking' ? t.reference : undefined,
              createdAt: (t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt) || new Date().toISOString(),
            }));
          }

          const wallet: Wallet = {
            balance: backendWallet.balance,
            transactions: transactions,
            pendingCredits: backendWallet.pendingBalance,
            currency: backendWallet.currency,
            totalEarned: backendWallet.totalEarned,
            totalSpent: backendWallet.totalSpent,
          };

          set({
            wallet,
            monthlyEarnings: summaryResponse?.success ? summaryResponse.data.earnings : 0,
            walletLoading: false,
            lastWalletFetch: Date.now(),
          });
        } else {
          throw new Error('Failed to fetch wallet');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch wallet balance';
        console.error('Wallet fetch error:', errorMessage);

        set({
          walletLoading: false,
          walletError: errorMessage,
        });
      }
    },

    /**
     * Fetch wallet transactions from backend
     */
    fetchTransactions: async (options) => {
      try {
        const context = options?.context ?? get().walletContext;
        const response = await getWalletApi(context).getTransactions(options);

        if (response.success && response.data) {
          // Transform backend transactions to frontend format
          const transactions: WalletTransaction[] = response.data.transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            reason: t.description,
            bookingId: t.referenceType === 'booking' ? t.reference : undefined,
            createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
          }));

          // Update wallet with transactions
          set((state) => ({
            wallet: {
              ...state.wallet,
              transactions,
            },
          }));

          return transactions;
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return [];
      }
    },

    /**
     * Direct credit additions are disabled — use AddMoneyModal with Stripe verification
     */
    addCredits: async (_amount, _reason, _idempotencyKey) => {
      return {
        success: false,
        newBalance: get().wallet.balance,
        error: 'Direct credit additions are not allowed. Use the Add Money flow with payment verification.',
      };
    },

    /**
     * Deduct credits from wallet with optimistic update and rollback on failure
     */
    deductCredits: async (amount, reason, bookingId) => {
      const state = get();
      const previousBalance = state.wallet.balance;
      const updateId = `deduct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Check if sufficient balance (optimistic check - backend will also validate)
      if (previousBalance < amount) {
        return {
          success: false,
          newBalance: previousBalance,
          error: 'Insufficient wallet balance',
        };
      }

      // Store optimistic update for potential rollback
      pendingOptimisticUpdates.set(updateId, {
        id: updateId,
        type: 'deduct',
        amount,
        previousBalance,
        timestamp: Date.now(),
      });

      // Optimistic update - immediately show the new balance
      set({
        wallet: {
          ...state.wallet,
          balance: previousBalance - amount,
        },
      });

      try {
        // Call backend API to deduct credits
        const response = await getWalletApi(get().walletContext).deductCredits({
          amount,
          reason,
          reference: bookingId,
          referenceType: bookingId ? 'booking' : 'other',
          idempotencyKey: updateId,
        });

        if (!response.success) {
          throw new Error(response.message || 'Failed to deduct credits');
        }

        // Update with actual balance from backend
        set({
          wallet: {
            ...state.wallet,
            balance: response.data.newBalance,
          },
        });

        // Clean up pending update on success
        pendingOptimisticUpdates.delete(updateId);

        return {
          success: true,
          newBalance: response.data.newBalance,
        };
      } catch (error) {
        // Rollback on failure
        const errorMessage = error instanceof Error ? error.message : 'Failed to deduct credits';

        set({
          wallet: {
            ...state.wallet,
            balance: previousBalance,
          },
          walletError: errorMessage,
        });

        pendingOptimisticUpdates.delete(updateId);

        return {
          success: false,
          newBalance: previousBalance,
          error: errorMessage,
        };
      }
    },

    applyPromoCode: async (code, orderValue) => {
      const promo = get().promoCodes.find((p) => p.code === code.toUpperCase());

      if (!promo) {
        return { valid: false, discount: 0, message: 'Invalid promo code' };
      }

      // Check expiry
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return { valid: false, discount: 0, message: 'Promo code expired' };
      }

      // Check max uses
      if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return { valid: false, discount: 0, message: 'Promo code limit reached' };
      }

      // Check min order value
      if (promo.minOrderValue && orderValue < promo.minOrderValue) {
        return {
          valid: false,
          discount: 0,
          message: `Minimum order value ${promo.minOrderValue}`,
        };
      }

      // Calculate discount
      let discount = 0;
      if (promo.type === 'percentage') {
        discount = (orderValue * promo.value) / 100;
      } else {
        discount = promo.value;
      }

      // Apply max discount cap
      if (promo.maxDiscount) {
        discount = Math.min(discount, promo.maxDiscount);
      }

      return { valid: true, discount, message: 'Promo applied!' };
    },

    setSubscription: (sub) => set({ subscription: sub }),

    cancelSubscription: () =>
      set((state) => ({
        subscription: state.subscription
          ? { ...state.subscription, autoRenew: false }
          : null,
      })),

    addPromoCode: (promo) =>
      set((state) => ({
        promoCodes: [...state.promoCodes, promo],
      })),

    setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

    setAutoApplyReferralCredits: (enabled) => set({ autoApplyReferralCredits: enabled }),

    clearWalletError: () => set({ walletError: null }),
  })
);

// Optimistic update cleanup interval - stored for cleanup
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic cleanup of stale optimistic updates.
 * Call this when the app initializes.
 */
export function startOptimisticUpdateCleanup(): void {
  if (!cleanupIntervalId) {
    cleanupIntervalId = setInterval(() => {
      const now = Date.now();
      for (const [id, update] of pendingOptimisticUpdates.entries()) {
        if (now - update.timestamp > CLEANUP_THRESHOLD_MS) {
          console.warn(`Cleaning up stale optimistic update: ${id}`);
          pendingOptimisticUpdates.delete(id);
        }
      }
    }, 60000); // Run every minute
  }
}

/**
 * Stop the periodic cleanup of stale optimistic updates.
 * Call this when the app unmounts or when cleanup is needed.
 */
export function stopOptimisticUpdateCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Automatic cleanup on module unload (browser)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', stopOptimisticUpdateCleanup);
}

/**
 * React hook to automatically start/stop optimistic update cleanup.
 * Call this once at app initialization (e.g., in App.tsx).
 * Returns cleanup function for manual cleanup if needed.
 */
export function useOptimisticUpdateCleanup(): () => void {
  React.useEffect(() => {
    startOptimisticUpdateCleanup();
    return () => {
      stopOptimisticUpdateCleanup();
    };
  }, []);
  return stopOptimisticUpdateCleanup;
}

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      'Book any service',
      'Pay per booking',
      'Standard support',
      'Basic recommendations',
    ],
  },
  premium: {
    name: 'Premium',
    price: 199,
    period: 'monthly',
    features: [
      'Everything in Free',
      '5% off every booking',
      'Priority support',
      'Advanced recommendations',
      'Exclusive deals',
      'Early access to new services',
    ],
  },
  pro: {
    name: 'Pro',
    price: 499,
    period: 'monthly',
    features: [
      'Everything in Premium',
      '10% off every booking',
      'Dedicated support',
      'Personalized AI assistant',
      'Exclusive Pro deals',
      'First access to new services',
      'Free cancellation',
    ],
  },
};

// Referral rewards configuration (aligned with backend REFERRAL_REWARDS)
export const REFERRAL_CONFIG = {
  referrerReward: 500,
  refereeReward: 250,
  maxCredits: 1000,
  minWithdrawAmount: 500,
};

// Calculate potential earnings
export function calculateReferralEarnings(referralCount: number): number {
  return Math.min(referralCount * REFERRAL_CONFIG.referrerReward, REFERRAL_CONFIG.maxCredits);
}

// Hook for wallet - forces re-render and triggers fetch if needed
export function useWallet(context: WalletContext = 'customer') {
  const wallet = useRevenueStore((state) => state.wallet);
  const monthlyEarnings = useRevenueStore((state) => state.monthlyEarnings);
  const fetchWallet = useRevenueStore((state) => state.fetchWallet);
  const setWalletContext = useRevenueStore((state) => state.setWalletContext);
  const lastFetch = useRevenueStore((state) => state.lastWalletFetch);
  const walletContext = useRevenueStore((state) => state.walletContext);
  const loading = useRevenueStore((state) => state.walletLoading);

  // Auto-fetch on first access if never fetched - use useEffect to prevent infinite loops
  React.useEffect(() => {
    if (walletContext !== context) {
      setWalletContext(context);
    }
    if ((!lastFetch || walletContext !== context) && !loading) {
      fetchWallet({ context });
    }
  }, [lastFetch, loading, fetchWallet, context, walletContext, setWalletContext]);

  return { ...wallet, monthlyEarnings };
}

// Hook for subscription
export function useSubscription() {
  return useRevenueStore((state) => state.subscription);
}

// Hook for promo codes
export function usePromoCodes() {
  return useRevenueStore((state) => state.promoCodes);
}

// Hook to force refresh wallet balance
export function useRefreshWallet(context: WalletContext = 'customer') {
  const fetchWallet = useRevenueStore((state) => state.fetchWallet);
  const fetchTransactions = useRevenueStore((state) => state.fetchTransactions);
  const setWalletContext = useRevenueStore((state) => state.setWalletContext);
  const updateWalletBalance = useRevenueStore((state) => state.updateWalletBalance);
  const loading = useRevenueStore((state) => state.walletLoading);
  const lastFetch = useRevenueStore((state) => state.lastWalletFetch);
  const error = useRevenueStore((state) => state.walletError);
  const refreshRef = React.useRef<number>(0);

  React.useEffect(() => {
    setWalletContext(context);
  }, [context, setWalletContext]);

  // Track if a refresh is in progress by comparing refreshRef timestamp with lastFetch
  const isRefreshing = refreshRef.current > 0 && lastFetch !== null && refreshRef.current > lastFetch;

  const refresh = React.useCallback(() => {
    refreshRef.current = Date.now();
    return fetchWallet({ force: true, context });
  }, [fetchWallet, context]);

  const refreshTransactions = React.useCallback(() => {
    return fetchTransactions({ limit: 10, context });
  }, [fetchTransactions, context]);

  return {
    refresh,
    refreshTransactions,
    updateWalletBalance,
    loading: isRefreshing || loading,
    error,
  };
}

// Revenue analytics tracking
import { analytics } from '../product/AnalyticsService';

export function trackRevenueEvent(
  event: 'subscription_started' | 'subscription_cancelled' | 'wallet_topup' | 'promo_applied',
  data?: Record<string, unknown>
) {
  analytics.track(`revenue_${event}`, {
    ...data,
    timestamp: Date.now(),
  });
}

export default useRevenueStore;
