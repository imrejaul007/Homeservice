import { Request, Response } from 'express';
import mongoose from 'mongoose';
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
  const pageNum = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    return res.status(400).json({ success: false, message: 'Invalid provider ID' });
  }

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

  const totalReviews = providerProfile.reviewsData.totalReviews || 0;
  const totalPages = Math.ceil(totalReviews / limitNum);

  // FIX: Apply pagination BEFORE fetching (prevents loading all reviews into memory)
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedReviewIds = providerProfile.reviewsData.recentReviews
    .slice(startIndex, endIndex)
    .map((review: any) => review.bookingId)
    .filter(Boolean);

  if (paginatedReviewIds.length === 0) {
    return res.json({
      success: true,
      data: {
        reviews: [],
        total: totalReviews,
        totalReviews,
        averageRating: providerProfile.reviewsData.averageRating,
        ratingDistribution: providerProfile.reviewsData.ratingDistribution,
        page: pageNum,
        pages: totalPages,
      },
    });
  }

  // FIX: Single query with $in instead of N+1 individual queries
  const bookings = await Booking.find({ _id: { $in: paginatedReviewIds } })
    .populate([
      { path: 'customerId', select: 'firstName lastName avatar' },
      { path: 'serviceId', select: 'name' },
    ])
    .lean();

  // Create a map for O(1) lookup
  const bookingMap = new Map(
    bookings.map(b => [b._id.toString(), b])
  );

  // Transform reviews maintaining pagination order
  const reviews = paginatedReviewIds
    .map((bookingId: any) => {
      const booking = bookingMap.get(bookingId?.toString());
      if (!booking) return null;

      const reviewData = providerProfile.reviewsData.recentReviews.find(
        (r: any) => r.bookingId?.toString() === bookingId?.toString()
      );

      return {
        _id: reviewData?._id?.toString() || '',
        id: reviewData?._id?.toString() || '',
        rating: reviewData?.rating || 0,
        title: reviewData?.title || '',
        comment: reviewData?.comment || '',
        photos: reviewData?.photos || [],
        isVerified: true,
        createdAt: reviewData?.createdAt || booking.createdAt,
        customer: booking.customerId
          ? {
              id: (booking.customerId as any)._id.toString(),
              firstName: (booking.customerId as any).firstName,
              lastName: (booking.customerId as any).lastName,
              avatar: (booking.customerId as any).avatar,
            }
          : null,
        service: booking.serviceId
          ? { name: (booking.serviceId as any).name || 'Service' }
          : null,
      };
    })
    .filter(Boolean);

  return res.json({
    success: true,
    data: {
      reviews,
      total: totalReviews,
      totalReviews,
      averageRating: providerProfile.reviewsData.averageRating,
      ratingDistribution: providerProfile.reviewsData.ratingDistribution,
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

  const matchStage = {
    customerId: user._id,
    customerReview: { $exists: true, $ne: null }
  };

  // Use aggregation pipeline to apply filtering and pagination at database level
  // This avoids loading all documents into memory before pagination
  const aggregationResult = await Booking.aggregate([
    { $match: matchStage },
    // Lookup customerReview to filter by moderationStatus
    {
      $lookup: {
        from: 'reviews',
        localField: 'customerReview',
        foreignField: '_id',
        as: 'customerReviewData'
      }
    },
    { $unwind: { path: '$customerReviewData', preserveNullAndEmptyArrays: true } },
    // Filter out rejected reviews at database level
    {
      $match: {
        $or: [
          { 'customerReviewData.moderationStatus': { $exists: false } },
          { 'customerReviewData.moderationStatus': { $ne: 'rejected' } }
        ]
      }
    },
    // Facet to get count and paginated data in single query
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: { updatedAt: -1 } },
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          // Lookup related data
          {
            $lookup: {
              from: 'users',
              localField: 'providerId',
              foreignField: '_id',
              as: 'providerData'
            }
          },
          { $unwind: { path: '$providerData', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'services',
              localField: 'serviceId',
              foreignField: '_id',
              as: 'serviceData'
            }
          },
          { $unwind: { path: '$serviceData', preserveNullAndEmptyArrays: true } },
          // Project final shape
          {
            $project: {
              _id: 1,
              provider: {
                id: '$providerData._id',
                name: { $concat: [{ $ifNull: ['$providerData.firstName', ''] }, ' ', { $ifNull: ['$providerData.lastName', ''] }] },
                avatar: '$providerData.avatar'
              },
              service: {
                id: '$serviceData._id',
                name: { $ifNull: ['$serviceData.name', 'Service'] }
              },
              rating: { $ifNull: ['$rating', 0] },
              comment: { $ifNull: ['$reviewComment', ''] },
              images: { $ifNull: ['$reviewPhotos', []] },
              helpfulVotes: 0,
              isVerified: true,
              moderationStatus: { $ifNull: ['$customerReviewData.moderationStatus', 'pending'] },
              createdAt: { $ifNull: ['$customerReviewCreatedAt', '$updatedAt'] },
              updatedAt: 1
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
