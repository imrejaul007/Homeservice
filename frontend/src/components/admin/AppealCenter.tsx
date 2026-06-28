import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  User,
  Calendar,
  AlertCircle,
  Scale,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

/** Mutation endpoints are not implemented for this widget — actions are read-only. */
const WIDGET_MUTATIONS_READ_ONLY = true;

interface Appeal {
  id: string;
  appealNumber: string;
  type: 'provider_suspension' | 'account_termination' | 'review_removal' | 'payout_dispute' | 'policy_violation';
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  appellantId: string;
  appellantName: string;
  appellantEmail: string;
  appellantType: 'provider' | 'customer';
  subject: string;
  description: string;
  originalDecision: string;
  originalDecisionDate: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerNote?: string;
  evidence: Array<{
    id: string;
    type: 'document' | 'image' | 'screenshot';
    name: string;
    url: string;
    uploadedAt: string;
  }>;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: 'appellant' | 'admin' | 'system';
    message: string;
    timestamp: string;
  }>;
  decision?: {
    outcome: 'upheld' | 'overturned' | 'compromised';
    summary: string;
    conditions?: string[];
  };
}

interface AppealStats {
  totalAppeals: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  avgReviewTime: number;
  approvalRate: number;
  byType: Array<{ type: string; count: number; color: string }>;
  trend: Array<{ week: string; submitted: number; resolved: number }>;
  avgResolutionTime: number;
}

interface AppealCenterProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TYPE_CONFIG = {
  provider_suspension: { label: 'Provider Suspension', color: '#EF4444', bgColor: 'bg-red-100' },
  account_termination: { label: 'Account Termination', color: '#DC2626', bgColor: 'bg-red-200' },
  review_removal: { label: 'Review Removal', color: '#F59E0B', bgColor: 'bg-amber-100' },
  payout_dispute: { label: 'Payout Dispute', color: '#3B82F6', bgColor: 'bg-blue-100' },
  policy_violation: { label: 'Policy Violation', color: '#8B5CF6', bgColor: 'bg-purple-100' }
};

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: FileText },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-700', icon: AlertCircle }
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' }
};

const OUTCOME_CONFIG = {
  upheld: { label: 'Upheld', color: 'bg-red-100 text-red-700' },
  overturned: { label: 'Overturned', color: 'bg-green-100 text-green-700' },
  compromised: { label: 'Compromised', color: 'bg-amber-100 text-amber-700' }
};

export const AppealCenter: React.FC<AppealCenterProps> = ({
  embedded = false,
  onClose
}) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [stats, setStats] = useState<AppealStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/appeals');

      if (response.data?.success) {
        setAppeals(response.data.data.appeals || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      setError(getAdminFetchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleUpdateStatus = async (appealId: string, newStatus: Appeal['status'], note?: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setActionLoading(appealId);
    try {
      await api.patch(`/admin/appeals/${appealId}`, { status: newStatus, reviewerNote: note });
      setAppeals(prev => prev.map(a =>
        a.id === appealId ? { ...a, status: newStatus, reviewedAt: new Date().toISOString() } : a
      ));
    } catch (err) {
      // Error state is handled by the parent component
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedAppeal || !newMessage.trim()) return;

    const message = {
      id: `m${Date.now()}`,
      senderId: 'admin',
      senderName: 'Admin',
      senderRole: 'admin' as const,
      message: newMessage,
      timestamp: new Date().toISOString()
    };

    setAppeals(prev => prev.map(a =>
      a.id === selectedAppeal.id ? { ...a, messages: [...a.messages, message] } : a
    ));
    setSelectedAppeal(prev => prev ? { ...prev, messages: [...prev.messages, message] } : null);
    setNewMessage('');
  };

  const filteredAppeals = appeals.filter(appeal => {
    const matchesSearch =
      appeal.appealNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appeal.appellantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appeal.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || appeal.status === statusFilter;
    const matchesType = typeFilter === 'all' || appeal.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Appeals</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Appeal Center</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Review and manage appeals workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <XCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <FileText className="w-6 h-6 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalAppeals || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Appeals</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pendingReview || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending Review</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.approved || 0}</p>
          <p className="text-xs text-nilin-warmGray">Approved</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.rejected || 0}</p>
          <p className="text-xs text-nilin-warmGray">Rejected</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <ThumbsUp className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.approvalRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Approval Rate</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Appeal Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Line type="monotone" dataKey="submitted" stroke="#3B82F6" strokeWidth={2} name="Submitted" />
                <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Type</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byType || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="type"
                >
                  {stats?.byType?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search appeals..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="provider_suspension">Provider Suspension</option>
          <option value="account_termination">Account Termination</option>
          <option value="review_removal">Review Removal</option>
          <option value="payout_dispute">Payout Dispute</option>
          <option value="policy_violation">Policy Violation</option>
        </select>
      </div>

      {/* Appeals List */}
      <div className="space-y-4">
        {filteredAppeals.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No appeals match your filters</p>
          </div>
        ) : (
          filteredAppeals.map(appeal => {
            const typeConfig = TYPE_CONFIG[appeal.type];
            const statusConfig = STATUS_CONFIG[appeal.status];
            const priorityConfig = PRIORITY_CONFIG[appeal.priority];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedAppeal?.id === appeal.id;

            return (
              <div
                key={appeal.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  appeal.status === 'submitted' ? 'border-blue-200 bg-blue-50/30' :
                  appeal.status === 'under_review' ? 'border-amber-200 bg-amber-50/30' :
                  appeal.status === 'approved' ? 'border-green-200/50' :
                  appeal.status === 'rejected' ? 'border-red-200/50' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', typeConfig.bgColor)}>
                    <FileText className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-nilin-warmGray">{appeal.appealNumber}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', priorityConfig.color)}>
                        {priorityConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-nilin-blush text-nilin-charcoal capitalize">
                        {appeal.appellantType}
                      </span>
                    </div>
                    <p className="font-medium text-nilin-charcoal">{appeal.subject}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {appeal.appellantName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Submitted: {new Date(appeal.submittedAt).toLocaleDateString()}
                      </span>
                      {appeal.messages.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {appeal.messages.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(appeal.status === 'submitted' || appeal.status === 'under_review') && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(appeal.id, 'under_review')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === appeal.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Start review'}
                          className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Review
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedAppeal(isSelected ? null : appeal)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Description</h4>
                        <p className="text-sm text-nilin-warmGray mb-4">{appeal.description}</p>

                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Original Decision</h4>
                        <p className="text-sm text-nilin-warmGray mb-4">{appeal.originalDecision}</p>

                        {appeal.decision && (
                          <div className={cn(
                            'p-4 rounded-xl mb-4',
                            appeal.decision.outcome === 'overturned' ? 'bg-green-50 border border-green-200' :
                            appeal.decision.outcome === 'upheld' ? 'bg-red-50 border border-red-200' :
                            'bg-amber-50 border border-amber-200'
                          )}>
                            <p className="text-sm font-medium text-nilin-charcoal">
                              Decision: <span className={cn('px-2 py-0.5 rounded text-xs font-medium', OUTCOME_CONFIG[appeal.decision.outcome].color)}>
                                {OUTCOME_CONFIG[appeal.decision.outcome].label}
                              </span>
                            </p>
                            <p className="text-sm text-nilin-warmGray mt-2">{appeal.decision.summary}</p>
                          </div>
                        )}

                        {appeal.evidence.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Evidence</h4>
                            <div className="space-y-2">
                              {appeal.evidence.map(ev => (
                                <div key={ev.id} className="flex items-center gap-2 p-2 bg-nilin-blush/30 rounded-lg">
                                  <FileText className="w-4 h-4 text-nilin-coral" />
                                  <span className="text-sm text-nilin-charcoal">{ev.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Messages</h4>
                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                          {appeal.messages.length === 0 ? (
                            <p className="text-sm text-nilin-warmGray italic">No messages yet</p>
                          ) : (
                            appeal.messages.map(msg => (
                              <div key={msg.id} className={cn(
                                'p-3 rounded-xl text-sm',
                                msg.senderRole === 'admin' ? 'bg-blue-50 ml-4' :
                                msg.senderRole === 'appellant' ? 'bg-nilin-blush/30 mr-4' :
                                'bg-gray-50'
                              )}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-nilin-charcoal">{msg.senderName}</span>
                                  <span className="text-xs text-nilin-warmGray">{new Date(msg.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-nilin-charcoal">{msg.message}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {appeal.status !== 'approved' && appeal.status !== 'rejected' && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Type a message..."
                              className="flex-1 px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={!newMessage.trim()}
                              className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AppealCenter;
