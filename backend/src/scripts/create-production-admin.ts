#!/usr/bin/env ts-node

/**
 * Production Admin Creation Script
 * Creates admin user directly in production MongoDB Atlas database
 */

import mongoose from 'mongoose';
import User from '../models/user.model';

// Production MongoDB Atlas connection string
const PRODUCTION_DB_URI = 'mongodb+srv://godstrident1_db_user:M1LL04ldcP2yjO5Z@cluster0.shitdwr.mongodb.net/homeservice?retryWrites=true&w=majority&appName=Cluster0';

const createProductionAdmin = async (): Promise<void> => {
  try {
    console.log('🚀 Connecting to production MongoDB Atlas database...\n');

    // Connect directly to production database
    await mongoose.connect(PRODUCTION_DB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to production database successfully\n');

    // Admin credentials
    const adminData = {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@homeservice.com',
      password: 'AdminPassword123!',
      phone: '+1234567890',
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
        tier: 'platinum',
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

      // AI personalization
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
    console.log(`🔐 Password: ${adminData.password}`);
    console.log(`👤 Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`📱 Phone: ${admin.phone}`);
    console.log(`🆔 User ID: ${admin._id}`);
    console.log(`🎫 Referral Code: ${admin.loyaltySystem.referralCode}`);
    console.log('\n🌐 You can now login at: https://homeservice-yucd.onrender.com');

  } catch (error: any) {
    console.error('❌ Error creating production admin:', error.message);

    if (error.message.includes('E11000')) {
      console.log('\n💡 Admin with this email already exists!');
      console.log('🔑 Login credentials:');
      console.log('📧 Email: admin@homeservice.com');
      console.log('🔐 Password: AdminPassword123!');
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