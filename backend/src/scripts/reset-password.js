const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function resetPassword() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const users = db.collection('users');

    // Find the user
    const user = await users.findOne({ email: 'testprovider@example.com' });

    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    // Hash new password
    const newPassword = 'TestProvider123!';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await users.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    console.log('✅ Password reset successfully!');
    console.log('📧 Email: testprovider@example.com');
    console.log('🔐 New Password:', newPassword);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

resetPassword();
