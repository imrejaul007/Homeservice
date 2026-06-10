/**
 * Diagnose review rating vs count inconsistencies (read-only).
 * Run: npx ts-node src/scripts/diagnoseReviewInconsistency.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  // Same as scripts/check-provider-verification.js — use URI as-is (optional MONGODB_DB)
  const connectOptions: mongoose.ConnectOptions = { serverSelectionTimeoutMS: 15000 };
  if (process.env.MONGODB_DB) {
    connectOptions.dbName = process.env.MONGODB_DB;
  }
  await mongoose.connect(uri, connectOptions);
  console.log(`Connected to DB: ${mongoose.connection.name}\n`);

  const db = mongoose.connection.db!;

  const totalReviews = await db.collection('reviews').countDocuments();
  const approvedReviews = await db.collection('reviews').countDocuments({
    moderationStatus: 'approved',
  });
  const pendingReviews = await db.collection('reviews').countDocuments({
    moderationStatus: 'pending',
  });

  console.log('=== Reviews collection ===');
  console.log(`  Total: ${totalReviews}`);
  console.log(`  Approved: ${approvedReviews}`);
  console.log(`  Pending: ${pendingReviews}`);

  const inconsistentProfiles = await db.collection('providerprofiles').find({
    $or: [
      {
        'reviewsData.totalReviews': { $gt: 0 },
        'reviewsData.recentReviews': { $size: 0 },
      },
      {
        'reviewsData.averageRating': { $gt: 0 },
        'reviewsData.totalReviews': 0,
      },
      {
        'reviewsData.totalReviews': 0,
        'reviewsData.averageRating': { $gte: 4 },
      },
    ],
  }).limit(10).toArray();

  console.log('\n=== Inconsistent provider profiles (sample) ===');
  for (const p of inconsistentProfiles) {
    const rd = p.reviewsData || {};
    console.log(`  userId: ${p.userId}`);
    console.log(`    averageRating: ${rd.averageRating}, totalReviews: ${rd.totalReviews}`);
    console.log(`    recentReviews.length: ${(rd.recentReviews || []).length}`);
    console.log(`    business: ${p.businessInfo?.businessName || p.instagramStyleProfile?.displayName || 'n/a'}`);
  }

  const sarahLike = await db.collection('providerprofiles').find({
    $or: [
      { 'businessInfo.businessName': /sarah/i },
      { 'instagramStyleProfile.displayName': /sarah/i },
    ],
  }).toArray();

  console.log('\n=== Sarah / makeup providers ===');
  for (const p of sarahLike) {
    const rd = p.reviewsData || {};
    console.log(`  userId: ${p.userId}, name: ${p.businessInfo?.businessName || 'n/a'}`);
    console.log(`    reviewsData: avg=${rd.averageRating}, total=${rd.totalReviews}, recent=${(rd.recentReviews || []).length}`);
  }

  const bridalServices = await db.collection('services').find({
    $or: [{ slug: 'bridal-makeup' }, { subcategory: 'bridal-makeup' }, { name: /bridal/i }],
  }).limit(5).toArray();

  console.log('\n=== Bridal makeup services (rating cache) ===');
  for (const s of bridalServices) {
    console.log(`  ${s.name} (${s._id})`);
    console.log(`    rating: ${JSON.stringify(s.rating)}`);
    console.log(`    providerId: ${s.providerId}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
