import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Check all reviews in the database (any status)
 */

// FIX: Use environment variable instead of hardcoded credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';

async function checkReviews() {
  const uri = MONGODB_URI;

  try {
    await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Check reviews by status
    console.log('📊 Reviews by Moderation Status:\n');

    const statuses = ['pending', 'approved', 'rejected', 'hidden', 'all'];

    for (const status of statuses) {
      const query = status === 'all' ? {} : { moderationStatus: status };
      const count = await db.collection('reviews').countDocuments(query);
      console.log(`   ${status}: ${count}`);
    }

    console.log('\n📋 All Reviews (Sample):\n');

    const reviews = await db.collection('reviews')
      .find({})
      .limit(10)
      .toArray();

    if (reviews.length === 0) {
      console.log('   No reviews found in the database.');
    } else {
      for (const r of reviews) {
        console.log(`   - _id: ${r._id}`);
        console.log(`     reviewerId: ${r.reviewerId}`);
        console.log(`     revieweeId: ${r.revieweeId}`);
        console.log(`     rating: ${r.rating}`);
        console.log(`     comment: ${r.comment?.substring(0, 50)}...`);
        console.log(`     moderationStatus: ${r.moderationStatus}`);
        console.log(`     createdAt: ${r.createdAt}`);
        console.log();
      }
    }

    // Check provider profiles with review data
    console.log('📋 Provider Profiles with reviewsData:\n');

    const profiles = await db.collection('providerprofiles')
      .find({
        $or: [
          { 'reviewsData.totalReviews': { $gt: 0 } },
          { 'reviewsData.recentReviews.0': { $exists: true } }
        ]
      })
      .limit(5)
      .toArray();

    if (profiles.length === 0) {
      console.log('   No provider profiles with review data found.');
    } else {
      for (const p of profiles) {
        console.log(`   - Profile: ${p._id}`);
        console.log(`     userId: ${p.userId}`);
        console.log(`     averageRating: ${p.reviewsData?.averageRating}`);
        console.log(`     totalReviews: ${p.reviewsData?.totalReviews}`);
        console.log(`     recentReviews count: ${p.reviewsData?.recentReviews?.length || 0}`);
        console.log();
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

checkReviews();
