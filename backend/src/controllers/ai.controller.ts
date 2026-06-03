import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';
import logger from '../utils/logger';

const chatSchema = Joi.object({
  message: Joi.string().required().min(1).max(2000),
  context: Joi.object({
    currentPage: Joi.string(),
    bookingId: Joi.string(),
    serviceId: Joi.string(),
  }),
  conversationId: Joi.string(),
});

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  userId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for conversations (use Redis/DB in production)
const conversations = new Map<string, Conversation>();

// Generate a simple response based on user message
function generateAIResponse(message: string, context?: unknown): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('booking') || lowerMessage.includes('appointment')) {
    return "I can help you with bookings! You can browse services, select a provider, and book an appointment. Would you like me to show you available services?";
  }

  if (lowerMessage.includes('cancel')) {
    return "To cancel a booking, go to your bookings page and select the booking you want to cancel. You'll see a 'Cancel' option if it's still within the cancellation policy. Need help finding your bookings?";
  }

  if (lowerMessage.includes('payment') || lowerMessage.includes('refund')) {
    return "For payment issues or refund inquiries, I recommend checking your wallet in the app. If you need further assistance, our support team is available 24/7.";
  }

  if (lowerMessage.includes('provider') || lowerMessage.includes('stylist')) {
    return "All our providers are verified professionals. You can view ratings, reviews, and specialties on each provider's profile. Would you like recommendations based on your preferences?";
  }

  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('charge')) {
    return "Prices vary by service and provider. You can see the exact price on each service page. We also offer periodic discounts and promotions!";
  }

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return "Hello! I'm your NILIN assistant. I can help you with bookings, payments, finding providers, and answering questions about our services. How can I help you today?";
  }

  if (lowerMessage.includes('contact') || lowerMessage.includes('support')) {
    return "You can reach our support team via:\nPhone: Available in Settings > Help (24/7)\nEmail: support@nilin.com\nIn-app chat\nWe're always here to help!";
  }

  // Default response
  return "I'm here to help! I can assist with:\n- Booking appointments\n- Finding providers\n- Managing payments\n- Tracking orders\n- General questions\n\nWhat would you like help with?";
}

export async function chat(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const { error, value } = chatSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { message, context, conversationId } = value;
  const userId = user._id.toString();

  // Get or create conversation
  let conversation: Conversation;
  if (conversationId) {
    const existingConv = conversations.get(conversationId);
    // IDOR protection: only allow access if conversation exists AND belongs to user
    if (existingConv && existingConv.userId === userId) {
      conversation = existingConv;
    } else if (existingConv && existingConv.userId !== userId) {
      // User is trying to access another user's conversation
      // Structured audit event for security team review (issue #10)
      const auditEvent = {
        timestamp: new Date().toISOString(),
        type: 'SECURITY_IDOR_DETECTED',
        severity: 'HIGH',
        context: 'AIController',
        action: 'IDOR_CHAT_ATTEMPT',
        details: {
          attemptedUserId: userId,
          targetConversationId: conversationId,
          conversationOwnerId: existingConv.userId,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          path: req.path,
          method: req.method,
        },
        outcome: 'BLOCKED',
        responseCode: 403,
      };

      // Log both as structured audit event and traditional log
      logger.warn('Security: IDOR Attempt Detected', auditEvent);
      logger.warn('IDOR Attempt: User tried to access another user conversation', {
        context: 'AIController',
        action: 'IDOR_CHAT_ATTEMPT',
        userId,
        conversationId,
        ownerId: existingConv.userId
      });
      throw new ApiError(403, 'Access denied to this conversation');
    } else {
      // Conversation doesn't exist - create new one (ignore invalid conversationId)
      conversation = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        userId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.set(conversation.id, conversation);
    }
  } else {
    // No conversationId provided - create new conversation
    conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    conversations.set(conversation.id, conversation);
  }

  // Add user message
  conversation.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date(),
  });

  // Generate AI response
  const aiResponse = generateAIResponse(message, context);

  // Add assistant message
  conversation.messages.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date(),
  });

  conversation.updatedAt = new Date();

  logger.info('AI Chat', {
    userId,
    conversationId: conversation.id,
    messageLength: message.length,
    action: 'AI_CHAT',
  });

  res.json({
    success: true,
    data: {
      message: aiResponse, // FIX #5 & #20: Changed from 'response' to 'message' to match frontend expectation
      response: aiResponse, // Keep 'response' for backward compatibility
      conversationId: conversation.id,
      messages: conversation.messages,
    },
  });
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const { conversationId } = req.params;
  const userId = user._id.toString();

  const conversation = conversations.get(conversationId);

  if (!conversation || conversation.userId !== userId) {
    throw new ApiError(404, 'Conversation not found');
  }

  res.json({
    success: true,
    data: conversation,
  });
}

export async function getConversations(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const userId = user._id.toString();

  // Issue #4 fix: Add pagination with limit/offset parameters (default: limit=20, offset=0)
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const allUserConversations = Array.from(conversations.values())
    .filter(conv => conv.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const total = allUserConversations.length;
  const userConversations = allUserConversations.slice(offset, offset + limit);

  res.json({
    success: true,
    data: {
      conversations: userConversations,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    }
  });
}

export async function deleteConversation(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const { conversationId } = req.params;
  const userId = user._id.toString();

  const conversation = conversations.get(conversationId);

  if (!conversation || conversation.userId !== userId) {
    throw new ApiError(404, 'Conversation not found');
  }

  conversations.delete(conversationId);

  // Issue #5 fix: Standardize response format to { success: boolean, data: any }
  res.json({
    success: true,
    data: {
      deleted: true,
      conversationId
    }
  });
}

export default {
  chat,
  getConversation,
  getConversations,
  deleteConversation,
};
