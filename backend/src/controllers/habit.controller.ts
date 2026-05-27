import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getAchievements,
  getWeeklyChallenge,
  updateWeeklyProgress,
  claimWeeklyReward,
  unlockAchievement,
} from '../services/habit.service';

export const getHabits = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const [achievements, weeklyChallenge] = await Promise.all([
    getAchievements(user._id.toString()),
    getWeeklyChallenge(user._id.toString()),
  ]);

  res.json({
    success: true,
    data: {
      achievements,
      weeklyChallenge,
    },
  });
});

export const getWeekly = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const challenge = await getWeeklyChallenge(user._id.toString());

  res.json({
    success: true,
    data: challenge,
  });
});

export const claimWeekly = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await claimWeeklyReward(user._id.toString());

  res.json({
    success: result.success,
    message: result.success ? `Claimed ${result.reward} points!` : 'Challenge not completed',
    data: result,
  });
});

export const updateProgress = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { type, amount } = req.body;

  await updateWeeklyProgress(user._id.toString(), type, amount);

  res.json({
    success: true,
  });
});

export const unlock = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { achievementId } = req.body;

  const achievement = await unlockAchievement(user._id.toString(), achievementId);

  res.json({
    success: !!achievement,
    message: achievement ? `Achievement unlocked! +${achievement.reward} points` : 'Achievement already unlocked',
    data: achievement,
  });
});

export default {
  getHabits,
  getWeekly,
  claimWeekly,
  updateProgress,
  unlock,
};
