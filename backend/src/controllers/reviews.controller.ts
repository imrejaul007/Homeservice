import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { getTenantId } from '../utils/tenantFilter';

// Constants for review submission rules
const REVIEW_WINDOW_DAYS = 14;  // Customer has 14 days after service to submit review
const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const submitReview = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  const { rating, comment, title, photos } = req.body;
  const tenantId = getTenantId(req);

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
    tenantId: tenantId || undefined,
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

  // FIX #6: DO NOT update ratings immediately - delay until review is approved by admin
  // Rating updates are now handled in admin.controller.ts moderateReview function
  // when the review status is set to 'approved'

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
