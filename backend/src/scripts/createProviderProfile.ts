import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import { DEFAULT_DUBAI_COORDS } from '../utils/sanitizeProviderGeo';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function createProviderProfile() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email: 'testprovider@example.com' });

  if (!user) {
    console.log('User not found: testprovider@example.com');
    await mongoose.disconnect();
    return;
  }

  const existingProfile = await ProviderProfile.findOne({ userId: user._id });

  if (existingProfile) {
    console.log(`Provider profile already exists for ${user.email}`);
    console.log(`Profile ID: ${existingProfile._id}`);
  } else {
    const profile = await ProviderProfile.create({
      userId: user._id,
      businessInfo: {
        businessName: 'Test Provider Business',
        businessType: 'individual',
        description: 'A test provider account',
        tagline: 'Professional services',
        serviceRadius: 25,
        instantBooking: false,
        advanceBookingDays: 30,
      },
      instagramStyleProfile: {
        bio: 'Professional test provider',
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
          street: 'Test Street',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '00000',
          country: 'AE',
          coordinates: {
            type: 'Point',
            coordinates: DEFAULT_DUBAI_COORDS,
          },
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
      isProfileComplete: false,
      completionPercentage: 0,
    });

    console.log(`Created provider profile for ${user.email}`);
    console.log(`Profile ID: ${profile._id}`);
    console.log(`User ID: ${user._id}`);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

createProviderProfile().catch((err) => {
  console.error(err);
  process.exit(1);
});
