import { Router } from 'express';
import {
  getMasterCategories,
  getCategoryBySlug,
  getCategoryById,
  getSubcategories,
  getCategoryServices,
  getCategoryStats,
  searchCategories,
  updateSubcategory,
  deleteSubcategory
} from '../controllers/category.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import ServiceCategory from '../models/serviceCategory.model';
import logger from '../utils/logger';

const router = Router();

/**
 * Public Category Routes
 * All routes are public - no authentication required
 */

// GET /api/categories - Get all master categories
// Query params: featured=true (optional)
router.get('/', getMasterCategories);

// GET /api/categories/stats - Get categories with service counts
router.get('/stats', getCategoryStats);

// GET /api/categories/id/:id - Get category by ID (returns slug for redirect)
// This must come BEFORE /:slug to avoid route conflicts
router.get('/id/:id', getCategoryById);

// GET /api/categories/search - Search categories and subcategories
// Query params: q (search query)
router.get('/search', searchCategories);

// GET /api/categories/:slug - Get category by slug with full details
router.get('/:slug', getCategoryBySlug);

// GET /api/categories/:slug/subcategories - Get subcategories for a category
router.get('/:slug/subcategories', getSubcategories);

// GET /api/categories/:slug/services - Get services under a category
// Query params: subcategory, page, limit, sortBy
router.get('/:slug/services', getCategoryServices);

// Subcategory management routes (require authentication)
router.put('/:slug/subcategories/:subSlug', authenticate, requireRole('admin'), updateSubcategory);
router.delete('/:slug/subcategories/:subSlug', authenticate, requireRole('admin'), deleteSubcategory);

/**
 * FIX: Get service categories for frontend dropdown
 * GET /api/service-categories
 * Returns simple category list for portfolio categorization
 */
router.get('/service-categories/list', asyncHandler(async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true })
      .select('name slug')
      .sort({ name: 1 })
      .lean();

    // Extract unique category names for dropdown
    const categoryNames = [...new Set(categories.map(c => c.name))].sort();

    logger.debug('Service categories fetched for frontend', {
      context: 'CategoryRoutes',
      action: 'FETCH_SERVICE_CATEGORIES',
      count: categoryNames.length,
    });

    res.json({
      success: true,
      data: {
        categories: categoryNames,
        // Also return full data for future extensibility
        fullCategories: categories
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch service categories', {
      context: 'CategoryRoutes',
      action: 'FETCH_SERVICE_CATEGORIES_ERROR',
      error: error.message,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
}));

export default router;
