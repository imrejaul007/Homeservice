import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Check provider ID formats and match with user IDs
 */

async function checkProviderIds() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';

  try {
    await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Get provider profiles with reviews
    console.log('📋 Provider Profiles with reviews:\n');

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
      console.log(`  _id: ${p._id} (type: ${typeof p._id})`);
      console.log(`  userId: ${p.userId} (type: ${typeof p.userId})`);
      console.log(`  userId is ObjectId: ${p.userId instanceof mongoose.Types.ObjectId}`);

      // Check if there's a user with this ID
      const user = await db.collection('users').findOne({ _id: p.userId });
      console.log(`  Matching user found: ${user ? 'Yes' : 'No'}`);
      if (user) {
        console.log(`  User email: ${user.email}`);
        console.log(`  User role: ${user.role}`);
      }

      console.log(`\n  Recent Reviews (first one):`);
      if (p.reviewsData?.recentReviews?.[0]) {
        console.log(`    bookingId: ${p.reviewsData.recentReviews[0].bookingId}`);
      }

      // Check the reviews collection
      const reviews = await db.collection('reviews')
        .find({ revieweeId: p.userId })
        .limit(2)
        .toArray();
      console.log(`\n  Reviews in reviews collection: ${reviews.length}`);

      console.log('\n' + '='.repeat(60) + '\n');
    }

    // Now check what IDs are used in bookings
    console.log('📋 Sample Bookings with reviews:\n');

    const bookings = await db.collection('bookings')
      .find({ customerReview: { $exists: true, $ne: null } })
      .limit(3)
      .toArray();

    for (const b of bookings) {
      console.log(`Booking: ${b._id}`);
      console.log(`  providerId: ${b.providerId}`);
      console.log(`  customerReview: ${b.customerReview}`);
      console.log(`  status: ${b.status}`);
      console.log();
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

checkProviderIds();
