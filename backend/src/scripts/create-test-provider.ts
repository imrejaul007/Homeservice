import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';

/**
 * Generate a random secure password
 * @returns A random password with 16 characters
 */
const generateSecurePassword = (): string => {
  const length = 16;
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

async function createTestProvider() {
  try {
    console.log('🚀 Creating test provider...');

    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/rezz');
    console.log('✅ Connected to MongoDB');

    // Check if provider already exists
    const existingUser = await User.findOne({ email: 'testprovider@example.com' });
    if (existingUser) {
      console.log('✅ Test provider already exists!');
      console.log('📧 Email: testprovider@example.com');
      console.log('🔐 Password: [Use the password from initial creation or reset via forgot password]');
      console.log('👤 User ID:', existingUser._id);

      // Check provider profile
      const profile = await ProviderProfile.findOne({ userId: existingUser._id });
      if (profile) {
        console.log('🏢 Provider Profile ID:', profile._id);
        console.log('📊 Verification Status:', profile.verificationStatus.overall);

        // Generate auth token for testing
        const token = (existingUser as any).generateAuthToken();
        console.log('🔑 Auth Token (first 50 chars):', token.substring(0, 50) + '...');
      }
      return;
    }

    // Generate secure random password
    const securePassword = generateSecurePassword();

    // Create provider user
    const testUser = new User({
      firstName: 'Test',
      lastName: 'Provider',
      email: 'testprovider@example.com',
      password: securePassword,
      phone: '+15551234567',
      role: 'provider',
      isEmailVerified: true,
      accountStatus: 'active',
      dateOfBirth: new Date('1985-01-01'),
      loyaltySystem: {
        coins: 100,
        tier: 'bronze',
        referralCode: 'TEST' + Date.now().toString().slice(-6),
        totalReferrals: 0,
        currentStreak: 0,
        pointsHistory: []
      },
      socialProfiles: {
        followers: [],
        following: [],
        socialMediaLinks: {},
        isPublicProfile: true,
        profileViews: 0,
        lastActiveAt: new Date()
      }
    });

    await testUser.save();
    console.log('✅ Test user created:', testUser._id);

    // Create provider profile
    const testProviderProfile = new ProviderProfile({
      userId: testUser._id,
      businessInfo: {
        businessName: 'Test Provider Services',
        businessType: 'individual',
        description: 'Professional test services for development and testing purposes. We provide reliable testing solutions.',
        tagline: 'Your trusted test provider',
        website: 'https://testprovider.example.com',
        establishedDate: '2020-01-01',
        serviceRadius: 30,
        instantBooking: false,
        advanceBookingDays: 14,
        businessHours: {
          monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          saturday: { isOpen: true, openTime: '10:00', closeTime: '15:00' },
          sunday: { isOpen: false, openTime: '00:00', closeTime: '00:00' }
        },
        licenseNumbers: ['TEST-LIC-12345'],
        certifications: ['Test Certification', 'Quality Assurance'],
        insuranceInfo: {
          hasLiability: true,
          hasBonding: true,
          provider: 'Test Insurance Co',
          policyNumber: 'TEST-POL-67890'
        }
      },
      locationInfo: {
        primaryAddress: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US',
          coordinates: {
            lat: 40.7128,
            lng: -74.0060
          }
        },
        serviceAreas: ['Test City', 'Test County', 'Test State'],
        mobileService: true,
        hasFixedLocation: true
      },
      verificationStatus: {
        overall: 'pending',
        identity: 'pending',
        business: 'pending',
        background: 'pending',
        adminNotes: 'Test provider created for development purposes',
        submittedAt: new Date(),
        documents: {
          idProof: { submitted: true, verified: false },
          businessLicense: { submitted: true, verified: false },
          insurance: { submitted: true, verified: false }
        }
      },
      services: [
        {
          name: 'Comprehensive Testing Service',
          category: 'Testing',
          subcategory: 'Quality Assurance',
          description: 'Complete testing service including manual and automated testing for web applications',
          shortDescription: 'Professional QA testing services',
          duration: 120,
          price: { amount: 150, currency: 'USD', type: 'fixed' },
          tags: ['testing', 'qa', 'automation', 'manual'],
          isActive: true,
          images: [],
          requirements: ['Access to application', 'Test specifications']
        },
        {
          name: 'Bug Fixing Service',
          category: 'Development',
          subcategory: 'Debugging',
          description: 'Identify and fix bugs in web applications and software systems',
          shortDescription: 'Professional bug fixing',
          duration: 90,
          price: { amount: 100, currency: 'USD', type: 'hourly' },
          tags: ['debugging', 'bug-fix', 'troubleshooting'],
          isActive: true,
          images: [],
          requirements: ['Code access', 'Bug description']
        }
      ],
      portfolio: [
        {
          title: 'E-commerce Testing Project',
          description: 'Complete testing suite for large e-commerce platform',
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
          category: 'Testing',
          isBeforeAfter: false,
          tags: ['e-commerce', 'testing', 'qa'],
          uploadedAt: new Date()
        }
      ],
      ratings: {
        average: 4.8,
        count: 15,
        breakdown: { 5: 12, 4: 2, 3: 1, 2: 0, 1: 0 }
      },
      earnings: {
        totalEarned: 2500,
        availableBalance: 400,
        pendingBalance: 200,
        lastPayout: new Date()
      },
      analytics: {
        profileViews: 150,
        bookingRequests: 25,
        conversionRate: 60,
        repeatCustomers: 8
      },
      completionPercentage: 95,
      isProfileComplete: true,
      socialMediaProfiles: {
        instagram: '@testprovider',
        facebook: 'Test Provider Services',
        linkedin: 'test-provider-services'
      }
    });

    await testProviderProfile.save();
    console.log('✅ Provider profile created:', testProviderProfile._id);

    // Generate auth token for immediate testing
    const authToken = (testUser as any).generateAuthToken();

    console.log('\n🎉 Test provider created successfully!');
    console.log('📧 Email: testprovider@example.com');
    console.log('🔐 Password:', securePassword);
    console.log('👤 User ID:', testUser._id);
    console.log('🏢 Profile ID:', testProviderProfile._id);
    console.log('📊 Verification Status:', testProviderProfile.verificationStatus.overall);
    console.log('🔑 Auth Token (for API testing):', authToken.substring(0, 50) + '...');

    console.log('\n💡 Next steps:');
    console.log('1. Login with these credentials at http://localhost:3000/login');
    console.log('2. Access provider dashboard at http://localhost:3000/provider/dashboard');
    console.log('3. Test service management at http://localhost:3000/provider/services');
    console.log('4. To approve this provider, use: POST /api/admin/providers/' + testProviderProfile._id + '/approve');

    console.log('\n🧪 For API testing:');
    console.log(`curl -H "Authorization: Bearer ${authToken.substring(0, 50)}..." http://localhost:5000/api/provider/services`);

  } catch (error) {
    console.error('❌ Error creating test provider:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createTestProvider();