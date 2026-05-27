/**
 * Repair provider profiles with invalid GeoJSON coordinates.
 * Run from backend/: node scripts/fix-provider-coordinates.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_COORDS = [55.2708, 25.2048]; // Dubai [lng, lat]

function isValidPoint(coords) {
  return (
    coords &&
    coords.type === 'Point' &&
    Array.isArray(coords.coordinates) &&
    coords.coordinates.length === 2 &&
    typeof coords.coordinates[0] === 'number' &&
    typeof coords.coordinates[1] === 'number'
  );
}

async function fixProviderCoordinates() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.db.collection('providerprofiles');

  const cursor = collection.find({
    'locationInfo.primaryAddress.coordinates.type': 'Point',
  });

  let fixed = 0;
  let unset = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const coords = doc.locationInfo?.primaryAddress?.coordinates;

    if (isValidPoint(coords)) continue;

    const primaryAddress = doc.locationInfo?.primaryAddress || {};
    const country = primaryAddress.country || 'AE';
    const mobileService = doc.locationInfo?.mobileService !== false;
    const hasAddress = Boolean(
      primaryAddress.street && primaryAddress.city && primaryAddress.state && primaryAddress.zipCode
    );

    if (hasAddress || (country === 'AE' && mobileService)) {
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            'locationInfo.primaryAddress.coordinates': {
              type: 'Point',
              coordinates: DEFAULT_COORDS,
            },
            'locationInfo.primaryAddress.country': primaryAddress.country || 'AE',
            ...(hasAddress
              ? {}
              : {
                  'locationInfo.primaryAddress.street': primaryAddress.street || 'Service Area',
                  'locationInfo.primaryAddress.city': primaryAddress.city || 'Dubai',
                  'locationInfo.primaryAddress.state': primaryAddress.state || 'Dubai',
                  'locationInfo.primaryAddress.zipCode': primaryAddress.zipCode || '00000',
                }),
          },
        }
      );
      fixed++;
      console.log(`Fixed coordinates for profile ${doc._id}`);
    } else {
      await collection.updateOne(
        { _id: doc._id },
        { $unset: { 'locationInfo.primaryAddress.coordinates': '' } }
      );
      unset++;
      console.log(`Unset invalid coordinates for profile ${doc._id}`);
    }
  }

  // Also fix profiles with coordinates object missing type but broken structure
  const broken = await collection
    .find({
      $or: [
        { 'locationInfo.primaryAddress.coordinates': { $exists: true, $type: 'object' } },
      ],
    })
    .toArray();

  for (const doc of broken) {
    const coords = doc.locationInfo?.primaryAddress?.coordinates;
    if (!coords || isValidPoint(coords)) continue;
    if (coords.type === 'Point' && !Array.isArray(coords.coordinates)) {
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            'locationInfo.primaryAddress.coordinates': {
              type: 'Point',
              coordinates: DEFAULT_COORDS,
            },
          },
        }
      );
      fixed++;
      console.log(`Fixed broken Point for profile ${doc._id}`);
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Unset: ${unset}`);
  await mongoose.disconnect();
}

fixProviderCoordinates().catch((err) => {
  console.error(err);
  process.exit(1);
});
