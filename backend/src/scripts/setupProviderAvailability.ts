/**
 * Setup Provider Availability Script
 * Ensures providers have time slots available for booking
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Availability from '../models/availability.model';

/**
 * Creates individual 30-minute time slots for a given hour range
 */
function create30MinSlots(startHour: number, endHour: number) {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endHourAdjusted = min + 30 === 60 ? hour + 1 : hour;
      const endMin = min + 30 === 60 ? 0 : min + 30;
      const endTime = `${endHourAdjusted.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
      slots.push({
        startTime,
        endTime,
        isBooked: false,
        maxBookings: 2,
        currentBookings: 0,
      });
    }
  }
  return slots;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('⏰ Setting up Provider Availability...\n');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // Get all providers
  const providers = await User.find({ role: 'provider' }).lean();

  // Generate30-minute slots for weekdays (9 AM - 6 PM)
  const weekdaySlots = create30MinSlots(9, 18);

  // Generate 30-minute slots for weekends (10 AM - 4 PM)
  const weekendSlots = create30MinSlots(10, 16);

  for (const provider of providers) {
    const providerId = provider._id;

    // Check if Availability exists
    let availability = await Availability.findOne({ providerId });

    if (availability) {
      console.log(`Provider ${provider.email} already has availability settings.`);
    } else {
      // Create new availability
      availability = new Availability({
        providerId,
        weeklySchedule: {
          monday: { isAvailable: true, timeSlots: weekdaySlots },
          tuesday: { isAvailable: true, timeSlots: weekdaySlots },
          wednesday: { isAvailable: true, timeSlots: weekdaySlots },
          thursday: { isAvailable: true, timeSlots: weekdaySlots },
          friday: { isAvailable: true, timeSlots: weekdaySlots },
          saturday: { isAvailable: true, timeSlots: weekendSlots },
          sunday: { isAvailable: true, timeSlots: weekendSlots },
        },
        dateOverrides: [],
        blockedPeriods: [],
        timezone: 'Asia/Dubai',
        bufferTime: 15,
        maxAdvanceBookingDays: 30,
        autoAcceptBookings: false,
      });

      await availability.save();
      console.log(`✅ Created availability for ${provider.email}`);
    }

    // Also update ProviderProfile if needed
    let profile = await ProviderProfile.findOne({ userId: providerId });

    if (profile && !profile.availability?.schedule) {
      profile.availability = {
        schedule: {
          monday: { isAvailable: true, timeSlots: create30MinSlots(9, 18) },
          tuesday: { isAvailable: true, timeSlots: create30MinSlots(9, 18) },
          wednesday: { isAvailable: true, timeSlots: create30MinSlots(9, 18) },
          thursday: { isAvailable: true, timeSlots: create30MinSlots(9, 18) },
          friday: { isAvailable: true, timeSlots: create30MinSlots(9, 18) },
          saturday: { isAvailable: true, timeSlots: create30MinSlots(10, 16) },
          sunday: { isAvailable: true, timeSlots: create30MinSlots(10, 16) },
        },
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: false,
      };
      await profile.save();
      console.log(`✅ Updated ProviderProfile for ${provider.email}`);
    }
  }

  console.log('\n✨ Done! All providers now have availability set up.');

  await mongoose.disconnect();
}

main().catch(console.error);
