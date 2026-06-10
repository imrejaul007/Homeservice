import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Diagnostic: Check provider profiles and reviews data
 *
 * Usage: npx ts-node src/scripts/diagnoseReviews.ts <database_name>
 */

// FIX: Use environment variable instead of hardcoded credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';

async function diagnose() {
  const dbName = process.argv[2];

  if (!dbName) {
    console.error('❌ Error: Database name is required');
    console.log('Usage: npx ts-node src/scripts/diagnoseReviews.ts <database_name>');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Diagnostic: Check Provider Profiles & Reviews');
  console.log('='.repeat(60));
  console.log();

  // Build URI from env or default
  const baseUri = MONGODB_URI.endsWith('/') ? MONGODB_URI.slice(0, -1) : MONGODB_URI;
  const dbPart = baseUri.includes('/') ? baseUri.split('/').slice(-1)[0] : dbName;
  const uri = `${baseUri}/${dbName}?appName=Cluster0`;

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

    const db = mongoose.connection.db!;

    // Check providerprofiles collection
    const totalProviders = await db.collection('providerprofiles').countDocuments();
    console.log(`📊 Total provider profiles: ${totalProviders}`);

    // Check profiles with reviewsData
    const profilesWithReviewsData = await db.collection('providerprofiles').countDocuments({
      'reviewsData': { $exists: true }
    });
    console.log(`📊 Profiles with reviewsData field: ${profilesWithReviewsData}`);

    // Check profiles with recentReviews (non-empty)
    const profilesWithRecentReviews = await db.collection('providerprofiles').countDocuments({
      'reviewsData.recentReviews': { $exists: true, $ne: [] }
    });
    console.log(`📊 Profiles with recentReviews: ${profilesWithRecentReviews}`);

    // Get sample of profiles with reviewsData
    const sampleProfiles = await db.collection('providerprofiles').find({
      'reviewsData': { $exists: true }
    }).limit(3).toArray();

    if (sampleProfiles.length > 0) {
      console.log('\n📋 Sample of profiles with reviewsData:');
      for (const profile of sampleProfiles) {
        console.log(`\n  Provider ID: ${profile.userId}`);
        console.log(`  has reviewsData: ${!!profile.reviewsData}`);
        if (profile.reviewsData) {
          console.log(`  reviewsData keys: ${Object.keys(profile.reviewsData)}`);
          if (profile.reviewsData.recentReviews) {
            console.log(`  recentReviews count: ${profile.reviewsData.recentReviews.length}`);
            if (profile.reviewsData.recentReviews.length > 0) {
              const firstReview = profile.reviewsData.recentReviews[0];
              console.log(`  First review keys: ${Object.keys(firstReview)}`);
              console.log(`  First review has serviceId: ${!!firstReview.serviceId}`);
            }
          }
        }
      }
    }

    // Also check the reviews collection
    const totalReviews = await db.collection('reviews').countDocuments();
    console.log(`\n📊 Total reviews in 'reviews' collection: ${totalReviews}`);

    // Check bookings with customerReview
    const bookingsWithReviews = await db.collection('bookings').countDocuments({
      'customerReview': { $exists: true, $ne: null }
    });
    console.log(`📊 Bookings with customerReview: ${bookingsWithReviews}`);

    await mongoose.disconnect();
    console.log('\n✅ Diagnostic complete.');

  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

diagnose();
