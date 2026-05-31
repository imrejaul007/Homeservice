import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Phone,
  Clock,
  User,
  Star,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  Paperclip,
  Image,
  PhoneIncoming,
  PhoneOutgoing,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ChatStatus = 'idle' | 'connecting' | 'waiting' | 'active' | 'ended';
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'customer' | 'agent' | 'system';
  senderName: string;
  timestamp: Date;
  type: MessageType;
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

export interface ChatSession {
  sessionId: string;
  chatRoomId: string;
  status: ChatStatus;
  agentId?: string;
  agentName?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  startedAt?: Date;
  endedAt?: Date;
}

export interface QuickReply {
  id: string;
  text: string;
}

export interface LiveChatProps {
  className?: string;
  onClose?: () => void;
  initialOpen?: boolean;
}

// ============================================
// API SERVICE
// ============================================

const liveChatApi = {
  async startSession(initialMessage?: string, priority?: string): Promise<ChatSession> {
    const response = await authService.post<{ success: boolean; data: ChatSession }>(
      '/support/chat/start',
      { initialMessage, priority: priority || 'normal' }
    );
    return response.data;
  },

  async sendMessage(sessionId: string, content: string, type: MessageType = 'text'): Promise<ChatMessage> {
    const response = await authService.post<{ success: boolean; data: ChatMessage }>(
      `/support/chat/${sessionId}/message`,
      { content, type }
    );
    return response.data;
  },

  async getMessages(sessionId: string, limit?: number): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const response = await authService.get<{ success: boolean; data: { messages: ChatMessage[]; hasMore: boolean } }>(
      `/support/chat/${sessionId}/messages?limit=${limit || 50}`
    );
    return response.data;
  },

  async endSession(sessionId: string): Promise<void> {
    await authService.post(`/support/chat/${sessionId}/end`);
  },

  async rateSession(sessionId: string, rating: number, feedback?: string): Promise<void> {
    await authService.post(`/support/chat/${sessionId}/rate`, { rating, feedback });
  },

  async markRead(sessionId: string): Promise<void> {
    await authService.get(`/support/chat/${sessionId}/read`);
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 1) return mins > 0 ? `1 hour ${mins} min` : '1 hour';
  return `${hours} hours ${mins} min`;
};

// ============================================
// STATUS INDICATOR COMPONENT
// ============================================

const StatusIndicator: React.FC<{ status: ChatStatus; waitTime?: number }> = ({ status, waitTime }) => {
  const statusConfig = {
    idle: { color: 'bg-gray-400', label: 'Click to chat' },
    connecting: { color: 'bg-yellow-400', label: 'Connecting...' },
    waiting: { color: 'bg-yellow-400', label: `Waiting (${waitTime ? formatDuration(waitTime) : '...'})` },
    active: { color: 'bg-green-400', label: 'Connected' },
    ended: { color: 'bg-gray-400', label: 'Chat ended' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2.5 h-2.5 rounded-full', config.color, status === 'connecting' && 'animate-pulse')} />
      <span className="text-xs text-white/80">{config.label}</span>
    </div>
  );
};

// ============================================
// MESSAGE BUBBLE COMPONENT
// ============================================

const MessageBubble: React.FC<{ message: ChatMessage; isOwn: boolean }> = ({ message, isOwn }) => {
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isOwn
            ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-br-sm'
            : 'bg-white border border-nilin-border text-nilin-charcoal rounded-bl-sm'
        )}
      >
        {!isOwn && (
          <p className="text-xs font-medium text-nilin-coral mb-1">{message.senderName}</p>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {message.attachments.map((attachment, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg overflow-hidden',
                  isOwn ? 'bg-white/10' : 'bg-gray-50'
                )}
              >
                {attachment.mimeType.startsWith('image/') ? (
                  <img
                    src={attachment.url}
                    alt={attachment.filename}
                    className="max-w-full rounded-lg max-h-48"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2">
                    <Paperclip className="h-4 w-4 opacity-60" />
                    <span className="text-sm truncate">{attachment.filename}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={cn('text-xs mt-1', isOwn ? 'text-white/60' : 'text-gray-400')}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
};

// ============================================
// TYPING INDICATOR COMPONENT
// ============================================

const TypingIndicator: React.FC<{ agentName?: string }> = ({ agentName }) => (
  <div className="flex items-start gap-2">
    <div className="w-8 h-8 rounded-full bg-nilin-blush/50 flex items-center justify-center">
      <MessageCircle className="h-4 w-4 text-nilin-coral" />
    </div>
    <div className="bg-white border border-nilin-border rounded-2xl rounded-bl-sm px-4 py-3">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {agentName && <p className="text-xs text-gray-400 mt-1">{agentName} is typing...</p>}
    </div>
  </div>
);

// ============================================
// RATING COMPONENT
// ============================================

const RatingComponent: React.FC<{
  onRate: (rating: number) => void;
  onSkip: () => void;
}> = ({ onRate, onSkip }) => {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (selectedRating > 0) {
      onRate(selectedRating);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="p-4 bg-white rounded-xl border border-nilin-border text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <p className="font-medium text-nilin-charcoal">Thank you for your feedback!</p>
        <p className="text-sm text-gray-500 mt-1">Your rating helps us improve.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-xl border border-nilin-border">
      <p className="text-sm font-medium text-nilin-charcoal text-center mb-3">
        How would you rate this chat?
      </p>
      <div className="flex items-center justify-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onMouseEnter={() => setHoveredRating(rating)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => setSelectedRating(rating)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                rating <= (hoveredRating || selectedRating)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-gray-300'
              )}
            />
          </button>
        ))}
      </div>
      {selectedRating > 0 && (
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us more about your experience (optional)..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          rows={2}
        />
      )}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Skip
        </button>
        {selectedRating > 0 && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-nilin-coral text-white text-sm rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// QUEUE INFO COMPONENT
// ============================================

const QueueInfo: React.FC<{ position?: number; waitTime?: number }> = ({ position, waitTime }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
    <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
    <p className="font-medium text-amber-800">
      {position ? `Position in queue: ${position}` : 'Connecting you to an agent...'}
    </p>
    {waitTime && (
      <p className="text-sm text-amber-600 mt-1">
        Estimated wait: {formatDuration(waitTime)}
      </p>
    )}
    <div className="mt-3 flex items-center justify-center gap-2">
      <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
      <span className="text-sm text-amber-600">Please wait</span>
    </div>
  </div>
);

// ============================================
// AGENT INFO COMPONENT
// ============================================

const AgentInfo: React.FC<{ name: string; duration?: number }> = ({ name, duration }) => (
  <div className="flex items-center gap-2 text-white/80">
    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
      <User className="h-4 w-4" />
    </div>
    <div>
      <p className="text-sm font-medium">{name}</p>
      {duration !== undefined && (
        <p className="text-xs text-white/60">
          {duration > 0 ? `Duration: ${formatDuration(duration)}` : 'Connected'}
        </p>
      )}
    </div>
  </div>
);

// ============================================
// MAIN LIVE CHAT COMPONENT
// ============================================

export const LiveChat: React.FC<LiveChatProps> = ({
  className,
  onClose,
  initialOpen = false,
}) => {
  // State
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Quick replies for common questions
  const quickReplies: QuickReply[] = [
    { id: '1', text: 'I have a booking issue' },
    { id: '2', text: 'Payment problem' },
    { id: '3', text: 'Service inquiry' },
    { id: '4', text: 'Something else' },
  ];

  // Start a new chat session
  const startChat = useCallback(async () => {
    setChatStatus('connecting');

    try {
      const newSession = await liveChatApi.startSession();

      setSession(newSession);

      if (newSession.status === 'waiting' && newSession.queuePosition) {
        setChatStatus('waiting');
        setWaitTime(newSession.estimatedWaitTime || 0);
      } else {
        setChatStatus('active');
        // Add welcome message
        setMessages([
          {
            id: `sys-${Date.now()}`,
            content: newSession.agentName
              ? `You are now connected with ${newSession.agentName}`
              : 'You are now connected with a support agent',
            sender: 'system',
            senderName: 'System',
            timestamp: new Date(),
            type: 'system',
          },
        ]);
      }

      // Start duration timer if session is active
      if (newSession.startedAt) {
        const startTime = new Date(newSession.startedAt).getTime();
        durationIntervalRef.current = setInterval(() => {
          setSessionDuration(Math.floor((Date.now() - startTime) / 60000));
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
      setChatStatus('idle');
      setMessages([
        {
          id: `sys-${Date.now()}`,
          content: 'Unable to connect. Please try again.',
          sender: 'system',
          senderName: 'System',
          timestamp: new Date(),
          type: 'system',
        },
      ]);
    }
  }, []);

  // Poll for messages and status updates
  useEffect(() => {
    if (!session?.sessionId || chatStatus !== 'active') return;

    const pollMessages = async () => {
      try {
        const { messages: newMessages } = await liveChatApi.getMessages(session.sessionId);

        if (newMessages.length > messages.length) {
          setMessages(newMessages);

          // Mark as read
          await liveChatApi.markRead(session.sessionId);
        }

        // Simulate agent typing (in production, this would come from WebSocket)
        if (Math.random() > 0.7) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 2000);
        }
      } catch (error) {
        console.error('Failed to poll messages:', error);
      }
    };

    pollIntervalRef.current = setInterval(pollMessages, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [session?.sessionId, chatStatus, messages.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && chatStatus === 'active') {
      inputRef.current?.focus();
    }
  }, [isOpen, chatStatus]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isSending || !session) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Optimistically add user message
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content: messageText,
      sender: 'customer',
      senderName: 'You',
      timestamp: new Date(),
      type: 'text',
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      await liveChatApi.sendMessage(session.sessionId, messageText);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Mark message as failed (could add error state)
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, session]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // End chat session
  const handleEndChat = useCallback(async () => {
    if (!session) return;

    try {
      await liveChatApi.endSession(session.sessionId);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          content: 'This chat has ended. Thank you for contacting us!',
          sender: 'system',
          senderName: 'System',
          timestamp: new Date(),
          type: 'system',
        },
      ]);

      setChatStatus('ended');
      setShowRating(true);
    } catch (error) {
      console.error('Failed to end chat:', error);
    }
  }, [session]);

  // Handle rating
  const handleRate = useCallback(async (rating: number) => {
    if (!session) return;

    try {
      await liveChatApi.rateSession(session.sessionId, rating);
    } catch (error) {
      console.error('Failed to rate chat:', error);
    }
  }, [session]);

  // Toggle chat
  const toggleChat = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  // Quick reply handler
  const handleQuickReply = (reply: QuickReply) => {
    setInputValue(reply.text);
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'fixed z-50 transition-all duration-300',
        'bottom-4 right-4',
        className
      )}
    >
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-4 w-96 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral p-4 text-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {chatStatus === 'active' && session?.agentName ? (
                  <AgentInfo name={session.agentName} duration={sessionDuration} />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Live Support</h3>
                      <StatusIndicator status={chatStatus} waitTime={waitTime} />
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {/* Idle State - Start Chat */}
            {chatStatus === 'idle' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-nilin-blush/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-nilin-coral" />
                </div>
                <h4 className="font-semibold text-nilin-charcoal mb-2">Chat with Support</h4>
                <p className="text-sm text-gray-500 mb-6">
                  Our support team is ready to help you with any questions.
                </p>
                <button
                  onClick={startChat}
                  className="px-6 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  Start Chat
                </button>

                {/* Quick Topics */}
                <div className="mt-6 text-left">
                  <p className="text-xs text-gray-500 mb-2">Quick topics:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        onClick={() => handleQuickReply(reply)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {reply.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Connecting State */}
            {chatStatus === 'connecting' && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 text-nilin-coral mx-auto mb-4 animate-spin" />
                <p className="font-medium text-nilin-charcoal">Connecting...</p>
                <p className="text-sm text-gray-500">Finding an available agent</p>
              </div>
            )}

            {/* Waiting in Queue */}
            {chatStatus === 'waiting' && (
              <QueueInfo position={session?.queuePosition} waitTime={waitTime} />
            )}

            {/* Active Chat */}
            {(chatStatus === 'active' || chatStatus === 'ended') && (
              <>
                {/* Messages */}
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.sender === 'customer'}
                  />
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <TypingIndicator agentName={session?.agentName} />
                )}

                {/* Rating */}
                {showRating && (
                  <RatingComponent
                    onRate={handleRate}
                    onSkip={() => setShowRating(false)}
                  />
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          {chatStatus === 'active' && (
            <div className="border-t border-nilin-border p-4 flex-shrink-0 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 px-4 py-3 bg-nilin-blush/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-nilin-charcoal placeholder:text-nilin-warmGray"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  className={cn(
                    'p-3 rounded-xl transition-all',
                    inputValue.trim() && !isSending
                      ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-nilin-border">
                <button
                  onClick={handleEndChat}
                  className="text-sm text-red-500 hover:text-red-600 transition-colors"
                >
                  End Chat
                </button>
                <div className="flex items-center gap-3">
                  <button className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Request callback
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="w-16 h-16 rounded-full bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}
    </div>
  );
};

export default LiveChat;
