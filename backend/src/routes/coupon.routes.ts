import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import Joi from 'joi';
import {
  getAllCoupons,
  createCoupon,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  deactivateCoupon,
  getCouponStats,
  archiveCoupon,
  cloneCoupon,
  updateCouponStatus,
  bulkDeactivateCoupons,
  bulkDeleteCoupons,
} from '../controllers/coupon.controller';

const router = Router();

// Validation schemas for coupon routes
const createCouponSchema = Joi.object({
  // min 6, max 20, alphanumeric only
  code: Joi.string().required().min(6).max(20).pattern(/^[A-Z0-9]+$/).uppercase().messages({
    'string.pattern.base': 'Coupon code must be alphanumeric (A-Z, 0-9 only)',
    'string.min': 'Coupon code must be at least 6 characters',
    'string.max': 'Coupon code cannot exceed 20 characters',
  }),
  type: Joi.string().required().valid('percentage', 'fixed', 'free_service'),
  value: Joi.number().required().min(0).when('type', {
    is: 'percentage',
    then: Joi.number().max(100).messages({
      'number.max': 'Percentage value cannot exceed 100'
    })
  }),
  maxDiscount: Joi.number().min(0).optional(),
  minOrderAmount: Joi.number().min(0).default(0),
  currency: Joi.string().default('AED'),
  usageLimit: Joi.number().integer().min(1).default(1),
  maxUsesPerUser: Joi.number().integer().min(1).default(1),
  validFrom: Joi.date().iso().required(),
  validUntil: Joi.date().iso().greater(Joi.ref('validFrom')).required(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
  applicableServices: Joi.array().items(Joi.string()).optional(),
  title: Joi.string().required().min(3).max(100),
  description: Joi.string().max(500).optional(),
  displayTitle: Joi.string().max(100).optional(),
  displaySubtitle: Joi.string().max(200).optional(),
  displayGradient: Joi.string().optional(),
  displayBadge: Joi.string().valid('Limited Time', 'New', 'Popular', 'Hot').optional(),
  imageUrl: Joi.string().uri().optional(),
  featured: Joi.boolean().default(false),
  claimExpiresInDays: Joi.number().integer().min(1).max(365).optional(),
});

const updateCouponSchema = Joi.object({
  // FIX: Standardized to min 6, max 20 to match model and create schema
  code: Joi.string().min(6).max(20).uppercase(),
  type: Joi.string().valid('percentage', 'fixed', 'free_service'),
  value: Joi.number().min(0).when('type', {
    is: 'percentage',
    then: Joi.number().max(100).messages({
      'number.max': 'Percentage value cannot exceed 100'
    })
  }),
  maxDiscount: Joi.number().min(0).allow(null),
  minOrderAmount: Joi.number().min(0),
  currency: Joi.string(),
  usageLimit: Joi.number().integer().min(1),
  maxUsesPerUser: Joi.number().integer().min(1),
  validFrom: Joi.date().iso(),
  validUntil: Joi.date().iso(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
  applicableServices: Joi.array().items(Joi.string()).optional(),
  title: Joi.string().min(3).max(100),
  description: Joi.string().max(500).allow(''),
  displayTitle: Joi.string().max(100).allow(''),
  displaySubtitle: Joi.string().max(200).allow(''),
  displayGradient: Joi.string().allow(''),
  displayBadge: Joi.string().valid('Limited Time', 'New', 'Popular', 'Hot').allow(''),
  imageUrl: Joi.string().uri().allow(''),
  featured: Joi.boolean(),
  claimExpiresInDays: Joi.number().integer().min(1).max(365),
  isActive: Joi.boolean(),
});

// Validation middleware for create coupon
const validateCreateCoupon = (req: any, res: any, next: any) => {
  const { error } = createCouponSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

// Validation middleware for update coupon
const validateUpdateCoupon = (req: any, res: any, next: any) => {
  const { error } = updateCouponSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

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
router.post('/', validateCreateCoupon, createCoupon);

// ============================================
// BULK OPERATION ROUTES (before /:id routes)
// ============================================

/**
 * POST /api/admin/coupons/bulk/deactivate
 * Bulk deactivate coupons
 */
router.post('/bulk/deactivate', bulkDeactivateCoupons);

/**
 * DELETE /api/admin/coupons/bulk
 * Bulk delete coupons
 */
router.delete('/bulk', bulkDeleteCoupons);

// ============================================
// ROUTES WITH :id - Specific routes BEFORE parameterized /:id
// ============================================

/**
 * PUT /api/admin/coupons/:id
 * Update a coupon
 */
router.put('/:id', validateUpdateCoupon, updateCoupon);

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

/**
 * POST /api/admin/coupons/:id/archive
 * Archive a coupon
 * FIX: New endpoint for archiving coupons
 */
router.post('/:id/archive', archiveCoupon);

/**
 * POST /api/admin/coupons/:id/clone
 * Clone a coupon
 * FIX: New endpoint for cloning coupons
 */
router.post('/:id/clone', cloneCoupon);

/**
 * PATCH /api/admin/coupons/:id/status
 * Update coupon approval status (draft -> pending_review -> approved -> published)
 * FIX: New endpoint for approval workflow
 */
router.patch('/:id/status', updateCouponStatus);

/**
 * GET /api/admin/coupons/:id
 * Get a specific coupon by ID (must be last for /:id routes)
 */
router.get('/:id', getCouponById);

export default router;
