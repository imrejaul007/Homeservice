import mongoose, { Types } from 'mongoose';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type BoostDuration = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type BoostPosition = 'category_top' | 'featured' | 'premium' | 'hero';
export type BoostCategory = 'all' | 'specific';

export interface FeaturedBoostProduct {
  _id?: Types.ObjectId;
  productId: string;
  name: string;
  description: string;
  duration: BoostDuration;
  position: BoostPosition;
  price: number;
  pricePerDay: number;
  features: string[];
  positionGuarantee: number; // Guaranteed position (1 = top)
  categoryBoost: boolean;
  searchBoostMultiplier: number;
  isActive: boolean;
  createdAt: Date;
}

export interface FeaturedBoost {
  _id?: Types.ObjectId;
  boostId: string;
  providerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  position: BoostPosition;
  duration: BoostDuration;
  startDate: Date;
  endDate: Date;
  originalPosition?: number;
  boostedPosition: number;
  price: number;
  currency: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'expired';
  paymentId?: string;
  paidAt?: Date;
  metadata?: {
    searchQueries?: string[];
    impressions?: number;
    clicks?: number;
    conversions?: number;
    ctr?: number; // Click-through rate
    categoryName?: string;
    serviceName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Featured Boost Products
// ============================================

const BOOST_PRODUCTS: FeaturedBoostProduct[] = [
  {
    productId: 'BOOST-DAILY-TOP',
    name: 'Daily Top Placement',
    description: '24-hour featured placement at the top of category search results',
    duration: 'daily',
    position: 'category_top',
    price: 9.99,
    pricePerDay: 9.99,
    features: [
      'Top 3 placement in category',
      'Featured badge',
      'Basic analytics',
    ],
    positionGuarantee: 3,
    categoryBoost: true,
    searchBoostMultiplier: 2.0,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BOOST-WEEKLY-TOP',
    name: 'Weekly Top Placement',
    description: '7-day featured placement with enhanced visibility',
    duration: 'weekly',
    position: 'category_top',
    price: 49.99,
    pricePerDay: 7.14,
    features: [
      'Top 3 placement in category',
      'Featured badge',
      'Advanced analytics',
      'Priority support',
    ],
    positionGuarantee: 3,
    categoryBoost: true,
    searchBoostMultiplier: 2.5,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BOOST-MONTHLY-FEATURED',
    name: 'Monthly Featured Placement',
    description: '30-day featured placement across all categories',
    duration: 'monthly',
    position: 'featured',
    price: 149.99,
    pricePerDay: 5.00,
    features: [
      'Featured in category pages',
      'Featured badge',
      'Full analytics dashboard',
      'Priority support',
      'Homepage rotation',
    ],
    positionGuarantee: 5,
    categoryBoost: true,
    searchBoostMultiplier: 3.0,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BOOST-QUARTERLY-PREMIUM',
    name: 'Quarterly Premium Package',
    description: '90-day premium placement with maximum visibility',
    duration: 'quarterly',
    position: 'premium',
    price: 399.99,
    pricePerDay: 4.44,
    features: [
      'Premium placement',
      'Premium badge',
      'Real-time analytics',
      'Dedicated support',
      'Homepage featured',
      'Category hero placement',
    ],
    positionGuarantee: 2,
    categoryBoost: true,
    searchBoostMultiplier: 4.0,
    isActive: true,
    createdAt: new Date(),
  },
  {
    productId: 'BOOST-HERO',
    name: 'Hero Placement',
    description: 'Maximum visibility with hero section placement',
    duration: 'monthly',
    position: 'hero',
    price: 299.99,
    pricePerDay: 10.00,
    features: [
      'Hero section placement',
      'Premium badge',
      'Real-time analytics',
      'Dedicated account manager',
      'Social media promotion',
      'Push notification feature',
    ],
    positionGuarantee: 1,
    categoryBoost: false,
    searchBoostMultiplier: 5.0,
    isActive: true,
    createdAt: new Date(),
  },
];

// Duration in days
const DURATION_DAYS: Record<BoostDuration, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

// ============================================
// Featured Search Boost Service
// ============================================

export class FeaturedSearchBoostService {
  private boostModel: any;

  constructor() {
    this.initializeModel();
  }

  private initializeModel(): void {
    try {
      this.boostModel = mongoose.models.FeaturedBoost || this.createBoostSchema();
    } catch {
      this.boostModel = this.createBoostSchema();
    }
  }

  private createBoostSchema(): any {
    const BoostSchema = new mongoose.Schema({
      boostId: { type: String, required: true, unique: true },
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      productName: { type: String, required: true },
      position: { type: String, enum: ['category_top', 'featured', 'premium', 'hero'], required: true },
      duration: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly'], required: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      originalPosition: Number,
      boostedPosition: { type: Number, required: true },
      price: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled', 'expired'], default: 'pending' },
      paymentId: String,
      paidAt: Date,
      metadata: {
        searchQueries: [String],
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        ctr: Number,
        categoryName: String,
        serviceName: String,
      },
    }, { timestamps: true });

    BoostSchema.index({ boostId: 1 }, { unique: true });
    BoostSchema.index({ providerId: 1, status: 1 });
    BoostSchema.index({ serviceId: 1, status: 1 });
    BoostSchema.index({ categoryId: 1, status: 1 });
    BoostSchema.index({ startDate: 1, endDate: 1 });
    BoostSchema.index({ status: 1, endDate: 1 }); // For finding expired boosts

    return mongoose.model('FeaturedBoost', BoostSchema);
  }

  /**
   * Get all available boost products
   */
  getProducts(): FeaturedBoostProduct[] {
    return BOOST_PRODUCTS.filter(p => p.isActive);
  }

  /**
   * Get product by ID
   */
  getProductById(productId: string): FeaturedBoostProduct | undefined {
    return BOOST_PRODUCTS.find(p => p.productId === productId && p.isActive);
  }

  /**
   * Get products by position
   */
  getProductsByPosition(position: BoostPosition): FeaturedBoostProduct[] {
    return BOOST_PRODUCTS.filter(p => p.position === position && p.isActive);
  }

  /**
   * Purchase a featured boost
   */
  async purchaseBoost(
    providerId: string | Types.ObjectId,
    productId: string,
    options: {
      serviceId?: string;
      categoryId?: string;
      startDate?: Date;
      paymentId?: string;
    } = {}
  ): Promise<{ success: boolean; boost?: FeaturedBoost; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      const product = this.getProductById(productId);
      if (!product) {
        return { success: false, error: 'Boost product not found' };
      }

      const boostId = this.generateBoostId();
      const startDate = options.startDate || new Date();
      const durationDays = DURATION_DAYS[product.duration];
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);

      // Get category/service info for metadata
      let categoryName: string | undefined;
      let serviceName: string | undefined;

      if (options.serviceId) {
        const service = await Service.findById(options.serviceId);
        if (service) {
          serviceName = service.name;
          if ((service as any).category) {
            categoryName = (service as any).categoryName || 'Category';
          }
        }
      }

      if (options.categoryId && !categoryName) {
        const ServiceCategory = mongoose.models.ServiceCategory;
        if (ServiceCategory) {
          const category = await ServiceCategory.findById(options.categoryId);
          if (category) {
            categoryName = (category as any).name;
          }
        }
      }

      const boost = new this.boostModel({
        boostId,
        providerId: providerObjectId,
        serviceId: options.serviceId ? new Types.ObjectId(options.serviceId) : undefined,
        categoryId: options.categoryId ? new Types.ObjectId(options.categoryId) : undefined,
        productId: product._id || new Types.ObjectId(),
        productName: product.name,
        position: product.position,
        duration: product.duration,
        startDate,
        endDate,
        boostedPosition: product.positionGuarantee,
        price: product.price,
        currency: 'AED',
        status: options.paymentId ? 'active' : 'pending',
        paymentId: options.paymentId,
        paidAt: options.paymentId ? new Date() : undefined,
        metadata: {
          categoryName,
          serviceName,
        },
      });

      await boost.save();

      // Update provider profile with boost info
      await ProviderProfile.findOneAndUpdate(
        { userId: providerObjectId },
        {
          $push: {
            'featuredBoosts': {
              boostId,
              productId: product.productId,
              position: product.position,
              startDate,
              endDate,
              status: boost.status,
            },
          },
        }
      );

      logger.info('Featured boost purchased', {
        boostId,
        providerId: providerObjectId.toString(),
        productId,
        price: product.price,
        startDate,
        endDate,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.FEATURED_BOOST_PURCHASED, {
        boostId,
        providerId: providerObjectId.toString(),
        productId,
        position: product.position,
        price: product.price,
      });

      return { success: true, boost };
    } catch (error) {
      logger.error('Error purchasing featured boost', {
        providerId: providerId.toString(),
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase boost',
      };
    }
  }

  /**
   * Get active boosts for a provider
   */
  async getActiveBoosts(providerId: string | Types.ObjectId): Promise<FeaturedBoost[]> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    return this.boostModel.find({
      providerId: providerObjectId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).sort({ endDate: 1 });
  }

  /**
   * Get boost by ID
   */
  async getBoost(boostId: string): Promise<FeaturedBoost | null> {
    return this.boostModel.findOne({ boostId });
  }

  /**
   * Update boost analytics
   */
  async updateAnalytics(
    boostId: string,
    data: {
      impressions?: number;
      clicks?: number;
      conversions?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const boost = await this.boostModel.findOne({ boostId });
      if (!boost) {
        return { success: false, error: 'Boost not found' };
      }

      if (data.impressions !== undefined) {
        boost.metadata = boost.metadata || {};
        boost.metadata.impressions = data.impressions;
      }
      if (data.clicks !== undefined) {
        boost.metadata = boost.metadata || {};
        boost.metadata.clicks = data.clicks;
        // Calculate CTR
        if (boost.metadata.impressions && boost.metadata.impressions > 0) {
          boost.metadata.ctr = (data.clicks / boost.metadata.impressions) * 100;
        }
      }
      if (data.conversions !== undefined) {
        boost.metadata = boost.metadata || {};
        boost.metadata.conversions = data.conversions;
      }

      await boost.save();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update analytics',
      };
    }
  }

  /**
   * Cancel a boost
   */
  async cancelBoost(
    boostId: string,
    reason?: string
  ): Promise<{ success: boolean; refundAmount?: number; error?: string }> {
    try {
      const boost = await this.boostModel.findOne({ boostId });
      if (!boost) {
        return { success: false, error: 'Boost not found' };
      }

      if (boost.status === 'completed' || boost.status === 'cancelled') {
        return { success: false, error: `Cannot cancel boost with status: ${boost.status}` };
      }

      // Calculate refund based on remaining time
      const now = new Date();
      const remainingDays = Math.max(0, (boost.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = DURATION_DAYS[boost.duration as BoostDuration];
      const usedDays = totalDays - remainingDays;

      // Full refund if not started, partial if partially used
      let refundAmount = 0;
      if (now < boost.startDate) {
        refundAmount = boost.price; // Full refund
      } else if (remainingDays > 0) {
        refundAmount = Math.round((boost.price * (remainingDays / totalDays)) * 100) / 100;
      }

      boost.status = 'cancelled';
      await boost.save();

      // Remove from provider profile
      await ProviderProfile.findOneAndUpdate(
        { userId: boost.providerId },
        {
          $pull: {
            'featuredBoosts': { boostId },
          },
        }
      );

      logger.info('Featured boost cancelled', {
        boostId,
        reason,
        refundAmount,
        remainingDays,
      });

      return { success: true, refundAmount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel boost',
      };
    }
  }

  /**
   * Get provider's boost history
   */
  async getBoostHistory(
    providerId: string | Types.ObjectId,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<{ boosts: FeaturedBoost[]; total: number }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const query: any = { providerId: providerObjectId };
    if (options.status) {
      query.status = options.status;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [boosts, total] = await Promise.all([
      this.boostModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.boostModel.countDocuments(query),
    ]);

    return { boosts, total };
  }

  /**
   * Process expired boosts
   */
  async processExpiredBoosts(): Promise<{ processed: number }> {
    const expiredBoosts = await this.boostModel.find({
      status: 'active',
      endDate: { $lt: new Date() },
    });

    for (const boost of expiredBoosts) {
      boost.status = 'expired';
      await boost.save();

      // Remove from provider profile
      await ProviderProfile.findOneAndUpdate(
        { userId: boost.providerId },
        {
          $set: {
            'featuredBoosts.$.status': 'expired',
          },
        }
      );

      logger.info('Expired boost processed', {
        boostId: boost.boostId,
        providerId: boost.providerId.toString(),
      });
    }

    return { processed: expiredBoosts.length };
  }

  /**
   * Get analytics for boosts
   */
  async getAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    providerId?: string;
    categoryId?: string;
  } = {}): Promise<{
    totalBoosts: number;
    activeBoosts: number;
    totalSpent: number;
    averageCtr: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    byPosition: Record<BoostPosition, { count: number; spent: number }>;
    topPerformingBoosts: Array<{
      boostId: string;
      productName: string;
      ctr: number;
      conversions: number;
    }>;
  }> {
    const query: any = {};
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    }
    if (options.providerId) {
      query.providerId = new Types.ObjectId(options.providerId);
    }
    if (options.categoryId) {
      query.categoryId = new Types.ObjectId(options.categoryId);
    }

    const boosts = await this.boostModel.find(query);

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalSpent = 0;
    let ctrSum = 0;
    let ctrCount = 0;
    const byPosition: Record<BoostPosition, { count: number; spent: number }> = {
      category_top: { count: 0, spent: 0 },
      featured: { count: 0, spent: 0 },
      premium: { count: 0, spent: 0 },
      hero: { count: 0, spent: 0 },
    };

    for (const boost of boosts) {
      totalSpent += boost.price;
      if (boost.metadata) {
        totalImpressions += boost.metadata.impressions || 0;
        totalClicks += boost.metadata.clicks || 0;
        totalConversions += boost.metadata.conversions || 0;
        if (boost.metadata.ctr) {
          ctrSum += boost.metadata.ctr;
          ctrCount++;
        }
      }
      const pos = boost.position as BoostPosition;
      byPosition[pos].count++;
      byPosition[pos].spent += boost.price;
    }

    // Find top performing boosts
    const topPerforming = boosts
      .filter((b: { metadata?: { ctr?: number } }) => b.metadata?.ctr)
      .sort((a: { metadata?: { ctr?: number } }, b: { metadata?: { ctr?: number } }) => (b.metadata?.ctr || 0) - (a.metadata?.ctr || 0))
      .slice(0, 5)
      .map((b: { boostId: string; productName: string; metadata?: { ctr?: number; conversions?: number } }) => ({
        boostId: b.boostId,
        productName: b.productName,
        ctr: b.metadata?.ctr || 0,
        conversions: b.metadata?.conversions || 0,
      }));

    return {
      totalBoosts: boosts.length,
      activeBoosts: boosts.filter((b: { status: string }) => b.status === 'active').length,
      totalSpent,
      averageCtr: ctrCount > 0 ? ctrSum / ctrCount : 0,
      totalImpressions,
      totalClicks,
      totalConversions,
      byPosition,
      topPerformingBoosts: topPerforming,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateBoostId(): string {
    return `BST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const featuredSearchBoostService = new FeaturedSearchBoostService();
export default featuredSearchBoostService;
