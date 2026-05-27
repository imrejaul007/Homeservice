import mongoose, { Schema, Document } from 'mongoose';

/**
 * SMS Dead Letter Queue - Persistent DLQ Implementation
 *
 * Stores failed SMS messages that exceeded max retries.
 * Provides audit trail and manual intervention capability.
 */

export interface ISmsDLQ extends Document {
  phoneNumber: string;
  message: string;
  error: string;
  attempts: number;
  lastAttempt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution?: 'manual' | 'automatic' | 'ignored';
  metadata?: Record<string, any>;
}

const smsDlqSchema = new Schema<ISmsDLQ>({
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  error: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    required: true
  },
  lastAttempt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: String,
    default: null
  },
  resolution: {
    type: String,
    enum: ['manual', 'automatic', 'ignored', null],
    default: null
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: null
  }
});

// TTL index to auto-delete resolved DLQ entries after 30 days
smsDlqSchema.index({ resolvedAt: 1 }, {
  expireAfterSeconds: 30 * 24 * 60 * 60 // 30 days
});

// Compound index for queries
smsDlqSchema.index({ createdAt: -1 });
smsDlqSchema.index({ resolvedAt: 1, resolution: 1 });

export const SmsDLQ = mongoose.model<ISmsDLQ>('SmsDLQ', smsDlqSchema);

export default SmsDLQ;
