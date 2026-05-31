import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  FileText,
  Image,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';
import type {
  Dispute,
  DisputeStatus,
  DisputeCategory,
  ResolutionType,
  DisputeEvidence,
  DisputeMessage,
  DisputeTimeline,
} from './DisputeCenter';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DisputeDetailProps {
  disputeId: string;
  className?: string;
  onBack?: () => void;
}

// ============================================
// API SERVICE
// ============================================

const disputeApi = {
  async getDispute(disputeId: string): Promise<Dispute> {
    const response = await authService.get<{ success: boolean; data: Dispute }>(
      `/disputes/my/${disputeId}`
    );
    return response.data;
  },

  async addEvidence(disputeId: string, evidence: { type: string; url?: string; description?: string }): Promise<Dispute> {
    const response = await authService.post<{ success: boolean; data: Dispute }>(
      `/disputes/${disputeId}/evidence`,
      evidence
    );
    return response.data;
  },

  async addMessage(disputeId: string, message: string): Promise<Dispute> {
    const response = await authService.post<{ success: boolean; data: Dispute }>(
      `/disputes/${disputeId}/messages`,
      { message }
    );
    return response.data;
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getStatusConfig = (status: DisputeStatus) => {
  const configs: Record<DisputeStatus, { color: string; bgColor: string; label: string }> = {
    open: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Open' },
    under_review: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Under Review' },
    resolved: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Resolved' },
    escalated: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Escalated' },
    closed: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Closed' },
  };
  return configs[status];
};

const getCategoryConfig = (category: DisputeCategory) => {
  const configs: Record<DisputeCategory, { icon: string; label: string }> = {
    service_quality: { icon: '⭐', label: 'Service Quality' },
    no_show: { icon: '👤', label: 'No Show' },
    damage: { icon: '💔', label: 'Damage' },
    billing: { icon: '💰', label: 'Billing' },
    cancellation: { icon: '🚫', label: 'Cancellation' },
    communication: { icon: '💬', label: 'Communication' },
    other: { icon: '📝', label: 'Other' },
  };
  return configs[category];
};

const getResolutionConfig = (type: ResolutionType) => {
  const configs: Record<ResolutionType, { icon: string; label: string; color: string }> = {
    refund: { icon: '💵', label: 'Full Refund', color: 'text-green-600' },
    partial_refund: { icon: '💴', label: 'Partial Refund', color: 'text-green-600' },
    no_action: { icon: '✖️', label: 'No Action Taken', color: 'text-gray-600' },
    provider_warning: { icon: '⚠️', label: 'Provider Warning', color: 'text-orange-600' },
    provider_suspended: { icon: '🚫', label: 'Provider Suspended', color: 'text-red-600' },
  };
  return configs[type];
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number, currency: string = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(amount);
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

  return formatDate(dateString);
};

// ============================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}> = ({ title, children, defaultOpen = true, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-nilin-charcoal">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
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
// EVIDENCE CARD COMPONENT
// ============================================

const EvidenceCard: React.FC<{ evidence: DisputeEvidence }> = ({ evidence }) => {
  const isImage = evidence.type === 'image';

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
          {isImage ? (
            <Image className="h-5 w-5 text-gray-500" />
          ) : (
            <FileText className="h-5 w-5 text-gray-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-nilin-charcoal truncate">
            {evidence.description || (isImage ? 'Image evidence' : 'Document evidence')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatRelativeTime(evidence.submittedAt)}
          </p>
          {evidence.url && (
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-nilin-coral hover:underline mt-1 inline-block"
            >
              View file
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MESSAGE BUBBLE COMPONENT
// ============================================

const MessageBubble: React.FC<{ message: DisputeMessage }> = ({ message }) => {
  const isAdmin = message.senderRole === 'admin';
  const isSystem = message.isSystemMessage;

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3',
          isAdmin
            ? 'bg-white border border-gray-200 text-nilin-charcoal'
            : 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-xs font-medium', isAdmin ? 'text-nilin-coral' : 'text-white/80')}>
            {message.senderRole === 'admin' ? 'Support' : 'You'}
          </span>
          <span className={cn('text-xs', isAdmin ? 'text-gray-400' : 'text-white/60')}>
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
      </div>
    </div>
  );
};

// ============================================
// TIMELINE ITEM COMPONENT
// ============================================

const TimelineItem: React.FC<{ item: DisputeTimeline; isLast?: boolean }> = ({ item, isLast }) => {
  const getActionIcon = (action: string) => {
    if (action.includes('created')) return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    if (action.includes('evidence')) return <Upload className="h-4 w-4 text-purple-500" />;
    if (action.includes('message')) return <MessageSquare className="h-4 w-4 text-gray-500" />;
    if (action.includes('resolved')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('escalated')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (action.includes('status')) return <Clock className="h-4 w-4 text-orange-500" />;
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          {getActionIcon(item.action)}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-gray-200 mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm text-nilin-charcoal">{item.details || item.action}</p>
        <p className="text-xs text-gray-400 mt-1">
          {item.performedByRole === 'system' ? 'System' : item.performedBy} - {formatRelativeTime(item.timestamp)}
        </p>
      </div>
    </div>
  );
};

// ============================================
// MAIN DISPUTE DETAIL COMPONENT
// ============================================

export const DisputeDetail: React.FC<DisputeDetailProps> = ({
  disputeId,
  className,
  onBack,
}) => {
  // State
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceType, setEvidenceType] = useState<'image' | 'document'>('image');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [addingEvidence, setAddingEvidence] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch dispute
  const fetchDispute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await disputeApi.getDispute(disputeId);
      setDispute(data);
    } catch (err) {
      console.error('Failed to fetch dispute:', err);
      setError('Failed to load dispute details.');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  // Initial fetch
  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dispute?.messages]);

  // Handle send message
  const handleSend = async () => {
    if (!message.trim() || sending || !dispute) return;

    const messageText = message.trim();
    setMessage('');
    setSending(true);

    try {
      await disputeApi.addMessage(disputeId, messageText);
      await fetchDispute();
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessage(messageText);
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Handle add evidence
  const handleAddEvidence = async () => {
    if (!evidenceUrl.trim() || addingEvidence || !dispute) return;

    setAddingEvidence(true);

    try {
      await disputeApi.addEvidence(disputeId, {
        type: evidenceType,
        url: evidenceUrl.trim(),
        description: evidenceDescription.trim(),
      });
      await fetchDispute();
      setShowEvidenceForm(false);
      setEvidenceUrl('');
      setEvidenceDescription('');
    } catch (err) {
      console.error('Failed to add evidence:', err);
      setError('Failed to add evidence.');
    } finally {
      setAddingEvidence(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
  if (error || !dispute) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-4', className)}>
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-600 text-center">{error || 'Dispute not found'}</p>
        <button onClick={onBack} className="mt-4 text-sm text-nilin-coral hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const statusConfig = getStatusConfig(dispute.status);
  const categoryConfig = getCategoryConfig(dispute.category);
  const canSendMessage = !['resolved', 'closed'].includes(dispute.status);

  return (
    <div className={cn('flex flex-col h-full bg-gray-50', className)}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back to Disputes
          </button>
        )}

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{categoryConfig.icon}</span>
              <span className="font-mono text-sm text-gray-500">{dispute.disputeNumber}</span>
              <span className={cn('text-xs px-2 py-1 rounded-full', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </span>
              {dispute.priority === 'urgent' && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Urgent
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-nilin-charcoal">{dispute.reason}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Booking Reference */}
        {dispute.bookingReference && (
          <div className="p-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-nilin-charcoal">Booking Details</h3>
                <span className="text-sm text-gray-500">{dispute.bookingReference.bookingNumber}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Service</p>
                  <p className="font-medium text-nilin-charcoal">{dispute.bookingReference.serviceName}</p>
                </div>
                <div>
                  <p className="text-gray-500">Amount</p>
                  <p className="font-medium text-nilin-charcoal">
                    {formatCurrency(dispute.bookingReference.totalAmount, dispute.bookingReference.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Scheduled</p>
                    <p className="font-medium text-nilin-charcoal">{formatDate(dispute.bookingReference.scheduledDate)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="px-4 pb-4">
          <CollapsibleSection title="Description" defaultOpen={true}>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
          </CollapsibleSection>
        </div>

        {/* Messages */}
        {dispute.messages && dispute.messages.length > 0 && (
          <div className="px-4 pb-4">
            <CollapsibleSection title="Messages" badge={dispute.messages.length} defaultOpen={true}>
              <div className="space-y-3">
                {dispute.messages.map((msg) => (
                  <MessageBubble key={msg._id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Evidence */}
        <div className="px-4 pb-4">
          <CollapsibleSection title="Evidence" badge={dispute.evidence.length} defaultOpen={false}>
            <div className="space-y-3">
              {dispute.evidence.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No evidence uploaded yet</p>
              ) : (
                dispute.evidence.map((ev) => <EvidenceCard key={ev._id} evidence={ev} />)
              )}

              {/* Add Evidence Button/Form */}
              {!showEvidenceForm ? (
                <button
                  onClick={() => setShowEvidenceForm(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-nilin-coral hover:text-nilin-coral transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Add Evidence
                </button>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-nilin-charcoal">Upload Evidence</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEvidenceType('image')}
                      className={cn(
                        'flex-1 py-2 text-sm rounded-lg border',
                        evidenceType === 'image'
                          ? 'border-nilin-coral bg-nilin-coral/10 text-nilin-coral'
                          : 'border-gray-200 text-gray-600'
                      )}
                    >
                      Image
                    </button>
                    <button
                      onClick={() => setEvidenceType('document')}
                      className={cn(
                        'flex-1 py-2 text-sm rounded-lg border',
                        evidenceType === 'document'
                          ? 'border-nilin-coral bg-nilin-coral/10 text-nilin-coral'
                          : 'border-gray-200 text-gray-600'
                      )}
                    >
                      Document
                    </button>
                  </div>
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="Enter URL to your file"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                  <input
                    type="text"
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    placeholder="Brief description (optional)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEvidenceForm(false)}
                      className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEvidence}
                      disabled={!evidenceUrl.trim() || addingEvidence}
                      className="flex-1 py-2 text-sm bg-nilin-coral text-white rounded-lg disabled:opacity-50"
                    >
                      {addingEvidence ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Upload'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* Resolution */}
        {dispute.resolution && (
          <div className="px-4 pb-4">
            <CollapsibleSection title="Resolution" defaultOpen={true}>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">
                      {getResolutionConfig(dispute.resolution.type).icon}{' '}
                      {getResolutionConfig(dispute.resolution.type).label}
                    </p>
                    {dispute.resolution.amount && (
                      <p className="text-sm text-green-600">
                        {formatCurrency(dispute.resolution.amount)}
                      </p>
                    )}
                  </div>
                </div>
                {dispute.resolution.reason && (
                  <p className="text-sm text-green-700">{dispute.resolution.reason}</p>
                )}
                <p className="text-xs text-green-600 mt-2">
                  Resolved on {formatDateTime(dispute.resolution.resolvedAt)}
                </p>
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Timeline */}
        <div className="px-4 pb-4">
          <CollapsibleSection title="Activity Timeline" defaultOpen={false}>
            <div>
              {dispute.timeline.map((item, index) => (
                <TimelineItem
                  key={index}
                  item={item}
                  isLast={index === dispute.timeline.length - 1}
                />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Message Input */}
      {canSendMessage && (
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-nilin-charcoal"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className={cn(
                'p-3 rounded-xl transition-all',
                message.trim() && !sending
                  ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white'
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
        </div>
      )}
    </div>
  );
};

export default DisputeDetail;
