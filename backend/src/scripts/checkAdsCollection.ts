import mongoose from 'mongoose';

/**
 * Check Ads Collection Script
 * Lists all collections and checks if providerads exists
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkAdsCollection.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkAdsCollection.ts');
  process.exit(1);
}

async function check() {
  await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // List all collections
  console.log('Collections:');
  const collections = await db.listCollections().toArray();
  collections.forEach(c => console.log(`  - ${c.name}`));

  // Check if providerads exists
  const hasAdsCollection = collections.some(c => c.name === 'providerads');
  console.log('\nproviderads collection exists:', hasAdsCollection);

  // If not, create it
  if (!hasAdsCollection) {
    console.log('Creating providerads collection...');
    await db.createCollection('providerads', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['name', 'providerId', 'status', 'isActive'],
          properties: {
            name: { bsonType: 'string' },
            providerId: { bsonType: 'objectId' },
            status: { bsonType: 'string' },
            isActive: { bsonType: 'bool' }
          }
        }
      }
    });
    console.log('Created providerads collection');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

check().catch(err => { console.error(err); process.exit(1); });
