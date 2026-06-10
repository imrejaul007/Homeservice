import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
  await mongoose.connect(uri, { maxPoolSize: 5 });
  const db = mongoose.connection.db!;

  console.log('Reviews with reviewerType:');
  const reviews = await db.collection('reviews').find({}).toArray();
  reviews.forEach(r => {
    console.log(`  - ${r._id.toString().slice(-8)} reviewerType: "${r.reviewerType}" revieweeType: "${r.revieweeType}"`);
  });

  await mongoose.disconnect();
}

check().catch(err => { console.error(err); process.exit(1); });
