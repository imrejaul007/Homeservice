import { Router, Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';
import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import { escapeRegex } from '../utils/formatBookingListItem';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const sendMessageSchema = Joi.object({
  receiverId: Joi.string().required().hex().length(24).messages({
    'string.hex': 'Receiver ID must be a valid hex string',
    'string.length': 'Receiver ID must be 24 characters',
    'any.required': 'Receiver ID is required'
  }),
  content: Joi.string().max(5000).allow('').optional(),
  type: Joi.string().valid('text', 'image', 'file', 'system').default('text'),
  bookingId: Joi.string().hex().length(24).optional(),
  replyTo: Joi.string().hex().length(24).optional(),
  attachments: Joi.array().items(
    Joi.object({
      url: Joi.string().required(),
      filename: Joi.string().required(),
      mimeType: Joi.string().required(),
      size: Joi.number().positive().required(),
      thumbnailUrl: Joi.string().optional()
    })
  ).max(10).optional()
});

const getMessagesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  before: Joi.date().iso().optional(),
  after: Joi.date().iso().optional(),
  includeDeleted: Joi.boolean().default(false)
});

const markReadSchema = Joi.object({
  messageIds: Joi.array().items(
    Joi.string().hex().length(24)
  ).optional()
});

const createRoomSchema = Joi.object({
  type: Joi.string().valid('direct', 'booking', 'support').required(),
  participantIds: Joi.array().items(
    Joi.string().hex().length(24)
  ).min(1).required(),
  name: Joi.string().max(100).optional(),
  bookingId: Joi.string().hex().length(24).optional()
});

// =============================================================================
// Middleware: Validate ObjectId
// =============================================================================

const validateObjectId = (paramName: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ${paramName} format`);
    }
    next();
  };
};

// =============================================================================
// Middleware: Validate Message Content Length
// =============================================================================

// Maximum content length for messages (in characters)
const MAX_CONTENT_LENGTH = 5000;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per attachment

const validateMessageContent = (req: Request, _res: Response, next: NextFunction) => {
  const { content, attachments } = req.body;

  // Validate content length
  if (content && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
    throw new ApiError(400, `Message content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
  }

  // Validate attachments
  if (attachments && Array.isArray(attachments)) {
    if (attachments.length > 10) {
      throw new ApiError(400, 'Maximum 10 attachments allowed per message');
    }

    for (const attachment of attachments) {
      if (attachment.size && attachment.size > MAX_ATTACHMENT_SIZE) {
        throw new ApiError(400, `Attachment "${attachment.filename}" exceeds maximum size of 10MB`);
      }
    }
  }

  next();
};

// =============================================================================
// Chat Room Routes
// =============================================================================

/**
 * GET /api/chat/rooms
 * Get all chat rooms for the authenticated user
 */
router.get(
  '/rooms',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();

    const {
      status = 'active',
      type,
      limit = '20',
      skip = '0'
    } = req.query;

    const result = await chatService.getChatRooms(userId, {
      status: status as 'active' | 'archived' | 'blocked',
      type: type as 'direct' | 'booking' | 'support' | undefined,
      limit: parseInt(limit as string, 10),
      skip: parseInt(skip as string, 10)
    });

    res.json({
      success: true,
      data: {
        rooms: result.rooms,
        total: result.total
      }
    });
  })
);

/**
 * POST /api/chat/rooms
 * Create a new chat room
 */
router.post(
  '/rooms',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();

    // Validate request body
    const { error, value } = createRoomSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    const chatRoom = await chatService.createChatRoom(
      userId,
      value.type,
      value.participantIds,
      {
        name: value.name,
        bookingId: value.bookingId
      }
    );

    res.status(201).json({
      success: true,
      data: { chatRoom }
    });
  })
);

/**
 * GET /api/chat/rooms/:id
 * Get a specific chat room
 */
router.get(
  '/rooms/:id',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    // Get the room
    const { rooms } = await chatService.getChatRooms(userId, {
      limit: 1
    });

    const chatRoom = rooms.find(r => r._id.toString() === id);

    if (!chatRoom) {
      throw new ApiError(404, 'Chat room not found');
    }

    res.json({
      success: true,
      data: { chatRoom }
    });
  })
);

/**
 * DELETE /api/chat/rooms/:id
 * Delete (soft delete) a chat room
 */
router.delete(
  '/rooms/:id',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    await chatService.deleteChatRoom(id, userId);

    res.json({
      success: true,
      message: 'Chat room deleted successfully'
    });
  })
);

/**
 * PATCH /api/chat/rooms/:id/archive
 * Archive a chat room
 */
router.patch(
  '/rooms/:id/archive',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    await chatService.archiveChatRoom(id, userId);

    res.json({
      success: true,
      message: 'Chat room archived successfully'
    });
  })
);

/**
 * POST /api/chat/rooms/direct
 * Get or create a direct chat room with another user
 */
router.post(
  '/rooms/direct',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();

    const { participantId } = req.body;

    if (!participantId || !mongoose.Types.ObjectId.isValid(participantId)) {
      throw new ApiError(400, 'Valid participant ID is required');
    }

    const chatRoom = await chatService.getOrCreateDirectChat(userId, participantId);

    res.status(201).json({
      success: true,
      data: { chatRoom }
    });
  })
);

/**
 * POST /api/chat/rooms/booking
 * Get or create a booking-related chat room
 * CRITICAL: Verifies user is the customer, provider, or admin before creating room
 */
router.post(
  '/rooms/booking',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const userRole = req.user!.role;
    const { bookingId, customerId, providerId } = req.body;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ApiError(400, 'Valid booking ID is required');
    }

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      throw new ApiError(400, 'Valid customer ID is required');
    }

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Valid provider ID is required');
    }

    // IDOR Protection: Fetch booking and verify user relationship
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Verify user is the customer OR provider OR admin
    const isCustomer = booking.customerId?.toString() === userId;
    const isProvider = booking.providerId?.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to access this booking');
    }

    // Verify the provided customerId/providerId match the booking's actual IDs
    if (booking.customerId?.toString() !== customerId) {
      throw new ApiError(400, 'Customer ID does not match booking');
    }

    if (booking.providerId?.toString() !== providerId) {
      throw new ApiError(400, 'Provider ID does not match booking');
    }

    const chatRoom = await chatService.getOrCreateBookingChat(
      bookingId,
      customerId,
      providerId
    );

    res.status(201).json({
      success: true,
      data: { chatRoom }
    });
  })
);

// =============================================================================
// Message Routes
// =============================================================================

/**
 * GET /api/chat/rooms/:id/messages
 * Get messages for a chat room
 */
router.get(
  '/rooms/:id/messages',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    // Validate query params
    const { error, value } = getMessagesSchema.validate(req.query, {
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    const result = await chatService.getMessages(id, userId, {
      limit: value.limit,
      before: value.before ? new Date(value.before) : undefined,
      after: value.after ? new Date(value.after) : undefined,
      includeDeleted: value.includeDeleted
    });

    res.json({
      success: true,
      data: {
        messages: result.messages,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor
      }
    });
  })
);

/**
 * POST /api/chat/rooms/:id/messages
 * Send a message to a chat room
 */
router.post(
  '/rooms/:id/messages',
  authenticate,
  validateObjectId('id'),
  validateMessageContent,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    // Validate request body
    const { error, value } = sendMessageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    // Validate content for text messages
    if (value.type === 'text' && (!value.content || !value.content.trim())) {
      throw new ApiError(400, 'Message content is required for text messages');
    }

    const message = await chatService.sendMessage({
      chatRoomId: id,
      senderId: userId,
      receiverId: value.receiverId,
      content: value.content || '',
      type: value.type,
      bookingId: value.bookingId,
      replyTo: value.replyTo,
      attachments: value.attachments,
      metadata: {
        deviceType: req.headers['x-device-type'] as 'mobile' | 'desktop' | 'tablet' | undefined,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(201).json({
      success: true,
      data: { message }
    });
  })
);

/**
 * PATCH /api/chat/messages/read
 * Mark messages as read (by message IDs)
 */
router.patch(
  '/messages/read',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      throw new ApiError(400, 'Message IDs are required');
    }

    // Validate all message IDs
    for (const id of messageIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid message ID: ${id}`);
      }
    }

    // Get the message to find the chat room
    const { rooms } = await chatService.getChatRooms(userId, { limit: 100 });

    // Find the chat room containing this message
    let chatRoomId: string | null = null;
    for (const room of rooms) {
      const roomId = room._id.toString();
      const { messages } = await chatService.getMessages(
        roomId,
        userId,
        { limit: 1000 }
      );
      if (messages.some(m => m._id.toString() === messageIds[0])) {
        chatRoomId = roomId;
        break;
      }
    }

    if (!chatRoomId) {
      throw new ApiError(404, 'Message not found');
    }

    const count = await chatService.markMessagesAsRead(chatRoomId, userId, messageIds);

    res.json({
      success: true,
      data: { markedCount: count }
    });
  })
);

/**
 * PATCH /api/chat/rooms/:id/read
 * Mark all messages in a chat room as read
 */
router.patch(
  '/rooms/:id/read',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    // Validate query params
    const { error, value } = markReadSchema.validate(req.query, {
      stripUnknown: true
    });

    if (error) {
      throw new ApiError(400, error.details.map(d => d.message).join('; '));
    }

    const count = await chatService.markMessagesAsRead(
      id,
      userId,
      value.messageIds
    );

    res.json({
      success: true,
      data: { markedCount: count }
    });
  })
);

/**
 * DELETE /api/chat/messages/:id
 * Delete a message
 */
router.delete(
  '/messages/:id',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    await chatService.deleteMessage(id, userId);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  })
);

// =============================================================================
// Unread Count Routes
// =============================================================================

/**
 * GET /api/chat/rooms/:id/unread
 * Get unread count for a chat room
 */
router.get(
  '/rooms/:id/unread',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    const count = await chatService.getUnreadCount(id, userId);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  })
);

/**
 * GET /api/chat/unread
 * Get total unread count for all chat rooms
 */
router.get(
  '/unread',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();

    const count = await chatService.getTotalUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  })
);

// =============================================================================
// Search Routes
// =============================================================================

/**
 * GET /api/chat/rooms/:id/search
 * Search messages within a chat room
 */
router.get(
  '/rooms/:id/search',
  authenticate,
  validateObjectId('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const { query, limit = '50', page = '1' } = req.query;

    if (!query || typeof query !== 'string') {
      throw new ApiError(400, 'Search query is required');
    }

    // Validate search query length
    if (query.length > 200) {
      throw new ApiError(400, 'Search query exceeds maximum length of 200 characters');
    }

    // Verify user has access to this chat room
    const { rooms } = await chatService.getChatRooms(userId, { limit: 1 });
    const hasAccess = rooms.some(r => r._id.toString() === id);

    if (!hasAccess) {
      throw new ApiError(403, 'Access denied to this chat room');
    }

    // Search messages
    const Message = (await import('../models/message.model')).default;
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const pageNum = Math.max(parseInt(page as string, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    const searchResults = await Message.find({
      chatRoomId: new mongoose.Types.ObjectId(id),
      isDeleted: false,
      type: 'text',
      content: { $regex: escapeRegex(query), $options: 'i' }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('senderId', 'firstName lastName avatar role')
      .lean();

    const total = await Message.countDocuments({
      chatRoomId: new mongoose.Types.ObjectId(id),
      isDeleted: false,
      type: 'text',
      content: { $regex: escapeRegex(query), $options: 'i' }
    });

    res.json({
      success: true,
      data: {
        messages: searchResults,
        total,
        page: pageNum,
        limit: limitNum,
        hasMore: skip + searchResults.length < total
      }
    });
  })
);

// =============================================================================
// Export
// =============================================================================

export default router;
