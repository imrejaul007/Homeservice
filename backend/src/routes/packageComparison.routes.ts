import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validateObjectId } from '../middleware/security-validation.middleware';
import { validateTenantAccess } from '../middleware/tenantValidation.middleware';
import {
  comparePackages,
  getRecommendedForComparison,
} from '../controllers/packageComparison.controller';

/**
 * Package Comparison Routes
 *
 * Mounted at /api/packages/compare
 *
 * Routes:
 * - GET /api/packages/compare?packageIds=id1,id2,id3 - Compare multiple packages
 * - GET /api/packages/compare/recommended - Get recommended packages for comparison
 *
 * SECURITY: All routes require authentication and tenant validation
 * to prevent cross-tenant data access
 */
const router = Router();

/**
 * GET /api/packages/compare
 * Compare multiple packages side-by-side
 *
 * Query Parameters:
 * - packageIds: comma-separated list of package IDs (2-5 packages required)
 *
 * Example: GET /api/packages/compare?packageIds=507f1f77bcf86cd799439011,507f1f77bcf86cd799439012
 */
router.get(
  '/',
  authenticate,
  validateTenantAccess,
  comparePackages
);

/**
 * GET /api/packages/compare/recommended
 * Get recommended packages for comparison
 *
 * Query Parameters:
 * - category: Filter by category (optional)
 * - minPrice: Minimum price filter (optional)
 * - maxPrice: Maximum price filter (optional)
 * - excludeIds: Comma-separated IDs to exclude (optional)
 */
router.get(
  '/recommended',
  authenticate,
  validateTenantAccess,
  getRecommendedForComparison
);

export default router;
