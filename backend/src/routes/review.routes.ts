import { Router, Request, Response } from 'express';
import reviewController from '../controllers/review.controller';
import reviewsController from '../controllers/reviews.controller';
import authMiddleware from '../middleware/auth.middleware';
import Joi from 'joi';
import { validate } from '../middleware/validation.middleware';

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

// Get provider reviews (public)
router.get('/provider/:providerId',
  async (req: Request, res: Response): Promise<Response> => {
    const { providerId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    try {
      const ProviderProfile = (await import('../models/providerProfile.model')).default;
      const BookingModel = (await import('../models/booking.model')).default;

      const providerProfile = await ProviderProfile.findOne({ userId: providerId });

      if (!providerProfile || !providerProfile.reviewsData) {
        return res.json({
          success: true,
          data: {
            reviews: [],
            total: 0,
            averageRating: 0,
            ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          },
        });
      }

      const reviews = await Promise.all(
        providerProfile.reviewsData.recentReviews.slice(0, 20).map(async (review) => {
          const booking = await BookingModel.findById(review.bookingId).populate(
            'customerId',
            'firstName lastName avatar'
          );

          return {
            id: review.bookingId?.toString(),
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            photos: review.photos || [],
            isVerified: true,
            createdAt: review.createdAt,
            customer: booking?.customerId
              ? {
                  id: (booking.customerId as any)._id.toString(),
                  firstName: (booking.customerId as any).firstName,
                  lastName: (booking.customerId as any).lastName,
                  avatar: (booking.customerId as any).avatar,
                }
              : null,
          };
        })
      );

      return res.json({
        success: true,
        data: {
          reviews,
          total: providerProfile.reviewsData.totalReviews,
          averageRating: providerProfile.reviewsData.averageRating,
          ratingDistribution: providerProfile.reviewsData.ratingDistribution,
        },
      });
    } catch (error) {
      console.error('Error fetching provider reviews:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ============================================
// Protected Routes
// ============================================

// Get my reviews
router.get('/my-reviews',
  authMiddleware.authenticate,
  reviewController.getMyReviews
);

// Submit a review for a completed booking
router.post('/booking/:bookingId',
  authMiddleware.authenticate,
  validate(submitReviewSchema),
  reviewsController.submitReview
);

// Update a review
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
