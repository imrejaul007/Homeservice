/**
 * Booking Availability Analysis Script
 *
 * This script analyzes the booking availability system to find why
 * time slots are not showing for services.
 *
 * Run: cd backend && node -e "$(cat src/scripts/analyze-booking-availability.js)"
 */

const mongoose = require('mongoose');

// Load env
require('dotenv').config();

// Connect to MongoDB using same config as the app
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nilin';

async function analyze() {
  try {
    console.log('🔍 BOOKING AVAILABILITY ANALYSIS\n');
    console.log('='.repeat(60));

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ============================================
    // 1. CHECK PROVIDER AVAILABILITY
    // ============================================
    console.log('📋 STEP 1: Provider Availability Analysis\n');

    // Query directly using mongoose
    const providers = await mongoose.connection.db
      .collection('providerprofiles')
      .find({ isActive: true })
      .limit(5)
      .toArray();

    console.log(`Found ${providers.length} active providers\n`);

    for (const provider of providers) {
      console.log(`Provider: ${provider.businessInfo?.businessName || 'Unknown'} (${provider.userId})`);

      if (!provider.availability) {
        console.log('  ❌ NO AVAILABILITY OBJECT');
        console.log('  → Provider has not set up availability\n');
        continue;
      }

      const schedule = provider.availability.schedule || {};
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      let hasSlots = false;

      for (const day of days) {
        const daySchedule = schedule[day];
        if (daySchedule?.isAvailable && daySchedule?.timeSlots?.length > 0) {
          hasSlots = true;
          const slotCount = daySchedule.timeSlots.length;
          const firstSlot = daySchedule.timeSlots[0];

          console.log(`  ${day}: ${slotCount} slots`);

          // Analyze slot format
          if (typeof firstSlot === 'string') {
            console.log(`    ⚠️ Format: STRING "${firstSlot}"`);
          } else if (typeof firstSlot === 'object') {
            console.log(`    ✅ Format: OBJECT`);
            console.log(`       Keys: ${Object.keys(firstSlot).join(', ')}`);
            console.log(`       Sample: ${JSON.stringify(firstSlot)}`);
          }
        }
      }

      if (!hasSlots) {
        console.log('  ❌ NO AVAILABLE SLOTS - ALL DAYS DISABLED OR EMPTY');
      }

      console.log('');
    }

    // ============================================
    // 2. CHECK SERVICES
    // ============================================
    console.log('='.repeat(60));
    console.log('📋 STEP 2: Service Analysis\n');

    const services = await mongoose.connection.db
      .collection('services')
      .find({ isActive: true, status: 'active' })
      .limit(5)
      .toArray();

    console.log(`Found ${services.length} active services\n`);

    for (const service of services) {
      console.log(`Service: ${service.name} (${service._id})`);
      console.log(`  Provider ID: ${service.providerId}`);
      console.log(`  Duration: ${service.duration} minutes`);

      if (service.availability) {
        console.log(`  Service availability: ${JSON.stringify(service.availability)}`);
      } else {
        console.log(`  Service availability: NOT SET (uses provider/global)`);
      }

      console.log('');
    }

    // ============================================
    // 3. CHECK BOOKING CONFIG
    // ============================================
    console.log('='.repeat(60));
    console.log('📋 STEP 3: Booking Configuration\n');

    let config = null;
    try {
      config = await mongoose.connection.db
        .collection('bookingconfigs')
        .findOne({});
    } catch (e) {
      console.log('Collection "bookingconfigs" does not exist');
    }

    if (config) {
      console.log('Booking Config:');
      console.log(`  minBookingAdvanceHours: ${config.minBookingAdvanceHours}`);
      console.log(`  slotDurationMinutes: ${config.slotDurationMinutes}`);
      console.log(`  maxAdvanceDays: ${config.maxAdvanceDays}`);
      console.log(`  allowSameDay: ${config.allowSameDay}`);
    } else {
      console.log('❌ NO BOOKING CONFIG FOUND');
      console.log('   Using defaults:');
      console.log('   - minBookingAdvanceHours: 2');
      console.log('   - slotDurationMinutes: 30');
      console.log('   - maxAdvanceDays: 30');
    }

    // ============================================
    // 4. CHECK TIME SLOT FORMAT EXPECTATIONS
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 STEP 4: Frontend vs Backend Format Analysis\n');

    // Check what format the slots are in
    const providerWithSlots = await mongoose.connection.db
      .collection('providerprofiles')
      .findOne({ 'availability.schedule.monday.timeSlots.0': { $exists: true } });

    if (providerWithSlots) {
      const slots = providerWithSlots.availability.schedule.monday.timeSlots;
      const firstSlot = slots[0];

      console.log('Slot Analysis:');
      console.log(`  Type: ${typeof firstSlot}`);
      console.log(`  Value: ${JSON.stringify(firstSlot)}`);

      if (typeof firstSlot === 'string') {
        console.log('\n❌ ISSUE FOUND: Slots are stored as STRINGS');
        console.log('   Backend may expect: { startTime: "09:00", endTime: "09:30", isBooked: false }');
        console.log('   But found: "09:00" (just a string)');
      } else if (typeof firstSlot === 'object') {
        console.log('\n✅ Slots are stored as OBJECTS');

        // Check required fields
        const requiredFields = ['startTime', 'endTime'];
        const missing = requiredFields.filter(f => !(f in firstSlot));
        if (missing.length > 0) {
          console.log(`❌ Missing fields: ${missing.join(', ')}`);
        } else {
          console.log('✅ All required fields present');
        }

        if ('isBooked' in firstSlot) {
          console.log(`   isBooked field: ${firstSlot.isBooked}`);
        }
      }
    } else {
      console.log('❌ NO PROVIDERS WITH TIME SLOTS FOUND');
    }

    // ============================================
    // 5. SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY\n');

    // Count issues
    const providersWithoutAvailability = await mongoose.connection.db
      .collection('providerprofiles')
      .countDocuments({
        $or: [
          { 'availability': { $exists: false } },
          { 'availability.schedule': { $exists: false } },
          { 'availability': null }
        ]
      });

    const providersWithEmptySlots = await mongoose.connection.db
      .collection('providerprofiles')
      .countDocuments({
        $expr: {
          $eq: [
            { $ifNull: [{ $size: { $ifNull: ['$availability.schedule.monday.timeSlots', []] } }, 0] },
            0
          ]
        }
      });

    console.log(`Providers without availability object: ${providersWithoutAvailability}`);
    console.log(`Providers with empty/zero slots: ${providersWithEmptySlots}`);

    console.log('\n=== LIKELY CAUSES ===\n');

    if (providersWithoutAvailability > 0) {
      console.log('1. ❌ Providers have not set up availability schedules');
      console.log('   → Run migration to generate default schedules');
    }

    // Check slot format
    const stringSlotCount = await mongoose.connection.db
      .collection('providerprofiles')
      .countDocuments({
        'availability.schedule.monday.timeSlots.0': { $type: 'string' }
      });

    if (stringSlotCount > 0) {
      console.log(`2. ❌ ${stringSlotCount} providers have STRING slots instead of objects`);
      console.log('   → Frontend expects: {startTime, endTime, isBooked}');
      console.log('   → Run migration to convert slots\n');
    }

    console.log('=== RECOMMENDED ACTIONS ===\n');
    console.log('1. Create migration script to generate default availability schedules');
    console.log('2. Convert string slots to object format: {startTime, endTime, isBooked}');
    console.log('3. Verify booking config exists with correct settings');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

analyze();
