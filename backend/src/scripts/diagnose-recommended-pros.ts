/**
 * Diagnostic Script: Check Find Professional API
 *
 * Tests the actual aggregation and checks what's needed
 *
 * Usage: npx ts-node src/scripts/diagnose-recommended-pros.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function diagnose() {
  console.log('='.repeat(60));
  console.log('DIAGNOSTIC: Find Professional API');
  console.log('='.repeat(60));
  console.log();

  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  const db = mongoose.connection.db!;
  const tenantObjectId = new mongoose.Types.ObjectId('6a212f330d27419f416e6be3');

  // 1. Check tenants
  console.log('1. TENANTS');
  const tenants = await db.collection('tenants').find({}).toArray();
  console.log(`   Found ${tenants.length} tenant(s)`);
  tenants.forEach(t => console.log(`   - ${t.name}: ${t._id}`));
  console.log();

  // 2. Check users with role=provider
  console.log('2. PROVIDER USERS');
  const providerUsers = await db.collection('users').find({ role: 'provider' }).toArray();
  console.log(`   Found ${providerUsers.length} provider user(s)`);
  const withTenant = providerUsers.filter(u => u.tenantId);
  console.log(`   With tenantId: ${withTenant.length}`);
  console.log(`   Without tenantId: ${providerUsers.length - withTenant.length}`);
  console.log();

  // 3. Check provider profiles
  console.log('3. PROVIDER PROFILES');
  const allProfiles = await db.collection('providerprofiles').find({}).toArray();
  console.log(`   Total profiles: ${allProfiles.length}`);

  const profilesWithTenant = await db.collection('providerprofiles').find({ tenantId: tenantObjectId }).toArray();
  console.log(`   With correct tenantId: ${profilesWithTenant.length}`);

  const approvedProfiles = profilesWithTenant.filter(p =>
    p.isActive && !p.isDeleted && p.verificationStatus?.overall === 'approved'
  );
  console.log(`   Approved & active: ${approvedProfiles.length}`);
  console.log();

  // 4. Check services
  console.log('4. SERVICES');
  const servicesWithTenant = await db.collection('services').find({ tenantId: tenantObjectId }).toArray();
  console.log(`   Services with tenantId: ${servicesWithTenant.length}`);

  const activeServices = servicesWithTenant.filter(s => s.isActive);
  console.log(`   Active services: ${activeServices.length}`);
  console.log();

  // 5. Run the actual aggregation
  console.log('5. AGGREGATION TEST');
  try {
    const aggregation = await db.collection('providerprofiles').aggregate([
      { $match: { tenantId: tenantObjectId, isActive: true, isDeleted: false, 'verificationStatus.overall': 'approved' } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $match: { userId: { $exists: true, $ne: null } } },
      { $unwind: '$user' },
      { $lookup: {
        from: 'services',
        let: { providerId: '$userId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$providerId', '$$providerId'] }, isActive: true } },
          { $limit: 5 }
        ],
        as: 'servicesData'
      }},
      { $lookup: {
        from: 'reviews',
        let: { providerId: '$userId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$revieweeId', '$$providerId'] }, tenantId: tenantObjectId } },
          { $group: { _id: null, averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
        ],
        as: 'reviewsData'
      }},
      { $unwind: { path: '$reviewsData', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 1,
        tier: 1,
        'user.firstName': 1,
        'user.lastName': 1,
        servicesCount: { $size: '$servicesData' },
        averageRating: { $ifNull: ['$reviewsData.averageRating', 0] },
        totalReviews: { $ifNull: ['$reviewsData.totalReviews', 0] },
      }},
      { $limit: 10 }
    ]).toArray();

    console.log(`   Aggregation returned ${aggregation.length} provider(s)`);
    aggregation.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.user?.firstName || 'N/A'} ${p.user?.lastName || ''} (${p.tier})`);
      console.log(`      - Services: ${p.servicesCount}`);
      console.log(`      - Rating: ${p.averageRating?.toFixed(1) || 'N/A'} (${p.totalReviews} reviews)`);
    });
  } catch (err) {
    console.log(`   ERROR: ${err instanceof Error ? err.message : err}`);
  }
  console.log();

  // 6. Check if customer exists for testing
  console.log('6. CUSTOMER (for testing)');
  const customers = await db.collection('users').find({ role: 'customer' }).limit(3).toArray();
  console.log(`   Found ${customers.length} customer(s)`);
  customers.slice(0, 1).forEach(c => {
    console.log(`   - ${c.firstName} ${c.lastName}: ${c.email}`);
    console.log(`     tenantId: ${c.tenantId || 'MISSING'}`);
  });
  console.log();

  // 7. Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const issues: string[] = [];

  if (tenants.length === 0) issues.push('No tenants found');
  if (providerUsers.length === 0) issues.push('No provider users');
  if (withTenant.length !== providerUsers.length) issues.push('Some provider users missing tenantId');
  if (profilesWithTenant.length === 0) issues.push('No provider profiles with tenantId');
  if (approvedProfiles.length === 0) issues.push('No approved provider profiles');
  if (activeServices.length === 0) issues.push('No active services');

  if (issues.length === 0) {
    console.log('✅ All checks passed!');
    console.log('   Find Professional should work if:');
    console.log('   - User is authenticated');
    console.log('   - User has valid tenantId in request');
    console.log('   - Backend API is running');
  } else {
    console.log('❌ Issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
}

diagnose().catch((err) => {
  console.error('\n❌ Diagnostic failed:', err);
  process.exit(1);
});
