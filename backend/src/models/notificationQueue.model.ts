import mongoose, { Schema, Document } from 'mongoose';

/**
 * Notification Queue - Persistent queue for failed notifications
 *
 * Stores failed notifications for retry processing.
 * Provides audit trail and automatic retry capability.
 */

export interface INotificationQueue extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  recipientId: string;
  type: string;
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  error: string;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastAttempt?: Date;
  nextRetry?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  getNextRetryTime(): Date;
}

const notificationQueueSchema = new Schema<INotificationQueue>({
  // Multi-tenant support
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: false,  // Backwards compatible
    index: true
  },

  recipientId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  actionText: {
    type: String
  },
  actionUrl: {
    type: String
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  channel: {
    type: String,
    enum: ['in_app', 'email', 'sms', 'push'],
    default: 'in_app'
  },
  error: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  lastAttempt: {
    type: Date
  },
  nextRetry: {
    type: Date,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for queue processing
notificationQueueSchema.index({ tenantId: 1, status: 1, nextRetry: 1 });
notificationQueueSchema.index({ status: 1, nextRetry: 1 });
notificationQueueSchema.index({ recipientId: 1, status: 1 });
notificationQueueSchema.index({ createdAt: -1 });

// Calculate next retry time with exponential backoff
notificationQueueSchema.methods.getNextRetryTime = function(): Date {
  const backoffMs = Math.min(1000 * Math.pow(2, this.attempts), 300000); // Max 5 minutes
  return new Date(Date.now() + backoffMs);
};

export const NotificationQueue = mongoose.model<INotificationQueue>('NotificationQueue', notificationQueueSchema);

export default NotificationQueue;
