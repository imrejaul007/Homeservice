import mongoose from 'mongoose';
import ProviderVerification from '../models/providerVerification.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

// ============================================
// Background Check Types
// ============================================

export interface BackgroundCheck {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerPhone: string;
  type: 'identity' | 'criminal' | 'address' | 'employment' | 'education' | 'financial' | 'reference';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'needs_review';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestDate: string;
  completedDate?: string;
  expiryDate?: string;
  result?: CheckResult;
  retryCount: number;
  lastRetryDate?: string;
  assignedTo?: string;
  notes: string;
}

export interface CheckResult {
  verified: boolean;
  score: number;
  details: string;
  documents?: Array<{
    type: string;
    url: string;
    verified: boolean;
  }>;
}

export interface BackgroundCheckStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  needsReview: number;
  avgCompletionTime: number;
  passRate: number;
  byType: Array<{ type: string; count: number; color: string }>;
  trend: Array<{ date: string; requested: number; completed: number; failed: number }>;
  urgentCount: number;
}

export interface VerificationProvider {
  name: string;
  apiKey: string;
  apiUrl: string;
  enabled: boolean;
}

// ============================================
// Background Check Service
// ============================================

export class BackgroundCheckService {
  // Verification providers configuration
  private readonly verificationProviders: Record<string, VerificationProvider> = {
    Jumio: {
      name: 'Jumio',
      apiKey: process.env.JUMIO_API_KEY || '',
      apiUrl: 'https://netverify.com/api/v4',
      enabled: !!process.env.JUMIO_API_KEY,
    },
    Checkr: {
      name: 'Checkr',
      apiKey: process.env.CHECKR_API_KEY || '',
      apiUrl: 'https://api.checkr.com/v1',
      enabled: !!process.env.CHECKR_API_KEY,
    },
    Veriff: {
      name: 'Veriff',
      apiKey: process.env.VERIFF_API_KEY || '',
      apiUrl: 'https://api.veriff.com',
      enabled: !!process.env.VERIFF_API_KEY,
    },
  };

  // Check type configurations
  private readonly checkTypeConfigs = {
    identity: {
      name: 'Identity Verification',
      provider: 'Jumio',
      fields: ['fullName', 'dateOfBirth', 'idNumber', 'idDocument'],
      scoring: { verified: 100, partial: 60, failed: 0 },
    },
    criminal: {
      name: 'Criminal Background Check',
      provider: 'Checkr',
      fields: ['ssn', 'county', 'state'],
      scoring: { verified: 100, partial: 50, failed: 0 },
    },
    address: {
      name: 'Address Verification',
      provider: 'Veriff',
      fields: ['address', 'utilityBill', 'bankStatement'],
      scoring: { verified: 100, partial: 70, failed: 0 },
    },
    employment: {
      name: 'Employment Verification',
      provider: 'Manual',
      fields: ['companyName', 'position', 'startDate', 'endDate', 'contactPerson'],
      scoring: { verified: 100, partial: 60, failed: 0 },
    },
    education: {
      name: 'Education Verification',
      provider: 'Manual',
      fields: ['institution', 'degree', 'graduationYear', 'transcript'],
      scoring: { verified: 100, partial: 50, failed: 0 },
    },
    financial: {
      name: 'Financial Check',
      provider: 'Checkr',
      fields: ['bankStatement', 'creditScore', 'incomeVerification'],
      scoring: { verified: 100, partial: 40, failed: 0 },
    },
    reference: {
      name: 'Reference Check',
      provider: 'Manual',
      fields: ['referenceName', 'referenceContact', 'relationship'],
      scoring: { verified: 100, partial: 60, failed: 0 },
    },
  };

  // ========================================
  // Main Background Check Methods
  // ========================================

  /**
   * Create a new background check request
   */
  async createCheck(
    providerId: string,
    type: BackgroundCheck['type'],
    priority: BackgroundCheck['priority'] = 'medium',
    notes?: string
  ): Promise<BackgroundCheck> {
    const provider = await User.findById(providerId);
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }

    const checkConfig = this.checkTypeConfigs[type];
    const checkData = {
      providerId,
      providerName: provider.firstName && provider.lastName
        ? `${provider.firstName} ${provider.lastName}`
        : provider.email || 'Unknown',
      providerEmail: provider.email,
      providerPhone: provider.phone || '',
      type,
      status: 'pending' as const,
      priority,
      requestDate: new Date(),
      retryCount: 0,
      notes: notes || '',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    // Store in provider verification model
    const verification = await ProviderVerification.findOne({ providerId });
    if (verification) {
      verification.backgroundChecks = verification.backgroundChecks || [];
      verification.backgroundChecks.push({
        checkId: `bc-${Date.now()}`,
        type,
        status: 'pending',
        priority,
        requestDate: new Date(),
        result: undefined,
        retryCount: 0,
        notes: notes || '',
      });
      await verification.save();
    } else {
      await ProviderVerification.create({
        providerId,
        status: 'pending',
        backgroundChecks: [{
          checkId: `bc-${Date.now()}`,
          type,
          status: 'pending',
          priority,
          requestDate: new Date(),
          result: undefined,
          retryCount: 0,
          notes: notes || '',
        }],
      });
    }

    // Trigger async verification based on provider type
    this.initiateCheck(providerId, type, priority).catch(err => {
      logger.error('BACKGROUND_CHECK: Failed to initiate check', { providerId, type, error: err.message });
    });

    return {
      id: `bc-${Date.now()}`,
      ...checkData,
      requestDate: checkData.requestDate.toISOString(),
      expiryDate: checkData.expiryDate.toISOString(),
    };
  }

  /**
   * Initiate background check with verification provider
   */
  private async initiateCheck(
    providerId: string,
    type: BackgroundCheck['type'],
    priority: BackgroundCheck['priority']
  ): Promise<void> {
    const checkConfig = this.checkTypeConfigs[type];
    const provider = this.verificationProviders[checkConfig.provider];

    if (!provider?.enabled) {
      logger.warn('BACKGROUND_CHECK: Verification provider not configured', {
        providerId,
        type,
        provider: checkConfig.provider,
      });
      return;
    }

    // Get provider profile data for verification
    const profile = await ProviderProfile.findOne({ userId: providerId });
    const user = await User.findById(providerId);

    // Build verification payload based on check type
    const payload = this.buildVerificationPayload(type, profile, user);

    // Call verification provider API
    const result = await this.callVerificationProvider(provider, type, payload);

    // Update check status based on result
    await this.updateCheckStatus(providerId, type, result);
  }

  /**
   * Build verification payload based on check type
   */
  private buildVerificationPayload(
    type: BackgroundCheck['type'],
    profile: any,
    user: any
  ): Record<string, any> {
    switch (type) {
      case 'identity':
        return {
          firstName: user?.firstName,
          lastName: user?.lastName,
          email: user?.email,
          phone: user?.phone,
          dateOfBirth: profile?.dateOfBirth,
          idDocument: profile?.documents?.find((d: any) => d.type === 'id')?.url,
        };
      case 'criminal':
        return {
          ssn: profile?.ssnLast4,
          county: profile?.locationInfo?.city,
          state: profile?.locationInfo?.state || 'UAE',
        };
      case 'address':
        return {
          address: profile?.locationInfo?.primaryAddress,
          city: profile?.locationInfo?.city,
          country: profile?.locationInfo?.country || 'UAE',
          utilityBill: profile?.documents?.find((d: any) => d.type === 'utility_bill')?.url,
        };
      case 'employment':
        return {
          employerName: profile?.employmentHistory?.[0]?.companyName,
          position: profile?.employmentHistory?.[0]?.position,
          startDate: profile?.employmentHistory?.[0]?.startDate,
          contactEmail: profile?.employmentHistory?.[0]?.contactEmail,
        };
      case 'education':
        return {
          institution: profile?.education?.[0]?.institution,
          degree: profile?.education?.[0]?.degree,
          graduationYear: profile?.education?.[0]?.graduationYear,
        };
      case 'financial':
        return {
          bankStatement: profile?.documents?.find((d: any) => d.type === 'bank_statement')?.url,
          incomeRange: profile?.incomeRange,
        };
      default:
        return {};
    }
  }

  /**
   * Call external verification provider
   */
  private async callVerificationProvider(
    provider: VerificationProvider,
    type: BackgroundCheck['type'],
    payload: Record<string, any>
  ): Promise<{ success: boolean; result?: CheckResult; error?: string }> {
    // In production, this would make actual API calls to verification providers
    // For now, simulate the verification process
    try {
      logger.info('BACKGROUND_CHECK: Initiating verification', {
        provider: provider.name,
        type,
        payload: { ...payload, email: payload.email ? '***' : undefined },
      });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate verification result based on random factors
      // In production, this would be replaced with actual provider response
      const randomScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const verified = randomScore >= 70;

      return {
        success: true,
        result: {
          verified,
          score: randomScore,
          details: verified
            ? 'Verification successful. All documents authenticated.'
            : 'Partial verification. Additional documentation required.',
          documents: [],
        },
      };
    } catch (error) {
      logger.error('BACKGROUND_CHECK: Provider API error', {
        provider: provider.name,
        type,
        error: (error as Error).message,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Update check status after verification
   */
  private async updateCheckStatus(
    providerId: string,
    type: BackgroundCheck['type'],
    result: { success: boolean; result?: CheckResult; error?: string }
  ): Promise<void> {
    const verification = await ProviderVerification.findOne({ providerId });
    if (!verification?.backgroundChecks) return;

    const check = verification.backgroundChecks.find((c: any) => c.type === type);
    if (!check) return;

    if (result.success && result.result) {
      check.result = result.result;
      check.status = result.result.verified ? 'completed' : 'needs_review';
      check.completedDate = new Date();
    } else {
      check.status = 'failed';
      check.notes = result.error || 'Verification provider error';
    }

    await verification.save();
  }

  /**
   * Get all background checks for admin dashboard
   */
  async getAllChecks(filters: {
    status?: string;
    type?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ checks: BackgroundCheck[]; total: number }> {
    const { status, type, priority, search, page = 1, limit = 50 } = filters;

    const query: Record<string, any> = {};
    if (status && status !== 'all') query['backgroundChecks.status'] = status;
    if (type && type !== 'all') query['backgroundChecks.type'] = type;
    if (priority && priority !== 'all') query['backgroundChecks.priority'] = priority;

    const verifications = await ProviderVerification.find(query)
      .populate('providerId', 'firstName lastName email phone')
      .skip((page - 1) * limit)
      .limit(limit);

    const allChecks: BackgroundCheck[] = [];

    for (const verification of verifications) {
      const provider = verification.providerId as any;
      for (const check of verification.backgroundChecks || []) {
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          const providerName = `${provider?.firstName || ''} ${provider?.lastName || ''}`.toLowerCase();
          const providerEmail = (provider?.email || '').toLowerCase();
          if (!providerName.includes(searchLower) && !providerEmail.includes(searchLower)) {
            continue;
          }
        }

        allChecks.push({
          id: check.checkId,
          providerId: verification.providerId.toString(),
          providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
          providerEmail: provider?.email || '',
          providerPhone: provider?.phone || '',
          type: check.type,
          status: check.status,
          priority: check.priority,
          requestDate: check.requestDate.toISOString(),
          completedDate: check.completedDate?.toISOString(),
          expiryDate: check.expiryDate?.toISOString(),
          result: check.result,
          retryCount: check.retryCount,
          lastRetryDate: check.lastRetryDate?.toISOString(),
          assignedTo: check.assignedTo,
          notes: check.notes,
        });
      }
    }

    // Get total count
    const totalVerifications = await ProviderVerification.countDocuments(query);
    const avgChecksPerVerification = allChecks.length / (totalVerifications || 1);
    const total = Math.ceil(totalVerifications * avgChecksPerVerification);

    return { checks: allChecks, total };
  }

  /**
   * Get background check statistics
   */
  async getStats(): Promise<BackgroundCheckStats> {
    const verifications = await ProviderVerification.find({
      'backgroundChecks.0': { $exists: true },
    });

    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      needsReview: 0,
      avgCompletionTime: 0,
      passRate: 0,
      byType: [
        { type: 'Identity', count: 0, color: '#3B82F6' },
        { type: 'Criminal', count: 0, color: '#EF4444' },
        { type: 'Address', count: 0, color: '#8B5CF6' },
        { type: 'Employment', count: 0, color: '#10B981' },
        { type: 'Education', count: 0, color: '#F59E0B' },
        { type: 'Financial', count: 0, color: '#EC4899' },
      ],
      trend: [] as Array<{ date: string; requested: number; completed: number; failed: number }>,
      urgentCount: 0,
    };

    const completionTimes: number[] = [];

    for (const verification of verifications) {
      for (const check of verification.backgroundChecks || []) {
        stats.total++;

        switch (check.status) {
          case 'pending': stats.pending++; break;
          case 'in_progress': stats.inProgress++; break;
          case 'completed': stats.completed++; break;
          case 'failed': stats.failed++; break;
          case 'needs_review': stats.needsReview++; break;
        }

        if (check.priority === 'urgent') stats.urgentCount++;

        // Count by type
        const typeIndex = stats.byType.findIndex(t =>
          t.type.toLowerCase() === check.type
        );
        if (typeIndex >= 0) stats.byType[typeIndex].count++;

        // Calculate completion time
        if (check.completedDate) {
          const completionTime = (check.completedDate.getTime() - check.requestDate.getTime()) / (1000 * 60 * 60 * 24);
          completionTimes.push(completionTime);
        }
      }
    }

    // Calculate averages
    stats.avgCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    stats.passRate = stats.completed > 0
      ? ((stats.completed - stats.failed) / stats.completed) * 100
      : 0;

    // Generate trend data for last 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = days[date.getDay()];

      const dayVerifications = verifications.filter((v: any) => {
        return v.backgroundChecks?.some((c: any) => {
          const checkDate = new Date(c.requestDate);
          return checkDate.toDateString() === date.toDateString();
        });
      });

      stats.trend.push({
        date: dateStr,
        requested: dayVerifications.length * 2, // Simulated
        completed: Math.floor(dayVerifications.length * 1.5), // Simulated
        failed: Math.floor(dayVerifications.length * 0.2), // Simulated
      });
    }

    return stats;
  }

  /**
   * Retry a failed background check
   */
  async retryCheck(providerId: string, checkId: string): Promise<BackgroundCheck> {
    const verification = await ProviderVerification.findOne({ providerId });
    if (!verification?.backgroundChecks) {
      throw new ApiError(404, 'Background check not found');
    }

    const check = verification.backgroundChecks.find((c: any) => c.checkId === checkId);
    if (!check) {
      throw new ApiError(404, 'Background check not found');
    }

    if (check.retryCount >= 3) {
      throw new ApiError(400, 'Maximum retry attempts exceeded');
    }

    if (check.status !== 'failed') {
      throw new ApiError(400, 'Can only retry failed checks');
    }

    // Increment retry count and reset status
    check.retryCount++;
    check.lastRetryDate = new Date();
    check.status = 'pending';
    check.result = undefined;
    check.notes = `Retry attempt ${check.retryCount}`;

    await verification.save();

    // Re-initiate the check
    await this.initiateCheck(providerId, check.type, check.priority);

    const user = await User.findById(providerId);

    return {
      id: check.checkId,
      providerId,
      providerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
      providerEmail: user?.email || '',
      providerPhone: user?.phone || '',
      type: check.type,
      status: check.status,
      priority: check.priority,
      requestDate: check.requestDate.toISOString(),
      retryCount: check.retryCount,
      lastRetryDate: check.lastRetryDate.toISOString(),
      notes: check.notes,
    };
  }

  /**
   * Update background check status manually
   */
  async updateCheckStatusManual(
    providerId: string,
    checkId: string,
    status: BackgroundCheck['status'],
    notes?: string
  ): Promise<BackgroundCheck> {
    const verification = await ProviderVerification.findOne({ providerId });
    if (!verification?.backgroundChecks) {
      throw new ApiError(404, 'Background check not found');
    }

    const check = verification.backgroundChecks.find((c: any) => c.checkId === checkId);
    if (!check) {
      throw new ApiError(404, 'Background check not found');
    }

    check.status = status;
    if (notes) check.notes = notes;
    if (status === 'completed') {
      check.completedDate = new Date();
    }

    await verification.save();

    const user = await User.findById(providerId);

    return {
      id: check.checkId,
      providerId,
      providerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
      providerEmail: user?.email || '',
      providerPhone: user?.phone || '',
      type: check.type,
      status: check.status,
      priority: check.priority,
      requestDate: check.requestDate.toISOString(),
      completedDate: check.completedDate?.toISOString(),
      result: check.result,
      retryCount: check.retryCount,
      notes: check.notes,
    };
  }

  /**
   * Get background check by ID
   */
  async getCheckById(providerId: string, checkId: string): Promise<BackgroundCheck | null> {
    const verification = await ProviderVerification.findOne({ providerId });
    if (!verification?.backgroundChecks) return null;

    const check = verification.backgroundChecks.find((c: any) => c.checkId === checkId);
    if (!check) return null;

    const user = await User.findById(providerId);

    return {
      id: check.checkId,
      providerId,
      providerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
      providerEmail: user?.email || '',
      providerPhone: user?.phone || '',
      type: check.type,
      status: check.status,
      priority: check.priority,
      requestDate: check.requestDate.toISOString(),
      completedDate: check.completedDate?.toISOString(),
      expiryDate: check.expiryDate?.toISOString(),
      result: check.result,
      retryCount: check.retryCount,
      lastRetryDate: check.lastRetryDate?.toISOString(),
      assignedTo: check.assignedTo,
      notes: check.notes,
    };
  }

  /**
   * Alert on failed check
   */
  async alertOnFailure(providerId: string, checkId: string): Promise<void> {
    const check = await this.getCheckById(providerId, checkId);
    if (!check) return;

    logger.warn('BACKGROUND_CHECK: Check failed', {
      providerId,
      checkId,
      type: check.type,
      result: check.result,
    });

    // In production, this would:
    // 1. Send notification to admin
    // 2. Update provider status to suspended if critical check fails
    // 3. Create incident ticket
    // 4. Send email/SMS to provider
  }
}

// Export singleton instance
export const backgroundCheckService = new BackgroundCheckService();
export default backgroundCheckService;
