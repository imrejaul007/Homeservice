import { Router } from 'express';
import {
  getMasterCategories,
  getCategoryBySlug,
  getSubcategories,
  getCategoryServices,
  getCategoryStats,
  searchCategories
} from '../controllers/category.controller';

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

export default router;
