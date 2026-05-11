import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import database from '../config/database';

/**
 * Migration: Remap services from old "Beauty & Wellness" parent category
 * to new top-level beauty categories (Hair, Makeup, Nails, etc.)
 *
 * Also archives non-beauty services (Fitness, Medical, etc.)
 */

// Old subcategory name → new top-level category name
const SUBCATEGORY_TO_CATEGORY_MAP: Record<string, string> = {
  'Hair': 'Hair',
  'Makeup': 'Makeup',
  'Nails': 'Nails',
  'Skin & Aesthetics': 'Skin & Aesthetics',
  'Massage & Body Treatment': 'Massage & Body',
  'Personal Care': 'Personal Care',
  // Additional mappings for old subcategory names found in existing data
  'Massage': 'Massage & Body',
  'Facial': 'Skin & Aesthetics',
  'Waxing': 'Personal Care',
  'Threading': 'Personal Care',
  'Eyes': 'Personal Care',
};

const NON_BEAUTY_CATEGORIES = [
  'Fitness & Personal Health',
  'Mobile Medical Care',
  'Education & Personal Development',
  'Corporate Services',
  'Home & Maintenance',
];

async function migrate() {
  await database.connect();
  console.log('Connected to database. Starting category migration...\n');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not available');
  }

  const servicesCollection = db.collection('services');
  const providerProfilesCollection = db.collection('providerprofiles');

  let migratedCount = 0;
  let archivedCount = 0;
  let unmatchedCount = 0;
  let providerUpdatedCount = 0;

  // ─── 1. Remap Beauty & Wellness services ───────────────────────
  console.log('=== Step 1: Remap Beauty & Wellness services ===');

  for (const [oldSubcategory, newCategory] of Object.entries(SUBCATEGORY_TO_CATEGORY_MAP)) {
    const result = await servicesCollection.updateMany(
      { category: 'Beauty & Wellness', subcategory: oldSubcategory },
      {
        $set: {
          category: newCategory,
          subcategory: '',
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`  Remapped ${result.modifiedCount} services: "${oldSubcategory}" → "${newCategory}"`);
      migratedCount += result.modifiedCount;
    }
  }

  // Check for any Beauty & Wellness services that didn't match a subcategory mapping
  const unmatchedBeauty = await servicesCollection
    .find({ category: 'Beauty & Wellness' })
    .toArray();

  if (unmatchedBeauty.length > 0) {
    console.log(`\n  ⚠ ${unmatchedBeauty.length} Beauty & Wellness services with unrecognized subcategories:`);
    for (const svc of unmatchedBeauty) {
      console.log(`    - "${svc.name}" (subcategory: "${svc.subcategory}", id: ${svc._id})`);
    }
    unmatchedCount += unmatchedBeauty.length;
  }

  // ─── 2. Archive non-beauty services ────────────────────────────
  console.log('\n=== Step 2: Archive non-beauty services ===');

  for (const category of NON_BEAUTY_CATEGORIES) {
    const result = await servicesCollection.updateMany(
      { category },
      {
        $set: {
          isActive: false,
          status: 'archived',
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`  Archived ${result.modifiedCount} "${category}" services`);
      archivedCount += result.modifiedCount;
    }
  }

  // ─── 3. Remap ProviderProfile.services[] embedded array ────────
  console.log('\n=== Step 3: Remap ProviderProfile.services[] ===');

  for (const [oldSubcategory, newCategory] of Object.entries(SUBCATEGORY_TO_CATEGORY_MAP)) {
    const result = await providerProfilesCollection.updateMany(
      { 'services.category': 'Beauty & Wellness', 'services.subcategory': oldSubcategory },
      {
        $set: {
          'services.$[elem].category': newCategory,
          'services.$[elem].subcategory': '',
        },
      },
      {
        arrayFilters: [
          {
            'elem.category': 'Beauty & Wellness',
            'elem.subcategory': oldSubcategory,
          },
        ],
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`  Updated ${result.modifiedCount} provider profiles: "${oldSubcategory}" → "${newCategory}"`);
      providerUpdatedCount += result.modifiedCount;
    }
  }

  // Also handle provider services that only have category "Beauty & Wellness" without subcategory
  const fallbackResult = await providerProfilesCollection.updateMany(
    { 'services.category': 'Beauty & Wellness' },
    {
      $set: {
        'services.$[elem].category': 'Hair',
        'services.$[elem].subcategory': '',
      },
    },
    {
      arrayFilters: [{ 'elem.category': 'Beauty & Wellness' }],
    }
  );
  if (fallbackResult.modifiedCount > 0) {
    console.log(`  Fallback: updated ${fallbackResult.modifiedCount} remaining B&W provider services → "Hair"`);
    providerUpdatedCount += fallbackResult.modifiedCount;
  }

  // ─── Summary ───────────────────────────────────────────────────
  console.log('\n=== Migration Summary ===');
  console.log(`  Services remapped:       ${migratedCount}`);
  console.log(`  Services archived:       ${archivedCount}`);
  console.log(`  Unmatched (needs manual): ${unmatchedCount}`);
  console.log(`  Provider profiles updated: ${providerUpdatedCount}`);
  console.log('\nMigration complete.');
}

// Run if called directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrate;
