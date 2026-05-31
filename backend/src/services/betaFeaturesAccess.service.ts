import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type FeatureStatus = 'development' | 'beta' | 'rolling_out' | 'released' | 'deprecated';
export type AccessLevel = 'none' | 'waitlist' | 'beta' | 'graduated';
export type FeedbackType = 'bug_report' | 'feature_feedback' | 'general' | 'improvement';

export interface BetaFeature {
  _id?: Types.ObjectId;
  featureKey: string;
  name: string;
  description: string;
  status: FeatureStatus;
  rolloutPercentage: number;
  requiredRoles?: string[];
  requiredTiers?: string[];
  graduatedAt?: Date;
  maxParticipants?: number;
  currentParticipants: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProviderBetaAccess {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  featureKey: string;
  accessLevel: AccessLevel;
  optedInAt?: Date;
  optedOutAt?: Date;
  graduatedAt?: Date;
  usageStats: {
    firstUsedAt?: Date;
    lastUsedAt?: Date;
    usageCount: number;
  };
  feedbackCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BetaFeedback {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  featureKey: string;
  type: FeedbackType;
  rating?: number; // 1-5
  title: string;
  content: string;
  screenshots?: string[];
  attachments?: string[];
  status: 'new' | 'reviewed' | 'implemented' | 'dismissed';
  adminResponse?: {
    content: string;
    respondedAt: Date;
    respondedBy: Types.ObjectId;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateFeatureInput {
  featureKey: string;
  name: string;
  description: string;
  status?: FeatureStatus;
  rolloutPercentage?: number;
  requiredRoles?: string[];
  requiredTiers?: string[];
  maxParticipants?: number;
  metadata?: Record<string, unknown>;
}

export interface SubmitFeedbackInput {
  providerId: string;
  featureKey: string;
  type: FeedbackType;
  rating?: number;
  title: string;
  content: string;
  screenshots?: string[];
  attachments?: string[];
}

// ============================================
// Mongoose Interfaces
// ============================================

interface IBetaFeature extends Document, Omit<BetaFeature, '_id'> {}
interface IProviderBetaAccess extends Document, Omit<ProviderBetaAccess, '_id'> {}
interface IBetaFeedback extends Document, Omit<BetaFeedback, '_id'> {}

// ============================================
// Mongoose Schemas
// ============================================

const BetaFeatureSchema = new mongoose.Schema({
  featureKey: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['development', 'beta', 'rolling_out', 'released', 'deprecated'],
    default: 'beta',
  },
  rolloutPercentage: { type: Number, default: 0, min: 0, max: 100 },
  requiredRoles: [{ type: String }],
  requiredTiers: [{ type: String }],
  graduatedAt: { type: Date },
  maxParticipants: { type: Number },
  currentParticipants: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
  collection: 'beta_features',
});

BetaFeatureSchema.index({ status: 1 });
BetaFeatureSchema.index({ featureKey: 1 }, { unique: true });

const ProviderBetaAccessSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  featureKey: { type: String, required: true },
  accessLevel: {
    type: String,
    enum: ['none', 'waitlist', 'beta', 'graduated'],
    default: 'none',
  },
  optedInAt: { type: Date },
  optedOutAt: { type: Date },
  graduatedAt: { type: Date },
  usageStats: {
    firstUsedAt: { type: Date },
    lastUsedAt: { type: Date },
    usageCount: { type: Number, default: 0 },
  },
  feedbackCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'provider_beta_access',
});

ProviderBetaAccessSchema.index({ providerId: 1, featureKey: 1 }, { unique: true });
ProviderBetaAccessSchema.index({ featureKey: 1, accessLevel: 1 });
ProviderBetaAccessSchema.index({ providerId: 1, accessLevel: 1 });

const AdminResponseSchema = new mongoose.Schema({
  content: { type: String, required: true },
  respondedAt: { type: Date, required: true },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: false });

const BetaFeedbackSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  featureKey: { type: String, required: true },
  type: {
    type: String,
    enum: ['bug_report', 'feature_feedback', 'general', 'improvement'],
    required: true,
  },
  rating: { type: Number, min: 1, max: 5 },
  title: { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true, maxlength: 5000 },
  screenshots: [{ type: String }],
  attachments: [{ type: String }],
  status: {
    type: String,
    enum: ['new', 'reviewed', 'implemented', 'dismissed'],
    default: 'new',
  },
  adminResponse: { type: AdminResponseSchema },
}, {
  timestamps: true,
  collection: 'beta_feedback',
});

BetaFeedbackSchema.index({ providerId: 1, featureKey: 1 });
BetaFeedbackSchema.index({ featureKey: 1, status: 1 });
BetaFeedbackSchema.index({ createdAt: -1 });

// ============================================
// Model Registration
// ============================================

export const BetaFeatureModel = mongoose.models.BetaFeature ||
  mongoose.model<IBetaFeature>('BetaFeature', BetaFeatureSchema);
export const ProviderBetaAccessModel = mongoose.models.ProviderBetaAccess ||
  mongoose.model<IProviderBetaAccess>('ProviderBetaAccess', ProviderBetaAccessSchema);
export const BetaFeedbackModel = mongoose.models.BetaFeedback ||
  mongoose.model<IBetaFeedback>('BetaFeedback', BetaFeedbackSchema);

// ============================================
// Service Class
// ============================================

export class BetaFeaturesAccessService {

  // ========================================
  // Feature Management
  // ========================================

  /**
   * Create a new beta feature
   */
  async createFeature(input: CreateFeatureInput): Promise<IBetaFeature> {
    const {
      featureKey,
      name,
      description,
      status,
      rolloutPercentage,
      requiredRoles,
      requiredTiers,
      maxParticipants,
      metadata,
    } = input;

    // Check for duplicate
    const existing = await BetaFeatureModel.findOne({ featureKey });
    if (existing) {
      throw ApiError.conflict('Feature with this key already exists');
    }

    const feature = new BetaFeatureModel({
      featureKey,
      name,
      description,
      status: status || 'development',
      rolloutPercentage: rolloutPercentage || 0,
      requiredRoles: requiredRoles || [],
      requiredTiers: requiredTiers || [],
      maxParticipants,
      currentParticipants: 0,
      metadata,
    });

    await feature.save();

    logger.info('Beta feature created', {
      context: 'BetaFeaturesAccessService',
      action: 'FEATURE_CREATED',
      featureKey,
      name,
    });

    eventBus.publish(EVENT_TYPES.BETA_FEATURE_CREATED, {
      featureKey,
      name,
    });

    return feature;
  }

  /**
   * Update beta feature
   */
  async updateFeature(featureKey: string, updates: Partial<BetaFeature>): Promise<IBetaFeature> {
    const feature = await BetaFeatureModel.findOneAndUpdate(
      { featureKey },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!feature) {
      throw ApiError.notFound('Feature not found');
    }

    logger.info('Beta feature updated', {
      context: 'BetaFeaturesAccessService',
      action: 'FEATURE_UPDATED',
      featureKey,
    });

    return feature;
  }

  /**
   * Get feature by key
   */
  async getFeatureByKey(featureKey: string): Promise<IBetaFeature | null> {
    return BetaFeatureModel.findOne({ featureKey });
  }

  /**
   * Get all features with optional status filter
   */
  async getAllFeatures(status?: FeatureStatus): Promise<IBetaFeature[]> {
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    return BetaFeatureModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Graduate a feature (move from beta to production)
   */
  async graduateFeature(featureKey: string): Promise<IBetaFeature> {
    const feature = await BetaFeatureModel.findOneAndUpdate(
      { featureKey },
      {
        status: 'released',
        rolloutPercentage: 100,
        graduatedAt: new Date(),
      },
      { new: true }
    );

    if (!feature) {
      throw ApiError.notFound('Feature not found');
    }

    // Update all participants to graduated status
    await ProviderBetaAccessModel.updateMany(
      { featureKey, accessLevel: 'beta' },
      { accessLevel: 'graduated', graduatedAt: new Date() }
    );

    logger.info('Feature graduated', {
      context: 'BetaFeaturesAccessService',
      action: 'FEATURE_GRADUATED',
      featureKey,
    });

    eventBus.publish(EVENT_TYPES.BETA_FEATURE_GRADUATED, {
      featureKey,
    });

    return feature;
  }

  // ========================================
  // Access Management
  // ========================================

  /**
   * Check if provider has access to a feature
   */
  async hasAccess(providerId: string, featureKey: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(providerId)) {
      return false;
    }

    const feature = await BetaFeatureModel.findOne({ featureKey });
    if (!feature) {
      return false;
    }

    // Feature not in beta/rolling out
    if (feature.status !== 'beta' && feature.status !== 'rolling_out') {
      return feature.status === 'released';
    }

    // Check explicit access
    const access = await ProviderBetaAccessModel.findOne({
      providerId: new Types.ObjectId(providerId),
      featureKey,
      accessLevel: { $in: ['beta', 'graduated'] },
    });

    if (access) {
      return true;
    }

    // Check rollout percentage
    if (feature.rolloutPercentage > 0) {
      const hash = this.hashProviderId(providerId, featureKey);
      const percentage = hash % 100;
      return percentage < feature.rolloutPercentage;
    }

    return false;
  }

  /**
   * Get provider's access level for a feature
   */
  async getAccessLevel(providerId: string, featureKey: string): Promise<AccessLevel> {
    if (!Types.ObjectId.isValid(providerId)) {
      return 'none';
    }

    const access = await ProviderBetaAccessModel.findOne({
      providerId: new Types.ObjectId(providerId),
      featureKey,
    });

    if (access) {
      return access.accessLevel;
    }

    // Check if in rollout percentage
    const feature = await BetaFeatureModel.findOne({ featureKey });
    if (feature && feature.status !== 'development' && feature.rolloutPercentage > 0) {
      const hash = this.hashProviderId(providerId, featureKey);
      const percentage = hash % 100;
      if (percentage < feature.rolloutPercentage) {
        return 'beta';
      }
    }

    return 'none';
  }

  /**
   * Opt-in to beta feature
   */
  async optIn(providerId: string, featureKey: string): Promise<IProviderBetaAccess> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const feature = await BetaFeatureModel.findOne({ featureKey });
    if (!feature) {
      throw ApiError.notFound('Feature not found');
    }

    if (feature.status === 'released') {
      throw ApiError.badRequest('Feature is already released to all users');
    }

    // Check max participants
    if (feature.maxParticipants && feature.currentParticipants >= feature.maxParticipants) {
      throw ApiError.badRequest('Beta program is full. Please join the waitlist.');
    }

    // Check for existing access
    let access = await ProviderBetaAccessModel.findOne({
      providerId: new Types.ObjectId(providerId),
      featureKey,
    });

    if (access) {
      if (access.accessLevel === 'beta') {
        throw ApiError.conflict('Already opted in to this feature');
      }
      if (access.accessLevel === 'graduated') {
        throw ApiError.conflict('You already have access to this feature');
      }

      access.accessLevel = 'beta';
      access.optedInAt = new Date();
      access.optedOutAt = undefined;
      await access.save();
    } else {
      access = new ProviderBetaAccessModel({
        providerId: new Types.ObjectId(providerId),
        featureKey,
        accessLevel: 'beta',
        optedInAt: new Date(),
        usageStats: { usageCount: 0 },
      });
      await access.save();

      // Increment participant count
      await BetaFeatureModel.updateOne(
        { featureKey },
        { $inc: { currentParticipants: 1 } }
      );
    }

    logger.info('Provider opted in to beta feature', {
      context: 'BetaFeaturesAccessService',
      action: 'OPTED_IN',
      providerId,
      featureKey,
    });

    return access;
  }

  /**
   * Opt-out from beta feature
   */
  async optOut(providerId: string, featureKey: string): Promise<IProviderBetaAccess> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const access = await ProviderBetaAccessModel.findOne({
      providerId: new Types.ObjectId(providerId),
      featureKey,
    });

    if (!access) {
      throw ApiError.notFound('No access record found');
    }

    if (access.accessLevel === 'graduated') {
      throw ApiError.badRequest('Cannot opt out of released features');
    }

    access.accessLevel = 'none';
    access.optedOutAt = new Date();
    await access.save();

    // Decrement participant count
    await BetaFeatureModel.updateOne(
      { featureKey },
      { $inc: { currentParticipants: -1 } }
    );

    logger.info('Provider opted out of beta feature', {
      context: 'BetaFeaturesAccessService',
      action: 'OPTED_OUT',
      providerId,
      featureKey,
    });

    return access;
  }

  /**
   * Join waitlist for beta feature
   */
  async joinWaitlist(providerId: string, featureKey: string): Promise<IProviderBetaAccess> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    let access = await ProviderBetaAccessModel.findOne({
      providerId: new Types.ObjectId(providerId),
      featureKey,
    });

    if (access) {
      if (access.accessLevel === 'waitlist') {
        throw ApiError.conflict('Already on the waitlist');
      }
      if (access.accessLevel === 'beta' || access.accessLevel === 'graduated') {
        throw ApiError.conflict('Already have access to this feature');
      }

      access.accessLevel = 'waitlist';
      await access.save();
    } else {
      access = new ProviderBetaAccessModel({
        providerId: new Types.ObjectId(providerId),
        featureKey,
        accessLevel: 'waitlist',
        usageStats: { usageCount: 0 },
      });
      await access.save();
    }

    logger.info('Provider joined waitlist', {
      context: 'BetaFeaturesAccessService',
      action: 'WAITLIST_JOINED',
      providerId,
      featureKey,
    });

    return access;
  }

  /**
   * Get provider's beta features
   */
  async getProviderBetaFeatures(providerId: string): Promise<{
    active: IBetaFeature[];
    graduated: IBetaFeature[];
    waitlist: IBetaFeature[];
    available: IBetaFeature[];
  }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const providerObjectId = new Types.ObjectId(providerId);

    // Get all beta/rolling out features
    const features = await BetaFeatureModel.find({
      status: { $in: ['beta', 'rolling_out', 'released'] },
    });

    // Get provider's access records
    const accesses = await ProviderBetaAccessModel.find({
      providerId: providerObjectId,
    });

    const accessMap = new Map(accesses.map(a => [a.featureKey, a]));

    const result = {
      active: [] as IBetaFeature[],
      graduated: [] as IBetaFeature[],
      waitlist: [] as IBetaFeature[],
      available: [] as IBetaFeature[],
    };

    for (const feature of features) {
      const access = accessMap.get(feature.featureKey);

      if (access?.accessLevel === 'beta') {
        result.active.push(feature);
      } else if (access?.accessLevel === 'graduated' || feature.status === 'released') {
        result.graduated.push(feature);
      } else if (access?.accessLevel === 'waitlist') {
        result.waitlist.push(feature);
      } else if (await this.hasAccess(providerId, feature.featureKey)) {
        result.active.push(feature);
      } else {
        result.available.push(feature);
      }
    }

    return result;
  }

  // ========================================
  // Usage Tracking
  // ========================================

  /**
   * Record feature usage
   */
  async recordUsage(providerId: string, featureKey: string): Promise<void> {
    if (!Types.ObjectId.isValid(providerId)) {
      return;
    }

    const now = new Date();

    await ProviderBetaAccessModel.findOneAndUpdate(
      {
        providerId: new Types.ObjectId(providerId),
        featureKey,
        accessLevel: { $in: ['beta', 'graduated'] },
      },
      {
        $set: {
          'usageStats.lastUsedAt': now,
        },
        $inc: {
          'usageStats.usageCount': 1,
        },
        $setOnInsert: {
          'usageStats.firstUsedAt': now,
        },
      },
      { upsert: true }
    );
  }

  // ========================================
  // Feedback Collection
  // ========================================

  /**
   * Submit beta feedback
   */
  async submitFeedback(input: SubmitFeedbackInput): Promise<IBetaFeedback> {
    const {
      providerId,
      featureKey,
      type,
      rating,
      title,
      content,
      screenshots,
      attachments,
    } = input;

    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const feedback = new BetaFeedbackModel({
      providerId: new Types.ObjectId(providerId),
      featureKey,
      type,
      rating,
      title,
      content,
      screenshots: screenshots || [],
      attachments: attachments || [],
      status: 'new',
    });

    await feedback.save();

    // Update feedback count
    await ProviderBetaAccessModel.updateOne(
      {
        providerId: new Types.ObjectId(providerId),
        featureKey,
      },
      { $inc: { feedbackCount: 1 } }
    );

    logger.info('Beta feedback submitted', {
      context: 'BetaFeaturesAccessService',
      action: 'FEEDBACK_SUBMITTED',
      feedbackId: feedback._id.toString(),
      providerId,
      featureKey,
      type,
    });

    eventBus.publish(EVENT_TYPES.BETA_FEEDBACK_SUBMITTED, {
      feedbackId: feedback._id,
      providerId,
      featureKey,
    });

    return feedback;
  }

  /**
   * Get feedback for a feature
   */
  async getFeatureFeedback(
    featureKey: string,
    options: {
      status?: BetaFeedback['status'];
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ feedback: IBetaFeedback[]; total: number; page: number; pages: number }> {
    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { featureKey };
    if (status) query.status = status;

    const [feedback, total] = await Promise.all([
      BetaFeedbackModel.find(query)
        .populate('providerId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BetaFeedbackModel.countDocuments(query),
    ]);

    return {
      feedback,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get provider's feedback history
   */
  async getProviderFeedback(
    providerId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ feedback: IBetaFeedback[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [feedback, total] = await Promise.all([
      BetaFeedbackModel.find({ providerId: new Types.ObjectId(providerId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BetaFeedbackModel.countDocuments({ providerId: new Types.ObjectId(providerId) }),
    ]);

    return {
      feedback,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Respond to feedback (admin)
   */
  async respondToFeedback(
    feedbackId: string,
    adminId: string,
    response: string
  ): Promise<IBetaFeedback> {
    if (!Types.ObjectId.isValid(feedbackId) || !Types.ObjectId.isValid(adminId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const feedback = await BetaFeedbackModel.findByIdAndUpdate(
      feedbackId,
      {
        status: 'reviewed',
        adminResponse: {
          content: response,
          respondedAt: new Date(),
          respondedBy: new Types.ObjectId(adminId),
        },
      },
      { new: true }
    ).populate('providerId', 'firstName lastName');

    if (!feedback) {
      throw ApiError.notFound('Feedback not found');
    }

    logger.info('Feedback responded to', {
      context: 'BetaFeaturesAccessService',
      action: 'FEEDBACK_RESPONDED',
      feedbackId,
      adminId,
    });

    return feedback;
  }

  // ========================================
  // Graduated Rollout
  // ========================================

  /**
   * Gradually increase rollout percentage
   */
  async increaseRollout(featureKey: string, increment: number): Promise<IBetaFeature> {
    const feature = await BetaFeatureModel.findOne({ featureKey });
    if (!feature) {
      throw ApiError.notFound('Feature not found');
    }

    const newPercentage = Math.min(100, feature.rolloutPercentage + increment);

    feature.rolloutPercentage = newPercentage;

    if (newPercentage >= 100) {
      return this.graduateFeature(featureKey);
    }

    await feature.save();

    logger.info('Feature rollout increased', {
      context: 'BetaFeaturesAccessService',
      action: 'ROLLOUT_INCREASED',
      featureKey,
      newPercentage,
    });

    return feature;
  }

  // ========================================
  // Analytics
  // ========================================

  /**
   * Get feature statistics
   */
  async getFeatureStats(featureKey: string): Promise<{
    totalParticipants: number;
    activeUsers: number;
    graduatedUsers: number;
    waitlistCount: number;
    avgUsageCount: number;
    feedbackCount: number;
    avgRating: number;
  }> {
    const feature = await BetaFeatureModel.findOne({ featureKey });
    if (!feature) {
      throw ApiError.notFound('Feature not found');
    }

    const [accessStats, usageStats, feedbackStats] = await Promise.all([
      ProviderBetaAccessModel.aggregate([
        { $match: { featureKey } },
        {
          $group: {
            _id: '$accessLevel',
            count: { $sum: 1 },
          },
        },
      ]),
      ProviderBetaAccessModel.aggregate([
        {
          $match: {
            featureKey,
            accessLevel: { $in: ['beta', 'graduated'] },
            'usageStats.usageCount': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avgUsage: { $avg: '$usageStats.usageCount' },
            activeUsers: { $sum: 1 },
          },
        },
      ]),
      BetaFeedbackModel.aggregate([
        { $match: { featureKey } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgRating: { $avg: '$rating' },
          },
        },
      ]),
    ]);

    const accessCounts: Record<string, number> = {};
    for (const s of accessStats) {
      accessCounts[s._id] = s.count;
    }

    return {
      totalParticipants: feature.currentParticipants,
      activeUsers: usageStats[0]?.activeUsers || 0,
      graduatedUsers: accessCounts['graduated'] || 0,
      waitlistCount: accessCounts['waitlist'] || 0,
      avgUsageCount: Math.round(usageStats[0]?.avgUsage || 0),
      feedbackCount: feedbackStats[0]?.count || 0,
      avgRating: Math.round((feedbackStats[0]?.avgRating || 0) * 10) / 10,
    };
  }

  // ========================================
  // Helpers
  // ========================================

  /**
   * Hash provider ID for consistent rollout percentage
   */
  private hashProviderId(providerId: string, featureKey: string): number {
    const str = `${providerId}:${featureKey}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// ============================================
// Export Singleton
// ============================================

export const betaFeaturesAccessService = new BetaFeaturesAccessService();
export default betaFeaturesAccessService;
