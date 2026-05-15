import mongoose, { Types } from 'mongoose';
import Dispute, { IDispute, DisputeStatus, ResolutionType, UserRole } from '../models/dispute.model';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CreateDisputeDTO {
  bookingId: string;
  reason: string;
  description: string;
  category: 'service_quality' | 'no_show' | 'damage' | 'billing' | 'cancellation' | 'communication' | 'other';
  evidence?: Array<{
    type: 'image' | 'document' | 'text';
    url?: string;
    description?: string;
  }>;
}

export interface AddEvidenceDTO {
  disputeId: string;
  userId: string;
  type: 'image' | 'document' | 'text';
  url?: string;
  description?: string;
}

export interface AddMessageDTO {
  disputeId: string;
  senderId: string;
  senderRole: UserRole | 'admin';
  message: string;
}

export interface ResolveDisputeDTO {
  disputeId: string;
  resolvedBy: string;
  resolutionType: ResolutionType;
  amount?: number;
  reason: string;
  notes?: string;
}

export interface DisputeFiltersDTO {
  status?: DisputeStatus;
  category?: string;
  priority?: string;
  assignedTo?: string;
  initiatorId?: string;
  respondentId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedDisputesResult {
  disputes: IDispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

// ============================================
// DISPUTE SERVICE CLASS
// ============================================

export class DisputeService {
  // ========================================
  // Create Dispute (Customer or Provider Initiated)
  // ========================================

  async createDispute(userId: string, userRole: UserRole, data: CreateDisputeDTO): Promise<IDispute> {
    // Validate booking exists
    const booking = await Booking.findById(data.bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Validate user is part of this booking
    const isCustomer = booking.customerId?.toString() === userId;
    const isProvider = booking.providerId.toString() === userId;

    if (!isCustomer && !isProvider) {
      throw new ApiError(403, 'You are not authorized to create a dispute for this booking');
    }

    // Check if dispute already exists for this booking
    const existingDispute = await Dispute.findOne({
      bookingId: data.bookingId,
      status: { $nin: ['resolved', 'closed'] },
    });

    if (existingDispute) {
      throw new ApiError(409, 'An active dispute already exists for this booking');
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Determine initiator and respondent
    const initiator = {
      userId: new Types.ObjectId(userId),
      role: userRole,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
    };

    const respondentUserId = isCustomer ? booking.providerId : booking.customerId;
    const respondentUser = respondentUserId ? await User.findById(respondentUserId) : null;

    const respondent = {
      userId: respondentUserId || new Types.ObjectId(),
      role: (isCustomer ? 'provider' : 'customer') as UserRole,
      name: respondentUser ? `${respondentUser.firstName} ${respondentUser.lastName}` : 'Unknown',
      email: respondentUser?.email || '',
    };

    // Get service name for reference
    const service = booking.serviceId;

    // Create dispute
    const disputeData: Partial<IDispute> = {
      bookingId: new Types.ObjectId(data.bookingId),
      initiator,
      respondent,
      reason: data.reason,
      description: data.description,
      category: data.category,
      status: 'open',
      priority: this.calculatePriority(data.category),
      evidence: data.evidence?.map(e => ({
        _id: new Types.ObjectId(),
        submittedBy: new Types.ObjectId(userId),
        type: e.type,
        url: e.url,
        description: e.description,
        submittedAt: new Date(),
      })) || [],
      bookingReference: {
        bookingNumber: booking.bookingNumber,
        serviceName: service?.toString() || 'Unknown Service',
        scheduledDate: booking.scheduledDate,
        totalAmount: booking.pricing?.totalAmount || 0,
        currency: booking.pricing?.currency || 'AED',
      },
    };

    const dispute = new Dispute(disputeData);
    await dispute.save();

    // Populate for response
    await dispute.populate([
      { path: 'bookingId', select: 'bookingNumber pricing scheduledDate' },
      { path: 'initiator.userId', select: 'firstName lastName email' },
      { path: 'respondent.userId', select: 'firstName lastName email' },
    ]);

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_CREATED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      bookingId: dispute.bookingId,
      category: dispute.category,
      priority: dispute.priority,
      initiatedBy: userId,
      initiatorRole: userRole,
    });

    return dispute;
  }

  // ========================================
  // Get Dispute by ID
  // ========================================

  async getDisputeById(disputeId: string, userId?: string, userRole?: string): Promise<IDispute> {
    if (!mongoose.Types.ObjectId.isValid(disputeId)) {
      throw new ApiError(400, 'Invalid dispute ID');
    }

    const dispute = await Dispute.findById(disputeId)
      .populate('bookingId', 'bookingNumber pricing scheduledDate location customerInfo providerId')
      .populate('initiator.userId', 'firstName lastName email avatar')
      .populate('respondent.userId', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName email')
      .populate('evidence.submittedBy', 'firstName lastName')
      .populate('messages.senderId', 'firstName lastName');

    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    // Authorization check - allow if user is part of dispute or is admin
    if (userId && userRole !== 'admin') {
      const isParty =
        dispute.initiator.userId._id.toString() === userId ||
        dispute.respondent.userId._id.toString() === userId;

      if (!isParty) {
        throw new ApiError(403, 'Access denied');
      }
    }

    return dispute;
  }

  // ========================================
  // List Disputes (with filters)
  // ========================================

  async listDisputes(filters: DisputeFiltersDTO): Promise<PaginatedDisputesResult> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.assignedTo) {
      query.assignedTo = new Types.ObjectId(filters.assignedTo);
    }

    if (filters.initiatorId) {
      query['initiator.userId'] = new Types.ObjectId(filters.initiatorId);
    }

    if (filters.respondentId) {
      query['respondent.userId'] = new Types.ObjectId(filters.respondentId);
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      Dispute.find(query)
        .populate('bookingId', 'bookingNumber pricing scheduledDate')
        .populate('initiator.userId', 'firstName lastName email')
        .populate('respondent.userId', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Dispute.countDocuments(query),
    ]);

    return {
      disputes: disputes as IDispute[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + disputes.length < total,
      },
    };
  }

  // ========================================
  // Get User's Disputes
  // ========================================

  async getUserDisputes(userId: string, filters?: { status?: DisputeStatus; page?: number; limit?: number }): Promise<PaginatedDisputesResult> {
    const query: any = {
      $or: [
        { 'initiator.userId': new Types.ObjectId(userId) },
        { 'respondent.userId': new Types.ObjectId(userId) },
      ],
    };

    if (filters?.status) {
      query.status = filters.status;
    }

    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      Dispute.find(query)
        .populate('bookingId', 'bookingNumber pricing scheduledDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Dispute.countDocuments(query),
    ]);

    return {
      disputes: disputes as IDispute[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + disputes.length < total,
      },
    };
  }

  // ========================================
  // Add Evidence
  // ========================================

  async addEvidence(data: AddEvidenceDTO): Promise<IDispute> {
    const dispute = await Dispute.findById(data.disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    // Authorization check
    const isParty =
      dispute.initiator.userId.toString() === data.userId ||
      dispute.respondent.userId.toString() === data.userId;

    if (!isParty) {
      throw new ApiError(403, 'Only dispute parties can submit evidence');
    }

    // Check dispute is not closed
    if (['resolved', 'closed'].includes(dispute.status)) {
      throw new ApiError(400, 'Cannot add evidence to a closed dispute');
    }

    // Add evidence
    dispute.evidence.push({
      _id: new Types.ObjectId(),
      submittedBy: new Types.ObjectId(data.userId),
      type: data.type,
      url: data.url,
      description: data.description,
      submittedAt: new Date(),
    });

    // Add timeline entry
    dispute.timeline.push({
      action: 'evidence_added',
      performedBy: new Types.ObjectId(data.userId),
      performedByRole: dispute.initiator.userId.toString() === data.userId ? dispute.initiator.role : dispute.respondent.role,
      timestamp: new Date(),
      details: `New ${data.type} evidence submitted`,
    });

    await dispute.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_EVIDENCE_ADDED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      evidenceType: data.type,
      submittedBy: data.userId,
    });

    // Re-fetch with populated data
    return this.getDisputeById(data.disputeId);
  }

  // ========================================
  // Add Message
  // ========================================

  async addMessage(data: AddMessageDTO): Promise<IDispute> {
    const dispute = await Dispute.findById(data.disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    // Authorization check
    const isParty =
      dispute.initiator.userId.toString() === data.senderId ||
      dispute.respondent.userId.toString() === data.senderId;

    const isAdmin = data.senderRole === 'admin';

    if (!isParty && !isAdmin) {
      throw new ApiError(403, 'Only dispute parties or admins can send messages');
    }

    // Check dispute is not closed
    if (['resolved', 'closed'].includes(dispute.status)) {
      throw new ApiError(400, 'Cannot send messages to a closed dispute');
    }

    // Add message
    dispute.messages.push({
      _id: new Types.ObjectId(),
      senderId: new Types.ObjectId(data.senderId),
      senderRole: data.senderRole,
      message: data.message,
      timestamp: new Date(),
      isSystemMessage: false,
    });

    // Add timeline entry
    dispute.timeline.push({
      action: 'message_sent',
      performedBy: new Types.ObjectId(data.senderId),
      performedByRole: data.senderRole,
      timestamp: new Date(),
      details: 'New message added to dispute',
    });

    await dispute.save();

    // Emit event for real-time notifications
    eventBus.publish(EVENT_TYPES.DISPUTE_MESSAGE_ADDED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      senderId: data.senderId,
      senderRole: data.senderRole,
    });

    // Re-fetch with populated data
    return this.getDisputeById(data.disputeId);
  }

  // ========================================
  // Assign Dispute to Admin
  // ========================================

  async assignDispute(disputeId: string, adminId: string): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    if (dispute.assignedTo?.toString() === adminId) {
      throw new ApiError(400, 'Dispute is already assigned to this admin');
    }

    // Update assignment
    dispute.assignedTo = new Types.ObjectId(adminId);
    dispute.assignedAt = new Date();

    // Auto-transition to under_review if it was open
    if (dispute.status === 'open') {
      dispute.status = 'under_review';
      dispute.timeline.push({
        action: 'status_changed',
        performedBy: new Types.ObjectId(adminId),
        performedByRole: 'admin',
        timestamp: new Date(),
        details: 'Auto-transitioned to under_review when assigned',
        previousStatus: 'open',
        newStatus: 'under_review',
      });
    }

    // Add timeline entry
    dispute.timeline.push({
      action: 'assigned',
      performedBy: new Types.ObjectId(adminId),
      performedByRole: 'admin',
      timestamp: new Date(),
      details: `Assigned to admin`,
    });

    await dispute.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_ASSIGNED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      assignedTo: adminId,
    });

    // Re-fetch with populated data
    return this.getDisputeById(disputeId, adminId, 'admin');
  }

  // ========================================
  // Escalate Dispute
  // ========================================

  async escalateDispute(disputeId: string, userId: string, userRole: UserRole, reason: string): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    // Authorization check
    const isParty =
      dispute.initiator.userId.toString() === userId ||
      dispute.respondent.userId.toString() === userId;

    if (!isParty) {
      throw new ApiError(403, 'Only dispute parties can escalate');
    }

    if (dispute.status === 'escalated') {
      throw new ApiError(400, 'Dispute is already escalated');
    }

    if (['resolved', 'closed'].includes(dispute.status)) {
      throw new ApiError(400, 'Cannot escalate a closed dispute');
    }

    const previousStatus = dispute.status;

    dispute.status = 'escalated';
    dispute.escalatedAt = new Date();
    dispute.escalationReason = reason;
    dispute.priority = 'urgent';

    dispute.timeline.push({
      action: 'escalated',
      performedBy: new Types.ObjectId(userId),
      performedByRole: userRole,
      timestamp: new Date(),
      details: reason,
      previousStatus,
      newStatus: 'escalated',
    });

    await dispute.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_ESCALATED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      escalatedBy: userId,
      reason,
    });

    return this.getDisputeById(disputeId);
  }

  // ========================================
  // Update Dispute Status
  // ========================================

  async updateStatus(
    disputeId: string,
    adminId: string,
    newStatus: DisputeStatus,
    reason?: string
  ): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    const validTransitions: Record<DisputeStatus, DisputeStatus[]> = {
      open: ['under_review', 'escalated', 'closed'],
      under_review: ['resolved', 'escalated', 'closed'],
      escalated: ['under_review', 'resolved', 'closed'],
      resolved: ['closed'],
      closed: [],
    };

    if (!validTransitions[dispute.status].includes(newStatus)) {
      throw new ApiError(400, `Cannot transition from ${dispute.status} to ${newStatus}`);
    }

    const previousStatus = dispute.status;
    dispute.status = newStatus;

    dispute.timeline.push({
      action: 'status_changed',
      performedBy: new Types.ObjectId(adminId),
      performedByRole: 'admin',
      timestamp: new Date(),
      details: reason,
      previousStatus,
      newStatus,
    });

    await dispute.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_STATUS_CHANGED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      previousStatus,
      newStatus,
      changedBy: adminId,
    });

    return this.getDisputeById(disputeId, adminId, 'admin');
  }

  // ========================================
  // Resolve Dispute
  // ========================================

  async resolveDispute(data: ResolveDisputeDTO): Promise<IDispute> {
    const dispute = await Dispute.findById(data.disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      throw new ApiError(400, 'Dispute is already resolved or closed');
    }

    // Validate resolution type and amount
    if (['refund', 'partial_refund'].includes(data.resolutionType) && !data.amount) {
      throw new ApiError(400, 'Refund amount is required for refund resolutions');
    }

    if (data.amount && dispute.bookingReference?.totalAmount && data.amount > dispute.bookingReference.totalAmount) {
      throw new ApiError(400, 'Refund amount cannot exceed booking total');
    }

    const previousStatus = dispute.status;

    dispute.status = 'resolved';
    dispute.resolution = {
      type: data.resolutionType,
      amount: data.amount,
      reason: data.reason,
      notes: data.notes,
      resolvedBy: new Types.ObjectId(data.resolvedBy),
      resolvedAt: new Date(),
    };

    dispute.timeline.push({
      action: 'resolved',
      performedBy: new Types.ObjectId(data.resolvedBy),
      performedByRole: 'admin',
      timestamp: new Date(),
      details: `Dispute resolved with outcome: ${data.resolutionType}${data.amount ? ` (${data.amount} ${dispute.bookingReference?.currency || 'AED'})` : ''}`,
      previousStatus,
      newStatus: 'resolved',
    });

    await dispute.save();

    // Emit events
    eventBus.publish(EVENT_TYPES.DISPUTE_RESOLVED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      resolutionType: data.resolutionType,
      amount: data.amount,
      resolvedBy: data.resolvedBy,
      bookingId: dispute.bookingId,
    });

    // If refund, trigger refund process
    if (['refund', 'partial_refund'].includes(data.resolutionType) && data.amount) {
      eventBus.publish(EVENT_TYPES.REFUND_TRIGGERED, {
        disputeId: dispute._id,
        disputeNumber: dispute.disputeNumber,
        bookingId: dispute.bookingId,
        amount: data.amount,
        type: data.resolutionType,
      });
    }

    return this.getDisputeById(data.disputeId, data.resolvedBy, 'admin');
  }

  // ========================================
  // Close Dispute
  // ========================================

  async closeDispute(disputeId: string, userId: string, userRole: UserRole | 'admin' | 'system', reason?: string): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    if (dispute.status === 'closed') {
      throw new ApiError(400, 'Dispute is already closed');
    }

    const previousStatus = dispute.status;
    dispute.status = 'closed';

    dispute.timeline.push({
      action: 'closed',
      performedBy: new Types.ObjectId(userId),
      performedByRole: userRole,
      timestamp: new Date(),
      details: reason || 'Dispute closed',
      previousStatus,
      newStatus: 'closed',
    });

    await dispute.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_CLOSED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      closedBy: userId,
      reason,
    });

    return this.getDisputeById(disputeId);
  }

  // ========================================
  // Add Admin Notes
  // ========================================

  async addAdminNotes(disputeId: string, adminId: string, notes: string): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    dispute.adminNotes = notes;
    dispute.updatedAt = new Date();

    dispute.timeline.push({
      action: 'admin_notes_added',
      performedBy: new Types.ObjectId(adminId),
      performedByRole: 'admin',
      timestamp: new Date(),
      details: 'Admin notes updated',
    });

    await dispute.save();

    return this.getDisputeById(disputeId, adminId, 'admin');
  }

  // ========================================
  // Get Unassigned Disputes
  // ========================================

  async getUnassignedDisputes(limit?: number): Promise<IDispute[]> {
    return Dispute.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: null },
      ],
      status: { $in: ['open', 'escalated'] },
    })
      .populate('bookingId', 'bookingNumber pricing scheduledDate')
      .populate('initiator.userId', 'firstName lastName email')
      .populate('respondent.userId', 'firstName lastName email')
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit || 50) as unknown as IDispute[];
  }

  // ========================================
  // Get Disputes by Admin
  // ========================================

  async getDisputesByAdmin(adminId: string, filters?: { status?: DisputeStatus; page?: number; limit?: number }): Promise<PaginatedDisputesResult> {
    return this.listDisputes({
      ...filters,
      assignedTo: adminId,
    });
  }

  // ========================================
  // Get Dispute Statistics
  // ========================================

  async getDisputeStats(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await Dispute.getStats(start, end);

    // Get additional stats
    const [totalDisputes, openDisputes, escalatedDisputes, avgResponseTime] = await Promise.all([
      Dispute.countDocuments(),
      Dispute.countDocuments({ status: 'open' }),
      Dispute.countDocuments({ status: 'escalated' }),
      this.calculateAverageResponseTime(start, end),
    ]);

    return {
      ...stats,
      totalDisputes,
      openDisputes,
      escalatedDisputes,
      avgResponseTimeHours: avgResponseTime,
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Calculate priority based on dispute category
   */
  private calculatePriority(category: string): 'low' | 'medium' | 'high' | 'urgent' {
    const highPriorityCategories = ['damage', 'no_show'];
    const urgentPriorityCategories = ['billing'];

    if (urgentPriorityCategories.includes(category)) return 'urgent';
    if (highPriorityCategories.includes(category)) return 'high';
    return 'medium';
  }

  /**
   * Calculate average response time for disputes
   */
  private async calculateAverageResponseTime(startDate?: Date, endDate?: Date): Promise<number> {
    const matchStage: any = {
      status: { $in: ['resolved', 'closed'] },
      assignedAt: { $exists: true },
    };

    if (startDate) matchStage.createdAt = { $gte: startDate };
    if (endDate) matchStage.createdAt = { ...matchStage.createdAt, $lte: endDate };

    const result = await Dispute.aggregate([
      { $match: matchStage },
      {
        $project: {
          responseTimeHours: {
            $divide: [
              { $subtract: ['$assignedAt', '$createdAt'] },
              1000 * 60 * 60,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTimeHours' },
        },
      },
    ]);

    return result[0]?.avgResponseTime || 0;
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const disputeService = new DisputeService();
export default disputeService;
