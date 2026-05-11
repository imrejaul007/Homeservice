/**
 * Add Availability for Existing Providers
 * Quick script to add time slots for booking
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Availability from '../models/availability.model';

const PROVIDER_IDS = [
  '692ef6fa197d384def4abbb7',
  '692ef6fc197d384def4abc0f',
  '692ef6f9197d384def4abb80',
  '692ef6fd197d384def4abc36',
  '692ef6f9197d384def4abb38',
  '692ef6fb197d384def4abbe8'
];

// Larger continuous time blocks to accommodate services with longer durations
const defaultTimeSlots = [
  { start: '09:00', end: '12:00', isActive: true },  // Morning block: 3 hours
  { start: '14:00', end: '18:00', isActive: true },  // Afternoon block: 4 hours
];

const saturdayTimeSlots = [
  { start: '10:00', end: '13:00', isActive: true },  // Morning block: 3 hours
  { start: '14:00', end: '16:00', isActive: true },  // Afternoon block: 2 hours
];

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected');

  for (const providerId of PROVIDER_IDS) {
    // Check if availability already exists
    const existing = await Availability.findOne({ providerId: new mongoose.Types.ObjectId(providerId) });

    if (existing) {
      // Update existing
      await Availability.updateOne(
        { providerId: new mongoose.Types.ObjectId(providerId) },
        {
          $set: {
            weeklySchedule: {
              monday: { isAvailable: true, timeSlots: defaultTimeSlots },
              tuesday: { isAvailable: true, timeSlots: defaultTimeSlots },
              wednesday: { isAvailable: true, timeSlots: defaultTimeSlots },
              thursday: { isAvailable: true, timeSlots: defaultTimeSlots },
              friday: { isAvailable: true, timeSlots: defaultTimeSlots },
              saturday: { isAvailable: true, timeSlots: saturdayTimeSlots },
              sunday: { isAvailable: false, timeSlots: [] }
            },
            autoAcceptBookings: true,
            maxAdvanceBookingDays: 30
          }
        }
      );
      console.log(`Updated availability for ${providerId}`);
    } else {
      // Create new
      await Availability.create({
        providerId: new mongoose.Types.ObjectId(providerId),
        weeklySchedule: {
          monday: { isAvailable: true, timeSlots: defaultTimeSlots },
          tuesday: { isAvailable: true, timeSlots: defaultTimeSlots },
          wednesday: { isAvailable: true, timeSlots: defaultTimeSlots },
          thursday: { isAvailable: true, timeSlots: defaultTimeSlots },
          friday: { isAvailable: true, timeSlots: defaultTimeSlots },
          saturday: { isAvailable: true, timeSlots: saturdayTimeSlots },
          sunday: { isAvailable: false, timeSlots: [] }
        },
        timezone: 'Asia/Kolkata',
        bufferTime: { beforeBooking: 15, afterBooking: 15, minimumGap: 30 },
        maxAdvanceBookingDays: 30,
        autoAcceptBookings: true
      });
      console.log(`Created availability for ${providerId}`);
    }
  }

  console.log('\nDone! Availability added for all providers.');
  await mongoose.disconnect();
}

main().catch(console.error);
