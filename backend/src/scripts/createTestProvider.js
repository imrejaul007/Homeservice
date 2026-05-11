const mongoose = require('mongoose');
const User = require('../models/user.model').default;
const ProviderProfile = require('../models/providerProfile.model').default;
require('dotenv').config();

async function createTestProvider() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if test provider already exists
    const existingUser = await User.findOne({ email: 'testprovider@example.com' });
    if (existingUser) {
      console.log('Test provider already exists');
      return;
    }

    // Create test provider user
    const testUser = new User({
      firstName: 'John',
      lastName: 'TestProvider',
      email: 'testprovider@example.com',
      password: 'TestPassword123!',
      phone: '+1234567890',
      role: 'provider',
      isEmailVerified: true,
      accountStatus: 'pending_verification',
      dateOfBirth: new Date('1990-01-01'),
      socialProfiles: {
        followers: [],
        following: [],
        isPublicProfile: true,
        profileViews: 0,
        lastActiveAt: new Date()
      },
      loyaltySystem: {
        coins: 0,
        tier: 'bronze',
        streakDays: 0,
        totalEarned: 0,
        totalSpent: 0,
        pointsHistory: []
      },
      communicationPreferences: {
        email: {
          marketing: false,
          bookingUpdates: true,
          reminders: true,
          newsletters: false,
          promotions: false
        },
        sms: {
          bookingUpdates: true,
          reminders: true,
          promotions: false
        },
        push: {
          bookingUpdates: true,
          reminders: true,
          newMessages: true,
          promotions: false
        },
        language: 'en',
        timezone: 'UTC',
        currency: 'USD'
      },
      aiPersonalization: {
        preferences: {
          preferredServiceTypes: ['Cleaning'],
          preferredProviders: [],
          preferredTimeSlots: [],
          preferredDays: [],
          locationPreference: 'both'
        },
        behaviorData: {
          searchHistory: [],
          bookingPatterns: {
            averageSpend: 0,
            preferredDays: [],
            preferredTimes: [],
            seasonalPreferences: []
          },
          servicePreferences: {
            preferredCategories: ['Cleaning'],
            preferredProviders: [],
            priceRangePreference: { min: 0, max: 500 },
            qualityVsPrice: 'balanced'
          }
        }
      }
    });

    await testUser.save();
    console.log('Test user created:', testUser.email);

    // Create test provider profile
    const testProviderProfile = new ProviderProfile({
      userId: testUser._id,
      businessInfo: {
        businessName: 'John\'s Cleaning Services',
        businessType: 'individual',
        description: 'Professional cleaning services with 5+ years of experience. We provide reliable and thorough cleaning for residential and commercial properties.',
        tagline: 'Clean homes, happy customers',
        serviceRadius: 25,
        instantBooking: false,
        advanceBookingDays: 30,
        businessHours: {
          monday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
          tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
          wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
          thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
          friday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
          saturday: { isOpen: true, openTime: '09:00', closeTime: '16:00' },
          sunday: { isOpen: false }
        }
      },
      instagramStyleProfile: {
        profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        bio: 'Professional cleaner making homes sparkle ✨ 5+ years experience 📍 NYC area',
        isVerified: false,
        verificationBadges: [],
        highlights: [],
        posts: [],
        followersCount: 0,
        followingCount: 0,
        totalLikes: 0,
        engagementRate: 0
      },
      locationInfo: {
        primaryAddress: {
          street: '123 Test Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US',
          coordinates: {
            type: 'Point',
            coordinates: [-74.0060, 40.7128]
          }
        },
        mobileService: true,
        hasFixedLocation: false,
        serviceAreas: [{
          type: 'radius',
          center: {
            lat: 40.7128,
            lng: -74.0060
          },
          radius: 25,
          name: 'NYC Metro Area'
        }]
      },
      services: [{
        name: 'Deep House Cleaning',
        category: 'Cleaning',
        description: 'Complete deep cleaning of all rooms including bathrooms, kitchen, and living areas',
        duration: 180,
        price: {
          amount: 150,
          currency: 'USD',
          type: 'fixed'
        },
        tags: ['residential', 'deep-clean', 'thorough'],
        isActive: true,
        images: []
      }],
      verificationStatus: {
        overall: 'pending',
        identity: {
          status: 'pending',
          documents: []
        },
        business: {
          status: 'pending',
          documents: []
        },
        background: {
          status: 'pending'
        }
      },
      settings: {
        autoAcceptBookings: false,
        instantBookingEnabled: false,
        bufferTime: 15,
        cancellationPolicy: 'flexible',
        maxAdvanceBooking: 90,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        blackoutDates: [],
        pricing: {
          baseRate: 150,
          currency: 'USD',
          emergencyRate: 1.5,
          holidayRate: 1.25
        }
      },
      reviewsData: {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        },
        recentReviews: []
      },
      analytics: {
        performanceMetrics: {
          responseTime: 0,
          completionRate: 0,
          qualityScore: 0,
          customerSatisfaction: 0
        },
        revenueStats: {
          totalEarnings: 0,
          monthlyRevenue: [],
          averageJobValue: 0,
          totalJobs: 0
        },
        bookingStats: {
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          noShowBookings: 0
        }
      },
      isActive: true,
      isDeleted: false,
      isAvailable: true,
      completionPercentage: 75,
      isProfileComplete: false,
      lastActiveAt: new Date()
    });

    await testProviderProfile.save();
    console.log('Test provider profile created:', testProviderProfile.businessInfo.businessName);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test provider:', error);
    process.exit(1);
  }
}

createTestProvider();