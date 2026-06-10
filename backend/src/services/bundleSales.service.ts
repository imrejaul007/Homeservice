import mongoose, { Types } from 'mongoose';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import Bundle from '../models/bundle.model';
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
  quantity: number;
  description?: string;
}

export interface Bundle {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  services: BundleService[];
  originalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercentage: number;
  validFrom: Date;
  validUntil: Date;
  maxRedemptions?: number;
  redemptionsUsed: number;
  categoryId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  isActive: boolean;
  isFeatured: boolean;
  image?: string;
  tags?: string[];
  terms?: string;
  rating?: {
    average: number;
    count: number;
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
  private bundleModel: typeof Bundle;

  constructor() {
    this.bundleModel = Bundle;
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
    validFrom: Date;
    validUntil: Date;
    maxRedemptions?: number;
    tags?: string[];
    terms?: string;
    image?: string;
  }): Promise<{ success: boolean; bundle?: any; error?: string }> {
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
      let originalPrice = 0;
      const bundleServices: BundleService[] = services.map(service => {
        const price = (service as any).price?.amount || (service as any).basePrice || 0;
        originalPrice += price;
        return {
          serviceId: service._id as Types.ObjectId,
          serviceName: service.name,
          originalPrice: price,
          quantity: 1,
        };
      });

      // Apply discount
      const savingsAmount = Math.round(originalPrice * (data.discountPercentage / 100) * 100) / 100;
      const bundlePrice = Math.round((originalPrice - savingsAmount) * 100) / 100;

      const bundle = new this.bundleModel({
        name: data.name,
        description: data.description,
        services: bundleServices,
        originalPrice,
        bundlePrice,
        savingsAmount,
        savingsPercentage: data.discountPercentage,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        maxRedemptions: data.maxRedemptions,
        redemptionsUsed: 0,
        categoryId: data.categoryId ? new mongoose.Types.ObjectId(data.categoryId) : undefined,
        createdBy: data.providerId ? new mongoose.Types.ObjectId(data.providerId) : new mongoose.Types.ObjectId(),
        isActive: true,
        isFeatured: false,
        tags: data.tags || [],
        terms: data.terms,
        image: data.image,
      });

      await bundle.save();

      logger.info('Bundle created', {
        bundleId: bundle._id.toString(),
        name: data.name,
        originalPrice,
        bundlePrice,
        savingsPercentage: data.discountPercentage,
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
      .populate('categoryId');
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
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    };

    if (options.categoryId) {
      query.categoryId = new mongoose.Types.ObjectId(options.categoryId);
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [bundles, total] = await Promise.all([
      this.bundleModel.find(query)
        .populate('services.serviceId', 'name images')
        .populate('categoryId', 'name')
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
      scheduledTime?: string;
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
          now < bundle.validFrom ||
          now > bundle.validUntil) {
        await session.abortTransaction();
        return { success: false, error: 'Bundle is not available' };
      }

      // Check redemption limit
      if (bundle.maxRedemptions && bundle.redemptionsUsed >= bundle.maxRedemptions) {
        await session.abortTransaction();
        return { success: false, error: 'Bundle redemption limit reached' };
      }

      // Increment redemption count
      bundle.redemptionsUsed += 1;
      await bundle.save({ session });

      // Create individual bookings for each service
      const bookingNumbers: string[] = [];
      for (const bundleService of bundle.services) {
        const service = await Service.findById(bundleService.serviceId).session(session);
        if (!service) continue;

        const providerId = bookingData.providerId || (bundle.createdBy?.toString());

        if (!providerId) continue;

        // Calculate the discounted price for this service
        const originalPrice = bundleService.originalPrice;
        const discountedPrice = Math.round(
          originalPrice * (1 - bundle.savingsPercentage / 100) * 100
        ) / 100;

        const booking = new Booking({
          bookingNumber: this.generateBookingNumber(),
          customerId: new mongoose.Types.ObjectId(customerId),
          providerId: new mongoose.Types.ObjectId(providerId),
          serviceId: service._id,
          scheduledDate: bookingData.scheduledDate || new Date(),
          scheduledTime: bookingData.scheduledTime || '10:00',
          duration: service.duration || 60,
          location: bookingData.location,
          pricing: {
            basePrice: discountedPrice,
            addOns: [],
            discounts: [{
              type: 'bundle',
              code: bundle._id.toString(),
              amount: originalPrice - discountedPrice,
            }],
            subtotal: discountedPrice,
            tax: 0,
            totalAmount: discountedPrice,
            currency: 'AED',
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

      const savings = bundle.savingsAmount;

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
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    };

    if (categoryIds.size > 0) {
      query.categoryId = { $in: Array.from(categoryIds).map(id => new mongoose.Types.ObjectId(id)) };
    }

    return this.bundleModel.find(query)
      .populate('services.serviceId', 'name images')
      .sort({ savingsPercentage: -1, redemptionsUsed: -1 })
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
