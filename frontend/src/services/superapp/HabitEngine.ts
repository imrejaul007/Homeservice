// Habit Engine - Streaks, achievements, and engagement loops
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { superAppApi } from '../superappApi';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'bookings' | 'spending' | 'engagement' | 'social' | 'special';
  requirement: number;
  progress: number;
  unlockedAt?: number;
  reward?: number;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  type: 'bookings' | 'spending' | 'checkin' | 'referral';
  target: number;
  progress: number;
  reward: number;
  expiresAt: number;
  completed: boolean;
}

export interface HabitState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  achievements: Achievement[];
  totalPoints: number;
  dailyCheckIns: number;
  weeklyGoals: Record<string, boolean>;

  // Streak freeze
  streakFreezeUsed: number;
  lastStreakFreezeWeek: string;

  // Weekly challenges
  weeklyChallenges: WeeklyChallenge[];

  // Actions
  checkIn: () => CheckInResult;
  updateAchievementProgress: (achievementId: string, progress: number) => void;
  unlockAchievement: (achievementId: string) => void;
  resetStreak: () => void;
  getStreakStatus: () => StreakStatus;

  // Streak freeze actions
  useStreakFreeze: () => boolean;
  getStreakFreezeStatus: () => { available: boolean; usedThisWeek: boolean; nextRefreshDays: number; freezeAvailable: boolean };

  // Weekly challenges
  getWeeklyChallenge: (challengeId: string) => WeeklyChallenge | undefined;
  updateChallengeProgress: (challengeId: string, progress: number) => void;
  claimChallengeReward: (challengeId: string) => boolean;
  generateWeeklyChallenges: () => void;

  // Milestone celebration
  shouldCelebrateMilestone: () => { celebrate: boolean; milestone: number } | null;
  clearMilestoneCelebration: () => void;

  // Backend sync
  syncWithBackend: () => Promise<void>;
}

export interface CheckInResult {
  success: boolean;
  streakIncreased: boolean;
  newStreak: number;
  pointsEarned: number;
  newAchievements: Achievement[];
  level: number;
  streakProtected: boolean;
  milestoneReached: number | null;
}

export interface StreakStatus {
  status: 'active' | 'at_risk' | 'broken';
  daysUntilLoss: number;
  encouragement: string;
  freezeAvailable: boolean;
  protectionMessage?: string;
}

export interface ReengagementNudge {
  title: string;
  message: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  // Booking achievements
  { id: 'first_booking', title: 'First Step', description: 'Complete your first booking', icon: '🎯', category: 'bookings', requirement: 1, progress: 0 },
  { id: 'five_bookings', title: 'Regular', description: 'Complete 5 bookings', icon: '🔄', category: 'bookings', requirement: 5, progress: 0 },
  { id: 'ten_bookings', title: 'Loyal Customer', description: 'Complete 10 bookings', icon: '⭐', category: 'bookings', requirement: 10, progress: 0 },
  { id: 'twentyfive_bookings', title: 'Super User', description: 'Complete 25 bookings', icon: '🌟', category: 'bookings', requirement: 25, progress: 0 },
  { id: 'hundred_bookings', title: 'Legend', description: 'Complete 100 bookings', icon: '👑', category: 'bookings', requirement: 100, progress: 0 },

  // Streak achievements
  { id: 'streak_3', title: 'Getting Started', description: 'Maintain a 3-day streak', icon: '🔥', category: 'engagement', requirement: 3, progress: 0 },
  { id: 'streak_7', title: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'engagement', requirement: 7, progress: 0 },
  { id: 'streak_30', title: 'Month Master', description: 'Maintain a 30-day streak', icon: '🔥', category: 'engagement', requirement: 30, progress: 0 },
  { id: 'streak_100', title: 'Unstoppable', description: 'Maintain a 100-day streak', icon: '🔥', category: 'engagement', requirement: 100, progress: 0 },

  // Spending achievements
  { id: 'spent_1000', title: 'Getting Started', description: 'Spend ₹1,000', icon: '💰', category: 'spending', requirement: 1000, progress: 0 },
  { id: 'spent_10000', title: 'Premium', description: 'Spend ₹10,000', icon: '💎', category: 'spending', requirement: 10000, progress: 0 },
  { id: 'spent_50000', title: 'VIP', description: 'Spend ₹50,000', icon: '👑', category: 'spending', requirement: 50000, progress: 0 },

  // Social achievements
  { id: 'first_review', title: 'Voice Matters', description: 'Write your first review', icon: '✍️', category: 'social', requirement: 1, progress: 0 },
  { id: 'first_referral', title: 'Word Spreader', description: 'Refer your first friend', icon: '👥', category: 'social', requirement: 1, progress: 0 },
  { id: 'five_referrals', title: 'Influencer', description: 'Refer 5 friends', icon: '🌟', category: 'social', requirement: 5, progress: 0 },

  // Special achievements
  { id: 'early_bird', title: 'Early Bird', description: 'Book before 9 AM', icon: '🌅', category: 'special', requirement: 1, progress: 0 },
  { id: 'weekend_warrior', title: 'Weekend Warrior', description: 'Book on 5 weekends', icon: '🎉', category: 'special', requirement: 5, progress: 0 },
];

// Weekly challenge templates
const WEEKLY_CHALLENGE_TEMPLATES: Omit<WeeklyChallenge, 'expiresAt' | 'progress' | 'completed'>[] = [
  { id: 'wc_book_2', title: 'Book 2 Services', description: 'Complete 2 bookings this week', type: 'bookings', target: 2, reward: 100 },
  { id: 'wc_spend_500', title: 'Spa Week', description: 'Spend AED 500+ on services', type: 'spending', target: 500, reward: 150 },
  { id: 'wc_checkin_5', title: 'Daily Check-in', description: 'Check in 5 days this week', type: 'checkin', target: 5, reward: 50 },
  { id: 'wc_refer_1', title: 'Share the Love', description: 'Refer a friend this week', type: 'referral', target: 1, reward: 200 },
  { id: 'wc_book_3', title: 'Service Explorer', description: 'Book 3 different services', type: 'bookings', target: 3, reward: 175 },
  { id: 'wc_spend_1000', title: 'Premium Week', description: 'Spend AED 1000+ this week', type: 'spending', target: 1000, reward: 300 },
];

// Milestone definitions for celebrations
const MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getCurrentWeekKey(): string {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum}`;
}

function getWeekEndDate(): Date {
  const now = new Date();
  const daysUntilSunday = 7 - now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function calculateLevel(points: number): number {
  // Level up every 500 points
  return Math.floor(points / 500) + 1;
}

function getEncouragement(streak: number): string {
  if (streak === 0) return "Start your streak today!";
  if (streak < 3) return `${streak}-day streak! Keep it going!`;
  if (streak < 7) return `${streak} days! You're building a habit!`;
  if (streak < 30) return `Amazing ${streak}-day streak!`;
  return `${streak}-day legend! You're unstoppable!`;
}

function getMilestoneEncouragement(milestone: number): string {
  if (milestone === 7) return "One week strong!";
  if (milestone === 14) return "Two weeks of dedication!";
  if (milestone === 21) return "Three weeks - habit formed!";
  if (milestone === 30) return "A full month! Incredible!";
  if (milestone === 50) return "50 days - you're unstoppable!";
  if (milestone === 100) return "100 days - legendary status!";
  if (milestone === 365) return "One full year! Hero status!";
  return `${milestone} days - milestone reached!`;
}

function checkMilestone(newStreak: number, previousStreak: number): number | null {
  for (const milestone of MILESTONES) {
    if (newStreak >= milestone && previousStreak < milestone) {
      return milestone;
    }
  }
  return null;
}

function getDaysUntilNextSunday(): number {
  const now = new Date();
  const daysUntilSunday = 7 - now.getDay();
  return daysUntilSunday === 7 ? 0 : daysUntilSunday;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      achievements: ACHIEVEMENTS.map(a => ({ ...a })),
      totalPoints: 0,
      dailyCheckIns: 0,
      weeklyGoals: {},

      // Streak freeze
      streakFreezeUsed: 0,
      lastStreakFreezeWeek: '',

      // Weekly challenges
      weeklyChallenges: [],

      checkIn: (): CheckInResult => {
        const state = get();
        const today = getToday();
        const yesterday = getYesterday();
        const currentWeek = getCurrentWeekKey();

        // Check if already checked in today
        if (state.lastActiveDate === today) {
          return {
            success: false,
            streakIncreased: false,
            newStreak: state.currentStreak,
            pointsEarned: 0,
            newAchievements: [],
            level: calculateLevel(state.totalPoints),
            streakProtected: false,
            milestoneReached: null,
          };
        }

        // Check if streak freeze can be used
        let streakProtected = false;
        let newStreak = 1;

        if (state.lastActiveDate !== yesterday) {
          // Streak is about to break
          const { freezeAvailable } = state.getStreakFreezeStatus();
          if (freezeAvailable && state.currentStreak > 0) {
            // Auto-use streak freeze for active streaks
            state.useStreakFreeze();
            newStreak = state.currentStreak + 1;
            streakProtected = true;
          }
        } else {
          newStreak = state.currentStreak + 1;
        }

        const previousStreak = state.currentStreak;

        // Check for milestone
        const milestoneReached = checkMilestone(newStreak, previousStreak);

        // Calculate points
        const basePoints = 10;
        const streakBonus = Math.min(newStreak * 2, 50);
        const milestoneBonus = milestoneReached ? milestoneReached * 5 : 0;
        const pointsEarned = basePoints + streakBonus + milestoneBonus;

        // Check for new achievements
        const newAchievements: Achievement[] = [];
        const updatedAchievements = state.achievements.map(achievement => {
          const updated = { ...achievement };

          // Update streak achievements
          if (achievement.category === 'engagement' && achievement.id.startsWith('streak_')) {
            if (newStreak >= achievement.requirement && !achievement.unlockedAt) {
              updated.unlockedAt = Date.now();
              updated.progress = achievement.requirement;
              newAchievements.push(updated);
            } else {
              updated.progress = newStreak;
            }
          }

          return updated;
        });

        // Update check-in challenge progress
        const updatedChallenges = state.weeklyChallenges.map(challenge => {
          if (challenge.type === 'checkin' && !challenge.completed) {
            const newProgress = challenge.progress + 1;
            return {
              ...challenge,
              progress: newProgress,
              completed: newProgress >= challenge.target,
            };
          }
          return challenge;
        });

        // Update state
        set({
          currentStreak: newStreak,
          longestStreak: Math.max(state.longestStreak, newStreak),
          lastActiveDate: today,
          achievements: updatedAchievements,
          totalPoints: state.totalPoints + pointsEarned,
          dailyCheckIns: state.dailyCheckIns + 1,
          weeklyChallenges: updatedChallenges,
        });

        return {
          success: true,
          streakIncreased: newStreak > previousStreak,
          newStreak,
          pointsEarned,
          newAchievements,
          level: calculateLevel(state.totalPoints + pointsEarned),
          streakProtected,
          milestoneReached,
        };
      },

      updateAchievementProgress: (achievementId, progress) => {
        set(state => ({
          achievements: state.achievements.map(a =>
            a.id === achievementId ? { ...a, progress } : a
          ),
        }));
      },

      unlockAchievement: (achievementId) => {
        set(state => {
          const achievement = state.achievements.find(a => a.id === achievementId);
          if (!achievement || achievement.unlockedAt) return state;

          const reward = achievement.reward || Math.floor(achievement.requirement * 5);

          return {
            achievements: state.achievements.map(a =>
              a.id === achievementId
                ? { ...a, unlockedAt: Date.now(), progress: a.requirement }
                : a
            ),
            totalPoints: state.totalPoints + reward,
          };
        });
      },

      resetStreak: () => {
        set({ currentStreak: 0 });
      },

      getStreakStatus: (): StreakStatus => {
        const state = get();
        const today = getToday();
        const yesterday = getYesterday();
        const { freezeAvailable } = state.getStreakFreezeStatus();

        if (state.lastActiveDate === today) {
          return {
            status: 'active',
            daysUntilLoss: 1,
            encouragement: getEncouragement(state.currentStreak),
            freezeAvailable,
            protectionMessage: freezeAvailable ? "Your streak is safe if you miss tomorrow!" : undefined,
          };
        }

        if (state.lastActiveDate === yesterday) {
          return {
            status: 'at_risk',
            daysUntilLoss: 0,
            encouragement: "Check in today to keep your streak!",
            freezeAvailable,
            protectionMessage: freezeAvailable
              ? "Don't worry! You have a streak freeze available!"
              : "Your streak will reset tomorrow if you don't check in.",
          };
        }

        return {
          status: 'broken',
          daysUntilLoss: 0,
          encouragement: "Start a new streak today!",
          freezeAvailable: false,
        };
      },

      useStreakFreeze: (): boolean => {
        const state = get();
        const currentWeek = getCurrentWeekKey();

        if (state.lastStreakFreezeWeek === currentWeek) {
          return false; // Already used this week
        }

        set({
          streakFreezeUsed: state.streakFreezeUsed + 1,
          lastStreakFreezeWeek: currentWeek,
        });

        return true;
      },

      getStreakFreezeStatus: () => {
        const state = get();
        const currentWeek = getCurrentWeekKey();
        const usedThisWeek = state.lastStreakFreezeWeek === currentWeek;
        const available = !usedThisWeek;

        return {
          available,
          usedThisWeek,
          nextRefreshDays: usedThisWeek ? getDaysUntilNextSunday() : 0,
          freezeAvailable: available,
        };
      },

      getWeeklyChallenge: (challengeId: string): WeeklyChallenge | undefined => {
        const state = get();
        return state.weeklyChallenges.find(c => c.id === challengeId);
      },

      updateChallengeProgress: (challengeId: string, progress: number) => {
        set(state => ({
          weeklyChallenges: state.weeklyChallenges.map(c => {
            if (c.id === challengeId && !c.completed) {
              return {
                ...c,
                progress: Math.min(progress, c.target),
                completed: progress >= c.target,
              };
            }
            return c;
          }),
        }));
      },

      claimChallengeReward: (challengeId: string): boolean => {
        const state = get();
        const challenge = state.weeklyChallenges.find(c => c.id === challengeId);

        if (!challenge || !challenge.completed) {
          return false;
        }

        set({
          totalPoints: state.totalPoints + challenge.reward,
          weeklyChallenges: state.weeklyChallenges.map(c =>
            c.id === challengeId ? { ...c, completed: true } : c
          ),
        });

        return true;
      },

      generateWeeklyChallenges: () => {
        const state = get();
        const currentWeek = getCurrentWeekKey();

        // Check if we already have challenges for this week
        const existingChallenge = state.weeklyChallenges[0];
        if (existingChallenge) {
          const existingWeek = getCurrentWeekKey();
          // Challenges already generated for this week
          return;
        }

        // Generate 2 random challenges for the week
        const shuffled = [...WEEKLY_CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
        const selectedChallenges = shuffled.slice(0, 2).map(template => ({
          ...template,
          progress: 0,
          expiresAt: getWeekEndDate().getTime(),
          completed: false,
        }));

        set({
          weeklyChallenges: selectedChallenges,
        });
      },

      shouldCelebrateMilestone: () => {
        const state = get();
        const lastCelebrated = localStorage.getItem('last_milestone_celebration');

        if (lastCelebrated) {
          const celebratedMilestone = parseInt(lastCelebrated, 10);
          if (state.currentStreak >= celebratedMilestone) {
            return null;
          }
        }

        for (const milestone of MILESTONES) {
          if (state.currentStreak >= milestone) {
            return { celebrate: true, milestone };
          }
        }

        return null;
      },

      clearMilestoneCelebration: () => {
        const state = get();
        localStorage.setItem('last_milestone_celebration', state.currentStreak.toString());
      },

      // Sync with backend
      syncWithBackend: async () => {
        try {
          // Fetch streak data from backend
          const streakResponse = await superAppApi.getStreak();
          if (streakResponse.success && streakResponse.data) {
            set({
              currentStreak: streakResponse.data.currentStreak,
              longestStreak: streakResponse.data.longestStreak,
              lastActiveDate: streakResponse.data.lastCheckIn
                ? new Date(streakResponse.data.lastCheckIn).toISOString()
                : new Date().toISOString(),
            });
          }

          // Fetch achievements from backend
          const habitsResponse = await superAppApi.getHabits();
          if (habitsResponse.success && habitsResponse.data) {
            set({ achievements: habitsResponse.data.achievements });

            // Set weekly challenge if exists
            if (habitsResponse.data.weeklyChallenge) {
              set({
                weeklyChallenges: [habitsResponse.data.weeklyChallenge]
              });
            }
          }
        } catch (error) {
          console.error('Failed to sync habits with backend:', error);
        }
      },
    }),
    { name: 'nilin-habits' }
  )
);

// Hook for habit system
export function useHabits() {
  const store = useHabitStore();
  const status = store.getStreakStatus();
  const unlockedCount = store.achievements.filter(a => a.unlockedAt).length;
  const level = calculateLevel(store.totalPoints);
  const freezeStatus = store.getStreakFreezeStatus();

  return {
    ...store,
    status,
    freezeStatus,
    unlockedCount,
    totalAchievements: store.achievements.length,
    level,
    progress: Math.round((unlockedCount / store.achievements.length) * 100),
  };
}

// Re-engagement hook
export function useReengagement(): {
  shouldShowReengagement: () => boolean;
  getReengagementNudge: () => ReengagementNudge | null;
  getDaysSinceActive: () => number;
} {
  const store = useHabitStore();

  const getDaysSinceActive = (): number => {
    const lastActive = store.lastActiveDate;
    if (!lastActive) return 999;

    const lastDate = new Date(lastActive);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const shouldShowReengagement = (): boolean => {
    const daysSinceActive = getDaysSinceActive();
    return daysSinceActive >= 7; // 1 week inactive
  };

  const getReengagementNudge = (): ReengagementNudge | null => {
    const daysSinceActive = getDaysSinceActive();
    const streak = store.currentStreak;
    const longestStreak = store.longestStreak;

    if (daysSinceActive < 7) return null;

    // Prioritize based on user history
    if (longestStreak >= 30) {
      return {
        title: "We miss you, champion!",
        message: `It's been ${daysSinceActive} days since your last visit. Your ${longestStreak}-day streak is waiting!`,
        action: 'continue_streak',
        priority: 'high',
      };
    }

    if (streak > 0) {
      return {
        title: "Don't lose your streak!",
        message: `${daysSinceActive} days away. You had a ${streak}-day streak going!`,
        action: 'book_cleaning',
        priority: 'high',
      };
    }

    if (longestStreak >= 7) {
      return {
        title: "Your streak wants you back!",
        message: `It's been ${daysSinceActive} days. Start where you left off with a ${longestStreak}-day streak!`,
        action: 'restart_streak',
        priority: 'medium',
      };
    }

    return {
      title: "We miss you!",
      message: `Your last booking was ${daysSinceActive} days ago. Ready to book again?`,
      action: 'book_cleaning',
      priority: 'low',
    };
  };

  return {
    shouldShowReengagement,
    getReengagementNudge,
    getDaysSinceActive,
  };
}

// Milestone celebration hook
export function useMilestoneCelebration(): {
  shouldCelebrate: { celebrate: boolean; milestone: number } | null;
  clearCelebration: () => void;
  getCelebrationMessage: () => string;
} {
  const store = useHabitStore();
  const shouldCelebrate = store.shouldCelebrateMilestone();

  return {
    shouldCelebrate,
    clearCelebration: store.clearMilestoneCelebration,
    getCelebrationMessage: () => {
      if (!shouldCelebrate) return '';
      return getMilestoneEncouragement(shouldCelebrate.milestone);
    },
  };
}

// Weekly challenges hook
export function useWeeklyChallenges(): {
  challenges: WeeklyChallenge[];
  activeChallenge: WeeklyChallenge | null;
  claimReward: (challengeId: string) => boolean;
  refreshChallenges: () => void;
} {
  const store = useHabitStore();

  // Generate challenges on first use
  if (store.weeklyChallenges.length === 0) {
    store.generateWeeklyChallenges();
  }

  // Filter out expired challenges
  const now = Date.now();
  const validChallenges = store.weeklyChallenges.filter(c => c.expiresAt > now);
  const activeChallenge = validChallenges.find(c => !c.completed) || null;

  return {
    challenges: validChallenges,
    activeChallenge,
    claimReward: store.claimChallengeReward,
    refreshChallenges: store.generateWeeklyChallenges,
  };
}

export default useHabitStore;
