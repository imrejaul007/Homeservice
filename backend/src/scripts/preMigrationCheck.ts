/**
 * Pre-Migration Check: Validates database state before running migrateToDubaiBeauty.ts
 * Run with: npx ts-node src/scripts/preMigrationCheck.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');
  const db = mongoose.connection.db!;

  let issues = 0;

  // ============================================================
  // CHECK 1: servicecategories collection exists and has data
  // ============================================================
  console.log('=== CHECK 1: Service Categories ===');
  const categories = await db.collection('servicecategories').find({}).toArray();
  console.log(`  Total categories: ${categories.length}`);

  if (categories.length === 0) {
    console.log('  ❌ ISSUE: No categories found! Migration step 1 will have no effect.');
    issues++;
  } else {
    // Check for beauty-wellness slug
    const beautyCategory = categories.find(c => c.slug === 'beauty-wellness');
    if (!beautyCategory) {
      console.log('  ❌ ISSUE: No category with slug "beauty-wellness" found!');
      console.log('  Available slugs:', categories.map(c => c.slug).join(', '));
      issues++;
    } else {
      console.log(`  ✅ beauty-wellness category found (id: ${beautyCategory._id})`);
      console.log(`     Name: "${beautyCategory.name}"`);
      console.log(`     Current subcategories: ${beautyCategory.subcategories?.length || 0}`);
      if (beautyCategory.subcategories?.length > 0) {
        console.log('     Subcategory names:', beautyCategory.subcategories.map((s: any) => s.name).join(', '));
      }
      console.log(`     comingSoon field exists: ${beautyCategory.comingSoon !== undefined}`);
    }

    // List all categories
    console.log('\n  All categories:');
    for (const cat of categories) {
      console.log(`    - "${cat.name}" (slug: ${cat.slug}, comingSoon: ${cat.comingSoon ?? 'not set'})`);
    }

    const nonBeauty = categories.filter(c => c.slug !== 'beauty-wellness');
    console.log(`\n  Non-beauty categories to be marked comingSoon: ${nonBeauty.length}`);
  }

  // ============================================================
  // CHECK 2: services collection
  // ============================================================
  console.log('\n=== CHECK 2: Services ===');
  const serviceCount = await db.collection('services').countDocuments();
  console.log(`  Total services: ${serviceCount}`);
  if (serviceCount > 0) {
    console.log(`  ⚠️  All ${serviceCount} services will be DELETED by migration step 3`);

    // Sample categories of existing services
    const serviceCats = await db.collection('services').distinct('category');
    console.log('  Existing service categories:', serviceCats.join(', '));

    // Sample currencies
    const currencies = await db.collection('services').distinct('price.currency');
    console.log('  Existing currencies:', currencies.join(', '));
  } else {
    console.log('  ℹ️  No services exist (step 3 delete will be a no-op, step 4 will seed 24 new ones)');
  }

  // ============================================================
  // CHECK 3: providerprofiles collection
  // ============================================================
  console.log('\n=== CHECK 3: Provider Profiles ===');
  const providerCount = await db.collection('providerprofiles').countDocuments();
  console.log(`  Total provider profiles: ${providerCount}`);
  if (providerCount > 0) {
    console.log(`  ⚠️  All ${providerCount} profiles will be updated (location → Dubai, currency → AED)`);

    // Check current locations
    const cities = await db.collection('providerprofiles').distinct('locationInfo.primaryAddress.city');
    console.log('  Current cities:', cities.join(', ') || '(none set)');

    const countries = await db.collection('providerprofiles').distinct('locationInfo.primaryAddress.country');
    console.log('  Current countries:', countries.join(', ') || '(none set)');

    // Check if providers have services array
    const withServices = await db.collection('providerprofiles').countDocuments({ 'services.0': { $exists: true } });
    console.log(`  Providers with services array: ${withServices}`);
  } else {
    console.log('  ℹ️  No provider profiles found (step 5 will be a no-op)');
  }

  // ============================================================
  // CHECK 4: bookings collection
  // ============================================================
  console.log('\n=== CHECK 4: Bookings ===');
  const bookingCount = await db.collection('bookings').countDocuments();
  console.log(`  Total bookings: ${bookingCount}`);
  if (bookingCount > 0) {
    console.log(`  ⚠️  All ${bookingCount} bookings will be DELETED by migration step 6`);

    const statuses = await db.collection('bookings').distinct('status');
    console.log('  Booking statuses:', statuses.join(', '));
  } else {
    console.log('  ℹ️  No bookings exist (step 6 delete will be a no-op)');
  }

  // ============================================================
  // CHECK 5: Verify collection names match what migration expects
  // ============================================================
  console.log('\n=== CHECK 5: Collection Names ===');
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  const expectedCollections = ['servicecategories', 'services', 'providerprofiles', 'bookings'];
  for (const expected of expectedCollections) {
    if (collectionNames.includes(expected)) {
      console.log(`  ✅ "${expected}" collection exists`);
    } else {
      console.log(`  ❌ ISSUE: "${expected}" collection NOT found!`);
      issues++;
    }
  }

  // ============================================================
  // CHECK 6: Index check on services (for performance)
  // ============================================================
  console.log('\n=== CHECK 6: Services Indexes ===');
  try {
    const indexes = await db.collection('services').indexes();
    console.log(`  ${indexes.length} indexes on services collection`);
    for (const idx of indexes) {
      console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`);
    }
  } catch {
    console.log('  ℹ️  Could not read indexes (collection may not exist yet)');
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(50));
  if (issues === 0) {
    console.log('✅ PRE-MIGRATION CHECK PASSED — Safe to run migration');
  } else {
    console.log(`❌ ${issues} ISSUE(S) FOUND — Review above before running migration`);
  }
  console.log('='.repeat(50));

  await mongoose.disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
