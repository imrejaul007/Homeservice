/**
 * Migration Script: Fix Category and Subcategory Names
 *
 * This script fixes services that have incorrect category/subcategory names
 * by mapping them to the correct database values.
 *
 * Run with: npx ts-node src/scripts/migrateCategoryNames.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';

dotenv.config();

// Mapping of incorrect category names to correct ones
const CATEGORY_MAPPING: Record<string, string> = {
  // Old frontend constants → Correct database names
  'beauty': 'Beauty & Wellness',
  'fitness': 'Fitness & Personal Health',
  'cleaning': 'Home & Maintenance',
  'home repair': 'Home & Maintenance',
  'plumbing': 'Home & Maintenance',
  'electrical': 'Home & Maintenance',
  'painting': 'Home & Maintenance',
  'landscaping': 'Home & Maintenance',
  'tutoring': 'Education & Personal Development',
  'pet care': 'Home & Maintenance',
  'moving': 'Home & Maintenance',
  'assembly': 'Home & Maintenance',
  'technology': 'Home & Maintenance',
  'automotive': 'Home & Maintenance',
};

// Mapping of incorrect subcategory names to correct ones
const SUBCATEGORY_MAPPING: Record<string, string> = {
  'hair services': 'Hair',
  'makeup & beauty': 'Makeup',
  'skin care': 'Skin & Aesthetics',
  'skincare': 'Skin & Aesthetics',
  'deep cleaning': 'Cleaning',
  'regular cleaning': 'Cleaning',
  'personal training': 'Personal Training',
  'group classes': 'Group Classes',
};

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
}

async function migrateCategories() {
  console.log('\n=== Starting Category Migration ===\n');

  // Get all valid categories from database for reference
  const validCategories = await ServiceCategory.find({ isActive: true }).lean();
  console.log('Valid categories in database:');
  validCategories.forEach((cat: any) => {
    console.log(`  - ${cat.name}`);
    (cat.subcategories || []).forEach((sub: any) => {
      if (sub.isActive !== false) {
        console.log(`      - ${sub.name}`);
      }
    });
  });

  console.log('\n--- Migrating Categories ---\n');

  // Migrate category names
  for (const [oldCat, newCat] of Object.entries(CATEGORY_MAPPING)) {
    const result = await Service.updateMany(
      { category: { $regex: new RegExp(`^${oldCat}$`, 'i') } },
      { $set: { category: newCat } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Migrated ${result.modifiedCount} services: "${oldCat}" → "${newCat}"`);
    }
  }

  console.log('\n--- Migrating Subcategories ---\n');

  // Migrate subcategory names
  for (const [oldSub, newSub] of Object.entries(SUBCATEGORY_MAPPING)) {
    const result = await Service.updateMany(
      { subcategory: { $regex: new RegExp(`^${oldSub}$`, 'i') } },
      { $set: { subcategory: newSub } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Migrated ${result.modifiedCount} services: "${oldSub}" → "${newSub}"`);
    }
  }

  console.log('\n--- Checking for remaining invalid categories ---\n');

  // Find any services with categories that don't match database
  const validCategoryNames = validCategories.map((cat: any) => cat.name);
  const servicesWithInvalidCategory = await Service.find({
    category: { $nin: validCategoryNames }
  }).select('_id name category subcategory').lean();

  if (servicesWithInvalidCategory.length > 0) {
    console.log(`⚠️  Found ${servicesWithInvalidCategory.length} services with invalid categories:`);
    servicesWithInvalidCategory.forEach((s: any) => {
      console.log(`   - "${s.name}" has category "${s.category}"`);
    });
    console.log('\nPlease add mappings for these categories and run again.');
  } else {
    console.log('✅ All services have valid categories!');
  }

  console.log('\n=== Migration Complete ===\n');
}

async function main() {
  try {
    await connectDB();
    await migrateCategories();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
