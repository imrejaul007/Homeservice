import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';
import type { Ticket, TicketMessage, TicketStatus, TicketPriority } from './TicketList';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TicketDetailProps {
  ticketId: string;
  className?: string;
  onBack?: () => void;
  onClose?: () => void;
  isAdmin?: boolean;
}

// ============================================
// API SERVICE
// ============================================

const ticketApi = {
  async getTicket(ticketId: string): Promise<Ticket> {
    const response = await authService.get<{ success: boolean; data: Ticket }>(
      `/support/tickets/${ticketId}`
    );
    return response.data;
  },

  async addMessage(ticketId: string, message: string): Promise<void> {
    await authService.post(`/support/tickets/${ticketId}/message`, { message });
  },

  async closeTicket(ticketId: string, note?: string): Promise<void> {
    await authService.patch(`/support/tickets/${ticketId}/close`, { note });
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getStatusConfig = (status: TicketStatus) => {
  const configs: Record<TicketStatus, { color: string; bgColor: string; label: string }> = {
    open: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Open' },
    in_progress: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'In Progress' },
    pending_response: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Pending' },
    resolved: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Resolved' },
    closed: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Closed' },
  };
  return configs[status];
};

const getPriorityConfig = (priority: TicketPriority) => {
  const configs: Record<TicketPriority, { color: string; bgColor: string; label: string }> = {
    low: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Low' },
    medium: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Medium' },
    high: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'High' },
    urgent: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Urgent' },
  };
  return configs[priority];
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateTime(dateString);
};

// ============================================
// MESSAGE BUBBLE COMPONENT
// ============================================

const MessageBubble: React.FC<{ message: TicketMessage }> = ({ message }) => {
  const isAdmin = message.senderType === 'admin';

  return (
    <div className={cn('flex', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3',
          isAdmin
            ? 'bg-white border border-nilin-border text-nilin-charcoal'
            : 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white'
        )}
      >
        {/* Sender */}
        <div className="flex items-center gap-2 mb-1">
          {isAdmin ? (
            <>
              <div className="w-6 h-6 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                <User className="h-3 w-3 text-nilin-coral" />
              </div>
              <span className="text-xs font-medium text-nilin-coral">
                {message.senderName || 'Support'}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-white/80">You</span>
          )}
          <span className={cn('text-xs', isAdmin ? 'text-gray-400' : 'text-white/60')}>
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>

        {/* Message Content */}
        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
      </div>
    </div>
  );
};

// ============================================
// INFO SECTION COMPONENT
// ============================================

const InfoSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-nilin-charcoal">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
};

// ============================================
// MAIN TICKET DETAIL COMPONENT
// ============================================

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticketId,
  className,
  onBack,
  onClose,
  isAdmin = false,
}) => {
  // State
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch ticket
  const fetchTicket = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await ticketApi.getTicket(ticketId);
      setTicket(data);
    } catch (err) {
      console.error('Failed to fetch ticket:', err);
      setError('Failed to load ticket details.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // Initial fetch
  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  // Handle send message
  const handleSend = async () => {
    if (!message.trim() || sending || !ticket) return;

    const messageText = message.trim();
    setMessage('');
    setSending(true);

    try {
      await ticketApi.addMessage(ticketId, messageText);
      await fetchTicket();
      messageInputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message.');
      setMessage(messageText); // Restore message
    } finally {
      setSending(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle close ticket
  const handleCloseTicket = async () => {
    if (!ticket || closing) return;

    if (!confirm('Are you sure you want to close this ticket?')) return;

    setClosing(true);

    try {
      await ticketApi.closeTicket(ticketId);
      await fetchTicket();
    } catch (err) {
      console.error('Failed to close ticket:', err);
      setError('Failed to close ticket.');
    } finally {
      setClosing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !ticket) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-4', className)}>
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-600 text-center">{error || 'Ticket not found'}</p>
        <button
          onClick={onBack}
          className="mt-4 text-sm text-nilin-coral hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const canSendMessage = ticket.status !== 'closed' && ticket.status !== 'resolved';
  const canCloseTicket = ticket.status === 'resolved' || (isAdmin && ticket.status !== 'closed');

  return (
    <div className={cn('flex flex-col h-full bg-gray-50', className)}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-500">{ticket.ticketNumber}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityConfig.bgColor, priorityConfig.color)}>
                {priorityConfig.label}
              </span>
            </div>
            <h1 className="font-semibold text-nilin-charcoal">{ticket.subject}</h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Created {formatDateTime(ticket.createdAt)}</span>
          </div>
          {ticket.assignedToName && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>Assigned to {ticket.assignedToName}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{ticket.messages?.length || 0} messages</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Messages */}
        <div className="p-4 space-y-4">
          {/* Original Message */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                <User className="h-4 w-4 text-nilin-coral" />
              </div>
              <div>
                <p className="text-sm font-medium text-nilin-charcoal">
                  {ticket.userName || 'You'}
                </p>
                <p className="text-xs text-gray-400">{formatDateTime(ticket.createdAt)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Thread Messages */}
          {ticket.messages && ticket.messages.length > 1 && (
            <>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  Conversation
                </p>
              </div>
              {ticket.messages.slice(1).map((msg) => (
                <MessageBubble key={msg._id} message={msg} />
              ))}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Info Sections */}
        <div className="p-4 space-y-4">
          <InfoSection title="Ticket Details">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Category</p>
                <p className="font-medium text-nilin-charcoal capitalize">{ticket.category}</p>
              </div>
              <div>
                <p className="text-gray-500">Priority</p>
                <p className={cn('font-medium', priorityConfig.color)}>{priorityConfig.label}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className={cn('font-medium', statusConfig.color)}>{statusConfig.label}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="font-medium text-nilin-charcoal">{formatDateTime(ticket.updatedAt)}</p>
              </div>
            </div>
          </InfoSection>

          {ticket.resolvedAt && (
            <InfoSection title="Resolution" defaultOpen={false}>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Resolved on {formatDateTime(ticket.resolvedAt)}</span>
              </div>
            </InfoSection>
          )}
        </div>
      </div>

      {/* Message Input */}
      {canSendMessage && (
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your reply..."
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-nilin-charcoal placeholder:text-gray-400"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className={cn(
                'p-3 rounded-xl transition-all',
                message.trim() && !sending
                  ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}

      {/* Closed State */}
      {ticket.status === 'closed' && (
        <div className="bg-gray-100 border-t border-gray-200 p-4 text-center flex-shrink-0">
          <p className="text-sm text-gray-500">This ticket has been closed</p>
        </div>
      )}

      {/* Resolved State - Close Button */}
      {ticket.status === 'resolved' && (
        <div className="bg-gray-100 border-t border-gray-200 p-4 flex-shrink-0">
          <button
            onClick={handleCloseTicket}
            disabled={closing}
            className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            {closing ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              'Close Ticket'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;
