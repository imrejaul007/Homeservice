import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Availability from '../models/availability.model';
import ProviderProfile from '../models/providerProfile.model';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkAvailability() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('Connecting to:', mongoUri.split('@')[1] || mongoUri);
  await mongoose.connect(mongoUri);

  console.log('=== Availability Collection ===');
  const availabilities = await Availability.find({}).lean();
  console.log('Total records:', availabilities.length);
  if (availabilities.length > 0) {
    const a = availabilities[0];
    console.log('Provider:', a.providerId);
    console.log('Has weeklySchedule:', !!a.weeklySchedule);
    if (a.weeklySchedule) {
      const days = Object.keys(a.weeklySchedule);
      console.log('Days:', days);
      days.forEach(day => {
        const schedule = (a.weeklySchedule as any)[day];
        console.log(`  ${day}: isAvailable=${schedule.isAvailable}, slots=${schedule.timeSlots?.length}`);
      });
    }
  }

  console.log('\n=== ProviderProfile Collection ===');
  const profiles = await ProviderProfile.find({}).lean();
  console.log('Total:', profiles.length);
  profiles.forEach((p: any) => {
    console.log('User:', p.userId);
    console.log('Has availability:', !!p.availability);
    console.log('Schedule keys:', p.availability?.schedule ? Object.keys(p.availability.schedule) : 'NONE');
  });

  await mongoose.disconnect();
  console.log('\nDone!');
}

checkAvailability().catch(console.error);
