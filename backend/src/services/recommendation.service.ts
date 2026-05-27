import mongoose, { Document, Model, Types } from 'mongoose';
import User, { IUser } from '../models/user.model';
import Booking, { IBooking } from '../models/booking.model';
import Service from '../models/service.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

// =============================================================================
// NILIN AI Recommendation Service
// Personalized service and provider recommendations for the marketplace
// =============================================================================

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ServiceRecommendation {
  service: {
    _id: Types.ObjectId;
    name: string;
    category: string;
    subcategory?: string;
    description: string;
    shortDescription?: string;
    price: {
      amount: number;
      currency: string;
      type: 'fixed' | 'hourly' | 'custom';
      discounts?: Array<{
        type: 'bulk' | 'seasonal' | 'loyalty' | 'first_time';
        percentage: number;
        validFrom?: Date;
        validTo?: Date;
      }>;
    };
    duration: number;
    images: string[];
    rating: {
      average: number;
      count: number;
    };
    providerId: Types.ObjectId;
    location: {
      address: {
        city: string;
        state: string;
      };
      coordinates: {
        coordinates: [number, number];
      };
    };
    isFeatured?: boolean;
    isPopular?: boolean;
  };
  score: number;
  reasons: string[];
  personalized: boolean;
  matchFactors: {
    categoryMatch: boolean;
    priceMatch: boolean;
    ratingMatch: boolean;
    locationMatch: boolean;
    historyMatch: boolean;
  };
}

export interface ProviderRecommendation {
  provider: {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    avatar?: string;
    rating: {
      average: number;
      count: number;
    };
    servicesCount: number;
    completedBookings: number;
    responseRate: number;
    yearsExperience?: number;
    specialties?: string[];
    location?: {
      city?: string;
      state?: string;
    };
  };
  score: number;
  reasons: string[];
  commonServices: string[];
}

export interface TrendingService {
  service: {
    _id: Types.ObjectId;
    name: string;
    category: string;
    price: {
      amount: number;
      currency: string;
    };
    image?: string;
    rating: {
      average: number;
      count: number;
    };
    bookingCount: number;
  };
  trendScore: number;
  growthRate: number;
  category: string;
}

export interface DemandPrediction {
  serviceId: Types.ObjectId;
  serviceName: string;
  predictedDemand: 'low' | 'medium' | 'high' | 'surge';
  confidence: number;
  factors: {
    historicalVolume: number;
    seasonalFactor: number;
    dayOfWeek: string;
    timeOfDay: string;
    upcomingEvents: number;
  };
  recommendedActions: string[];
}

export interface OfferTargeting {
  offerId: Types.ObjectId;
  targetUserIds: Types.ObjectId[];
  targetCriteria: {
    minBookings?: number;
    maxBookings?: number;
    preferredCategories?: string[];
    priceRangeMin?: number;
    priceRangeMax?: number;
    loyaltyTier?: ('bronze' | 'silver' | 'gold' | 'platinum')[];
    inactiveDaysMin?: number;
    inactiveDaysMax?: number;
  };
  expectedConversionRate: number;
  estimatedReach: number;
}

interface UserPreferences {
  preferredServiceTypes: string[];
  preferredProviders: Types.ObjectId[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  preferredTimeSlots: string[];
  preferredDays: string[];
  locationPreference: 'home' | 'provider_location' | 'both';
}

interface BehaviorData {
  searchHistory: Array<{
    query: string;
    category?: string;
    location?: string;
    timestamp: Date;
  }>;
  bookingPatterns: {
    averageSpend: number;
    bookingFrequency: number;
    seasonalPreferences: string[];
    timePreferences: string[];
  };
}

interface BookingWithService extends Document {
  serviceId: Types.ObjectId;
  category?: string;
  pricing: {
    totalAmount: number;
  };
  status: string;
  scheduledDate: Date;
}

interface ServiceDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
    discounts?: Array<{
      type: 'bulk' | 'seasonal' | 'loyalty' | 'first_time';
      percentage: number;
      validFrom?: Date;
      validTo?: Date;
    }>;
  };
  duration: number;
  images: string[];
  rating: {
    average: number;
    count: number;
  };
  providerId: Types.ObjectId;
  location: {
    address: {
      city: string;
      state: string;
    };
    coordinates: {
      coordinates: [number, number];
    };
  };
  searchMetadata: {
    popularityScore: number;
    bookingCount: number;
  };
  isFeatured: boolean;
  isPopular: boolean;
}

// =============================================================================
// Recommendation Service Class
// =============================================================================

class RecommendationService {
  // Scoring weights
  private readonly WEIGHTS = {
    popularity: 0.2,
    categoryMatch: 0.25,
    historyMatch: 0.15,
    ratingMatch: 0.15,
    priceMatch: 0.1,
    locationMatch: 0.1,
    recency: 0.05,
  };

  // Cache TTL in milliseconds (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private cache: Map<string, { data: any; expiry: number }> = new Map();

  // =============================================================================
  // Core Recommendation Methods
  // =============================================================================

  /**
   * Get personalized service recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 10,
    options: { category?: string; excludeServiceIds?: string[] } = {}
  ): Promise<ServiceRecommendation[]> {
    const cacheKey = `personalized:${userId}:${limit}:${options.category || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // 1. Get user preferences and behavior data
    const user = await User.findById(userId).select('aiPersonalization').lean();
    if (!user) {
      return this.getTrendingRecommendations(limit, options);
    }

    const userPrefs: UserPreferences = user.aiPersonalization.preferences;
    const behaviorData: BehaviorData = user.aiPersonalization.behaviorData;

    // 2. Get user's booking history
    const bookingHistory = await Booking.find({
      customerId: userId,
      status: { $in: ['completed', 'confirmed'] }
    }).populate<BookingWithService>('serviceId', 'category').lean() as unknown as (BookingWithService & { serviceId: { category?: string } })[];

    // 3. Get candidate services (trending + category match)
    const candidateServices = await this.getCandidateServices(userPrefs, options, limit * 3);

    // 4. Score each service
    const scoredServices = candidateServices.map((service) => {
      const { score, reasons, matchFactors } = this.calculateServiceScore(
        service,
        userPrefs,
        behaviorData,
        bookingHistory
      );
      return { service, score, reasons, personalized: true, matchFactors };
    });

    // 5. Sort and return top results
    const recommendations = scoredServices
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    this.setCache(cacheKey, recommendations);
    return recommendations;
  }

  /**
   * Calculate recommendation score for a service
   */
  private calculateServiceScore(
    service: ServiceDocument,
    userPrefs: UserPreferences,
    behaviorData: BehaviorData,
    bookingHistory: (BookingWithService & { serviceId: { category?: string } })[]
  ): { score: number; reasons: string[]; matchFactors: ServiceRecommendation['matchFactors'] } {
    let score = 0;
    const reasons: string[] = [];
    const matchFactors = {
      categoryMatch: false,
      priceMatch: false,
      ratingMatch: false,
      locationMatch: false,
      historyMatch: false,
    };

    // Popularity score contribution
    const normalizedPopularity = Math.min(service.searchMetadata.popularityScore / 1000, 1);
    score += normalizedPopularity * this.WEIGHTS.popularity * 100;

    // Category match
    const userCategories = new Set(userPrefs.preferredServiceTypes);
    if (userCategories.has(service.category) || (service.subcategory && userCategories.has(service.subcategory))) {
      matchFactors.categoryMatch = true;
      score += 30 * this.WEIGHTS.categoryMatch;
      reasons.push(`Matches your favorite category: ${service.category}`);
    }

    // Price range match
    if (userPrefs.priceRangeMin !== undefined && userPrefs.priceRangeMax !== undefined) {
      if (service.price.amount >= userPrefs.priceRangeMin && service.price.amount <= userPrefs.priceRangeMax) {
        matchFactors.priceMatch = true;
        score += 15 * this.WEIGHTS.priceMatch;
        reasons.push('Within your preferred price range');
      }
    } else if (behaviorData.bookingPatterns.averageSpend > 0) {
      const avgSpend = behaviorData.bookingPatterns.averageSpend;
      const priceDiff = Math.abs(service.price.amount - avgSpend) / avgSpend;
      if (priceDiff < 0.3) {
        matchFactors.priceMatch = true;
        score += 10 * this.WEIGHTS.priceMatch;
      }
    }

    // Rating match
    if (userPrefs.preferredServiceTypes.length > 0) {
      // Users who book frequently prefer high-rated services
      if (service.rating.average >= 4.5) {
        matchFactors.ratingMatch = true;
        score += 15 * this.WEIGHTS.ratingMatch;
        reasons.push('Highly rated service (4.5+ stars)');
      } else if (service.rating.average >= 4.0) {
        score += 8 * this.WEIGHTS.ratingMatch;
      }
    }

    // History match - services similar to past bookings
    const pastCategories = new Set(
      bookingHistory
        .filter((b) => b.serviceId?.category)
        .map((b) => b.serviceId.category)
    );

    if (pastCategories.has(service.category)) {
      matchFactors.historyMatch = true;
      score += 20 * this.WEIGHTS.historyMatch;
      reasons.push('Based on your past bookings');
    }

    // Recency bonus for newer popular services
    const daysSinceCreation = Math.floor(
      (Date.now() - (service.get('createdAt') as Date)?.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreation < 30 && service.isFeatured) {
      score += 10 * this.WEIGHTS.recency;
      reasons.push('New featured service');
    }

    return { score, reasons, matchFactors };
  }

  /**
   * Get trending service recommendations (non-personalized fallback)
   */
  async getTrendingRecommendations(
    limit: number = 10,
    options: { category?: string } = {}
  ): Promise<ServiceRecommendation[]> {
    const cacheKey = `trending:${limit}:${options.category || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const query: any = { isActive: true, status: 'active' };
    if (options.category) {
      query.category = options.category;
    }

    const services = await Service.find(query)
      .sort({ 'searchMetadata.popularityScore': -1, 'rating.average': -1 })
      .limit(limit)
      .lean();

    const recommendations: ServiceRecommendation[] = services.map((service) => ({
      service: this.formatServiceForRecommendation(service),
      score: service.searchMetadata.popularityScore,
      reasons: this.generateTrendingReasons(service),
      personalized: false,
      matchFactors: {
        categoryMatch: false,
        priceMatch: false,
        ratingMatch: service.rating.average >= 4.0,
        locationMatch: false,
        historyMatch: false,
      },
    }));

    this.setCache(cacheKey, recommendations);
    return recommendations;
  }

  /**
   * Get provider recommendations for a user
   */
  async getProviderRecommendations(
    userId: string,
    limit: number = 5,
    options: { category?: string; location?: { lat: number; lng: number; radius?: number } } = {}
  ): Promise<ProviderRecommendation[]> {
    const cacheKey = `providers:${userId}:${limit}:${options.category || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Get user preferences
    const user = await User.findById(userId)
      .select('aiPersonalization.preferences.favoriteProviders aiPersonalization.preferences.preferredServiceTypes')
      .lean();

    // Get user's past providers
    const pastBookings = await Booking.aggregate([
      { $match: { customerId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
      { $group: { _id: '$providerId', bookingCount: { $sum: 1 } } },
      { $sort: { bookingCount: -1 } },
      { $limit: 20 },
    ]);

    const pastProviderIds = pastBookings.map((b) => b._id);

    // Build query for providers
    const matchStage: any = {
      'accountStatus': 'active',
      'isActive': true,
    };

    if (options.category) {
      matchStage['services.category'] = options.category;
    }

    // Provider scoring pipeline
    const providerScores = await User.aggregate([
      { $match: { _id: { $in: pastProviderIds }, role: 'provider' } },
      {
        $lookup: {
          from: 'bookings',
          let: { providerId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$providerId', '$$providerId'] },
                status: 'completed',
              },
            },
            { $count: 'completedCount' },
          ],
          as: 'completedBookings',
        },
      },
      {
        $lookup: {
          from: 'services',
          let: { providerId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$providerId', '$$providerId'] }, isActive: true } },
            { $count: 'servicesCount' },
          ],
          as: 'services',
        },
      },
      {
        $addFields: {
          completedBookings: { $ifNull: [{ $arrayElemAt: ['$completedBookings.completedCount', 0] }, 0] },
          servicesCount: { $ifNull: [{ $arrayElemAt: ['$services.servicesCount', 0] }, 0] },
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          avatar: 1,
          rating: 1,
          completedBookings: 1,
          servicesCount: 1,
          address: 1,
          providerProfile: 1,
          score: {
            $add: [
              { $multiply: [{ $ifNull: ['$rating.average', 0] }, 10] },
              { $multiply: [{ $ifNull: ['$completedBookings', 0] }, 0.5] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
    ]);

    const recommendations: ProviderRecommendation[] = providerScores.map((provider) => ({
      provider: {
        _id: provider._id,
        firstName: provider.firstName,
        lastName: provider.lastName,
        avatar: provider.avatar,
        rating: provider.rating,
        servicesCount: provider.servicesCount,
        completedBookings: provider.completedBookings,
        responseRate: provider.providerProfile?.responseRate || 0,
        yearsExperience: provider.providerProfile?.yearsExperience,
        specialties: provider.providerProfile?.specialties,
        location: provider.address,
      },
      score: provider.score,
      reasons: this.generateProviderReasons(provider, pastProviderIds),
      commonServices: [],
    }));

    this.setCache(cacheKey, recommendations);
    return recommendations;
  }

  // =============================================================================
  // Smart Offer Targeting
  // =============================================================================

  /**
   * Find users who should receive a specific offer
   */
  async getOfferTargets(offer: {
    _id: Types.ObjectId;
    minBookings?: number;
    maxBookings?: number;
    preferredCategories?: string[];
    priceRangeMin?: number;
    priceRangeMax?: number;
    loyaltyTier?: string[];
    inactiveDaysMin?: number;
    inactiveDaysMax?: number;
  }): Promise<OfferTargeting> {
    const matchConditions: any = {
      role: 'customer',
      accountStatus: 'active',
      isActive: true,
      isDeleted: false,
    };

    // Booking count filters
    if (offer.minBookings !== undefined || offer.maxBookings !== undefined) {
      matchConditions.totalBookings = {};
      if (offer.minBookings !== undefined) {
        matchConditions.totalBookings.$gte = offer.minBookings;
      }
      if (offer.maxBookings !== undefined) {
        matchConditions.totalBookings.$lte = offer.maxBookings;
      }
    }

    // Loyalty tier filter
    if (offer.loyaltyTier && offer.loyaltyTier.length > 0) {
      matchConditions['loyaltySystem.tier'] = { $in: offer.loyaltyTier };
    }

    // Get matching users
    const users = await User.find(matchConditions)
      .select('_id aiPersonalization loyaltySystem')
      .lean();

    // Filter by activity
    const now = new Date();
    const targetUserIds = users
      .filter((user) => {
        const lastActive = user.aiPersonalization?.recommendations?.lastUpdated;
        if (!lastActive) return true; // New users

        const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

        if (offer.inactiveDaysMin !== undefined && daysSinceActive < offer.inactiveDaysMin) {
          return false;
        }
        if (offer.inactiveDaysMax !== undefined && daysSinceActive > offer.inactiveDaysMax) {
          return false;
        }
        return true;
      })
      .map((u) => u._id);

    // Estimate conversion rate based on targeting precision
    let expectedConversionRate = 0.1; // Base 10%
    if (offer.loyaltyTier && offer.loyaltyTier.length > 0) {
      expectedConversionRate += 0.05; // Loyalty tier targeting improves conversion
    }
    if (offer.inactiveDaysMin !== undefined) {
      expectedConversionRate += 0.08; // Inactive user targeting improves conversion
    }
    if (offer.preferredCategories && offer.preferredCategories.length > 0) {
      expectedConversionRate += 0.05; // Category preference improves conversion
    }

    return {
      offerId: offer._id,
      targetUserIds,
      targetCriteria: {
        minBookings: offer.minBookings,
        maxBookings: offer.maxBookings,
        preferredCategories: offer.preferredCategories,
        priceRangeMin: offer.priceRangeMin,
        priceRangeMax: offer.priceRangeMax,
        loyaltyTier: offer.loyaltyTier as any,
        inactiveDaysMin: offer.inactiveDaysMin,
        inactiveDaysMax: offer.inactiveDaysMax,
      },
      expectedConversionRate: Math.min(expectedConversionRate, 0.5),
      estimatedReach: targetUserIds.length,
    };
  }

  // =============================================================================
  // Demand Prediction
  // =============================================================================

  /**
   * Predict demand for services in the coming days
   */
  async predictDemand(
    serviceId: string,
    daysAhead: number = 7
  ): Promise<DemandPrediction> {
    const service = await Service.findById(serviceId).lean();
    if (!service) {
      throw ApiError.notFound('Service not found', ERROR_CODES.NOT_FOUND);
    }

    // Get historical booking data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalBookings = await Booking.countDocuments({
      serviceId: new mongoose.Types.ObjectId(serviceId),
      status: 'completed',
      scheduledDate: { $gte: thirtyDaysAgo },
    });

    // Calculate average daily bookings
    const avgDailyBookings = historicalBookings / 30;

    // Day of week analysis
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

    // Seasonal factor (simplified - could be enhanced with event data)
    const month = new Date().getMonth();
    const seasonalFactor = this.getSeasonalFactor(month);

    // Calculate trend
    const recentBookings = await Booking.countDocuments({
      serviceId: new mongoose.Types.ObjectId(serviceId),
      status: 'completed',
      scheduledDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    const growthRate = avgDailyBookings > 0 ? (recentBookings / 7 - avgDailyBookings) / avgDailyBookings : 0;

    // Predict demand level
    const predictedVolume = avgDailyBookings * seasonalFactor * (1 + growthRate * 0.5);
    let predictedDemand: 'low' | 'medium' | 'high' | 'surge';
    let confidence = 0.7;

    if (predictedVolume < avgDailyBookings * 0.5) {
      predictedDemand = 'low';
      confidence = 0.8;
    } else if (predictedVolume < avgDailyBookings) {
      predictedDemand = 'medium';
      confidence = 0.75;
    } else if (predictedVolume < avgDailyBookings * 1.5) {
      predictedDemand = 'high';
      confidence = 0.7;
    } else {
      predictedDemand = 'surge';
      confidence = 0.65;
    }

    // Generate recommendations
    const recommendedActions = this.generateDemandRecommendations(predictedDemand, service);

    return {
      serviceId: service._id,
      serviceName: service.name,
      predictedDemand,
      confidence,
      factors: {
        historicalVolume: historicalBookings,
        seasonalFactor,
        dayOfWeek,
        timeOfDay,
        upcomingEvents: 0,
      },
      recommendedActions,
    };
  }

  /**
   * Get seasonal factor based on month
   */
  private getSeasonalFactor(month: number): number {
    // Peak seasons (summer for AC services, holidays for gift services, etc.)
    const seasonalFactors: Record<number, number> = {
      0: 0.9,   // January
      1: 0.85,  // February
      2: 1.0,   // March
      3: 1.1,   // April
      4: 1.2,   // May
      5: 1.4,   // June - Summer begins
      6: 1.5,   // July - Peak summer
      7: 1.4,   // August
      8: 1.1,   // September
      9: 1.0,   // October
      10: 1.2,  // November - Pre-holiday
      11: 1.3,  // December - Holiday season
    };
    return seasonalFactors[month] || 1.0;
  }

  /**
   * Generate recommendations based on demand prediction
   */
  private generateDemandRecommendations(
    predictedDemand: string,
    service: any
  ): string[] {
    const recommendations: string[] = [];

    switch (predictedDemand) {
      case 'low':
        recommendations.push('Consider running a promotional campaign');
        recommendations.push('Lower prices to attract more bookings');
        recommendations.push('Highlight service benefits in marketing');
        break;
      case 'high':
        recommendations.push('Ensure provider availability is maximized');
        recommendations.push('Consider adding more providers to this service');
        recommendations.push('Prepare for surge pricing opportunity');
        break;
      case 'surge':
        recommendations.push('Activate surge pricing');
        recommendations.push('Notify customers of high demand');
        recommendations.push('Ensure quality control during peak');
        recommendations.push('Consider premium service tier for early bookings');
        break;
    }

    return recommendations;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Get candidate services for recommendation
   */
  private async getCandidateServices(
    userPrefs: UserPreferences,
    options: { category?: string; excludeServiceIds?: string[] },
    limit: number
  ): Promise<ServiceDocument[]> {
    const query: any = {
      isActive: true,
      status: 'active',
    };

    if (options.category) {
      query.category = options.category;
    } else if (userPrefs.preferredServiceTypes.length > 0) {
      // Include user's preferred categories
      query.$or = [
        { category: { $in: userPrefs.preferredServiceTypes } },
        { subcategory: { $in: userPrefs.preferredServiceTypes } },
      ];
    }

    if (options.excludeServiceIds && options.excludeServiceIds.length > 0) {
      query._id = { $nin: options.excludeServiceIds };
    }

    return Service.find(query)
      .sort({ 'searchMetadata.popularityScore': -1, 'rating.average': -1 })
      .limit(limit)
      .lean() as unknown as ServiceDocument[];
  }

  /**
   * Format service for recommendation response
   */
  private formatServiceForRecommendation(service: any): ServiceRecommendation['service'] {
    return {
      _id: service._id,
      name: service.name,
      category: service.category,
      subcategory: service.subcategory,
      description: service.description,
      shortDescription: service.shortDescription,
      price: service.price,
      duration: service.duration,
      images: service.images,
      rating: service.rating,
      providerId: service.providerId,
      location: service.location,
      isFeatured: service.isFeatured,
      isPopular: service.isPopular,
    };
  }

  /**
   * Generate reasons for trending service
   */
  private generateTrendingReasons(service: any): string[] {
    const reasons: string[] = [];

    if (service.rating.average >= 4.5) {
      reasons.push('Top rated service');
    }
    if (service.isPopular) {
      reasons.push('Popular in your area');
    }
    if (service.isFeatured) {
      reasons.push('Featured service');
    }
    if (service.searchMetadata.bookingCount > 100) {
      reasons.push(`Booked ${service.searchMetadata.bookingCount} times`);
    }

    return reasons.length > 0 ? reasons : ['Trending now'];
  }

  /**
   * Generate reasons for provider recommendation
   */
  private generateProviderReasons(provider: any, pastProviderIds: Types.ObjectId[]): string[] {
    const reasons: string[] = [];
    const isPastProvider = pastProviderIds.some(
      (id) => id.toString() === provider._id.toString()
    );

    if (isPastProvider) {
      reasons.push('You\'ve booked this provider before');
    }
    if (provider.completedBookings > 50) {
      reasons.push('Highly experienced');
    }
    if (provider.rating.average >= 4.5) {
      reasons.push('Excellent rating (4.5+ stars)');
    }
    if (provider.servicesCount > 5) {
      reasons.push('Wide range of services');
    }

    return reasons.length > 0 ? reasons : ['Recommended for you'];
  }

  // =============================================================================
  // Cache Methods
  // =============================================================================

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttl || this.CACHE_TTL),
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  // =============================================================================
  // Analytics Methods
  // =============================================================================

  /**
   * Record recommendation feedback (click, conversion)
   */
  async recordRecommendationFeedback(
    userId: string,
    serviceId: string,
    action: 'view' | 'click' | 'booking' | 'dismiss'
  ): Promise<void> {
    const service = await Service.findById(serviceId);
    if (!service) return;

    switch (action) {
      case 'view':
        // Increment view count for recommendation analytics
        break;
      case 'click':
        service.searchMetadata.clickCount += 1;
        break;
      case 'booking':
        service.searchMetadata.bookingCount += 1;
        break;
      case 'dismiss':
        // Track dismissed recommendations for better future suggestions
        break;
    }

    await service.save();

    // Update user's recommendation data
    await User.findByIdAndUpdate(userId, {
      $set: { 'aiPersonalization.recommendations.lastUpdated': new Date() },
    });
  }

  /**
   * Get recommendation analytics
   */
  async getRecommendationAnalytics(timeRange: { start: Date; end: Date }) {
    const bookings = await Booking.aggregate([
      {
        $match: {
          metadata: { bookingSource: 'recommendation' },
          createdAt: { $gte: timeRange.start, $lte: timeRange.end },
        },
      },
      {
        $group: {
          _id: null,
          totalRecommendationsBooked: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalAmount' },
          avgBookingValue: { $avg: '$pricing.totalAmount' },
        },
      },
    ]);

    return {
      recommendationsServed: 0, // Would need to track this separately
      recommendationsBooked: bookings[0]?.totalRecommendationsBooked || 0,
      conversionRate: 0, // Would need recommendations served count
      revenueFromRecommendations: bookings[0]?.totalRevenue || 0,
      avgBookingValue: bookings[0]?.avgBookingValue || 0,
    };
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const recommendationService = new RecommendationService();

// =============================================================================
// Export Class for Testing
// =============================================================================

export { RecommendationService };
export default recommendationService;
