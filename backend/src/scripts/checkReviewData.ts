import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Debug: Check reviews data structure
 */

async function check() {
  const baseUri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/';
  const uri = `${baseUri}test?appName=Cluster0`;

  await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });

  const db = mongoose.connection.db!;

  console.log('='.repeat(60));
  console.log('Debug: Review Data Structure');
  console.log('='.repeat(60));
  console.log();

  // Check provider profile
  const profile = await db.collection('providerprofiles').findOne({});
  console.log('📋 Provider Profile:');
  console.log('   _id:', profile?._id);
  console.log('   userId:', profile?.userId);
  console.log('   userId type:', typeof profile?.userId);
  console.log();

  // Check reviews
  const reviews = await db.collection('reviews').find({}).toArray();
  console.log('📋 Reviews Collection:');
  console.log('   Count:', reviews.length);
  if (reviews.length > 0) {
    console.log('   Sample review:');
    console.log('   - _id:', reviews[0]._id);
    console.log('   - revieweeId:', reviews[0].revieweeId);
    console.log('   - revieweeId type:', typeof reviews[0].revieweeId);
    console.log('   - reviewerId:', reviews[0].reviewerId);
    console.log('   - reviewerId type:', typeof reviews[0].reviewerId);
  }
  console.log();

  // Check users
  const users = await db.collection('users').find({role: 'provider'}).toArray();
  console.log('📋 Provider Users:');
  console.log('   Count:', users.length);
  if (users.length > 0) {
    console.log('   Sample provider:');
    console.log('   - _id:', users[0]._id);
    console.log('   - _id type:', typeof users[0]._id);
    console.log('   - email:', users[0].email);
  }
  console.log();

  // Compare IDs
  if (profile?.userId && reviews.length > 0) {
    console.log('📋 ID Comparison:');
    console.log('   profile.userId:', profile.userId.toString());
    console.log('   review revieweeId:', reviews[0].revieweeId.toString());
    console.log('   Match:', profile.userId.toString() === reviews[0].revieweeId.toString());
  }

  // Check if review.revieweeId matches user._id or profile.userId
  if (reviews.length > 0 && users.length > 0) {
    console.log();
    console.log('📋 Matching Check:');
    console.log('   review.revieweeId == users[0]._id:',
      reviews[0].revieweeId.toString() === users[0]._id.toString());
    console.log('   profile.userId == review.revieweeId:',
      profile?.userId.toString() === reviews[0].revieweeId.toString());
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.');
}

check().catch(err => {
  console.error('❌ Error:', err);
  mongoose.disconnect();
  process.exit(1);
});
