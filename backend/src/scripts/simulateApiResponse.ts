import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Simulate the exact API response from getProviderReviews endpoint
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/simulateApiResponse.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/simulateApiResponse.ts');
  process.exit(1);
}

async function simulateApiResponse() {
  try {
    await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Get the provider profile
    console.log('📊 Simulating getProviderReviews response:\n');

    const profile = await db.collection('providerprofiles').findOne({
      'reviewsData.totalReviews': { $gt: 0 }
    });

    if (!profile) {
      console.log('❌ No provider profile with reviews found');
      return;
    }

    const providerId = profile.userId;
    console.log(`Provider ID: ${providerId}`);
    console.log(`Total Reviews: ${profile.reviewsData?.totalReviews}`);
    console.log(`Recent Reviews Count: ${profile.reviewsData?.recentReviews?.length || 0}`);

    // Check what the API would return
    const pageNum = 1;
    const limitNum = 10;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedReviewIds = (profile.reviewsData?.recentReviews || [])
      .slice(startIndex, endIndex)
      .map((review: any) => review.bookingId)
      .filter(Boolean);

    console.log(`\nPaginated booking IDs: ${paginatedReviewIds.length}`);

    if (paginatedReviewIds.length === 0) {
      console.log('\n⚠️  Empty reviews would be returned (this matches the bug!)');
      console.log('   recentReviews array exists but bookingId is null/missing');
      return;
    }

    // Get bookings
    const bookings = await db.collection('bookings')
      .find({ _id: { $in: paginatedReviewIds } })
      .limit(limitNum)
      .toArray();

    console.log(`\nFound ${bookings.length} bookings`);

    // Transform reviews
    const reviews = paginatedReviewIds
      .map((bookingId: any) => {
        const booking = bookings.find(b => b._id.toString() === bookingId?.toString());
        if (!booking) return null;

        const reviewData = profile.reviewsData?.recentReviews?.find(
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
          customer: booking.customerId ? {
            id: booking.customerId.toString(),
            firstName: 'Customer',
            lastName: '',
          } : null,
          service: booking.serviceId ? { name: 'Service' } : null,
        };
      })
      .filter(Boolean);

    console.log(`\nTransformed reviews count: ${reviews.length}`);

    if (reviews.length > 0) {
      console.log('\nSample review:');
      console.log(JSON.stringify(reviews[0], null, 2));
    } else {
      console.log('\n⚠️  No reviews would be returned!');
      console.log('\nChecking recentReviews structure:');
      const sample = profile.reviewsData?.recentReviews?.[0];
      console.log('Sample recentReview entry:');
      console.log(JSON.stringify(sample, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

simulateApiResponse();
