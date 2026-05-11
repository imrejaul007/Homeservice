/**
 * Cleanup Script: Fix Orphaned Category Data
 *
 * Fixes services and provider profiles that reference legacy/incorrect
 * category or subcategory names after the single-source-of-truth migration.
 *
 * Run with: npx ts-node src/scripts/cleanupOrphanedCategories.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';

dotenv.config();

const VALID_CATEGORIES = [
  'Beauty & Wellness',
  'Fitness & Personal Health',
  'Mobile Medical Care',
  'Education & Personal Development',
  'Corporate Services',
  'Home & Maintenance',
];

// Known subcategory fixes
const SUBCATEGORY_FIXES: Record<string, { category: string; subcategory: string }> = {
  'Interior': { category: 'Home & Maintenance', subcategory: 'Cleaning' },
  'Hair Services': { category: 'Beauty & Wellness', subcategory: 'Hair' },
  'Makeup & Beauty': { category: 'Beauty & Wellness', subcategory: 'Makeup' },
};

// Legacy category → NILIN category mapping
const CATEGORY_FIXES: Record<string, string> = {
  'Home Services': 'Home & Maintenance',
  'Cleaning': 'Home & Maintenance',
  'Home Repair': 'Home & Maintenance',
  'Plumbing': 'Home & Maintenance',
  'Electrical': 'Home & Maintenance',
  'Painting': 'Home & Maintenance',
  'Landscaping': 'Home & Maintenance',
  'Beauty': 'Beauty & Wellness',
  'Fitness': 'Fitness & Personal Health',
  'Tutoring': 'Education & Personal Development',
  'Technology': 'Corporate Services',
  'Pet Care': 'Home & Maintenance',
  'Moving': 'Home & Maintenance',
  'Assembly': 'Home & Maintenance',
  'Automotive': 'Home & Maintenance',
};

async function cleanupOrphanedCategories() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI or MONGO_URI found in environment');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');

  let totalFixed = 0;

  // 1. Fix services with undefined/null/missing subcategory
  console.log('=== Fixing services with undefined subcategory ===');
  // Match services where subcategory exists but is null/undefined, or equals the string "undefined"
  const undefinedSubcatServices = await Service.find({
    $or: [
      { subcategory: 'undefined' },
      { subcategory: null },
      { subcategory: { $exists: false } },
    ]
  });
  for (const svc of undefinedSubcatServices) {
    console.log(`  [FIX] Service "${svc.name}" (${svc._id}): subcategory ${JSON.stringify(svc.subcategory)} → unset`);
    await Service.updateOne({ _id: svc._id }, { $unset: { subcategory: '' } });
    totalFixed++;
  }

  // 2. Fix services with legacy subcategory names
  console.log('\n=== Fixing services with legacy subcategory names ===');
  for (const [oldSubcat, fix] of Object.entries(SUBCATEGORY_FIXES)) {
    const services = await Service.find({ subcategory: oldSubcat });
    for (const svc of services) {
      console.log(`  [FIX] Service "${svc.name}" (${svc._id}): subcategory "${oldSubcat}" → "${fix.subcategory}"`);
      svc.subcategory = fix.subcategory;
      if (!VALID_CATEGORIES.includes(svc.category)) {
        console.log(`    Also fixing category "${svc.category}" → "${fix.category}"`);
        svc.category = fix.category;
      }
      await svc.save();
      totalFixed++;
    }
  }

  // 3. Fix services with legacy category names
  console.log('\n=== Fixing services with legacy category names ===');
  for (const [oldCat, newCat] of Object.entries(CATEGORY_FIXES)) {
    const services = await Service.find({ category: oldCat });
    for (const svc of services) {
      console.log(`  [FIX] Service "${svc.name}" (${svc._id}): category "${oldCat}" → "${newCat}"`);
      svc.category = newCat;
      await svc.save();
      totalFixed++;
    }
  }

  // 4. Fix provider profiles with legacy category references
  console.log('\n=== Fixing provider profiles with legacy categories ===');
  for (const [oldCat, newCat] of Object.entries(CATEGORY_FIXES)) {
    const providers = await ProviderProfile.find({ 'services.category': oldCat });
    for (const provider of providers) {
      let changed = false;
      for (const svc of (provider as any).services || []) {
        if (svc.category === oldCat) {
          console.log(`  [FIX] Provider ${provider._id}: service category "${oldCat}" → "${newCat}"`);
          svc.category = newCat;
          changed = true;
        }
      }
      if (changed) {
        await provider.save();
        totalFixed++;
      }
    }
  }

  // 5. Fix provider profiles with legacy subcategory references
  console.log('\n=== Fixing provider profiles with legacy subcategories ===');
  const PROVIDER_SUBCAT_FIXES: Record<string, string> = {
    'Hair Services': 'Hair',
    'Makeup & Beauty': 'Makeup',
    'Interior': 'Cleaning',
  };
  for (const [oldSubcat, newSubcat] of Object.entries(PROVIDER_SUBCAT_FIXES)) {
    const providers = await ProviderProfile.find({ 'services.subcategory': oldSubcat });
    for (const provider of providers) {
      let changed = false;
      for (const svc of (provider as any).services || []) {
        if (svc.subcategory === oldSubcat) {
          console.log(`  [FIX] Provider ${provider._id}: subcategory "${oldSubcat}" → "${newSubcat}"`);
          svc.subcategory = newSubcat;
          changed = true;
        }
      }
      if (changed) {
        await provider.save();
        totalFixed++;
      }
    }
  }

  // 6. Report any remaining mismatches
  console.log('\n=== Checking for remaining mismatches ===');
  const allServices = await Service.find({
    category: { $nin: VALID_CATEGORIES }
  }).select('name category subcategory _id');

  if (allServices.length > 0) {
    console.log(`  WARNING: ${allServices.length} services still have invalid categories:`);
    for (const svc of allServices) {
      console.log(`    - "${svc.name}" (${svc._id}): category="${svc.category}", subcategory="${svc.subcategory}"`);
    }
  } else {
    console.log('  All services have valid NILIN categories.');
  }

  // Verify against DB categories
  const dbCategories = await ServiceCategory.find({}).select('name');
  const dbCategoryNames = dbCategories.map((c: any) => c.name);
  console.log(`\n  DB ServiceCategory collection has: ${dbCategoryNames.join(', ')}`);

  console.log(`\n=== Done. Total fixes applied: ${totalFixed} ===`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

cleanupOrphanedCategories().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
