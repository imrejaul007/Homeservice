import mongoose, { Types } from 'mongoose';
import SupportTicket, { ISupportTicket, TicketStatus, TicketPriority, TicketCategory } from '../models/supportTicket.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CreateTicketDTO {
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'customer' | 'provider' | 'admin';
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTicketDTO {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  subject?: string;
  description?: string;
}

export interface TicketFiltersDTO {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TicketStats {
  open: number;
  in_progress: number;
  pending_response: number;
  resolved: number;
  closed: number;
  total: number;
  resolvedToday: number;
  avgResponseTimeHours: number;
  priorityBreakdown: Record<TicketPriority, number>;
  categoryBreakdown: Record<string, number>;
}

export interface PaginatedTicketsResult {
  tickets: ISupportTicket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

// ============================================
// SUPPORT TICKET SERVICE CLASS
// ============================================

export class SupportTicketService {

  // ========================================
  // CREATE TICKET
  // ========================================

  /**
   * Create a new support ticket
   */
  async createTicket(data: CreateTicketDTO): Promise<ISupportTicket> {
    // Validate category
    const validCategories: TicketCategory[] = ['technical', 'billing', 'account', 'service', 'other'];
    if (!validCategories.includes(data.category)) {
      throw new ApiError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    // Validate priority if provided
    const validPriorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      throw new ApiError(400, `Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate subject length
    if (data.subject.length < 5) {
      throw new ApiError(400, 'Subject must be at least 5 characters');
    }
    if (data.subject.length > 200) {
      throw new ApiError(400, 'Subject cannot exceed 200 characters');
    }

    // Validate description length
    if (data.description.length < 20) {
      throw new ApiError(400, 'Description must be at least 20 characters');
    }
    if (data.description.length > 5000) {
      throw new ApiError(400, 'Description cannot exceed 5000 characters');
    }

    // Create ticket
    const ticket = new SupportTicket({
      userId: new Types.ObjectId(data.userId),
      userType: data.userType,
      userName: data.userName,
      userEmail: data.userEmail,
      category: data.category,
      priority: data.priority || 'medium',
      status: 'open',
      subject: data.subject,
      description: data.description,
      metadata: data.metadata,
      messages: [{
        sender: new Types.ObjectId(data.userId),
        senderType: data.userType,
        senderName: data.userName,
        message: data.description,
        createdAt: new Date()
      }]
    });

    await ticket.save();

    logger.info('Support ticket created', {
      context: 'SupportTicketService',
      action: 'TICKET_CREATED',
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      userId: data.userId,
      category: data.category,
      priority: data.priority || 'medium'
    });

    return ticket;
  }

  // ========================================
  // GET TICKET
  // ========================================

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string, userId?: string): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    const ticket = await SupportTicket.findById(ticketId)
      .populate('userId', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email')
      .populate('messages.sender', 'firstName lastName');

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    // Authorization check - user can only view their own tickets unless admin
    if (userId) {
      const ticketObj = ticket.toObject();
      const userIdStr = typeof ticket.userId === 'object' && ticket.userId !== null
        ? (ticket.userId as unknown as { _id: mongoose.Types.ObjectId })._id.toString()
        : String(ticket.userId);

      if (userIdStr !== userId) {
        throw new ApiError(403, 'Access denied');
      }
    }

    return ticket;
  }

  /**
   * Get tickets for a user
   */
  async getUserTickets(
    userId: string,
    filters?: { status?: TicketStatus; page?: number; limit?: number }
  ): Promise<PaginatedTicketsResult> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

    if (filters?.status) {
      query.status = filters.status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query)
    ]);

    return {
      tickets: tickets as unknown as ISupportTicket[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + tickets.length < total
      }
    };
  }

  /**
   * List all tickets (admin)
   */
  async listTickets(filters: TicketFiltersDTO): Promise<PaginatedTicketsResult> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.category) query.category = filters.category;
    if (filters.assignedTo) query.assignedTo = new Types.ObjectId(filters.assignedTo);
    if (filters.userId) query.userId = new Types.ObjectId(filters.userId);

    if (filters.startDate || filters.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (filters.startDate) createdAtFilter.$gte = new Date(filters.startDate);
      if (filters.endDate) createdAtFilter.$lte = new Date(filters.endDate);
      query.createdAt = createdAtFilter;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate('userId', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query)
    ]);

    return {
      tickets: tickets as unknown as ISupportTicket[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + tickets.length < total
      }
    };
  }

  // ========================================
  // UPDATE TICKET
  // ========================================

  /**
   * Update ticket
   */
  async updateTicket(ticketId: string, data: UpdateTicketDTO): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    if (data.status) {
      await ticket.updateStatus(data.status);
      logger.info('Ticket status updated', {
        context: 'SupportTicketService',
        action: 'STATUS_UPDATED',
        ticketId,
        newStatus: data.status
      });
    }

    if (data.priority) {
      await ticket.updatePriority(data.priority);
      logger.info('Ticket priority updated', {
        context: 'SupportTicketService',
        action: 'PRIORITY_UPDATED',
        ticketId,
        newPriority: data.priority
      });
    }

    if (data.category) {
      ticket.category = data.category;
      await ticket.save();
    }

    if (data.subject) {
      ticket.subject = data.subject;
      await ticket.save();
    }

    if (data.description) {
      ticket.description = data.description;
      await ticket.save();
    }

    return ticket;
  }

  /**
   * Assign ticket to admin
   */
  async assignTicket(ticketId: string, adminId: string, adminName: string): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    if (ticket.assignedTo?.toString() === adminId) {
      throw new ApiError(400, 'Ticket is already assigned to this admin');
    }

    await ticket.assignTo(new Types.ObjectId(adminId), adminName);

    // Add system message
    await ticket.addMessage(
      new Types.ObjectId(adminId),
      'admin',
      `Ticket assigned to ${adminName}`,
      adminName
    );

    logger.info('Ticket assigned', {
      context: 'SupportTicketService',
      action: 'TICKET_ASSIGNED',
      ticketId,
      adminId,
      adminName
    });

    return ticket;
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    senderId: string,
    senderType: 'customer' | 'provider' | 'admin',
    senderName: string,
    message: string
  ): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    if (!message.trim()) {
      throw new ApiError(400, 'Message cannot be empty');
    }

    if (message.length > 5000) {
      throw new ApiError(400, 'Message cannot exceed 5000 characters');
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new ApiError(400, 'Cannot add messages to closed tickets');
    }

    await ticket.addMessage(
      new Types.ObjectId(senderId),
      senderType,
      message.trim(),
      senderName
    );

    logger.info('Message added to ticket', {
      context: 'SupportTicketService',
      action: 'MESSAGE_ADDED',
      ticketId,
      senderId
    });

    return ticket;
  }

  // ========================================
  // RESOLUTION & CLOSURE
  // ========================================

  /**
   * Resolve ticket
   */
  async resolveTicket(ticketId: string, adminId: string, adminName: string, note?: string): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new ApiError(400, 'Ticket is already closed');
    }

    await ticket.resolve();

    // Add resolution note if provided
    if (note) {
      await ticket.addMessage(
        new Types.ObjectId(adminId),
        'admin',
        `Resolution: ${note}`,
        adminName
      );
    }

    logger.info('Ticket resolved', {
      context: 'SupportTicketService',
      action: 'TICKET_RESOLVED',
      ticketId,
      adminId
    });

    return ticket;
  }

  /**
   * Close ticket
   */
  async closeTicket(ticketId: string, userId: string, userType: 'customer' | 'admin', note?: string): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new ApiError(400, 'Ticket is already closed');
    }

    // Only resolved tickets can be closed by customers
    if (userType === 'customer' && ticket.status !== 'resolved') {
      throw new ApiError(400, 'Only resolved tickets can be closed');
    }

    await ticket.close();

    if (note) {
      await ticket.addMessage(
        new Types.ObjectId(userId),
        userType,
        note,
        userType === 'admin' ? 'Admin' : 'Customer'
      );
    }

    logger.info('Ticket closed', {
      context: 'SupportTicketService',
      action: 'TICKET_CLOSED',
      ticketId,
      closedBy: userId
    });

    return ticket;
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get ticket statistics
   */
  async getStats(startDate?: string, endDate?: string): Promise<TicketStats> {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const baseQuery = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Get status counts
    const statusStats = await (SupportTicket as any).getStats(baseQuery);

    // Get resolved today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const resolvedToday = await SupportTicket.countDocuments({
      resolvedAt: { $gte: today, $lt: tomorrow }
    });

    // Calculate average response time (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTickets = await SupportTicket.find({
      createdAt: { $gte: thirtyDaysAgo },
      resolvedAt: { $exists: true }
    }).select('createdAt resolvedAt').lean();

    let avgResponseTimeHours = 0;
    if (recentTickets.length > 0) {
      const totalHours = recentTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt).getTime();
        const resolved = new Date(ticket.resolvedAt as Date).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0);
      avgResponseTimeHours = Math.round(totalHours / recentTickets.length);
    }

    // Get priority breakdown
    const priorityStats = await SupportTicket.aggregate([
      { $match: { status: { $in: ['open', 'in_progress'] } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const priorityBreakdown: Record<TicketPriority, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    priorityStats.forEach(stat => {
      priorityBreakdown[stat._id as TicketPriority] = stat.count;
    });

    // Get category breakdown
    const categoryStats = await SupportTicket.aggregate([
      { $match: { status: { $in: ['open', 'in_progress'] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const categoryBreakdown: Record<string, number> = {};
    categoryStats.forEach(stat => {
      categoryBreakdown[stat._id] = stat.count;
    });

    return {
      ...statusStats,
      resolvedToday,
      avgResponseTimeHours,
      priorityBreakdown,
      categoryBreakdown
    };
  }

  // ========================================
  // ESCALATION
  // ========================================

  /**
   * Escalate ticket to higher priority
   */
  async escalateTicket(ticketId: string, reason: string, escalatedBy: string): Promise<ISupportTicket> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new ApiError(400, 'Invalid ticket ID');
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    // Escalate priority
    const priorityOrder: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
    const currentIndex = priorityOrder.indexOf(ticket.priority);

    if (currentIndex < priorityOrder.length - 1) {
      ticket.priority = priorityOrder[currentIndex + 1];
    }

    // Set status to escalated if applicable
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    logger.info('Ticket escalated', {
      context: 'SupportTicketService',
      action: 'TICKET_ESCALATED',
      ticketId,
      reason,
      escalatedBy,
      newPriority: ticket.priority
    });

    return ticket;
  }

  /**
   * Auto-escalate based on SLA
   */
  async autoEscalateOverdueTickets(): Promise<number> {
    const SLA_HOURS = {
      low: 72,
      medium: 48,
      high: 24,
      urgent: 4
    };

    const now = new Date();
    let escalatedCount = 0;

    // Find tickets that have exceeded SLA
    const overdueTickets = await SupportTicket.find({
      status: { $in: ['open', 'in_progress'] },
      priority: { $exists: true }
    }).lean();

    for (const ticket of overdueTickets) {
      const createdAt = new Date(ticket.createdAt);
      const slaHours = SLA_HOURS[ticket.priority as TicketPriority] || 48;
      const slaDeadline = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

      if (now > slaDeadline) {
        // Escalate
        await SupportTicket.findByIdAndUpdate(ticket._id, {
          $set: {
            priority: ticket.priority === 'low' ? 'medium' :
                      ticket.priority === 'medium' ? 'high' : 'urgent'
          }
        });
        escalatedCount++;
      }
    }

    if (escalatedCount > 0) {
      logger.info('Auto-escalated overdue tickets', {
        context: 'SupportTicketService',
        action: 'AUTO_ESCALATION',
        escalatedCount
      });
    }

    return escalatedCount;
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const supportTicketService = new SupportTicketService();
export default supportTicketService;
