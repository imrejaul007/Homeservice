import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Fix: Update reviews to have correct customer (reviewer) IDs
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/fixReviewData.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/fixReviewData.ts');
  process.exit(1);
}

async function fix() {
  await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5 });
  const db = mongoose.connection.db!;

  console.log('='.repeat(60));
  console.log('Fix: Update reviews with correct reviewer IDs');
  console.log('='.repeat(60));
  console.log();

  // Get the provider
  const provider = await db.collection('users').findOne({ role: 'provider', email: 'provider@nilin.com' });
  console.log('📋 Provider:', provider?._id.toString());
  console.log();

  // Check current reviews
  const reviews = await db.collection('reviews').find({}).toArray();
  console.log('📋 Current reviews:', reviews.length);
  reviews.forEach(r => {
    console.log(`   - ${r._id.toString().slice(-8)} reviewerId: ${r.reviewerId.toString().slice(-8)} (${r.reviewerId.toString() === provider?._id.toString() ? 'WRONG - same as provider' : 'OK'})`);
  });
  console.log();

  // Create proper customer users
  const customers = [
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@test.com' },
    { firstName: 'Mike', lastName: 'Chen', email: 'mike.chen@test.com' },
    { firstName: 'Emily', lastName: 'Davis', email: 'emily.davis@test.com' },
    { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@test.com' },
    { firstName: 'Lisa', lastName: 'Brown', email: 'lisa.brown@test.com' },
  ];

  console.log('📋 Creating proper customer users...');
  const customerIds: string[] = [];

  for (const cust of customers) {
    let user = await db.collection('users').findOne({ email: cust.email });
    if (!user) {
      const result = await db.collection('users').insertOne({
        _id: new mongoose.Types.ObjectId(),
        email: cust.email,
        firstName: cust.firstName,
        lastName: cust.lastName,
        role: 'customer',
        accountStatus: 'active',
        createdAt: new Date()
      });
      user = { _id: result.insertedId };
    }
    customerIds.push(user._id.toString());
    console.log(`   ✅ ${cust.firstName} ${cust.lastName}: ${user._id.toString().slice(-8)}`);
  }
  console.log();

  // Update reviews with correct reviewerId
  console.log('📋 Updating reviews with correct reviewer IDs...');
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    const newReviewerId = customerIds[i % customerIds.length];

    await db.collection('reviews').updateOne(
      { _id: review._id },
      { $set: { reviewerId: new mongoose.Types.ObjectId(newReviewerId) } }
    );

    console.log(`   ✅ Updated review ${review._id.toString().slice(-8)}: reviewerId -> ${newReviewerId.slice(-8)}`);
  }
  console.log();

  // Also update the recentReviews in provider profile
  console.log('📋 Updating provider profile recentReviews...');
  const providerProfile = await db.collection('providerprofiles').findOne({ userId: provider?._id });

  if (providerProfile?.reviewsData?.recentReviews) {
    const updatedRecentReviews = providerProfile.reviewsData.recentReviews.map((r: any, i: number) => ({
      ...r,
      customerId: new mongoose.Types.ObjectId(customerIds[i % customerIds.length])
    }));

    await db.collection('providerprofiles').updateOne(
      { _id: providerProfile._id },
      { $set: { 'reviewsData.recentReviews': updatedRecentReviews } }
    );
    console.log(`   ✅ Updated ${updatedRecentReviews.length} recentReviews`);
  }
  console.log();

  // Verify the fix
  console.log('='.repeat(60));
  console.log('Verification');
  console.log('='.repeat(60));

  const updatedReviews = await db.collection('reviews').find({}).toArray();
  console.log('📋 Updated reviews:');
  for (const r of updatedReviews) {
    const user = await db.collection('users').findOne({ _id: r.reviewerId });
    console.log(`   - ${r.title}: ${user?.firstName} ${user?.lastName} (${user?.email})`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

fix().catch(err => {
  console.error('❌ Error:', err);
  mongoose.disconnect();
  process.exit(1);
});
