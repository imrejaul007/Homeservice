/**
 * Migration Script: Add tenantId to existing provider data
 *
 * This script adds tenantId to:
 * - ProviderProfiles without tenantId
 * - Users with role='provider' without tenantId
 * - Services without tenantId
 *
 * Usage: npx ts-node src/scripts/migrate-add-tenant-id.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Default tenant ID
const DEFAULT_TENANT_ID = '6a212f330d27419f416e6be3';

async function migrate() {
  console.log('='.repeat(60));
  console.log('MIGRATION: Add tenantId to existing provider data');
  console.log('='.repeat(60));
  console.log();

  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  const tenantObjectId = new mongoose.Types.ObjectId(DEFAULT_TENANT_ID);

  // 1. Migrate ProviderProfiles
  console.log('1. Migrating ProviderProfiles...');
  const providerProfilesResult = await mongoose.connection.collection('providerprofiles').updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: tenantObjectId } }
  );
  console.log(`   Updated ${providerProfilesResult.modifiedCount} ProviderProfiles`);

  // 2. Migrate Users (providers)
  console.log('2. Migrating User accounts (providers)...');
  const usersResult = await mongoose.connection.collection('users').updateMany(
    { role: 'provider', tenantId: { $exists: false } },
    { $set: { tenantId: tenantObjectId } }
  );
  console.log(`   Updated ${usersResult.modifiedCount} provider users`);

  // 3. Migrate Services
  console.log('3. Migrating Services...');
  const servicesResult = await mongoose.connection.collection('services').updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: tenantObjectId } }
  );
  console.log(`   Updated ${servicesResult.modifiedCount} services`);

  // 4. Verify the migration
  console.log('\n4. Verifying migration...');

  const providersWithTenant = await mongoose.connection.collection('providerprofiles').countDocuments({ tenantId: tenantObjectId });
  console.log(`   ProviderProfiles with tenantId: ${providersWithTenant}`);

  const providersWithoutTenant = await mongoose.connection.collection('providerprofiles').countDocuments({ tenantId: { $exists: false } });
  console.log(`   ProviderProfiles without tenantId: ${providersWithoutTenant}`);

  // Show sample provider
  const sampleProvider = await mongoose.connection.collection('providerprofiles').findOne({ tenantId: tenantObjectId });
  if (sampleProvider) {
    console.log('\n5. Sample ProviderProfile after migration:');
    console.log(`   _id: ${sampleProvider._id}`);
    console.log(`   tier: ${sampleProvider.tier}`);
    console.log(`   isActive: ${sampleProvider.isActive}`);
    console.log(`   tenantId: ${sampleProvider.tenantId}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log('\nNow re-run the seed: npm run db:seed:recommended');
  console.log('Or refresh the Find Professional modal.');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
