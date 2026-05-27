import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import {
  getAllCoupons,
  createCoupon,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  deactivateCoupon,
  getCouponStats,
} from '../controllers/coupon.controller';

const router = Router();

// All admin coupon routes require authentication, admin role, and rate limiting
router.use(authenticate);
router.use(requireRole('admin'));
router.use(adminLimiter);

/**
 * GET /api/admin/coupons
 * List all coupons with pagination, filtering, and search
 */
router.get('/', getAllCoupons);

/**
 * GET /api/admin/coupons/stats
 * Get coupon statistics
 */
router.get('/stats', getCouponStats);

/**
 * POST /api/admin/coupons
 * Create a new coupon
 */
router.post('/', createCoupon);

/**
 * GET /api/admin/coupons/:id
 * Get a specific coupon by ID
 */
router.get('/:id', getCouponById);

/**
 * PUT /api/admin/coupons/:id
 * Update a coupon
 */
router.put('/:id', updateCoupon);

/**
 * DELETE /api/admin/coupons/:id
 * Delete a coupon
 */
router.delete('/:id', deleteCoupon);

/**
 * POST /api/admin/coupons/:id/deactivate
 * Deactivate a coupon (soft disable)
 */
router.post('/:id/deactivate', deactivateCoupon);

export default router;
