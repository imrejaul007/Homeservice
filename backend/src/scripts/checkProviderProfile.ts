import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkProviderProfile() {
  const mongoUri = process.env.MONGODB_URI || '';
  await mongoose.connect(mongoUri);

  console.log('=== Checking Provider Profile ===\n');

  // Get all users with role 'provider'
  const providers = await User.find({ role: 'provider' }).lean();
  console.log('Providers:', providers.length);
  providers.forEach(p => {
    console.log(`  User ID: ${p._id}, Email: ${p.email}`);
  });

  // Get all provider profiles
  const profiles = await ProviderProfile.find({}).lean();
  console.log('\nProvider Profiles:', profiles.length);
  profiles.forEach(p => {
    console.log(`  Profile ID: ${p._id}`);
    console.log(`  User ID (ref): ${p.userId}`);
  });

  // Check if ProviderProfile.userId matches service.providerId
  console.log('\n=== Service Provider Link ===');
  if (providers.length > 0 && profiles.length > 0) {
    const providerUserId = providers[0]._id.toString();
    const profileUserId = profiles[0].userId?.toString() || 'NONE';

    console.log(`Service expects providerId: ${providerUserId}`);
    console.log(`ProviderProfile userId: ${profileUserId}`);
    console.log(`Match: ${providerUserId === profileUserId ? 'YES ✅' : 'NO ❌'}`);
  }

  await mongoose.disconnect();
}

checkProviderProfile().catch(console.error);
