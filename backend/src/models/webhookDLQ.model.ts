import mongoose, { Schema, Document } from 'mongoose';

/**
 * Webhook Dead Letter Queue - Persistent DLQ Implementation
 * 
 * Stores failed webhook events that exceeded max retries.
 * Provides audit trail and manual intervention capability.
 */

export interface IWebhookDLQ extends Document {
  eventId: string;
  eventType: string;
  payload: any;
  error: string;
  attempts: number;
  lastAttempt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution?: 'manual' | 'automatic' | 'ignored';
}

const webhookDLQSchema = new Schema<IWebhookDLQ>({
  eventId: { 
    type: String, 
    required: true, 
    index: true 
  },
  eventType: { 
    type: String, 
    required: true,
    index: true 
  },
  payload: { 
    type: Schema.Types.Mixed, 
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
  }
});

// TTL index to auto-delete resolved DLQ entries after 30 days
webhookDLQSchema.index({ resolvedAt: 1 }, { 
  expireAfterSeconds: 30 * 24 * 60 * 60 // 30 days
});

// Compound index for queries
webhookDLQSchema.index({ eventType: 1, createdAt: -1 });
webhookDLQSchema.index({ resolvedAt: 1, resolution: 1 });

export const WebhookDLQ = mongoose.model<IWebhookDLQ>('WebhookDLQ', webhookDLQSchema);

export default WebhookDLQ;
