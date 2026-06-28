import mongoose, { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import Dispute from '../models/dispute.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { NotificationService } from './notification.service';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// DISPUTE & REFUND ESCALATION CONFIGURATION
// ============================================

const DISPUTE_REFUND_ESCALATION_CONFIG = {
  // Dispute escalation thresholds
  dispute: {
    amountThreshold: 10000, // AED - above which disputes are auto-escalated
    unresolvedDaysThreshold: 3, // Days after which unresolved disputes are escalated
    maxPreviousDisputes: 2, // Maximum previous disputes between same parties before escalation
  },
  // Refund escalation thresholds
  refund: {
    amountThreshold: 5000, // AED - above which refunds are auto-escalated
    maxPreviousRefunds: 2, // Maximum previous refunds from same customer before escalation
  },
};

// New escalation triggers for dispute/refund specific escalation
export type DisputeRefundEscalationTrigger =
  | 'high_amount'
  | 'unresolved_too_long'
  | 'banned_user_involved'
  | 'suspended_user_involved'
  | 'repeat_disputes'
  | 'repeat_refunds'
  | 'chargeback';

export interface EscalationCheckResult {
  shouldEscalate: boolean;
  triggers: DisputeRefundEscalationTrigger[];
  reasons: string[];
}

// ============================================
// EXISTING TYPES & INTERFACES
// ============================================

export type EscalationLevel = 'level1' | 'level2' | 'level3' | 'supervisor' | 'manager';
export type EscalationTrigger = 'sla_breach' | 'customer_request' | 'auto' | 'manual' | 'priority';
export type EscalationStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

export interface EscalationRule {
  _id: string;
  name: string;
  description: string;
  trigger: EscalationTrigger;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  condition: {
    type: 'time' | 'count' | 'sentiment' | 'keyword';
    threshold: number; // in minutes for time, count for count
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  };
  targetLevel: EscalationLevel;
  autoAssign?: boolean;
  notify?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Escalation {
  _id: mongoose.Types.ObjectId;
  escalationId: string;
  entityType: 'ticket' | 'chat' | 'dispute' | 'booking';
  entityId: string;
  entityNumber: string;
  trigger: EscalationTrigger;
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: EscalationStatus;
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;
  notes?: string;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAMetric {
  entityType: 'ticket' | 'chat';
  entityId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  firstResponseDue: Date;
  resolutionDue: Date;
  firstResponseMet: boolean;
  resolutionMet: boolean;
  breachedAt?: Date;
  currentStatus: 'on_track' | 'at_risk' | 'breached';
}

// SLA Configuration by priority
const SLA_CONFIG = {
  low: {
    firstResponse: 24 * 60, // 24 hours in minutes
    resolution: 72 * 60, // 72 hours in minutes
  },
  medium: {
    firstResponse: 8 * 60, // 8 hours in minutes
    resolution: 48 * 60, // 48 hours in minutes
  },
  high: {
    firstResponse: 2 * 60, // 2 hours in minutes
    resolution: 24 * 60, // 24 hours in minutes
  },
  urgent: {
    firstResponse: 30, // 30 minutes
    resolution: 4 * 60, // 4 hours in minutes
  },
};

// In-memory escalation storage (in production, use MongoDB)
const escalations: Map<string, Escalation> = new Map();
const escalationRules: EscalationRule[] = [];

// ============================================
// ESCALATION SERVICE CLASS
// ============================================

export class EscalationService {

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize default escalation rules
   */
  async initializeDefaultRules(): Promise<void> {
    const defaultRules: Omit<EscalationRule, '_id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'SLA First Response Breach',
        description: 'Auto-escalate when first response SLA is breached',
        trigger: 'sla_breach',
        condition: {
          type: 'time',
          threshold: 0,
          operator: 'gte',
        },
        targetLevel: 'level2',
        autoAssign: true,
        notify: ['supervisor'],
        isActive: true,
      },
      {
        name: 'SLA Resolution Breach',
        description: 'Auto-escalate when resolution SLA is breached',
        trigger: 'sla_breach',
        condition: {
          type: 'time',
          threshold: 0,
          operator: 'gte',
        },
        targetLevel: 'supervisor',
        autoAssign: true,
        notify: ['manager'],
        isActive: true,
      },
      {
        name: 'Multiple Reassignments',
        description: 'Escalate after multiple agent reassignments',
        trigger: 'auto',
        condition: {
          type: 'count',
          threshold: 3,
          operator: 'gte',
        },
        targetLevel: 'level2',
        autoAssign: true,
        notify: ['supervisor'],
        isActive: true,
      },
      {
        name: 'Urgent Priority',
        description: 'High priority issues go directly to level 2',
        trigger: 'priority',
        priority: 'urgent',
        condition: {
          type: 'time',
          threshold: 0,
          operator: 'gte',
        },
        targetLevel: 'level2',
        autoAssign: true,
        isActive: true,
      },
      {
        name: 'Customer Request',
        description: 'Escalate when customer explicitly requests escalation',
        trigger: 'customer_request',
        condition: {
          type: 'time',
          threshold: 0,
          operator: 'gte',
        },
        targetLevel: 'supervisor',
        autoAssign: true,
        isActive: true,
      },
    ];

    defaultRules.forEach((rule, index) => {
      escalationRules.push({
        ...rule,
        _id: `default-${index}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    logger.info('Default escalation rules initialized', {
      context: 'EscalationService',
      action: 'INIT_RULES',
      count: defaultRules.length,
    });
  }

  // ========================================
  // ESCALATION MANAGEMENT
  // ========================================

  /**
   * Create an escalation
   */
  async createEscalation(
    entityType: 'ticket' | 'chat' | 'dispute' | 'booking',
    entityId: string,
    entityNumber: string,
    trigger: EscalationTrigger,
    fromLevel: EscalationLevel,
    toLevel: EscalationLevel,
    reason: string,
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<Escalation> {
    const escalationId = `ESC${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const escalation: Escalation = {
      _id: new Types.ObjectId(),
      escalationId,
      entityType,
      entityId,
      entityNumber,
      trigger,
      fromLevel,
      toLevel,
      reason,
      priority,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    escalations.set(escalationId, escalation);

    logger.info('Escalation created', {
      context: 'EscalationService',
      action: 'ESCALATION_CREATED',
      escalationId,
      entityType,
      entityId,
      trigger,
      toLevel,
    });

    return escalation;
  }

  /**
   * Get escalation by ID
   */
  async getEscalationById(escalationId: string): Promise<Escalation | null> {
    return escalations.get(escalationId) || null;
  }

  /**
   * Get escalations for an entity
   */
  async getEscalationsForEntity(entityType: string, entityId: string): Promise<Escalation[]> {
    const entityEscalations: Escalation[] = [];
    escalations.forEach(escalation => {
      if (escalation.entityType === entityType && escalation.entityId === entityId) {
        entityEscalations.push(escalation);
      }
    });
    return entityEscalations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Assign escalation to handler
   */
  async assignEscalation(
    escalationId: string,
    assignedTo: string,
    assignedToName: string
  ): Promise<Escalation> {
    const escalation = escalations.get(escalationId);

    if (!escalation) {
      throw new ApiError(404, 'Escalation not found');
    }

    if (escalation.status !== 'pending') {
      throw new ApiError(400, 'Escalation is already being handled');
    }

    escalation.assignedTo = new Types.ObjectId(assignedTo);
    escalation.assignedToName = assignedToName;
    escalation.status = 'in_progress';
    escalation.updatedAt = new Date();

    escalations.set(escalationId, escalation);

    logger.info('Escalation assigned', {
      context: 'EscalationService',
      action: 'ESCALATION_ASSIGNED',
      escalationId,
      assignedTo,
    });

    return escalation;
  }

  /**
   * Resolve escalation
   */
  async resolveEscalation(
    escalationId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<Escalation> {
    const escalation = escalations.get(escalationId);

    if (!escalation) {
      throw new ApiError(404, 'Escalation not found');
    }

    if (escalation.status === 'resolved' || escalation.status === 'closed') {
      throw new ApiError(400, 'Escalation is already resolved');
    }

    escalation.status = 'resolved';
    escalation.resolvedAt = new Date();
    escalation.resolvedBy = new Types.ObjectId(resolvedBy);
    escalation.resolution = resolution;
    escalation.updatedAt = new Date();

    escalations.set(escalationId, escalation);

    logger.info('Escalation resolved', {
      context: 'EscalationService',
      action: 'ESCALATION_RESOLVED',
      escalationId,
      resolvedBy,
    });

    return escalation;
  }

  /**
   * Close escalation
   */
  async closeEscalation(escalationId: string): Promise<Escalation> {
    const escalation = escalations.get(escalationId);

    if (!escalation) {
      throw new ApiError(404, 'Escalation not found');
    }

    escalation.status = 'closed';
    escalation.updatedAt = new Date();

    escalations.set(escalationId, escalation);

    return escalation;
  }

  // ========================================
  // ESCALATION RULES
  // ========================================

  /**
   * Get all escalation rules
   */
  async getRules(): Promise<EscalationRule[]> {
    return escalationRules;
  }

  /**
   * Get active escalation rules
   */
  async getActiveRules(): Promise<EscalationRule[]> {
    return escalationRules.filter(rule => rule.isActive);
  }

  /**
   * Add a new escalation rule
   */
  async addRule(rule: Omit<EscalationRule, '_id' | 'createdAt' | 'updatedAt'>): Promise<EscalationRule> {
    const newRule: EscalationRule = {
      ...rule,
      _id: `rule-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    escalationRules.push(newRule);

    logger.info('Escalation rule added', {
      context: 'EscalationService',
      action: 'RULE_ADDED',
      ruleId: newRule._id,
      name: newRule.name,
    });

    return newRule;
  }

  /**
   * Update an escalation rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<EscalationRule>
  ): Promise<EscalationRule> {
    const index = escalationRules.findIndex(r => r._id === ruleId);

    if (index === -1) {
      throw new ApiError(404, 'Escalation rule not found');
    }

    escalationRules[index] = {
      ...escalationRules[index],
      ...updates,
      updatedAt: new Date(),
    };

    logger.info('Escalation rule updated', {
      context: 'EscalationService',
      action: 'RULE_UPDATED',
      ruleId,
    });

    return escalationRules[index];
  }

  /**
   * Delete an escalation rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    const index = escalationRules.findIndex(r => r._id === ruleId);

    if (index === -1) {
      throw new ApiError(404, 'Escalation rule not found');
    }

    escalationRules.splice(index, 1);

    logger.info('Escalation rule deleted', {
      context: 'EscalationService',
      action: 'RULE_DELETED',
      ruleId,
    });
  }

  // ========================================
  // SLA MANAGEMENT
  // ========================================

  /**
   * Calculate SLA metrics for an entity
   */
  async calculateSLAMetrics(
    entityType: 'ticket' | 'chat',
    entityId: string,
    priority: 'low' | 'medium' | 'high' | 'urgent',
    createdAt: Date,
    firstResponseAt?: Date,
    resolvedAt?: Date
  ): Promise<SLAMetric> {
    const slaConfig = SLA_CONFIG[priority];
    const now = new Date();

    const firstResponseDue = new Date(createdAt.getTime() + slaConfig.firstResponse * 60 * 1000);
    const resolutionDue = new Date(createdAt.getTime() + slaConfig.resolution * 60 * 1000);

    const firstResponseMet = firstResponseAt ? firstResponseAt <= firstResponseDue : false;
    const resolutionMet = resolvedAt ? resolvedAt <= resolutionDue : false;

    let breachedAt: Date | undefined;
    let currentStatus: 'on_track' | 'at_risk' | 'breached' = 'on_track';

    if (resolvedAt) {
      if (!resolutionMet) {
        breachedAt = new Date(resolutionDue.getTime() + 1);
        currentStatus = 'breached';
      }
    } else {
      // Check if currently at risk or breached
      const timeToFirstResponse = (firstResponseDue.getTime() - now.getTime()) / (60 * 1000);
      const timeToResolution = (resolutionDue.getTime() - now.getTime()) / (60 * 1000);

      if (timeToResolution <= 0) {
        breachedAt = new Date();
        currentStatus = 'breached';
      } else if (timeToFirstResponse <= 0 || timeToResolution < 60) {
        currentStatus = 'at_risk';
      }
    }

    return {
      entityType,
      entityId,
      priority,
      firstResponseDue,
      resolutionDue,
      firstResponseMet,
      resolutionMet,
      breachedAt,
      currentStatus,
    };
  }

  /**
   * Check and trigger SLA-based escalations
   */
  async checkSLAEscalations(): Promise<number> {
    let escalatedCount = 0;

    // This would typically query actual tickets/chats from database
    // For now, this is a placeholder for the SLA check logic
    const activeRules = await this.getActiveRules();
    const slaRules = activeRules.filter(r => r.trigger === 'sla_breach');

    for (const rule of slaRules) {
      // In production, query entities that match the rule conditions
      // and create escalations as needed
      escalatedCount++;
    }

    if (escalatedCount > 0) {
      logger.info('SLA escalations triggered', {
        context: 'EscalationService',
        action: 'SLA_ESCALATION_CHECK',
        escalatedCount,
      });
    }

    return escalatedCount;
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get escalation statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    byLevel: Record<EscalationLevel, number>;
    byTrigger: Record<EscalationTrigger, number>;
    avgResolutionTime: number; // in minutes
  }> {
    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      byLevel: {
        level1: 0,
        level2: 0,
        level3: 0,
        supervisor: 0,
        manager: 0,
      } as Record<EscalationLevel, number>,
      byTrigger: {
        sla_breach: 0,
        customer_request: 0,
        auto: 0,
        manual: 0,
        priority: 0,
      } as Record<EscalationTrigger, number>,
      avgResolutionTime: 0,
    };

    const resolutionTimes: number[] = [];

    escalations.forEach(escalation => {
      // Apply date filter if provided
      if (startDate && escalation.createdAt < startDate) return;
      if (endDate && escalation.createdAt > endDate) return;

      stats.total++;
      const statusKey = escalation.status === 'in_progress' ? 'inProgress' : escalation.status;
      if (statusKey in stats && typeof stats[statusKey as keyof typeof stats] === 'number') {
        (stats[statusKey as 'pending' | 'inProgress' | 'resolved'] as number)++;
      }
      stats.byLevel[escalation.toLevel]++;
      stats.byTrigger[escalation.trigger]++;

      if (escalation.resolvedAt && escalation.createdAt) {
        const resolutionTime =
          (new Date(escalation.resolvedAt).getTime() - new Date(escalation.createdAt).getTime()) /
          (60 * 1000);
        resolutionTimes.push(resolutionTime);
      }
    });

    if (resolutionTimes.length > 0) {
      stats.avgResolutionTime = Math.round(
        resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      );
    }

    return stats;
  }

  /**
   * Get escalations by status
   */
  async getEscalationsByStatus(
    status: EscalationStatus,
    page: number = 1,
    limit: number = 20
  ): Promise<{ escalations: Escalation[]; total: number; pages: number }> {
    const filtered: Escalation[] = [];
    escalations.forEach(escalation => {
      if (escalation.status === status) {
        filtered.push(escalation);
      }
    });

    // Sort by createdAt descending
    filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = filtered.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return { escalations: paginated, total, pages };
  }

  /**
   * Get supervisor assignments for escalations
   */
  async getSupervisorAssignments(): Promise<{
    level1: string[];
    level2: string[];
    level3: string[];
    supervisor: string[];
    manager: string[];
  }> {
    // In production, this would query the database for actual agent assignments
    return {
      level1: [],
      level2: [],
      level3: [],
      supervisor: [],
      manager: [],
    };
  }

  /**
   * Auto-assign to appropriate level based on rules
   */
  async autoAssignLevel(
    entityType: string,
    priority: 'low' | 'medium' | 'high' | 'urgent',
    category?: string
  ): Promise<EscalationLevel> {
    const rules = await this.getActiveRules();

    // Find matching rule
    const matchingRule = rules.find(rule => {
      if (rule.priority && rule.priority !== priority) return false;
      if (rule.category && rule.category !== category) return false;
      return true;
    });

    return matchingRule?.targetLevel || 'level1';
  }

  // ========================================
  // DISPUTE ESCALATION METHODS
  // ========================================

  /**
   * Check if a dispute should be escalated based on rules
   */
  async checkDisputeEscalation(disputeId: string): Promise<EscalationCheckResult> {
    const triggers: DisputeRefundEscalationTrigger[] = [];
    const reasons: string[] = [];

    try {
      const dispute = await Dispute.findById(disputeId)
        .populate('bookingId', 'pricing customerId providerId')
        .lean();

      if (!dispute) {
        return { shouldEscalate: false, triggers: [], reasons: [] };
      }

      const booking = dispute.bookingId as any;
      const amount = booking?.pricing?.totalAmount || 0;
      const currency = booking?.pricing?.currency || 'AED';

      // Check 1: High amount threshold
      if (amount > DISPUTE_REFUND_ESCALATION_CONFIG.dispute.amountThreshold) {
        triggers.push('high_amount');
        reasons.push(`Amount (${currency} ${amount}) exceeds threshold (${currency} ${DISPUTE_REFUND_ESCALATION_CONFIG.dispute.amountThreshold})`);
      }

      // Check 2: Unresolved for too long
      const daysSinceCreation = this.calculateDaysSince(dispute.createdAt);
      if (daysSinceCreation > DISPUTE_REFUND_ESCALATION_CONFIG.dispute.unresolvedDaysThreshold) {
        const status = dispute.status;
        if (status !== 'resolved' && status !== 'closed') {
          triggers.push('unresolved_too_long');
          reasons.push(`Unresolved for ${daysSinceCreation} days (threshold: ${DISPUTE_REFUND_ESCALATION_CONFIG.dispute.unresolvedDaysThreshold} days)`);
        }
      }

      // Check 3: Banned or suspended user involved
      const initiatorStatus = await this.checkUserStatus(dispute.initiator.userId);
      const respondentStatus = await this.checkUserStatus(dispute.respondent.userId);

      if (initiatorStatus.isBanned) {
        triggers.push('banned_user_involved');
        reasons.push(`Initiator (${dispute.initiator.name}) is banned`);
      } else if (initiatorStatus.isSuspended) {
        triggers.push('suspended_user_involved');
        reasons.push(`Initiator (${dispute.initiator.name}) is suspended`);
      }

      if (respondentStatus.isBanned) {
        triggers.push('banned_user_involved');
        reasons.push(`Respondent (${dispute.respondent.name}) is banned`);
      } else if (respondentStatus.isSuspended) {
        triggers.push('suspended_user_involved');
        reasons.push(`Respondent (${dispute.respondent.name}) is suspended`);
      }

      // Check 4: Repeat disputes between same parties
      const previousDisputesCount = await this.countPreviousDisputesBetweenParties(
        dispute.initiator.userId,
        dispute.respondent.userId,
        disputeId
      );

      if (previousDisputesCount >= DISPUTE_REFUND_ESCALATION_CONFIG.dispute.maxPreviousDisputes) {
        triggers.push('repeat_disputes');
        reasons.push(`${previousDisputesCount + 1} disputes between same parties (threshold: ${DISPUTE_REFUND_ESCALATION_CONFIG.dispute.maxPreviousDisputes})`);
      }

      return {
        shouldEscalate: triggers.length > 0,
        triggers,
        reasons,
      };

    } catch (error) {
      logger.error('Error checking dispute escalation', {
        disputeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { shouldEscalate: false, triggers: [], reasons: [] };
    }
  }

  /**
   * Escalate a dispute automatically
   */
  async escalateDispute(disputeId: string, reasons: DisputeRefundEscalationTrigger[]): Promise<void> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const dispute = await Dispute.findById(disputeId).session(session);
      if (!dispute) {
        throw new ApiError(404, 'Dispute not found');
      }

      // Already escalated
      if (dispute.status === 'escalated') {
        await session.commitTransaction();
        return;
      }

      const previousStatus = dispute.status;
      const previousPriority = dispute.priority;

      // Update dispute
      dispute.status = 'escalated';
      dispute.escalatedAt = new Date();
      dispute.priority = 'urgent';

      // Add timeline entry
      dispute.timeline.push({
        action: 'auto_escalated',
        performedBy: new Types.ObjectId('000000000000000000000000'),
        performedByRole: 'system',
        timestamp: new Date(),
        details: `Auto-escalated due to: ${reasons.join(', ')}`,
        previousStatus,
        newStatus: 'escalated',
      });

      await dispute.save({ session });
      await session.commitTransaction();

      // Publish event
      eventBus.publish(EVENT_TYPES.DISPUTE_ESCALATED, {
        disputeId: dispute._id,
        disputeNumber: dispute.disputeNumber,
        escalatedBy: 'system',
        reason: reasons.join(', '),
        autoEscalated: true,
      });

      // Notify admins
      await this.notifyEscalationAdmins({
        entityType: 'dispute',
        entityId: dispute._id,
        entityNumber: dispute.disputeNumber,
        triggers: reasons,
      });

      logger.info('Dispute auto-escalated', {
        disputeId,
        disputeNumber: dispute.disputeNumber,
        triggers: reasons,
      });

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
  // REFUND ESCALATION METHODS
  // ========================================

  /**
   * Check if a refund should be escalated based on rules
   */
  async checkRefundEscalation(refundId: string): Promise<EscalationCheckResult> {
    const triggers: DisputeRefundEscalationTrigger[] = [];
    const reasons: string[] = [];

    try {
      const RefundRequest = mongoose.model('RefundRequest');
      const refund = await RefundRequest.findById(refundId)
        .populate('bookingId', 'pricing customerId')
        .lean() as any;

      if (!refund) {
        return { shouldEscalate: false, triggers: [], reasons: [] };
      }

      const booking = refund.bookingId as { pricing?: { currency?: string }; customerId?: Types.ObjectId } | null;
      const amount = (refund as any).amount || 0;
      const currency = booking?.pricing?.currency || 'AED';

      // Check 1: High amount threshold
      if (amount > DISPUTE_REFUND_ESCALATION_CONFIG.refund.amountThreshold) {
        triggers.push('high_amount');
        reasons.push(`Refund amount (${currency} ${amount}) exceeds threshold (${currency} ${DISPUTE_REFUND_ESCALATION_CONFIG.refund.amountThreshold})`);
      }

      // Check 2: Repeat refunds from same customer
      const customerId = booking?.customerId;
      if (customerId) {
        const previousRefundsCount = await this.countPreviousRefundsFromCustomer(
          customerId,
          refundId
        );

        if (previousRefundsCount >= DISPUTE_REFUND_ESCALATION_CONFIG.refund.maxPreviousRefunds) {
          triggers.push('repeat_refunds');
          reasons.push(`${previousRefundsCount + 1} refunds from same customer (threshold: ${DISPUTE_REFUND_ESCALATION_CONFIG.refund.maxPreviousRefunds})`);
        }
      }

      // Check 3: Chargeback
      const refundAny = refund as any;
      if (refundAny.type === 'chargeback') {
        triggers.push('chargeback');
        reasons.push('Chargeback initiated - requires immediate attention');
      }

      return {
        shouldEscalate: triggers.length > 0,
        triggers,
        reasons,
      };

    } catch (error) {
      logger.error('Error checking refund escalation', {
        refundId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { shouldEscalate: false, triggers: [], reasons: [] };
    }
  }

  /**
   * Escalate a refund automatically
   */
  async escalateRefund(refundId: string, reasons: DisputeRefundEscalationTrigger[]): Promise<void> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const RefundRequest = mongoose.model('RefundRequest');
      const refund = await RefundRequest.findById(refundId).session(session);

      if (!refund) {
        throw new ApiError(404, 'Refund not found');
      }

      const refundAny = refund as any;

      // Add escalation metadata
      refundAny.escalatedAt = new Date();
      refundAny.escalationTriggers = reasons;
      refundAny.isEscalated = true;

      // Add timeline entry
      refund.timeline.push({
        action: 'auto_escalated',
        performedBy: new Types.ObjectId('000000000000000000000000'),
        performedByRole: 'system',
        timestamp: new Date(),
        details: `Auto-escalated due to: ${reasons.join(', ')}`,
      });

      await refund.save({ session });
      await session.commitTransaction();

      // Publish event
      eventBus.publish(EVENT_TYPES.REFUND_ESCALATED, {
        refundId: refund._id,
        refundNumber: refundAny.refundNumber,
        escalatedBy: 'system',
        reason: reasons.join(', '),
        autoEscalated: true,
      });

      // Notify admins
      await this.notifyEscalationAdmins({
        entityType: 'refund',
        entityId: refund._id,
        entityNumber: refundAny.refundNumber,
        triggers: reasons,
      });

      logger.info('Refund auto-escalated', {
        refundId,
        refundNumber: refundAny.refundNumber,
        triggers: reasons,
      });

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
  // HELPER METHODS
  // ========================================

  /**
   * Notify admins about escalated items
   */
  private async notifyEscalationAdmins(context: {
    entityType: 'dispute' | 'refund';
    entityId: Types.ObjectId;
    entityNumber: string;
    triggers: DisputeRefundEscalationTrigger[];
  }): Promise<void> {
    try {
      const admins = await User.find({ role: 'admin' }).select('_id email firstName lastName');
      const notificationService = new NotificationService();

      const triggerDescriptions = context.triggers.map(t => this.getTriggerDescription(t)).join(', ');

      const notifications = admins.map(admin => ({
        recipientId: admin._id.toString(),
        type: `${context.entityType}_escalated` as any,
        title: `${context.entityType === 'dispute' ? 'Dispute' : 'Refund'} Escalated`,
        message: `${context.entityType === 'dispute' ? 'Dispute' : 'Refund'} #${context.entityNumber} has been auto-escalated. Reason: ${triggerDescriptions}`,
        metadata: {
          entityType: context.entityType,
          entityId: context.entityId.toString(),
          entityNumber: context.entityNumber,
          triggers: context.triggers,
          escalatedAt: new Date().toISOString(),
        },
      }));

      await Promise.all(
        notifications.map(notification =>
          notificationService.createNotification(notification)
        )
      );

      logger.info('Escalation notifications sent', {
        entityType: context.entityType,
        entityId: context.entityId,
        adminCount: admins.length,
      });

    } catch (error) {
      logger.error('Failed to send escalation notifications', {
        entityType: context.entityType,
        entityId: context.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get human-readable description for escalation trigger
   */
  private getTriggerDescription(trigger: DisputeRefundEscalationTrigger): string {
    const descriptions: Record<DisputeRefundEscalationTrigger, string> = {
      high_amount: 'High transaction amount',
      unresolved_too_long: 'Unresolved for too long',
      banned_user_involved: 'Banned user involved',
      suspended_user_involved: 'Suspended user involved',
      repeat_disputes: 'Repeat disputes between parties',
      repeat_refunds: 'Repeat refunds from customer',
      chargeback: 'Chargeback initiated',
    };
    return descriptions[trigger] || trigger;
  }

  /**
   * Check user ban/suspension status
   */
  private async checkUserStatus(userId: Types.ObjectId): Promise<{
    isBanned: boolean;
    isSuspended: boolean;
  }> {
    const user = await User.findById(userId)
      .select('status suspensionEndsAt')
      .lean();

    if (!user) {
      return { isBanned: false, isSuspended: false };
    }

    const userAny = user as any;
    const isBanned = userAny.status === 'banned' || userAny.status === 'deactivated';
    const isSuspended = userAny.status === 'suspended' &&
      (!userAny.suspensionEndsAt || userAny.suspensionEndsAt > new Date());

    return { isBanned, isSuspended };
  }

  /**
   * Count previous disputes between same parties
   */
  private async countPreviousDisputesBetweenParties(
    initiatorId: Types.ObjectId,
    respondentId: Types.ObjectId,
    excludeDisputeId: string
  ): Promise<number> {
    const count = await Dispute.countDocuments({
      _id: { $ne: new Types.ObjectId(excludeDisputeId) },
      status: { $nin: ['resolved', 'closed'] },
      $or: [
        {
          'initiator.userId': initiatorId,
          'respondent.userId': respondentId,
        },
        {
          'initiator.userId': respondentId,
          'respondent.userId': initiatorId,
        },
      ],
    });

    return count;
  }

  /**
   * Count previous refunds from same customer
   */
  private async countPreviousRefundsFromCustomer(
    customerId: Types.ObjectId,
    excludeRefundId: string
  ): Promise<number> {
    const RefundRequest = mongoose.model('RefundRequest');

    const count = await RefundRequest.countDocuments({
      _id: { $ne: new Types.ObjectId(excludeRefundId) },
      requestedBy: customerId,
      status: { $in: ['pending', 'approved', 'processing', 'completed'] },
    });

    return count;
  }

  /**
   * Calculate days since a date
   */
  private calculateDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // ========================================
  // BATCH PROCESSING (for cron jobs)
  // ========================================

  /**
   * Process all open disputes for potential escalation
   */
  async processOpenDisputesForEscalation(): Promise<{ processed: number; escalated: number }> {
    let processed = 0;
    let escalated = 0;

    try {
      const disputes = await Dispute.find({
        status: { $in: ['open', 'under_review'] },
        escalatedAt: { $exists: false },
      }).select('_id disputeNumber');

      for (const dispute of disputes) {
        processed++;
        const result = await this.checkDisputeEscalation(dispute._id.toString());

        if (result.shouldEscalate) {
          await this.escalateDispute(dispute._id.toString(), result.triggers);
          escalated++;
        }
      }

      logger.info('Batch dispute escalation completed', { processed, escalated });
      return { processed, escalated };

    } catch (error) {
      logger.error('Error in batch dispute escalation', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { processed, escalated };
    }
  }

  /**
   * Process all pending refunds for potential escalation
   */
  async processPendingRefundsForEscalation(): Promise<{ processed: number; escalated: number }> {
    let processed = 0;
    let escalated = 0;

    try {
      const RefundRequest = mongoose.model('RefundRequest');

      const refunds = await RefundRequest.find({
        status: 'pending',
        isEscalated: { $ne: true },
      }).select('_id refundNumber');

      for (const refund of refunds) {
        processed++;
        const result = await this.checkRefundEscalation(refund._id.toString());

        if (result.shouldEscalate) {
          await this.escalateRefund(refund._id.toString(), result.triggers);
          escalated++;
        }
      }

      logger.info('Batch refund escalation completed', { processed, escalated });
      return { processed, escalated };

    } catch (error) {
      logger.error('Error in batch refund escalation', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { processed, escalated };
    }
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const escalationService = new EscalationService();
export default escalationService;
