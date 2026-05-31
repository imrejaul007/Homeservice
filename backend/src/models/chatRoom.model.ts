import mongoose, { Document, Schema, Model } from 'mongoose';
import logger from '../utils/logger';

// =============================================================================
// Chat Room Types
// =============================================================================

export type ChatRoomType = 'direct' | 'booking' | 'support';
export type ChatRoomStatus = 'active' | 'archived' | 'blocked';

// =============================================================================
// Chat Room Interface
// =============================================================================

export interface IChatRoom extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  // Core Fields
  _id: mongoose.Types.ObjectId;
  name?: string; // Optional name for group chats or support rooms
  type: ChatRoomType;

  // Participants
  participants: Array<{
    userId: mongoose.Types.ObjectId;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
    lastReadAt?: Date;
    isMuted?: boolean;
    isPinned?: boolean;
  }>;

  // Optional Booking Link
  bookingId?: mongoose.Types.ObjectId;

  // Last Message Reference
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;

  // Unread Counts (per user)
  unreadCounts: Map<string, number>;

  // Status
  status: ChatRoomStatus;

  // Settings
  settings: {
    allowMessages: boolean;
    notificationsEnabled: boolean;
  };

  // Blocked Users (for direct chats)
  blockedBy?: mongoose.Types.ObjectId;
  blockedAt?: Date;
  blockReason?: string;

  // Soft Delete
  isDeleted: boolean;
  deletedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance Methods
  isParticipant(userId: string): boolean;
  addParticipant(userId: mongoose.Types.ObjectId, role?: 'owner' | 'admin' | 'member'): Promise<void>;
  removeParticipant(userId: mongoose.Types.ObjectId): Promise<void>;
  updateLastRead(userId: mongoose.Types.ObjectId): Promise<void>;
  incrementUnreadCount(userId: mongoose.Types.ObjectId): Promise<void>;
  resetUnreadCount(userId: mongoose.Types.ObjectId): Promise<void>;
  archive(): Promise<void>;
  block(userId: mongoose.Types.ObjectId, reason?: string): Promise<void>;
}

export interface IChatRoomModel extends Model<IChatRoom> {
  findOrCreateDirectChat(userId1: mongoose.Types.ObjectId, userId2: mongoose.Types.ObjectId): Promise<IChatRoom>;
  findOrCreateBookingChat(bookingId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId, providerId: mongoose.Types.ObjectId): Promise<IChatRoom>;
  getRoomsForUser(userId: string, options?: { status?: ChatRoomStatus; type?: ChatRoomType; limit?: number; skip?: number; bookingId?: string }): Promise<IChatRoom[]>;
  getTotalUnreadCount(userId: string): Promise<number>;
  updateLastMessage(roomId: string, messageId: mongoose.Types.ObjectId, preview?: string): Promise<void>;
}

// =============================================================================
// Chat Room Schema
// =============================================================================

const participantSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastReadAt: Date,
  isMuted: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const chatRoomSchema = new Schema<IChatRoom>(
  {
    // Multi-tenant
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    // Name (optional - used for support rooms)
    name: {
      type: String,
      maxlength: [100, 'Room name cannot exceed 100 characters']
    },

    // Type
    type: {
      type: String,
      enum: ['direct', 'booking', 'support'],
      required: [true, 'Room type is required'],
      index: true
    },

    // Participants
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: function(participants: Array<{
          userId: mongoose.Types.ObjectId;
          role: string;
          joinedAt: Date;
          lastReadAt?: Date;
          isMuted?: boolean;
          isPinned?: boolean;
        }>) {
          return participants && participants.length >= 2;
        },
        message: 'Chat room must have at least 2 participants'
      }
    },

    // Booking Link
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      index: true
    },

    // Last Message
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    lastMessageAt: {
      type: Date,
      index: true
    },
    lastMessagePreview: {
      type: String,
      maxlength: [200, 'Message preview cannot exceed 200 characters']
    },

    // Unread Counts - stored as a Map
    unreadCounts: {
      type: Map,
      of: Number,
      default: {}
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'archived', 'blocked'],
      default: 'active',
      index: true
    },

    // Settings
    settings: {
      allowMessages: {
        type: Boolean,
        default: true
      },
      notificationsEnabled: {
        type: Boolean,
        default: true
      }
    },

    // Blocking
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    blockedAt: Date,
    blockReason: String,

    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// =============================================================================
// Indexes for Performance
// =============================================================================

// Participant lookup
chatRoomSchema.index({ 'participants.userId': 1 });
chatRoomSchema.index({ type: 1, status: 1 });

// Last message sorting
chatRoomSchema.index({ lastMessageAt: -1 });

// Booking lookup
chatRoomSchema.index({ bookingId: 1, type: 1 });

// Active rooms for user
chatRoomSchema.index({ 'participants.userId': 1, status: 1, isDeleted: 1 });

// Tenant isolation
chatRoomSchema.index({ tenantId: 1, 'participants.userId': 1 });

// Compound for common queries
chatRoomSchema.index({ status: 1, isDeleted: 1, lastMessageAt: -1 });

// =============================================================================
// Virtual Properties
// =============================================================================

// Get participant count
chatRoomSchema.virtual('participantCount').get(function() {
  return this.participants?.length || 0;
});

// Check if user is participant
chatRoomSchema.methods.isParticipant = function(userId: string): boolean {
  return this.participants.some(
    (p: { userId: { toString: () => string } }) => p.userId.toString() === userId
  );
};

// Get other participant in direct chat
chatRoomSchema.virtual('otherParticipant').get(function(this: IChatRoom) {
  if (this.type !== 'direct' || this.participants.length !== 2) {
    return null;
  }
  return this.participants[1];
});

// =============================================================================
// Instance Methods
// =============================================================================

/**
 * Add a participant to the chat room
 */
chatRoomSchema.methods.addParticipant = async function(
  userId: mongoose.Types.ObjectId,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<void> {
  const exists = this.participants.some(
    (p: { userId: { equals: (id: mongoose.Types.ObjectId) => boolean } }) => p.userId.equals(userId)
  );

  if (!exists) {
    this.participants.push({
      userId,
      role,
      joinedAt: new Date()
    });
    await this.save();

    logger.info('Participant added to chat room', {
      context: 'ChatRoomModel',
      action: 'ADD_PARTICIPANT',
      chatRoomId: this._id.toString(),
      userId: userId.toString(),
      role,
    });
  }
};

/**
 * Remove a participant from the chat room
 */
chatRoomSchema.methods.removeParticipant = async function(
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const initialLength = this.participants.length;
  this.participants = this.participants.filter(
    (p: { userId: { equals: (id: mongoose.Types.ObjectId) => boolean } }) => !p.userId.equals(userId)
  );

  if (this.participants.length < initialLength) {
    await this.save();

    logger.info('Participant removed from chat room', {
      context: 'ChatRoomModel',
      action: 'REMOVE_PARTICIPANT',
      chatRoomId: this._id.toString(),
      userId: userId.toString(),
    });
  }
};

/**
 * Update last read timestamp for a participant
 */
chatRoomSchema.methods.updateLastRead = async function(
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const participant = this.participants.find(
    (p: { userId: { equals: (id: mongoose.Types.ObjectId) => boolean } }) => p.userId.equals(userId)
  );

  if (participant) {
    participant.lastReadAt = new Date();
    await this.save();
  }
};

/**
 * Increment unread count for a user
 */
chatRoomSchema.methods.incrementUnreadCount = async function(
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const userIdStr = userId.toString();
  const currentCount = this.unreadCounts.get(userIdStr) || 0;
  this.unreadCounts.set(userIdStr, currentCount + 1);
  await this.save();
};

/**
 * Reset unread count for a user
 */
chatRoomSchema.methods.resetUnreadCount = async function(
  userId: mongoose.Types.ObjectId
): Promise<void> {
  this.unreadCounts.set(userId.toString(), 0);
  await this.save();
};

/**
 * Archive the chat room
 */
chatRoomSchema.methods.archive = async function(): Promise<void> {
  this.status = 'archived';
  await this.save();

  logger.info('Chat room archived', {
    context: 'ChatRoomModel',
    action: 'ARCHIVE',
    chatRoomId: this._id.toString(),
  });
};

/**
 * Block a user in the chat room
 */
chatRoomSchema.methods.block = async function(
  blockedBy: mongoose.Types.ObjectId,
  reason?: string
): Promise<void> {
  this.status = 'blocked';
  this.blockedBy = blockedBy;
  this.blockedAt = new Date();
  this.blockReason = reason;
  await this.save();

  logger.info('Chat room blocked', {
    context: 'ChatRoomModel',
    action: 'BLOCK',
    chatRoomId: this._id.toString(),
    blockedBy: blockedBy.toString(),
    reason,
  });
};

// =============================================================================
// Static Methods
// =============================================================================

/**
 * Find or create a direct chat room between two users
 */
chatRoomSchema.statics.findOrCreateDirectChat = async function(
  userId1: string,
  userId2: string
): Promise<IChatRoom> {
  // Check for existing direct chat
  const existingRoom = await this.findOne({
    type: 'direct',
    'participants.userId': { $all: [
      new mongoose.Types.ObjectId(userId1),
      new mongoose.Types.ObjectId(userId2)
    ]},
    status: { $ne: 'blocked' },
    isDeleted: false
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Create new chat room
  const newRoom = new this({
    type: 'direct',
    participants: [
      {
        userId: new mongoose.Types.ObjectId(userId1),
        role: 'member',
        joinedAt: new Date()
      },
      {
        userId: new mongoose.Types.ObjectId(userId2),
        role: 'member',
        joinedAt: new Date()
      }
    ],
    status: 'active'
  });

  await newRoom.save();

  logger.info('Direct chat room created', {
    context: 'ChatRoomModel',
    action: 'CREATE_DIRECT_CHAT',
    chatRoomId: newRoom._id.toString(),
    participants: [userId1, userId2],
  });

  return newRoom;
};

/**
 * Find or create a booking chat room
 */
chatRoomSchema.statics.findOrCreateBookingChat = async function(
  bookingId: string,
  customerId: string,
  providerId: string
): Promise<IChatRoom> {
  // Check for existing booking chat
  const existingRoom = await this.findOne({
    bookingId: new mongoose.Types.ObjectId(bookingId),
    type: 'booking',
    isDeleted: false
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Create new booking chat room
  const newRoom = new this({
    type: 'booking',
    bookingId: new mongoose.Types.ObjectId(bookingId),
    participants: [
      {
        userId: new mongoose.Types.ObjectId(customerId),
        role: 'member',
        joinedAt: new Date()
      },
      {
        userId: new mongoose.Types.ObjectId(providerId),
        role: 'owner',
        joinedAt: new Date()
      }
    ],
    status: 'active'
  });

  await newRoom.save();

  logger.info('Booking chat room created', {
    context: 'ChatRoomModel',
    action: 'CREATE_BOOKING_CHAT',
    chatRoomId: newRoom._id.toString(),
    bookingId,
  });

  return newRoom;
};

/**
 * Get chat rooms for a user
 */
chatRoomSchema.statics.getRoomsForUser = async function(
  userId: string,
  options: {
    status?: ChatRoomStatus;
    type?: ChatRoomType;
    limit?: number;
    skip?: number;
    sortBy?: 'lastMessageAt' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<IChatRoom[]> {
  const {
    status = 'active',
    type,
    limit = 20,
    skip = 0,
    sortBy = 'lastMessageAt',
    sortOrder = 'desc'
  } = options;

  const query: Record<string, unknown> = {
    'participants.userId': new mongoose.Types.ObjectId(userId),
    status,
    isDeleted: false
  };

  if (type) {
    query.type = type;
  }

  return this.find(query)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit)
    .populate('participants.userId', 'firstName lastName avatar role')
    .populate('lastMessage')
    .populate('bookingId', 'bookingNumber status scheduledDate')
    .lean();
};

/**
 * Get total unread count for a user
 */
chatRoomSchema.statics.getTotalUnreadCount = async function(userId: string): Promise<number> {
  const rooms = await this.find({
    'participants.userId': new mongoose.Types.ObjectId(userId),
    status: 'active',
    isDeleted: false
  }).select('unreadCounts');

  let totalUnread = 0;
  for (const room of rooms) {
    const count = room.unreadCounts?.get(userId) || 0;
    totalUnread += count;
  }

  return totalUnread;
};

/**
 * Update last message info
 */
chatRoomSchema.statics.updateLastMessage = async function(
  roomId: string,
  messageId: mongoose.Types.ObjectId,
  preview?: string
): Promise<void> {
  await this.findByIdAndUpdate(roomId, {
    lastMessage: messageId,
    lastMessageAt: new Date(),
    lastMessagePreview: preview?.substring(0, 200)
  });
};

// =============================================================================
// Pre-save Middleware
// =============================================================================

chatRoomSchema.pre('save', function(next) {
  // Validate minimum participants
  if (this.participants.length < 2 && this.type === 'direct') {
    next(new Error('Direct chat rooms must have at least 2 participants'));
    return;
  }

  // Ensure direct chats have exactly 2 participants
  if (this.type === 'direct' && this.participants.length > 2) {
    next(new Error('Direct chat rooms cannot have more than 2 participants'));
    return;
  }

  // Set owner role for booking rooms
  if (this.type === 'booking' && this.isNew) {
    const ownerParticipant = this.participants.find(
      (p: { role: string }) => p.role === 'owner'
    );
    if (!ownerParticipant) {
      this.participants[1].role = 'owner';
    }
  }

  next();
});

// =============================================================================
// Post-save Hooks
// =============================================================================

chatRoomSchema.post('save', async function(doc) {
  logger.debug('Chat room saved', {
    context: 'ChatRoomModel',
    action: 'SAVE',
    chatRoomId: doc._id.toString(),
    type: doc.type,
    participantCount: doc.participants.length,
  });
});

// =============================================================================
// Model Export
// =============================================================================

const ChatRoom = mongoose.model<IChatRoom, IChatRoomModel>('ChatRoom', chatRoomSchema);

export default ChatRoom;
