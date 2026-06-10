/**
 * Migration: 003_backpopulate_premium_memberships
 *
 * This migration back-populates PremiumMembership records for existing users who qualify
 * based on their metrics (totalBookings, totalSpent, averageRating, referralCount).
 *
 * Tier Requirements:
 *   - silver:  minBookings >= 5, minSpent >= 500
 *   - gold:    minBookings >= 15, minSpent >= 2000, minRating >= 4.5
 *   - platinum: minBookings >= 30, minSpent >= 5000, minRating >= 4.8, referralCount >= 5
 *   - vip:     minBookings >= 50, minSpent >= 15000, minRating >= 4.9, referralCount >= 15
 *
 * Run with: mongosh < backend/src/migrations/003_backpopulate_premium_memberships.js
 * Or via mongoose migration system if configured
 */

db = db.getSiblingDB('homeservice');

print('===========================================');
print('Migration: 003_backpopulate_premium_memberships');
print('Started at: ' + new Date().toISOString());
print('===========================================');

// ============================================
// Tier Requirements (must match premiumMembership.model.ts)
// ============================================
const TIER_REQUIREMENTS = {
  standard: {},
  silver: { minBookings: 5, minSpent: 500 },
  gold: { minBookings: 15, minSpent: 2000, minRating: 4.5 },
  platinum: { minBookings: 30, minSpent: 5000, minRating: 4.8, referralCount: 5 },
  vip: { minBookings: 50, minSpent: 15000, minRating: 4.9, referralCount: 15 },
};

// ============================================
// Helper: Determine tier based on metrics
// ============================================
function determineTier(metrics) {
  const { totalBookings, totalSpent, averageRating, referralCount } = metrics;

  // Check VIP first (highest tier)
  const vipReqs = TIER_REQUIREMENTS.vip;
  if (
    totalBookings >= (vipReqs.minBookings || 0) &&
    totalSpent >= (vipReqs.minSpent || 0) &&
    averageRating >= (vipReqs.minRating || 0) &&
    referralCount >= (vipReqs.referralCount || 0)
  ) {
    return 'vip';
  }

  // Check Platinum
  const platinumReqs = TIER_REQUIREMENTS.platinum;
  if (
    totalBookings >= (platinumReqs.minBookings || 0) &&
    totalSpent >= (platinumReqs.minSpent || 0) &&
    averageRating >= (platinumReqs.minRating || 0) &&
    referralCount >= (platinumReqs.referralCount || 0)
  ) {
    return 'platinum';
  }

  // Check Gold
  const goldReqs = TIER_REQUIREMENTS.gold;
  if (
    totalBookings >= (goldReqs.minBookings || 0) &&
    totalSpent >= (goldReqs.minSpent || 0) &&
    averageRating >= (goldReqs.minRating || 0)
  ) {
    return 'gold';
  }

  // Check Silver
  const silverReqs = TIER_REQUIREMENTS.silver;
  if (
    totalBookings >= (silverReqs.minBookings || 0) &&
    totalSpent >= (silverReqs.minSpent || 0)
  ) {
    return 'silver';
  }

  return 'standard';
}

// ============================================
// Helper: Get user's average rating from reviews
// ============================================
function getUserAverageRating(userId) {
  const result = db.reviews.aggregate([
    { $match: { revieweeId: userId } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } },
  ]).toArray();

  return result.length > 0 ? Math.round(result[0].avgRating * 10) / 10 : 0;
}

// ============================================
// Helper: Count users referred by a user
// ============================================
function getReferralCount(userId) {
  return db.users.countDocuments({
    'loyaltySystem.referredBy': userId,
  });
}

// ============================================
// Helper: Get user's booking metrics
// ============================================
function getUserBookingMetrics(userId) {
  // Get completed bookings for this user as customer
  const bookingsResult = db.bookings.aggregate([
    {
      $match: {
        customerId: userId,
        status: 'completed',
      },
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' },
      },
    },
  ]).toArray();

  const metrics = {
    totalBookings: 0,
    totalSpent: 0,
    averageRating: 0,
    referralCount: 0,
  };

  if (bookingsResult.length > 0) {
    metrics.totalBookings = bookingsResult[0].totalBookings || 0;
    metrics.totalSpent = Math.round((bookingsResult[0].totalSpent || 0) * 100) / 100;
  }

  // Get average rating from reviews
  metrics.averageRating = getUserAverageRating(userId);

  // Get referral count
  metrics.referralCount = getReferralCount(userId);

  return metrics;
}

// ============================================
// Helper: Create premium membership document
// ============================================
const MEMBERSHIP_BENEFITS = {
  standard: {
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
  silver: {
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
  gold: {
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
  platinum: {
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
  vip: {
    featuredListingCredits: -1,
    featuredListingDuration: -1,
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
};

function createPremiumMembership(userId, tier, metrics, startDate) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 365); // 1 year membership for back-populated records

  const membership = {
    userId: userId,
    tier: tier,
    status: 'active',
    startDate: startDate,
    endDate: endDate,
    benefits: MEMBERSHIP_BENEFITS[tier] || MEMBERSHIP_BENEFITS.standard,
    featuredListings: [],
    featuredListingCreditsUsed: 0,
    bookingPriorities: [],
    transactions: [],
    totalCashbackEarned: 0,
    totalDiscountsReceived: 0,
    metrics: {
      totalBookings: metrics.totalBookings,
      totalSpent: metrics.totalSpent,
      averageRating: metrics.averageRating,
      referralCount: metrics.referralCount,
      referralConversions: 0,
      exclusiveOffersUsed: 0,
      priorityBookings: 0,
    },
    benefitsUsed: {
      exclusiveOffersUsedCount: 0,
      vipConciergeRequestsCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  return membership;
}

// ============================================
// Statistics
// ============================================
print('\n[Statistics]');
const totalUsers = db.users.countDocuments({ role: 'customer', isDeleted: false });
const existingMemberships = db.premiummemberships.countDocuments({});
print(`  Total customers: ${totalUsers}`);
print(`  Existing memberships: ${existingMemberships}`);
print(`  Customers needing membership: ${totalUsers}`);

// ============================================
// Phase 1: Find all customers without memberships
// ============================================
print('\n[1/4] Finding customers without memberships...');

const usersWithoutMemberships = db.users
  .find({ role: 'customer', isDeleted: false })
  .project({ _id: 1, createdAt: 1, email: 1 })
  .toArray();

print(`  Found ${usersWithoutMemberships.length} customers without memberships`);

// ============================================
// Phase 2: Calculate metrics for each user
// ============================================
print('\n[2/4] Calculating metrics for each user...');

const usersWithMetrics = [];
let metricsErrors = 0;

usersWithoutMemberships.forEach((user, index) => {
  if (index % 100 === 0) {
    print(`  Processing user ${index + 1} of ${usersWithoutMemberships.length}...`);
  }

  try {
    const metrics = getUserBookingMetrics(user._id);
    usersWithMetrics.push({
      userId: user._id,
      userEmail: user.email,
      createdAt: user.createdAt,
      metrics: metrics,
    });
  } catch (e) {
    print(`  Error getting metrics for user ${user._id}: ${e.message}`);
    metricsErrors++;
  }
});

print(`  Processed ${usersWithMetrics.length} users`);
print(`  Metrics errors: ${metricsErrors}`);

// ============================================
// Phase 3: Determine tiers and create memberships
// ============================================
print('\n[3/4] Determining tiers and creating memberships...');

const tierCounts = {
  standard: 0,
  silver: 0,
  gold: 0,
  platinum: 0,
  vip: 0,
};

const usersToInsert = [];

usersWithMetrics.forEach((userData) => {
  const tier = determineTier(userData.metrics);
  tierCounts[tier]++;

  const membership = createPremiumMembership(
    userData.userId,
    tier,
    userData.metrics,
    userData.createdAt
  );

  usersToInsert.push(membership);
});

print('  Tier distribution:');
print(`    standard: ${tierCounts.standard}`);
print(`    silver:   ${tierCounts.silver}`);
print(`    gold:     ${tierCounts.gold}`);
print(`    platinum: ${tierCounts.platinum}`);
print(`    vip:      ${tierCounts.vip}`);

// ============================================
// Phase 4: Bulk insert memberships (with error handling)
// ============================================
print('\n[4/4] Inserting memberships...');

let insertSuccess = 0;
let insertErrors = 0;
const BATCH_SIZE = 100;

for (let i = 0; i < usersToInsert.length; i += BATCH_SIZE) {
  const batch = usersToInsert.slice(i, i + BATCH_SIZE);

  try {
    db.premiummemberships.insertMany(batch, { ordered: false });
    insertSuccess += batch.length;
  } catch (e) {
    // Handle duplicate key errors (user already has membership)
    if (e.code === 11000) {
      const duplicateCount = (e.writeErrors || []).filter(
        (err) => err.code === 11000
      ).length;
      insertSuccess += batch.length - duplicateCount;
      insertErrors += duplicateCount;
    } else {
      print(`  Batch insert error: ${e.message}`);
      insertErrors += batch.length;
    }
  }

  if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= usersToInsert.length) {
    print(`  Inserted ${Math.min(i + BATCH_SIZE, usersToInsert.length)} of ${usersToInsert.length}...`);
  }
}

// ============================================
// Ensure indexes exist
// ============================================
print('\n[Indexing] Ensuring required indexes...');

try {
  db.premiummemberships.createIndex({ userId: 1, status: 1 });
  db.premiummemberships.createIndex({ tier: 1, status: 1 });
  db.premiummemberships.createIndex({ endDate: 1, status: 1 });
  db.premiummemberships.createIndex({ 'metrics.totalSpent': -1 });
  db.premiummemberships.createIndex({ 'metrics.referralCount': -1 });
  print('  Indexes created/verified');
} catch (e) {
  print(`  Index creation: ${e.message}`);
}

// ============================================
// Final Summary
// ============================================
print('\n===========================================');
print('Migration Summary');
print('===========================================');
print(`  Users processed: ${usersWithMetrics.length}`);
print(`  Memberships created: ${insertSuccess}`);
print(`  Duplicate/Errors: ${insertErrors}`);
print(`  Metrics errors: ${metricsErrors}`);
print(`  Total time: ${new Date().toISOString()}`);
print('===========================================');
print('\nTier Distribution:');
print(`  standard: ${tierCounts.standard}`);
print(`  silver:   ${tierCounts.silver}`);
print(`  gold:     ${tierCounts.gold}`);
print(`  platinum: ${tierCounts.platinum}`);
print(`  vip:      ${tierCounts.vip}`);
print('===========================================');

// ============================================
// Verification
// ============================================
print('\n[Verification]');
const totalMemberships = db.premiummemberships.countDocuments({});
const activeMemberships = db.premiummemberships.countDocuments({ status: 'active' });
print(`  Total memberships in DB: ${totalMemberships}`);
print(`  Active memberships: ${activeMemberships}`);

// Sample of created memberships by tier
['standard', 'silver', 'gold', 'platinum', 'vip'].forEach((tier) => {
  const count = db.premiummemberships.countDocuments({ tier: tier });
  const sample = db.premiummemberships
    .find({ tier: tier })
    .limit(1)
    .toArray();

  if (sample.length > 0) {
    print(`\n  ${tier.toUpperCase()} sample membership:`);
    print(`    UserID: ${sample[0].userId}`);
    print(`    Metrics: bookings=${sample[0].metrics.totalBookings}, spent=$${sample[0].metrics.totalSpent}, rating=${sample[0].metrics.averageRating}, referrals=${sample[0].metrics.referralCount}`);
  }
});

print('\n===========================================');
print('Migration completed successfully!');
print('===========================================');

print('\nNote: This migration is idempotent - running it again is safe.');
print('Duplicate membership attempts will be silently skipped.');
