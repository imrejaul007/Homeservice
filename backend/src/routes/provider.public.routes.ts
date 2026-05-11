import express from 'express';
import {
  getProviderById,
  getProvidersByCategory,
  getProvidersBySubcategory,
  getFeaturedProviders
} from '../controllers/provider.public.controller';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for public provider endpoints
const providerRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 60
  }
});

router.use(providerRateLimit);

// Get featured providers
// GET /api/providers/featured
router.get('/featured', getFeaturedProviders);

// Get providers by category
// GET /api/providers/category/:slug
router.get('/category/:slug', getProvidersByCategory);

// Get providers by subcategory
// GET /api/providers/subcategory/:categorySlug/:subcategorySlug
router.get('/subcategory/:categorySlug/:subcategorySlug', getProvidersBySubcategory);

// Get provider by ID (must be last to avoid conflicts with other routes)
// GET /api/providers/:id
router.get('/:id', getProviderById);

export default router;
