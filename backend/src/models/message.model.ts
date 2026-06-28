import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';
import logger from '../utils/logger';

// =============================================================================
// Message Types
// =============================================================================

export type MessageType = 'text' | 'image' | 'file' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read';

// =============================================================================
// Message Interface
// =============================================================================

export interface IMessage extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  // Message Core Fields
  _id: mongoose.Types.ObjectId;
  chatRoomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;

  // Message Content
  content: string;
  type: MessageType;

  // Attachments (for image/file types)
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    thumbnailUrl?: string;
  }>;

  // Message Status Tracking
  status: MessageStatus;
  deliveredAt?: Date;
  readAt?: Date;

  // Soft Delete Support
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  // Reply Support
  replyTo?: mongoose.Types.ObjectId;

  // Metadata
  metadata?: {
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    userAgent?: string;
    ipAddress?: string;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance Methods
  markAsDelivered(): Promise<void>;
  markAsRead(): Promise<void>;
  softDelete(deletedBy: mongoose.Types.ObjectId): Promise<void>;
}

// =============================================================================
// Message Schema
// =============================================================================

const messageSchema = new Schema<IMessage>(
  {
    // Multi-tenant
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    // Room and Participants
    chatRoomId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: [true, 'Chat room ID is required'],
      index: true
    },

    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true
    },

    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver ID is required'],
      index: true
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      index: true
    },

    // Message Content
    content: {
      type: String,
      required: function(this: IMessage) {
        return this.type === 'text' || this.type === 'system';
      },
      maxlength: [5000, 'Message content cannot exceed 5000 characters'],
      trim: true
    },

    type: {
      type: String,
      // Issue #17: Added 'booking_update' to match frontend enum
      enum: ['text', 'image', 'file', 'system', 'booking_update'],
      default: 'text',
      required: true
    },

    // Attachments
    attachments: [{
      url: {
        type: String,
        required: true
      },
      filename: {
        type: String,
        required: true
      },
      mimeType: {
        type: String,
        required: true
      },
      size: {
        type: Number,
        required: true,
        min: [0, 'File size cannot be negative']
      },
      thumbnailUrl: String
    }],

    // Status Tracking
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true
    },

    deliveredAt: Date,
    readAt: Date,

    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    // Reply Support
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },

    // Metadata
    metadata: {
      deviceType: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet']
      },
      userAgent: String,
      ipAddress: String
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// =============================================================================
// Indexes for Performance
// =============================================================================

// FIX 1: Add missing isDeleted compound indexes for efficient soft-delete queries
messageSchema.index({ isDeleted: 1, status: 1 }); // Soft deleted messages by status
messageSchema.index({ isDeleted: 1, createdAt: -1 }); // Soft deleted sorted by date

// Primary query patterns
messageSchema.index({ chatRoomId: 1, createdAt: -1 });
messageSchema.index({ chatRoomId: 1, status: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, createdAt: -1 });

// Compound indexes for common queries
messageSchema.index({ chatRoomId: 1, senderId: 1, createdAt: -1 });

// Unread count query optimization - COMPOUND version (more comprehensive)
messageSchema.index({ chatRoomId: 1, receiverId: 1, status: 1, isDeleted: 1 });

// Soft delete cleanup
messageSchema.index({ isDeleted: 1, deletedAt: 1 });

// Tenant isolation
messageSchema.index({ tenantId: 1, chatRoomId: 1, createdAt: -1 });

// =============================================================================
// Instance Methods
// =============================================================================

/**
 * Mark message as delivered
 */
messageSchema.methods.markAsDelivered = async function(): Promise<void> {
  if (this.status === 'sent') {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    await this.save();

    logger.debug('Message marked as delivered', {
      context: 'MessageModel',
      action: 'MARK_DELIVERED',
      messageId: this._id.toString(),
      chatRoomId: this.chatRoomId.toString(),
    });
  }
};

/**
 * Mark message as read
 */
messageSchema.methods.markAsRead = async function(): Promise<void> {
  if (this.status !== 'read') {
    const previousStatus = this.status;
    this.status = 'read';
    this.readAt = new Date();

    // Also set deliveredAt if not already set
    if (!this.deliveredAt) {
      this.deliveredAt = new Date();
    }

    await this.save();

    logger.debug('Message marked as read', {
      context: 'MessageModel',
      action: 'MARK_READ',
      messageId: this._id.toString(),
      chatRoomId: this.chatRoomId.toString(),
      previousStatus,
    });
  }
};

/**
 * Soft delete a message
 */
messageSchema.methods.softDelete = async function(deletedBy: mongoose.Types.ObjectId): Promise<void> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.content = '[Message deleted]';
  this.attachments = undefined;
  await this.save();

  logger.info('Message soft deleted', {
    context: 'MessageModel',
    action: 'SOFT_DELETE',
    messageId: this._id.toString(),
    chatRoomId: this.chatRoomId.toString(),
    deletedBy: deletedBy.toString(),
  });
};

// =============================================================================
// Static Methods
// =============================================================================

/**
 * Get unread count for a user in a chat room
 */
messageSchema.statics.getUnreadCount = async function(
  chatRoomId: string,
  userId: string
): Promise<number> {
  return this.countDocuments({
    chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
    receiverId: new mongoose.Types.ObjectId(userId),
    status: { $ne: 'read' },
    isDeleted: false
  });
};

/**
 * Get messages for a chat room with pagination
 */
messageSchema.statics.getMessagesForRoom = async function(
  chatRoomId: string,
  options: {
    limit?: number;
    before?: Date;
    after?: Date;
    includeDeleted?: boolean;
  } = {}
): Promise<IMessage[]> {
  const {
    limit = 50,
    before,
    after,
    includeDeleted = false
  } = options;

  const query: Record<string, unknown> = {
    chatRoomId: new mongoose.Types.ObjectId(chatRoomId)
  };

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  if (before) {
    query.createdAt = { $lt: before };
  }

  if (after) {
    query.createdAt = { ...(query.createdAt as object || {}), $gt: after };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'firstName lastName avatar role')
    .populate('replyTo', 'content type attachments')
    .lean();
};

/**
 * Mark multiple messages as read
 */
messageSchema.statics.markMessagesAsRead = async function(
  chatRoomId: string,
  userId: string,
  messageIds?: string[]
): Promise<number> {
  const query: Record<string, unknown> = {
    chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
    receiverId: new mongoose.Types.ObjectId(userId),
    status: { $ne: 'read' },
    isDeleted: false
  };

  if (messageIds && messageIds.length > 0) {
    query._id = { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) };
  }

  const result = await this.updateMany(query, {
    $set: {
      status: 'read',
      readAt: new Date()
    }
  });

  logger.debug('Messages marked as read', {
    context: 'MessageModel',
    action: 'MARK_MULTIPLE_READ',
    chatRoomId,
    userId,
    modifiedCount: result.modifiedCount,
  });

  return result.modifiedCount;
};

/**
 * Get total unread count for a user across all chat rooms
 */
messageSchema.statics.getTotalUnreadCount = async function(userId: string): Promise<number> {
  return this.countDocuments({
    receiverId: new mongoose.Types.ObjectId(userId),
    status: { $ne: 'read' },
    isDeleted: false
  });
};

/**
 * Get last message for each chat room
 */
messageSchema.statics.getLastMessages = async function(
  chatRoomIds: string[]
): Promise<Map<string, IMessage>> {
  const messages = await this.aggregate([
    {
      $match: {
        chatRoomId: { $in: chatRoomIds.map(id => new mongoose.Types.ObjectId(id)) },
        isDeleted: false
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$chatRoomId',
        lastMessage: { $first: '$$ROOT' }
      }
    }
  ]);

  const messageMap = new Map<string, IMessage>();
  for (const item of messages) {
    messageMap.set(item._id.toString(), item.lastMessage);
  }

  return messageMap;
};

// =============================================================================
// Message Encryption (At Rest)
// FIX P1: Encrypt message content for sensitive data protection
// =============================================================================

// Encryption key from environment (32 bytes for AES-256-GCM)
const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!keyHex) {
    // Fallback to a derived key from JWT_SECRET for development
    const secret = process.env.JWT_SECRET || process.env.CSRF_SECRET || 'default-dev-key';
    return crypto.createHash('sha256').update(secret).digest();
  }
  return Buffer.from(keyHex, 'hex');
};

// Encrypt content using AES-256-GCM
const encryptContent = (content: string): string => {
  if (!content) return content;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Message encryption failed', {
      context: 'MessageModel',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return content; // Fallback to storing unencrypted
  }
};

// Decrypt content using AES-256-GCM
const decryptContent = (encryptedContent: string): string => {
  if (!encryptedContent) return encryptedContent;
  try {
    const parts = encryptedContent.split(':');
    if (parts.length !== 3) {
      // Not encrypted format, return as-is for backward compatibility
      return encryptedContent;
    }
    const [ivHex, authTagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Message decryption failed', {
      context: 'MessageModel',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return '[Message could not be decrypted]';
  }
};

/**
 * Basic content sanitization
 */
messageSchema.statics.sanitizeContent = function(content: string): string {
  if (!content) return content;

  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// =============================================================================
// Pre-save Middleware
// =============================================================================

messageSchema.pre('save', function(next) {
  // Set timestamps for status changes
  if (this.isModified('status')) {
    if (this.status === 'delivered' && !this.deliveredAt) {
      this.deliveredAt = new Date();
    }
    if (this.status === 'read' && !this.readAt) {
      this.readAt = new Date();
      if (!this.deliveredAt) {
        this.deliveredAt = new Date();
      }
    }
  }

  // FIX P1: Encrypt content before saving (only for text messages)
  if (this.isModified('content') && this.type === 'text') {
    const sanitized = (this.constructor as unknown as { sanitizeContent(c: string): string }).sanitizeContent(this.content);
    this.content = encryptContent(sanitized);
  }

  next();
});

// FIX P1: Add decryption on document hydration
messageSchema.methods.getDecryptedContent = function(): string {
  return decryptContent(this.content);
};

// Static method to decrypt content (for lean queries)
messageSchema.statics.decryptContent = decryptContent;

// =============================================================================
// Post-save Hooks
// =============================================================================

messageSchema.post('save', async function(doc) {
  // Update ChatRoom lastMessage when a new message is saved
  if (doc.isNew || doc.isModified('content')) {
    try {
      const ChatRoom = mongoose.model('ChatRoom');
      await ChatRoom.findByIdAndUpdate(doc.chatRoomId, {
        lastMessage: doc._id,
        lastMessageAt: doc.createdAt
      });
    } catch (error) {
      logger.warn('Failed to update ChatRoom lastMessage', {
        context: 'MessageModel',
        action: 'UPDATE_CHATROOM_LAST_MESSAGE',
        messageId: doc._id.toString(),
        error: (error as Error).message,
      });
    }
  }
});

// =============================================================================
// Pre-save Middleware
// =============================================================================

messageSchema.pre('save', function(next) {
  // Set timestamps for status changes
  if (this.isModified('status')) {
    if (this.status === 'delivered' && !this.deliveredAt) {
      this.deliveredAt = new Date();
    }
    if (this.status === 'read' && !this.readAt) {
      this.readAt = new Date();
      if (!this.deliveredAt) {
        this.deliveredAt = new Date();
      }
    }
  }

  // FIX P1: Encrypt content before saving (only for text messages)
  if (this.isModified('content') && this.type === 'text') {
    const sanitized = (this.constructor as unknown as { sanitizeContent(c: string): string }).sanitizeContent(this.content);
    this.content = encryptContent(sanitized);
  }

  next();
});

// FIX P1: Add decryption on document hydration
messageSchema.methods.getDecryptedContent = function(): string {
  return decryptContent(this.content);
};

// Static method to decrypt content (for lean queries)
messageSchema.statics.decryptContent = decryptContent;

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
