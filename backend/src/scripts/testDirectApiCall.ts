import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Test direct API response with the exact format ServiceReviews expects
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/testDirectApiCall.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/testDirectApiCall.ts');
  process.exit(1);
}

async function testDirectApi() {
  try {
    await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Get first provider profile to test with
    const providerProfile = await db.collection('providerprofiles').findOne({});

    if (!providerProfile) {
      console.log('❌ No provider profile found');
      return;
    }

    const providerId = providerProfile.userId;
    console.log(`Testing with provider ID: ${providerId}\n`);

    console.log('📊 Provider Profile Found:');
    console.log(`  reviewsData.totalReviews: ${providerProfile.reviewsData?.totalReviews}`);
    console.log(`  reviewsData.recentReviews.length: ${providerProfile.reviewsData?.recentReviews?.length}`);

    if (!providerProfile.reviewsData) {
      console.log('\n❌ No reviewsData field');
      return;
    }

    const totalReviews = providerProfile.reviewsData.totalReviews || 0;
    const pageNum = 1;
    const limitNum = 10;

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedReviewIds = (providerProfile.reviewsData.recentReviews || [])
      .slice(startIndex, endIndex)
      .map((review: any) => review.bookingId)
      .filter(Boolean);

    console.log(`\n📋 Paginated booking IDs: ${paginatedReviewIds.length}`);

    if (paginatedReviewIds.length === 0) {
      console.log('\n⚠️  No valid booking IDs in recentReviews!');
      console.log('\n🔍 Checking recentReviews entries:');
      for (let i = 0; i < Math.min(3, providerProfile.reviewsData.recentReviews.length); i++) {
        const r = providerProfile.reviewsData.recentReviews[i];
        console.log(`  [${i}] bookingId: ${r.bookingId} (type: ${typeof r.bookingId})`);
      }
      return;
    }

    // Get bookings
    const bookings = await db.collection('bookings')
      .find({ _id: { $in: paginatedReviewIds } })
      .toArray();

    console.log(`\n📋 Found ${bookings.length} bookings`);

    // Create booking map
    const bookingMap = new Map(
      bookings.map(b => [b._id.toString(), b])
    );

    // Transform reviews (exact code from backend)
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
          customer: booking.customerId ? {
            id: booking.customerId.toString(),
            firstName: booking.customerId?.firstName || 'Customer',
            lastName: '',
          } : null,
          service: booking.serviceId ? { name: 'Service' } : null,
        };
      })
      .filter(Boolean);

    console.log(`\n✅ Transformed reviews: ${reviews.length}`);

    // Show sample
    if (reviews.length > 0) {
      console.log('\n📝 Sample review that would be returned:');
      console.log(JSON.stringify(reviews[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

testDirectApi();
