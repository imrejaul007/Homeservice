import express from 'express';
import {
  getMyServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  getServiceAnalytics,
  getOverviewAnalytics,
  getProviderInsightsAnalytics,
  getProviderOnboardingStatus,
  getProviderVerification,
  uploadVerificationDocument,
  submitVerification,
  getPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  addPortfolioImage,
  removePortfolioImage,
  getProviderSettings,
  updateProviderSettings,
} from '../controllers/provider.controller';
import { authenticate, requireProviderAccount } from '../middleware/auth.middleware';
import { validateProviderRole } from '../middleware/validation.middleware';
import {
  validateServiceCreation,
  validateServiceUpdate,
  validateServiceId
} from '../middleware/validation/provider.validation';
import rateLimit from 'express-rate-limit';
import providerOpsRoutes from './provider-ops.routes';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadPortfolio, uploadPortfolioMultiple } from '../utils/cloudinary';

const router = express.Router();

// Rate limiting for provider operations
const providerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each provider to 100 requests per windowMs
  message: {
    error: 'Too many requests from this provider, please try again later.',
    retryAfter: 15 * 60
  }
});

// Apply authentication and provider role validation to all routes
router.use(authenticate);
router.use(validateProviderRole);
router.use(providerRateLimit);

// Analytics Routes (MUST be before :id routes to prevent matching)
router.get('/analytics/insights', getProviderInsightsAnalytics);
router.get('/analytics', getOverviewAnalytics);

// Service Management Routes (specific routes before :id)
router.get('/services', getMyServices);
router.post('/services', validateServiceCreation, requireProviderAccount, createService);

// Service Routes with ID (after specific routes)
router.get('/services/:id', validateServiceId, getServiceById);
router.put('/services/:id', validateServiceId, validateServiceUpdate, updateService);
router.delete('/services/:id', validateServiceId, deleteService);
router.patch('/services/:id/status', validateServiceId, toggleServiceStatus);
router.get('/services/:id/analytics', validateServiceId, getServiceAnalytics);

// Provider Onboarding Routes (no rate limiting for these as they are lightweight)
router.get('/onboarding', getProviderOnboardingStatus);
router.get('/verification', getProviderVerification);
router.post('/verification/documents', uploadVerificationDocument);
router.post('/verification/submit', submitVerification);

// Provider Settings Routes
router.get('/settings', getProviderSettings);
router.patch('/settings', updateProviderSettings);

// Portfolio Management Routes
router.get('/portfolio', getPortfolioItems);
router.post('/portfolio', uploadPortfolioMultiple, createPortfolioItem);
router.put('/portfolio/:itemId', updatePortfolioItem);
router.delete('/portfolio/:itemId', deletePortfolioItem);
router.patch('/portfolio/:itemId/images', uploadPortfolioMultiple, addPortfolioImage);
router.delete('/portfolio/:itemId/images/:imageId', removePortfolioImage);

// Toggle provider active status
router.patch('/status', asyncHandler(async (req, res) => {
  const providerProfile = await ProviderProfile.findOne({ userId: (req.user as any)._id });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  providerProfile.isActive = !providerProfile.isActive;
  await providerProfile.save();

  res.json({
    success: true,
    data: {
      isActive: providerProfile.isActive
    },
    message: providerProfile.isActive
      ? 'Your profile is now visible to customers'
      : 'Your profile is now hidden from customers'
  });
}));

// Operations Dashboard Routes (requires admin)
router.use('/ops', providerOpsRoutes);

export default router;