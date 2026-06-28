import express, { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  disputeService,
  CreateDisputeDTO,
  AddEvidenceDTO,
  AddMessageDTO,
  ResolveDisputeDTO,
  DisputeFiltersDTO,
  SubmitAppealDTO,
  ReviewAppealDTO,
} from '../services/dispute.service';
import { refundService, CreateRefundDTO, ProcessRefundDTO } from '../services/refund.service';
import { escalationService } from '../services/escalation.service';
import { cache } from '../config/redis';
import logger from '../utils/logger';
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for dispute messages - prevents message flooding attacks
 * Limits to 30 messages per minute per user per dispute
 */
const disputeMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { _id?: string } }).user?._id || 'unknown';
    const disputeId = req.params.id || 'unknown';
    return `dispute:msg:${userId}:${disputeId}`;
  },
  message: { success: false, error: 'Too many messages sent. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('Dispute message rate limit exceeded', {
      ip: req.ip,
      disputeId: req.params.id,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'DISPUTE_MESSAGE_RATE_LIMIT',
    });
    res.status(429).json({
      success: false,
      error: 'Too many messages sent. Please wait a moment before sending another message.',
    });
  },
});

/**
 * Rate limiter for dispute evidence - prevents evidence flooding
 * Limits to 10 evidence submissions per minute per user per dispute
 */
const disputeEvidenceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 evidence items per minute
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { _id?: string } }).user?._id || 'unknown';
    const disputeId = req.params.id || 'unknown';
    return `dispute:evidence:${userId}:${disputeId}`;
  },
  message: { success: false, error: 'Too many evidence submissions. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('Dispute evidence rate limit exceeded', {
      ip: req.ip,
      disputeId: req.params.id,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'DISPUTE_EVIDENCE_RATE_LIMIT',
    });
    res.status(429).json({
      success: false,
      error: 'Too many evidence submissions. Please wait a moment before submitting more evidence.',
    });
  },
});

/**
 * Rate limiter for dispute escalation - prevents escalation abuse
 * Limits to 3 escalations per hour per user per dispute
 */
const disputeEscalateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 escalations per hour
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { _id?: string } }).user?._id || 'unknown';
    const disputeId = req.params.id || 'unknown';
    return `dispute:escalate:${userId}:${disputeId}`;
  },
  message: { success: false, error: 'Too many escalation requests.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('Dispute escalation rate limit exceeded', {
      ip: req.ip,
      disputeId: req.params.id,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'DISPUTE_ESCALATE_RATE_LIMIT',
    });
    res.status(429).json({
      success: false,
      error: 'Too many escalation requests. Please wait before escalating this dispute again.',
    });
  },
});

/**
 * Rate limiter for dispute list retrieval
 * Limits to 100 requests per minute per user
 */
const disputesListLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { _id?: string } }).user?._id || 'unknown';
    return `dispute:list:${userId}`;
  },
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Dispute list rate limit exceeded', {
      ip: req.ip,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'DISPUTE_LIST_RATE_LIMIT',
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before fetching your disputes.',
    });
  },
});

const router = express.Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Validation schema for dispute status update
 * Status is required, reason is optional
 */
const updateDisputeStatusSchema = Joi.object({
  status: Joi.string()
    .valid('open', 'under_review', 'escalated', 'resolved', 'closed')
    .required()
    .messages({
      'any.only': 'Status must be one of: open, under_review, escalated, resolved, closed',
      'any.required': 'Status is required'
    }),
  reason: Joi.string().max(500).optional()
});

/**
 * Validation schema for dispute resolution
 * All fields are required when resolving a dispute
 */
const resolveDisputeSchema = Joi.object({
  resolutionType: Joi.string()
    .valid('refund', 'partial_refund', 'no_action', 'provider_warning', 'provider_suspended')
    .required()
    .messages({
      'any.only': 'Resolution type must be one of: refund, partial_refund, no_action, provider_warning, provider_suspended',
      'any.required': 'Resolution type is required'
    }),
  amount: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Refund amount cannot be negative'
    }),
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Resolution reason must be at least 10 characters',
      'string.max': 'Resolution reason cannot exceed 500 characters',
      'any.required': 'Resolution reason is required'
    }),
  notes: Joi.string().max(1000).optional()
});

/**
 * Validation middleware for dispute status updates
 */
const validateDisputeStatus = (req: Request, res: Response, next: NextFunction) => {
  const { error } = updateDisputeStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  return next();
};

/**
 * Validation middleware for dispute resolution
 */
const validateDisputeResolution = (req: Request, res: Response, next: NextFunction) => {
  const { error } = resolveDisputeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  return next();
};

// ============================================
// DISPUTE ROUTES
// ============================================

/**
 * @route   POST /api/disputes
 * @desc    Create a new dispute
 * @access  Private (Customer or Provider)
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { bookingId, reason, description, category, evidence } = req.body as CreateDisputeDTO;

    // Validate required fields
    if (!bookingId || !reason || !description || !category) {
      throw new ApiError(400, 'Missing required fields: bookingId, reason, description, category');
    }

    const userRole = req.user!.role === 'customer' ? 'customer' : 'provider';
    const dispute = await disputeService.createDispute(req.user!._id.toString(), userRole, {
      bookingId,
      reason,
      description,
      category,
      evidence,
    });

    // Check if dispute should be auto-escalated
    const escalationResult = await escalationService.checkDisputeEscalation(dispute._id.toString());
    if (escalationResult.shouldEscalate) {
      // Escalate asynchronously to not block the response
      escalationService.escalateDispute(dispute._id.toString(), escalationResult.triggers).catch(err => {
        logger.error('Auto-escalation failed', {
          disputeId: dispute._id.toString(),
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    res.status(201).json({
      success: true,
      data: { dispute },
      message: escalationResult.shouldEscalate
        ? 'Dispute created successfully. It has been escalated for priority review.'
        : 'Dispute created successfully',
    });
  })
);

/**
 * @route   GET /api/disputes
 * @desc    List disputes with filters
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const filters: DisputeFiltersDTO = {
      status: req.query.status as any,
      category: req.query.category as string,
      priority: req.query.priority as string,
      assignedTo: req.query.assignedTo as string,
      initiatorId: req.query.initiatorId as string,
      respondentId: req.query.respondentId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await disputeService.listDisputes(filters);

    res.json({
      success: true,
      data: result.disputes,
      pagination: result.pagination,
      ...(result.statusBreakdown && { statusBreakdown: result.statusBreakdown }),
    });
  })
);

/**
 * @route   GET /api/disputes/my
 * @desc    Get current user's disputes
 * @access  Private
 */
router.get(
  '/my',
  authenticate,
  disputesListLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status as any,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await disputeService.getUserDisputes(req.user!._id.toString(), filters);

    res.json({
      success: true,
      data: result.disputes,
      pagination: result.pagination,
      statusBreakdown: result.statusBreakdown,
    });
  })
);

/**
 * @route   GET /api/disputes/unassigned
 * @desc    Get unassigned disputes
 * @access  Private (Admin only)
 */
router.get(
  '/unassigned',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const disputes = await disputeService.getUnassignedDisputes(limit);

    res.json({
      success: true,
      data: disputes,
    });
  })
);

/**
 * @route   GET /api/disputes/stats
 * @desc    Get dispute statistics
 * @access  Private (Admin only)
 */
router.get(
  '/stats',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await disputeService.getDisputeStats(
      req.query.startDate as string,
      req.query.endDate as string
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route   GET /api/disputes/my/:disputeId
 * @desc    Get dispute by ID for current user
 * @access  Private
 * @note    FIX: Changed route from /my/:disputeId to /my/detail/:disputeId to avoid conflict with /:id
 */
router.get(
  '/my/detail/:disputeId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const dispute = await disputeService.getDisputeById(
      req.params.disputeId,
      req.user!._id.toString(),
      req.user!.role
    );

    res.json({
      success: true,
      data: dispute,
    });
  })
);

/**
 * @route   GET /api/disputes/:id
 * @desc    Get dispute by ID (Admin)
 * @access  Private (Admin only)
 */
router.get(
  '/:id',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const dispute = await disputeService.getDisputeById(
      req.params.id,
      req.user!._id.toString(),
      req.user!.role
    );

    res.json({
      success: true,
      data: dispute,
    });
  })
);

/**
 * @route   POST /api/disputes/:id/evidence
 * @desc    Add evidence to dispute
 * @access  Private (Dispute parties only)
 * @security IDOR prevention: Verifies user is party to dispute before allowing evidence submission
 * @security Rate limiting: 10 evidence submissions per minute per user per dispute
 */
router.post(
  '/:id/evidence',
  authenticate,
  disputeEvidenceLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, url, description } = req.body;
    const userId = req.user!._id.toString();
    const userRole = req.user!.role;

    if (!type) {
      throw new ApiError(400, 'Evidence type is required');
    }

    // IDOR PREVENTION: Verify user is party to dispute before allowing evidence submission
    // Admins have full access, parties can only access their own disputes
    const dispute = await disputeService.verifyDisputeAccess(
      req.params.id,
      userId,
      {
        allowAdmin: userRole === 'admin',
        allowParties: true,
        allowAssignee: true,
      }
    );

    // Check if dispute is in a state that allows evidence submission
    if (['resolved', 'closed'].includes(dispute.status)) {
      throw new ApiError(400, 'Cannot add evidence to a closed or resolved dispute');
    }

    const updatedDispute = await disputeService.addEvidence({
      disputeId: req.params.id,
      userId,
      type,
      url,
      description,
    });

    res.json({
      success: true,
      data: updatedDispute,
      message: 'Evidence added successfully',
    });
  })
);

/**
 * @route   POST /api/disputes/:id/messages
 * @desc    Add message to dispute
 * @access  Private (Dispute parties and Admin)
 */
router.post(
  '/:id/messages',
  authenticate,
  disputeMessageLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      throw new ApiError(400, 'Message content is required');
    }

    // IDOR check - verify user is party to dispute
    await disputeService.verifyDisputeAccess(
      req.params.id,
      req.user!._id.toString(),
      { allowAdmin: true, allowParties: true }
    );

    const dispute = await disputeService.addMessage({
      disputeId: req.params.id,
      senderId: req.user!._id.toString(),
      senderRole: req.user!.role === 'admin' ? 'admin' : (req.user!.role === 'customer' ? 'customer' : 'provider'),
      message: message.trim(),
    });

    res.json({
      success: true,
      data: dispute,
      message: 'Message added successfully',
    });
  })
);

/**
 * @route   POST /api/disputes/:id/assign
 * @desc    Assign dispute to admin
 * @access  Private (Admin only)
 */
router.post(
  '/:id/assign',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const dispute = await disputeService.assignDispute(
      req.params.id,
      req.user!._id.toString()
    );

    res.json({
      success: true,
      data: dispute,
      message: 'Dispute assigned successfully',
    });
  })
);

/**
 * @route   POST /api/disputes/:id/escalate
 * @desc    Escalate dispute
 * @access  Private (Dispute parties only)
 */
router.post(
  '/:id/escalate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;

    if (!reason) {
      throw new ApiError(400, 'Escalation reason is required');
    }

    // IDOR check - verify user is party to dispute (admins cannot escalate)
    await disputeService.verifyDisputeAccess(
      req.params.id,
      req.user!._id.toString(),
      { allowAdmin: false, allowParties: true }
    );

    const dispute = await disputeService.escalateDispute(
      req.params.id,
      req.user!._id.toString(),
      req.user!.role === 'customer' ? 'customer' : 'provider',
      reason
    );

    res.json({
      success: true,
      data: dispute,
      message: 'Dispute escalated successfully',
    });
  })
);

/**
 * @route   PATCH /api/disputes/:id/status
 * @desc    Update dispute status
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/status',
  authenticate,
  requireRole(['admin']),
  validateDisputeStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, reason } = req.body;

    const dispute = await disputeService.updateStatus(
      req.params.id,
      req.user!._id.toString(),
      status,
      reason
    );

    // Check for escalation triggers after status change
    // (only for open/under_review status, not for resolved/closed)
    if (status !== 'resolved' && status !== 'closed') {
      const escalationResult = await escalationService.checkDisputeEscalation(req.params.id);
      if (escalationResult.shouldEscalate) {
        // Escalate asynchronously
        escalationService.escalateDispute(req.params.id, escalationResult.triggers).catch(err => {
          logger.error('Auto-escalation failed on status change', {
            disputeId: req.params.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }

    res.json({
      success: true,
      data: dispute,
      message: 'Dispute status updated successfully',
    });
  })
);

/**
 * @route   POST /api/disputes/:id/resolve
 * @desc    Resolve dispute
 * @access  Private (Admin only)
 */
router.post(
  '/:id/resolve',
  authenticate,
  requireRole(['admin']),
  validateDisputeResolution,
  asyncHandler(async (req: Request, res: Response) => {
    const { resolutionType, amount, reason, notes } = req.body as Omit<ResolveDisputeDTO, 'disputeId' | 'resolvedBy'>;

    const dispute = await disputeService.resolveDispute({
      disputeId: req.params.id,
      resolvedBy: req.user!._id.toString(),
      resolutionType,
      amount,
      reason,
      notes,
    });

    res.json({
      success: true,
      data: dispute,
      message: 'Dispute resolved successfully',
    });
  })
);

/**
 * @route   POST /api/disputes/:id/close
 * @desc    Close dispute
 * @access  Private
 */
router.post(
  '/:id/close',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;

    // Admins can close any dispute, parties can only close resolved disputes
    const dispute = await disputeService.getDisputeById(req.params.id);

    if (req.user!.role !== 'admin') {
      if (dispute.status !== 'resolved') {
        throw new ApiError(403, 'Only admins can close unresolved disputes');
      }
    }

    const closedDispute = await disputeService.closeDispute(
      req.params.id,
      req.user!._id.toString(),
      req.user!.role === 'admin' ? 'admin' : 'customer',
      reason
    );

    res.json({
      success: true,
      data: closedDispute,
      message: 'Dispute closed successfully',
    });
  })
);

/**
 * @route   PATCH /api/disputes/:id/notes
 * @desc    Add admin notes to dispute
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/notes',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { notes } = req.body;

    if (!notes) {
      throw new ApiError(400, 'Notes content is required');
    }

    const dispute = await disputeService.addAdminNotes(
      req.params.id,
      req.user!._id.toString(),
      notes
    );

    res.json({
      success: true,
      data: dispute,
      message: 'Admin notes updated successfully',
    });
  })
);

// ============================================
// APPEAL ROUTES
// ============================================

/**
 * @route   POST /api/disputes/:id/appeal
 * @desc    Submit appeal for a resolved dispute
 * @access  Private (Dispute parties only)
 */
router.post(
  '/:id/appeal',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body as { reason: string };

    if (!reason) {
      throw new ApiError(400, 'Appeal reason is required');
    }

    // Verify user is party to dispute
    await disputeService.verifyDisputeAccess(
      req.params.id,
      req.user!._id.toString(),
      { allowAdmin: false, allowParties: true }
    );

    const dispute = await disputeService.submitAppeal({
      disputeId: req.params.id,
      reason,
      submittedBy: req.user!._id.toString(),
    });

    res.json({
      success: true,
      data: dispute,
      message: 'Appeal submitted successfully',
    });
  })
);

/**
 * @route   GET /api/admin/disputes/appeals
 * @desc    List pending appeals
 * @access  Private (Admin only)
 */
router.get(
  '/admin/appeals',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await disputeService.getPendingAppeals(page, limit);

    res.json({
      success: true,
      data: result.disputes,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   POST /api/admin/disputes/:id/appeal-review
 * @desc    Review appeal (approve/reject)
 * @access  Private (Admin only)
 */
router.post(
  '/admin/:id/appeal-review',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { action, reviewNotes } = req.body as { action: 'approve' | 'reject'; reviewNotes?: string };

    if (!action || !['approve', 'reject'].includes(action)) {
      throw new ApiError(400, 'Action must be "approve" or "reject"');
    }

    const dispute = await disputeService.reviewAppeal({
      disputeId: req.params.id,
      action,
      reviewNotes,
      reviewedBy: req.user!._id.toString(),
    });

    res.json({
      success: true,
      data: dispute,
      message: `Appeal ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  })
);

// ============================================
// REFUND ROUTES
// ============================================

/**
 * @route   POST /api/disputes/refunds
 * @desc    Create a refund request
 * @access  Private (Customer only)
 */
router.post(
  '/refunds',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { bookingId, amount, reason, description, type, disputeId } = req.body as CreateRefundDTO;

    if (!bookingId || !reason) {
      throw new ApiError(400, 'Booking ID and reason are required');
    }

    // Only customers can create refund requests
    if (req.user!.role !== 'customer') {
      throw new ApiError(403, 'Only customers can request refunds');
    }

    const refund = await refundService.createRefundRequest({
      bookingId,
      requestedBy: req.user!._id.toString(),
      amount,
      reason,
      description,
      type,
      disputeId,
    });

    // Check if refund should be auto-escalated
    const escalationResult = await escalationService.checkRefundEscalation(refund._id.toString());
    if (escalationResult.shouldEscalate) {
      // Escalate asynchronously to not block the response
      escalationService.escalateRefund(refund._id.toString(), escalationResult.triggers).catch(err => {
        logger.error('Auto-escalation failed', {
          refundId: refund._id.toString(),
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    res.status(201).json({
      success: true,
      data: refund,
      message: escalationResult.shouldEscalate
        ? 'Refund request created successfully. It has been escalated for priority review.'
        : 'Refund request created successfully',
    });
  })
);

/**
 * @route   GET /api/disputes/refunds
 * @desc    List refund requests
 * @access  Private (Admin only)
 */
router.get(
  '/refunds',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status as any,
      type: req.query.type as any,
      bookingId: req.query.bookingId as string,
      disputeId: req.query.disputeId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      minAmount: parseFloat(req.query.minAmount as string),
      maxAmount: parseFloat(req.query.maxAmount as string),
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await refundService.listRefunds(filters);

    res.json({
      success: true,
      data: result.refunds,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/disputes/refunds/stats
 * @desc    Get refund statistics
 * @access  Private (Admin only)
 */
router.get(
  '/refunds/stats',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await refundService.getRefundStats(
      req.query.startDate as string,
      req.query.endDate as string
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route   GET /api/disputes/refunds/pending
 * @desc    Get pending refunds
 * @access  Private (Admin only)
 */
router.get(
  '/refunds/pending',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const refunds = await refundService.getPendingRefunds(limit);

    res.json({
      success: true,
      data: refunds,
    });
  })
);

/**
 * @route   GET /api/disputes/refunds/my
 * @desc    Get current user's refund requests
 * @access  Private
 */
router.get(
  '/refunds/my',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status as any,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await refundService.getRefundsByUser(req.user!._id.toString(), filters);

    res.json({
      success: true,
      data: result.refunds,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/disputes/refunds/:id
 * @desc    Get refund by ID
 * @access  Private
 */
router.get(
  '/refunds/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const refund = await refundService.getRefundById(
      req.params.id,
      req.user!._id.toString(),
      req.user!.role
    );

    res.json({
      success: true,
      data: refund,
    });
  })
);

/**
 * @route   GET /api/disputes/refunds/booking/:bookingId
 * @desc    Get refunds by booking ID
 * @access  Private
 */
router.get(
  '/refunds/booking/:bookingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const refunds = await refundService.getRefundsByBooking(req.params.bookingId);

    res.json({
      success: true,
      data: refunds,
    });
  })
);

/**
 * @route   POST /api/disputes/refunds/:id/process
 * @desc    Process refund (approve/reject)
 * @access  Private (Admin only)
 */
router.post(
  '/refunds/:id/process',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { action, amount, notes, rejectionReason } = req.body as Omit<ProcessRefundDTO, 'refundId' | 'processedBy'>;

    if (!action || !['approve', 'reject'].includes(action)) {
      throw new ApiError(400, 'Action must be "approve" or "reject"');
    }

    if (action === 'reject' && !rejectionReason) {
      throw new ApiError(400, 'Rejection reason is required when rejecting');
    }

    const refund = await refundService.processRefund({
      refundId: req.params.id,
      action,
      processedBy: req.user!._id.toString(),
      amount,
      notes,
      rejectionReason,
    });

    res.json({
      success: true,
      data: refund,
      message: `Refund ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  })
);

/**
 * @route   POST /api/disputes/refunds/:id/cancel
 * @desc    Cancel refund request
 * @access  Private
 */
router.post(
  '/refunds/:id/cancel',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const refund = await refundService.cancelRefundRequest(
      req.params.id,
      req.user!._id.toString()
    );

    res.json({
      success: true,
      data: refund,
      message: 'Refund cancelled successfully',
    });
  })
);

export default router;
