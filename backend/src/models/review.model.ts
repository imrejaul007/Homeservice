import mongoose, { Document, Schema, Model, FilterQuery } from 'mongoose';
import logger from '../utils/logger';

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;

  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Booking reference
  bookingId: mongoose.Types.ObjectId;

  // Service reference (denormalized for efficient queries)
  // FIX: Added serviceId for filtering reviews by service
  serviceId?: mongoose.Types.ObjectId;

  // Who is reviewing
  reviewerId: mongoose.Types.ObjectId;  // Customer who wrote the review
  reviewerType: 'customer' | 'provider';

  // Who is being reviewed
  revieweeId: mongoose.Types.ObjectId;  // Provider being reviewed
  revieweeType: 'provider' | 'customer';

  // Review content
  rating: number;  // 1-5 stars
  title?: string;
  comment: string;
  photos?: string[];

  // Review metadata
  isVerified: boolean;  // Verified booking (true for customer reviews)
  helpfulVotes: number;
  reportCount: number;
  isHidden: boolean;

  // Moderation
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'hidden';
  moderationReason?: string;
  moderatedAt?: Date;
  moderatedBy?: mongoose.Types.ObjectId;

  // Content moderation
  autoFlagged: boolean;
  moderationScore?: number;
  moderationIssues?: string[];

  // Response from reviewee
  response?: {
    content: string;
    createdAt: Date;
    updatedAt?: Date;
  };

  // Soft delete fields (audit trail)
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },

    // FIX: Added serviceId for efficient service-level review queries
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      index: true,
    },

    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer ID is required'],
      index: true,
    },

    reviewerType: {
      type: String,
      enum: ['customer', 'provider'],
      required: true,
    },

    revieweeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewee ID is required'],
      index: true,
    },

    revieweeType: {
      type: String,
      enum: ['provider', 'customer'],
      required: true,
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },

    title: {
      type: String,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    comment: {
      type: String,
      required: [true, 'Comment is required'],
      minlength: [10, 'Comment must be at least 10 characters'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },

    photos: [{
      type: String,
    }],

    isVerified: {
      type: Boolean,
      default: false,
    },

    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },

    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },

    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden'],
      default: 'pending',
      index: true,
    },

    moderationReason: {
      type: String,
      maxlength: [500, 'Moderation reason cannot exceed 500 characters'],
    },

    moderatedAt: {
      type: Date,
    },

    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    autoFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },

    moderationScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    moderationIssues: [{
      type: String,
    }],

    response: {
      content: {
        type: String,
        maxlength: [500, 'Response cannot exceed 500 characters'],
      },
      createdAt: {
        type: Date,
      },
      updatedAt: {
        type: Date,
      },
    },

    // FIX 1: Add soft delete field to review schema for audit trail
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===================================
// UNIQUE COMPOUND INDEX (CRITICAL)
// ===================================
// Prevents duplicate reviews: one customer can only review a provider
// once per booking (not multiple reviews for the same service)
reviewSchema.index(
  { bookingId: 1, reviewerId: 1 },
  {
    unique: true,
    name: 'unique_booking_reviewer'
  }
);

// FIX 1: Add missing isDeleted compound indexes for efficient soft-delete queries
reviewSchema.index({ isDeleted: 1, moderationStatus: 1 }); // Soft deleted reviews by status
reviewSchema.index({ isDeleted: 1, createdAt: -1 }); // Soft deleted reviews sorted by date
reviewSchema.index({ isDeleted: 1, revieweeId: 1 }); // Soft deleted reviews by reviewee

// Compound indexes for common query patterns
// PERFORMANCE FIX: Add index for service rating recalculation (N+1 query fix)
reviewSchema.index({ bookingId: 1, isHidden: 1 }); // For rating recalculation
reviewSchema.index({ revieweeId: 1, reviewerType: 1, createdAt: -1 }); // For provider reviews
reviewSchema.index({ reviewerId: 1, createdAt: -1 });
reviewSchema.index({ rating: 1, createdAt: -1 });
reviewSchema.index({ isHidden: 1, createdAt: -1 });
reviewSchema.index({ isHidden: 1 }); // For findByProvider queries filtering hidden reviews
// PERFORMANCE FIX: Compound index for service analytics queries
reviewSchema.index({ bookingId: 1, revieweeId: 1 }); // For service-level rating queries

// HIGH PRIORITY: Compound indexes for serviceId queries (filtering reviews by service and time/rating)
reviewSchema.index({ serviceId: 1, createdAt: -1 }); // For fetching reviews by service, newest first
reviewSchema.index({ serviceId: 1, rating: -1 }); // For fetching reviews by service, highest rated first

// Tenant isolation indexes
reviewSchema.index({ tenantId: 1, revieweeId: 1 });
reviewSchema.index({ tenantId: 1, reviewerId: 1 });
reviewSchema.index({ tenantId: 1, moderationStatus: 1 });

// FIX: Add index for helpful votes sorting (find most helpful reviews)
reviewSchema.index({ helpfulVotes: -1, createdAt: -1 });

// FIX: Add index for report count queries (moderation queue)
reviewSchema.index({ reportCount: 1, moderationStatus: 1 });

// Partial index for visible reviews only (performance optimization)
// MongoDB >= 3.2: Uses partial index for better performance
// MongoDB < 3.2 fallback: Non-partial compound index at line 200
reviewSchema.index(
  { revieweeId: 1, createdAt: -1, isHidden: 1 },
  {
    partialFilterExpression: { isHidden: false },
    name: 'visible_reviews_by_reviewee'
  }
);

// Index for pending moderation
// MongoDB >= 3.2: Uses partial index for better performance
// MongoDB < 3.2 fallback: Regular compound index (moderationStatus already has basic index at line 143)
reviewSchema.index(
  { moderationStatus: 1, createdAt: -1 },
  {
    partialFilterExpression: { moderationStatus: 'pending' },
    name: 'pending_moderation'
  }
);

// Index for flagged reviews (high report count)
// MongoDB >= 3.2: Uses partial index for better performance
// MongoDB < 3.2 fallback: Regular compound index (reportCount already has basic index at line 213)
reviewSchema.index(
  { reportCount: -1, createdAt: -1 },
  {
    partialFilterExpression: { reportCount: { $gt: 0 } },
    name: 'flagged_reviews'
  }
);

// Index for auto-flagged reviews (from content moderation)
reviewSchema.index(
  { autoFlagged: 1, createdAt: -1 },
  {
    partialFilterExpression: { autoFlagged: true },
    name: 'auto_flagged_reviews'
  }
);

// Compound index for moderation queue with auto-flagged priority
reviewSchema.index(
  { autoFlagged: 1, moderationStatus: 1, createdAt: -1 },
  {
    name: 'moderation_queue_auto_flagged'
  }
);

// PERFORMANCE FIX: Text index for efficient search on review content
// Supports $text queries which are more efficient than regex for search
// Replace case-insensitive regex search with $text search for better performance
reviewSchema.index(
  { comment: 'text', title: 'text' },
  {
    weights: {
      title: 10,   // Title matches are more relevant
      comment: 5,  // Comment matches are still valuable
    },
    name: 'review_text_search',
    default_language: 'english',
    language_override: 'language',
  }
);

// ===================================
// PUBLIC VISIBILITY (customer / provider storefront)
// ===================================

/** Reviews visible on provider profiles and service pages */
export const PUBLIC_REVIEW_QUERY: FilterQuery<IReview> = {
  isHidden: false,
  // SECURITY FIX: Exclude reviews with high report counts unless explicitly approved by a moderator
  // Reviews with reportCount >= 3 are flagged as potentially abusive and must be manually approved
  $or: [
    { moderationStatus: 'approved' },
    { moderationStatus: { $exists: false } },
  ],
  $nor: [
    { reportCount: { $gte: 3 } },
  ],
};

// ===================================
// STATIC METHODS
// ===================================

// Get reviews for a provider (public)
reviewSchema.statics.findByProvider = function(
  providerId: string,
  options: { page?: number; limit?: number; minRating?: number } = {}
) {
  const { page = 1, limit = 10, minRating } = options;

  const query: any = {
    revieweeId: providerId,
    reviewerType: 'customer',
    ...PUBLIC_REVIEW_QUERY,
  };

  if (minRating) {
    query.rating = { $gte: minRating };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('reviewerId', 'firstName lastName avatar')
    .lean();
};

// Get review statistics for a provider
// FIX P0: Add isDeleted: false filter to exclude soft-deleted reviews from stats
reviewSchema.statics.getProviderStats = async function(providerId: string) {
  const stats = await this.aggregate([
    {
      $match: {
        revieweeId: new mongoose.Types.ObjectId(providerId),
        reviewerType: 'customer',
        isHidden: false,
        isDeleted: false, // Exclude soft-deleted reviews from stats
        $or: [
          { moderationStatus: 'approved' },
          { moderationStatus: { $exists: false } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  return {
    totalReviews: stats[0].totalReviews,
    averageRating: Math.round(stats[0].averageRating * 10) / 10,
    ratingDistribution: {
      5: stats[0].rating5,
      4: stats[0].rating4,
      3: stats[0].rating3,
      2: stats[0].rating2,
      1: stats[0].rating1,
    },
  };
};

// Check if review exists for booking + reviewer
reviewSchema.statics.existsForBooking = async function(
  bookingId: string,
  reviewerId: string
): Promise<boolean> {
  const count = await this.countDocuments({ bookingId, reviewerId });
  return count > 0;
};

// Interface for ReviewModel with static methods
interface ReviewModel extends Model<IReview> {
  findByProvider(
    providerId: string,
    options?: { page?: number; limit?: number; minRating?: number }
  ): Promise<IReview[]>;
  getProviderStats(providerId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  }>;
  existsForBooking(bookingId: string, reviewerId: string): Promise<boolean>;
}

const Review = mongoose.model<IReview, ReviewModel>('Review', reviewSchema);

// ===================================
// POST-SAVE HOOKS FOR DENORMALIZED ANALYTICS
// ===================================
// FIX: Trigger ProviderProfile review stats recalculation when reviews change
// FIX P1: Wrap review save and stats recalculation in proper transaction handling

reviewSchema.post('save', { document: true, query: false }, async function(doc: IReview) {
  // Recalculate provider's review stats when a review is created or updated
  if (doc.revieweeType === 'provider' && doc.reviewerType === 'customer') {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const ProviderProfile = mongoose.model('ProviderProfile') as any;
      // FIX: Pass tenantId for multi-tenant isolation to prevent cross-tenant data leakage
      await ProviderProfile.recalculateReviewsData(doc.revieweeId, doc.tenantId, session);

      // Also update booking reference to review
      const Booking = mongoose.model('Booking');
      await Booking.findByIdAndUpdate(
        doc.bookingId,
        { $set: { customerReview: doc._id } },
        { session }
      );

      await session.commitTransaction();

      logger.debug('Provider review stats recalculated after review change', {
        context: 'ReviewModel',
        action: 'RECALCULATE_REVIEW_STATS',
        reviewId: doc._id.toString(),
        providerId: doc.revieweeId.toString(),
        tenantId: doc.tenantId?.toString(),
      });
    } catch (error: unknown) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      // Log the error but don't fail the review save operation
      // The stats will be eventually consistent via a scheduled job
      logger.error('Failed to recalculate provider review stats - will retry via background job', {
        context: 'ReviewModel',
        action: 'RECALCULATE_REVIEW_STATS_ERROR',
        reviewId: doc._id.toString(),
        providerId: doc.revieweeId.toString(),
        tenantId: doc.tenantId?.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (!session.hasEnded) {
        await session.endSession();
      }
    }
  }
});

// Recalculate on review deletion
reviewSchema.post('findOneAndDelete', async function(doc: IReview | null) {
  if (doc && doc.revieweeType === 'provider' && doc.reviewerType === 'customer') {
    try {
      const ProviderProfile = mongoose.model('ProviderProfile') as any;
      // FIX: Pass tenantId for multi-tenant isolation to prevent cross-tenant data leakage
      await ProviderProfile.recalculateReviewsData(doc.revieweeId, doc.tenantId);

      // Clear review reference from booking
      const Booking = mongoose.model('Booking');
      await Booking.findByIdAndUpdate(doc.bookingId, {
        $unset: { customerReview: 1 }
      });

      logger.debug('Provider review stats recalculated after review deletion', {
        context: 'ReviewModel',
        action: 'RECALCULATE_REVIEW_STATS_ON_DELETE',
        reviewId: doc._id.toString(),
        providerId: doc.revieweeId.toString(),
        tenantId: doc.tenantId?.toString(),
      });
    } catch (error: unknown) {
      logger.warn('Failed to recalculate provider review stats on delete', {
        context: 'ReviewModel',
        action: 'RECALCULATE_REVIEW_STATS_DELETE_ERROR',
        reviewId: doc._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

// FIX: Pre-delete hook to clean up related data when review is deleted
reviewSchema.pre('deleteOne', { document: true, query: false }, async function(this: IReview) {
  // This runs before the document is deleted
  // The post-delete hook will handle recalculating review stats
  logger.debug('Review deletion initiated', {
    context: 'ReviewModel',
    action: 'REVIEW_DELETE_INITIATED',
    reviewId: this._id.toString(),
    bookingId: this.bookingId.toString(),
  });
});

export default Review;
