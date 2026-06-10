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

    let createdCount = 0;

    for (const booking of bookingsWithoutReviews) {
      const sampleReview = sampleReviews[Math.floor(Math.random() * sampleReviews.length)];

      const review = new Review({
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
      });

      await review.save();
      createdCount++;

      // Update booking with review reference
      await Booking.findByIdAndUpdate(booking._id, {
        customerReview: review._id
      });
    }

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
