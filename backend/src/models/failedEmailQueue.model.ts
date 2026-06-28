import mongoose, { Schema, Document } from 'mongoose';

/**
 * Failed Email Queue - Persistent queue for failed emails
 *
 * Stores failed emails for retry processing with MongoDB persistence.
 * Provides TTL-based automatic cleanup to prevent unbounded growth.
 * Survives server restarts unlike in-memory arrays.
 */

export interface IFailedEmailQueue extends Document {
  // Email content
  to: string;
  subject: string;
  html: string;
  text?: string;

  // Retry tracking
  attempt: number;
  maxAttempts: number;
  lastAttempt: Date;
  nextRetry: Date;

  // Status and error info
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';

  // Priority (for processing order)
  priority: 'high' | 'normal' | 'low';

  // Metadata for tracking
  metadata?: {
    userId?: string;
    bookingId?: string;
    type: string;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  getNextRetryTime(): Date;
  markCompleted(): Promise<void>;
  markFailed(error: string): Promise<void>;
}

interface IFailedEmailQueueModel extends mongoose.Model<IFailedEmailQueue> {
  getNextBatch(batchSize?: number): Promise<IFailedEmailQueue[]>;
  getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    readyToProcess: number;
  }>;
}

const failedEmailQueueSchema = new Schema<IFailedEmailQueue>({
  // Email content
  to: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  html: {
    type: String,
    required: true
  },
  text: {
    type: String
  },

  // Retry tracking
  attempt: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  lastAttempt: {
    type: Date,
    default: Date.now
  },
  nextRetry: {
    type: Date,
    required: true,
    index: true
  },

  // Status and error info
  error: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },

  // Priority for processing order
  priority: {
    type: String,
    enum: ['high', 'normal', 'low'],
    default: 'normal'
  },

  // Metadata
  metadata: {
    userId: String,
    bookingId: String,
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queue processing
failedEmailQueueSchema.index({ status: 1, priority: 1, nextRetry: 1 });
failedEmailQueueSchema.index({ to: 1, subject: 1, status: 1 });
failedEmailQueueSchema.index({ createdAt: 1 });

// TTL index - automatically remove completed/failed entries after 7 days
failedEmailQueueSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: { $in: ['completed', 'failed'] } } }
);

// Calculate next retry time with exponential backoff
// RETRY_DELAYS = [1min, 5min, 15min, 30min, 60min]
const RETRY_DELAYS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

failedEmailQueueSchema.methods.getNextRetryTime = function(): Date {
  const delayIndex = Math.min(this.attempt, RETRY_DELAYS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS[delayIndex]);
};

// Mark as completed
failedEmailQueueSchema.methods.markCompleted = async function(): Promise<void> {
  this.status = 'completed';
  await this.save();
};

// Mark as failed
failedEmailQueueSchema.methods.markFailed = async function(error: string): Promise<void> {
  this.error = error;
  if (this.attempt >= this.maxAttempts) {
    this.status = 'failed';
  } else {
    this.status = 'pending';
    this.nextRetry = this.getNextRetryTime();
  }
  await this.save();
};

// Static method to get next batch of emails for processing
failedEmailQueueSchema.statics.getNextBatch = async function(
  batchSize: number = 10
): Promise<IFailedEmailQueue[]> {
  return this.find({
    status: 'pending',
    nextRetry: { $lte: new Date() }
  })
    .sort({ priority: 1, nextRetry: 1 }) // High priority first, then by retry time
    .limit(batchSize);
};

// Static method to get queue statistics
failedEmailQueueSchema.statics.getStats = async function(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  readyToProcess: number;
}> {
  const [pending, processing, completed, failed] = await Promise.all([
    this.countDocuments({ status: 'pending' }),
    this.countDocuments({ status: 'processing' }),
    this.countDocuments({ status: 'completed' }),
    this.countDocuments({ status: 'failed' })
  ]);

  const readyToProcess = await this.countDocuments({
    status: 'pending',
    nextRetry: { $lte: new Date() }
  });

  return { pending, processing, completed, failed, readyToProcess };
};

export const FailedEmailQueue = mongoose.model<IFailedEmailQueue, IFailedEmailQueueModel>('FailedEmailQueue', failedEmailQueueSchema);

export default FailedEmailQueue;
