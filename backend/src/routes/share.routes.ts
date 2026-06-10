import { Router, Request, Response } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  trackShareEvent,
  getShareAnalyticsSummary,
  getItemShareHistory,
  getUserShareActivity,
} from '../services/shareAnalytics.service';

const router = Router();

/**
 * @route   POST /api/share/track
 * @desc    Track a share event
 * @access  Public
 */
router.post(
  '/track',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      itemType,
      itemId,
      platform,
      metadata,
    }: {
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
    } = req.body;

    // Validate required fields
    if (!itemType || !itemId || !platform) {
      throw new ApiError(400, 'itemType, itemId, and platform are required');
    }

    // Validate itemType
    const validItemTypes = ['service', 'package', 'provider', 'experience', 'page'];
    if (!validItemTypes.includes(itemType)) {
      throw new ApiError(400, `Invalid itemType. Must be one of: ${validItemTypes.join(', ')}`);
    }

    // Validate platform
    const validPlatforms = ['native', 'whatsapp', 'facebook', 'twitter', 'linkedin', 'email', 'sms', 'copy', 'native_share'];
    if (!validPlatforms.includes(platform)) {
      throw new ApiError(400, `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
    }

    // Generate session ID if not provided
    const sessionId = (req as any).sessionID || req.headers['x-session-id'] as string || `anon_${Date.now()}`;

    // Track the share event
    const event = await trackShareEvent({
      userId: (req as any).user?.id,
      sessionId,
      itemType,
      itemId,
      platform,
      metadata: {
        ...metadata,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer,
        utmSource: req.query.utm_source as string,
        utmMedium: req.query.utm_medium as string,
        utmCampaign: req.query.utm_campaign as string,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: event._id,
        platform,
        itemType,
        itemId,
        timestamp: event.timestamp,
      },
    });
  })
);

/**
 * @route   GET /api/share/analytics
 * @desc    Get share analytics summary
 * @access  Admin
 */
router.get(
  '/analytics',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, period, itemType } = req.query;

    // Calculate date range
    let start: Date;
    let end: Date = new Date();

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const periodValue = typeof period === 'string' ? period : '30d';
      const days =
        periodValue === '7d' ? 7 :
        periodValue === '90d' ? 90 :
        periodValue === '365d' ? 365 :
        30;

      start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    const summary = await getShareAnalyticsSummary(
      start,
      end,
      itemType as string | undefined
    );

    res.json({
      success: true,
      data: summary,
      meta: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        itemType: itemType || null,
      },
    });
  })
);

/**
 * @route   GET /api/share/item/:itemId
 * @desc    Get share history for a specific item
 * @access  Public
 */
router.get(
  '/item/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const { itemId } = req.params;
    const { itemType, limit } = req.query;

    if (!itemType || !['service', 'package', 'provider', 'experience', 'page'].includes(itemType as string)) {
      throw new ApiError(400, 'itemType query parameter is required and must be valid');
    }

    const history = await getItemShareHistory(
      itemId,
      itemType as string,
      limit ? parseInt(limit as string, 10) : 100
    );

    res.json({
      success: true,
      data: {
        itemId,
        itemType,
        shareCount: history.length,
        history: history.map((event) => ({
          platform: event.platform,
          timestamp: event.timestamp,
        })),
      },
    });
  })
);

/**
 * @route   GET /api/share/user/me
 * @desc    Get current user's share activity
 * @access  Private
 */
router.get(
  '/user/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new ApiError(401, 'User not authenticated');
    }

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    }

    const activity = await getUserShareActivity(userId, start, end);

    res.json({
      success: true,
      data: activity,
    });
  })
);

export default router;
