/**
 * Package Price Calculator Routes
 * API endpoints for package price calculation
 */

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { validateObjectId } from '../middleware/security-validation.middleware';
import { validateTenantAccess } from '../middleware/tenantValidation.middleware';
import {
  calculatePrice,
  validateDiscount,
  getEstimate,
  getAddOns,
  getDurations,
} from '../controllers/packagePriceCalculator.controller';

/**
 * Price Calculator routes - mounted at /api/packages
 *
 * Endpoints:
 * POST /api/packages/calculate-price - Calculate price with selected options
 * POST /api/packages/validate-discount - Validate a discount code
 * GET /api/packages/:id/estimate - Get base price estimate
 * GET /api/packages/:id/addons - Get available add-ons
 * GET /api/packages/:id/durations - Get available duration options
 */

const router = Router();

/**
 * POST /api/packages/calculate-price
 * Calculate package price with selected add-ons, durations, and discounts
 * Authentication required for personalized pricing
 */
router.post(
  '/calculate-price',
  optionalAuth, // Allow guests to calculate prices too
  validateTenantAccess,
  calculatePrice
);

/**
 * POST /api/packages/validate-discount
 * Validate a discount code without applying it
 * Authentication optional
 */
router.post(
  '/validate-discount',
  optionalAuth,
  validateTenantAccess,
  validateDiscount
);

/**
 * IMPORTANT: The following routes use /:id/* pattern and MUST be defined BEFORE any /:id route
 * to ensure proper Express route matching. Express matches routes in order of definition.
 */

/**
 * GET /api/packages/:id/durations
 * Get available duration options for a package
 * Public endpoint - no auth required
 * NOTE: Defined before /:id to ensure proper route matching
 */
router.get(
  '/:id/durations',
  validateObjectId('id'),
  validateTenantAccess,
  getDurations
);

/**
 * GET /api/packages/:id/addons
 * Get available add-ons for a package
 * Public endpoint - no auth required
 * NOTE: Defined before /:id to ensure proper route matching
 */
router.get(
  '/:id/addons',
  validateObjectId('id'),
  validateTenantAccess,
  getAddOns
);

/**
 * GET /api/packages/:id/estimate
 * Get base price estimate for a package
 * Public endpoint - no auth required
 * NOTE: Defined before /:id to ensure proper route matching
 */
router.get(
  '/:id/estimate',
  validateObjectId('id'),
  validateTenantAccess,
  getEstimate
);

export default router;
