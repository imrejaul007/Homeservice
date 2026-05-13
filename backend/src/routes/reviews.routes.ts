import { Router } from 'express';
import reviewsController from '../controllers/reviews.controller';
import reviewController from '../controllers/review.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const submitReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().min(10).max(1000).required(),
  title: Joi.string().max(100).allow(''),
  photos: Joi.array().items(Joi.string()),
});

// ============================================
// Public Routes
// ============================================

// Get provider reviews (public) - from review.controller
router.get('/provider/:providerId', reviewController.getProviderReviews);

// ============================================
// Protected Routes
// ============================================

// Submit a review
router.post('/booking/:bookingId',
  authMiddleware.authenticate,
  validate(submitReviewSchema),
  reviewsController.submitReview
);

export default router;
