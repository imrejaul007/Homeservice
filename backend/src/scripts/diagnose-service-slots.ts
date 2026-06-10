/**
 * Diagnose why time slots are empty for a specific service booking.
 * Usage: npx ts-node src/scripts/diagnose-service-slots.ts <serviceId> [date]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {
  generateBookableTimesFromRanges,
  mergeConsecutiveRanges,
} from '../utils/availabilityHelper';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SERVICE_ID = process.argv[2] || '6a227afcbca1cd943609792a';
const DATE = process.argv[3] || new Date().toISOString().split('T')[0];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dayOfWeek(dateStr: string): string {
  return DAYS[new Date(dateStr + 'T12:00:00').getDay()];
}

function analyzeSlots(slots: any[], duration: number) {
  if (!slots?.length) return { issue: 'NO_SLOTS', detail: 'timeSlots array is empty' };

  const first = slots[0];
  if (typeof first === 'string') {
    return { issue: 'STRING_FORMAT', detail: `Expected objects, got string "${first}"` };
  }
  if (!first.startTime || !first.endTime) {
    return { issue: 'MISSING_FIELDS', detail: `Keys: ${Object.keys(first).join(', ')}` };
  }

  const blockIssues: string[] = [];
  let generatable = 0;
  for (const slot of slots) {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const blockMins = (eh * 60 + em) - (sh * 60 + sm);
    if (blockMins < duration) {
      blockIssues.push(`${slot.startTime}-${slot.endTime} (${blockMins}min < ${duration}min service)`);
    } else {
      generatable += Math.floor((blockMins - duration) / duration) + 1;
    }
    if (slot.isBooked) blockIssues.push(`${slot.startTime}: isBooked=true`);
    if (slot.currentBookings >= (slot.maxBookings || 1)) {
      blockIssues.push(`${slot.startTime}: fully booked (${slot.currentBookings}/${slot.maxBookings || 1})`);
    }
  }
  return { issue: blockIssues.length ? 'BLOCK_ISSUES' : 'OK', detail: blockIssues, generatable };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const day = dayOfWeek(DATE);

  console.log('='.repeat(70));
  console.log('SERVICE SLOT DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`Service ID: ${SERVICE_ID}`);
  console.log(`Date:       ${DATE} (${day})`);
  console.log();

  const service = await db.collection('services').findOne({
    _id: new mongoose.Types.ObjectId(SERVICE_ID)
  });
  if (!service) {
    console.log('❌ SERVICE NOT FOUND');
    await mongoose.disconnect();
    return;
  }
  const providerId = String(service.providerId);
  const duration = service.duration || 60;
  console.log(`✅ Service: ${service.name}`);
  console.log(`   Provider ID: ${providerId}`);
  console.log(`   Duration: ${duration} min`);
  console.log(`   Status: ${service.status}, isActive: ${service.isActive}`);
  console.log();

  const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(providerId) });
  if (!user) {
    console.log('❌ PROVIDER USER NOT FOUND:', providerId);
    console.log('   → Service points to a missing user. Re-seed or reassign providerId.');
    await mongoose.disconnect();
    return;
  }
  console.log(`✅ Provider user: ${user.firstName} ${user.lastName} (${user.email})`);

  const profile = await db.collection('providerprofiles').findOne({
    userId: new mongoose.Types.ObjectId(providerId),
  });
  if (!profile) {
    console.log('❌ PROVIDER PROFILE NOT FOUND for userId:', providerId);
    console.log('   → User exists but has no ProviderProfile. Booking slots require one.');
    console.log('   → Run: npx ts-node src/scripts/fix-missing-provider-profile.ts', SERVICE_ID);
    await mongoose.disconnect();
    return;
  }

  const avail = profile.availability;
  if (!avail?.schedule) {
    console.log('❌ NO availability.schedule on provider profile');
    await mongoose.disconnect();
    return;
  }

  const serviceSchedule = avail.serviceSchedules?.[SERVICE_ID];
  const schedule = serviceSchedule || avail.schedule;
  const scheduleSource = serviceSchedule ? 'service-specific' : 'global';

  console.log(`Schedule source: ${scheduleSource}`);
  const daySchedule = schedule[day];
  console.log(`Day ${day}: isAvailable=${daySchedule?.isAvailable}, slots=${daySchedule?.timeSlots?.length ?? 0}`);

  if (!daySchedule?.isAvailable) {
    console.log(`❌ Day "${day}" is marked unavailable`);
  }

  const slotAnalysis = analyzeSlots(daySchedule?.timeSlots || [], duration);
  console.log('Slot analysis:', JSON.stringify(slotAnalysis, null, 2));

  const merged = mergeConsecutiveRanges(daySchedule?.timeSlots || []);
  const simulated = generateBookableTimesFromRanges(merged, duration, 30);
  console.log(`Simulated bookable slots (backend logic): ${simulated.length}`);
  if (simulated.length > 0) {
    console.log('  Sample:', simulated.slice(0, 8).join(', '));
  } else if ((daySchedule?.timeSlots?.length ?? 0) > 0) {
    console.log('  ⚠️  Schedule has blocks but 0 bookable times for', duration, 'min service');
    console.log('  → Run: npx ts-node src/scripts/fix-missing-provider-profile.ts --all --force-schedule');
  }

  if (daySchedule?.timeSlots?.length) {
    console.log('First 3 slots:', JSON.stringify(daySchedule.timeSlots.slice(0, 3), null, 2));
    console.log('Last 3 slots:', JSON.stringify(daySchedule.timeSlots.slice(-3), null, 2));
  }

  const exceptions = (avail.exceptions || []).filter((ex: any) => {
    const d = ex.date instanceof Date ? ex.date.toISOString().split('T')[0] : String(ex.date).split('T')[0];
    return d === DATE;
  });
  if (exceptions.length) {
    console.log('❌ Date exceptions:', JSON.stringify(exceptions, null, 2));
  }

  const start = new Date(DATE + 'T00:00:00Z');
  const end = new Date(DATE + 'T23:59:59Z');
  const bookings = await db.collection('bookings').find({
    providerId,
    scheduledDate: { $gte: start, $lte: end },
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  }).toArray();
  console.log(`\nBookings on ${DATE}: ${bookings.length}`);

  const settings = await db.collection('settings').findOne({}) ||
    await db.collection('platformsettings').findOne({});
  const minAdvance = settings?.minBookingAdvanceHours ?? 2;
  console.log(`minBookingAdvanceHours: ${minAdvance}`);

  const apiPort = process.env.PORT || 5000;
  const urls = [
    `http://localhost:${apiPort}/api/availability/provider/${providerId}/slots?date=${DATE}&duration=${duration}`,
    `http://localhost:${apiPort}/api/availability/provider/${providerId}/slots?date=${DATE}&duration=${duration}&serviceId=${SERVICE_ID}`,
  ];

  for (const url of urls) {
    console.log(`\nAPI test: GET ${url}`);
    try {
      const res = await fetch(url);
      const json = await res.json() as { data?: { slots?: string[] } };
      const slots = json?.data?.slots || [];
      console.log(`  → ${slots.length} slots returned`);
      if (slots.length > 0) console.log('  Sample:', slots.slice(0, 8));
    } catch (e) {
      console.log('  ⚠️  Could not reach API:', (e as Error).message);
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
