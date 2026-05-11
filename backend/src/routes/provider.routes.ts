import express from 'express';
import {
  getMyServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  getServiceAnalytics,
  getOverviewAnalytics
} from '../controllers/provider.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateProviderRole } from '../middleware/validation.middleware';
import { 
  validateServiceCreation,
  validateServiceUpdate,
  validateServiceId 
} from '../middleware/validation/provider.validation';
import rateLimit from 'express-rate-limit';

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

// Service Management Routes
router.get('/services', getMyServices);
router.get('/services/:id', validateServiceId, getServiceById);
router.post('/services', validateServiceCreation, createService);
router.put('/services/:id', validateServiceId, validateServiceUpdate, updateService);
router.delete('/services/:id', validateServiceId, deleteService);
router.patch('/services/:id/status', validateServiceId, toggleServiceStatus);

// Analytics Routes
router.get('/analytics', getOverviewAnalytics);
router.get('/services/:id/analytics', validateServiceId, getServiceAnalytics);

export default router;