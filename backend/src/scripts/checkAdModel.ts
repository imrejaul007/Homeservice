import mongoose from 'mongoose';

/**
 * Check Ad Model Script
 * Verifies the providerads collection and checks ad data
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkAdModel.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkAdModel.ts');
  process.exit(1);
}

async function check() {
  await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // Check if there are any ads
  const adsCount = await db.collection('providerads').countDocuments();
  console.log('Total ads:', adsCount);

  // Check schema
  const sampleAd = await db.collection('providerads').findOne({});
  if (sampleAd) {
    console.log('Sample ad providerId type:', typeof sampleAd.providerId);
    console.log('Sample ad providerId:', sampleAd.providerId);
  } else {
    console.log('No ads found in collection');
  }

  await mongoose.disconnect();
}

check().catch(err => { console.error(err); process.exit(1); });
