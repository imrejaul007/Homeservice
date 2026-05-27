import mongoose, { Document, Schema, Model } from 'mongoose';

// ===================================
// TYPE DEFINITIONS
// ===================================

export type ContentType = 'review' | 'service' | 'portfolio' | 'profile' | 'message';
export type FlagReason = 'spam' | 'inappropriate' | 'harassment' | 'fake' | 'other';
export type FlagStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';
export type FlagAction = 'removed' | 'warning' | 'user_banned' | 'dismissed';

export interface IContentFlag extends Document {
  _id: mongoose.Types.ObjectId;

  // Content identification
  contentType: ContentType;
  contentId: mongoose.Types.ObjectId;

  // Reporter information
  reportedBy: mongoose.Types.ObjectId;

  // Flag details
  reason: FlagReason;
  description?: string;

  // Review status
  status: FlagStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;

  // Action taken
  action?: FlagAction;
  actionTakenAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtual for populating content
  content?: any;
  reporter?: any;
}

// ===================================
// SCHEMA DEFINITION
// ===================================

const contentFlagSchema = new Schema<IContentFlag>(
  {
    contentType: {
      type: String,
      enum: ['review', 'service', 'portfolio', 'profile', 'message'] as ContentType[],
      required: [true, 'Content type is required'],
      index: true,
    },

    contentId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Content ID is required'],
      index: true,
    },

    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter ID is required'],
      index: true,
    },

    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'harassment', 'fake', 'other'] as FlagReason[],
      required: [true, 'Reason is required'],
      index: true,
    },

    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    status: {
      type: String,
      enum: ['pending', 'reviewed', 'actioned', 'dismissed'] as FlagStatus[],
      default: 'pending',
      index: true,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    reviewedAt: {
      type: Date,
    },

    action: {
      type: String,
      enum: ['removed', 'warning', 'user_banned', 'dismissed'] as FlagAction[],
    },

    actionTakenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===================================
// INDEXES
// ===================================

// Compound index for efficient queue queries
contentFlagSchema.index({ status: 1, createdAt: -1 });

// Index for finding flags by content
contentFlagSchema.index({ contentType: 1, contentId: 1, status: 1 });

// Index for finding flags by reporter
contentFlagSchema.index({ reportedBy: 1, createdAt: -1 });

// Index for reason-based filtering
contentFlagSchema.index({ reason: 1, status: 1 });

// ===================================
// STATIC METHODS
// ===================================

// Get moderation queue with pagination and filters
contentFlagSchema.statics.getQueue = function(
  filters: {
    contentType?: ContentType;
    status?: FlagStatus;
    reason?: FlagReason;
    page?: number;
    limit?: number;
  } = {}
) {
  const { contentType, status, reason, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (contentType) query.contentType = contentType;
  if (status) query.status = status;
  if (reason) query.reason = reason;

  return this.find(query)
    .populate('reportedBy', 'firstName lastName email avatar')
    .populate('reviewedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Count flags in queue
contentFlagSchema.statics.getQueueCount = async function(
  filters: { contentType?: ContentType; status?: FlagStatus; reason?: FlagReason } = {}
) {
  const query: any = {};
  if (filters.contentType) query.contentType = filters.contentType;
  if (filters.status) query.status = filters.status;
  if (filters.reason) query.reason = filters.reason;
  return this.countDocuments(query);
};

// Get queue statistics
contentFlagSchema.statics.getQueueStats = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pending, actionedToday, total, byReason, byContentType] = await Promise.all([
    this.countDocuments({ status: 'pending' }),
    this.countDocuments({
      status: 'actioned',
      actionTakenAt: { $gte: today }
    }),
    this.countDocuments(),
    this.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: '$reason', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: '$contentType', count: { $sum: 1 } } }
    ]),
  ]);

  return {
    pending,
    actionedToday,
    total,
    byReason: byReason.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>),
    byContentType: byContentType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>),
  };
};

// Find flags for specific content
contentFlagSchema.statics.findByContent = function(
  contentType: ContentType,
  contentId: string
) {
  return this.find({ contentType, contentId })
    .populate('reportedBy', 'firstName lastName email avatar')
    .sort({ createdAt: -1 });
};

// Check if content is already flagged by user
contentFlagSchema.statics.isContentFlaggedByUser = async function(
  contentType: ContentType,
  contentId: string,
  reportedBy: string
): Promise<boolean> {
  const count = await this.countDocuments({ contentType, contentId, reportedBy });
  return count > 0;
};

// ===================================
// INSTANCE METHODS
// ===================================

// Mark flag as reviewed
contentFlagSchema.methods.markAsReviewed = async function(
  reviewedBy: mongoose.Types.ObjectId,
  action: FlagAction
) {
  this.status = action === 'dismissed' ? 'dismissed' : 'actioned';
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  this.action = action;
  this.actionTakenAt = new Date();
  await this.save();
  return this;
};

const ContentFlag: Model<IContentFlag> = mongoose.model<IContentFlag>('ContentFlag', contentFlagSchema);

export default ContentFlag;
