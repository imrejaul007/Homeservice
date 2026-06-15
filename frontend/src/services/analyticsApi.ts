import { api } from './api';
import type { TrendResult } from './providerApi';
import type { ProviderInsightsAnalytics } from './providerApi';

// ============================================
// Churn Prediction Types
// ============================================

export interface ChurnFactor {
  name: string;
  weight: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RetentionAction {
  type: 'offer' | 'outreach' | 'incentive' | 'reengagement' | 'feedback';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact: number;
  offerDetails?: {
    discountPercent?: number;
    freeService?: string;
    loyaltyPoints?: number;
    validityDays?: number;
  };
  channels: ('push' | 'email' | 'sms' | 'in_app')[];
}

export interface ChurnRisk {
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  indicators: Array<{
    type: 'behavioral' | 'engagement' | 'feedback' | 'demographic';
    name: string;
    value: any;
    threshold: any;
    breached: boolean;
  }>;
  predictedChurnDate?: string;
  confidence: number;
  recommendedActions: RetentionAction[];
  lastBookingDate?: string;
  daysSinceLastBooking?: number;
  totalBookings: number;
  lifetimeValue: number;
}

export interface CustomerSegment {
  segmentId: string;
  name: string;
  description: string;
  customerCount: number;
  avgLifetimeValue: number;
  avgChurnRisk: number;
  characteristics: {
    avgBookingsPerMonth: number;
    avgOrderValue: number;
    avgDaysSinceLastBooking: number;
    topCategories: string[];
    preferredTimeSlots: string[];
  };
}

export interface ChurnStats {
  totalAtRisk: number;
  byRiskLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageRiskScore: number;
  totalLifetimeValueAtRisk: number;
  topRiskFactors: Array<{ factor: string; count: number }>;
}

export interface ChurnOverview {
  atRiskCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  segments: CustomerSegment[];
  recentAlerts: Array<{
    userId: string;
    customerName?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    daysSinceLastBooking: number;
    recommendedAction: string;
  }>;
}

// ============================================
// Fraud Detection Types
// ============================================

export interface FraudPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
    threshold?: number;
  }>;
  action: 'flag' | 'block' | 'auto_suspend';
}

export interface SuspiciousActivity {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  detectedAt: string;
  metadata?: Record<string, any>;
}

export interface FraudReport {
  providerId: string;
  generatedAt: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  patterns: FraudPattern[];
  suspiciousActivities: SuspiciousActivity[];
  recommendations: string[];
  summary: string;
}

export interface FraudStats {
  totalFlagged: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recentFlags: number;
  resolvedFlags: number;
}

export interface FraudOverview {
  totalFlagged: number;
  recentFlags: number;
  resolvedFlags: number;
  pendingFlags: number;
  bySeverity: Record<string, number>;
  alertLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

// ============================================
// SLA Types
// ============================================

export interface SLAThresholds {
  bookingResponseTime: number;
  bookingConfirmationTime: number;
  serviceCompletionTime: number;
  providerResponseTime: number;
  cancellationWindow: number;
}

export interface SLATrend {
  date: string;
  complianceRate: number;
  totalBookings: number;
  breaches: number;
}

export interface SLAComplianceByCategory {
  categoryId: string;
  categoryName: string;
  totalBookings: number;
  complianceRate: number;
  avgResponseTime: number;
  avgCompletionTime: number;
}

export interface SLAComplianceByProvider {
  providerId: string;
  providerName: string;
  totalBookings: number;
  complianceRate: number;
  breachedCount: number;
}

export interface SLAMetrics {
  totalBookings: number;
  meetingSLA: number;
  breachedSLA: number;
  complianceRate: number;
  averageResponseTime: number;
  averageCompletionTime: number;
  byCategory: SLAComplianceByCategory[];
  byProvider: SLAComplianceByProvider[];
  trends: SLATrend[];
}

export interface SLAReport {
  generatedAt: string;
  period: { start: string; end: string };
  overallCompliance: number;
  totalBookingsAnalyzed: number;
  totalBreaches: number;
  breachBreakdown: {
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  topBreachedCategories: Array<{ categoryId: string; categoryName: string; breachCount: number }>;
  topBreachedProviders: Array<{ providerId: string; providerName: string; breachCount: number }>;
  recommendations: string[];
}

export interface SLAOverview {
  currentCompliance: number;
  trend: 'improving' | 'stable' | 'declining';
  totalBreaches: number;
  criticalBreaches: number;
  averageResponseTime: number;
  topIssue: string;
}

// ============================================
// Analytics Dashboard Types
// ============================================

export interface TimeSeriesData {
  date: string;
  revenue: number;
  bookings: number;
  customers: number;
  providers: number;
  averageValue: number;
}

export interface AggregatedMetric {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CohortData {
  cohort: string;
  period: number;
  users: number;
  retained: number;
  retentionRate: number;
}

export interface FunnelStep {
  step: string;
  count: number;
  percentage: number;
  dropoffRate: number;
}

export interface GeoDistribution {
  region: string;
  country: string;
  city?: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  totalRevenue: number;
  totalBookings: number;
  averageRating: number;
  growth: number;
  share: number;
}

export interface DashboardMetrics {
  timestamp: string;
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    inProgress: number;
    noShow: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    monthOverMonthGrowth: number;
    averageBookingValue: number;
    projectedMonthly: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
    returning: number;
    churnRate: number;
  };
  providers: {
    total: number;
    active: number;
    pending: number;
    newThisMonth: number;
    averageRating: number;
  };
  serviceHealth: {
    totalServices: number;
    activeServices: number;
    averageRating: number;
    topPerforming: string[];
  };
}

// ============================================
// Business Intelligence Types
// ============================================

export interface CustomerLTV {
  customerId: string;
  customerName: string;
  totalBookings: number;
  totalSpent: number;
  averageBookingValue: number;
  firstBookingDate: string;
  lastBookingDate: string;
  lifetimeDays: number;
  predictedLTV: number;
  segment: 'low' | 'medium' | 'high' | 'vip';
}

export interface CACMetrics {
  period: string;
  totalMarketingSpend: number;
  newCustomersAcquired: number;
  averageCAC: number;
  byChannel: Array<{
    channel: string;
    spend: number;
    customers: number;
    cac: number;
  }>;
}

export interface RetentionMetrics {
  period: string;
  startingCustomers: number;
  retainedCustomers: number;
  churnedCustomers: number;
  retentionRate: number;
  churnRate: number;
  netRetention: number;
}

export interface RFMAnalysis {
  customerId: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: string;
  segment: 'champions' | 'loyal' | 'potential' | 'at_risk' | 'lost';
}

export interface RevenueBreakdown {
  period: string;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  platformFees: number;
  paymentFees: number;
  taxes: number;
  providerPayouts: number;
  platformProfit: number;
}

export interface BusinessHealthScore {
  overall: number;
  categories: Array<{
    name: string;
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    metrics: Record<string, number>;
  }>;
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metric?: string;
  }>;
}

// ============================================
// Executive Dashboard Types
// ============================================

export interface ExecutiveKPIs {
  timestamp: string;
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    monthOverMonthGrowth: number;
    yearToDate: number;
    projectedAnnual: number;
  };
  bookings: {
    total: number;
    thisMonth: number;
    completed: number;
    cancelled: number;
    completionRate: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
    retentionRate: number;
    ltv: number;
  };
  providers: {
    total: number;
    active: number;
    pendingVerification: number;
    averageRating: number;
  };
  platform: {
    grossMargin: number;
    netMargin: number;
    takeRate: number;
    averageOrderValue: number;
  };
}

export interface GrowthMetrics {
  period: string;
  revenue: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  bookings: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  customers: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  providers: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface RevenueDashboard {
  summary: {
    totalRevenue: number;
    grossRevenue: number;
    netRevenue: number;
    platformFees: number;
    paymentProcessingFees: number;
    commissions: number;
    taxes: number;
    providerPayouts: number;
  };
  breakdown: {
    byService: Array<{
      serviceId: string;
      serviceName: string;
      revenue: number;
      percentage: number;
      bookings: number;
    }>;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      revenue: number;
      percentage: number;
      bookings: number;
    }>;
    byProvider: Array<{
      providerId: string;
      providerName: string;
      revenue: number;
      percentage: number;
      bookings: number;
    }>;
  };
  trends: {
    daily: Array<{
      date: string;
      revenue: number;
      bookings: number;
    }>;
    weekly: Array<{
      week: string;
      revenue: number;
      bookings: number;
    }>;
    monthly: Array<{
      month: string;
      revenue: number;
      bookings: number;
    }>;
  };
}

export interface OperationalMetrics {
  averageBookingValue: number;
  averageServiceDuration: number;
  bookingLeadTime: number;
  providerUtilization: number;
  customerSatisfaction: {
    averageRating: number;
    responseRate: number;
    reviewRate: number;
  };
  serviceHealth: {
    activeServices: number;
    pendingServices: number;
    topPerformers: Array<{
      serviceId: string;
      serviceName: string;
      bookings: number;
      revenue: number;
      rating: number;
    }>;
    underperformers: Array<{
      serviceId: string;
      serviceName: string;
      reason: string;
    }>;
  };
}

export interface ExecutiveAlert {
  id: string;
  type: 'success' | 'info' | 'warning' | 'critical';
  category: 'revenue' | 'customers' | 'providers' | 'operations' | 'compliance';
  title: string;
  message: string;
  actionRequired: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface MarketOpportunity {
  category: string;
  demand: number;
  currentSupply: number;
  gap: number;
  opportunityScore: number;
  recommendation: string;
}

export interface ExecutiveDashboardData {
  kpis: ExecutiveKPIs;
  growth: GrowthMetrics;
  revenue: RevenueDashboard;
  operations: OperationalMetrics;
  alerts: ExecutiveAlert[];
  opportunities: MarketOpportunity[];
}

// ============================================
// Provider Unified Dashboard Types
// ============================================

export type ProviderDashboardRevenueMode = 'net' | 'gross';
export type ProviderDashboardPeriod = '7d' | '30d' | '90d';

export interface ProviderDashboardDataQuality {
  trackingSince: string | null;
  level: 'full' | 'bookings_only';
}

export interface ProviderExperimentResult {
  experimentId: string;
  variant: string;
  exposures: number;
  bookings: number;
  revenue: number;
  conversionRate: number;
}

export interface ProviderDashboardOverview {
  totalViews: number;
  totalViewsAllTime?: number;
  viewsTrend: TrendResult;
  profileViews: number;
  profileViewsTrend: TrendResult;
  bookingRequests: number;
  bookingRequestsTrend: TrendResult;
  conversionRate: number;
  conversionRateTrend: TrendResult;
  conversionRateConfirmed?: number;
  confirmedBookingRate?: number;
  confirmedRateTrend?: TrendResult;
  confirmedBookings?: number;
}

export interface ProviderDashboardResponse {
  period: ProviderDashboardPeriod;
  revenue: ProviderDashboardRevenueMode;
  city?: string | null;
  overview: ProviderDashboardOverview;
  earnings: ProviderInsightsAnalytics['earnings'] & {
    grossEarnings?: { thisMonth: number; lastMonth: number };
  };
  bookings: ProviderInsightsAnalytics['bookings'] & {
    confirmed?: number;
  };
  ratings: ProviderInsightsAnalytics['ratings'];
  topServices: ProviderInsightsAnalytics['topServices'];
  weeklyData: ProviderInsightsAnalytics['weeklyData'];
  timeSeries: ProviderInsightsAnalytics['timeSeries'];
  timeSeriesPrevious?: ProviderInsightsAnalytics['timeSeriesPrevious'];
  funnel: ProviderConversionFunnel | null;
  cancellationSnapshot?: Record<string, unknown> | null;
  responseTime: ProviderResponseTimeMetrics | null;
  ltv: ProviderCustomerLtv | null;
  geographic: ProviderGeographicDemand | null;
  forecast: ProviderRevenueForecast | null;
  bookingSources: ProviderBookingSourceAttribution | null;
  anomalyAlerts: ProviderAnomalyAlert[];
  serviceFunnel: ServiceAnalyticsMetrics[];
  experiments: ProviderExperimentResult[];
  dataQuality: ProviderDashboardDataQuality;
  meta?: {
    metricDefinitions?: Record<string, { label: string; description: string; formula?: string }>;
    generatedAt?: string;
  };
}

export interface GetProviderDashboardOptions {
  revenue?: ProviderDashboardRevenueMode;
  city?: string;
}

// ============================================
// Analytics API Service
// ============================================

export const analyticsApi = {
  // Dashboard Metrics
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get('/analytics/dashboard/metrics');
    return response.data.data;
  },

  // Time Series Data
  getTimeSeriesData: async (
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData[]> => {
    const response = await api.get('/analytics/dashboard/timeseries', {
      params: { startDate, endDate, granularity },
    });
    return response.data.data;
  },

  // Trend Analysis
  getTrendAnalysis: async (
    metric: 'revenue' | 'bookings' | 'customers' | 'providers',
    startDate: string,
    endDate: string
  ): Promise<AggregatedMetric> => {
    const response = await api.get('/analytics/dashboard/trends', {
      params: { metric, startDate, endDate },
    });
    return response.data.data;
  },

  // Cohort Analysis
  getCohortAnalysis: async (
    cohortType: 'weekly' | 'monthly' = 'monthly',
    retentionPeriods: number = 6
  ): Promise<CohortData[]> => {
    const response = await api.get('/analytics/dashboard/cohorts', {
      params: { cohortType, retentionPeriods },
    });
    return response.data.data;
  },

  // Conversion Funnel
  getConversionFunnel: async (
    startDate: string,
    endDate: string
  ): Promise<FunnelStep[]> => {
    const response = await api.get('/analytics/funnel', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // Geographic Distribution
  getGeographicDistribution: async (
    startDate: string,
    endDate: string
  ): Promise<GeoDistribution[]> => {
    const response = await api.get('/analytics/geographic', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // Category Performance
  getCategoryPerformance: async (
    startDate: string,
    endDate: string
  ): Promise<CategoryPerformance[]> => {
    const response = await api.get('/analytics/dashboard/categories', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // Overview (combined analytics)
  getOverview: async (period: string = 'month') => {
    const response = await api.get('/analytics/overview', {
      params: { period },
    });
    return response.data.data;
  },

  // Revenue Analytics
  getRevenueAnalytics: async (period: string = 'month') => {
    const response = await api.get('/analytics/revenue', {
      params: { period },
    });
    return response.data.data;
  },

  // Booking Analytics
  getBookingAnalytics: async (period: string = 'month') => {
    const response = await api.get('/analytics/bookings', {
      params: { period },
    });
    return response.data.data;
  },

  // Provider Analytics
  getProviderAnalytics: async () => {
    const response = await api.get('/analytics/providers');
    return response.data.data;
  },

  // Provider-Specific Analytics (for provider dashboard)
  getProviderAnalyticsById: async (providerId: string, period: '7d' | '30d' | '90d' = '30d') => {
    const response = await api.get(`/analytics/provider/${providerId}`, {
      params: { period },
    });
    return response.data.data;
  },

  // Customer Analytics
  getCustomerAnalytics: async () => {
    const response = await api.get('/analytics/customers');
    return response.data.data;
  },

  // Service Analytics
  getServiceAnalytics: async () => {
    const response = await api.get('/analytics/services');
    return response.data.data;
  },

  // Refresh Analytics Cache
  refreshAnalytics: async () => {
    const response = await api.post('/analytics/refresh');
    return response.data;
  },

  // Provider Travel Metrics (auth-scoped; providerId optional for admin override)
  getProviderTravelMetrics: async (
    _providerId?: string,
    period: string = '30d'
  ): Promise<ProviderTravelMetrics> => {
    const response = await api.get('/analytics/provider/travel', {
      params: { period },
    });
    return response.data.data;
  },

  // Service Profitability (auth-scoped)
  getServiceProfitability: async (
    _providerId?: string,
    period: string = '90d'
  ): Promise<ServiceProfitabilityData> => {
    const response = await api.get('/analytics/provider/profitability', {
      params: { period },
    });
    return mapServiceProfitabilityResponse(response.data.data);
  },

  // Competitive Position (auth-scoped)
  getCompetitivePosition: async (_providerId?: string): Promise<CompetitivePositionData> => {
    const response = await api.get('/analytics/provider/competitive-position');
    return mapCompetitivePositionResponse(response.data.data);
  },

  // ROAS Metrics (auth-scoped)
  getROASMetrics: async (
    _providerId?: string,
    period: string = '30d'
  ): Promise<ROASMetricsData> => {
    const response = await api.get('/analytics/provider/roas', {
      params: { period },
    });
    return response.data.data;
  },

  // Repeat Customer Rate (auth-scoped)
  getRepeatCustomerRate: async (
    _providerId?: string,
    period: string = '90d'
  ): Promise<RepeatCustomerMetricsData> => {
    const response = await api.get('/analytics/provider/repeat-customers', {
      params: { period },
    });
    return response.data.data;
  },

  // Peak Hours Revenue (auth-scoped)
  getPeakHoursRevenue: async (
    _providerId?: string,
    period: string = '30d'
  ): Promise<PeakHoursMetricsData> => {
    const response = await api.get('/analytics/provider/peak-hours', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderConversionFunnel: async (
    period: string = '30d',
  ): Promise<ProviderConversionFunnel> => {
    const response = await api.get('/analytics/provider/conversion-funnel', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderResponseTime: async (
    period: string = '30d',
  ): Promise<ProviderResponseTimeMetrics> => {
    const response = await api.get('/analytics/provider/response-time', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderCustomerLtv: async (
    period: string = '30d',
  ): Promise<ProviderCustomerLtv> => {
    const response = await api.get('/analytics/provider/customer-ltv', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderGeographicDemand: async (
    period: string = '30d',
  ): Promise<ProviderGeographicDemand> => {
    const response = await api.get('/analytics/provider/geographic-demand', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderRevenueForecast: async (
    period: string = '30d',
  ): Promise<ProviderRevenueForecast> => {
    const response = await api.get('/analytics/provider/revenue-forecast', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderBookingSourceAttribution: async (
    period: string = '30d',
  ): Promise<ProviderBookingSourceAttribution> => {
    const response = await api.get('/analytics/provider/booking-source-attribution', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderAnomalyAlerts: async (
    period: string = '30d',
  ): Promise<ProviderAnomalyAlert[]> => {
    const response = await api.get('/analytics/provider/anomaly-alerts', {
      params: { period },
    });
    return response.data.data;
  },

  getProviderDashboard: async (
    period: ProviderDashboardPeriod = '30d',
    options: GetProviderDashboardOptions = {},
  ): Promise<ProviderDashboardResponse> => {
    const response = await api.get('/analytics/provider/dashboard', {
      params: {
        period,
        revenue: options.revenue ?? 'net',
        ...(options.city ? { city: options.city } : {}),
      },
      timeout: 90000,
    });
    return response.data.data;
  },

  getProviderServicesAnalytics: async (
    period: string = '30d',
    limit: number = 5,
  ): Promise<ServiceAnalyticsMetrics[]> => {
    const endDate = new Date();
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const response = await api.get('/analytics/provider/services', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit,
      },
    });
    return response.data.data;
  },

  // Booking Funnel Analytics
  getBookingFunnel: async (startDate?: string, endDate?: string): Promise<FunnelMetrics> => {
    const response = await api.get('/analytics/funnel', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // Geographic Analytics
  getGeographicAnalytics: async (startDate?: string, endDate?: string): Promise<GeographicAnalytics> => {
    const response = await api.get('/analytics/geographic', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },
};

// ============================================
// Provider Travel Metrics Types
// ============================================

export interface ConversionFunnelStage {
  id: string;
  label: string;
  count: number;
  rateFromPrevious: number | null;
}

export interface ProviderConversionFunnel {
  stages: ConversionFunnelStage[];
  overallConversionRate: number;
}

export interface TravelData {
  date: string;
  totalTravelTime: number;
  avgTravelTime: number;
  totalDistance: number;
  bookings: number;
  efficiency: number;
}

export interface TravelStats {
  totalTravelTime: number;
  avgTravelTime: number;
  totalDistance: number;
  avgDistance: number;
  fuelCost: number;
  mostRemoteJob: string;
  leastEfficient: string;
  potentialSavings: number;
  efficiency: number;
}

export interface JobsByArea {
  area: string;
  jobs: number;
  avgTravel: number;
  avgDistance: number;
}

export interface ProviderTravelMetrics {
  travelData: TravelData[];
  stats: TravelStats;
  jobsByArea: JobsByArea[];
}

// ============================================
// Service Profitability Types
// ============================================

export interface ServiceData {
  serviceId: string;
  serviceName: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  bookings: number;
  avgPrice: number;
  trend: number;
  category: string;
}

export interface ProfitabilityStats {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  averageMargin: number;
  topPerformer: string;
  worstPerformer: string;
  potentialSavings: number;
}

export interface ServiceProfitabilityData {
  services: ServiceData[];
  stats: ProfitabilityStats;
}

// ============================================
// Competitive Position Types
// ============================================

export interface RankingData {
  metric: string;
  yourRank: number;
  totalProviders: number;
  percentile: number;
  change: number;
}

export interface ComparisonData {
  category: string;
  you: number;
  average: number;
  top10: number;
  top1: number;
}

export interface RadarData {
  metric: string;
  value: number;
  max: number;
}

export interface SuggestionData {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potential: number;
}

export interface PositionStats {
  overallRank: number;
  totalProviders: number;
  percentile: number;
  trend: number;
  marketShare: number;
  rating: number;
  reviews: number;
}

export interface CompetitivePositionData {
  rankingData: RankingData[];
  comparisonData: ComparisonData[];
  radarData: RadarData[];
  suggestions: SuggestionData[];
  stats: PositionStats;
}

/** Backend GET /analytics/provider/competitive-position payload */
interface CompetitivePositionApiPayload {
  providerId?: string;
  overallRank?: number;
  totalProviders?: number;
  percentile?: number;
  metrics?: Array<{
    metric: string;
    rank: number;
    percentile: number;
    change?: number;
  }>;
  comparison?: {
    rating?: number;
    avgRating?: number;
    top10Rating?: number;
    responseTime?: number;
    avgResponseTime?: number;
    completionRate?: number;
    avgCompletionRate?: number;
  };
  suggestions?: SuggestionData[];
  reviews?: number;
  marketShare?: number;
  trend?: number;
}

/** Backend GET /analytics/provider/profitability payload */
interface ServiceProfitabilityApiPayload {
  services?: Array<{
    serviceId: string;
    serviceName: string;
    categoryName?: string;
    totalRevenue?: number;
    totalBookings?: number;
    avgRevenue?: number;
  }>;
  totalRevenue?: number;
  totalBookings?: number;
  topPerformingService?: string;
  lowestPerformingService?: string;
}

const ESTIMATED_COST_RATIO = 0.3;

function mapCompetitivePositionResponse(
  raw: CompetitivePositionApiPayload | CompetitivePositionData | null | undefined
): CompetitivePositionData {
  if (!raw) {
    return {
      rankingData: [],
      comparisonData: [],
      radarData: [],
      suggestions: [],
      stats: {
        overallRank: 0,
        totalProviders: 0,
        percentile: 0,
        trend: 0,
        marketShare: 0,
        rating: 0,
        reviews: 0,
      },
    };
  }

  // Check if it's already transformed data (has rankingData)
  if ('rankingData' in raw) {
    return raw as CompetitivePositionData;
  }

  // It's the API payload form - cast to access its properties
  const apiPayload = raw as CompetitivePositionApiPayload;

  const totalProviders = apiPayload.totalProviders ?? 0;
  const comparison = apiPayload.comparison ?? {};
  const rating = comparison.rating ?? 0;
  const avgRating = comparison.avgRating ?? 0;
  const top10Rating = comparison.top10Rating ?? 5;
  const completionRate = comparison.completionRate ?? 0;
  const avgCompletionRate = comparison.avgCompletionRate ?? 0;
  const volumePercentile =
    apiPayload.metrics?.find((m) => m.metric === 'Volume')?.percentile ?? apiPayload.percentile ?? 0;

  const rankingData: RankingData[] = (apiPayload.metrics ?? []).map((m) => ({
    metric: m.metric,
    yourRank: m.rank,
    totalProviders,
    percentile: m.percentile,
    change: m.change ?? 0,
  }));

  const comparisonData: ComparisonData[] = [
    {
      category: 'Rating',
      you: rating,
      average: avgRating,
      top10: top10Rating,
      top1: 5,
    },
    {
      category: 'Completion %',
      you: completionRate,
      average: avgCompletionRate,
      top10: 100,
      top1: 100,
    },
  ];

  const radarData: RadarData[] = [
    { metric: 'Rating', value: Math.min(100, Math.round((rating / 5) * 100)), max: 100 },
    { metric: 'Volume', value: Math.min(100, volumePercentile), max: 100 },
    { metric: 'Completion', value: Math.min(100, completionRate), max: 100 },
    {
      metric: 'Response',
      value: comparison.avgResponseTime
        ? Math.min(100, Math.round(100 - comparison.avgResponseTime))
        : 50,
      max: 100,
    },
    { metric: 'Quality', value: Math.min(100, Math.round((rating / 5) * 100)), max: 100 },
  ];

  return {
    rankingData,
    comparisonData,
    radarData,
    suggestions: apiPayload.suggestions ?? [],
    stats: {
      overallRank: apiPayload.overallRank ?? 0,
      totalProviders,
      percentile: apiPayload.percentile ?? 0,
      trend: apiPayload.trend ?? 0,
      marketShare: apiPayload.marketShare ?? 0,
      rating,
      reviews: apiPayload.reviews ?? 0,
    },
  };
}

function mapServiceProfitabilityResponse(
  raw: ServiceProfitabilityApiPayload | ServiceProfitabilityData | null | undefined
): ServiceProfitabilityData {
  if (!raw) {
    return { services: [], stats: emptyProfitabilityStats() };
  }

  // Check if it's already transformed data (has stats with profit info)
  if ('stats' in raw && raw.stats && 'revenue' in (raw.stats as object)) {
    return raw as ServiceProfitabilityData;
  }

  // It's the API payload form - cast to access its properties
  const apiPayload = raw as ServiceProfitabilityApiPayload;

  const services: ServiceData[] = (apiPayload.services ?? []).map((s) => {
    const revenue = s.totalRevenue ?? 0;
    const costs = Math.round(revenue * ESTIMATED_COST_RATIO);
    const profit = revenue - costs;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      revenue,
      costs,
      profit,
      margin,
      bookings: s.totalBookings ?? 0,
      avgPrice: s.avgRevenue ?? 0,
      trend: 0,
      category: s.categoryName ?? 'Unknown',
    };
  });

  const totalRevenue = apiPayload.totalRevenue ?? services.reduce((sum, s) => sum + s.revenue, 0);
  const totalCosts = services.reduce((sum, s) => sum + s.costs, 0);
  const totalProfit = totalRevenue - totalCosts;
  const averageMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  return {
    services,
    stats: {
      totalRevenue,
      totalCosts,
      totalProfit,
      averageMargin,
      topPerformer: apiPayload.topPerformingService ?? services[0]?.serviceName ?? 'N/A',
      worstPerformer:
        apiPayload.lowestPerformingService ?? services[services.length - 1]?.serviceName ?? 'N/A',
      potentialSavings: 0,
    },
  };
}

function emptyProfitabilityStats(): ProfitabilityStats {
  return {
    totalRevenue: 0,
    totalCosts: 0,
    totalProfit: 0,
    averageMargin: 0,
    topPerformer: 'N/A',
    worstPerformer: 'N/A',
    potentialSavings: 0,
  };
}

// ============================================
// ROAS Types
// ============================================

export interface ROASData {
  date: string;
  adSpend: number;
  revenue: number;
  bookings: number;
  roas: number;
  cpc: number;
  impressions: number;
  clicks: number;
}

export interface ROASStats {
  totalAdSpend: number;
  totalRevenue: number;
  overallROAS: number;
  averageROAS: number;
  totalBookings: number;
  costPerBooking: number;
  bestCampaign: string;
  worstCampaign: string;
  targetROAS: number;
}

export interface CampaignData {
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  status: 'active' | 'paused';
}

export interface ROASMetricsData {
  roasData: ROASData[];
  stats: ROASStats;
  campaigns: CampaignData[];
}

export interface PeakHoursMetricsData {
  providerId: string;
  hourlyData: Array<{
    hour: number;
    revenue: number;
    bookings: number;
    avgDuration: number;
    demand: 'low' | 'medium' | 'high' | 'peak';
  }>;
  peakHour: number;
  slowHour: number;
  totalRevenue: number;
  totalBookings: number;
  avgBookingValue: number;
  potentialRevenue: number;
}

export interface RepeatCustomerTrendPoint {
  month: string;
  newCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}

export interface RepeatCustomerMetricsData {
  providerId: string;
  repeatRate: number;
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  avgTimeToRepeat?: number;
  trend?: number;
  trendData?: RepeatCustomerTrendPoint[];
  monthlyTrend?: RepeatCustomerTrendPoint[];
  cohortData: Array<{
    cohort: string;
    month1: number;
    month2: number;
    month3: number;
    month6: number;
  }>;
  retentionFactors?: Array<{
    factor: string;
    impact: number;
  }>;
}

export interface ProviderResponseTimeMetrics {
  providerId: string;
  period: string;
  avgResponseTimeMinutes: number;
  medianResponseTimeMinutes: number;
  p95ResponseTimeMinutes: number;
  sampleSize: number;
  targetMinutes: number;
  compliant: boolean;
  profileAvgResponseTimeMinutes: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface ProviderCustomerLtv {
  providerId: string;
  period: string;
  totalCustomers: number;
  avgRevenuePerCustomer: number;
  totalLTV: number;
  avgBookingsPerCustomer: number;
  topCustomers: Array<{
    customerId: string;
    totalSpent: number;
    bookingCount: number;
  }>;
}

export interface ProviderGeographicDemand {
  providerId: string;
  period: string;
  locations: Array<{
    city: string;
    emirate: string;
    bookings: number;
    revenue: number;
    avgBookingValue: number;
    share: number;
  }>;
  totalBookings: number;
  totalRevenue: number;
}

export interface ProviderRevenueForecast {
  providerId: string;
  period: string;
  historicalDaily: Array<{ date: string; revenue: number }>;
  forecast7d: Array<{
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
  }>;
  forecast30d: Array<{
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
  }>;
  projectedRevenue7d: number;
  projectedRevenue30d: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export type BookingAttributionSource =
  | 'organic'
  | 'search'
  | 'profile'
  | 'ad'
  | 'direct'
  | 'repeat';

export interface ProviderBookingSourceAttribution {
  providerId: string;
  period: string;
  startDate: string;
  endDate: string;
  totalBookings: number;
  totalCompletedBookings: number;
  totalRevenue: number;
  bySource: Array<{
    source: BookingAttributionSource;
    bookings: number;
    completedBookings: number;
    revenue: number;
  }>;
}

export interface ProviderAnomalyAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metric?: string;
  detectedAt: string;
}

export interface ServiceAnalyticsMetrics {
  serviceId: string;
  serviceName: string;
  category: string;
  totalBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  completedBookings: number;
  cancelledBookings: number;
  completionRate: number;
  cancellationRate: number;
  views: number;
  clicks: number;
  conversionRate: number;
  popularityScore: number;
}

// ============================================
// Funnel Analytics Types
// ============================================

export interface FunnelMetrics {
  views: number;
  search: number;
  service_view: number;
  booking_request: number;
  booking_confirmed: number;
  booking_completed: number;
  conversionRates: {
    viewToSearch: number;
    searchToServiceView: number;
    serviceViewToRequest: number;
    requestToConfirmed: number;
    confirmedToCompleted: number;
    overall: number;
  };
  dropoffPoints: Array<{
    stage: string;
    dropoffCount: number;
    dropoffRate: number;
  }>;
  dailyFunnel: Array<{
    date: string;
    views: number;
    search: number;
    service_view: number;
    booking_request: number;
    booking_confirmed: number;
    booking_completed: number;
  }>;
}

export interface GeographicAnalytics {
  byCity: Array<{
    city: string;
    bookings: number;
    revenue: number;
    customers: number;
    averageBookingValue: number;
    percentage: number;
  }>;
  byRegion: Array<{
    region: string;
    bookings: number;
    revenue: number;
    customers: number;
    averageBookingValue: number;
    percentage: number;
  }>;
  heatmapData: Array<{
    coordinates: {
      lat: number;
      lng: number;
    };
    intensity: number;
    bookings: number;
    revenue: number;
  }>;
  summary: {
    totalBookings: number;
    totalRevenue: number;
    totalCustomers: number;
    topCity: string;
    topRegion: string;
  };
}

// ============================================
// Business Intelligence API Service
// ============================================

export const businessIntelligenceApi = {
  // Customer LTV
  getCustomerLTV: async (
    startDate?: string,
    endDate?: string,
    limit: number = 100
  ): Promise<CustomerLTV[]> => {
    const response = await api.get('/bi/ltv', {
      params: { startDate, endDate, limit },
    });
    return response.data.data;
  },

  // Customer Acquisition Cost
  getCAC: async (
    startDate: string,
    endDate: string
  ): Promise<CACMetrics> => {
    const response = await api.get('/bi/cac', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // Retention Metrics
  getRetentionMetrics: async (
    startDate: string,
    endDate: string
  ): Promise<RetentionMetrics> => {
    const response = await api.get('/bi/retention', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // RFM Analysis
  getRFMAnalysis: async (limit: number = 1000): Promise<RFMAnalysis[]> => {
    const response = await api.get('/bi/rfm', {
      params: { limit },
    });
    return response.data.data;
  },

  // Revenue Breakdown
  getRevenueBreakdown: async (
    startDate: string,
    endDate: string
  ): Promise<RevenueBreakdown[]> => {
    const response = await api.get('/bi/revenue', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  // Business Health Score
  getBusinessHealthScore: async (): Promise<BusinessHealthScore> => {
    const response = await api.get('/bi/health');
    return response.data.data;
  },
};

// ============================================
// Executive Dashboard API Service
// ============================================

export const executiveDashboardApi = {
  // Get Full Dashboard
  getExecutiveDashboard: async (): Promise<ExecutiveDashboardData> => {
    // Fetch all data in parallel since executive endpoint doesn't exist yet
    const [overview, revenue, bookings, customers, providers, services] = await Promise.all([
      analyticsApi.getOverview(),
      analyticsApi.getRevenueAnalytics(),
      analyticsApi.getBookingAnalytics(),
      analyticsApi.getCustomerAnalytics(),
      analyticsApi.getProviderAnalytics(),
      analyticsApi.getServiceAnalytics(),
    ]);

    // Construct executive dashboard data from available endpoints
    return {
      kpis: {
        timestamp: new Date().toISOString(),
        revenue: {
          total: revenue.totalRevenue,
          thisMonth: revenue.revenueThisMonth,
          lastMonth: revenue.revenueLastMonth,
          monthOverMonthGrowth: revenue.monthOverMonthGrowth,
          yearToDate: revenue.totalRevenue,
          projectedAnnual: revenue.projectedMonthlyRevenue,
        },
        bookings: {
          total: bookings.totalBookings,
          thisMonth: bookings.totalBookings,
          completed: bookings.completedBookings,
          cancelled: bookings.cancelledBookings,
          completionRate: bookings.completionRate,
        },
        customers: {
          total: customers.totalCustomers,
          active: customers.activeCustomers,
          newThisMonth: customers.newCustomersThisMonth,
          retentionRate: 0,
          ltv: 0,
        },
        providers: {
          total: providers.totalProviders,
          active: providers.activeProviders,
          pendingVerification: providers.providersByStatus?.pending || 0,
          averageRating: 0,
        },
        platform: {
          grossMargin: 0,
          netMargin: 0,
          takeRate: 0.1,
          averageOrderValue: revenue.averageOrderValue,
        },
      },
      growth: {
        period: 'month',
        revenue: { current: revenue.revenueThisMonth, previous: revenue.revenueLastMonth, growth: revenue.monthOverMonthGrowth, trend: revenue.monthOverMonthGrowth > 0 ? 'up' : revenue.monthOverMonthGrowth < 0 ? 'down' : 'stable' },
        bookings: { current: bookings.totalBookings, previous: 0, growth: 0, trend: 'stable' as const },
        customers: { current: customers.newCustomersThisMonth, previous: 0, growth: 0, trend: 'stable' as const },
        providers: { current: providers.newProvidersThisMonth, previous: 0, growth: 0, trend: 'stable' as const },
      },
      revenue: {
        summary: {
          totalRevenue: revenue.totalRevenue,
          grossRevenue: revenue.totalRevenue,
          netRevenue: revenue.totalRevenue,
          platformFees: 0,
          paymentProcessingFees: 0,
          commissions: revenue.totalRevenue * 0.1,
          taxes: 0,
          providerPayouts: revenue.totalRevenue * 0.9,
        },
        breakdown: { byService: [], byCategory: revenue.revenueByCategory.map((c: any) => ({ categoryId: c.category, categoryName: c.category, revenue: c.revenue, percentage: c.percentage, bookings: 0 })), byProvider: [] },
        trends: { daily: revenue.revenueByDay, weekly: [], monthly: [] },
      },
      operations: {
        averageBookingValue: revenue.averageOrderValue,
        averageServiceDuration: 0,
        bookingLeadTime: 0,
        providerUtilization: 0,
        customerSatisfaction: { averageRating: 0, responseRate: 0, reviewRate: 0 },
        serviceHealth: { activeServices: services.activeServices, pendingServices: 0, topPerformers: [], underperformers: [] },
      },
      alerts: [],
      opportunities: [],
    };
  },

  // Get KPIs
  getKPIs: async (): Promise<ExecutiveKPIs> => {
    const data = await executiveDashboardApi.getExecutiveDashboard();
    return data.kpis;
  },

  // Get Growth Metrics
  getGrowthMetrics: async (): Promise<GrowthMetrics> => {
    const data = await executiveDashboardApi.getExecutiveDashboard();
    return data.growth;
  },

  // Get Revenue Dashboard
  getRevenueDashboard: async (): Promise<RevenueDashboard> => {
    const data = await executiveDashboardApi.getExecutiveDashboard();
    return data.revenue;
  },

  // Get Operational Metrics
  getOperationalMetrics: async (): Promise<OperationalMetrics> => {
    const data = await executiveDashboardApi.getExecutiveDashboard();
    return data.operations;
  },

  // Get Alerts
  getAlerts: async (): Promise<ExecutiveAlert[]> => {
    const data = await executiveDashboardApi.getExecutiveDashboard();
    return data.alerts;
  },

  // Get Market Opportunities
  getMarketOpportunities: async (): Promise<MarketOpportunity[]> => {
    const data = await executiveDashboardApi.getExecutiveDashboard();
    return data.opportunities;
  },
};

// ============================================
// Churn Prediction API Service
// ============================================

export const churnApi = {
  // Get churn prediction for a specific user
  getChurnRisk: async (userId: string): Promise<ChurnRisk> => {
    const response = await api.get(`/churn/predict/${userId}`);
    return response.data.data;
  },

  // Get all at-risk customers
  getAtRiskCustomers: async (options: {
    minRiskLevel?: 'medium' | 'high' | 'critical';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ customers: ChurnRisk[]; total: number }> => {
    const response = await api.get('/churn/at-risk', { params: options });
    return response.data.data;
  },

  // Get customer segments
  getCustomerSegments: async (): Promise<CustomerSegment[]> => {
    const response = await api.get('/admin/churn/segments');
    return response.data.data;
  },

  // Get churn statistics
  getChurnStats: async (): Promise<ChurnStats> => {
    const response = await api.get('/churn/stats');
    return response.data.data;
  },

  // Get churn overview for dashboard
  getChurnOverview: async (): Promise<ChurnOverview> => {
    const response = await api.get('/churn/overview');
    return response.data.data;
  },

  // Execute retention action for a user
  executeRetentionAction: async (userId: string, action: RetentionAction): Promise<{ success: boolean; message: string; actionTaken: string }> => {
    const response = await api.post(`/admin/churn/execute/${userId}`, { action });
    return response.data.data;
  },

  // Get churn statistics (admin endpoint)
  getChurnStatsAdmin: async (startDate?: string, endDate?: string): Promise<ChurnStatsAdmin> => {
    const response = await api.get('/admin/churn/stats', { params: { startDate, endDate } });
    return response.data.data;
  },

  // Get at-risk customers (admin endpoint)
  getAtRiskCustomersAdmin: async (options: {
    minRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
    minDaysInactive?: number;
    maxDaysInactive?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ customers: AtRiskCustomer[]; total: number }> => {
    const response = await api.get('/admin/churn/at-risk', { params: options });
    return response.data.data;
  },

  // Get churn risk for specific customer (admin endpoint)
  getChurnRiskAdmin: async (customerId: string): Promise<ChurnRiskAdmin> => {
    const response = await api.get(`/churn/admin/churn/customers/${customerId}/risk`);
    return response.data.data;
  },

  // Get churn overview for dashboard (admin endpoint)
  getChurnOverviewAdmin: async (): Promise<ChurnOverviewAdmin> => {
    const response = await api.get('/admin/churn/overview');
    return response.data.data;
  },

  // Refresh churn cache
  refreshChurnCache: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/admin/churn/refresh');
    return response.data;
  },
};

// ============================================
// Admin Churn Types
// ============================================

export interface ChurnStatsAdmin {
  totalCustomers: number;
  activeCustomers: number;
  atRiskCustomers: number;
  churnRate: number;
  byRiskLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageRiskScore: number;
  totalLifetimeValueAtRisk: number;
  churnTrend: Array<{
    date: string;
    churnRate: number;
    atRiskCount: number;
  }>;
  topRiskFactors: Array<{
    factor: string;
    count: number;
    percentage: number;
  }>;
}

export interface AtRiskCustomer {
  customerId: string;
  customerName: string;
  email: string;
  phone?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  daysSinceLastBooking: number;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate?: string;
  predictedChurnDate?: string;
  recommendedActions: string[];
}

export interface ChurnRiskAdmin {
  userId: string;
  userName: string;
  email: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  lastBookingDate?: string;
  daysSinceLastBooking: number;
  totalBookings: number;
  lifetimeValue: number;
  recommendedAction: string;
}

export interface ChurnOverviewAdmin {
  totalAtRisk: number;
  churnRate: number;
  byRiskLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageRiskScore: number;
  totalLifetimeValueAtRisk: number;
  topRiskFactors: Array<{
    factor: string;
    count: number;
    percentage: number;
  }>;
  recentAlerts: Array<{
    customerId: string;
    customerName: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    daysSinceLastBooking: number;
    recommendedAction: string;
  }>;
}

// ============================================
// Scheduled Reports API Service
// ============================================

export interface ScheduledReportConfig {
  name: string;
  type: 'churn' | 'revenue' | 'booking' | 'customer' | 'provider' | 'performance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'json' | 'csv' | 'pdf';
  recipients: string[];
  filters?: {
    startDate?: string;
    endDate?: string;
    categories?: string[];
    providers?: string[];
    regions?: string[];
  };
  enabled: boolean;
}

export interface ScheduledReport {
  _id: string;
  name: string;
  type: 'churn' | 'revenue' | 'booking' | 'customer' | 'provider' | 'performance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'json' | 'csv' | 'pdf';
  recipients: string[];
  filters?: {
    startDate?: string;
    endDate?: string;
    categories?: string[];
    providers?: string[];
    regions?: string[];
  };
  enabled: boolean;
  lastRunDate?: string;
  lastRunStatus?: 'success' | 'failed';
  lastRunError?: string;
  nextRunDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const reportsApi = {
  // Create scheduled report
  createReport: async (config: ScheduledReportConfig): Promise<ScheduledReport> => {
    const response = await api.post('/admin/reports', config);
    return response.data.data;
  },

  // List scheduled reports
  listReports: async (options: {
    enabled?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    reports: ScheduledReport[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const response = await api.get('/admin/reports', { params: options });
    return response.data.data;
  },

  // Get single report
  getReport: async (reportId: string): Promise<ScheduledReport> => {
    const response = await api.get(`/admin/reports/${reportId}`);
    return response.data.data;
  },

  // Update scheduled report
  updateReport: async (reportId: string, updates: Partial<ScheduledReportConfig>): Promise<ScheduledReport> => {
    const response = await api.patch(`/admin/reports/${reportId}`, updates);
    return response.data.data;
  },

  // Delete scheduled report
  deleteReport: async (reportId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/admin/reports/${reportId}`);
    return response.data;
  },

  // Toggle report enabled status
  toggleReport: async (reportId: string, enabled: boolean): Promise<ScheduledReport> => {
    const response = await api.post(`/admin/reports/${reportId}/toggle`, { enabled });
    return response.data.data;
  },

  // Trigger report generation
  triggerReport: async (reportId: string): Promise<{
    success: boolean;
    reportId: string;
    data?: any;
    error?: string;
  }> => {
    const response = await api.post(`/admin/reports/${reportId}/trigger`);
    return response.data;
  },

  // Get due reports
  getDueReports: async (): Promise<{
    count: number;
    reports: ScheduledReport[];
  }> => {
    const response = await api.get('/admin/reports/due');
    return response.data.data;
  },

  // Run all due reports
  runDueReports: async (): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: Array<{ reportId: string; success: boolean; error?: string }>;
  }> => {
    const response = await api.post('/admin/reports/run-due');
    return response.data.data;
  },
};

// ============================================
// Fraud Detection API Service
// ============================================

export const fraudApi = {
  // Analyze a provider for fraud indicators
  analyzeProvider: async (providerId: string): Promise<FraudReport> => {
    const response = await api.get(`/fraud/analyze/${providerId}`);
    return response.data.data;
  },

  // Get fraud statistics
  getFraudStats: async (): Promise<FraudStats> => {
    const response = await api.get('/fraud/stats');
    return response.data.data;
  },

  // Get fraud overview for dashboard
  getFraudOverview: async (): Promise<FraudOverview> => {
    const response = await api.get('/fraud/overview');
    return response.data.data;
  },

  // Flag suspicious activity
  flagSuspiciousActivity: async (providerId: string, activity: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence?: Record<string, any>;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/fraud/flag/${providerId}`, activity);
    return response.data;
  },

  // Resolve a fraud flag
  resolveFraudFlag: async (providerId: string, flagId: string, resolution: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/fraud/resolve/${providerId}/${flagId}`, { resolution });
    return response.data;
  },

  // Batch analyze multiple providers
  batchAnalyzeProviders: async (providerIds: string[]): Promise<{
    reports: FraudReport[];
    totalAnalyzed: number;
    highRiskCount: number;
  }> => {
    const response = await api.post('/fraud/batch-analyze', { providerIds });
    return response.data.data;
  },

  // Generate fraud report
  generateFraudReport: async (providerId: string): Promise<FraudReport> => {
    const response = await api.get(`/fraud/report/${providerId}`);
    return response.data.data;
  },

  // Get fraud patterns
  getFraudPatterns: async (): Promise<Array<{ id: string; name: string; severity: string }>> => {
    const response = await api.get('/fraud/patterns');
    return response.data.data;
  },
};

// ============================================
// SLA API Service
// ============================================

export const slaApi = {
  // Get SLA metrics
  getSLAMetrics: async (startDate?: string, endDate?: string): Promise<SLAMetrics> => {
    const response = await api.get('/sla/metrics', { params: { startDate, endDate } });
    return response.data.data;
  },

  // Get comprehensive SLA report
  getSLAReport: async (startDate?: string, endDate?: string): Promise<SLAReport> => {
    const response = await api.get('/sla/report', { params: { startDate, endDate } });
    return response.data.data;
  },

  // Get SLA overview for dashboard
  getSLAOverview: async (): Promise<SLAOverview> => {
    const response = await api.get('/sla/overview');
    return response.data.data;
  },

  // Get current SLA thresholds
  getSLAThresholds: async (): Promise<SLAThresholds> => {
    const response = await api.get('/sla/thresholds');
    return response.data.data;
  },

  // Update SLA thresholds
  updateSLAThresholds: async (thresholds: Partial<SLAThresholds>): Promise<{ success: boolean; data: SLAThresholds }> => {
    const response = await api.put('/sla/thresholds', thresholds);
    return response.data;
  },

  // Get SLA breaches
  getSLABreaches: async (options: {
    startDate?: string;
    endDate?: string;
    severity?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ breaches: any[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/sla/breaches', { params: options });
    return response.data.data;
  },

  // Get SLA trends
  getSLATrends: async (startDate?: string, endDate?: string): Promise<{ trends: SLATrend[]; summary: any }> => {
    const response = await api.get('/sla/trends', { params: { startDate, endDate } });
    return response.data.data;
  },

  // Get SLA compliance by provider
  getSLAByProvider: async (startDate?: string, endDate?: string, minCompliance?: number): Promise<SLAComplianceByProvider[]> => {
    const response = await api.get('/sla/providers', { params: { startDate, endDate, minCompliance } });
    return response.data.data;
  },

  // Get SLA compliance by category
  getSLAByCategory: async (startDate?: string, endDate?: string, minCompliance?: number): Promise<SLAComplianceByCategory[]> => {
    const response = await api.get('/sla/categories', { params: { startDate, endDate, minCompliance } });
    return response.data.data;
  },
};

export default {
  analyticsApi,
  businessIntelligenceApi,
  executiveDashboardApi,
  churnApi,
  fraudApi,
  slaApi,
  reportsApi,
};
