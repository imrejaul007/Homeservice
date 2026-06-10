/**
 * Package Price Calculator Service
 * Handles dynamic pricing calculations for service packages with variable pricing
 * Uses Bundle model as packages are stored in the Bundle collection
 */

import mongoose from 'mongoose';
import Bundle from '../models/bundle.model';
import { getPlatformPolicySync, calculateTaxAmount } from './platformSettingsPolicy.service';
import logger from '../utils/logger';

export interface AddOnSelection {
  id?: string;
  name: string;
  price: number;
  quantity?: number;
}

export interface DurationSelection {
  duration: number;
  price: number;
  label: string;
}

export interface LocationDetails {
  type: 'customer_address' | 'provider_location' | 'online';
  distance?: number; // Distance in km for travel fee calculation
}

export interface DiscountCode {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
}

export interface PriceCalculationRequest {
  packageId: string;
  selectedServices?: string[]; // Service IDs to include if package allows customization
  selectedAddOns?: AddOnSelection[];
  selectedDuration?: DurationSelection;
  location?: LocationDetails;
  discountCode?: string;
  isPackage?: boolean; // Whether this is for a service package or individual service
  customerId?: string; // For loyalty discounts
  tenantId?: mongoose.Types.ObjectId;
}

export interface PriceBreakdown {
  basePrice: number;
  addOnsTotal: number;
  durationUpgrade: number;
  travelFee: number;
  subtotal: number;
  discount: number;
  discountDescription?: string;
  tax: number;
  totalAmount: number;
  currency: string;
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  durationDetails?: {
    originalDuration: number;
    selectedDuration: number;
    priceDifference: number;
  };
  loyaltyDiscount?: {
    percentage: number;
    amount: number;
  };
}

export interface PriceCalculationResult {
  success: boolean;
  data?: {
    priceBreakdown: PriceBreakdown;
    originalPrice: number;
    savings: number;
    savingsPercentage: number;
  };
  error?: string;
}

/**
 * Format duration in minutes to a human-readable label
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${mins}m`;
}

/**
 * Calculate total duration from bundle services
 */
function calculateBundleDuration(services: Array<{ quantity: number; description?: string }>): number {
  // Default duration estimation: 60 min per service item with quantity
  // This can be enhanced if services have duration info
  return services.reduce((total, service) => total + (service.quantity || 1) * 60, 60);
}

/**
 * Calculate dynamic price for a package (bundle)
 * Packages are stored as Bundles in the database
 */
export async function calculatePackagePrice(
  request: PriceCalculationRequest
): Promise<PriceCalculationResult> {
  // Store packageId before try block for error logging
  const { packageId } = request;

  try {
    const {
      selectedAddOns = [],
      location,
      discountCode,
      tenantId,
    } = request;

    // Build query - packages are stored as Bundles
    const query: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(packageId),
      isActive: true,
      status: 'approved',
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    // Validate bundle exists
    const bundleDoc = await Bundle.findOne(query);

    if (!bundleDoc) {
      return {
        success: false,
        error: 'Package not found or inactive',
      };
    }

    // Check bundle validity
    const now = new Date();
    if (bundleDoc.validFrom > now || bundleDoc.validUntil < now) {
      return {
        success: false,
        error: 'Package is not currently valid',
      };
    }

    const policy = getPlatformPolicySync();
    const currency = bundleDoc.currency || 'AED';

    // Calculate base price from bundle using Bundle fields
    let basePrice = bundleDoc.bundlePrice;

    // Calculate add-ons total
    const addOnsTotal = selectedAddOns.reduce((sum, addon) => {
      const quantity = addon.quantity || 1;
      return sum + (addon.price * quantity);
    }, 0);

    // Note: Bundles don't have duration options like Services
    // Duration is calculated from the included services
    const durationUpgrade = 0;
    const durationDetails: PriceBreakdown['durationDetails'] | undefined = undefined;

    // Calculate travel fee if applicable
    let travelFee = 0;
    // Bundle doesn't have location.travelFee like Service, set to 0
    // Travel fee can be added via add-ons if needed

    // Calculate subtotal
    const subtotal = basePrice + addOnsTotal + durationUpgrade + travelFee;

    // Apply discounts
    let discount = 0;
    let discountDescription: string | undefined;

    // Check for bulk discount based on add-ons
    const totalQuantity = selectedAddOns.reduce((sum, a) => sum + (a.quantity || 1), 0);
    // Bundles have their own savings embedded in bundlePrice
    // Additional bulk discounts can be applied via promo codes

    // Apply promo/discount code
    if (discountCode) {
      const promoDiscount = await applyPromoCode(discountCode, subtotal, tenantId);
      if (promoDiscount) {
        discount += promoDiscount.amount;
        discountDescription = discountDescription
          ? `${discountDescription}, ${promoDiscount.description}`
          : promoDiscount.description;
      }
    }

    // Note: Seasonal discounts are not stored on Bundle model
    // They can be applied via promo codes

    // Calculate tax
    const taxableAmount = subtotal - discount;
    const tax = calculateTaxAmount(taxableAmount, policy);

    // Calculate total
    const totalAmount = Math.round((taxableAmount + tax) * 100) / 100;

    // Calculate savings - use Bundle's pre-calculated savings
    const originalPrice = bundleDoc.originalPrice;
    const fullOriginalPrice = originalPrice;
    const savings = Math.max(0, fullOriginalPrice - basePrice) + (basePrice - totalAmount);
    const savingsPercentage = fullOriginalPrice > 0
      ? Math.round((savings / fullOriginalPrice) * 100)
      : bundleDoc.savingsPercentage;

    // Build price breakdown
    const priceBreakdown: PriceBreakdown = {
      basePrice,
      addOnsTotal,
      durationUpgrade,
      travelFee,
      subtotal,
      discount: Math.round(discount * 100) / 100,
      discountDescription,
      tax: Math.round(tax * 100) / 100,
      totalAmount,
      currency,
      addOns: selectedAddOns.map((addon) => ({
        name: addon.name,
        price: addon.price,
        quantity: addon.quantity || 1,
        total: addon.price * (addon.quantity || 1),
      })),
      durationDetails,
    };

    logger.info('Package price calculated', {
      context: 'PackagePriceCalculator',
      packageId,
      totalAmount,
      currency,
      addOnsCount: selectedAddOns.length,
    });

    return {
      success: true,
      data: {
        priceBreakdown,
        originalPrice: fullOriginalPrice,
        savings,
        savingsPercentage,
      },
    };
  } catch (error) {
    logger.error('Error calculating package price', {
      context: 'PackagePriceCalculator',
      packageId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: 'Failed to calculate price. Please try again.',
    };
  }
}

/**
 * Apply a promo/discount code to the price
 */
async function applyPromoCode(
  code: string,
  subtotal: number,
  tenantId?: mongoose.Types.ObjectId
): Promise<{ amount: number; description: string } | null> {
  try {
    const Coupon = (await import('../models/coupon.model')).default;
    const query: Record<string, unknown> = {
      code: code.toUpperCase(),
      isDeleted: false,
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const coupon = await Coupon.findOne(query);

    if (!coupon) {
      return null;
    }

    // Check coupon validity
    const couponAny = coupon as unknown as { isValid?: () => { valid: boolean; reason?: string } | null };
    const validityCheck = typeof couponAny.isValid === 'function' ? couponAny.isValid() : null;
    if (validityCheck && !validityCheck.valid) {
      return null;
    }

    // Check minimum order value
    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      return null;
    }

    // Calculate discount amount
    let discountAmount: number;
    if (coupon.type === 'percentage') {
      discountAmount = subtotal * (coupon.value / 100);
      // Apply max discount cap if set
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = coupon.value;
    }

    return {
      amount: Math.round(discountAmount * 100) / 100,
      description: `Promo code: ${code.toUpperCase()}`,
    };
  } catch (error) {
    logger.error('Error applying promo code', {
      context: 'PackagePriceCalculator',
      code,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Validate a discount code without applying it
 */
export async function validateDiscountCode(
  code: string,
  packageId: string,
  subtotal: number,
  tenantId?: mongoose.Types.ObjectId
): Promise<{
  valid: boolean;
  error?: string;
  discount?: { type: string; value: number; description: string };
}> {
  try {
    const Coupon = (await import('../models/coupon.model')).default;
    const query: Record<string, unknown> = {
      code: code.toUpperCase(),
      isDeleted: false,
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const coupon = await Coupon.findOne(query);

    if (!coupon) {
      return { valid: false, error: 'Invalid discount code' };
    }

    // Check validity
    const couponAny = coupon as unknown as { isValid?: () => { valid: boolean; reason?: string } | null };
    const validityCheck = typeof couponAny.isValid === 'function' ? couponAny.isValid() : null;
    if (validityCheck && !validityCheck.valid) {
      return { valid: false, error: validityCheck.reason || 'Coupon is not valid' };
    }

    // Check minimum order value
    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      return {
        valid: false,
        error: `Minimum order value of ${coupon.currency} ${coupon.minOrderValue} required`,
      };
    }

    // Calculate potential discount
    let discountAmount: number;
    if (coupon.type === 'percentage') {
      discountAmount = subtotal * (coupon.value / 100);
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = coupon.value;
    }

    return {
      valid: true,
      discount: {
        type: coupon.type,
        value: Math.round(discountAmount * 100) / 100,
        description: `${coupon.type === 'percentage' ? `${coupon.value}%` : `${coupon.currency} ${coupon.value}`} off`,
      },
    };
  } catch (error) {
    logger.error('Error validating discount code', {
      context: 'PackagePriceCalculator',
      code,
      error: error instanceof Error ? error.message : String(error),
    });
    return { valid: false, error: 'Failed to validate discount code' };
  }
}

/**
 * Get price estimate preview for a package
 */
export async function getPriceEstimate(
  packageId: string,
  tenantId?: mongoose.Types.ObjectId
): Promise<PriceCalculationResult> {
  // Return base price without any add-ons or customizations
  return calculatePackagePrice({
    packageId,
    tenantId,
  });
}

/**
 * Get available add-ons for a package with their prices
 * Note: Bundle model doesn't have addOns field like Service
 * Returns empty array - add-ons can be managed separately
 */
export async function getPackageAddOns(
  packageId: string,
  tenantId?: mongoose.Types.ObjectId
): Promise<{
  success: boolean;
  addOns?: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
  }>;
  error?: string;
}> {
  try {
    const query: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(packageId),
      isActive: true,
      status: 'approved',
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const bundleDoc = await Bundle.findOne(query).lean();

    if (!bundleDoc) {
      return { success: false, error: 'Package not found' };
    }

    // Bundles don't have addOns - return empty array
    // Add-ons can be managed as separate services or through customization
    return {
      success: true,
      addOns: [],
    };
  } catch (error) {
    logger.error('Error fetching package add-ons', {
      context: 'PackagePriceCalculator',
      packageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Failed to fetch add-ons' };
  }
}

/**
 * Get available duration options for a package
 * Note: Bundle model doesn't have durationOptions like Service
 * Returns default duration calculated from included services
 */
export async function getPackageDurationOptions(
  packageId: string,
  tenantId?: mongoose.Types.ObjectId
): Promise<{
  success: boolean;
  durationOptions?: Array<{
    duration: number;
    price: number;
    label: string;
  }>;
  error?: string;
}> {
  try {
    const query: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(packageId),
      isActive: true,
      status: 'approved',
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const bundleDoc = await Bundle.findOne(query).lean();

    if (!bundleDoc) {
      return { success: false, error: 'Package not found' };
    }

    // Bundles don't have durationOptions - return single option based on services
    const defaultDuration = calculateBundleDuration(bundleDoc.services);

    return {
      success: true,
      durationOptions: [{
        duration: defaultDuration,
        price: bundleDoc.bundlePrice,
        label: formatDuration(defaultDuration),
      }],
    };
  } catch (error) {
    logger.error('Error fetching duration options', {
      context: 'PackagePriceCalculator',
      packageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Failed to fetch duration options' };
  }
}

/**
 * Get bundle details including services for display
 */
export async function getBundleDetails(
  packageId: string,
  tenantId?: mongoose.Types.ObjectId
): Promise<{
  success: boolean;
  bundle?: {
    id: string;
    name: string;
    description: string;
    originalPrice: number;
    bundlePrice: number;
    savingsAmount: number;
    savingsPercentage: number;
    currency: string;
    services: Array<{
      serviceId: string;
      serviceName: string;
      quantity: number;
      originalPrice: number;
      description?: string;
    }>;
    validFrom: Date;
    validUntil: Date;
    isActive: boolean;
    status: string;
  };
  error?: string;
}> {
  try {
    const query: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(packageId),
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const bundleDoc = await Bundle.findOne(query).lean();

    if (!bundleDoc) {
      return { success: false, error: 'Bundle not found' };
    }

    return {
      success: true,
      bundle: {
        id: bundleDoc._id.toString(),
        name: bundleDoc.name,
        description: bundleDoc.description,
        originalPrice: bundleDoc.originalPrice,
        bundlePrice: bundleDoc.bundlePrice,
        savingsAmount: bundleDoc.savingsAmount,
        savingsPercentage: bundleDoc.savingsPercentage,
        currency: bundleDoc.currency,
        services: bundleDoc.services.map(s => ({
          serviceId: s.serviceId.toString(),
          serviceName: s.serviceName,
          quantity: s.quantity,
          originalPrice: s.originalPrice,
          description: s.description,
        })),
        validFrom: bundleDoc.validFrom,
        validUntil: bundleDoc.validUntil,
        isActive: bundleDoc.isActive,
        status: bundleDoc.status,
      },
    };
  } catch (error) {
    logger.error('Error fetching bundle details', {
      context: 'PackagePriceCalculator',
      packageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Failed to fetch bundle details' };
  }
}

export default {
  calculatePackagePrice,
  validateDiscountCode,
  getPriceEstimate,
  getPackageAddOns,
  getPackageDurationOptions,
  getBundleDetails,
};