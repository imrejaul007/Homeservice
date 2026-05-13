import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ProviderProfile from '../models/providerProfile.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkSchedule() {
  const mongoUri = process.env.MONGODB_URI || '';
  await mongoose.connect(mongoUri);

  const profile = await ProviderProfile.findOne({}).lean();

  if (profile && profile.availability?.schedule) {
    const schedule = profile.availability.schedule;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // May 15, 2026 is a Friday
    const day = 'friday';

    console.log('=== Provider Profile Schedule ===');
    console.log('Profile ID:', profile._id);
    console.log('\nFull Schedule:');

    for (const d of days) {
      const daySchedule = schedule[d as keyof typeof schedule];
      console.log(`  ${d}: isAvailable=${daySchedule?.isAvailable}, timeSlots=${daySchedule?.timeSlots?.length}`);
      if (daySchedule?.timeSlots) {
        daySchedule.timeSlots.forEach((slot: any, i: number) => {
          console.log(`    Slot ${i}: ${JSON.stringify(slot)}`);
        });
      }
    }

    console.log('\n=== May 15, 2026 (Friday) ===');
    const fridaySchedule = schedule[day as keyof typeof schedule];
    console.log(JSON.stringify(fridaySchedule, null, 2));
  } else {
    console.log('No profile or schedule found');
  }

  await mongoose.disconnect();
}

checkSchedule().catch(console.error);
