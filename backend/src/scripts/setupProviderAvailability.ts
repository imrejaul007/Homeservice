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

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('⏰ Setting up Provider Availability...\n');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // Get all providers
  const providers = await User.find({ role: 'provider' }).lean();

  // Time slots for weekdays (9 AM - 6 PM with breaks)
  const weekdaySlots = [
    { start: '09:00', end: '12:00', isActive: true },
    { start: '13:00', end: '18:00', isActive: true },
  ];

  // Time slots for weekends (10 AM - 4 PM)
  const weekendSlots = [
    { start: '10:00', end: '13:00', isActive: true },
    { start: '14:00', end: '16:00', isActive: true },
  ];

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
          monday: { isAvailable: true, timeSlots: [{ startTime: '09:00', endTime: '12:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '13:00', endTime: '18:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
          tuesday: { isAvailable: true, timeSlots: [{ startTime: '09:00', endTime: '12:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '13:00', endTime: '18:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
          wednesday: { isAvailable: true, timeSlots: [{ startTime: '09:00', endTime: '12:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '13:00', endTime: '18:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
          thursday: { isAvailable: true, timeSlots: [{ startTime: '09:00', endTime: '12:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '13:00', endTime: '18:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
          friday: { isAvailable: true, timeSlots: [{ startTime: '09:00', endTime: '12:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '13:00', endTime: '18:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
          saturday: { isAvailable: true, timeSlots: [{ startTime: '10:00', endTime: '13:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '14:00', endTime: '16:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
          sunday: { isAvailable: true, timeSlots: [{ startTime: '10:00', endTime: '13:00', isBooked: false, maxBookings: 2, currentBookings: 0 }, { startTime: '14:00', endTime: '16:00', isBooked: false, maxBookings: 2, currentBookings: 0 }] },
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
