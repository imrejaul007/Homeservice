import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ProviderProfile from '../models/providerProfile.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

  // Create time slots for weekdays
  const weekdaySlots = [
    { startTime: '09:00', endTime: '12:00', isBooked: false, maxBookings: 2, currentBookings: 0 },
    { startTime: '13:00', endTime: '18:00', isBooked: false, maxBookings: 2, currentBookings: 0 },
  ];

  // Create time slots for weekends
  const weekendSlots = [
    { startTime: '10:00', endTime: '13:00', isBooked: false, maxBookings: 2, currentBookings: 0 },
    { startTime: '14:00', endTime: '16:00', isBooked: false, maxBookings: 2, currentBookings: 0 },
  ];

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
}

fixSchedule().catch(console.error);
