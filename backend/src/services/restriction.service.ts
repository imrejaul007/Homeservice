/**
 * Data Restriction Service
 * 
 * GDPR Compliance: Article 18 - Right to Restriction of Processing
 * Implements the ability for users to restrict processing of their data
 */

import mongoose from 'mongoose';
import User from '../models/user.model';
import GdprAuditLog from '../models/gdprAuditLog.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

export type RestrictionReason = 
  | 'user_request'
  | 'legal_dispute'
  | 'pending_verification'
  | 'data_accuracy_dispute'
  | 'unlawful_processing';

export interface RestrictionDetails {
  reason: RestrictionReason;
  requestedAt: Date;
  requestedBy: 'user' | 'admin';
  notes?: string;
  legalBasis?: string;
}

/**
 * Restrict processing for a user
 */
export async function restrictUserProcessing(
  userId: string,
  reason: RestrictionReason,
  options: {
    requestedBy?: 'user' | 'admin';
    notes?: string;
    legalBasis?: string;
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<void> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  // Update user document
  const user = await User.findByIdAndUpdate(
    userObjectId,
    {
      $set: {
        processingRestricted: true,
        restrictedAt: new Date(),
        restrictionReason: reason,
        restrictionDetails: {
          reason,
          requestedAt: new Date(),
          requestedBy: options.requestedBy || 'user',
          notes: options.notes,
          legalBasis: options.legalBasis,
        },
      },
    },
    { new: true }
  );
  
  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  
  // Audit log
  await GdprAuditLog.create({
    userId: userObjectId,
    action: 'processing_restricted',
    resource: 'user_profile',
    resourceId: userId,
    details: {
      reason,
      requestedBy: options.requestedBy || 'user',
      notes: options.notes,
      legalBasis: options.legalBasis,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    timestamp: new Date(),
    complianceId: `restriction-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });
  
  logger.info('User processing restricted', {
    userId,
    reason,
    requestedBy: options.requestedBy,
    action: 'USER_PROCESSING_RESTRICTED',
  });
}

/**
 * Lift restriction on user processing
 */
export async function liftUserRestriction(
  userId: string,
  options: {
    requestedBy?: 'user' | 'admin';
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<void> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  // Verify restriction exists
  const user = await User.findById(userObjectId);
  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  
  if (!user.processingRestricted) {
    throw ApiError.badRequest('User processing is not restricted', [], ERROR_CODES.INVALID_INPUT);
  }
  
  // Update user document
  await User.findByIdAndUpdate(
    userObjectId,
    {
      $set: {
        processingRestricted: false,
        unrestrictedAt: new Date(),
      },
      $unset: {
        restrictionReason: '',
        restrictionDetails: '',
      },
    }
  );
  
  // Audit log
  await GdprAuditLog.create({
    userId: userObjectId,
    action: 'processing_restriction_lifted',
    resource: 'user_profile',
    resourceId: userId,
    details: {
      requestedBy: options.requestedBy || 'admin',
      reason: options.reason,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    timestamp: new Date(),
    complianceId: `unrestrict-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });
  
  logger.info('User processing restriction lifted', {
    userId,
    requestedBy: options.requestedBy,
    reason: options.reason,
    action: 'USER_PROCESSING_UNRESTRICTED',
  });
}

/**
 * Check if user processing is restricted
 */
export async function isUserProcessingRestricted(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select('processingRestricted');
  return user?.processingRestricted || false;
}

/**
 * Get restriction details for a user
 */
export async function getRestrictionDetails(
  userId: string
): Promise<RestrictionDetails | null> {
  const user = await User.findById(userId).select(
    'processingRestricted restrictedAt restrictionReason restrictionDetails'
  );
  
  if (!user || !user.processingRestricted) {
    return null;
  }
  
  return {
    reason: user.restrictionReason as RestrictionReason,
    requestedAt: user.restrictedAt || new Date(),
    requestedBy: user.restrictionDetails?.requestedBy || 'user',
    notes: user.restrictionDetails?.notes,
    legalBasis: user.restrictionDetails?.legalBasis,
  };
}

/**
 * Apply legal hold to a user (admin function)
 */
export async function applyLegalHold(
  userId: string,
  reason: string,
  legalBasis: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<void> {
  await restrictUserProcessing(userId, 'legal_dispute', {
    requestedBy: 'admin',
    notes: reason,
    legalBasis,
    ...options,
  });
  
  logger.info('Legal hold applied to user', {
    userId,
    reason,
    legalBasis,
    action: 'LEGAL_HOLD_APPLIED',
  });
}

/**
 * Remove legal hold from a user (admin function)
 */
export async function removeLegalHold(
  userId: string,
  reason: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<void> {
  await liftUserRestriction(userId, {
    requestedBy: 'admin',
    reason: `Legal hold removed: ${reason}`,
    ...options,
  });
  
  logger.info('Legal hold removed from user', {
    userId,
    reason,
    action: 'LEGAL_HOLD_REMOVED',
  });
}

/**
 * Check if user is under legal hold
 */
export async function isUserUnderLegalHold(userId: string): Promise<boolean> {
  const restrictionDetails = await getRestrictionDetails(userId);
  return restrictionDetails?.reason === 'legal_dispute';
}

/**
 * Get all users under processing restriction
 */
export async function getRestrictedUsers(
  filters?: {
    reason?: RestrictionReason;
    requestedBy?: 'user' | 'admin';
    startDate?: Date;
    endDate?: Date;
  }
): Promise<Array<{
  userId: string;
  reason: RestrictionReason;
  restrictedAt: Date;
  requestedBy: 'user' | 'admin';
}>> {
  const query: Record<string, any> = {
    processingRestricted: true,
  };
  
  if (filters?.reason) {
    query.restrictionReason = filters.reason;
  }
  
  if (filters?.requestedBy) {
    query['restrictionDetails.requestedBy'] = filters.requestedBy;
  }
  
  if (filters?.startDate || filters?.endDate) {
    query.restrictedAt = {};
    if (filters.startDate) {
      (query.restrictedAt as any).$gte = filters.startDate;
    }
    if (filters.endDate) {
      (query.restrictedAt as any).$lte = filters.endDate;
    }
  }
  
  const users = await User.find(query)
    .select('_id restrictedAt restrictionReason restrictionDetails')
    .lean();
  
  return users.map((user: any) => ({
    userId: user._id.toString(),
    reason: user.restrictionReason as RestrictionReason,
    restrictedAt: user.restrictedAt,
    requestedBy: user.restrictionDetails?.requestedBy || 'user',
  }));
}

/**
 * Get restriction statistics
 */
export async function getRestrictionStatistics(): Promise<{
  totalRestricted: number;
  byReason: Record<RestrictionReason, number>;
  byRequestType: Record<'user' | 'admin', number>;
  legalHolds: number;
}> {
  const restrictedUsers = await User.find({
    processingRestricted: true,
  }).select('_id restrictionReason restrictionDetails');
  
  const stats = {
    totalRestricted: restrictedUsers.length,
    byReason: {} as Record<RestrictionReason, number>,
    byRequestType: { user: 0, admin: 0 } as Record<'user' | 'admin', number>,
    legalHolds: 0,
  };
  
  for (const user of restrictedUsers) {
    const reason = user.restrictionReason as RestrictionReason;
    const requestedBy = (user.restrictionDetails?.requestedBy || 'user') as 'user' | 'admin';

    stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
    stats.byRequestType[requestedBy] = (stats.byRequestType[requestedBy] || 0) + 1;
    
    if (reason === 'legal_dispute') {
      stats.legalHolds++;
    }
  }
  
  return stats;
}

/**
 * Middleware to check if user processing is restricted
 * Use this in routes to block restricted users
 */
export async function checkProcessingRestriction(
  userId: string
): Promise<{
  isRestricted: boolean;
  reason?: RestrictionReason;
  restrictedAt?: Date;
}> {
  const user = await User.findById(userId).select(
    'processingRestricted restrictionReason restrictedAt'
  );
  
  if (!user || !user.processingRestricted) {
    return { isRestricted: false };
  }
  
  return {
    isRestricted: true,
    reason: user.restrictionReason as RestrictionReason,
    restrictedAt: user.restrictedAt,
  };
}

/**
 * Create a query filter to exclude restricted users
 */
export function excludeRestrictedUsers<T extends Record<string, any>>(
  query: T
): T & { processingRestricted?: { $ne: boolean } } {
  return {
    ...query,
    processingRestricted: { $ne: true },
  };
}

/**
 * Create an aggregation pipeline stage to exclude restricted users
 */
export function excludeRestrictedUsersStage(): Record<string, any>[] {
  return [
    {
      $match: {
        processingRestricted: { $ne: true },
      },
    },
  ];
}

export default {
  restrictUserProcessing,
  liftUserRestriction,
  isUserProcessingRestricted,
  getRestrictionDetails,
  applyLegalHold,
  removeLegalHold,
  isUserUnderLegalHold,
  getRestrictedUsers,
  getRestrictionStatistics,
  checkProcessingRestriction,
  excludeRestrictedUsers,
  excludeRestrictedUsersStage,
};
