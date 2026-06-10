/**
 * Centralized Subscription Plan Constants
 *
 * This file consolidates all subscription plan pricing and features
 * to prevent confusion from duplicate PLAN_PRICES definitions.
 *
 * Constants are organized by subscription type:
 * - PROVIDER_PLAN_PRICES: For service provider subscriptions (basic, standard, premium, enterprise)
 * - CUSTOMER_PLAN_PRICES: For customer/user subscriptions (free, basic, premium, enterprise)
 * - BEAUTY_PLAN_PRICES: For beauty/salon provider subscriptions (beauty_free, beauty_pro, beauty_premium)
 */

// ============================================
// Provider Plan Constants (Service Providers)
// ============================================

export type ProviderPlanType = 'basic' | 'standard' | 'premium' | 'enterprise';
export type ProviderBillingCycle = 'monthly' | 'yearly';

export const PROVIDER_PLAN_FEATURES = {
  basic: {
    maxServices: 5,
    maxImagesPerService: 3,
    featuredListingEnabled: false,
    prioritySupport: false,
    analyticsAccess: false,
    customBranding: false,
    apiAccess: false,
    commissionRate: 15, // 15% commission
    maxBookingsPerMonth: 50,
    maxCustomers: 100,
  },
  standard: {
    maxServices: 15,
    maxImagesPerService: 5,
    featuredListingEnabled: true,
    prioritySupport: false,
    analyticsAccess: true,
    customBranding: false,
    apiAccess: false,
    commissionRate: 12,
    maxBookingsPerMonth: 200,
    maxCustomers: 500,
  },
  premium: {
    maxServices: 50,
    maxImagesPerService: 10,
    featuredListingEnabled: true,
    prioritySupport: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: false,
    commissionRate: 10,
    maxBookingsPerMonth: 1000,
    maxCustomers: 2000,
  },
  enterprise: {
    maxServices: -1, // Unlimited
    maxImagesPerService: 20,
    featuredListingEnabled: true,
    prioritySupport: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    commissionRate: 8,
    maxBookingsPerMonth: -1, // Unlimited
    maxCustomers: -1, // Unlimited
  },
} as const;

export const PROVIDER_PLAN_PRICES: Record<ProviderBillingCycle, Record<ProviderPlanType, number>> = {
  monthly: {
    basic: 99,
    standard: 299,
    premium: 599,
    enterprise: 1299,
  },
  yearly: {
    basic: 990,
    standard: 2990,
    premium: 5990,
    enterprise: 12990,
  },
} as const;

// ============================================
// Customer Plan Constants (End Users)
// ============================================

export type CustomerPlanType = 'free' | 'basic' | 'premium' | 'enterprise';
export type CustomerBillingCycle = 'monthly' | 'yearly';

export interface CustomerPlanDetails {
  id: CustomerPlanType;
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

export const CUSTOMER_SUBSCRIPTION_PLANS: Record<CustomerPlanType, CustomerPlanDetails> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'AED',
    features: [
      'Basic service browsing',
      'Book appointments',
      'View provider profiles',
      'Basic search filters',
      'Standard customer support',
    ],
    limits: {
      bookingsPerMonth: 2,
      featuredListings: 0,
      commissionDiscount: 0,
      maxAddresses: 1,
      maxPaymentMethods: 1,
      prioritySupport: false,
      exclusiveOffers: false,
      earlyAccess: false,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 29,
    currency: 'AED',
    features: [
      'Everything in Free',
      'Unlimited bookings',
      'Save favorite providers',
      'Receive booking reminders',
      'Email support',
      'View booking history',
    ],
    limits: {
      bookingsPerMonth: -1, // Unlimited
      featuredListings: 0,
      commissionDiscount: 0,
      maxAddresses: 3,
      maxPaymentMethods: 2,
      prioritySupport: false,
      exclusiveOffers: false,
      earlyAccess: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 79,
    currency: 'AED',
    features: [
      'Everything in Basic',
      'Featured listings priority',
      'Exclusive deals & discounts',
      'Priority customer support',
      'Early access to new features',
      'Save unlimited favorites',
      'Share experiences',
    ],
    limits: {
      bookingsPerMonth: -1,
      featuredListings: 3,
      commissionDiscount: 5,
      maxAddresses: 5,
      maxPaymentMethods: 5,
      prioritySupport: true,
      exclusiveOffers: true,
      earlyAccess: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    currency: 'AED',
    features: [
      'Everything in Premium',
      'Dedicated account manager',
      'VIP concierge service',
      'Exclusive partner benefits',
      'Priority provider matching',
      'Custom notifications',
      'Advanced analytics',
    ],
    limits: {
      bookingsPerMonth: -1,
      featuredListings: -1,
      commissionDiscount: 10,
      maxAddresses: -1,
      maxPaymentMethods: -1,
      prioritySupport: true,
      exclusiveOffers: true,
      earlyAccess: true,
    },
  },
};

export const CUSTOMER_PLAN_PRICES: Record<CustomerBillingCycle, Record<CustomerPlanType, number>> = {
  monthly: {
    free: 0,
    basic: 29,
    premium: 79,
    enterprise: 199,
  },
  yearly: {
    free: 0,
    basic: 290,
    premium: 790,
    enterprise: 1990,
  },
} as const;

// Yearly discount percentage
export const CUSTOMER_YEARLY_DISCOUNT_PERCENTAGE = 17; // Approx 2 months free

// ============================================
// Beauty/Salon Plan Constants
// ============================================

export type BeautyPlanType = 'beauty_free' | 'beauty_pro' | 'beauty_premium';

export const BEAUTY_PLANS = {
  FREE: 'beauty_free',
  PRO: 'beauty_pro',
  PREMIUM: 'beauty_premium',
} as const;

export const BEAUTY_COMMISSION_RATES: Record<BeautyPlanType, number> = {
  beauty_free: 20,
  beauty_pro: 15,
  beauty_premium: 12,
};

export const BEAUTY_PLAN_PRICES: Record<BeautyPlanType, { monthly: number; yearly: number }> = {
  beauty_free: { monthly: 0, yearly: 0 },
  beauty_pro: { monthly: 299, yearly: 2990 },
  beauty_premium: { monthly: 799, yearly: 7990 },
};
