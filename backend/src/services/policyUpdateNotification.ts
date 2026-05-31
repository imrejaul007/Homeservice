import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type NotificationStatus = 'pending' | 'sent' | 'read' | 'acknowledged' | 'dismissed';
export type PolicyType = 'terms_of_service' | 'privacy_policy' | 'cookie_policy' | 'provider_guidelines' | 'service_agreement';
export type ChangeSeverity = 'minor' | 'moderate' | 'major' | 'critical';

export interface PolicyChange {
  _id?: Types.ObjectId;
  policyType: PolicyType;
  version: string;
  title: string;
  summary: string;
  changes: Array<{
    section: string;
    previousText?: string;
    newText: string;
    changeType: 'added' | 'removed' | 'modified';
    severity: ChangeSeverity;
  }>;
  effectiveDate: Date;
  isMandatory: boolean;
  requiresReacknowledgment: boolean;
  createdBy: Types.ObjectId;
  createdAt?: Date;
}

export interface ProviderPolicyNotification {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  policyChangeId: Types.ObjectId;
  status: NotificationStatus;
  notifiedAt: Date;
  readAt?: Date;
  acknowledgedAt?: Date;
  acknowledgmentConfirmed: boolean;
  reminderCount: number;
  lastReminderAt?: Date;
  nextReminderAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PolicyVersionHistory {
  _id?: Types.ObjectId;
  policyType: PolicyType;
  version: string;
  content: string;
  changesSummary: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  createdAt?: Date;
}

export interface CreatePolicyChangeInput {
  policyType: PolicyType;
  version: string;
  title: string;
  summary: string;
  changes: PolicyChange['changes'];
  effectiveDate: Date;
  isMandatory?: boolean;
  requiresReacknowledgment?: boolean;
}

// ============================================
// Mongoose Interfaces
// ============================================

interface IPolicyChange extends Document, Omit<PolicyChange, '_id'> {}
interface IProviderPolicyNotification extends Document, Omit<ProviderPolicyNotification, '_id'> {}
interface IPolicyVersionHistory extends Document, Omit<PolicyVersionHistory, '_id'> {}

// ============================================
// Mongoose Schemas
// ============================================

const ChangeSchema = new mongoose.Schema({
  section: { type: String, required: true },
  previousText: { type: String },
  newText: { type: String, required: true },
  changeType: { type: String, enum: ['added', 'removed', 'modified'], required: true },
  severity: { type: String, enum: ['minor', 'moderate', 'major', 'critical'], required: true },
}, { _id: false });

const PolicyChangeSchema = new mongoose.Schema({
  policyType: {
    type: String,
    enum: ['terms_of_service', 'privacy_policy', 'cookie_policy', 'provider_guidelines', 'service_agreement'],
    required: true,
  },
  version: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  summary: { type: String, required: true },
  changes: { type: [ChangeSchema], required: true },
  effectiveDate: { type: Date, required: true },
  isMandatory: { type: Boolean, default: true },
  requiresReacknowledgment: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
  collection: 'policy_changes',
});

PolicyChangeSchema.index({ policyType: 1, version: 1 }, { unique: true });
PolicyChangeSchema.index({ effectiveDate: 1 });
PolicyChangeSchema.index({ createdAt: -1 });

const ProviderPolicyNotificationSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyChangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PolicyChange', required: true },
  status: {
    type: String,
    enum: ['pending', 'sent', 'read', 'acknowledged', 'dismissed'],
    default: 'pending',
  },
  notifiedAt: { type: Date, default: Date.now },
  readAt: { type: Date },
  acknowledgedAt: { type: Date },
  acknowledgmentConfirmed: { type: Boolean, default: false },
  reminderCount: { type: Number, default: 0 },
  lastReminderAt: { type: Date },
  nextReminderAt: { type: Date },
  expiresAt: { type: Date },
}, {
  timestamps: true,
  collection: 'provider_policy_notifications',
});

ProviderPolicyNotificationSchema.index({ providerId: 1, policyChangeId: 1 }, { unique: true });
ProviderPolicyNotificationSchema.index({ providerId: 1, status: 1 });
ProviderPolicyNotificationSchema.index({ status: 1 });
ProviderPolicyNotificationSchema.index({ nextReminderAt: 1 });

const PolicyVersionHistorySchema = new mongoose.Schema({
  policyType: {
    type: String,
    enum: ['terms_of_service', 'privacy_policy', 'cookie_policy', 'provider_guidelines', 'service_agreement'],
    required: true,
  },
  version: { type: String, required: true },
  content: { type: String, required: true },
  changesSummary: { type: String, required: true },
  effectiveFrom: { type: Date, required: true },
  effectiveUntil: { type: Date },
}, {
  timestamps: true,
  collection: 'policy_version_history',
});

PolicyVersionHistorySchema.index({ policyType: 1, version: 1 }, { unique: true });
PolicyVersionHistorySchema.index({ policyType: 1, effectiveFrom: -1 });

// ============================================
// Model Registration
// ============================================

export const PolicyChangeModel = mongoose.models.PolicyChange ||
  mongoose.model<IPolicyChange>('PolicyChange', PolicyChangeSchema);
export const ProviderPolicyNotificationModel = mongoose.models.ProviderPolicyNotification ||
  mongoose.model<IProviderPolicyNotification>('ProviderPolicyNotification', ProviderPolicyNotificationSchema);
export const PolicyVersionHistoryModel = mongoose.models.PolicyVersionHistory ||
  mongoose.model<IPolicyVersionHistory>('PolicyVersionHistory', PolicyVersionHistorySchema);

// ============================================
// Service Class
// ============================================

export class PolicyUpdateNotificationService {

  // Reminder schedule (in days)
  private readonly REMINDER_SCHEDULE = [1, 3, 7];

  // ========================================
  // Policy Change Management
  // ========================================

  /**
   * Create a new policy change
   */
  async createPolicyChange(input: CreatePolicyChangeInput, createdBy: string): Promise<IPolicyChange> {
    const {
      policyType,
      version,
      title,
      summary,
      changes,
      effectiveDate,
      isMandatory,
      requiresReacknowledgment,
    } = input;

    if (!Types.ObjectId.isValid(createdBy)) {
      throw ApiError.badRequest('Invalid creator ID');
    }

    // Check for duplicate version
    const existing = await PolicyChangeModel.findOne({ policyType, version });
    if (existing) {
      throw ApiError.conflict('Policy version already exists');
    }

    const policyChange = new PolicyChangeModel({
      policyType,
      version,
      title,
      summary,
      changes,
      effectiveDate,
      isMandatory: isMandatory ?? true,
      requiresReacknowledgment: requiresReacknowledgment ?? true,
      createdBy: new Types.ObjectId(createdBy),
    });

    await policyChange.save();

    logger.info('Policy change created', {
      context: 'PolicyUpdateNotificationService',
      action: 'POLICY_CHANGE_CREATED',
      policyChangeId: policyChange._id.toString(),
      policyType,
      version,
    });

    eventBus.publish(EVENT_TYPES.POLICY_CHANGE_CREATED, {
      policyChangeId: policyChange._id,
      policyType,
      version,
      effectiveDate,
    });

    return policyChange;
  }

  /**
   * Get policy change by ID
   */
  async getPolicyChangeById(changeId: string): Promise<IPolicyChange | null> {
    if (!Types.ObjectId.isValid(changeId)) {
      throw ApiError.badRequest('Invalid change ID');
    }
    return PolicyChangeModel.findById(changeId)
      .populate('createdBy', 'firstName lastName email');
  }

  /**
   * Get active policy change for a type
   */
  async getActivePolicyChange(policyType: PolicyType): Promise<IPolicyChange | null> {
    const now = new Date();

    return PolicyChangeModel.findOne({
      policyType,
      effectiveDate: { $lte: now },
    }).sort({ effectiveDate: -1, createdAt: -1 });
  }

  /**
   * Get all policy changes
   */
  async getPolicyChanges(options: {
    policyType?: PolicyType;
    page?: number;
    limit?: number;
  } = {}): Promise<{ changes: IPolicyChange[]; total: number; page: number; pages: number }> {
    const { policyType, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (policyType) query.policyType = policyType;

    const [changes, total] = await Promise.all([
      PolicyChangeModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PolicyChangeModel.countDocuments(query),
    ]);

    return {
      changes,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ========================================
  // Notification Management
  // ========================================

  /**
   * Send policy notifications to all providers
   */
  async sendNotificationsToProviders(policyChangeId: string): Promise<number> {
    if (!Types.ObjectId.isValid(policyChangeId)) {
      throw ApiError.badRequest('Invalid policy change ID');
    }

    const policyChange = await PolicyChangeModel.findById(policyChangeId);
    if (!policyChange) {
      throw ApiError.notFound('Policy change not found');
    }

    // Get all active providers
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}));
    const providers = await User.find({ role: 'provider', isActive: true }).select('_id');

    const notifications: IProviderPolicyNotification[] = [];
    const now = new Date();

    for (const provider of providers) {
      // Check if notification already exists
      const existing = await ProviderPolicyNotificationModel.findOne({
        providerId: provider._id,
        policyChangeId: new Types.ObjectId(policyChangeId),
      });

      if (existing) continue;

      // Calculate next reminder date
      const nextReminder = new Date(now);
      nextReminder.setDate(nextReminder.getDate() + this.REMINDER_SCHEDULE[0]);

      notifications.push(new ProviderPolicyNotificationModel({
        providerId: provider._id,
        policyChangeId: new Types.ObjectId(policyChangeId),
        status: 'pending',
        notifiedAt: now,
        acknowledgmentConfirmed: false,
        reminderCount: 0,
        nextReminderAt: nextReminder,
        expiresAt: policyChange.effectiveDate,
      }));
    }

    if (notifications.length > 0) {
      await ProviderPolicyNotificationModel.insertMany(notifications);
    }

    logger.info('Policy notifications sent', {
      context: 'PolicyUpdateNotificationService',
      action: 'NOTIFICATIONS_SENT',
      policyChangeId,
      providerCount: notifications.length,
    });

    eventBus.publish(EVENT_TYPES.POLICY_NOTIFICATIONS_SENT, {
      policyChangeId,
      providerCount: notifications.length,
    });

    return notifications.length;
  }

  /**
   * Send notification to specific providers
   */
  async sendNotificationsToProvidersList(policyChangeId: string, providerIds: string[]): Promise<number> {
    if (!Types.ObjectId.isValid(policyChangeId)) {
      throw ApiError.badRequest('Invalid policy change ID');
    }

    const notifications: IProviderPolicyNotification[] = [];
    const now = new Date();

    for (const providerId of providerIds) {
      if (!Types.ObjectId.isValid(providerId)) continue;

      const existing = await ProviderPolicyNotificationModel.findOne({
        providerId: new Types.ObjectId(providerId),
        policyChangeId: new Types.ObjectId(policyChangeId),
      });

      if (existing) continue;

      notifications.push(new ProviderPolicyNotificationModel({
        providerId: new Types.ObjectId(providerId),
        policyChangeId: new Types.ObjectId(policyChangeId),
        status: 'pending',
        notifiedAt: now,
        acknowledgmentConfirmed: false,
        reminderCount: 0,
        nextReminderAt: new Date(now.getTime() + this.REMINDER_SCHEDULE[0] * 24 * 60 * 60 * 1000),
      }));
    }

    if (notifications.length > 0) {
      await ProviderPolicyNotificationModel.insertMany(notifications);
    }

    return notifications.length;
  }

  /**
   * Get provider's policy notifications
   */
  async getProviderNotifications(
    providerId: string,
    options: {
      status?: NotificationStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ notifications: IProviderPolicyNotification[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { providerId: new Types.ObjectId(providerId) };
    if (status) query.status = status;

    const [notifications, total] = await Promise.all([
      ProviderPolicyNotificationModel.find(query)
        .populate('policyChangeId')
        .sort({ notifiedAt: -1 })
        .skip(skip)
        .limit(limit),
      ProviderPolicyNotificationModel.countDocuments(query),
    ]);

    return {
      notifications,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get pending acknowledgments for a provider
   */
  async getPendingAcknowledgments(providerId: string): Promise<IProviderPolicyNotification[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    return ProviderPolicyNotificationModel.find({
      providerId: new Types.ObjectId(providerId),
      status: { $in: ['pending', 'sent', 'read'] },
    })
      .populate('policyChangeId')
      .sort({ notifiedAt: -1 });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, providerId: string): Promise<IProviderPolicyNotification> {
    if (!Types.ObjectId.isValid(notificationId) || !Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const notification = await ProviderPolicyNotificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      providerId: new Types.ObjectId(providerId),
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    notification.status = 'read';
    notification.readAt = new Date();
    await notification.save();

    logger.info('Policy notification marked as read', {
      context: 'PolicyUpdateNotificationService',
      action: 'NOTIFICATION_READ',
      notificationId,
      providerId,
    });

    return notification;
  }

  /**
   * Acknowledge policy change
   */
  async acknowledgePolicyChange(
    notificationId: string,
    providerId: string,
    confirmation: boolean = true
  ): Promise<IProviderPolicyNotification> {
    if (!Types.ObjectId.isValid(notificationId) || !Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const notification = await ProviderPolicyNotificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      providerId: new Types.ObjectId(providerId),
    }).populate('policyChangeId');

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    const policyChange = notification.policyChangeId as unknown as IPolicyChange;

    if (policyChange.requiresReacknowledgment && !confirmation) {
      throw ApiError.badRequest('Acknowledgment confirmation is required');
    }

    notification.status = 'acknowledged';
    notification.acknowledgedAt = new Date();
    notification.acknowledgmentConfirmed = confirmation;
    notification.nextReminderAt = undefined;
    await notification.save();

    logger.info('Policy change acknowledged', {
      context: 'PolicyUpdateNotificationService',
      action: 'POLICY_ACKNOWLEDGED',
      notificationId,
      providerId,
      confirmed: confirmation,
    });

    eventBus.publish(EVENT_TYPES.POLICY_ACKNOWLEDGED, {
      notificationId,
      providerId,
      policyChangeId: policyChange._id,
    });

    return notification;
  }

  /**
   * Dismiss notification (optional acknowledgment)
   */
  async dismissNotification(notificationId: string, providerId: string): Promise<IProviderPolicyNotification> {
    if (!Types.ObjectId.isValid(notificationId) || !Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const notification = await ProviderPolicyNotificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      providerId: new Types.ObjectId(providerId),
    }).populate('policyChangeId');

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    const policyChange = notification.policyChangeId as unknown as IPolicyChange;

    // Check if policy requires mandatory acknowledgment
    if (policyChange.isMandatory && policyChange.requiresReacknowledgment) {
      throw ApiError.badRequest('This policy requires acknowledgment and cannot be dismissed');
    }

    notification.status = 'dismissed';
    notification.acknowledgedAt = new Date();
    notification.acknowledgmentConfirmed = false;
    await notification.save();

    logger.info('Policy notification dismissed', {
      context: 'PolicyUpdateNotificationService',
      action: 'NOTIFICATION_DISMISSED',
      notificationId,
      providerId,
    });

    return notification;
  }

  // ========================================
  // Reminder Management
  // ========================================

  /**
   * Send reminders for pending acknowledgments
   */
  async sendReminders(): Promise<number> {
    const now = new Date();

    // Find notifications due for reminder
    const dueNotifications = await ProviderPolicyNotificationModel.find({
      status: { $in: ['pending', 'sent', 'read'] },
      nextReminderAt: { $lte: now },
    }).populate('policyChangeId');

    let reminderCount = 0;

    for (const notification of dueNotifications) {
      const policyChange = notification.policyChangeId as unknown as IPolicyChange;

      // Don't send reminders for optional policies
      if (!policyChange.isMandatory && !policyChange.requiresReacknowledgment) {
        continue;
      }

      // Increment reminder count
      notification.reminderCount += 1;
      notification.lastReminderAt = now;

      // Schedule next reminder or clear if max reached
      if (notification.reminderCount < this.REMINDER_SCHEDULE.length) {
        const nextDays = this.REMINDER_SCHEDULE[notification.reminderCount];
        const nextReminder = new Date(now);
        nextReminder.setDate(nextReminder.getDate() + nextDays);
        notification.nextReminderAt = nextReminder;
      } else {
        notification.nextReminderAt = undefined;
      }

      await notification.save();
      reminderCount++;

      // Emit event for sending notification
      eventBus.publish(EVENT_TYPES.POLICY_REMINDER_SENT, {
        notificationId: notification._id,
        providerId: notification.providerId,
        reminderNumber: notification.reminderCount,
      });
    }

    logger.info('Policy reminders processed', {
      context: 'PolicyUpdateNotificationService',
      action: 'REMINDERS_PROCESSED',
      reminderCount,
    });

    return reminderCount;
  }

  // ========================================
  // Version History
  // ========================================

  /**
   * Get version history for a policy type
   */
  async getVersionHistory(
    policyType: PolicyType
  ): Promise<IPolicyVersionHistory[]> {
    return PolicyVersionHistoryModel.find({ policyType })
      .sort({ effectiveFrom: -1 });
  }

  /**
   * Archive policy version to history
   */
  async archivePolicyVersion(
    policyType: PolicyType,
    version: string,
    content: string,
    changesSummary: string,
    effectiveFrom: Date
  ): Promise<IPolicyVersionHistory> {
    // Mark previous version as ended
    await PolicyVersionHistoryModel.updateMany(
      {
        policyType,
        effectiveUntil: { $exists: false },
      },
      {
        effectiveUntil: effectiveFrom,
      }
    );

    const history = new PolicyVersionHistoryModel({
      policyType,
      version,
      content,
      changesSummary,
      effectiveFrom,
    });

    await history.save();

    logger.info('Policy version archived', {
      context: 'PolicyUpdateNotificationService',
      action: 'VERSION_ARCHIVED',
      policyType,
      version,
    });

    return history;
  }

  // ========================================
  // Analytics & Reporting
  // ========================================

  /**
   * Get notification statistics
   */
  async getNotificationStats(policyChangeId?: string): Promise<{
    totalSent: number;
    totalRead: number;
    totalAcknowledged: number;
    totalDismissed: number;
    pendingAcknowledgment: number;
    averageAcknowledgmentTime: number; // in hours
    reminderStats: { sent: number; byLevel: Record<number, number> };
  }> {
    const matchStage: Record<string, unknown> = {};
    if (policyChangeId) {
      matchStage.policyChangeId = new Types.ObjectId(policyChangeId);
    }

    const stats = await ProviderPolicyNotificationModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts: Record<string, number> = {};
    let total = 0;

    for (const s of stats) {
      statusCounts[s._id] = s.count;
      total += s.count;
    }

    // Calculate average acknowledgment time
    const ackTimes = await ProviderPolicyNotificationModel.aggregate([
      {
        $match: {
          ...matchStage,
          acknowledgedAt: { $exists: true },
        },
      },
      {
        $project: {
          ackTime: {
            $divide: [
              { $subtract: ['$acknowledgedAt', '$notifiedAt'] },
              3600000, // Convert to hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$ackTime' },
        },
      },
    ]);

    // Get reminder stats
    const reminderStats = await ProviderPolicyNotificationModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$reminderCount',
          count: { $sum: 1 },
        },
      },
    ]);

    const reminderByLevel: Record<number, number> = {};
    let totalReminders = 0;
    for (const r of reminderStats) {
      reminderByLevel[r._id] = r.count;
      totalReminders += r._id * r.count;
    }

    return {
      totalSent: total,
      totalRead: statusCounts['read'] || 0,
      totalAcknowledged: statusCounts['acknowledged'] || 0,
      totalDismissed: statusCounts['dismissed'] || 0,
      pendingAcknowledgment: (statusCounts['pending'] || 0) + (statusCounts['sent'] || 0) + (statusCounts['read'] || 0),
      averageAcknowledgmentTime: Math.round((ackTimes[0]?.avgTime || 0) * 100) / 100,
      reminderStats: {
        sent: totalReminders,
        byLevel: reminderByLevel,
      },
    };
  }

  /**
   * Get providers who haven't acknowledged mandatory policies
   */
  async getNonCompliantProviders(policyChangeId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(policyChangeId)) {
      throw ApiError.badRequest('Invalid policy change ID');
    }

    const notifications = await ProviderPolicyNotificationModel.find({
      policyChangeId: new Types.ObjectId(policyChangeId),
      status: { $in: ['pending', 'sent', 'read'] },
    }).populate('policyChangeId');

    const nonCompliant: string[] = [];

    for (const n of notifications) {
      const policyChange = n.policyChangeId as unknown as IPolicyChange;
      if (policyChange.isMandatory && policyChange.requiresReacknowledgment) {
        nonCompliant.push(n.providerId.toString());
      }
    }

    return nonCompliant;
  }
}

// ============================================
// Export Singleton
// ============================================

export const policyUpdateNotificationService = new PolicyUpdateNotificationService();
export default policyUpdateNotificationService;
