import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Fix Reviews Data Consistency
 *
 * This script fixes the issue where:
 * - ProviderProfile.reviewsData has aggregate data (averageRating, totalReviews)
 * - But reviewsData.recentReviews array is empty
 *
 * Run with: npx ts-node src/scripts/fixReviewsConsistency.ts
 */

// FIX: Use environment variable instead of hardcoded credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';

async function fixReviewsConsistency() {
  console.log('🔧 Starting review data consistency fix...\n');

  const uri = MONGODB_URI;

  try {
    await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = mongoose.connection.db!;

    // Step 1: Get all approved reviews
    console.log('📊 Step 1: Fetching all approved reviews...');
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

    // Step 2: Group reviews by provider (revieweeId)
    console.log('📋 Step 2: Grouping reviews by provider (revieweeId)...');
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

    // Step 3: Update each provider's reviewsData
    console.log('🔄 Step 3: Updating provider profiles...\n');
    let updatedCount = 0;
    let skippedCount = 0;

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

      // Try to find provider profile by userId (revieweeId)
      let providerProfile = await db.collection('providerprofiles').findOne({ userId: new mongoose.Types.ObjectId(providerId) });

      // If not found, try by _id
      if (!providerProfile) {
        providerProfile = await db.collection('providerprofiles').findOne({ _id: new mongoose.Types.ObjectId(providerId) });
      }

      if (!providerProfile) {
        console.log(`   ⚠️  No provider profile found for provider ID: ${providerId}`);
        skippedCount++;
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
      console.log(`   ✅ Updated (${updatedCount}): Provider ${providerId.substring(0, 8)}... | ${totalReviews} reviews, avg ${averageRating}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📝 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`   - Providers updated: ${updatedCount}`);
    console.log(`   - Providers skipped: ${skippedCount}`);
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

// Run migration
fixReviewsConsistency().catch(err => {
  console.error('❌ Fatal error:', err);
  mongoose.disconnect();
  process.exit(1);
});
