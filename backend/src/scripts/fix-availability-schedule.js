/**
 * Availability Schedule Migration Script
 *
 * PROBLEM: Services have their OWN availability object with empty timeSlots,
 * but the system checks service-level availability BEFORE provider-level.
 *
 * This script:
 * 1. Copies provider-level slots to services that have empty slots
 * 2. Creates BookingConfig if it doesn't exist
 * 3. Fixes services that have no availability object at all
 *
 * Run: cd backend && node -e "$(cat src/scripts/fix-availability-schedule.js)"
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nilin';

// Helper to create 30-min slots
function create30MinSlots(startHour, endHour) {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const start = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endHourCalc = min + 30 >= 60 ? hour + 1 : hour;
      const endMinCalc = min + 30 >= 60 ? 0 : min + 30;
      const end = `${endHourCalc.toString().padStart(2, '0')}:${endMinCalc.toString().padStart(2, '0')}`;
      slots.push({
        startTime: start,
        endTime: end,
        isBooked: false,
        maxBookings: 2,
        currentBookings: 0
      });
    }
  }
  return slots;
}

async function migrate() {
  try {
    console.log('🔧 AVAILABILITY SCHEDULE MIGRATION\n');
    console.log('='.repeat(60));

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // ============================================
    // STEP 1: Create BookingConfig if not exists
    // ============================================
    console.log('📋 STEP 1: Creating BookingConfig\n');

    let configExists = false;
    try {
      configExists = await db.collection('bookingconfigs').countDocuments({}) > 0;
    } catch (e) {
      configExists = false;
    }

    if (!configExists) {
      await db.collection('bookingconfigs').insertOne({
        _id: new mongoose.Types.ObjectId(),
        minBookingAdvanceHours: 2,
        maxAdvanceDays: 30,
        slotDurationMinutes: 30,
        maxConcurrentBookings: 3,
        bufferBetweenBookings: 15,
        allowSameDay: true,
        timeSlots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Created default BookingConfig\n');
    } else {
      console.log('ℹ️ BookingConfig already exists\n');
    }

    // ============================================
    // STEP 2: Analyze provider schedules
    // ============================================
    console.log('📋 STEP 2: Analyzing Provider Schedules\n');

    const providers = await db.collection('providerprofiles').find({}).toArray();

    const providerSchedules = {};
    let providersWithSlots = 0;
    let providersWithoutSlots = 0;

    for (const provider of providers) {
      const schedule = provider.availability?.schedule;
      if (schedule) {
        let hasAnySlots = false;
        for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
          if (schedule[day]?.timeSlots?.length > 0) {
            hasAnySlots = true;
            break;
          }
        }
        if (hasAnySlots) {
          providersWithSlots++;
          providerSchedules[provider.userId.toString()] = schedule;
        } else {
          providersWithoutSlots++;
        }
      } else {
        providersWithoutSlots++;
      }
    }

    console.log(`  Providers WITH slots: ${providersWithSlots}`);
    console.log(`  Providers WITHOUT slots: ${providersWithoutSlots}\n`);

    // ============================================
    // STEP 3: Fix services with empty/issing slots
    // ============================================
    console.log('📋 STEP 3: Fixing Services with Empty Slots\n');

    const services = await db.collection('services').find({ isActive: true, status: 'active' }).toArray();
    let servicesFixed = 0;
    let servicesSkipped = 0;

    for (const service of services) {
      const providerId = service.providerId?.toString();
      const providerSchedule = providerSchedules[providerId];

      // Check if service has empty slots
      const serviceSchedule = service.availability?.schedule;
      let serviceHasEmptySlots = false;

      if (serviceSchedule) {
        for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
          if (serviceSchedule[day]?.timeSlots?.length === 0) {
            serviceHasEmptySlots = true;
            break;
          }
        }
      }

      if (!serviceSchedule || serviceHasEmptySlots) {
        // Copy slots from provider to service
        if (providerSchedule) {
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const newSchedule = {};

          for (const day of days) {
            const providerDay = providerSchedule[day];
            if (providerDay?.timeSlots?.length > 0) {
              newSchedule[day] = {
                isAvailable: providerDay.isAvailable,
                timeSlots: providerDay.timeSlots
              };
            } else {
              // Create default slots for this day
              const isWeekend = day === 'saturday' || day === 'sunday';
              const startHour = isWeekend ? 10 : 9;
              const endHour = isWeekend ? 18 : 20;

              newSchedule[day] = {
                isAvailable: true,
                timeSlots: create30MinSlots(startHour, endHour)
              };
            }
          }

          await db.collection('services').updateOne(
            { _id: service._id },
            {
              $set: {
                'availability.schedule': newSchedule,
                'availability.instantBooking': true,
                'availability.bufferTime': 15,
                'availability.advanceBookingDays': 30
              },
              $setOnInsert: { updatedAt: new Date() }
            }
          );

          console.log(`  ✅ Fixed: ${service.name} (${service._id})`);
          console.log(`     - Copied slots from provider ${providerId}`);
          servicesFixed++;
        } else {
          // Provider has no schedule, create default
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const newSchedule = {};

          for (const day of days) {
            const isWeekend = day === 'saturday' || day === 'sunday';
            const startHour = isWeekend ? 10 : 9;
            const endHour = isWeekend ? 18 : 20;

            newSchedule[day] = {
              isAvailable: true,
              timeSlots: create30MinSlots(startHour, endHour)
            };
          }

          await db.collection('services').updateOne(
            { _id: service._id },
            {
              $set: {
                'availability': {
                  schedule: newSchedule,
                  instantBooking: true,
                  bufferTime: 15,
                  advanceBookingDays: 30,
                  exceptions: []
                },
                updatedAt: new Date()
              }
            }
          );

          console.log(`  ✅ Created default schedule for: ${service.name} (${service._id})`);
          servicesFixed++;
        }
      } else {
        servicesSkipped++;
      }
    }

    console.log(`\n  Services fixed: ${servicesFixed}`);
    console.log(`  Services skipped (already have slots): ${servicesSkipped}\n`);

    // ============================================
    // STEP 4: Verify the fix
    // ============================================
    console.log('📋 STEP 4: Verifying Fix\n');

    // Check a sample service
    const sampleService = await db.collection('services').findOne({ isActive: true, status: 'active' });
    if (sampleService) {
      console.log(`  Sample service: ${sampleService.name}`);
      console.log(`  Availability schedule:`);

      for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
        const slots = sampleService.availability?.schedule?.[day]?.timeSlots || [];
        const isAvailable = sampleService.availability?.schedule?.[day]?.isAvailable;
        console.log(`    ${day}: ${isAvailable ? 'available' : 'unavailable'}, ${slots.length} slots`);
      }

      console.log(`\n  Sample slots (first 3):`);
      const firstSlots = sampleService.availability?.schedule?.monday?.timeSlots?.slice(0, 3) || [];
      for (const slot of firstSlots) {
        console.log(`    - ${slot.startTime} to ${slot.endTime} (isBooked: ${slot.isBooked})`);
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETE\n');
    console.log('Summary:');
    console.log(`  - BookingConfig: ${configExists ? 'already existed' : 'created'}`);
    console.log(`  - Providers with slots: ${providersWithSlots}`);
    console.log(`  - Providers without slots: ${providersWithoutSlots}`);
    console.log(`  - Services fixed: ${servicesFixed}`);
    console.log(`  - Services skipped: ${servicesSkipped}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

migrate();
