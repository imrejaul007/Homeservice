/**
 * Link Services to Providers Script
 * Fixes the issue where services exist but aren't shown under providers in admin
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('🔗 Linking Services to Providers...\n');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // Get all users with role 'provider'
  const providers = await User.find({ role: 'provider' }).lean();
  console.log(`Found ${providers.length} providers\n`);

  // Get all services
  const services = await Service.find({}).lean();
  console.log(`Found ${services.length} total services\n`);

  // Group services by providerId
  const servicesByProvider: Record<string, number> = {};
  for (const service of services) {
    const pid = service.providerId.toString();
    servicesByProvider[pid] = (servicesByProvider[pid] || 0) + 1;
  }

  console.log('Services by Provider ID:');
  for (const [pid, count] of Object.entries(servicesByProvider)) {
    console.log(`  ${pid}: ${count} services`);
  }
  console.log();

  // Check which providers have ProviderProfile
  for (const provider of providers) {
    const profile = await ProviderProfile.findOne({ userId: provider._id });
    const pid = provider._id.toString();
    const serviceCount = servicesByProvider[pid] || 0;

    console.log(`${provider.firstName} ${provider.lastName} (${provider.email}):`);
    console.log(`  User ID: ${pid}`);
    console.log(`  ProviderProfile: ${profile ? 'Yes' : 'No'}`);
    console.log(`  Services: ${serviceCount}`);

    if (!profile) {
      console.log(`  ⚠️  WARNING: No ProviderProfile found!`);
    }
    if (serviceCount === 0) {
      console.log(`  ⚠️  WARNING: No services linked!`);
    }
    console.log();
  }

  // Summary
  const providersWithServices = await Service.distinct('providerId');
  console.log(`\n📊 Summary:`);
  console.log(`  Total providers: ${providers.length}`);
  console.log(`  Providers with services: ${providersWithServices.length}`);
  console.log(`  Total services: ${services.length}`);

  // Check if services have providerId that matches any provider
  const providerIds = providers.map(p => p._id.toString());
  const orphanedServices = services.filter(s => !providerIds.includes(s.providerId.toString()));

  if (orphanedServices.length > 0) {
    console.log(`\n⚠️  ${orphanedServices.length} services have providerId not matching any provider!`);
    console.log('These services will not appear in the admin dashboard.');
  }

  await mongoose.disconnect();
  console.log('\n✨ Done!');
}

main().catch(console.error);
