/**
 * Fix admin user coordinates field
 * Run: node scripts/fix-admin-coordinates.js
 */

const mongoose = require('mongoose');

async function fixAdminCoordinates() {
  // Use MongoDB Atlas connection
  const MONGODB_URI = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/?appName=Cluster0';

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    const db = mongoose.connection.db;
    const users = db.collection('users');

    // Find admin user
    const adminUser = await users.findOne({ email: 'admin@homeservice.com' });

    if (!adminUser) {
      console.log('Admin user not found');
      return;
    }

    console.log('Found admin user:', adminUser.email);
    console.log('Current address:', adminUser.address);

    // Fix the coordinates field
    await users.updateOne(
      { email: 'admin@homeservice.com' },
      {
        $set: {
          'address.coordinates': {
            type: 'Point',
            coordinates: [0, 0] // Default coordinates [longitude, latitude]
          }
        }
      }
    );

    console.log('Successfully updated admin user coordinates');

    // Verify the update
    const updatedUser = await users.findOne({ email: 'admin@homeservice.com' });
    console.log('Updated address:', updatedUser.address);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAdminCoordinates();
