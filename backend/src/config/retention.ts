/**
 * NILIN Data Retention Policy Configuration
 * 
 * GDPR Compliance: Article 5(1)(e) - Storage Limitation
 * Defines retention periods for all personal data categories
 * with legal basis documentation.
 */

export type RetentionUnit = 'days' | 'months' | 'years' | 'hours';
export type RetentionAction = 'delete' | 'anonymize' | 'archive';

export interface RetentionRule {
  duration: number | null;
  unit: RetentionUnit;
  action: RetentionAction;
  legalBasis?: string;
  legalHold?: boolean;
  description: string;
}

export interface RetentionPolicy {
  [dataType: string]: RetentionRule;
}

// ============================================
// RETENTION POLICY
// ============================================

export const RETENTION_POLICY: RetentionPolicy = {
  // User Account Data
  userAccounts: {
    duration: 90,
    unit: 'days',
    action: 'delete',
    description: 'Soft-deleted accounts are hard-deleted after 90 days grace period',
    legalBasis: 'Contract performance and legitimate interest for account recovery',
  },
  
  activeAccounts: {
    duration: null, // Indefinite while active
    unit: 'years',
    action: 'anonymize',
    description: 'Active accounts retained indefinitely. Anonymized upon deletion request.',
    legalBasis: 'Contract performance and legal obligations',
  },
  
  // Authentication & Security Data
  loginAttempts: {
    duration: 2,
    unit: 'years',
    action: 'delete',
    description: 'Login attempt history for security and fraud prevention',
    legalBasis: 'Legitimate interest in security and fraud prevention',
  },
  
  sessions: {
    duration: 30,
    unit: 'days',
    action: 'delete',
    description: 'User sessions with 30-day TTL',
    legalBasis: 'Legitimate interest in session security',
  },
  
  refreshTokens: {
    duration: 30,
    unit: 'days',
    action: 'delete',
    description: 'Refresh tokens for authentication',
    legalBasis: 'Contract performance',
  },
  
  passwordResetTokens: {
    duration: 1,
    unit: 'hours',
    action: 'delete',
    description: 'Password reset tokens with 1-hour expiry',
    legalBasis: 'Contract performance',
  },
  
  // Financial & Transaction Data
  paymentRecords: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'Financial records for tax and legal compliance',
    legalBasis: 'Legal obligation for financial record keeping (7 years)',
  },
  
  commissionRecords: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'Provider commission records',
    legalBasis: 'Legal obligation and contract performance',
  },
  
  settlementRecords: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'Provider payout settlements',
    legalBasis: 'Legal obligation and contract performance',
  },
  
  // Booking & Service Data
  bookings: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'Service booking records',
    legalBasis: 'Contract performance and legal obligation',
  },
  
  bookingNotifications: {
    duration: 90,
    unit: 'days',
    action: 'delete',
    description: 'In-app booking notifications',
    legalBasis: 'Legitimate interest in user communication history',
  },
  
  // Communication Data
  emailNotifications: {
    duration: 90,
    unit: 'days',
    action: 'delete',
    description: 'Email notification records (excluding email content)',
    legalBasis: 'Legitimate interest in communication records',
  },
  
  pushNotifications: {
    duration: 30,
    unit: 'days',
    action: 'delete',
    description: 'Push notification records',
    legalBasis: 'Legitimate interest in notification delivery',
  },
  
  // Device & Technical Data
  deviceTokens: {
    duration: 90,
    unit: 'days',
    action: 'delete',
    description: 'Push notification device tokens',
    legalBasis: 'Contract performance for push notifications',
  },
  
  deviceTokensInactive: {
    duration: 90,
    unit: 'days',
    action: 'delete',
    description: 'Inactive device tokens (not used in 90 days)',
    legalBasis: 'Data minimization',
  },
  
  // Behavioral & Analytics Data
  searchHistory: {
    duration: 24,
    unit: 'months',
    action: 'anonymize',
    description: 'User search history for personalization',
    legalBasis: 'Consent for personalization features',
  },
  
  interactionHistory: {
    duration: 24,
    unit: 'months',
    action: 'anonymize',
    description: 'Profile view and interaction history',
    legalBasis: 'Legitimate interest in service improvement',
  },
  
  profileViews: {
    duration: 12,
    unit: 'months',
    action: 'anonymize',
    description: 'Profile view tracking data',
    legalBasis: 'Legitimate interest in analytics',
  },
  
  // Loyalty & Rewards Data
  loyaltyPointsHistory: {
    duration: 24,
    unit: 'months',
    action: 'delete',
    description: 'Individual points earning/spending transactions',
    legalBasis: 'Contract performance for loyalty program',
  },
  
  loyaltyTierHistory: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'Tier changes and point totals',
    legalBasis: 'Contract performance and dispute resolution',
  },
  
  // Consent & GDPR Data
  consentRecords: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'GDPR consent records',
    legalBasis: 'Legal obligation for proof of consent',
  },
  
  dataRequests: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'GDPR data subject requests',
    legalBasis: 'Legal obligation for compliance records',
  },
  
  gdprAuditLogs: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'GDPR audit trail',
    legalBasis: 'Legal obligation for accountability',
  },
  
  // Review & Social Data
  reviews: {
    duration: null, // Retained with anonymized author
    unit: 'years',
    action: 'anonymize',
    description: 'Service reviews (author anonymized, content retained)',
    legalBasis: 'Legitimate interest in service quality and community',
  },
  
  // General Audit Data
  auditLogs: {
    duration: 7,
    unit: 'years',
    action: 'archive',
    legalHold: true,
    description: 'System audit logs',
    legalBasis: 'Legal obligation for security incident investigation',
  },
  
  accessLogs: {
    duration: 2,
    unit: 'years',
    action: 'delete',
    description: 'API and endpoint access logs',
    legalBasis: 'Legitimate interest in security monitoring',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get retention period in milliseconds
 */
export function getRetentionPeriodMs(dataType: string): number | null {
  const rule = RETENTION_POLICY[dataType];
  if (!rule) return null;
  
  const { duration, unit } = rule;
  if (duration === null) return null; // Indefinite
  
  const multipliers = {
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000, // Approximate
    years: 365 * 24 * 60 * 60 * 1000, // Approximate
  };
  
  return duration * (multipliers[unit] || 0);
}

/**
 * Check if data should be deleted
 */
export function shouldDeleteData(dataType: string, createdAt: Date): boolean {
  const rule = RETENTION_POLICY[dataType];
  if (!rule || rule.action === 'anonymize') return false;
  
  const retentionMs = getRetentionPeriodMs(dataType);
  if (retentionMs === null) return false; // Indefinite
  
  const expiryDate = new Date(createdAt.getTime() + retentionMs);
  return expiryDate < new Date();
}

/**
 * Check if data should be anonymized
 */
export function shouldAnonymizeData(dataType: string, createdAt: Date): boolean {
  const rule = RETENTION_POLICY[dataType];
  if (!rule || rule.action !== 'anonymize') return false;
  
  const retentionMs = getRetentionPeriodMs(dataType);
  if (retentionMs === null) return false; // Indefinite
  
  const expiryDate = new Date(createdAt.getTime() + retentionMs);
  return expiryDate < new Date();
}

/**
 * Check if data is under legal hold
 */
export function isUnderLegalHold(dataType: string): boolean {
  const rule = RETENTION_POLICY[dataType];
  return rule?.legalHold === true;
}

/**
 * Get legal basis for data processing
 */
export function getLegalBasis(dataType: string): string | null {
  const rule = RETENTION_POLICY[dataType];
  return rule?.legalBasis || null;
}

/**
 * Get all data types under legal hold
 */
export function getDataTypesUnderLegalHold(): string[] {
  return Object.entries(RETENTION_POLICY)
    .filter(([_, rule]) => rule.legalHold === true)
    .map(([type]) => type);
}

/**
 * Calculate deletion/expiry date for a data type
 */
export function calculateExpiryDate(dataType: string, createdAt: Date): Date | null {
  const rule = RETENTION_POLICY[dataType];
  if (!rule) return null;
  
  const { duration, unit } = rule;
  if (duration === null) return null; // Indefinite
  
  const multipliers = {
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };
  
  return new Date(createdAt.getTime() + duration * (multipliers[unit] || 0));
}

// ============================================
// COMPLIANCE REPORTING
// ============================================

export interface RetentionComplianceReport {
  dataType: string;
  retentionRule: RetentionRule;
  isActive: boolean;
  itemsAtRisk: number;
  itemsUnderLegalHold: number;
  nextScheduledCleanup: Date | null;
}

export function generateRetentionReport(dataTypes: string[]): RetentionComplianceReport[] {
  return dataTypes.map(dataType => {
    const rule = RETENTION_POLICY[dataType];
    if (!rule) {
      const fallbackRule: RetentionRule = {
        duration: null,
        unit: 'years',
        action: 'delete',
        description: 'No policy defined - immediate action required',
      };
      return {
        dataType,
        retentionRule: fallbackRule,
        isActive: false,
        itemsAtRisk: 0,
        itemsUnderLegalHold: 0,
        nextScheduledCleanup: null,
      };
    }
    
    return {
      dataType,
      retentionRule: rule,
      isActive: true,
      itemsAtRisk: 0, // Would be populated by data analysis
      itemsUnderLegalHold: rule.legalHold ? 0 : 0,
      nextScheduledCleanup: null, // Would be calculated from schedule
    };
  });
}

export default {
  RETENTION_POLICY,
  getRetentionPeriodMs,
  shouldDeleteData,
  shouldAnonymizeData,
  isUnderLegalHold,
  getLegalBasis,
  getDataTypesUnderLegalHold,
  calculateExpiryDate,
  generateRetentionReport,
};
