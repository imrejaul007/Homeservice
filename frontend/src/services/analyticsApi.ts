import { api } from './api';

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
    const response = await api.get('/analytics/timeseries', {
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
    const response = await api.get('/analytics/trends', {
      params: { metric, startDate, endDate },
    });
    return response.data.data;
  },

  // Cohort Analysis
  getCohortAnalysis: async (
    cohortType: 'weekly' | 'monthly' = 'monthly',
    retentionPeriods: number = 6
  ): Promise<CohortData[]> => {
    const response = await api.get('/analytics/cohorts', {
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
    const response = await api.get('/analytics/categories', {
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
};

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
    const response = await api.get('/churn/segments');
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
    const response = await api.post(`/churn/execute/${userId}`, { action });
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
};
