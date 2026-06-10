/**
 * Unified Subscription and Membership Types
 *
 * This file consolidates all tier-related types to ensure consistency
 * across the codebase. Previously, tier types were defined differently
 * in each file, causing type mismatches when data flows between components.
 *
 * Tier Systems:
 * - ProviderSubscriptionTier: For provider-facing subscription plans (basic, standard, premium, elite)
 * - CustomerPlanType: For customer-facing subscription plans (free, basic, premium, enterprise)
 * - MembershipTier: For loyalty/membership benefits (standard, silver, gold, platinum, vip)
 * - ApiPlanTier: For API access plans (free, starter, professional, enterprise)
 */

// ============================================
// Provider Subscription Tiers
// ============================================

export type ProviderSubscriptionTier = 'basic' | 'standard' | 'premium' | 'elite';

export const PROVIDER_TIER_ORDER: Record<ProviderSubscriptionTier, number> = {
  basic: 1,
  standard: 2,
  premium: 3,
  elite: 4,
};

export const PROVIDER_TIER_CONFIG: Record<ProviderSubscriptionTier, {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
}> = {
  basic: {
    name: 'Basic',
    description: 'Perfect for starting out',
    monthlyPrice: 0,
    annualPrice: 0,
  },
  standard: {
    name: 'Standard',
    description: 'Grow your business',
    monthlyPrice: 99,
    annualPrice: 89,
  },
  premium: {
    name: 'Premium',
    description: 'For established providers',
    monthlyPrice: 249,
    annualPrice: 199,
  },
  elite: {
    name: 'Elite',
    description: 'Maximum visibility & features',
    monthlyPrice: 499,
    annualPrice: 399,
  },
};

// ============================================
// Customer Subscription Tiers
// ============================================

export type CustomerPlanType = 'free' | 'basic' | 'premium' | 'enterprise';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'expired' | 'trialing';

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

// ============================================
// Membership Tiers (Loyalty/Benefits)
// ============================================

export type MembershipTier = 'standard' | 'silver' | 'gold' | 'platinum' | 'vip';

export const MEMBERSHIP_TIER_ORDER: Record<MembershipTier, number> = {
  standard: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  vip: 5,
};

// ============================================
// API Plan Tiers
// ============================================

export type ApiPlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

// ============================================
// Unified Interfaces
// ============================================

export interface SubscriptionPlan {
  id: ProviderSubscriptionTier;
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
  plan: CustomerPlanType;
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
    plan: CustomerPlanType;
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

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | string;
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  funding?: 'credit' | 'debit' | 'prepaid' | string;
  country?: string;
  isDefault?: boolean;
  source?: 'stripe' | 'local';
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

// Provider Package Subscription Types
export interface PackageBenefit {
  id: string;
  name: string;
  description: string;
  value: number | string;
  icon?: string;
}

export interface ProviderSubscriptionPackage {
  _id: string;
  name: string;
  description: string;
  tier: ProviderSubscriptionTier;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  benefits: PackageBenefit[];
  maxServices: number;
  maxBookings: number;
  maxPhotos: number;
  analyticsAccess: boolean;
  prioritySupport: boolean;
  featuredListing: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  isPopular?: boolean;
}

// ============================================
// Service Package Types (Customer-Facing)
// ============================================

/**
 * Feature type - discriminated union supporting both object and string formats
 * Backend may return features as:
 * - { name: string; included: boolean }[] (object format)
 * - string[] (simple string format)
 */
export type Feature = { name: string; included: boolean } | string;

/**
 * Type guard to check if a feature is an object with name/included properties
 */
export const isFeatureObject = (feature: Feature): feature is { name: string; included: boolean } => {
  return typeof feature === 'object' && feature !== null && 'name' in feature && 'included' in feature;
};

/**
 * Type guard to check if a feature is a plain string
 */
export const isFeatureString = (feature: Feature): feature is string => {
  return typeof feature === 'string';
};

/**
 * Get the display text for a feature (handles both formats)
 */
export const getFeatureText = (feature: Feature): string => {
  return isFeatureObject(feature) ? feature.name : feature;
};

/**
 * Get the included status for a feature (defaults to true for string features)
 */
export const isFeatureIncluded = (feature: Feature): boolean => {
  return isFeatureObject(feature) ? feature.included : true;
};

/**
 * Normalize features array to handle backend inconsistencies
 * Ensures features are always in object format for consistent rendering
 */
export const normalizeFeatures = (features?: Feature[]): Array<{ name: string; included: boolean }> => {
  if (!features) return [];
  return features.map(feature => ({
    name: getFeatureText(feature),
    included: isFeatureIncluded(feature),
  }));
};

/**
 * ServicePackage - Customer-facing service package type
 * Represents packages available for customers to purchase
 */
export interface ServicePackage {
  _id: string;
  id?: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
    discounts?: Array<{
      code: string;
      amount: number;
      type: 'fixed' | 'percentage';
    }>;
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  /** Features can be object format { name, included } or simple strings */
  features?: Feature[];
  /** Raw backend field - may be present instead of features, same type */
  includedItems?: Feature[];
  services: Array<{
    _id: string;
    name: string;
    duration: number;
    price: number;
  }>;
  images?: string[];
  isActive: boolean;
  isFeatured: boolean;
  isPopular?: boolean;
  validity: {
    days: number;
    startDate?: string;
    endDate?: string;
  };
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    avatar?: string;
    rating?: number;
    isVerified?: boolean;
  };
  stats?: {
    totalPurchases: number;
    rating: number;
    reviewCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PackageFilters {
  category?: string;
  subcategory?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minDuration?: number;
  maxDuration?: number;
  featured?: boolean | string;
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'price_desc' | 'duration' | 'popularity' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface PackageResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore?: boolean;
  };
}

export interface PackageStats {
  totalPackages: number;
  totalSavings: number;
  averageRating: number;
  popularCategories: Array<{ category: string; count: number }>;
}

export interface SubscriptionDetails {
  currentTier: ProviderSubscriptionTier;
  billingCycle: BillingCycle;
  currentPeriodEnd: Date;
  autoRenewal: boolean;
  totalSaved: number;
  discountApplied: number;
}

export interface PlanFeatures {
  maxServices: number;
  maxImages: number;
  featuredListing: boolean;
  prioritySupport: boolean;
  analytics: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  commissionRate: number;
  bookingLimit: number;
  leadCredits: number;
  featuredDays: number;
}

export interface ProviderSubscriptionPlan {
  tier: ProviderSubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: PlanFeatures;
  highlighted?: boolean;
  popular?: boolean;
}

// Helper function to get tier order for comparison
export function getProviderTierOrder(tier: ProviderSubscriptionTier): number {
  return PROVIDER_TIER_ORDER[tier];
}

// Helper function to check if upgrading
export function isProviderTierUpgrade(
  currentTier: ProviderSubscriptionTier,
  newTier: ProviderSubscriptionTier
): boolean {
  return PROVIDER_TIER_ORDER[newTier] > PROVIDER_TIER_ORDER[currentTier];
}

// Helper function to check if downgrading
export function isProviderTierDowngrade(
  currentTier: ProviderSubscriptionTier,
  newTier: ProviderSubscriptionTier
): boolean {
  return PROVIDER_TIER_ORDER[newTier] < PROVIDER_TIER_ORDER[currentTier];
}
