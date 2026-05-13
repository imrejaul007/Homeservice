import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Coupon from '../models/coupon.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkAndFixOffers() {
  const mongoUri = process.env.MONGODB_URI || '';
  console.log('🔍 Checking offers...\n');

  await mongoose.connect(mongoUri);

  // Find all offers
  const offers = await Coupon.find({}).lean();
  console.log(`Total offers: ${offers.length}\n`);

  // Group by code to find duplicates
  const codeGroups: Record<string, typeof offers> = {};
  offers.forEach(offer => {
    const code = (offer as any).code;
    if (!codeGroups[code]) codeGroups[code] = [];
    codeGroups[code].push(offer);
  });

  // Check for duplicates
  let hasDuplicates = false;
  Object.entries(codeGroups).forEach(([code, group]) => {
    if (group.length > 1) {
      hasDuplicates = true;
      console.log(`⚠️ Duplicate code "${code}": ${group.length} offers`);
      group.forEach((o, i) => {
        console.log(`  ${i + 1}. ${(o as any).title} (${(o as any)._id})`);
      });
    }
  });

  if (hasDuplicates) {
    console.log('\n🔧 Removing duplicates...');
    // Keep the first one, remove others
    Object.entries(codeGroups).forEach(([code, group]) => {
      if (group.length > 1) {
        const toDelete = group.slice(1).map(o => (o as any)._id);
        console.log(`  Deleting ${toDelete.length} duplicates for "${code}"`);
        Coupon.deleteMany({ _id: { $in: toDelete } });
      }
    });
  }

  // Show all offers
  console.log('\n📋 All offers:');
  const remainingOffers = await Coupon.find({}).lean();
  remainingOffers.forEach((offer: any, i) => {
    console.log(`  ${i + 1}. ${offer.displayTitle || offer.title} (${offer.code}) - ${offer.type}: ${offer.value}`);
  });

  await mongoose.disconnect();
  console.log('\n✨ Done!');
}

checkAndFixOffers().catch(console.error);
