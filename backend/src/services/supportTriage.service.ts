import mongoose from 'mongoose';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Type Definitions
// ============================================

export type TicketCategory =
  | 'booking'
  | 'payment'
  | 'technical'
  | 'complaint'
  | 'billing'
  | 'account'
  | 'general';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';

export type TicketSource = 'email' | 'chat' | 'in_app' | 'phone' | 'social';

export interface TriageResult {
  category: TicketCategory;
  priority: TicketPriority;
  suggestedAction: string;
  estimatedResolution: string;
  confidence: number;
  keywords: string[];
  escalationRequired: boolean;
  relatedEntities?: {
    bookingId?: string;
    userId?: string;
    providerId?: string;
  };
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  assignedTo?: string;
  assignedAt?: Date;
  bookingId?: string;
  relatedBooking?: {
    bookingNumber: string;
    serviceName?: string;
    scheduledDate?: Date;
    status?: string;
  };
  messages: TicketMessage[];
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  satisfactionRating?: number;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderRole: 'customer' | 'agent' | 'system' | 'admin';
  senderName?: string;
  message: string;
  attachments?: string[];
  timestamp: Date;
  readAt?: Date;
}

export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedTo?: string;
  customerId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byCategory: Record<TicketCategory, number>;
  byPriority: Record<TicketPriority, number>;
  openTickets: number;
  avgResponseTime: number;
  resolutionRate: number;
  urgentCount: number;
}

export interface EscalationRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  action: {
    type: 'assign' | 'priority' | 'category' | 'notify';
    value: any;
  };
  enabled: boolean;
}

// ============================================
// Support Ticket Model (MongoDB)
// ============================================

interface ISupportTicketDocument extends mongoose.Document {
  ticketNumber: string;
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  assignedTo?: string;
  assignedAt?: Date;
  bookingId?: string;
  relatedBooking?: {
    bookingNumber: string;
    serviceName?: string;
    scheduledDate?: Date;
    status?: string;
  };
  messages: {
    senderId: string;
    senderRole: 'customer' | 'agent' | 'system' | 'admin';
    senderName?: string;
    message: string;
    attachments?: string[];
    timestamp: Date;
    readAt?: Date;
  }[];
  tags: string[];
  metadata?: Record<string, any>;
  resolvedAt?: Date;
  satisfactionRating?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const TicketMessageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderRole: {
    type: String,
    enum: ['customer', 'agent', 'system', 'admin'],
    required: true,
  },
  senderName: String,
  message: { type: String, required: true },
  attachments: [String],
  timestamp: { type: Date, default: Date.now },
  readAt: Date,
}, { _id: true });

const SupportTicketSchema = new mongoose.Schema<ISupportTicketDocument>({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  category: {
    type: String,
    enum: ['booking', 'payment', 'technical', 'complaint', 'billing', 'account', 'general'],
    default: 'general',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true,
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true,
  },
  source: {
    type: String,
    enum: ['email', 'chat', 'in_app', 'phone', 'social'],
    default: 'in_app',
  },
  customerId: { type: String, index: true },
  customerName: String,
  customerEmail: String,
  assignedTo: String,
  assignedAt: Date,
  bookingId: String,
  relatedBooking: {
    bookingNumber: String,
    serviceName: String,
    scheduledDate: Date,
    status: String,
  },
  messages: [TicketMessageSchema],
  tags: [String],
  metadata: mongoose.Schema.Types.Mixed,
  resolvedAt: Date,
  satisfactionRating: Number,
}, {
  timestamps: true,
});

// Compound indexes
SupportTicketSchema.index({ status: 1, priority: 1 });
SupportTicketSchema.index({ customerId: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });

export const SupportTicketModel: mongoose.Model<ISupportTicketDocument> =
  mongoose.models.TriageSupportTicket || mongoose.model<ISupportTicketDocument>('TriageSupportTicket', SupportTicketSchema);

// ============================================
// Support Triage Service
// ============================================

export class SupportTriageService {
  // Keyword mappings for category detection
  private readonly categoryKeywords: Record<TicketCategory, string[]> = {
    booking: [
      'booking', 'appointment', 'schedule', 'reschedule', 'cancel', 'cancellation',
      'service', 'provider', 'beautician', 'stylist', 'appointment', 'slot',
      'availability', 'no show', 'didn\'t show', 'late', 'waiting',
    ],
    payment: [
      'payment', 'pay', 'paid', 'transaction', 'card', 'credit', 'debit',
      'wallet', 'balance', 'currency', 'amount', 'price', 'cost', 'fee',
      'transfer', 'bank', 'account', 'money',
    ],
    billing: [
      'invoice', 'receipt', 'charge', 'billing', 'statement', 'refund',
      'overcharge', 'wrong amount', 'duplicate charge', 'subscription',
      'plan', 'coupon', 'discount', 'promo',
    ],
    technical: [
      'error', 'bug', 'crash', 'not working', 'broken', 'issue', 'problem',
      'app', 'website', 'login', 'password', 'account access', 'loading',
      'slow', 'freeze', 'stuck', 'can\'t', 'unable', 'fails',
    ],
    complaint: [
      'complaint', 'unhappy', 'dissatisfied', 'angry', 'terrible', 'worst',
      'horrible', 'awful', 'disappointed', 'frustrated', 'poor service',
      'bad experience', 'wrong', 'damaged', 'hygiene', 'cleanliness',
    ],
    account: [
      'account', 'profile', 'personal info', 'change', 'update', 'email',
      'phone', 'address', 'name', 'picture', 'avatar', 'settings',
      'preferences', 'notification', 'privacy', 'data', 'delete account',
    ],
    general: [],
  };

  // Priority trigger keywords
  private readonly urgentKeywords = [
    'urgent', 'asap', 'immediately', 'emergency', 'critical', 'important',
    'now', 'right away', 'deadline', 'overdue', 'past due', 'as soon as possible',
  ];

  private readonly highPriorityKeywords = [
    'serious', 'concern', 'worried', 'frustrated', 'escalate', 'supervisor',
    'manager', 'help', 'please', 'need', 'require', 'issue', 'problem',
  ];

  // Escalation rules
  private readonly escalationRules: EscalationRule[] = [
    {
      id: 'auto_assign_booking',
      name: 'Auto-assign booking issues',
      condition: { field: 'category', operator: 'equals', value: 'booking' },
      action: { type: 'assign', value: 'booking_team' },
      enabled: true,
    },
    {
      id: 'auto_assign_payment',
      name: 'Auto-assign payment issues',
      condition: { field: 'category', operator: 'equals', value: 'payment' },
      action: { type: 'assign', value: 'billing_team' },
      enabled: true,
    },
    {
      id: 'urgent_escalation',
      name: 'Urgent ticket escalation',
      condition: { field: 'priority', operator: 'equals', value: 'urgent' },
      action: { type: 'notify', value: 'admin_channel' },
      enabled: true,
    },
    {
      id: 'complaint_escalation',
      name: 'Complaint escalation to supervisor',
      condition: { field: 'category', operator: 'equals', value: 'complaint' },
      action: { type: 'priority', value: 'high' },
      enabled: true,
    },
  ];

  // ========================================
  // Auto-Triage Methods
  // ========================================

  /**
   * Extract keywords from message text
   */
  extractKeywords(text: string): string[] {
    const normalizedText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = normalizedText.split(' ');
    const keywords: string[] = [];

    for (const [category, categoryWords] of Object.entries(this.categoryKeywords)) {
      for (const keyword of categoryWords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          keywords.push(keyword.toLowerCase());
        }
      }
    }

    return [...new Set(keywords)];
  }

  /**
   * Categorize ticket based on message content
   */
  categorize(keywords: string[]): TicketCategory {
    const scores: Record<TicketCategory, number> = {
      booking: 0,
      payment: 0,
      billing: 0,
      technical: 0,
      complaint: 0,
      account: 0,
      general: 0,
    };

    for (const keyword of keywords) {
      for (const [category, categoryKeywords] of Object.entries(this.categoryKeywords)) {
        if (categoryKeywords.some(ck => ck.includes(keyword) || keyword.includes(ck))) {
          scores[category as TicketCategory]++;
        }
      }
    }

    // Find category with highest score
    let maxScore = 0;
    let bestCategory: TicketCategory = 'general';

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as TicketCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Determine priority based on keywords and content
   */
  determinePriority(text: string, category: TicketCategory): TicketPriority {
    const normalizedText = text.toLowerCase();

    // Check for urgent keywords
    const urgentMatches = this.urgentKeywords.filter(kw =>
      normalizedText.includes(kw.toLowerCase())
    );

    if (urgentMatches.length > 0) {
      return 'urgent';
    }

    // Check for high priority keywords
    const highPriorityMatches = this.highPriorityKeywords.filter(kw =>
      normalizedText.includes(kw.toLowerCase())
    );

    if (highPriorityMatches.length >= 3 || urgentMatches.length > 0) {
      return 'high';
    }

    // Complaints are typically higher priority
    if (category === 'complaint') {
      return 'high';
    }

    // Payment and technical issues are medium-high
    if (category === 'payment' || category === 'technical') {
      return 'medium';
    }

    return 'medium';
  }

  /**
   * Auto-triage incoming ticket
   */
  async triageTicket(message: string, subject?: string): Promise<TriageResult> {
    const fullText = `${subject || ''} ${message}`.trim();
    const keywords = this.extractKeywords(fullText);
    const category = this.categorize(keywords);
    const priority = this.determinePriority(fullText, category);

    // Generate suggested action based on category
    const suggestedAction = this.getSuggestedAction(category, priority);
    const estimatedResolution = this.getEstimatedResolution(category, priority);
    const escalationRequired = this.shouldEscalate(category, priority);

    // Calculate confidence based on keyword matches
    const confidence = Math.min(0.95, 0.4 + keywords.length * 0.1);

    // Try to identify related entities
    const relatedEntities = await this.identifyRelatedEntities(fullText);

    return {
      category,
      priority,
      suggestedAction,
      estimatedResolution,
      confidence,
      keywords,
      escalationRequired,
      relatedEntities,
    };
  }

  /**
   * Get suggested action based on category and priority
   */
  private getSuggestedAction(category: TicketCategory, priority: TicketPriority): string {
    const actions: Record<TicketCategory, string> = {
      booking: 'Check booking system for related reservations and provider status',
      payment: 'Review payment history and verify transaction status',
      billing: 'Examine billing records and invoice details',
      technical: 'Check system logs and user device compatibility',
      complaint: 'Review service details and contact relevant parties for investigation',
      account: 'Verify account settings and recent changes',
      general: 'Provide general guidance and support information',
    };

    let action = actions[category] || 'Review and respond to customer inquiry';

    if (priority === 'urgent') {
      action = `IMMEDIATE ACTION REQUIRED - ${action}`;
    } else if (priority === 'high') {
      action = `Priority: ${action}`;
    }

    return action;
  }

  /**
   * Get estimated resolution time based on category and priority
   */
  private getEstimatedResolution(category: TicketCategory, priority: TicketPriority): string {
    const resolutions: Record<TicketCategory, { low: string; high: string }> = {
      booking: { low: '1 hour', high: '4 hours' },
      payment: { low: '2 hours', high: '24 hours' },
      billing: { low: '4 hours', high: '48 hours' },
      technical: { low: '4 hours', high: '72 hours' },
      complaint: { low: '2 hours', high: '24 hours' },
      account: { low: '1 hour', high: '24 hours' },
      general: { low: '4 hours', high: '48 hours' },
    };

    const resolution = resolutions[category] || { low: '4 hours', high: '48 hours' };

    if (priority === 'urgent') {
      return '15 minutes - 1 hour';
    } else if (priority === 'high') {
      return resolution.low;
    }

    return `${resolution.low} - ${resolution.high}`;
  }

  /**
   * Determine if escalation is required
   */
  private shouldEscalate(category: TicketCategory, priority: TicketPriority): boolean {
    if (priority === 'urgent') return true;
    if (priority === 'high' && category === 'complaint') return true;
    return false;
  }

  /**
   * Identify related entities from ticket content
   */
  private async identifyRelatedEntities(text: string): Promise<TriageResult['relatedEntities']> {
    const relatedEntities: TriageResult['relatedEntities'] = {};

    // Try to find booking number (format: RZ-YYYYMMDD-XXX)
    const bookingMatch = text.match(/RZ-\d{8}-\d{3,}/i);
    if (bookingMatch) {
      const booking = await Booking.findOne({ bookingNumber: bookingMatch[0] });
      if (booking) {
        relatedEntities.bookingId = booking._id.toString();
        relatedEntities.userId = booking.customerId?.toString();
        relatedEntities.providerId = booking.providerId?.toString();
      }
    }

    return relatedEntities;
  }

  // ========================================
  // Ticket Management Methods
  // ========================================

  /**
   * Create a new support ticket with auto-triage
   */
  async createTicket(
    data: {
      subject: string;
      message: string;
      source?: TicketSource;
      customerId?: string;
      customerEmail?: string;
      customerName?: string;
      bookingId?: string;
    }
  ): Promise<SupportTicket> {
    // Auto-triage the ticket
    const triage = await this.triageTicket(data.message, data.subject);

    // Generate ticket number
    const ticketNumber = this.generateTicketNumber();

    // Get related booking info if available
    let relatedBooking;
    if (data.bookingId || triage.relatedEntities?.bookingId) {
      const booking = await Booking.findById(data.bookingId || triage.relatedEntities?.bookingId);
      if (booking) {
        relatedBooking = {
          bookingNumber: booking.bookingNumber,
          serviceName: (booking as any).serviceId?.title || 'Unknown Service',
          scheduledDate: booking.scheduledDate,
          status: booking.status,
        };
      }
    }

    // Apply escalation rules
    let assignedTo: string | undefined;
    let priority = triage.priority;

    for (const rule of this.escalationRules) {
      if (!rule.enabled) continue;

      const fieldValue = rule.condition.field === 'category' ? triage.category : triage.priority;
      if (this.evaluateCondition(fieldValue, rule.condition.operator, rule.condition.value)) {
        switch (rule.action.type) {
          case 'assign':
            assignedTo = rule.action.value;
            break;
          case 'priority':
            priority = rule.action.value as TicketPriority;
            break;
        }
      }
    }

    // Create the ticket
    const ticket = await SupportTicketModel.create({
      ticketNumber,
      subject: data.subject,
      message: data.message,
      category: triage.category,
      priority,
      status: 'open',
      source: data.source || 'in_app',
      customerId: data.customerId,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      bookingId: data.bookingId || triage.relatedEntities?.bookingId,
      relatedBooking,
      messages: [{
        senderId: data.customerId || 'anonymous',
        senderRole: 'customer',
        senderName: data.customerName,
        message: data.message,
        timestamp: new Date(),
      }],
      tags: triage.keywords.slice(0, 5),
      metadata: {
        triageResult: triage,
        suggestedAction: triage.suggestedAction,
      },
      assignedTo,
      assignedAt: assignedTo ? new Date() : undefined,
    });

    logger.info('SupportTriage: Ticket created', {
      ticketId: ticket._id,
      ticketNumber,
      category: triage.category,
      priority,
    });

    return this.formatTicket(ticket);
  }

  /**
   * Get tickets with filters
   */
  async getTickets(filters: TicketFilters): Promise<{
    data: SupportTicket[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.priority) query.priority = filters.priority;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters.customerId) query.customerId = filters.customerId;

    if (filters.search) {
      query.$or = [
        { subject: { $regex: filters.search, $options: 'i' } },
        { message: { $regex: filters.search, $options: 'i' } },
        { ticketNumber: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const [tickets, total] = await Promise.all([
      SupportTicketModel.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicketModel.countDocuments(query),
    ]);

    return {
      data: tickets.map(t => this.formatTicket(t)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    const ticket = await SupportTicketModel.findById(ticketId);
    if (!ticket) return null;
    return this.formatTicket(ticket);
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    data: {
      senderId: string;
      senderRole: 'agent' | 'admin' | 'system';
      senderName?: string;
      message: string;
      attachments?: string[];
    }
  ): Promise<SupportTicket | null> {
    const ticket = await SupportTicketModel.findById(ticketId);
    if (!ticket) return null;

    const newMessage: TicketMessage = {
      id: uuidv4(),
      senderId: data.senderId,
      senderRole: data.senderRole,
      senderName: data.senderName,
      message: data.message,
      attachments: data.attachments,
      timestamp: new Date(),
    };

    ticket.messages.push(newMessage as any);

    // Update status if it was closed
    if (ticket.status === 'closed') {
      ticket.status = 'open';
      ticket.resolvedAt = undefined;
    }

    // Update status to in_progress if it was open
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    logger.info('SupportTriage: Message added to ticket', {
      ticketId,
      messageId: newMessage.id,
    });

    return this.formatTicket(ticket);
  }

  /**
   * Assign ticket to agent
   */
  async assignTicket(
    ticketId: string,
    agentId: string,
    assignedBy?: string
  ): Promise<SupportTicket | null> {
    const ticket = await SupportTicketModel.findById(ticketId);
    if (!ticket) return null;

    ticket.assignedTo = agentId;
    ticket.assignedAt = new Date();

    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    // Add system message about assignment
    ticket.messages.push({
      senderId: 'system',
      senderRole: 'system',
      message: assignedBy
        ? `Ticket assigned to agent ${agentId} by ${assignedBy}`
        : `Ticket assigned to agent ${agentId}`,
      timestamp: new Date(),
    } as any);

    await ticket.save();

    logger.info('SupportTriage: Ticket assigned', {
      ticketId,
      agentId,
      assignedBy,
    });

    return this.formatTicket(ticket);
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    updatedBy: string
  ): Promise<SupportTicket | null> {
    const ticket = await SupportTicketModel.findById(ticketId);
    if (!ticket) return null;

    const previousStatus = ticket.status;
    ticket.status = status;

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date();
    }

    // Add system message about status change
    ticket.messages.push({
      senderId: 'system',
      senderRole: 'system',
      message: `Ticket status changed from ${previousStatus} to ${status} by ${updatedBy}`,
      timestamp: new Date(),
    } as any);

    await ticket.save();

    logger.info('SupportTriage: Ticket status updated', {
      ticketId,
      previousStatus,
      newStatus: status,
    });

    return this.formatTicket(ticket);
  }

  /**
   * Update ticket priority
   */
  async updateTicketPriority(
    ticketId: string,
    priority: TicketPriority,
    updatedBy: string
  ): Promise<SupportTicket | null> {
    const ticket = await SupportTicketModel.findById(ticketId);
    if (!ticket) return null;

    ticket.priority = priority;

    // Add system message
    ticket.messages.push({
      senderId: 'system',
      senderRole: 'system',
      message: `Ticket priority changed to ${priority} by ${updatedBy}`,
      timestamp: new Date(),
    } as any);

    await ticket.save();

    return this.formatTicket(ticket);
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(): Promise<TicketStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [allTickets, todayTickets] = await Promise.all([
      SupportTicketModel.find({}),
      SupportTicketModel.find({ createdAt: { $gte: todayStart } }),
    ]);

    const stats: TicketStats = {
      total: allTickets.length,
      byStatus: { open: 0, pending: 0, in_progress: 0, resolved: 0, closed: 0 },
      byCategory: { booking: 0, payment: 0, technical: 0, complaint: 0, billing: 0, account: 0, general: 0 },
      byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
      openTickets: 0,
      avgResponseTime: 0,
      resolutionRate: 0,
      urgentCount: 0,
    };

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const ticket of allTickets) {
      stats.byStatus[ticket.status]++;
      stats.byCategory[ticket.category]++;
      stats.byPriority[ticket.priority]++;

      if (ticket.status === 'open' || ticket.status === 'in_progress') {
        stats.openTickets++;
      }

      if (ticket.priority === 'urgent' && ticket.status !== 'resolved' && ticket.status !== 'closed') {
        stats.urgentCount++;
      }

      // Calculate response time
      if (ticket.messages.length > 1 && ticket.resolvedAt && ticket.createdAt) {
        const firstResponseTime = ticket.messages[1]?.timestamp?.getTime() - ticket.createdAt.getTime();
        if (firstResponseTime > 0) {
          totalResponseTime += firstResponseTime;
          responseCount++;
        }
      }

      // Calculate resolution rate
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        stats.resolutionRate++;
      }
    }

    stats.avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
    stats.resolutionRate = allTickets.length > 0 ? stats.resolutionRate / allTickets.length : 0;

    return stats;
  }

  // ========================================
  // Helper Methods
  // ========================================

  private generateTicketNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TKT-${dateStr}-${random}`;
  }

  private evaluateCondition(value: any, operator: string, targetValue: any): boolean {
    switch (operator) {
      case 'equals':
        return value === targetValue;
      case 'contains':
        return String(value).includes(String(targetValue));
      case 'greater_than':
        return value > targetValue;
      case 'less_than':
        return value < targetValue;
      default:
        return false;
    }
  }

  private formatTicket(doc: ISupportTicketDocument): SupportTicket {
    return {
      id: doc._id.toString(),
      ticketNumber: doc.ticketNumber,
      subject: doc.subject,
      message: doc.message,
      category: doc.category,
      priority: doc.priority,
      status: doc.status,
      source: doc.source,
      customerId: doc.customerId,
      customerName: doc.customerName,
      customerEmail: doc.customerEmail,
      assignedTo: doc.assignedTo,
      assignedAt: doc.assignedAt,
      bookingId: doc.bookingId,
      relatedBooking: doc.relatedBooking,
      messages: doc.messages.map(m => ({
        id: (m as any)._id?.toString() || uuidv4(),
        senderId: m.senderId,
        senderRole: m.senderRole,
        senderName: m.senderName,
        message: m.message,
        attachments: m.attachments,
        timestamp: m.timestamp,
        readAt: m.readAt,
      })),
      tags: doc.tags,
      metadata: doc.metadata,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
      resolvedAt: doc.resolvedAt,
      satisfactionRating: doc.satisfactionRating,
    };
  }
}

// ============================================
// Service Instance
// ============================================

export const supportTriageService = new SupportTriageService();
export default supportTriageService;
