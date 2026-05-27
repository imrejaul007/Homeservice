import { api } from './api';

// ============================================
// Type Definitions
// ============================================

export type CustomerTier = 'new' | 'regular' | 'trusted' | 'flagged' | 'banned';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AbuseFlagType =
  | 'high_refund_rate'
  | 'chargeback'
  | 'coupon_abuse'
  | 'fake_referral'
  | 'suspicious_activity'
  | 'spam'
  | 'fake_review'
  | 'multiple_accounts'
  | 'payment_fraud';

// ============================================
// DTO Interfaces
// ============================================

export interface AbuseFlag {
  type: AbuseFlagType;
  reason: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface CustomerMetrics {
  _id: string;
  userId: string;
  trustScore: number;
  tier: CustomerTier;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShows: number;
  cancellationRate: number;
  refundCount: number;
  refundAmount: number;
  refundRate: number;
  chargebackCount: number;
  chargebackAmount: number;
  referralCount: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  suspiciousReferrals: number;
  couponUsageCount: number;
  couponAbuseCount: number;
  flags: AbuseFlag[];
  abuseCount: number;
  lastAbuseAt?: string;
  lifetimeAbuseScore: number;
  spamReports: number;
  fakeEngagementCount: number;
  isBlocked: boolean;
  blockReason?: string;
  blockedAt?: string;
  blockedBy?: string;
  firstBookingAt?: string;
  lastBookingAt?: string;
  averageBookingValue: number;
  totalSpent: number;
  reviewsWritten: number;
  reviewsReceived: number;
  reviewManipulationScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerUserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  accountStatus: string;
  isEmailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface RecentBooking {
  id: string;
  bookingNumber: string;
  service: string;
  provider: string;
  scheduledDate: string;
  status: string;
  totalAmount: number;
}

export interface TrustScoreDeduction {
  category: string;
  reason: string;
  amount: number;
}

export interface TrustScoreBreakdown {
  baseScore: number;
  deductions: TrustScoreDeduction[];
  finalScore: number;
  tier: CustomerTier;
  riskLevel: RiskLevel;
  riskFactors: string[];
}

export interface CustomerSearchFilters {
  search?: string;
  tier?: CustomerTier | CustomerTier[];
  riskLevel?: RiskLevel;
  isBlocked?: boolean;
  minTrustScore?: number;
  maxTrustScore?: number;
  hasUnresolvedFlags?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface CustomerListItem {
  metrics: CustomerMetrics;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    accountStatus: string;
  };
}

export interface CustomerListResponse {
  customers: CustomerListItem[];
  total: number;
  page: number;
  pages: number;
  stats: {
    totalCustomers: number;
    averageTrustScore: number;
    tierDistribution: Record<CustomerTier, number>;
    riskDistribution: Record<string, number>;
  };
}

export interface CustomerDetailResponse {
  metrics: CustomerMetrics;
  user: CustomerUserInfo;
  recentBookings: RecentBooking[];
  abuseHistory: AbuseFlag[];
  recommendations: string[];
}

export interface DashboardStats {
  totalCustomers: number;
  tierDistribution: Record<CustomerTier, number>;
  riskDistribution: Record<string, number>;
  averageTrustScore: number;
  recentFlags: Array<{
    type: AbuseFlagType;
    reason: string;
    createdAt: string;
    customerId: string;
    customerName: string;
  }>;
  topRiskCustomers: Array<{
    userId: string;
    name: string;
    trustScore: number;
    riskLevel: string;
    riskFactors: string[];
  }>;
  dailyFlagTrend: Array<{ date: string; count: number }>;
}

export interface AbuseScanResult {
  refund: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    refundHistory: {
      count: number;
      totalAmount: number;
      rate: number;
      recentTrend: string;
    };
  };
  loyalty: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    referralAnalysis: {
      totalReferrals: number;
      suspiciousCount: number;
      patterns: string[];
    };
  };
  coupon: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    couponAnalysis: {
      totalUsage: number;
      uniqueCoupons: number;
      accountOverlap: number;
      velocity: number;
    };
  };
  chargeback: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    chargebackHistory: {
      count: number;
      totalAmount: number;
      isDisputed: boolean;
      merchantLoss: number;
    };
  };
  spam: {
    isAbuse: boolean;
    confidence: number;
    details: string;
  };
  overallRisk: RiskLevel;
  shouldFlag: boolean;
  recommendedActions: string[];
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// API Response Types
// ============================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// ============================================
// CustomerOpsApiService Class
// ============================================

class CustomerOpsApiService {
  /**
   * Get paginated list of customers with metrics
   */
  async getCustomerList(params: {
    filters?: CustomerSearchFilters;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<CustomerListResponse> {
    const { filters = {}, page = 1, limit = 20, sortBy = 'trustScore', sortOrder = 'asc' } = params;

    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortOrder', sortOrder);

    // Add filters to query params
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.tier) queryParams.append('tier', Array.isArray(filters.tier) ? filters.tier.join(',') : filters.tier);
    if (filters.riskLevel) queryParams.append('riskLevel', filters.riskLevel);
    if (filters.isBlocked !== undefined) queryParams.append('isBlocked', filters.isBlocked.toString());
    if (filters.minTrustScore !== undefined) queryParams.append('minTrustScore', filters.minTrustScore.toString());
    if (filters.maxTrustScore !== undefined) queryParams.append('maxTrustScore', filters.maxTrustScore.toString());
    if (filters.hasUnresolvedFlags !== undefined) queryParams.append('hasUnresolvedFlags', filters.hasUnresolvedFlags.toString());
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

    const response = await api.get(`/admin/customers?${queryParams.toString()}`);
    const result = response.data as ApiResponse<CustomerListResponse>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch customer list');
    }

    return result.data!;
  }

  /**
   * Get detailed information about a customer
   */
  async getCustomerDetail(customerId: string): Promise<CustomerDetailResponse> {
    const response = await api.get(`/admin/customers/${customerId}`);
    const result = response.data as ApiResponse<CustomerDetailResponse>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch customer details');
    }

    return result.data!;
  }

  /**
   * Get trust score breakdown for a customer
   */
  async getTrustScoreBreakdown(customerId: string): Promise<TrustScoreBreakdown> {
    const response = await api.get(`/admin/customers/${customerId}/trust-score`);
    const result = response.data as ApiResponse<TrustScoreBreakdown>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch trust score breakdown');
    }

    return result.data!;
  }

  /**
   * Refresh trust score for a customer
   */
  async refreshTrustScore(customerId: string): Promise<TrustScoreBreakdown> {
    const response = await api.post(`/admin/customers/${customerId}/refresh-trust-score`);
    const result = response.data as ApiResponse<TrustScoreBreakdown>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to refresh trust score');
    }

    return result.data!;
  }

  /**
   * Add an abuse flag to a customer
   */
  async addAbuseFlag(
    customerId: string,
    flagType: AbuseFlagType,
    reason: string
  ): Promise<ActionResult> {
    const response = await api.post(`/admin/customers/${customerId}/flags`, {
      type: flagType,
      reason,
    });
    return response.data as ActionResult;
  }

  /**
   * Resolve an abuse flag
   */
  async resolveAbuseFlag(
    customerId: string,
    flagIndex: number,
    resolutionNotes: string
  ): Promise<ActionResult> {
    const response = await api.patch(`/admin/customers/${customerId}/flags/${flagIndex}/resolve`, {
      resolutionNotes,
    });
    return response.data as ActionResult;
  }

  /**
   * Block a customer
   */
  async blockCustomer(customerId: string, reason: string): Promise<ActionResult> {
    const response = await api.post(`/admin/customers/${customerId}/block`, { reason });
    return response.data as ActionResult;
  }

  /**
   * Unblock a customer
   */
  async unblockCustomer(customerId: string): Promise<ActionResult> {
    const response = await api.post(`/admin/customers/${customerId}/unblock`);
    return response.data as ActionResult;
  }

  /**
   * Adjust customer tier
   */
  async adjustTier(
    customerId: string,
    newTier: CustomerTier,
    reason: string
  ): Promise<ActionResult> {
    const response = await api.patch(`/admin/customers/${customerId}/tier`, {
      tier: newTier,
      reason,
    });
    return response.data as ActionResult;
  }

  /**
   * Run abuse scan on a customer
   */
  async runAbuseScan(customerId: string): Promise<{
    scanResult: AbuseScanResult;
    metrics: CustomerMetrics;
  }> {
    const response = await api.post(`/admin/customers/${customerId}/abuse-scan`);
    const result = response.data as ApiResponse<{
      scanResult: AbuseScanResult;
      metrics: CustomerMetrics;
    }>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to run abuse scan');
    }

    return result.data!;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get('/admin/customers/stats');
    const result = response.data as ApiResponse<DashboardStats>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch dashboard stats');
    }

    return result.data!;
  }

  /**
   * Sync metrics for a customer from booking data
   */
  async syncMetrics(customerId: string): Promise<void> {
    const response = await api.post(`/admin/customers/${customerId}/sync-metrics`);
    const result = response.data as ApiResponse<void>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to sync metrics');
    }
  }

  /**
   * Get customers by tier
   */
  async getCustomersByTier(
    tier: CustomerTier,
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { tier },
      page,
      limit,
    });
  }

  /**
   * Get flagged customers
   */
  async getFlaggedCustomers(
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { tier: 'flagged', hasUnresolvedFlags: true },
      page,
      limit,
    });
  }

  /**
   * Get blocked customers
   */
  async getBlockedCustomers(
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { isBlocked: true },
      page,
      limit,
    });
  }

  /**
   * Get high risk customers
   */
  async getHighRiskCustomers(
    riskLevel: RiskLevel = 'high',
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { riskLevel },
      page,
      limit,
      sortBy: 'trustScore',
      sortOrder: 'asc',
    });
  }
}

// ============================================
// Export singleton instance
// ============================================

export const customerOpsApi = new CustomerOpsApiService();
export default customerOpsApi;

// ============================================
// Helper utilities
// ============================================

export const getTierColor = (tier: CustomerTier): string => {
  const colors: Record<CustomerTier, string> = {
    new: 'bg-gray-100 text-gray-700',
    regular: 'bg-blue-100 text-blue-700',
    trusted: 'bg-green-100 text-green-700',
    flagged: 'bg-amber-100 text-amber-700',
    banned: 'bg-red-100 text-red-700',
  };
  return colors[tier] || colors.new;
};

export const getTierLabel = (tier: CustomerTier): string => {
  const labels: Record<CustomerTier, string> = {
    new: 'New',
    regular: 'Regular',
    trusted: 'Trusted',
    flagged: 'Flagged',
    banned: 'Banned',
  };
  return labels[tier] || tier;
};

export const getRiskColor = (riskLevel: RiskLevel): string => {
  const colors: Record<RiskLevel, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return colors[riskLevel] || colors.low;
};

export const getRiskLabel = (riskLevel: RiskLevel): string => {
  const labels: Record<RiskLevel, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
  };
  return labels[riskLevel] || riskLevel;
};

export const getTrustScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  if (score >= 20) return 'text-orange-600';
  return 'text-red-600';
};

export const getTrustScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-yellow-100';
  if (score >= 20) return 'bg-orange-100';
  return 'bg-red-100';
};

export const formatFlagType = (type: AbuseFlagType): string => {
  const labels: Record<AbuseFlagType, string> = {
    high_refund_rate: 'High Refund Rate',
    chargeback: 'Chargeback',
    coupon_abuse: 'Coupon Abuse',
    fake_referral: 'Fake Referral',
    suspicious_activity: 'Suspicious Activity',
    spam: 'Spam',
    fake_review: 'Fake Review',
    multiple_accounts: 'Multiple Accounts',
    payment_fraud: 'Payment Fraud',
  };
  return labels[type] || type;
};
