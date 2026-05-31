/**
 * Dispute Mediation Auto-Assignment Automation
 *
 * Automatically assigns disputes to mediators with load balancing:
 * - Auto-assign to mediators
 * - Load balancing
 * - SLA tracking
 * - Escalation rules
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import Dispute, { IDispute } from '../models/dispute.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IMediatorAssignment extends Document {
  disputeId: mongoose.Types.ObjectId;
  mediatorId: mongoose.Types.ObjectId;
  assignedAt: Date;
  assignedBy: 'system' | mongoose.Types.ObjectId;
  assignmentReason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'assigned' | 'accepted' | 'rejected' | 'escalated' | 'completed';
  deadline: Date;
  slaStatus: 'on_track' | 'at_risk' | 'breached';
  completedAt?: Date;
  resolution?: {
    type: 'mediated' | 'escalated' | 'closed';
    notes?: string;
  };
  auditTrail?: Array<{
    action: string;
    timestamp: Date;
    performedBy?: mongoose.Types.ObjectId | 'system';
    details?: string;
  }>;
  reassignment?: {
    previousMediatorId: mongoose.Types.ObjectId;
    reassignedAt: Date;
    reason: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const mediatorAssignmentSchema = new Schema<IMediatorAssignment>(
  {
    disputeId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispute',
      required: true,
      index: true,
    },
    mediatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignmentReason: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      required: true,
    },
    status: {
      type: String,
      enum: ['assigned', 'accepted', 'rejected', 'escalated', 'completed'],
      default: 'assigned',
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    slaStatus: {
      type: String,
      enum: ['on_track', 'at_risk', 'breached'],
      default: 'on_track',
    },
    completedAt: Date,
    resolution: {
      type: {
        type: String,
        enum: ['mediated', 'escalated', 'closed'],
      },
      notes: String,
    },
    reassignment: {
      previousMediatorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      reassignedAt: Date,
      reason: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
mediatorAssignmentSchema.index({ mediatorId: 1, status: 1 });
mediatorAssignmentSchema.index({ status: 1, slaStatus: 1 });
mediatorAssignmentSchema.index({ deadline: 1, status: 1 });

const MediatorAssignment = mongoose.model<IMediatorAssignment>('MediatorAssignment', mediatorAssignmentSchema);

// Configuration
const CONFIG = {
  // SLA deadlines by priority (hours)
  slaDeadlines: {
    urgent: 4,
    high: 24,
    medium: 48,
    low: 72,
  },

  // SLA warning threshold (percentage of time remaining)
  slaWarningThreshold: 25, // 25% time remaining = at risk

  // Max active assignments per mediator
  maxActiveAssignments: {
    urgent: 2,
    high: 5,
    medium: 10,
    low: 15,
  },

  // Load balancing weights
  loadWeights: {
    // Prefer mediators with fewer current assignments
    currentLoad: 0.4,
    // Prefer mediators with better resolution rates
    resolutionRate: 0.3,
    // Prefer mediators with faster resolution times
    avgResolutionTime: 0.2,
    // Prefer mediators with relevant category experience
    categoryExperience: 0.1,
  },

  // Categories that may require special handling
  specialCategories: ['damage', 'safety'],

  // Auto-escalate after X SLA breaches
  autoEscalateAfterBreaches: 2,
};

interface MediatorScore {
  mediatorId: mongoose.Types.ObjectId;
  score: number;
  currentLoad: number;
  avgResolutionTime: number;
  resolutionRate: number;
}

/**
 * Get available mediators
 */
async function getAvailableMediators(
  priority: IMediatorAssignment['priority']
): Promise<MediatorScore[]> {
  const maxAssignments = CONFIG.maxActiveAssignments[priority];

  // Get mediator stats
  const mediatorStats = await User.aggregate([
    {
      $match: {
        role: 'admin',
        accountStatus: 'active',
        isActive: true,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'mediatorassignments',
        pipeline: [
          {
            $match: {
              status: { $in: ['assigned', 'accepted'] },
            },
          },
          {
            $group: {
              _id: '$mediatorId',
              activeCount: { $sum: 1 },
              urgentCount: {
                $sum: {
                  $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0],
                },
              },
            },
          },
        ],
        as: 'assignments',
      },
    },
    {
      $unwind: {
        path: '$assignments',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        currentLoad: { $ifNull: ['$assignments.activeCount', 0] },
        urgentCount: { $ifNull: ['$assignments.urgentCount', 0] },
      },
    },
    {
      $match: {
        $or: [
          { urgentCount: { $lt: CONFIG.maxActiveAssignments.urgent } },
          { priority: { $ne: 'urgent' } },
        ],
      },
    },
  ]);

  // Get resolution statistics for each mediator
  const mediatorScores: MediatorScore[] = [];

  for (const mediator of mediatorStats) {
    const assignments = await MediatorAssignment.find({
      mediatorId: mediator._id,
      status: 'completed',
    }).select('createdAt completedAt');

    const currentLoad = (mediator as { currentLoad?: number }).currentLoad || 0;

    // Skip if at max capacity
    if (currentLoad >= maxAssignments) continue;

    // Calculate resolution rate
    const totalAssignments = assignments.length;
    const resolvedCount = assignments.filter(a => a.completedAt).length;
    const resolutionRate = totalAssignments > 0 ? resolvedCount / totalAssignments : 0.8; // Default to 80%

    // Calculate average resolution time
    const resolutionTimes = assignments
      .filter(a => a.completedAt)
      .map(a => (a.completedAt!.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60)); // Hours
    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum: number, t: number) => sum + t, 0) / resolutionTimes.length
      : 24; // Default 24 hours

    mediatorScores.push({
      mediatorId: mediator._id,
      score: 0,
      currentLoad,
      resolutionRate,
      avgResolutionTime,
    });
  }

  // Normalize scores
  const maxLoad = Math.max(...mediatorScores.map(m => m.currentLoad), 1);
  const minResolutionTime = Math.min(...mediatorScores.map(m => m.avgResolutionTime), 1);

  for (const mediator of mediatorScores) {
    // Load score (lower load = higher score)
    const loadScore = 1 - (mediator.currentLoad / maxLoad);

    // Resolution rate score (higher = better)
    const resolutionScore = mediator.resolutionRate;

    // Time score (faster = higher score)
    const timeScore = Math.min(1, minResolutionTime / Math.max(mediator.avgResolutionTime, 1));

    // Calculate weighted score
    mediator.score =
      loadScore * CONFIG.loadWeights.currentLoad +
      resolutionScore * CONFIG.loadWeights.resolutionRate +
      timeScore * CONFIG.loadWeights.avgResolutionTime;
  }

  // Sort by score descending
  mediatorScores.sort((a, b) => b.score - a.score);

  return mediatorScores;
}

/**
 * Assign dispute to a mediator
 */
export async function assignDisputeToMediator(
  disputeId: mongoose.Types.ObjectId,
  options?: {
    priority?: IMediatorAssignment['priority'];
    forceMediatorId?: mongoose.Types.ObjectId;
  }
): Promise<IMediatorAssignment | null> {
  try {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    // Check if already assigned
    const existingAssignment = await MediatorAssignment.findOne({
      disputeId,
      status: { $in: ['assigned', 'accepted'] },
    });

    if (existingAssignment) {
      logger.debug('assignDisputeToMediator: Already assigned', {
        disputeId: disputeId.toString(),
        mediatorId: existingAssignment.mediatorId.toString(),
      });
      return existingAssignment;
    }

    // Determine priority
    const priority = options?.priority ||
      (dispute.priority as IMediatorAssignment['priority']) ||
      'medium';

    let mediatorId: mongoose.Types.ObjectId;

    if (options?.forceMediatorId) {
      // Force assignment to specific mediator
      mediatorId = options.forceMediatorId;
    } else {
      // Auto-select mediator using load balancing
      const availableMediators = await getAvailableMediators(priority);

      if (availableMediators.length === 0) {
        logger.warn('assignDisputeToMediator: No available mediators', {
          disputeId: disputeId.toString(),
          priority,
        });
        return null;
      }

      mediatorId = availableMediators[0].mediatorId;
    }

    // Calculate deadline
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + CONFIG.slaDeadlines[priority]);

    // Create assignment
    const assignment = await MediatorAssignment.create({
      disputeId,
      mediatorId,
      assignedAt: new Date(),
      assignedBy: 'system',
      assignmentReason: options?.forceMediatorId
        ? 'Manual assignment by admin'
        : `Auto-assigned based on mediator availability and load (priority: ${priority})`,
      priority,
      status: 'assigned',
      deadline,
      slaStatus: 'on_track',
    });

    // Update dispute
    await Dispute.findByIdAndUpdate(disputeId, {
      assignedTo: mediatorId,
      assignedAt: new Date(),
    });

    // Notify mediator
    await notifyMediator(assignment, dispute);

    logger.info('assignDisputeToMediator: Dispute assigned', {
      disputeId: disputeId.toString(),
      mediatorId: mediatorId.toString(),
      priority,
      deadline: deadline.toISOString(),
    });

    return assignment;
  } catch (error) {
    logger.error('assignDisputeToMediator: Failed', {
      disputeId: disputeId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Notify mediator of new assignment
 */
async function notifyMediator(
  assignment: IMediatorAssignment,
  dispute: IDispute
): Promise<void> {
  try {
    const mediator = await User.findById(assignment.mediatorId).select('email firstName');

    if (!mediator) return;

    const priorityEmoji = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    // Send email
    await addJob('email-queue', 'send_email', {
      to: mediator.email,
      subject: `${priorityEmoji[assignment.priority]} New Dispute Assignment - ${assignment.priority.toUpperCase()} Priority`,
      template: 'dispute_assignment',
      data: {
        mediatorName: mediator.firstName,
        disputeId: dispute._id.toString(),
        disputeNumber: dispute.disputeNumber,
        category: dispute.category,
        priority: assignment.priority,
        deadline: assignment.deadline.toISOString(),
        reason: dispute.reason,
        description: dispute.description.substring(0, 200),
        customerName: dispute.initiator.name,
        providerName: dispute.respondent.name,
        disputeUrl: `${process.env.FRONTEND_URL}/admin/disputes/${dispute._id}`,
      },
    });

    // Send push notification
    await addJob('notification-queue', 'send_notification', {
      userId: assignment.mediatorId.toString(),
      type: 'dispute_assigned',
      title: 'New Dispute Assigned',
      message: `${priorityEmoji[assignment.priority]} A ${assignment.priority} priority dispute requires your attention.`,
      data: {
        disputeId: dispute._id.toString(),
        priority: assignment.priority,
        deadline: assignment.deadline.toISOString(),
      },
    });

    logger.info('notifyMediator: Mediator notified', {
      assignmentId: assignment._id.toString(),
      mediatorId: assignment.mediatorId.toString(),
    });
  } catch (error) {
    logger.error('notifyMediator: Failed', {
      assignmentId: assignment._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Accept assignment by mediator
 */
export async function acceptAssignment(
  assignmentId: mongoose.Types.ObjectId,
  mediatorId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    const assignment = await MediatorAssignment.findById(assignmentId);

    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    if (!assignment.mediatorId.equals(mediatorId)) {
      throw new Error('Not authorized to accept this assignment');
    }

    if (assignment.status !== 'assigned') {
      throw new Error(`Assignment cannot be accepted (current status: ${assignment.status})`);
    }

    assignment.status = 'accepted';
    assignment.auditTrail = assignment.auditTrail || [];
    assignment.auditTrail.push({
      action: 'accepted',
      timestamp: new Date(),
      performedBy: mediatorId,
      details: 'Mediator accepted the assignment',
    });

    await assignment.save();

    logger.info('acceptAssignment: Assignment accepted', {
      assignmentId: assignmentId.toString(),
      mediatorId: mediatorId.toString(),
    });
  } catch (error) {
    logger.error('acceptAssignment: Failed', {
      assignmentId: assignmentId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Reject assignment by mediator
 */
export async function rejectAssignment(
  assignmentId: mongoose.Types.ObjectId,
  mediatorId: mongoose.Types.ObjectId,
  reason: string
): Promise<void> {
  try {
    const assignment = await MediatorAssignment.findById(assignmentId);

    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    if (!assignment.mediatorId.equals(mediatorId)) {
      throw new Error('Not authorized to reject this assignment');
    }

    // Mark as rejected and reassign
    assignment.status = 'rejected';
    if (assignment.auditTrail) {
      assignment.auditTrail.push({
        action: 'rejected',
        timestamp: new Date(),
        performedBy: mediatorId,
        details: reason,
      });
    }

    await assignment.save();

    // Reassign to another mediator
    await assignDisputeToMediator(assignment.disputeId, {
      priority: assignment.priority,
    });

    logger.info('rejectAssignment: Assignment rejected and reassigned', {
      assignmentId: assignmentId.toString(),
      mediatorId: mediatorId.toString(),
      reason,
    });
  } catch (error) {
    logger.error('rejectAssignment: Failed', {
      assignmentId: assignmentId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Complete mediation
 */
export async function completeMediation(
  assignmentId: mongoose.Types.ObjectId,
  resolution: { type: 'mediated' | 'escalated'; notes?: string }
): Promise<void> {
  try {
    const assignment = await MediatorAssignment.findById(assignmentId);

    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    assignment.status = 'completed';
    assignment.completedAt = new Date();
    assignment.resolution = resolution;

    if (!assignment.auditTrail) {
      assignment.auditTrail = [];
    }
    assignment.auditTrail.push({
      action: 'completed',
      timestamp: new Date(),
      performedBy: assignment.mediatorId,
      details: `Mediation completed: ${resolution.type}`,
    });

    await assignment.save();

    // Update dispute status
    await Dispute.findByIdAndUpdate(assignment.disputeId, {
      status: resolution.type === 'escalated' ? 'escalated' : 'resolved',
    });

    logger.info('completeMediation: Mediation completed', {
      assignmentId: assignmentId.toString(),
      resolutionType: resolution.type,
    });
  } catch (error) {
    logger.error('completeMediation: Failed', {
      assignmentId: assignmentId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Check SLA status and update
 * Called hourly by scheduled job
 */
export async function checkSlaStatus(): Promise<{
  atRisk: number;
  breached: number;
  escalated: number;
}> {
  const result = {
    atRisk: 0,
    breached: 0,
    escalated: 0,
  };

  try {
    const now = new Date();

    // Find assignments that need SLA checks
    const assignments = await MediatorAssignment.find({
      status: { $in: ['assigned', 'accepted'] },
    });

    for (const assignment of assignments) {
      const timeRemaining = assignment.deadline.getTime() - now.getTime();
      const totalTime = assignment.deadline.getTime() - assignment.assignedAt.getTime();
      const timeRemainingPercentage = (timeRemaining / totalTime) * 100;

      const previousStatus = assignment.slaStatus;

      // Check if breached
      if (timeRemaining <= 0) {
        if (assignment.slaStatus !== 'breached') {
          assignment.slaStatus = 'breached';
          await assignment.save();
          result.breached++;

          // Auto-escalate if configured
          await handleSlaBreach(assignment);
          result.escalated++;
        }
      }
      // Check if at risk
      else if (timeRemainingPercentage <= CONFIG.slaWarningThreshold) {
        if (assignment.slaStatus !== 'at_risk') {
          assignment.slaStatus = 'at_risk';
          await assignment.save();
          result.atRisk++;

          // Notify mediator
          await notifySlaWarning(assignment, timeRemaining);
        }
      }
    }

    logger.info('checkSlaStatus: SLA check completed', result);
    return result;
  } catch (error) {
    logger.error('checkSlaStatus: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Handle SLA breach
 */
async function handleSlaBreach(assignment: IMediatorAssignment): Promise<void> {
  try {
    // Update assignment status
    await assignment.updateOne({
      status: 'escalated',
      resolution: {
        type: 'escalated',
        notes: 'Auto-escalated due to SLA breach',
      },
      completedAt: new Date(),
    });

    // Escalate the dispute
    await Dispute.findByIdAndUpdate(assignment.disputeId, {
      status: 'escalated',
    });

    // Notify ops team
    await addJob('notification-queue', 'send_notification', {
      userId: 'ops_team',
      type: 'sla_breach',
      title: 'SLA Breach - Dispute Escalated',
      message: `A dispute has breached SLA and been escalated. Immediate attention required.`,
      data: {
        disputeId: assignment.disputeId.toString(),
        assignmentId: assignment._id.toString(),
      },
    });

    logger.info('handleSlaBreach: SLA breach handled', {
      assignmentId: assignment._id.toString(),
      disputeId: assignment.disputeId.toString(),
    });
  } catch (error) {
    logger.error('handleSlaBreach: Failed', {
      assignmentId: assignment._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Notify mediator of SLA warning
 */
async function notifySlaWarning(
  assignment: IMediatorAssignment,
  timeRemainingMs: number
): Promise<void> {
  const hoursRemaining = Math.round(timeRemainingMs / (1000 * 60 * 60));

  await addJob('notification-queue', 'send_notification', {
    userId: assignment.mediatorId.toString(),
    type: 'sla_warning',
    title: 'Dispute Resolution Deadline Approaching',
    message: `Your dispute resolution deadline is in ${hoursRemaining} hour(s). Please prioritize this case.`,
    data: {
      disputeId: assignment.disputeId.toString(),
      assignmentId: assignment._id.toString(),
      hoursRemaining,
    },
  });
}

/**
 * Auto-assign unassigned disputes
 * Called every 15 minutes by scheduled job
 */
export async function autoAssignUnassignedDisputes(): Promise<number> {
  try {
    // Find unassigned open disputes
    const unassignedDisputes = await Dispute.find({
      status: 'open',
      assignedTo: { $exists: false },
    }).select('_id priority category');

    let assigned = 0;

    for (const dispute of unassignedDisputes) {
      const assignment = await assignDisputeToMediator(dispute._id, {
        priority: dispute.priority as IMediatorAssignment['priority'],
      });

      if (assignment) {
        assigned++;
      }
    }

    logger.info('autoAssignUnassignedDisputes: Assignment complete', {
      found: unassignedDisputes.length,
      assigned,
    });

    return assigned;
  } catch (error) {
    logger.error('autoAssignUnassignedDisputes: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get mediation statistics
 */
export async function getMediationStats(): Promise<{
  totalAssignments: number;
  byStatus: Record<string, number>;
  bySlaStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageResolutionTime: number;
  mediationSuccessRate: number;
  slaBreachRate: number;
  topMediators: Array<{
    mediatorId: string;
    assignments: number;
    resolutionRate: number;
    avgResolutionTime: number;
  }>;
}> {
  const [statusStats, slaStats, priorityStats, resolutionStats, mediatorStats] = await Promise.all([
    MediatorAssignment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    MediatorAssignment.aggregate([{ $group: { _id: '$slaStatus', count: { $sum: 1 } } }]),
    MediatorAssignment.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    MediatorAssignment.aggregate([
      {
        $match: { status: 'completed', completedAt: { $exists: true } },
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$completedAt', '$assignedAt'] },
              1000 * 60 * 60, // Hours
            ],
          },
          resolution: 1,
        },
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          mediatedCount: {
            $sum: { $cond: [{ $eq: ['$resolution.type', 'mediated'] }, 1, 0] },
          },
          totalCompleted: { $sum: 1 },
        },
      },
    ]),
    MediatorAssignment.aggregate([
      {
        $match: { status: 'completed' },
      },
      {
        $group: {
          _id: '$mediatorId',
          assignments: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$resolution.type', 'mediated'] }, 1, 0] },
          },
        },
      },
      { $sort: { assignments: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const byStatus = statusStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const bySlaStatus = slaStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const byPriority = priorityStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const totalCompleted = resolutionStats[0]?.totalCompleted || 0;
  const mediatedCount = resolutionStats[0]?.mediatedCount || 0;

  return {
    totalAssignments: (Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0),
    byStatus,
    bySlaStatus,
    byPriority,
    averageResolutionTime: resolutionStats[0]?.avgResolutionTime || 0,
    mediationSuccessRate: totalCompleted > 0 ? (mediatedCount / totalCompleted) * 100 : 0,
    slaBreachRate: bySlaStatus['breached']
      ? (bySlaStatus['breached'] / (Object.values(bySlaStatus) as number[]).reduce((sum, c) => sum + c, 0)) * 100
      : 0,
    topMediators: mediatorStats.map(m => ({
      mediatorId: m._id.toString(),
      assignments: m.assignments,
      resolutionRate: m.assignments > 0 ? (m.resolved / m.assignments) * 100 : 0,
      avgResolutionTime: 0, // Would need additional calculation
    })),
  };
}

/**
 * Assign mediations to available mediators
 * Wrapper function for scheduler integration
 */
export async function assignMediations(): Promise<{
  assignmentsMade: number;
  mediationsProcessed: number;
}> {
  try {
    logger.info('Assigning mediations via scheduler');

    // Auto-assign unassigned disputes
    const assigned = await autoAssignUnassignedDisputes();
    logger.info('Mediation auto-assignment completed', { assigned });

    // Check SLA status
    const slaResult = await checkSlaStatus();
    logger.info('SLA status checked', slaResult);

    logger.info('Mediation assignment completed via scheduler');

    return {
      assignmentsMade: assigned,
      mediationsProcessed: slaResult.atRisk,
    };
  } catch (error) {
    logger.error('Mediation assignment failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  assignDisputeToMediator,
  acceptAssignment,
  rejectAssignment,
  completeMediation,
  checkSlaStatus,
  autoAssignUnassignedDisputes,
  assignMediations,
  getMediationStats,
  MediatorAssignment,
};
