import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import auditService from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface ISecret extends Document {
  name: string;
  type: 'api_key' | 'secret_key' | 'access_token' | 'refresh_token' | 'encryption_key' | 'jwt_secret';
  encryptedValue: string;
  keyVersion: number;
  rotationInterval: number; // days
  lastRotated: Date;
  nextRotation: Date;
  isActive: boolean;
  metadata: {
    environment?: string;
    service?: string;
    createdBy?: string;
    lastUsed?: Date;
    usageCount: number;
  };
  rotationHistory: Array<{
    version: number;
    rotatedAt: Date;
    rotatedBy: string;
    expiresAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAPIKey extends Document {
  keyId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  userId?: mongoose.Types.ObjectId;
  permissions: string[];
  expiresAt?: Date;
  lastUsed: Date;
  isActive: boolean;
  metadata: {
    environment?: string;
    service?: string;
    description?: string;
    allowedIPs?: string[];
    rateLimit?: number;
  };
  usageLogs: Array<{
    timestamp: Date;
    ip: string;
    endpoint: string;
    success: boolean;
    errorMessage?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSecretDTO {
  name: string;
  type: ISecret['type'];
  value: string;
  rotationInterval?: number;
  metadata?: Partial<ISecret['metadata']>;
}

export interface CreateAPIKeyDTO {
  name: string;
  userId?: string;
  permissions?: string[];
  expiresAt?: Date;
  metadata?: Partial<IAPIKey['metadata']>;
}

export interface RotationResult {
  success: boolean;
  oldKeyVersion?: number;
  newKeyVersion?: number;
  newValue?: string;
  error?: string;
}

export interface APIKeyValidationResult {
  valid: boolean;
  keyId?: string;
  permissions?: string[];
  error?: string;
}

// ============================================
// Schema Definitions
// ============================================

const secretSchema = new Schema<ISecret>(
  {
    name: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['api_key', 'secret_key', 'access_token', 'refresh_token', 'encryption_key', 'jwt_secret'],
    },
    encryptedValue: { type: String, required: true },
    keyVersion: { type: Number, default: 1 },
    rotationInterval: { type: Number, default: 90 }, // days
    lastRotated: { type: Date, default: Date.now },
    nextRotation: { type: Date },
    isActive: { type: Boolean, default: true },
    metadata: {
      environment: String,
      service: String,
      createdBy: String,
      lastUsed: Date,
      usageCount: { type: Number, default: 0 },
    },
    rotationHistory: [
      {
        version: Number,
        rotatedAt: Date,
        rotatedBy: String,
        expiresAt: Date,
      },
    ],
  },
  { timestamps: true }
);

// Calculate next rotation date
secretSchema.pre('save', function (next) {
  if (this.isModified()) {
    this.nextRotation = new Date(
      this.lastRotated.getTime() + this.rotationInterval * 24 * 60 * 60 * 1000
    );
  }
  next();
});

const apiKeySchema = new Schema<IAPIKey>(
  {
    keyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    permissions: [{ type: String }],
    expiresAt: { type: Date },
    lastUsed: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    metadata: {
      environment: String,
      service: String,
      description: String,
      allowedIPs: [String],
      rateLimit: Number,
    },
    usageLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        ip: String,
        endpoint: String,
        success: Boolean,
        errorMessage: String,
      },
    ],
  },
  { timestamps: true }
);

// Indexes
apiKeySchema.index({ keyPrefix: 1 });
apiKeySchema.index({ userId: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// ============================================
// Models
// ============================================

export const Secret = mongoose.model<ISecret>('Secret', secretSchema);
export const APIKey = mongoose.model<IAPIKey>('APIKey', apiKeySchema);

// ============================================
// Encryption Utilities
// ============================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment or generate from master key
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.SECRET_MASTER_KEY || process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error('SECRET_MASTER_KEY or ENCRYPTION_KEY environment variable is required');
  }
  // Derive a 256-bit key from the master key using SHA-256
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Encrypt a secret value
 */
function encrypt(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a secret value
 */
function decrypt(encryptedValue: string): string {
  const key = getEncryptionKey();
  const parts = encryptedValue.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a secure random API key
 */
function generateAPIKey(): { key: string; prefix: string; hash: string } {
  const key = crypto.randomBytes(32).toString('base64url');
  const prefix = `nil_${key.substring(0, 8)}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

// ============================================
// Secret Rotation Service Class
// ============================================

export class SecretRotationService {
  // ========================================
  // Secret Management
  // ========================================

  /**
   * Create a new secret
   */
  async createSecret(
    data: CreateSecretDTO,
    createdBy: string
  ): Promise<ISecret> {
    // Check if secret with same name exists
    const existingSecret = await Secret.findOne({ name: data.name });
    if (existingSecret) {
      throw new ApiError(
        409,
        `Secret '${data.name}' already exists`,
        [],
        ERROR_CODES.DUPLICATE_ENTRY
      );
    }

    const encryptedValue = encrypt(data.value);

    const secret = new Secret({
      name: data.name,
      type: data.type,
      encryptedValue,
      rotationInterval: data.rotationInterval || 90,
      lastRotated: new Date(),
      isActive: true,
      metadata: {
        ...data.metadata,
        createdBy,
        usageCount: 0,
      },
      rotationHistory: [
        {
          version: 1,
          rotatedAt: new Date(),
          rotatedBy: createdBy,
          expiresAt: new Date(
            Date.now() + (data.rotationInterval || 90) * 24 * 60 * 60 * 1000
          ),
        },
      ],
    });

    await secret.save();

    // Audit log
    await auditService.logAction({
      action: 'secret_created',
      userId: createdBy,
      targetType: 'secret',
      targetId: secret._id.toString(),
      metadata: {
        secretName: secret.name,
        secretType: secret.type,
      },
    });

    logger.info(`Secret '${secret.name}' created`, {
      secretId: secret._id,
      type: secret.type,
      createdBy,
    });

    return secret;
  }

  /**
   * Get secret by name (returns decrypted value)
   */
  async getSecret(name: string, requestedBy: string): Promise<string | null> {
    const secret = await Secret.findOne({ name, isActive: true });
    if (!secret) {
      return null;
    }

    // Update usage metadata
    secret.metadata.lastUsed = new Date();
    secret.metadata.usageCount++;
    await secret.save();

    // Audit log for secret access
    await auditService.logAction({
      action: 'secret_accessed',
      userId: requestedBy,
      targetType: 'secret',
      targetId: secret._id.toString(),
      metadata: {
        secretName: secret.name,
        secretType: secret.type,
      },
    });

    return decrypt(secret.encryptedValue);
  }

  /**
   * Get secret metadata (without value)
   */
  async getSecretMetadata(name: string): Promise<ISecret | null> {
    return Secret.findOne({ name }).select('-encryptedValue');
  }

  /**
   * List all secrets (metadata only)
   */
  async listSecrets(includeInactive: boolean = false): Promise<ISecret[]> {
    const query = includeInactive ? {} : { isActive: true };
    return Secret.find(query)
      .select('-encryptedValue')
      .sort({ name: 1 });
  }

  /**
   * Update secret metadata
   */
  async updateSecretMetadata(
    name: string,
    updates: { rotationInterval?: number; metadata?: Partial<ISecret['metadata']> },
    updatedBy: string
  ): Promise<ISecret> {
    const secret = await Secret.findOne({ name });
    if (!secret) {
      throw new ApiError(404, 'Secret not found', [], ERROR_CODES.NOT_FOUND);
    }

    if (updates.rotationInterval !== undefined) {
      secret.rotationInterval = updates.rotationInterval;
    }

    if (updates.metadata) {
      secret.metadata = { ...secret.metadata, ...updates.metadata };
    }

    await secret.save();

    // Audit log
    await auditService.logAction({
      action: 'secret_metadata_updated',
      userId: updatedBy,
      targetType: 'secret',
      targetId: secret._id.toString(),
      metadata: { secretName: secret.name },
    });

    return secret;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(
    name: string,
    newValue: string,
    rotatedBy: string
  ): Promise<RotationResult> {
    const secret = await Secret.findOne({ name });
    if (!secret) {
      return { success: false, error: 'Secret not found' };
    }

    const oldVersion = secret.keyVersion;
    const newVersion = oldVersion + 1;

    // Encrypt new value
    const encryptedValue = encrypt(newValue);

    // Update secret
    secret.encryptedValue = encryptedValue;
    secret.keyVersion = newVersion;
    secret.lastRotated = new Date();

    // Add to rotation history
    secret.rotationHistory.push({
      version: newVersion,
      rotatedAt: new Date(),
      rotatedBy,
      expiresAt: new Date(
        Date.now() + secret.rotationInterval * 24 * 60 * 60 * 1000
      ),
    });

    // Keep only last 10 rotation history entries
    if (secret.rotationHistory.length > 10) {
      secret.rotationHistory = secret.rotationHistory.slice(-10);
    }

    await secret.save();

    // Audit log
    await auditService.logAction({
      action: 'secret_rotated',
      userId: rotatedBy,
      targetType: 'secret',
      targetId: secret._id.toString(),
      metadata: {
        secretName: secret.name,
        oldVersion,
        newVersion,
      },
    });

    logger.info(`Secret '${name}' rotated`, {
      secretId: secret._id,
      oldVersion,
      newVersion,
      rotatedBy,
    });

    return {
      success: true,
      oldKeyVersion: oldVersion,
      newKeyVersion: newVersion,
    };
  }

  /**
   * Disable a secret (soft delete)
   */
  async disableSecret(name: string, disabledBy: string): Promise<void> {
    const secret = await Secret.findOne({ name });
    if (!secret) {
      throw new ApiError(404, 'Secret not found', [], ERROR_CODES.NOT_FOUND);
    }

    secret.isActive = false;
    await secret.save();

    // Audit log
    await auditService.logAction({
      action: 'secret_disabled',
      userId: disabledBy,
      targetType: 'secret',
      targetId: secret._id.toString(),
      metadata: { secretName: secret.name },
    });

    logger.info(`Secret '${name}' disabled`, {
      secretId: secret._id,
      disabledBy,
    });
  }

  /**
   * Delete a secret permanently
   */
  async deleteSecret(name: string, deletedBy: string): Promise<void> {
    const secret = await Secret.findOne({ name });
    if (!secret) {
      throw new ApiError(404, 'Secret not found', [], ERROR_CODES.NOT_FOUND);
    }

    // Audit log before deletion
    await auditService.logAction({
      action: 'secret_deleted',
      userId: deletedBy,
      targetType: 'secret',
      targetId: secret._id.toString(),
      metadata: {
        secretName: secret.name,
        secretType: secret.type,
        keyVersion: secret.keyVersion,
      },
    });

    await Secret.deleteOne({ _id: secret._id });

    logger.info(`Secret '${name}' deleted`, {
      secretId: secret._id,
      deletedBy,
    });
  }

  // ========================================
  // API Key Management
  // ========================================

  /**
   * Create a new API key
   */
  async createAPIKey(
    data: CreateAPIKeyDTO,
    createdBy: string
  ): Promise<{ apiKey: IAPIKey; rawKey: string }> {
    const { key, prefix, hash } = generateAPIKey();

    const apiKey = new APIKey({
      keyId: `key_${crypto.randomBytes(8).toString('hex')}`,
      name: data.name,
      keyHash: hash,
      keyPrefix: prefix,
      userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : undefined,
      permissions: data.permissions || [],
      expiresAt: data.expiresAt,
      isActive: true,
      metadata: data.metadata || {},
      usageLogs: [],
    });

    await apiKey.save();

    // Audit log
    await auditService.logAction({
      action: 'api_key_created',
      userId: createdBy,
      targetType: 'api_key',
      targetId: apiKey._id.toString(),
      metadata: {
        keyName: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        hasExpiry: !!apiKey.expiresAt,
      },
    });

    logger.info(`API key '${apiKey.name}' created`, {
      keyId: apiKey.keyId,
      keyPrefix: apiKey.keyPrefix,
      createdBy,
    });

    return { apiKey, rawKey: key };
  }

  /**
   * Validate an API key
   */
  async validateAPIKey(rawKey: string, ip?: string): Promise<APIKeyValidationResult> {
    // Calculate hash of provided key
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.substring(0, 9);

    // Find API key by prefix and hash
    const apiKey = await APIKey.findOne({
      keyPrefix: prefix,
      isActive: true,
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      // Log failed usage
      await this.logAPIKeyUsage(apiKey._id.toString(), ip || 'unknown', 'unknown', false, 'Key expired');
      return { valid: false, error: 'API key has expired' };
    }

    // Verify hash using timing-safe comparison
    const hashBuffer = Buffer.from(hash, 'hex');
    const storedHashBuffer = Buffer.from(apiKey.keyHash, 'hex');

    if (hashBuffer.length !== storedHashBuffer.length || !crypto.timingSafeEqual(hashBuffer, storedHashBuffer)) {
      // Log failed usage
      await this.logAPIKeyUsage(apiKey._id.toString(), ip || 'unknown', 'unknown', false, 'Hash mismatch');
      return { valid: false, error: 'Invalid API key' };
    }

    // Check IP restrictions
    if (apiKey.metadata.allowedIPs && apiKey.metadata.allowedIPs.length > 0) {
      if (!ip || !apiKey.metadata.allowedIPs.includes(ip)) {
        await this.logAPIKeyUsage(apiKey._id.toString(), ip || 'unknown', 'unknown', false, 'IP not allowed');
        return { valid: false, error: 'IP address not allowed' };
      }
    }

    // Update last used
    apiKey.lastUsed = new Date();
    await apiKey.save();

    return {
      valid: true,
      keyId: apiKey.keyId,
      permissions: apiKey.permissions,
    };
  }

  /**
   * Log API key usage
   */
  private async logAPIKeyUsage(
    keyId: string,
    ip: string,
    endpoint: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const apiKey = await APIKey.findById(keyId);
    if (!apiKey) return;

    apiKey.usageLogs.push({
      timestamp: new Date(),
      ip,
      endpoint,
      success,
      errorMessage,
    });

    // Keep only last 1000 usage logs
    if (apiKey.usageLogs.length > 1000) {
      apiKey.usageLogs = apiKey.usageLogs.slice(-1000);
    }

    await apiKey.save();
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string, revokedBy: string): Promise<void> {
    const apiKey = await APIKey.findOne({ keyId });
    if (!apiKey) {
      throw new ApiError(404, 'API key not found', [], ERROR_CODES.NOT_FOUND);
    }

    apiKey.isActive = false;
    await apiKey.save();

    // Audit log
    await auditService.logAction({
      action: 'api_key_revoked',
      userId: revokedBy,
      targetType: 'api_key',
      targetId: apiKey._id.toString(),
      metadata: {
        keyName: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
      },
    });

    logger.info(`API key '${apiKey.name}' revoked`, {
      keyId: apiKey.keyId,
      revokedBy,
    });
  }

  /**
   * List API keys (metadata only)
   */
  async listAPIKeys(userId?: string): Promise<IAPIKey[]> {
    const query = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
    return APIKey.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get API key usage statistics
   */
  async getAPIKeyStats(keyId: string): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    lastUsed: Date | null;
    recentLogs: IAPIKey['usageLogs'];
  }> {
    const apiKey = await APIKey.findOne({ keyId });
    if (!apiKey) {
      throw new ApiError(404, 'API key not found', [], ERROR_CODES.NOT_FOUND);
    }

    const logs = apiKey.usageLogs;
    return {
      totalRequests: logs.length,
      successfulRequests: logs.filter((l) => l.success).length,
      failedRequests: logs.filter((l) => !l.success).length,
      lastUsed: apiKey.lastUsed,
      recentLogs: logs.slice(-100),
    };
  }

  // ========================================
  // Scheduled Rotation
  // ========================================

  /**
   * Get secrets due for rotation
   */
  async getSecretsDueForRotation(): Promise<ISecret[]> {
    const now = new Date();
    return Secret.find({
      isActive: true,
      nextRotation: { $lte: now },
    });
  }

  /**
   * Auto-rotate a secret (generates new value)
   */
  async autoRotateSecret(name: string): Promise<RotationResult> {
    const secret = await Secret.findOne({ name });
    if (!secret) {
      return { success: false, error: 'Secret not found' };
    }

    // Generate new random value
    const newValue = crypto.randomBytes(32).toString('base64');

    return this.rotateSecret(name, newValue, 'system');
  }

  /**
   * Process all secrets due for rotation
   */
  async processScheduledRotations(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> {
    const secrets = await this.getSecretsDueForRotation();
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const secret of secrets) {
      try {
        const result = await this.autoRotateSecret(secret.name);
        if (result.success) {
          succeeded++;
          logger.info(`Auto-rotated secret: ${secret.name}`);
        } else {
          failed++;
          errors.push(`${secret.name}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        errors.push(`${secret.name}: ${(error as Error).message}`);
      }
    }

    return {
      processed: secrets.length,
      succeeded,
      failed,
      errors,
    };
  }

  // ========================================
  // Credential Refresh
  // ========================================

  /**
   * Refresh multiple secrets atomically (for coordinated rotation)
   */
  async refreshCredentials(
    secretNames: string[],
    rotatedBy: string
  ): Promise<{ success: boolean; results: Map<string, RotationResult> }> {
    const results = new Map<string, RotationResult>();

    // Generate all new values first
    const newValues = new Map<string, string>();
    for (const name of secretNames) {
      newValues.set(name, crypto.randomBytes(32).toString('base64'));
    }

    // Rotate all secrets
    for (const name of secretNames) {
      const newValue = newValues.get(name)!;
      const result = await this.rotateSecret(name, newValue, rotatedBy);
      results.set(name, result);

      if (!result.success) {
        // Rollback already-rotated secrets
        for (const [rolledBackName] of results) {
          if (rolledBackName === name) break;
          await this.rotateSecret(rolledBackName, newValues.get(rolledBackName)!, 'system');
        }
        return { success: false, results };
      }
    }

    return { success: true, results };
  }
}

// Export singleton instance
export const secretRotationService = new SecretRotationService();

export default secretRotationService;
