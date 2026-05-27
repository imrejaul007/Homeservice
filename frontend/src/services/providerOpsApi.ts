import axios from 'axios';
import { api } from './api';

// Generate idempotency key
const generateIdempotencyKey = () => `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

// ============================================
// Provider Operations API Types
// ============================================

export interface ProviderVerification {
  _id: string;
  providerId: string;
  status: 'pending' | 'in_progress' | 'verified' | 'rejected' | 'suspended';
  kycScore: number;
  kycLevel: 'basic' | 'standard' | 'enhanced';
  documents: ProviderDocument[];
  backgroundCheck: BackgroundCheck;
  fraudFlags: FraudFlag[];
  reviewHistory: ReviewHistoryEntry[];
  metadata: VerificationMetadata;
  appeal?: AppealInfo;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface ProviderDocument {
  _id: string;
  type: 'id_card' | 'passport' | 'business_license' | 'address_proof' | 'tax_certificate' | 'insurance';
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  ocrData?: {
    name?: string;
    documentNumber?: string;
    expiryDate?: string;
    dob?: string;
    address?: string;
    confidence?: number;
  };
}

export interface BackgroundCheck {
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  provider?: string;
  reportId?: string;
  initiatedAt?: string;
  completedAt?: string;
  result?: {
    criminalCheck: boolean;
    sexOffenderCheck: boolean;
    sanctionsCheck: boolean;
    notes?: string;
  };
}

export interface FraudFlag {
  _id: string;
  type: 'duplicate_account' | 'suspicious_document' | 'unusual_pattern' | 'address_mismatch' | 'velocity_check_failed' | 'high_risk_country';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface ReviewHistoryEntry {
  _id: string;
  action: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended' | 'document_requested' | 'appeal_reviewed';
  performedBy: string;
  performedAt: string;
  notes?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface VerificationMetadata {
  ipAddress?: string;
  deviceFingerprint?: string;
  browserInfo?: string;
  verificationAttempts: number;
  lastAttemptAt?: string;
}

export interface AppealInfo {
  isAppealed: boolean;
  appealedAt?: string;
  appealReason?: string;
  appealStatus?: 'pending' | 'approved' | 'rejected';
  appealReviewedAt?: string;
  appealReviewedBy?: string;
  appealNotes?: string;
}

export interface ProviderMetrics {
  providerId: string;
  qualityScore: number;
  reliabilityScore: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShows: number;
  avgRating: number;
  avgResponseTime: number;
  acceptanceRate: number;
  lastUpdated: string;
}

export interface OnboardingStatus {
  providerId: string;
  currentStage: 'registration' | 'document_upload' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  completedStages: string[];
  pendingStages: string[];
  requiredDocuments: string[];
  missingDocuments: string[];
  estimatedCompletionTime?: number;
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

export interface FraudPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: FraudCondition[];
  action: 'flag' | 'block' | 'auto_suspend';
}

export interface FraudCondition {
  field: string;
  operator: string;
  value: unknown;
  threshold?: number;
}

export interface IdentityVerificationStatus {
  status: 'pending' | 'in_progress' | 'verified' | 'rejected';
  documentType?: 'id_card' | 'passport';
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface BusinessVerificationStatus {
  status: 'pending' | 'in_progress' | 'verified' | 'rejected';
  documentType?: 'business_license' | 'trade_license';
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface SuspiciousActivity {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SLAMetrics {
  providerId: string;
  responseTime: {
    avgMinutes: number;
    p95Minutes: number;
    targetMinutes: number;
    compliant: boolean;
  };
  bookingAcceptanceRate: {
    accepted: number;
    rejected: number;
    rate: number;
    targetPercentage: number;
    compliant: boolean;
  };
  completionRate: {
    completed: number;
    cancelled: number;
    noShow: number;
    rate: number;
    targetPercentage: number;
    compliant: boolean;
  };
  lastUpdated: string;
}

export interface ProviderFilters {
  status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  qualityScoreMin?: number;
  qualityScoreMax?: number;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'qualityScore' | 'reliabilityScore' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedProvidersResponse {
  success: boolean;
  data: {
    providers: ProviderWithUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface ProviderWithUser {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    accountStatus: string;
    createdAt: string;
  };
  businessInfo: {
    businessName: string;
    businessType: string;
    description: string;
    city?: string;
  };
  verificationStatus: {
    overall: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'suspended';
    identity?: IdentityVerificationStatus;
    business?: BusinessVerificationStatus;
  };
  instagramStyleProfile: {
    isVerified: boolean;
    profilePhoto: string;
  };
  analytics: {
    performanceMetrics: {
      qualityScore: number;
      punctualityScore: number;
    };
    bookingStats: {
      totalBookings: number;
      completedBookings: number;
    };
  };
  locationInfo?: {
    primaryAddress?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
  reviewsData?: {
    averageRating: number;
    totalReviews: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FraudStats {
  totalFlagged: number;
  bySeverity: Record<string, number>;
  recentFlags: number;
  resolvedFlags: number;
}

export interface ProviderActionResponse {
  success: boolean;
  data: {
    provider: ProviderWithUser;
    verification?: ProviderVerification;
    message?: string;
  };
  message?: string;
}

// ============================================
// API Methods
// ============================================

export const providerOpsApiService = {
  // ========================================
  // Provider List & Filters
  // ========================================

  /**
   * Get paginated list of providers with filters
   */
  getProviders: async (filters?: ProviderFilters): Promise<PaginatedProvidersResponse> => {
    const response = await api.get('/provider-ops/providers', { params: filters });
    return response.data;
  },

  /**
   * Get single provider details
   */
  getProviderDetails: async (providerId: string): Promise<{ success: boolean; data: { provider: ProviderWithUser } }> => {
    const response = await api.get(`/provider-ops/providers/${providerId}`);
    return response.data;
  },

  // ========================================
  // Verification Management (Provider Self)
  // ========================================

  /**
   * Get provider's own verification details
   */
  getVerification: async (providerId: string): Promise<{ success: boolean; data: { verification: ProviderVerification } }> => {
    const response = await api.get(`/provider-ops/verification/${providerId}`);
    return response.data;
  },

  /**
   * Upload KYC document
   */
  uploadKycDocument: async (
    providerId: string,
    documentType: ProviderDocument['type'],
    file: File
  ): Promise<{ success: boolean; data: { verification: ProviderVerification } }> => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('document', file);

    // Uses admin endpoint for upload (provider endpoint would need separate implementation)
    const response = await api.post(`/provider-ops/verification/${providerId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Verify KYC document (admin action)
   */
  verifyDocument: async (
    providerId: string,
    documentId: string,
    verified: boolean,
    notes?: string
  ): Promise<{ success: boolean; data: { verification: ProviderVerification } }> => {
    const response = await api.post(`/provider-ops/verification/${providerId}/documents/${documentId}/verify`, {
      verified,
      notes,
    });
    return response.data;
  },

  /**
   * Submit provider for review
   */
  submitForReview: async (providerId: string): Promise<{ success: boolean; data: { verification: ProviderVerification } }> => {
    const response = await api.post(`/provider-ops/verification/${providerId}/submit`);
    return response.data;
  },

  // ========================================
  // Onboarding Status
  // ========================================

  /**
   * Get provider onboarding status (uses provider-specific endpoint)
   */
  getOnboardingStatus: async (providerId: string): Promise<{ success: boolean; data: OnboardingStatus }> => {
    // Try provider-specific endpoint first, fall back to admin endpoint
    try {
      const response = await api.get(`/provider/onboarding`, {
        params: { providerId }
      });
      return response.data;
    } catch (primaryError) {
      console.warn('Provider onboarding endpoint failed, trying admin endpoint:', primaryError);
      // Fall back to admin endpoint
      const response = await api.get(`/provider-ops/onboarding/${providerId}`);
      return response.data;
    }
  },

  // ========================================
  // Metrics & Scoring
  // ========================================

  /**
   * Get provider metrics (quality & reliability scores)
   */
  getProviderMetrics: async (providerId: string): Promise<{ success: boolean; data: ProviderMetrics }> => {
    const response = await api.get(`/provider-ops/metrics/${providerId}`);
    return response.data;
  },

  /**
   * Get provider SLA metrics
   */
  getSlaMetrics: async (providerId: string): Promise<{ success: boolean; data: SLAMetrics }> => {
    const response = await api.get(`/provider-ops/sla/${providerId}`);
    return response.data;
  },

  // ========================================
  // Provider Actions
  // ========================================

  /**
   * Approve provider
   */
  approveProvider: async (
    providerId: string,
    notes?: string
  ): Promise<ProviderActionResponse> => {
    const response = await api.post(`/provider-ops/providers/${providerId}/approve`, { notes });
    return response.data;
  },

  /**
   * Reject provider
   */
  rejectProvider: async (
    providerId: string,
    reason: string,
    notes?: string
  ): Promise<ProviderActionResponse> => {
    const response = await api.post(`/provider-ops/providers/${providerId}/reject`, { reason, notes });
    return response.data;
  },

  /**
   * Suspend provider
   */
  suspendProvider: async (
    providerId: string,
    reason: string,
    type: 'temporary' | 'permanent',
    endDate?: string
  ): Promise<ProviderActionResponse> => {
    const response = await api.post(`/provider-ops/providers/${providerId}/suspend`, {
      reason,
      type,
      endDate,
    });
    return response.data;
  },

  /**
   * Reactivate provider
   */
  reactivateProvider: async (
    providerId: string,
    notes?: string
  ): Promise<ProviderActionResponse> => {
    const response = await api.post(`/provider-ops/providers/${providerId}/reactivate`, { notes });
    return response.data;
  },

  // ========================================
  // Payout Management
  // ========================================

  /**
   * Place payout hold
   */
  placePayoutHold: async (
    providerId: string,
    reason: string,
    frozenAmount?: number
  ): Promise<ProviderActionResponse> => {
    const response = await api.post(`/provider-ops/providers/${providerId}/payout-hold`, {
      reason,
      frozenAmount,
    });
    return response.data;
  },

  /**
   * Release payout hold
   */
  releasePayoutHold: async (
    providerId: string,
    releaseAmount?: number
  ): Promise<ProviderActionResponse> => {
    const response = await api.post(`/provider-ops/providers/${providerId}/payout-release`, {
      releaseAmount,
    });
    return response.data;
  },

  // ========================================
  // Fraud Detection
  // ========================================

  /**
   * Run fraud check on provider
   */
  runFraudCheck: async (providerId: string): Promise<{ success: boolean; data: FraudReport }> => {
    const response = await api.post(`/provider-ops/fraud/check/${providerId}`);
    return response.data;
  },

  /**
   * Get provider fraud status
   */
  getFraudStatus: async (providerId: string): Promise<{
    success: boolean;
    data: {
      hasFlags: boolean;
      flags: FraudFlag[];
      riskLevel: string;
      lastChecked?: string;
    };
  }> => {
    const response = await api.get(`/provider-ops/fraud/status/${providerId}`);
    return response.data;
  },

  /**
   * Resolve fraud flag
   */
  resolveFraudFlag: async (
    providerId: string,
    flagId: string,
    resolution: string
  ): Promise<{ success: boolean }> => {
    const response = await api.post(`/provider-ops/fraud/resolve/${providerId}/${flagId}`, { resolution });
    return response.data;
  },

  /**
   * Get fraud statistics
   */
  getFraudStats: async (): Promise<{ success: boolean; data: FraudStats }> => {
    const response = await api.get('/provider-ops/fraud/stats');
    return response.data;
  },

  // ========================================
  // SLA Monitoring
  // ========================================

  /**
   * Get providers with SLA violations
   */
  getSlaViolations: async (): Promise<{
    success: boolean;
    data: {
      providers: Array<{
        providerId: string;
        violations: string[];
        severity: 'low' | 'medium' | 'high';
      }>;
    };
  }> => {
    const response = await api.get('/provider-ops/sla/violations');
    return response.data;
  },

  // ========================================
  // Document Verification Workflow
  // ========================================

  /**
   * Get document verification status
   */
  getDocumentVerificationStatus: async (providerId: string): Promise<{
    success: boolean;
    data: {
      totalDocuments: number;
      verifiedDocuments: number;
      pendingDocuments: number;
      rejectedDocuments: number;
      documents: ProviderDocument[];
      overallProgress: number;
    };
  }> => {
    const response = await api.get(`/provider-ops/verification/${providerId}/documents`);
    return response.data;
  },

  // ========================================
  // Dashboard Statistics
  // ========================================

  /**
   * Get dashboard overview statistics
   */
  getDashboardStats: async (): Promise<{
    success: boolean;
    data: {
      providers: {
        total: number;
        pending: number;
        approved: number;
        suspended: number;
        rejected: number;
      };
      metrics: {
        avgQualityScore: number;
        avgReliabilityScore: number;
        totalBookings: number;
        avgRating: number;
      };
      fraud: FraudStats;
      sla: {
        compliantProviders: number;
        violationsCount: number;
      };
    };
  }> => {
    const response = await api.get('/provider-ops/dashboard/stats');
    return response.data;
  },
};

export default providerOpsApiService;
