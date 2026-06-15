import { Router, Request, Response } from 'express';
import reviewController from '../controllers/review.controller';
import reviewsController from '../controllers/reviews.controller';
import { getProviderReviews } from '../controllers/provider.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';
import logger from '../utils/logger';

/**
 * Strip HTML tags to prevent XSS attacks
 */
function sanitizeHtml(input: string): string {
  if (!input) return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const updateReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5),
  comment: Joi.string().max(1000),
  images: Joi.array().items(Joi.string()),
});

const submitReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().min(10).max(1000).required(),
  title: Joi.string().max(100).allow(''),
  photos: Joi.array().items(Joi.string()),
});

// ============================================
// Public Routes
// ============================================

// Backward-compatible alias → canonical GET /api/provider/reviews
router.get('/provider/me', authMiddleware.authenticate, getProviderReviews);

// Get provider reviews for authenticated provider (maps scope param to backend filter)
router.get('/provider/reviews', authMiddleware.authenticate, getProviderReviews);

// Get provider reviews (public) - MUST be after /me and /provider/reviews
// Canonical route using Review model (reviews.routes.ts has same route)
router.get('/provider/:providerId', reviewController.getProviderReviews);

// ============================================
// Protected Routes
// ============================================

// Get my reviews
router.get('/my-reviews',
  authMiddleware.authenticate,
  reviewController.getMyReviews
);

// Submit review for a completed booking (customer)
router.post(
  '/booking/:bookingId',
  authMiddleware.authenticate,
  validate(submitReviewSchema),
  reviewsController.submitReview
);

// Submit review for a package (directly from package detail page)
router.post(
  '/package/:packageId',
  authMiddleware.authenticate,
  validate(submitReviewSchema),
  reviewsController.submitPackageReview
);

// Get package review eligibility (check if user can review a package)
router.get(
  '/package/:packageId/eligibility',
  authMiddleware.authenticate,
  reviewsController.getPackageReviewEligibility
);

// ============================================
// ROUTES WITH :reviewId - Specific routes BEFORE parameterized /:reviewId
// ============================================

// Reply to a review (provider only)
router.post('/:reviewId/reply',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const user = req.user as any;
      const { reviewId } = req.params;
      const { comment } = req.body;

      if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Reply comment is required' });
      }

      if (comment.length > 500) {
        return res.status(400).json({ success: false, message: 'Reply must be 500 characters or less' });
      }

      // Get the review
      const Review = (await import('../models/review.model')).default;
      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({ success: false, message: 'Review not found' });
      }

      // Verify this provider owns this review
      if (review.revieweeId.toString() !== user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to reply to this review' });
      }

      // Check if review is in a state that allows replies (approved or pending only)
      // Rejected reviews should not allow provider replies
      if (review.moderationStatus === 'rejected') {
        return res.status(400).json({ success: false, message: 'Cannot reply to a rejected review' });
      }

      // Check if already replied
      if (review.response) {
        return res.status(400).json({ success: false, message: 'Already replied to this review' });
      }

      // Store the provider response on the review
      review.response = {
        content: comment.trim(),
        createdAt: new Date(),
      };
      await review.save();

      // Update denormalized reviewsData in ProviderProfile to sync the response
      const ProviderProfile = (await import('../models/providerProfile.model')).default;
      await ProviderProfile.recalculateReviewsData(review.revieweeId);

      // FIX: Return response.comment to match frontend expectations
      return res.json({
        success: true,
        message: 'Reply submitted successfully',
        data: {
          response: {
            comment: comment.trim(),  // Frontend expects 'comment'
            content: comment.trim(),   // Keep for backwards compatibility
            createdAt: review.response.createdAt.toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error('Error submitting review reply', {
        context: 'ReviewRoutes',
        action: 'SUBMIT_REPLY_ERROR',
        error: error instanceof Error ? error.message : String(error),
        reviewId: req.params.reviewId,
        userId: (req.user as any)?._id,
      });
      return res.status(500).json({
        success: false,
        message: 'Server error while submitting reply',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      });
    }
  }
);

// Update a review (must be after /:reviewId/reply)
router.patch('/:reviewId',
  authMiddleware.authenticate,
  validate(updateReviewSchema),
  reviewController.updateReview
);

// Delete a review
router.delete('/:reviewId',
  authMiddleware.authenticate,
  reviewController.deleteReview
);

export default router;
