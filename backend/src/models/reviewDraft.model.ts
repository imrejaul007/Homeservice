/**
 * Review Draft Model
 * Allows customers to save review drafts before submitting
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import logger from '../utils/logger';

// Draft expiration time (30 days)
const DRAFT_EXPIRATION_DAYS = 30;

export interface IReviewDraft extends Document {
  // User reference
  userId: mongoose.Types.ObjectId;
  userType: 'customer' | 'provider';

  // Booking reference
  bookingId: mongoose.Types.ObjectId;

  // Service and provider references (for quick access)
  serviceId?: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;

  // Review content (all optional until submission)
  rating?: number; // 1-5
  title?: string;
  comment?: string;
  photos?: string[];

  // Draft metadata
  isComplete: boolean; // True when all required fields are filled
  lastSavedAt: Date;
  expiresAt: Date;
  autoSaveEnabled: boolean;

  // Version tracking for optimistic locking
  version: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  checkCompleteness(): boolean;
  updateContent(data: {
    rating?: number;
    title?: string;
    comment?: string;
    photos?: string[];
  }): this;
  extendExpiration(): this;
  getTimeRemaining(): {
    days: number;
    hours: number;
    minutes: number;
    isExpired: boolean;
    formatted: string;
  };
}

export interface IReviewDraftModel extends Model<IReviewDraft> {
  getDraftCount(userId: string, userType: 'customer' | 'provider'): Promise<number>;
  cleanupExpired(batchSize?: number): Promise<{ deleted: number }>;
  getExpiringSoon(hoursThreshold?: number): Promise<IReviewDraft[]>;
}

// Schema definition
const reviewDraftSchema = new Schema<IReviewDraft>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    userType: {
      type: String,
      enum: ['customer', 'provider'],
      required: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },

    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      index: true,
    },

    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },

    title: {
      type: String,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    comment: {
      type: String,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },

    photos: [{
      type: String,
    }],

    isComplete: {
      type: Boolean,
      default: false,
    },

    lastSavedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    autoSaveEnabled: {
      type: Boolean,
      default: true,
    },

    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===================================
// INDEXES
// ===================================

// Compound unique index: one draft per user per booking
reviewDraftSchema.index(
  { userId: 1, bookingId: 1 },
  {
    unique: true,
    name: 'unique_user_booking_draft',
  }
);

// Index for finding expired drafts (cleanup job)
reviewDraftSchema.index(
  { expiresAt: 1, isComplete: 1 },
  {
    name: 'expired_drafts_cleanup',
  }
);

// Index for user drafts list
reviewDraftSchema.index(
  { userId: 1, updatedAt: -1 },
  {
    name: 'user_drafts_list',
  }
);

// Tenant isolation indexes
reviewDraftSchema.index({ userId: 1, userType: 1 });

// ===================================
// INSTANCE METHODS
// ===================================

/**
 * Check if draft is complete (all required fields filled)
 */
reviewDraftSchema.methods.checkCompleteness = function(): boolean {
  // For customer reviews: rating is required, comment is required
  if (this.userType === 'customer') {
    return (
      typeof this.rating === 'number' &&
      this.rating >= 1 &&
      this.rating <= 5 &&
      typeof this.comment === 'string' &&
      this.comment.trim().length >= 10
    );
  }

  // For provider reviews (of customers): rating is required
  if (this.userType === 'provider') {
    return typeof this.rating === 'number' && this.rating >= 1 && this.rating <= 5;
  }

  return false;
};

/**
 * Update draft with partial data and recalculate completeness
 */
reviewDraftSchema.methods.updateContent = function(data: {
  rating?: number;
  title?: string;
  comment?: string;
  photos?: string[];
}): IReviewDraft {
  if (data.rating !== undefined) {
    this.rating = data.rating;
  }
  if (data.title !== undefined) {
    this.title = data.title;
  }
  if (data.comment !== undefined) {
    this.comment = data.comment;
  }
  if (data.photos !== undefined) {
    this.photos = data.photos;
  }

  this.lastSavedAt = new Date();
  this.isComplete = this.checkCompleteness();
  this.version += 1;

  return this as unknown as IReviewDraft;
};

/**
 * Get time remaining until expiration
 */
reviewDraftSchema.methods.getTimeRemaining = function(): {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
  formatted: string;
} {
  const now = new Date();
  const remaining = this.expiresAt.getTime() - now.getTime();

  if (remaining <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: true,
      formatted: 'Expired',
    };
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  let formatted = '';
  if (days > 0) {
    formatted = `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    formatted = `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    formatted = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  return {
    days,
    hours,
    minutes,
    isExpired: false,
    formatted,
  };
};

/**
 * Extend expiration date
 */
reviewDraftSchema.methods.extendExpiration = function(
  additionalDays: number = DRAFT_EXPIRATION_DAYS
): void {
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);
  this.expiresAt = newExpiresAt;
};

// ===================================
// STATIC METHODS
// ===================================

/**
 * Find or create draft for a booking
 */
reviewDraftSchema.statics.findOrCreate = async function(
  userId: string,
  bookingId: string,
  userType: 'customer' | 'provider' = 'customer',
  additionalData: {
    serviceId?: string;
    providerId?: string;
  } = {}
): Promise<IReviewDraft> {
  let draft = await this.findOne({ userId, bookingId, userType });

  if (!draft) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DRAFT_EXPIRATION_DAYS);

    draft = new this({
      userId,
      bookingId,
      userType,
      serviceId: additionalData.serviceId,
      providerId: additionalData.providerId,
      expiresAt,
      isComplete: false,
      version: 1,
    });

    await draft.save();
    logger.debug('Review draft created', {
      context: 'ReviewDraft',
      action: 'DRAFT_CREATED',
      draftId: draft._id.toString(),
      userId: userId.toString(),
      bookingId: bookingId.toString(),
    });
  }

  return draft;
};

/**
 * Find all drafts for a user
 */
reviewDraftSchema.statics.findByUser = function(
  userId: string,
  options: {
    userType?: 'customer' | 'provider';
    includeExpired?: boolean;
    page?: number;
    limit?: number;
  } = {}
): mongoose.Query<IReviewDraft[], IReviewDraft> {
  const { userType, includeExpired = false, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = { userId };

  if (userType) {
    query.userType = userType;
  }

  if (!includeExpired) {
    query.expiresAt = { $gt: new Date() };
  }

  return this.find(query)
    .populate('bookingId', 'bookingNumber scheduledDate')
    .populate('serviceId', 'name category images')
    .populate('providerId', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

/**
 * Get draft count for a user
 */
reviewDraftSchema.statics.getDraftCount = async function(
  userId: string,
  userType?: 'customer' | 'provider'
): Promise<number> {
  const query: Record<string, unknown> = { userId };

  if (userType) {
    query.userType = userType;
  }

  // Only count non-expired drafts
  query.expiresAt = { $gt: new Date() };

  return this.countDocuments(query);
};

/**
 * Clean up expired drafts
 */
reviewDraftSchema.statics.cleanupExpired = async function(
  batchSize: number = 100
): Promise<{ deleted: number }> {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
    isComplete: false, // Only delete incomplete expired drafts
  }).limit(batchSize);

  if (result.deletedCount > 0) {
    logger.info('Expired review drafts cleaned up', {
      context: 'ReviewDraft',
      action: 'CLEANUP_EXPIRED',
      deletedCount: result.deletedCount,
    });
  }

  return { deleted: result.deletedCount };
};

/**
 * Delete draft after successful review submission
 */
reviewDraftSchema.statics.deleteAfterSubmission = async function(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const result = await this.deleteOne({ userId, bookingId });
  return result.deletedCount > 0;
};

/**
 * Check if user has a draft for a booking
 */
reviewDraftSchema.statics.hasDraft = async function(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const count = await this.countDocuments({
    userId,
    bookingId,
    expiresAt: { $gt: new Date() },
  });
  return count > 0;
};

/**
 * Get drafts expiring soon (for notification)
 */
reviewDraftSchema.statics.getExpiringSoon = async function(
  userId: string,
  hoursThreshold: number = 48
): Promise<IReviewDraft[]> {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() + hoursThreshold);

  return this.find({
    userId,
    expiresAt: {
      $gt: new Date(),
      $lte: thresholdDate,
    },
    isComplete: false,
  })
    .populate('bookingId', 'bookingNumber')
    .populate('serviceId', 'name')
    .sort({ expiresAt: 1 });
};

// ===================================
// MIDDLEWARE
// ===================================

// Pre-save: update isComplete flag
reviewDraftSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('rating') || this.isModified('comment')) {
    this.isComplete = this.checkCompleteness();
  }
  next();
});

// Post-save: log draft updates
reviewDraftSchema.post('save', function(doc) {
  logger.debug('Review draft saved', {
    context: 'ReviewDraft',
    action: 'DRAFT_SAVED',
    draftId: doc._id.toString(),
    userId: doc.userId.toString(),
    isComplete: doc.isComplete,
    version: doc.version,
  });
});

// ===================================
// EXPORT
// ===================================

const ReviewDraft = mongoose.model<IReviewDraft, IReviewDraftModel>('ReviewDraft', reviewDraftSchema);

export default ReviewDraft;
