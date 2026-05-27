import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function check() {
  const uri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/test?appName=Cluster0';
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
