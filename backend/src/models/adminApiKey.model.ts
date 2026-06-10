import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';
import { API_KEY_PERMISSIONS } from '../constants/apiKeyPermissions';

/**
 * Admin API Key Model
 * Used by admins to create API keys for external integrations or services
 */

export interface IAdminApiKey extends Document {
  name: string;
  keyPrefix: string;
  keyHash: string;
  description?: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  rateLimit: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  recordUsage(): Promise<void>;
}

export interface IAdminApiKeyWithPlainKey extends Omit<IAdminApiKey, 'keyHash'> {
  plainKey: string;
}

export interface IAdminApiKeyModel extends mongoose.Model<IAdminApiKey> {
  generateKey(): { plainKey: string; keyHash: string; keyPrefix: string };
  verifyKey(plainKey: string): Promise<IAdminApiKey | null>;
}

const adminApiKeySchema = new Schema<IAdminApiKey, IAdminApiKeyModel>(
  {
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      maxlength: [100, 'API key name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    keyPrefix: {
      type: String,
      required: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      select: false,
    },
    permissions: [{
      type: String,
      enum: {
        values: API_KEY_PERMISSIONS,
        message: 'Invalid permission: {VALUE}. Valid permissions are: ' + API_KEY_PERMISSIONS.join(', '),
      },
    }],
    expiresAt: {
      type: Date,
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    rateLimit: {
      type: Number,
      default: 100,
      min: 1,
      max: 10000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(_doc, ret: Record<string, unknown>) {
        ret.keyHash = undefined;
        ret.__v = undefined;
        return ret;
      },
    },
  }
);

// Compound indexes for efficient queries
adminApiKeySchema.index({ isActive: 1 });
adminApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminApiKeySchema.index({ createdAt: -1 });

/**
 * Generate a new API key
 * Returns the plain key (only shown once) and stores the hash
 */
adminApiKeySchema.statics.generateKey = function(): { plainKey: string; keyHash: string; keyPrefix: string } {
  const plainKey = `admin_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
  const keyPrefix = plainKey.substring(0, 12);

  return { plainKey, keyHash, keyPrefix };
};

/**
 * Verify an API key against stored hash
 */
adminApiKeySchema.statics.verifyKey = async function(plainKey: string): Promise<IAdminApiKey | null> {
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');

  const apiKey = await this.findOne({
    keyHash,
    isActive: true,
  }).select('+keyHash');

  if (!apiKey) {
    return null;
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  return apiKey;
};

/**
 * Update last used timestamp
 */
adminApiKeySchema.methods.recordUsage = async function(): Promise<void> {
  this.lastUsedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

const AdminApiKey = mongoose.model<IAdminApiKey, IAdminApiKeyModel>('AdminApiKey', adminApiKeySchema);

export default AdminApiKey;
