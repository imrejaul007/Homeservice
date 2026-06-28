import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// ============================================
// DISPUTE TYPES & INTERFACES
// ============================================

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
export type ResolutionType = 'refund' | 'partial_refund' | 'no_action' | 'provider_warning' | 'provider_suspended';
export type AppealStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type EvidenceType = 'image' | 'document' | 'text';
export type UserRole = 'customer' | 'provider';

export interface IDisputeEvidence {
  _id: Types.ObjectId;
  submittedBy: Types.ObjectId;
  type: EvidenceType;
  url?: string;
  description?: string;
  submittedAt: Date;
}

export interface IDisputeMessage {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: UserRole | 'admin';
  message: string;
  timestamp: Date;
  isSystemMessage: boolean;
}

export interface IDisputeResolution {
  type: ResolutionType;
  amount?: number;
  reason: string;
  notes?: string;
  resolvedBy: Types.ObjectId;
  resolvedAt: Date;
}

export interface IDisputeTimeline {
  action: string;
  performedBy: Types.ObjectId;
  performedByRole: UserRole | 'admin' | 'system';
  timestamp: Date;
  details?: string;
  previousStatus?: DisputeStatus;
  newStatus?: DisputeStatus;
}

export interface IDisputeAppeal {
  status: AppealStatus;
  reason: string;
  submittedBy: Types.ObjectId;
  submittedAt: Date;
  deadline: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  originalResolution?: {
    type: ResolutionType;
    amount?: number;
    reason: string;
  };
}

export interface IDispute extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Soft delete support
  isDeleted: boolean;
  deletedAt?: Date;

  // Core Information
  disputeNumber: string;
  bookingId: Types.ObjectId;

  // Parties involved
  initiator: {
    userId: Types.ObjectId;
    role: UserRole;
    name: string;
    email: string;
  };
  respondent: {
    userId: Types.ObjectId;
    role: UserRole;
    name: string;
    email: string;
  };

  // Dispute details
  reason: string;
  description: string;
  category: 'service_quality' | 'no_show' | 'damage' | 'billing' | 'cancellation' | 'communication' | 'other';
  status: DisputeStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Evidence
  evidence: IDisputeEvidence[];

  // Communication
  messages: IDisputeMessage[];

  // Resolution
  resolution?: IDisputeResolution;

  // Assignment
  assignedTo?: Types.ObjectId;
  assignedAt?: Date;

  // Escalation
  escalatedAt?: Date;
  escalationReason?: string;

  // Reopening (for resolved/closed disputes)
  reopenedAt?: Date;
  reopenedBy?: Types.ObjectId;
  reopenedReason?: string;

  // Appeal (for resolved disputes)
  appeal?: IDisputeAppeal;

  // Timeline/Audit Trail
  timeline: IDisputeTimeline[];

  // Booking reference (denormalized for quick access)
  bookingReference?: {
    bookingNumber: string;
    serviceName: string;
    scheduledDate: Date;
    totalAmount?: number;
    currency?: string;
  };

  // Admin review notes
  adminNotes?: string;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  addEvidence(evidence: Omit<IDisputeEvidence, '_id' | 'submittedAt'>): Promise<void>;
  addMessage(message: Omit<IDisputeMessage, '_id' | 'timestamp' | 'isSystemMessage'>): Promise<void>;
  updateStatus(newStatus: DisputeStatus, updatedBy: Types.ObjectId, updatedByRole: UserRole | 'admin' | 'system', reason?: string): Promise<void>;
  assignTo(adminId: Types.ObjectId): Promise<void>;
  escalate(reason: string): Promise<void>;
  resolve(resolution: Omit<IDisputeResolution, 'resolvedAt'>): Promise<void>;
  close(closedBy: Types.ObjectId, closedByRole: UserRole | 'admin' | 'system', reason?: string): Promise<void>;
}

// Static methods interface
export interface IDisputeModel extends Model<IDispute> {
  generateDisputeNumber(): Promise<string>;
  findByUser(userId: Types.ObjectId, options?: { status?: DisputeStatus; limit?: number; skip?: number }): Promise<IDispute[]>;
  findUnassigned(limit?: number): Promise<IDispute[]>;
  getStats(startDate?: Date, endDate?: Date): Promise<{
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byResolution: Record<string, { count: number; totalAmount: number }>;
    avgResolutionTimeHours: number;
  }>;
}

// ============================================
// SCHEMA DEFINITION
// ============================================

const disputeSchema = new Schema<IDispute>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },

    // Soft delete support
    isDeleted: {
      type: Boolean,
      default: false,
      select: false
    },
    deletedAt: Date,

    disputeNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },

    initiator: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: {
        type: String,
        enum: ['customer', 'provider'],
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
    },

    respondent: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: {
        type: String,
        enum: ['customer', 'provider'],
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
    },

    reason: {
      type: String,
      required: true,
      maxlength: [200, 'Reason cannot exceed 200 characters'],
    },

    description: {
      type: String,
      required: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },

    category: {
      type: String,
      enum: ['service_quality', 'no_show', 'damage', 'billing', 'cancellation', 'communication', 'other'],
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'escalated', 'closed'],
      default: 'open',
      required: true,
      index: true,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },

    evidence: [{
      _id: {
        type: Schema.Types.ObjectId,
        default: () => new Types.ObjectId(),
      },
      submittedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      type: {
        type: String,
        enum: ['image', 'document', 'text'],
        required: true,
      },
      url: String,
      description: String,
      submittedAt: {
        type: Date,
        default: Date.now,
      },
    }],

    messages: [{
      _id: {
        type: Schema.Types.ObjectId,
        default: () => new Types.ObjectId(),
      },
      senderId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      senderRole: {
        type: String,
        enum: ['customer', 'provider', 'admin'],
        required: true,
      },
      message: {
        type: String,
        required: true,
        maxlength: [2000, 'Message cannot exceed 2000 characters'],
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      isSystemMessage: {
        type: Boolean,
        default: false,
      },
    }],

    resolution: {
      type: {
        type: String,
        enum: ['refund', 'partial_refund', 'no_action', 'provider_warning', 'provider_suspended'],
        required: true,
      },
      amount: {
        type: Number,
        min: [0, 'Refund amount cannot be negative'],
      },
      reason: {
        type: String,
        required: true,
        maxlength: [1000, 'Resolution reason cannot exceed 1000 characters'],
      },
      notes: String,
      resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      resolvedAt: {
        type: Date,
        default: Date.now,
      },
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    assignedAt: Date,

    escalatedAt: Date,

    escalationReason: String,

    // Reopening fields
    reopenedAt: Date,

    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    reopenedReason: String,

    // Appeal fields
    appeal: {
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none',
      },
      reason: {
        type: String,
        maxlength: [2000, 'Appeal reason cannot exceed 2000 characters'],
      },
      submittedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      submittedAt: Date,
      deadline: Date,
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      reviewedAt: Date,
      reviewNotes: String,
      originalResolution: {
        type: {
          type: String,
          enum: ['refund', 'partial_refund', 'no_action', 'provider_warning', 'provider_suspended'],
        },
        amount: Number,
        reason: String,
      },
    },

    timeline: [{
      action: {
        type: String,
        required: true,
      },
      performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      performedByRole: {
        type: String,
        enum: ['customer', 'provider', 'admin', 'system'],
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      details: String,
      previousStatus: String,
      newStatus: String,
    }],

    bookingReference: {
      bookingNumber: String,
      serviceName: String,
      scheduledDate: Date,
      totalAmount: Number,
      currency: String,
    },

    adminNotes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES
// ============================================

// Compound indexes for common query patterns
disputeSchema.index({ 'initiator.userId': 1, status: 1 });
disputeSchema.index({ 'respondent.userId': 1, status: 1 });
disputeSchema.index({ assignedTo: 1, status: 1 });
disputeSchema.index({ status: 1, priority: 1, createdAt: -1 });
disputeSchema.index({ category: 1, status: 1 });

// Tenant isolation indexes
disputeSchema.index({ tenantId: 1, status: 1 });
disputeSchema.index({ tenantId: 1, 'initiator.userId': 1 });
disputeSchema.index({ tenantId: 1, 'respondent.userId': 1 });

// Soft delete indexes
disputeSchema.index({ isDeleted: 1, createdAt: -1 });
disputeSchema.index({ isDeleted: 1, status: 1 });

// FIX: Compound index on bookingId for efficient queries and cascade operations
disputeSchema.index({ bookingId: 1, status: 1 });

// Appeal indexes for efficient queries
disputeSchema.index({ 'appeal.status': 1, createdAt: -1 });
disputeSchema.index({ 'appeal.deadline': 1, 'appeal.status': 1 });

// Text index for search
disputeSchema.index({ disputeNumber: 'text', reason: 'text', description: 'text' });

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Add evidence to the dispute
 */
disputeSchema.methods.addEvidence = async function(
  this: IDispute,
  evidence: Omit<IDisputeEvidence, '_id' | 'submittedAt'>
): Promise<void> {
  this.evidence.push({
    _id: new Types.ObjectId(),
    ...evidence,
    submittedAt: new Date(),
  } as IDisputeEvidence);

  // Add to timeline
  this.timeline.push({
    action: 'evidence_added',
    performedBy: evidence.submittedBy,
    performedByRole: 'customer', // Will be determined by caller
    timestamp: new Date(),
    details: `New ${evidence.type} evidence submitted`,
  });

  await this.save();
};

/**
 * Add a message to the dispute
 */
disputeSchema.methods.addMessage = async function(
  this: IDispute,
  message: Omit<IDisputeMessage, '_id' | 'timestamp' | 'isSystemMessage'>
): Promise<void> {
  this.messages.push({
    _id: new Types.ObjectId(),
    ...message,
    timestamp: new Date(),
    isSystemMessage: false,
  } as IDisputeMessage);

  await this.save();
};

/**
 * Update dispute status with timeline tracking
 */
disputeSchema.methods.updateStatus = async function(
  this: IDispute,
  newStatus: DisputeStatus,
  updatedBy: Types.ObjectId,
  updatedByRole: UserRole | 'admin' | 'system',
  reason?: string
): Promise<void> {
  const previousStatus = this.status;
  this.status = newStatus;

  // Add to timeline
  this.timeline.push({
    action: 'status_changed',
    performedBy: updatedBy,
    performedByRole: updatedByRole,
    timestamp: new Date(),
    details: reason,
    previousStatus,
    newStatus,
  });

  // Auto-assign to admin when escalated
  if (newStatus === 'escalated' && !this.assignedTo) {
    this.escalatedAt = new Date();
  }

  await this.save();
};

/**
 * Assign dispute to an admin
 */
disputeSchema.methods.assignTo = async function(
  this: IDispute,
  adminId: Types.ObjectId
): Promise<void> {
  this.assignedTo = adminId;
  this.assignedAt = new Date();

  // Add to timeline
  this.timeline.push({
    action: 'assigned',
    performedBy: adminId,
    performedByRole: 'admin',
    timestamp: new Date(),
    details: `Assigned to admin`,
  });

  // Auto-update status to under_review if it was open
  if (this.status === 'open') {
    this.status = 'under_review';
    this.timeline.push({
      action: 'status_changed',
      performedBy: adminId,
      performedByRole: 'admin',
      timestamp: new Date(),
      details: 'Auto-transitioned to under_review when assigned',
      previousStatus: 'open',
      newStatus: 'under_review',
    });
  }

  await this.save();
};

/**
 * Escalate the dispute
 */
disputeSchema.methods.escalate = async function(
  this: IDispute,
  reason: string
): Promise<void> {
  const previousStatus = this.status;
  this.status = 'escalated';
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  this.priority = 'urgent';

  // Add to timeline
  this.timeline.push({
    action: 'escalated',
    performedBy: this.initiator.userId,
    performedByRole: this.initiator.role,
    timestamp: new Date(),
    details: reason,
    previousStatus,
    newStatus: 'escalated',
  });

  await this.save();
};

/**
 * Resolve the dispute
 */
disputeSchema.methods.resolve = async function(
  this: IDispute,
  resolution: Omit<IDisputeResolution, 'resolvedAt'>
): Promise<void> {
  const previousStatus = this.status;
  this.status = 'resolved';
  this.resolution = {
    ...resolution,
    resolvedAt: new Date(),
  };

  // Add to timeline
  this.timeline.push({
    action: 'resolved',
    performedBy: resolution.resolvedBy,
    performedByRole: 'admin',
    timestamp: new Date(),
    details: `Dispute resolved with outcome: ${resolution.type}${resolution.amount ? ` (${resolution.amount})` : ''}`,
    previousStatus,
    newStatus: 'resolved',
  });

  await this.save();
};

/**
 * Close the dispute (final state)
 */
disputeSchema.methods.close = async function(
  this: IDispute,
  closedBy: Types.ObjectId,
  closedByRole: UserRole | 'admin' | 'system',
  reason?: string
): Promise<void> {
  const previousStatus = this.status;
  this.status = 'closed';

  // Add to timeline
  this.timeline.push({
    action: 'closed',
    performedBy: closedBy,
    performedByRole: closedByRole,
    timestamp: new Date(),
    details: reason || 'Dispute closed',
    previousStatus,
    newStatus: 'closed',
  });

  await this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Generate unique dispute number
 */
disputeSchema.statics.generateDisputeNumber = async function(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get count of disputes created today
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const count = await this.countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `DSP-${year}${month}-${sequence}`;
};

/**
 * Find disputes by user (as initiator or respondent)
 */
disputeSchema.statics.findByUser = function(
  userId: Types.ObjectId,
  options?: { status?: DisputeStatus; limit?: number; skip?: number }
) {
  const query: any = {
    $or: [
      { 'initiator.userId': userId },
      { 'respondent.userId': userId },
    ],
  };

  if (options?.status) {
    query.status = options.status;
  }

  return this.find(query)
    .populate('bookingId')
    .sort({ createdAt: -1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 20);
};

/**
 * Find unassigned disputes
 */
disputeSchema.statics.findUnassigned = function(limit?: number) {
  return this.find({
    assignedTo: { $exists: false },
    status: { $in: ['open', 'escalated'] },
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit || 50);
};

/**
 * Get dispute statistics
 */
disputeSchema.statics.getStats = async function(startDate?: Date, endDate?: Date) {
  const dateFilter: any = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const matchStage: any = {};
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const categoryStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
  ]);

  const resolutionStats = await this.aggregate([
    { $match: { ...matchStage, status: 'resolved', 'resolution.type': { $exists: true } } },
    {
      $group: {
        _id: '$resolution.type',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$resolution.amount', 0] } },
      },
    },
  ]);

  const avgResolutionTime = await this.aggregate([
    { $match: { ...matchStage, status: { $in: ['resolved', 'closed'] }, 'resolution.resolvedAt': { $exists: true } } },
    {
      $project: {
        resolutionTime: {
          $divide: [
            { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
            1000 * 60 * 60, // Convert to hours
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgResolutionTime: { $avg: '$resolutionTime' },
      },
    },
  ]);

  return {
    byStatus: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    byCategory: categoryStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    byResolution: resolutionStats.reduce((acc, s) => ({ ...acc, [s._id]: { count: s.count, totalAmount: s.totalAmount } }), {}),
    avgResolutionTimeHours: avgResolutionTime[0]?.avgResolutionTime || 0,
  };
};

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

disputeSchema.pre('save', async function(next) {
  if (this.isNew && !this.disputeNumber) {
    this.disputeNumber = await (this.constructor as IDisputeModel).generateDisputeNumber();
  }

  // FIX: Validate bookingId refers to an existing (non-deleted) booking
  if (this.isModified('bookingId') || this.isNew) {
    const Booking = mongoose.model('Booking');
    const booking = await Booking.findById(this.bookingId).select('_id isDeleted').lean();

    const bookingDoc = booking as { _id: unknown; isDeleted?: boolean } | null;

    if (!bookingDoc) {
      const error = new Error('Booking not found') as Error & { name: string };
      error.name = 'ValidationError';
      return next(error);
    }

    if (bookingDoc.isDeleted === true) {
      const error = new Error('Cannot create dispute for a deleted booking') as Error & { name: string };
      error.name = 'ValidationError';
      return next(error);
    }
  }

  // Initialize timeline if new
  if (this.isNew) {
    this.timeline.push({
      action: 'created',
      performedBy: this.initiator.userId,
      performedByRole: this.initiator.role,
      timestamp: new Date(),
      details: 'Dispute created',
      newStatus: 'open',
    });
  }

  next();
});

// ============================================
// CREATE AND EXPORT MODEL
// ============================================

const Dispute = mongoose.model<IDispute, IDisputeModel>('Dispute', disputeSchema);

export default Dispute;
