import { Request, Response } from 'express';
import mongoose from 'mongoose';
import SupportTicket, { ISupportTicket, ISupportTicketModel, TicketStatus, TicketPriority, TicketCategory, UserType } from '../models/supportTicket.model';
import User, { IUser } from '../models/user.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

interface PaginationQuery {
  page?: string;
  limit?: string;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  assignedTo?: string;
  userId?: string;
}

interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build query filters from request query params
 */
const buildFilters = (query: PaginationQuery): TicketFilters => {
  const filters: TicketFilters = {};

  if (query.status) {
    filters.status = query.status as TicketStatus;
  }
  if (query.priority) {
    filters.priority = query.priority as TicketPriority;
  }
  if (query.category) {
    filters.category = query.category as TicketCategory;
  }
  if (query.assignedTo) {
    filters.assignedTo = new mongoose.Types.ObjectId(query.assignedTo);
  }
  if (query.userId) {
    filters.userId = new mongoose.Types.ObjectId(query.userId);
  }

  return filters;
};

/**
 * Sanitize pagination params with hard limits
 */
const sanitizePagination = (query: PaginationQuery) => {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));

  return { page, limit, skip: (page - 1) * limit };
};

// ============================================
// ADMIN TICKET CONTROLLERS
// ============================================

/**
 * Get all tickets with filtering and pagination
 * GET /api/admin/tickets
 */
export const getAllTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, skip } = sanitizePagination(req.query as PaginationQuery);
  const filters = buildFilters(req.query as PaginationQuery);
  const search = req.query.search as string | undefined;

  // Build MongoDB query
  const query: Record<string, unknown> = { ...filters };

  // Add text search if provided
  if (search && typeof search === 'string') {
    query.$text = { $search: search };
  }

  // Execute query with pagination
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

  // Transform data for frontend
  const transformedTickets = tickets.map(ticket => ({
    ...ticket,
    id: ticket._id,
    userName: ticket.userId
      ? `${(ticket.userId as unknown as { firstName: string; lastName: string }).firstName} ${(ticket.userId as unknown as { firstName: string; lastName: string }).lastName}`
      : ticket.userName,
    userEmail: (ticket.userId as unknown as { email?: string })?.email || ticket.userEmail,
    assignedToName: ticket.assignedTo
      ? `${(ticket.assignedTo as unknown as { firstName: string; lastName: string }).firstName} ${(ticket.assignedTo as unknown as { firstName: string; lastName: string }).lastName}`
      : ticket.assignedToName
  }));

  res.json({
    success: true,
    data: {
      tickets: transformedTickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * Get ticket statistics for dashboard
 * GET /api/admin/tickets/stats
 */
export const getTicketStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Get status counts
  const statusStats = await (SupportTicket as any).getStats();

  // Get resolved today
  const resolvedToday = await SupportTicket.countDocuments({
    resolvedAt: { $gte: startOfDay, $lt: endOfDay }
  });

  // Get average response time (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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

  const priorityBreakdown = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  priorityStats.forEach(stat => {
    priorityBreakdown[stat._id as keyof typeof priorityBreakdown] = stat.count;
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

  res.json({
    success: true,
    data: {
      ...statusStats,
      resolvedToday,
      avgResponseTimeHours,
      priorityBreakdown,
      categoryBreakdown
    }
  });
});

/**
 * Get single ticket by ID
 * GET /api/admin/tickets/:id
 */
export const getTicketById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findById(id)
    .populate('userId', 'firstName lastName email phone')
    .populate('assignedTo', 'firstName lastName email')
    .populate('messages.sender', 'firstName lastName email');

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  // Transform for frontend
  const transformedTicket = {
    ...ticket.toObject(),
    id: ticket._id,
    userName: ticket.userId
      ? `${(ticket.userId as unknown as { firstName: string; lastName: string }).firstName} ${(ticket.userId as unknown as { firstName: string; lastName: string }).lastName}`
      : ticket.userName,
    userEmail: (ticket.userId as unknown as { email?: string })?.email || ticket.userEmail,
    userPhone: (ticket.userId as unknown as { phone?: string })?.phone,
    assignedToName: ticket.assignedTo
      ? `${(ticket.assignedTo as unknown as { firstName: string; lastName: string }).firstName} ${(ticket.assignedTo as unknown as { firstName: string; lastName: string }).lastName}`
      : ticket.assignedToName,
    messages: ticket.messages.map(msg => ({
      ...msg,
      id: msg._id,
      senderName: msg.sender
        ? `${(msg.sender as unknown as { firstName: string; lastName: string }).firstName} ${(msg.sender as unknown as { firstName: string; lastName: string }).lastName}`
        : msg.senderName
    }))
  };

  res.json({
    success: true,
    data: transformedTicket
  });
});

/**
 * Update ticket (status, priority, category)
 * PATCH /api/admin/tickets/:id
 */
export const updateTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, priority, category, subject, description } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  // Update allowed fields
  if (status) {
    await ticket.updateStatus(status as TicketStatus);
    logger.info('Ticket status updated', { ticketId: id, status, adminId: req.user?._id });
  }

  if (priority) {
    await ticket.updatePriority(priority as TicketPriority);
    logger.info('Ticket priority updated', { ticketId: id, priority, adminId: req.user?._id });
  }

  if (category) {
    ticket.category = category as TicketCategory;
    await ticket.save();
    logger.info('Ticket category updated', { ticketId: id, category, adminId: req.user?._id });
  }

  if (subject) {
    ticket.subject = subject;
    await ticket.save();
  }

  if (description) {
    ticket.description = description;
    await ticket.save();
  }

  // Return updated ticket
  const updatedTicket = await SupportTicket.findById(id)
    .populate('userId', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .lean();

  res.json({
    success: true,
    data: updatedTicket,
    message: 'Ticket updated successfully'
  });
});

/**
 * Assign ticket to admin
 * POST /api/admin/tickets/:id/assign
 */
export const assignTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { adminId, adminName } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  if (!adminId) {
    throw new ApiError(400, 'Admin ID is required');
  }

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  const assignedAdminId = new mongoose.Types.ObjectId(adminId);
  const adminFullName = adminName || `Admin ${adminId.slice(-4)}`;

  await ticket.assignTo(assignedAdminId, adminFullName);

  // Add system message about assignment
  await ticket.addMessage(
    assignedAdminId,
    'admin',
    `Ticket assigned to ${adminFullName}`,
    adminFullName
  );

  logger.info('Ticket assigned', {
    ticketId: id,
    assignedTo: adminId,
    adminId: req.user?._id
  });

  res.json({
    success: true,
    message: `Ticket assigned to ${adminFullName}`,
    data: {
      assignedTo: assignedAdminId,
      assignedToName: adminFullName,
      status: ticket.status
    }
  });
});

/**
 * Add message to ticket thread
 * POST /api/admin/tickets/:id/message
 */
export const addTicketMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new ApiError(400, 'Message content is required');
  }

  if (message.length > 5000) {
    throw new ApiError(400, 'Message cannot exceed 5000 characters');
  }

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  // Cannot add messages to closed tickets
  if (ticket.status === 'closed') {
    throw new ApiError(400, 'Cannot add messages to closed tickets');
  }

  const senderId = req.user?._id || new mongoose.Types.ObjectId();
  const senderName = req.user
    ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
    : 'Admin';

  await ticket.addMessage(senderId, 'admin', message.trim(), senderName);

  logger.info('Message added to ticket', {
    ticketId: id,
    senderId,
    messageLength: message.length,
    newStatus: ticket.status
  });

  res.json({
    success: true,
    message: 'Message added successfully',
    data: {
      ticketId: ticket._id,
      status: ticket.status,
      lastMessage: ticket.messages[ticket.messages.length - 1]
    }
  });
});

/**
 * Resolve ticket
 * PATCH /api/admin/tickets/:id/resolve
 */
export const resolveTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { resolutionNote } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw new ApiError(400, 'Ticket is already closed');
  }

  await ticket.resolve();

  // Add resolution message if provided
  if (resolutionNote) {
    const senderId = req.user?._id || new mongoose.Types.ObjectId();
    const senderName = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
      : 'Admin';

    await ticket.addMessage(senderId, 'admin', resolutionNote, senderName);
  }

  logger.info('Ticket resolved', {
    ticketId: id,
    resolvedBy: req.user?._id,
    resolutionNote: resolutionNote || 'No note provided'
  });

  res.json({
    success: true,
    message: 'Ticket resolved successfully',
    data: {
      ticketId: ticket._id,
      status: ticket.status,
      resolvedAt: ticket.resolvedAt
    }
  });
});

/**
 * Close ticket
 * PATCH /api/admin/tickets/:id/close
 */
export const closeTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw new ApiError(400, 'Ticket is already closed');
  }

  await ticket.close();

  // Add closure message if provided
  if (note) {
    const senderId = req.user?._id || new mongoose.Types.ObjectId();
    const senderName = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
      : 'Admin';

    await ticket.addMessage(senderId, 'admin', note, senderName);
  }

  logger.info('Ticket closed', {
    ticketId: id,
    closedBy: req.user?._id
  });

  res.json({
    success: true,
    message: 'Ticket closed successfully',
    data: {
      ticketId: ticket._id,
      status: ticket.status,
      closedAt: ticket.closedAt
    }
  });
});

/**
 * Get list of admins for assignment dropdown
 * GET /api/admin/tickets/admins
 */
export const getAdminList = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const User = mongoose.model('User');

  const admins = await User.find({ role: 'admin', accountStatus: 'active' })
    .select('_id firstName lastName email')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  const transformedAdmins = admins.map(admin => ({
    id: admin._id,
    _id: admin._id,
    name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email,
    email: admin.email
  }));

  res.json({
    success: true,
    data: transformedAdmins
  });
});

// ============================================
// USER TICKET CONTROLLERS (for customers/providers)
// ============================================

/**
 * Get user's own tickets
 * GET /api/support/tickets
 */
export const getUserTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const { page, limit, skip } = sanitizePagination(req.query as PaginationQuery);
  const status = req.query.status as string | undefined;

  const query: Record<string, unknown> = { userId: req.user._id };

  if (status && ['open', 'in_progress', 'pending_response', 'resolved', 'closed'].includes(status)) {
    query.status = status;
  }

  const [tickets, total] = await Promise.all([
    SupportTicket.find(query)
      .select('-messages') // Exclude messages for list view
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * Create new support ticket
 * POST /api/support/tickets
 */
export const createTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const { category, priority, subject, description } = req.body;

  // Validate required fields
  if (!category || !subject || !description) {
    throw new ApiError(400, 'Category, subject, and description are required');
  }

  // Validate category
  const validCategories = ['technical', 'billing', 'account', 'service', 'other'];
  if (!validCategories.includes(category)) {
    throw new ApiError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    throw new ApiError(400, `Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
  }

  // Validate subject length
  if (subject.length > 200) {
    throw new ApiError(400, 'Subject cannot exceed 200 characters');
  }

  // Validate description length
  if (description.length > 5000) {
    throw new ApiError(400, 'Description cannot exceed 5000 characters');
  }

  // Determine user type from role
  const userType: UserType = req.user.role as UserType || 'customer';
  const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

  // Create ticket
  const ticket = new SupportTicket({
    userId: req.user._id,
    userType,
    userName,
    userEmail: req.user.email,
    category: category as TicketCategory,
    priority: priority as TicketPriority || 'medium',
    subject,
    description,
    messages: [{
      sender: req.user._id,
      senderType: userType,
      senderName: userName,
      message: description,
      createdAt: new Date()
    }]
  });

  await ticket.save();

  logger.info('Support ticket created', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    userId: req.user._id,
    category,
    priority: priority || 'medium'
  });

  res.status(201).json({
    success: true,
    data: ticket,
    message: 'Support ticket created successfully'
  });
});

/**
 * Get single ticket for user
 * GET /api/support/tickets/:id
 */
export const getUserTicketById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findOne({
    _id: id,
    userId: req.user._id
  }).populate('assignedTo', 'firstName lastName email');

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  res.json({
    success: true,
    data: ticket
  });
});

/**
 * Add message to ticket (user side)
 * POST /api/support/tickets/:id/message
 */
export const addUserMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const { id } = req.params;
  const { message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new ApiError(400, 'Message content is required');
  }

  if (message.length > 5000) {
    throw new ApiError(400, 'Message cannot exceed 5000 characters');
  }

  const ticket = await SupportTicket.findOne({
    _id: id,
    userId: req.user._id
  });

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw new ApiError(400, 'Cannot add messages to closed tickets');
  }

  const userType: UserType = req.user.role as UserType || 'customer';
  const senderName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

  await ticket.addMessage(req.user._id, userType, message.trim(), senderName);

  res.json({
    success: true,
    message: 'Message added successfully',
    data: {
      ticketId: ticket._id,
      status: ticket.status
    }
  });
});

/**
 * Close ticket (user can close their own resolved tickets)
 * PATCH /api/support/tickets/:id/close
 */
export const closeUserTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ticket ID');
  }

  const ticket = await SupportTicket.findOne({
    _id: id,
    userId: req.user._id
  });

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw new ApiError(400, 'Ticket is already closed');
  }

  // User can close resolved tickets
  if (ticket.status !== 'resolved') {
    throw new ApiError(400, 'Only resolved tickets can be closed by users');
  }

  await ticket.close();

  res.json({
    success: true,
    message: 'Ticket closed successfully',
    data: {
      ticketId: ticket._id,
      status: ticket.status
    }
  });
});
