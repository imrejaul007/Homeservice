import User from '../models/user.model';
import logger from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCheckIn: Date | null;
  totalCheckIns: number;
  streakHistory: Array<{
    date: string;
    streak: number;
  }>;
}

interface CheckInResult {
  success: boolean;
  newStreak: number;
  pointsEarned: number;
  message: string;
}

export const getStreak = async (userId: string): Promise<StreakData> => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const loyaltySystem = (user as any).loyaltySystem || {};
  const streakHistory = (user as any).streakHistory || [];

  // Calculate current streak
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastCheckIn = loyaltySystem.lastStreakDate
    ? new Date(loyaltySystem.lastStreakDate)
    : null;

  let currentStreak = loyaltySystem.streakDays || 0;

  // Check if streak is still valid (checked in today or yesterday)
  if (lastCheckIn) {
    const lastCheckInDay = new Date(
      lastCheckIn.getFullYear(),
      lastCheckIn.getMonth(),
      lastCheckIn.getDate()
    );
    const daysDiff = Math.floor(
      (today.getTime() - lastCheckInDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If more than 1 day gap, streak is broken
    if (daysDiff > 1) {
      currentStreak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak: (user as any).loyaltySystem?.longestStreak || loyaltySystem.longestStreak || 0,
    lastCheckIn: lastCheckIn,
    totalCheckIns: streakHistory.length,
    streakHistory: streakHistory.slice(-30),
  };
};

export const checkIn = async (userId: string): Promise<CheckInResult> => {
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = today.toISOString().split('T')[0];

  const loyaltySystem = (user as any).loyaltySystem || {};
  const lastCheckIn = loyaltySystem.lastStreakDate
    ? new Date(loyaltySystem.lastStreakDate)
    : null;
  const streakHistory = (user as any).streakHistory || [];

  let currentStreak = loyaltySystem.streakDays || 0;
  let pointsEarned = 0;

  // Check if already checked in today
  if (lastCheckIn) {
    const lastCheckInDay = new Date(
      lastCheckIn.getFullYear(),
      lastCheckIn.getMonth(),
      lastCheckIn.getDate()
    );
    const daysDiff = Math.floor(
      (today.getTime() - lastCheckInDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      return {
        success: false,
        newStreak: currentStreak,
        pointsEarned: 0,
        message: 'Already checked in today!',
      };
    }

    if (daysDiff === 1) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }

  // Calculate points earned
  const basePoints = 10;
  const streakBonus = Math.min(currentStreak * 2, 50);
  pointsEarned = basePoints + streakBonus;

  // Update user - award coins and persist streak data
  const updatedLongest = Math.max((user as any).loyaltySystem?.longestStreak || loyaltySystem.longestStreak || 0, currentStreak);
  (user as any).loyaltySystem = {
    ...loyaltySystem,
    streakDays: currentStreak,
    lastStreakDate: now,
    longestStreak: updatedLongest,
    coins: (loyaltySystem.coins || 0) + pointsEarned,
    totalEarned: (loyaltySystem.totalEarned || 0) + pointsEarned,
    pointsHistory: [
      ...(loyaltySystem.pointsHistory || []),
      {
        amount: pointsEarned,
        type: 'bonus' as const,
        description: `Daily check-in streak bonus (${currentStreak} day streak)`,
        date: new Date(),
      },
    ].slice(-100),
  };

  (user as any).streakHistory = [
    ...streakHistory,
    { date: todayStr, streak: currentStreak },
  ].slice(-365);

  await user.save();

  logger.info('Streak check-in', {
    userId,
    newStreak: currentStreak,
    pointsEarned,
    action: 'STREAK_CHECKIN',
  });

  return {
    success: true,
    newStreak: currentStreak,
    pointsEarned,
    message: `Streak increased to ${currentStreak} days! +${pointsEarned} points`,
  };
};

export const getStreakHistory = async (
  userId: string,
  days: number = 30
): Promise<Array<{ date: string; streak: number }>> => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  return ((user as any).streakHistory || []).slice(-days);
};

export const getStreakLeaderboard = async (
  limit: number = 10
): Promise<Array<{ userId: string; streak: number; rank: number }>> => {
  const topUsers = await User.find({ 'loyaltySystem.streakDays': { $gt: 0 } })
    .select('loyaltySystem.streakDays firstName lastName')
    .sort({ 'loyaltySystem.streakDays': -1 })
    .limit(limit)
    .lean();

  return topUsers.map((user, index) => ({
    userId: user._id.toString(),
    streak: ((user as any).loyaltySystem?.streakDays || 0),
    rank: index + 1,
  }));
};
