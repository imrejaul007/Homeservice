import mongoose from 'mongoose';

async function check() {
  const uri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/test?appName=Cluster0';
  await mongoose.connect(uri, { maxPoolSize: 5 });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  console.log('Users:');
  const users = await db.collection('users').find({}).toArray();
  users.forEach(u => console.log(`  - ${u._id} | ${u.email} | ${u.role}`));

  console.log('\nProvider Profiles:');
  const profiles = await db.collection('providerprofiles').find({}).toArray();
  profiles.forEach(p => console.log(`  - ${p._id} | userId: ${p.userId}`));

  await mongoose.disconnect();
}

check().catch(err => { console.error(err); process.exit(1); });
