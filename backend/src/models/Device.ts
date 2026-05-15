/**
 * Device Model
 *
 * Stores device information for push notification targeting
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IDevice extends Document {
  token: string;
  platform: 'android' | 'ios';
  userId?: mongoose.Types.ObjectId;
  appVersion?: string;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios'],
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    appVersion: {
      type: String,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
DeviceSchema.index({ userId: 1, platform: 1 });
DeviceSchema.index({ lastActive: -1 });

// TTL index to auto-delete stale devices (90 days)
DeviceSchema.index({ lastActive: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);
