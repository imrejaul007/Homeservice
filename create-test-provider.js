const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/rezz');

// Import models (we'll define them inline for simplicity)
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  phone: String,
  role: String,
  isEmailVerified: Boolean,
  accountStatus: String,
  dateOfBirth: Date,
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastLoginIP: String,
  passwordChangedAt: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  verificationToken: String,
  verificationExpire: Date,
  refreshTokens: [String],
  loyaltySystem: {
    coins: { type: Number, default: 0 },
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    referralCode: String,
    totalReferrals: { type: Number, default: 0 },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    currentStreak: { type: Number, default: 0 },
    pointsHistory: [{
      amount: Number,
      type: String,
      description: String,
      date: { type: Date, default: Date.now },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
    }]
  },
  socialProfiles: {
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    socialMediaLinks: {
      instagram: String,
      facebook: String,
      twitter: String,
      linkedin: String,
      youtube: String,
      tiktok: String
    },
    isPublicProfile: { type: Boolean, default: true },
    profileViews: { type: Number, default: 0 },
    lastActiveAt: Date
  }
}, { timestamps: true });

// Hash password before saving
const bcrypt = require('bcryptjs');
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// JWT methods
const jwt = require('jsonwebtoken');
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      firstName: this.firstName,
      lastName: this.lastName,
      isEmailVerified: this.isEmailVerified,
      accountStatus: this.accountStatus
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '15m' }
  );
};

const providerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  businessInfo: {
    businessName: String,
    businessType: String,
    description: String,
    tagline: String,
    serviceRadius: Number,
    instantBooking: Boolean,
    advanceBookingDays: Number
  },
  locationInfo: {
    primaryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    serviceAreas: [String],
    mobileService: Boolean,
    hasFixedLocation: Boolean
  },
  verificationStatus: {
    overall: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
    identity: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    business: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    background: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: String,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  services: [{
    name: String,
    category: String,
    description: String,
    duration: Number,
    price: {
      amount: Number,
      currency: String,
      type: String
    },
    tags: [String],
    isActive: Boolean,
    images: [String]
  }],
  completionPercentage: { type: Number, default: 0 },
  isProfileComplete: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const ProviderProfile = mongoose.model('ProviderProfile', providerProfileSchema);

async function createTestProvider() {
  try {
    console.log('Creating test provider...');

    // Check if provider already exists
    const existingUser = await User.findOne({ email: 'testprovider@example.com' });
    if (existingUser) {
      console.log('Test provider already exists!');
      console.log('Email: testprovider@example.com');
      console.log('Password: TestProvider123!');
      console.log('User ID:', existingUser._id);

      // Check provider profile
      const profile = await ProviderProfile.findOne({ userId: existingUser._id });
      if (profile) {
        console.log('Provider Profile ID:', profile._id);
        console.log('Verification Status:', profile.verificationStatus.overall);
      }
      return;
    }

    // Create provider user
    const testUser = new User({
      firstName: 'Test',
      lastName: 'Provider',
      email: 'testprovider@example.com',
      password: 'TestProvider123!',
      phone: '+1-555-TEST-123',
      role: 'provider',
      isEmailVerified: true,
      accountStatus: 'active',
      dateOfBirth: new Date('1985-01-01'),
      loyaltySystem: {
        referralCode: 'TEST' + Date.now().toString().slice(-6)
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
        description: 'Professional test services for development and testing purposes.',
        tagline: 'Your trusted test provider',
        serviceRadius: 30,
        instantBooking: false,
        advanceBookingDays: 14
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
        serviceAreas: ['Test City', 'Test County'],
        mobileService: true,
        hasFixedLocation: true
      },
      verificationStatus: {
        overall: 'pending',
        identity: 'pending',
        business: 'pending',
        background: 'pending'
      },
      services: [
        {
          name: 'Test Service 1',
          category: 'Testing',
          description: 'A comprehensive test service for development purposes',
          duration: 120,
          price: { amount: 100, currency: 'USD', type: 'fixed' },
          tags: ['test', 'development'],
          isActive: true,
          images: []
        },
        {
          name: 'Test Service 2',
          category: 'Testing',
          description: 'Another test service for verification testing',
          duration: 90,
          price: { amount: 75, currency: 'USD', type: 'fixed' },
          tags: ['test', 'verification'],
          isActive: true,
          images: []
        }
      ],
      completionPercentage: 100,
      isProfileComplete: true
    });

    await testProviderProfile.save();
    console.log('✅ Provider profile created:', testProviderProfile._id);

    console.log('\n🎉 Test provider created successfully!');
    console.log('📧 Email: testprovider@example.com');
    console.log('🔐 Password: TestProvider123!');
    console.log('👤 User ID:', testUser._id);
    console.log('🏢 Profile ID:', testProviderProfile._id);
    console.log('📊 Verification Status:', testProviderProfile.verificationStatus.overall);

    console.log('\n💡 Next steps:');
    console.log('1. Login with these credentials at http://localhost:3000/login');
    console.log('2. Access provider dashboard at http://localhost:3000/provider/dashboard');
    console.log('3. To approve this provider, use admin panel or API');

  } catch (error) {
    console.error('❌ Error creating test provider:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestProvider();