import express, { Router } from 'express';
import {
  createAd,
  getMyAds,
  getAdById,
  updateAd,
  deleteAd,
  pauseAd,
  resumeAd,
  launchAd,
  getAdStats,
  getAdAnalytics,
  getTargetingCategories,
  bulkPauseAds,
  bulkResumeAds,
  bulkDeleteAds,
} from '../controllers/providerAd.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateProviderRole } from '../middleware/validation.middleware';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import {
  validateCreateProviderAd,
  validateUpdateProviderAd,
} from '../middleware/validation/providerAd.validation';

// Create router
const router: Router = express.Router();

// Rate limiting for ad operations
const adRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each provider to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 15 * 60,
  },
});

// Validation middleware for ad ID
const validateAdId = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new Error('Invalid ad ID'));
  }

  next();
};

// ============================================
// Public Routes (no auth required) - MUST be before protected routes
// ============================================

/**
 * GET /api/provider/ads/categories
 * Get available targeting categories (requires auth for stats but categories is public)
 * NOTE: Now handled by /api/ads/public/categories in routes/index.ts
 */

/**
 * GET /api/provider/ads/stats
 * Get provider's overall ad statistics (requires auth)
 */
router.get('/stats', authenticate, validateProviderRole, getAdStats);

// ============================================
// Protected Routes (auth required)
// ============================================

// Apply authentication and provider role validation to all routes below
router.use(authenticate);
router.use(validateProviderRole);
router.use(adRateLimit);

/**
 * POST /api/provider/ads/bulk/pause
 * Bulk pause ads
 * NOTE: This route MUST come before /:id to avoid matching issues
 */
router.post('/bulk/pause', bulkPauseAds);

/**
 * POST /api/provider/ads/bulk/resume
 * Bulk resume ads
 * NOTE: This route MUST come before /:id to avoid matching issues
 */
router.post('/bulk/resume', bulkResumeAds);

/**
 * POST /api/provider/ads/bulk/delete
 * Bulk delete ads
 * NOTE: This route MUST come before /:id to avoid matching issues
 */
router.post('/bulk/delete', bulkDeleteAds);

// ============================================
// Ad Campaign Routes with ID (after specific routes)
// ============================================

/**
 * POST /api/provider/ads
 * Create a new ad campaign
 */
router.post('/', createAd);

/**
 * GET /api/provider/ads
 * Get all ads for the authenticated provider
 */
router.get('/', getMyAds);

// ============================================
// Ad Campaign Routes with ID - Specific routes BEFORE parameterized /:id
// ============================================

/**
 * PUT /api/provider/ads/:id
 * Update an existing ad
 */
router.put('/:id', validateAdId, validateUpdateProviderAd, updateAd);

/**
 * DELETE /api/provider/ads/:id
 * Delete an ad
 */
router.delete('/:id', validateAdId, deleteAd);

// ============================================
// Ad Campaign Action Routes
// ============================================

/**
 * POST /api/provider/ads/:id/pause
 * Pause an active ad
 */
router.post('/:id/pause', validateAdId, pauseAd);

/**
 * POST /api/provider/ads/:id/resume
 * Resume a paused ad
 */
router.post('/:id/resume', validateAdId, resumeAd);

/**
 * POST /api/provider/ads/:id/launch
 * Launch a draft ad
 */
router.post('/:id/launch', validateAdId, launchAd);

/**
 * GET /api/provider/ads/:id/analytics
 * Get detailed analytics for a specific ad
 */
router.get('/:id/analytics', validateAdId, getAdAnalytics);

/**
 * GET /api/provider/ads/:id
 * Get a specific ad by ID (must be last for /:id routes)
 */
router.get('/:id', validateAdId, getAdById);

export default router;
