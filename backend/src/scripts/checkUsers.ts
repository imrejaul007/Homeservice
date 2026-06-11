import mongoose from 'mongoose';

/**
 * Check Users Script
 * Lists all users and provider profiles in the database
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkUsers.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/checkUsers.ts');
  process.exit(1);
}

async function check() {
  await mongoose.connect(MONGODB_URI!, { maxPoolSize: 5 });
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
