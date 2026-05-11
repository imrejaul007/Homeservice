import User from '../models/user.model';
import database from '../config/database';

export const createAdminUser = async (): Promise<void> => {
  try {
    console.log('👑 Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: process.env.ADMIN_EMAIL || 'admin@homeservice.com',
      role: 'admin' 
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }

    // Create admin user with enhanced profile
    const adminData = {
      firstName: process.env.ADMIN_FIRST_NAME || 'Super',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@homeservice.com',
      password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
      phone: process.env.ADMIN_PHONE || '+1234567890',
      role: 'admin',
      isEmailVerified: true,
      accountStatus: 'active',
      
      // Social profile setup
      socialProfiles: {
        followers: [],
        following: [],
        isPublicProfile: false,
        profileViews: 0,
        lastActiveAt: new Date()
      },
      
      // Loyalty system initialization
      loyaltySystem: {
        coins: 0,
        tier: 'platinum', // Admin starts with platinum tier
        referralCode: 'ADMIN000',
        streakDays: 0,
        totalEarned: 0,
        totalSpent: 0,
        pointsHistory: []
      },
      
      // Communication preferences
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
      
      // AI personalization (minimal for admin)
      aiPersonalization: {
        preferences: {
          preferredServiceTypes: [],
          preferredProviders: [],
          preferredTimeSlots: [],
          preferredDays: [],
          locationPreference: 'both'
        },
        behaviorData: {
          searchHistory: [],
          bookingPatterns: {
            averageSpend: 0,
            bookingFrequency: 0,
            seasonalPreferences: [],
            timePreferences: []
          },
          interactionHistory: {
            profileViews: [],
            favoriteActions: []
          }
        },
        recommendations: {
          suggestedProviders: [],
          suggestedServices: [],
          personalizedOffers: []
        }
      }
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🆔 ID: ${admin._id}`);
    console.log(`🎫 Referral Code: ${admin.loyaltySystem.referralCode}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await database.connect();
      await createAdminUser();
      console.log('🎉 Admin user creation completed!');
      process.exit(0);
    } catch (error) {
      console.error('💥 Admin user creation failed:', error);
      process.exit(1);
    }
  })();
}