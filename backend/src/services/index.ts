// Service Layer Index
// Re-exports for cleaner imports

export { authService, AuthService } from './auth.service';
export { bookingService, BookingService } from './booking.service';
export { providerService, ProviderService } from './provider.service';
export { notificationService, NotificationService } from './notification.service';

// Provider AI Insights exports
export {
  getProviderInsights,
  getProviderPerformanceMetrics,
  getProviderRevenueMetrics,
  getCustomerSatisfactionMetrics,
  getBookingTrends,
  generateProviderInsights,
  getRevenueOptimizationTips,
  clearInsightsCache,
} from './providerInsights.service';

// Schedule Optimization exports
export {
  getOptimalSchedule,
  analyzeBookingPatterns,
  getAvailabilityGaps,
  getPeakDemandAnalysis,
  detectScheduleConflicts,
  getScheduleEfficiencyScore,
  clearScheduleCache,
} from './scheduleOptimization.service';

// Cancellation Prediction exports
export {
  getCustomerCancellationProfile,
  predictBookingCancellation,
  getProviderCancellationStats,
  predictUpcomingCancellations,
  predictNoShows,
  getCancellationPreventionRecommendations,
  clearCancellationCache,
} from './cancellationPrediction.service';

// Email service exports
export {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingRequestEmail,
  sendBookingConfirmationEmail,
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendBookingRescheduled,
  sendProviderApproval,
  sendProviderRejection,
} from './email.service';

// Finance service exports
export {
  financeService,
  calculateProviderEarnings,
  calculateProviderEarningsFromBooking,
  calculatePayoutSchedule,
  calculatePlatformFees,
  getProviderPayoutSummary,
  getCommissionConfig,
  getCommissionTiers,
} from './finance';

// Trust & Safety service exports
export {
  trustSafetyService,
  calculateTrustScore,
  getTrustBreakdown,
  updateTrustScore,
  getTrustFactors,
  compareProvidersTrustScores,
  getTopTrustedProviders,
  getTrustThresholds,
} from './trust-safety';

// Marketplace service exports
export {
  marketplaceService,
  calculateSurgeMultiplier,
  getDemandLevel,
  getUpcomingSurges,
  getHighDemandZones,
  calculatePriceWithSurge,
  getSurgeConfiguration,
  clearSurgeCache,
  experimentBucket,
} from './marketplace';

// Anomaly Detection service exports
export {
  anomalyDetectionService,
  AnomalyModel,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyFilters,
  AnomalyStats,
  BehavioralScore,
} from './anomalyDetection.service';

// Support Triage service exports
export {
  supportTriageService,
  SupportTicketModel,
  TriageResult,
  SupportTicket,
  TicketFilters,
  TicketStats,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './supportTriage.service';

// Event Stream service exports
export {
  eventStreamService,
  AnalyticsEventModel,
  StreamEventModel,
  StreamEvent,
  StreamMetrics,
  StreamAggregation,
  AnalyticsEvent,
  FunnelAnalysis,
} from './eventStream.service';

// Recommendation service exports
export {
  recommendationService,
  RecommendationService,
  ServiceRecommendation,
  ProviderRecommendation,
  TrendingService,
  DemandPrediction,
  OfferTargeting,
} from './recommendation.service';

// Churn Prediction service exports
export {
  churnPredictionService,
  ChurnPredictionService,
  ChurnRisk,
  ChurnFactor,
  RetentionAction,
  CustomerSegment,
} from './churnPrediction.service';

// Pricing Recommendation service exports
export {
  pricingRecommendationService,
  PricingRecommendationService,
  PriceRecommendation,
  MarketRate,
  ProviderPricingAnalysis,
  DemandBasedPricing,
} from './pricingRecommendation.service';

// Analytics service exports
export {
  analyticsService,
  AnalyticsService,
  TrendDataPoint,
  AggregatedMetric,
  CohortData,
  FunnelStep,
  GeoDistribution,
  TimeSeriesData,
  CategoryPerformance,
  DashboardMetrics,
  TimePeriod,
  ComparisonPeriods,
  FunnelMetrics,
  GeographicAnalytics,
  getBookingFunnel,
  getGeographicAnalytics,
} from './analytics.service';

// Churn service exports
export {
  churnService,
  ChurnService,
} from './churn.service';
export type {
  ChurnRiskReport,
  ChurnFilters,
  DateRange,
  ChurnStats,
  AtRiskCustomer,
} from './churn.service';

// Report service exports
export {
  reportService,
  ReportService,
  ReportConfig,
  ScheduledReport,
  ReportData,
} from './report.service';

// Business Intelligence service exports
export {
  businessIntelligenceService,
  BusinessIntelligenceService,
  CustomerLifetimeValue,
  CustomerAcquisitionCost,
  RetentionMetrics,
  CohortRetention,
  RFMAnalysis,
  RevenueBreakdown,
  BusinessHealthScore,
  BusinessGrowthMetrics,
  CompetitiveMetrics,
} from './businessIntelligence.service';

// Executive Dashboard service exports
export {
  executiveDashboardService,
  ExecutiveDashboardService,
  ExecutiveKPIs,
  GrowthMetrics,
  RevenueDashboard,
  OperationalMetrics,
  ExecutiveAlert,
  MarketOpportunity,
  ExecutiveDashboardData,
} from './executiveDashboard.service';

// Demo service exports
export {
  demoService,
  DemoService,
  DemoConfig,
  DemoAccount,
  DemoMetrics,
  DemoScenario,
  DemoStep,
  LaunchReadiness,
  ReadinessItem,
} from './demoService';
