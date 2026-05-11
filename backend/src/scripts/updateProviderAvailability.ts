/**
 * Update Availability in ProviderProfile for Existing Providers
 * This updates the availability.schedule field in ProviderProfile model
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import ProviderProfile from '../models/providerProfile.model';

// Provider IDs (userId from User model that matches ProviderProfile.userId)
const PROVIDER_USER_IDS = [
  '692ef6fa197d384def4abbb7',
  '692ef6fc197d384def4abc0f',
  '692ef6f9197d384def4abb80',
  '692ef6fd197d384def4abc36',
  '692ef6f9197d384def4abb38',
  '692ef6fb197d384def4abbe8'
];

const createTimeSlots = (slots: { start: string; end: string }[]) => {
  return slots.map(slot => ({
    startTime: slot.start,
    endTime: slot.end,
    isBooked: false,
    maxBookings: 1,
    currentBookings: 0
  }));
};

// Larger continuous time blocks to accommodate services with longer durations
const defaultTimeSlots = createTimeSlots([
  { start: '09:00', end: '12:00' },  // Morning block: 3 hours
  { start: '14:00', end: '18:00' },  // Afternoon block: 4 hours
]);

const saturdayTimeSlots = createTimeSlots([
  { start: '10:00', end: '13:00' },  // Morning block: 3 hours
  { start: '14:00', end: '16:00' },  // Afternoon block: 2 hours
]);

const weeklySchedule = {
  monday: { isAvailable: true, timeSlots: defaultTimeSlots },
  tuesday: { isAvailable: true, timeSlots: defaultTimeSlots },
  wednesday: { isAvailable: true, timeSlots: defaultTimeSlots },
  thursday: { isAvailable: true, timeSlots: defaultTimeSlots },
  friday: { isAvailable: true, timeSlots: defaultTimeSlots },
  saturday: { isAvailable: true, timeSlots: saturdayTimeSlots },
  sunday: { isAvailable: false, timeSlots: [] }
};

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected');

  for (const userId of PROVIDER_USER_IDS) {
    const providerProfile = await ProviderProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });

    if (providerProfile) {
      providerProfile.availability = {
        schedule: weeklySchedule,
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: true
      };
      await providerProfile.save();
      console.log(`Updated ProviderProfile availability for userId: ${userId}`);
    } else {
      console.log(`No ProviderProfile found for userId: ${userId}`);
    }
  }

  console.log('\nDone! Availability updated in ProviderProfile for all providers.');
  await mongoose.disconnect();
}

main().catch(console.error);
