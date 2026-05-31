import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type PackageTier = 'basic' | 'standard' | 'premium' | 'enterprise';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';

export interface PackageBenefit {
  id: string;
  name: string;
  description: string;
  value: number | string;
  icon?: string;
}

export interface PackageDiscount {
  discountType: 'percentage' | 'fixed';
  amount: number;
  minBookings?: number;
  minSpent?: number;
  validFrom?: Date;
  validUntil?: Date;
}

export interface ServicePackage {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  tier: PackageTier;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  benefits: PackageBenefit[];
  discountRates: PackageDiscount[];
  autoRenewal: boolean;
  trialDays: number;
  maxServices: number;
  maxBookings: number;
  maxPhotos: number;
  analyticsAccess: boolean;
  prioritySupport: boolean;
  featuredListing: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProviderSubscription {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  packageId: Types.ObjectId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  autoRenewal: boolean;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  usage: {
    servicesUsed: number;
    bookingsUsed: number;
    photosUsed: number;
  };
  discountApplied: number;
  totalSaved: number;
  history: Array<{
    packageId: Types.ObjectId;
    status: SubscriptionStatus;
    price: number;
    changedAt: Date;
    reason: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreatePackageInput {
  name: string;
  description: string;
  tier: PackageTier;
  price: number;
  currency?: string;
  billingCycle: BillingCycle;
  benefits?: PackageBenefit[];
  discountRates?: PackageDiscount[];
  autoRenewal?: boolean;
  trialDays?: number;
  maxServices?: number;
  maxBookings?: number;
  maxPhotos?: number;
  analyticsAccess?: boolean;
  prioritySupport?: boolean;
  featuredListing?: boolean;
  customBranding?: boolean;
  apiAccess?: boolean;
}

export interface SubscribeToPackageInput {
  providerId: string;
  packageId: string;
  billingCycle: BillingCycle;
  autoRenewal?: boolean;
  paymentMethodId?: string;
}

// ============================================
// Mongoose Model Interfaces
// ============================================

interface IServicePackage extends Document, Omit<ServicePackage, '_id'> {}
interface IProviderSubscription extends Document, Omit<ProviderSubscription, '_id'> {}

// ============================================
// Mongoose Schemas
// ============================================

const PackageBenefitSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  icon: { type: String },
}, { _id: false });

const PackageDiscountSchema = new mongoose.Schema({
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  amount: { type: Number, required: true },
  minBookings: { type: Number },
  minSpent: { type: Number },
  validFrom: { type: Date },
  validUntil: { type: Date },
}, { _id: false });

const ServicePackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  tier: { type: String, enum: ['basic', 'standard', 'premium', 'enterprise'], required: true },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'AED' },
  billingCycle: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
  benefits: { type: [PackageBenefitSchema], default: [] },
  discountRates: { type: [PackageDiscountSchema], default: [] },
  autoRenewal: { type: Boolean, default: true },
  trialDays: { type: Number, default: 0, min: 0, max: 90 },
  maxServices: { type: Number, default: 5 },
  maxBookings: { type: Number, default: 50 },
  maxPhotos: { type: Number, default: 100 },
  analyticsAccess: { type: Boolean, default: false },
  prioritySupport: { type: Boolean, default: false },
  featuredListing: { type: Boolean, default: false },
  customBranding: { type: Boolean, default: false },
  apiAccess: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  collection: 'service_packages',
});

const UsageSchema = new mongoose.Schema({
  servicesUsed: { type: Number, default: 0 },
  bookingsUsed: { type: Number, default: 0 },
  photosUsed: { type: Number, default: 0 },
}, { _id: false });

const SubscriptionHistorySchema = new mongoose.Schema({
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePackage', required: true },
  status: { type: String, enum: ['active', 'paused', 'cancelled', 'expired', 'pending'], required: true },
  price: { type: Number, required: true },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String, required: true },
}, { _id: false });

const ProviderSubscriptionSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePackage', required: true },
  status: { type: String, enum: ['active', 'paused', 'cancelled', 'expired', 'pending'], default: 'pending' },
  billingCycle: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  trialEnd: { type: Date },
  autoRenewal: { type: Boolean, default: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  usage: { type: UsageSchema, default: () => ({}) },
  discountApplied: { type: Number, default: 0 },
  totalSaved: { type: Number, default: 0 },
  history: { type: [SubscriptionHistorySchema], default: [] },
}, {
  timestamps: true,
  collection: 'provider_subscriptions',
});

// ============================================
// Model Registration
// ============================================

export const ServicePackageModel = mongoose.models.ServicePackage ||
  mongoose.model<IServicePackage>('ServicePackage', ServicePackageSchema);

export const ProviderSubscriptionModel = mongoose.models.ProviderSubscription ||
  mongoose.model<IProviderSubscription>('ProviderSubscription', ProviderSubscriptionSchema);

// ============================================
// Service Class
// ============================================

export class ServicePackagesService {

  // ========================================
  // Package Management
  // ========================================

  /**
   * Create a new service package
   */
  async createPackage(input: CreatePackageInput): Promise<IServicePackage> {
    try {
      const pkg = new ServicePackageModel({
        ...input,
        benefits: input.benefits || [],
        discountRates: input.discountRates || [],
      });

      await pkg.save();

      logger.info('Service package created', {
        context: 'ServicePackagesService',
        action: 'PACKAGE_CREATED',
        packageId: pkg._id.toString(),
        tier: pkg.tier,
      });

      eventBus.publish(EVENT_TYPES.PACKAGE_CREATED, {
        packageId: pkg._id,
        name: pkg.name,
        tier: pkg.tier,
      });

      return pkg;
    } catch (error) {
      logger.error('Failed to create service package', {
        context: 'ServicePackagesService',
        action: 'PACKAGE_CREATE_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
      throw ApiError.internal('Failed to create service package');
    }
  }

  /**
   * Get package by ID
   */
  async getPackageById(packageId: string): Promise<IServicePackage | null> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw ApiError.badRequest('Invalid package ID');
    }
    return ServicePackageModel.findById(packageId);
  }

  /**
   * Get all active packages
   */
  async getAllPackages(filters?: { tier?: PackageTier; isActive?: boolean }): Promise<IServicePackage[]> {
    const query: Record<string, unknown> = {};

    if (filters?.tier) query.tier = filters.tier;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    return ServicePackageModel.find(query).sort({ tier: 1, price: 1 });
  }

  /**
   * Update a package
   */
  async updatePackage(packageId: string, updates: Partial<CreatePackageInput>): Promise<IServicePackage> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw ApiError.badRequest('Invalid package ID');
    }

    const pkg = await ServicePackageModel.findByIdAndUpdate(
      packageId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!pkg) {
      throw ApiError.notFound('Package not found');
    }

    logger.info('Service package updated', {
      context: 'ServicePackagesService',
      action: 'PACKAGE_UPDATED',
      packageId: pkg._id.toString(),
    });

    return pkg;
  }

  /**
   * Deactivate a package (soft delete)
   */
  async deactivatePackage(packageId: string): Promise<void> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw ApiError.badRequest('Invalid package ID');
    }

    const result = await ServicePackageModel.findByIdAndUpdate(
      packageId,
      { isActive: false },
      { new: true }
    );

    if (!result) {
      throw ApiError.notFound('Package not found');
    }

    logger.info('Service package deactivated', {
      context: 'ServicePackagesService',
      action: 'PACKAGE_DEACTIVATED',
      packageId,
    });
  }

  // ========================================
  // Subscription Management
  // ========================================

  /**
   * Subscribe a provider to a package
   */
  async subscribeToPackage(input: SubscribeToPackageInput): Promise<IProviderSubscription> {
    const { providerId, packageId, billingCycle, autoRenewal = true } = input;

    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    if (!Types.ObjectId.isValid(packageId)) {
      throw ApiError.badRequest('Invalid package ID');
    }

    const pkg = await ServicePackageModel.findById(packageId);
    if (!pkg || !pkg.isActive) {
      throw ApiError.notFound('Package not found or inactive');
    }

    // Check for existing subscription
    const existingSubscription = await ProviderSubscriptionModel.findOne({ providerId });
    if (existingSubscription) {
      throw ApiError.conflict('Provider already has an active subscription');
    }

    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, billingCycle, pkg.trialDays || 0);

    const subscription = new ProviderSubscriptionModel({
      providerId: new Types.ObjectId(providerId),
      packageId: new Types.ObjectId(packageId),
      status: pkg.trialDays ? 'pending' : 'active',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: pkg.trialDays ? new Date(now.getTime() + pkg.trialDays * 24 * 60 * 60 * 1000) : undefined,
      autoRenewal,
      usage: {
        servicesUsed: 0,
        bookingsUsed: 0,
        photosUsed: 0,
      },
      history: [{
        packageId: new Types.ObjectId(packageId),
        status: 'pending',
        price: this.calculatePriceWithDiscount(pkg, billingCycle),
        changedAt: now,
        reason: 'Initial subscription',
      }],
    });

    await subscription.save();

    logger.info('Provider subscribed to package', {
      context: 'ServicePackagesService',
      action: 'SUBSCRIPTION_CREATED',
      providerId,
      packageId,
      billingCycle,
    });

    eventBus.publish(EVENT_TYPES.SUBSCRIPTION_CREATED, {
      subscriptionId: subscription._id,
      providerId,
      packageId,
      tier: pkg.tier,
    });

    return subscription;
  }

  /**
   * Get subscription by provider ID
   */
  async getSubscriptionByProvider(providerId: string): Promise<IProviderSubscription | null> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    return ProviderSubscriptionModel.findOne({ providerId })
      .populate('packageId')
      .populate('providerId', 'firstName lastName email');
  }

  /**
   * Change provider's package
   */
  async changePackage(
    providerId: string,
    newPackageId: string,
    reason?: string
  ): Promise<IProviderSubscription> {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(newPackageId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const subscription = await ProviderSubscriptionModel.findOne({ providerId });
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    const newPackage = await ServicePackageModel.findById(newPackageId);
    if (!newPackage || !newPackage.isActive) {
      throw ApiError.notFound('Package not found or inactive');
    }

    const oldPackageId = subscription.packageId;
    const newPrice = this.calculatePriceWithDiscount(newPackage, subscription.billingCycle);

    subscription.packageId = new Types.ObjectId(newPackageId);
    subscription.status = 'active';
    subscription.history.push({
      packageId: oldPackageId,
      status: subscription.status,
      price: newPrice,
      changedAt: new Date(),
      reason: reason || `Changed from previous package`,
    });

    await subscription.save();

    logger.info('Provider package changed', {
      context: 'ServicePackagesService',
      action: 'PACKAGE_CHANGED',
      providerId,
      oldPackageId: oldPackageId.toString(),
      newPackageId,
    });

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    providerId: string,
    immediate: boolean = false,
    reason?: string
  ): Promise<IProviderSubscription> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const subscription = await ProviderSubscriptionModel.findOne({ providerId });
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (subscription.status === 'cancelled') {
      throw ApiError.badRequest('Subscription already cancelled');
    }

    if (immediate) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
    }

    subscription.cancellationReason = reason;

    subscription.history.push({
      packageId: subscription.packageId,
      status: subscription.status,
      price: 0,
      changedAt: new Date(),
      reason: reason || 'Subscription cancelled',
    });

    await subscription.save();

    logger.info('Subscription cancelled', {
      context: 'ServicePackagesService',
      action: 'SUBSCRIPTION_CANCELLED',
      providerId,
      immediate,
    });

    eventBus.publish(EVENT_TYPES.SUBSCRIPTION_CANCELLED, {
      subscriptionId: subscription._id,
      providerId,
      immediate,
    });

    return subscription;
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(providerId: string): Promise<IProviderSubscription> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const subscription = await ProviderSubscriptionModel.findOne({ providerId });
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (subscription.status !== 'cancelled') {
      throw ApiError.badRequest('Subscription is not cancelled');
    }

    subscription.status = 'active';
    subscription.cancelAtPeriodEnd = false;
    subscription.cancellationReason = undefined;
    subscription.cancelledAt = undefined;

    subscription.history.push({
      packageId: subscription.packageId,
      status: 'active',
      price: 0,
      changedAt: new Date(),
      reason: 'Subscription reactivated',
    });

    await subscription.save();

    logger.info('Subscription reactivated', {
      context: 'ServicePackagesService',
      action: 'SUBSCRIPTION_REACTIVATED',
      providerId,
    });

    return subscription;
  }

  // ========================================
  // Usage Tracking
  // ========================================

  /**
   * Record usage for a provider
   */
  async recordUsage(
    providerId: string,
    type: 'services' | 'bookings' | 'photos',
    count: number = 1
  ): Promise<void> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const usageField = `${type}Used` as keyof IProviderSubscription['usage'];

    await ProviderSubscriptionModel.findOneAndUpdate(
      { providerId },
      { $inc: { [`usage.${usageField}`]: count } }
    );
  }

  /**
   * Check if provider can perform action
   */
  async checkUsageLimit(
    providerId: string,
    type: 'services' | 'bookings' | 'photos'
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const subscription = await ProviderSubscriptionModel.findOne({ providerId })
      .populate('packageId');

    if (!subscription) {
      return { allowed: false, used: 0, limit: 0 };
    }

    const pkg = subscription.packageId as unknown as IServicePackage;
    const usageField = `${type}Used` as keyof IProviderSubscription['usage'];
    const limitField = `max${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof IServicePackage;

    const used = subscription.usage[usageField] as number;
    const limit = (pkg[limitField] as number) || 0;

    return {
      allowed: limit === 0 || used < limit,
      used,
      limit,
    };
  }

  // ========================================
  // Discount Calculation
  // ========================================

  /**
   * Calculate price with applicable discounts
   */
  calculatePriceWithDiscount(pkg: IServicePackage, billingCycle: BillingCycle): number {
    let basePrice = pkg.price;

    // Apply billing cycle discount
    switch (billingCycle) {
      case 'quarterly':
        basePrice *= 3 * 0.95; // 5% off
        break;
      case 'yearly':
        basePrice *= 12 * 0.80; // 20% off
        break;
      default:
        break;
    }

    // Apply package-specific discounts
    const now = new Date();
    for (const discount of pkg.discountRates) {
      if (discount.validFrom && discount.validFrom > now) continue;
      if (discount.validUntil && discount.validUntil < now) continue;

      if (discount.discountType === 'percentage') {
        basePrice *= (1 - discount.amount / 100);
      } else {
        basePrice -= discount.amount;
      }
    }

    return Math.max(0, Math.round(basePrice * 100) / 100);
  }

  /**
   * Get discount rate for a provider based on their usage
   */
  async calculateProviderDiscount(providerId: string): Promise<number> {
    if (!Types.ObjectId.isValid(providerId)) {
      return 0;
    }

    const subscription = await ProviderSubscriptionModel.findOne({ providerId })
      .populate('packageId');

    if (!subscription) return 0;

    const pkg = subscription.packageId as unknown as IServicePackage;
    let maxDiscount = 0;

    for (const discount of pkg.discountRates) {
      let applies = true;

      if (discount.minBookings && subscription.usage.bookingsUsed < discount.minBookings) {
        applies = false;
      }

      if (discount.minSpent && subscription.totalSaved < discount.minSpent) {
        applies = false;
      }

      if (applies && discount.amount > maxDiscount) {
        maxDiscount = discount.amount;
      }
    }

    return maxDiscount;
  }

  // ========================================
  // Billing & Renewal
  // ========================================

  /**
   * Calculate period end date
   */
  private calculatePeriodEnd(startDate: Date, billingCycle: BillingCycle, trialDays: number): Date {
    const baseDate = trialDays > 0
      ? new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : startDate;

    switch (billingCycle) {
      case 'quarterly':
        baseDate.setMonth(baseDate.getMonth() + 3);
        break;
      case 'yearly':
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        break;
      default:
        baseDate.setMonth(baseDate.getMonth() + 1);
    }

    return baseDate;
  }

  /**
   * Process subscription renewals (called by scheduler)
   */
  async processRenewals(): Promise<{ renewed: number; failed: number; expired: number }> {
    const result = { renewed: 0, failed: 0, expired: 0 };
    const now = new Date();

    // Find subscriptions due for renewal
    const dueSubscriptions = await ProviderSubscriptionModel.find({
      status: 'active',
      currentPeriodEnd: { $lte: now },
      cancelAtPeriodEnd: false,
    });

    for (const subscription of dueSubscriptions) {
      try {
        const pkg = await ServicePackageModel.findById(subscription.packageId);
        if (!pkg) {
          subscription.status = 'expired';
          await subscription.save();
          result.expired++;
          continue;
        }

        // Renew if auto-renewal is enabled
        if (subscription.autoRenewal) {
          subscription.currentPeriodStart = now;
          subscription.currentPeriodEnd = this.calculatePeriodEnd(now, subscription.billingCycle, 0);
          subscription.status = 'active';
          subscription.usage = {
            servicesUsed: 0,
            bookingsUsed: 0,
            photosUsed: 0,
          };

          subscription.history.push({
            packageId: subscription.packageId,
            status: 'active',
            price: this.calculatePriceWithDiscount(pkg, subscription.billingCycle),
            changedAt: now,
            reason: 'Subscription renewed',
          });

          await subscription.save();
          result.renewed++;

          eventBus.publish(EVENT_TYPES.SUBSCRIPTION_RENEWED, {
            subscriptionId: subscription._id,
            providerId: subscription.providerId,
          });
        } else {
          subscription.status = 'expired';
          await subscription.save();
          result.expired++;
        }
      } catch (error) {
        logger.error('Failed to process renewal', {
          context: 'ServicePackagesService',
          action: 'RENEWAL_FAILED',
          subscriptionId: subscription._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        result.failed++;
      }
    }

    // Process cancelled subscriptions at period end
    const cancelledDue = await ProviderSubscriptionModel.find({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $lte: now },
    });

    for (const subscription of cancelledDue) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = now;
      await subscription.save();
      result.expired++;
    }

    return result;
  }

  // ========================================
  // Analytics & Reporting
  // ========================================

  /**
   * Get package statistics
   */
  async getPackageStats(): Promise<{
    totalPackages: number;
    activePackages: number;
    subscriptionsByTier: Record<PackageTier, number>;
    revenueByTier: Record<PackageTier, number>;
  }> {
    const packages = await ServicePackageModel.find();

    const subscriptions = await ProviderSubscriptionModel.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$packageId',
          count: { $sum: 1 },
        },
      },
    ]);

    const subscriptionMap = new Map(subscriptions.map(s => [s._id.toString(), s.count]));

    let totalPackages = packages.length;
    let activePackages = packages.filter(p => p.isActive).length;
    let subscriptionsByTier: Record<PackageTier, number> = { basic: 0, standard: 0, premium: 0, enterprise: 0 };
    let revenueByTier: Record<PackageTier, number> = { basic: 0, standard: 0, premium: 0, enterprise: 0 };

    for (const pkg of packages) {
      const count = subscriptionMap.get(pkg._id.toString()) || 0;
      const tier = pkg.tier as PackageTier;
      subscriptionsByTier[tier] += count;
      revenueByTier[tier] += count * pkg.price;
    }

    return {
      totalPackages,
      activePackages,
      subscriptionsByTier,
      revenueByTier,
    };
  }

  /**
   * Get provider's subscription history
   */
  async getSubscriptionHistory(providerId: string): Promise<IProviderSubscription['history']> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const subscription = await ProviderSubscriptionModel.findOne({ providerId });
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    return subscription.history;
  }
}

// ============================================
// Export Singleton
// ============================================

export const servicePackagesService = new ServicePackagesService();
export default servicePackagesService;
