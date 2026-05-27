import express from 'express';
import {
  searchServices,
  getSearchSuggestions,
  getTrendingServices,
  getSearchFilters,
  getServiceById,
  trackServiceClick,
  getPopularServices,
  getServicesByCategory,
  // Analytics endpoints
  getSearchAnalyticsSummary,
  getRefinementPatterns,
  getSynonymDictionary,
  previewQueryExpansion,
  getZeroResultSearches,
} from '../controllers/search.controller';
import {
  reindexAllServices,
  getSearchStats,
} from '../services/search.service';
import {
  validateSearchQuery,
  validateSuggestionQuery,
  validateCategoryParam,
  validateServiceId
} from '../middleware/validation/search.validation';
import { searchLimiter, suggestionLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// ============================================
// PUBLIC SEARCH ENDPOINTS
// ============================================

router.get('/services', searchLimiter, validateSearchQuery, searchServices);

router.get('/suggestions', suggestionLimiter, validateSuggestionQuery, getSearchSuggestions);

router.get('/trending', getTrendingServices);

router.get('/filters', getSearchFilters);

router.get('/popular', getPopularServices);

router.get('/category/:category', validateCategoryParam, validateSearchQuery, getServicesByCategory);

router.get('/service/:id', validateServiceId, getServiceById);

router.post('/service/:id/click', validateServiceId, trackServiceClick);

// ============================================
// MEILISEARCH STATS & ADMIN ENDPOINTS
// ============================================

router.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await getSearchStats();
  res.json({ success: true, data: stats });
}));

router.post('/reindex', authenticate, asyncHandler(async (_req, res) => {
  await reindexAllServices();
  res.json({ success: true, message: 'Reindexing started' });
}));

// ============================================
// SEARCH ANALYTICS ENDPOINTS (ADMIN ONLY)
// ============================================

/**
 * GET /api/search/analytics
 * Get search analytics summary - requires admin access
 */
router.get('/analytics', authenticate, getSearchAnalyticsSummary);

/**
 * GET /api/search/analytics/refinements
 * Get search refinement patterns - requires admin access
 */
router.get('/analytics/refinements', authenticate, getRefinementPatterns);

/**
 * GET /api/search/zero-results
 * Get zero-result searches for content gap analysis - requires admin access
 */
router.get('/zero-results', authenticate, getZeroResultSearches);

/**
 * GET /api/search/synonyms
 * Get synonym dictionary for debugging - requires admin access
 */
router.get('/synonyms', authenticate, getSynonymDictionary);

/**
 * POST /api/search/preview-expansion
 * Preview query expansion with synonyms - requires admin access
 */
router.post('/preview-expansion', authenticate, previewQueryExpansion);

export default router;