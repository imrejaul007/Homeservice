import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Fix Review Moderation Status
 *
 * The reviews in the database have `moderationStatus: undefined` (field doesn't exist).
 * This script:
 * 1. Sets default `moderationStatus: 'approved'` for existing reviews
 * 2. Ensures recentReviews array has correct status
 * 3. Updates provider profiles
 */

// FIX: Use environment variable instead of hardcoded credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';

async function fixReviewModerationStatus() {
  console.log('🔧 Starting review moderation status fix...\n');

  const uri = MONGODB_URI;

  try {
    await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Step 1: Update reviews without moderationStatus to have 'approved' status
    console.log('📊 Step 1: Setting default moderationStatus for reviews...');

    const undefinedStatusResult = await db.collection('reviews').updateMany(
      { moderationStatus: { $exists: false } },
      { $set: { moderationStatus: 'approved' } }
    );
    console.log(`   ✅ Updated ${undefinedStatusResult.modifiedCount} reviews with default 'approved' status\n`);

    // Step 2: Get all approved reviews
    console.log('📊 Step 2: Fetching all approved reviews...');
    const reviews = await db.collection('reviews')
      .find({ moderationStatus: 'approved' })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    console.log(`   Found ${reviews.length} approved reviews\n`);

    if (reviews.length === 0) {
      console.log('❌ No approved reviews found. Exiting.');
      return;
    }

    // Step 3: Group reviews by provider (revieweeId)
    console.log('📋 Step 3: Grouping reviews by provider (revieweeId)...');
    const reviewsByProvider = new Map<string, typeof reviews>();

    for (const review of reviews) {
      const providerId = review.revieweeId?.toString();
      if (!providerId) continue;

      if (!reviewsByProvider.has(providerId)) {
        reviewsByProvider.set(providerId, []);
      }
      reviewsByProvider.get(providerId)!.push(review);
    }

    console.log(`   Found ${reviewsByProvider.size} providers with reviews\n`);

    // Step 4: Update each provider's reviewsData
    console.log('🔄 Step 4: Updating provider profiles...\n');
    let updatedCount = 0;

    for (const [providerId, providerReviews] of reviewsByProvider) {
      // Calculate aggregate stats
      const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let totalRating = 0;

      for (const review of providerReviews) {
        const rating = Math.round(review.rating || 0);
        if (rating >= 1 && rating <= 5) {
          ratingDistribution[rating]++;
          totalRating += (review.rating || 0);
        }
      }

      const totalReviews = providerReviews.length;
      const averageRating = totalReviews > 0
        ? Math.round((totalRating / totalReviews) * 10) / 10
        : 0;

      // Format recentReviews array (limit to 20 most recent)
      const recentReviews = providerReviews.slice(0, 20).map(r => ({
        _id: r._id,
        customerId: r.reviewerId,
        bookingId: r.bookingId,
        serviceId: r.serviceId,
        rating: r.rating,
        title: r.title || '',
        comment: r.comment || '',
        photos: r.photos || [],
        isVerified: r.isVerified || false,
        createdAt: r.createdAt,
      }));

      // Find provider profile
      let providerProfile = await db.collection('providerprofiles').findOne(
        { userId: new mongoose.Types.ObjectId(providerId) }
      );

      if (!providerProfile) {
        providerProfile = await db.collection('providerprofiles').findOne(
          { _id: new mongoose.Types.ObjectId(providerId) }
        );
      }

      if (!providerProfile) {
        console.log(`   ⚠️  No provider profile for: ${providerId.substring(0, 8)}...`);
        continue;
      }

      // Update the reviewsData
      await db.collection('providerprofiles').updateOne(
        { _id: providerProfile._id },
        {
          $set: {
            'reviewsData.averageRating': averageRating,
            'reviewsData.totalReviews': totalReviews,
            'reviewsData.ratingDistribution': ratingDistribution,
            'reviewsData.recentReviews': recentReviews,
          }
        }
      );

      updatedCount++;
      console.log(`   ✅ (${updatedCount}) ${providerId.substring(0, 8)}... | ${totalReviews} reviews, avg ${averageRating}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📝 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`   - Reviews updated: ${undefinedStatusResult.modifiedCount}`);
    console.log(`   - Provider profiles updated: ${updatedCount}`);
    console.log(`   - Total reviews processed: ${reviews.length}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixReviewModerationStatus().catch(err => {
  console.error('❌ Fatal error:', err);
  mongoose.disconnect();
  process.exit(1);
});
