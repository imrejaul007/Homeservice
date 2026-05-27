import mongoose from 'mongoose';

async function check() {
  const uri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/test?appName=Cluster0';
  await mongoose.connect(uri, { maxPoolSize: 5 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // Check if there are any ads
  const adsCount = await db.collection('providerads').countDocuments();
  console.log('Total ads:', adsCount);

  // Check ads for test provider
  const userId = '6a13ddce180760005bdb6e37';
  const oid = new mongoose.Types.ObjectId(userId);
  const testProviderAds = await db.collection('providerads').find({ providerId: oid }).toArray();
  console.log('Ads for test provider:', testProviderAds.length);

  // Check schema
  const sampleAd = await db.collection('providerads').findOne({});
  if (sampleAd) {
    console.log('Sample ad providerId type:', typeof sampleAd.providerId);
    console.log('Sample ad providerId:', sampleAd.providerId);
  } else {
    console.log('No ads found in collection');
  }

  await mongoose.disconnect();
}

check().catch(err => { console.error(err); process.exit(1); });
