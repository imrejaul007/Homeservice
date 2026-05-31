import mongoose, { Types } from 'mongoose';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export interface BundleService {
  serviceId: Types.ObjectId;
  serviceName: string;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
}

export interface Bundle {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  services: BundleService[];
  originalTotal: number;
  bundlePrice: number;
  discountAmount: number;
  discountPercentage: number;
  currency: string;
  category?: Types.ObjectId;
  providerId?: Types.ObjectId;
  isActive: boolean;
  validityPeriod: {
    startDate: Date;
    endDate: Date;
  };
  usageLimit?: number;
  usageCount: number;
  metadata?: {
    tags?: string[];
    imageUrl?: string;
    highlightServices?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleBooking {
  _id?: Types.ObjectId;
  bundleId: Types.ObjectId;
  bundleName: string;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  services: Array<{
    serviceId: Types.ObjectId;
    serviceName: string;
    priceAtBooking: number;
    bookingId?: Types.ObjectId;
  }>;
  originalTotal: number;
  bundlePrice: number;
  savings: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';
  bookedAt: Date;
  completedAt?: Date;
}

export interface BundleAnalytics {
  totalBundles: number;
  activeBundles: number;
  totalBookings: number;
  totalRevenue: number;
  totalSavings: number;
  averageOrderValue: number;
  conversionRate: number;
  topBundles: Array<{
    bundleId: string;
    bundleName: string;
    bookingCount: number;
    revenue: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    bundleCount: number;
    bookingCount: number;
  }>;
}

// ============================================
// Bundle Sales Service
// ============================================

export class BundleSalesService {
  private bundleModel: any;

  constructor() {
    // Initialize bundle schema dynamically if model doesn't exist
    this.initializeBundleModel();
  }

  private initializeBundleModel(): void {
    try {
      this.bundleModel = mongoose.models.Bundle || this.createBundleSchema();
    } catch {
      this.bundleModel = this.createBundleSchema();
    }
  }

  private createBundleSchema(): any {
    const BundleSchema = new mongoose.Schema({
      name: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      services: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
        serviceName: { type: String, required: true },
        originalPrice: { type: Number, required: true },
        discountedPrice: { type: Number, required: true },
        quantity: { type: Number, default: 1, min: 1 },
      }],
      originalTotal: { type: Number, required: true },
      bundlePrice: { type: Number, required: true },
      discountAmount: { type: Number, required: true },
      discountPercentage: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      category: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      isActive: { type: Boolean, default: true },
      validityPeriod: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
      },
      usageLimit: { type: Number },
      usageCount: { type: Number, default: 0 },
      metadata: {
        tags: [String],
        imageUrl: String,
        highlightServices: [String],
      },
    }, { timestamps: true });

    BundleSchema.index({ isActive: 1, 'validityPeriod.endDate': 1 });
    BundleSchema.index({ category: 1 });
    BundleSchema.index({ providerId: 1 });

    return mongoose.model('Bundle', BundleSchema);
  }

  /**
   * Create a new service bundle
   */
  async createBundle(data: {
    name: string;
    description: string;
    serviceIds: string[];
    discountPercentage: number;
    providerId?: string;
    categoryId?: string;
    validityPeriod: { startDate: Date; endDate: Date };
    usageLimit?: number;
    metadata?: {
      tags?: string[];
      imageUrl?: string;
      highlightServices?: string[];
    };
  }): Promise<{ success: boolean; bundle?: Bundle; error?: string }> {
    try {
      // Validate service IDs
      if (!data.serviceIds || data.serviceIds.length < 2) {
        return { success: false, error: 'Bundle must contain at least 2 services' };
      }

      // Fetch services and calculate pricing
      const serviceIds = data.serviceIds.map(id => new mongoose.Types.ObjectId(id));
      const services = await Service.find({ _id: { $in: serviceIds } });

      if (services.length !== data.serviceIds.length) {
        return { success: false, error: 'One or more services not found' };
      }

      // Calculate bundle pricing
      let originalTotal = 0;
      const bundleServices: BundleService[] = services.map(service => {
        const price = (service as any).price?.amount || (service as any).basePrice || 0;
        originalTotal += price;
        return {
          serviceId: service._id as Types.ObjectId,
          serviceName: service.name,
          originalPrice: price,
          discountedPrice: price, // Will be calculated below
          quantity: 1,
        };
      });

      // Apply discount
      const discountAmount = Math.round(originalTotal * (data.discountPercentage / 100) * 100) / 100;
      const bundlePrice = Math.round((originalTotal - discountAmount) * 100) / 100;

      // Update discounted prices proportionally
      for (const service of bundleServices) {
        service.discountedPrice = Math.round(
          service.originalPrice * (1 - data.discountPercentage / 100) * 100
        ) / 100;
      }

      const bundle = new this.bundleModel({
        name: data.name,
        description: data.description,
        services: bundleServices,
        originalTotal,
        bundlePrice,
        discountAmount,
        discountPercentage: data.discountPercentage,
        currency: 'AED',
        category: data.categoryId ? new mongoose.Types.ObjectId(data.categoryId) : undefined,
        providerId: data.providerId ? new mongoose.Types.ObjectId(data.providerId) : undefined,
        validityPeriod: data.validityPeriod,
        usageLimit: data.usageLimit,
        metadata: data.metadata,
      });

      await bundle.save();

      logger.info('Bundle created', {
        bundleId: bundle._id.toString(),
        name: data.name,
        originalTotal,
        bundlePrice,
        discountPercentage: data.discountPercentage,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.BUNDLE_CREATED, {
        bundleId: bundle._id.toString(),
        name: data.name,
        serviceCount: services.length,
        bundlePrice,
      });

      return { success: true, bundle };
    } catch (error) {
      logger.error('Error creating bundle', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bundle',
      };
    }
  }

  /**
   * Get bundle by ID
   */
  async getBundleById(bundleId: string): Promise<Bundle | null> {
    return this.bundleModel.findById(bundleId)
      .populate('services.serviceId')
      .populate('category');
  }

  /**
   * Get available bundles for a category or provider
   */
  async getAvailableBundles(options: {
    categoryId?: string;
    providerId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ bundles: Bundle[]; total: number }> {
    const now = new Date();
    const query: any = {
      isActive: true,
      'validityPeriod.startDate': { $lte: now },
      'validityPeriod.endDate': { $gte: now },
    };

    if (options.categoryId) {
      query.category = new mongoose.Types.ObjectId(options.categoryId);
    }

    if (options.providerId) {
      query.providerId = new mongoose.Types.ObjectId(options.providerId);
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [bundles, total] = await Promise.all([
      this.bundleModel.find(query)
        .populate('services.serviceId', 'name images')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.bundleModel.countDocuments(query),
    ]);

    return { bundles, total };
  }

  /**
   * Book a bundle (creates individual bookings for each service)
   */
  async bookBundle(
    bundleId: string,
    customerId: string,
    bookingData: {
      providerId?: string;
      scheduledDate?: Date;
      location?: any;
    }
  ): Promise<{ success: boolean; bookingNumber?: string; savings?: number; error?: string }> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const bundle = await this.bundleModel.findById(bundleId).session(session);
      if (!bundle) {
        await session.abortTransaction();
        return { success: false, error: 'Bundle not found' };
      }

      // Check validity
      const now = new Date();
      if (!bundle.isActive ||
          now < bundle.validityPeriod.startDate ||
          now > bundle.validityPeriod.endDate) {
        await session.abortTransaction();
        return { success: false, error: 'Bundle is not available' };
      }

      // Check usage limit
      if (bundle.usageLimit && bundle.usageCount >= bundle.usageLimit) {
        await session.abortTransaction();
        return { success: false, error: 'Bundle usage limit reached' };
      }

      // Increment usage count
      bundle.usageCount += 1;
      await bundle.save({ session });

      // Create individual bookings for each service
      const bookingNumbers: string[] = [];
      for (const bundleService of bundle.services) {
        const service = await Service.findById(bundleService.serviceId).session(session);
        if (!service) continue;

        const providerId = bookingData.providerId ||
          ((service as any).providerId?.toString()) ||
          (bundle.providerId?.toString());

        if (!providerId) continue;

        const booking = new Booking({
          bookingNumber: this.generateBookingNumber(),
          customerId: new mongoose.Types.ObjectId(customerId),
          providerId: new mongoose.Types.ObjectId(providerId),
          serviceId: service._id,
          scheduledDate: bookingData.scheduledDate || new Date(),
          scheduledTime: '10:00',
          duration: service.duration || 60,
          location: bookingData.location,
          pricing: {
            basePrice: bundleService.discountedPrice,
            addOns: [],
            discounts: [{
              type: 'bundle',
              code: bundle._id.toString(),
              amount: bundleService.originalPrice - bundleService.discountedPrice,
            }],
            subtotal: bundleService.discountedPrice,
            tax: 0,
            totalAmount: bundleService.discountedPrice,
            currency: bundle.currency,
          },
          status: 'confirmed',
          metadata: {
            bundleId: bundle._id,
            bundleName: bundle.name,
            bundleBooking: true,
          },
        });

        await booking.save({ session });
        bookingNumbers.push(booking.bookingNumber);
      }

      await session.commitTransaction();

      const savings = bundle.discountAmount;

      logger.info('Bundle booked', {
        bundleId: bundle._id.toString(),
        customerId,
        serviceCount: bundle.services.length,
        savings,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.BUNDLE_BOOKED, {
        bundleId: bundle._id.toString(),
        bundleName: bundle.name,
        customerId,
        bookingCount: bookingNumbers.length,
        savings,
      });

      return {
        success: true,
        bookingNumber: bookingNumbers[0],
        savings,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error booking bundle', {
        bundleId,
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to book bundle',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Update bundle
   */
  async updateBundle(
    bundleId: string,
    updates: Partial<Bundle>
  ): Promise<{ success: boolean; bundle?: Bundle; error?: string }> {
    try {
      const bundle = await this.bundleModel.findById(bundleId);
      if (!bundle) {
        return { success: false, error: 'Bundle not found' };
      }

      // Apply updates
      Object.assign(bundle, updates);
      await bundle.save();

      return { success: true, bundle };
    } catch (error) {
      logger.error('Error updating bundle', {
        bundleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update bundle',
      };
    }
  }

  /**
   * Deactivate bundle
   */
  async deactivateBundle(bundleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.bundleModel.findByIdAndUpdate(bundleId, { isActive: false });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate bundle',
      };
    }
  }

  /**
   * Generate analytics for bundles
   */
  async getAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    providerId?: string;
    categoryId?: string;
  } = {}): Promise<BundleAnalytics> {
    const matchQuery: any = {
      'metadata.bundleBooking': true,
    };

    if (options.startDate || options.endDate) {
      matchQuery.createdAt = {};
      if (options.startDate) matchQuery.createdAt.$gte = options.startDate;
      if (options.endDate) matchQuery.createdAt.$lte = options.endDate;
    }

    const bookings = await Booking.find(matchQuery);

    // Calculate analytics
    let totalBookings = 0;
    let totalRevenue = 0;
    let totalSavings = 0;
    const bundleMap = new Map<string, { name: string; count: number; revenue: number }>();
    const categoryMap = new Map<string, { name: string; bundles: number; bookings: number }>();

    for (const booking of bookings) {
      const bundleId = (booking.metadata as any)?.bundleId?.toString();
      const bundleName = (booking.metadata as any)?.bundleName || 'Unknown';
      const bundleDiscount = (booking.pricing as any)?.discounts?.find(
        (d: any) => d.type === 'bundle'
      );

      if (bundleId) {
        totalBookings++;
        totalRevenue += (booking.pricing as any)?.totalAmount || 0;
        totalSavings += bundleDiscount?.amount || 0;

        const existing = bundleMap.get(bundleId) || { name: bundleName, count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += (booking.pricing as any)?.totalAmount || 0;
        bundleMap.set(bundleId, existing);
      }
    }

    const allBundles = await this.bundleModel.find();
    const activeBundles = allBundles.filter((b: any) => b.isActive).length;

    const topBundles = Array.from(bundleMap.entries())
      .map(([bundleId, data]) => ({
        bundleId,
        bundleName: data.name,
        bookingCount: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const byCategory = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      bundleCount: data.bundles,
      bookingCount: data.bookings,
    }));

    return {
      totalBundles: allBundles.length,
      activeBundles,
      totalBookings,
      totalRevenue,
      totalSavings,
      averageOrderValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      conversionRate: 0, // Would need view/impression data
      topBundles,
      byCategory,
    };
  }

  /**
   * Get bundle recommendations for a customer
   */
  async getRecommendations(customerId: string, limit: number = 5): Promise<Bundle[]> {
    // Get customer's booking history to identify categories
    const customerBookings = await Booking.find({ customerId })
      .populate('serviceId', 'category')
      .limit(20);

    const categoryIds = new Set<string>();
    for (const booking of customerBookings) {
      const service = booking.serviceId as any;
      if (service?.category) {
        categoryIds.add(service.category.toString());
      }
    }

    // Find bundles in those categories
    const now = new Date();
    const query: any = {
      isActive: true,
      'validityPeriod.startDate': { $lte: now },
      'validityPeriod.endDate': { $gte: now },
    };

    if (categoryIds.size > 0) {
      query.category = { $in: Array.from(categoryIds).map(id => new mongoose.Types.ObjectId(id)) };
    }

    return this.bundleModel.find(query)
      .populate('services.serviceId', 'name images')
      .sort({ discountPercentage: -1, usageCount: -1 })
      .limit(limit);
  }

  private generateBookingNumber(): string {
    const now = new Date();
    return `BZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const bundleSalesService = new BundleSalesService();
export default bundleSalesService;
