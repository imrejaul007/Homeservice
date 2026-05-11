/**
 * Reset Providers: Clean all old providers and create fresh Beauty & Wellness providers
 * Run with: npx ts-node src/scripts/resetProviders.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function reset() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.error('No MONGODB_URI'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');
  const db = mongoose.connection.db!;

  // ============================================================
  // STEP 1: Delete all old provider data
  // ============================================================
  console.log('=== Step 1: Cleaning up old provider data ===');

  const delProfiles = await db.collection('providerprofiles').deleteMany({});
  console.log(`  Deleted ${delProfiles.deletedCount} provider profiles`);

  const delProviderUsers = await db.collection('users').deleteMany({ role: 'provider' });
  console.log(`  Deleted ${delProviderUsers.deletedCount} provider users`);

  const delServices = await db.collection('services').deleteMany({});
  console.log(`  Deleted ${delServices.deletedCount} services`);

  const delBookings = await db.collection('bookings').deleteMany({});
  console.log(`  Deleted ${delBookings.deletedCount} bookings`);

  // ============================================================
  // STEP 2: Create 3 new provider users
  // ============================================================
  console.log('\n=== Step 2: Creating provider users ===');

  const passwordHash = await bcrypt.hash('Provider@123', 10);

  const providerUsersData = [
    { firstName: 'Sara', lastName: 'Al Maktoum', email: 'sara@nilin.ae', phone: '+971501234567' },
    { firstName: 'Fatima', lastName: 'Hassan', email: 'fatima@nilin.ae', phone: '+971502345678' },
    { firstName: 'Layla', lastName: 'Ahmed', email: 'layla@nilin.ae', phone: '+971503456789' },
  ];

  const createdUsers: any[] = [];
  for (const pu of providerUsersData) {
    const userId = new mongoose.Types.ObjectId();
    await db.collection('users').insertOne({
      _id: userId,
      firstName: pu.firstName,
      lastName: pu.lastName,
      email: pu.email,
      phone: pu.phone,
      password: passwordHash,
      role: 'provider',
      accountStatus: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      isDeleted: false,
      address: {
        street: 'Dubai Marina',
        city: 'Dubai',
        state: 'Dubai',
        country: 'AE',
        zipCode: '00000',
        coordinates: { lat: 25.2048, lng: 55.2708 }
      },
      communicationPreferences: {
        email: { marketing: false, bookingUpdates: true, reminders: true, newsletters: false, promotions: false },
        sms: { bookingUpdates: true, reminders: true, promotions: false },
        push: { bookingUpdates: true, reminders: true, newMessages: true, promotions: false },
        language: 'en',
        timezone: 'Asia/Dubai',
        currency: 'AED'
      },
      loyaltySystem: { coins: 0, tier: 'bronze', streakDays: 0, totalEarned: 0, totalSpent: 0 },
      tokenVersion: 1,
      loginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdUsers.push({ _id: userId, ...pu });
    console.log(`  Created user: ${pu.firstName} ${pu.lastName} (${userId})`);
  }

  // ============================================================
  // STEP 3: Get Beauty & Wellness subcategories
  // ============================================================
  console.log('\n=== Step 3: Fetching subcategories ===');
  const bwCat = await db.collection('servicecategories').findOne({ slug: 'beauty-wellness' });
  if (!bwCat) {
    console.error('  ERROR: beauty-wellness category not found!');
    await mongoose.disconnect();
    process.exit(1);
  }
  const subcategories = bwCat.subcategories || [];
  console.log(`  Found ${subcategories.length} subcategories: ${subcategories.map((s: any) => s.name).join(', ')}`);

  // ============================================================
  // STEP 4: Define services per subcategory
  // ============================================================
  const serviceData = [
    // Hair
    { name: 'Blowout & Styling', subcategory: 'Hair', price: 120, duration: 45, description: 'Professional blowout and styling for a polished, salon-fresh look. Includes wash and conditioning treatment.' },
    { name: 'Hair Coloring', subcategory: 'Hair', price: 350, duration: 120, description: 'Full hair coloring service using premium products. Includes consultation, application, and finishing style.' },
    { name: 'Keratin Treatment', subcategory: 'Hair', price: 500, duration: 180, description: 'Smoothing keratin treatment for frizz-free, silky hair lasting up to 3 months.' },
    // Nails
    { name: 'Gel Manicure', subcategory: 'Nails', price: 80, duration: 45, description: 'Long-lasting gel manicure with cuticle care, nail shaping, and your choice of color.' },
    { name: 'Classic Pedicure', subcategory: 'Nails', price: 90, duration: 50, description: 'Relaxing pedicure with foot soak, exfoliation, nail shaping, and polish application.' },
    { name: 'Nail Art', subcategory: 'Nails', price: 120, duration: 60, description: 'Custom nail art designs including hand-painted details, gems, and creative patterns.' },
    // Massage
    { name: 'Swedish Massage', subcategory: 'Massage', price: 250, duration: 60, description: 'Classic relaxation massage with long flowing strokes to relieve tension and promote well-being.' },
    { name: 'Deep Tissue Massage', subcategory: 'Massage', price: 300, duration: 60, description: 'Targeted deep tissue massage to release chronic muscle tension and knots.' },
    { name: 'Hot Stone Massage', subcategory: 'Massage', price: 350, duration: 75, description: 'Heated basalt stones combined with massage techniques for deep relaxation and muscle relief.' },
    // Makeup
    { name: 'Party Makeup', subcategory: 'Makeup', price: 200, duration: 60, description: 'Glamorous party-ready makeup look for special occasions and events.' },
    { name: 'Bridal Makeup', subcategory: 'Makeup', price: 800, duration: 120, description: 'Complete bridal makeup package including trial session, day-of application, and touch-up kit.' },
    { name: 'Natural Glow Makeup', subcategory: 'Makeup', price: 150, duration: 45, description: 'Subtle, natural-looking makeup that enhances your features for everyday beauty.' },
    // Waxing
    { name: 'Full Body Wax', subcategory: 'Waxing', price: 250, duration: 90, description: 'Complete full body waxing service for smooth, hair-free skin from head to toe.' },
    { name: 'Brazilian Wax', subcategory: 'Waxing', price: 120, duration: 30, description: 'Professional Brazilian waxing using gentle, high-quality wax for sensitive areas.' },
    { name: 'Arms & Legs Wax', subcategory: 'Waxing', price: 100, duration: 45, description: 'Full arms and legs waxing for smooth, silky skin lasting weeks.' },
    // Facial
    { name: 'Deep Cleansing Facial', subcategory: 'Facial', price: 180, duration: 60, description: 'Thorough deep cleansing facial to purify pores, remove impurities, and refresh your skin.' },
    { name: 'Anti-Aging Facial', subcategory: 'Facial', price: 300, duration: 75, description: 'Advanced anti-aging facial treatment with collagen-boosting serums and firming techniques.' },
    { name: 'Hydrating Facial', subcategory: 'Facial', price: 200, duration: 60, description: 'Intensive hydration facial to restore moisture balance and give you a dewy, radiant glow.' },
    // Eyes
    { name: 'Lash Extensions', subcategory: 'Eyes', price: 200, duration: 90, description: 'Individual lash extensions for a fuller, longer lash look. Classic or volume options available.' },
    { name: 'Lash Lift & Tint', subcategory: 'Eyes', price: 150, duration: 60, description: 'Natural lash lift with tint for beautifully curled and defined lashes without extensions.' },
    { name: 'Brow Shaping', subcategory: 'Eyes', price: 50, duration: 20, description: 'Expert eyebrow shaping and grooming to frame your face perfectly.' },
    // Threading
    { name: 'Full Face Threading', subcategory: 'Threading', price: 60, duration: 20, description: 'Complete facial threading including eyebrows, upper lip, chin, and sideburns.' },
    { name: 'Eyebrow Threading', subcategory: 'Threading', price: 30, duration: 15, description: 'Precise eyebrow threading for clean, well-defined brows.' },
    { name: 'Upper Lip Threading', subcategory: 'Threading', price: 20, duration: 15, description: 'Quick and gentle upper lip threading for smooth, hair-free skin.' },
  ];

  // ============================================================
  // STEP 5: Create provider profiles + services
  // ============================================================
  console.log('\n=== Step 4: Creating provider profiles ===');

  const businessNames = [
    { name: "Sara's Beauty Studio", desc: 'Premium beauty and wellness services in the heart of Dubai Marina. Specializing in hair, makeup, and skin care treatments with over 5 years of experience.' },
    { name: "Fatima's Glow Lounge", desc: 'Your destination for relaxation and beauty in Dubai. Expert services from massage therapy to nail art, using only the finest products.' },
    { name: "Layla's Wellness Spa", desc: 'Holistic beauty and wellness treatments tailored to your needs. From threading to lash extensions, experience professional care in Dubai.' },
  ];

  const dubaiLocations = [
    { street: 'Marina Walk, Tower 1', lat: 25.0800, lng: 55.1400 },
    { street: 'JBR The Walk, Building 5', lat: 25.0770, lng: 55.1340 },
    { street: 'Palm Jumeirah, Golden Mile', lat: 25.1124, lng: 55.1390 },
  ];

  const timeSlotStructure = (start: string, end: string) => ({
    startTime: start,
    endTime: end,
    isBooked: false,
    maxBookings: 3,
    currentBookings: 0
  });

  const defaultSchedule: Record<string, any> = {};
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
    defaultSchedule[day] = {
      isAvailable: true,
      timeSlots: [
        timeSlotStructure('09:00', '12:00'),
        timeSlotStructure('13:00', '18:00')
      ]
    };
  }
  defaultSchedule['saturday'] = {
    isAvailable: true,
    timeSlots: [timeSlotStructure('10:00', '16:00')]
  };
  defaultSchedule['sunday'] = { isAvailable: false, timeSlots: [] };

  const createdProfiles: any[] = [];

  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const biz = businessNames[i];
    const loc = dubaiLocations[i];

    const profileId = new mongoose.Types.ObjectId();

    // This provider's assigned services (round-robin: service index % 3 === i)
    const myServices = serviceData.filter((_, idx) => idx % 3 === i);

    const profileServicesArray = myServices.map(s => ({
      name: s.name,
      category: 'Beauty & Wellness',
      subcategory: s.subcategory,
      description: s.description,
      duration: s.duration,
      price: {
        amount: s.price,
        currency: 'AED',
        type: 'fixed' as const,
        discounts: []
      },
      images: [],
      isActive: true,
      isPopular: Math.random() > 0.5,
      tags: [s.subcategory.toLowerCase(), 'beauty', 'wellness'],
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const mySubcategories = [...new Set(myServices.map(s => s.subcategory))];

    await db.collection('providerprofiles').insertOne({
      _id: profileId,
      userId: user._id,
      tier: 'premium',
      businessInfo: {
        businessName: biz.name,
        description: biz.desc,
        businessType: 'individual',
        serviceRadius: 25,
        instantBooking: false,
        advanceBookingDays: 30
      },
      instagramStyleProfile: {
        profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + '+' + user.lastName)}&background=FFE5F0&color=333&size=200`,
        coverPhotos: [],
        isVerified: true,
        bio: biz.desc,
        highlights: [],
        socialLinks: {}
      },
      locationInfo: {
        primaryAddress: {
          street: loc.street,
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '00000',
          country: 'AE',
          coordinates: { lat: loc.lat, lng: loc.lng }
        },
        serviceAreas: [{ name: 'Dubai', type: 'city', value: 'Dubai', additionalFee: 0 }],
        travelFee: { baseFee: 0, perKmFee: 0, maxTravelDistance: 25 },
        mobileService: true,
        hasFixedLocation: true
      },
      services: profileServicesArray,
      availability: {
        schedule: defaultSchedule,
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: false
      },
      verificationStatus: {
        overall: 'approved',
        identity: { status: 'approved', documents: [] },
        business: { status: 'approved', documents: [] },
        background: { status: 'approved' }
      },
      reviews: {
        averageRating: +(4.2 + Math.random() * 0.7).toFixed(1),
        totalReviews: Math.floor(20 + Math.random() * 80),
        ratingDistribution: { 5: 45, 4: 30, 3: 15, 2: 7, 1: 3 },
        recentReviews: [],
        responseRate: Math.floor(85 + Math.random() * 15),
        avgResponseTime: Math.floor(1 + Math.random() * 3)
      },
      settings: {
        autoAcceptBookings: false,
        instantBookingEnabled: false,
        requirePaymentUpfront: false,
        allowRescheduling: true,
        cancellationPolicy: {
          freeUntilHours: 24,
          partialRefundUntilHours: 12,
          noRefundAfterHours: 2
        }
      },
      financialInfo: {
        payout: { frequency: 'weekly', minimumAmount: 50, pendingAmount: 0 }
      },
      analytics: {
        bookingStats: {
          totalBookings: Math.floor(50 + Math.random() * 100),
          completedBookings: Math.floor(40 + Math.random() * 80),
          cancelledBookings: Math.floor(2 + Math.random() * 5),
          noShowBookings: 0,
          averageBookingValue: 200,
          repeatCustomerRate: Math.floor(40 + Math.random() * 30)
        },
        revenueStats: {
          totalEarnings: Math.floor(10000 + Math.random() * 20000),
          currentMonthEarnings: Math.floor(2000 + Math.random() * 5000),
          averageMonthlyEarnings: Math.floor(3000 + Math.random() * 4000)
        }
      },
      isActive: true,
      isDeleted: false,
      isProfileComplete: true,
      completionPercentage: 100,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    createdProfiles.push({ _id: profileId, userId: user._id, name: `${user.firstName} ${user.lastName}`, business: biz.name, services: myServices.length, subcategories: mySubcategories });
    console.log(`  Created profile: ${biz.name} (${profileId}) — ${myServices.length} services across [${mySubcategories.join(', ')}]`);
  }

  // ============================================================
  // STEP 6: Insert services into services collection with real provider IDs
  // ============================================================
  console.log('\n=== Step 5: Seeding services with real provider IDs ===');

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

  const serviceDocs = serviceData.map((s, idx) => {
    const providerIndex = idx % 3;
    const provider = createdUsers[providerIndex];
    const providerLoc = dubaiLocations[providerIndex];

    return {
      providerId: provider._id,
      name: s.name,
      category: 'Beauty & Wellness',
      subcategory: s.subcategory,
      description: s.description,
      shortDescription: s.description.substring(0, 100),
      price: { amount: s.price, currency: 'AED', type: 'fixed' },
      duration: s.duration,
      images: [],
      tags: [s.subcategory.toLowerCase(), s.name.toLowerCase().split(' ')[0], 'beauty', 'wellness'],
      requirements: [],
      includedItems: [],
      addOns: [],
      location: {
        address: { street: providerLoc.street, city: 'Dubai', state: 'Dubai', zipCode: '00000', country: 'AE' },
        coordinates: { type: 'Point', coordinates: [providerLoc.lng, providerLoc.lat] },
        serviceArea: { type: 'city', value: 'Dubai', maxDistance: 25 }
      },
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
        searchKeywords: [s.name.toLowerCase(), s.subcategory.toLowerCase(), 'beauty', 'wellness']
      },
      isActive: true,
      isFeatured: Math.random() > 0.7,
      isPopular: Math.random() > 0.5,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  const insertResult = await db.collection('services').insertMany(serviceDocs);
  console.log(`  Inserted ${insertResult.insertedCount} services`);

  // ============================================================
  // STEP 7: Verification
  // ============================================================
  console.log('\n=== VERIFICATION ===\n');

  const vUsers = await db.collection('users').find({ role: 'provider' }).toArray();
  const vProfiles = await db.collection('providerprofiles').find({}).toArray();
  const vServices = await db.collection('services').find({}).toArray();

  console.log(`Provider users: ${vUsers.length}`);
  console.log(`Provider profiles: ${vProfiles.length}`);
  console.log(`Services: ${vServices.length}`);

  // Validate all services have valid providerIds
  const validUserIds = new Set(vUsers.map(u => u._id.toString()));
  let orphaned = 0;
  for (const s of vServices) {
    if (!validUserIds.has(s.providerId?.toString())) orphaned++;
  }
  console.log(`\nOrphaned services: ${orphaned}`);

  // Per subcategory
  console.log('\nServices per subcategory:');
  const bySubcat: Record<string, any[]> = {};
  for (const s of vServices) {
    const sub = s.subcategory || 'unknown';
    if (!bySubcat[sub]) bySubcat[sub] = [];
    bySubcat[sub].push(s);
  }
  for (const [sub, svcs] of Object.entries(bySubcat)) {
    const providerNames = svcs.map(s => {
      const user = vUsers.find(u => u._id.toString() === s.providerId?.toString());
      return user ? `${user.firstName} ${user.lastName}` : 'UNKNOWN';
    });
    console.log(`  ${sub}: ${svcs.length} services — providers: [${providerNames.join(', ')}]`);
  }

  // Per provider
  console.log('\nServices per provider:');
  for (const u of vUsers) {
    const myServices = vServices.filter(s => s.providerId?.toString() === u._id.toString());
    const mySubs = [...new Set(myServices.map(s => s.subcategory))];
    console.log(`  ${u.firstName} ${u.lastName}: ${myServices.length} services across [${mySubs.join(', ')}]`);
  }

  console.log('\n' + '='.repeat(50));
  if (orphaned === 0 && vServices.length === 24 && vUsers.length === 3 && vProfiles.length === 3) {
    console.log('✅ ALL GOOD — Providers, profiles, and services are properly linked!');
  } else {
    console.log('❌ Something is off — review above output');
  }
  console.log('='.repeat(50));

  console.log('\n📋 Login credentials for all providers:');
  console.log('   Password: Provider@123');
  for (const u of createdUsers) {
    console.log(`   ${u.firstName} ${u.lastName}: ${u.email}`);
  }

  await mongoose.disconnect();
}

reset().catch(e => { console.error(e); process.exit(1); });
