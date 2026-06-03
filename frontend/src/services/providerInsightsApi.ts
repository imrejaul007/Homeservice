import { api } from './api';

// ============================================
// TYPES & INTERFACES
// ============================================

export type Period = 'week' | 'month' | 'quarter' | 'year';
export type InsightType = 'performance' | 'revenue' | 'scheduling' | 'customer';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ProviderInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  impact: ImpactLevel;
  actionItems: string[];
  generatedAt: string;
  data?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  pendingBookings: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  averageRating: number;
  totalReviews: number;
  responseRate: number;
  averageResponseTime: number;
  repeatCustomerRate: number;
  period: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  averageBookingValue: number;
  revenueGrowth: number;
  revenueByDay: Array<{ date: string; amount: number; count: number }>;
  revenueByService: Array<{ serviceId: string; serviceName: string; revenue: number; count: number }>;
  peakRevenueHour: number;
  projectedMonthlyRevenue: number;
  period: string;
}

export interface CustomerSatisfactionMetrics {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recentTrend: Array<{ period: string; averageRating: number; count: number }>;
  positiveReviewPercentage: number;
  negativeReviewPercentage: number;
  commonPraise: string[];
  commonComplaints: string[];
  period: string;
}

export interface BookingTrend {
  period: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
  averageValue: number;
}

export interface ProviderInsightsData {
  providerId: string;
  period: string;
  performance: PerformanceMetrics;
  revenue: RevenueMetrics;
  customerSatisfaction: CustomerSatisfactionMetrics;
  trends: BookingTrend[];
  insights: ProviderInsight[];
  generatedAt: string;
}

export interface RevenueOptimizationTip {
  category: 'pricing' | 'volume' | 'efficiency' | 'retention';
  title: string;
  description: string;
  potentialImpact: number;
  difficulty: 'easy' | 'medium' | 'hard';
  actionItems: string[];
}

// Schedule Optimization Types
export interface TimeSlot {
  time: string;
  demand: number;
  supply: number;
  gap: number;
  fillRate: number;
  recommendation: string;
}

export interface ScheduleOptimization {
  providerId: string;
  currentUtilization: number;
  optimalSlots: TimeSlot[];
  peakDemandHours: number[];
  offPeakHours: number[];
  suggestions: string[];
  weeklyPattern: DayPattern[];
  generatedAt: string;
}

export interface DayPattern {
  dayOfWeek: number;
  dayName: string;
  totalBookings: number;
  averageBookings: number;
  averageRevenue: number;
  isPeakDay: boolean;
  demandLevel: 'low' | 'medium' | 'high';
}

export interface AvailabilityGap {
  dayOfWeek: number;
  timeSlot: string;
  unfilledDemand: number;
  potentialRevenue: number;
  recommendation: string;
}

export interface BookingPattern {
  hourlyDistribution: Array<{
    hour: number;
    bookings: number;
    revenue: number;
    averageValue: number;
  }>;
  dailyDistribution: Array<{
    dayOfWeek: number;
    bookings: number;
    revenue: number;
  }>;
  weeklyTrend: number;
  monthlyTrend: number;
}

export interface ScheduleEfficiencyScore {
  overallScore: number;
  components: {
    utilization: number;
    peakCoverage: number;
    offPeakFillRate: number;
    bufferAdequacy: number;
  };
  recommendations: string[];
}

// Cancellation Prediction Types
export interface CancellationFactor {
  type: string;
  weight: number;
  description: string;
  riskContribution: number;
}

export interface CancellationRisk {
  bookingId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: CancellationFactor[];
  probability: number;
  recommendedActions: string[];
  predictedAt: string;
}

export interface BookingCancellationPrediction {
  bookingId: string;
  customerId?: string;
  customerName: string;
  scheduledDate: string;
  scheduledTime: string;
  serviceName: string;
  totalAmount: number;
  riskAssessment: CancellationRisk;
}

export interface CustomerCancellationProfile {
  customerId: string;
  customerName: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  averageBookingValue: number;
  repeatCustomer: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  factors: Array<{
    type: string;
    value: unknown;
    riskImpact: number;
  }>;
  lastBookingDate?: string;
  lastCancellationDate?: string;
  accountAge: number;
}

export interface ProviderCancellationStats {
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  customerInitiatedCancellations: number;
  providerInitiatedCancellations: number;
  systemCancellations: number;
  averageCancellationTime: number;
  commonReasons: Array<{ reason: string; count: number; percentage: number }>;
  highRiskBookings: BookingCancellationPrediction[];
  trend: 'improving' | 'stable' | 'worsening';
  period: string;
}

export interface NoShowRisk {
  bookingId: string;
  customerName: string;
  scheduledDate: string;
  scheduledTime: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: string[];
}

export interface PreventionRecommendation {
  type: 'reminder' | 'confirmation' | 'deposit' | 'follow_up';
  priority: 'high' | 'medium' | 'low';
  targetBookings: string[];
  message: string;
  estimatedImpact: number;
}

export interface ScheduleConflict {
  hasConflicts: boolean;
  conflicts: Array<{
    type: 'overlap' | 'too_short' | 'too_long';
    bookingId: string;
    message: string;
  }>;
  suggestions: string[];
}

// ============================================
// API FUNCTIONS
// ============================================

class ProviderInsightsApiService {
  private baseUrl = '/provider';

  // ============================================
  // PROVIDER INSIGHTS
  // ============================================

  async getInsights(period: Period = 'month'): Promise<ProviderInsightsData> {
    const response = await api.get(`${this.baseUrl}/insights`, {
      params: { period },
    });
    // FIX: Backend returns ProviderInsightsData directly in response.data.data
    return response.data.data;
  }

  async getPerformance(period: Period = 'month'): Promise<PerformanceMetrics> {
    const response = await api.get(`${this.baseUrl}/insights/performance`, {
      params: { period },
    });
    return response.data.data.metrics;
  }

  async getRevenue(period: Period = 'month'): Promise<RevenueMetrics> {
    const response = await api.get(`${this.baseUrl}/insights/revenue`, {
      params: { period },
    });
    return response.data.data.metrics;
  }

  async getSatisfaction(period: Period = 'month'): Promise<CustomerSatisfactionMetrics> {
    const response = await api.get(`${this.baseUrl}/insights/satisfaction`, {
      params: { period },
    });
    return response.data.data.metrics;
  }

  async getTrends(period: Period = 'month'): Promise<BookingTrend[]> {
    const response = await api.get(`${this.baseUrl}/insights/trends`, {
      params: { period },
    });
    return response.data.data.trends;
  }

  async generateInsights(period: Period = 'month'): Promise<ProviderInsight[]> {
    const response = await api.get(`${this.baseUrl}/insights/generate`, {
      params: { period },
    });
    return response.data.data.insights;
  }

  async getOptimizationTips(): Promise<RevenueOptimizationTip[]> {
    const response = await api.get(`${this.baseUrl}/insights/optimization-tips`);
    return response.data.data.tips;
  }

  // ============================================
  // SCHEDULE OPTIMIZATION
  // ============================================

  async getOptimalSchedule(): Promise<ScheduleOptimization> {
    const response = await api.get(`${this.baseUrl}/schedule/optimal`);
    return response.data.data.optimization;
  }

  async getSchedulePatterns(days: number = 30): Promise<BookingPattern> {
    const response = await api.get(`${this.baseUrl}/schedule/patterns`, {
      params: { days },
    });
    return response.data.data.patterns;
  }

  async getAvailabilityGaps(): Promise<AvailabilityGap[]> {
    const response = await api.get(`${this.baseUrl}/schedule/gaps`);
    return response.data.data.gaps;
  }

  async getPeakDemandAnalysis(): Promise<{
    peakHours: Array<{ hour: number; demand: number; revenue: number }>;
    optimalBookingWindow: { start: number; end: number };
    recommendations: string[];
  }> {
    const response = await api.get(`${this.baseUrl}/schedule/peak-demand`);
    return response.data.data.analysis;
  }

  async getScheduleConflicts(date: string): Promise<ScheduleConflict> {
    const response = await api.get(`${this.baseUrl}/schedule/conflicts`, {
      params: { date },
    });
    return response.data.data.conflicts;
  }

  async getScheduleEfficiency(): Promise<ScheduleEfficiencyScore> {
    const response = await api.get(`${this.baseUrl}/schedule/efficiency`);
    return response.data.data.score;
  }

  // ============================================
  // CANCELLATION PREDICTION
  // ============================================

  async getCancellationProfile(customerId: string): Promise<CustomerCancellationProfile> {
    const response = await api.get(
      `${this.baseUrl}/cancellations/customer/${customerId}`
    );
    return response.data.data.profile;
  }

  async predictCancellation(bookingId: string): Promise<CancellationRisk> {
    const response = await api.get(
      `${this.baseUrl}/cancellations/predict/${bookingId}`
    );
    return response.data.data.prediction;
  }

  async getCancellationStats(period: Period = 'month'): Promise<ProviderCancellationStats> {
    const response = await api.get(`${this.baseUrl}/cancellations/stats`, {
      params: { period },
    });
    return response.data.data.stats;
  }

  async getUpcomingCancellations(days: number = 7): Promise<BookingCancellationPrediction[]> {
    const response = await api.get(`${this.baseUrl}/cancellations/upcoming`, {
      params: { days },
    });
    return response.data.data.predictions;
  }

  async getNoShows(date?: string): Promise<NoShowRisk[]> {
    const response = await api.get(`${this.baseUrl}/cancellations/no-shows`, {
      params: { date: date || new Date().toISOString().split('T')[0] },
    });
    return response.data.data.noShows;
  }

  async getPreventionRecommendations(): Promise<PreventionRecommendation[]> {
    const response = await api.get(`${this.baseUrl}/cancellations/prevention`);
    return response.data.data.recommendations;
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  async clearCache(): Promise<void> {
    await api.post(`${this.baseUrl}/insights/cache/clear`);
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  formatCurrency(amount: number, currency: string = 'AED'): string {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  formatHour(hour: number): string {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${suffix}`;
  }

  getRiskLevelColor(level: RiskLevel): string {
    switch (level) {
      case 'critical':
        return 'text-red-700 bg-red-100';
      case 'high':
        return 'text-orange-700 bg-orange-100';
      case 'medium':
        return 'text-yellow-700 bg-yellow-100';
      case 'low':
        return 'text-green-700 bg-green-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  }

  getImpactColor(impact: ImpactLevel): string {
    switch (impact) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  getUtilizationColor(utilization: number): string {
    if (utilization >= 80) return 'text-green-600';
    if (utilization >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  getRatingStars(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      '★'.repeat(fullStars) +
      (hasHalfStar ? '½' : '') +
      '☆'.repeat(emptyStars)
    );
  }
}

export const providerInsightsApi = new ProviderInsightsApiService();

export default providerInsightsApi;
