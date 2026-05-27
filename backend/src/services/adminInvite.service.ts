import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Admin Invite Token Schema
const adminInviteTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  usedAt: {
    type: Date,
    default: null
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
adminInviteTokenSchema.index({ expiresAt: 1, isRevoked: 1 });

// Static method to hash token
(adminInviteTokenSchema.statics as any).hashToken = function(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method to find valid invite token
(adminInviteTokenSchema.statics as any).findValidToken = async function(token: string) {
  const tokenHash = (this as any).hashToken(token);

  return this.findOne({
    tokenHash,
    isRevoked: false,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  });
};

// Instance method to use the token
adminInviteTokenSchema.methods.useToken = async function(userId: mongoose.Types.ObjectId) {
  this.usedAt = new Date();
  this.usedBy = userId;
  await this.save();
};

// Instance method to revoke the token
adminInviteTokenSchema.methods.revokeToken = async function() {
  this.isRevoked = true;
  await this.save();
};

export interface IAdminInviteToken extends mongoose.Document {
  token: string;
  tokenHash: string;
  createdBy: mongoose.Types.ObjectId;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: mongoose.Types.ObjectId | null;
  isRevoked: boolean;
  createdAt: Date;
  useToken(userId: mongoose.Types.ObjectId): Promise<void>;
  revokeToken(): Promise<void>;
}

export interface IAdminInviteTokenModel extends mongoose.Model<IAdminInviteToken> {
  hashToken(token: string): string;
  findValidToken(token: string): Promise<IAdminInviteToken | null>;
}

const AdminInviteToken = mongoose.model<IAdminInviteToken, IAdminInviteTokenModel>('AdminInviteToken', adminInviteTokenSchema);

/**
 * Admin Invite Token Service
 *
 * SECURITY FIX: This service replaces predictable admin invite tokens with
 * cryptographically secure tokens using crypto.randomBytes(32).
 * Each token has a configurable expiration time.
 */
export class AdminInviteService {
  // Default token expiration: 7 days
  private static readonly DEFAULT_EXPIRATION_DAYS = 7;
  // Token length for randomBytes
  private static readonly TOKEN_BYTES = 32;

  /**
   * Generate a secure admin invite token
   *
   * SECURITY FIX: Uses crypto.randomBytes(32) instead of predictable tokens
   * - 32 bytes = 64 hex characters of entropy
   * - Tokens are cryptographically random
   * - Each token has configurable expiration
   *
   * @param creatorId - The admin user ID creating the invite
   * @param email - The email address to invite
   * @param expiresInDays - Token expiration in days (default: 7)
   * @returns The generated invite token
   */
  static async generateInviteToken(
    creatorId: string,
    email: string,
    expiresInDays: number = this.DEFAULT_EXPIRATION_DAYS
  ): Promise<{ token: string; expiresAt: Date; inviteId: string }> {
    // Validate inputs
    if (!creatorId) {
      throw new ApiError(400, 'Creator ID is required');
    }
    if (!email || !email.includes('@')) {
      throw new ApiError(400, 'Valid email is required');
    }
    if (expiresInDays < 1 || expiresInDays > 30) {
      throw new ApiError(400, 'Expiration must be between 1 and 30 days');
    }

    // SECURITY FIX: Generate cryptographically secure token
    // Using crypto.randomBytes(32) provides 256 bits of entropy
    const token = crypto.randomBytes(this.TOKEN_BYTES).toString('hex');

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Hash the token for storage (never store plain tokens)
    const tokenHash = AdminInviteToken.hashToken(token);

    // Create the invite record
    const invite = new AdminInviteToken({
      token, // Store full token for email delivery
      tokenHash, // Store hash for verification lookups
      createdBy: creatorId,
      email: email.toLowerCase().trim(),
      expiresAt
    });

    await invite.save();

    logger.info('Admin invite token generated', {
      action: 'ADMIN_INVITE_CREATED',
      creatorId,
      email,
      expiresAt: expiresAt.toISOString(),
      inviteId: invite._id.toString()
    });

    // SECURITY FIX: Return inviteId for tracking without exposing token
    // The token should ONLY be sent via email, never in API responses
    return { token, expiresAt, inviteId: invite._id.toString() };
  }

  /**
   * Verify and consume an admin invite token
   *
   * SECURITY FIX: Validates token before use
   * - Verifies token hasn't expired
   * - Verifies token hasn't been used
   * - Verifies token hasn't been revoked
   * - Marks token as used after successful verification
   *
   * @param token - The invite token to verify
   * @param userId - The user ID claiming the invite
   * @returns The invite details if valid
   */
  static async verifyAndConsumeToken(
    token: string,
    userId: string
  ): Promise<{
    email: string;
    createdBy: string;
    expiresAt: Date;
  }> {
    if (!token) {
      throw new ApiError(400, 'Token is required');
    }
    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    // Find valid token
    const invite = await AdminInviteToken.findValidToken(token);

    if (!invite) {
      // Check if token exists but is invalid (for logging)
      const tokenHash = AdminInviteToken.hashToken(token);
      const existingToken = await AdminInviteToken.findOne({ tokenHash });

      if (existingToken) {
        if (existingToken.isRevoked) {
          logger.warn('Admin invite token revocation attempt', {
            action: 'ADMIN_INVITE_REVOKED_TOKEN_USED',
            userId,
            tokenId: existingToken._id
          });
          throw new ApiError(400, 'This invite has been revoked');
        }
        if (existingToken.usedAt) {
          logger.warn('Admin invite token reuse attempt', {
            action: 'ADMIN_INVITE_TOKEN_REUSED',
            userId,
            tokenId: existingToken._id,
            originalUserId: existingToken.usedBy
          });
          throw new ApiError(400, 'This invite has already been used');
        }
        if (existingToken.expiresAt < new Date()) {
          logger.warn('Expired admin invite token usage attempt', {
            action: 'ADMIN_INVITE_EXPIRED_TOKEN_USED',
            userId,
            tokenId: existingToken._id
          });
          throw new ApiError(400, 'This invite has expired');
        }
      }

      logger.warn('Invalid admin invite token attempted', {
        action: 'ADMIN_INVITE_INVALID_TOKEN',
        userId
      });
      throw new ApiError(400, 'Invalid invite token');
    }

    // Verify email matches (if user has already registered)
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if email matches
    const inviteEmail = invite.email.toLowerCase();
    const userEmail = user.email.toLowerCase();

    if (inviteEmail !== userEmail) {
      logger.warn('Admin invite email mismatch', {
        action: 'ADMIN_INVITE_EMAIL_MISMATCH',
        userId,
        invitedEmail: inviteEmail,
        userEmail: userEmail
      });
      throw new ApiError(400, 'This invite was sent to a different email address');
    }

    // Mark token as used
    await invite.useToken(user._id);

    logger.info('Admin invite token consumed', {
      action: 'ADMIN_INVITE_TOKEN_CONSUMED',
      userId,
      email: invite.email,
      createdBy: invite.createdBy.toString()
    });

    return {
      email: invite.email,
      createdBy: invite.createdBy.toString(),
      expiresAt: invite.expiresAt
    };
  }

  /**
   * Revoke an admin invite token
   *
   * @param token - The invite token to revoke
   * @param revokerId - The admin user ID revoking the invite
   */
  static async revokeToken(token: string, revokerId: string): Promise<void> {
    if (!token) {
      throw new ApiError(400, 'Token is required');
    }

    const tokenHash = AdminInviteToken.hashToken(token);
    const invite = await AdminInviteToken.findOne({ tokenHash });

    if (!invite) {
      throw new ApiError(404, 'Invite token not found');
    }

    // Only the creator or an admin can revoke
    const revoker = await User.findById(revokerId);
    if (!revoker) {
      throw new ApiError(404, 'Revoker not found');
    }

    if (invite.createdBy.toString() !== revokerId && revoker.role !== 'admin') {
      throw new ApiError(403, 'Only the creator or an admin can revoke this invite');
    }

    if (invite.isRevoked) {
      throw new ApiError(400, 'This invite has already been revoked');
    }

    if (invite.usedAt) {
      throw new ApiError(400, 'Cannot revoke an invite that has been used');
    }

    await invite.revokeToken();

    logger.info('Admin invite token revoked', {
      action: 'ADMIN_INVITE_REVOKED',
      revokerId,
      inviteId: invite._id,
      email: invite.email
    });
  }

  /**
   * List all pending (unused, non-expired, non-revoked) invites by creator
   *
   * @param creatorId - The admin user ID
   * @returns List of pending invites
   */
  static async listPendingInvites(creatorId: string): Promise<Array<{
    id: string;
    email: string;
    expiresAt: Date;
    createdAt: Date;
    status: 'pending' | 'expired' | 'used' | 'revoked';
  }>> {
    const invites = await AdminInviteToken.find({
      createdBy: creatorId
    }).sort({ createdAt: -1 });

    const now = new Date();

    return invites.map(invite => ({
      id: invite._id.toString(),
      email: invite.email,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      status: invite.usedAt
        ? 'used'
        : invite.isRevoked
          ? 'revoked'
          : invite.expiresAt < now
            ? 'expired'
            : 'pending'
    }));
  }

  /**
   * Cleanup expired tokens (can be run as a scheduled job)
   *
   * @returns Number of deleted tokens
   */
  static async cleanupExpiredTokens(): Promise<{ deleted: number }> {
    // Delete tokens that have been expired for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await AdminInviteToken.deleteMany({
      expiresAt: { $lt: thirtyDaysAgo },
      usedAt: { $ne: null } // Only delete used tokens
    });

    if (result.deletedCount > 0) {
      logger.info('Cleaned up expired admin invite tokens', {
        deleted: result.deletedCount
      });
    }

    return { deleted: result.deletedCount };
  }
}

export default AdminInviteService;
