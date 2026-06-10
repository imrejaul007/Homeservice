import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Test the /reviews/provider/:providerId endpoint logic
 */

async function testEndpoint() {
  const baseUri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/';
  const uri = `${baseUri}?appName=Cluster0`;

  try {
    await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Get the provider with reviews
    console.log('📋 Checking provider profiles with review data:\n');

    const profiles = await db.collection('providerprofiles')
      .find({
        $and: [
          { 'reviewsData.totalReviews': { $gt: 0 } },
          { 'reviewsData.recentReviews.0': { $exists: true } }
        ]
      })
      .limit(5)
      .toArray();

    for (const p of profiles) {
      console.log(`Provider Profile:`);
      console.log(`  _id: ${p._id}`);
      console.log(`  userId: ${p.userId}`);
      console.log(`  averageRating: ${p.reviewsData?.averageRating}`);
      console.log(`  totalReviews: ${p.reviewsData?.totalReviews}`);
      console.log(`  recentReviews count: ${p.reviewsData?.recentReviews?.length || 0}`);

      if (p.reviewsData?.recentReviews?.length > 0) {
        console.log(`\n  Sample recentReviews entry:`);
        console.log(`    bookingId: ${p.reviewsData.recentReviews[0].bookingId}`);
        console.log(`    rating: ${p.reviewsData.recentReviews[0].rating}`);
        console.log(`    comment: ${p.reviewsData.recentReviews[0].comment?.substring(0, 50)}...`);
      }

      // Now check if we can find the bookings
      if (p.reviewsData?.recentReviews?.length > 0) {
        const bookingIds = p.reviewsData.recentReviews.map((r: any) => r.bookingId);
        console.log(`\n  Checking bookings for these reviews...`);

        const bookings = await db.collection('bookings')
          .find({ _id: { $in: bookingIds } })
          .limit(5)
          .toArray();

        console.log(`    Found ${bookings.length} out of ${bookingIds.length} bookings`);

        if (bookings.length > 0) {
          console.log(`\n  Sample booking:`);
          console.log(`    _id: ${bookings[0]._id}`);
          console.log(`    customerId: ${bookings[0].customerId}`);
          console.log(`    status: ${bookings[0].status}`);
        } else {
          console.log(`\n  ⚠️  NO BOOKINGS FOUND! This is the bug!`);
        }
      }
      console.log('\n' + '='.repeat(60) + '\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

testEndpoint();
