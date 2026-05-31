import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Clock,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Home,
  Book,
  HelpCircle,
  CreditCard,
  Calendar,
  User,
  Settings,
  ShoppingBag,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
}

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
};

// ============================================
// Default Intents / Responses
// ============================================

const DEFAULT_RESPONSES: Record<string, BotResponse> = {
  greeting: {
    message: "Hello! I'm NILIN's AI assistant. How can I help you today?",
    suggestedReplies: ['Book a service', 'Track my booking', 'Payment help', 'Contact support'],
  },
  booking: {
    message: "I'd be happy to help you with booking! You can browse our services or I can help you find a specific provider.",
    actions: [
      { id: 'browse', type: 'link', label: 'Browse Services', value: '/services', icon: ACTION_ICONS.booking },
      { id: 'track', type: 'action', label: 'Track Booking', value: 'track_booking', icon: ACTION_ICONS.home },
    ],
  },
  payment: {
    message: "For payment-related questions, I can help you with:\n\n- Payment methods\n- Refunds\n- Pricing\n\nWhat would you like to know?",
    actions: [
      { id: 'methods', type: 'action', label: 'Payment Methods', value: 'payment_methods', icon: ACTION_ICONS.payment },
      { id: 'refund', type: 'action', label: 'Request Refund', value: 'request_refund', icon: ACTION_ICONS.payment },
      { id: 'pricing', type: 'action', label: 'Pricing Info', value: 'pricing_info', icon: ACTION_ICONS.payment },
    ],
  },
  cancellation: {
    message: "I understand you need to cancel. Here's what you should know:\n\n- Cancellations made 24+ hours before: Full refund\n- Cancellations within 24 hours: Partial refund may apply\n\nWould you like me to help you cancel your booking?",
    suggestedReplies: ['Yes, cancel my booking', 'What about my refund?', 'I need to reschedule'],
  },
  refund: {
    message: "To process a refund, I'll need some information. Refunds typically take 5-7 business days to process.\n\nWould you like me to initiate a refund request for you?",
    actions: [
      { id: 'start_refund', type: 'action', label: 'Start Refund Request', value: 'start_refund', icon: ACTION_ICONS.payment },
    ],
  },
  support: {
    message: "I'll connect you with our support team right away. They can help you with any issues you're experiencing.",
    suggestedReplies: ['Connect me to support', 'I\'ll wait', 'Let me try something first'],
  },
  unknown: {
    message: "I'm not sure I understand that. Let me help you with some common topics:",
    actions: [
      { id: 'booking_help', type: 'action', label: 'Booking Help', value: 'booking', icon: ACTION_ICONS.booking },
      { id: 'payment_help', type: 'action', label: 'Payment Help', value: 'payment', icon: ACTION_ICONS.payment },
      { id: 'account_help', type: 'action', label: 'Account Help', value: 'account', icon: ACTION_ICONS.account },
      { id: 'talk_support', type: 'action', label: 'Talk to Support', value: 'support', icon: ACTION_ICONS.help },
    ],
  },
};

// ============================================
// NLU Helper Functions
// ============================================

const analyzeIntent = (message: string): string => {
  const lowerMessage = message.toLowerCase();

  // Greeting patterns
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy)/.test(lowerMessage)) {
    return 'greeting';
  }

  // Booking patterns
  if (/book|appointment|schedule|reserve|service|provider/.test(lowerMessage)) {
    return 'booking';
  }

  // Payment patterns
  if (/pay|payment|refund|money|charge|cost|price|fee/.test(lowerMessage)) {
    return 'payment';
  }

  // Cancellation patterns
  if (/cancel|change|reschedule|modify|edit/.test(lowerMessage)) {
    return 'cancellation';
  }

  // Refund patterns
  if (/refund|money back|reverse/.test(lowerMessage)) {
    return 'refund';
  }

  // Support patterns
  if (/support|help|human|agent|real person|person|talk/.test(lowerMessage)) {
    return 'support';
  }

  return 'unknown';
};

// ============================================
// Message Bubble Component
// ============================================

interface MessageBubbleProps {
  message: ChatMessage;
  onAction?: (action: QuickAction) => void;
  onSuggestionClick?: (suggestion: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onAction,
  onSuggestionClick,
}) => {
  const isUser = message.type === 'user';
  const isBot = message.type === 'bot';
  const isSystem = message.type === 'system';

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="px-4 py-2 bg-nilin-blush/30 rounded-full text-xs text-nilin-warmGray">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start', 'mb-4')}>
      <div className={cn('max-w-[85%]', isUser && 'text-right')}>
        {/* Avatar for bot */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs text-nilin-warmGray font-medium">NILIN Assistant</span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 inline-block text-left',
            isUser
              ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-br-md'
              : 'bg-nilin-blush/50 text-nilin-charcoal rounded-bl-md'
          )}
        >
          {/* Typing indicator */}
          {message.isTyping ? (
            <div className="flex items-center gap-1 py-1">
              <div className="w-2 h-2 bg-nilin-warmGray rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-nilin-warmGray rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-nilin-warmGray rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              {/* Message content */}
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {/* Time */}
              <p className={cn(
                'text-xs mt-1',
                isUser ? 'text-white/70' : 'text-nilin-warmGray'
              )}>
                {formatTime(message.timestamp)}
              </p>
            </>
          )}
        </div>

        {/* Quick Actions */}
        {isBot && message.actions && !message.isTyping && (
          <div className="mt-2 space-y-2">
            {message.actions.map(action => (
              <button
                key={action.id}
                onClick={() => onAction?.(action)}
                className={cn(
                  'flex items-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  'bg-white border border-nilin-border hover:border-nilin-coral/50 hover:shadow-sm',
                  'text-nilin-charcoal hover:text-nilin-coral'
                )}
              >
                {action.icon && (
                  <span className="text-nilin-coral">{action.icon}</span>
                )}
                {action.label}
                {action.type === 'link' && (
                  <ExternalLink className="h-3 w-3 ml-auto text-nilin-warmGray" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Suggested Replies */}
        {isBot && message.suggestedReplies && !message.isTyping && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.suggestedReplies.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  'bg-white border border-nilin-coral/30 text-nilin-coral',
                  'hover:bg-nilin-coral/10'
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const AutoChatbot: React.FC<AutoChatbotProps> = ({
  isOpen,
  onToggle,
  position = 'bottom-right',
  welcomeMessage = "Hello! I'm NILIN's AI assistant. How can I help you today?",
  userName,
  context,
  onAction,
  onMessage,
  onHumanTransfer,
  onClose,
  primaryColor = '#E8B4A8',
  className,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastBotMessageId, setLastBotMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          type: 'bot',
          content: welcomeMessage,
          timestamp: new Date(),
          suggestedReplies: ['Book a service', 'Track my booking', 'Payment help', 'Contact support'],
        },
      ]);
    }
  }, [isOpen, messages.length, welcomeMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Process message and generate response
  const processMessage = useCallback(async (userMessage: string): Promise<BotResponse> => {
    // If custom handler provided, use it
    if (onMessage) {
      try {
        return await onMessage(userMessage);
      } catch {
        // Fall through to default processing
      }
    }

    // Default intent-based responses
    const intent = analyzeIntent(userMessage);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    return DEFAULT_RESPONSES[intent] || DEFAULT_RESPONSES.unknown;
  }, [onMessage]);

  // Send message
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    // Add user message
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Get bot response
      const response = await processMessage(messageText);

      // Create bot message
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        type: 'bot',
        content: response.message,
        timestamp: new Date(),
        actions: response.actions,
        suggestedReplies: response.suggestedReplies,
      };

      // Add bot message
      setMessages(prev => [...prev, botMessage]);
      setLastBotMessageId(botMessage.id);

      // If follow-up needed
      if (response.followUp) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `followup-${Date.now()}`,
            type: 'bot',
            content: response.followUp!,
            timestamp: new Date(),
          }]);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to process message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [processMessage]);

  // Handle action click
  const handleAction = useCallback(async (action: QuickAction) => {
    if (action.type === 'action') {
      // Process action through handler or simulate response
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
          // Fall through to default
        }
      }

      // Default action responses
      const actionResponses: Record<string, string> = {
        track_booking: "To track your booking, I'll need your booking ID. You can find it in your booking confirmation email.",
        payment_methods: "We accept the following payment methods:\n\n- Credit/Debit Cards\n- Apple Pay\n- Google Pay\n- Cash on completion",
        request_refund: "I can help you with a refund. Please provide your booking ID and the reason for the refund request.",
        booking: "Great! Let's help you book a service. What type of service are you looking for?",
        payment: "I can help with payment-related questions. What specific issue are you experiencing?",
        account: "I can help with your account settings. What would you like to do?",
        support: "I'll connect you with our support team. One moment please...",
        start_refund: "Please provide your booking ID and I'll initiate the refund process for you.",
      };

      const response = actionResponses[action.value] || "I've noted your request. How else can I help?";

      setMessages(prev => [...prev, {
        id: `action-${Date.now()}`,
        type: 'bot',
        content: response,
        timestamp: new Date(),
      }]);

      // If requesting support transfer
      if (action.value === 'support') {
        setTimeout(() => {
          onHumanTransfer?.();
        }, 1500);
      }
    } else if (action.type === 'link') {
      // Navigate to link
      window.location.href = action.value;
    }
  }, [onAction, onHumanTransfer]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage(suggestion);
  }, [sendMessage]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
    setLastBotMessageId(null);
    setShowFeedback(false);
  };

  return (
    <div
      className={cn(
        'fixed z-50 transition-all duration-300',
        position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4',
        className
      )}
    >
      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            'bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 mb-4',
            isMinimized ? 'w-80 h-16' : 'w-96 h-[600px] max-h-[80vh]'
          )}
        >
          {/* Header */}
          <div
            className="p-4 text-white"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #E8B4A8)` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
                </div>
                <div>
                  <h3 className="font-semibold">NILIN Assistant</h3>
                  <div className="flex items-center gap-1 text-xs text-white/80">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    Online now
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  {isMinimized ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    clearChat();
                    onClose?.();
                  }}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Minimized State */}
          {isMinimized && (
            <div className="p-3 cursor-pointer" onClick={() => setIsMinimized(false)}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-nilin-warmGray">
                  Click to continue chatting
                </span>
                <ChevronUp className="h-4 w-4 text-nilin-warmGray" />
              </div>
            </div>
          )}

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 h-[calc(100%-140px)]">
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
              </div>

              {/* Input */}
              <div className="border-t border-nilin-border p-4 bg-white">
                {/* Feedback (shown after interaction) */}
                {showFeedback && (
                  <div className="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-nilin-border">
                    <span className="text-sm text-nilin-warmGray">Was this helpful?</span>
                    <button
                      onClick={() => setShowFeedback(false)}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition-colors"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowFeedback(false)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Suggestions bar */}
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {['Book', 'Track', 'Help', 'More'].map((item, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(`I need help with ${item.toLowerCase()}`)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-nilin-blush/50 rounded-full text-xs text-nilin-coral whitespace-nowrap hover:bg-nilin-coral/10 transition-colors"
                    >
                      {ACTION_ICONS[item.toLowerCase() as keyof typeof ACTION_ICONS] || <MessageCircle className="h-3 w-3" />}
                      {item}
                    </button>
                  ))}
                </div>

                {/* Input field */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type your message..."
                      rows={1}
                      className="w-full px-4 py-3 bg-nilin-blush/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-nilin-charcoal placeholder:text-nilin-warmGray"
                      style={{ maxHeight: '120px' }}
                    />
                  </div>
                  <button
                    onClick={() => sendMessage(inputValue)}
                    disabled={!inputValue.trim() || isTyping}
                    className={cn(
                      'p-3 rounded-xl transition-all flex-shrink-0',
                      inputValue.trim() && !isTyping
                        ? 'text-white'
                        : 'text-nilin-warmGray'
                    )}
                    style={{
                      background: inputValue.trim() && !isTyping
                        ? `linear-gradient(135deg, ${primaryColor}, #E8B4A8)`
                        : '#e5e5e5',
                    }}
                  >
                    {isTyping ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-nilin-border text-xs text-nilin-warmGray">
                  <button
                    onClick={clearChat}
                    className="flex items-center gap-1 hover:text-nilin-coral transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    New chat
                  </button>
                  <button
                    onClick={onHumanTransfer}
                    className="flex items-center gap-1 hover:text-nilin-coral transition-colors"
                  >
                    <User className="h-3 w-3" />
                    Talk to human
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={cn(
            'w-16 h-16 rounded-full text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center',
            'relative'
          )}
          style={{ background: `linear-gradient(135deg, ${primaryColor}, #E8B4A8)` }}
        >
          {isTyping ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Bot className="h-7 w-7" />
          )}

          {/* Notification indicator */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}
    </div>
  );
};

export default AutoChatbot;
