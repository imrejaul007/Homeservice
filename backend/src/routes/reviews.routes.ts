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

const voteReviewSchema = Joi.object({
  helpful: Joi.boolean().required(),
});

// ============================================
// Public Routes
// ============================================

// Get provider reviews (public)
// NOTE: This route is also defined in review.routes.ts - consolidated to use review.controller
router.get('/provider/:providerId', reviewController.getProviderReviews);

// ============================================
// ROUTES WITH :reviewId - Specific routes BEFORE parameterized /:reviewId
// ============================================

// Get review votes
router.get('/:reviewId/votes', reviewsController.getReviewVotes);

// Get provider review analytics
router.get('/analytics/provider/:providerId', reviewsController.getProviderReviewAnalytics);

// ============================================
// Protected Routes
// ============================================

// NOTE: POST /reviews/booking/:bookingId is consolidated in review.routes.ts
// to avoid duplicate route definitions. Both routes pointed to reviewsController.submitReview
// which creates standalone Review documents.

// Vote on a review
router.post('/:reviewId/vote',
  authMiddleware.authenticate,
  validate(voteReviewSchema),
  reviewsController.voteReview
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
