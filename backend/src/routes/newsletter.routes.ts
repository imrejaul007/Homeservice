import { Router } from 'express';
import { subscribe, unsubscribe, verifyEmail, checkStatus, getStats } from '../controllers/newsletter.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { rateLimit } from 'express-rate-limit';
import asyncHandler from 'express-async-handler';

const router = Router();

// ============================================
// Rate Limiting
// ============================================

// Stricter rate limit for subscription attempts (prevent abuse)
const subscribeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 subscription attempts per hour per IP
  message: {
    success: false,
    message: 'Too many subscription attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limit for unsubscription
const unsubscribeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 unsubscription attempts per hour per IP
  message: {
    success: false,
    message: 'Too many unsubscription attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// Public Routes
// ============================================

/**
 * @route POST /api/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 * @rate5 requests per hour per IP
 */
router.post(
  '/subscribe',
  subscribeRateLimiter,
  asyncHandler(subscribe)
);

/**
 * @route   POST /api/newsletter/unsubscribe
 * @desc    Unsubscribe from newsletter
 * @access  Public
 * @rate    10 requests per hour per IP
 */
router.post(
  '/unsubscribe',
  unsubscribeRateLimiter,
  asyncHandler(unsubscribe)
);

/**
 * @route   GET /api/newsletter/verify/:token
 * @desc    Verify email address for newsletter
 * @access  Public
 */
router.get(
  '/verify/:token',
  asyncHandler(verifyEmail)
);

/**
 * @route   GET /api/newsletter/check
 * @desc    Check subscription status
 * @access  Public
 */
router.get(
  '/check',
  asyncHandler(checkStatus)
);

// ============================================
// Admin Routes (Protected)
// ============================================

/**
 * @route   GET /api/newsletter/stats
 * @desc    Get newsletter statistics
 * @access  Admin only
 */
router.get(
  '/stats',
  authenticate,
  requireRole('admin'),
  asyncHandler(getStats)
);

export default router;