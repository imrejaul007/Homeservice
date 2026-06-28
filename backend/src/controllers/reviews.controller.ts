import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import Service from '../models/service.model';
import Bundle from '../models/bundle.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { getTenantId } from '../utils/tenantFilter';
import logger from '../utils/logger';
import { checkContent } from '../services/contentModeration.service';

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
    tenantId: tenantId ?? undefined,
    bookingId: booking._id,
    serviceId: booking.serviceId,
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

  // Run content moderation check on review submission
  const combinedContent = `${title || ''} ${comment}`.trim();
  const moderationResult = checkContent(combinedContent);

  // Log moderation decision
  logger.info('Content moderation check for review', {
    context: 'ReviewsController',
    action: 'CONTENT_MODERATION',
    reviewId: review._id?.toString(),
    userId: user._id.toString(),
    moderationScore: moderationResult.score,
    moderationAction: moderationResult.action,
    issues: moderationResult.issues.map(i => i.type),
  });

  // Auto-flag reviews with problematic content for manual review
  if (moderationResult.action === 'flag' || moderationResult.action === 'reject') {
    review.autoFlagged = true;
    review.moderationScore = moderationResult.score;
    review.moderationIssues = moderationResult.issues.map(i => i.type);
    review.moderationReason = `Auto-flagged: ${moderationResult.issues.map(i => i.type).join(', ')} (score: ${moderationResult.score})`;
  } else {
    // Still store the score for analytics even if auto-approved
    review.moderationScore = moderationResult.score;
  }

  // Save the review first
  await review.save();

  // FIX #2: Update booking atomically with customerReview reference
  // Using findOneAndUpdate ensures atomic update and prevents race conditions
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      $or: [
        { customerReview: { $exists: false } },  // Field doesn't exist
        { customerReview: null }                 // Field is null (no review submitted)
      ]
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

  // FIX: Get booking details for socket event
  const bookingDetails = await Booking.findById(booking._id)
    .select('bookingNumber serviceId')
    .populate('serviceId', 'name')
    .lean();

  // Publish review received event for notifications (now includes bookingNumber and serviceName for socket)
  eventBus.publish(EVENT_TYPES.REVIEW_RECEIVED, {
    reviewId: review._id.toString(),
    providerId: booking.providerId.toString(),
    bookingId: booking._id.toString(),
    bookingNumber: bookingDetails?.bookingNumber || '',
    customerName: user.firstName + ' ' + user.lastName,
    rating: review.rating,
    comment: review.comment,
    serviceName: (bookingDetails?.serviceId as any)?.name || '',
  });

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully. It will appear on the provider profile after admin approval.',
    data: {
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: review.photos,
        isVerified: review.isVerified,
        moderationStatus: 'pending',
        createdAt: review.createdAt,
      },
    },
  });
});

/**
 * Submit a review for a package (service)
 * This endpoint allows customers to write reviews directly from the package detail page
 * by finding their completed booking for that specific package/service
 *
 * POST /api/reviews/package/:packageId
 */
export const submitPackageReview = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { packageId } = req.params;
  const { rating, comment, title, photos } = req.body;
  const tenantId = getTenantId(req);

  // Validate input
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }
  if (!comment || comment.trim().length === 0) {
    throw new ApiError(400, 'Comment is required');
  }
  if (comment.trim().length < 10) {
    throw new ApiError(400, 'Comment must be at least 10 characters');
  }

  // Validate packageId format
  if (!mongoose.Types.ObjectId.isValid(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  const packageObjectId = new mongoose.Types.ObjectId(packageId);

  // Verify the package exists (check Bundle first, then Service)
  const bundle = await Bundle.findById(packageObjectId).populate('providerId', '_id');
  const service = bundle ? null : await Service.findOne({
    _id: packageObjectId,
    isActive: true,
  }).populate('providerId', '_id');

  const packageExists = bundle || service;
  const packageName = bundle?.name || service?.name;
  const providerId = bundle?.providerId?._id || bundle?.providerId || service?.providerId?._id || service?.providerId;

  if (!packageExists) {
    throw new ApiError(404, 'Package not found');
  }

  // Check if bundle is active
  if (bundle && !bundle.isActive) {
    throw new ApiError(400, 'Package is not available');
  }

  // Find the customer's completed booking for this package
  // Look for bookings where serviceId matches the package and customer has not reviewed yet
  const booking = await Booking.findOne({
    serviceId: packageObjectId,
    customerId: user._id,
    status: 'completed',
    $or: [
      { customerReview: { $exists: false } },
      { customerReview: null }
    ]
  }).sort({ completedAt: -1 });

  if (!booking) {
    // Check if there's a completed booking that was already reviewed
    const existingReview = await Booking.findOne({
      serviceId: packageObjectId,
      customerId: user._id,
      status: 'completed'
    });

    if (existingReview && existingReview.customerReview) {
      throw new ApiError(400, 'You have already reviewed this package');
    }

    // Check if the customer has any completed bookings for this package at all
    const anyCompletedBooking = await Booking.findOne({
      serviceId: packageObjectId,
      customerId: user._id,
      status: 'completed'
    });

    if (!anyCompletedBooking) {
      throw new ApiError(400, 'You must complete a booking for this package before reviewing');
    }

    // If there's a completed booking but it's outside the review window
    const serviceCompletionDate = anyCompletedBooking.completedAt || anyCompletedBooking.estimatedEndTime;
    const now = new Date();
    const daysSinceCompletion = (now.getTime() - serviceCompletionDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCompletion > REVIEW_WINDOW_DAYS) {
      throw new ApiError(
        400,
        `Reviews must be submitted within ${REVIEW_WINDOW_DAYS} days after service completion. ` +
        `This service was completed ${Math.floor(daysSinceCompletion)} days ago.`
      );
    }

    throw new ApiError(404, 'No eligible booking found for review');
  }

  // Check review window for the found booking
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
    tenantId: tenantId ?? undefined,
    bookingId: booking._id,
    serviceId: booking.serviceId,
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

  // Run content moderation check on package review submission
  const combinedContent = `${title || ''} ${comment}`.trim();
  const moderationResult = checkContent(combinedContent);

  // Log moderation decision
  logger.info('Content moderation check for package review', {
    context: 'ReviewsController',
    action: 'CONTENT_MODERATION_PACKAGE',
    reviewId: review._id?.toString(),
    userId: user._id.toString(),
    packageId,
    moderationScore: moderationResult.score,
    moderationAction: moderationResult.action,
    issues: moderationResult.issues.map(i => i.type),
  });

  // Auto-flag reviews with problematic content for manual review
  if (moderationResult.action === 'flag' || moderationResult.action === 'reject') {
    review.autoFlagged = true;
    review.moderationScore = moderationResult.score;
    review.moderationIssues = moderationResult.issues.map(i => i.type);
    review.moderationReason = `Auto-flagged: ${moderationResult.issues.map(i => i.type).join(', ')} (score: ${moderationResult.score})`;
  } else {
    // Still store the score for analytics even if auto-approved
    review.moderationScore = moderationResult.score;
  }

  // Save the review first
  await review.save();

  // Update booking with customerReview reference
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      $or: [
        { customerReview: { $exists: false } },
        { customerReview: null }
      ]
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
    await Review.findByIdAndDelete(review._id);
    throw new ApiError(400, 'Review was already submitted');
  }

  // Update provider reviews data if the review is auto-approved or we want immediate update
  // Note: Rating updates are typically handled when admin approves the review
  // For immediate visual feedback on the package page, we can update the provider's stats

  // Get booking details for socket event
  const bookingDetails = await Booking.findById(booking._id)
    .select('bookingNumber')
    .lean();

  // Log the review submission
  logger.info('Package review submitted', {
    context: 'ReviewsController',
    action: 'SUBMIT_PACKAGE_REVIEW',
    userId: user._id.toString(),
    packageId,
    bookingId: booking._id.toString(),
    reviewId: review._id.toString(),
    rating,
  });

  // Publish review received event for notifications
  eventBus.publish(EVENT_TYPES.REVIEW_RECEIVED, {
    reviewId: review._id.toString(),
    providerId: booking.providerId.toString(),
    bookingId: booking._id.toString(),
    bookingNumber: bookingDetails?.bookingNumber || '',
    customerName: user.firstName + ' ' + user.lastName,
    rating: review.rating,
    comment: review.comment,
    serviceName: packageName || '',
  });

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully. It will appear after admin approval.',
    data: {
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: review.photos,
        isVerified: review.isVerified,
        moderationStatus: 'pending',
        createdAt: review.createdAt,
      },
    },
  });
});

/**
 * Get the customer's eligible booking for a package review
 * This endpoint checks if the user can write a review for a specific package
 *
 * GET /api/reviews/package/:packageId/eligibility
 */
export const getPackageReviewEligibility = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { packageId } = req.params;

  // Validate packageId format
  if (!mongoose.Types.ObjectId.isValid(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  const packageObjectId = new mongoose.Types.ObjectId(packageId);

  // Verify the package exists (check Bundle first, then Service)
  const bundle = await Bundle.findById(packageObjectId).select('name isActive');
  const service = bundle ? null : await Service.findOne({
    _id: packageObjectId,
    isActive: true,
  }).select('name category');

  const packageExists = bundle || service;
  const packageName = bundle?.name || service?.name;

  if (!packageExists) {
    throw new ApiError(404, 'Package not found');
  }

  // Check if bundle/package is active
  if (bundle && !bundle.isActive) {
    throw new ApiError(400, 'Package is not available');
  }

  // Find completed booking for this customer and package
  const booking = await Booking.findOne({
    serviceId: packageObjectId,
    customerId: user._id,
    status: 'completed'
  }).sort({ completedAt: -1 });

  if (!booking) {
    return res.json({
      success: true,
      data: {
        eligible: false,
        reason: 'no_booking',
        message: 'You must complete a booking for this package before reviewing',
      },
    });
  }

  // Check if already reviewed
  if (booking.customerReview) {
    return res.json({
      success: true,
      data: {
        eligible: false,
        reason: 'already_reviewed',
        message: 'You have already reviewed this package',
        bookingId: booking._id,
        completedAt: booking.completedAt,
      },
    });
  }

  // Check review window
  const serviceCompletionDate = booking.completedAt || booking.estimatedEndTime;
  const now = new Date();
  const daysSinceCompletion = (now.getTime() - serviceCompletionDate.getTime()) / (1000 * 60 * 60 * 24);
  const daysRemaining = REVIEW_WINDOW_DAYS - daysSinceCompletion;

  if (daysSinceCompletion > REVIEW_WINDOW_DAYS) {
    return res.json({
      success: true,
      data: {
        eligible: false,
        reason: 'review_window_expired',
        message: `Review window has expired. Reviews must be submitted within ${REVIEW_WINDOW_DAYS} days of service completion.`,
        daysSinceCompletion: Math.floor(daysSinceCompletion),
      },
    });
  }

  // User is eligible
  return res.json({
    success: true,
    data: {
      eligible: true,
      bookingId: booking._id,
      packageName: packageName,
      completedAt: booking.completedAt,
      daysRemaining: Math.ceil(daysRemaining),
      reviewWindowDays: REVIEW_WINDOW_DAYS,
    },
  });
});

/**
 * Vote on a review (mark as helpful or not helpful)
 *
 * POST /api/reviews/:reviewId/vote
 */
export const voteReview = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { reviewId } = req.params;
  const { helpful } = req.body;

  if (typeof helpful !== 'boolean') {
    throw new ApiError(400, 'Vote value (helpful) must be a boolean');
  }

  // Validate reviewId format
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format');
  }

  // Find the review
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // Prevent user from voting on their own review
  if (review.reviewerId.toString() === user._id.toString()) {
    throw new ApiError(400, 'You cannot vote on your own review');
  }

  // Check if user already voted (import ReviewVote model)
  const ReviewVote = mongoose.model('ReviewVote');

  const existingVote = await ReviewVote.findOne({
    reviewId: new mongoose.Types.ObjectId(reviewId),
    userId: user._id,
  });

  let isNewVote = false;
  let previousVote: boolean | null = null;

  if (existingVote) {
    if (existingVote.helpful === helpful) {
      // Same vote - remove it (toggle off)
      await ReviewVote.findByIdAndDelete(existingVote._id);
      previousVote = existingVote.helpful;
    } else {
      // Different vote - update it
      existingVote.helpful = helpful;
      await existingVote.save();
      previousVote = !helpful;
    }
  } else {
    // New vote
    await ReviewVote.create({
      reviewId: new mongoose.Types.ObjectId(reviewId),
      userId: user._id,
      helpful,
    });
    isNewVote = true;
  }

  // Update helpful votes count on the review
  const helpfulCount = await ReviewVote.countDocuments({
    reviewId: new mongoose.Types.ObjectId(reviewId),
    helpful: true,
  });

  review.helpfulVotes = helpfulCount;
  await review.save();

  // Log the vote
  logger.info('Review vote recorded', {
    context: 'ReviewsController',
    action: 'VOTE_REVIEW',
    reviewId,
    userId: user._id.toString(),
    helpful,
    isNewVote,
    previousVote,
  });

  res.json({
    success: true,
    message: isNewVote
      ? (helpful ? 'Marked as helpful' : 'Marked as not helpful')
      : previousVote === helpful
        ? 'Vote removed'
        : 'Vote updated',
    data: {
      helpfulVotes: helpfulCount,
      userVote: isNewVote ? helpful : (previousVote === helpful ? null : helpful),
    },
  });
});

/**
 * Get review voting stats
 *
 * GET /api/reviews/:reviewId/votes
 */
export const getReviewVotes = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;
  const user = (req as any).user;

  // Validate reviewId format
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, 'Invalid review ID format');
  }

  const ReviewVote = mongoose.model('ReviewVote');

  // Get vote counts
  const [helpfulCount, notHelpfulCount] = await Promise.all([
    ReviewVote.countDocuments({
      reviewId: new mongoose.Types.ObjectId(reviewId),
      helpful: true,
    }),
    ReviewVote.countDocuments({
      reviewId: new mongoose.Types.ObjectId(reviewId),
      helpful: false,
    }),
  ]);

  // Get user's vote if authenticated
  let userVote: boolean | null = null;
  if (user?._id) {
    const vote = await ReviewVote.findOne({
      reviewId: new mongoose.Types.ObjectId(reviewId),
      userId: user._id,
    });
    userVote = vote?.helpful ?? null;
  }

  res.json({
    success: true,
    data: {
      helpfulVotes: helpfulCount,
      notHelpfulVotes: notHelpfulCount,
      userVote,
    },
  });
});

/**
 * Get review analytics for a provider (admin or provider)
 *
 * GET /api/reviews/provider/:providerId/analytics
 */
export const getProviderReviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { period } = req.query; // '30d', '90d', '1y', 'all'

  // Validate providerId format
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID format');
  }

  // Calculate date range
  let startDate: Date;
  const now = new Date();

  switch (period) {
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0); // All time
  }

  // Get all approved reviews in the period
  const reviews = await Review.find({
    revieweeId: new mongoose.Types.ObjectId(providerId),
    reviewerType: 'customer',
    isHidden: false,
    moderationStatus: 'approved',
    createdAt: { $gte: startDate },
  }).sort({ createdAt: -1 });

  // Calculate summary stats
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  // Calculate response rate
  const respondedReviews = reviews.filter(r => r.response).length;
  const responseRate = totalReviews > 0 ? (respondedReviews / totalReviews) * 100 : 0;

  // Calculate rating distribution
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
  });

  // Calculate monthly trends
  const trends: Array<{ month: string; averageRating: number; count: number }> = [];
  const monthlyData: Record<string, { total: number; count: number }> = {};

  reviews.forEach(r => {
    const monthKey = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { total: 0, count: 0 };
    }
    monthlyData[monthKey].total += r.rating;
    monthlyData[monthKey].count += 1;
  });

  Object.entries(monthlyData)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .forEach(([month, data]) => {
      trends.push({
        month,
        averageRating: Math.round((data.total / data.count) * 10) / 10,
        count: data.count,
      });
    });

  // Get recent reviews for trend analysis
  const recentReviews = reviews.slice(0, 10);
  const recentAvgRating = recentReviews.length > 0
    ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
    : 0;

  res.json({
    success: true,
    data: {
      summary: {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        responseRate: Math.round(responseRate),
        recentAvgRating: Math.round(recentAvgRating * 10) / 10,
      },
      trends,
      ratingDistribution,
      period: period || 'all',
    },
  });
});

const reviewsController = {
  submitReview,
  submitPackageReview,
  getPackageReviewEligibility,
  voteReview,
  getReviewVotes,
  getProviderReviewAnalytics,
};
export default reviewsController;
