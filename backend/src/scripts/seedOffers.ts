import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Coupon from '../models/coupon.model';
import User from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seedOffers() {
  const mongoUri = process.env.MONGODB_URI || '';
  console.log('🔧 Seeding offers...\n');

  await mongoose.connect(mongoUri);

  // Find admin user for createdBy field
  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    console.log('❌ No admin user found. Creating with system ID...');
  }
  const createdBy = adminUser?._id || new mongoose.Types.ObjectId();

  const offers = [
    {
      title: 'First Booking 20% Off',
      displayTitle: 'First Booking 20% Off',
      displaySubtitle: 'Use code NILIN20 on your first service',
      displayGradient: 'from-nilin-rose to-nilin-coral',
      displayBadge: 'New',
      description: 'Get 20% off your first booking with code NILIN20',
      code: 'NILIN20',
      type: 'percentage',
      value: 20,
      maxDiscount: 100,
      minOrderValue: 0,
      maxUses: 1000,
      currentUses: 0,
      isActive: true,
      featured: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      createdBy,
    },
    {
      title: 'Weekend Spa Special',
      displayTitle: 'Weekend Spa Special',
      displaySubtitle: 'Swedish & Deep Tissue from AED 199',
      displayGradient: 'from-nilin-charcoal to-gray-700',
      displayBadge: 'Limited Time',
      description: 'Swedish & Deep Tissue massage from just AED 199',
      code: 'SPAWEEKEND',
      type: 'fixed',
      value: 199,
      maxDiscount: 0,
      minOrderValue: 199,
      maxUses: 500,
      currentUses: 0,
      isActive: true,
      featured: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      createdBy,
    },
    {
      title: 'Bridal Glow Package',
      displayTitle: 'Bridal Glow Package',
      displaySubtitle: 'Complete bridal beauty from AED 1,499',
      displayGradient: 'from-nilin-blush to-nilin-rose',
      displayBadge: 'Popular',
      description: 'Complete bridal beauty package starting from AED 1,499',
      code: 'BRIDAL',
      type: 'fixed',
      value: 1499,
      maxDiscount: 0,
      minOrderValue: 1499,
      maxUses: 200,
      currentUses: 0,
      isActive: true,
      featured: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      createdBy,
    },
    {
      title: 'Summer Sale 15% Off',
      displayTitle: 'Summer Sale 15% Off',
      displaySubtitle: 'Use code SUMMER15 for 15% off',
      displayGradient: 'from-yellow-400 to-orange-500',
      displayBadge: 'Hot',
      description: 'Get 15% off all services this summer',
      code: 'SUMMER15',
      type: 'percentage',
      value: 15,
      maxDiscount: 75,
      minOrderValue: 50,
      maxUses: 1000,
      currentUses: 0,
      isActive: true,
      featured: true,
      validFrom: new Date('2026-05-01'),
      validUntil: new Date('2026-08-31'),
      createdBy,
    },
    {
      title: 'Refer a Friend',
      displayTitle: 'Refer a Friend',
      displaySubtitle: 'Give AED 25, Get AED 25',
      displayGradient: 'from-green-400 to-teal-500',
      displayBadge: 'Popular',
      description: 'Refer a friend and both get AED 25 credit',
      code: 'REFER25',
      type: 'fixed',
      value: 25,
      maxDiscount: 0,
      minOrderValue: 100,
      maxUses: 5000,
      currentUses: 0,
      isActive: true,
      featured: false,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      createdBy,
    },
  ];

  // Delete existing offers
  await Coupon.deleteMany({});
  console.log('Cleared existing offers');

  // Insert new offers
  const result = await Coupon.insertMany(offers);
  console.log(`\n✅ Created ${result.length} offers`);

  result.forEach(offer => {
    console.log(`  - ${offer.displayTitle} (${offer.code})`);
  });

  await mongoose.disconnect();
  console.log('\n✨ Done!');
}

seedOffers().catch(console.error);
