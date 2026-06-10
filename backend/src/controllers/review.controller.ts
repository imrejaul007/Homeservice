import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import Review, { PUBLIC_REVIEW_QUERY } from '../models/review.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

const INVALID_ID_ERROR = 'Invalid ID format';

// ============================================
// Get Provider Reviews (Public)
// ============================================

export const getProviderReviews = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const pageNum = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    return res.status(400).json({ success: false, message: 'Invalid provider ID' });
  }

  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const stats = await Review.getProviderStats(providerId);
  const totalReviews = stats.totalReviews || 0;
  const averageRating = totalReviews > 0 ? stats.averageRating : 0;
  const ratingDistribution = stats.ratingDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const totalPages = Math.ceil(totalReviews / limitNum);

  if (totalReviews === 0) {
    return res.json({
      success: true,
      data: {
        reviews: [],
        total: 0,
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        page: pageNum,
        pages: 0,
      },
    });
  }

  const reviewDocs = await Review.find({
    revieweeId: providerObjectId,
    reviewerType: 'customer',
    ...PUBLIC_REVIEW_QUERY,
  })
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate('reviewerId', 'firstName lastName avatar')
    .populate({
      path: 'bookingId',
      select: 'serviceId',
      populate: { path: 'serviceId', select: 'name' },
    })
    .lean();

  const reviews = reviewDocs.map((review) => {
    const customer = review.reviewerId as {
      _id?: mongoose.Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatar?: string;
    } | null;
    const booking = review.bookingId as {
      serviceId?: { name?: string } | mongoose.Types.ObjectId;
    } | null;
    const serviceName =
      booking?.serviceId && typeof booking.serviceId === 'object' && 'name' in booking.serviceId
        ? (booking.serviceId as { name?: string }).name
        : undefined;

    return {
      _id: review._id.toString(),
      id: review._id.toString(),
      rating: review.rating,
      title: review.title || '',
      comment: review.comment,
      photos: review.photos || [],
      isVerified: review.isVerified,
      createdAt: review.createdAt,
      customer: customer
        ? {
            id: customer._id?.toString() || '',
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            avatar: customer.avatar,
          }
        : null,
      service: serviceName ? { name: serviceName } : null,
    };
  });

  return res.json({
    success: true,
    data: {
      reviews,
      total: totalReviews,
      totalReviews,
      averageRating,
      ratingDistribution,
      page: pageNum,
      pages: totalPages,
    },
  });
});

// ============================================
// Get My Reviews (Reviews written by current user)
// ============================================

export const getMyReviews = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const pageNum = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

  // FIX: Query Review collection directly since reviews are stored in Review model
  // This is cleaner and more aligned with the actual data storage pattern
  const matchStage: any = {
    reviewerId: user._id,
    reviewerType: 'customer',
  };

  // Use aggregation pipeline to apply filtering and pagination at database level
  const aggregationResult = await Review.aggregate([
    { $match: matchStage },
    // Lookup booking to get service and provider info
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'bookingData'
      }
    },
    { $unwind: { path: '$bookingData', preserveNullAndEmptyArrays: true } },
    // Lookup provider
    {
      $lookup: {
        from: 'users',
        localField: 'revieweeId',
        foreignField: '_id',
        as: 'providerData'
      }
    },
    { $unwind: { path: '$providerData', preserveNullAndEmptyArrays: true } },
    // Lookup service
    {
      $lookup: {
        from: 'services',
        localField: 'bookingData.serviceId',
        foreignField: '_id',
        as: 'serviceData'
      }
    },
    { $unwind: { path: '$serviceData', preserveNullAndEmptyArrays: true } },
    // Facet to get count and paginated data in single query
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          // Project final shape with data from Review, Booking, User, Service
          {
            $project: {
              _id: 1,
              bookingId: '$bookingData._id',
              provider: {
                id: '$providerData._id',
                name: { $concat: [{ $ifNull: ['$providerData.firstName', ''] }, ' ', { $ifNull: ['$providerData.lastName', ''] }] },
                avatar: '$providerData.avatar'
              },
              service: {
                id: '$serviceData._id',
                name: { $ifNull: ['$serviceData.name', 'Service'] }
              },
              // Get rating from Review document
              rating: '$rating',
              comment: '$comment',
              photos: { $ifNull: ['$photos', []] },
              title: { $ifNull: ['$title', ''] },
              helpfulVotes: { $ifNull: ['$helpfulVotes', 0] },
              isVerified: '$isVerified',
              moderationStatus: { $ifNull: ['$moderationStatus', 'pending'] },
              response: '$response',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt'
            }
          }
        ]
      }
    }
  ]);

  const total = aggregationResult[0]?.metadata[0]?.total || 0;
  const reviews = aggregationResult[0]?.data || [];
  const totalPages = Math.ceil(total / limitNum);

  return res.json({
    success: true,
    data: {
      reviews,
      total,
      totalReviews: total,
      page: pageNum,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: totalPages,
      },
    },
  });
});

// ============================================
// Update a Review
// ============================================

export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { reviewId } = req.params;
  const { rating, comment, images, photos } = req.body;

  // Support both 'images' and 'photos' field names
  const photosToSave = images ?? photos;

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, INVALID_ID_ERROR);
  }

  // FIX: First look up the review by reviewId
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // Verify the review belongs to the current user
  if (review.reviewerId.toString() !== user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this review');
  }

  // Verify it's a customer review (only customers can update their reviews)
  if (review.reviewerType !== 'customer') {
    throw new ApiError(400, 'Only customer reviews can be updated');
  }

  // Check if review is within 30 days
  const daysSinceReview = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceReview > 30) {
    throw new ApiError(400, 'Reviews can only be edited within 30 days');
  }

  // Update review fields
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  if (images !== undefined || photos !== undefined) review.photos = photosToSave;

  // Reset moderation status to pending when edited
  review.moderationStatus = 'pending';

  await review.save();

  return res.json({
    success: true,
    message: 'Review updated successfully',
    data: {
      review: {
        _id: review._id.toString(),
        rating: review.rating,
        comment: review.comment,
        photos: review.photos,
        isVerified: review.isVerified,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
    },
  });
});

// ============================================
// Delete a Review
// ============================================

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { reviewId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, INVALID_ID_ERROR);
  }

  // FIX: First look up the review by reviewId
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // Verify the review belongs to the current user
  if (review.reviewerId.toString() !== user._id.toString()) {
    throw new ApiError(403, 'Not authorized to delete this review');
  }

  // Verify it's a customer review (only customers can delete their reviews)
  if (review.reviewerType !== 'customer') {
    throw new ApiError(400, 'Only customer reviews can be deleted');
  }

  // Store provider ID for recalculating stats later
  const providerId = review.revieweeId;
  const tenantId = review.tenantId;

  // The Review model's post-findOneAndDelete hook will:
  // 1. Recalculate provider's review stats
  // 2. Clear customerReview reference from the Booking

  // Delete the review
  await Review.findByIdAndDelete(reviewId);

  return res.json({
    success: true,
    message: 'Review deleted successfully',
  });
});

export default {
  getProviderReviews,
  getMyReviews,
  updateReview,
  deleteReview,
};
