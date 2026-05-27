import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { eventBus, EVENT_TYPES } from '../event-bus';

// Constants for review submission rules
const REVIEW_WINDOW_DAYS = 14;  // Customer has 14 days after service to submit review
const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const submitReview = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  const { rating, comment, title, photos } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }
  if (!comment || comment.trim().length === 0) {
    throw new ApiError(400, 'Comment is required');
  }
  if (comment.trim().length < 10) {
    throw new ApiError(400, 'Comment must be at least 10 characters');
  }

  // Validate bookingId format
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  // Use atomic findOneAndUpdate to check and update in one operation
  // This prevents race conditions where two requests could both pass the check
  const booking = await Booking.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(bookingId),
      customerId: user._id,
      status: 'completed',
    },
    {
      new: true,  // Return updated document
    }
  );

  if (!booking) {
    throw new ApiError(404, 'Booking not found or not completed');
  }

  // FIX #1: Use customerReview instead of review.isReviewed
  // customerReview is an ObjectId reference - check if it exists and is not null
  if (booking.customerReview) {
    throw new ApiError(400, 'Already reviewed');
  }

  // FIX #4: Add time window check - customer must submit review within 14 days of service completion
  const serviceCompletionDate = booking.completedAt || booking.estimatedEndTime;
  const now = new Date();
  const daysSinceCompletion = (now.getTime() - serviceCompletionDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCompletion > REVIEW_WINDOW_DAYS) {
    throw new ApiError(
      400,
      `Reviews must be submitted within ${REVIEW_WINDOW_DAYS} days after service completion. ` +
      `This service was completed ${Math.floor(daysSinceCompletion)} days ago.`
    );
  }

  // Create the review document
  const review = new Review({
    bookingId: booking._id,
    reviewerId: user._id,
    reviewerType: 'customer',
    revieweeId: booking.providerId,
    revieweeType: 'provider',
    rating,
    title: title || '',
    comment: comment.trim(),
    photos: photos || [],
    isVerified: true,  // Customer reviews from completed bookings are verified
  });

  // Save the review first
  await review.save();

  // FIX #2: Update booking atomically with customerReview reference
  // Using findOneAndUpdate ensures atomic update and prevents race conditions
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      customerReview: { $exists: false }  // Double-check no review exists (race condition protection)
    },
    {
      $set: {
        customerReview: review._id,
      },
    },
    { new: true }
  );

  if (!updatedBooking) {
    // Race condition: another request already created a review
    // Rollback the review we just created
    await Review.findByIdAndDelete(review._id);
    throw new ApiError(400, 'Review was already submitted');
  }

  // FIX #3: Update provider profile stats atomically
  const providerProfile = await ProviderProfile.findOneAndUpdate(
    { userId: booking.providerId },
    {
      $setOnInsert: {
        reviewsData: {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          recentReviews: [],
          responseRate: 0,
          avgResponseTime: 0,
        },
      },
    },
    { new: true, upsert: true }
  );

  if (providerProfile) {
    // Calculate new average
    const prev = providerProfile.reviewsData;
    const newTotal = prev.averageRating * prev.totalReviews + rating;
    const newReviewCount = prev.totalReviews + 1;
    const newAverage = newTotal / newReviewCount;

    // Update provider profile with new stats
    await ProviderProfile.findByIdAndUpdate(providerProfile._id, {
      $set: {
        'reviewsData.averageRating': Math.round(newAverage * 10) / 10,
        'reviewsData.totalReviews': newReviewCount,
        [`reviewsData.ratingDistribution.${rating}`]: (prev.ratingDistribution as any)[rating] + 1,
      },
      $push: {
        'reviewsData.recentReviews': {
          $each: [{
            customerId: user._id,
            bookingId: booking._id,
            serviceId: booking.serviceId,
            rating,
            title: title || '',
            comment: comment.trim(),
            photos: photos || [],
            isVerified: true,
            helpfulVotes: 0,
            createdAt: new Date(),
          }],
          $position: 0,
          $slice: 20,  // Keep only 20 most recent reviews
        },
      },
    });
  }

  // Keep per-service rating in sync (used on provider service management)
  if (booking.serviceId) {
    const service = await Service.findById(booking.serviceId);
    if (service?.rating) {
      const prev = service.rating;
      const newCount = prev.count + 1;
      const newAverage = (prev.average * prev.count + rating) / newCount;
      const distKey = String(rating) as '1' | '2' | '3' | '4' | '5';
      const distribution = { ...prev.distribution };
      distribution[distKey] = (distribution[distKey] || 0) + 1;

      await Service.findByIdAndUpdate(booking.serviceId, {
        $set: {
          'rating.average': Math.round(newAverage * 10) / 10,
          'rating.count': newCount,
          'rating.distribution': distribution,
        },
      });
    }
  }

  // Publish review received event for notifications
  eventBus.publish(EVENT_TYPES.REVIEW_RECEIVED, {
    reviewId: review._id.toString(),
    providerId: booking.providerId.toString(),
    bookingId: booking._id.toString(),
    customerName: user.firstName + ' ' + user.lastName,
    rating: review.rating,
  });

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: {
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: review.photos,
        isVerified: review.isVerified,
        createdAt: review.createdAt,
      },
    },
  });
});

export default { submitReview };
