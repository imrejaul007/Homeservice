/**
 * Script to debug the "No professionals available" issue
 * Checks the database for providers and verifies the aggregation pipeline
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function main() {
  console.log('='.repeat(70));
  console.log('DEBUGGING: Find Professional - "No professionals available"');
  console.log('='.repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\nConnected to MongoDB\n');

  // Check for Tenants
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({ name: String, slug: String }, { strict: false }));
  const tenants = await Tenant.find({}).lean();
  console.log('TENANTS:');
  console.log(`  Found ${tenants.length} tenants`);
  tenants.forEach(t => console.log(`    - ${t.name} (${t.slug}): ${t._id}`));

  // Default tenant ID (used by middleware if no tenant found)
  const defaultTenantId = '000000000000000000000000';

  // Check Users with role='provider'
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const providers = await User.find({ role: 'provider' }).lean();
  console.log('\nUSERS (role=provider):');
  console.log(`  Found ${providers.length} provider users`);
  if (providers.length > 0) {
    console.log('  Sample provider users:');
    providers.slice(0, 3).forEach(p => {
      console.log(`    - ${p.firstName} ${p.lastName} (${p.email})`);
      console.log(`      tenantId: ${p.tenantId || 'UNDEFINED/null'}`);
    });
  }

  // Check ProviderProfiles
  const ProviderProfile = mongoose.model('ProviderProfile', new mongoose.Schema({}, { strict: false }));
  const profiles = await ProviderProfile.find({}).lean();
  console.log('\nPROVIDER PROFILES:');
  console.log(`  Found ${profiles.length} provider profiles`);
  if (profiles.length > 0) {
    console.log('  Sample profiles:');
    profiles.slice(0, 3).forEach(p => {
      console.log(`    - ${p.businessInfo?.businessName || 'N/A'}`);
      console.log(`      tenantId: ${p.tenantId || 'UNDEFINED/null'}`);
      console.log(`      isActive: ${p.isActive}`);
      console.log(`      isDeleted: ${p.isDeleted}`);
      console.log(`      verificationStatus.overall: ${p.verificationStatus?.overall}`);
      console.log(`      userId: ${p.userId}`);
    });
  }

  // Check if tenantId matches
  console.log('\n' + '='.repeat(70));
  console.log('TENANT MATCHING ANALYSIS:');
  console.log('='.repeat(70));

  // Get the actual tenant ID from the database
  let actualTenantId = defaultTenantId;
  if (tenants.length > 0) {
    actualTenantId = tenants[0]._id.toString();
    console.log(`\n  Using tenant ID from DB: ${actualTenantId}`);
  }

  // Count profiles with matching tenantId
  const profilesWithTenant = profiles.filter(p => p.tenantId?.toString() === actualTenantId);
  const profilesWithoutTenant = profiles.filter(p => !p.tenantId);
  const profilesWithDefaultTenant = profiles.filter(p => p.tenantId?.toString() === defaultTenantId);

  console.log(`\n  Profiles matching actual tenant (${actualTenantId}): ${profilesWithTenant.length}`);
  console.log(`  Profiles with default tenant (${defaultTenantId}): ${profilesWithDefaultTenant.length}`);
  console.log(`  Profiles WITHOUT tenantId: ${profilesWithoutTenant.length}`);

  // Run the aggregation with the actual tenant ID
  console.log('\n' + '='.repeat(70));
  console.log('TESTING AGGREGATION PIPELINE:');
  console.log('='.repeat(70));

  try {
    const result = await ProviderProfile.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(actualTenantId),
          isActive: true,
          isDeleted: false,
          'verificationStatus.overall': 'approved',
        },
      },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          userId: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          businessName: '$businessInfo.businessName',
          tenantId: 1,
          isActive: 1,
          isDeleted: 1,
          verificationStatus: 1,
        },
      },
    ]);

    console.log(`\n  Aggregation result: ${result.length} providers found`);
    if (result.length === 0) {
      console.log('  ISSUE CONFIRMED: No providers match the aggregation criteria');
      console.log('  Possible causes:');
      console.log('    1. ProviderProfiles are missing tenantId');
      console.log('    2. tenantId in database does not match middleware tenant');
      console.log('    3. Providers are not verified (verificationStatus.overall != "approved")');
      console.log('    4. Providers are marked isActive=false or isDeleted=true');
    } else {
      console.log('  Sample results:');
      result.slice(0, 3).forEach(p => {
        console.log(`    - ${p.firstName} ${p.lastName} (${p.businessName})`);
      });
    }
  } catch (err) {
    console.log(`\n  Aggregation error: ${err.message}`);
  }

  // Test with no tenantId filter
  console.log('\n  Testing aggregation WITHOUT tenantId filter:');
  try {
    const resultNoTenant = await ProviderProfile.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
          'verificationStatus.overall': 'approved',
        },
      },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          businessName: '$businessInfo.businessName',
          tenantId: 1,
          isActive: 1,
          isDeleted: 1,
          verificationStatus: 1,
        },
      },
    ]);

    console.log(`    Result: ${resultNoTenant.length} providers found`);
  } catch (err) {
    console.log(`    Error: ${err.message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(70));

  if (profilesWithoutTenant.length > 0) {
    console.log('\n  1. FIX: Update seeder to set tenantId on ProviderProfiles');
    console.log(`     Run this migration to fix existing data:`);
    console.log(`     await ProviderProfile.updateMany({ tenantId: { $exists: false } }, { $set: { tenantId: new mongoose.Types.ObjectId("${actualTenantId}") } })`);
  }

  if (profilesWithTenant.length === 0 && profiles.length > 0) {
    console.log('\n  2. FIX: Tenant ID mismatch between middleware and database');
    console.log('     The middleware uses tenantId from Tenant collection, but seeder does not set it.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('SCRIPT COMPLETE');
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
