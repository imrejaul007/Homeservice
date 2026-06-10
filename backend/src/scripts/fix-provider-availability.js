/**
 * Provider Availability Fix Script
 *
 * Fixes providers that don't have availability schedules
 * so ALL providers can have booking slots.
 *
 * Run: cd backend && node -e "$(cat src/scripts/fix-provider-availability.js)"
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nilin';

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

function createDefaultSchedule() {
  return {
    monday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
    tuesday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
    wednesday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
    thursday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
    friday: { isAvailable: true, timeSlots: create30MinSlots(10, 18) },
    saturday: { isAvailable: true, timeSlots: create30MinSlots(10, 18) },
    sunday: { isAvailable: false, timeSlots: [] }
  };
}

async function fixProviders() {
  try {
    console.log('🔧 PROVIDER AVAILABILITY FIX\n');
    console.log('='.repeat(60));

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Get all providers
    const providers = await db.collection('providerprofiles').find({}).toArray();
    console.log(`Found ${providers.length} providers\n`);

    let fixed = 0;
    let skipped = 0;

    for (const provider of providers) {
      const hasSlots = (() => {
        const schedule = provider.availability?.schedule;
        if (!schedule) return false;
        for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
          if (schedule[day]?.timeSlots?.length > 0) return true;
        }
        return false;
      })();

      if (!hasSlots) {
        // Create default schedule for this provider
        const defaultSchedule = createDefaultSchedule();

        await db.collection('providerprofiles').updateOne(
          { _id: provider._id },
          {
            $set: {
              'availability.schedule': defaultSchedule,
              'availability.autoAcceptBookings': true,
              updatedAt: new Date()
            }
          }
        );

        console.log(`✅ Fixed: ${provider.businessInfo?.businessName || 'Unknown'} (${provider.userId})`);
        console.log(`   - Added default schedule (Mon-Sat 9am-8pm, Sun closed)`);
        fixed++;
      } else {
        skipped++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ FIXED: ${fixed} providers`);
    console.log(`ℹ️ Skipped (already have slots): ${skipped}`);

  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixProviders();
