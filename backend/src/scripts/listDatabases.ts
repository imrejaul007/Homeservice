import mongoose from 'mongoose';

/**
 * List all databases on the MongoDB cluster
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx ts-node scripts/listDatabases.ts
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  console.error('   Usage: MONGODB_URI="mongodb+srv://..." npx ts-node scripts/listDatabases.ts');
  process.exit(1);
}

async function listDatabases() {
  console.log('='.repeat(60));
  console.log('List Databases on MongoDB Cluster');
  console.log('='.repeat(60));
  console.log();

  try {
    // Extract base URI from the full connection string (remove database name)
    const baseUri = MONGODB_URI!.replace(/\/[^/]+\?/, '/');

    // Connect without specifying a database
    await mongoose.connect(baseUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB');
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    console.log();

    // List databases
    const adminDb = mongoose.connection.db!.admin();
    const result = await adminDb.listDatabases();

    console.log('📦 Databases on this cluster:');
    console.log();

    for (const db of result.databases) {
      const sizeInMB = db.sizeOnDisk ? (db.sizeOnDisk / (1024 * 1024)).toFixed(2) : '0.00';
      console.log(`  📁 ${db.name} (${sizeInMB} MB)`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done.');

  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

listDatabases();
