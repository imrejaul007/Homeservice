import { Router } from 'express';
import recurringBookingController from '../controllers/recurringBooking.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const createSubscriptionSchema = Joi.object({
  serviceId: Joi.string().required(),
  providerId: Joi.string().required(),
  frequency: Joi.string().valid('daily', 'weekly', 'biweekly', 'monthly', 'quarterly').required(),
  interval: Joi.number().integer().min(1).default(1),
  startDate: Joi.date().iso().required(),
  preferredTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
  notes: Joi.string().max(500).allow(''),
  addressId: Joi.string(),
});

const updateSubscriptionSchema = Joi.object({
  status: Joi.string().valid('active', 'paused', 'cancelled'),
  frequency: Joi.string().valid('daily', 'weekly', 'biweekly', 'monthly', 'quarterly'),
  interval: Joi.number().integer().min(1),
  preferredTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  notes: Joi.string().max(500).allow(''),
});

// ============================================
// Routes (All Protected)
// ============================================

// Get all subscriptions for the authenticated customer
router.get('/',
  authMiddleware.authenticate,
  recurringBookingController.getSubscriptions
);

// Create a new subscription
router.post('/',
  authMiddleware.authenticate,
  validate(createSubscriptionSchema),
  recurringBookingController.createSubscription
);

// Update a subscription (pause, resume, modify)
router.patch('/:subscriptionId',
  authMiddleware.authenticate,
  validate(updateSubscriptionSchema),
  recurringBookingController.updateSubscription
);

// Cancel/delete a subscription
router.delete('/:subscriptionId',
  authMiddleware.authenticate,
  recurringBookingController.deleteSubscription
);

export default router;
