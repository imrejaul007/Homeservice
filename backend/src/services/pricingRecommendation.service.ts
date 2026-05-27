import mongoose, { Types } from 'mongoose';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

// =============================================================================
// NILIN Pricing Recommendation Service
// Dynamic pricing recommendations and market rate analysis
// =============================================================================

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface PriceRecommendation {
  serviceId: Types.ObjectId;
  currentPrice: number;
  recommendedPrice: number;
  priceChange: number;
  changePercent: number;
  confidence: number;
  strategy: 'aggressive' | 'moderate' | 'conservative';
  reasons: string[];
  factors: PriceFactor[];
  validUntil: Date;
  effectiveDate?: Date;
}

export interface PriceFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
  currentValue?: number;
  benchmarkValue?: number;
}

export interface MarketRate {
  category: string;
  subcategory?: string;
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  priceDistribution: {
    budget: number;    // < 25th percentile
    economy: number;   // 25-50th percentile
    standard: number;  // 50-75th percentile
    premium: number;   // > 75th percentile
  };
  marketSize: number;  // Number of services in category
  trend: 'rising' | 'stable' | 'falling';
  trendPercent: number;
  lastUpdated: Date;
}

export interface ProviderPricingAnalysis {
  providerId: Types.ObjectId;
  currentPerformance: {
    avgPrice: number;
    avgRating: number;
    completionRate: number;
    bookingCount: number;
    revenue: number;
  };
  competitivePosition: {
    priceRank: number;
    totalProviders: number;
    percentile: number;
    vsMarketAverage: number;
    vsMarketMedian: number;
  };
  recommendations: ProviderRecommendation[];
  optimalPriceRange: {
    min: number;
    max: number;
    sweetSpot: number;
  };
  potentialRevenueLift: number;
}

export interface ProviderRecommendation {
  type: 'increase' | 'decrease' | 'maintain' | 'bundle';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact: {
    type: 'revenue' | 'bookings' | 'rating';
    changePercent: number;
    confidence: number;
  };
  affectedServices: string[];
}

export interface DemandBasedPricing {
  serviceId: Types.ObjectId;
  timeSlots: TimeSlotPrice[];
  dayPricing: DayPricing[];
  surgeMultiplier: number;
  optimalPrice: number;
  demandLevel: 'low' | 'normal' | 'high' | 'surge';
}

export interface TimeSlotPrice {
  slot: string;  // e.g., "09:00-12:00"
  basePrice: number;
  recommendedPrice: number;
  demandFactor: number;  // Multiplier based on demand
  availabilityPercent: number;
  bookingProbability: number;
}

export interface DayPricing {
  day: string;  // "monday", "tuesday", etc.
  basePrice: number;
  recommendedPrice: number;
  demandFactor: number;
  isWeekend: boolean;
  avgBookings: number;
}

export interface CompetitorPrice {
  providerId: Types.ObjectId;
  providerName: string;
  serviceName: string;
  price: number;
  rating: number;
  distance?: number;
  lastUpdated: Date;
}

export interface PricingExperiment {
  experimentId: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: PricingVariant[];
  status: 'draft' | 'running' | 'completed' | 'paused';
  startDate?: Date;
  endDate?: Date;
  results?: ExperimentResults;
}

export interface PricingVariant {
  variantId: string;
  name: string;
  priceAdjustment: number;  // Percentage change
  description: string;
  trafficAllocation: number;  // 0-100
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  };
}

export interface ExperimentResults {
  controlConversionRate: number;
  treatmentConversionRate: number;
  winner: string | null;
  lift: number;
  confidence: number;
  revenueImpact: number;
  sampleSize: number;
}

// =============================================================================
// Pricing Recommendation Service Class
// =============================================================================

class PricingRecommendationService {
  // Pricing strategy thresholds
  private readonly PRICE_ADJUSTMENT_THRESHOLDS = {
    aggressive: 0.15,  // >15% change
    moderate: 0.10,     // 10-15% change
    conservative: 0.05, // 5-10% change
  };

  // Demand multipliers
  private readonly DEMAND_MULTIPLIERS = {
    surge: 1.3,    // Peak demand
    high: 1.15,    // Above normal
    normal: 1.0,    // Average
    low: 0.85,     // Below normal
  };

  // Time slot demand factors (example for UAE market)
  private readonly TIME_SLOT_FACTORS: Record<string, number> = {
    '06:00-09:00': 0.9,   // Early morning - lower demand
    '09:00-12:00': 1.1,   // Late morning - higher demand
    '12:00-15:00': 1.0,   // Midday - normal
    '15:00-18:00': 1.2,   // Afternoon - higher demand
    '18:00-21:00': 1.3,   // Evening peak - surge
    '21:00-00:00': 1.1,   // Night - moderate
  };

  // Day of week factors
  private readonly DAY_FACTORS: Record<string, { factor: number; isWeekend: boolean }> = {
    monday: { factor: 0.95, isWeekend: false },
    tuesday: { factor: 0.95, isWeekend: false },
    wednesday: { factor: 1.0, isWeekend: false },
    thursday: { factor: 1.05, isWeekend: false },
    friday: { factor: 1.2, isWeekend: true },
    saturday: { factor: 1.25, isWeekend: true },
    sunday: { factor: 1.1, isWeekend: true },
  };

  // Cache for market rates
  private marketRateCache: Map<string, { data: MarketRate; expiry: number }> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  // =============================================================================
  // Core Pricing Methods
  // =============================================================================

  /**
   * Get price recommendation for a service
   */
  async getPriceRecommendation(
    serviceId: string,
    options: {
      targetPriceChange?: number;
      strategy?: 'aggressive' | 'moderate' | 'conservative';
      considerCompetition?: boolean;
    } = {}
  ): Promise<PriceRecommendation> {
    const service = await Service.findById(serviceId).lean();
    if (!service) {
      throw ApiError.notFound('Service not found', ERROR_CODES.NOT_FOUND);
    }

    const currentPrice = service.price.amount;

    // Get market rate for this category
    const marketRate = await this.getMarketRate(service.category, service.subcategory);

    // Calculate price factors
    const factors = await this.calculatePriceFactors(service);

    // Calculate recommended price
    const recommendedPrice = this.calculateOptimalPrice(service, marketRate, factors, options.strategy);
    const priceChange = recommendedPrice - currentPrice;
    const changePercent = (priceChange / currentPrice) * 100;

    // Determine strategy based on change magnitude
    let strategy: 'aggressive' | 'moderate' | 'conservative' = 'conservative';
    if (Math.abs(changePercent) > this.PRICE_ADJUSTMENT_THRESHOLDS.aggressive * 100) {
      strategy = 'aggressive';
    } else if (Math.abs(changePercent) > this.PRICE_ADJUSTMENT_THRESHOLDS.moderate * 100) {
      strategy = 'moderate';
    }

    // Generate reasons
    const reasons = this.generateRecommendationReasons(service, factors, marketRate, currentPrice, recommendedPrice);

    // Calculate confidence
    const confidence = this.calculateConfidence(factors, marketRate);

    return {
      serviceId: service._id,
      currentPrice,
      recommendedPrice: Math.round(recommendedPrice * 100) / 100,
      priceChange: Math.round(priceChange * 100) / 100,
      changePercent: Math.round(changePercent * 10) / 10,
      confidence,
      strategy,
      reasons,
      factors,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 24 hours
    };
  }

  /**
   * Calculate factors that influence pricing
   */
  private async calculatePriceFactors(service: any): Promise<PriceFactor[]> {
    const factors: PriceFactor[] = [];

    // 1. Market position factor
    const marketRate = await this.getMarketRate(service.category, service.subcategory);
    const marketDiff = (service.price.amount - marketRate.averagePrice) / marketRate.averagePrice;

    factors.push({
      name: 'market_position',
      impact: marketDiff > 0.1 ? 'negative' : marketDiff < -0.1 ? 'positive' : 'neutral',
      weight: 25,
      description: marketDiff > 0
        ? 'Price is above market average'
        : marketDiff < 0
        ? 'Price is below market average'
        : 'Price is at market average',
      currentValue: service.price.amount,
      benchmarkValue: marketRate.averagePrice,
    });

    // 2. Rating factor
    const ratingFactor = service.rating?.average || 0;
    const expectedRating = 4.0;
    const ratingDiff = ratingFactor - expectedRating;

    factors.push({
      name: 'rating_quality',
      impact: ratingDiff > 0.5 ? 'positive' : ratingDiff < -0.5 ? 'negative' : 'neutral',
      weight: 20,
      description: ratingDiff > 0
        ? 'Above average rating supports higher pricing'
        : 'Below average rating suggests price reduction',
      currentValue: ratingFactor,
      benchmarkValue: expectedRating,
    });

    // 3. Popularity/booking volume factor
    const bookingCount = service.searchMetadata?.bookingCount || 0;
    const isPopular = bookingCount > 100;

    factors.push({
      name: 'popularity',
      impact: isPopular ? 'positive' : 'neutral',
      weight: 15,
      description: isPopular
        ? 'High demand allows for price increase'
        : 'Building popularity, maintain competitive pricing',
      currentValue: bookingCount,
      benchmarkValue: 100,
    });

    // 4. Competition density factor
    const competitorCount = marketRate.marketSize;
    const highCompetition = competitorCount > 50;

    factors.push({
      name: 'competition',
      impact: highCompetition ? 'negative' : 'neutral',
      weight: 20,
      description: highCompetition
        ? 'High competition suggests lower pricing'
        : 'Limited competition allows premium pricing',
      currentValue: competitorCount,
      benchmarkValue: 50,
    });

    // 5. Seasonality factor
    const month = new Date().getMonth();
    const seasonalFactor = this.getSeasonalPricingFactor(service.category, month);

    factors.push({
      name: 'seasonality',
      impact: seasonalFactor > 1 ? 'positive' : seasonalFactor < 1 ? 'negative' : 'neutral',
      weight: 10,
      description: seasonalFactor > 1
        ? 'Peak season - demand is high'
        : 'Off-season - demand is lower',
      currentValue: seasonalFactor,
    });

    // 6. Price elasticity factor (based on historical data)
    const elasticity = await this.calculatePriceElasticity(service._id);
    const isElastic = elasticity > 0.5;

    factors.push({
      name: 'price_elasticity',
      impact: isElastic ? 'negative' : 'neutral',
      weight: 10,
      description: isElastic
        ? 'Customers are price-sensitive for this service'
        : 'Customers are less price-sensitive',
      currentValue: elasticity,
      benchmarkValue: 0.5,
    });

    return factors;
  }

  /**
   * Calculate optimal price based on all factors
   */
  private calculateOptimalPrice(
    service: any,
    marketRate: MarketRate,
    factors: PriceFactor[],
    strategy?: 'aggressive' | 'moderate' | 'conservative'
  ): number {
    const currentPrice = service.price.amount;

    // Calculate base adjustment from market rate
    const marketAdjustment = (marketRate.averagePrice - currentPrice) * 0.3;

    // Calculate weighted factor adjustments
    let totalAdjustment = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      if (factor.impact === 'positive') {
        totalAdjustment += factor.weight * 0.02; // Positive factors add ~2% per unit weight
        totalWeight += factor.weight;
      } else if (factor.impact === 'negative') {
        totalAdjustment -= factor.weight * 0.02; // Negative factors subtract ~2% per unit weight
        totalWeight += factor.weight;
      }
    }

    // Normalize and apply adjustments
    const normalizedAdjustment = totalAdjustment / Math.max(totalWeight, 1);
    const factorPriceChange = currentPrice * normalizedAdjustment;

    // Combine market and factor adjustments
    let recommendedPrice = currentPrice + (marketAdjustment * 0.7) + (factorPriceChange * 0.3);

    // Apply strategy limits
    if (strategy) {
      const maxChange = this.PRICE_ADJUSTMENT_THRESHOLDS[strategy] * currentPrice;
      const actualChange = recommendedPrice - currentPrice;
      if (Math.abs(actualChange) > maxChange) {
        recommendedPrice = currentPrice + Math.sign(actualChange) * maxChange;
      }
    }

    // Ensure price stays within reasonable bounds (market min to market max * 1.5)
    const minPrice = marketRate.minPrice * 0.9;
    const maxPrice = marketRate.maxPrice * 1.5;
    recommendedPrice = Math.max(minPrice, Math.min(maxPrice, recommendedPrice));

    return recommendedPrice;
  }

  /**
   * Get market rate for a category
   */
  async getMarketRate(category: string, subcategory?: string): Promise<MarketRate> {
    const cacheKey = `${category}:${subcategory || 'all'}`;
    const cached = this.marketRateCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Aggregate pricing data for the category
    const pipeline = [
      {
        $match: {
          category,
          ...(subcategory ? { subcategory } : {}),
          isActive: true,
          status: 'active',
        },
      },
      {
        $group: {
          _id: null,
          avgPrice: { $avg: '$price.amount' },
          prices: { $push: '$price.amount' },
          marketSize: { $sum: 1 },
        },
      },
    ];

    const result = await Service.aggregate(pipeline);

    if (result.length === 0 || result[0].marketSize < 3) {
      // Return default market rate if insufficient data
      const defaultRate: MarketRate = {
        category,
        subcategory,
        averagePrice: 100,
        medianPrice: 100,
        minPrice: 50,
        maxPrice: 200,
        priceDistribution: {
          budget: 75,
          economy: 90,
          standard: 100,
          premium: 125,
        },
        marketSize: 0,
        trend: 'stable',
        trendPercent: 0,
        lastUpdated: new Date(),
      };
      return defaultRate;
    }

    const prices = result[0].prices.sort((a: number, b: number) => a - b);
    const medianIndex = Math.floor(prices.length / 2);
    const medianPrice = prices.length % 2 === 0
      ? (prices[medianIndex - 1] + prices[medianIndex]) / 2
      : prices[medianIndex];

    // Calculate percentiles
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p50 = medianPrice;
    const p75 = prices[Math.floor(prices.length * 0.75)];

    // Calculate trend (comparing recent to older prices)
    const trendPercent = await this.calculateMarketTrend(category, subcategory);

    const marketRate: MarketRate = {
      category,
      subcategory,
      averagePrice: Math.round(result[0].avgPrice * 100) / 100,
      medianPrice: Math.round(medianPrice * 100) / 100,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      priceDistribution: {
        budget: p25,
        economy: medianPrice,
        standard: p75,
        premium: prices[Math.floor(prices.length * 0.9)],
      },
      marketSize: result[0].marketSize,
      trend: trendPercent > 5 ? 'rising' : trendPercent < -5 ? 'falling' : 'stable',
      trendPercent,
      lastUpdated: new Date(),
    };

    this.marketRateCache.set(cacheKey, {
      data: marketRate,
      expiry: Date.now() + this.CACHE_TTL,
    });

    return marketRate;
  }

  /**
   * Calculate market trend over time
   */
  private async calculateMarketTrend(category: string, subcategory?: string): Promise<number> {
    // Compare average price in last 30 days vs previous 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [recent, older] = await Promise.all([
      Service.find({
        category,
        ...(subcategory ? { subcategory } : {}),
        isActive: true,
        createdAt: { $gte: thirtyDaysAgo },
      }).select('price.amount'),

      Service.find({
        category,
        ...(subcategory ? { subcategory } : {}),
        isActive: true,
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }).select('price.amount'),
    ]);

    if (recent.length === 0 || older.length === 0) return 0;

    const avgRecent = recent.reduce((sum, s) => sum + s.price.amount, 0) / recent.length;
    const avgOlder = older.reduce((sum, s) => sum + s.price.amount, 0) / older.length;

    return avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;
  }

  // =============================================================================
  // Provider Pricing Analysis
  // =============================================================================

  /**
   * Get comprehensive pricing analysis for a provider
   */
  async getProviderPricingAnalysis(providerId: string): Promise<ProviderPricingAnalysis> {
    const provider = await User.findById(providerId).lean();
    if (!provider) {
      throw ApiError.notFound('Provider not found', ERROR_CODES.NOT_FOUND);
    }

    // Get all services for this provider
    const services = await Service.find({ providerId, isActive: true }).lean();

    if (services.length === 0) {
      throw ApiError.notFound('No active services found for this provider', ERROR_CODES.NOT_FOUND);
    }

    // Calculate current performance
    const bookings = await Booking.find({
      providerId,
      status: 'completed',
      scheduledDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }).lean();

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
    const avgPrice = services.reduce((sum, s) => sum + s.price.amount, 0) / services.length;
    const avgRating = services.reduce((sum, s) => sum + (s.rating?.average || 0), 0) / services.length;
    const completedBookings = bookings.length;
    const totalBookings = await Booking.countDocuments({ providerId });
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    // Get competitive position
    const competitivePosition = await this.calculateCompetitivePosition(providerId, avgPrice);

    // Generate recommendations
    const recommendations = this.generateProviderRecommendations(
      providerId,
      avgPrice,
      avgRating,
      completionRate,
      services,
      competitivePosition
    );

    // Calculate optimal price range
    const marketRates = await Promise.all(
      services.map(s => this.getMarketRate(s.category, s.subcategory))
    );
    const avgMarketPrice = marketRates.reduce((sum, m) => sum + m.averagePrice, 0) / marketRates.length;
    const optimalMin = avgMarketPrice * 0.85;
    const optimalMax = avgMarketPrice * 1.15;
    const sweetSpot = avgMarketPrice;

    // Calculate potential revenue lift
    const currentRevenue = totalRevenue;
    const optimalRevenue = currentRevenue * (1 + (competitivePosition.percentile - 50) / 100);
    const potentialRevenueLift = optimalRevenue - currentRevenue;

    return {
      providerId: new Types.ObjectId(providerId),
      currentPerformance: {
        avgPrice: Math.round(avgPrice * 100) / 100,
        avgRating: Math.round(avgRating * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        bookingCount: completedBookings,
        revenue: Math.round(totalRevenue * 100) / 100,
      },
      competitivePosition,
      recommendations,
      optimalPriceRange: {
        min: Math.round(optimalMin * 100) / 100,
        max: Math.round(optimalMax * 100) / 100,
        sweetSpot: Math.round(sweetSpot * 100) / 100,
      },
      potentialRevenueLift: Math.round(potentialRevenueLift * 100) / 100,
    };
  }

  /**
   * Calculate competitive position relative to market
   */
  private async calculateCompetitivePosition(
    providerId: string,
    avgPrice: number
  ): Promise<ProviderPricingAnalysis['competitivePosition']> {
    // Get all providers with similar services
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: 'providerId',
          as: 'services',
        },
      },
      {
        $match: {
          role: 'provider',
          'services.0': { $exists: true },
        },
      },
      {
        $addFields: {
          avgPrice: {
            $avg: '$services.price.amount',
          },
        },
      },
      {
        $sort: { avgPrice: 1 as const },
      },
    ];

    const providers = await User.aggregate(pipeline);

    const priceRank = providers.findIndex(
      (p: any) => p._id.toString() === providerId
    ) + 1;

    const avgMarketPrice = providers.reduce((sum: number, p: any) => sum + (p.avgPrice || 0), 0) / providers.length;
    const medianProvider = providers[Math.floor(providers.length / 2)];
    const medianPrice = medianProvider?.avgPrice || avgMarketPrice;

    return {
      priceRank,
      totalProviders: providers.length,
      percentile: Math.round((1 - priceRank / providers.length) * 100),
      vsMarketAverage: Math.round(((avgPrice - avgMarketPrice) / avgMarketPrice) * 100 * 10) / 10,
      vsMarketMedian: Math.round(((avgPrice - medianPrice) / medianPrice) * 100 * 10) / 10,
    };
  }

  /**
   * Generate recommendations for provider
   */
  private generateProviderRecommendations(
    providerId: string,
    avgPrice: number,
    avgRating: number,
    completionRate: number,
    services: any[],
    competitivePosition: ProviderPricingAnalysis['competitivePosition']
  ): ProviderRecommendation[] {
    const recommendations: ProviderRecommendation[] = [];

    // Price positioning recommendations
    if (competitivePosition.percentile > 75) {
      recommendations.push({
        type: 'decrease',
        priority: 'high',
        title: 'Consider Price Reduction',
        description: 'Your prices are in the top 25% of providers. Consider reducing to improve competitiveness.',
        expectedImpact: {
          type: 'bookings',
          changePercent: 15,
          confidence: 0.7,
        },
        affectedServices: services.map(s => s.name),
      });
    } else if (competitivePosition.percentile < 25) {
      recommendations.push({
        type: 'increase',
        priority: 'medium',
        title: 'Room for Price Increase',
        description: 'Your prices are below market. Quality services can command higher prices.',
        expectedImpact: {
          type: 'revenue',
          changePercent: 10,
          confidence: 0.65,
        },
        affectedServices: services.map(s => s.name),
      });
    }

    // Rating-based recommendations
    if (avgRating >= 4.5 && competitivePosition.percentile < 60) {
      recommendations.push({
        type: 'increase',
        priority: 'high',
        title: 'Leverage High Rating',
        description: 'Your excellent rating (4.5+) is underutilized. Raise prices to match your quality.',
        expectedImpact: {
          type: 'revenue',
          changePercent: 8,
          confidence: 0.75,
        },
        affectedServices: services.map(s => s.name),
      });
    }

    // Completion rate recommendations
    if (completionRate < 80) {
      recommendations.push({
        type: 'maintain',
        priority: 'high',
        title: 'Improve Completion Rate',
        description: 'Your completion rate is below target. Focus on reliability before adjusting prices.',
        expectedImpact: {
          type: 'rating',
          changePercent: 5,
          confidence: 0.8,
        },
        affectedServices: services.map(s => s.name),
      });
    }

    // Bundle recommendation
    if (services.length >= 3) {
      recommendations.push({
        type: 'bundle',
        priority: 'low',
        title: 'Create Service Bundles',
        description: 'Offer package deals for multiple services to increase average order value.',
        expectedImpact: {
          type: 'revenue',
          changePercent: 12,
          confidence: 0.6,
        },
        affectedServices: services.slice(0, 3).map(s => s.name),
      });
    }

    return recommendations;
  }

  // =============================================================================
  // Demand-Based Pricing
  // =============================================================================

  /**
   * Get demand-based pricing for a service
   */
  async getDemandBasedPricing(serviceId: string): Promise<DemandBasedPricing> {
    const service = await Service.findById(serviceId).lean();
    if (!service) {
      throw ApiError.notFound('Service not found', ERROR_CODES.NOT_FOUND);
    }

    const basePrice = service.price.amount;

    // Generate time slot pricing
    const timeSlots = this.generateTimeSlotPricing(basePrice, serviceId);

    // Generate day-based pricing
    const dayPricing = this.generateDayPricing(basePrice);

    // Calculate overall demand level
    const avgDemandFactor =
      timeSlots.reduce((sum, t) => sum + t.demandFactor, 0) / timeSlots.length +
      dayPricing.reduce((sum, d) => sum + d.demandFactor, 0) / dayPricing.length;

    let demandLevel: 'low' | 'normal' | 'high' | 'surge' = 'normal';
    if (avgDemandFactor > 1.2) demandLevel = 'surge';
    else if (avgDemandFactor > 1.1) demandLevel = 'high';
    else if (avgDemandFactor < 0.9) demandLevel = 'low';

    const surgeMultiplier = this.DEMAND_MULTIPLIERS[demandLevel];

    return {
      serviceId: service._id,
      timeSlots,
      dayPricing,
      surgeMultiplier,
      optimalPrice: Math.round(basePrice * surgeMultiplier * 100) / 100,
      demandLevel,
    };
  }

  /**
   * Generate pricing for different time slots
   */
  private generateTimeSlotPricing(basePrice: number, serviceId: string): TimeSlotPrice[] {
    const slots = Object.entries(this.TIME_SLOT_FACTORS).map(([slot, factor]) => {
      const recommendedPrice = basePrice * factor;
      const availabilityPercent = Math.max(20, 100 - (factor - 0.9) * 500);
      const bookingProbability = factor > 1.1 ? 0.8 : factor > 1 ? 0.6 : 0.4;

      return {
        slot,
        basePrice,
        recommendedPrice: Math.round(recommendedPrice * 100) / 100,
        demandFactor: factor,
        availabilityPercent: Math.round(availabilityPercent),
        bookingProbability,
      };
    });

    return slots;
  }

  /**
   * Generate pricing for different days
   */
  private generateDayPricing(basePrice: number): DayPricing[] {
    return Object.entries(this.DAY_FACTORS).map(([day, { factor, isWeekend }]) => {
      const recommendedPrice = basePrice * factor;
      const avgBookings = isWeekend ? 15 : 8;

      return {
        day,
        basePrice,
        recommendedPrice: Math.round(recommendedPrice * 100) / 100,
        demandFactor: factor,
        isWeekend,
        avgBookings,
      };
    });
  }

  // =============================================================================
  // Competitor Analysis
  // =============================================================================

  /**
   * Get competitor pricing for similar services
   */
  async getCompetitorPrices(
    serviceId: string,
    options: { limit?: number; radius?: number } = {}
  ): Promise<CompetitorPrice[]> {
    const service = await Service.findById(serviceId).lean();
    if (!service) {
      throw ApiError.notFound('Service not found', ERROR_CODES.NOT_FOUND);
    }

    const competitors = await Service.find({
      _id: { $ne: serviceId },
      category: service.category,
      subcategory: service.subcategory,
      isActive: true,
      status: 'active',
    })
      .populate('providerId', 'firstName lastName')
      .sort({ 'rating.average': -1 })
      .limit(options.limit || 10)
      .lean();

    return competitors.map((competitor: any) => ({
      providerId: competitor.providerId._id,
      providerName: `${competitor.providerId.firstName} ${competitor.providerId.lastName}`,
      serviceName: competitor.name,
      price: competitor.price.amount,
      rating: competitor.rating.average,
      lastUpdated: competitor.updatedAt,
    }));
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Get seasonal pricing factor
   */
  private getSeasonalPricingFactor(category: string, month: number): number {
    // Define seasonal patterns by category
    const seasonalPatterns: Record<string, number[]> = {
      // AC services peak in summer (May-September)
      'air-conditioning': [0.9, 0.9, 1.0, 1.0, 1.2, 1.4, 1.5, 1.5, 1.3, 1.1, 1.0, 0.9],
      // Cleaning services peak at year end
      'cleaning': [1.0, 0.95, 1.0, 1.0, 1.0, 0.95, 0.95, 0.95, 1.0, 1.1, 1.2, 1.3],
      // Beauty services vary by season
      'beauty': [1.1, 1.2, 1.1, 1.0, 0.9, 0.85, 0.85, 0.9, 1.0, 1.1, 1.15, 1.2],
      // Default pattern
      default: [1.0, 1.0, 1.0, 1.0, 1.05, 1.1, 1.1, 1.1, 1.0, 1.0, 1.05, 1.1],
    };

    const pattern = seasonalPatterns[category] || seasonalPatterns.default;
    return pattern[month];
  }

  /**
   * Calculate price elasticity for a service
   */
  private async calculatePriceElasticity(serviceId: string): Promise<number> {
    // Get booking data with price variations
    const bookings = await Booking.find({
      serviceId: new mongoose.Types.ObjectId(serviceId),
      status: { $in: ['completed', 'cancelled'] },
      scheduledDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    })
      .select('pricing.totalAmount scheduledDate status')
      .sort({ scheduledDate: -1 })
      .limit(50)
      .lean();

    if (bookings.length < 10) return 0.5; // Default moderate elasticity

    // Group by price buckets
    const buckets: Record<number, { total: number; completed: number }> = {};
    for (const booking of bookings) {
      const price = Math.round((booking.pricing?.totalAmount || 0) / 20) * 20;
      if (!buckets[price]) {
        buckets[price] = { total: 0, completed: 0 };
      }
      buckets[price].total++;
      if (booking.status === 'completed') {
        buckets[price].completed++;
      }
    }

    // Calculate conversion rate per bucket
    const conversionRates = Object.entries(buckets).map(([price, data]) => ({
      price: parseInt(price),
      rate: data.completed / data.total,
    }));

    // Estimate elasticity (simplified)
    if (conversionRates.length < 2) return 0.5;

    const sorted = conversionRates.sort((a, b) => a.price - b.price);
    const priceRange = sorted[sorted.length - 1].price - sorted[0].price;
    const rateRange = sorted[sorted.length - 1].rate - sorted[0].rate;

    if (priceRange === 0) return 0.5;

    const elasticity = Math.abs(rateRange / (priceRange / sorted[0].price));
    return Math.min(1, elasticity);
  }

  /**
   * Generate recommendation reasons
   */
  private generateRecommendationReasons(
    service: any,
    factors: PriceFactor[],
    marketRate: MarketRate,
    currentPrice: number,
    recommendedPrice: number
  ): string[] {
    const reasons: string[] = [];

    const marketFactor = factors.find(f => f.name === 'market_position');
    if (marketFactor) {
      if (recommendedPrice > currentPrice) {
        reasons.push(`Price is ${Math.abs(marketRate.averagePrice - currentPrice).toFixed(0)} below market average`);
      } else {
        reasons.push(`Price is ${Math.abs(currentPrice - marketRate.averagePrice).toFixed(0)} above market average`);
      }
    }

    const ratingFactor = factors.find(f => f.name === 'rating_quality');
    if (ratingFactor && ratingFactor.impact === 'positive') {
      reasons.push('High rating supports premium pricing');
    }

    const popularityFactor = factors.find(f => f.name === 'popularity');
    if (popularityFactor && popularityFactor.impact === 'positive') {
      reasons.push('High demand justifies price increase');
    }

    const competitionFactor = factors.find(f => f.name === 'competition');
    if (competitionFactor && competitionFactor.impact === 'negative') {
      reasons.push('Competitive market suggests competitive pricing');
    }

    const seasonalityFactor = factors.find(f => f.name === 'seasonality');
    if (seasonalityFactor) {
      if (seasonalityFactor.impact === 'positive') {
        reasons.push('Peak season pricing opportunity');
      } else if (seasonalityFactor.impact === 'negative') {
        reasons.push('Off-season - consider promotional pricing');
      }
    }

    return reasons;
  }

  /**
   * Calculate confidence in recommendation
   */
  private calculateConfidence(factors: PriceFactor[], marketRate: MarketRate): number {
    let confidence = 0.5; // Base confidence

    // More market data = higher confidence
    if (marketRate.marketSize > 50) confidence += 0.15;
    else if (marketRate.marketSize > 20) confidence += 0.1;

    // More factors evaluated = higher confidence
    const evaluatedFactors = factors.filter(f => f.currentValue !== undefined).length;
    confidence += (evaluatedFactors / factors.length) * 0.2;

    // Market trend clarity = higher confidence
    if (Math.abs(marketRate.trendPercent) > 5) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  /**
   * Clear market rate cache
   */
  clearCache(): void {
    this.marketRateCache.clear();
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const pricingRecommendationService = new PricingRecommendationService();

// =============================================================================
// Export Class for Testing
// =============================================================================

export { PricingRecommendationService };
export default pricingRecommendationService;
