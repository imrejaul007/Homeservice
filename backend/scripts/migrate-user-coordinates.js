/**
 * Migration Script: Fix Malformed User Coordinates
 *
 * Fixes users with address.coordinates = { type: "Point" }
 * (missing coordinates array) which causes 2dsphere index errors.
 */

const mongoose = require('mongoose');

// Load environment
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Load models
const User = require('../dist/models/user.model').default || require('../dist/models/user.model');

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nilin');
    console.log('Connected\n');

    // Find users with malformed coordinates
    const usersWithBadCoords = await User.find({
      'address.coordinates': { $exists: true }
    });

    let fixed = 0;
    let skipped = 0;

    for (const user of usersWithBadCoords) {
      const coords = user.address?.coordinates;

      // Check if coordinates is malformed (has type but no coordinates array)
      if (coords && coords.type === 'Point' && !Array.isArray(coords.coordinates)) {
        console.log(`Fixing user ${user.email} (${user._id})...`);

        // Set proper coordinates (default to Dubai)
        user.address.coordinates = {
          type: 'Point',
          coordinates: [55.2708, 25.2048] // [longitude, latitude]
        };

        await user.save();
        fixed++;
      } else if (coords && Array.isArray(coords.coordinates)) {
        // Good data
        skipped++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`  Fixed: ${fixed} users`);
    console.log(`  Skipped (already valid): ${skipped} users`);
    console.log(`  Total checked: ${usersWithBadCoords.length} users`);

    // Also remove the 2dsphere index if it's causing issues
    console.log('\nChecking indexes...');
    const indexes = await User.collection.indexes();
    const geoIndex = indexes.find(i => i.key && i.key['address.coordinates'] === '2dsphere');

    if (geoIndex) {
      console.log(`Found 2dsphere index: ${geoIndex.name}`);
      // Don't drop it automatically, just report it
      console.log('Note: The 2dsphere index exists but users with valid coordinates will work fine.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
