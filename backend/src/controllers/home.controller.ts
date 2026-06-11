import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { homeTrendingFeedService, TrendingFeedItemType } from '../services/homeTrendingFeed.service';

/**
 * GET /api/home/trending-feed
 */
export const getTrendingFeed = asyncHandler(async (req: Request, res: Response) => {
  const {
    limit = '8',
    minItems = '4',
    city,
    lat,
    lng,
    period,
    types,
  } = req.query;

  const parsedTypes = types
    ? (types as string).split(',').filter(Boolean) as TrendingFeedItemType[]
    : undefined;

  const result = await homeTrendingFeedService.getFeed({
    limit: parseInt(limit as string, 10),
    minItems: parseInt(minItems as string, 10),
    city: city as string | undefined,
    lat: lat ? parseFloat(lat as string) : undefined,
    lng: lng ? parseFloat(lng as string) : undefined,
    period: period === '30d' ? '30d' : '7d',
    types: parsedTypes,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/home/trending-feed/:itemId/click
 */
export const trackTrendingFeedClick = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  await homeTrendingFeedService.trackClick(itemId);
  res.json({ success: true });
});
