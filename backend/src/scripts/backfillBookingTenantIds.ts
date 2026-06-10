import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import Tenant from '../models/tenant.model';

/**
 * Backfill tenantId on bookings that were created before tenant was persisted.
 *
 * Usage: npx ts-node src/scripts/backfillBookingTenantIds.ts
 */
async function backfillBookingTenantIds() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  let defaultTenant = await Tenant.findOne({ slug: 'default', isActive: true }).lean();
  if (!defaultTenant) {
    defaultTenant = await Tenant.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  }

  const fallbackTenantId = defaultTenant?._id ?? new mongoose.Types.ObjectId('000000000000000000000000');

  const filter = {
    $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
    deletedAt: { $exists: false },
  };

  const missingCount = await Booking.countDocuments(filter);
  console.log(`Bookings missing tenantId: ${missingCount}`);

  if (missingCount === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  const result = await Booking.updateMany(filter, {
    $set: { tenantId: fallbackTenantId },
  });

  console.log(`Updated ${result.modifiedCount} booking(s) with tenantId ${fallbackTenantId}`);
  await mongoose.disconnect();
}

backfillBookingTenantIds().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
