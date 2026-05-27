import { api } from './api';

// ============================================
// Types
// ============================================

export type PlanType = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'expired' | 'trialing';
export type BillingCycle = 'monthly' | 'yearly';
export type MembershipTier = 'standard' | 'silver' | 'gold' | 'platinum' | 'vip';

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  currency: string;
  features: string[];
  limits: {
    bookingsPerMonth?: number;
    featuredListings?: number;
    commissionDiscount?: number;
    maxAddresses?: number;
    maxPaymentMethods?: number;
    prioritySupport?: boolean;
    exclusiveOffers?: boolean;
    earlyAccess?: boolean;
  };
}

export interface Subscription {
  _id: string;
  userId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  stripeSubscriptionId?: string;
  price: number;
  currency: string;
  cancelledAt?: string;
  cancellationReason?: string;
  usage: {
    bookingsThisMonth: number;
    featuredListingsUsed: number;
    totalSpent: number;
  };
  history: Array<{
    plan: PlanType;
    price: number;
    changedAt: string;
    reason?: string;
    changedBy: 'user' | 'admin' | 'system';
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipBenefits {
  featuredListingCredits: number;
  featuredListingDuration: number;
  prioritySupport: boolean;
  priorityResponseTime?: number;
  bookingPriority: boolean;
  exclusiveProviders: boolean;
  commissionDiscount: number;
  cashbackPercentage: number;
  exclusiveDiscounts: boolean;
  earlyAccess: boolean;
  exclusiveEvents: boolean;
  vipConcierge: boolean;
  customNotifications: boolean;
  advancedAnalytics: boolean;
}

export interface FeaturedListing {
  id: string;
  serviceId?: string;
  experienceId?: string;
  title: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  placement?: 'top' | 'featured' | 'category';
}

export interface Membership {
  _id: string;
  userId: string;
  tier: MembershipTier;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  startDate: string;
  endDate: string;
  benefits: MembershipBenefits;
  featuredListings: FeaturedListing[];
  featuredListingCreditsUsed: number;
  totalCashbackEarned: number;
  totalDiscountsReceived: number;
  metrics: {
    totalBookings: number;
    totalSpent: number;
    averageRating: number;
    referralCount: number;
    referralConversions: number;
    exclusiveOffersUsed: number;
    priorityBookings: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UsageStats {
  bookingsThisMonth: number;
  bookingLimit: number;
  featuredListingsUsed: number;
  featuredListingLimit: number;
  isUnderLimit: boolean;
}

export interface BillingHistoryItem {
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoiceUrl?: string;
}

export interface TierUpgradeEligibility {
  currentTier: MembershipTier;
  nextTier: MembershipTier | null;
  requirements: {
    minBookings?: number;
    minSpent?: number;
    minRating?: number;
    referralCount?: number;
  };
  progress: Record<string, number>;
  canUpgrade: boolean;
}

// ============================================
// API Response Types
// ============================================

interface SubscriptionResponse {
  success: boolean;
  data: Subscription;
}

interface MembershipResponse {
  success: boolean;
  data: Membership;
}

interface UsageStatsResponse {
  success: boolean;
  data: UsageStats;
}

interface TierEligibilityResponse {
  success: boolean;
  data: TierUpgradeEligibility;
}

interface SubscriptionListResponse {
  success: boolean;
  data: {
    subscriptions: Subscription[];
    total: number;
    page: number;
    pages: number;
  };
}

interface MembershipListResponse {
  success: boolean;
  data: {
    memberships: Membership[];
    total: number;
    page: number;
    pages: number;
  };
}

interface StatsResponse {
  success: boolean;
  data: {
    byPlan: Record<string, { count: number; totalRevenue: number }>;
    byStatus: Record<string, number>;
    totalSubscriptions: number;
    activeSubscriptions: number;
    mrr: number;
  };
}

// ============================================
// Subscription API Service
// ============================================

class SubscriptionApiService {
  // ========================================
  // Subscription Management
  // ========================================

  /**
   * Get current user's subscription
   */
  async getSubscription(): Promise<SubscriptionResponse> {
    const response = await api.get('/subscriptions/me');
    return response.data;
  }

  /**
   * Get available subscription plans
   */
  async getPlans(): Promise<{ success: boolean; data: SubscriptionPlan[] }> {
    const response = await api.get('/subscriptions/plans');
    return response.data;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: {
    plan: PlanType;
    billingCycle: BillingCycle;
    paymentMethodId?: string;
    trialDays?: number;
  }): Promise<SubscriptionResponse> {
    const response = await api.post('/subscriptions', data);
    return response.data;
  }

  /**
   * Change subscription plan
   */
  async changePlan(
    newPlan: PlanType,
    options?: {
      billingCycle?: BillingCycle;
      immediate?: boolean;
      reason?: string;
    }
  ): Promise<SubscriptionResponse> {
    const response = await api.patch('/subscriptions/plan', {
      plan: newPlan,
      ...options,
    });
    return response.data;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(options?: {
    immediate?: boolean;
    reason?: string;
  }): Promise<SubscriptionResponse> {
    const response = await api.post('/subscriptions/cancel', options || {});
    return response.data;
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(): Promise<SubscriptionResponse> {
    const response = await api.post('/subscriptions/reactivate');
    return response.data;
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(paymentMethodId: string): Promise<SubscriptionResponse> {
    const response = await api.patch('/subscriptions/payment-method', {
      paymentMethodId,
    });
    return response.data;
  }

  // ========================================
  // Usage & Limits
  // ========================================

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStatsResponse> {
    const response = await api.get('/subscriptions/usage');
    return response.data;
  }

  /**
   * Check if user can perform action
   */
  async checkPermission(action: 'booking' | 'featuredListing'): Promise<{
    success: boolean;
    data: { allowed: boolean; reason?: string };
  }> {
    const response = await api.get(`/subscriptions/permissions/${action}`);
    return response.data;
  }

  // ========================================
  // Billing History
  // ========================================

  /**
   * Get billing history
   */
  async getBillingHistory(options?: {
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: {
      subscriptions: Subscription[];
      total: number;
      page: number;
      pages: number;
    };
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = `/subscriptions/history${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  // ========================================
  // Membership Management
  // ========================================

  /**
   * Get current user's membership
   */
  async getMembership(): Promise<MembershipResponse> {
    const response = await api.get('/membership/me');
    return response.data;
  }

  /**
   * Get membership plans/tiers
   */
  async getMembershipTiers(): Promise<{
    success: boolean;
    data: Array<{
      tier: MembershipTier;
      name: string;
      price: number;
      benefits: MembershipBenefits;
      requirements?: {
        minBookings?: number;
        minSpent?: number;
        minRating?: number;
        referralCount?: number;
      };
    }>;
  }> {
    const response = await api.get('/membership/tiers');
    return response.data;
  }

  /**
   * Upgrade membership tier
   */
  async upgradeTier(
    tier: MembershipTier,
    options?: {
      durationDays?: number;
      reason?: string;
    }
  ): Promise<MembershipResponse> {
    const response = await api.post('/membership/upgrade', {
      tier,
      ...options,
    });
    return response.data;
  }

  /**
   * Check tier upgrade eligibility
   */
  async checkTierEligibility(): Promise<TierEligibilityResponse> {
    const response = await api.get('/membership/eligibility');
    return response.data;
  }

  // ========================================
  // Featured Listings
  // ========================================

  /**
   * Get featured listings
   */
  async getFeaturedListings(): Promise<{
    success: boolean;
    data: FeaturedListing[];
  }> {
    const response = await api.get('/membership/featured-listings');
    return response.data;
  }

  /**
   * Add featured listing
   */
  async addFeaturedListing(data: {
    title: string;
    imageUrl?: string;
    serviceId?: string;
    experienceId?: string;
    startDate: string;
    endDate: string;
    placement?: 'top' | 'featured' | 'category';
  }): Promise<{
    success: boolean;
    data: FeaturedListing;
  }> {
    const response = await api.post('/membership/featured-listings', data);
    return response.data;
  }

  /**
   * Cancel featured listing
   */
  async cancelFeaturedListing(listingId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.delete(`/membership/featured-listings/${listingId}`);
    return response.data;
  }

  // ========================================
  // Booking Benefits
  // ========================================

  /**
   * Add booking priority
   */
  async addBookingPriority(
    providerId: string,
    options?: {
      hours?: number;
      reason?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post(`/membership/booking-priority/${providerId}`, options || {});
    return response.data;
  }

  /**
   * Check booking priority
   */
  async checkBookingPriority(providerId: string): Promise<{
    success: boolean;
    data: { hasPriority: boolean };
  }> {
    const response = await api.get(`/membership/booking-priority/${providerId}`);
    return response.data;
  }

  // ========================================
  // Cashback & Discounts
  // ========================================

  /**
   * Get membership transactions
   */
  async getMembershipTransactions(options?: {
    type?: 'credit' | 'debit';
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: {
      transactions: Array<{
        id: string;
        type: 'credit' | 'debit';
        amount: number;
        description: string;
        reference?: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      pages: number;
    };
  }> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = `/membership/transactions${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  // ========================================
  // VIP Concierge
  // ========================================

  /**
   * Submit VIP concierge request
   */
  async submitConciergeRequest(data: {
    type: 'booking' | 'recommendation' | 'special' | 'other';
    description: string;
    preferredDate?: string;
    preferences?: Record<string, any>;
  }): Promise<{
    success: boolean;
    data: {
      requestId: string;
      estimatedResponseTime: string;
    };
  }> {
    const response = await api.post('/membership/concierge', data);
    return response.data;
  }

  // ========================================
  // Admin Endpoints (if user is admin)
  // ========================================

  /**
   * Get all subscriptions (admin)
   */
  async getAllSubscriptions(options?: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
    plan?: PlanType;
  }): Promise<SubscriptionListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.plan) params.append('plan', options.plan);

    const queryString = params.toString();
    const url = `/admin/subscriptions${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get subscription statistics (admin)
   */
  async getStats(): Promise<StatsResponse> {
    const response = await api.get('/admin/subscriptions/stats');
    return response.data;
  }

  /**
   * Get all memberships (admin)
   */
  async getAllMemberships(options?: {
    page?: number;
    limit?: number;
    tier?: MembershipTier;
    status?: string;
  }): Promise<MembershipListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.tier) params.append('tier', options.tier);
    if (options?.status) params.append('status', options.status);

    const queryString = params.toString();
    const url = `/admin/memberships${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get membership statistics (admin)
   */
  async getMembershipStats(): Promise<{
    success: boolean;
    data: {
      byTier: Record<string, { count: number; avgSpent: number; totalCashback: number }>;
      byStatus: Record<string, number>;
      totalMemberships: number;
      activeMemberships: number;
      totalCashbackIssued: number;
      totalDiscountsIssued: number;
    };
  }> {
    const response = await api.get('/admin/memberships/stats');
    return response.data;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const subscriptionApi = new SubscriptionApiService();
export default subscriptionApi;

// ============================================
// Simple API Methods (Nilin)
// ============================================

/**
 * Simple get current subscription - returns the data directly
 */
export async function getSubscription() {
  const response = await api.get('/subscription/current');
  return response.data;
}

/**
 * Simple subscribe to a tier
 */
export async function subscribe(tier: string) {
  const res = await api.post('/subscription/create', { tier });
  return res.data;
}

/**
 * Simple cancel subscription
 */
export async function cancelSubscriptionSimple() {
  const res = await api.post('/subscription/cancel');
  return res.data;
}

/**
 * Simple upgrade subscription
 */
export async function upgradeSubscription(tier: string) {
  const res = await api.post('/subscription/upgrade', { tier });
  return res.data;
}
