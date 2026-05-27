import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
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
function generateAIResponse(message: string, context?: any): string {
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
    return "Hello! 👋 I'm your NILIN assistant. I can help you with bookings, payments, finding providers, and answering questions about our services. How can I help you today?";
  }

  if (lowerMessage.includes('contact') || lowerMessage.includes('support')) {
    return "You can reach our support team via:\n📞 Phone: 1800-XXX-XXXX (24/7)\n📧 Email: support@nilin.com\n💬 In-app chat\nWe're always here to help!";
  }

  // Default response
  return "I'm here to help! I can assist with:\n• Booking appointments\n• Finding providers\n• Managing payments\n• Tracking orders\n• General questions\n\nWhat would you like help with?";
}

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = chatSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { message, context, conversationId } = value;
  const userId = user._id.toString();

  // Get or create conversation
  let conversation: Conversation;
  if (conversationId && conversations.has(conversationId)) {
    conversation = conversations.get(conversationId)!;
  } else {
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
      response: aiResponse,
      conversationId: conversation.id,
      messages: conversation.messages,
    },
  });
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
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
});

export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user._id.toString();

  const userConversations = Array.from(conversations.values())
    .filter(conv => conv.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  res.json({
    success: true,
    data: userConversations,
  });
});

export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { conversationId } = req.params;
  const userId = user._id.toString();

  const conversation = conversations.get(conversationId);

  if (!conversation || conversation.userId !== userId) {
    throw new ApiError(404, 'Conversation not found');
  }

  conversations.delete(conversationId);

  res.json({
    success: true,
    message: 'Conversation deleted',
  });
});

export default {
  chat,
  getConversation,
  getConversations,
  deleteConversation,
};
