import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Bot,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Home,
  Book,
  HelpCircle,
  CreditCard,
  Calendar,
  User,
  Settings,
  ShoppingBag,
  RefreshCw,
  Search,
  ArrowRight,
  Zap,
  Package,
  Star,
  MapPin,
  Phone,
  Mail,
  UserPlus,
  HeartHandshake,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { aiChatApi } from '../../services/aiChatApi';
import { chatAnalytics } from '../../services/analyticsService';
import {
  initErrorTracking,
  trackError,
  trackWarning,
  trackAPIError,
  trackMessageSent,
  trackMessageReceived,
  ChatAnalyticsErrorBoundary,
} from '../../lib/errorTracking';

// Initialize error tracking
initErrorTracking({
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV || 'development',
});

// ============================================
// Type Definitions
// ============================================

export type MessageType = 'user' | 'bot' | 'system';
export type QuickActionType = 'link' | 'action' | 'suggestion';

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  actions?: QuickAction[];
  suggestedReplies?: string[];
}

export interface QuickAction {
  id: string;
  type: QuickActionType;
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface BotResponse {
  message: string;
  actions?: QuickAction[];
  suggestedReplies?: string[];
  followUp?: string;
}

export interface AutoChatbotTheme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
}

export interface AutoChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  position?: 'bottom-right' | 'bottom-left';
  welcomeMessage?: string;
  userName?: string;
  context?: Record<string, unknown>;
  onAction?: (action: QuickAction) => Promise<BotResponse>;
  onMessage?: (message: string) => Promise<BotResponse>;
  onHumanTransfer?: () => void;
  onClose?: () => void;
  primaryColor?: string;
  className?: string;
  theme?: AutoChatbotTheme;
}

// ============================================
// Helper Functions (Moved outside component)
// ============================================

const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ============================================
// Quick Action Icons
// ============================================

const ACTION_ICONS: Record<string, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  booking: <Calendar className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  account: <User className="h-4 w-4" />,
  help: <HelpCircle className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  service: <ShoppingBag className="h-4 w-4" />,
  book: <Book className="h-4 w-4" />,
  link: <ExternalLink className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  package: <Package className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  user: <UserPlus className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
};

// ============================================
// Quick Suggestions (Moved outside component)
// ============================================

const QUICK_SUGGESTIONS = [
  { label: 'Book', icon: ACTION_ICONS.booking, message: 'I want to book a service' },
  { label: 'Track', icon: ACTION_ICONS.search, message: 'Track my booking' },
  { label: 'Help', icon: ACTION_ICONS.help, message: 'I need help' },
  { label: 'Services', icon: ACTION_ICONS.service, message: 'Show me services' },
];

// ============================================
// Default Intents / Responses
// ============================================

const DEFAULT_RESPONSES: Record<string, BotResponse> = {
  greeting: {
    message: "Hello! 👋 Welcome to NILIN. I'm your AI assistant here to help you find the perfect beauty service. What can I help you with today?",
    suggestedReplies: ['Browse Services', 'Track Booking', 'Payment Help', 'Talk to Support'],
  },
  booking: {
    message: "Great choice! 🎉 I'd love to help you book a service. You can explore our categories or let me know what you're looking for.",
    actions: [
      { id: 'browse', type: 'link', label: 'Browse All Services', value: '/services', icon: ACTION_ICONS.search },
      { id: 'categories', type: 'action', label: 'View Categories', value: 'categories', icon: ACTION_ICONS.book },
      { id: 'track', type: 'action', label: 'Track My Booking', value: 'track_booking', icon: ACTION_ICONS.booking },
    ],
  },
  payment: {
    message: "💳 I can help you with payment-related questions. Here's what I can assist with:",
    actions: [
      { id: 'methods', type: 'action', label: 'Payment Methods', value: 'payment_methods', icon: ACTION_ICONS.payment },
      { id: 'pricing', type: 'action', label: 'View Pricing', value: 'pricing_info', icon: ACTION_ICONS.star },
      { id: 'refund', type: 'action', label: 'Request Refund', value: 'request_refund', icon: ACTION_ICONS.payment },
    ],
  },
  cancellation: {
    message: "I understand plans change! 📅 Here's what you need to know about cancellations:\n\n• 24+ hours before: Full refund\n• Within 24 hours: Partial refund may apply\n\nWould you like me to help you with your booking?",
    suggestedReplies: ['Cancel Booking', 'Reschedule Instead', 'Contact Support'],
  },
  refund: {
    message: "No worries! 💰 I can help you with a refund request. Refunds typically take 5-7 business days to process.\n\nShall I initiate the refund process for you?",
    actions: [
      { id: 'start_refund', type: 'action', label: 'Start Refund Request', value: 'start_refund', icon: ACTION_ICONS.payment },
      { id: 'check_status', type: 'action', label: 'Check Refund Status', value: 'refund_status', icon: ACTION_ICONS.help },
    ],
  },
  support: {
    message: "I'll connect you with our support team right away! 🎧 Our team is available 24/7 to help you.",
    suggestedReplies: ['Connect to Support', 'I\'ll Try First', 'Leave a Message'],
  },
  categories: {
    message: "Here's what we offer at NILIN! ✨",
    actions: [
      { id: 'hair', type: 'action', label: 'Hair & Styling', value: 'category_hair', icon: ACTION_ICONS.star },
      { id: 'nails', type: 'action', label: 'Nail Art', value: 'category_nails', icon: ACTION_ICONS.package },
      { id: 'skincare', type: 'action', label: 'Skincare', value: 'category_skincare', icon: ACTION_ICONS.user },
      { id: 'massage', type: 'action', label: 'Massage', value: 'category_massage', icon: ACTION_ICONS.home },
    ],
  },
  unknown: {
    message: "I'm not sure I understand that, but I'm here to help! 🤖 Here are some things I can assist you with:",
    actions: [
      { id: 'booking_help', type: 'action', label: 'Booking Help', value: 'booking', icon: ACTION_ICONS.booking },
      { id: 'payment_help', type: 'action', label: 'Payment Help', value: 'payment', icon: ACTION_ICONS.payment },
      { id: 'services', type: 'action', label: 'Browse Services', value: 'categories', icon: ACTION_ICONS.search },
      { id: 'talk_support', type: 'action', label: 'Talk to Support', value: 'support', icon: ACTION_ICONS.help },
    ],
  },
};

// ============================================
// NLU Helper Functions
// ============================================

const analyzeIntent = (message: string): string => {
  const lowerMessage = message.toLowerCase();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|start)/.test(lowerMessage)) {
    return 'greeting';
  }

  if (/book|appointment|schedule|reserve|service|provider|beautician|artist/.test(lowerMessage)) {
    return 'booking';
  }

  if (/pay|payment|refund|money|charge|cost|price|fee|transaction/.test(lowerMessage)) {
    return 'payment';
  }

  if (/cancel|change|reschedule|modify|edit|appointment/.test(lowerMessage)) {
    return 'cancellation';
  }

  if (/refund|money back|reverse|get back/.test(lowerMessage)) {
    return 'refund';
  }

  if (/support|help|human|agent|real person|person|talk|contact/.test(lowerMessage)) {
    return 'support';
  }

  if (/category|categories|browse|show|what.*offer|what.*available|hair|nail|skincare|massage/.test(lowerMessage)) {
    return 'categories';
  }

  return 'unknown';
};

/**
 * Extract suggested replies from AI response
 * Looks for common patterns like numbered lists, bullet points, or question marks
 */
const extractSuggestedReplies = (message: string): string[] | undefined => {
  const suggestions: string[] = [];

  // Look for questions at the end of message
  const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lastSentence = sentences[sentences.length - 1]?.trim() || '';

  if (lastSentence.includes('?')) {
    // Extract key phrases from the question
    const questionWords = ['book', 'track', 'help', 'show', 'find', 'browse', 'contact', 'support'];
    const found = questionWords.filter(word => lastSentence.toLowerCase().includes(word));
    if (found.length > 0) {
      suggestions.push(`Yes, ${found[0]}`);
      suggestions.push('No thanks');
    }
  }

  // Check for common intents
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('booking') || lowerMessage.includes('service')) {
    suggestions.push('Book a service');
  }
  if (lowerMessage.includes('track') || lowerMessage.includes('booking')) {
    suggestions.push('Track my booking');
  }
  if (lowerMessage.includes('payment') || lowerMessage.includes('price')) {
    suggestions.push('Payment help');
  }
  if (lowerMessage.includes('support') || lowerMessage.includes('help')) {
    suggestions.push('Talk to support');
  }

  // Remove duplicates and limit to 4 suggestions
  const uniqueSuggestions = [...new Set(suggestions)].slice(0, 4);
  return uniqueSuggestions.length > 0 ? uniqueSuggestions : undefined;
};

// ============================================
// Typing Indicator Component (Memoized)
// ============================================

const TypingIndicator: React.FC = memo(() => (
  <div className="flex items-center gap-1.5 px-1 py-1">
    <div className="flex gap-1">
      {[0, 150, 300].map((delay) => (
        <div
          key={delay}
          className="w-2 h-2 bg-nilin-warmGray/60 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
));

TypingIndicator.displayName = 'TypingIndicator';

// ============================================
// Message Bubble Component (Memoized)
// ============================================

interface MessageBubbleProps {
  message: ChatMessage;
  onAction?: (action: QuickAction) => void;
  onSuggestionClick?: (suggestion: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(({
  message,
  onAction,
  onSuggestionClick,
}) => {
  const isUser = message.type === 'user';
  const isBot = message.type === 'bot';
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 animate-fade-in" role="article" aria-label="System message">
<div className="px-4 py-2 bg-emerald-50 rounded-full text-xs text-emerald-600 flex items-center gap-2">
          <CheckCircle className="h-3 w-3" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start', 'mb-4 animate-fade-in-up')} role="article" aria-label={`${isUser ? 'Your' : 'NILIN Assistant'} message`}>
      <div className={cn('max-w-[85%]', isUser && 'text-right')}>
        {/* Bot header with avatar */}
        {!isUser && (
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-nilin-rose via-nilin-coral to-nilin-peach flex items-center justify-center shadow-md">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-nilin-charcoal">NILIN Assistant</span>
              <span className="text-[10px] text-nilin-warmGray">Just now</span>
            </div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 inline-block text-left shadow-sm',
            isUser
              ? 'bg-gradient-to-br from-nilin-rose to-nilin-coral text-white rounded-br-sm'
              : 'bg-white border border-nilin-border/60 text-nilin-charcoal rounded-bl-sm'
          )}
        >
          {/* Typing indicator */}
          {message.isTyping ? (
            <TypingIndicator />
          ) : (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              <p className={cn(
                'text-[10px] mt-1.5',
                isUser ? 'text-white/60' : 'text-nilin-warmGray/70'
              )}>
                {formatTime(message.timestamp)}
              </p>
            </>
          )}
        </div>

        {/* Quick Actions */}
        {isBot && message.actions && !message.isTyping && (
          <div className="mt-3 space-y-2" role="group" aria-label="Quick action buttons">
            {message.actions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => onAction?.(action)}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  'bg-white border border-nilin-border/50 hover:border-nilin-coral/50 hover:shadow-lg',
                  'text-nilin-charcoal hover:text-nilin-coral hover:-translate-y-0.5',
                  'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:ring-offset-2',
                  'group'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                aria-label={`${action.label} action`}
              >
                {action.icon && (
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-nilin-blush/60 to-nilin-peach/40 flex items-center justify-center text-nilin-coral group-hover:scale-110 transition-transform">
                    {action.icon}
                  </span>
                )}
                <span className="flex-1 text-left">{action.label}</span>
                <ArrowRight className="h-4 w-4 text-nilin-warmGray/50 group-hover:text-nilin-coral group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        )}

        {/* Suggested Replies */}
        {isBot && message.suggestedReplies && !message.isTyping && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Suggested replies">
            {message.suggestedReplies.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  'bg-gradient-to-r from-nilin-blush/50 to-nilin-peach/30 text-nilin-coral border border-nilin-coral/20',
                  'hover:shadow-lg hover:-translate-y-0.5 hover:shadow-nilin-coral/10',
                  'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:ring-offset-2'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                aria-label={`Send suggested reply: ${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// ============================================
// Main Component
// ============================================

const AutoChatbot: React.FC<AutoChatbotProps> = ({
  isOpen,
  onToggle,
  position = 'bottom-right',
  welcomeMessage = "Hello! 👋 I'm NILIN's AI assistant. How can I help you today?",
  userName,
  context,
  onAction,
  onMessage,
  onHumanTransfer,
  onClose,
  primaryColor = '#E8B4A8',
  className,
  theme,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastBotMessageId, setLastBotMessageId] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessagesBadge, setShowNewMessagesBadge] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportTransferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);

  // Effective theme colors (custom theme overrides or defaults)
  const effectivePrimaryColor = theme?.primaryColor || primaryColor || '#E8B4A8';
  const effectiveSecondaryColor = theme?.secondaryColor || '#D4948A';

  useEffect(() => {
    if (isOpen && !isInitialized) {
      setMessages([
        {
          id: 'welcome',
          type: 'bot',
          content: welcomeMessage,
          timestamp: new Date(),
          suggestedReplies: ['Browse Services', 'Track Booking', 'Payment Help', 'Talk to Support'],
        },
      ]);
      setIsInitialized(true);
    }
  }, [isOpen, isInitialized, welcomeMessage]);

  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen]);

  // Scroll handler to detect if user is near bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 150;
    setIsNearBottom(nearBottom);

    if (nearBottom) {
      setShowNewMessagesBadge(false);
    }
  }, []);

  // Auto-scroll when new messages arrive (only if near bottom)
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setShowNewMessagesBadge(messages.length > 0);
    }
  }, [messages, isNearBottom]);

  // Scroll to bottom when user clicks "New messages" badge
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessagesBadge(false);
    setIsNearBottom(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const processMessage = useCallback(async (userMessage: string): Promise<BotResponse> => {
    // Track message sent
    trackMessageSent();
    const startTime = Date.now();

    // Use custom message handler if provided
    if (onMessage) {
      try {
        return await onMessage(userMessage);
      } catch (error) {
        trackError(error instanceof Error ? error : new Error(String(error)), {
          type: 'custom_handler_error',
          conversationId: conversationIdRef.current,
        });
        console.error('Custom message handler failed:', error);
      }
    }

    // Call backend AI API
    try {
      const response = await aiChatApi.sendMessage({
        message: userMessage,
        context: context as { currentPage?: string; bookingId?: string; serviceId?: string },
        conversationId: conversationIdRef.current,
      });

      // Track successful response
      const responseTime = Date.now() - startTime;
      trackMessageReceived(responseTime);

      // Store conversation ID for continuity
      if (response.conversationId) {
        conversationIdRef.current = response.conversationId;
      }

      return {
        message: response.message,
        suggestedReplies: extractSuggestedReplies(response.message),
      };
    } catch (error) {
      // Track API error
      const err = error instanceof Error ? error : new Error(String(error));
      trackAPIError(err, '/api/ai/chat');
      trackError(err, { conversationId: conversationIdRef.current });
      trackWarning('AI Chat API failed, using fallback', {
        conversationId: conversationIdRef.current,
      });

      // Fallback to local intent analysis
      const intent = analyzeIntent(userMessage);
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600));

      return DEFAULT_RESPONSES[intent] || DEFAULT_RESPONSES.unknown;
    }
  }, [onMessage, context]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatAnalytics.trackMessageSent(userMessage.id, messageText.length);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await processMessage(messageText);

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'bot',
        content: response.message,
        timestamp: new Date(),
        actions: response.actions,
        suggestedReplies: response.suggestedReplies,
      };

      setMessages(prev => [...prev, botMessage]);
      chatAnalytics.trackMessageReceived(botMessage.id, response.message.length);
      setLastBotMessageId(botMessage.id);

      if (response.followUp) {
        const followUpContent = response.followUp;
        followUpTimeoutRef.current = setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `followup-${Date.now()}`,
            type: 'bot',
            content: followUpContent,
            timestamp: new Date(),
          }]);
        }, 2000);
      }
    } catch (error) {
      // Track error in monitoring system
      const err = error instanceof Error ? error : new Error(String(error));
      trackError(err, {
        type: 'message_processing_error',
        conversationId: conversationIdRef.current,
      });
      console.error('Failed to process message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      // Focus back on input after sending
      inputRef.current?.focus();
    }
  }, [processMessage]);

  const handleAction = useCallback(async (action: QuickAction) => {
    if (action.type === 'action') {
      if (onAction) {
        try {
          setIsTyping(true);
          const response = await onAction(action);
          setMessages(prev => [...prev, {
            id: `action-${Date.now()}`,
            type: 'bot',
            content: response.message,
            timestamp: new Date(),
            actions: response.actions,
            suggestedReplies: response.suggestedReplies,
          }]);
          return;
        } catch {
          // Fall through
        }
      }

      const actionResponses: Record<string, string> = {
        track_booking: "To track your booking, I'll need your booking ID. You can find it in your booking confirmation email or in your account's booking history.",
        payment_methods: "We accept the following payment methods:\n\n• Credit/Debit Cards (Visa, Mastercard, AMEX)\n• Apple Pay & Google Pay\n• Cash on completion\n\nAll online payments are secure and encrypted! 🔒",
        request_refund: "I can help you with a refund. Please provide your booking ID and the reason for the refund request. Our team will review it within 24 hours.",
        booking: "Great! Let's help you book a service. What type of service are you looking for? We have Hair, Nails, Skincare, Makeup, and more!",
        payment: "I can help with payment-related questions. What specific issue are you experiencing?",
        account: "I can help with your account settings. What would you like to do?",
        support: "I'll connect you with our support team. One moment please... They're typically available within 2-5 minutes. 🎧",
        start_refund: "Please provide your booking ID and I'll initiate the refund process for you. You'll receive an email confirmation once it's submitted.",
        categories: "Here are our service categories:\n\n🎨 Hair & Styling\n💅 Nail Art\n✨ Skincare & Facial\n💆 Massage Therapy\n💄 Makeup Services\n\nWhich one interests you?",
        category_hair: "Great choice! Our hair services include:\n\n• Haircuts & Styling\n• Coloring & Highlights\n• Treatments & Conditioning\n• Bridal Styling\n\nWould you like me to show you available providers?",
        category_nails: "Our nail services include:\n\n• Manicure & Pedicure\n• Gel & Acrylic Nails\n• Nail Art & Design\n• Nail Treatments\n\nWould you like to see our nail technicians?",
        refund_status: "To check your refund status, please provide your booking ID or order number. You can also check the status in your account's payment history.",
      };

      const response = actionResponses[action.value] || "I've noted your request. How else can I help?";

      setMessages(prev => [...prev, {
        id: `action-${Date.now()}`,
        type: 'bot',
        content: response,
        timestamp: new Date(),
      }]);

      if (action.value === 'support') {
        supportTransferTimeoutRef.current = setTimeout(() => {
          onHumanTransfer?.();
        }, 1500);
      }
    } else if (action.type === 'link') {
      window.location.href = action.value;
    }
  }, [onAction, onHumanTransfer]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage(suggestion);
  }, [sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }, [sendMessage, inputValue]);

  const clearChat = useCallback(() => {
    if (followUpTimeoutRef.current) {
      clearTimeout(followUpTimeoutRef.current);
      followUpTimeoutRef.current = null;
    }
    if (supportTransferTimeoutRef.current) {
      clearTimeout(supportTransferTimeoutRef.current);
      supportTransferTimeoutRef.current = null;
    }
    setMessages([]);
    setLastBotMessageId(null);
    setShowFeedback(false);
    setShowClearConfirm(false);
    // Reset conversation ID for new chat
    conversationIdRef.current = undefined;
    chatAnalytics.trackNewChatStarted();
  }, []);

  const handleNewChatClick = useCallback(() => {
    if (messages.length > 0) {
      setShowClearConfirm(true);
    } else {
      clearChat();
    }
  }, [messages.length, clearChat]);

  useEffect(() => {
    return () => {
      if (followUpTimeoutRef.current) clearTimeout(followUpTimeoutRef.current);
      if (supportTransferTimeoutRef.current) clearTimeout(supportTransferTimeoutRef.current);
    };
  }, []);

  const showCharCounter = inputValue.length > 400;

  return (
    <div
      className={cn(
        'fixed z-50 transition-all duration-300 ease-out',
        position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6',
        className
      )}
    >
      {/* Chat Window */}
      {isOpen && (
        <div
          className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-4 w-[380px] md:w-[420px] h-[580px] max-h-[85vh] flex flex-col animate-slide-up relative"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)'
          }}
        >
          {/* Header */}
          <div
            className="px-6 py-5 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${effectivePrimaryColor} 0%, ${effectiveSecondaryColor} 100%)` }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Bot className="h-7 w-7" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-3 border-white shadow-sm animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">NILIN Assistant</h3>
                  <div className="flex items-center gap-2 text-xs text-white/90">
                    <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                    <span>Online • Ready to help</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    clearChat();
                    onClose?.();
                  }}
                  className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium flex items-center gap-2"
                  aria-label="End chat"
                >
                  <X className="h-4 w-4" />
                  <span>End Chat</span>
                </button>
              </div>
            </div>
          </div>

          {/* Chat Content - always visible when window is open */}
          <>
              {/* Support Banner */}
              {onHumanTransfer && (
                <div className="bg-gradient-to-r from-nilin-blush/30 to-nilin-peach/20 px-4 py-3 border-b border-nilin-border/30">
                  <button
                    onClick={onHumanTransfer}
                    className="w-full flex items-center justify-center gap-2 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors group"
                    aria-label="Talk to a human support agent"
                  >
                    <div className="w-8 h-8 rounded-xl bg-nilin-coral/10 flex items-center justify-center group-hover:bg-nilin-coral/20 transition-colors">
                      <HeartHandshake className="h-4 w-4" />
                    </div>
                    <span>Talk to a human</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-5 space-y-1 bg-gradient-to-b from-nilin-cream/30 to-white scrollbar-chat"
                onScroll={handleScroll}
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
              >
                {messages.map(message => (
                  <MessageBubble
                    key={message.id}
                    message={{
                      ...message,
                      isTyping: message.id === lastBotMessageId && isTyping,
                    }}
                    onAction={handleAction}
                    onSuggestionClick={handleSuggestionClick}
                  />
                ))}
                <div ref={messagesEndRef} />

                {/* New messages badge */}
                {showNewMessagesBadge && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-nilin-charcoal text-white rounded-full text-sm font-medium shadow-lg hover:bg-nilin-charcoal/90 transition-colors flex items-center gap-2"
                    aria-label="Scroll to new messages"
                  >
                    <ChevronDown className="h-4 w-4" />
                    New messages
                  </button>
                )}
              </div>

              {/* Quick Suggestions */}
              <div className="px-5 py-3 bg-white border-t border-nilin-border/30">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Quick suggestions">
                  {QUICK_SUGGESTIONS.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(item.message)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-nilin-blush/40 rounded-2xl text-xs font-medium text-nilin-coral whitespace-nowrap hover:bg-nilin-blush/60 transition-colors group"
                      aria-label={`${item.label}: ${item.message}`}
                    >
                      <span className="w-7 h-7 rounded-xl bg-white/50 flex items-center justify-center group-hover:bg-white/70 transition-colors">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t border-nilin-border/30">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      aria-label="Type your message"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Ask me anything..."
                      rows={1}
                      maxLength={500}
                      className="w-full px-4 py-3.5 bg-nilin-blush/20 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-nilin-charcoal placeholder:text-nilin-warmGray/70 text-sm"
                      style={{ maxHeight: '120px' }}
                    />
                    {showCharCounter && (
                      <div className="absolute bottom-2 right-3 text-[10px] text-nilin-warmGray/60">
                        {inputValue.length}/500
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => sendMessage(inputValue)}
                    disabled={!inputValue.trim() || isTyping}
                    className={cn(
                      'w-12 h-12 rounded-2xl transition-all flex items-center justify-center shadow-lg flex-shrink-0',
                      inputValue.trim() && !isTyping
                        ? 'text-white'
                        : 'text-white/50 cursor-not-allowed'
                    )}
                    style={{
                      background: inputValue.trim() && !isTyping
                        ? `linear-gradient(135deg, ${effectivePrimaryColor}, ${effectiveSecondaryColor})`
                        : '#d1d1d1',
                    }}
                    aria-label="Send message"
                  >
                    {isTyping ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-nilin-border/30 text-[11px] text-nilin-warmGray/70">
                  <button
                    onClick={handleNewChatClick}
                    className="flex items-center gap-1.5 hover:text-nilin-coral transition-colors"
                    aria-label="Start new chat"
                  >
                    <RefreshCw className="h-3 w-3" />
                    New chat
                  </button>
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Powered by NILIN AI
                  </span>
                </div>
              </div>
            </>
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={cn(
            'w-16 h-16 rounded-full text-white shadow-xl hover:shadow-2xl transition-all flex items-center justify-center',
            'relative group'
          )}
          style={{ background: `linear-gradient(135deg, ${effectivePrimaryColor}, ${effectiveSecondaryColor})` }}
          aria-label="Open chat assistant"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-white/20 scale-110 group-hover:scale-125 transition-transform" />

          {isTyping ? (
            <Loader2 className="h-7 w-7 animate-spin relative z-10" />
          ) : (
            <Bot className="h-7 w-7 relative z-10" />
          )}

          {/* Pulse indicator */}
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-3 border-white animate-pulse" />
        </button>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-chat-title"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 id="clear-chat-title" className="font-semibold text-nilin-charcoal">Start new conversation?</h3>
                <p className="text-sm text-nilin-warmGray">Your current chat will be cleared.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/20 transition-colors"
                aria-label="Cancel and keep current chat"
              >
                Cancel
              </button>
              <button
                onClick={clearChat}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ background: `linear-gradient(135deg, ${effectivePrimaryColor}, ${effectiveSecondaryColor})` }}
                aria-label="Start new conversation"
              >
                Start New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoChatbot;