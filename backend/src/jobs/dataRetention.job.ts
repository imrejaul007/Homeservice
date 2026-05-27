/**
 * Data Retention Cleanup Jobs
 * 
 * GDPR Compliance: Article 5(1)(e) - Storage Limitation
 * Implements automated cleanup of personal data according to retention policy
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import BookingNotification from '../models/bookingNotification.model';
import Consent from '../models/consent.model';
import GdprAuditLog from '../models/gdprAuditLog.model';
import DataRequest from '../models/dataRequest.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import Wallet from '../models/wallet.model';
import Dispute from '../models/dispute.model';
import logger from '../utils/logger';

// Export directory for data files (consistent with dataExport.service.ts)
const EXPORT_DIR = path.join(process.cwd(), 'exports');
import { 
  RETENTION_POLICY, 
  shouldDeleteData, 
  isUnderLegalHold,
  calculateExpiryDate,
} from '../config/retention';

/**
 * Job result tracking
 */
interface CleanupJobResult {
  success: boolean;
  jobName: string;
  deleted: number;
  anonymized: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

/**
 * Generic cleanup job executor
 */
async function runCleanupJob<T>(
  jobName: string,
  getItemsToProcess: () => Promise<T[]>,
  processItem: (item: T) => Promise<void>,
  batchSize: number = 100
): Promise<CleanupJobResult> {
  const startTime = Date.now();
  const result: CleanupJobResult = {
    success: true,
    jobName,
    deleted: 0,
    anonymized: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
  };
  
  try {
    const items = await getItemsToProcess();
    logger.info(`[${jobName}] Starting cleanup of ${items.length} items`);
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        await Promise.all(batch.map(item => processItem(item)));
        result.deleted += batch.length;
      } catch (error) {
        result.errors.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error}`);
        logger.error(`[${jobName}] Batch ${Math.floor(i / batchSize) + 1} failed`, error);
      }
    }
    
    result.duration = Date.now() - startTime;
    logger.info(`[${jobName}] Completed: ${result.deleted} items processed in ${result.duration}ms`);
  } catch (error) {
    result.success = false;
    result.errors.push(`Job failed: ${error}`);
    logger.error(`[${jobName}] Job failed`, error);
  }
  
  return result;
}

/**
 * Job 1: Cleanup expired sessions
 * Runs: Daily at 2:00 AM
 */
async function cleanupExpiredSessions(): Promise<CleanupJobResult> {
  return runCleanupJob(
    'cleanupExpiredSessions',
    async () => {
      const now = new Date();
      const expiredUsers = await User.find({
        'sessions.expiresAt': { $lt: now },
      }).select('_id');
      
      return expiredUsers;
    },
    async (user) => {
      await User.updateOne(
        { _id: user._id },
        { $pull: { sessions: { expiresAt: { $lt: new Date() } } } }
      );
    }
  );
}

/**
 * Job 2: Cleanup old notifications
 * Runs: Daily at 3:00 AM
 */
async function cleanupOldNotifications(): Promise<CleanupJobResult> {
  const retentionDays = 90; // 90 days from RETENTION_POLICY
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  return runCleanupJob(
    'cleanupOldNotifications',
    async () => {
      const notifications = await BookingNotification.find({
        createdAt: { $lt: cutoffDate },
      }).select('_id');
      
      return notifications;
    },
    async (notification) => {
      await BookingNotification.deleteOne({ _id: notification._id });
    }
  );
}

/**
 * Job 3: Cleanup inactive device tokens
 * Runs: Weekly on Sunday at 4:00 AM
 */
async function cleanupInactiveDeviceTokens(): Promise<CleanupJobResult> {
  const retentionDays = 90; // 90 days inactive
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  return runCleanupJob(
    'cleanupInactiveDeviceTokens',
    async () => {
      const users = await User.find({
        'deviceTokens.lastUsed': { $lt: cutoffDate, $exists: true },
      }).select('_id deviceTokens');
      
      return users;
    },
    async (user) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      
      await User.updateOne(
        { _id: user._id },
        { $pull: { deviceTokens: { lastUsed: { $lt: cutoff } } } }
      );
    }
  );
}

/**
 * Job 4: Cleanup soft-deleted accounts (hard delete)
 * Runs: Weekly on Sunday at 5:00 AM
 *
 * CRITICAL GDPR FIX: Implements hard deletion after 90-day grace period
 * FIX: Added missing collections: CustomerProfile, ProviderProfile, Wallet, Dispute
 */
async function cleanupSoftDeletedAccounts(): Promise<CleanupJobResult> {
  const gracePeriodDays = 90; // 90 days grace period
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

  return runCleanupJob(
    'cleanupSoftDeletedAccounts',
    async () => {
      const users = await User.find({
        isDeleted: true,
        updatedAt: { $lt: cutoffDate },
      }).select('_id email role');

      return users;
    },
    async (user) => {
      const userId = user._id;

      // Check for legal holds
      const hasLegalHold = await checkLegalHold(userId);
      if (hasLegalHold) {
        logger.info(`[${userId}] Skipping hard delete - legal hold active`);
        return;
      }

      // Start session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete user bookings
        const bookingDelete = await Booking.deleteMany({
          $or: [{ customerId: userId }, { providerId: userId }],
        }, { session });

        // Delete notifications
        await BookingNotification.deleteMany({
          recipientId: userId,
        }, { session });

        // Delete consent records
        await Consent.deleteMany({
          userId: userId,
        }, { session });

        // Delete data requests
        await DataRequest.deleteMany({
          userId: userId,
        }, { session });

        // Delete customer profile
        await CustomerProfile.deleteMany({
          userId: userId,
        }, { session });

        // Delete provider profile
        await ProviderProfile.deleteMany({
          userId: userId,
        }, { session });

        // Delete wallet
        await Wallet.deleteMany({
          userId: userId,
        }, { session });

        // Delete disputes (user was either initiator or respondent)
        await Dispute.deleteMany({
          $or: [
            { 'initiator.userId': userId },
            { 'respondent.userId': userId },
          ],
        }, { session });

        // Hard delete user
        await User.deleteOne({ _id: userId }, { session });

        await session.commitTransaction();

        // Audit log
        await GdprAuditLog.create({
          userId: userId,
          action: 'data_deletion_completed',
          resource: 'user_profile',
          resourceId: userId.toString(),
          details: {
            reason: 'Automated hard delete after grace period',
            previousEmail: user.email,
            previousRole: user.role,
            deletedCollections: {
              bookings: bookingDelete.deletedCount,
              customerProfile: 1,
              providerProfile: 1,
              wallet: 1,
              disputes: 1,
            },
          },
          timestamp: new Date(),
          complianceId: `auto-deletion-${userId}-${Date.now()}`,
          regulation: 'gdpr',
        });

        logger.info(`[${userId}] Hard deleted after grace period`);
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }
  );
}

/**
 * Job 5: Anonymize old behavioral data
 * Runs: Monthly on 1st at 6:00 AM
 */
async function anonymizeOldBehavioralData(): Promise<CleanupJobResult> {
  const retentionMonths = 24; // 24 months from RETENTION_POLICY
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
  
  return runCleanupJob(
    'anonymizeOldBehavioralData',
    async () => {
      const users = await User.find({
        'aiPersonalization.behaviorData.searchHistory': { $exists: true },
      }).select('_id aiPersonalization');
      
      return users;
    },
    async (user) => {
      // Anonymize search history
      if (user.aiPersonalization?.behaviorData?.searchHistory) {
        const oldHistory = user.aiPersonalization.behaviorData.searchHistory;
        
        const anonymizedHistory = oldHistory.map((entry: any) => ({
          query: hashString(entry.query || ''),
          category: entry.category || null,
          location: null, // Remove location
          timestamp: entry.timestamp,
        }));
        
        await User.updateOne(
          { _id: user._id },
          { $set: { 'aiPersonalization.behaviorData.searchHistory': anonymizedHistory } }
        );
      }
      
      // Anonymize interaction history
      if (user.aiPersonalization?.behaviorData?.interactionHistory) {
        const anonymizedInteractions = {
          profileViews: [], // Remove identifiable profile views
          favoriteActions: user.aiPersonalization.behaviorData.interactionHistory.favoriteActions?.map((action: any) => ({
            action: action.action,
            timestamp: action.timestamp,
            // Remove providerId
          })) || [],
        };
        
        await User.updateOne(
          { _id: user._id },
          { $set: { 'aiPersonalization.behaviorData.interactionHistory': anonymizedInteractions } }
        );
      }
    }
  );
}

/**
 * Job 6: Cleanup old audit logs (within retention period)
 * Runs: Monthly on 15th at 7:00 AM
 */
async function cleanupOldAuditLogs(): Promise<CleanupJobResult> {
  const retentionYears = 7; // 7 years from RETENTION_POLICY
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  return runCleanupJob(
    'cleanupOldAuditLogs',
    async () => {
      const logs = await GdprAuditLog.find({
        createdAt: { $lt: cutoffDate },
      }).select('_id');

      return logs;
    },
    async (log) => {
      await GdprAuditLog.deleteOne({ _id: log._id });
    }
  );
}

/**
 * Job 7: Cleanup expired export files
 * Runs: Daily at 1:00 AM
 * Removes export files older than 7 days
 */
async function cleanupExpiredExportFiles(): Promise<CleanupJobResult> {
  const result: CleanupJobResult = {
    success: true,
    jobName: 'cleanupExpiredExportFiles',
    deleted: 0,
    anonymized: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
  };

  const startTime = Date.now();

  try {
    // Export files expire after 7 days per dataExport.service.ts
    const expiryDays = 7;
    const cutoffTime = Date.now() - (expiryDays * 24 * 60 * 60 * 1000);

    if (!fs.existsSync(EXPORT_DIR)) {
      logger.info('[cleanupExpiredExportFiles] Export directory does not exist, skipping');
      result.duration = Date.now() - startTime;
      return result;
    }

    const files = fs.readdirSync(EXPORT_DIR);
    logger.info(`[cleanupExpiredExportFiles] Found ${files.length} files to check`);

    for (const file of files) {
      try {
        const filePath = path.join(EXPORT_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile() && stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          result.deleted++;
          logger.debug(`[cleanupExpiredExportFiles] Deleted expired export file: ${file}`);
        }
      } catch (error) {
        const errorMsg = `Failed to process file ${file}: ${error}`;
        result.errors.push(errorMsg);
        logger.error(`[cleanupExpiredExportFiles] ${errorMsg}`);
      }
    }

    result.duration = Date.now() - startTime;
    logger.info(`[cleanupExpiredExportFiles] Completed: ${result.deleted} files deleted in ${result.duration}ms`);
  } catch (error) {
    result.success = false;
    result.errors.push(`Job failed: ${error}`);
    logger.error('[cleanupExpiredExportFiles] Job failed', error);
  }

  return result;
}

/**
 * Job 8: Database compaction
 * Runs: Monthly on 1st at 3:00 AM
 * Compacts MongoDB collections to reclaim disk space after data deletion
 *
 * NOTE: This requires MongoDB 4.2+ and appropriate privileges.
 * In production, consider running this during maintenance windows.
 */
async function runDatabaseCompaction(): Promise<CleanupJobResult> {
  const result: CleanupJobResult = {
    success: true,
    jobName: 'runDatabaseCompaction',
    deleted: 0,
    anonymized: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
  };

  const startTime = Date.now();

  try {
    // Collections known to have high deletion rates and benefit from compaction
    const collectionsToCompact = [
      'users',
      'bookings',
      'bookingnotifications',
      'consents',
      'datarequests',
      'customerprofiles',
      'providerprofiles',
      'wallets',
      'disputes',
    ];

    const adminDb = mongoose.connection.db?.admin();
    if (!adminDb) {
      throw new Error('Database connection not available');
    }

    for (const collectionName of collectionsToCompact) {
      try {
        // Use compact command for each collection
        // Note: This is a best-effort approach. In production,
        // consider using MongoDB Atlas maintenance or dedicated compaction scripts.
        logger.info(`[runDatabaseCompaction] Compacting collection: ${collectionName}`);

        const compactResult = await adminDb.command({
          compact: collectionName,
          force: true, // Allows compaction on replica set members
        });

        if (compactResult.ok) {
          logger.info(`[runDatabaseCompaction] Successfully compacted: ${collectionName}`);
          result.deleted++;
        } else {
          logger.warn(`[runDatabaseCompaction] Compact returned non-ok for: ${collectionName}`, compactResult);
        }
      } catch (collectionError) {
        // Collection might not exist or command not supported
        // This is expected for some collections in development
        logger.debug(`[runDatabaseCompaction] Skipping ${collectionName}: ${collectionError}`);
      }
    }

    // Also clean up orphaned documents using a separate approach
    await cleanupOrphanedDocuments(result);

    result.duration = Date.now() - startTime;
    logger.info(`[runDatabaseCompaction] Completed in ${result.duration}ms`);
  } catch (error) {
    result.success = false;
    result.errors.push(`Database compaction failed: ${error}`);
    logger.error('[runDatabaseCompaction] Job failed', error);
    // Don't throw - compaction failure shouldn't stop other jobs
  }

  return result;
}

/**
 * Helper: Clean up orphaned documents
 * Removes documents that reference non-existent users
 */
async function cleanupOrphanedDocuments(result: CleanupJobResult): Promise<void> {
  try {
    // Find bookings with non-existent customers
    const bookings = await Booking.find().select('customerId providerId').lean();
    const userIds = new Set(bookings.flatMap(b => [b.customerId?.toString(), b.providerId?.toString()]));

    const validUsers = new Set(
      (await User.find().select('_id').lean()).map(u => u._id.toString())
    );

    let orphanedCount = 0;
    for (const booking of bookings) {
      const customerId = booking.customerId?.toString();
      const providerId = booking.providerId?.toString();

      if ((customerId && !validUsers.has(customerId)) || (providerId && !validUsers.has(providerId))) {
        await Booking.deleteOne({ _id: (booking as any)._id });
        orphanedCount++;
      }
    }

    if (orphanedCount > 0) {
      result.deleted += orphanedCount;
      logger.info(`[cleanupOrphanedDocuments] Removed ${orphanedCount} orphaned bookings`);
    }
  } catch (error) {
    logger.error('[cleanupOrphanedDocuments] Failed', error);
    result.errors.push(`Orphan cleanup failed: ${error}`);
  }
}

/**
 * Helper: Check if user has legal hold
 */
async function checkLegalHold(userId: mongoose.Types.ObjectId): Promise<boolean> {
  // Check for active data requests
  const activeRequests = await DataRequest.countDocuments({
    userId,
    status: { $in: ['pending', 'processing'] },
  });

  if (activeRequests > 0) return true;

  // Check for pending disputes (user is initiator or respondent)
  const activeDisputes = await Dispute.countDocuments({
    $or: [
      { 'initiator.userId': userId },
      { 'respondent.userId': userId },
    ],
    status: { $in: ['open', 'under_review', 'escalated'] },
  });

  if (activeDisputes > 0) return true;

  return false;
}

/**
 * Helper: Simple string hashing for anonymization
 */
function hashString(input: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

/**
 * Schedule all cleanup jobs
 */
export function scheduleRetentionCleanupJobs(): void {
  logger.info('Scheduling data retention cleanup jobs');

  // Daily jobs
  cron.schedule('0 1 * * *', async () => {
    logger.info('Running daily export file cleanup');
    await cleanupExpiredExportFiles();
  }, {
    timezone: 'UTC',
  });

  cron.schedule('0 2 * * *', async () => {
    logger.info('Running daily session cleanup');
    await cleanupExpiredSessions();
  }, {
    timezone: 'UTC',
  });

  cron.schedule('0 3 * * *', async () => {
    logger.info('Running daily notification cleanup');
    await cleanupOldNotifications();
  }, {
    timezone: 'UTC',
  });

  // Weekly jobs (Sunday)
  cron.schedule('0 4 * * 0', async () => {
    logger.info('Running weekly device token cleanup');
    await cleanupInactiveDeviceTokens();
  }, {
    timezone: 'UTC',
  });

  cron.schedule('0 5 * * 0', async () => {
    logger.info('Running weekly soft-deleted account cleanup');
    await cleanupSoftDeletedAccounts();
  }, {
    timezone: 'UTC',
  });

  // Monthly jobs (1st of month)
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Running monthly database compaction');
    await runDatabaseCompaction();
  }, {
    timezone: 'UTC',
  });

  cron.schedule('0 6 1 * *', async () => {
    logger.info('Running monthly behavioral data anonymization');
    await anonymizeOldBehavioralData();
  }, {
    timezone: 'UTC',
  });

  cron.schedule('0 7 15 * *', async () => {
    logger.info('Running monthly audit log cleanup');
    await cleanupOldAuditLogs();
  }, {
    timezone: 'UTC',
  });

  logger.info('Data retention cleanup jobs scheduled successfully');
}

/**
 * Manual trigger for cleanup jobs (admin use)
 */
export async function runManualCleanup(
  jobName: string
): Promise<CleanupJobResult | null> {
  const jobs: Record<string, () => Promise<CleanupJobResult>> = {
    cleanupExpiredSessions,
    cleanupOldNotifications,
    cleanupInactiveDeviceTokens,
    cleanupSoftDeletedAccounts,
    anonymizeOldBehavioralData,
    cleanupOldAuditLogs,
    cleanupExpiredExportFiles,
    runDatabaseCompaction,
  };

  if (!jobs[jobName]) {
    logger.error(`Unknown cleanup job: ${jobName}`);
    return null;
  }

  logger.info(`Manually triggering cleanup job: ${jobName}`);
  return await jobs[jobName]();
}

/**
 * Get retention statistics
 */
export async function getRetentionStatistics(): Promise<{
  activeAccounts: number;
  softDeletedAccounts: number;
  softDeletedAccountsOverGrace: number;
  oldNotifications: number;
  inactiveDeviceTokens: number;
  legalHolds: number;
}> {
  const gracePeriodDays = 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
  
  const [activeAccounts, softDeletedAccounts, oldNotifications, inactiveTokens, legalHolds] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isDeleted: true }),
    BookingNotification.countDocuments({
      createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    }),
    User.countDocuments({
      'deviceTokens.lastUsed': { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    }),
    DataRequest.countDocuments({
      status: { $in: ['pending', 'processing'] },
    }),
  ]);
  
  const softDeletedAccountsOverGrace = await User.countDocuments({
    isDeleted: true,
    updatedAt: { $lt: cutoffDate },
  });
  
  return {
    activeAccounts,
    softDeletedAccounts,
    softDeletedAccountsOverGrace,
    oldNotifications,
    inactiveDeviceTokens: inactiveTokens,
    legalHolds,
  };
}

export default {
  scheduleRetentionCleanupJobs,
  runManualCleanup,
  getRetentionStatistics,
  cleanupExpiredSessions,
  cleanupOldNotifications,
  cleanupInactiveDeviceTokens,
  cleanupSoftDeletedAccounts,
  anonymizeOldBehavioralData,
  cleanupOldAuditLogs,
  cleanupExpiredExportFiles,
  runDatabaseCompaction,
};
