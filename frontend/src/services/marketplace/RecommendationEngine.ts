// AI-Powered Recommendation Engine
// Personalized service and provider recommendations based on user behavior

export interface RecommendationContext {
  userId?: string;
  location?: { lat: number; lng: number };
  browsingHistory?: string[];
  favorites?: string[];
  pastBookings?: string[];
  searchQuery?: string;
  category?: string;
}

export interface ServiceRecommendation {
  id: string;
  score: number;
  reason: 'popular' | 'nearby' | 'personalized' | 'similar' | 'trending';
  label: string;
}

export interface ProviderRecommendation {
  id: string;
  score: number;
  reason: 'top_rated' | 'nearby' | 'reliable' | 'similar';
  label: string;
}

class RecommendationEngine {
  private userContext: RecommendationContext = {};
  private recentlyRecommended: Set<string> = new Set();

  // Update user context for better recommendations
  updateContext(context: Partial<RecommendationContext>) {
    this.userContext = { ...this.userContext, ...context };
  }

  // Get personalized service recommendations
  async getServiceRecommendations(
    services: any[],
    limit: number = 10
  ): Promise<ServiceRecommendation[]> {
    const scored = services.map((service) => {
      let score = 0;
      let reason: ServiceRecommendation['reason'] = 'popular';
      let label = '';

      // Popularity score
      const popularityScore = (service.bookings || 0) * 0.3;

      // Rating score
      const ratingScore = (service.rating || 0) * 20;

      // Recency bonus
      const recencyScore = this.getRecencyScore(service.createdAt);

      // Personalization score
      const personalizationScore = this.getPersonalizationScore(service);

      // Distance score (if location available)
      const distanceScore = this.getDistanceScore(service);

      // Calculate total score with weights
      score =
        popularityScore * 0.2 +
        ratingScore * 0.3 +
        recencyScore * 0.1 +
        personalizationScore * 0.25 +
        distanceScore * 0.15;

      // Determine reason
      if (personalizationScore > 50) {
        reason = 'personalized';
        label = 'Recommended for you';
      } else if (distanceScore > 70) {
        reason = 'nearby';
        label = 'Near your location';
      } else if (service.trending) {
        reason = 'trending';
        label = 'Trending now';
      } else if (popularityScore > 80) {
        reason = 'popular';
        label = 'Popular in your area';
      }

      // Boost for favorites
      if (this.userContext.favorites?.includes(service.id)) {
        score *= 1.2;
      }

      return {
        id: service.id,
        score,
        reason,
        label,
      };
    });

    // Sort by score and filter out recently shown
    const filtered = scored
      .filter((s) => !this.recentlyRecommended.has(s.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Track recently shown
    filtered.forEach((s) => this.recentlyRecommended.add(s.id));

    // Clean up old recommendations
    if (this.recentlyRecommended.size > 50) {
      const arr = Array.from(this.recentlyRecommended);
      this.recentlyRecommended = new Set(arr.slice(-50));
    }

    return filtered;
  }

  // Get provider recommendations
  async getProviderRecommendations(
    providers: any[],
    limit: number = 5
  ): Promise<ProviderRecommendation[]> {
    const scored = providers.map((provider) => {
      let score = 0;
      let reason: ProviderRecommendation['reason'] = 'top_rated';
      let label = '';

      // Trust score
      const trustScore = (provider.rating || 0) * 20 +
        (provider.completedJobs || 0) * 0.1 +
        (provider.isVerified ? 30 : 0) +
        (provider.isTopRated ? 50 : 0);

      // Reliability score
      const reliabilityScore = (provider.acceptanceRate || 0) * 2 +
        (100 - (provider.cancellationRate || 0)) * 0.5;

      // Response score
      const responseScore = (provider.responseRate || 0);

      score = trustScore * 0.4 + reliabilityScore * 0.35 + responseScore * 0.25;

      // Determine reason
      if (provider.isTopRated) {
        reason = 'top_rated';
        label = 'Top Rated';
      } else if (provider.isVerified && provider.rating >= 4.8) {
        reason = 'reliable';
        label = 'Highly Reliable';
      }

      return { id: provider.id, score, reason, label };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Get personalized search suggestions
  getSearchSuggestions(query: string, history: string[]): string[] {
    const suggestions: string[] = [];

    // Add from search history
    const matchingHistory = history.filter((h) =>
      h.toLowerCase().includes(query.toLowerCase())
    );
    suggestions.push(...matchingHistory.slice(0, 3));

    // Add popular searches
    const popular = this.getPopularSearches(query);
    suggestions.push(...popular.filter((p) => !suggestions.includes(p)));

    return suggestions.slice(0, 6);
  }

  // Get "Recently viewed" + "Similar services" recommendation
  async getSmartDiscovery(services: any[]): Promise<ServiceRecommendation[]> {
    const recentlyViewed = this.userContext.browsingHistory || [];
    const favorites = this.userContext.favorites || [];

    // Get similar services to recently viewed/favorites
    const targetIds = [...recentlyViewed, ...favorites];
    const similar = services
      .filter((s) => !targetIds.includes(s.id))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        score: 80,
        reason: 'similar' as const,
        label: 'Similar to your interests',
      }));

    return similar;
  }

  // Calculate personalization score
  private getPersonalizationScore(service: any): number {
    let score = 0;
    const favorites = this.userContext.favorites || [];
    const pastBookings = this.userContext.pastBookings || [];

    // Boost if in favorites
    if (favorites.includes(service.id)) score += 50;

    // Boost if previously booked similar
    if (pastBookings.some((id) => service.categoryId === this.getCategoryForService(id))) {
      score += 40;
    }

    // Boost if similar to browsing history
    const browsingHistory = this.userContext.browsingHistory || [];
    if (browsingHistory.length > 0 && service.id !== browsingHistory[browsingHistory.length - 1]) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private getDistanceScore(service: any): number {
    // Use real haversine distance calculation
    const userLocation = this.userContext.location;
    if (!userLocation) return 50;

    // Service coordinates (from service object or default fallback)
    const serviceLat = service.coordinates?.lat ?? service.location?.lat;
    const serviceLng = service.coordinates?.lng ?? service.location?.lng;

    if (serviceLat == null || serviceLng == null) {
      return 50; // No location data available
    }

    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(serviceLat - userLocation.lat);
    const dLng = this.toRad(serviceLng - userLocation.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(userLocation.lat)) *
        Math.cos(this.toRad(serviceLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Convert distance to a score (closer = higher score, max 100)
    // Using exponential decay: score = 100 * e^(-distance/15)
    // This gives ~90 at 1km, ~73 at 5km, ~37 at 10km, ~14 at 25km
    const score = Math.min(100, Math.max(0, 100 * Math.exp(-distanceKm / 15)));

    return Math.round(score);
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private getRecencyScore(createdAt: string): number {
    const daysSince = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 100 - daysSince * 2);
  }

  private getPopularSearches(query: string): string[] {
    const popular = [
      'plumbing repair',
      'electrician',
      'home cleaning',
      'AC service',
      'painting',
      'carpenter',
    ];
    return popular.filter((p) => p.includes(query.toLowerCase()));
  }

  private getCategoryForService(serviceId: string): string {
    // In production, would look up actual category
    return '';
  }

  // Reset recommendations (for new session)
  reset() {
    this.recentlyRecommended.clear();
  }
}

export const recommendationEngine = new RecommendationEngine();

// React hook for recommendations
import { useState, useEffect, useCallback } from 'react';
import { useRetentionStore } from '../product/RetentionService';

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<ServiceRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { recentlyViewed, engagement } = useRetentionStore();

  // Update context with user data
  useEffect(() => {
    recommendationEngine.updateContext({
      browsingHistory: recentlyViewed.filter((r) => r.type === 'service').map((r) => r.id),
      favorites: engagement.favoriteServices,
    });
  }, [recentlyViewed, engagement.favoriteServices]);

  // Get recommendations
  const fetchRecommendations = useCallback(async (services: any[]) => {
    setIsLoading(true);
    try {
      const recs = await recommendationEngine.getServiceRecommendations(services);
      setRecommendations(recs);
    } catch (error) {
      console.error('Recommendations error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { recommendations, fetchRecommendations, isLoading };
}

export default recommendationEngine;
