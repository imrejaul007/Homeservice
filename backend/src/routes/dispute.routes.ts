import express, { Request, Response, NextFunction } from 'express';
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
} from '../services/dispute.service';
import { refundService, CreateRefundDTO, ProcessRefundDTO } from '../services/refund.service';
import { cache } from '../config/redis';
import logger from '../utils/logger';

const router = express.Router();

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

    res.status(201).json({
      success: true,
      data: { dispute },
      message: 'Dispute created successfully',
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
 */
router.get(
  '/my/:disputeId',
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
 */
router.post(
  '/:id/evidence',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, url, description } = req.body;

    if (!type) {
      throw new ApiError(400, 'Evidence type is required');
    }

    const dispute = await disputeService.addEvidence({
      disputeId: req.params.id,
      userId: req.user!._id.toString(),
      type,
      url,
      description,
    });

    res.json({
      success: true,
      data: dispute,
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
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      throw new ApiError(400, 'Message content is required');
    }

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
  asyncHandler(async (req: Request, res: Response) => {
    const { status, reason } = req.body;

    if (!status) {
      throw new ApiError(400, 'Status is required');
    }

    const validStatuses = ['open', 'under_review', 'resolved', 'escalated', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const dispute = await disputeService.updateStatus(
      req.params.id,
      req.user!._id.toString(),
      status,
      reason
    );

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
  asyncHandler(async (req: Request, res: Response) => {
    const { resolutionType, amount, reason, notes } = req.body as Omit<ResolveDisputeDTO, 'disputeId' | 'resolvedBy'>;

    if (!resolutionType || !reason) {
      throw new ApiError(400, 'Resolution type and reason are required');
    }

    const validTypes = ['refund', 'partial_refund', 'no_action', 'provider_warning', 'provider_suspended'];
    if (!validTypes.includes(resolutionType)) {
      throw new ApiError(400, `Invalid resolution type. Must be one of: ${validTypes.join(', ')}`);
    }

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

    res.status(201).json({
      success: true,
      data: refund,
      message: 'Refund request created successfully',
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

// ============================================
// WEBHOOK ROUTES
// ============================================

/**
 * @route   POST /api/disputes/webhooks/stripe
 * @desc    Handle Stripe webhooks
 * @access  Public (with signature verification)
 */
router.post(
  '/webhooks/stripe',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new ApiError(400, 'Missing Stripe signature');
    }

    // Verify webhook signature
    const stripe = await import('stripe');
    const stripeInstance = new stripe.default(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16' as any,
    });

    let event: any;

    try {
      event = stripeInstance.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      logger.error('Stripe webhook signature verification failed', {
        error: err.message,
        action: 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED',
      });
      throw new ApiError(400, 'Invalid Stripe signature');
    }

    // Idempotency check using Redis
    const eventKey = `webhook:processed:${event.id}`;
    const alreadyProcessed = await cache.get(eventKey);
    if (alreadyProcessed) {
      logger.info('Stripe webhook event already processed, skipping', {
        eventId: event.id,
        eventType: event.type,
        action: 'WEBHOOK_IDEMPOTENT_SKIP',
      });
      return res.json({ received: true, duplicate: true });
    }

    // Handle refund events
    if (event.type === 'charge.refunded') {
      await refundService.handleStripeWebhook(event);
    }

    // Mark event as processed with 24 hour TTL
    await cache.set(eventKey, JSON.stringify({ processed: true, timestamp: Date.now() }), 86400);

    logger.info('Stripe webhook processed successfully', {
      eventId: event.id,
      eventType: event.type,
      action: 'WEBHOOK_PROCESSED',
    });

    return res.json({ received: true });
  })
);

export default router;
