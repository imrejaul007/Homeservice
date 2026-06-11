import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Test: Simulate what the /reviews/provider/me endpoint returns
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/testReviewsEndpoint.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/testReviewsEndpoint.ts');
  process.exit(1);
}

async function test() {
  await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5 });
  const db = mongoose.connection.db!;

  console.log('='.repeat(60));
  console.log('Test: /reviews/provider/me endpoint simulation');
  console.log('='.repeat(60));
  console.log();

  // Get the provider user
  const provider = await db.collection('users').findOne({ role: 'provider', email: 'provider@nilin.com' });

  if (!provider) {
    console.log('❌ No provider found');
    await mongoose.disconnect();
    return;
  }

  console.log('📋 Provider:', provider._id.toString(), provider.email);
  console.log();

  // Simulate the endpoint query using raw collection
  const reviews = await db.collection('reviews')
    .aggregate([
      {
        $match: {
          revieweeId: provider._id,
          reviewerType: 'customer',
          isHidden: false
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $limit: 50
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reviewerId',
          foreignField: '_id',
          as: 'reviewer'
        }
      },
      {
        $unwind: {
          path: '$reviewer',
          preserveNullAndEmptyArrays: true
        }
      }
    ])
    .toArray();

  console.log('📋 Reviews found:', reviews.length);
  console.log();

  // Compute stats
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    }
  });

  console.log('📋 Stats:');
  console.log('   totalReviews:', totalReviews);
  console.log('   averageRating:', averageRating);
  console.log('   ratingDistribution:', ratingDistribution);
  console.log();

  console.log('📋 First review:');
  if (reviews.length > 0) {
    const r = reviews[0];
    console.log(JSON.stringify({
      id: r._id.toString(),
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      customer: r.reviewer ? {
        id: r.reviewer._id.toString(),
        firstName: r.reviewer.firstName,
        lastName: r.reviewer.lastName
      } : null
    }, null, 2));
  } else {
    console.log('   (empty)');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.');
}

test().catch(err => {
  console.error('❌ Error:', err);
  mongoose.disconnect();
  process.exit(1);
});
