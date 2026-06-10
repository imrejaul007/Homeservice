import mongoose, { ClientSession, Types } from 'mongoose';
import Dispute, { IDispute, DisputeStatus, ResolutionType, UserRole } from '../models/dispute.model';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { NotificationService } from './notification.service';
import logger from '../utils/logger';

// ============================================
// VALIDATION CONSTANTS
// ============================================

const MAX_MESSAGE_LENGTH = 5000;
const MAX_ESCALATION_REASON_LENGTH = 1000;
const MAX_ADMIN_NOTES_LENGTH = 5000;

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
  tenantId?: string;
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
    // Start a MongoDB transaction for atomic operations
    const session: ClientSession = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      // Validate booking exists
      const booking = await Booking.findById(data.bookingId).session(session);
      if (!booking) {
        await session.abortTransaction();
        throw new ApiError(404, 'Booking not found');
      }

      // Validate user is part of this booking
      const isCustomer = booking.customerId?.toString() === userId;
      const isProvider = booking.providerId.toString() === userId;

      if (!isCustomer && !isProvider) {
        await session.abortTransaction();
        throw new ApiError(403, 'You are not authorized to create a dispute for this booking');
      }

      // Check if dispute already exists for this booking
      const existingDispute = await Dispute.findOne({
        bookingId: data.bookingId,
        status: { $nin: ['resolved', 'closed'] },
      }).session(session);

      if (existingDispute) {
        await session.abortTransaction();
        throw new ApiError(409, 'An active dispute already exists for this booking');
      }

      // Get user details
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
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
      const respondentUser = respondentUserId ? await User.findById(respondentUserId).session(session) : null;

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
        tenantId: data.tenantId ? new Types.ObjectId(data.tenantId) : undefined,
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
      await dispute.save({ session });

      // Commit transaction for dispute creation
      await session.commitTransaction();

      // Populate for response (outside transaction)
      await dispute.populate([
        { path: 'bookingId', select: 'bookingNumber pricing scheduledDate' },
        { path: 'initiator.userId', select: 'firstName lastName email' },
        { path: 'respondent.userId', select: 'firstName lastName email' },
      ]);

      // Emit event (outside transaction)
      eventBus.publish(EVENT_TYPES.DISPUTE_CREATED, {
        disputeId: dispute._id,
        disputeNumber: dispute.disputeNumber,
        bookingId: dispute.bookingId,
        category: dispute.category,
        priority: dispute.priority,
        initiatedBy: userId,
        initiatorRole: userRole,
      });

      // Send notification to respondent (the other party in the dispute)
      // This ensures they know a dispute has been filed against them
      if (respondentUserId && respondentUser) {
        try {
          const notificationService = new NotificationService();
          await notificationService.createNotification({
            recipientId: respondentUserId.toString(),
            type: 'dispute_received',
            title: 'New Dispute Filed',
            message: `A dispute has been filed for booking #${booking.bookingNumber}. Reason: ${data.reason}`,
            metadata: {
              disputeId: dispute._id.toString(),
              disputeNumber: dispute.disputeNumber,
              bookingNumber: booking.bookingNumber,
              reason: data.reason,
            },
          });
        } catch (notifError) {
          // Log but don't fail the dispute creation
          logger.error('Failed to send dispute notification to respondent', {
            context: 'DisputeService',
            action: 'NOTIFICATION_ERROR',
            disputeId: dispute._id.toString(),
            respondentId: respondentUserId?.toString(),
            error: notifError instanceof Error ? notifError.message : String(notifError),
          });
        }
      }

      return dispute;

    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (!session.hasEnded) {
        await session.endSession();
      }
    }
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
    // Get dispute for authorization check first
    const dispute = await Dispute.findById(data.disputeId).select('_id initiator.respondent status');
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

    // Atomic update - only succeeds if dispute is still open
    const result = await Dispute.findOneAndUpdate(
      { _id: data.disputeId, status: { $nin: ['resolved', 'closed'] } },
      {
        $push: {
          evidence: {
            _id: new Types.ObjectId(),
            submittedBy: new Types.ObjectId(data.userId),
            type: data.type,
            url: data.url,
            description: data.description,
            submittedAt: new Date(),
          },
          timeline: {
            action: 'evidence_added',
            performedBy: new Types.ObjectId(data.userId),
            performedByRole: dispute.initiator.userId.toString() === data.userId ? dispute.initiator.role : dispute.respondent.role,
            timestamp: new Date(),
            details: `New ${data.type} evidence submitted`,
          },
        },
      },
      { new: true }
    );

    if (!result) {
      throw new ApiError(400, 'Cannot add evidence to closed dispute');
    }

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_EVIDENCE_ADDED, {
      disputeId: result._id,
      disputeNumber: result.disputeNumber,
      evidenceType: data.type,
      submittedBy: data.userId,
    });

    // Notify the other party about new evidence
    try {
      const notificationService = new NotificationService();
      const otherPartyUserId = dispute.initiator.userId.toString() === data.userId
        ? dispute.respondent.userId
        : dispute.initiator.userId;

      await notificationService.createNotification({
        recipientId: otherPartyUserId.toString(),
        type: 'dispute_evidence_added',
        title: 'New Evidence Added',
        message: `New ${data.type} evidence has been added to dispute #${dispute.disputeNumber}`,
        metadata: {
          disputeId: dispute._id.toString(),
          disputeNumber: dispute.disputeNumber,
          evidenceType: data.type,
        },
      });
    } catch (notifError) {
      logger.error('Failed to send dispute evidence notification', {
        context: 'DisputeService',
        action: 'EVIDENCE_NOTIFICATION_ERROR',
        disputeId: dispute._id.toString(),
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    }

    // Re-fetch with populated data
    return this.getDisputeById(data.disputeId);
  }

  // ========================================
  // Add Message
  // ========================================

  async addMessage(data: AddMessageDTO): Promise<IDispute> {
    // Validate message length
    if (!data.message || data.message.length === 0) {
      throw new ApiError(400, 'Message cannot be empty');
    }

    if (data.message.length > MAX_MESSAGE_LENGTH) {
      throw new ApiError(400, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

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

    // Notify the assigned admin about the dispute assignment
    try {
      const notificationService = new NotificationService();
      const adminUser = await User.findById(adminId);

      await notificationService.createNotification({
        recipientId: adminId,
        type: 'dispute_assigned',
        title: 'Dispute Assigned',
        message: `Dispute #${dispute.disputeNumber} has been assigned to you`,
        metadata: {
          disputeId: dispute._id.toString(),
          disputeNumber: dispute.disputeNumber,
          category: dispute.category,
          priority: dispute.priority,
        },
      });
    } catch (notifError) {
      logger.error('Failed to send dispute assignment notification', {
        context: 'DisputeService',
        action: 'ASSIGNMENT_NOTIFICATION_ERROR',
        disputeId: dispute._id.toString(),
        adminId,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    }

    // Re-fetch with populated data
    return this.getDisputeById(disputeId, adminId, 'admin');
  }

  // ========================================
  // Escalate Dispute
  // ========================================

  async escalateDispute(disputeId: string, userId: string, userRole: UserRole, reason: string): Promise<IDispute> {
    // Validate escalation reason length
    if (!reason || reason.length === 0) {
      throw new ApiError(400, 'Escalation reason is required');
    }

    if (reason.length > MAX_ESCALATION_REASON_LENGTH) {
      throw new ApiError(400, `Escalation reason cannot exceed ${MAX_ESCALATION_REASON_LENGTH} characters`);
    }

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
    // Validate notes length if provided
    if (data.notes && data.notes.length > MAX_ADMIN_NOTES_LENGTH) {
      throw new ApiError(400, `Resolution notes cannot exceed ${MAX_ADMIN_NOTES_LENGTH} characters`);
    }

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
    const shouldRefund = ['refund', 'partial_refund'].includes(data.resolutionType) && data.amount;

    // Start a MongoDB transaction for atomic operations
    const session: ClientSession = await mongoose.startSession();
    try {
      session.startTransaction();

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

      // Save dispute within transaction
      await dispute.save({ session });

      // FIX [MEDIUM-2]: When dispute is resolved in favor of customer (refund), adjust settlement record
      if (shouldRefund && data.amount) {
        const Settlement = mongoose.model('Settlement');

        // Find settlement that includes this booking
        const settlement = await Settlement.findOne({
          'lineItems.bookingId': dispute.bookingId
        }).session(session);

        if (settlement) {
          const lineItem = settlement.lineItems.find(
            (item: any) => item.bookingId?.toString() === dispute.bookingId.toString()
          );

          if (lineItem) {
            // Add deduction for the refund amount (up to the net amount of this booking's settlement)
            const deductionAmount = Math.min(data.amount, lineItem.netAmount);

            (settlement as any).addDeduction(
              'dispute_refund',
              deductionAmount,
              `Dispute #${dispute.disputeNumber} resolved with ${data.resolutionType}. Refund: ${deductionAmount} ${dispute.bookingReference?.currency || 'AED'}`,
              dispute._id.toString()
            );
            await settlement.save({ session });

            logger.info('Settlement deduction added for dispute refund', {
              action: 'DISPUTE_SETTLEMENT_SYNC',
              disputeId: dispute._id.toString(),
              disputeNumber: dispute.disputeNumber,
              settlementId: settlement._id.toString(),
              settlementNumber: settlement.settlementNumber,
              deductionAmount,
              resolutionType: data.resolutionType,
            });
          }
        }
      }

      // Commit the dispute resolution first
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      if (!session.hasEnded) {
        await session.endSession();
      }
    }

    // HIGH SEVERITY FIX: Direct logging for dispute resolution observability
    logger.info('Dispute resolved', {
      disputeId: dispute._id.toString(),
      disputeNumber: dispute.disputeNumber,
      resolution: {
        type: data.resolutionType,
        amount: data.amount,
        notes: data.notes ? '(provided)' : undefined,
      },
      refundTriggered: shouldRefund,
      resolvedBy: data.resolvedBy,
      action: 'DISPUTE_RESOLVED',
    });

    // Emit events (outside transaction - these are fire-and-forget)
    eventBus.publish(EVENT_TYPES.DISPUTE_RESOLVED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      resolutionType: data.resolutionType,
      amount: data.amount,
      resolvedBy: data.resolvedBy,
      bookingId: dispute.bookingId,
    });

    // If refund, trigger refund process (outside transaction)
    if (shouldRefund) {
      eventBus.publish(EVENT_TYPES.REFUND_TRIGGERED, {
        disputeId: dispute._id,
        disputeNumber: dispute.disputeNumber,
        bookingId: dispute.bookingId,
        amount: data.amount,
        type: data.resolutionType,
      });
    }

    // Send notifications to both parties about dispute resolution
    const notificationService = new NotificationService();
    const currency = dispute.bookingReference?.currency || 'AED';
    const resolutionMessage = data.resolutionType === 'refund'
      ? `A full refund of ${data.amount} ${currency} has been processed.`
      : data.resolutionType === 'partial_refund'
        ? `A partial refund of ${data.amount} ${currency} has been processed.`
        : `The dispute has been resolved. Reason: ${data.reason}`;

    // Notify both parties
    const notifyParty = async (userId: Types.ObjectId | undefined, partyName: string) => {
      if (userId) {
        try {
          await notificationService.createNotification({
            recipientId: userId.toString(),
            type: 'dispute_resolved',
            title: 'Dispute Resolved',
            message: `Dispute #${dispute.disputeNumber} has been resolved. ${resolutionMessage}`,
            metadata: {
              disputeId: dispute._id.toString(),
              disputeNumber: dispute.disputeNumber,
              resolutionType: data.resolutionType,
              amount: data.amount,
            },
          });
        } catch (notifError) {
          logger.error('Failed to send dispute resolution notification', {
            context: 'DisputeService',
            action: 'NOTIFICATION_ERROR',
            disputeId: dispute._id.toString(),
            partyId: userId.toString(),
            error: notifError instanceof Error ? notifError.message : String(notifError),
          });
        }
      }
    };

    await Promise.all([
      notifyParty(dispute.initiator.userId, 'initiator'),
      notifyParty(dispute.respondent.userId, 'respondent'),
    ]);

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
  // Reopen Dispute
  // ========================================

  /**
   * Reopen a resolved or closed dispute
   * Only allows reopening within a time limit after resolution
   */
  async reopenDispute(
    disputeId: string,
    userId: string,
    userRole: UserRole | 'admin',
    reason: string
  ): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    // Only resolved or closed disputes can be reopened
    if (!['resolved', 'closed'].includes(dispute.status)) {
      throw new ApiError(400, 'Only resolved or closed disputes can be reopened');
    }

    // Check if reopening is allowed (time limit: 7 days after resolution)
    const REOPEN_TIME_LIMIT_DAYS = 7;
    if (dispute.resolution?.resolvedAt) {
      const daysSinceResolution = (Date.now() - dispute.resolution.resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceResolution > REOPEN_TIME_LIMIT_DAYS) {
        throw new ApiError(
          400,
          `Dispute cannot be reopened after ${REOPEN_TIME_LIMIT_DAYS} days from resolution. Please create a new dispute if needed.`
        );
      }
    }

    // Authorization check - allow if user is part of dispute or is admin
    const isParty =
      dispute.initiator.userId.toString() === userId ||
      dispute.respondent.userId.toString() === userId;

    if (!isParty && userRole !== 'admin') {
      throw new ApiError(403, 'Only dispute parties or admins can reopen a dispute');
    }

    const previousStatus = dispute.status;

    // Reopen the dispute
    dispute.status = 'open';
    dispute.resolution = undefined; // Clear previous resolution
    dispute.reopenedAt = new Date();
    dispute.reopenedBy = new Types.ObjectId(userId);
    dispute.reopenedReason = reason;

    // Clear assignment so it goes back to queue
    dispute.assignedTo = undefined;
    dispute.assignedAt = undefined;

    // Reset priority to high if it was lowered
    if (dispute.priority === 'low') {
      dispute.priority = 'medium';
    }

    dispute.timeline.push({
      action: 'reopened',
      performedBy: new Types.ObjectId(userId),
      performedByRole: userRole,
      timestamp: new Date(),
      details: reason,
      previousStatus,
      newStatus: 'open',
    });

    await dispute.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.DISPUTE_REOPENED, {
      disputeId: dispute._id,
      disputeNumber: dispute.disputeNumber,
      reopenedBy: userId,
      reopenedByRole: userRole,
      reason,
      previousStatus,
    });

    // Notify both parties
    const notificationService = new NotificationService();
    const notifyParty = async (partyUserId: Types.ObjectId | undefined) => {
      if (partyUserId) {
        try {
          await notificationService.createNotification({
            recipientId: partyUserId.toString(),
            type: 'dispute_created',
            title: 'Dispute Reopened',
            message: `Dispute #${dispute.disputeNumber} has been reopened. Reason: ${reason}`,
            metadata: {
              disputeId: dispute._id.toString(),
              disputeNumber: dispute.disputeNumber,
              reason,
            },
          });
        } catch (notifError) {
          logger.error('Failed to send dispute reopen notification', {
            context: 'DisputeService',
            action: 'NOTIFICATION_ERROR',
            disputeId: dispute._id.toString(),
            partyId: partyUserId?.toString(),
            error: notifError instanceof Error ? notifError.message : String(notifError),
          });
        }
      }
    };

    await Promise.all([
      notifyParty(dispute.initiator.userId),
      notifyParty(dispute.respondent.userId),
    ]);

    return this.getDisputeById(disputeId, userId, userRole);
  }

  // ========================================
  // Add Admin Notes
  // ========================================

  async addAdminNotes(disputeId: string, adminId: string, notes: string): Promise<IDispute> {
    // Validate notes length
    if (!notes || notes.length === 0) {
      throw new ApiError(400, 'Admin notes cannot be empty');
    }

    if (notes.length > MAX_ADMIN_NOTES_LENGTH) {
      throw new ApiError(400, `Admin notes cannot exceed ${MAX_ADMIN_NOTES_LENGTH} characters`);
    }

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
  // Dispute Access Verification
  // ========================================

  /**
   * Verify if a user has access to a dispute
   * Returns the dispute if access is granted, throws ApiError otherwise
   * This is the central method for IDOR prevention across all dispute operations
   */
  async verifyDisputeAccess(
    disputeId: string,
    userId: string,
    options?: {
      allowAdmin?: boolean;      // Whether admins have access (default: true)
      allowParties?: boolean;    // Whether dispute parties have access (default: true)
      allowAssignee?: boolean;   // Whether assigned admin has access (default: false)
    }
  ): Promise<IDispute> {
    const opts = {
      allowAdmin: true,
      allowParties: true,
      allowAssignee: false,
      ...options,
    };

    // Validate disputeId format
    if (!mongoose.Types.ObjectId.isValid(disputeId)) {
      throw new ApiError(400, 'Invalid dispute ID format');
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID format');
    }

    // Fetch dispute without population for faster access check
    const dispute = await Dispute.findById(disputeId).select('initiator.userId respondent.userId assignedTo status');

    if (!dispute) {
      throw new ApiError(404, 'Dispute not found');
    }

    const initiatorId = dispute.initiator.userId?.toString();
    const respondentId = dispute.respondent.userId?.toString();
    const assignedToId = dispute.assignedTo?.toString();

    // Check party access
    const isParty = initiatorId === userId || respondentId === userId;

    // Check assignee access
    const isAssignee = assignedToId === userId;

    // Determine access based on options
    if (opts.allowParties && isParty) {
      return dispute;
    }

    if (opts.allowAssignee && isAssignee) {
      return dispute;
    }

    // Admin access is checked via userRole parameter passed separately
    // This method does NOT check for admin role - caller must do that

    throw new ApiError(403, 'You are not authorized to access this dispute');
  }

  /**
   * Verify dispute access and return populated dispute
   * Use this when you need the full dispute object with populated fields
   */
  async verifyDisputeAccessWithPopulate(
    disputeId: string,
    userId: string,
    userRole: string
  ): Promise<IDispute> {
    // Validate access
    await this.verifyDisputeAccess(disputeId, userId, {
      allowAdmin: userRole === 'admin',
      allowParties: true,
      allowAssignee: true,
    });

    // Return fully populated dispute
    return this.getDisputeById(disputeId, userId, userRole);
  }

  /**
   * Check if user is party to dispute (returns boolean)
   * Does NOT throw - use for conditional logic
   */
  async isDisputeParty(disputeId: string, userId: string): Promise<boolean> {
    try {
      await this.verifyDisputeAccess(disputeId, userId, {
        allowAdmin: false,
        allowParties: true,
        allowAssignee: false,
      });
      return true;
    } catch {
      return false;
    }
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
