/**
 * Migration: Replace unique { userId, couponCode } index with partial unique
 * { userId, offerId } where status is 'claimed' — enables multi-use per customer.
 *
 * Run: node src/migrations/006_offer_claim_multi_use_index.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collection = db.collection('offerclaims');

  const indexes = await collection.indexes();
  const legacy = indexes.find(
    (idx) =>
      idx.key?.userId === 1 &&
      idx.key?.couponCode === 1 &&
      idx.unique === true
  );

  if (legacy) {
    console.log('Dropping legacy index:', legacy.name);
    await collection.dropIndex(legacy.name);
  } else {
    console.log('Legacy userId+couponCode unique index not found (may already be migrated)');
  }

  try {
    await collection.createIndex(
      { userId: 1, offerId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: 'claimed' },
        name: 'userId_1_offerId_1_claimed_partial',
      }
    );
    console.log('Created partial unique index userId_1_offerId_1_claimed_partial');
  } catch (err) {
    if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
      console.log('Partial index already exists');
    } else {
      throw err;
    }
  }

  try {
    await collection.createIndex(
      { userId: 1, couponCode: 1 },
      { name: 'userId_1_couponCode_1_lookup' }
    );
    console.log('Created lookup index userId_1_couponCode_1_lookup');
  } catch (err) {
    if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
      console.log('Lookup index already exists');
    } else {
      throw err;
    }
  }

  await mongoose.disconnect();
  console.log('Migration complete');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
