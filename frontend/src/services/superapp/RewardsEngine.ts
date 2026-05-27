// Rewards & Cashback Engine - Financial ecosystem
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loyaltyApi } from '../loyaltyApi';

export interface Reward {
  id: string;
  type: 'cashback' | 'points' | 'credits' | 'voucher';
  amount: number;
  source: 'booking' | 'referral' | 'promo' | 'achievement' | 'streak';
  description: string;
  createdAt: string;
  expiresAt?: string;
  used: boolean;
}

export interface CashbackRate {
  source: 'booking' | 'referral' | 'promo' | 'achievement' | 'streak';
  rate: number;
  maxAmount?: number;
  minAmount?: number;
}

export interface SpendingSummary {
  totalSpent: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrend: number;
  averageOrderValue: number;
  topCategory: string;
}

interface RewardsState {
  points: number;
  lifetimePoints: number;
  rewards: Reward[];
  cashbackBalance: number;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';

  // Actions
  earnCashback: (amount: number, source: Reward['source'], description: string) => void;
  earnPoints: (points: number, source: Reward['source'], description: string) => void;
  redeemPoints: (points: number, description: string) => Promise<boolean>;
  useReward: (rewardId: string) => Promise<boolean>;
  getAvailableRewards: () => Reward[];
  getExpiringRewards: () => Reward[];
  calculateCashback: (amount: number, source: Reward['source']) => number;
  updateLoyaltyTier: () => void;
  getSpendingSummary: (transactions: any[]) => SpendingSummary;
  syncWithBackend: () => Promise<void>;
}

// Cashback rates configuration
const CASHBACK_RATES: CashbackRate[] = [
  { source: 'booking', rate: 0.05, maxAmount: 100 }, // 5% cashback, max ₹100
  { source: 'referral', rate: 0.10, maxAmount: 200 }, // 10% for referrals
  { source: 'promo', rate: 1.0, maxAmount: 500 }, // Full promo credit
];

// Loyalty tier thresholds
const LOYALTY_TIERS = {
  bronze: { min: 0, cashbackBonus: 0, pointsMultiplier: 1 },
  silver: { min: 5000, cashbackBonus: 0.01, pointsMultiplier: 1.25 },
  gold: { min: 20000, cashbackBonus: 0.02, pointsMultiplier: 1.5 },
  platinum: { min: 50000, cashbackBonus: 0.05, pointsMultiplier: 2 },
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRewardExpiry(source: Reward['source']): string | undefined {
  const days = source === 'promo' ? 30 : source === 'achievement' ? 90 : 365;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString();
}

export const useRewardsStore = create<RewardsState>()(
  persist(
    (set, get) => ({
      points: 0,
      lifetimePoints: 0,
      rewards: [],
      cashbackBalance: 0,
      loyaltyTier: 'bronze',

      earnCashback: (amount, source, description) => {
        const cashback = get().calculateCashback(amount, source);
        if (cashback <= 0) return;

        const newReward: Reward = {
          id: generateId(),
          type: 'cashback',
          amount: cashback,
          source,
          description,
          createdAt: new Date().toISOString(),
          expiresAt: getRewardExpiry(source),
          used: false,
        };

        set(state => ({
          cashbackBalance: state.cashbackBalance + cashback,
          rewards: [newReward, ...state.rewards].slice(0, 100) as Reward[],
        }));
      },

      earnPoints: (points, source, description) => {
        const state = get();
        const tier = LOYALTY_TIERS[state.loyaltyTier];
        const bonusPoints = Math.floor(points * tier.pointsMultiplier);

        const newReward: Reward = {
          id: generateId(),
          type: 'points',
          amount: bonusPoints,
          source,
          description,
          createdAt: new Date().toISOString(),
          expiresAt: getRewardExpiry(source),
          used: false,
        };

        set(state => ({
          points: state.points + bonusPoints,
          lifetimePoints: state.lifetimePoints + bonusPoints,
          rewards: [newReward, ...state.rewards].slice(0, 100) as Reward[],
        }));

        get().updateLoyaltyTier();
      },

      redeemPoints: async (points, description) => {
        const state = get();
        if (state.points < points) return false;

        // Convert points to credits (100 points = ₹1)
        const credit = Math.floor(points / 100);

        set(state => ({
          points: state.points - points,
          rewards: [
            {
              id: generateId(),
              type: 'credits',
              amount: credit,
              source: 'achievement',
              description: `Redeemed: ${description}`,
              createdAt: new Date().toISOString(),
              used: false,
            },
            ...state.rewards,
          ],
        }));

        return true;
      },

      useReward: async (rewardId) => {
        const state = get();
        const reward = state.rewards.find(r => r.id === rewardId);

        if (!reward || reward.used) return false;

        if (reward.type === 'cashback' || reward.type === 'credits') {
          set(state => ({
            cashbackBalance: Math.max(0, state.cashbackBalance - reward.amount),
            rewards: state.rewards.map(r =>
              r.id === rewardId ? { ...r, used: true } : r
            ),
          }));
        }

        return true;
      },

      getAvailableRewards: () => {
        return get().rewards.filter(r => !r.used && (!r.expiresAt || new Date(r.expiresAt) > new Date()));
      },

      getExpiringRewards: () => {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        return get().rewards.filter(r =>
          !r.used &&
          r.expiresAt &&
          new Date(r.expiresAt) <= sevenDaysFromNow
        );
      },

      calculateCashback: (amount, source) => {
        const state = get();
        const rateConfig = CASHBACK_RATES.find(r => r.source === source);

        if (!rateConfig) return 0;

        let cashback = amount * rateConfig.rate;

        // Apply loyalty bonus
        const tier = LOYALTY_TIERS[state.loyaltyTier];
        cashback += cashback * tier.cashbackBonus;

        // Apply min/max
        if (rateConfig.minAmount && cashback < rateConfig.minAmount) {
          cashback = rateConfig.minAmount;
        }
        if (rateConfig.maxAmount && cashback > rateConfig.maxAmount) {
          cashback = rateConfig.maxAmount;
        }

        return Math.round(cashback);
      },

      updateLoyaltyTier: () => {
        const lifetimeSpent = get().lifetimePoints / 100; // Rough conversion

        let newTier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';

        if (lifetimeSpent >= LOYALTY_TIERS.platinum.min) {
          newTier = 'platinum';
        } else if (lifetimeSpent >= LOYALTY_TIERS.gold.min) {
          newTier = 'gold';
        } else if (lifetimeSpent >= LOYALTY_TIERS.silver.min) {
          newTier = 'silver';
        }

        if (newTier !== get().loyaltyTier) {
          set({ loyaltyTier: newTier });
        }
      },

      getSpendingSummary: (transactions) => {
        const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        const categoryBreakdown: Record<string, number> = {};
        transactions.forEach(t => {
          const cat = t.category || 'Other';
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (t.amount || 0);
        });

        const sortedCategories = Object.entries(categoryBreakdown)
          .sort(([, a], [, b]) => b - a);

        const topCategory = sortedCategories[0]?.[0] || 'Other';
        const averageOrderValue = transactions.length > 0 ? totalSpent / transactions.length : 0;

        // Calculate monthly trend (simplified)
        const monthlyTrend = 5; // Would calculate from actual data

        return {
          totalSpent,
          categoryBreakdown,
          monthlyTrend,
          averageOrderValue,
          topCategory,
        };
      },

      // Sync with backend
      syncWithBackend: async () => {
        try {
          // Fetch loyalty status from backend
          const statusResponse = await loyaltyApi.getStatus();
          if (statusResponse.success && statusResponse.data) {
            const statusData = statusResponse.data as any;
            set({
              points: statusData.coins,
              lifetimePoints: statusData.totalEarned,
              cashbackBalance: statusData.cashbackBalance || 0,
              loyaltyTier: statusData.tier || 'bronze',
            });
          }

          // Fetch rewards history from backend
          const historyResponse = await loyaltyApi.getHistory();
          if (historyResponse.success && historyResponse.data) {
            // Transform backend data to rewards format
            const rewards: Reward[] = historyResponse.data.history.map((item: any) => ({
              id: item._id || `reward-${Date.now()}`,
              type: item.type === 'earned' ? 'points' : 'cashback',
              amount: item.amount,
              source: 'achievement',
              description: item.description,
              createdAt: item.date,
              used: item.type === 'spent',
            }));
            set({ rewards });
          }
        } catch (error) {
          console.error('Failed to sync rewards with backend:', error);
        }
      },
    }),
    { name: 'nilin-rewards' }
  )
);

// Hook for rewards
export function useRewards() {
  const store = useRewardsStore();
  const availableRewards = store.getAvailableRewards();
  const expiringRewards = store.getExpiringRewards();
  const tierInfo = LOYALTY_TIERS[store.loyaltyTier];

  // Calculate next tier progress
  const currentTierThreshold = LOYALTY_TIERS[store.loyaltyTier].min;
  const nextTierThreshold = store.loyaltyTier === 'platinum' ? null :
    Object.values(LOYALTY_TIERS).find(t => t.min > currentTierThreshold)?.min;

  const progressToNextTier = nextTierThreshold
    ? Math.min(100, ((store.lifetimePoints / 100) / nextTierThreshold) * 100)
    : 100;

  return {
    ...store,
    availableRewards,
    expiringRewards,
    tierInfo,
    nextTierThreshold,
    progressToNextTier,
    pointsValue: Math.floor(store.points / 100), // ₹ value of points
  };
}

// Points to currency conversion
export function pointsToCurrency(points: number): number {
  return Math.floor(points / 100);
}

export default useRewardsStore;
