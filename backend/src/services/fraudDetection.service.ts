import mongoose from 'mongoose';
import ProviderVerification from '../models/providerVerification.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

// ============================================
// Fraud Detection Types
// ============================================

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
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'in_list' | 'not_in_list';
  value: any;
  threshold?: number;
}

export interface SuspiciousActivity {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  detectedAt: Date;
  metadata?: Record<string, any>;
}

export interface FraudReport {
  providerId: mongoose.Types.ObjectId;
  generatedAt: Date;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  patterns: FraudPattern[];
  suspiciousActivities: SuspiciousActivity[];
  recommendations: string[];
  summary: string;
}

export interface AccountChallenge {
  type: 'email_verification' | 'phone_verification' | 'document_upload' | 'captcha' | 'manual_review';
  required: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================
// Fraud Detection Service
// ============================================

export class FraudDetectionService {
  // Fraud patterns configuration
  private readonly fraudPatterns: FraudPattern[] = [
    {
      id: 'duplicate_accounts',
      name: 'Duplicate Account Detection',
      description: 'Multiple accounts from the same IP or device',
      severity: 'high',
      conditions: [
        { field: 'duplicateIps', operator: 'greater_than', value: 0, threshold: 2 },
      ],
      action: 'flag',
    },
    {
      id: 'velocity_check',
      name: 'Velocity Check',
      description: 'Unusually high booking or cancellation rate',
      severity: 'medium',
      conditions: [
        { field: 'bookingVelocity', operator: 'greater_than', value: 10, threshold: 10 },
        { field: 'cancellationVelocity', operator: 'greater_than', value: 5, threshold: 5 },
      ],
      action: 'flag',
    },
    {
      id: 'suspicious_document',
      name: 'Suspicious Document',
      description: 'Document appears tampered or invalid',
      severity: 'critical',
      conditions: [
        { field: 'documentConfidence', operator: 'less_than', value: 0.7, threshold: 0.7 },
      ],
      action: 'block',
    },
    {
      id: 'address_mismatch',
      name: 'Address Mismatch',
      description: 'Provider and document addresses do not match',
      severity: 'medium',
      conditions: [
        { field: 'addressMatchScore', operator: 'less_than', value: 0.5, threshold: 0.5 },
      ],
      action: 'flag',
    },
    {
      id: 'high_risk_country',
      name: 'High Risk Country',
      description: 'Account from high-risk country or VPN detected',
      severity: 'high',
      conditions: [
        { field: 'countryRisk', operator: 'in_list', value: ['North Korea', 'Iran', 'Syria', 'Cuba'] },
        { field: 'vpnDetected', operator: 'equals', value: true },
      ],
      action: 'flag',
    },
    {
      id: 'payment_failure_spike',
      name: 'Payment Failure Spike',
      description: 'High number of failed payment attempts',
      severity: 'medium',
      conditions: [
        { field: 'paymentFailures', operator: 'greater_than', value: 3, threshold: 3 },
      ],
      action: 'flag',
    },
    {
      id: 'no_show_pattern',
      name: 'No-Show Pattern',
      description: 'Provider has high no-show rate',
      severity: 'high',
      conditions: [
        { field: 'noShowRate', operator: 'greater_than', value: 0.1, threshold: 0.1 },
      ],
      action: 'flag',
    },
    {
      id: 'fake_reviews',
      name: 'Suspicious Review Pattern',
      description: 'Reviews from suspicious or fake accounts',
      severity: 'high',
      conditions: [
        { field: 'reviewVelocity', operator: 'greater_than', value: 5, threshold: 5 },
        { field: 'sameIpReviews', operator: 'greater_than', value: 2, threshold: 2 },
      ],
      action: 'flag',
    },
  ];

  // ========================================
  // Main Fraud Detection Methods
  // ========================================

  /**
   * Analyze a provider for fraud indicators
   */
  async analyzeProvider(providerId: string): Promise<FraudReport> {
    const provider = await User.findById(providerId);
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }

    const providerProfile = await ProviderProfile.findOne({ userId: providerId });
    const verification = await ProviderVerification.findOne({ providerId });

    // Gather evidence for fraud analysis
    const evidence = await this.gatherEvidence(providerId, providerProfile, verification);
    const suspiciousActivities: SuspiciousActivity[] = [];
    const matchedPatterns: FraudPattern[] = [];

    // Check each fraud pattern
    for (const pattern of this.fraudPatterns) {
      const patternEvidence = await this.evaluatePattern(pattern, evidence, providerId);
      if (patternEvidence.isMatch) {
        matchedPatterns.push(pattern);
        suspiciousActivities.push({
          type: pattern.id,
          severity: pattern.severity,
          description: pattern.description,
          evidence: patternEvidence.evidence,
          detectedAt: new Date(),
          metadata: patternEvidence.metadata,
        });
      }
    }

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(matchedPatterns, suspiciousActivities);
    const riskLevel = this.determineRiskLevel(riskScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(matchedPatterns, riskLevel);

    return {
      providerId: provider._id as mongoose.Types.ObjectId,
      generatedAt: new Date(),
      riskScore,
      riskLevel,
      patterns: matchedPatterns,
      suspiciousActivities,
      recommendations,
      summary: this.generateSummary(riskScore, riskLevel, matchedPatterns.length, suspiciousActivities.length),
    };
  }

  /**
   * Gather evidence data for fraud analysis
   */
  private async gatherEvidence(
    providerId: string,
    providerProfile: any,
    verification: any
  ): Promise<Record<string, any>> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get booking statistics
    const bookings = await Booking.find({
      providerId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled' && b.cancellationDetails?.cancelledBy === 'provider');
    const noShows = bookings.filter(b => b.status === 'no_show');

    // Get duplicate accounts
    const duplicateIps = await this.findDuplicateAccountsByIp(providerId);

    // Get reviews
    const reviews = providerProfile?.reviewsData?.recentReviews || [];
    const recentReviews = reviews.filter((r: any) => new Date(r.createdAt) >= thirtyDaysAgo);

    // Calculate document confidence
    let documentConfidence = 1;
    if (verification?.documents) {
      const verifiedDocs = verification.documents.filter((d: any) => d.verified);
      if (verifiedDocs.length > 0) {
        const avgConfidence = verifiedDocs.reduce((sum: number, d: any) => {
          return sum + (d.ocrData?.confidence || 0.8);
        }, 0) / verifiedDocs.length;
        documentConfidence = avgConfidence;
      }
    }

    // Calculate address match score
    let addressMatchScore = 1;
    if (verification?.documents && providerProfile?.locationInfo) {
      addressMatchScore = this.calculateAddressMatch(
        verification.documents,
        providerProfile.locationInfo.primaryAddress
      );
    }

    return {
      // Provider info
      providerId,
      providerEmail: (await User.findById(providerId))?.email,
      providerCreatedAt: (await User.findById(providerId))?.createdAt,

      // Booking metrics
      totalBookings: bookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      noShows: noShows.length,
      bookingVelocity: bookings.length,
      cancellationVelocity: cancelledBookings.length,

      // Rates
      completionRate: bookings.length > 0 ? completedBookings.length / bookings.length : 0,
      cancellationRate: bookings.length > 0 ? cancelledBookings.length / bookings.length : 0,
      noShowRate: bookings.length > 0 ? noShows.length / bookings.length : 0,

      // Document info
      documentsUploaded: verification?.documents?.length || 0,
      documentsVerified: verification?.documents?.filter((d: any) => d.verified)?.length || 0,
      documentConfidence,
      verificationStatus: verification?.status || 'none',

      // Address info
      addressMatchScore,

      // Account info
      duplicateIps,
      duplicateAccountsCount: duplicateIps.length,

      // Review info
      reviewVelocity: recentReviews.length,

      // Payment failures (would need payment service integration)
      paymentFailures: 0,

      // VPN/Country risk (would need IP geolocation service)
      vpnDetected: false,
      countryRisk: 'low',

      // Profile completeness
      profileCompleteness: providerProfile?.completionPercentage || 0,
    };
  }

  /**
   * Evaluate a fraud pattern against evidence
   */
  private async evaluatePattern(
    pattern: FraudPattern,
    evidence: Record<string, any>,
    providerId: string
  ): Promise<{ isMatch: boolean; evidence: Record<string, any>; metadata?: Record<string, any> }> {
    for (const condition of pattern.conditions) {
      const evidenceValue = evidence[condition.field];

      if (evidenceValue === undefined) continue;

      let isMatch = false;

      switch (condition.operator) {
        case 'equals':
          isMatch = evidenceValue === condition.value;
          break;
        case 'not_equals':
          isMatch = evidenceValue !== condition.value;
          break;
        case 'greater_than':
          isMatch = typeof evidenceValue === 'number' && evidenceValue > (condition.threshold || condition.value);
          break;
        case 'less_than':
          isMatch = typeof evidenceValue === 'number' && evidenceValue < (condition.threshold || condition.value);
          break;
        case 'contains':
          isMatch = typeof evidenceValue === 'string' && evidenceValue.includes(condition.value);
          break;
        case 'regex':
          isMatch = typeof evidenceValue === 'string' && new RegExp(condition.value).test(evidenceValue);
          break;
        case 'in_list':
          isMatch = Array.isArray(condition.value) && condition.value.includes(evidenceValue);
          break;
        case 'not_in_list':
          isMatch = Array.isArray(condition.value) && !condition.value.includes(evidenceValue);
          break;
      }

      if (isMatch) {
        return {
          isMatch: true,
          evidence: {
            condition: `${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`,
            actualValue: evidenceValue,
          },
          metadata: {
            patternId: pattern.id,
            matchedCondition: condition,
          },
        };
      }
    }

    return { isMatch: false, evidence: {} };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(patterns: FraudPattern[], activities: SuspiciousActivity[]): number {
    let score = 0;

    // Base score from pattern matches
    const patternWeights: Record<string, number> = {
      'duplicate_accounts': 25,
      'velocity_check': 15,
      'suspicious_document': 35,
      'address_mismatch': 15,
      'high_risk_country': 30,
      'payment_failure_spike': 10,
      'no_show_pattern': 20,
      'fake_reviews': 25,
    };

    for (const pattern of patterns) {
      score += patternWeights[pattern.id] || 10;
    }

    // Add severity multipliers
    for (const activity of activities) {
      const severityMultiplier: Record<string, number> = {
        'low': 1,
        'medium': 1.5,
        'high': 2,
        'critical': 3,
      };
      score *= severityMultiplier[activity.severity] || 1;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(patterns: FraudPattern[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Immediate manual review required');
      recommendations.push('Consider temporary account suspension pending investigation');
    }

    for (const pattern of patterns) {
      switch (pattern.id) {
        case 'duplicate_accounts':
          recommendations.push('Review duplicate accounts for potential abuse');
          break;
        case 'suspicious_document':
          recommendations.push('Request additional document verification');
          recommendations.push('Enable enhanced KYC verification');
          break;
        case 'no_show_pattern':
          recommendations.push('Issue warning to provider about service commitments');
          recommendations.push('Consider implementing no-show penalties');
          break;
        case 'fake_reviews':
          recommendations.push('Review flagged reviews for authenticity');
          recommendations.push('Implement review verification measures');
          break;
        case 'high_risk_country':
          recommendations.push('Apply enhanced due diligence procedures');
          recommendations.push('Enable additional verification steps');
          break;
        default:
          recommendations.push('Monitor account activity closely');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue routine monitoring');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    riskScore: number,
    riskLevel: string,
    patternCount: number,
    activityCount: number
  ): string {
    if (riskLevel === 'low') {
      return `Provider shows normal activity patterns with ${patternCount} minor checks passed. Risk score: ${riskScore}/100.`;
    }

    if (riskLevel === 'critical') {
      return `CRITICAL ALERT: Provider flagged for ${activityCount} suspicious activities across ${patternCount} patterns. Immediate action required. Risk score: ${riskScore}/100.`;
    }

    return `Provider flagged for ${activityCount} suspicious activities across ${patternCount} fraud patterns. Risk level: ${riskLevel.toUpperCase()}. Risk score: ${riskScore}/100.`;
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Find duplicate accounts by IP address
   */
  private async findDuplicateAccountsByIp(providerId: string): Promise<string[]> {
    const provider = await User.findById(providerId).select('+refreshTokens');
    if (!provider) return [];

    // In a real implementation, you would track IP addresses
    // For now, return empty array as IP tracking would need middleware
    return [];
  }

  /**
   * Calculate address match score between documents and profile
   */
  private calculateAddressMatch(documents: any[], profileAddress: any): number {
    if (!documents.length || !profileAddress) return 0;

    const addressParts = [
      profileAddress.city?.toLowerCase(),
      profileAddress.state?.toLowerCase(),
      profileAddress.country?.toLowerCase(),
    ].filter(Boolean);

    if (addressParts.length === 0) return 0.5; // Neutral score if no address

    // Simple matching - in production would use fuzzy matching
    let matches = 0;
    for (const doc of documents) {
      const docAddress = doc.ocrData?.address?.toLowerCase() || '';
      for (const part of addressParts) {
        if (docAddress.includes(part)) {
          matches++;
        }
      }
    }

    return matches / (documents.length * addressParts.length);
  }

  /**
   * Flag suspicious activity and add to verification record
   */
  async flagSuspiciousActivity(
    providerId: string,
    activity: SuspiciousActivity
  ): Promise<void> {
    const verification = await ProviderVerification.findOne({ providerId });

    if (verification) {
      verification.fraudFlags.push({
        type: activity.type as any,
        severity: activity.severity,
        description: activity.description,
        detectedAt: activity.detectedAt,
        resolved: false,
      });

      // If critical fraud detected, auto-suspend
      if (activity.severity === 'critical') {
        verification.status = 'suspended';
        logger.warn('FRAUD_DETECTION: Auto-suspending provider due to critical fraud flag', {
          providerId,
          activityType: activity.type,
        });
      }

      await verification.save();
    } else {
      // Create new verification record with fraud flag
      await ProviderVerification.create({
        providerId,
        status: 'pending',
        fraudFlags: [{
          type: activity.type as any,
          severity: activity.severity,
          description: activity.description,
          detectedAt: activity.detectedAt,
          resolved: false,
        }],
      });
    }

    logger.info('FRAUD_DETECTION: Suspicious activity flagged', {
      providerId,
      activityType: activity.type,
      severity: activity.severity,
    });
  }

  /**
   * Resolve a fraud flag
   */
  async resolveFraudFlag(
    providerId: string,
    flagId: string,
    adminId: string,
    resolution: string
  ): Promise<void> {
    const verification = await ProviderVerification.findOne({ providerId });

    if (!verification) {
      throw new ApiError(404, 'Verification record not found');
    }

    const flag = verification.fraudFlags.find(f => (f._id as any)?.toString() === flagId);

    if (!flag) {
      throw new ApiError(404, 'Fraud flag not found');
    }

    flag.resolved = true;
    flag.resolvedAt = new Date();
    flag.resolvedBy = new mongoose.Types.ObjectId(adminId);
    flag.resolution = resolution;

    // If all flags are resolved, check if we can restore status
    const unresolvedFlags = verification.fraudFlags.filter(f => !f.resolved);
    if (unresolvedFlags.length === 0 && verification.status === 'suspended') {
      verification.status = 'pending';
    }

    await verification.save();

    logger.info('FRAUD_DETECTION: Fraud flag resolved', {
      providerId,
      flagId,
      adminId,
      resolution,
    });
  }

  /**
   * Create account verification challenge
   */
  async createVerificationChallenge(
    providerId: string,
    challengeType: AccountChallenge['type']
  ): Promise<AccountChallenge> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    return {
      type: challengeType,
      required: true,
      expiresAt,
      metadata: {
        createdAt: new Date(),
        providerId,
      },
    };
  }

  /**
   * Generate comprehensive fraud report
   */
  async generateFraudReport(providerId: string): Promise<FraudReport> {
    return this.analyzeProvider(providerId);
  }

  /**
   * Get fraud statistics for dashboard
   */
  async getFraudStats(): Promise<{
    totalFlagged: number;
    bySeverity: Record<string, number>;
    recentFlags: number;
    resolvedFlags: number;
  }> {
    const verifications = await ProviderVerification.find({
      'fraudFlags.0': { $exists: true },
    });

    const stats = {
      totalFlagged: 0,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      recentFlags: 0,
      resolvedFlags: 0,
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const verification of verifications) {
      for (const flag of verification.fraudFlags) {
        stats.totalFlagged++;
        stats.bySeverity[flag.severity] = (stats.bySeverity[flag.severity] || 0) + 1;

        if (flag.detectedAt >= sevenDaysAgo) {
          stats.recentFlags++;
        }

        if (flag.resolved) {
          stats.resolvedFlags++;
        }
      }
    }

    return stats;
  }

  /**
   * Batch analyze multiple providers for fraud
   */
  async batchAnalyzeProviders(providerIds: string[]): Promise<FraudReport[]> {
    const reports: FraudReport[] = [];

    for (const providerId of providerIds) {
      try {
        const report = await this.analyzeProvider(providerId);
        reports.push(report);
      } catch (error) {
        logger.error('FRAUD_DETECTION: Batch analysis failed for provider', {
          providerId,
          error: (error as Error).message,
        });
      }
    }

    return reports;
  }
}

// Export singleton instance
export const fraudDetectionService = new FraudDetectionService();
export default fraudDetectionService;
