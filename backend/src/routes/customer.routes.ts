import { Router } from 'express';
import customerController from '../controllers/customer.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';

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

const updateAddressSchema = Joi.object({
  label: Joi.string(),
  street: Joi.string(),
  city: Joi.string(),
  state: Joi.string().allow(''),
  country: Joi.string(),
  zipCode: Joi.string().allow(''),
  coordinates: Joi.object({
    lat: Joi.number(),
    lng: Joi.number(),
  }),
  isDefault: Joi.boolean(),
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

// Addresses
router.get('/addresses',
  authMiddleware.authenticate,
  customerController.getAddresses
);

router.post('/addresses',
  authMiddleware.authenticate,
  validate(addressSchema),
  customerController.addAddress
);

router.patch('/addresses/:addressId',
  authMiddleware.authenticate,
  validate(updateAddressSchema),
  customerController.updateAddress
);

router.delete('/addresses/:addressId',
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

export default router;
