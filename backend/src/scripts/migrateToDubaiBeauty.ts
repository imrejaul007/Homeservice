/**
 * Migration: Dubai Beauty & Wellness Platform Pivot
 *
 * This script:
 * 1. Marks 5 non-Beauty categories as comingSoon
 * 2. Replaces Beauty & Wellness subcategories with 8 new ones
 * 3. Deletes all existing services
 * 4. Seeds 24 new dummy services (3 per subcategory)
 * 5. Updates all provider profiles to Beauty & Wellness / Dubai / AED
 * 6. Deletes all old bookings
 *
 * Run with: npx ts-node src/scripts/migrateToDubaiBeauty.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');
  const db = mongoose.connection.db!;

  // ============================================================
  // STEP 1: Mark non-Beauty categories as comingSoon
  // ============================================================
  console.log('=== Step 1: Marking non-Beauty categories as comingSoon ===');

  const markComingSoon = await db.collection('servicecategories').updateMany(
    { slug: { $ne: 'beauty-wellness' } },
    { $set: { comingSoon: true } }
  );
  console.log(`  Marked ${markComingSoon.modifiedCount} categories as comingSoon`);

  const markActive = await db.collection('servicecategories').updateOne(
    { slug: 'beauty-wellness' },
    { $set: { comingSoon: false } }
  );
  console.log(`  Marked Beauty & Wellness as active (matched: ${markActive.matchedCount})`);

  // ============================================================
  // STEP 2: Replace Beauty & Wellness subcategories
  // ============================================================
  console.log('\n=== Step 2: Replacing Beauty & Wellness subcategories ===');

  const newSubcategories = [
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Hair',
      slug: 'hair',
      description: 'Professional hair styling, coloring, and treatment services',
      icon: '💇',
      isActive: true,
      sortOrder: 1,
      metadata: { averagePrice: 150, averageDuration: 60, popularTimes: ['morning', 'afternoon'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Nails',
      slug: 'nails',
      description: 'Manicure, pedicure, and nail art services',
      icon: '💅',
      isActive: true,
      sortOrder: 2,
      metadata: { averagePrice: 80, averageDuration: 45, popularTimes: ['morning', 'afternoon'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Massage',
      slug: 'massage',
      description: 'Relaxing and therapeutic massage treatments',
      icon: '💆',
      isActive: true,
      sortOrder: 3,
      metadata: { averagePrice: 250, averageDuration: 60, popularTimes: ['afternoon', 'evening'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Makeup',
      slug: 'makeup',
      description: 'Professional makeup for events, parties, and everyday looks',
      icon: '💄',
      isActive: true,
      sortOrder: 4,
      metadata: { averagePrice: 200, averageDuration: 60, popularTimes: ['morning', 'afternoon'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Waxing',
      slug: 'waxing',
      description: 'Full body and targeted waxing services',
      icon: '✨',
      isActive: true,
      sortOrder: 5,
      metadata: { averagePrice: 120, averageDuration: 40, popularTimes: ['morning', 'afternoon'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Facial',
      slug: 'facial',
      description: 'Deep cleansing, anti-aging, and hydrating facial treatments',
      icon: '🧖',
      isActive: true,
      sortOrder: 6,
      metadata: { averagePrice: 180, averageDuration: 60, popularTimes: ['morning', 'afternoon'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Eyes',
      slug: 'eyes',
      description: 'Lash extensions, lash lifts, brow shaping, and tinting',
      icon: '👁️',
      isActive: true,
      sortOrder: 7,
      metadata: { averagePrice: 130, averageDuration: 45, popularTimes: ['morning', 'afternoon'] }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Threading',
      slug: 'threading',
      description: 'Precise facial threading for eyebrows, upper lip, and full face',
      icon: '🧵',
      isActive: true,
      sortOrder: 8,
      metadata: { averagePrice: 40, averageDuration: 15, popularTimes: ['morning', 'afternoon'] }
    }
  ];

  const updateSubs = await db.collection('servicecategories').updateOne(
    { slug: 'beauty-wellness' },
    { $set: { subcategories: newSubcategories } }
  );
  console.log(`  Updated subcategories (matched: ${updateSubs.matchedCount}, modified: ${updateSubs.modifiedCount})`);

  // ============================================================
  // STEP 3: Delete ALL existing services
  // ============================================================
  console.log('\n=== Step 3: Deleting all existing services ===');

  const deleteServices = await db.collection('services').deleteMany({});
  console.log(`  Deleted ${deleteServices.deletedCount} services`);

  // ============================================================
  // STEP 4: Seed new dummy services (3 per subcategory = 24)
  // ============================================================
  console.log('\n=== Step 4: Seeding new Beauty & Wellness services ===');

  const dubaiLocation = {
    address: {
      street: 'Dubai Marina',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '00000',
      country: 'AE'
    },
    coordinates: {
      type: 'Point',
      coordinates: [55.2708, 25.2048] // [lng, lat]
    },
    serviceArea: {
      type: 'city',
      value: 'Dubai',
      maxDistance: 25
    }
  };

  const defaultAvailability = {
    schedule: {
      monday: { isAvailable: true, timeSlots: ['09:00-12:00', '13:00-18:00'] },
      tuesday: { isAvailable: true, timeSlots: ['09:00-12:00', '13:00-18:00'] },
      wednesday: { isAvailable: true, timeSlots: ['09:00-12:00', '13:00-18:00'] },
      thursday: { isAvailable: true, timeSlots: ['09:00-12:00', '13:00-18:00'] },
      friday: { isAvailable: true, timeSlots: ['09:00-12:00', '13:00-18:00'] },
      saturday: { isAvailable: true, timeSlots: ['10:00-16:00'] },
      sunday: { isAvailable: false, timeSlots: [] }
    },
    exceptions: [],
    bufferTime: 15,
    instantBooking: false,
    advanceBookingDays: 30
  };


  const serviceData = [
    // Hair
    { name: 'Blowout & Styling', subcategory: 'Hair', price: 120, duration: 45, description: 'Professional blowout and styling for a polished, salon-fresh look. Includes wash and conditioning treatment.', tags: ['blowout', 'styling', 'hair'] },
    { name: 'Hair Coloring', subcategory: 'Hair', price: 350, duration: 120, description: 'Full hair coloring service using premium products. Includes consultation, application, and finishing style.', tags: ['color', 'dye', 'hair'] },
    { name: 'Keratin Treatment', subcategory: 'Hair', price: 500, duration: 180, description: 'Smoothing keratin treatment for frizz-free, silky hair lasting up to 3 months.', tags: ['keratin', 'smoothing', 'treatment'] },
    // Nails
    { name: 'Gel Manicure', subcategory: 'Nails', price: 80, duration: 45, description: 'Long-lasting gel manicure with cuticle care, nail shaping, and your choice of color.', tags: ['gel', 'manicure', 'nails'] },
    { name: 'Classic Pedicure', subcategory: 'Nails', price: 90, duration: 50, description: 'Relaxing pedicure with foot soak, exfoliation, nail shaping, and polish application.', tags: ['pedicure', 'classic', 'nails'] },
    { name: 'Nail Art', subcategory: 'Nails', price: 120, duration: 60, description: 'Custom nail art designs including hand-painted details, gems, and creative patterns.', tags: ['nail-art', 'design', 'nails'] },
    // Massage
    { name: 'Swedish Massage', subcategory: 'Massage', price: 250, duration: 60, description: 'Classic relaxation massage with long flowing strokes to relieve tension and promote well-being.', tags: ['swedish', 'relaxation', 'massage'] },
    { name: 'Deep Tissue Massage', subcategory: 'Massage', price: 300, duration: 60, description: 'Targeted deep tissue massage to release chronic muscle tension and knots.', tags: ['deep-tissue', 'therapeutic', 'massage'] },
    { name: 'Hot Stone Massage', subcategory: 'Massage', price: 350, duration: 75, description: 'Heated basalt stones combined with massage techniques for deep relaxation and muscle relief.', tags: ['hot-stone', 'relaxation', 'massage'] },
    // Makeup
    { name: 'Party Makeup', subcategory: 'Makeup', price: 200, duration: 60, description: 'Glamorous party-ready makeup look for special occasions and events.', tags: ['party', 'glam', 'makeup'] },
    { name: 'Bridal Makeup', subcategory: 'Makeup', price: 800, duration: 120, description: 'Complete bridal makeup package including trial session, day-of application, and touch-up kit.', tags: ['bridal', 'wedding', 'makeup'] },
    { name: 'Natural Glow Makeup', subcategory: 'Makeup', price: 150, duration: 45, description: 'Subtle, natural-looking makeup that enhances your features for everyday beauty.', tags: ['natural', 'everyday', 'makeup'] },
    // Waxing
    { name: 'Full Body Wax', subcategory: 'Waxing', price: 250, duration: 90, description: 'Complete full body waxing service for smooth, hair-free skin from head to toe.', tags: ['full-body', 'wax', 'waxing'] },
    { name: 'Brazilian Wax', subcategory: 'Waxing', price: 120, duration: 30, description: 'Professional Brazilian waxing using gentle, high-quality wax for sensitive areas.', tags: ['brazilian', 'wax', 'waxing'] },
    { name: 'Arms & Legs Wax', subcategory: 'Waxing', price: 100, duration: 45, description: 'Full arms and legs waxing for smooth, silky skin lasting weeks.', tags: ['arms', 'legs', 'waxing'] },
    // Facial
    { name: 'Deep Cleansing Facial', subcategory: 'Facial', price: 180, duration: 60, description: 'Thorough deep cleansing facial to purify pores, remove impurities, and refresh your skin.', tags: ['deep-cleansing', 'purifying', 'facial'] },
    { name: 'Anti-Aging Facial', subcategory: 'Facial', price: 300, duration: 75, description: 'Advanced anti-aging facial treatment with collagen-boosting serums and firming techniques.', tags: ['anti-aging', 'collagen', 'facial'] },
    { name: 'Hydrating Facial', subcategory: 'Facial', price: 200, duration: 60, description: 'Intensive hydration facial to restore moisture balance and give you a dewy, radiant glow.', tags: ['hydrating', 'moisturizing', 'facial'] },
    // Eyes
    { name: 'Lash Extensions', subcategory: 'Eyes', price: 200, duration: 90, description: 'Individual lash extensions for a fuller, longer lash look. Classic or volume options available.', tags: ['lash-extensions', 'lashes', 'eyes'] },
    { name: 'Lash Lift & Tint', subcategory: 'Eyes', price: 150, duration: 60, description: 'Natural lash lift with tint for beautifully curled and defined lashes without extensions.', tags: ['lash-lift', 'tint', 'eyes'] },
    { name: 'Brow Shaping', subcategory: 'Eyes', price: 50, duration: 20, description: 'Expert eyebrow shaping and grooming to frame your face perfectly.', tags: ['brow', 'shaping', 'eyes'] },
    // Threading
    { name: 'Full Face Threading', subcategory: 'Threading', price: 60, duration: 20, description: 'Complete facial threading including eyebrows, upper lip, chin, and sideburns.', tags: ['full-face', 'threading'] },
    { name: 'Eyebrow Threading', subcategory: 'Threading', price: 30, duration: 10, description: 'Precise eyebrow threading for clean, well-defined brows.', tags: ['eyebrow', 'threading'] },
    { name: 'Upper Lip Threading', subcategory: 'Threading', price: 20, duration: 5, description: 'Quick and gentle upper lip threading for smooth, hair-free skin.', tags: ['upper-lip', 'threading'] },
  ];

  const serviceDocs = serviceData.map(s => ({
    providerId: new mongoose.Types.ObjectId(),
    name: s.name,
    category: 'Beauty & Wellness',
    subcategory: s.subcategory,
    description: s.description,
    shortDescription: s.description.substring(0, 100),
    price: {
      amount: s.price,
      currency: 'AED',
      type: 'fixed'
    },
    duration: s.duration,
    images: [],
    tags: s.tags,
    requirements: [],
    includedItems: [],
    addOns: [],
    location: dubaiLocation,
    availability: defaultAvailability,
    rating: {
      average: +(4.0 + Math.random() * 1.0).toFixed(1),
      count: Math.floor(10 + Math.random() * 90),
      distribution: { 5: 40, 4: 30, 3: 15, 2: 10, 1: 5 }
    },
    searchMetadata: {
      searchCount: Math.floor(Math.random() * 100),
      clickCount: Math.floor(Math.random() * 50),
      bookingCount: Math.floor(Math.random() * 30),
      popularityScore: Math.floor(Math.random() * 500),
      searchKeywords: [s.name.toLowerCase(), s.subcategory.toLowerCase(), 'beauty', 'wellness', ...s.tags]
    },
    isActive: true,
    isFeatured: Math.random() > 0.7,
    isPopular: Math.random() > 0.5,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  const insertResult = await db.collection('services').insertMany(serviceDocs);
  console.log(`  Inserted ${insertResult.insertedCount} services`);

  // ============================================================
  // STEP 5: Update all provider profiles
  // ============================================================
  console.log('\n=== Step 5: Updating provider profiles to Dubai/AED ===');

  const providers = await db.collection('providerprofiles').find({}).toArray();
  console.log(`  Found ${providers.length} provider profiles`);

  for (const provider of providers) {
    await db.collection('providerprofiles').updateOne(
      { _id: provider._id },
      {
        $set: {
          'locationInfo.primaryAddress.city': 'Dubai',
          'locationInfo.primaryAddress.state': 'Dubai',
          'locationInfo.primaryAddress.country': 'AE',
          'locationInfo.primaryAddress.zipCode': '00000',
          'locationInfo.primaryAddress.coordinates': { lat: 25.2048, lng: 55.2708 },
          'services': provider.services?.map((svc: any) => ({
            ...svc,
            category: 'Beauty & Wellness',
            price: {
              ...svc.price,
              currency: 'AED'
            }
          })) || []
        }
      }
    );
  }
  console.log(`  Updated ${providers.length} provider profiles`);

  // ============================================================
  // STEP 6: Delete all old bookings
  // ============================================================
  console.log('\n=== Step 6: Deleting all old bookings ===');

  const deleteBookings = await db.collection('bookings').deleteMany({});
  console.log(`  Deleted ${deleteBookings.deletedCount} bookings`);

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n=== Migration Complete ===');
  console.log('  - 5 categories marked as comingSoon');
  console.log('  - Beauty & Wellness subcategories replaced with 8 new ones');
  console.log(`  - ${insertResult.insertedCount} new services seeded`);
  console.log(`  - ${providers.length} provider profiles updated to Dubai/AED`);
  console.log('  - All old bookings deleted');
  console.log('\nDone!');

  await mongoose.disconnect();
}

migrate().catch(e => { console.error(e); process.exit(1); });
