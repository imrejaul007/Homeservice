import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Review from '../models/review.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nilin';

const sampleReviews = [
  {
    rating: 5,
    title: 'Excellent service!',
    comment: 'The provider was punctual, professional, and did an amazing job. Highly recommended!',
    isVerified: true,
    moderationStatus: 'approved' as const,
  },
  {
    rating: 4,
    title: 'Great work',
    comment: 'Very satisfied with the service. Would book again for sure.',
    isVerified: true,
    moderationStatus: 'approved' as const,
  },
  {
    rating: 5,
    title: 'Outstanding!',
    comment: 'Exceeded all expectations. Very thorough and clean work.',
    isVerified: true,
    moderationStatus: 'approved' as const,
  },
  {
    rating: 3,
    title: 'Good but could be better',
    comment: 'Service was okay, but the provider was a bit late.',
    isVerified: true,
    moderationStatus: 'approved' as const,
  },
];

async function seedReviews() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Get completed bookings that don't have reviews yet
    const bookingsWithoutReviews = await Booking.find({
      status: 'completed',
      deletedAt: { $exists: false },
      customerReview: { $exists: false }
    }).limit(10);

    logger.info(`Found ${bookingsWithoutReviews.length} bookings without reviews`);

    // Collect all review data first
    const reviewsToCreate = bookingsWithoutReviews.map((booking) => {
      const sampleReview = sampleReviews[Math.floor(Math.random() * sampleReviews.length)];
      return {
        ...sampleReview,
        bookingId: booking._id,
        serviceId: booking.serviceId,
        tenantId: booking.tenantId,
        reviewerId: booking.customerId,
        reviewerType: 'customer',
        revieweeId: booking.providerId,
        revieweeType: 'provider',
        helpfulVotes: 0,
        reportCount: 0,
        isHidden: false,
      };
    });

    // Bulk insert reviews and update bookings in a transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Bulk insert all reviews
      const insertedReviews = await Review.insertMany(reviewsToCreate, { session });
      const createdCount = insertedReviews.length;

      // Build booking update operations
      const bookingUpdates = insertedReviews.map((review) => ({
        updateOne: {
          filter: { _id: review.bookingId },
          update: { $set: { customerReview: review._id } },
        },
      }));

      // Bulk update all bookings
      await Booking.updateMany(
        { _id: { $in: insertedReviews.map((r) => r.bookingId) } },
        { $set: { customerReview: insertedReviews.find((r) => r.bookingId.toString() === bookingUpdates[0].updateOne.filter._id.toString())?._id || null } },
        { session }
      );

      // Use individual updates since each review maps to a different booking
      for (const review of insertedReviews) {
        await Booking.updateOne(
          { _id: review.bookingId },
          { $set: { customerReview: review._id } },
          { session }
        );
      }

      await session.commitTransaction();
      logger.info(`Created ${createdCount} review records using batch operations`);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    const createdCount = reviewsToCreate.length;

    logger.info(`Created ${createdCount} review records`);

    // Log existing review stats
    const reviewStats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    if (reviewStats.length > 0) {
      logger.info(`Total reviews: ${reviewStats[0].totalReviews}, Avg rating: ${reviewStats[0].avgRating?.toFixed(2)}`);
    }

    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding reviews:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedReviews();
