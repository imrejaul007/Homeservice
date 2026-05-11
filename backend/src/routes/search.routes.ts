import express from 'express';
import {
  searchServices,
  getSearchSuggestions,
  getTrendingServices,
  getSearchFilters,
  getServiceById,
  trackServiceClick,
  getPopularServices,
  getServicesByCategory
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
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many search requests, please try again later.',
    retryAfter: 60
  }
});

const suggestionRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: {
    error: 'Too many suggestion requests, please try again later.',
    retryAfter: 60
  }
});

router.get('/services', searchRateLimit, validateSearchQuery, searchServices);

router.get('/suggestions', suggestionRateLimit, validateSuggestionQuery, getSearchSuggestions);

router.get('/trending', getTrendingServices);

router.get('/filters', getSearchFilters);

router.get('/popular', getPopularServices);

router.get('/category/:category', validateCategoryParam, validateSearchQuery, getServicesByCategory);

router.get('/service/:id', validateServiceId, getServiceById);

router.post('/service/:id/click', validateServiceId, trackServiceClick);

// MeiliSearch stats and admin endpoints
router.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await getSearchStats();
  res.json({ success: true, data: stats });
}));

router.post('/reindex', asyncHandler(async (_req, res) => {
  await reindexAllServices();
  res.json({ success: true, message: 'Reindexing started' });
}));

export default router;