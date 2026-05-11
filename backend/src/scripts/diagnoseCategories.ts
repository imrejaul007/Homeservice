/**
 * Diagnostic script: Show current state of categories in the DB
 * Run with: npx ts-node src/scripts/diagnoseCategories.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function diagnose() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');
  const db = mongoose.connection.db!;

  // 1. ServiceCategory collection
  const dbCats = await db.collection('servicecategories').find({}, { projection: { name: 1, slug: 1, isFeatured: 1 } }).toArray();
  console.log('=== ServiceCategory collection (source of truth) ===');
  dbCats.forEach(c => console.log(`  ${c.name} | ${c.slug} | featured: ${c.isFeatured}`));

  // 2. Distinct category values in services
  const serviceCats = await db.collection('services').distinct('category');
  console.log('\n=== Distinct services.category values ===');
  serviceCats.forEach(c => console.log(`  ${JSON.stringify(c)}`));

  // 3. Distinct subcategory values in services
  const serviceSubcats = await db.collection('services').distinct('subcategory');
  console.log('\n=== Distinct services.subcategory values ===');
  serviceSubcats.forEach(c => console.log(`  ${JSON.stringify(c)}`));

  // 4. Count by category
  const catCounts = await db.collection('services').aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\n=== Service counts by category ===');
  catCounts.forEach(c => console.log(`  ${c._id} : ${c.count}`));

  // 5. Count by category+subcategory
  const subcatCounts = await db.collection('services').aggregate([
    { $group: { _id: { cat: '$category', subcat: '$subcategory' }, count: { $sum: 1 } } },
    { $sort: { '_id.cat': 1, count: -1 } }
  ]).toArray();
  console.log('\n=== Service counts by category + subcategory ===');
  subcatCounts.forEach(c => console.log(`  ${c._id.cat} / ${JSON.stringify(c._id.subcat)} : ${c.count}`));

  // 6. Provider profile distinct categories
  const providerCats = await db.collection('providerprofiles').distinct('services.category');
  console.log('\n=== Distinct providerprofiles.services.category ===');
  providerCats.forEach(c => console.log(`  ${JSON.stringify(c)}`));

  // 7. Provider profile distinct subcategories
  const providerSubcats = await db.collection('providerprofiles').distinct('services.subcategory');
  console.log('\n=== Distinct providerprofiles.services.subcategory ===');
  providerSubcats.forEach(c => console.log(`  ${JSON.stringify(c)}`));

  await mongoose.disconnect();
  console.log('\nDone.');
}

diagnose().catch(e => { console.error(e); process.exit(1); });
