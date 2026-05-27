import mongoose, { Schema, Document } from 'mongoose';

/**
 * Webhook Outbox - Transactional Outbox Pattern Implementation
 * 
 * Guarantees at-least-once delivery by:
 * 1. Writing events to outbox in same transaction as business data
 * 2. Polling outbox and publishing events
 * 3. Marking events as completed only after successful publish
 */

export interface IWebhookOutbox extends Document {
  eventId: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  lastAttempt: Date | null;
  createdAt: Date;
  nextRetryAt: Date | null;
  maxRetries: number;
  expiresAt: Date;
  lastError?: string;
}

const webhookOutboxSchema = new Schema<IWebhookOutbox>({
  eventId: { 
    type: String, 
    required: true, 
    unique: true,
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
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'dead_letter'],
    default: 'pending',
    index: true
  },
  attempts: { 
    type: Number, 
    default: 0 
  },
  lastAttempt: { 
    type: Date, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  nextRetryAt: { 
    type: Date, 
    default: null,
    index: true
  },
  maxRetries: { 
    type: Number, 
    default: 10 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: true 
  },
  lastError: {
    type: String,
    default: null
  }
});

// Compound index for efficient polling
webhookOutboxSchema.index({ status: 1, nextRetryAt: 1 });

// TTL index to auto-delete completed entries after 7 days
webhookOutboxSchema.index({ status: 1, createdAt: 1 }, { 
  expireAfterSeconds: 7 * 24 * 60 * 60 // 7 days
});

export const WebhookOutbox = mongoose.model<IWebhookOutbox>('WebhookOutbox', webhookOutboxSchema);

export default WebhookOutbox;
