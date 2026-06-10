/**
 * Migration Script: Fix Review Data Consistency
 *
 * This script fixes the issue where:
 * - ProviderProfile.reviewsData has aggregate data (averageRating, totalReviews)
 * - But reviewsData.recentReviews array is empty
 *
 * It will:
 * 1. Find all approved reviews in the Review collection
 * 2. Group them by provider (revieweeId)
 * 3. Populate recentReviews array for each provider
 * 4. Recalculate aggregate stats
 *
 * Run with: npx ts-node --esm src/scripts/migrateReviewData.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nilin';

async function migrateReviewData() {
  console.log('🔧 Starting review data migration...\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Dynamic imports to avoid connection issues
    const Review = (await import('../models/review.model')).default;
    const ProviderProfile = (await import('../models/providerProfile.model')).default;

    // Step 1: Get all approved reviews grouped by provider
    console.log('📊 Step 1: Fetching all approved reviews...');
    const reviews = await Review.find({ moderationStatus: 'approved' })
      .sort({ createdAt: -1 })
      .limit(100) // Limit per provider
      .populate('reviewerId', 'firstName lastName avatar')
      .lean();

    console.log(`   Found ${reviews.length} approved reviews\n`);

    // Step 2: Group reviews by provider (revieweeId)
    console.log('📋 Step 2: Grouping reviews by provider...');
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
    console.log('🔄 Step 3: Updating provider profiles...');
    let updatedCount = 0;
    let skippedCount = 0;

    for (const [providerId, providerReviews] of reviewsByProvider) {
      // Calculate aggregate stats
      const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let totalRating = 0;

      for (const review of providerReviews) {
        const rating = Math.round(review.rating);
        if (rating >= 1 && rating <= 5) {
          (ratingDistribution as any)[rating]++;
          totalRating += review.rating;
        }
      }

      const totalReviews = providerReviews.length;
      const averageRating = totalReviews > 0
        ? Math.round((totalRating / totalReviews) * 10) / 10
        : 0;

      // Format recentReviews array
      const recentReviews = providerReviews.slice(0, 20).map(r => ({
        _id: r._id,
        customerId: (r.reviewerId as any)?._id || r.reviewerId,
        bookingId: r.bookingId,
        rating: r.rating,
        title: r.title || '',
        comment: r.comment || '',
        photos: r.photos || [],
        isVerified: r.isVerified || false,
        helpfulVotes: r.helpfulVotes || 0,
        createdAt: r.createdAt,
      }));

      // Calculate response rate (simplified - based on whether reviews have responses)
      const reviewsWithResponses = providerReviews.filter((r: any) => r.response).length;
      const responseRate = providerReviews.length > 0
        ? Math.round((reviewsWithResponses / providerReviews.length) * 100)
        : 0;

      // Find the provider profile
      const providerProfile = await ProviderProfile.findOne({ userId: providerId });

      if (!providerProfile) {
        console.log(`   ⚠️  No provider profile found for ${providerId}`);
        skippedCount++;
        continue;
      }

      // Update the reviewsData
      providerProfile.reviewsData = {
        averageRating,
        totalReviews,
        ratingDistribution,
        recentReviews,
        responseRate,
        avgResponseTime: 0, // Default, as we don't have this data in reviews
      };

      await providerProfile.save();
      updatedCount++;

      console.log(`   ✅ Updated ${providerProfile.userId}: ${totalReviews} reviews, avg ${averageRating}`);
    }

    console.log('\n📝 Migration Summary:');
    console.log(`   - Providers updated: ${updatedCount}`);
    console.log(`   - Providers skipped: ${skippedCount}`);
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
migrateReviewData();
