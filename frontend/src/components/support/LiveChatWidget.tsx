import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Minimize2,
  Maximize2,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Image,
  Paperclip,
  Smile,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type ChatStatus = 'offline' | 'online' | 'away' | 'busy';
export type AgentStatus = 'available' | 'typing' | 'offline';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  status?: MessageStatus;
  agentName?: string;
  agentAvatar?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document';
  size: number;
}

export interface QuickReply {
  id: string;
  text: string;
}

export interface LiveChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  position?: 'bottom-right' | 'bottom-left';
  messages?: ChatMessage[];
  chatStatus?: ChatStatus;
  agentName?: string;
  agentAvatar?: string;
  onSendMessage?: (message: string, attachments?: File[]) => Promise<void>;
  onQuickReplyClick?: (reply: QuickReply) => void;
  onStartChat?: () => Promise<void>;
  onEndChat?: () => void;
  onRateChat?: (rating: number, feedback?: string) => Promise<void>;
  quickReplies?: QuickReply[];
  unreadCount?: number;
  greetingMessage?: string;
  className?: string;
}

// ============================================
// Status Indicator Component
// ============================================

const StatusIndicator: React.FC<{ status: ChatStatus }> = ({ status }) => {
  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const statusLabels = {
    online: 'Online',
    away: 'Away',
    busy: 'Busy',
    offline: 'Offline',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', statusColors[status])} />
      <span className="text-xs text-nilin-warmGray">{statusLabels[status]}</span>
    </div>
  );
};

// ============================================
// Message Bubble Component
// ============================================

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderStatus = () => {
    if (!isOwn || !message.status) return null;

    const statusIcons = {
      sending: <Loader2 className="h-3 w-3 animate-spin text-nilin-warmGray" />,
      sent: <CheckCircle className="h-3 w-3 text-nilin-warmGray" />,
      delivered: <CheckCircle className="h-3 w-3 text-nilin-warmGray fill-current" />,
      read: <CheckCircle className="h-3 w-3 text-nilin-coral fill-current" />,
      failed: <AlertCircle className="h-3 w-3 text-red-500" />,
    };

    return (
      <div className="flex items-center gap-1 mt-1">
        {statusIcons[message.status]}
        <span className="text-xs text-nilin-warmGray">{formatTime(message.timestamp)}</span>
      </div>
    );
  };

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isOwn
            ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-br-md'
            : 'bg-nilin-blush/50 text-nilin-charcoal rounded-bl-md'
        )}
      >
        {!isOwn && message.agentName && (
          <p className="text-xs font-medium mb-1 opacity-75">{message.agentName}</p>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {message.attachments.map(attachment => (
              <div
                key={attachment.id}
                className={cn(
                  'rounded-lg overflow-hidden',
                  isOwn ? 'bg-white/20' : 'bg-white'
                )}
              >
                {attachment.type === 'image' ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="max-w-full rounded-lg"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm">{attachment.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {renderStatus()}
      </div>
    </div>
  );
};

// ============================================
// Typing Indicator Component
// ============================================

const TypingIndicator: React.FC<{ agentName?: string }> = ({ agentName }) => (
  <div className="flex items-center gap-2 text-nilin-warmGray">
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 bg-nilin-warmGray rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-nilin-warmGray rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-nilin-warmGray rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
    {agentName && <span className="text-xs">{agentName} is typing...</span>}
  </div>
);

// ============================================
// Rating Component
// ============================================

interface RatingComponentProps {
  onRate: (rating: number) => void;
  onSkip: () => void;
}

const RatingComponent: React.FC<RatingComponentProps> = ({ onRate, onSkip }) => {
  const [hoveredRating, setHoveredRating] = useState(0);

  return (
    <div className="p-4 bg-white rounded-xl border border-nilin-border">
      <p className="text-sm font-medium text-nilin-charcoal text-center mb-3">
        How would you rate this chat?
      </p>
      <div className="flex items-center justify-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map(rating => (
          <button
            key={rating}
            onMouseEnter={() => setHoveredRating(rating)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => onRate(rating)}
            className="p-1 transition-transform hover:scale-110"
          >
            <svg
              className={cn(
                'h-8 w-8 transition-colors',
                rating <= (hoveredRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
              )}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
      </div>
      <button
        onClick={onSkip}
        className="w-full text-sm text-nilin-warmGray hover:text-nilin-coral transition-colors"
      >
        Skip rating
      </button>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const LiveChatWidget: React.FC<LiveChatWidgetProps> = ({
  isOpen,
  onToggle,
  position = 'bottom-right',
  messages = [],
  chatStatus = 'online',
  agentName,
  agentAvatar,
  onSendMessage,
  onQuickReplyClick,
  onStartChat,
  onEndChat,
  onRateChat,
  quickReplies = [],
  unreadCount = 0,
  greetingMessage = "Hi! How can we help you today?",
  className,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isSending) return;

    const message = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      await onSendMessage?.(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, onSendMessage]);

  // Handle quick reply
  const handleQuickReply = useCallback(async (reply: QuickReply) => {
    setInputValue(reply.text);
    await onQuickReplyClick?.(reply);
  }, [onQuickReplyClick]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onSendMessage?.('', files);
    }
    e.target.value = '';
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
          <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative">
                  {agentAvatar ? (
                    <img
                      src={agentAvatar}
                      alt={agentName || 'Agent'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                  )}
                  {chatStatus === 'online' && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Info */}
                <div>
                  <h3 className="font-semibold">
                    {agentName || 'Customer Support'}
                  </h3>
                  <StatusIndicator status={chatStatus} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  {isMinimized ? (
                    <Maximize2 className="h-4 w-4" />
                  ) : (
                    <Minimize2 className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={onToggle}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Minimized State */}
          {isMinimized && (
            <div className="p-3 cursor-pointer" onClick={() => setIsMinimized(false)}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-nilin-warmGray">
                  {unreadCount > 0 ? `${unreadCount} new messages` : 'Click to expand'}
                </span>
                <ChevronUp className="h-4 w-4 text-nilin-warmGray" />
              </div>
            </div>
          )}

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-140px)]">
                {/* Greeting Message */}
                {messages.length === 0 && chatStatus !== 'offline' && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-nilin-blush/50 flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-nilin-coral" />
                    </div>
                    <div className="bg-nilin-blush/50 rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-nilin-charcoal">{greetingMessage}</p>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {messages.map(message => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.sender === 'user'}
                  />
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-nilin-blush/50 flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-nilin-coral" />
                    </div>
                    <div className="bg-nilin-blush/50 rounded-2xl rounded-bl-md px-4 py-3">
                      <TypingIndicator agentName={agentName} />
                    </div>
                  </div>
                )}

                {/* Rating */}
                {showRating && (
                  <RatingComponent
                    onRate={(rating) => {
                      onRateChat?.(rating);
                      setShowRating(false);
                    }}
                    onSkip={() => setShowRating(false)}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              {quickReplies.length > 0 && messages.length === 0 && (
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map(reply => (
                      <button
                        key={reply.id}
                        onClick={() => handleQuickReply(reply)}
                        className="px-3 py-1.5 bg-nilin-blush/50 text-nilin-coral text-sm rounded-full hover:bg-nilin-coral/10 transition-colors"
                      >
                        {reply.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="border-t border-nilin-border p-4 bg-white">
                <div className="flex items-end gap-2">
                  {/* Attachments */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-nilin-blush/50 transition-colors"
                  >
                    <Paperclip className="h-5 w-5 text-nilin-warmGray" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Text Input */}
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

                  {/* Send Button */}
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isSending || chatStatus === 'offline'}
                    className={cn(
                      'p-3 rounded-xl transition-all',
                      inputValue.trim() && chatStatus !== 'offline'
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

                {/* Offline Message */}
                {chatStatus === 'offline' && (
                  <p className="text-xs text-nilin-warmGray text-center mt-2">
                    We're currently offline. Leave a message and we'll get back to you.
                  </p>
                )}

                {/* Contact Options */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-nilin-border">
                  <button className="flex items-center gap-1 text-xs text-nilin-warmGray hover:text-nilin-coral transition-colors">
                    <Phone className="h-3 w-3" />
                    Call us
                  </button>
                  <button className="flex items-center gap-1 text-xs text-nilin-warmGray hover:text-nilin-coral transition-colors">
                    <Mail className="h-3 w-3" />
                    Email
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
            'w-16 h-16 rounded-full bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center',
            'relative'
          )}
        >
          <MessageCircle className="h-7 w-7" />

          {/* Notification Badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      )}
    </div>
  );
};

export default LiveChatWidget;
