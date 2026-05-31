import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================
// SUPPORT TICKET TYPES & INTERFACES
// ============================================

export type TicketStatus = 'open' | 'in_progress' | 'pending_response' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'technical' | 'billing' | 'account' | 'service' | 'other';
export type UserType = 'customer' | 'provider' | 'admin';

export interface ITicketMessage {
  _id: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  senderType: UserType;
  senderName?: string;
  message: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Core Fields
  ticketNumber: string;
  userId: mongoose.Types.ObjectId;
  userType: UserType;
  userName?: string;
  userEmail?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;

  // Content
  subject: string;
  description: string;

  // Assignment
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;

  // Communication Thread
  messages: ITicketMessage[];

  // Resolution Tracking
  resolvedAt?: Date;
  closedAt?: Date;

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit Fields (auto-added by mongoose)
  createdAt: Date;
  updatedAt: Date;

  // Instance Methods
  generateTicketNumber(): Promise<string>;
  addMessage(senderId: mongoose.Types.ObjectId, senderType: UserType, message: string, senderName?: string): Promise<void>;
  assignTo(adminId: mongoose.Types.ObjectId, adminName: string): Promise<void>;
  updateStatus(status: TicketStatus): Promise<void>;
  updatePriority(priority: TicketPriority): Promise<void>;
  resolve(): Promise<void>;
  close(): Promise<void>;
}

// Static methods interface
export interface ISupportTicketModel extends Model<ISupportTicket> {
  generateTicketNumber(): Promise<string>;
  getStats(filters?: Record<string, unknown>): Promise<Record<string, number>>;
}

// ============================================
// SUPPORT TICKET SCHEMA
// ============================================

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    ticketNumber: {
      type: String,
      unique: true,
      required: true,
      index: true
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },

    userType: {
      type: String,
      enum: {
        values: ['customer', 'provider', 'admin'],
        message: 'Invalid user type: {VALUE}'
      },
      required: [true, 'User type is required']
    },

    userName: {
      type: String
    },

    userEmail: {
      type: String
    },

    category: {
      type: String,
      enum: {
        values: ['technical', 'billing', 'account', 'service', 'other'],
        message: 'Invalid category: {VALUE}'
      },
      required: [true, 'Category is required'],
      index: true
    },

    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: 'Invalid priority: {VALUE}'
      },
      default: 'medium',
      index: true
    },

    status: {
      type: String,
      enum: {
        values: ['open', 'in_progress', 'pending_response', 'resolved', 'closed'],
        message: 'Invalid status: {VALUE}'
      },
      default: 'open',
      required: true,
      index: true
    },

    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters']
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },

    assignedToName: {
      type: String
    },

    messages: [{
      _id: {
        type: Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId()
      },
      sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      senderType: {
        type: String,
        enum: ['customer', 'provider', 'admin'],
        required: true
      },
      senderName: {
        type: String
      },
      message: {
        type: String,
        required: [true, 'Message content is required'],
        maxlength: [5000, 'Message cannot exceed 5000 characters']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],

    resolvedAt: {
      type: Date
    },

    closedAt: {
      type: Date
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Compound indexes for common query patterns
SupportTicketSchema.index({ status: 1, priority: 1 });
SupportTicketSchema.index({ category: 1, status: 1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ createdAt: -1, status: 1 });

// Text index for search functionality
SupportTicketSchema.index({ subject: 'text', description: 'text' });

// User lookup indexes
SupportTicketSchema.index({ userId: 1, createdAt: -1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Generate a unique ticket number
 * Format: TKT-YYYYMMDD-XXXX
 */
SupportTicketSchema.statics.generateTicketNumber = async function(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Find the highest sequence number for today
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const result = await this.findOne({
    ticketNumber: { $regex: `^TKT-${dateStr}-` }
  }).sort({ ticketNumber: -1 });

  let sequence = 1;
  if (result) {
    const lastNumber = result.ticketNumber.split('-')[2];
    sequence = parseInt(lastNumber, 10) + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `TKT-${dateStr}-${sequenceStr}`;
};

/**
 * Get tickets statistics
 */
SupportTicketSchema.statics.getStats = async function(filters: Record<string, unknown> = {}) {
  const stats = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    open: 0,
    in_progress: 0,
    pending_response: 0,
    resolved: 0,
    closed: 0,
    total: 0
  };

  stats.forEach(stat => {
    if (stat._id in result) {
      (result as Record<string, number>)[stat._id] = stat.count;
      result.total += stat.count;
    }
  });

  return result;
};

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Generate ticket number on creation
 */
SupportTicketSchema.methods.generateTicketNumber = async function(): Promise<string> {
  return (this.constructor as unknown as ISupportTicketModel).generateTicketNumber();
};

/**
 * Add a message to the ticket thread
 */
SupportTicketSchema.methods.addMessage = async function(
  senderId: mongoose.Types.ObjectId,
  senderType: UserType,
  message: string,
  senderName?: string
): Promise<void> {
  this.messages.push({
    _id: new mongoose.Types.ObjectId(),
    sender: senderId,
    senderType,
    senderName,
    message,
    createdAt: new Date()
  });

  // Update status based on who is responding
  if (senderType === 'admin' && this.status === 'open') {
    this.status = 'in_progress';
  } else if (senderType !== 'admin' && this.status === 'pending_response') {
    this.status = 'open';
  }

  await this.save();
};

/**
 * Assign ticket to an admin
 */
SupportTicketSchema.methods.assignTo = async function(
  adminId: mongoose.Types.ObjectId,
  adminName: string
): Promise<void> {
  this.assignedTo = adminId;
  this.assignedToName = adminName;

  if (this.status === 'open') {
    this.status = 'in_progress';
  }

  await this.save();
};

/**
 * Update ticket status
 */
SupportTicketSchema.methods.updateStatus = async function(status: TicketStatus): Promise<void> {
  this.status = status;

  // Set resolution/closure timestamps
  if (status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  } else if (status === 'closed' && !this.closedAt) {
    this.closedAt = new Date();
  }

  await this.save();
};

/**
 * Update ticket priority
 */
SupportTicketSchema.methods.updatePriority = async function(priority: TicketPriority): Promise<void> {
  this.priority = priority;
  await this.save();
};

/**
 * Mark ticket as resolved
 */
SupportTicketSchema.methods.resolve = async function(): Promise<void> {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  await this.save();
};

/**
 * Mark ticket as closed
 */
SupportTicketSchema.methods.close = async function(): Promise<void> {
  this.status = 'closed';
  this.closedAt = new Date();
  await this.save();
};

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

// Generate ticket number before first save
SupportTicketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    try {
      this.ticketNumber = await (this.constructor as unknown as ISupportTicketModel).generateTicketNumber();
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

// ============================================
// VIRTUALS
// ============================================

// Get message count
SupportTicketSchema.virtual('messageCount').get(function() {
  return this.messages?.length || 0;
});

// Check if ticket is open
SupportTicketSchema.virtual('isOpen').get(function() {
  return ['open', 'in_progress', 'pending_response'].includes(this.status);
});

// Check if ticket is assigned
SupportTicketSchema.virtual('isAssigned').get(function() {
  return !!this.assignedTo;
});

// Calculate response time (in hours)
SupportTicketSchema.virtual('responseTimeHours').get(function() {
  if (!this.createdAt) return null;
  const now = new Date();
  const diff = now.getTime() - new Date(this.createdAt).getTime();
  return Math.round(diff / (1000 * 60 * 60));
});

// Enable virtuals in JSON output
SupportTicketSchema.set('toJSON', { virtuals: true });
SupportTicketSchema.set('toObject', { virtuals: true });

// ============================================
// CREATE & EXPORT MODEL
// ============================================

const SupportTicket: Model<ISupportTicket> = mongoose.model<ISupportTicket, ISupportTicketModel>(
  'SupportTicket',
  SupportTicketSchema
);

export default SupportTicket;
