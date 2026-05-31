import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export interface PriorityMatchConfig {
  enabled: boolean;
  baseFeePercentage: number;
  maxFeePercentage: number;
  minFee: number;
  maxFee: number;
  boostMultiplier: number;
}

export interface PriorityMatchFee {
  _id?: Types.ObjectId;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  providerId: Types.ObjectId;
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  baseServicePrice: number;
  priorityFee: number;
  totalPrice: number;
  currency: string;
  boostLevel: 'standard' | 'enhanced' | 'premium' | 'exclusive';
  positionGuarantee: number; // Minimum position in search results
  validUntil: Date;
  status: 'active' | 'expired' | 'used' | 'cancelled';
  createdAt: Date;
  metadata?: {
    originalSearchRank?: number;
    finalSearchRank?: number;
    categoryId?: Types.ObjectId;
    serviceName?: string;
  };
}

export interface ProviderEarningsAdjustment {
  providerId: Types.ObjectId;
  bookingId: Types.ObjectId;
  originalEarnings: number;
  priorityFeeDeduction: number;
  adjustedEarnings: number;
  platformShare: number;
  calculatedAt: Date;
}

// Fee calculation by boost level
const BOOST_LEVEL_FEES: Record<string, { feePercentage: number; positionGuarantee: number }> = {
  standard: { feePercentage: 3, positionGuarantee: 10 },
  enhanced: { feePercentage: 5, positionGuarantee: 5 },
  premium: { feePercentage: 8, positionGuarantee: 3 },
  exclusive: { feePercentage: 12, positionGuarantee: 1 },
};

// ============================================
// Priority Match Fee Service
// ============================================

export class PriorityMatchFeeService {
  private config: PriorityMatchConfig = {
    enabled: true,
    baseFeePercentage: 3,
    maxFeePercentage: 15,
    minFee: 5,
    maxFee: 200,
    boostMultiplier: 1.5,
  };

  /**
   * Initialize with custom configuration
   */
  async initialize(config: Partial<PriorityMatchConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    logger.info('PriorityMatchFeeService initialized', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): PriorityMatchConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<PriorityMatchConfig>): Promise<PriorityMatchConfig> {
    this.config = { ...this.config, ...updates };
    return this.config;
  }

  /**
   * Calculate priority match fee based on service price and boost level
   */
  calculateFee(
    servicePrice: number,
    boostLevel: PriorityMatchFee['boostLevel']
  ): { priorityFee: number; totalPrice: number; feePercentage: number } {
    const levelConfig = BOOST_LEVEL_FEES[boostLevel] || BOOST_LEVEL_FEES.standard;
    let feePercentage = levelConfig.feePercentage;

    // Apply boost multiplier for higher tiers
    if (boostLevel === 'premium' || boostLevel === 'exclusive') {
      feePercentage = Math.min(
        feePercentage * this.config.boostMultiplier,
        this.config.maxFeePercentage
      );
    }

    // Calculate fee
    let priorityFee = servicePrice * (feePercentage / 100);

    // Apply min/max constraints
    priorityFee = Math.max(this.config.minFee, priorityFee);
    priorityFee = Math.min(this.config.maxFee, priorityFee);

    // Round to 2 decimal places
    priorityFee = Math.round(priorityFee * 100) / 100;

    return {
      priorityFee,
      totalPrice: servicePrice + priorityFee,
      feePercentage,
    };
  }

  /**
   * Check if a provider is eligible for priority matching
   */
  async checkEligibility(providerId: string | Types.ObjectId): Promise<{
    eligible: boolean;
    reason?: string;
    maxBoostLevel?: PriorityMatchFee['boostLevel'];
  }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const provider = await ProviderProfile.findOne({ userId: providerObjectId });

    if (!provider) {
      return { eligible: false, reason: 'Provider profile not found' };
    }

    // Check if provider is active
    if (provider.isActive === false) {
      return { eligible: false, reason: 'Provider is not active' };
    }

    // Check minimum rating requirement for premium/exclusive
    const minRating = 4.0;
    const currentRating = provider.reviewsData?.averageRating || 0;

    if (currentRating < minRating) {
      return {
        eligible: true,
        maxBoostLevel: 'enhanced',
        reason: `Rating ${currentRating} below minimum ${minRating} for premium placement`,
      };
    }

    // Determine max boost level based on provider metrics
    let maxBoostLevel: PriorityMatchFee['boostLevel'] = 'standard';

    if (currentRating >= 4.5) {
      maxBoostLevel = 'exclusive';
    } else if (currentRating >= 4.2) {
      maxBoostLevel = 'premium';
    } else if (currentRating >= 4.0) {
      maxBoostLevel = 'enhanced';
    }

    return { eligible: true, maxBoostLevel };
  }

  /**
   * Create priority match fee record for a booking
   */
  async createPriorityMatch(
    bookingId: string | Types.ObjectId,
    boostLevel: PriorityMatchFee['boostLevel'],
    options: {
      providerId?: string | Types.ObjectId;
      customFee?: number;
    } = {}
  ): Promise<{ success: boolean; record?: PriorityMatchFee; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId)
        .populate('serviceId')
        .populate('customerId');

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Get service price
      const service = booking.serviceId as any;
      const servicePrice = service?.price?.amount || service?.basePrice || 0;

      if (servicePrice <= 0) {
        return { success: false, error: 'Invalid service price' };
      }

      // Calculate fee
      let priorityFee: number;
      let feePercentage: number;

      if (options.customFee !== undefined) {
        priorityFee = options.customFee;
        feePercentage = (priorityFee / servicePrice) * 100;
      } else {
        const calculated = this.calculateFee(servicePrice, boostLevel);
        priorityFee = calculated.priorityFee;
        feePercentage = calculated.feePercentage;
      }

      // Validate fee against limits
      priorityFee = Math.max(this.config.minFee, priorityFee);
      priorityFee = Math.min(this.config.maxFee, priorityFee);

      const levelConfig = BOOST_LEVEL_FEES[boostLevel];
      const totalPrice = servicePrice + priorityFee;

      // Get provider name
      const providerObjectId = options.providerId
        ? (typeof options.providerId === 'string'
            ? new Types.ObjectId(options.providerId)
            : options.providerId)
        : booking.providerId as Types.ObjectId;

      const User = mongoose.model('User');
      const provider = await User.findById(providerObjectId);
      const providerName = provider
        ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim()
        : 'Unknown';

      const record: PriorityMatchFee = {
        _id: new Types.ObjectId(),
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        providerId: providerObjectId,
        customerId: (booking.customerId as Types.ObjectId) || new Types.ObjectId(),
        serviceId: booking.serviceId as Types.ObjectId,
        baseServicePrice: servicePrice,
        priorityFee,
        totalPrice,
        currency: service?.price?.currency || 'AED',
        boostLevel,
        positionGuarantee: levelConfig?.positionGuarantee || 10,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'active',
        createdAt: new Date(),
        metadata: {
          categoryId: service?.category,
          serviceName: service?.name || 'Unknown Service',
        },
      };

      // Store in booking metadata
      booking.metadata = booking.metadata || {};
      (booking.metadata as any).priorityMatch = {
        fee: priorityFee,
        boostLevel,
        positionGuarantee: record.positionGuarantee,
        totalPrice,
        createdAt: new Date(),
      };
      await booking.save();

      logger.info('Priority match fee created', {
        bookingId: bookingObjectId.toString(),
        boostLevel,
        priorityFee,
        totalPrice,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.PRIORITY_MATCH_CREATED, {
        bookingId: bookingObjectId.toString(),
        providerId: providerObjectId.toString(),
        boostLevel,
        priorityFee,
        servicePrice,
      });

      return { success: true, record };
    } catch (error) {
      logger.error('Error creating priority match fee', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create priority match',
      };
    }
  }

  /**
   * Adjust provider earnings for priority match fee
   */
  async calculateEarningsAdjustment(
    bookingId: string | Types.ObjectId
  ): Promise<ProviderEarningsAdjustment | null> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return null;
      }

      const priorityMatch = (booking.metadata as any)?.priorityMatch;
      if (!priorityMatch) {
        return null;
      }

      const priorityFee = priorityMatch.fee || 0;
      const baseAmount = (booking.pricing as any)?.subtotal || 0;
      const providerEarnings = (booking.pricing as any)?.providerEarnings || 0;

      // Calculate platform's share of the priority fee
      // Platform keeps a portion as service fee
      const platformShareRate = 0.15; // 15% platform fee on priority fee
      const platformShare = Math.round(priorityFee * platformShareRate * 100) / 100;

      // Remaining goes to provider (offset from their earnings)
      const priorityFeeDeduction = priorityFee;
      const adjustedEarnings = providerEarnings - priorityFee + (priorityFee - platformShare);

      const adjustment: ProviderEarningsAdjustment = {
        providerId: booking.providerId as Types.ObjectId,
        bookingId: bookingObjectId,
        originalEarnings: providerEarnings,
        priorityFeeDeduction,
        adjustedEarnings: Math.max(0, adjustedEarnings),
        platformShare,
        calculatedAt: new Date(),
      };

      logger.info('Priority match earnings adjustment calculated', {
        bookingId: bookingObjectId.toString(),
        originalEarnings: providerEarnings,
        adjustedEarnings: adjustment.adjustedEarnings,
        platformShare,
      });

      return adjustment;
    } catch (error) {
      logger.error('Error calculating earnings adjustment', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update priority match status
   */
  async updateStatus(
    bookingId: string | Types.ObjectId,
    newStatus: PriorityMatchFee['status']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      const priorityMatch = (booking.metadata as any)?.priorityMatch;
      if (!priorityMatch) {
        return { success: false, error: 'No priority match record found' };
      }

      priorityMatch.status = newStatus;
      priorityMatch.updatedAt = new Date();
      await booking.save();

      logger.info('Priority match status updated', {
        bookingId: bookingObjectId.toString(),
        newStatus,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating priority match status', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  /**
   * Get boost level options with pricing
   */
  getBoostLevelOptions(servicePrice: number): Array<{
    level: PriorityMatchFee['boostLevel'];
    fee: number;
    feePercentage: number;
    positionGuarantee: number;
    features: string[];
  }> {
    const levels: PriorityMatchFee['boostLevel'][] = ['standard', 'enhanced', 'premium', 'exclusive'];

    return levels.map(level => {
      const { priorityFee, feePercentage } = this.calculateFee(servicePrice, level);
      const levelConfig = BOOST_LEVEL_FEES[level];

      const features: string[] = [];
      if (level === 'standard') {
        features.push('Top 10 visibility', 'Basic analytics');
      } else if (level === 'enhanced') {
        features.push('Top 5 visibility', 'Advanced analytics', 'Featured badge');
      } else if (level === 'premium') {
        features.push('Top 3 visibility', 'Premium analytics', 'Featured badge', 'Priority support');
      } else if (level === 'exclusive') {
        features.push('#1 position', 'Real-time analytics', 'Premium badge', 'Dedicated support', 'Exclusive category');
      }

      return {
        level,
        fee: priorityFee,
        feePercentage,
        positionGuarantee: levelConfig?.positionGuarantee || 10,
        features,
      };
    });
  }

  /**
   * Get analytics for priority matching
   */
  async getAnalytics(
    options: {
      startDate?: Date;
      endDate?: Date;
      providerId?: string | Types.ObjectId;
    } = {}
  ): Promise<{
    totalMatches: number;
    revenueGenerated: number;
    averageFee: number;
    byLevel: Record<string, { count: number; revenue: number }>;
    topProviders: Array<{ providerId: string; matchCount: number; revenue: number }>;
  }> {
    const query: any = {
      'metadata.priorityMatch': { $exists: true, $ne: null },
    };

    if (options.startDate || options.endDate) {
      query.scheduledDate = {};
      if (options.startDate) query.scheduledDate.$gte = options.startDate;
      if (options.endDate) query.scheduledDate.$lte = options.endDate;
    }

    if (options.providerId) {
      query.providerId = typeof options.providerId === 'string'
        ? new Types.ObjectId(options.providerId)
        : options.providerId;
    }

    const bookings = await Booking.find(query);

    const byLevel: Record<string, { count: number; revenue: number }> = {};
    const providerMap = new Map<string, { matchCount: number; revenue: number }>();

    let totalMatches = 0;
    let totalRevenue = 0;

    for (const booking of bookings) {
      const priorityMatch = (booking.metadata as any)?.priorityMatch;
      const level = priorityMatch?.boostLevel || 'standard';
      const fee = priorityMatch?.fee || 0;

      totalMatches++;
      totalRevenue += fee;

      if (!byLevel[level]) {
        byLevel[level] = { count: 0, revenue: 0 };
      }
      byLevel[level].count++;
      byLevel[level].revenue += fee;

      const providerId = booking.providerId.toString();
      const existing = providerMap.get(providerId) || { matchCount: 0, revenue: 0 };
      existing.matchCount++;
      existing.revenue += fee;
      providerMap.set(providerId, existing);
    }

    const topProviders = Array.from(providerMap.entries())
      .map(([providerId, data]) => ({ providerId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalMatches,
      revenueGenerated: totalRevenue,
      averageFee: totalMatches > 0 ? totalRevenue / totalMatches : 0,
      byLevel,
      topProviders,
    };
  }
}

// ============================================
// Export singleton instance
// ============================================

export const priorityMatchFeeService = new PriorityMatchFeeService();
export default priorityMatchFeeService;
