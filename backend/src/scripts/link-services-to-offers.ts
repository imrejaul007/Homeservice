/**
 * Script: Link Services to All Offers
 *
 * Links services to all active offers so they appear on the offer detail page.
 *
 * Run: cd backend && npx ts-node src/scripts/link-services-to-offers.ts
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('./dist/models/coupon.model').default;
const Service = require('./dist/models/service.model').default;

async function linkServicesToOffers() {
  console.log('🔗 Linking Services to Offers...\n');

  await mongoose.connect(process.env.MONGODB_URI);

  // Get all active services
  const services = await Service.find({
    status: 'active',
    isDeleted: { $ne: true }
  }).lean();

  if (services.length === 0) {
    console.log('❌ No active services found!');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${services.length} active services\n`);

  // Get all offers
  const offers = await Coupon.find({});
  console.log(`Processing ${offers.length} offers...\n`);

  for (const offer of offers) {
    const o = offer as any;
    console.log(`📦 ${o.displayTitle || o.title} (${o.code})`);

    // Check if already has targetServices
    const hasTargetServices = o.targetServices && o.targetServices.length > 0;
    const hasApplicableServices = o.applicableServices && o.applicableServices.length > 0;

    if (hasTargetServices || hasApplicableServices) {
      console.log(`   ✅ Already has links: targetServices=${o.targetServices?.length || 0}, applicableServices=${o.applicableServices?.length || 0}`);
    } else {
      // Link first 5 services to this offer
      const serviceIds = services.slice(0, 5).map((s: any) => s._id);
      o.targetServices = serviceIds;
      await o.save();
      console.log(`   🔗 Linked ${serviceIds.length} services`);
    }
  }

  // Clear any cached offer data
  console.log('\n🗑️ Note: Restart backend server to clear offer cache');

  await mongoose.disconnect();
  console.log('\n✨ Done! All offers now have linked services.\n');
}

linkServicesToOffers().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
