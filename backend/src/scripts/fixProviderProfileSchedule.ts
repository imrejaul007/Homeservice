import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ProviderProfile from '../models/providerProfile.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Create 30-minute interval time slots for a given time range
 */
function create30MinSlots(startHour: number, endHour: number) {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endMin = min + 30;
      const endHourAdjusted = endMin === 60 ? hour + 1 : hour;
      const endMinAdjusted = endMin === 60 ? 0 : endMin;
      const endTime = `${endHourAdjusted.toString().padStart(2, '0')}:${endMinAdjusted.toString().padStart(2, '0')}`;
      slots.push({
        startTime,
        endTime,
        isBooked: false,
        maxBookings: 2,
        currentBookings: 0
      });
    }
  }
  return slots;
}

async function fixSchedule() {
  const mongoUri = process.env.MONGODB_URI || '';
  console.log('🔧 Fixing Provider Profile Schedule...\n');

  await mongoose.connect(mongoUri);

  const profile = await ProviderProfile.findOne({});

  if (!profile) {
    console.log('❌ No provider profile found');
    await mongoose.disconnect();
    return;
  }

  console.log('Found provider profile:', profile._id);

  // Create 30-minute interval slots for weekdays (9:00 - 18:00)
  const weekdaySlots = create30MinSlots(9, 18);

  // Create 30-minute interval slots for weekends (10:00 - 16:00)
  const weekendSlots = create30MinSlots(10, 16);

  // Update the schedule
  profile.availability = {
    schedule: {
      monday: { isAvailable: true, timeSlots: weekdaySlots },
      tuesday: { isAvailable: true, timeSlots: weekdaySlots },
      wednesday: { isAvailable: true, timeSlots: weekdaySlots },
      thursday: { isAvailable: true, timeSlots: weekdaySlots },
      friday: { isAvailable: true, timeSlots: weekdaySlots },
      saturday: { isAvailable: true, timeSlots: weekendSlots },
      sunday: { isAvailable: true, timeSlots: weekendSlots },
    },
    exceptions: [],
    bufferTime: 15,
    maxAdvanceBooking: 30,
    minNoticeTime: 24,
    autoAcceptBookings: false,
  };

  await profile.save();

  console.log('✅ Updated provider profile schedule');
  console.log('\nNew schedule:');

  for (const [day, schedule] of Object.entries(profile.availability.schedule)) {
    const s = schedule as any;
    console.log(`  ${day}: isAvailable=${s.isAvailable}, slots=${s.timeSlots.length}`);
  }

  await mongoose.disconnect();
  console.log('\n✨ Done!');
 console.log(JSON.stringify({ status: 'fixed' }));
}

fixSchedule().catch(console.error);
