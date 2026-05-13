import { Request, Response } from 'express';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

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

  const booking = await Booking.findOne({
    _id: bookingId,
    customerId: user._id,
    status: 'completed',
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found or not completed');
  }

  if ((booking as any).review?.isReviewed) {
    throw new ApiError(400, 'Already reviewed');
  }

  (booking as any).review = { isReviewed: true, rating, comment: comment.trim(), title: title || '', photos: photos || [], createdAt: new Date() };
  await booking.save();

  const providerProfile = await ProviderProfile.findOne({ userId: booking.providerId });
  if (providerProfile) {
    if (!providerProfile.reviewsData) {
      providerProfile.reviewsData = { averageRating: 0, totalReviews: 0, ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, recentReviews: [], responseRate: 0, avgResponseTime: 0 };
    }
    const prev = providerProfile.reviewsData;
    const newTotal = prev.averageRating * prev.totalReviews + rating;
    prev.totalReviews++;
    prev.averageRating = newTotal / prev.totalReviews;
    (prev.ratingDistribution as any)[rating]++;
    prev.recentReviews.unshift({ customerId: user._id, bookingId: booking._id, rating, title: title || '', comment: comment.trim(), photos: photos || [], isVerified: true, helpfulVotes: 0, createdAt: new Date() });
    if (prev.recentReviews.length > 20) prev.recentReviews = prev.recentReviews.slice(0, 20);
    await providerProfile.save();
  }

  res.status(201).json({ success: true, message: 'Review submitted', data: { review: (booking as any).review } });
});

export default { submitReview };
