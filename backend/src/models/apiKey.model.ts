import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  name: string;
  keyPrefix: string;
  keyHash: string;
  userId: mongoose.Types.ObjectId;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  rateLimit: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  recordUsage(): Promise<void>;
}

export interface IApiKeyWithPlainKey extends Omit<IApiKey, 'keyHash'> {
  plainKey: string;
}

export interface IApiKeyModel extends mongoose.Model<IApiKey> {
  generateKey(): { plainKey: string; keyHash: string; keyPrefix: string };
  verifyKey(plainKey: string): Promise<IApiKey | null>;
}

const apiKeySchema = new Schema<IApiKey, IApiKeyModel>(
  {
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      maxlength: [100, 'API key name cannot exceed 100 characters'],
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    permissions: [{
      type: String,
      enum: [
        'read',
        'write',
        'delete',
        'admin',
        'analytics',
        'webhooks',
      ],
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
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Generate a new API key
 * Returns the plain key (only shown once) and stores the hash
 */
apiKeySchema.statics.generateKey = function(): { plainKey: string; keyHash: string; keyPrefix: string } {
  const plainKey = `hs_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
  const keyPrefix = plainKey.substring(0, 12);

  return { plainKey, keyHash, keyPrefix };
};

/**
 * Verify an API key against stored hash
 */
apiKeySchema.statics.verifyKey = async function(plainKey: string): Promise<IApiKey | null> {
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
apiKeySchema.methods.recordUsage = async function(): Promise<void> {
  this.lastUsedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

const ApiKey = mongoose.model<IApiKey>('ApiKey', apiKeySchema);

export default ApiKey;
