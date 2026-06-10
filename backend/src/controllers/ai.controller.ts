import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';
import logger from '../utils/logger';
import mongoose from 'mongoose';
import { IAAgent, IAAgentCategory, IAAgentType, IAAgentStatus } from '../models/iaAgent.model';
import Conversation from '../models/conversation.model';
import {
  aiService,
  AIRequest,
  AIResponse,
  AIResponseStatus,
  NILIN_SYSTEM_PROMPT,
} from '../services/ai.service';

// =============================================================================
// Validation Schemas
// =============================================================================

const chatSchema = Joi.object({
  message: Joi.string().required().min(1).max(2000),
  context: Joi.object({
    currentPage: Joi.string(),
    bookingId: Joi.string(),
    serviceId: Joi.string(),
  }),
  conversationId: Joi.string(),
  agentId: Joi.string(), // Optional: specify which agent to use
  category: Joi.string().valid(...Object.values(IAAgentCategory)), // Category filter
});

const listConversationsSchema = Joi.object({
  status: Joi.string().valid('active', 'closed', 'archived'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

// =============================================================================
// Default System Prompt (uses comprehensive prompt from AI service)
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = NILIN_SYSTEM_PROMPT;

// =============================================================================
// Periodic Cleanup (runs on interval)
// =============================================================================

let cleanupIntervalId: NodeJS.Timeout | null = null;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ARCHIVED_CONVERSATION_RETENTION_DAYS = 90;

/**
 * Start the periodic cleanup of old conversations
 * Call this once when the server starts
 */
export function startConversationCleanup(): void {
  if (cleanupIntervalId) {
    logger.warn('Conversation cleanup is already running', {
      context: 'AIController',
      action: 'START_CLEANUP_ALREADY_RUNNING',
    });
    return;
  }

  cleanupIntervalId = setInterval(async () => {
    try {
      const deletedCount = await Conversation.cleanupOldConversations(
        ARCHIVED_CONVERSATION_RETENTION_DAYS
      );
      if (deletedCount > 0) {
        logger.info('Scheduled conversation cleanup completed', {
          context: 'AIController',
          action: 'SCHEDULED_CLEANUP',
          deletedCount,
        });
      }
    } catch (error) {
      logger.error('Scheduled conversation cleanup failed', {
        context: 'AIController',
        action: 'SCHEDULED_CLEANUP_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, CLEANUP_INTERVAL_MS);

  logger.info('Conversation cleanup scheduler started', {
    context: 'AIController',
    action: 'START_CLEANUP',
    intervalMs: CLEANUP_INTERVAL_MS,
    retentionDays: ARCHIVED_CONVERSATION_RETENTION_DAYS,
  });
}

/**
 * Stop the periodic cleanup
 */
export function stopConversationCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('Conversation cleanup scheduler stopped', {
      context: 'AIController',
      action: 'STOP_CLEANUP',
    });
  }
}

// =============================================================================
// Agent Selection
// =============================================================================

/**
 * Find the best matching deployed agent for the given category/context
 */
async function findBestAgent(category?: string): Promise<{ agent: any; name: string } | null> {
  try {
    const filter: Record<string, unknown> = {
      status: IAAgentStatus.Deployed,
      isActive: true,
    };

    // Prefer agents from the specified category
    if (category && Object.values(IAAgentCategory).includes(category as IAAgentCategory)) {
      filter.category = category;
    }

    // Find a deployed agent
    const agent = await IAAgent.findOne(filter).lean();

    if (agent) {
      return {
        agent: agent as any,
        name: agent.name,
      };
    }

    // Fallback: find any deployed agent
    const anyAgent = await IAAgent.findOne({
      status: IAAgentStatus.Deployed,
      isActive: true,
    }).lean();

    if (anyAgent) {
      return {
        agent: anyAgent as any,
        name: anyAgent.name,
      };
    }

    return null;
  } catch (error) {
    logger.error('Error finding agent:', { error });
    return null;
  }
}

// =============================================================================
// AI Response Generation
// =============================================================================

/**
 * Generate AI response using AI service with circuit breaker and fallback
 */
async function generateAIResponse(
  message: string,
  agent: { instructions: string; configuration: any; knowledgeBase: any[] } | null,
  context?: { currentPage?: string; bookingId?: string; serviceId?: string },
  userId?: string
): Promise<string> {
  const startTime = Date.now();

  // Build the AI request
  const aiRequest: AIRequest = {
    message,
    systemPrompt: agent?.instructions || DEFAULT_SYSTEM_PROMPT,
    configuration: agent?.configuration || {},
    knowledgeBase: agent?.knowledgeBase || [],
    context: {
      ...context,
      userId,
    },
  };

  try {
    // Generate response using AI service (includes circuit breaker and timeout)
    const response = await aiService.generateResponse(aiRequest);

    // Log AI response metrics
    logger.info('AI Response Generated', {
      userId,
      status: response.status,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      tokensUsed: response.tokensUsed,
      responseStatus: response.status,
      action: 'AI_RESPONSE',
 });

    // Return the content
    return response.content;
  } catch (error) {
    // Log the error
    logger.error('AI Service Error', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
      action: 'AI_ERROR',
    });

    // Return rule-based fallback as ultimate fallback
    return getRuleBasedResponse(message, agent?.knowledgeBase || []);
  }
}

/**
 * Rule-based fallback responses (ultimate fallback when AI fails)
 */
function getRuleBasedResponse(
  message: string,
  knowledgeBase: any[]
): string {
  const lowerMessage = message.toLowerCase();

  // Check knowledge base first
  if (knowledgeBase.length > 0) {
    for (const entry of knowledgeBase) {
      const entryText = `${entry.title} ${entry.content}`.toLowerCase();
      if (lowerMessage.split(' ').some(word => word.length > 4 && entryText.includes(word))) {
        return entry.content;
      }
    }
  }

  // Rule-based fallback responses
  if (lowerMessage.includes('booking') || lowerMessage.includes('appointment')) {
    return "I can help you with bookings! You can browse services on our Packages page, select a provider, and book an appointment. Would you like me to show you available services?";
  }

  if (lowerMessage.includes('cancel')) {
    return "To cancel a booking, go to your bookings page and select the booking you want to cancel. You'll see a 'Cancel' option if it's still within the cancellation policy. Need help finding your bookings?";
  }

  if (lowerMessage.includes('payment') || lowerMessage.includes('refund') || lowerMessage.includes('price')) {
    return "For payment issues or refund inquiries, I recommend checking your wallet in the app. If you need further assistance, our support team is available 24/7.";
  }

  if (lowerMessage.includes('provider') || lowerMessage.includes('stylist') || lowerMessage.includes('salon')) {
    return "All our providers are verified professionals. You can view ratings, reviews, and specialties on each provider's profile. Would you like recommendations based on your preferences?";
  }

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return "Hello! I'm your NILIN assistant. I can help you with bookings, payments, finding providers, and answering questions about our services. How can I help you today?";
  }

  if (lowerMessage.includes('contact') || lowerMessage.includes('support')) {
    return "You can reach our support team via:\n- Phone: Available in Settings > Help (24/7)\n- Email: support@nilin.com\n- In-app chat\nWe're always here to help!";
  }

  if (lowerMessage.includes('package') || lowerMessage.includes('bundle') || lowerMessage.includes('deal')) {
    return "We offer various service packages and bundles! You can browse our Packages section to find great deals on combinations of services. Would you like me to help you find a package that suits your needs?";
  }

  if (lowerMessage.includes('track') || lowerMessage.includes('status') || lowerMessage.includes('where')) {
    return "You can track your booking status by going to /track and entering your booking number. You'll see real-time updates on your service status.";
  }

  // Default response
  return "I'm here to help! I can assist with:\n- Booking appointments\n- Finding providers\n- Managing payments\n- Tracking orders\n- General questions\n\nWhat would you like help with?";
}

// =============================================================================
// Controller Functions
// =============================================================================

/**
 * Send a chat message and get AI response
 */
export async function chat(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const { error, value } = chatSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { message, context, conversationId, agentId, category } = value;
  const userId = user._id.toString();

  // Find the agent to use
  let selectedAgent: { agent: any; name: string } | null = null;

  if (agentId) {
    // Use specified agent if valid and deployed
    const agent = await IAAgent.findOne({ _id: agentId, status: IAAgentStatus.Deployed, isActive: true }).lean();
    if (agent) {
      selectedAgent = { agent, name: agent.name };
    }
  }

  if (!selectedAgent) {
    // Find best matching agent by category
    selectedAgent = await findBestAgent(category);
  }

  // Get or create conversation
  let conversation;

  if (conversationId) {
    // Validate conversationId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      // Invalid format - treat as new conversation
      conversation = await Conversation.create({
        userId: new mongoose.Types.ObjectId(userId),
        agentId: selectedAgent?.agent._id ? new mongoose.Types.ObjectId(selectedAgent.agent._id) : undefined,
        agentCategory: selectedAgent?.agent.category,
        messages: [],
        metadata: {
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          deviceType: getDeviceType(req.get('User-Agent') || ''),
          context: context || undefined,
        },
      });
    } else {
      // Try to find existing conversation
      conversation = await Conversation.findOne({
        _id: new mongoose.Types.ObjectId(conversationId),
      });

      if (conversation) {
        // IDOR protection: verify ownership
        if (conversation.userId.toString() !== userId) {
          // User is trying to access another user's conversation
          const auditEvent = {
            timestamp: new Date().toISOString(),
            type: 'SECURITY_IDOR_DETECTED',
            severity: 'HIGH',
            context: 'AIController',
            action: 'IDOR_CHAT_ATTEMPT',
            details: {
              attemptedUserId: userId,
              targetConversationId: conversationId,
              conversationOwnerId: conversation.userId.toString(),
              ip: req.ip || req.connection.remoteAddress || 'unknown',
              userAgent: req.get('User-Agent') || 'unknown',
              path: req.path,
              method: req.method,
            },
            outcome: 'BLOCKED',
            responseCode: 403,
          };

          logger.warn('Security: IDOR Attempt Detected', auditEvent);
          logger.warn('IDOR Attempt: User tried to access another user conversation', {
            context: 'AIController',
            action: 'IDOR_CHAT_ATTEMPT',
            userId,
            conversationId,
            ownerId: conversation.userId.toString(),
          });
          throw new ApiError(403, 'Access denied to this conversation');
        }

        // Update conversation metadata if context changed
        if (context) {
          conversation.metadata = {
            ...conversation.metadata,
            context: context,
          };
        }
      } else {
        // Conversation doesn't exist - create new one
        conversation = await Conversation.create({
          userId: new mongoose.Types.ObjectId(userId),
          agentId: selectedAgent?.agent._id ? new mongoose.Types.ObjectId(selectedAgent.agent._id) : undefined,
          agentCategory: selectedAgent?.agent.category,
          messages: [],
          metadata: {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            deviceType: getDeviceType(req.get('User-Agent') || ''),
            context: context || undefined,
          },
        });
      }
    }
  } else {
    // No conversationId provided - create new conversation
    conversation = await Conversation.create({
      userId: new mongoose.Types.ObjectId(userId),
      agentId: selectedAgent?.agent._id ? new mongoose.Types.ObjectId(selectedAgent.agent._id) : undefined,
      agentCategory: selectedAgent?.agent.category,
      messages: [],
      metadata: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        deviceType: getDeviceType(req.get('User-Agent') || ''),
        context: context || undefined,
      },
    });
  }

  // Add user message
  conversation.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date(),
  });

  // Generate AI response (pass userId for rate limiting and metrics)
  const aiResponse = await generateAIResponse(
    message,
    selectedAgent?.agent || null,
    context,
    userId
  );

  // Add assistant message
  conversation.messages.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date(),
    agentId: selectedAgent?.agent._id ? new mongoose.Types.ObjectId(selectedAgent.agent._id) : undefined,
    agentName: selectedAgent?.name,
  });

  // Save the conversation
  await conversation.save();

  logger.info('AI Chat', {
    userId,
    conversationId: conversation._id.toString(),
    agentId: selectedAgent?.agent._id?.toString(),
    agentName: selectedAgent?.name,
    messageLength: message.length,
    action: 'AI_CHAT',
  });

  res.json({
    success: true,
    data: {
      message: aiResponse,
      response: aiResponse, // Backward compatibility
      conversationId: conversation._id.toString(),
      messages: conversation.messages,
      agentId: selectedAgent?.agent._id?.toString(),
      agentName: selectedAgent?.name,
    },
  });
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const { conversationId } = req.params;
  const userId = user._id.toString();

  // Validate conversationId format
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, 'Invalid conversation ID format');
  }

  const conversation = await Conversation.findOne({
    _id: new mongoose.Types.ObjectId(conversationId),
  }).lean();

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // IDOR protection: verify ownership
  if (conversation.userId.toString() !== userId) {
    logger.warn('IDOR Attempt: User tried to access another user conversation', {
      context: 'AIController',
      action: 'IDOR_GET_CONVERSATION',
      userId,
      conversationId,
      ownerId: conversation.userId.toString(),
    });
    throw new ApiError(404, 'Conversation not found');
  }

  res.json({
    success: true,
    data: conversation,
  });
}

/**
 * Get all conversations for a user with pagination
 */
export async function getConversations(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const userId = user._id.toString();

  // Parse and validate query parameters
  const { error, value } = listConversationsSchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { status, limit, offset } = value;

  // Get conversations from MongoDB with pagination
  const { conversations, total } = await Conversation.getUserConversations(userId, {
    status: status as any,
    limit,
    offset,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  // Transform for response (lean documents need _id toString conversion)
  const transformedConversations = conversations.map((conv: any) => ({
    _id: conv._id.toString(),
    userId: conv.userId.toString(),
    agentId: conv.agentId?.toString(),
    agentCategory: conv.agentCategory,
    messages: conv.messages.map((msg: any) => ({
      ...msg,
      agentId: msg.agentId?.toString(),
    })),
    status: conv.status,
    metadata: conv.metadata,
    messageCount: conv.messageCount,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  }));

  res.json({
    success: true,
    data: {
      conversations: transformedConversations,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    },
  });
}

/**
 * Delete a conversation
 */
export async function deleteConversation(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const { conversationId } = req.params;
  const userId = user._id.toString();

  // Validate conversationId format
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, 'Invalid conversation ID format');
  }

  // Find conversation to verify ownership
  const conversation = await Conversation.findOne({
    _id: new mongoose.Types.ObjectId(conversationId),
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // IDOR protection: verify ownership
  if (conversation.userId.toString() !== userId) {
    logger.warn('IDOR Attempt: User tried to delete another user conversation', {
      context: 'AIController',
      action: 'IDOR_DELETE_CONVERSATION',
      userId,
      conversationId,
      ownerId: conversation.userId.toString(),
    });
    throw new ApiError(404, 'Conversation not found');
  }

  // Delete the conversation
  await Conversation.deleteOne({ _id: conversation._id });

  logger.info('Conversation deleted', {
    context: 'AIController',
    action: 'DELETE_CONVERSATION',
    userId,
    conversationId,
  });

  res.json({
    success: true,
    data: {
      deleted: true,
      conversationId,
    },
  });
}

/**
 * Get available agents for chat (deployed ones only)
 */
export async function getAvailableAgents(req: Request, res: Response): Promise<void> {
  const { category } = req.query;

  const filter: Record<string, unknown> = {
    status: IAAgentStatus.Deployed,
    isActive: true,
  };

  if (category && Object.values(IAAgentCategory).includes(category as IAAgentCategory)) {
    filter.category = category;
  }

  const agents = await IAAgent.find(filter)
    .select('_id name description category type')
    .lean();

  res.json({
    success: true,
    data: { agents },
  });
}

/**
 * Get conversation statistics for a user
 */
export async function getConversationStats(req: Request, res: Response): Promise<void> {
  const user = (req as unknown as { user: { _id: { toString: () => string } } }).user;
  const userId = user._id.toString();

  const stats = await Conversation.getUserStats(userId);

  res.json({
    success: true,
    data: stats,
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine device type from User-Agent string
 */
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  if (/(android|iphone|ipod|mobile)/i.test(ua)) {
    return 'mobile';
  }
  if (/(tablet|ipad|playbook|silk)/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

// =============================================================================
// Export
// =============================================================================

export default {
  chat,
  getConversation,
  getConversations,
  deleteConversation,
  getAvailableAgents,
  getConversationStats,
  startConversationCleanup,
  stopConversationCleanup,
};
