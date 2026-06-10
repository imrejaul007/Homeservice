import mongoose, { Schema, Document } from 'mongoose';

// Share Analytics Document Interface
export interface IShareAnalytics extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId: string;
  itemType: 'service' | 'package' | 'provider' | 'experience' | 'page';
  itemId: string;
  platform: string;
  timestamp: Date;
  metadata?: {
    userAgent?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

// Share Analytics Schema
const shareAnalyticsSchema = new Schema<IShareAnalytics>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['service', 'package', 'provider', 'experience', 'page'],
      required: true,
      index: true,
    },
    itemId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['native', 'whatsapp', 'facebook', 'twitter', 'linkedin', 'email', 'sms', 'copy', 'native_share'],
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      userAgent: String,
      referrer: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
    },
  },
  {
    timestamps: false,
    collection: 'share_analytics',
  }
);

// Compound indexes for efficient querying
shareAnalyticsSchema.index({ itemType: 1, platform: 1, timestamp: -1 });
shareAnalyticsSchema.index({ userId: 1, timestamp: -1 });
shareAnalyticsSchema.index({ itemId: 1, timestamp: -1 });

// Create the model
const ShareAnalytics = mongoose.model<IShareAnalytics>('ShareAnalytics', shareAnalyticsSchema);

export default ShareAnalytics;
