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

// Get provider's own reviews (for provider dashboard) - MUST be before /:providerId
router.get('/provider/me',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const user = req.user as any;

      const Review = (await import('../models/review.model')).default;

      // Get reviews for this provider using the Review model
      const reviews = await Review.find({
        revieweeId: user._id,
        reviewerType: 'customer',
        isHidden: false,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('reviewerId', 'firstName lastName avatar');

      // Compute stats manually
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 0;

      const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach((r) => {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
        }
      });

      const transformedReviews = reviews.map((review) => ({
        id: review._id.toString(),
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: review.photos || [],
        isVerified: review.isVerified,
        createdAt: review.createdAt,
        customer: review.reviewerId
          ? {
              id: (review.reviewerId as any)._id.toString(),
              firstName: (review.reviewerId as any).firstName,
              lastName: (review.reviewerId as any).lastName,
              avatar: (review.reviewerId as any).avatar,
            }
          : null,
        response: review.response
          ? {
              comment: review.response.content,
              createdAt: review.response.createdAt?.toISOString(),
            }
          : undefined,
      }));

      return res.json({
        success: true,
        data: {
          reviews: transformedReviews,
          total: totalReviews,
          averageRating,
          ratingDistribution,
        },
      });
    } catch (error) {
      console.error('Error fetching provider reviews:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Get provider reviews (public) - MUST be after /me
router.get('/provider/:providerId',
  async (req: Request, res: Response): Promise<Response> => {
    const { providerId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    try {
      const ProviderProfile = (await import('../models/providerProfile.model')).default;

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

      // Batch fetch all customer IDs and service IDs from reviews
      const reviewItems = providerProfile.reviewsData.recentReviews.slice(0, 20);
      const customerIds = [...new Set(reviewItems.map(r => r.customerId?.toString()).filter(Boolean))];
      const serviceIds = [...new Set(reviewItems.map(r => r.serviceId?.toString()).filter(Boolean))];

      // Batch fetch customers and services for efficiency
      const UserModel = (await import('../models/user.model')).default;
      const Service = (await import('../models/service.model')).default;

      const [customers, services] = await Promise.all([
        customerIds.length > 0
          ? UserModel.find({ _id: { $in: customerIds } })
              .select('firstName lastName avatar')
              .lean()
          : [],
        serviceIds.length > 0
          ? Service.find({ _id: { $in: serviceIds } })
              .select('name')
              .lean()
          : []
      ]);

      // Create lookup maps for O(1) access
      const customerMap = new Map(customers.map(c => [c._id.toString(), c]));
      const serviceMap = new Map(services.map(s => [s._id.toString(), s]));

      const reviews = reviewItems.map((review) => {
        const customerId = review.customerId?.toString();
        const serviceId = review.serviceId?.toString();
        const customer = customerId ? customerMap.get(customerId) : undefined;
        const service = serviceId ? serviceMap.get(serviceId) : undefined;

        return {
          id: review.bookingId?.toString(),
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          photos: review.photos || [],
          isVerified: review.isVerified ?? true,
          helpfulVotes: review.helpfulVotes,
          createdAt: review.createdAt,
          customer: customer
            ? {
                id: customer._id.toString(),
                firstName: customer.firstName,
                lastName: customer.lastName,
                avatar: customer.avatar,
              }
            : null,
          service: service
            ? {
                id: service._id.toString(),
                name: service.name,
              }
            : null,
        };
      });

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

      return res.json({
        success: true,
        message: 'Reply submitted successfully',
        data: {
          response: {
            comment: comment.trim(),
            createdAt: review.response.createdAt.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Error submitting review reply:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

export default router;
