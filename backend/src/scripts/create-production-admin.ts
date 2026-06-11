#!/usr/bin/env ts-node

/**
 * Production Admin Creation Script
 * Creates admin user directly in production MongoDB Atlas database
 *
 * SECURITY: All credentials must be provided via environment variables
 *
 * Required Environment Variables:
 * - MONGODB_URI: Production MongoDB connection string
 * - ADMIN_EMAIL: Admin user email
 * - ADMIN_PASSWORD: Admin user password (min 12 chars)
 * - ADMIN_PHONE: Admin user phone number
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="SecurePass123!" npx ts-node scripts/create-production-admin.ts
 */

import mongoose from 'mongoose';
import User from '../models/user.model';
import crypto from 'crypto';

// Validate required environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Super';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'Admin';

function validateEnvironment(): void {
  const missing: string[] = [];

  if (!MONGODB_URI) missing.push('MONGODB_URI');
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (!ADMIN_PHONE) missing.push('ADMIN_PHONE');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\n📖 Usage:');
    console.error('   export MONGODB_URI="your-mongodb-uri"');
    console.error('   export ADMIN_EMAIL="admin@example.com"');
    console.error('   export ADMIN_PASSWORD="YourSecurePassword123!"');
    console.error('   export ADMIN_PHONE="+1234567890"');
    console.error('   npx ts-node scripts/create-production-admin.ts');
    process.exit(1);
  }

  // Validate password strength
  if ((ADMIN_PASSWORD as string).length < 12) {
    console.error('❌ Password must be at least 12 characters long');
    process.exit(1);
  }
}

function generateReferralCode(): string {
  // Generate a secure 8-character referral code
  return 'ADM' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

const createProductionAdmin = async (): Promise<void> => {
  validateEnvironment();

  try {
    console.log('🚀 Connecting to production MongoDB Atlas database...\n');

    // Connect using environment variable
    await mongoose.connect(MONGODB_URI!, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to production database successfully\n');

    // Admin credentials from environment
    const adminData = {
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      email: ADMIN_EMAIL!,
      password: ADMIN_PASSWORD!,
      phone: ADMIN_PHONE!,
      role: 'admin' as const,
      isEmailVerified: true,
      accountStatus: 'active' as const,

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
        tier: 'platinum' as const,
        referralCode: generateReferralCode(),
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

      // AI personalization
      aiPersonalization: {
        preferences: {
          preferredServiceTypes: [],
          preferredProviders: [],
          preferredTimeSlots: [],
          preferredDays: [],
          locationPreference: 'both' as const
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

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: adminData.email,
      role: 'admin'
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists in production database!');
      console.log(`📧 Email: ${existingAdmin.email}`);
      console.log(`🆔 ID: ${existingAdmin._id}`);
      return;
    }

    // Create admin user
    console.log('👑 Creating admin user in production database...');
    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Production admin user created successfully!\n');
    console.log('🔑 **ADMIN CREDENTIALS:**');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔐 Password: [PROVIDED VIA ENVIRONMENT VARIABLE]`);
    console.log(`👤 Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`📱 Phone: ${admin.phone}`);
    console.log(`🆔 User ID: ${admin._id}`);
    console.log(`🎫 Referral Code: ${admin.loyaltySystem.referralCode}`);
    console.log('\n🌐 You can now login at your production URL');

  } catch (error: any) {
    console.error('❌ Error creating production admin:', error.message);

    if (error.message.includes('E11000')) {
      console.log('\n💡 Admin with this email already exists!');
      console.log('🔑 Login with the credentials you provided via environment variables.');
    }
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from production database');
    process.exit(0);
  }
};

// Execute the script
if (require.main === module) {
  createProductionAdmin().catch((error) => {
    console.error('💥 Production admin creation failed:', error);
    process.exit(1);
  });
}

export default createProductionAdmin;
