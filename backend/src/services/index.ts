// Service Layer Index
// Re-exports for cleaner imports

export { authService, AuthService } from './auth.service';
export { bookingService, BookingService } from './booking.service';
export { providerService, ProviderService } from './provider.service';
export { notificationService, NotificationService } from './notification.service';

// Chat service exports
export { chatService, ChatService } from './chat.service';
export type { SendMessageInput, GetMessagesOptions, ChatRoomWithParticipants } from './chat.service';

// Chat moderation service exports
export { chatModerationService } from './chatModeration.service';
export type { ModerationResult, SpamCheckResult } from './chatModeration.service';

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

// ============================================
// Notification services (notifications subdirectory)
export * from './notifications/index';

// Chat services - exported above via named exports

// PDF & Document services
export { default as pdfService } from './pdf.service';
export { default as invoiceService } from './invoice.service';
export { default as receiptService } from './receipt.service';

// Analytics services
export { default as trendingService } from './trending.service';
export { default as geolocationService } from './geolocation.service';

// Trust & Safety services
export { default as deviceFingerprintService } from './deviceFingerprint.service';
export { default as behavioralAnalysisService } from './behavioralAnalysis.service';
export { default as vpnProxyDetectionService } from './vpnProxyDetection.service';
export { default as emailReputationService } from './emailReputation.service';
export { default as phoneIntelligenceService } from './phoneIntelligence.service';
export { default as chargebackPredictionService } from './chargebackPrediction.service';
export { default as reviewVelocityMonitorService } from './reviewVelocityMonitor.service';
export { default as loginAnomalyDetectionService } from './loginAnomalyDetection.service';
export { default as sessionManagementService } from './sessionManagement.service';
export { default as trustedDeviceFlowService } from './trustedDeviceFlow.service';

// Monetization services
export { default as instantBookingCommissionService } from './instantBookingCommission.service';
export { default as priorityMatchFeeService } from './priorityMatchFee.service';
export { default as bundleSalesService } from './bundleSales.service';
export { default as bookingDepositService } from './bookingDeposit.service';
export { default as cancellationInsuranceService } from './cancellationInsurance.service';
export { default as verifiedBadgeService } from './verifiedBadge.service';
export { default as leadGenerationFeeService } from './leadGenerationFee.service';
export { default as featuredSearchBoostService } from './featuredSearchBoost.service';
export { default as corporateAccountService } from './corporateAccount.service';
export { default as b2bBillingService } from './b2bBilling.service';
export { default as apiAccessPricingService } from './apiAccessPricing.service';

// Trust & Safety - Fraud Detection Services
export { default as breachCheckService } from './breachCheck.service';
export { default as bankVerificationService } from './bankVerification.service';
export { default as stockPhotoDetectionService } from './stockPhotoDetection.service';
export { default as imageModerationService } from './imageModeration.service';
export { default as profanityFilterService } from './profanityFilter.service';
export { default as bookingRingDetectionService } from './bookingRingDetection.service';

// Cross-connection services
export { default as servicePackagesService } from './servicePackages.service';
export { default as tippingService } from './tipping.service';
export { default as photoSharingService } from './photoSharing.service';
export { default as quoteRequestService } from './quoteRequest.service';
export { default as policyUpdateNotificationService } from './policyUpdateNotification';
export { default as monthlyScorecardService } from './monthlyScorecard.service';
export { default as trainingAcademyService } from './trainingAcademy.service';
export { default as betaFeaturesAccessService } from './betaFeaturesAccess.service';
export { default as enhancedAccountRecoveryService } from './enhancedAccountRecovery.service';
export { default as activityAuditLogService } from './activityAuditLog.service';
