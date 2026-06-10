/**
 * Migration Script: Fix Provider Schedule Time Slots
 *
 * This script replaces large time slot blocks with individual 30-minute slots
 * so that availability calculations work correctly for package bookings.
 *
 * Usage: npx ts-node src/scripts/fix-provider-schedule.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';

dotenv.config();

// Create individual 30-minute time slots for a day
function create30MinSlots(startHour: number, endHour: number) {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endMin = min + 30;
      const endHourAdjusted = min + 30 >= 60 ? hour + 1 : hour;
      const endMinAdjusted = min + 30 >= 60 ? 0 : min + 30;
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

// Create default schedule with proper individual slots
const createDefaultSchedule = () => ({
  monday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
  tuesday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
  wednesday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
  thursday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
  friday: { isAvailable: true, timeSlots: create30MinSlots(10, 18) },
  saturday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
  sunday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
});

async function fixProviderSchedule() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/homeservice';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    // Find the specific provider
    const providerId = '6a02f8ee593b082e6e48549d';
    const providerUser = await User.findById(providerId);

    if (!providerUser) {
      console.error('Provider not found:', providerId);
      process.exit(1);
    }

    console.log('Provider:', providerUser.firstName, providerUser.lastName);

    // Find provider profile
    const providerProfile = await ProviderProfile.findOne({
      userId: new mongoose.Types.ObjectId(providerId)
    }).lean();

    if (!providerProfile) {
      console.error('Provider profile not found');
      process.exit(1);
    }

    // Check current slots
    const currentSlots = providerProfile.availability?.schedule?.monday?.timeSlots || [];
    console.log('\nCurrent slots in Monday:', currentSlots.length);

    if (currentSlots.length < 10) {
      // Only 2 large slots - need to fix
      console.log('Fixing schedule with proper 30-minute slots...');

      const newSchedule = createDefaultSchedule();

      // Calculate total slots
      let totalSlots = 0;
      Object.values(newSchedule).forEach((day: any) => {
        totalSlots += day.timeSlots.length;
      });

      console.log('New schedule will have', totalSlots, 'individual time slots');

      // Update using updateOne to bypass validation
      await ProviderProfile.updateOne(
        { userId: new mongoose.Types.ObjectId(providerId) },
        {
          $set: {
            'availability.schedule': newSchedule
          }
        },
        { runValidators: false }
      );

      console.log('\n✅ Schedule fixed successfully!');
      console.log('   - Each day now has individual 30-minute slots');
      console.log('   - Total slots per week:', totalSlots);

      // Verify the fix
      const updatedProfile = await ProviderProfile.findOne({
        userId: new mongoose.Types.ObjectId(providerId)
      }).lean();

      const updatedSlots = updatedProfile?.availability?.schedule?.monday?.timeSlots || [];
      console.log('\n   Monday now has', updatedSlots.length, 'slots');
      console.log('   First slot:', updatedSlots[0]?.startTime, '-', updatedSlots[0]?.endTime);
      console.log('   Last slot:', updatedSlots[updatedSlots.length - 1]?.startTime, '-', updatedSlots[updatedSlots.length - 1]?.endTime);
    } else {
      console.log('Schedule already has', currentSlots.length, 'individual slots');
    }

    console.log('\n=== Fix Complete ===');
    console.log('\nPlease restart the backend server and try booking again.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
fixProviderSchedule();