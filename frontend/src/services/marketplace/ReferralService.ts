// Referral & Growth Service - Viral growth loops and rewards
import { create } from 'zustand';

const DEFAULT_REFERRER_REWARD = 500;
const DEFAULT_REFEREE_REWARD = 250;
import { persist } from 'zustand/middleware';
import { useCallback } from 'react';
import { analytics } from '../product/AnalyticsService';
import authService from '../AuthService';

export interface ReferralCode {
  code: string;
  userId: string;
  createdAt: number;
  uses: number;
  rewards: {
    referrer: number; // Credits for referrer
    referee: number; // Credits for new user
  };
}

// Unified ReferralData interface shared across all files
export interface ReferralData {
  referralCode: string;
  referralUrl?: string;
  referrerReward?: number;
  refereeReward?: number;
  totalReferrals?: number;
  successfulReferrals?: number;
  totalRewardsEarned?: number;
}

export interface ReferralMetrics {
  referralCode: string;
  totalInvites: number;
  successfulReferrals: number;
  totalEarned: number;
  conversionRate: number;
}

// Get referral source (for deep link tracking) - defined before use to avoid hoisting issues
function getSource(): string {
  if (typeof window === 'undefined') return 'direct';
  const params = new URLSearchParams(window.location.search);
  return params.get('utm_source') || params.get('ref') || 'direct';
}

interface ReferralState {
  referralCode: ReferralCode | null;
  referrals: {
    id: string;
    invitedAt: number;
    status: 'pending' | 'completed' | 'rewarded';
    earnedCredits: number;
  }[];
  metrics: ReferralMetrics | null;

  // Actions
  setReferralCode: (code: ReferralCode) => void;
  addReferral: (referral: { id: string }) => void;
  markReferralCompleted: (id: string, credits: number) => void;
  getShareableLink: () => string;
  trackShare: (platform: string) => void;
  syncWithBackend: () => Promise<void>;
}

export const useReferralStore = create<ReferralState>()(
  persist(
    (set, get) => ({
      referralCode: null,
      referrals: [],
      metrics: null,

      setReferralCode: (code) => set({ referralCode: code }),

      addReferral: (referral) =>
        set((state) => ({
          referrals: [
            ...state.referrals,
            {
              ...referral,
              invitedAt: Date.now(),
              status: 'pending',
              earnedCredits: 0,
            },
          ],
        })),

      markReferralCompleted: (id, credits) =>
        set((state) => ({
          referrals: state.referrals.map((r) =>
            r.id === id ? { ...r, status: 'rewarded', earnedCredits: credits } : r
          ),
          metrics: state.metrics
            ? {
                ...state.metrics,
                successfulReferrals: state.metrics.successfulReferrals + 1,
                totalEarned: state.metrics.totalEarned + credits,
                conversionRate:
                  (state.metrics.successfulReferrals + 1) / state.metrics.totalInvites,
              }
            : null,
        })),

      getShareableLink: () => {
        const code = get().referralCode;
        if (!code) return '';
        return `https://nilin.app/invite/${code.code}?ref=${getSource()}`;
      },

      trackShare: (platform) => {
        // Track share event for analytics
        console.log(`[Referral] Shared via ${platform}`);
        analytics.trackReferralEvent('share', { platform });
        analytics.trackViralEvent('invite_sent', { platform });
      },

      // Sync with backend
      syncWithBackend: async () => {
        try {
          // Fetch referral code from backend
          const codeResponse = await authService.getReferralCode();
          if (codeResponse.success && codeResponse.data) {
            set({
              referralCode: {
                code: codeResponse.data.code,
                userId: '', // Not provided by API
                createdAt: codeResponse.data.createdAt ? new Date(codeResponse.data.createdAt).getTime() : Date.now(),
                uses: codeResponse.data.totalUses || 0,
                rewards: {
                  referrer: codeResponse.data.referrerReward || DEFAULT_REFERRER_REWARD,
                  referee: codeResponse.data.refereeReward || DEFAULT_REFEREE_REWARD,
                },
              },
            });
          }

          // Fetch referral stats from backend
          const statsResponse = await authService.getReferralStats();
          if (statsResponse.success && statsResponse.data) {
            set({
              metrics: {
                referralCode: get().referralCode?.code || '',
                totalInvites: statsResponse.data.totalReferrals || 0,
                successfulReferrals: statsResponse.data.successfulReferrals || 0,
                totalEarned: statsResponse.data.totalEarned || 0,
                conversionRate: statsResponse.data.totalReferrals > 0
                  ? (statsResponse.data.successfulReferrals / statsResponse.data.totalReferrals) * 100
                  : 0,
              },
            });
          }
        } catch (error) {
          console.error('Failed to sync referrals with backend:', error);
        }
      },
    }),
    { name: 'nilin-referral' }
  )
);

// Referral reward calculation
export function calculateReferralReward(referralCount: number): number {
  // Tiered rewards
  if (referralCount >= 10) return 200; // Gold tier
  if (referralCount >= 5) return 150; // Silver tier
  if (referralCount >= 1) return 100; // Bronze tier
  return 100; // Default
}

// Share message templates
export function getShareMessage(referralCode: string, refereeReward?: number, referrerReward?: number): string {
  // Import currency config dynamically to avoid circular dependencies
  const { symbol } = getCurrencyConfig();
  const actualRefereeReward = refereeReward || DEFAULT_REFEREE_REWARD;
  const actualReferrerReward = referrerReward || DEFAULT_REFERRER_REWARD;
  const formattedRefereeReward = `${symbol}${actualRefereeReward}`;
  const formattedReferrerReward = `${symbol}${actualReferrerReward}`;
  return `Hey! Get ${formattedRefereeReward} off your first booking on NILIN! Use my code: ${referralCode} - You get ${formattedRefereeReward}, I get ${formattedReferrerReward} too! Win-win! 🎉\n\nDownload app: https://nilin.app/invite/${referralCode}`;
}

// Get currency configuration from environment
function getCurrencyConfig(): { code: string; symbol: string } {
  const symbols: Record<string, string> = {
    AED: 'د.إ',
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    SAR: 'ر.س',
  };
  return {
    code: import.meta.env.VITE_CURRENCY_CODE || 'AED',
    symbol: import.meta.env.VITE_CURRENCY_SYMBOL || symbols[import.meta.env.VITE_CURRENCY_CODE || 'AED'] || 'د.إ',
  };
}

// Get deep link for referral
export function getDeepLink(referralCode: string): string {
  return `https://nilin.app/invite/${referralCode}?ref=${getSource()}`;
}

// Share to platform
export async function shareToPlatform(
  platform: 'whatsapp' | 'sms' | 'copy',
  referralCode: string,
  refereeReward?: number,
  referrerReward?: number
): Promise<boolean> {
  const message = getShareMessage(referralCode, refereeReward, referrerReward);

  switch (platform) {
    case 'whatsapp':
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        '_blank'
      );
      return true;

    case 'sms':
      window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
      return true;

    case 'copy':
      try {
        await navigator.clipboard.writeText(message);
        return true;
      } catch {
        return false;
      }

    default:
      return false;
  }
}

// Growth milestones
export interface GrowthMilestone {
  id: string;
  type: 'bookings' | 'referrals' | 'spending_value' | 'reviews';
  threshold: number;
  title: string;
  description: string;
  reward?: number;
}

export const GROWTH_MILESTONES: GrowthMilestone[] = [
  {
    id: 'first_booking',
    type: 'bookings',
    threshold: 1,
    title: 'First Booking',
    description: 'Complete your first booking',
    reward: 50,
  },
  {
    id: 'five_bookings',
    type: 'bookings',
    threshold: 5,
    title: 'Regular Customer',
    description: 'Complete 5 bookings',
    reward: 150,
  },
  {
    id: 'ten_bookings',
    type: 'bookings',
    threshold: 10,
    title: 'Loyal Customer',
    description: 'Complete 10 bookings',
    reward: 300,
  },
  {
    id: 'first_referral',
    type: 'referrals',
    threshold: 1,
    title: 'Word Spreader',
    description: 'Refer your first friend',
    reward: 100,
  },
  {
    id: 'five_referrals',
    type: 'referrals',
    threshold: 5,
    title: 'Influencer',
    description: 'Refer 5 friends',
    reward: 500,
  },
  {
    id: 'first_review',
    type: 'reviews',
    threshold: 1,
    title: 'Reviewer',
    description: 'Leave your first review',
    reward: 25,
  },
];

// Hook for milestones
import { useAuthStore } from '../../stores/authStore';

export function useGrowthMilestones() {
  const { user } = useAuthStore();
  const referralMetrics = useReferralStore((s) => s.metrics);

  const getCompletedMilestones = useCallback(
    (stats: { bookings: number; referrals: number; reviews: number }) => {
      return GROWTH_MILESTONES.filter((m) => {
        switch (m.type) {
          case 'bookings':
            return stats.bookings >= m.threshold;
          case 'referrals':
            return stats.referrals >= m.threshold;
          case 'reviews':
            return stats.reviews >= m.threshold;
          default:
            return false;
        }
      });
    },
    []
  );

  const getNextMilestone = useCallback(
    (stats: { bookings: number; referrals: number; reviews: number }) => {
      return GROWTH_MILESTONES.find((m) => {
        switch (m.type) {
          case 'bookings':
            return stats.bookings < m.threshold;
          case 'referrals':
            return stats.referrals < m.threshold;
          case 'reviews':
            return stats.reviews < m.threshold;
          default:
            return false;
        }
      });
    },
    []
  );

  const getProgress = useCallback(
    (stats: { bookings: number; referrals: number; reviews: number }) => {
      const completed = getCompletedMilestones(stats);
      const total = GROWTH_MILESTONES.length;
      return Math.round((completed.length / total) * 100);
    },
    [getCompletedMilestones]
  );

  return {
    milestones: GROWTH_MILESTONES,
    getCompletedMilestones,
    getNextMilestone,
    getProgress,
  };
}

export default useReferralStore;
