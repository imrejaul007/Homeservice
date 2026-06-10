import mongoose from 'mongoose';
import Consent, { IConsent, ConsentType } from '../models/consent.model';
import GdprAuditLog from '../models/gdprAuditLog.model';
import logger from '../utils/logger';

export interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  version: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  purpose?: string;
  legalBasis?: string;
}

export interface ConsentSummary {
  hasAcceptedTerms: boolean;
  hasAcceptedPrivacy: boolean;
  hasOptedInMarketing: boolean;
  hasAcceptedCookies: boolean;
  hasAcceptedDataProcessing: boolean;
  lastConsentUpdate: Date;
}

export interface ConsentVersionInfo {
  currentVersion: string;
  requiredVersion: string;
  needsUpdate: boolean;
  changelog?: string;
}

// Current policy versions (update these when policies change)
const CONSENT_VERSIONS: Record<ConsentType, string> = {
  terms: '2.0.0',
  privacy: '3.0.0',
  marketing: '1.0.0',
  cookies: '2.0.0',
  data_processing: '1.0.0',
};

const CHANGELOGS: Record<ConsentType, string> = {
  terms: 'Updated terms of service with new user guidelines and service level agreements.',
  privacy: 'Enhanced privacy protections, updated data retention policies, and added third-party sharing disclosures.',
  marketing: 'New marketing consent policy with granular communication preferences.',
  cookies: 'Updated cookie categories and added consent management for analytics.',
  data_processing: 'New data processing agreement aligned with GDPR requirements.',
};

/**
 * Get the current required version for a consent type
 */
export const getRequiredVersion = (type: ConsentType): string => {
  return CONSENT_VERSIONS[type];
};

/**
 * Get all required versions
 */
export const getAllRequiredVersions = (): Record<ConsentType, string> => {
  return { ...CONSENT_VERSIONS };
};

/**
 * Get version info for a consent type
 */
export const getVersionInfo = (type: ConsentType): ConsentVersionInfo => {
  return {
    currentVersion: CONSENT_VERSIONS[type],
    requiredVersion: CONSENT_VERSIONS[type],
    needsUpdate: false,
    changelog: CHANGELOGS[type],
  };
};

/**
 * Record user consent
 */
export const recordConsent = async (
  userId: string,
  type: ConsentType,
  granted: boolean,
  options: {
    version?: string;
    ipAddress?: string;
    userAgent?: string;
    purpose?: string;
    legalBasis?: string;
    method?: 'web' | 'mobile' | 'api' | 'written';
    metadata?: Record<string, unknown>;
  } = {}
): Promise<IConsent> => {
  const version = options.version || CONSENT_VERSIONS[type];
  const timestamp = new Date();

  // Check for existing consent
  const existingConsent = await Consent.findOne({ userId: new mongoose.Types.ObjectId(userId), type });

  let consent: IConsent;

  if (existingConsent) {
    // Update existing consent
    const wasGranted = existingConsent.granted;
    existingConsent.granted = granted;
    existingConsent.version = version;
    existingConsent.timestamp = timestamp;
    existingConsent.ipAddress = options.ipAddress;
    existingConsent.userAgent = options.userAgent;
    existingConsent.purpose = options.purpose;
    existingConsent.legalBasis = (options.legalBasis || 'consent') as IConsent['legalBasis'];
    existingConsent.metadata = options.metadata;

    // Track withdrawal date if consent is being removed
    if (wasGranted && !granted) {
      existingConsent.withdrawalDate = timestamp;
    }

    await existingConsent.save();
    consent = existingConsent;
  } else {
    // Create new consent record
    consent = await Consent.create({
      userId: new mongoose.Types.ObjectId(userId),
      type,
      granted,
      version,
      timestamp,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      purpose: options.purpose,
      legalBasis: (options.legalBasis || 'consent') as IConsent['legalBasis'],
      method: options.method || 'web',
      metadata: options.metadata,
    });
  }

  // Create audit log
  await GdprAuditLog.create({
    userId: new mongoose.Types.ObjectId(userId),
    action: granted ? 'consent_given' : 'consent_withdrawn',
    resource: 'consent',
    resourceId: consent._id.toString(),
    details: {
      consentType: type,
      version,
      purpose: options.purpose,
      legalBasis: options.legalBasis,
      method: options.method,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    timestamp,
    legalBasis: options.legalBasis || 'consent',
    purpose: options.purpose,
    dataCategory: [type],
    complianceId: `consent-${userId}-${type}-${timestamp.getTime()}`,
    regulation: 'gdpr',
  });

  logger.info('Consent recorded', {
    userId,
    type,
    granted,
    version,
    action: 'CONSENT_RECORDED',
  });

  return consent;
};

/**
 * Record multiple consents at once (bulk consent)
 */
export const recordBulkConsent = async (
  userId: string,
  consents: Array<{
    type: ConsentType;
    granted: boolean;
    version?: string;
  }>,
  options: {
    ipAddress?: string;
    userAgent?: string;
    method?: 'web' | 'mobile' | 'api' | 'written';
  } = {}
): Promise<IConsent[]> => {
  const results: IConsent[] = [];

  for (const consent of consents) {
    const result = await recordConsent(userId, consent.type, consent.granted, {
      version: consent.version,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      method: options.method,
    });
    results.push(result);
  }

  logger.info('Bulk consent recorded', {
    userId,
    consentCount: consents.length,
    action: 'BULK_CONSENT_RECORDED',
  });

  return results;
};

/**
 * Get all user consents
 */
export const getUserConsents = async (userId: string): Promise<IConsent[]> => {
  const consents = await Consent.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ timestamp: -1 })
    .lean();
  return consents as unknown as IConsent[];
};

/**
 * Get consent summary for a user
 */
export const getConsentSummary = async (userId: string): Promise<ConsentSummary> => {
  const consents = await getUserConsents(userId);

  const summary: ConsentSummary = {
    hasAcceptedTerms: false,
    hasAcceptedPrivacy: false,
    hasOptedInMarketing: false,
    hasAcceptedCookies: false,
    hasAcceptedDataProcessing: false,
    lastConsentUpdate: new Date(0),
  };

  for (const consent of consents) {
    if (!consent.granted) continue;

    switch (consent.type) {
      case 'terms':
        summary.hasAcceptedTerms = true;
        break;
      case 'privacy':
        summary.hasAcceptedPrivacy = true;
        break;
      case 'marketing':
        summary.hasOptedInMarketing = true;
        break;
      case 'cookies':
        summary.hasAcceptedCookies = true;
        break;
      case 'data_processing':
        summary.hasAcceptedDataProcessing = true;
        break;
    }

    if (consent.timestamp > summary.lastConsentUpdate) {
      summary.lastConsentUpdate = consent.timestamp;
    }
  }

  return summary;
};

/**
 * Check if user has valid consent for a specific type
 */
export const hasValidConsent = async (userId: string, type: ConsentType): Promise<boolean> => {
  const consent = await Consent.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    type,
    granted: true,
  });

  if (!consent) return false;

  // Check if consent version is current
  return consent.version === CONSENT_VERSIONS[type];
};

/**
 * Check if user has valid consent for all required types
 */
export const hasAllRequiredConsents = async (userId: string): Promise<{
  hasAll: boolean;
  missing: ConsentType[];
  outdated: ConsentType[];
}> => {
  const consents = await getUserConsents(userId);
  const consentMap = new Map<ConsentType, IConsent>();

  for (const consent of consents) {
    const existing = consentMap.get(consent.type);
    if (!existing || consent.timestamp > existing.timestamp) {
      consentMap.set(consent.type, consent);
    }
  }

  const requiredTypes: ConsentType[] = ['terms', 'privacy', 'data_processing'];
  const missing: ConsentType[] = [];
  const outdated: ConsentType[] = [];

  for (const type of requiredTypes) {
    const consent = consentMap.get(type);
    if (!consent || !consent.granted) {
      missing.push(type);
    } else if (consent.version !== CONSENT_VERSIONS[type]) {
      outdated.push(type);
    }
  }

  return {
    hasAll: missing.length === 0 && outdated.length === 0,
    missing,
    outdated,
  };
};

/**
 * Check if marketing consent is given
 */
export const hasMarketingConsent = async (userId: string): Promise<boolean> => {
  return hasValidConsent(userId, 'marketing');
};

/**
 * Check which consents are outdated (granted but version behind current policy)
 * Uses single query to fetch all consents, then processes in memory
 */
export const hasOutdatedConsents = async (
  userId: string,
  consentTypes: ConsentType[]
): Promise<ConsentType[]> => {
  const consents = await getUserConsents(userId);
  const consentMap = new Map<ConsentType, IConsent>();

  // Build map of latest consent per type (by timestamp)
  for (const consent of consents) {
    const existing = consentMap.get(consent.type);
    if (!existing || consent.timestamp > existing.timestamp) {
      consentMap.set(consent.type, consent);
    }
  }

  const outdated: ConsentType[] = [];
  for (const type of consentTypes) {
    const consent = consentMap.get(type);
    if (consent && consent.granted && consent.version !== CONSENT_VERSIONS[type]) {
      outdated.push(type);
    }
  }

  return outdated;
};

/**
 * Check if cookie consent is given
 */
export const hasCookieConsent = async (userId: string): Promise<boolean> => {
  return hasValidConsent(userId, 'cookies');
};

/**
 * Get consent history for a user (all versions)
 */
export const getConsentHistory = async (
  userId: string,
  type?: ConsentType
): Promise<IConsent[]> => {
  const query: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (type) {
    query.type = type;
  }

  const consents = await Consent.find(query)
    .sort({ timestamp: -1 })
    .lean();
  return consents as unknown as IConsent[];
};

/**
 * Verify consent proof
 */
export const verifyConsentProof = async (
  userId: string,
  type: ConsentType
): Promise<{
  valid: boolean;
  consent?: IConsent;
  proof?: string;
}> => {
  const consent = await Consent.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    type,
    granted: true,
  }).sort({ timestamp: -1 });

  if (!consent) {
    return { valid: false };
  }

  // Generate proof of consent
  const proof = JSON.stringify({
    consentId: consent._id,
    userId: consent.userId,
    type: consent.type,
    version: consent.version,
    timestamp: consent.timestamp,
    legalBasis: consent.legalBasis,
    ipAddress: consent.ipAddress,
    purpose: consent.purpose,
  });

  return {
    valid: true,
    consent,
    proof,
  };
};

/**
 * Delete all consent records for a user (for account deletion)
 */
export const deleteAllUserConsents = async (userId: string): Promise<number> => {
  const result = await Consent.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
  });

  // Audit log
  await GdprAuditLog.create({
    userId: new mongoose.Types.ObjectId(userId),
    action: 'data_deletion_completed',
    resource: 'consent',
    details: {
      deletedCount: result.deletedCount,
      reason: 'User account deletion',
    },
    timestamp: new Date(),
    complianceId: `consent-deletion-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });

  logger.info('All user consents deleted', {
    userId,
    deletedCount: result.deletedCount,
    action: 'ALL_CONSENTS_DELETED',
  });

  return result.deletedCount;
};

/**
 * Get consent statistics for admin dashboard
 */
export const getConsentStatistics = async (
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalUsers: number;
  consentRates: Record<ConsentType, { total: number; granted: number; rate: number }>;
  recentWithdrawals: number;
}> => {
  const matchStage: Record<string, unknown> = {};

  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) (matchStage.timestamp as Record<string, Date>).$gte = startDate;
    if (endDate) (matchStage.timestamp as Record<string, Date>).$lte = endDate;
  }

  const consentTypes: ConsentType[] = ['terms', 'privacy', 'marketing', 'cookies', 'data_processing'];
  const consentRates: Record<string, { total: number; granted: number; rate: number }> = {};

  for (const type of consentTypes) {
    const total = await Consent.countDocuments({ type });
    const granted = await Consent.countDocuments({ type, granted: true });

    consentRates[type] = {
      total,
      granted,
      rate: total > 0 ? (granted / total) * 100 : 0,
    };
  }

  // Count unique users with any consent
  const totalUsers = await Consent.distinct('userId').then(users => users.length);

  // Count recent withdrawals
  const recentWithdrawals = await Consent.countDocuments({
    withdrawalDate: { $exists: true, $ne: null },
    ...(startDate || endDate ? { withdrawalDate: matchStage.timestamp } : {}),
  });

  return {
    totalUsers,
    consentRates,
    recentWithdrawals,
  };
};

export default {
  getRequiredVersion,
  getAllRequiredVersions,
  getVersionInfo,
  recordConsent,
  recordBulkConsent,
  getUserConsents,
  getConsentSummary,
  hasValidConsent,
  hasAllRequiredConsents,
  hasOutdatedConsents,
  hasMarketingConsent,
  hasCookieConsent,
  getConsentHistory,
  verifyConsentProof,
  deleteAllUserConsents,
  getConsentStatistics,
};
