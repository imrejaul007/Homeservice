import mongoose, { Types } from 'mongoose';
import {
  PremiumMembership,
  IMembershipBenefits,
  MembershipTier,
  MEMBERSHIP_TIERS,
  MEMBERSHIP_PRICES,
  TIER_REQUIREMENTS,
  IFeaturedListing,
} from '../models/premiumMembership.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Membership Service
// ============================================

export class MembershipService {
  // ========================================
  // Create / Get Membership
  // ========================================

  /**
   * Create a new membership for a user
   */
  async createMembership(
    userId: string,
    tier: MembershipTier = 'standard',
    options: {
      durationDays?: number;
      stripeCustomerId?: string;
      subscriptionId?: string;
    } = {}
  ): Promise<typeof PremiumMembership.prototype> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    // Check if user already has a membership
    const existingMembership = await PremiumMembership.findByUserId(userId);
    if (existingMembership) {
      throw ApiError.conflict('User already has a membership');
    }

    const { durationDays = 30, stripeCustomerId, subscriptionId } = options;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    const membership = new PremiumMembership({
      userId: new Types.ObjectId(userId),
      tier,
      status: 'active',
      startDate: now,
      endDate,
      benefits: { ...MEMBERSHIP_TIERS[tier] },
      stripeCustomerId,
      subscriptionId,
      featuredListings: [],
      transactions: [],
    });

    await membership.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.MEMBERSHIP_CREATED, {
      membershipId: membership._id,
      userId,
      tier,
    });

    return membership;
  }

  /**
   * Get membership by user ID
   */
  async getMembershipByUserId(userId: string): Promise<typeof PremiumMembership.prototype | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }
    return PremiumMembership.findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'firstName lastName email')
      .populate('featuredListings.serviceId', 'name images')
      .populate('featuredListings.experienceId', 'title images');
  }

  /**
   * Get membership by ID
   */
  async getMembershipById(membershipId: string): Promise<typeof PremiumMembership.prototype | null> {
    if (!Types.ObjectId.isValid(membershipId)) {
      throw ApiError.badRequest('Invalid membership ID');
    }
    return PremiumMembership.findById(membershipId)
      .populate('userId', 'firstName lastName email');
  }

  /**
   * Get or create membership for user
   */
  async getOrCreateMembership(userId: string): Promise<typeof PremiumMembership.prototype> {
    let membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      membership = await this.createMembership(userId, 'standard');
    }
    return membership;
  }

  // ========================================
  // Tier Management
  // ========================================

  /**
   * Upgrade membership tier
   */
  async upgradeTier(
    userId: string,
    newTier: MembershipTier,
    options: {
      durationDays?: number;
      reason?: string;
    } = {}
  ): Promise<typeof PremiumMembership.prototype> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    const currentTierIndex = this.getTierIndex(membership.tier);
    const newTierIndex = this.getTierIndex(newTier);

    if (newTierIndex <= currentTierIndex) {
      throw ApiError.badRequest('Cannot downgrade using upgrade method. Use downgradeTier instead.');
    }

    const { durationDays = 30, reason } = options;

    // Extend end date
    const newEndDate = new Date(membership.endDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    // Update membership
    membership.tier = newTier;
    membership.benefits = { ...MEMBERSHIP_TIERS[newTier] };
    membership.endDate = newEndDate;
    membership.featuredListingCreditsUsed = 0; // Reset on upgrade

    await membership.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.MEMBERSHIP_UPDATED, {
      membershipId: membership._id,
      userId,
      action: 'upgrade',
      fromTier: membership.tier,
      toTier: newTier,
      reason,
    });

    return membership;
  }

  /**
   * Downgrade membership tier
   */
  async downgradeTier(
    userId: string,
    newTier: MembershipTier,
    options: {
      immediate?: boolean;
      reason?: string;
    } = {}
  ): Promise<typeof PremiumMembership.prototype> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    const currentTierIndex = this.getTierIndex(membership.tier);
    const newTierIndex = this.getTierIndex(newTier);

    if (newTierIndex >= currentTierIndex) {
      throw ApiError.badRequest('Cannot upgrade using downgrade method. Use upgradeTier instead.');
    }

    const { immediate = false, reason } = options;

    if (immediate) {
      membership.tier = newTier;
      membership.benefits = { ...MEMBERSHIP_TIERS[newTier] };

      // Cancel active featured listings that exceed new tier limits
      const newCredits = MEMBERSHIP_TIERS[newTier].featuredListingCredits;
      if (newCredits !== -1 && membership.featuredListingCreditsUsed > newCredits) {
        await this.cancelExcessFeaturedListings(membership, newCredits);
      }
    } else {
      // Schedule downgrade at end of period
      // This could be tracked with a pending downgrade flag
    }

    await membership.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.MEMBERSHIP_UPDATED, {
      membershipId: membership._id,
      userId,
      action: 'downgrade',
      fromTier: membership.tier,
      toTier: newTier,
      immediate,
      reason,
    });

    return membership;
  }

  /**
   * Check tier upgrade eligibility
   */
  async checkTierEligibility(userId: string): Promise<{
    currentTier: MembershipTier;
    nextTier: MembershipTier | null;
    requirements: typeof TIER_REQUIREMENTS['gold'];
    progress: Record<string, number>;
    canUpgrade: boolean;
  }> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    const currentTierIndex = this.getTierIndex(membership.tier);
    const tiers: MembershipTier[] = ['standard', 'silver', 'gold', 'platinum', 'vip'];

    // Find next tier
    let nextTier: MembershipTier | null = null;
    for (let i = currentTierIndex + 1; i < tiers.length; i++) {
      nextTier = tiers[i];
      break;
    }

    if (!nextTier) {
      return {
        currentTier: membership.tier,
        nextTier: null,
        requirements: {} as typeof TIER_REQUIREMENTS['gold'],
        progress: {},
        canUpgrade: false,
      };
    }

    const requirements = TIER_REQUIREMENTS[nextTier];
    const progress: Record<string, number> = {};

    // Calculate progress for each requirement
    if (requirements.minBookings) {
      progress.minBookings = Math.min(100, (membership.metrics.totalBookings / requirements.minBookings) * 100);
    }
    if (requirements.minSpent) {
      progress.minSpent = Math.min(100, (membership.metrics.totalSpent / requirements.minSpent) * 100);
    }
    if (requirements.minRating) {
      progress.minRating = Math.min(100, (membership.metrics.averageRating / requirements.minRating) * 100);
    }
    if (requirements.referralCount) {
      progress.referralCount = Math.min(100, (membership.metrics.referralCount / requirements.referralCount) * 100);
    }

    // Check if all requirements are met
    const canUpgrade = this.meetsRequirements(membership, requirements);

    return {
      currentTier: membership.tier,
      nextTier,
      requirements,
      progress,
      canUpgrade,
    };
  }

  // ========================================
  // Featured Listings
  // ========================================

  /**
   * Add a featured listing
   */
  async addFeaturedListing(
    userId: string,
    data: {
      title: string;
      imageUrl?: string;
      serviceId?: string;
      experienceId?: string;
      startDate: Date;
      endDate: Date;
      placement?: 'top' | 'featured' | 'category';
    }
  ): Promise<IFeaturedListing> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    // Check if user has available credits
    if (!membership.hasFeaturedCredits(1)) {
      throw ApiError.badRequest('No featured listing credits available');
    }

    const featuredListing: IFeaturedListing = {
      _id: new Types.ObjectId(),
      title: data.title,
      imageUrl: data.imageUrl || '',
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'pending',
      placement: data.placement || 'featured',
    };

    if (data.serviceId) {
      featuredListing.serviceId = new Types.ObjectId(data.serviceId);
    }
    if (data.experienceId) {
      featuredListing.experienceId = new Types.ObjectId(data.experienceId);
    }

    membership.featuredListings.push(featuredListing);
    await membership.useFeaturedCredit(1);
    await membership.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.FEATURED_LISTING_ADDED, {
      membershipId: membership._id,
      userId,
      listingId: featuredListing._id.toString(),
      title: data.title,
    });

    return featuredListing;
  }

  /**
   * Get user's featured listings
   */
  async getFeaturedListings(userId: string): Promise<IFeaturedListing[]> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      return [];
    }
    return membership.featuredListings;
  }

  /**
   * Cancel a featured listing
   */
  async cancelFeaturedListing(userId: string, listingId: string): Promise<void> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    const listing = membership.featuredListings.find(
      (l: IFeaturedListing) => l._id.toString() === listingId
    );

    if (!listing) {
      throw ApiError.notFound('Featured listing not found');
    }

    if (listing.status === 'cancelled') {
      throw ApiError.badRequest('Listing is already cancelled');
    }

    listing.status = 'cancelled';
    await membership.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.FEATURED_LISTING_CANCELLED, {
      membershipId: membership._id,
      userId,
      listingId,
    });
  }

  /**
   * Get available featured listing credits
   */
  async getAvailableCredits(userId: string): Promise<number> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      return 0;
    }
    return membership.availableFeaturedCredits;
  }

  // ========================================
  // Booking Benefits
  // ========================================

  /**
   * Add booking priority for a provider
   */
  async addBookingPriority(
    userId: string,
    providerId: string,
    options: {
      hours?: number;
      reason?: string;
    } = {}
  ): Promise<void> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    if (!membership.benefits.bookingPriority) {
      throw ApiError.badRequest('Booking priority not available on your tier');
    }

    await membership.addBookingPriority(
      new Types.ObjectId(providerId),
      options.hours || 24,
      options.reason || 'Membership benefit'
    );

    // Emit event
    eventBus.publish(EVENT_TYPES.BOOKING_PRIORITY_ADDED, {
      membershipId: membership._id,
      userId,
      providerId,
    });
  }

  /**
   * Check if user has booking priority
   */
  async hasBookingPriority(userId: string, providerId: string): Promise<boolean> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      return false;
    }
    return membership.hasBookingPriority(new Types.ObjectId(providerId));
  }

  // ========================================
  // Cashback & Discounts
  // ========================================

  /**
   * Calculate cashback for a booking
   */
  async calculateCashback(userId: string, bookingAmount: number): Promise<number> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership || membership.benefits.cashbackPercentage <= 0) {
      return 0;
    }
    return Math.round(bookingAmount * (membership.benefits.cashbackPercentage / 100) * 100) / 100;
  }

  /**
   * Credit cashback to membership
   */
  async creditCashback(
    userId: string,
    amount: number,
    description: string,
    reference?: string
  ): Promise<void> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    await membership.addCashback(amount, description, reference);

    // Emit event
    eventBus.publish(EVENT_TYPES.CASHBACK_CREDITED, {
      membershipId: membership._id,
      userId,
      amount,
      reference,
    });
  }

  /**
   * Calculate discount for a booking
   */
  async calculateDiscount(userId: string, originalAmount: number): Promise<{
    discount: number;
    discountedAmount: number;
    discountPercentage: number;
  }> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership || !membership.benefits.exclusiveDiscounts) {
      return {
        discount: 0,
        discountedAmount: originalAmount,
        discountPercentage: 0,
      };
    }

    // Calculate discount based on membership tier
    const discountPercentage = membership.benefits.commissionDiscount;
    const discount = Math.round(originalAmount * (discountPercentage / 100) * 100) / 100;

    return {
      discount,
      discountedAmount: Math.round((originalAmount - discount) * 100) / 100,
      discountPercentage,
    };
  }

  /**
   * Record discount usage
   */
  async recordDiscountUsage(
    userId: string,
    amount: number,
    description: string
  ): Promise<void> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    await membership.addDiscount(amount, description);

    // Emit event
    eventBus.publish(EVENT_TYPES.DISCOUNT_APPLIED, {
      membershipId: membership._id,
      userId,
      amount,
    });
  }

  // ========================================
  // Metrics Update
  // ========================================

  /**
   * Update membership metrics after a booking
   */
  async updateMetricsAfterBooking(
    userId: string,
    bookingAmount: number,
    rating?: number
  ): Promise<void> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) return;

    membership.metrics.totalBookings += 1;
    membership.metrics.totalSpent += bookingAmount;

    if (typeof rating === 'number' && rating > 0) {
      // Update average rating
      const totalRatings = membership.metrics.averageRating * (membership.metrics.totalBookings - 1);
      membership.metrics.averageRating = (totalRatings + rating) / membership.metrics.totalBookings;
    }

    // Check for tier upgrade eligibility
    const eligibility = await this.checkTierEligibility(userId);
    if (eligibility.canUpgrade && eligibility.nextTier) {
      // Emit upgrade suggestion event
      eventBus.publish(EVENT_TYPES.MEMBERSHIP_UPGRADE_SUGGESTED, {
        membershipId: membership._id,
        userId,
        suggestedTier: eligibility.nextTier,
      });
    }

    await membership.save();
  }

  /**
   * Record referral
   */
  async recordReferral(
    referrerUserId: string,
    referredUserId: string
  ): Promise<void> {
    const membership = await PremiumMembership.findByUserId(referrerUserId);
    if (!membership) return;

    membership.metrics.referralCount += 1;
    await membership.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.REFERRAL_COMPLETED, {
      membershipId: membership._id,
      referrerUserId,
      referredUserId,
    });
  }

  /**
   * Record referral conversion
   */
  async recordReferralConversion(referrerUserId: string): Promise<void> {
    const membership = await PremiumMembership.findByUserId(referrerUserId);
    if (!membership) return;

    membership.metrics.referralConversions += 1;
    await membership.save();
  }

  // ========================================
  // VIP Concierge
  // ========================================

  /**
   * Submit VIP concierge request
   */
  async submitConciergeRequest(
    userId: string,
    request: {
      type: 'booking' | 'recommendation' | 'special' | 'other';
      description: string;
      preferredDate?: Date;
      preferences?: Record<string, any>;
    }
  ): Promise<{ requestId: string; estimatedResponseTime: string }> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    if (!membership.benefits.vipConcierge) {
      throw ApiError.forbidden('VIP concierge service requires VIP tier membership');
    }

    // Track concierge usage
    membership.benefitsUsed.vipConciergeRequestsCount += 1;
    await membership.save();

    // In a real implementation, this would create a support ticket
    // or notify the concierge team
    const requestId = `CON_${Date.now()}`;

    // Emit event
    eventBus.publish(EVENT_TYPES.CONCIERGE_REQUEST, {
      membershipId: membership._id,
      userId,
      requestId,
      type: request.type,
      description: request.description,
    });

    return {
      requestId,
      estimatedResponseTime: '< 1 hour',
    };
  }

  // ========================================
  // Transactions & History
  // ========================================

  /**
   * Get membership transactions
   */
  async getTransactions(
    userId: string,
    options: {
      type?: 'credit' | 'debit';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    transactions: typeof PremiumMembership.prototype.transactions;
    total: number;
    page: number;
    pages: number;
  }> {
    const membership = await PremiumMembership.findByUserId(userId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    let transactions = [...membership.transactions];

    if (options.type) {
      transactions = transactions.filter(t => t.type === options.type);
    }

    // Sort by date descending
    transactions.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    const total = transactions.length;
    const pages = Math.ceil(total / limit);

    return {
      transactions: transactions.slice(skip, skip + limit),
      total,
      page,
      pages,
    };
  }

  // ========================================
  // Admin Operations
  // ========================================

  /**
   * Get all memberships (admin)
   */
  async getAllMemberships(options: {
    page?: number;
    limit?: number;
    tier?: MembershipTier;
    status?: string;
    search?: string;
  } = {}): Promise<{
    memberships: typeof PremiumMembership.prototype[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { page = 1, limit = 20, tier, status } = options;

    const query: any = {};
    if (tier) query.tier = tier;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [memberships, total] = await Promise.all([
      PremiumMembership.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PremiumMembership.countDocuments(query),
    ]);

    return {
      memberships,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get membership statistics (admin)
   */
  async getStats(): Promise<{
    byTier: Record<string, { count: number; avgSpent: number; totalCashback: number }>;
    byStatus: Record<string, number>;
    totalMemberships: number;
    activeMemberships: number;
    totalCashbackIssued: number;
    totalDiscountsIssued: number;
  }> {
    const stats = await PremiumMembership.getStats();
    const totalMemberships = await PremiumMembership.countDocuments();
    const activeMemberships = await PremiumMembership.countDocuments({ status: 'active' });

    const totals = await PremiumMembership.aggregate([
      {
        $group: {
          _id: null,
          totalCashback: { $sum: '$totalCashbackEarned' },
          totalDiscounts: { $sum: '$totalDiscountsReceived' },
        },
      },
    ]);

    return {
      ...stats,
      totalMemberships,
      activeMemberships,
      totalCashbackIssued: totals[0]?.totalCashback || 0,
      totalDiscountsIssued: totals[0]?.totalDiscounts || 0,
    };
  }

  /**
   * Admin update membership
   */
  async adminUpdateMembership(
    membershipId: string,
    updates: {
      tier?: MembershipTier;
      status?: 'active' | 'expired' | 'cancelled' | 'suspended';
      endDate?: Date;
    }
  ): Promise<typeof PremiumMembership.prototype> {
    const membership = await PremiumMembership.findById(membershipId);
    if (!membership) {
      throw ApiError.notFound('Membership not found');
    }

    if (updates.tier) {
      membership.tier = updates.tier;
      membership.benefits = { ...MEMBERSHIP_TIERS[updates.tier] };
    }

    if (updates.status) {
      membership.status = updates.status;
    }

    if (updates.endDate) {
      membership.endDate = updates.endDate;
    }

    await membership.save();
    return membership;
  }

  // ========================================
  // Helper Methods
  // ========================================

  private getTierIndex(tier: MembershipTier): number {
    const tiers: MembershipTier[] = ['standard', 'silver', 'gold', 'platinum', 'vip'];
    return tiers.indexOf(tier);
  }

  private meetsRequirements(
    membership: typeof PremiumMembership.prototype,
    requirements: typeof TIER_REQUIREMENTS['gold']
  ): boolean {
    if (requirements.minBookings && membership.metrics.totalBookings < requirements.minBookings) {
      return false;
    }
    if (requirements.minSpent && membership.metrics.totalSpent < requirements.minSpent) {
      return false;
    }
    if (requirements.minRating && membership.metrics.averageRating < requirements.minRating) {
      return false;
    }
    if (requirements.referralCount && membership.metrics.referralCount < requirements.referralCount) {
      return false;
    }
    return true;
  }

  private async cancelExcessFeaturedListings(
    membership: typeof PremiumMembership.prototype,
    maxCredits: number
  ): Promise<void> {
    let cancelled = 0;
    for (const listing of membership.featuredListings) {
      if (listing.status === 'active' && cancelled < membership.featuredListingCreditsUsed - maxCredits) {
        listing.status = 'cancelled';
        cancelled++;
      }
    }
  }
}

// Export singleton instance
export const membershipService = new MembershipService();
export default membershipService;
