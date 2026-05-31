import { Router } from 'express';
import reviewsController from '../controllers/reviews.controller';
import reviewController from '../controllers/review.controller';
import * as reviewDraftController from '../controllers/reviewDraft.controller';
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

// ============================================
// Review Draft Routes
// ============================================

// Save or update a draft
router.post('/drafts',
  authMiddleware.authenticate,
  reviewDraftController.saveDraft
);

// Get all user drafts
router.get('/drafts',
  authMiddleware.authenticate,
  reviewDraftController.getUserDrafts
);

// Get draft count
router.get('/drafts/count',
  authMiddleware.authenticate,
  reviewDraftController.getDraftCount
);

// Get draft by booking ID
router.get('/drafts/:bookingId',
  authMiddleware.authenticate,
  reviewDraftController.getDraft
);

// Delete draft
router.delete('/drafts/:bookingId',
  authMiddleware.authenticate,
  reviewDraftController.deleteDraft
);

// Submit draft as review
router.post('/drafts/:bookingId/submit',
  authMiddleware.authenticate,
  reviewDraftController.submitDraft
);

// Submit review directly (without draft)
router.post('/',
  authMiddleware.authenticate,
  reviewDraftController.submitReview
);

export default router;
