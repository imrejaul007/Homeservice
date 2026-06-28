/**
 * Location & Distance Flow — MongoDB Data Analysis
 * Run: node scripts/analyze-location-data.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../backend/package.json'));
const mongoose = require('mongoose');

const envPath = join(__dirname, '../backend/.env');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const MONGO_URI = process.env.MONGODB_URI;
const DUBAI_COORDS = [55.2708, 25.2048];

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

function extractCoords(doc, path) {
  const parts = path.split('.');
  let cur = doc;
  for (const p of parts) cur = cur?.[p];
  if (!cur) return null;
  if (Array.isArray(cur) && cur.length >= 2) return { lng: cur[0], lat: cur[1] };
  if (cur.coordinates && Array.isArray(cur.coordinates) && cur.coordinates.length >= 2) {
    return { lng: cur.coordinates[0], lat: cur.coordinates[1] };
  }
  if (cur.lat != null && cur.lng != null) return { lng: cur.lng, lat: cur.lat };
  return null;
}

async function analyze() {
  console.log('LOCATION & DISTANCE DATA ANALYSIS');
  console.log('='.repeat(60));

  if (!MONGO_URI) {
    console.error('MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB\n');

  // --- SERVICES ---
  const servicesCol = db.collection('services');
  const totalServices = await servicesCol.countDocuments({});
  const geoJsonCoords = await servicesCol.countDocuments({
    'location.coordinates.coordinates.0': { $exists: true },
    'location.coordinates.coordinates.1': { $exists: true },
  });
  const legacyLatLng = await servicesCol.countDocuments({
    'location.coordinates.lat': { $exists: true },
  });
  const missingCoords = totalServices - geoJsonCoords;
  const dubaiDefault = await servicesCol.countDocuments({
    'location.coordinates.coordinates': DUBAI_COORDS,
  });

  console.log('1. SERVICES COLLECTION');
  console.log('-'.repeat(40));
  console.log(`   Total services:              ${totalServices}`);
  console.log(`   With GeoJSON [lng,lat]:      ${geoJsonCoords} (${pct(geoJsonCoords, totalServices)})`);
  console.log(`   Missing/invalid coordinates: ${missingCoords}`);
  console.log(`   Legacy {lat,lng} format:     ${legacyLatLng}`);
  console.log(`   Using Dubai default coords:  ${dubaiDefault}`);

  const cityBreakdown = await servicesCol
    .aggregate([
      { $group: { _id: '$location.address.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])
    .toArray();
  console.log('\n   Top cities (address.city):');
  cityBreakdown.forEach((c) => console.log(`     - ${c._id || '(empty)'}: ${c.count}`));

  const sampleServices = await servicesCol
    .find({})
    .limit(8)
    .project({ name: 1, 'location.address': 1, 'location.coordinates': 1 })
    .toArray();

  console.log('\n   Sample services:');
  for (const s of sampleServices) {
    const coords = extractCoords(s, 'location.coordinates');
    console.log(`     • ${s.name}`);
    console.log(`       city: ${s.location?.address?.city ?? 'N/A'}`);
    console.log(`       coords: ${coords ? `[${coords.lng}, ${coords.lat}]` : 'MISSING'}`);
  }

  // --- PROVIDERS ---
  const provCol = db.collection('providerprofiles');
  const totalProviders = await provCol.countDocuments({});
  const provGeoJson = await provCol.countDocuments({
    'locationInfo.primaryAddress.coordinates.coordinates.0': { $exists: true },
  });
  const provLegacy = await provCol.countDocuments({
    'locationInfo.primaryAddress.coordinates.lat': { $exists: true },
  });
  const provNoCoords = await provCol.countDocuments({
    $or: [
      { 'locationInfo.primaryAddress.coordinates': { $exists: false } },
      { 'locationInfo.primaryAddress.coordinates.coordinates': { $exists: false } },
    ],
  });

  console.log('\n2. PROVIDER PROFILES');
  console.log('-'.repeat(40));
  console.log(`   Total providers:             ${totalProviders}`);
  console.log(`   With GeoJSON coordinates:    ${provGeoJson} (${pct(provGeoJson, totalProviders)})`);
  console.log(`   Legacy {lat,lng} format:     ${provLegacy}`);
  console.log(`   Missing coordinates:         ${provNoCoords}`);

  const sampleProviders = await provCol
    .find({})
    .limit(5)
    .project({
      'businessInfo.businessName': 1,
      'locationInfo.primaryAddress': 1,
    })
    .toArray();

  console.log('\n   Sample providers:');
  for (const p of sampleProviders) {
    const coords = extractCoords(p, 'locationInfo.primaryAddress.coordinates');
    const addr = p.locationInfo?.primaryAddress;
    console.log(`     • ${p.businessInfo?.businessName ?? 'Unnamed'}`);
    console.log(`       city: ${addr?.city ?? 'N/A'}`);
    console.log(`       coords: ${coords ? `[${coords.lng}, ${coords.lat}]` : 'MISSING'}`);
  }

  // --- INDEXES ---
  const serviceIndexes = await servicesCol.indexes();
  const geoIndexes = serviceIndexes.filter((i) =>
    Object.values(i.key || {}).includes('2dsphere')
  );

  console.log('\n3. GEOSPATIAL INDEXES');
  console.log('-'.repeat(40));
  console.log(`   Services 2dsphere index: ${geoIndexes.length > 0 ? 'YES' : 'NO'}`);
  geoIndexes.forEach((i) => console.log(`     - ${i.name}: ${JSON.stringify(i.key)}`));

  // --- DISTANCE SIMULATION (Bangalore user → services) ---
  const BANGALORE = { lat: 12.9716, lng: 77.5946 };
  console.log('\n4. DISTANCE SIMULATION (User in Bangalore)');
  console.log('-'.repeat(40));

  const activeWithCoords = await servicesCol
    .find({
      isActive: true,
      status: 'active',
      'location.coordinates.coordinates.0': { $exists: true },
    })
    .limit(10)
    .project({ name: 1, 'location.address.city': 1, 'location.coordinates.coordinates': 1 })
    .toArray();

  for (const s of activeWithCoords.slice(0, 6)) {
    const [lng, lat] = s.location.coordinates.coordinates;
    const dist = haversineKm(BANGALORE.lat, BANGALORE.lng, lat, lng);
    console.log(
      `     • ${s.name} (${s.location?.address?.city}) → ${dist.toFixed(0)} km`
    );
  }

  // --- MISMATCH: city vs coords ---
  console.log('\n5. CITY vs COORDINATE MISMATCHES');
  console.log('-'.repeat(40));
  const mismatches = [];
  const allWithCoords = await servicesCol
    .find({ 'location.coordinates.coordinates.0': { $exists: true } })
    .project({ name: 1, 'location.address.city': 1, 'location.coordinates.coordinates': 1 })
    .limit(200)
    .toArray();

  for (const s of allWithCoords) {
    const city = (s.location?.address?.city || '').toLowerCase();
    const [lng, lat] = s.location.coordinates.coordinates;
    const nearDubai = haversineKm(lat, lng, 25.2048, 55.2708) < 50;
    const nearBangalore = haversineKm(lat, lng, 12.9716, 77.5946) < 50;
    if (city.includes('bangalore') && nearDubai) mismatches.push({ name: s.name, city, issue: 'Bangalore city but Dubai coords' });
    if (city.includes('dubai') && nearBangalore) mismatches.push({ name: s.name, city, issue: 'Dubai city but Bangalore coords' });
    if (city.includes('dubai') && nearDubai && lng === DUBAI_COORDS[0] && lat === DUBAI_COORDS[1]) {
      mismatches.push({ name: s.name, city, issue: 'Exact Dubai default fallback coords' });
    }
  }
  console.log(`   Potential mismatches found: ${mismatches.length}`);
  mismatches.slice(0, 8).forEach((m) => console.log(`     - ${m.name}: ${m.issue}`));

  // --- SUMMARY ---
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  if (missingCoords > 0) console.log(`⚠  ${missingCoords} services lack valid coordinates`);
  if (provNoCoords > 0) console.log(`⚠  ${provNoCoords} providers lack coordinates`);
  if (dubaiDefault > 0) console.log(`⚠  ${dubaiDefault} services use Dubai default fallback`);
  if (geoIndexes.length === 0) console.log('❌ No 2dsphere index on services');
  else console.log('✅ 2dsphere index present');

  await mongoose.disconnect();
  console.log('\nDone.');
}

function pct(n, total) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

analyze().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
