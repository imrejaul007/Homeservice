const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function resetTestUser() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const users = db.collection('users');

    // Delete existing user
    await users.deleteOne({ email: 'testprovider@example.com' });
    console.log('🗑️ Deleted existing user');

    // Hash password
    const password = 'TestProvider123!';
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    // Create fresh user with proper geo coordinates
    const user = {
      _id: new ObjectId(),
      firstName: 'Test',
      lastName: 'Provider',
      email: 'testprovider@example.com',
      password: hashedPassword,
      phone: '+15551234567',
      role: 'provider',
      accountStatus: 'active',
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      isDeleted: false,
      loginAttempts: 0,
      tokenVersion: 1,
      createdAt: now,
      updatedAt: now,
      // Valid geo coordinates [lng, lat] for 2dsphere index
      address: {
        coordinates: {
          type: 'Point',
          coordinates: [55.2708, 25.2048]
        },
        country: 'UAE'
      }
    };

    await users.insertOne(user);
    console.log('✅ User created successfully!');
    console.log('');
    console.log('🎉 Test Provider Ready!');
    console.log('📧 Email: testprovider@example.com');
    console.log('🔐 Password: TestProvider123!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

resetTestUser();
