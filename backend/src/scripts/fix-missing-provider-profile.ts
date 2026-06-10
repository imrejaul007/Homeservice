/**
 * Fix missing ProviderProfile + availability for services that can't show time slots.
 *
 * Usage:
 *   npx ts-node src/scripts/fix-missing-provider-profile.ts <serviceId>
 *   npx ts-node src/scripts/fix-missing-provider-profile.ts --provider <providerUserId>
 *   npx ts-node src/scripts/fix-missing-provider-profile.ts --all
 *   npx ts-node src/scripts/fix-missing-provider-profile.ts --all --force-schedule
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** Wide range blocks — work for 90+ min services (unlike isolated 30-min cells). */
const createDayRangeBlock = (startHour: number, endHour: number) => ({
  isAvailable: true,
  timeSlots: [{
    startTime: `${startHour.toString().padStart(2, '0')}:00`,
    endTime: `${endHour.toString().padStart(2, '0')}:00`,
    isBooked: false,
    maxBookings: 2,
    currentBookings: 0,
  }],
});

const createDefaultSchedule = () => ({
  monday: createDayRangeBlock(9, 20),
  tuesday: createDayRangeBlock(9, 20),
  wednesday: createDayRangeBlock(9, 20),
  thursday: createDayRangeBlock(9, 20),
  friday: createDayRangeBlock(10, 18),
  saturday: createDayRangeBlock(9, 20),
  sunday: createDayRangeBlock(9, 20),
});

async function ensureProviderProfile(
  providerUserId: string,
  label: string,
  forceSchedule: boolean
): Promise<boolean> {
  const userObjectId = new mongoose.Types.ObjectId(providerUserId);
  const user = await User.findById(userObjectId);

  if (!user) {
    console.log(`  ❌ User not found: ${providerUserId} (${label})`);
    return false;
  }

  let profile = await ProviderProfile.findOne({ userId: userObjectId });

  if (!profile) {
    console.log(`  ➕ Creating ProviderProfile for ${user.firstName} ${user.lastName} (${providerUserId})`);
    profile = await ProviderProfile.create({
      userId: userObjectId,
      tenantId: user.tenantId,
      tier: 'standard',
      businessInfo: {
        businessName: `${user.firstName} ${user.lastName}`.trim() || 'NILIN Provider',
        businessType: 'individual',
        description: 'Professional home service provider on NILIN.',
        tagline: 'Quality services at your doorstep',
        serviceRadius: 25,
        instantBooking: true,
        advanceBookingDays: 30,
      },
      instagramStyleProfile: {
        profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent((user.firstName || 'P') + '+' + (user.lastName || 'R'))}&background=E8A598&color=fff&size=200`,
        bio: 'Professional service provider',
        isVerified: false,
        verificationBadges: [],
        highlights: [],
        posts: [],
        followersCount: 0,
        followingCount: 0,
        totalLikes: 0,
        engagementRate: 0,
      },
      locationInfo: {
        primaryAddress: {
          street: 'Dubai',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '00000',
          country: 'UAE',
          coordinates: { type: 'Point', coordinates: [55.2708, 25.2048] },
        },
        serviceAreas: [{ name: 'Dubai', type: 'city', value: 'Dubai', additionalFee: 0 }],
        travelFee: { baseFee: 0, perKmFee: 0, maxTravelDistance: 25 },
        mobileService: true,
        hasFixedLocation: false,
      },
      verificationStatus: {
        overall: 'pending',
        identity: { status: 'pending', documents: [] },
        business: { status: 'pending', documents: [] },
        background: { status: 'pending' },
      },
      isProfileComplete: true,
      completionPercentage: 80,
      isActive: true,
      isDeleted: false,
    });
    console.log(`  ✅ Created profile ${profile._id}`);
  } else {
    console.log(`  ✅ Profile exists: ${profile._id}`);
  }

  const hasSchedule =
    profile.availability?.schedule &&
    Object.values(profile.availability.schedule).some(
      (day: any) => day?.isAvailable && day?.timeSlots?.length > 0
    );

  if (!hasSchedule || forceSchedule) {
    if (!profile.availability) {
      profile.availability = {} as any;
    }
    profile.availability.schedule = createDefaultSchedule();
    profile.availability.bufferTime = 15;
    profile.availability.maxAdvanceBooking = 30;
    profile.availability.minNoticeTime = 2;
    profile.availability.autoAcceptBookings = true;
    profile.availability.exceptions = profile.availability.exceptions || [];
    await profile.save({ validateBeforeSave: false });
    console.log(
      forceSchedule && hasSchedule
        ? '  ✅ Replaced schedule with range blocks (9 AM – 8 PM) for long services'
        : '  ✅ Set default availability schedule (9 AM – 8 PM range blocks)'
    );
  } else {
    console.log('  ℹ️  Availability schedule already set (use --force-schedule to replace)');
  }

  return true;
}

async function collectProviderIds(serviceId?: string, providerId?: string, all?: boolean): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  if (providerId) {
    map.set(providerId, 'CLI provider arg');
    return map;
  }

  if (serviceId) {
    const service = await Service.findById(serviceId).lean();
    if (!service) throw new Error(`Service not found: ${serviceId}`);
    map.set(String(service.providerId), service.name as string);
    return map;
  }

  if (all) {
    const services = await Service.find({ isActive: true, status: 'active' }).select('providerId name').lean();
    for (const s of services) {
      if (s.providerId) map.set(String(s.providerId), s.name as string);
    }
    return map;
  }

  throw new Error('Pass a serviceId, --provider <id>, or --all');
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const forceSchedule = args.includes('--force-schedule');
  const providerFlag = args.indexOf('--provider');
  const providerId = providerFlag >= 0 ? args[providerFlag + 1] : undefined;
  const serviceId = args.find(
    (a) => !a.startsWith('--') && a !== providerId && a !== '--force-schedule'
  );

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const providers = await collectProviderIds(serviceId, providerId, all);
  console.log(`Checking ${providers.size} provider(s)...\n`);

  let fixed = 0;
  let missing = 0;

  for (const [pid, label] of providers) {
    console.log(`--- ${label} (provider ${pid}) ---`);
    const profileBefore = await ProviderProfile.findOne({ userId: new mongoose.Types.ObjectId(pid) });
    const ok = await ensureProviderProfile(pid, label, forceSchedule);
    if (ok) fixed++;
    else missing++;

    if (!profileBefore && ok) {
      console.log('  → Was missing; now fixed.');
    }
    console.log();
  }

  console.log('='.repeat(60));
  console.log(`Done. Fixed/verified: ${fixed}, still missing user: ${missing}`);
  if (serviceId) {
    console.log(`\nRe-run diagnostic:`);
    console.log(`  npx ts-node src/scripts/diagnose-service-slots.ts ${serviceId}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
