import mongoose, { Schema, Document } from 'mongoose';

/**
 * Blocked Term Model
 *
 * Stores terms that are blocked from search queries for content moderation.
 */

export interface IBlockedTerm extends Document {
  term: string;
  reason: string;
  category: 'profanity' | 'spam' | 'inappropriate' | 'competitor' | 'custom';
  severity: 'low' | 'medium' | 'high';
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  matchType: 'exact' | 'partial' | 'fuzzy';
  createdAt: Date;
  updatedAt: Date;
}

const blockedTermSchema = new Schema<IBlockedTerm>(
  {
    term: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    reason: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['profanity', 'spam', 'inappropriate', 'competitor', 'custom'],
      default: 'custom'
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    matchType: {
      type: String,
      enum: ['exact', 'partial', 'fuzzy'],
      default: 'partial'
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient lookups
blockedTermSchema.index({ term: 1 }, { unique: true });
blockedTermSchema.index({ isActive: 1, category: 1 });
blockedTermSchema.index({ severity: 1 });

const BlockedTerm = mongoose.model<IBlockedTerm>('BlockedTerm', blockedTermSchema);

export default BlockedTerm;
