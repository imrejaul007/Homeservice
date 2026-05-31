/**
 * Win-Back Campaign Routes
 *
 * Handles win-back campaign management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  detectInactiveUsers,
  createWinBackCampaign,
  sendCampaignMessage,
  trackCampaignEngagement,
  markCampaignConverted,
  getWinBackStats,
  WinBackCampaign,
} from '../automation/winBackCampaign';

const router = Router();

/**
 * GET /api/winback/stats
 * Get win-back campaign statistics
 */
router.get(
  '/stats',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await getWinBackStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get win-back stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/winback/campaigns
 * Get all win-back campaigns
 */
router.get(
  '/campaigns',
  authenticate,
  requireRole(['admin']),
  [
    query('status').optional().isIn(['pending', 'engaged', 'converted', 'failed', 'skipped']),
    query('campaignType').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const {
        status,
        campaignType,
        page = 1,
        limit = 20,
      } = req.query;

      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (campaignType) filter.campaignType = campaignType;

      const skip = (Number(page) - 1) * Number(limit);

      const [campaigns, total] = await Promise.all([
        WinBackCampaign.find(filter)
          .populate('userId', 'firstName lastName email phone')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        WinBackCampaign.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: {
          campaigns,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get campaigns',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/winback/trigger
 * Manually trigger a win-back campaign
 */
router.post(
  '/trigger',
  authenticate,
  requireRole(['admin']),
  [
    body('userId').isMongoId().withMessage('Valid user ID required'),
    body('campaignType').optional().isIn(['dormant_30', 'dormant_60', 'dormant_90', 'churn_risk', 'win_back']),
    body('offerCode').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { userId, campaignType = 'dormant_30', offerCode } = req.body;

      const campaign = await createWinBackCampaign(
        userId as any,
        campaignType as any
      );

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'User not found or campaign already exists',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Win-back campaign triggered successfully',
        data: campaign,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to trigger win-back campaign',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/winback/:campaignId/resend
 * Resend campaign message
 */
router.post(
  '/:campaignId/resend',
  authenticate,
  requireRole(['admin']),
  [
    param('campaignId').isMongoId().withMessage('Valid campaign ID required'),
    body('channel').optional().isIn(['email', 'push', 'sms']),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { campaignId } = req.params;
      const { channel = 'email' } = req.body;

      await sendCampaignMessage(campaignId as any, channel);

      res.status(200).json({
        success: true,
        message: 'Campaign message resent successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to resend campaign message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/winback/:campaignId/track
 * Track campaign engagement
 */
router.post(
  '/:campaignId/track',
  [
    param('campaignId').isMongoId().withMessage('Valid campaign ID required'),
    body('action').isIn(['open', 'click']).withMessage('Action must be open or click'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { campaignId } = req.params;
      const { action } = req.body;

      await trackCampaignEngagement(campaignId, action);

      res.status(200).json({
        success: true,
        message: 'Campaign engagement tracked',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to track engagement',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/winback/:campaignId/convert
 * Mark campaign as converted
 */
router.post(
  '/:campaignId/convert',
  authenticate,
  requireRole(['admin']),
  [
    param('campaignId').isMongoId().withMessage('Valid campaign ID required'),
    body('bookingId').isMongoId().withMessage('Valid booking ID required'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { campaignId } = req.params;
      const { bookingId } = req.body;

      await markCampaignConverted(campaignId as any, bookingId as any);

      res.status(200).json({
        success: true,
        message: 'Campaign marked as converted',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to mark campaign as converted',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/winback/run
 * Manually run win-back detection
 */
router.post(
  '/run',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await detectInactiveUsers();

      res.status(200).json({
        success: true,
        message: 'Win-back detection completed',
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to run win-back detection',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
