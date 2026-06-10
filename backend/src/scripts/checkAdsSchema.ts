import mongoose from 'mongoose';

/**
 * Check Ads Schema Script
 * Verifies the providerads collection schema
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkAdsSchema.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkAdsSchema.ts');
  process.exit(1);
}

async function check() {
  await mongoose.connect(MONGODB_URI, { maxPoolSize: 5 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // Try to query the collection with the model
  console.log('Attempting to query providerads collection...');

  try {
    // Check if we can do a simple count
    const count = await db.collection('providerads').countDocuments();
    console.log('Document count:', count);

    // Try to insert a test document
    const testDoc = {
      name: 'Test Ad',
      providerId: new mongoose.Types.ObjectId(),
      status: 'draft',
      isActive: true,
      content: { title: 'Test', description: 'Test ad' },
      budget: { total: 100 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('providerads').insertOne(testDoc);
    console.log('Insert result:', result.insertedId);

    // Clean up
    await db.collection('providerads').deleteOne({ _id: result.insertedId });
    console.log('Cleaned up test document');

  } catch (error: any) {
    console.log('Error:', error.message);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

check().catch(err => { console.error(err); process.exit(1); });
