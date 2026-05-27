import User from '../models/user.model';
import logger from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

interface Achievement {
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

interface WeeklyChallenge {
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

const ACHIEVEMENTS = [
  { id: 'first_booking', title: 'First Steps', description: 'Complete your first booking', icon: '🎯', category: 'bookings' as const, requirement: 1, reward: 50 },
  { id: 'five_bookings', title: 'Regular Customer', description: 'Complete 5 bookings', icon: '⭐', category: 'bookings' as const, requirement: 5, reward: 100 },
  { id: 'ten_bookings', title: 'Loyal Customer', description: 'Complete 10 bookings', icon: '💎', category: 'bookings' as const, requirement: 10, reward: 200 },
  { id: 'twentyfive_bookings', title: 'VIP Customer', description: 'Complete 25 bookings', icon: '👑', category: 'bookings' as const, requirement: 25, reward: 500 },
  { id: 'hundred_bookings', title: 'Legendary', description: 'Complete 100 bookings', icon: '🏆', category: 'bookings' as const, requirement: 100, reward: 1000 },
  { id: 'spent_500', title: 'First Spent', description: 'Spend ₹500 on services', icon: '💰', category: 'spending' as const, requirement: 500, reward: 50 },
  { id: 'spent_5000', title: 'Big Spender', description: 'Spend ₹5,000 on services', icon: '💎', category: 'spending' as const, requirement: 5000, reward: 200 },
  { id: 'spent_25000', title: 'Premium', description: 'Spend ₹25,000 on services', icon: '👑', category: 'spending' as const, requirement: 25000, reward: 500 },
  { id: 'seven_day_streak', title: 'Week Warrior', description: 'Maintain 7-day streak', icon: '🔥', category: 'engagement' as const, requirement: 7, reward: 100 },
  { id: 'thirty_day_streak', title: 'Month Master', description: 'Maintain 30-day streak', icon: '⚡', category: 'engagement' as const, requirement: 30, reward: 300 },
  { id: 'referrer', title: 'Social Butterfly', description: 'Refer your first friend', icon: '🦋', category: 'social' as const, requirement: 1, reward: 100 },
  { id: 'five_referrals', title: 'Influencer', description: 'Refer 5 friends', icon: '🌟', category: 'social' as const, requirement: 5, reward: 500 },
];

const WEEKLY_CHALLENGES = [
  { id: 'weekly_1', title: 'Book 2 Services', description: 'Complete 2 bookings this week', type: 'bookings' as const, target: 2, reward: 50 },
  { id: 'weekly_2', title: 'Spend ₹500', description: 'Spend ₹500 on services', type: 'spending' as const, target: 500, reward: 50 },
  { id: 'weekly_3', title: 'Check In Daily', description: 'Check in every day this week', type: 'checkin' as const, target: 7, reward: 75 },
  { id: 'weekly_4', title: 'Refer a Friend', description: 'Get a friend to sign up', type: 'referral' as const, target: 1, reward: 100 },
  { id: 'weekly_5', title: 'Book 5 Services', description: 'Complete 5 bookings this week', type: 'bookings' as const, target: 5, reward: 150 },
];

export const getAchievements = async (userId: string): Promise<Achievement[]> => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const bookingCount = (user as any).bookingCount || 0;
  const totalSpent = (user as any).totalSpent || (user.loyaltySystem as any)?.totalSpent || 0;
  const streakDays = (user.loyaltySystem as any)?.streakDays || 0;
  const referralCount = (user.loyaltySystem as any)?.referralCount || 0;
  const completedAchievements = (user as any).completedAchievements || [];

  return ACHIEVEMENTS.map((achievement) => {
    let progress = 0;

    switch (achievement.category) {
      case 'bookings':
        progress = Math.min(bookingCount, achievement.requirement);
        break;
      case 'spending':
        progress = Math.min(totalSpent, achievement.requirement);
        break;
      case 'engagement':
        progress = Math.min(streakDays, achievement.requirement);
        break;
      case 'social':
        progress = Math.min(referralCount, achievement.requirement);
        break;
    }

    const isCompleted = completedAchievements.includes(achievement.id);

    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      requirement: achievement.requirement,
      progress,
      unlockedAt: isCompleted ? Date.now() : undefined,
      reward: achievement.reward,
    };
  });
};

export const getWeeklyChallenge = async (userId: string): Promise<WeeklyChallenge | null> => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const now = Date.now();
  const weeklyChallenge = (user as any).weeklyChallenge;
  const weeklyChallengeExpiry = (user as any).weeklyChallengeExpiry || 0;
  const weeklyChallengeProgress = (user as any).weeklyChallengeProgress || 0;

  // If no challenge or expired, generate new one
  if (!weeklyChallenge || now > weeklyChallengeExpiry) {
    const randomChallenge = WEEKLY_CHALLENGES[Math.floor(Math.random() * WEEKLY_CHALLENGES.length)];
    const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    // Save to user
    await User.findByIdAndUpdate(userId, {
      weeklyChallenge: randomChallenge.id,
      weeklyChallengeProgress: 0,
      weeklyChallengeExpiry: weekFromNow,
    });

    return {
      id: randomChallenge.id,
      title: randomChallenge.title,
      description: randomChallenge.description,
      type: randomChallenge.type,
      target: randomChallenge.target,
      progress: 0,
      reward: randomChallenge.reward,
      expiresAt: weekFromNow,
      completed: false,
    };
  }

  // Return existing challenge
  const challenge = WEEKLY_CHALLENGES.find(c => c.id === weeklyChallenge);
  if (!challenge) return null;

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    type: challenge.type,
    target: challenge.target,
    progress: weeklyChallengeProgress,
    reward: challenge.reward,
    expiresAt: weeklyChallengeExpiry,
    completed: weeklyChallengeProgress >= challenge.target,
  };
};

export const updateWeeklyProgress = async (userId: string, type: string, amount: number): Promise<void> => {
  const user = await User.findById(userId).lean();
  if (!user) return;

  const now = Date.now();
  const weeklyChallenge = (user as any).weeklyChallenge;
  const weeklyChallengeExpiry = (user as any).weeklyChallengeExpiry || 0;

  if (weeklyChallenge && now < weeklyChallengeExpiry) {
    const challenge = WEEKLY_CHALLENGES.find(c => c.id === weeklyChallenge);
    if (challenge && challenge.type === type) {
      const newProgress = ((user as any).weeklyChallengeProgress || 0) + amount;
      await User.findByIdAndUpdate(userId, { weeklyChallengeProgress: newProgress });

      logger.info('Weekly challenge progress updated', { userId, challenge: weeklyChallenge, newProgress });
    }
  }
};

export const claimWeeklyReward = async (userId: string): Promise<{ success: boolean; reward: number }> => {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  const weeklyChallenge = (user as any).weeklyChallenge;
  const weeklyChallengeProgress = (user as any).weeklyChallengeProgress || 0;
  const challenge = WEEKLY_CHALLENGES.find(c => c.id === weeklyChallenge);
  if (!challenge) throw ApiError.notFound('No active challenge', ERROR_CODES.NOT_FOUND);

  if (weeklyChallengeProgress < challenge.target) {
    return { success: false, reward: 0 };
  }

  // Give reward
  const currentPoints = (user.loyaltySystem as any)?.totalPoints || 0;
  await User.findByIdAndUpdate(userId, {
    'loyaltySystem.totalPoints': currentPoints + challenge.reward,
    weeklyChallenge: undefined,
    weeklyChallengeProgress: 0,
    weeklyChallengeExpiry: 0,
  });

  logger.info('Weekly challenge reward claimed', { userId, reward: challenge.reward });

  return { success: true, reward: challenge.reward };
};

export const unlockAchievement = async (userId: string, achievementId: string): Promise<Achievement | null> => {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) throw ApiError.notFound('Achievement not found', ERROR_CODES.NOT_FOUND);

  const completedAchievements = (user as any).completedAchievements || [];
  if (completedAchievements.includes(achievementId)) {
    return null;
  }

  // Add achievement and reward points
  const newPoints = ((user.loyaltySystem as any)?.totalPoints || 0) + (achievement.reward || 0);
  await User.findByIdAndUpdate(userId, {
    completedAchievements: [...completedAchievements, achievementId],
    'loyaltySystem.totalPoints': newPoints,
  });

  logger.info('Achievement unlocked', { userId, achievement: achievementId, reward: achievement.reward });

  return {
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
    category: achievement.category,
    requirement: achievement.requirement,
    progress: achievement.requirement,
    unlockedAt: Date.now(),
    reward: achievement.reward,
  };
};
