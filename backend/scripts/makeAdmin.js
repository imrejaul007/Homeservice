const { MongoClient } = require('mongodb');
require('dotenv').config();

async function makeAdmin() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz');
  
  try {
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // List all users first
    const allUsers = await usersCollection.find({}).toArray();
    console.log('📋 All users in database:');
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.role || 'unknown'}) - Status: ${user.accountStatus || 'unknown'}`);
    });

    // Find and update the admin user
    const result = await usersCollection.findOneAndUpdate(
      { email: 'admin@rezz.com' },
      { 
        $set: {
          role: 'admin',
          accountStatus: 'active',
          isEmailVerified: true
        }
      },
      { returnDocument: 'after' }
    );

    if (result.value) {
      console.log('✅ Admin user updated successfully:', result.value.email, 'Role:', result.value.role);
    } else {
      console.log('❌ User admin@rezz.com not found');
    }
  } catch (error) {
    console.error('❌ Error updating admin user:', error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

makeAdmin();