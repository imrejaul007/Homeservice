// AI Services Index - Central export for all AI services
// Platform Intelligence & Machine Learning Services

// Re-export fraud detection rules
export {
  FraudSignal,
  FraudPrediction,
  FraudFactors,
  BookingPattern,
  getBookingPattern,
  DEFAULT_CONFIG,
} from './rules';

// Re-export enhanced fraud detection
export {
  fraudDetectionService,
  FraudRisk,
} from './fraudDetection.service';

// Re-export recommendation service
export {
  recommendationService,
  Recommendation,
  RecommendedItem,
} from './recommendation.service';

// Re-export churn prediction
export {
  churnPredictionService,
  ChurnRisk,
  EngagementMetrics,
} from './churnPrediction.service';

// Re-export demand forecasting
export {
  demandForecastService,
  DemandForecast,
  HourForecast,
  RegionalDemand,
} from './demandForecast.service';

// Re-export smart pricing
export {
  smartPricingService,
  SmartPricing,
  PricingFactor,
  PricingRecommendation,
  CompetitiveAnalysis,
  CompetitorPrice,
  PricingMetadata,
} from './smartPricing.service';

// Re-export availability prediction
export {
  availabilityPredictionService,
  AvailabilityForecast,
  HourlyAvailability,
  AvailabilitySummary,
  AvailabilityMetadata,
  SlotRecommendation,
  ProviderAvailabilityRequest,
} from './availabilityPrediction.service';

// Re-export notification optimizer
export {
  notificationOptimizerService,
  NotificationOptimization,
  OptimalTime,
  ChannelPreferences,
  ContentSuggestion,
  SuppressRule,
  NotificationSchedule,
  PersonalizedContent,
} from './notificationOptimizer.service';

// Re-export event processor
export {
  eventProcessor,
  trackEvent,
  AIEvent,
  AIEventType,
  EventContext,
  FeatureStoreUpdate,
  EventStreamConfig,
  UserFeatures,
  ServiceFeatures,
  ProviderFeatures,
} from './eventProcessor.service';
