// Hyper-Personalization Engine
// Deep user behavior modeling and contextual personalization

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPreferenceProfile {
  // Demographics
  preferredLocation?: { lat: number; lng: number; address: string };
  preferredTimeSlots: ('morning' | 'afternoon' | 'evening' | 'night')[];
  preferredDays: number[]; // 0-6

  // Behavior patterns
  bookingFrequency: 'weekly' | 'biweekly' | 'monthly' | 'rarely';
  averageBudget: number;
  budgetRange: { min: number; max: number };

  // Service preferences
  favoriteCategories: string[];
  preferredProviders: string[];
  avoidedProviders: string[];

  // Engagement patterns
  preferredNotificationTime?: string;
  prefersCalls?: boolean;
  prefersChat?: boolean;

  // Context
  homeOwner: boolean;
  hasPets: boolean;
  hasChildren: boolean;
  worksFromHome: boolean;

  // ML-ready features
  engagementScore: number;
  churnRisk: 'low' | 'medium' | 'high';
  ltvTier: 'bronze' | 'silver' | 'gold' | 'platinum';

  // Timestamps
  lastUpdated: number;
  profileCompleteness: number;
}

interface PersonalizationState {
  profile: UserPreferenceProfile;

  // Actions
  updatePreference: <K extends keyof UserPreferenceProfile>(
    key: K,
    value: UserPreferenceProfile[K]
  ) => void;
  updateMultiple: (updates: Partial<UserPreferenceProfile>) => void;
  calculateProfileCompleteness: () => number;
  getPersonalizationContext: () => PersonalizationContext;
}

export interface PersonalizationContext {
  timeContext: 'morning' | 'afternoon' | 'evening' | 'night';
  dayContext: 'weekday' | 'weekend';
  locationContext: 'home' | 'work' | 'travel';
  seasonContext: string;
  userProfile: UserPreferenceProfile;
  sessionCount: number;
  daysSinceLastBooking: number;
}

// Time-aware context
function getTimeContext(): PersonalizationContext['timeContext'] {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getDayContext(): PersonalizationContext['dayContext'] {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

export const usePersonalizationStore = create<PersonalizationState>()(
  persist(
    (set, get) => ({
      profile: {
        preferredTimeSlots: [],
        preferredDays: [],
        bookingFrequency: 'monthly',
        averageBudget: 500,
        budgetRange: { min: 200, max: 1500 },
        favoriteCategories: [],
        preferredProviders: [],
        avoidedProviders: [],
        engagementScore: 0,
        churnRisk: 'low',
        ltvTier: 'bronze',
        lastUpdated: Date.now(),
        profileCompleteness: 0,
        homeOwner: false,
        hasPets: false,
        hasChildren: false,
        worksFromHome: false,
      },

      updatePreference: (key, value) =>
        set((state) => {
          const profile = { ...state.profile, [key]: value, lastUpdated: Date.now() };
          profile.profileCompleteness = calculateProfileCompleteness(profile);
          return { profile };
        }),

      updateMultiple: (updates) =>
        set((state) => {
          const profile = { ...state.profile, ...updates, lastUpdated: Date.now() };
          profile.profileCompleteness = calculateProfileCompleteness(profile);
          return { profile };
        }),

      calculateProfileCompleteness: () => {
        const profile = get().profile;
        return calculateProfileCompleteness(profile);
      },

      getPersonalizationContext: (): PersonalizationContext => {
        const profile = get().profile;
        return {
          timeContext: getTimeContext(),
          dayContext: getDayContext(),
          locationContext: 'home', // Would be determined by GPS
          seasonContext: getSeason(),
          userProfile: profile,
          sessionCount: 1, // Would track actual sessions
          daysSinceLastBooking: 0, // Would calculate from actual data
        };
      },
    }),
    { name: 'nilin-personalization' }
  )
);

function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function calculateProfileCompleteness(profile: UserPreferenceProfile): number {
  const fields = [
    profile.preferredLocation,
    profile.preferredTimeSlots.length > 0,
    profile.preferredDays.length > 0,
    profile.bookingFrequency,
    profile.averageBudget > 0,
    profile.favoriteCategories.length > 0,
    profile.homeOwner !== undefined,
    profile.hasPets !== undefined,
    profile.hasChildren !== undefined,
  ];

  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

// Personalized recommendation context
export function usePersonalizationContext() {
  return usePersonalizationStore((state) => state.getPersonalizationContext());
}

// Hook for personalization
export function usePersonalization() {
  const { profile, updatePreference, updateMultiple } = usePersonalizationStore();
  const context = usePersonalizationStore((state) => state.getPersonalizationContext());

  // Calculate engagement score
  const engagementScore = profile.engagementScore;

  // Churn prediction (simplified)
  const churnRisk = (() => {
    if (profile.engagementScore > 80) return 'low';
    if (profile.engagementScore > 50) return 'medium';
    return 'high';
  })();

  // LTV tier
  const ltvTier = (() => {
    if (profile.engagementScore >= 95) return 'platinum';
    if (profile.engagementScore >= 80) return 'gold';
    if (profile.engagementScore >= 60) return 'silver';
    return 'bronze';
  })();

  return {
    profile,
    context,
    engagementScore,
    churnRisk,
    ltvTier,
    updatePreference,
    updateMultiple,
    isHighlyEngaged: engagementScore > 80,
    needsReengagement: churnRisk === 'high',
  };
}

export default usePersonalizationStore;
