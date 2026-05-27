import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Migration: Backfill serviceId in recentReviews array for existing reviews
 *
 * This script:
 * 1. Finds all provider profiles with recent reviews
 * 2. For reviews missing serviceId, looks up the booking to get serviceId
 * 3. Updates the review with the serviceId
 *
 * Usage: npx ts-node src/scripts/backfillReviewServiceIds.ts <database_name>
 * Example: npx ts-node src/scripts/backfillReviewServiceIds.ts nilin
 */

interface ReviewItem {
  customerId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  serviceId?: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  isVerified: boolean;
  helpfulVotes: number;
  createdAt: Date;
}

interface RecentReviewItem extends ReviewItem {
  _index: number;
}

async function backfillServiceIds() {
  // Get database name from command line argument
  const dbName = process.argv[2];

  if (!dbName) {
    console.error('❌ Error: Database name is required');
    console.log('Usage: npx ts-node src/scripts/backfillReviewServiceIds.ts <database_name>');
    console.log('Example: npx ts-node src/scripts/backfillReviewServiceIds.ts nilin');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Migration: Backfill serviceId in recentReviews');
  console.log('='.repeat(60));
  console.log();

  // Build connection URI with specified database
  const baseUri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/';
  const uri = `${baseUri}${dbName}?appName=Cluster0`;

  console.log(`📍 Target Database: ${dbName}`);
  console.log();

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB');
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    console.log();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const providerProfilesCollection = db.collection('providerprofiles');
    const bookingsCollection = db.collection('bookings');

    // Find all provider profiles with recentReviews
    const providerProfiles = await providerProfilesCollection.find({
      'reviewsData.recentReviews': { $exists: true, $ne: [] }
    }).toArray();

    console.log(`Found ${providerProfiles.length} provider profiles with reviews`);
    console.log();

    let totalReviewsScanned = 0;
    let totalReviewsUpdated = 0;
    let totalProvidersUpdated = 0;
    let skippedDueToMissingBooking = 0;
    let skippedDueToMissingServiceId = 0;

    for (const profile of providerProfiles) {
      const reviewsData = profile.reviewsData;
      const recentReviews: RecentReviewItem[] = reviewsData.recentReviews.map(
        (review: any, index: number) => ({ ...review, _index: index })
      );

      // Filter reviews that need updating (missing serviceId)
      const reviewsNeedingUpdate = recentReviews.filter(
        (review) => !review.serviceId
      );

      if (reviewsNeedingUpdate.length === 0) {
        console.log(`  ⏭️  ${profile.userId}: All ${recentReviews.length} reviews already have serviceId`);
        totalReviewsScanned += recentReviews.length;
        continue;
      }

      console.log(`\n📋 Provider: ${profile.userId}`);
      console.log(`   Reviews needing serviceId: ${reviewsNeedingUpdate.length} / ${recentReviews.length}`);

      let providerUpdated = false;

      for (const review of reviewsNeedingUpdate) {
        totalReviewsScanned++;

        try {
          // Look up the booking to get serviceId
          const booking = await bookingsCollection.findOne({
            _id: new mongoose.Types.ObjectId(review.bookingId)
          });

          if (!booking) {
            console.log(`   ⚠️  Review ${review._index}: Booking ${review.bookingId} not found (may have been deleted)`);
            skippedDueToMissingBooking++;
            continue;
          }

          if (!booking.serviceId) {
            console.log(`   ⚠️  Review ${review._index}: Booking has no serviceId`);
            skippedDueToMissingServiceId++;
            continue;
          }

          // Update the review with serviceId
          const result = await providerProfilesCollection.updateOne(
            {
              _id: profile._id,
              [`reviewsData.recentReviews.${review._index}.bookingId`]: review.bookingId
            },
            {
              $set: {
                [`reviewsData.recentReviews.${review._index}.serviceId`]: booking.serviceId
              }
            }
          );

          if (result.modifiedCount > 0) {
            console.log(`   ✅ Review ${review._index}: Added serviceId ${booking.serviceId}`);
            totalReviewsUpdated++;
            providerUpdated = true;
          }
        } catch (error: any) {
          console.log(`   ❌ Review ${review._index}: Error - ${error.message}`);
        }
      }

      if (providerUpdated) {
        totalProvidersUpdated++;
      }
    }

    // Summary
    console.log();
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`  Provider profiles scanned:  ${providerProfiles.length}`);
    console.log(`  Provider profiles updated:  ${totalProvidersUpdated}`);
    console.log(`  Total reviews scanned:      ${totalReviewsScanned}`);
    console.log(`  Reviews updated:            ${totalReviewsUpdated}`);
    console.log(`  Skipped (missing booking): ${skippedDueToMissingBooking}`);
    console.log(`  Skipped (missing service): ${skippedDueToMissingServiceId}`);
    console.log();

    if (totalReviewsUpdated > 0) {
      console.log('✅ Migration completed successfully!');
    } else if (skippedDueToMissingBooking > 0 || skippedDueToMissingServiceId > 0) {
      console.log('⚠️  Migration completed with warnings:');
      console.log('    Some reviews reference deleted bookings or bookings without serviceId.');
      console.log('    These reviews will display "Service" as the service name.');
    } else {
      console.log('ℹ️  No updates needed - all reviews already have serviceId.');
    }

    // Disconnect
    await mongoose.disconnect();
    console.log();
    console.log('Database connection closed.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backfillServiceIds();
}

export default backfillServiceIds;
