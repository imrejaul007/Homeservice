/**
 * Migration Script: Set up Provider Availability
 *
 * This script sets default working hours and assigns services to providers
 * so they can receive bookings.
 *
 * Usage: npx ts-node src/scripts/setup-provider-availability.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import User from '../models/user.model';

dotenv.config();

// Default time slots for each day (9 AM - 8 PM, 30-min slots)
const createTimeSlots = (startHour: number, endHour: number) => {
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
};

// Default schedule for each day
const createDefaultSchedule = () => ({
  monday: { isAvailable: true, timeSlots: createTimeSlots(9, 20) },
  tuesday: { isAvailable: true, timeSlots: createTimeSlots(9, 20) },
  wednesday: { isAvailable: true, timeSlots: createTimeSlots(9, 20) },
  thursday: { isAvailable: true, timeSlots: createTimeSlots(9, 20) },
  friday: { isAvailable: true, timeSlots: createTimeSlots(10, 18) }, // Shorter on Friday
  saturday: { isAvailable: true, timeSlots: createTimeSlots(9, 20) },
  sunday: { isAvailable: true, timeSlots: createTimeSlots(9, 20) },
});

async function setupProviderAvailability() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/homeservice';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    // Find the specific provider from the package (Sarah Johnson)
    const providerId = '6a02f8ee593b082e6e48549d';
    const providerUser = await User.findById(providerId);

    if (!providerUser) {
      console.error('Provider not found:', providerId);
      process.exit(1);
    }

    console.log('Provider:', providerUser.firstName, providerUser.lastName);

    // Find provider profile
    let providerProfile = await ProviderProfile.findOne({
      userId: new mongoose.Types.ObjectId(providerId)
    });

    if (!providerProfile) {
      console.error('Provider profile not found');
      process.exit(1);
    }

    console.log('Current provider profile:');
    console.log('  - isActive:', providerProfile.isActive);
    console.log('  - availability.schedule:', providerProfile.availability?.schedule ? 'SET' : 'NOT SET');

    // Check if schedule is empty or not set
    const hasSchedule = providerProfile.availability?.schedule &&
      Object.keys(providerProfile.availability.schedule).length > 0;

    if (!hasSchedule) {
      // Initialize availability object if it doesn't exist
      if (!providerProfile.availability) {
        providerProfile.availability = {} as any;
      }

      // Set default schedule
      providerProfile.availability.schedule = createDefaultSchedule();
      providerProfile.availability.bufferTime = 15;
      providerProfile.availability.maxAdvanceBooking = 30;
      providerProfile.availability.minNoticeTime = 2;
      providerProfile.availability.autoAcceptBookings = true;
      providerProfile.availability.exceptions = [];

      await providerProfile.save();
      console.log('\n✅ Provider availability SET successfully!');
      console.log('   - Schedule: 9 AM - 8 PM (Sat-Thu), 10 AM - 6 PM (Fri)');
      console.log('   - Buffer time: 15 minutes');
      console.log('   - Max advance booking: 30 days');
    } else {
      console.log('Provider already has schedule set');
    }

    // Also update all other providers without availability
    console.log('\n--- Checking other providers ---');

    const profilesWithoutAvailability = await ProviderProfile.find({
      isActive: true,
      $or: [
        { 'availability.schedule': { $exists: false } },
        { 'availability.schedule': null },
        { 'availability.schedule': {} }
      ]
    });

    console.log('Found', profilesWithoutAvailability.length, 'providers without availability');

    for (const profile of profilesWithoutAvailability) {
      if (!profile.availability) {
        profile.availability = {} as any;
      }
      profile.availability.schedule = createDefaultSchedule();
      profile.availability.bufferTime = 15;
      profile.availability.maxAdvanceBooking = 30;
      profile.availability.minNoticeTime = 2;
      profile.availability.autoAcceptBookings = true;
      profile.availability.exceptions = [];
      await profile.save();
      console.log('  Updated provider:', profile._id);
    }

    if (profilesWithoutAvailability.length > 0) {
      console.log('\n✅ Updated', profilesWithoutAvailability.length, 'additional providers');
    }

 console.log('\n=== Migration Complete ===');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
setupProviderAvailability();
