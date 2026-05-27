import mongoose from 'mongoose';

/**
 * List all databases on the MongoDB cluster
 */

async function listDatabases() {
  console.log('='.repeat(60));
  console.log('List Databases on MongoDB Cluster');
  console.log('='.repeat(60));
  console.log();

  const baseUri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/';

  try {
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
