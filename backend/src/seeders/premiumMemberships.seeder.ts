import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import PremiumMembership from '../models/premiumMembership.model';
import User from '../models/user.model';
import database from '../config/database';

/**
 * Premium Membership Tier Data
 * Sample memberships for different user tiers
 */
const PREMIUM_MEMBERSHIP_DATA = [
  {
    tier: 'standard',
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    benefits: {
      featuredListingCredits: 0,
      featuredListingDuration: 0,
      prioritySupport: false,
      bookingPriority: false,
      exclusiveProviders: false,
      commissionDiscount: 0,
      cashbackPercentage: 0,
      exclusiveDiscounts: false,
      earlyAccess: false,
      exclusiveEvents: false,
      vipConcierge: false,
      customNotifications: false,
      advancedAnalytics: false,
    },
  },
  {
    tier: 'silver',
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    benefits: {
      featuredListingCredits: 1,
      featuredListingDuration: 7,
      prioritySupport: false,
      priorityResponseTime: 24,
      bookingPriority: false,
      exclusiveProviders: false,
      commissionDiscount: 2,
      cashbackPercentage: 1,
      exclusiveDiscounts: true,
      earlyAccess: false,
      exclusiveEvents: false,
      vipConcierge: false,
      customNotifications: false,
      advancedAnalytics: false,
    },
  },
  {
    tier: 'gold',
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    benefits: {
      featuredListingCredits: 3,
      featuredListingDuration: 14,
      prioritySupport: true,
      priorityResponseTime: 12,
      bookingPriority: true,
      exclusiveProviders: false,
      commissionDiscount: 5,
      cashbackPercentage: 2,
      exclusiveDiscounts: true,
      earlyAccess: true,
      exclusiveEvents: false,
      vipConcierge: false,
      customNotifications: true,
      advancedAnalytics: false,
    },
  },
  {
    tier: 'platinum',
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    benefits: {
      featuredListingCredits: 5,
      featuredListingDuration: 30,
      prioritySupport: true,
      priorityResponseTime: 4,
      bookingPriority: true,
      exclusiveProviders: true,
      commissionDiscount: 8,
      cashbackPercentage: 3,
      exclusiveDiscounts: true,
      earlyAccess: true,
      exclusiveEvents: true,
      vipConcierge: false,
      customNotifications: true,
      advancedAnalytics: true,
    },
  },
  {
    tier: 'vip',
    status: 'active',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    benefits: {
      featuredListingCredits: -1, // Unlimited
      featuredListingDuration: -1, // Permanent
      prioritySupport: true,
      priorityResponseTime: 1,
      bookingPriority: true,
      exclusiveProviders: true,
      commissionDiscount: 10,
      cashbackPercentage: 5,
      exclusiveDiscounts: true,
      earlyAccess: true,
      exclusiveEvents: true,
      vipConcierge: true,
      customNotifications: true,
      advancedAnalytics: true,
    },
  },
];

export const seedPremiumMemberships = async (): Promise<void> => {
  try {
    console.log('Starting Premium Memberships seeding...');

    // Clear existing memberships
    await PremiumMembership.deleteMany({});
    console.log('Cleared existing premium memberships');

    // Fetch users to associate with memberships
    const users = await User.find({ role: { $in: ['customer', 'provider'] } }).limit(5);

    if (users.length === 0) {
      console.log('No users found. Creating sample memberships without user associations...');

      // Create sample memberships without userId for reference/template purposes
      const sampleMemberships = PREMIUM_MEMBERSHIP_DATA.map((membership) => ({
        ...membership,
        userId: null, // Will need manual assignment
        featuredListings: [],
        featuredListingCreditsUsed: 0,
        bookingPriorities: [],
        transactions: [],
        totalCashbackEarned: 0,
        totalDiscountsReceived: 0,
        metrics: {
          totalBookings: 0,
          totalSpent: 0,
          averageRating: 0,
          referralCount: 0,
          referralConversions: 0,
          exclusiveOffersUsed: 0,
          priorityBookings: 0,
        },
        benefitsUsed: {
          exclusiveOffersUsedCount: 0,
          vipConciergeRequestsCount: 0,
        },
      }));

      await PremiumMembership.insertMany(sampleMemberships);
      console.log('Sample premium membership templates created (without user associations)');
    } else {
      // Create memberships for existing users
      const memberships = users.map((user, index) => {
        const membershipData = PREMIUM_MEMBERSHIP_DATA[index % PREMIUM_MEMBERSHIP_DATA.length];
        return {
          userId: user._id,
          tier: membershipData.tier,
          status: membershipData.status,
          startDate: membershipData.startDate,
          endDate: membershipData.endDate,
          benefits: membershipData.benefits,
          featuredListings: [],
          featuredListingCreditsUsed: 0,
          bookingPriorities: [],
          transactions: [],
          totalCashbackEarned: 0,
          totalDiscountsReceived: 0,
          metrics: {
            totalBookings: Math.floor(Math.random() * 50),
            totalSpent: Math.floor(Math.random() * 5000),
            averageRating: 3.5 + Math.random() * 1.5,
            referralCount: Math.floor(Math.random() * 10),
            referralConversions: Math.floor(Math.random() * 3),
            exclusiveOffersUsed: Math.floor(Math.random() * 5),
            priorityBookings: Math.floor(Math.random() * 10),
          },
          benefitsUsed: {
            exclusiveOffersUsedCount: 0,
            vipConciergeRequestsCount: 0,
          },
        };
      });

      await PremiumMembership.insertMany(memberships);
      console.log(`Premium memberships seeded for ${memberships.length} users`);
    }

    // Log statistics
    const tierStats = await PremiumMembership.aggregate([
      {
        $group: {
          _id: '$tier',
          count: { $sum: 1 },
        },
      },
    ]);

    console.log('\nSeeding Statistics:');
    console.log(`   Total Memberships: ${await PremiumMembership.countDocuments()}`);
    console.log('   By Tier:');
    tierStats.forEach((stat: any) => {
      console.log(`      ${stat._id}: ${stat.count}`);
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error seeding premium memberships:', error);
    throw error;
  }
};

// Seed a specific membership tier for testing
export const seedMembershipByTier = async (tier: string, userId?: string): Promise<void> => {
  try {
    console.log(`Seeding ${tier} membership...`);

    const membershipData = PREMIUM_MEMBERSHIP_DATA.find((m) => m.tier === tier);
    if (!membershipData) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const membership = new PremiumMembership({
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      tier: membershipData.tier,
      status: membershipData.status,
      startDate: membershipData.startDate,
      endDate: membershipData.endDate,
      benefits: membershipData.benefits,
      featuredListings: [],
      featuredListingCreditsUsed: 0,
      bookingPriorities: [],
      transactions: [],
      totalCashbackEarned: 0,
      totalDiscountsReceived: 0,
      metrics: {
        totalBookings: 0,
        totalSpent: 0,
        averageRating: 0,
        referralCount: 0,
        referralConversions: 0,
        exclusiveOffersUsed: 0,
        priorityBookings: 0,
      },
      benefitsUsed: {
        exclusiveOffersUsedCount: 0,
        vipConciergeRequestsCount: 0,
      },
    });

    await membership.save();
    console.log(`${tier} membership seeded successfully`);

  } catch (error) {
    console.error(`Error seeding ${tier} membership:`, error);
    throw error;
  }
};

// Create all tier templates (for reference/display purposes)
export const createTierTemplates = async (): Promise<void> => {
  try {
    console.log('Creating membership tier templates...');

    // Clear existing templates
    await PremiumMembership.deleteMany({ userId: { $eq: null } });

    const templates = PREMIUM_MEMBERSHIP_DATA.map((membership) => ({
      userId: null, // null indicates this is a template
      tier: membership.tier,
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
      benefits: membership.benefits,
      featuredListings: [],
      featuredListingCreditsUsed: 0,
      bookingPriorities: [],
      transactions: [],
      totalCashbackEarned: 0,
      totalDiscountsReceived: 0,
      metrics: {
        totalBookings: 0,
        totalSpent: 0,
        averageRating: 0,
        referralCount: 0,
        referralConversions: 0,
        exclusiveOffersUsed: 0,
        priorityBookings: 0,
      },
      benefitsUsed: {
        exclusiveOffersUsedCount: 0,
        vipConciergeRequestsCount: 0,
      },
    }));

    await PremiumMembership.insertMany(templates);
    console.log('Membership tier templates created successfully');

    // Display tier comparison
    console.log('\nMembership Tier Comparison:');
    templates.forEach((t) => {
      console.log(`\n${t.tier.toUpperCase()}:`);
      console.log(`   Featured Credits: ${t.benefits.featuredListingCredits === -1 ? 'Unlimited' : t.benefits.featuredListingCredits}`);
      console.log(`   Priority Support: ${t.benefits.prioritySupport ? `Yes (<${t.benefits.priorityResponseTime}h)` : 'No'}`);
      console.log(`   Booking Priority: ${t.benefits.bookingPriority ? 'Yes' : 'No'}`);
      console.log(`   Commission Discount: ${t.benefits.commissionDiscount}%`);
      console.log(`   Cashback: ${t.benefits.cashbackPercentage}%`);
      console.log(`   Exclusive Discounts: ${t.benefits.exclusiveDiscounts ? 'Yes' : 'No'}`);
      console.log(`   Early Access: ${t.benefits.earlyAccess ? 'Yes' : 'No'}`);
      console.log(`   VIP Concierge: ${t.benefits.vipConcierge ? 'Yes' : 'No'}`);
      console.log(`   Advanced Analytics: ${t.benefits.advancedAnalytics ? 'Yes' : 'No'}`);
    });

  } catch (error) {
    console.error('Error creating tier templates:', error);
    throw error;
  }
};

// Export membership data for use in other scripts
export const MEMBERSHIP_TIER_DATA = PREMIUM_MEMBERSHIP_DATA;

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await database.connect();

      // Parse command line arguments
      const args = process.argv.slice(2);

      if (args.includes('--templates')) {
        // Create tier templates only
        await createTierTemplates();
      } else if (args.includes('--tier') && args[args.indexOf('--tier') + 1]) {
        // Seed specific tier
        const tier = args[args.indexOf('--tier') + 1];
        const userId = args.includes('--user') ? args[args.indexOf('--user') + 1] : undefined;
        await seedMembershipByTier(tier, userId);
      } else {
        // Full seeding
        await seedPremiumMemberships();
      }

      console.log('\nPremium membership seeding completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}
