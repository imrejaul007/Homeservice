import mongoose from 'mongoose';
import ShareAnalytics, { IShareAnalytics } from '../models/shareAnalytics.model';
import logger from '../utils/logger';

export interface ShareEventData {
  userId?: string;
  sessionId: string;
  itemType: 'service' | 'package' | 'provider' | 'experience' | 'page';
  itemId: string;
  platform: string;
  metadata?: {
    userAgent?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

export interface ShareAnalyticsSummary {
  platform: string;
  count: number;
  percentage: number;
}

export interface ShareTopItems {
  itemId: string;
  itemType: string;
  shareCount: number;
}

// Track a share event
export async function trackShareEvent(data: ShareEventData): Promise<IShareAnalytics> {
  try {
    const event = new ShareAnalytics({
      userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : undefined,
      sessionId: data.sessionId,
      itemType: data.itemType,
      itemId: data.itemId,
      platform: data.platform,
      timestamp: new Date(),
      metadata: data.metadata,
    });

    await event.save();
    logger.debug(`Share event tracked: ${data.platform} - ${data.itemType}/${data.itemId}`);
    return event;
  } catch (error) {
    logger.error('Failed to track share event:', error);
    throw error;
  }
}

// Get share analytics summary
export async function getShareAnalyticsSummary(
  startDate: Date,
  endDate: Date,
  itemType?: string
): Promise<{
  totalShares: number;
  byPlatform: ShareAnalyticsSummary[];
  topItems: ShareTopItems[];
  trend: { date: string; count: number }[];
}> {
  const matchStage: Record<string, any> = {
    timestamp: { $gte: startDate, $lte: endDate },
  };

  if (itemType) {
    matchStage.itemType = itemType;
  }

  // Total shares
  const totalResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    { $count: 'totalShares' },
  ]);
  const totalShares = totalResult[0]?.totalShares || 0;

  // By platform
  const byPlatformResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$platform',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const byPlatform: ShareAnalyticsSummary[] = byPlatformResult.map((item) => ({
    platform: item._id,
    count: item.count,
    percentage: totalShares > 0 ? Math.round((item.count / totalShares) * 100) : 0,
  }));

  // Top items
  const topItemsResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { itemId: '$itemId', itemType: '$itemType' },
        shareCount: { $sum: 1 },
      },
    },
    { $sort: { shareCount: -1 } },
    { $limit: 10 },
  ]);

  const topItems: ShareTopItems[] = topItemsResult.map((item) => ({
    itemId: item._id.itemId,
    itemType: item._id.itemType,
    shareCount: item.shareCount,
  }));

  // Daily trend
  const trendResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trend = trendResult.map((item) => ({
    date: item._id,
    count: item.count,
  }));

  return {
    totalShares,
    byPlatform,
    topItems,
    trend,
  };
}

// Get share events for a specific item
export async function getItemShareHistory(
  itemId: string,
  itemType: string,
  limit = 100
): Promise<(IShareAnalytics & { _id: mongoose.Types.ObjectId })[]> {
  return ShareAnalytics.find({
    itemId,
    itemType,
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean() as any;
}

// Get user's share activity
export async function getUserShareActivity(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalShares: number;
  platforms: ShareAnalyticsSummary[];
  items: ShareTopItems[];
}> {
  const matchStage: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (startDate && endDate) {
    matchStage.timestamp = { $gte: startDate, $lte: endDate };
  }

  const totalResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    { $count: 'totalShares' },
  ]);
  const totalShares = totalResult[0]?.totalShares || 0;

  const platformsResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$platform',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const platforms: ShareAnalyticsSummary[] = platformsResult.map((item) => ({
    platform: item._id,
    count: item.count,
    percentage: totalShares > 0 ? Math.round((item.count / totalShares) * 100) : 0,
  }));

  const itemsResult = await ShareAnalytics.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { itemId: '$itemId', itemType: '$itemType' },
        shareCount: { $sum: 1 },
      },
    },
    { $sort: { shareCount: -1 } },
  ]);

  const items: ShareTopItems[] = itemsResult.map((item) => ({
    itemId: item._id.itemId,
    itemType: item._id.itemType,
    shareCount: item.shareCount,
  }));

  return {
    totalShares,
    platforms,
    items,
  };
}

export default {
  trackShareEvent,
  getShareAnalyticsSummary,
  getItemShareHistory,
  getUserShareActivity,
};
