/**
 * Migration Script: Fix Offer Service Links
 *
 * This script:
 * 1. Ensures all active offers have valid service/category links
 * 2. Adds default services to offers that have no links (if services exist)
 * 3. Validates that linked services/categories still exist
 * 4. Cleans up invalid links
 *
 * Run: cd backend && npx ts-node src/scripts/migrate-offer-services.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Coupon from '../models/coupon.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function migrateOfferServices() {
  const mongoUri = process.env.MONGODB_URI || '';
  console.log('🔧 Starting Offer Service Migration...\n');
  console.log('═'.repeat(60));

  await mongoose.connect(mongoUri);

  // Get all services and categories for reference
  const services = await Service.find({ status: 'active', isDeleted: false })
    .select('_id name category')
    .lean();

  const categories = await ServiceCategory.find({})
    .select('_id name')
    .lean();

  console.log(`\n📊 Found ${services.length} active services`);
  console.log(`📊 Found ${categories.length} categories\n`);

  // Get all offers
  const offers = await Coupon.find({});
  console.log(`📊 Found ${offers.length} offers to analyze\n`);

  let fixedOffers = 0;
  let cleanedOffers = 0;

  for (const offer of offers) {
    const o = offer as any;
    console.log(`\n📦 Processing: ${o.displayTitle || o.title} (${o.code})`);

    // 1. Check for invalid service links
    const validServiceIds = new Set(services.map((s: any) => s._id.toString()));
    const validCategoryIds = new Set(categories.map((c: any) => c._id.toString()));

    // Clean up targetServices
    if (o.targetServices && o.targetServices.length > 0) {
      const invalidServices = o.targetServices.filter((sId: any) => !validServiceIds.has(sId.toString()));
      if (invalidServices.length > 0) {
        console.log(`  ⚠️ Removing ${invalidServices.length} invalid service links`);
        o.targetServices = o.targetServices.filter((sId: any) => validServiceIds.has(sId.toString()));
        await o.save();
        cleanedOffers++;
      }
    }

    // Clean up targetCategories
    if (o.targetCategories && o.targetCategories.length > 0) {
      const invalidCategories = o.targetCategories.filter((cId: any) => !validCategoryIds.has(cId.toString()));
      if (invalidCategories.length > 0) {
        console.log(`  ⚠️ Removing ${invalidCategories.length} invalid category links`);
        o.targetCategories = o.targetCategories.filter((cId: any) => validCategoryIds.has(cId.toString()));
        await o.save();
        cleanedOffers++;
      }
    }

    // 2. Handle offers without any links
    const hasTargetServices = o.targetServices && o.targetServices.length > 0;
    const hasTargetCategories = o.targetCategories && o.targetCategories.length > 0;
    const hasApplicableServices = o.applicableServices && o.applicableServices.length > 0;
    const hasApplicableCategories = o.applicableCategories && o.applicableCategories.length > 0;

    if (!hasTargetServices && !hasTargetCategories && !hasApplicableServices && !hasApplicableCategories) {
      console.log(`  ⚠️ No service/category links found`);

      // If this is a general offer (like "Summer Sale"), link some default services
      // or categories based on offer type
      if (services.length > 0) {
        // Option 1: Link all services to the offer (for general offers)
        const shouldLinkAll = o.code === 'SUMMER15' || o.code === 'NILIN20' || o.code === 'REFER25';

        if (shouldLinkAll) {
          console.log(`  🔧 Linking first 5 services as default...`);
          const defaultServiceIds = services.slice(0, 5).map((s: any) => s._id);
          o.targetServices = defaultServiceIds;
          await o.save();
          fixedOffers++;
          console.log(`  ✅ Linked ${defaultServiceIds.length} services`);
        } else {
          // Option 2: Link a category
          if (categories.length > 0) {
            console.log(`  🔧 Linking first category as default...`);
            o.targetCategories = [categories[0]._id];
            await o.save();
            fixedOffers++;
            console.log(`  ✅ Linked category: ${categories[0].name}`);
          }
        }
      }
    } else {
      console.log(`  ✅ Has valid links`);
      if (hasTargetServices) console.log(`     - targetServices: ${o.targetServices.length}`);
      if (hasTargetCategories) console.log(`     - targetCategories: ${o.targetCategories.length}`);
      if (hasApplicableServices) console.log(`     - applicableServices: ${o.applicableServices.length}`);
      if (hasApplicableCategories) console.log(`     - applicableCategories: ${o.applicableCategories.length}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Migration Summary\n');
  console.log(`  Fixed (added links): ${fixedOffers}`);
  console.log(`  Cleaned (removed invalid): ${cleanedOffers}`);

  // Invalidate offer cache
  console.log('\n🗑️ Note: Please restart backend server to clear offer cache');

  await mongoose.disconnect();
  console.log('\n✨ Migration complete!\n');
}

// Run migration
migrateOfferServices().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
