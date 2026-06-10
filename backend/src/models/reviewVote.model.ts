/**
 * ReviewVote Model
 * Tracks user votes on reviews (helpful/not helpful)
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReviewVote extends Document {
  _id: mongoose.Types.ObjectId;
  reviewId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  helpful: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewVoteSchema = new Schema<IReviewVote>(
  {
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      required: [true, 'Review ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    helpful: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: one vote per user per review
reviewVoteSchema.index(
  { reviewId: 1, userId: 1 },
  { unique: true, name: 'unique_user_review_vote' }
);

// Index for counting helpful votes efficiently
reviewVoteSchema.index({ reviewId: 1, helpful: 1 });

interface ReviewVoteModel extends Model<IReviewVote> {}

const ReviewVote = mongoose.model<IReviewVote, ReviewVoteModel>('ReviewVote', reviewVoteSchema);

export default ReviewVote;
