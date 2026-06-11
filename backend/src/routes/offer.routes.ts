import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { offerService } from '../services/offer.service';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.middleware';
import { offerClaimLimiter, offerValidateLimiter } from '../middleware/rateLimiter';
import { createHoneypotMiddleware } from '../middleware/honeypot';
import { issueChallenge, verifyChallenge, getPendingChallenge } from '../middleware/challengeVerification';
import logger from '../utils/logger';

const router = Router();

// SECURITY FIX (SEC-D): Add body size limit middleware for claim/validate endpoints
// Limits request body to 1kb to prevent payload-based DoS attacks
const bodyLimitMiddleware = express.json({ limit: '1kb' });

// SECURITY: Honeypot middleware for bot detection
const claimHoneypot = createHoneypotMiddleware({
  fieldName: 'website_url',
  shouldCapture: (req) => req.method === 'POST',
});

// Validation helper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// PUBLIC ROUTES
// ============================================

// FIX: IP-based rate limiter for public endpoints to prevent enumeration attacks
const offerPublicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { success: false, error: 'Too many requests, please slow down.' },
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

// GET /api/offers - List active offers for homepage (includes claimed status if authenticated)
// FIX: Added pagination support
router.get('/', offerPublicLimiter, optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const result = await offerService.getActiveOffers(userId, { page, limit });
  res.json({ success: true, data: result.offers, pagination: result.pagination });
}));

// POST /api/offers/:id/view - Track offer view (for analytics)
router.post('/:id/view', asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid offer ID' });
    return;
  }

  const offer = await offerService.incrementViewCount(req.params.id);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }

  res.json({ success: true, message: 'View recorded' });
}));

// ============================================
// USER ROUTES (Authenticated) - Must come before /:id
// ============================================

// GET /api/offers/my/claims - Get user's claimed offers with pagination
// Pagination support (page, limit query params)
router.get('/my/claims', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id?.toString() || (req as any).user.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const result = await offerService.getUserClaims(userId, page, limit);
  res.json({
    success: true,
    data: result.claims,
    pagination: {
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
      limit,
    },
  });
}));

// GET /api/offers/challenge - Get a challenge for claiming (anti-bot)
// Returns a simple math challenge that must be solved before claiming
router.get('/challenge', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id?.toString() || (req as any).user.id;

  // Check if user already has a pending challenge
  const existing = getPendingChallenge(userId);
  if (existing) {
    res.json({
      success: true,
      hasChallenge: true,
      challengeId: existing.challengeId, // FIX: Return the challenge ID, not the whole object
      challenge: existing.challenge,
      expiresIn: existing.expiresAt - Date.now(),
      message: 'You have a pending challenge',
    });
    return;
  }

  // Issue a new challenge
  const { challengeId, challenge, expiresIn } = issueChallenge(userId);
  res.json({
    success: true,
    hasChallenge: true,
    challengeId,
    challenge,
    expiresIn,
  });
}));

// POST /api/offers/verify-challenge - Verify a challenge response
router.post('/verify-challenge', bodyLimitMiddleware, authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { challengeId, answer } = req.body;
  const userId = (req as any).user._id?.toString() || (req as any).user.id;

  if (!challengeId || !answer) {
    res.status(400).json({ success: false, message: 'Challenge ID and answer are required' });
    return;
  }

  const result = await verifyChallenge(challengeId, userId, answer);

  if (result.valid) {
    res.json({
      success: true,
      verified: true,
      message: 'Challenge verified successfully',
    });
  } else {
    logger.warn('Challenge verification failed', {
      userId,
      challengeId,
      error: result.error,
      action: 'CHALLENGE_VERIFY_FAILED',
    });
    res.status(400).json({
      success: false,
      verified: false,
      message: result.error || 'Challenge verification failed',
    });
  }
}));

// POST /api/offers/claim - Claim an offer
// POST /api/offers/claim - Claim an offer
// Challenge verification is MANDATORY for all claim attempts
router.post('/claim', bodyLimitMiddleware, authenticate, offerClaimLimiter, claimHoneypot, asyncHandler(async (req: Request, res: Response) => {
  const { offerId, challengeId, challengeAnswer, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, referrer } = req.body;
  const userId = (req as any).user._id?.toString() || (req as any).user.id;

  if (!offerId) {
    res.status(400).json({ success: false, message: 'Offer ID is required' });
    return;
  }

  // Challenge verification is REQUIRED for all claims
  // This prevents automated bot attacks on the claim endpoint
  if (!challengeId || !challengeAnswer) {
    logger.warn('Challenge required but not provided on claim', {
      userId,
      offerId,
      action: 'CLAIM_MISSING_CHALLENGE',
    });
    res.status(400).json({
      success: false,
      requiresChallenge: true,
      challengeRequired: true,
      message: 'Challenge verification is required to claim offers',
    });
    return;
  }

  const challengeResult = await verifyChallenge(challengeId, userId, challengeAnswer);
  if (!challengeResult.valid) {
    logger.warn('Challenge verification failed on claim', {
      userId,
      offerId,
      error: challengeResult.error,
      action: 'CLAIM_CHALLENGE_FAILED',
    });
    res.status(400).json({
      success: false,
      requiresChallenge: true,
      challengeRequired: true,
      message: challengeResult.error || 'Challenge verification failed. Please try again.',
    });
    return;
  }

  // SECURITY: Extract device fingerprint for abuse detection
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.headers['x-real-ip']?.toString()
    || req.ip;

  // Extract idempotency key from header for network retry protection
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  // Standardize response format with device info and attribution data
  const result = await offerService.claimOffer(userId, offerId, {
    fingerprint: deviceFingerprint,
    ip,
    userAgent: req.headers['user-agent'],
  }, {
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    referrer,
  }, idempotencyKey);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    data: result.success ? {
      claimId: result.claimId,
      couponCode: result.couponCode,
      expiresAt: result.expiresAt,
    } : undefined,
    message: result.message,
  });
}));

// POST /api/offers/validate - Validate promo code at checkout
// SECURITY FIX (SEC-D): Apply body size limit to prevent payload-based attacks
// FIX: Changed from authenticate to optionalAuth to support guest checkout
router.post('/validate', bodyLimitMiddleware, offerValidateLimiter, optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { code, orderAmount, serviceId, categoryId } = req.body;
  // User ID is optional - guests can also validate promo codes
  const userId = (req as any).user?.id || (req as any).user?._id?.toString() || null;

  if (!code || orderAmount === undefined) {
    res.status(400).json({ success: false, message: 'Promo code and order amount are required' });
    return;
  }

  // FIX: Server-side code validation to prevent injection attacks
  if (typeof code !== 'string' || !/^[A-Z0-9_-]{3,30}$/i.test(code.trim())) {
    res.status(400).json({ success: false, message: 'Invalid promo code format' });
    return;
  }

  if (orderAmount < 0) {
    res.status(400).json({ success: false, message: 'Invalid order amount' });
    return;
  }

  // FIX: Pass serviceId and categoryId for validation, standardize response
  const result = await offerService.validatePromoCode(code, userId, orderAmount, serviceId, categoryId);
  res.status(result.valid ? 200 : 400).json({
    success: result.valid,
    data: result.valid ? {
      valid: true,
      discountAmount: result.discountAmount,
      discountType: result.discountType,
      couponCode: result.couponCode,
      offerId: result.offerId,
      minOrderValue: result.minOrderValue,
      maxDiscount: result.maxDiscount,
      title: result.title,
    } : undefined,
    message: result.message,
  });
}));

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/offers/admin/all - List all offers with pagination
router.get('/admin/all', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
  const filters = {
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    type: req.query.type as string || undefined,
    search: req.query.search as string || undefined,
  };

  const result = await offerService.getAllOffers(page, limit, filters);
  res.json({ success: true, ...result });
}));

// POST /api/offers/admin - Create new offer
router.post('/admin', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id?.toString() || (req as any).user?.id;
  const offer = await offerService.createOffer(req.body, adminId);
  res.status(201).json({ success: true, data: offer, message: 'Offer created successfully' });
}));

// ============================================
// ADMIN ROUTES WITH ID - Specific routes BEFORE parameterized /:id
// ============================================

// PUT /api/offers/admin/:id - Update offer
router.put('/admin/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid offer ID' });
    return;
  }
  const offer = await offerService.updateOffer(req.params.id, req.body);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, data: offer });
}));

// DELETE /api/offers/admin/:id - Deactivate offer
router.delete('/admin/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const result = await offerService.deactivateOffer(req.params.id);
  if (!result) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, message: 'Offer deactivated successfully' });
}));

// POST /api/offers/admin/:id/archive - Archive an offer
router.post('/admin/:id/archive', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid offer ID' });
    return;
  }
  const offer = await offerService.archiveOffer(req.params.id);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, data: offer, message: 'Offer archived successfully' });
}));

// POST /api/offers/admin/:id/clone - Clone an offer
router.post('/admin/:id/clone', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid offer ID' });
    return;
  }
  const { newCode } = req.body;
  if (!newCode) {
    res.status(400).json({ success: false, message: 'New code is required for cloning' });
    return;
  }
  const adminId = (req as any).user?._id?.toString() || (req as any).user?.id;
  try {
    const offer = await offerService.cloneOffer(req.params.id, newCode, adminId);
    res.status(201).json({ success: true, data: offer, message: 'Offer cloned successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}));

// PATCH /api/offers/admin/:id/status - Update offer status (approval workflow)
router.patch('/admin/:id/status', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid offer ID' });
    return;
  }
  const { status, isActive } = req.body;
  const validStatuses = ['draft', 'pending_review', 'approved', 'published', 'archived'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }
  const offer = await offerService.updateOfferStatus(req.params.id, status, isActive);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, data: offer, message: 'Offer status updated successfully' });
}));

// ============================================
// PUBLIC ROUTES - After specific routes
// ============================================

// GET /api/offers/:id - Get offer by ID (must be last)
// FIX: Hide sensitive data from public access
router.get('/:id', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.getOfferById(req.params.id);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }

  const userId = (req as any).user?._id?.toString() || (req as any).user?.id;
  let usageStats: Record<string, unknown> = {};
  if (userId) {
    usageStats = await offerService.getUserOfferUsageStats(userId, offer._id.toString());
  }

  const publicOffer = {
    _id: offer._id,
    code: offer.code,
    title: offer.title,
    description: offer.description,
    type: offer.type,
    value: offer.value,
    maxDiscount: offer.maxDiscount,
    minOrderValue: offer.minOrderValue,
    displayTitle: offer.displayTitle,
    displaySubtitle: offer.displaySubtitle,
    displayGradient: offer.displayGradient,
    displayBadge: offer.displayBadge,
    imageUrl: offer.imageUrl,
    featured: offer.featured,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    applicableServices: offer.applicableServices,
    applicableCategories: offer.applicableCategories,
    ...usageStats,
  };

  res.json({ success: true, data: publicOffer });
}));

export default router;
