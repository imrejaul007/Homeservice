/**
 * Migration Script: Fix Provider Locations
 *
 * Purpose: Update existing providers with proper geolocation coordinates
 *
 * Usage:
 *   Development: npx ts-node src/scripts/fix-provider-locations.ts
 *   Production: node dist/scripts/fix-provider-locations.js
 *
 * Features:
 *   - Updates providers with default Dubai coordinates to their actual city
 *   - Sets proper 2dsphere index for geospatial queries
 *   - Reports statistics on updated providers
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// City to coordinates mapping (GeoJSON format: [longitude, latitude])
const CITY_COORDINATES: Record<string, [number, number]> = {
  'dubai': [55.2708, 25.2048],
  'abu dhabi': [54.3773, 24.4539],
  'abu-dhabi': [54.3773, 24.4539],
  'sharjah': [55.4209, 25.3463],
  'ajman': [55.4209, 25.3488],
  'riyadh': [46.6753, 24.7136],
  'jeddah': [46.6753, 24.7136],
  'mumbai': [72.8777, 19.0760],
  'delhi': [77.1025, 28.7041],
  'bangalore': [77.5946, 12.9716],
};

// Default coordinates (Dubai)
const DEFAULT_COORDS: [number, number] = [55.2708, 25.2048];

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/?appName=Cluster0';

interface UpdateResult {
  totalScanned: number;
  totalUpdated: number;
  totalSkipped: number;
  errors: string[];
  details: Array<{
    providerId: string;
    businessName: string;
    oldCity: string;
    newCity: string;
    coordinates: [number, number];
  }>;
}

async function fixProviderLocations(): Promise<UpdateResult> {
  const result: UpdateResult = {
    totalScanned: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    errors: [],
    details: [],
  };

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Import the ProviderProfile model
    const ProviderProfile = (await import('../models/providerProfile.model')).default;

    // Find all providers with location data
    const providers = await ProviderProfile.find({
      isDeleted: { $ne: true },
    }).lean();

    result.totalScanned = providers.length;
    console.log(`📊 Found ${providers.length} providers to check\n`);

    for (const provider of providers) {
      try {
        const providerId = (provider._id as mongoose.Types.ObjectId).toString();
        const locationInfo = provider.locationInfo as any;
        const primaryAddress = locationInfo?.primaryAddress;

        if (!primaryAddress) {
          result.totalSkipped++;
          continue;
        }

        const city = (primaryAddress.city || '').toLowerCase().trim();
        const currentCoords = primaryAddress.coordinates?.coordinates as [number, number] | undefined;

        // Check if coordinates need updating
        const coords = CITY_COORDINATES[city];

        if (coords && currentCoords) {
          // Check if coordinates are different from the city defaults
          const isDefaultDubai = currentCoords[0] === 55.2708 && currentCoords[1] === 25.2048;

          if (isDefaultDubai && city !== 'dubai') {
            // Update provider with proper city coordinates
            await ProviderProfile.updateOne(
              { _id: provider._id },
              {
                $set: {
                  'locationInfo.primaryAddress.coordinates': {
                    type: 'Point',
                    coordinates: coords
                  }
                }
              }
            );

            result.totalUpdated++;
            result.details.push({
              providerId: providerId,
              businessName: provider.businessInfo?.businessName || 'Unknown',
              oldCity: 'Dubai (default)',
              newCity: city,
              coordinates: coords,
            });

            console.log(`  ✅ Updated: ${provider.businessInfo?.businessName} → ${city}`);
          } else if (coords[0] !== currentCoords[0] || coords[1] !== currentCoords[1]) {
            // City doesn't match coordinates - fix it
            await ProviderProfile.updateOne(
              { _id: provider._id },
              {
                $set: {
                  'locationInfo.primaryAddress.coordinates': {
                    type: 'Point',
                    coordinates: coords
                  }
                }
              }
            );

            result.totalUpdated++;
            result.details.push({
              providerId: providerId,
              businessName: provider.businessInfo?.businessName || 'Unknown',
              oldCity: city,
              newCity: city,
              coordinates: coords,
            });

            console.log(`  🔧 Fixed: ${provider.businessInfo?.businessName} coordinates`);
          } else {
            result.totalSkipped++;
          }
        } else if (!currentCoords || (currentCoords[0] === 0 && currentCoords[1] === 0)) {
          // Provider has no valid coordinates - set default based on city or Dubai
          const finalCoords = coords || DEFAULT_COORDS;
          const finalCity = city || 'Dubai';

          await ProviderProfile.updateOne(
            { _id: provider._id },
            {
              $set: {
                'locationInfo.primaryAddress.coordinates': {
                  type: 'Point',
                  coordinates: finalCoords
                },
                'locationInfo.primaryAddress.city': finalCity
              }
            }
          );

          result.totalUpdated++;
          result.details.push({
            providerId: providerId,
            businessName: provider.businessInfo?.businessName || 'Unknown',
            oldCity: 'No coordinates',
            newCity: finalCity,
            coordinates: finalCoords,
          });

          console.log(`  📍 Set default: ${provider.businessInfo?.businessName} → ${finalCity}`);
        } else {
          result.totalSkipped++;
        }
      } catch (error) {
        const providerId = (provider._id as mongoose.Types.ObjectId).toString();
        const errorMsg = `Error updating provider ${providerId}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`  ❌ ${errorMsg}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total scanned: ${result.totalScanned}`);
    console.log(`Total updated: ${result.totalUpdated}`);
    console.log(`Total skipped: ${result.totalSkipped}`);
    console.log(`Total errors: ${result.errors.length}`);

    if (result.details.length > 0) {
      console.log('\n📝 Updated Providers:');
      result.details.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.businessName}`);
        console.log(`     City: ${d.oldCity} → ${d.newCity}`);
        console.log(`     Coords: [${d.coordinates.join(', ')}]`);
      });
    }

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    // Verify 2dsphere index exists
    console.log('\n🔍 Checking geospatial indexes...');
    const collections = await mongoose.connection.db?.listCollections({ name: 'providerprofiles' }).toArray();
    if (collections && collections.length > 0) {
      const indexes = await mongoose.connection.db?.collection('providerprofiles').indexes();
      const has2dsphere = indexes?.some(idx =>
        idx.key && Object.values(idx.key).some(v => v === '2dsphere')
      );
      console.log(has2dsphere ? '  ✅ 2dsphere index exists' : '  ⚠️ 2dsphere index missing - run ensureIndex');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.errors.push(`Migration failed: ${error}`);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }

  return result;
}

// Run migration
console.log('🚀 Starting Provider Location Migration\n');
console.log('Database:', MONGODB_URI.replace(/\/\/.*@/, '//***@'));
console.log('');

fixProviderLocations()
  .then(result => {
    process.exit(result.errors.length > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });