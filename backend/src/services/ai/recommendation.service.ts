import { Types } from 'mongoose';
import Booking from '../../models/booking.model';
import Service from '../../models/service.model';
import User from '../../models/user.model';
import logger from '../../utils/logger';

export interface Recommendation {
  type: 'service' | 'provider' | 'complementary';
  items: RecommendedItem[];
  confidence: number;
  explanation: string;
}

export interface RecommendedItem {
  id: string;
  name: string;
  image?: string;
  rating?: number;
  price?: number;
  matchScore: number;
  reason: string;
}

export interface UserPreferences {
  categories: string[];
  priceRange: { min: number; max: number };
  preferredTime?: string;
  location?: { lat: number; lng: number };
}

class RecommendationService {
  /**
   * Get personalized service recommendations for a user
   */
  async getServiceRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<Recommendation> {
    try {
      // Get user preferences from booking history
      const userPreferences = await this.getUserPreferences(userId);

      // Get popular services as fallback
      const popularServices = await this.getPopularServices(limit);

      // Get personalized recommendations
      const personalizedServices = await this.getPersonalizedServices(
        userId,
        userPreferences,
        limit
      );

      // Combine and score
      const scoredServices = this.scoreServices(
        personalizedServices,
        popularServices,
        userPreferences
      );

      return {
        type: 'service',
        items: scoredServices.slice(0, limit),
        confidence: this.calculateConfidence(userId),
        explanation: 'Based on your booking history and preferences',
      };
    } catch (error) {
      logger.error('Recommendation error', { error, userId });
      // Return popular services as fallback
      return this.getPopularServicesFallback(limit);
    }
  }

  /**
   * Get complementary services (users also booked)
   */
  async getComplementaryServices(
    serviceId: string,
    limit: number = 5
  ): Promise<Recommendation> {
    try {
      // Find customers who booked this service
      const customersWhoBooked = await Booking.distinct('customerId', {
        serviceId: new Types.ObjectId(serviceId),
        status: 'completed',
        customerId: { $exists: true, $ne: null }
      });

      if (customersWhoBooked.length === 0) {
        return { type: 'complementary', items: [], confidence: 0, explanation: 'No booking history found' };
      }

      // Find other services booked by these customers (excluding the input service)
      const complementary = await Booking.aggregate([
        {
          $match: {
            customerId: { $in: customersWhoBooked },
            serviceId: { $ne: new Types.ObjectId(serviceId) },
            status: 'completed'
          }
        },
        { $group: { _id: '$serviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);

      const complementaryIds = complementary
        .filter(s => s._id.toString() !== serviceId)
        .slice(0, limit)
        .map(s => s._id);

      const services = await Service.find({
        _id: { $in: complementaryIds },
        isActive: true,
      });

      return {
        type: 'complementary',
        items: services.map(s => ({
          id: s._id.toString(),
          name: s.name,
          image: s.images?.[0],
          rating: s.rating?.average,
          matchScore: 0.8,
          reason: 'Frequently booked together',
        })),
        confidence: 0.7,
        explanation: 'Services frequently booked together',
      };
    } catch (error) {
      logger.error('Complementary service error', { error, serviceId });
      return { type: 'complementary', items: [], confidence: 0, explanation: '' };
    }
  }

  /**
   * Get provider recommendations
   */
  async getProviderRecommendations(
    userId: string,
    serviceId: string,
    limit: number = 5
  ): Promise<RecommendedItem[]> {
    try {
      const service = await Service.findById(serviceId);
      if (!service) return [];

      // Get top-rated providers for this service
      const providers = await User.find({
        role: 'provider',
        'providerProfile.services': serviceId,
        'providerProfile.isActive': true,
        'providerProfile.verified': true,
      })
        .sort({ 'providerProfile.rating.average': -1 })
        .limit(limit);

      return providers.map(p => ({
        id: p._id.toString(),
        name: `${p.firstName} ${p.lastName}`,
        image: p.avatar,
        rating: (p as any).providerProfile?.reviewsData?.averageRating || 4.5,
        matchScore: (p as any).providerProfile?.reviewsData?.averageRating || 4.5,
        reason: 'Top rated for this service',
      }));
    } catch (error) {
      logger.error('Provider recommendation error', { error });
      return [];
    }
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const bookings = await Booking.find({
      customerId: userId,
      status: { $in: ['completed', 'confirmed'] },
    }).populate('serviceId', 'category basePrice');

    const categories = new Set<string>();
    let totalSpent = 0;
    let count = 0;

    for (const booking of bookings) {
      const service = booking.serviceId as any;
      if (service?.category) {
        categories.add(service.category.toString());
      }
      totalSpent += booking.pricing.totalAmount;
      count++;
    }

    const avgSpent = count > 0 ? totalSpent / count : 0;

    return {
      categories: Array.from(categories),
      priceRange: {
        min: Math.max(0, avgSpent * 0.5),
        max: avgSpent * 1.5,
      },
    };
  }

  private async getPopularServices(limit: number): Promise<any[]> {
    return Service.find({ isActive: true })
      .sort({ 'rating.average': -1, 'bookingCount': -1 })
      .limit(limit);
  }

  private async getPersonalizedServices(
    userId: string,
    preferences: UserPreferences,
    limit: number
  ): Promise<any[]> {
    const bookings = await Booking.find({
      customerId: userId,
      status: 'completed',
    })
      .populate('serviceId')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get similar services based on categories
    const categories = preferences.categories;

    return Service.find({
      isActive: true,
      category: { $in: categories },
      basePrice: {
        $gte: preferences.priceRange.min,
        $lte: preferences.priceRange.max,
      },
    })
      .sort({ 'rating.average': -1 })
      .limit(limit);
  }

  private scoreServices(
    personalized: any[],
    popular: any[],
    preferences: UserPreferences
  ): RecommendedItem[] {
    const scored = new Map<string, RecommendedItem>();

    // Score personalized services
    personalized.forEach((service, index) => {
      const score = 1 - (index / personalized.length);
      scored.set(service._id.toString(), {
        id: service._id.toString(),
        name: service.name,
        image: service.images?.[0],
        rating: service.rating?.average,
        price: service.basePrice,
        matchScore: score * 0.7 + 0.3,
        reason: 'Matches your preferences',
      });
    });

    // Add popular services not already scored
    popular.forEach((service, index) => {
      if (!scored.has(service._id.toString())) {
        const score = 1 - (index / popular.length);
        scored.set(service._id.toString(), {
          id: service._id.toString(),
          name: service.name,
          image: service.images?.[0],
          rating: service.rating?.average,
          price: service.basePrice,
          matchScore: score * 0.4,
          reason: 'Popular choice',
        });
      }
    });

    return Array.from(scored.values())
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  private async getPopularServicesFallback(limit: number): Promise<Recommendation> {
    const services = await this.getPopularServices(limit);
    return {
      type: 'service',
      items: services.map((s, i) => ({
        id: s._id.toString(),
        name: s.name,
        image: s.images?.[0],
        rating: s.rating?.average,
        price: s.basePrice,
        matchScore: 1 - (i / services.length),
        reason: 'Popular service',
      })),
      confidence: 0.5,
      explanation: 'Popular services you might like',
    };
  }

  private calculateConfidence(userId: string): number {
    // More bookings = higher confidence
    return 0.5; // Simplified for now
  }
}

export const recommendationService = new RecommendationService();
