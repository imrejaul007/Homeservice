import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as streakService from '../services/streak.service';

export const getStreakData = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const streak = await streakService.getStreak(user._id.toString());

  res.json({
    success: true,
    data: streak,
  });
});

export const doCheckIn = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await streakService.checkIn(user._id.toString());

  res.json({
    success: true,
    data: result,
  });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { days = '30' } = req.query;
  const history = await streakService.getStreakHistory(user._id.toString(), parseInt(days as string));

  res.json({
    success: true,
    data: history,
  });
});

export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '10' } = req.query;
  const leaderboard = await streakService.getStreakLeaderboard(parseInt(limit as string));

  res.json({
    success: true,
    data: leaderboard,
  });
});

export default {
  getStreakData,
  doCheckIn,
  getHistory,
  getLeaderboard,
};
