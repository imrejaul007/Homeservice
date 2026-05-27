import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;

  // Booking reference
  bookingId: mongoose.Types.ObjectId;

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

  // Response from reviewee
  response?: {
    content: string;
    createdAt: Date;
    updatedAt?: Date;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
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

// Compound indexes for common query patterns
reviewSchema.index({ revieweeId: 1, createdAt: -1 });
reviewSchema.index({ reviewerId: 1, createdAt: -1 });
reviewSchema.index({ rating: 1, createdAt: -1 });
reviewSchema.index({ isHidden: 1, createdAt: -1 });

// Partial index for visible reviews only (performance optimization)
reviewSchema.index(
  { revieweeId: 1, createdAt: -1, isHidden: 1 },
  {
    partialFilterExpression: { isHidden: false },
    name: 'visible_reviews_by_reviewee'
  }
);

// Index for pending moderation
reviewSchema.index(
  { moderationStatus: 1, createdAt: -1 },
  {
    partialFilterExpression: { moderationStatus: 'pending' },
    name: 'pending_moderation'
  }
);

// Index for flagged reviews (high report count)
reviewSchema.index(
  { reportCount: -1, createdAt: -1 },
  {
    partialFilterExpression: { reportCount: { $gt: 0 } },
    name: 'flagged_reviews'
  }
);

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
    isHidden: false,
  };

  if (minRating) {
    query.rating = { $gte: minRating };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('reviewerId', 'firstName lastName avatar');
};

// Get review statistics for a provider
reviewSchema.statics.getProviderStats = async function(providerId: string) {
  const stats = await this.aggregate([
    {
      $match: {
        revieweeId: new mongoose.Types.ObjectId(providerId),
        reviewerType: 'customer',
        isHidden: false,
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

const Review: Model<IReview> = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
