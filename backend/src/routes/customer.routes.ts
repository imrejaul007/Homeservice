import { Router } from 'express';
import customerController from '../controllers/customer.controller';
import customerAnalyticsController from '../controllers/customer.analytics.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';
import { perUserRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const addressSchema = Joi.object({
  label: Joi.string().required(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().allow(''),
  country: Joi.string().default('UAE'),
  zipCode: Joi.string().allow(''),
  coordinates: Joi.object({
    lat: Joi.number(),
    lng: Joi.number(),
  }),
  isDefault: Joi.boolean(),
});

// SECURITY FIX: Field-level validation for updateAddress to prevent mass assignment
const updateAddressSchema = Joi.object({
  label: Joi.string().min(1).max(100),
  street: Joi.string().min(1).max(500),
  city: Joi.string().min(1).max(100),
  state: Joi.string().allow('').max(100),
  country: Joi.string().max(100),
  zipCode: Joi.string().allow('').max(20),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
  }),
  isDefault: Joi.boolean(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

const paymentMethodSchema = Joi.object({
  type: Joi.string().valid('card', 'apple_pay', 'google_pay').required(),
  token: Joi.string().required(), // Payment gateway token
  isDefault: Joi.boolean(),
});

const updatePaymentMethodSchema = Joi.object({
  isDefault: Joi.boolean(),
  nickname: Joi.string().allow(''),
});

// ============================================
// Routes (All Protected)
// ============================================

// Addresses - All address operations protected with rate limiting
router.get('/addresses',
  perUserRateLimiter,
  authMiddleware.authenticate,
  customerController.getAddresses
);

router.post('/addresses',
  perUserRateLimiter,
  authMiddleware.authenticate,
  validate(addressSchema),
  customerController.addAddress
);

router.patch('/addresses/:addressId',
  perUserRateLimiter,
  authMiddleware.authenticate,
  validate(updateAddressSchema),
  customerController.updateAddress
);

router.delete('/addresses/:addressId',
  perUserRateLimiter,
  authMiddleware.authenticate,
  customerController.deleteAddress
);

// Payment Methods
router.get('/payment-methods',
  authMiddleware.authenticate,
  customerController.getPaymentMethods
);

router.post('/payment-methods',
  authMiddleware.authenticate,
  validate(paymentMethodSchema),
  customerController.addPaymentMethod
);

router.delete('/payment-methods/:paymentMethodId',
  authMiddleware.authenticate,
  customerController.deletePaymentMethod
);

router.patch('/payment-methods/:paymentMethodId',
  authMiddleware.authenticate,
  validate(updatePaymentMethodSchema),
  customerController.updatePaymentMethod
);

// ============================================
// Customer Analytics Routes
// ============================================

router.get('/stats',
  authMiddleware.authenticate,
  customerAnalyticsController.getCustomerStats
);

router.get('/analytics',
  authMiddleware.authenticate,
  customerAnalyticsController.getCustomerAnalytics
);

router.get('/health-score',
  authMiddleware.authenticate,
  customerAnalyticsController.getCustomerHealthScore
);

export default router;
