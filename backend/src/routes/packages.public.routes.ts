import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import customerDashboardController from '../controllers/customerDashboard.controller';
import packageBookingController, { bookPackage } from '../controllers/packageBooking.controller';
import { validateObjectId } from '../middleware/security-validation.middleware';
import { validateTenantAccess } from '../middleware/tenantValidation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Bundle from '../models/bundle.model';
import logger from '../utils/logger';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { LOCATION_TYPES, OBJECT_ID_PATTERN, IDEMPOTENCY_KEY_PATTERN } from '../validation/schemas';

/**
 * Validation schema for package categories query parameters
 */
const packageCategoriesQuerySchema = Joi.object({
  includeSubcategories: Joi.boolean().default(false),
  minCount: Joi.number().integer().min(0).default(0),
}).options({ stripUnknown: true });

/**
 * Handler: GET /api/packages/categories
 * Get available package categories with counts
 *
 * @description Returns all categories that have active services/packages,
 * along with the count of services in each category.
 *
 * @query includeSubcategories - Whether to include subcategory breakdown (default: false)
 * @query minCount - Minimum count threshold to include category (default: 0)
 *
 * @returns Categories array with name, slug, count, and optionally subcategories
 */
const getPackageCategories = asyncHandler(async (req: any, res: any) => {
  const tenantId = req.tenantId;

  // Validate tenantId format
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getPackageCategories: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // Validate query parameters using Joi schema
  const { error, value } = packageCategoriesQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    logger.warn(`Invalid query parameters in getPackageCategories: ${error.message}`);
    throw new ApiError(400, error.details.map(d => d.message).join(', '));
  }

  const { includeSubcategories, minCount } = value;

  // Build the tenant filter
  const tenantFilter = tenantId !== '000000000000000000000000'
    ? { tenantId: new mongoose.Types.ObjectId(tenantId) }
    : {};

  // Base filter for active bundles (packages)
  const baseFilter = {
    ...tenantFilter,
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  };

  // Aggregate to get category counts from Bundle collection
  const categoryAggregation = await Bundle.aggregate([
    { $match: baseFilter },
    // Lookup category details
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'categoryInfo',
      },
    },
    {
      $group: {
        _id: '$categoryId',
        categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
        count: { $sum: 1 },
      }
    },
    { $sort: { count: -1 } },
    { $match: { count: { $gte: minCount } } }
  ]);

  // Format the response
  const categories = categoryAggregation
    .filter(cat => cat._id !== null && cat._id !== '')
    .map(cat => {
      const categoryName = cat.categoryName || 'Package';
      const categorySlug = categoryName
        .toLowerCase()
        .replace(/\s+&\s+/g, '-')
        .replace(/\s+/g, '-');

      const response: any = {
        name: categoryName,
        slug: categorySlug,
        count: cat.count,
      };

      return response;
    });

  logger.info('Package categories retrieved', {
    context: 'PackagesPublic',
    action: 'GET_PACKAGE_CATEGORIES',
    tenantId,
    categoryCount: categories.length,
    totalServices: categories.reduce((sum: number, cat: any) => sum + cat.count, 0),
  });

  res.json({
    success: true,
    data: {
      categories,
      total: categories.length,
      totalServices: categories.reduce((sum: number, cat: any) => sum + cat.count, 0),
    },
  });
});

/**
 * Package routes — mounted at /api/packages
 * GET /api/packages
 * GET /api/packages/categories
 * GET /api/packages/featured
 * GET /api/packages/:id
 * GET /api/packages/:id/print
 * POST /api/packages/:id/book
 *
 * SECURITY: All routes require tenant validation to prevent cross-tenant data access
 */
const router = Router();

/**
 * GET /api/packages/categories
 * Get available package categories with counts
 * Public endpoint - no authentication required (uses tenant validation)
 */
router.get('/categories', tenantMiddleware, getPackageCategories);

router.get(
  '/',
  tenantMiddleware,
  validateTenantAccess,
  customerDashboardController.getPackages
);

/**
 * GET /api/packages/featured
 * Get featured/promoted packages for homepage carousel
 * Public endpoint - no authentication required
 */
router.get(
  '/featured',
  tenantMiddleware,
  validateTenantAccess,
  customerDashboardController.getFeaturedPackages
);

/**
 * GET /api/packages/:id/print
 * Generate and download a PDF with package details for offline reference
 * Does NOT require authentication (public promotional document)
 * NOTE: This route MUST be defined BEFORE /:id to ensure Express matches it first
 */
router.get(
  '/:id/print',
  tenantMiddleware,
  customerDashboardController.printPackageDetails
);

/**
 * POST /api/packages/:id/book-package
 * Book entire package (multi-service) — must be before GET /:id
 */
router.post(
  '/:id/book-package',
  authenticate,
  requireRole('customer'),
  tenantMiddleware,
  validateObjectId('id'),
  validateTenantAccess,
  bookPackage
);

router.get(
  '/:id',
  tenantMiddleware,
  validateObjectId('id'),
  validateTenantAccess,
  customerDashboardController.getPackageById
);

/**
 * POST /api/packages/:id/book
 * Create a booking from a selected package
 * Requires: authenticated customer, valid package ID, tenant validation
 */
router.post(
  '/:id/book',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  validateTenantAccess,
  customerDashboardController.createBookingFromPackage
);

/**
 * Validation schema for book-package request body
 * Matches the frontend PackageBookingWizard payload
 * Uses centralized LOCATION_TYPES for consistent location type values
 */
const bookPackageSchema = Joi.object({
  scheduledDate: Joi.string().isoDate().required().messages({
    'string.isoDate': 'Please provide a valid date',
  }),
  scheduledTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': 'Please provide a valid time in HH:MM format',
  }),
  location: Joi.object({
    type: Joi.string().valid('customer_address', 'hotel', 'provider_location').required(),
    address: Joi.object({
      street: Joi.string().allow('').optional(),
      city: Joi.string().allow('').optional(),
      state: Joi.string().allow('').optional(),
      zipCode: Joi.string().allow('').optional(),
      country: Joi.string().default('AE'),
    }).optional(),
    notes: Joi.string().allow('').optional(),
  }).required(),
  customerInfo: Joi.object({
    firstName: Joi.string().allow('').optional(),
    lastName: Joi.string().allow('').optional(),
    name: Joi.string().allow('').optional(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    specialRequests: Joi.string().allow('').optional(),
    accessInstructions: Joi.string().allow('').optional(),
  }).optional(),
  paymentMethod: Joi.string().valid('apple_pay', 'credit_card', 'cash', 'card', 'wallet').default('cash'),
  couponCode: Joi.string().allow('').optional(),
  selectedAddOns: Joi.array().items(Joi.string()).optional(),
  addOns: Joi.array().items(Joi.object({
    id: Joi.string(),
    name: Joi.string(),
    price: Joi.number(),
  })).optional(),
  specialRequests: Joi.string().allow('').optional(),
  // Use centralized location types
  locationType: Joi.string().valid(...LOCATION_TYPES).optional(),
  metadata: Joi.object({
    idempotencyKey: Joi.string()
      .pattern(IDEMPOTENCY_KEY_PATTERN)
      .optional()
      .messages({
        'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
      })
  }).optional(),
}).options({ stripUnknown: true });

/**
 * POST /api/packages/book-package
 * Book a complete package with all services
 * Requires: authenticated customer, valid request body, tenant validation
 * Note: providerId is extracted from the Bundle, not from request body
 */
router.post(
  '/book-package',
  authenticate,
  requireRole('customer'),
  tenantMiddleware,
  asyncHandler(async (req: any, res: any, next: any) => {
    const tenantId = req.tenantId;
    const userId = req.user.id;

    // Validate tenantId format
    if (!tenantId) {
      throw new ApiError(400, 'Tenant ID required');
    }

    // Validate request body with Joi schema
    const { error, value } = bookPackageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn(`Invalid book-package request: ${error.message}`, {
        context: 'PackagesPublic',
        action: 'BOOK_PACKAGE_VALIDATION_FAILED',
        userId,
      });
      throw new ApiError(400, error.details.map(d => d.message).join(', '));
    }

    const bundleId = value.bundleId || req.body?.bundleId;
    if (!bundleId) {
      throw new ApiError(400, 'Package ID is required (bundleId in body)');
    }
    req.params.id = bundleId;

    logger.info('Book package request received', {
      context: 'PackagesPublic',
      action: 'BOOK_PACKAGE_REQUEST',
      userId,
      tenantId,
      bundleId,
      scheduledDate: value.scheduledDate,
      scheduledTime: value.scheduledTime,
    });

    await bookPackage(req, res, next);
  })
);

export default router;
