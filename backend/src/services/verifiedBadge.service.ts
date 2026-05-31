import mongoose, { Types } from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface VerifiedBadgeProduct {
  _id?: Types.ObjectId;
  productId: string;
  name: string;
  description: string;
  tier: BadgeTier;
  price: number;
  durationDays: number; // Validity period in days
  features: string[];
  benefits: {
    priorityVisibility: boolean;
    customBadge: boolean;
    analytics: boolean;
    supportPriority: number; // 1 = highest, higher = lower priority
    featuredSearchSlots: number;
    exclusiveBadges: string[];
  };
  renewalDiscount: number; // Percentage discount for renewal
  isActive: boolean;
  createdAt: Date;
}

export interface VerifiedBadgePurchase {
  _id?: Types.ObjectId;
  purchaseId: string;
  providerId: Types.ObjectId;
  productId: Types.ObjectId;
  badgeTier: BadgeTier;
  purchasePrice: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  paymentId?: string;
  paidAt?: Date;
  renewalOf?: Types.ObjectId; // Reference to previous purchase
  nextRenewalDate?: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BadgeDisplayInfo {
  providerId: string;
  tier: BadgeTier;
  productName: string;
  validUntil: Date;
  isActive: boolean;
  features: string[];
  customBadgeUrl?: string;
}

// ============================================
// Badge Product Configuration
// ============================================

const BADGE_PRODUCTS: VerifiedBadgeProduct[] = [
  {
    productId: 'BADGE-BRONZE',
    name: 'Bronze Verified',
    description: 'Basic verified badge for trusted providers',
    tier: 'bronze',
    price: 29.99,
    durationDays: 30,
    features: [
      'Verified badge on profile',
      'Basic search priority',
      'Email support',
      'Up to 10 featured slots/month',
    ],
    benefits: {
      priorityVisibility: true,
      customBadge: false,
      analytics: false,
      supportPriority: 4,
      featuredSearchSlots: 10,
      exclusiveBadges: ['bronze-check'],
    },
    renewalDiscount: 10,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BADGE-SILVER',
    name: 'Silver Verified',
    description: 'Enhanced verified badge with analytics',
    tier: 'silver',
    price: 59.99,
    durationDays: 30,
    features: [
      'Verified badge with silver styling',
      'Enhanced search priority',
      'Basic analytics dashboard',
      'Priority email support',
      'Up to 25 featured slots/month',
      'Custom response template',
    ],
    benefits: {
      priorityVisibility: true,
      customBadge: false,
      analytics: true,
      supportPriority: 3,
      featuredSearchSlots: 25,
      exclusiveBadges: ['silver-check', 'silver-star'],
    },
    renewalDiscount: 15,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BADGE-GOLD',
    name: 'Gold Verified',
    description: 'Premium verified badge with full analytics',
    tier: 'gold',
    price: 99.99,
    durationDays: 30,
    features: [
      'Verified badge with gold styling',
      'Top search priority placement',
      'Full analytics dashboard',
      'Priority phone support',
      'Up to 50 featured slots/month',
      'Custom response templates',
      'Featured in category highlights',
      'Monthly performance report',
    ],
    benefits: {
      priorityVisibility: true,
      customBadge: true,
      analytics: true,
      supportPriority: 2,
      featuredSearchSlots: 50,
      exclusiveBadges: ['gold-check', 'gold-star', 'gold-crown'],
    },
    renewalDiscount: 20,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BADGE-PLATINUM',
    name: 'Platinum Verified',
    description: 'The ultimate verified badge with exclusive benefits',
    tier: 'platinum',
    price: 199.99,
    durationDays: 30,
    features: [
      'Exclusive platinum verified badge',
      'Number 1 search priority placement',
      'Real-time analytics dashboard',
      'Dedicated account manager',
      'Unlimited featured slots',
      'Custom branded profile',
      'Featured in all category highlights',
      'Weekly performance reports',
      'Early access to new features',
      'Exclusive partner discounts',
    ],
    benefits: {
      priorityVisibility: true,
      customBadge: true,
      analytics: true,
      supportPriority: 1,
      featuredSearchSlots: -1, // Unlimited
      exclusiveBadges: ['platinum-check', 'platinum-star', 'platinum-crown', 'platinum-diamond'],
    },
    renewalDiscount: 25,
    isActive: true,
    createdAt: new Date(),
  },
];

// ============================================
// Verified Badge Service
// ============================================

export class VerifiedBadgeService {
  private purchaseModel: any;

  constructor() {
    this.initializeModel();
  }

  private initializeModel(): void {
    try {
      this.purchaseModel = mongoose.models.VerifiedBadgePurchase || this.createPurchaseSchema();
    } catch {
      this.purchaseModel = this.createPurchaseSchema();
    }
  }

  private createPurchaseSchema(): any {
    const PurchaseSchema = new mongoose.Schema({
      purchaseId: { type: String, required: true, unique: true },
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      badgeTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], required: true },
      purchasePrice: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      status: { type: String, enum: ['active', 'expired', 'cancelled', 'pending'], default: 'pending' },
      paymentId: { type: String },
      paidAt: { type: Date },
      renewalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'VerifiedBadgePurchase' },
      nextRenewalDate: { type: Date },
      autoRenew: { type: Boolean, default: false },
    }, { timestamps: true });

    PurchaseSchema.index({ purchaseId: 1 }, { unique: true });
    PurchaseSchema.index({ providerId: 1, status: 1 });
    PurchaseSchema.index({ endDate: 1 });

    return mongoose.model('VerifiedBadgePurchase', PurchaseSchema);
  }

  /**
   * Get all available badge products
   */
  getProducts(): VerifiedBadgeProduct[] {
    return BADGE_PRODUCTS.filter(p => p.isActive);
  }

  /**
   * Get product by tier
   */
  getProductByTier(tier: BadgeTier): VerifiedBadgeProduct | undefined {
    return BADGE_PRODUCTS.find(p => p.tier === tier && p.isActive);
  }

  /**
   * Get product by ID
   */
  getProductById(productId: string): VerifiedBadgeProduct | undefined {
    return BADGE_PRODUCTS.find(p => p.productId === productId && p.isActive);
  }

  /**
   * Check if provider has active badge
   */
  async hasActiveBadge(providerId: string | Types.ObjectId): Promise<{
    hasBadge: boolean;
    tier?: BadgeTier;
    validUntil?: Date;
  }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const purchase = await this.purchaseModel.findOne({
      providerId: providerObjectId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).sort({ endDate: -1 });

    if (!purchase) {
      return { hasBadge: false };
    }

    return {
      hasBadge: true,
      tier: purchase.badgeTier as BadgeTier,
      validUntil: purchase.endDate,
    };
  }

  /**
   * Get provider's badge display info
   */
  async getBadgeDisplayInfo(providerId: string | Types.ObjectId): Promise<BadgeDisplayInfo | null> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const purchase = await this.purchaseModel.findOne({
      providerId: providerObjectId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).sort({ endDate: -1 });

    if (!purchase) {
      return null;
    }

    const product = this.getProductByTier(purchase.badgeTier as BadgeTier);
    if (!product) {
      return null;
    }

    return {
      providerId: providerObjectId.toString(),
      tier: purchase.badgeTier as BadgeTier,
      productName: product.name,
      validUntil: purchase.endDate,
      isActive: purchase.status === 'active',
      features: product.features,
    };
  }

  /**
   * Purchase a verified badge
   */
  async purchaseBadge(
    providerId: string | Types.ObjectId,
    tier: BadgeTier,
    options: {
      paymentId?: string;
      autoRenew?: boolean;
      applyRenewalDiscount?: boolean;
    } = {}
  ): Promise<{ success: boolean; purchase?: VerifiedBadgePurchase; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      const product = this.getProductByTier(tier);
      if (!product) {
        return { success: false, error: 'Badge product not found' };
      }

      // Check for existing active badge
      const existingBadge = await this.hasActiveBadge(providerObjectId);
      if (existingBadge.hasBadge) {
        return { success: false, error: 'Provider already has an active badge' };
      }

      // Calculate price with renewal discount if applicable
      let price = product.price;
      if (options.applyRenewalDiscount && existingBadge.tier === tier) {
        price = price * (1 - product.renewalDiscount / 100);
      }

      const purchaseId = this.generatePurchaseId();
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + product.durationDays);

      const purchase = new this.purchaseModel({
        purchaseId,
        providerId: providerObjectId,
        productId: product._id || new Types.ObjectId(),
        badgeTier: tier,
        purchasePrice: Math.round(price * 100) / 100,
        currency: 'AED',
        startDate,
        endDate,
        status: options.paymentId ? 'active' : 'pending',
        paymentId: options.paymentId,
        paidAt: options.paymentId ? new Date() : undefined,
        autoRenew: options.autoRenew ?? false,
        nextRenewalDate: options.autoRenew
          ? new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days before expiry
          : undefined,
      });

      await purchase.save();

      // Update provider profile with badge info
      await ProviderProfile.findOneAndUpdate(
        { userId: providerObjectId },
        {
          $set: {
            'badges.verified': {
              tier,
              productId: product.productId,
              validUntil: endDate,
              isActive: true,
            },
          },
        }
      );

      logger.info('Verified badge purchased', {
        purchaseId,
        providerId: providerObjectId.toString(),
        tier,
        price,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.VERIFIED_BADGE_PURCHASED, {
        purchaseId,
        providerId: providerObjectId.toString(),
        tier,
        price,
      });

      return { success: true, purchase };
    } catch (error) {
      logger.error('Error purchasing verified badge', {
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase badge',
      };
    }
  }

  /**
   * Renew a verified badge
   */
  async renewBadge(
    providerId: string | Types.ObjectId,
    options: {
      extendDays?: number;
      upgradeTier?: BadgeTier;
    } = {}
  ): Promise<{ success: boolean; purchase?: VerifiedBadgePurchase; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      // Find current badge
      const currentBadge = await this.purchaseModel.findOne({
        providerId: providerObjectId,
        status: 'active',
      }).sort({ endDate: -1 });

      const newTier = options.upgradeTier || currentBadge?.badgeTier || 'bronze';
      const product = this.getProductByTier(newTier);

      if (!product) {
        return { success: false, error: 'Badge product not found' };
      }

      // Calculate extension
      const extendDays = options.extendDays ?? product.durationDays;
      const newEndDate = currentBadge
        ? new Date(currentBadge.endDate.getTime() + extendDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + extendDays * 24 * 60 * 60 * 1000);

      // Apply renewal discount
      const isRenewal = !!currentBadge && currentBadge.badgeTier === newTier;
      let price = product.price;
      if (isRenewal) {
        price = price * (1 - product.renewalDiscount / 100);
      }

      const purchaseId = this.generatePurchaseId();
      const startDate = currentBadge ? currentBadge.endDate : new Date();

      const purchase = new this.purchaseModel({
        purchaseId,
        providerId: providerObjectId,
        productId: product._id || new Types.ObjectId(),
        badgeTier: newTier,
        purchasePrice: Math.round(price * 100) / 100,
        currency: 'AED',
        startDate,
        endDate: newEndDate,
        status: 'active',
        renewalOf: currentBadge?._id,
        autoRenew: false,
      });

      await purchase.save();

      // Update provider profile
      await ProviderProfile.findOneAndUpdate(
        { userId: providerObjectId },
        {
          $set: {
            'badges.verified': {
              tier: newTier,
              productId: product.productId,
              validUntil: newEndDate,
              isActive: true,
            },
          },
        }
      );

      logger.info('Verified badge renewed', {
        purchaseId,
        providerId: providerObjectId.toString(),
        newTier,
        newEndDate,
      });

      return { success: true, purchase };
    } catch (error) {
      logger.error('Error renewing verified badge', {
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to renew badge',
      };
    }
  }

  /**
   * Cancel badge subscription
   */
  async cancelBadge(
    providerId: string | Types.ObjectId
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      await this.purchaseModel.updateMany(
        { providerId: providerObjectId, status: 'active' },
        { $set: { status: 'cancelled' } }
      );

      // Remove badge from provider profile
      await ProviderProfile.findOneAndUpdate(
        { userId: providerObjectId },
        { $unset: { 'badges.verified': 1 } }
      );

      logger.info('Verified badge cancelled', { providerId: providerObjectId.toString() });

      return { success: true };
    } catch (error) {
      logger.error('Error cancelling verified badge', {
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel badge',
      };
    }
  }

  /**
   * Get provider's badge purchase history
   */
  async getPurchaseHistory(
    providerId: string | Types.ObjectId,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ purchases: VerifiedBadgePurchase[]; total: number }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      this.purchaseModel.find({ providerId: providerObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.purchaseModel.countDocuments({ providerId: providerObjectId }),
    ]);

    return { purchases, total };
  }

  /**
   * Get renewal reminders (badges expiring soon)
   */
  async getRenewalReminders(daysBeforeExpiry: number = 7): Promise<VerifiedBadgePurchase[]> {
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + daysBeforeExpiry);

    return this.purchaseModel.find({
      status: 'active',
      endDate: { $lte: reminderDate, $gt: new Date() },
      autoRenew: false,
    }).populate('providerId', 'firstName lastName email');
  }

  /**
   * Process expired badges (cleanup job)
   */
  async processExpiredBadges(): Promise<{ processed: number }> {
    const expiredPurchases = await this.purchaseModel.find({
      status: 'active',
      endDate: { $lt: new Date() },
    });

    for (const purchase of expiredPurchases) {
      purchase.status = 'expired';
      await purchase.save();

      // Remove badge from provider profile
      await ProviderProfile.findOneAndUpdate(
        { userId: purchase.providerId },
        { $unset: { 'badges.verified': 1 } }
      );

      logger.info('Expired badge processed', {
        purchaseId: purchase.purchaseId,
        providerId: purchase.providerId.toString(),
      });
    }

    return { processed: expiredPurchases.length };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generatePurchaseId(): string {
    return `VBP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const verifiedBadgeService = new VerifiedBadgeService();
export default verifiedBadgeService;
