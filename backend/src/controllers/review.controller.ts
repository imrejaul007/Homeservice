import { Request, Response } from 'express';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ============================================
// Get Provider Reviews (Public)
// ============================================

export const getProviderReviews = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { page = '1', limit = '10' } = req.query;

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

  // Get reviews with customer and service info
  const reviews = await Promise.all(
    providerProfile.reviewsData.recentReviews.slice(0, 20).map(async (review) => {
      const booking = await Booking.findById(review.bookingId).populate([
        { path: 'customerId', select: 'firstName lastName avatar' },
        { path: 'serviceId', select: 'name' },
      ]);

      let serviceName = 'Service';
      if (booking?.serviceId) {
        const service = await Service.findById(booking.serviceId).select('name').lean();
        serviceName = service?.name || 'Service';
      }

      return {
        id: review.bookingId?.toString() || '',
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
        service: booking?.serviceId ? { name: serviceName } : null,
      };
    })
  );

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedReviews = reviews.slice(startIndex, endIndex);

  return res.json({
    success: true,
    data: {
      reviews: paginatedReviews,
      total: providerProfile.reviewsData.totalReviews,
      totalReviews: providerProfile.reviewsData.totalReviews, // Alias for frontend compatibility
      averageRating: providerProfile.reviewsData.averageRating,
      ratingDistribution: providerProfile.reviewsData.ratingDistribution,
      page: pageNum,
      pages: Math.ceil(providerProfile.reviewsData.totalReviews / limitNum),
    },
  });
});

// ============================================
// Get My Reviews (Reviews written by current user)
// ============================================

export const getMyReviews = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { page = '1', limit = '20' } = req.query;

  // Get all bookings where this user left a review (via customerReview reference)
  const bookings = await Booking.find({
    customerId: user._id,
    customerReview: { $exists: true, $ne: null }
  })
    .populate('providerId', 'firstName lastName avatar')
    .populate('serviceId', 'name')
    .sort({ updatedAt: -1 });

  // Transform to review format
  const reviews = bookings.map(booking => ({
    _id: booking._id.toString(),
    bookingId: booking._id,
    provider: {
      id: (booking.providerId as any)?._id,
      name: `${(booking.providerId as any)?.firstName || ''} ${(booking.providerId as any)?.lastName || ''}`.trim(),
      avatar: (booking.providerId as any)?.avatar,
    },
    service: {
      id: (booking.serviceId as any)?._id,
      name: (booking.serviceId as any)?.name || 'Service',
    },
    rating: (booking as any).rating || 0,
    comment: (booking as any).reviewComment || '',
    images: (booking as any).reviewPhotos || [],
    isVerified: true,
    createdAt: (booking as any).customerReviewCreatedAt || booking.updatedAt,
    updatedAt: booking.updatedAt,
  }));

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedReviews = reviews.slice(startIndex, endIndex);

  return res.json({
    success: true,
    data: {
      reviews: paginatedReviews,
      total: reviews.length,
      page: pageNum,
      pages: Math.ceil(reviews.length / limitNum),
    },
  });
});

// ============================================
// Update a Review
// ============================================

export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { reviewId } = req.params;
  const { rating, comment, images } = req.body;

  const booking = await Booking.findOne({
    _id: reviewId,
    customerId: user._id,
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (!(booking as any).customerReview) {
    throw new ApiError(400, 'No review found for this booking');
  }

  // Check if review is within 30 days
  const reviewDate = (booking as any).customerReviewCreatedAt || booking.updatedAt;
  const daysSinceReview = (Date.now() - new Date(reviewDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceReview > 30) {
    throw new ApiError(400, 'Reviews can only be edited within 30 days');
  }

  // Update review fields on booking
  if (rating !== undefined) (booking as any).rating = rating;
  if (comment !== undefined) (booking as any).reviewComment = comment;
  if (images !== undefined) (booking as any).reviewPhotos = images;

  await booking.save();

  return res.json({
    success: true,
    message: 'Review updated successfully',
    data: {
      review: {
        _id: booking._id.toString(),
        rating: (booking as any).rating,
        comment: (booking as any).reviewComment,
        images: (booking as any).reviewPhotos,
        isVerified: true,
        createdAt: reviewDate,
        updatedAt: new Date(),
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

  const booking = await Booking.findOne({
    _id: reviewId,
    customerId: user._id,
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (!(booking as any).customerReview) {
    throw new ApiError(400, 'No review found for this booking');
  }

  // Update provider's average rating
  const providerProfile = await ProviderProfile.findOne({ userId: booking.providerId });
  if (providerProfile?.reviewsData) {
    const bookingsWithReviews = await Booking.countDocuments({
      providerId: booking.providerId,
      customerReview: { $exists: true, $ne: null },
      _id: { $ne: booking._id },
    });

    if (bookingsWithReviews > 0) {
      const avgResult = await Booking.aggregate([
        { $match: { providerId: booking.providerId, customerReview: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]);
      providerProfile.reviewsData.averageRating = avgResult[0]?.avgRating || 0;
      providerProfile.reviewsData.totalReviews = bookingsWithReviews;
    } else {
      providerProfile.reviewsData.averageRating = 0;
      providerProfile.reviewsData.totalReviews = 0;
    }

    await providerProfile.save();
  }

  // Clear the review fields
  (booking as any).customerReview = undefined;
  (booking as any).rating = 0;
  (booking as any).reviewComment = '';
  (booking as any).reviewPhotos = [];
  await booking.save();

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
