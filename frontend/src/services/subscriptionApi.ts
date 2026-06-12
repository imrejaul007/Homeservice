import { api } from './api';

// ============================================
// Types - Re-exported from unified types file
// ============================================

export {
  // Provider subscription tiers
  type ProviderSubscriptionTier,
  PROVIDER_TIER_ORDER,
  PROVIDER_TIER_CONFIG,
  // Customer subscription types
  type CustomerPlanType,
  type SubscriptionStatus,
  type BillingCycle,
  // Membership tiers
  type MembershipTier,
  MEMBERSHIP_TIER_ORDER,
  // API plan tiers
  type ApiPlanTier,
  // Interfaces
  type SubscriptionPlan,
  type Subscription,
  type MembershipBenefits,
  type FeaturedListing,
  type Membership,
  type UsageStats,
  type BillingHistoryItem,
  type TierUpgradeEligibility,
  type PaymentMethod,
} from '../types/subscription.types';

// PlanType is already exported as CustomerPlanType above

import type {
  Subscription,
  Membership,
  UsageStats,
  MembershipTier,
  CustomerPlanType,
  SubscriptionStatus,
  BillingCycle,
  FeaturedListing,
  MembershipBenefits,
  BillingHistoryItem,
  TierUpgradeEligibility,
  PaymentMethod,
} from '../types/subscription.types';

// ============================================
// Invoice Types (for subscription invoices)
// ============================================

export interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  type: 'booking' | 'subscription' | 'refund' | 'adjustment';
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  sentAt?: string;
  notes?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInvoicesResponse {
  success: boolean;
  data: {
    invoices: SubscriptionInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// PlanType is now exported as CustomerPlanType from subscription.types.ts
export { type CustomerPlanType as PlanType } from '../types/subscription.types';

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
// Error Handling Helper
// ============================================

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { response?: { data?: { message?: string; error?: string }; message?: string }; message?: string };
    if (err.response?.data?.message) {
      return String(err.response.data.message);
    }
    if (err.response?.data?.error) {
      return String(err.response.data.error);
    }
    if (err.response?.data) {
      const data = err.response.data as Record<string, unknown>;
      if (data.message) return String(data.message);
      if (data.error) return String(data.error);
    }
    if (err.message) {
      return String(err.message);
    }
  }
  return fallback;
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
  async getSubscription(): Promise<Subscription> {
    try {
      const response = await api.get('/subscriptions/me');
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch subscription'));
    }
  }

  /**
   * Get available subscription plans
   */
  async getPlans(): Promise<Array<{ id: CustomerPlanType; name: string; price: number; currency: string; features: string[]; limits: Record<string, unknown> }>> {
    try {
      const response = await api.get('/subscriptions/plans');
      return (response.data.data || response.data) as Array<{ id: CustomerPlanType; name: string; price: number; currency: string; features: string[]; limits: Record<string, unknown> }>;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch subscription plans'));
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: {
    plan: CustomerPlanType;
    billingCycle: BillingCycle;
    paymentMethodId?: string;
    trialDays?: number;
  }): Promise<Subscription> {
    try {
      const response = await api.post('/subscriptions', data);
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to create subscription'));
    }
  }

  /**
   * Change subscription plan
   */
  async changePlan(
    newPlan: CustomerPlanType,
    options?: {
      billingCycle?: BillingCycle;
      immediate?: boolean;
      reason?: string;
    }
  ): Promise<Subscription> {
    try {
      const response = await api.patch('/subscriptions/plan', {
        plan: newPlan,
        ...options,
      });
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to change subscription plan'));
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(options?: {
    immediate?: boolean;
    reason?: string;
  }): Promise<Subscription> {
    try {
      const response = await api.post('/subscriptions/cancel', options || {});
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to cancel subscription'));
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(): Promise<Subscription> {
    try {
      const response = await api.post('/subscriptions/reactivate');
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to reactivate subscription'));
    }
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(paymentMethodId: string): Promise<Subscription> {
    try {
      const response = await api.patch('/subscriptions/payment-method', {
        paymentMethodId,
      });
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to update payment method'));
    }
  }

  /**
   * Get user's saved payment methods (from Stripe and local storage)
   */
  async getPaymentMethods(): Promise<{
    success: boolean;
    data: {
      paymentMethods: PaymentMethod[];
      defaultMethod: PaymentMethod | null;
      hasStripeCustomer: boolean;
    };
  }> {
    try {
      const response = await api.get('/payments/methods');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch payment methods'));
    }
  }

  // ========================================
  // Usage & Limits
  // ========================================

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStatsResponse> {
    try {
      const response = await api.get('/subscriptions/usage');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch usage statistics'));
    }
  }

  /**
   * Check if user can perform action
   */
  async checkPermission(action: 'booking' | 'featuredListing'): Promise<{
    success: boolean;
    data: { allowed: boolean; reason?: string };
  }> {
    try {
      const response = await api.get(`/subscriptions/permissions/${action}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to check permission'));
    }
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
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const queryString = params.toString();
      const url = `/subscriptions/history${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch billing history'));
    }
  }

  // ========================================
  // Subscription Invoices
  // ========================================

  /**
   * Get invoices for the current user's subscription
   */
  async getInvoices(options?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<SubscriptionInvoicesResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.status) params.append('status', options.status);

      const queryString = params.toString();
      const url = `/subscriptions/invoices${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch invoices'));
    }
  }

  /**
   * Download an invoice as PDF
   */
  async downloadInvoice(invoiceId: string): Promise<Blob> {
    try {
      const response = await api.get(`/subscriptions/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to download invoice'));
    }
  }

  /**
   * Get the PDF URL for an invoice (for opening in new tab)
   */
  async getInvoicePdfUrl(invoiceId: string): Promise<{ url: string; expiresAt: string }> {
    try {
      const response = await api.get(`/subscriptions/invoices/${invoiceId}/pdf-url`);
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to get invoice PDF URL'));
    }
  }

  // ========================================
  // Membership Management
  // ========================================

  /**
   * Get current user's membership
   */
  async getMembership(): Promise<MembershipResponse> {
    try {
      const response = await api.get('/membership/me');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch membership'));
    }
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
    try {
      const response = await api.get('/membership/tiers');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch membership tiers'));
    }
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
    try {
      const response = await api.post('/membership/upgrade', {
        tier,
        ...options,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to upgrade membership tier'));
    }
  }

  /**
   * Check tier upgrade eligibility
   */
  async checkTierEligibility(): Promise<TierEligibilityResponse> {
    try {
      const response = await api.get('/membership/eligibility');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to check tier eligibility'));
    }
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
    try {
      const response = await api.get('/membership/featured-listings');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch featured listings'));
    }
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
    try {
      const response = await api.post('/membership/featured-listings', data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to add featured listing'));
    }
  }

  /**
   * Cancel featured listing
   */
  async cancelFeaturedListing(listingId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await api.delete(`/membership/featured-listings/${listingId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to cancel featured listing'));
    }
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
    try {
      const response = await api.post(`/membership/booking-priority/${providerId}`, options || {});
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to add booking priority'));
    }
  }

  /**
   * Check booking priority
   */
  async checkBookingPriority(providerId: string): Promise<{
    success: boolean;
    data: { hasPriority: boolean };
  }> {
    try {
      const response = await api.get(`/membership/booking-priority/${providerId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to check booking priority'));
    }
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
    try {
      const params = new URLSearchParams();
      if (options?.type) params.append('type', options.type);
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const queryString = params.toString();
      const url = `/membership/transactions${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch membership transactions'));
    }
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
    try {
      const response = await api.post('/membership/concierge', data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to submit concierge request'));
    }
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
    plan?: CustomerPlanType;
  }): Promise<SubscriptionListResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.status) params.append('status', options.status);
      if (options?.plan) params.append('plan', options.plan);

      const queryString = params.toString();
      const url = `/admin/subscriptions${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch all subscriptions'));
    }
  }

  /**
   * Get subscription statistics (admin)
   */
  async getStats(): Promise<StatsResponse> {
    try {
      const response = await api.get('/admin/subscriptions/stats');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch subscription statistics'));
    }
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
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.tier) params.append('tier', options.tier);
      if (options?.status) params.append('status', options.status);

      const queryString = params.toString();
      const url = `/admin/memberships${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch all memberships'));
    }
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
    try {
      const response = await api.get('/admin/memberships/stats');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch membership statistics'));
    }
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
  try {
    const response = await api.get('/subscription/current');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to fetch subscription'));
  }
}

/**
 * Simple subscribe to a tier
 */
export async function subscribe(tier: string) {
  try {
    const res = await api.post('/subscription/create', { tier });
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to subscribe'));
  }
}

/**
 * Simple cancel subscription
 */
export async function cancelSubscriptionSimple() {
  try {
    const res = await api.post('/subscription/cancel');
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to cancel subscription'));
  }
}

/**
 * Simple upgrade subscription
 */
export async function upgradeSubscription(tier: string) {
  try {
    const res = await api.post('/subscription/upgrade', { tier });
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to upgrade subscription'));
  }
}
