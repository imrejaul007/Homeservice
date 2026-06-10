import { Router, Request, Response, NextFunction } from 'express';
import { liveChatService } from '../services/liveChat.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';
import mongoose from 'mongoose';

const router = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const startSessionSchema = Joi.object({
  initialMessage: Joi.string().max(2000).optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
  tags: Joi.array().items(Joi.string().max(50)).max(10).default([])
});

const sendMessageSchema = Joi.object({
  content: Joi.string().max(5000).required(),
  type: Joi.string().valid('text', 'image', 'file').default('text'),
  attachments: Joi.array().items(
    Joi.object({
      url: Joi.string().required(),
      filename: Joi.string().required(),
      mimeType: Joi.string().required(),
      size: Joi.number().positive().required()
    })
  ).max(10).optional()
});

const rateSessionSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  feedback: Joi.string().max(1000).optional()
});

const transferSessionSchema = Joi.object({
  toAgentId: Joi.string().hex().length(24).optional(),
  reason: Joi.string().max(500).optional()
});

// ============================================
// MIDDLEWARE: VALIDATE OBJECT ID
// ============================================

const validateObjectId = (paramName: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ${paramName} format`);
    }
    next();
  };
};

// ============================================
// SESSION ROUTES
// ============================================

/**
 * POST /api/support/chat/start
 * Start a new chat session
 */
router.post(
  '/start',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const userName = `${req.user!.firstName} ${req.user!.lastName}`;
    const userEmail = req.user!.email || '';

    const { error, value } = startSessionSchema.validate(req.body, {
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    const result = await liveChatService.startSession(
      userId,
      userName,
      userEmail,
      value.initialMessage,
      value.priority,
      value.tags
    );

    res.status(201).json({
      success: true,
      data: {
        sessionId: result.session.sessionId,
        chatRoomId: result.chatRoomId,
        status: result.session.status,
        queuePosition: result.session.queuePosition,
        estimatedWaitTime: result.session.estimatedWaitTime,
        agentName: result.session.agentName
      }
    });
  })
);

// ============================================
// STATIC ROUTES (must be before /:sessionId)
// ============================================

router.get(
  '/agents/available',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const agents = await liveChatService.getAvailableAgents();
    res.json({ success: true, data: agents });
  })
);

router.patch(
  '/agents/status',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.user!._id.toString();
    const { status } = req.body;
    if (!['available', 'busy', 'away', 'offline'].includes(status)) {
      throw new ApiError(400, 'Invalid status');
    }
    await liveChatService.setAgentStatus(agentId, status);
    res.json({ success: true, message: 'Agent status updated' });
  })
);

router.get(
  '/queue/status',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const status = await liveChatService.getQueueStatus();
    res.json({ success: true, data: status });
  })
);

router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { limit = '20', offset = '0' } = req.query;
    const result = await liveChatService.getChatHistory(
      userId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    res.json({ success: true, data: { sessions: result.sessions, total: result.total } });
  })
);

router.get(
  '/stats',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await liveChatService.getStats();
    res.json({ success: true, data: stats });
  })
);

// ============================================
// SESSION ROUTES (parameterized)
// ============================================

/**
 * GET /api/support/chat/:sessionId
 * Get chat session details
 */
router.get(
  '/:sessionId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!._id.toString();

    const session = await liveChatService.getSession(sessionId);

    if (!session) {
      throw new ApiError(404, 'Chat session not found');
    }

    res.json({
      success: true,
      data: session
    });
  })
);

/**
 * POST /api/support/chat/:sessionId/message
 * Send a message in the chat
 */
router.post(
  '/:sessionId/message',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!._id.toString();
    const userName = `${req.user!.firstName} ${req.user!.lastName}`;
    const userRole = req.user!.role as 'customer' | 'admin';

    const { error, value } = sendMessageSchema.validate(req.body, {
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    // Get the chat room for this session
    const history = await liveChatService.getChatHistory(userId, 1, 0);
    const sessionData = history.sessions.find(s => s.sessionId === sessionId);

    if (!sessionData) {
      throw new ApiError(404, 'Chat session not found');
    }

    const message = await liveChatService.addMessage(
      sessionData._id!.toString(),
      sessionId,
      userId,
      userRole === 'admin' ? 'agent' : 'customer',
      userName,
      value.content,
      value.type,
      value.attachments
    );

    res.status(201).json({
      success: true,
      data: message
    });
  })
);

/**
 * GET /api/support/chat/:sessionId/messages
 * Get messages for a chat session
 */
router.get(
  '/:sessionId/messages',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!._id.toString();
    const { limit = '50', before } = req.query;

    // Find the chat room
    const history = await liveChatService.getChatHistory(userId, 1, 0);
    const sessionData = history.sessions.find(s => s.sessionId === sessionId);

    if (!sessionData) {
      throw new ApiError(404, 'Chat session not found');
    }

    const beforeDate = before ? new Date(before as string) : undefined;
    const result = await liveChatService.getMessages(
      sessionData._id!.toString(),
      userId,
      parseInt(limit as string, 10),
      beforeDate
    );

    res.json({
      success: true,
      data: {
        messages: result.messages,
        hasMore: result.hasMore
      }
    });
  })
);

/**
 * POST /api/support/chat/:sessionId/end
 * End a chat session
 */
router.post(
  '/:sessionId/end',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!._id.toString();
    const userRole = req.user!.role as 'customer' | 'admin';

    const session = await liveChatService.endSession(
      sessionId,
      userId,
      userRole === 'admin' ? 'agent' : 'customer'
    );

    res.json({
      success: true,
      data: session,
      message: 'Chat session ended successfully'
    });
  })
);

/**
 * POST /api/support/chat/:sessionId/transfer
 * Transfer chat to another agent
 */
router.post(
  '/:sessionId/transfer',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const agentId = req.user!._id.toString();

    const { error, value } = transferSessionSchema.validate(req.body, {
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    const result = await liveChatService.transferSession(
      sessionId,
      agentId,
      value.toAgentId,
      value.reason
    );

    res.json({
      success: true,
      data: result,
      message: result.newAgentName
        ? `Chat transferred to ${result.newAgentName}`
        : 'Chat transferred to queue'
    });
  })
);

/**
 * POST /api/support/chat/:sessionId/rate
 * Rate a chat session
 */
router.post(
  '/:sessionId/rate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const { error, value } = rateSessionSchema.validate(req.body, {
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    await liveChatService.rateSession(sessionId, value.rating, value.feedback);

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });
  })
);

/**
 * GET /api/support/chat/:sessionId/read
 * Mark messages as read
 */
router.get(
  '/:sessionId/read',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!._id.toString();

    // Find the chat room
    const history = await liveChatService.getChatHistory(userId, 1, 0);
    const sessionData = history.sessions.find(s => s.sessionId === sessionId);

    if (!sessionData) {
      throw new ApiError(404, 'Chat session not found');
    }

    const count = await liveChatService.markAsRead(
      sessionData._id!.toString(),
      userId
    );

    res.json({
      success: true,
      data: { markedCount: count }
    });
  })
);

export default router;
