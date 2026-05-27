/**
 * Finance Calculations Service
 * Handles provider earnings, commission calculations, and payout schedules
 */

import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import BeautyPlan from '../models/beautyPlan.model';
import Subscription from '../models/subscription.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

export type ProviderPlan = 'beauty_free' | 'beauty_pro' | 'beauty_premium' | 'basic' | 'standard' | 'premium' | 'enterprise';

export interface ProviderEarnings {
  grossAmount: number;
  platformCommission: number;
  commissionRate: number;
  couponDiscount: number;
  couponCost: number; // Platform absorbs part of coupon
  netEarnings: number;
  payoutAmount: number;
  payoutDate: Date;
  breakdown: {
    baseAmount: number;
    addOnsAmount: number;
    tax: number;
    totalBeforeDiscount: number;
    discountApplied: number;
  };
}

export interface PayoutSummary {
  providerId: string;
  totalEarnings: number;
  totalCommission: number;
  totalPayoutAmount: number;
  pendingPayout: number;
  lastPayoutDate: Date | null;
  nextPayoutDate: Date;
  currency: string;
  periodBreakdown: Array<{
    period: string;
    earnings: number;
    commission: number;
    payout: number;
    bookingCount: number;
  }>;
}

export interface PlatformFees {
  totalRevenue: number;
  totalCommission: number;
  averageCommissionRate: number;
  couponCosts: number;
  netPlatformRevenue: number;
  breakdown: {
    byStatus: Record<string, { count: number; amount: number; commission: number }>;
    byPlan: Record<string, { count: number; amount: number; commission: number }>;
    byService: Array<{ serviceId: string; serviceName: string; count: number; amount: number; commission: number }>;
  };
}

export interface PayoutSchedule {
  providerId: string;
  plan: ProviderPlan;
  payoutFrequency: 'daily' | 'weekly' | 'monthly';
  minimumPayout: number;
  nextPayoutDate: Date;
  pendingAmount: number;
}

// ============================================
// Commission Configuration
// ============================================

interface CommissionConfig {
  rate: number;
  minPayout: number;
  payoutFrequency: 'daily' | 'weekly' | 'monthly';
}

const COMMISSION_TIERS: Record<ProviderPlan, CommissionConfig> = {
  beauty_free: { rate: 20, minPayout: 100, payoutFrequency: 'weekly' },
  beauty_pro: { rate: 15, minPayout: 50, payoutFrequency: 'weekly' },
  beauty_premium: { rate: 12, minPayout: 0, payoutFrequency: 'daily' },
  basic: { rate: 15, minPayout: 100, payoutFrequency: 'weekly' },
  standard: { rate: 12, minPayout: 50, payoutFrequency: 'weekly' },
  premium: { rate: 10, minPayout: 0, payoutFrequency: 'daily' },
  enterprise: { rate: 8, minPayout: 0, payoutFrequency: 'daily' },
};

// Platform coupon absorption rate (percentage of discount platform covers)
const PLATFORM_COUPON_ABSORPTION_RATE = 0.5; // Platform covers 50% of coupon discount

// ============================================
// Helper Functions
// ============================================

/**
 * Get the commission rate for a provider based on their plan
 * Uses platform settings for default commission rate
 */
async function getProviderCommissionRate(providerId: string | Types.ObjectId): Promise<CommissionConfig> {
  const pid = providerId instanceof Types.ObjectId ? providerId.toString() : providerId;

  // Get platform settings for default commission rate
  let platformDefaultRate = 15; // Default fallback
  let platformMinPayout = 50;

  try {
    const { getSetting } = await import('./settings.service');
    platformDefaultRate = await getSetting('commissionRate') || 15;
    platformMinPayout = await getSetting('minimumWithdrawalAmount') || 50;
  } catch (error) {
    logger.warn('Failed to get platform settings for commission rate, using defaults', {
      context: 'FinanceService',
      action: 'SETTINGS_FALLBACK',
      providerId: pid?.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // First check beauty plan
  const beautyPlan = await BeautyPlan.findOne({ providerId: pid });
  if (beautyPlan) {
    const tierConfig = COMMISSION_TIERS[beautyPlan.plan as ProviderPlan];
    if (tierConfig) {
      // Use tier-specific rate if set, otherwise use platform default
      return {
        ...tierConfig,
        rate: tierConfig.rate > 0 ? tierConfig.rate : platformDefaultRate,
        minPayout: tierConfig.minPayout > 0 ? tierConfig.minPayout : platformMinPayout
      };
    }
    return {
      rate: platformDefaultRate,
      minPayout: platformMinPayout,
      payoutFrequency: 'weekly'
    };
  }

  // Then check subscription plan
  const subscription = await Subscription.findOne({ providerId: pid });
  if (subscription) {
    const tierConfig = COMMISSION_TIERS[subscription.plan as ProviderPlan];
    if (tierConfig) {
      return {
        ...tierConfig,
        rate: tierConfig.rate > 0 ? tierConfig.rate : platformDefaultRate,
        minPayout: tierConfig.minPayout > 0 ? tierConfig.minPayout : platformMinPayout
      };
    }
  }

  // Default to free plan with platform default rate
  return {
    rate: platformDefaultRate,
    minPayout: platformMinPayout,
    payoutFrequency: 'weekly'
  };
}

/**
 * Calculate the next payout date based on plan and frequency
 */
function calculateNextPayoutDate(plan: ProviderPlan, fromDate: Date = new Date()): Date {
  const config = COMMISSION_TIERS[plan];
  const date = new Date(fromDate);

  switch (config.payoutFrequency) {
    case 'daily':
      // Next day
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
      break;

    case 'weekly':
      // Next Monday
      const dayOfWeek = date.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      date.setDate(date.getDate() + daysUntilMonday);
      date.setHours(0, 0, 0, 0);
      break;

    case 'monthly':
      // First day of next month
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      break;
  }

  return date;
}

/**
 * Round to 2 decimal places for currency
 */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ============================================
// Main Service Functions
// ============================================

/**
 * Calculate provider earnings for a completed booking
 */
export async function calculateProviderEarnings(
  bookingId: string,
  providerPlan?: ProviderPlan
): Promise<ProviderEarnings> {
  // Validate booking ID
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(400, 'Invalid booking ID');
  }

  // Fetch booking with populated pricing
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Only completed bookings generate earnings
  if (booking.status !== 'completed') {
    throw new ApiError(400, 'Only completed bookings have calculated earnings');
  }

  // Get commission config
  const plan = providerPlan || 'beauty_free';
  const commissionConfig = await getProviderCommissionRate(booking.providerId);

  // Override with provided plan if specified
  const effectiveConfig = COMMISSION_TIERS[plan] || commissionConfig;

  // Extract pricing components
  const baseAmount = booking.pricing.basePrice || 0;
  const addOnsAmount = (booking.pricing.addOns || []).reduce(
    (sum: number, addon: { name: string; price: number }) => sum + (addon.price || 0),
    0
  );
  const tax = booking.pricing.tax || 0;
  const subtotal = booking.pricing.subtotal || baseAmount + addOnsAmount;
  const totalBeforeDiscount = subtotal + tax;

  // Calculate discount from booking
  const discountApplied = (booking.pricing.discounts || []).reduce(
    (sum: number, discount: { type: string; amount: number; description: string }) => sum + (discount.amount || 0),
    0
  );

  // Get coupon discount if any
  let couponDiscount = 0;
  let couponCost = 0;

  for (const discount of booking.pricing.discounts || []) {
    if (discount.type === 'coupon') {
      couponDiscount = discount.amount || 0;
      // Platform absorbs 50% of coupon cost
      couponCost = roundCurrency(couponDiscount * PLATFORM_COUPON_ABSORPTION_RATE);
    }
  }

  // Calculate gross amount (before platform cut)
  const grossAmount = roundCurrency(totalBeforeDiscount - discountApplied);

  // Calculate platform commission (applied after coupon, platform absorbs part)
  const commissionableAmount = grossAmount - couponCost;
  const platformCommission = roundCurrency(commissionableAmount * (effectiveConfig.rate / 100));

  // Calculate net earnings
  const netEarnings = roundCurrency(grossAmount - platformCommission);

  // Check minimum payout threshold
  let payoutAmount = netEarnings;
  if (netEarnings < effectiveConfig.minPayout && effectiveConfig.minPayout > 0) {
    // Amount is below minimum, will be held for next payout cycle
    payoutAmount = 0;
  }

  // Calculate payout date
  const payoutDate = calculateNextPayoutDate(plan);

  return {
    grossAmount,
    platformCommission,
    commissionRate: effectiveConfig.rate,
    couponDiscount,
    couponCost,
    netEarnings,
    payoutAmount,
    payoutDate,
    breakdown: {
      baseAmount,
      addOnsAmount,
      tax,
      totalBeforeDiscount,
      discountApplied,
    },
  };
}

/**
 * Calculate provider earnings from a booking object directly
 */
export async function calculateProviderEarningsFromBooking(
  booking: any,
  providerPlan?: ProviderPlan
): Promise<ProviderEarnings> {
  // Get commission config
  const plan = providerPlan || 'beauty_free';
  const commissionConfig = await getProviderCommissionRate(booking.providerId);
  const effectiveConfig = COMMISSION_TIERS[plan] || commissionConfig;

  // Extract pricing components
  const baseAmount = booking.pricing?.basePrice || 0;
  const addOnsAmount = (booking.pricing?.addOns || []).reduce(
    (sum: number, addon: { name: string; price: number }) => sum + (addon.price || 0),
    0
  );
  const tax = booking.pricing?.tax || 0;
  const subtotal = booking.pricing?.subtotal || baseAmount + addOnsAmount;
  const totalBeforeDiscount = subtotal + tax;

  // Calculate discount from booking
  const discountApplied = (booking.pricing?.discounts || []).reduce(
    (sum: number, discount: { type: string; amount: number; description: string }) => sum + (discount.amount || 0),
    0
  );

  // Get coupon discount if any
  let couponDiscount = 0;
  let couponCost = 0;

  for (const discount of booking.pricing?.discounts || []) {
    if (discount.type === 'coupon') {
      couponDiscount = discount.amount || 0;
      couponCost = roundCurrency(couponDiscount * PLATFORM_COUPON_ABSORPTION_RATE);
    }
  }

  // Calculate gross amount
  const grossAmount = roundCurrency(totalBeforeDiscount - discountApplied);

  // Calculate platform commission
  const commissionableAmount = grossAmount - couponCost;
  const platformCommission = roundCurrency(commissionableAmount * (effectiveConfig.rate / 100));

  // Calculate net earnings
  const netEarnings = roundCurrency(grossAmount - platformCommission);

  // Check minimum payout threshold
  let payoutAmount = netEarnings;
  if (netEarnings < effectiveConfig.minPayout && effectiveConfig.minPayout > 0) {
    payoutAmount = 0;
  }

  const payoutDate = calculateNextPayoutDate(plan);

  return {
    grossAmount,
    platformCommission,
    commissionRate: effectiveConfig.rate,
    couponDiscount,
    couponCost,
    netEarnings,
    payoutAmount,
    payoutDate,
    breakdown: {
      baseAmount,
      addOnsAmount,
      tax,
      totalBeforeDiscount,
      discountApplied,
    },
  };
}

/**
 * Calculate payout schedule for a provider
 */
export async function calculatePayoutSchedule(providerId: string): Promise<PayoutSchedule> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID');
  }

  // Get provider's plan
  const commissionConfig = await getProviderCommissionRate(providerId);

  // Find provider plan
  let plan: ProviderPlan = 'beauty_free';
  const beautyPlan = await BeautyPlan.findOne({ providerId });
  if (beautyPlan) {
    plan = beautyPlan.plan as ProviderPlan;
  } else {
    const subscription = await Subscription.findOne({ providerId });
    if (subscription) {
      plan = subscription.plan as ProviderPlan;
    }
  }

  // Get provider profile for pending amount
  const providerProfile = await ProviderProfile.findOne({ userId: providerId }).lean();
  const pendingAmount = providerProfile?.financials?.payout?.pendingAmount || 0;

  // Calculate next payout date
  const nextPayoutDate = calculateNextPayoutDate(plan);

  return {
    providerId,
    plan,
    payoutFrequency: commissionConfig.payoutFrequency,
    minimumPayout: commissionConfig.minPayout,
    nextPayoutDate,
    pendingAmount: roundCurrency(pendingAmount),
  };
}

/**
 * Calculate platform fees from a list of bookings
 */
export async function calculatePlatformFees(
  bookings: any[],
  options?: {
    startDate?: Date;
    endDate?: Date;
    providerId?: string;
    serviceId?: string;
    status?: string;
  }
): Promise<PlatformFees> {
  // Build query if options provided
  let bookingDocs = bookings;

  if (options) {
    const query: any = {};

    if (options.startDate || options.endDate) {
      query.scheduledDate = {};
      if (options.startDate) query.scheduledDate.$gte = options.startDate;
      if (options.endDate) query.scheduledDate.$lte = options.endDate;
    }

    if (options.providerId) query.providerId = new Types.ObjectId(options.providerId);
    if (options.serviceId) query.serviceId = new Types.ObjectId(options.serviceId);
    if (options.status) query.status = options.status;

    bookingDocs = await Booking.find(query).populate('provider service').lean();
  }

  // Filter to only completed bookings
  const completedBookings = bookingDocs.filter((b) => b.status === 'completed');

  // Initialize totals
  let totalRevenue = 0;
  let totalCommission = 0;
  let couponCosts = 0;

  const byStatus: Record<string, { count: number; amount: number; commission: number }> = {};
  const byPlan: Record<string, { count: number; amount: number; commission: number }> = {};
  const byService: Record<string, { serviceId: string; serviceName: string; count: number; amount: number; commission: number }> = {};

  // Process each booking
  for (const booking of completedBookings) {
    const baseAmount = booking.pricing?.basePrice || 0;
    const addOnsAmount = (booking.pricing?.addOns || []).reduce(
      (sum: number, addon: { name: string; price: number }) => sum + (addon.price || 0),
      0
    );
    const tax = booking.pricing?.tax || 0;
    const discount = (booking.pricing?.discounts || []).reduce(
      (sum: number, d: { amount: number }) => sum + (d.amount || 0),
      0
    );

    const subtotal = baseAmount + addOnsAmount;
    const totalBeforeDiscount = subtotal + tax;
    const grossAmount = roundCurrency(totalBeforeDiscount - discount);

    // Calculate coupon cost
    let couponCost = 0;
    for (const d of booking.pricing?.discounts || []) {
      if (d.type === 'coupon') {
        couponCost = roundCurrency((d.amount || 0) * PLATFORM_COUPON_ABSORPTION_RATE);
      }
    }

    // Get commission rate
    const config = await getProviderCommissionRate(booking.providerId);
    const commissionableAmount = grossAmount - couponCost;
    const commission = roundCurrency(commissionableAmount * (config.rate / 100));

    // Update totals
    totalRevenue += grossAmount;
    totalCommission += commission;
    couponCosts += couponCost;

    // By status
    const status = booking.status;
    if (!byStatus[status]) {
      byStatus[status] = { count: 0, amount: 0, commission: 0 };
    }
    byStatus[status].count++;
    byStatus[status].amount += grossAmount;
    byStatus[status].commission += commission;

    // By plan
    const planName = config.payoutFrequency + '_' + config.minPayout;
    if (!byPlan[planName]) {
      byPlan[planName] = { count: 0, amount: 0, commission: 0 };
    }
    byPlan[planName].count++;
    byPlan[planName].amount += grossAmount;
    byPlan[planName].commission += commission;

    // By service
    const serviceId = booking.serviceId?.toString() || 'unknown';
    const serviceName = (booking.service as any)?.name || 'Unknown Service';
    if (!byService[serviceId]) {
      byService[serviceId] = { serviceId, serviceName, count: 0, amount: 0, commission: 0 };
    }
    byService[serviceId].count++;
    byService[serviceId].amount += grossAmount;
    byService[serviceId].commission += commission;
  }

  // Calculate average commission rate
  const averageCommissionRate = totalRevenue > 0
    ? roundCurrency((totalCommission / totalRevenue) * 100)
    : 0;

  return {
    totalRevenue: roundCurrency(totalRevenue),
    totalCommission: roundCurrency(totalCommission),
    averageCommissionRate,
    couponCosts: roundCurrency(couponCosts),
    netPlatformRevenue: roundCurrency(totalCommission - couponCosts),
    breakdown: {
      byStatus,
      byPlan,
      byService: Object.values(byService).sort((a, b) => b.commission - a.commission),
    },
  };
}

/**
 * Get provider payout summary for a date range
 */
export async function getProviderPayoutSummary(
  providerId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    includePending?: boolean;
  }
): Promise<PayoutSummary> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new ApiError(400, 'Invalid provider ID');
  }

  // Get commission config
  const commissionConfig = await getProviderCommissionRate(providerId);

  // Find provider plan
  let plan: ProviderPlan = 'beauty_free';
  const beautyPlan = await BeautyPlan.findOne({ providerId });
  if (beautyPlan) {
    plan = beautyPlan.plan as ProviderPlan;
  } else {
    const subscription = await Subscription.findOne({ providerId });
    if (subscription) {
      plan = subscription.plan as ProviderPlan;
    }
  }

  // Build query for bookings
  const query: any = {
    providerId: new Types.ObjectId(providerId),
    status: 'completed',
  };

  if (options?.startDate || options?.endDate) {
    query.scheduledDate = {};
    if (options.startDate) query.scheduledDate.$gte = options.startDate;
    if (options.endDate) query.scheduledDate.$lte = options.endDate;
  }

  // Fetch completed bookings
  const bookings = await Booking.find(query).lean();

  // Calculate totals - parallel processing to avoid N+1
  const earningsResults = await Promise.all(
    bookings.map(booking => calculateProviderEarningsFromBooking(booking, plan))
  );

  // Aggregate results
  let totalEarnings = 0;
  let totalCommission = 0;
  let totalPayoutAmount = 0;

  const periodBreakdown: PayoutSummary['periodBreakdown'] = [];

  // Group by period (week or month based on payout frequency)
  const earningsByPeriod: Record<string, { earnings: number; commission: number; bookingCount: number }> = {};

  for (let i = 0; i < bookings.length; i++) {
    const earnings = earningsResults[i];
    const booking = bookings[i];

    totalEarnings += earnings.grossAmount;
    totalCommission += earnings.platformCommission;
    totalPayoutAmount += earnings.payoutAmount;

    // Group by period
    const bookingDate = new Date(booking.scheduledDate);
    let period: string;

    if (commissionConfig.payoutFrequency === 'monthly') {
      period = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Weekly - use ISO week
      const weekNum = getWeekNumber(bookingDate);
      period = `${bookingDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }

    if (!earningsByPeriod[period]) {
      earningsByPeriod[period] = { earnings: 0, commission: 0, bookingCount: 0 };
    }

    earningsByPeriod[period].earnings += earnings.netEarnings;
    earningsByPeriod[period].commission += earnings.platformCommission;
    earningsByPeriod[period].bookingCount++;
  }

  // Convert to array
  for (const [period, data] of Object.entries(earningsByPeriod)) {
    periodBreakdown.push({
      period,
      earnings: roundCurrency(data.earnings),
      commission: roundCurrency(data.commission),
      payout: roundCurrency(data.earnings),
      bookingCount: data.bookingCount,
    });
  }

  // Sort by period descending
  periodBreakdown.sort((a, b) => b.period.localeCompare(a.period));

  // Get provider profile for pending amount
  const providerProfile = await ProviderProfile.findOne({ userId: providerId }).lean();
  const pendingPayout = providerProfile?.financials?.payout?.pendingAmount || 0;
  const lastPayoutDate = providerProfile?.financials?.payout?.lastPayoutDate || null;

  return {
    providerId,
    totalEarnings: roundCurrency(totalEarnings),
    totalCommission: roundCurrency(totalCommission),
    totalPayoutAmount: roundCurrency(totalPayoutAmount),
    pendingPayout: roundCurrency(pendingPayout),
    lastPayoutDate,
    nextPayoutDate: calculateNextPayoutDate(plan),
    currency: 'AED',
    periodBreakdown,
  };
}

/**
 * Get week number (ISO)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get commission configuration for a plan
 */
export function getCommissionConfig(plan: ProviderPlan): CommissionConfig {
  return COMMISSION_TIERS[plan] || COMMISSION_TIERS.beauty_free;
}

/**
 * Get all commission tiers
 */
export function getCommissionTiers(): Record<ProviderPlan, CommissionConfig> {
  return { ...COMMISSION_TIERS };
}

// ============================================
// Service Export
// ============================================

export const financeService = {
  calculateProviderEarnings,
  calculateProviderEarningsFromBooking,
  calculatePayoutSchedule,
  calculatePlatformFees,
  getProviderPayoutSummary,
  getCommissionConfig,
  getCommissionTiers,
};

export default financeService;
