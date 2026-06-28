import mongoose, { Document, Schema, Model } from 'mongoose';
import logger from '../utils/logger';

// =============================================================================
// Conversation Types
// =============================================================================

export enum ConversationStatus {
  Active = 'active',
  Closed = 'closed',
  Archived = 'archived',
}

export type MessageRole = 'user' | 'assistant';

// =============================================================================
// Conversation Message Interface (Subdocument)
// =============================================================================

export interface IConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
  agentId?: mongoose.Types.ObjectId;
  agentName?: string;
}

// =============================================================================
// Conversation Interface
// =============================================================================

export interface IConversation extends Document {
  // Core Fields
  userId: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  agentCategory?: string;

  // Messages
  messages: IConversationMessage[];

  // Status
  status: ConversationStatus;

  // Metadata
  metadata?: {
    ip?: string;
    userAgent?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    context?: {
      currentPage?: string;
      bookingId?: string;
      serviceId?: string;
    };
  };

  // Message counts for quick access
  messageCount: number;

  // Timestamps (managed by Mongoose)
  createdAt: Date;
  updatedAt: Date;

  // Instance Methods
  addMessage(role: MessageRole, content: string, agentInfo?: { agentId?: mongoose.Types.ObjectId; agentName?: string }): Promise<IConversation>;
  close(): Promise<IConversation>;
  archive(): Promise<IConversation>;
}

// =============================================================================
// Conversation Message Schema (Subdocument)
// =============================================================================

const conversationMessageSchema = new Schema<IConversationMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'] as const,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: [10000, 'Message content cannot exceed 10000 characters'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'IAAgent',
    },
    agentName: {
      type: String,
    },
  },
  { _id: false }
);

// =============================================================================
// Conversation Schema
// =============================================================================

const conversationSchema = new Schema<IConversation>(
  {
    // Core Fields
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'IAAgent',
    },
    agentCategory: {
      type: String,
    },

    // Messages
    messages: {
      type: [conversationMessageSchema],
      default: [],
      validate: {
        validator: function (v: IConversationMessage[]) {
          return v.length <= 1000; // Limit to 1000 messages per conversation
        },
        message: 'Conversation cannot exceed 1000 messages',
      },
    },

    // Status
    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.Active,
      index: true,
    },

    // Metadata
    metadata: {
      ip: String,
      userAgent: String,
      deviceType: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet'],
      },
      context: {
        currentPage: String,
        bookingId: String,
        serviceId: String,
      },
    },

    // Message count for quick access
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// =============================================================================
// Indexes for Performance
// =============================================================================

// FIX 1: Add missing isDeleted compound indexes for efficient soft-delete queries
conversationSchema.index({ isDeleted: 1, status: 1 }); // Soft deleted conversations by status
conversationSchema.index({ isDeleted: 1, updatedAt: -1 }); // Soft deleted sorted by date
conversationSchema.index({ isDeleted: 1, createdAt: -1 }); // Soft deleted sorted by creation date

// Primary query patterns
conversationSchema.index({ userId: 1, updatedAt: -1 });
// FIX 4: Removed duplicate index { userId: 1, status: 1 } - covered by compound index below
conversationSchema.index({ createdAt: 1 });

// Compound indexes for common queries - MORE COMPREHENSIVE than individual indexes
conversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });
conversationSchema.index({ status: 1, createdAt: 1 });

// Text search on messages (if needed)
conversationSchema.index({ messages: 1 });

// =============================================================================
// Instance Methods
// =============================================================================

/**
 * Add a message to the conversation
 */
conversationSchema.methods.addMessage = async function (
  role: MessageRole,
  content: string,
  agentInfo?: { agentId?: mongoose.Types.ObjectId; agentName?: string }
): Promise<IConversation> {
  const message: IConversationMessage = {
    role,
    content,
    timestamp: new Date(),
  };

  if (agentInfo) {
    if (agentInfo.agentId) message.agentId = agentInfo.agentId;
    if (agentInfo.agentName) message.agentName = agentInfo.agentName;
  }

  this.messages.push(message);
  this.messageCount = this.messages.length;
  this.updatedAt = new Date();

  await this.save();

  logger.debug('Message added to conversation', {
    context: 'ConversationModel',
    action: 'ADD_MESSAGE',
    conversationId: this._id.toString(),
    userId: this.userId.toString(),
    role,
    messageLength: content.length,
  });

  return this as unknown as IConversation;
};

/**
 * Close the conversation
 */
conversationSchema.methods.close = async function (): Promise<IConversation> {
  this.status = ConversationStatus.Closed;
  await this.save();

  logger.info('Conversation closed', {
    context: 'ConversationModel',
    action: 'CLOSE_CONVERSATION',
    conversationId: this._id.toString(),
    userId: this.userId.toString(),
  });

  return this as unknown as IConversation;
};

/**
 * Archive the conversation
 */
conversationSchema.methods.archive = async function (): Promise<IConversation> {
  this.status = ConversationStatus.Archived;
  await this.save();

  logger.info('Conversation archived', {
    context: 'ConversationModel',
    action: 'ARCHIVE_CONVERSATION',
    conversationId: this._id.toString(),
    userId: this.userId.toString(),
  });

  return this as unknown as IConversation;
};

// =============================================================================
// Static Methods
// =============================================================================

/**
 * Get conversations for a user with pagination
 */
conversationSchema.statics.getUserConversations = async function (
  userId: string,
  options: {
    status?: ConversationStatus;
    limit?: number;
    offset?: number;
    sortBy?: 'updatedAt' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{ conversations: IConversation[]; total: number }> {
  const {
    status,
    limit = 20,
    offset = 0,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = options;

  const query: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (status) {
    query.status = status;
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const [conversations, total] = await Promise.all([
    this.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(offset)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return { conversations, total };
};

/**
 * Get active conversation for user (if exists)
 */
conversationSchema.statics.getActiveConversation = async function (
  userId: string
): Promise<IConversation | null> {
  return this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    status: ConversationStatus.Active,
  }).sort({ updatedAt: -1 });
};

/**
 * Cleanup old archived conversations
 */
conversationSchema.statics.cleanupOldConversations = async function (
  daysOld: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    status: ConversationStatus.Archived,
    createdAt: { $lt: cutoffDate },
  });

  if (result.deletedCount > 0) {
    logger.info('Old conversations cleaned up', {
      context: 'ConversationModel',
      action: 'CLEANUP_OLD_CONVERSATIONS',
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    });
  }

  return result.deletedCount;
};

/**
 * Get conversation statistics for a user
 */
conversationSchema.statics.getUserStats = async function (
  userId: string
): Promise<{
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  lastConversationAt: Date | null;
}> {
  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        activeConversations: {
          $sum: { $cond: [{ $eq: ['$status', ConversationStatus.Active] }, 1, 0] },
        },
        totalMessages: { $sum: '$messageCount' },
        lastConversationAt: { $max: '$updatedAt' },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalConversations: 0,
      activeConversations: 0,
      totalMessages: 0,
      lastConversationAt: null,
    };
  }

  return {
    totalConversations: stats[0].totalConversations,
    activeConversations: stats[0].activeConversations,
    totalMessages: stats[0].totalMessages,
    lastConversationAt: stats[0].lastConversationAt,
  };
};

// =============================================================================
// Pre-save Middleware
// =============================================================================

conversationSchema.pre('save', function (next) {
  // Update message count before saving
  if (this.isModified('messages')) {
    this.messageCount = this.messages.length;
  }

  // Auto-close conversations that are too old (optional, disabled by default)
  // if (this.status === ConversationStatus.Active) {
  //   const thirtyDaysAgo = new Date();
  //   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  //   if (this.updatedAt && this.updatedAt < thirtyDaysAgo) {
  //     this.status = ConversationStatus.Closed;
  //   }
  // }

  next();
});

// =============================================================================
// Post-save Hooks
// =============================================================================

conversationSchema.post('save', async function (doc) {
  // Log conversation creation
  if (doc.isNew) {
    logger.info('Conversation created', {
      context: 'ConversationModel',
      action: 'CREATE_CONVERSATION',
      conversationId: doc._id.toString(),
      userId: doc.userId.toString(),
      agentId: doc.agentId?.toString(),
    });
  }
});

// =============================================================================
// Model Export
// =============================================================================

// Create the model with type assertions for static methods
const Conversation = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
) as Model<IConversation> & {
  getUserConversations(
    userId: string,
    options?: {
      status?: ConversationStatus;
      limit?: number;
      offset?: number;
      sortBy?: 'updatedAt' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ conversations: IConversation[]; total: number }>;

  getActiveConversation(userId: string): Promise<IConversation | null>;

  cleanupOldConversations(daysOld?: number): Promise<number>;

  getUserStats(userId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    lastConversationAt: Date | null;
  }>;
};

export default Conversation;
