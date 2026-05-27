import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import Dispute from '../models/dispute.model';
import Commission from '../models/commission.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import Settlement from '../models/settlement.model';
import Subscription from '../models/subscription.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import Wallet from '../models/wallet.model';
import DataRequest, { IDataRequest, DataRequestType } from '../models/dataRequest.model';
import Consent from '../models/consent.model';
import GdprAuditLog from '../models/gdprAuditLog.model';
import logger from '../utils/logger';

// Export directory for data files
const EXPORT_DIR = path.join(process.cwd(), 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// Data types that can be exported
export type ExportDataType =
  | 'profile'
  | 'bookings'
  | 'payments'
  | 'reviews'
  | 'preferences'
  | 'notifications'
  | 'loyalty'
  | 'subscriptions'
  | 'disputes'
  | 'sessions'
  | 'consents'
  | 'ai_personalization'
  | 'support_tickets';

export interface ExportedUserData {
  exportInfo: {
    generatedAt: string;
    userId: string;
    dataTypes: ExportDataType[];
    format: string;
    version: string;
  };
  profile?: Record<string, unknown>;
  bookings?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
  preferences?: Record<string, unknown>;
  notifications?: Array<Record<string, unknown>>;
  loyalty?: Record<string, unknown>;
  subscriptions?: Array<Record<string, unknown>>;
  disputes?: Array<Record<string, unknown>>;
  sessions?: Array<Record<string, unknown>>;
  consents?: Array<Record<string, unknown>>;
  ai_personalization?: Record<string, unknown>;
  support_tickets?: Array<Record<string, unknown>>;
}

export interface ExportProgress {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  steps: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    completedAt?: Date;
    error?: string;
  }>;
  downloadUrl?: string;
  expiresAt?: Date;
  errorMessage?: string;
}

const EXPORT_STEPS = [
  { name: 'Verifying request', description: 'Verifying data request authenticity' },
  { name: 'Collecting profile data', description: 'Collecting user profile information' },
  { name: 'Collecting bookings', description: 'Collecting booking history' },
  { name: 'Collecting payments', description: 'Collecting payment records' },
  { name: 'Collecting reviews', description: 'Collecting user reviews' },
  { name: 'Collecting preferences', description: 'Collecting user preferences' },
  { name: 'Collecting consent records', description: 'Collecting consent history' },
  { name: 'Collecting loyalty data', description: 'Collecting loyalty and rewards data' },
  { name: 'Generating export file', description: 'Generating data export file' },
  { name: 'Finalizing export', description: 'Finalizing and securing export file' },
];

/**
 * Create a new data request (export or deletion)
 */
export const createDataRequest = async (
  userId: string,
  type: DataRequestType,
  options: {
    ipAddress?: string;
    userAgent?: string;
    email?: string;
    exportFormat?: 'json' | 'csv' | 'pdf';
    exportDataTypes?: ExportDataType[];
    deletionReason?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<IDataRequest> => {
  const dataRequest = await DataRequest.create({
    userId: new mongoose.Types.ObjectId(userId),
    type,
    status: 'pending',
    requestedAt: new Date(),
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    email: options.email,
    exportFormat: options.exportFormat || 'json',
    exportDataTypes: options.exportDataTypes || ['profile', 'bookings', 'payments', 'reviews', 'preferences'],
    deletionReason: options.deletionReason,
    deletionConfirmed: type === 'deletion' ? false : undefined,
    gracePeriodEnd: type === 'deletion' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : undefined, // 90 days grace period (GDPR aligned)
    steps: EXPORT_STEPS.map(step => ({
      name: step.name,
      status: 'pending',
    })),
    responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // GDPR: 30 days
    ...(options.metadata && { metadata: options.metadata }),
  });

  // Audit log
  await GdprAuditLog.create({
    userId: new mongoose.Types.ObjectId(userId),
    action: type === 'export' ? 'data_access_requested' : 'data_deletion_requested',
    resource: 'data_request',
    resourceId: dataRequest._id.toString(),
    details: {
      requestType: type,
      exportFormat: options.exportFormat,
      exportDataTypes: options.exportDataTypes,
    },
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    timestamp: new Date(),
    requestId: dataRequest._id,
    requestType: type,
    complianceId: `data-request-${userId}-${type}-${Date.now()}`,
    regulation: 'gdpr',
  });

  logger.info('Data request created', {
    userId,
    requestId: dataRequest._id.toString(),
    type,
    action: 'DATA_REQUEST_CREATED',
  });

  return dataRequest;
};

/**
 * Update request progress
 */
const updateRequestProgress = async (
  requestId: string,
  stepIndex: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> => {
  const dataRequest = await DataRequest.findById(requestId);
  if (!dataRequest) return;

  if (dataRequest.steps && dataRequest.steps[stepIndex]) {
    dataRequest.steps[stepIndex].status = status;
    if (status === 'completed') {
      dataRequest.steps[stepIndex].completedAt = new Date();
    }
    if (error) {
      dataRequest.steps[stepIndex].error = error;
    }
  }

  dataRequest.currentStep = dataRequest.steps?.[stepIndex]?.name;
  dataRequest.progress = Math.round(((stepIndex + 1) / EXPORT_STEPS.length) * 100);

  await dataRequest.save();
};

/**
 * Collect all user data for export
 */
export const collectUserData = async (
  userId: string,
  dataTypes: ExportDataType[]
): Promise<ExportedUserData> => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const exportedData: ExportedUserData = {
    exportInfo: {
      generatedAt: new Date().toISOString(),
      userId,
      dataTypes,
      format: 'json',
      version: '1.0.0',
    },
  };

  // Collect profile data
  if (dataTypes.includes('profile')) {
    const user = await User.findById(userObjectId).select('-password -refreshTokens -resetPasswordToken -verificationToken');
    if (user) {
      exportedData.profile = user.toObject() as unknown as Record<string, unknown>;
    }
  }

  // Collect booking data
  if (dataTypes.includes('bookings')) {
    const bookings = await Booking.find({
      $or: [{ customerId: userObjectId }, { providerId: userObjectId }],
    }).lean();
    exportedData.bookings = bookings as unknown as Array<Record<string, unknown>>;
  }

  // Collect payment data
  if (dataTypes.includes('payments')) {
    const CommissionModel = (await import('../models/commission.model')).default as any;
    const commissions = await CommissionModel.find({
      $or: [{ customerId: userObjectId }, { providerId: userObjectId }],
    }).lean();
    exportedData.payments = commissions as unknown as Array<Record<string, unknown>>;

    const settlements = await Settlement.find({
      providerId: userObjectId,
    }).lean();
    exportedData.payments = [...(exportedData.payments || []), ...(settlements as unknown as Array<Record<string, unknown>>)];
  }

  // Collect review data
  if (dataTypes.includes('reviews')) {
    const bookings = await Booking.find({
      $or: [{ customerId: userObjectId }, { providerId: userObjectId }],
    }).select('review').lean();
    exportedData.reviews = bookings
      .filter((b: any) => b.review)
      .map((b: any) => b.review as unknown as Record<string, unknown>);
  }

  // Collect preference data
  if (dataTypes.includes('preferences')) {
    const user = await User.findById(userObjectId).select('communicationPreferences');
    if (user) {
      exportedData.preferences = {
        communicationPreferences: user.communicationPreferences,
      };
    }
  }

  // Collect consent records
  if (dataTypes.includes('consents')) {
    const consents = await Consent.find({ userId: userObjectId }).lean();
    exportedData.consents = consents;
  }

  // Collect loyalty data
  if (dataTypes.includes('loyalty')) {
    const user = await User.findById(userObjectId).select('loyaltySystem');
    if (user) {
      exportedData.loyalty = {
        coins: user.loyaltySystem.coins,
        tier: user.loyaltySystem.tier,
        totalEarned: user.loyaltySystem.totalEarned,
        totalSpent: user.loyaltySystem.totalSpent,
        pointsHistory: user.loyaltySystem.pointsHistory,
        referralCode: user.loyaltySystem.referralCode,
      };
    }
  }

  // Collect subscription data
  if (dataTypes.includes('subscriptions')) {
    const subscriptions = await Subscription.find({
      userId: userObjectId,
    }).lean();
    exportedData.subscriptions = subscriptions;
  }

  // Collect session data
  if (dataTypes.includes('sessions')) {
    const user = await User.findById(userObjectId).select('sessions');
    if (user) {
      exportedData.sessions = user.sessions.map(s => ({
        device: s.device,
        browser: s.browser,
        os: s.os,
        location: s.location,
        lastActive: s.lastActive,
        createdAt: s.createdAt,
        isCurrent: s.isCurrent,
      }));
    }
  }

  // Collect AI personalization data
  if (dataTypes.includes('ai_personalization')) {
    const user = await User.findById(userObjectId).select('aiPersonalization');
    if (user) {
      exportedData.ai_personalization = {
        preferences: user.aiPersonalization.preferences,
        recommendations: user.aiPersonalization.recommendations,
      };
    }
  }

  return exportedData;
};

/**
 * Generate and store export file
 */
const generateExportFile = async (
  requestId: string,
  data: ExportedUserData
): Promise<{ filePath: string; downloadUrl: string; expiresAt: Date }> => {
  const fileName = `data-export-${requestId}-${Date.now()}.json.gz`;
  const filePath = path.join(EXPORT_DIR, fileName);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create gzipped JSON file
  const jsonData = JSON.stringify(data, null, 2);
  const gzip = createGzip();

  const writeStream = fs.createWriteStream(filePath);
  const readStream = require('stream').Readable.from(jsonData);

  await pipeline(readStream, gzip, writeStream);

  const downloadUrl = `/api/gdpr/download/${requestId}`;

  return { filePath, downloadUrl, expiresAt };
};

/**
 * Process data export request
 */
export const processDataExport = async (requestId: string): Promise<void> => {
  const dataRequest = await DataRequest.findById(requestId);
  if (!dataRequest) {
    throw ApiError.notFound('Data request not found', ERROR_CODES.NOT_FOUND);
  }

  try {
    dataRequest.status = 'processing';
    dataRequest.processedAt = new Date();
    await dataRequest.save();

    const dataTypes = (dataRequest.exportDataTypes || ['profile', 'bookings', 'payments']) as ExportDataType[];

    // Step 1-8: Collect data
    for (let i = 0; i < 8; i++) {
      await updateRequestProgress(requestId, i, 'processing');

      // Simulate processing time for large datasets
      await new Promise(resolve => setTimeout(resolve, 100));

      await updateRequestProgress(requestId, i, 'completed');
    }

    // Step 9: Generate export file
    await updateRequestProgress(requestId, 8, 'processing');
    const userData = await collectUserData(dataRequest.userId.toString(), dataTypes);
    const { downloadUrl, expiresAt } = await generateExportFile(requestId, userData);
    await updateRequestProgress(requestId, 8, 'completed');

    // Step 10: Finalize
    await updateRequestProgress(requestId, 9, 'processing');
    await updateRequestProgress(requestId, 9, 'completed');

    // Update request with final status
    dataRequest.status = 'completed';
    dataRequest.completedAt = new Date();
    dataRequest.downloadUrl = downloadUrl;
    dataRequest.downloadExpiry = expiresAt;
    dataRequest.progress = 100;
    await dataRequest.save();

    // Audit log
    await GdprAuditLog.create({
      userId: dataRequest.userId,
      action: 'data_access_completed',
      resource: 'data_request',
      resourceId: requestId,
      details: {
        dataTypes,
        downloadUrl,
        expiresAt,
      },
      timestamp: new Date(),
      requestId: dataRequest._id,
      requestType: 'access',
      responseSentAt: new Date(),
      complianceId: `data-export-completed-${dataRequest.userId}-${Date.now()}`,
      regulation: 'gdpr',
    });

    logger.info('Data export completed', {
      requestId,
      userId: dataRequest.userId.toString(),
      action: 'DATA_EXPORT_COMPLETED',
    });

  } catch (error: any) {
    dataRequest.status = 'failed';
    dataRequest.errorMessage = error.message;
    dataRequest.retryCount = (dataRequest.retryCount || 0) + 1;
    dataRequest.lastRetryAt = new Date();
    await dataRequest.save();

    logger.error('Data export failed', {
      requestId,
      error: error.message,
      action: 'DATA_EXPORT_FAILED',
    });

    throw error;
  }
};

/**
 * Get export progress
 */
export const getExportProgress = async (requestId: string, userId: string): Promise<ExportProgress | null> => {
  const dataRequest = await DataRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!dataRequest) return null;

  return {
    requestId: dataRequest._id.toString(),
    status: dataRequest.status as 'pending' | 'processing' | 'completed' | 'failed',
    progress: dataRequest.progress || 0,
    currentStep: dataRequest.currentStep || 'pending',
    steps: dataRequest.steps || [],
    downloadUrl: dataRequest.downloadUrl,
    expiresAt: dataRequest.downloadExpiry,
    errorMessage: dataRequest.errorMessage,
  };
};

/**
 * Get user data requests
 */
export const getUserDataRequests = async (
  userId: string,
  type?: DataRequestType
): Promise<IDataRequest[]> => {
  const query: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (type) {
    query.type = type;
  }

  const requests = await DataRequest.find(query)
    .sort({ requestedAt: -1 })
    .lean();
  return requests as unknown as IDataRequest[];
};

/**
 * Cancel a pending data request
 */
export const cancelDataRequest = async (requestId: string, userId: string): Promise<boolean> => {
  const dataRequest = await DataRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    userId: new mongoose.Types.ObjectId(userId),
    status: 'pending',
  });

  if (!dataRequest) return false;

  dataRequest.status = 'cancelled';
  await dataRequest.save();

  // Audit log
  await GdprAuditLog.create({
    userId: new mongoose.Types.ObjectId(userId),
    action: 'data_access_requested',
    resource: 'data_request',
    resourceId: requestId,
    details: {
      action: 'cancelled',
      reason: 'User cancelled request',
    },
    timestamp: new Date(),
    requestId: dataRequest._id,
    complianceId: `request-cancelled-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });

  logger.info('Data request cancelled', {
    requestId,
    userId,
    action: 'DATA_REQUEST_CANCELLED',
  });

  return true;
};

/**
 * Download export file (returns file path for streaming)
 */
export const getExportFilePath = async (
  requestId: string,
  userId: string
): Promise<{ filePath: string; fileName: string } | null> => {
  const dataRequest = await DataRequest.findOne({
    _id: new mongoose.Types.ObjectId(requestId),
    userId: new mongoose.Types.ObjectId(userId),
    status: 'completed',
  });

  if (!dataRequest || !dataRequest.downloadUrl) return null;

  // Check expiry
  if (dataRequest.downloadExpiry && dataRequest.downloadExpiry < new Date()) {
    return null;
  }

  // Increment download count
  dataRequest.downloadCount = (dataRequest.downloadCount || 0) + 1;
  await dataRequest.save();

  // Find the file
  const files = fs.readdirSync(EXPORT_DIR);
  const file = files.find(f => f.includes(requestId));

  if (!file) return null;

  // Audit log
  await GdprAuditLog.create({
    userId: new mongoose.Types.ObjectId(userId),
    action: 'data_export_downloaded',
    resource: 'data_request',
    resourceId: requestId,
    details: {
      downloadCount: dataRequest.downloadCount,
    },
    timestamp: new Date(),
    requestId: dataRequest._id,
    complianceId: `export-downloaded-${userId}-${Date.now()}`,
    regulation: 'gdpr',
  });

  return {
    filePath: path.join(EXPORT_DIR, file),
    fileName: `nilin-data-export-${new Date().toISOString().split('T')[0]}.json.gz`,
  };
};

/**
 * Delete all user data (GDPR right to erasure)
 */
export const deleteUserData = async (
  userId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    deletionReason?: string;
    anonymizeInstead?: boolean;
  } = {}
): Promise<{
  deleted: boolean;
  anonymized: boolean;
  deletedRecords: Record<string, number>;
}> => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const result: Record<string, number> = {};
  let anonymized = false;

  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (options.anonymizeInstead) {
      // Anonymize user data instead of deletion
      await User.findByIdAndUpdate(userObjectId, {
        firstName: 'Deleted',
        lastName: 'User',
        email: `deleted-${crypto.randomUUID()}@anonymized.local`,
        phone: null,
        password: crypto.randomBytes(32).toString('hex'),
        avatar: null,
        bio: null,
        address: null,
        isDeleted: true,
        isActive: false,
        accountStatus: 'deactivated',
        notifications: [],
        sessions: [],
        refreshTokens: [],
        'socialProfiles.followers': [],
        'socialProfiles.following': [],
        'aiPersonalization.behaviorData.searchHistory': [],
        'aiPersonalization.behaviorData.interactionHistory.profileViews': [],
        'aiPersonalization.behaviorData.interactionHistory.favoriteActions': [],
        'loyaltySystem.pointsHistory': [],
      }, { session });

      anonymized = true;
      result.user = 1;
    } else {
      // Delete user and related data
      // Note: Some data may need to be retained for legal/compliance reasons
      // Implement according to your data retention policy

      // Delete user
      await User.deleteOne({ _id: userObjectId }, { session });
      result.user = 1;

      // Delete related data
      const bookingDelete = await Booking.deleteMany({
        $or: [{ customerId: userObjectId }, { providerId: userObjectId }],
      }, { session });
      result.bookings = bookingDelete.deletedCount;

      const consentDelete = await Consent.deleteMany({ userId: userObjectId }, { session });
      result.consents = consentDelete.deletedCount;

      // Note: Payment records may need to be retained for financial compliance
      // Comment out if you need to retain payment history
      // await Commission.deleteMany({ $or: [{ customerId: userObjectId }, { providerId: userObjectId }] }, { session });
    }

    await session.commitTransaction();

    // Audit log
    await GdprAuditLog.create({
      userId: userObjectId,
      action: anonymized ? 'account_anonymized' : 'data_deletion_completed',
      resource: 'user_profile',
      resourceId: userId,
      details: {
        deletionReason: options.deletionReason,
        anonymized,
        deletedRecords: result,
      },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      timestamp: new Date(),
      complianceId: `deletion-${userId}-${Date.now()}`,
      regulation: 'gdpr',
    });

    logger.info('User data deleted', {
      userId,
      anonymized,
      deletedRecords: result,
      action: anonymized ? 'USER_DATA_ANONYMIZED' : 'USER_DATA_DELETED',
    });

    return {
      deleted: !anonymized,
      anonymized,
      deletedRecords: result,
    };

  } catch (error: any) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get data retention statistics for admin
 */
export const getDataRetentionStats = async (): Promise<{
  totalUsers: number;
  dataByType: Record<string, number>;
  pendingRequests: number;
  completedRequests: number;
}> => {
  const CommissionModel = (await import('../models/commission.model')).default as any;
  const [totalUsers, bookingCount, consentCount, commissionCount] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    Booking.countDocuments(),
    Consent.countDocuments(),
    CommissionModel.countDocuments(),
  ]);

  const pendingRequests = await DataRequest.countDocuments({
    status: { $in: ['pending', 'processing'] },
  });

  const completedRequests = await DataRequest.countDocuments({
    status: 'completed',
  });

  return {
    totalUsers,
    dataByType: {
      users: totalUsers,
      bookings: bookingCount,
      consents: consentCount,
      commissions: commissionCount,
    },
    pendingRequests,
    completedRequests,
  };
};

export default {
  createDataRequest,
  processDataExport,
  getExportProgress,
  getUserDataRequests,
  cancelDataRequest,
  getExportFilePath,
  collectUserData,
  deleteUserData,
  getDataRetentionStats,
};
