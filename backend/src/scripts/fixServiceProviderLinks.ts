/**
 * Fix Service Provider Links Script
 * Updates services to have correct providerId matching actual provider user IDs
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/user.model';
import Service from '../models/service.model';

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('🔧 Fixing Service Provider Links...\n');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // Get all providers
  const providers = await User.find({ role: 'provider' }).lean();
  console.log(`Found ${providers.length} providers\n`);

  // Get all services
  const services = await Service.find({}).lean();
  console.log(`Found ${services.length} services\n`);

  // Create a map of provider emails to their IDs
  const providerEmailToId: Record<string, string> = {};
  for (const provider of providers) {
    providerEmailToId[provider.email.toLowerCase()] = provider._id.toString();
    console.log(`${provider.email} -> ${provider._id}`);
  }
  console.log();

  // Find services with wrong providerId
  let fixedCount = 0;
  for (const service of services) {
    const currentProviderId = service.providerId.toString();
    const serviceProviderEmail = (service as any).providerEmail;

    if (serviceProviderEmail) {
      const correctProviderId = providerEmailToId[serviceProviderEmail.toLowerCase()];
      if (correctProviderId && currentProviderId !== correctProviderId) {
        console.log(`Updating service "${service.name}":`);
        console.log(`  Old providerId: ${currentProviderId}`);
        console.log(`  New providerId: ${correctProviderId}`);

        await Service.updateOne(
          { _id: service._id },
          { $set: { providerId: new mongoose.Types.ObjectId(correctProviderId) } }
        );
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    console.log(`\n✅ Fixed ${fixedCount} services!\n`);
  } else {
    console.log('\nNo services needed fixing based on providerEmail field.\n');

    // Alternative: If there's only one provider, link all services to them
    if (providers.length === 1 && services.length > 0) {
      const singleProviderId = providers[0]._id.toString();
      console.log(`Only one provider found. Linking all ${services.length} services to this provider...`);

      const result = await Service.updateMany(
        {},
        { $set: { providerId: new mongoose.Types.ObjectId(singleProviderId) } }
      );

      console.log(`Updated ${result.modifiedCount} services to provider: ${providers[0].email}`);
    }
  }

  // Verify the fix
  console.log('\n📋 Verification:');
  const updatedServices = await Service.find({}).populate('providerId', 'email').lean();
  for (const service of updatedServices) {
    const providerEmail = (service.providerId as any)?.email || 'UNKNOWN';
    console.log(`  "${service.name}" -> ${providerEmail}`);
  }

  await mongoose.disconnect();
  console.log('\n✨ Done!');
}

main().catch(console.error);
