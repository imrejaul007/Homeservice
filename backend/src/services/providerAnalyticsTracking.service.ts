import type { Request } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';

const MAX_SESSION_IDS_PER_DAY = 500;
const MAX_DAILY_BUCKETS = 90;

const BOT_UA_PATTERN =
  /bot|crawler|spider|slurp|facebookexternalhit|linkedinbot|whatsapp|googlebot|bingbot|yandex|duckduckbot|semrush|ahrefs|headless|phantomjs|selenium|puppeteer/i;

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function shouldSkipTracking(viewerKey: string, providerId: string): boolean {
  if (!viewerKey || !providerId) return false;
  return viewerKey === `user:${providerId}`;
}

export function isBotUserAgent(req: Request): boolean {
  const ua = req.headers['user-agent'];
  if (!ua || typeof ua !== 'string') return false;
  return BOT_UA_PATTERN.test(ua);
}

export function getViewerKey(req: Request): string {
  const user = (req as Request & { user?: { _id?: mongoose.Types.ObjectId | string } }).user;
  if (user?._id) {
    return `user:${user._id.toString()}`;
  }

  const sessionHeader = req.headers['x-session-id'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) {
    return `session:${sessionHeader.trim()}`;
  }

  const cookieSession = (req as Request & { cookies?: { sessionId?: string } }).cookies?.sessionId;
  if (cookieSession) {
    return `session:${cookieSession}`;
  }

  return `ip:${req.ip || 'unknown'}`;
}

type DailyViewsField = 'profileViews' | 'listingImpressions';
type DailySessionsField = 'profileViewSessions' | 'listingImpressionSessions';
type CountField = 'views' | 'impressions';
type UniqueField = 'uniqueViews' | 'uniqueImpressions';

async function ensureTodayBuckets(
  providerId: string,
  today: Date,
  viewsField: DailyViewsField,
  sessionsField: DailySessionsField,
  countField: CountField,
  uniqueField: UniqueField,
): Promise<void> {
  await ProviderProfile.updateOne(
    {
      userId: providerId,
      [`analytics.${viewsField}`]: { $not: { $elemMatch: { date: today } } },
    },
    {
      $push: {
        [`analytics.${viewsField}`]: {
          $each: [{ date: today, [countField]: 0, [uniqueField]: 0 }],
          $slice: -MAX_DAILY_BUCKETS,
        },
        [`analytics.${sessionsField}`]: {
          $each: [{ date: today, sessionIds: [] }],
          $slice: -MAX_DAILY_BUCKETS,
        },
      },
    },
  );
}

async function incrementDailyMetric(
  providerId: string,
  today: Date,
  viewerKey: string,
  viewsField: DailyViewsField,
  sessionsField: DailySessionsField,
  countField: CountField,
  uniqueField: UniqueField,
  incrementBy: number,
): Promise<void> {
  await ensureTodayBuckets(providerId, today, viewsField, sessionsField, countField, uniqueField);

  await ProviderProfile.updateOne(
    {
      userId: providerId,
      [`analytics.${viewsField}.date`]: today,
    },
    {
      $inc: { [`analytics.${viewsField}.$.${countField}`]: incrementBy },
    },
  );

  const uniqueResult = await ProviderProfile.updateOne(
    {
      userId: providerId,
      [`analytics.${sessionsField}.date`]: today,
      [`analytics.${sessionsField}.$.sessionIds`]: { $ne: viewerKey },
    },
    {
      $push: {
        [`analytics.${sessionsField}.$.sessionIds`]: {
          $each: [viewerKey],
          $slice: -MAX_SESSION_IDS_PER_DAY,
        },
      },
    },
  );

  if (uniqueResult.modifiedCount > 0) {
    await ProviderProfile.updateOne(
      {
        userId: providerId,
        [`analytics.${viewsField}.date`]: today,
      },
      {
        $inc: { [`analytics.${viewsField}.$.${uniqueField}`]: 1 },
      },
    );
  }
}

export async function trackProviderProfileView(
  providerId: string,
  viewerKey: string,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) return;
  if (shouldSkipTracking(viewerKey, providerId)) return;

  const today = startOfDay();

  try {
    await incrementDailyMetric(
      providerId,
      today,
      viewerKey,
      'profileViews',
      'profileViewSessions',
      'views',
      'uniqueViews',
      1,
    );
  } catch (err) {
    logger.warn('Failed to track profile view', {
      providerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function trackListingImpressions(
  providerImpressionCounts: Map<string, number>,
  sessionKey: string,
): Promise<void> {
  if (providerImpressionCounts.size === 0 || !sessionKey) return;

  const today = startOfDay();

  await Promise.all(
    Array.from(providerImpressionCounts.entries()).map(async ([providerId, count]) => {
      if (!mongoose.Types.ObjectId.isValid(providerId) || count <= 0) return;
      if (shouldSkipTracking(sessionKey, providerId)) return;

      try {
        await incrementDailyMetric(
          providerId,
          today,
          sessionKey,
          'listingImpressions',
          'listingImpressionSessions',
          'impressions',
          'uniqueImpressions',
          count,
        );
      } catch (err) {
        logger.warn('Failed to track listing impressions', {
          providerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
}
