/**
 * Recommendation Components
 * AI-powered recommendation UI components for NILIN marketplace
 */

// Main components
export { default as RecommendationCarousel } from './RecommendationCarousel';
export { default as PersonalizedSection } from './PersonalizedSection';

// Re-export types for convenience
export type {
  ServiceRecommendation,
  ProviderRecommendation,
  TrendingService,
} from '@/hooks/useRecommendations';

export type {
  RecommendationAction,
} from '@/hooks/useRecommendations';
