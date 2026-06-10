/**
 * Sync review-related denormalized data ONLY (does not delete users, bookings, services, etc.)
 *
 * - Recalculates ProviderProfile.reviewsData from the Review collection
 * - Recalculates Service.rating from linked approved reviews
 * - Zeros stale ratings where no public reviews exist
 *
 * Run from backend/: npx ts-node src/scripts/syncReviewDataOnly.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
// Register schemas before recalculate* (they call mongoose.model('Review') / 'Booking')
import '../models/user.model';
import '../models/review.model';
import '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }
  console.log('Syncing review-related data only...\n');

  const connectOptions: mongoose.ConnectOptions = { serverSelectionTimeoutMS: 30000 };
  if (process.env.MONGODB_DB) {
    connectOptions.dbName = process.env.MONGODB_DB;
  }
  await mongoose.connect(uri, connectOptions);
  console.log(`Connected: ${mongoose.connection.name}\n`);

  const profiles = await ProviderProfile.find({}).select('userId businessInfo.businessName').lean();
  let providersUpdated = 0;

  for (const profile of profiles) {
    if (!profile.userId) continue;
    await ProviderProfile.recalculateReviewsData(profile.userId);
    providersUpdated++;
    if (providersUpdated % 25 === 0) {
      console.log(`  Providers synced: ${providersUpdated}/${profiles.length}`);
    }
  }

  const services = await Service.find({}).select('_id name rating').lean();
  let servicesUpdated = 0;

  for (const service of services) {
    await Service.recalculateRating(service._id);
    servicesUpdated++;
    if (servicesUpdated % 50 === 0) {
      console.log(`  Services synced: ${servicesUpdated}/${services.length}`);
    }
  }

  const inconsistent = await ProviderProfile.countDocuments({
    $or: [
      { 'reviewsData.averageRating': { $gt: 0 }, 'reviewsData.totalReviews': 0 },
      { 'reviewsData.totalReviews': { $gt: 0 }, 'reviewsData.recentReviews': { $size: 0 } },
    ],
  });

  console.log('\n--- Summary ---');
  console.log(`Provider profiles recalculated: ${providersUpdated}`);
  console.log(`Service ratings recalculated: ${servicesUpdated}`);
  console.log(`Remaining inconsistent provider profiles: ${inconsistent}`);

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Sync failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
