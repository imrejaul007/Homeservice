import mongoose from 'mongoose';

async function check() {
  const uri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/test?appName=Cluster0';
  await mongoose.connect(uri, { maxPoolSize: 5 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // Try to query the collection with the model
  console.log('Attempting to query providerads collection...');

  try {
    // Check if we can do a simple count
    const count = await db.collection('providerads').countDocuments();
    console.log('Document count:', count);

    // Try to insert a test document
    const testDoc = {
      name: 'Test Ad',
      providerId: new mongoose.Types.ObjectId('6a13ddce180760005bdb6e37'),
      status: 'draft',
      isActive: true,
      content: { title: 'Test', description: 'Test ad' },
      budget: { total: 100 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('providerads').insertOne(testDoc);
    console.log('Insert result:', result.insertedId);

    // Clean up
    await db.collection('providerads').deleteOne({ _id: result.insertedId });
    console.log('Cleaned up test document');

  } catch (error: any) {
    console.log('Error:', error.message);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

check().catch(err => { console.error(err); process.exit(1); });
