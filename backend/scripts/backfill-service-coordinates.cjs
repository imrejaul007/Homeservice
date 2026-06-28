/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const DUBAI_COORDS = [55.2708, 25.2048];

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function isValidLngLat(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    isFiniteNumber(coords[0]) &&
    isFiniteNumber(coords[1]) &&
    coords[0] >= -180 &&
    coords[0] <= 180 &&
    coords[1] >= -90 &&
    coords[1] <= 90
  );
}

function isDubaiDefault(coords) {
  return (
    isValidLngLat(coords) &&
    coords[0] === DUBAI_COORDS[0] &&
    coords[1] === DUBAI_COORDS[1]
  );
}

function extractServiceCoords(serviceDoc) {
  const direct = serviceDoc?.location?.coordinates?.coordinates;
  if (isValidLngLat(direct)) return direct;

  const legacyLat = serviceDoc?.location?.coordinates?.lat;
  const legacyLng = serviceDoc?.location?.coordinates?.lng;
  if (isFiniteNumber(legacyLng) && isFiniteNumber(legacyLat)) {
    const legacy = [legacyLng, legacyLat];
    if (isValidLngLat(legacy)) return legacy;
  }

  return null;
}

function extractProviderCoords(providerDoc) {
  const direct = providerDoc?.locationInfo?.primaryAddress?.coordinates?.coordinates;
  if (isValidLngLat(direct)) return direct;

  const legacyLat = providerDoc?.locationInfo?.primaryAddress?.coordinates?.lat;
  const legacyLng = providerDoc?.locationInfo?.primaryAddress?.coordinates?.lng;
  if (isFiniteNumber(legacyLng) && isFiniteNumber(legacyLat)) {
    const legacy = [legacyLng, legacyLat];
    if (isValidLngLat(legacy)) return legacy;
  }

  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing in backend/.env');
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const servicesCol = db.collection('services');
  const providerCol = db.collection('providerprofiles');

  console.log('Backfill service coordinates');
  console.log(`Mode: ${apply ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  console.log('Only field updated: location.coordinates');
  console.log('---');

  const services = await servicesCol
    .find({}, { projection: { _id: 1, name: 1, providerId: 1, location: 1 } })
    .toArray();

  const providerIds = [...new Set(services.map((s) => s.providerId?.toString()).filter(Boolean))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const providers = await providerCol
    .find(
      { userId: { $in: providerIds } },
      { projection: { _id: 1, userId: 1, locationInfo: 1, businessInfo: 1 } }
    )
    .toArray();

  const providerMap = new Map(providers.map((p) => [p.userId.toString(), p]));

  const updates = [];
  let unchanged = 0;
  let skippedNoProvider = 0;
  let skippedNoBetterCoords = 0;
  let hasValidServiceCoords = 0;

  for (const service of services) {
    const serviceCoords = extractServiceCoords(service);
    const provider = providerMap.get(service.providerId?.toString());
    const providerCoords = provider ? extractProviderCoords(provider) : null;

    const serviceHasValid = isValidLngLat(serviceCoords);
    const providerHasValid = isValidLngLat(providerCoords);
    if (serviceHasValid) hasValidServiceCoords += 1;

    const needsFixMissing = !serviceHasValid;
    const needsFixDubaiFallback =
      serviceHasValid && isDubaiDefault(serviceCoords) && providerHasValid && !isDubaiDefault(providerCoords);

    if (!needsFixMissing && !needsFixDubaiFallback) {
      unchanged += 1;
      continue;
    }

    if (!provider) {
      skippedNoProvider += 1;
      continue;
    }

    if (!providerHasValid) {
      skippedNoBetterCoords += 1;
      continue;
    }

    updates.push({
      updateOne: {
        filter: { _id: service._id },
        update: {
          $set: {
            location: {
              ...(service.location || {}),
              coordinates: {
                type: 'Point',
                coordinates: providerCoords,
              },
            },
          },
        },
      },
    });
  }

  console.log(`Total services scanned: ${services.length}`);
  console.log(`Services with valid coords already: ${hasValidServiceCoords}`);
  console.log(`Candidate updates: ${updates.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Skipped (provider missing): ${skippedNoProvider}`);
  console.log(`Skipped (provider coords not usable): ${skippedNoBetterCoords}`);

  if (updates.length > 0) {
    console.log('Sample updates (up to 10 service IDs):');
    updates.slice(0, 10).forEach((u) => console.log(`- ${u.updateOne.filter._id}`));
  }

  if (apply && updates.length > 0) {
    const result = await servicesCol.bulkWrite(updates, { ordered: false });
    console.log('---');
    console.log('Applied updates:');
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
  }

  if (!apply) {
    console.log('---');
    console.log('Dry run complete. Re-run with --apply to persist changes.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
