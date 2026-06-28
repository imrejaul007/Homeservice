/* eslint-disable */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const DUBAI = [55.2708, 25.2048];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const total = await db.collection('services').countDocuments({});
  const geo = await db.collection('services').countDocuments({
    'location.coordinates.coordinates.0': { $exists: true },
    'location.coordinates.coordinates.1': { $exists: true },
  });
  const dubai = await db.collection('services').countDocuments({
    'location.coordinates.coordinates': DUBAI,
  });
  const legacy = await db.collection('services').countDocuments({
    'location.coordinates.lat': { $exists: true },
  });

  const cities = await db
    .collection('services')
    .aggregate([
      { $group: { _id: '$location.address.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  const samples = await db
    .collection('services')
    .find({})
    .limit(8)
    .project({ name: 1, 'location.address.city': 1, 'location.coordinates': 1 })
    .toArray();

  const provTotal = await db.collection('providerprofiles').countDocuments({});
  const provGeo = await db.collection('providerprofiles').countDocuments({
    'locationInfo.primaryAddress.coordinates.coordinates.0': { $exists: true },
  });
  const provMissing = await db.collection('providerprofiles').countDocuments({
    $or: [
      { 'locationInfo.primaryAddress.coordinates': { $exists: false } },
      { 'locationInfo.primaryAddress.coordinates.coordinates': { $exists: false } },
    ],
  });

  const provSamples = await db
    .collection('providerprofiles')
    .find({})
    .limit(5)
    .project({
      'businessInfo.businessName': 1,
      'locationInfo.primaryAddress': 1,
    })
    .toArray();

  const indexes = await db.collection('services').indexes();
  const has2d = indexes.some((i) => Object.values(i.key || {}).includes('2dsphere'));

  const bangalore = { lat: 12.9716, lng: 77.5946 };
  const distSamples = await db
    .collection('services')
    .find({ isActive: true, 'location.coordinates.coordinates.0': { $exists: true } })
    .limit(6)
    .project({ name: 1, 'location.address.city': 1, 'location.coordinates.coordinates': 1 })
    .toArray();

  console.log('=== SERVICES ===');
  console.log({ total, withGeoJsonCoords: geo, missing: total - geo, dubaiDefault: dubai, legacyLatLng: legacy });
  console.log('Top cities:', cities);
  console.log('Samples:', samples.map((s) => ({
    name: s.name,
    city: s.location?.address?.city,
    coords: s.location?.coordinates?.coordinates,
  })));

  console.log('\n=== PROVIDERS ===');
  console.log({ provTotal, provGeo, provMissing });
  console.log('Samples:', provSamples.map((p) => ({
    name: p.businessInfo?.businessName,
    city: p.locationInfo?.primaryAddress?.city,
    coords: p.locationInfo?.primaryAddress?.coordinates?.coordinates,
  })));

  console.log('\n=== INDEX ===');
  console.log('2dsphere on services:', has2d);

  console.log('\n=== DISTANCE FROM BANGALORE ===');
  distSamples.forEach((s) => {
    const [lng, lat] = s.location.coordinates.coordinates;
    console.log(`${s.name} (${s.location?.address?.city}): ${haversineKm(bangalore.lat, bangalore.lng, lat, lng).toFixed(0)} km`);
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
