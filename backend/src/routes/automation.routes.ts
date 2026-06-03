/**
 * Automation Management Routes
 *
 * Handles triggering and monitoring marketing/service automations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Validation for welcome trigger
const triggerWelcomeValidation = [
  body('userId').optional().isMongoId().withMessage('Valid user ID required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('name').optional().isString(),
  body('source').optional().isString(),
];

// Validation for winback trigger
const triggerWinbackValidation = [
  body('userId').isMongoId().withMessage('Valid user ID required'),
  body('reason').optional().isString(),
  body('offerCode').optional().isString(),
];

// Helper to return 503 Service Unavailable with proper message
const notImplemented = (res: Response, feature: string): void => {
  res.status(503).json({
    success: false,
    message: 'This feature is coming soon',
    code: 'FEATURE_NOT_AVAILABLE',
    error: `The ${feature.toLowerCase()} feature is scheduled for a future release.`,
  });
};

/**
 * POST /api/automation/welcome
 * Trigger welcome automation
 */
router.post(
  '/welcome',
  authenticate,
  requireRole(['admin']),
  triggerWelcomeValidation,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const { userId, email, name, source } = req.body;
      // Welcome automation not yet implemented - requires queue integration
      notImplemented(res, 'Welcome automation trigger');
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/automation/winback
 * Trigger winback automation
 */
router.post(
  '/winback',
  authenticate,
  requireRole(['admin']),
  triggerWinbackValidation,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const { userId, reason, offerCode } = req.body;
      // Winback automation not yet implemented - use /api/winback/trigger instead
      notImplemented(res, 'Winback automation trigger');
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/automation/status
 * Get automation status
 */
router.get(
  '/status',
  authenticate,
  requireRole(['admin']),
  [
    query('automationType').optional().isString(),
    query('userId').optional().isMongoId().withMessage('Valid user ID required'),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        automationType,
        userId,
        status,
        page = 1,
        limit = 20,
      } = req.query;

      // Automation status tracking not yet implemented
      notImplemented(res, 'Automation status tracking');
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/automation/review-request
 * Trigger review request automation
 */
router.post(
  '/review-request',
  authenticate,
  requireRole(['admin', 'super_admin', 'support', 'provider'] as UserRole[]),
  [
    body('bookingId').isMongoId().withMessage('Valid booking ID required'),
    body('customerId').optional().isMongoId().withMessage('Valid customer ID required'),
    body('delay').optional().isInt({ min: 0, max: 72 }).withMessage('Delay must be 0-72 hours'),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const { bookingId, customerId, delay = 24 } = req.body;
      // Review request automation not yet implemented - use reviewRequestTiming automation
      notImplemented(res, 'Review request automation');
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/automation/referral
 * Trigger referral notification automation
 */
router.post(
  '/referral',
  authenticate,
  requireRole(['admin']),
  [
    body('referrerId').isMongoId().withMessage('Valid referrer ID required'),
    body('referredUserId').optional().isMongoId().withMessage('Valid referred user ID required'),
    body('rewardType').optional().isIn(['discount', 'credit', 'free_service']),
    body('rewardValue').optional().isFloat({ min: 0 }),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const { referrerId, referredUserId, rewardType, rewardValue } = req.body;
      // Referral automation not yet implemented - use referralGamification automation
      notImplemented(res, 'Referral automation');
    } catch (error) {
      next(error);
    }
  })
);

export default router;
