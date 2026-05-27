// AI Smart Pricing Service - Demand-Based Dynamic Pricing
import { Types } from 'mongoose';
import Booking from '../../models/booking.model';
import Service from '../../models/service.model';
import ProviderProfile from '../../models/providerProfile.model';
import { ApiError, ERROR_CODES } from '../../utils/ApiError';
import logger from '../../utils/logger';
import { circuitBreaker, CIRCUIT_NAMES } from '../../services/circuitBreaker.service';
import { withRetry } from '../../utils/retry.util';
import { demandForecastService } from './demandForecast.service';

// Types
export interface SmartPricing {
  serviceId: string;
  basePrice: number;
  suggestedPrice: number;
  priceRange: {
    min: number;
    max: number;
    optimal: number;
  };
  factors: PricingFactor[];
  demandMultiplier: number;
  competitionMultiplier: number;
  seasonMultiplier: number;
  urgencyMultiplier: number;
  finalPrice: number;
  confidence: number;
  validUntil: Date;
  metadata: PricingMetadata;
}

export interface PricingFactor {
  type: 'demand' | 'competition' | 'seasonal' | 'urgency' | 'location' | 'quality';
  name: string;
  multiplier: number;
  impact: 'increase' | 'decrease' | 'neutral';
  description: string;
}

export interface PricingMetadata {
  modelVersion: string;
  calculatedAt: Date;
  dataPointsUsed: number;
  algorithm: string;
}

export interface PricingRecommendation {
  serviceId: string;
  currentPrice: number;
  suggestedPrice: number;
  expectedRevenueImpact: number;
  confidence: number;
  reason: string;
  expiresAt: Date;
}

export interface CompetitiveAnalysis {
  serviceId: string;
  marketAverage: number;
  yourPrice: number;
  pricePosition: 'undercut' | 'competitive' | 'premium' | 'luxury';
  competitors: CompetitorPrice[];
  recommendations: string[];
}

export interface CompetitorPrice {
  providerId: string;
  providerName: string;
  price: number;
  rating: number;
  distance: number;
}

// Pricing Constants
const PRICING_WEIGHTS = {
  demand: 0.35,
  competition: 0.30,
  seasonal: 0.15,
  urgency: 0.10,
  quality: 0.10,
};

const PRICE_ADJUSTMENT_LIMITS = {
  minDiscount: 0.70, // Never go below 70% of base
  maxUplift: 1.50, // Never go above 150% of base
};

// Factor Calculations
async function calculateDemandFactor(
  serviceId: string,
  date: Date
): Promise<{ multiplier: number; description: string; confidence: number }> {
  try {
    const forecasts = await demandForecastService.forecastServiceDemand(serviceId, 1);
    const forecast = forecasts[0];
    const hour = date.getHours();

    const peakHour = forecast?.peakHours?.find(h => h.hour === hour);

    if (!peakHour) {
      return { multiplier: 1.0, description: 'Standard demand', confidence: 0.5 };
    }

    // Map demand level to multiplier
    const demandMultipliers: Record<string, number> = {
      peak: 1.30,
      high: 1.15,
      medium: 1.0,
      low: 0.85,
    };

    const multiplier = peakHour ? 1.2 : 1.0;
    const confidence = peakHour?.confidence || 0.5;

    return {
      multiplier,
      description: peakHour ? `Peak hours detected (confidence: ${confidence.toFixed(2)})` : 'Standard demand',
      confidence: confidence,
    };
  } catch (error) {
    return { multiplier: 1.0, description: 'Unable to calculate demand factor', confidence: 0.3 };
  }
}

async function calculateCompetitionFactor(
  serviceId: string,
  location?: { lat: number; lng: number }
): Promise<{ multiplier: number; description: string; competitors: CompetitorPrice[] }> {
  try {
    // Get similar services in the area
    const services = await Service.find({
      _id: { $ne: new Types.ObjectId(serviceId) },
      status: 'active',
    })
      .populate('providerId', 'businessInfo ratings location')
      .limit(10)
      .lean();

    const targetService = await Service.findById(serviceId).lean();
    if (!targetService) {
      return { multiplier: 1.0, description: 'No competition data', competitors: [] };
    }

    const targetPrice = (targetService.price as any)?.amount || 0;
    const competitorPrices = services
      .filter(s => (s.price as any)?.amount)
      .map(s => ({
        providerId: (s.providerId as any)?._id?.toString() || '',
        providerName: (s.providerId as any)?.businessInfo?.businessName || 'Unknown',
        price: (s.price as any)?.amount || 0,
        rating: (s.providerId as any)?.reviewsData?.averageRating || 4,
        distance: location && (s.providerId as any)?.locationInfo?.primaryAddress?.coordinates
          ? calculateDistance(
              location.lat,
              location.lng,
              (s.providerId as any).locationInfo.primaryAddress.coordinates[1],
              (s.providerId as any).locationInfo.primaryAddress.coordinates[0]
            )
          : 5,
      }))
      .filter(c => c.price > 0)
      .sort((a, b) => a.price - b.price);

    if (competitorPrices.length === 0) {
      return { multiplier: 1.0, description: 'No competitors found', competitors: [] };
    }

    const marketAverage = competitorPrices.reduce((sum, c) => sum + c.price, 0) / competitorPrices.length;
    const priceRatio = targetPrice / marketAverage;

    let multiplier = 1.0;
    let description = '';

    if (priceRatio < 0.85) {
      // Underpriced - can increase
      multiplier = 1.0 + (0.85 - priceRatio) * 0.5;
      description = `Below market average (${Math.round(priceRatio * 100)}% of avg)`;
    } else if (priceRatio > 1.15) {
      // Overpriced - should decrease
      multiplier = 1.0 - (priceRatio - 1.15) * 0.3;
      description = `Above market average (${Math.round(priceRatio * 100)}% of avg)`;
    } else {
      description = 'Competitive pricing';
    }

    return {
      multiplier: Math.max(0.9, Math.min(1.1, multiplier)),
      description,
      competitors: competitorPrices.slice(0, 5),
    };
  } catch (error) {
    return { multiplier: 1.0, description: 'Unable to analyze competition', competitors: [] };
  }
}

function calculateSeasonalFactor(date: Date): { multiplier: number; description: string } {
  const month = date.getMonth();
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Seasonal factors
  const seasonalMultipliers: Record<number, number> = {
    0: 0.90,  // January
    1: 0.90,  // February
    2: 1.00,  // March
    3: 1.05,  // April - spring
    4: 1.15,  // May
    5: 1.20,  // June - summer starts
    6: 1.25,  // July - peak summer
    7: 1.25,  // August - peak summer
    8: 1.15,  // September
    9: 1.05,  // October
    10: 1.00, // November
    11: 1.10, // December
  };

  let multiplier = seasonalMultipliers[month] || 1.0;

  // Weekend adjustment for home services
  if (isWeekend) {
    multiplier *= 1.10;
  }

  // Pre-holiday boost
  if (month === 11 && date.getDate() >= 15) {
    multiplier *= 1.15;
  }

  return {
    multiplier: Math.max(0.8, Math.min(1.3, multiplier)),
    description: `Seasonal factor for ${getMonthName(month)}${isWeekend ? ' (weekend)' : ''}`,
  };
}

function calculateUrgencyFactor(
  bookingDate: Date,
  currentDate: Date = new Date()
): { multiplier: number; description: string } {
  const hoursUntilBooking =
    (bookingDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);

  let multiplier = 1.0;
  let description = '';

  if (hoursUntilBooking < 0) {
    multiplier = 0.95;
    description = 'Past booking time';
  } else if (hoursUntilBooking < 24) {
    // Very short notice - premium pricing
    multiplier = 1.25;
    description = 'Same-day booking premium';
  } else if (hoursUntilBooking < 48) {
    multiplier = 1.15;
    description = 'Short notice booking';
  } else if (hoursUntilBooking < 72) {
    multiplier = 1.05;
    description = 'Near-term booking';
  } else if (hoursUntilBooking > 168) {
    // More than a week out - slight discount
    multiplier = 0.95;
    description = 'Advance booking discount';
  } else {
    description = 'Standard advance booking';
  }

  return { multiplier, description };
}

function calculateQualityFactor(provider: any): { multiplier: number; description: string } {
  const rating = provider.ratings?.average || 4.0;
  const completionRate = provider.analytics?.completionRate || 0.95;

  let multiplier = 1.0;
  let description = '';

  if (rating >= 4.9 && completionRate >= 0.98) {
    multiplier = 1.15;
    description = 'Premium provider (4.9+ stars, 98%+ completion)';
  } else if (rating >= 4.7 && completionRate >= 0.95) {
    multiplier = 1.08;
    description = 'High-rated provider';
  } else if (rating < 4.0 || completionRate < 0.90) {
    multiplier = 0.92;
    description = 'Below-average metrics - competitive pricing';
  } else {
    description = 'Average quality provider';
  }

  return { multiplier, description };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month] || 'Unknown';
}

// Main Smart Pricing Service
export class SmartPricingService {
  private modelVersion = 'v1.0.0';

  async calculateOptimalPrice(
    serviceId: string,
    bookingDate: Date,
    location?: { lat: number; lng: number }
  ): Promise<SmartPricing> {
    return circuitBreaker.execute(
      CIRCUIT_NAMES.AI_SMART_PRICING,
      async () => {
        return withRetry(
          async () => {
            // Get service details
            const service = await Service.findById(serviceId).lean();
            if (!service) {
              throw ApiError.notFound('Service not found', ERROR_CODES.NOT_FOUND);
            }

            const basePrice = (service.price as any)?.amount || 100;

            // Get provider details
            const provider = await ProviderProfile.findOne({
              userId: service.providerId
            }).lean();

            // Calculate all factors in parallel
            const [
              demandFactor,
              competitionFactor,
              seasonalFactor,
              urgencyFactor,
              qualityFactor,
            ] = await Promise.all([
              calculateDemandFactor(serviceId, bookingDate),
              calculateCompetitionFactor(serviceId, location),
              Promise.resolve(calculateSeasonalFactor(bookingDate)),
              Promise.resolve(calculateUrgencyFactor(bookingDate)),
              provider ? Promise.resolve(calculateQualityFactor(provider)) : Promise.resolve({ multiplier: 1.0, description: 'No provider data' }),
            ]);

            // Build pricing factors array
            const factors: PricingFactor[] = [
              {
                type: 'demand',
                name: 'Demand',
                multiplier: demandFactor.multiplier,
                impact: demandFactor.multiplier > 1 ? 'increase' : demandFactor.multiplier < 1 ? 'decrease' : 'neutral',
                description: demandFactor.description,
              },
              {
                type: 'competition',
                name: 'Competition',
                multiplier: competitionFactor.multiplier,
                impact: competitionFactor.multiplier > 1 ? 'increase' : competitionFactor.multiplier < 1 ? 'decrease' : 'neutral',
                description: competitionFactor.description,
              },
              {
                type: 'seasonal',
                name: 'Seasonal',
                multiplier: seasonalFactor.multiplier,
                impact: seasonalFactor.multiplier > 1 ? 'increase' : seasonalFactor.multiplier < 1 ? 'decrease' : 'neutral',
                description: seasonalFactor.description,
              },
              {
                type: 'urgency',
                name: 'Urgency',
                multiplier: urgencyFactor.multiplier,
                impact: urgencyFactor.multiplier > 1 ? 'increase' : urgencyFactor.multiplier < 1 ? 'decrease' : 'neutral',
                description: urgencyFactor.description,
              },
              {
                type: 'quality',
                name: 'Quality',
                multiplier: qualityFactor.multiplier,
                impact: qualityFactor.multiplier > 1 ? 'increase' : qualityFactor.multiplier < 1 ? 'decrease' : 'neutral',
                description: qualityFactor.description,
              },
            ];

            // Calculate final multiplier using weighted average
            const totalWeight = Object.values(PRICING_WEIGHTS).reduce((a, b) => a + b, 0);
            const finalMultiplier =
              factors.reduce((sum, f) => sum + f.multiplier * PRICING_WEIGHTS[f.type as keyof typeof PRICING_WEIGHTS], 0) /
              totalWeight;

            // Apply limits
            const clampedMultiplier = Math.max(
              PRICE_ADJUSTMENT_LIMITS.minDiscount,
              Math.min(PRICE_ADJUSTMENT_LIMITS.maxUplift, finalMultiplier)
            );

            const finalPrice = Math.round(basePrice * clampedMultiplier * 100) / 100;
            const suggestedPrice = Math.round(finalPrice);

            // Calculate confidence using quadratic weighting (confidence * weight squared / sum of squared weights)
            const weights = [
              { conf: demandFactor.confidence, weight: PRICING_WEIGHTS.demand },
              { conf: competitionFactor.competitors.length > 0 ? 0.7 : 0.3, weight: PRICING_WEIGHTS.competition },
              { conf: 0.8, weight: PRICING_WEIGHTS.seasonal },
              { conf: 0.9, weight: PRICING_WEIGHTS.urgency },
              { conf: 0.7, weight: PRICING_WEIGHTS.quality },
            ];
            const sumSquaredWeights = weights.reduce((sum, w) => sum + w.weight ** 2, 0);
            const confidence = Math.min(0.95, weights.reduce((sum, w) => sum + w.conf * (w.weight ** 2), 0) / sumSquaredWeights);

            logger.info('Smart pricing calculated', {
              serviceId,
              basePrice,
              suggestedPrice,
              finalMultiplier: clampedMultiplier,
              confidence,
            });

            return {
              serviceId,
              basePrice,
              suggestedPrice,
              priceRange: {
                min: Math.round(basePrice * PRICE_ADJUSTMENT_LIMITS.minDiscount),
                max: Math.round(basePrice * PRICE_ADJUSTMENT_LIMITS.maxUplift),
                optimal: suggestedPrice,
              },
              factors,
              demandMultiplier: demandFactor.multiplier,
              competitionMultiplier: competitionFactor.multiplier,
              seasonMultiplier: seasonalFactor.multiplier,
              urgencyMultiplier: urgencyFactor.multiplier,
              finalPrice,
              confidence: Math.min(0.95, confidence),
              validUntil: new Date(Date.now() + 15 * 60 * 1000), // Valid for 15 minutes
              metadata: {
                modelVersion: this.modelVersion,
                calculatedAt: new Date(),
                dataPointsUsed: competitionFactor.competitors.length + 1,
                algorithm: 'weighted_multi_factor',
              },
            };
          },
          { maxAttempts: 2, initialDelayMs: 200 }
        ).then(result => {
          if (!result.success) {
            throw result.error || new Error('Smart pricing calculation failed');
          }
          return result.result!;
        });
      },
      async () => {
        // Fallback: return base price
        const service = await Service.findById(serviceId).lean();
        const basePrice = (service?.price as any)?.amount || 100;

        return {
          serviceId,
          basePrice,
          suggestedPrice: basePrice,
          priceRange: {
            min: basePrice,
            max: basePrice,
            optimal: basePrice,
          },
          factors: [],
          demandMultiplier: 1.0,
          competitionMultiplier: 1.0,
          seasonMultiplier: 1.0,
          urgencyMultiplier: 1.0,
          finalPrice: basePrice,
          confidence: 0.3,
          validUntil: new Date(),
          metadata: {
            modelVersion: 'fallback',
            calculatedAt: new Date(),
            dataPointsUsed: 0,
            algorithm: 'base_price',
          },
        };
      }
    );
  }

  // Get pricing recommendation
  async getPricingRecommendation(serviceId: string): Promise<PricingRecommendation> {
    const currentDate = new Date();
    const pricing = await this.calculateOptimalPrice(serviceId, currentDate);

    const service = await Service.findById(serviceId).lean();
    const currentPrice = (service?.price as any)?.amount || pricing.basePrice;

    const expectedRevenueImpact = (
      (pricing.suggestedPrice - currentPrice) / currentPrice
    ) * 100;

    return {
      serviceId,
      currentPrice,
      suggestedPrice: pricing.suggestedPrice,
      expectedRevenueImpact: Math.round(expectedRevenueImpact * 10) / 10,
      confidence: pricing.confidence,
      reason: pricing.factors
        .filter(f => f.multiplier !== 1.0)
        .map(f => f.description)
        .join(', ') || 'Standard pricing recommended',
      expiresAt: pricing.validUntil,
    };
  }

  // Competitive analysis
  async analyzeCompetition(
    serviceId: string,
    location?: { lat: number; lng: number }
  ): Promise<CompetitiveAnalysis> {
    const service = await Service.findById(serviceId).lean();
    if (!service) {
      throw ApiError.notFound('Service not found', ERROR_CODES.NOT_FOUND);
    }

    const yourPrice = (service.price as any)?.amount || 0;
    const competitionResult = await calculateCompetitionFactor(serviceId, location);

    const marketAverage = competitionResult.competitors.length > 0
      ? competitionResult.competitors.reduce((sum, c) => sum + c.price, 0) / competitionResult.competitors.length
      : yourPrice;

    let pricePosition: CompetitiveAnalysis['pricePosition'];
    const ratio = yourPrice / marketAverage;

    if (ratio < 0.80) {
      pricePosition = 'undercut';
    } else if (ratio < 1.10) {
      pricePosition = 'competitive';
    } else if (ratio < 1.30) {
      pricePosition = 'premium';
    } else {
      pricePosition = 'luxury';
    }

    const recommendations: string[] = [];

    if (pricePosition === 'undercut') {
      recommendations.push('Consider raising prices to improve perceived value');
    } else if (pricePosition === 'premium' || pricePosition === 'luxury') {
      recommendations.push('Ensure service quality justifies premium pricing');
    } else {
      recommendations.push('Pricing is competitive - focus on service quality');
    }

    if (competitionResult.competitors.length < 3) {
      recommendations.push('Limited competition data - consider expanding search area');
    }

    return {
      serviceId,
      marketAverage: Math.round(marketAverage * 100) / 100,
      yourPrice,
      pricePosition,
      competitors: competitionResult.competitors,
      recommendations,
    };
  }

  // Batch pricing for multiple services
  async batchCalculatePrices(
    serviceIds: string[],
    bookingDate: Date,
    location?: { lat: number; lng: number }
  ): Promise<SmartPricing[]> {
    return Promise.all(
      serviceIds.map(id => this.calculateOptimalPrice(id, bookingDate, location))
    );
  }
}

export const smartPricingService = new SmartPricingService();
export default smartPricingService;
