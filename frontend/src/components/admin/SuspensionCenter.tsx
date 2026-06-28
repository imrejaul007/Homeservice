import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertTriangle,
  User,
  Calendar,
  Shield,
  Unlock,
  Eye,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Ban as BanIcon,
  AlertCircle
} from 'lucide-react';
import Modal from '../../components/common/Modal';
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

interface SuspensionRecord {
  id: string;
  providerId: string;
  providerName: string;
  email: string;
  phone: string;
  type: 'temporary' | 'permanent';
  reason: string;
  category: 'policy_violation' | 'fraud' | 'safety' | 'quality' | 'non_compliance' | 'customer_complaint';
  status: 'active' | 'pending_appeal' | 'resolved' | 'expired';
  suspendedAt: string;
  expiresAt?: string;
  resolvedAt?: string;
  reviewerId?: string;
  reviewerName?: string;
  appeal?: {
    submittedAt: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedAt?: string;
    reviewNote?: string;
  };
  impact: {
    affectedBookings: number;
    affectedRevenue: number;
    affectedCustomers: number;
  };
  history: Array<{
    action: string;
    performedBy: string;
    performedAt: string;
    note?: string;
  }>;
}

interface SuspensionStats {
  totalSuspensions: number;
  activeSuspensions: number;
  temporarySuspensions: number;
  permanentSuspensions: number;
  pendingAppeals: number;
  resolvedThisMonth: number;
  avgSuspensionDuration: number;
  byCategory: Array<{ category: string; count: number; color: string }>;
  trend: Array<{ month: string; suspensions: number; resolutions: number }>;
  topReasons: Array<{ reason: string; count: number }>;
}

interface SuspensionCenterProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CATEGORY_CONFIG = {
  policy_violation: { label: 'Policy Violation', color: '#EF4444', bgColor: 'bg-red-100' },
  fraud: { label: 'Fraud', color: '#DC2626', bgColor: 'bg-red-200' },
  safety: { label: 'Safety', color: '#B91C1C', bgColor: 'bg-red-100' },
  quality: { label: 'Quality Issues', color: '#F59E0B', bgColor: 'bg-amber-100' },
  non_compliance: { label: 'Non-Compliance', color: '#8B5CF6', bgColor: 'bg-purple-100' },
  customer_complaint: { label: 'Customer Complaint', color: '#EC4899', bgColor: 'bg-pink-100' }
};

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-red-100 text-red-700', icon: BanIcon },
  pending_appeal: { label: 'Pending Appeal', color: 'bg-amber-100 text-amber-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700', icon: XCircle }
};

const TYPE_CONFIG = {
  temporary: { label: 'Temporary', color: 'bg-amber-100 text-amber-700' },
  permanent: { label: 'Permanent', color: 'bg-red-100 text-red-700' }
};

export const SuspensionCenter: React.FC<SuspensionCenterProps> = ({
  embedded = false,
  onClose
}) => {
  const [suspensions, setSuspensions] = useState<SuspensionRecord[]>([]);
  const [stats, setStats] = useState<SuspensionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedSuspension, setSelectedSuspension] = useState<SuspensionRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNewSuspension, setShowNewSuspension] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: 'warning' | 'danger';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'warning',
    onConfirm: () => {},
  });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/suspensions');

      if (response.data?.success) {
        setSuspensions(response.data.data.suspensions || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching suspension data:', err);
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

  const handleReinstate = async (suspensionId: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    // Show confirmation modal before reinstating
    setConfirmModal({
      open: true,
      title: 'Reinstate Provider',
      message: 'Are you sure you want to reinstate this provider? They will regain access to their account.',
      confirmText: 'Reinstate',
      cancelText: 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        setActionLoading(suspensionId);
        try {
          await api.patch(`/admin/suspensions/${suspensionId}`, { status: 'resolved' });
          setSuspensions(prev => prev.map(s =>
            s.id === suspensionId ? { ...s, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : s
          ));
          toast.success('Provider reinstated successfully');
        } catch (err) {
          console.error('Error reinstating provider:', err);
          toast.error(err instanceof Error ? err.message : 'Failed to reinstate provider. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleReviewAppeal = async (suspensionId: string, approved: boolean, note: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    // Show confirmation modal before reviewing appeal
    setConfirmModal({
      open: true,
      title: approved ? 'Approve Appeal' : 'Reject Appeal',
      message: approved
        ? 'Are you sure you want to approve this appeal? The provider will be reinstated.'
        : 'Are you sure you want to reject this appeal? The suspension will remain active.',
      confirmText: approved ? 'Approve' : 'Reject',
      cancelText: 'Cancel',
      variant: approved ? 'warning' : 'danger',
      onConfirm: async () => {
        setActionLoading(suspensionId);
        try {
          await api.patch(`/admin/suspensions/${suspensionId}/appeal`, { approved, note });
          setSuspensions(prev => prev.map(s =>
            s.id === suspensionId ? {
              ...s,
              status: approved ? 'resolved' as const : 'active' as const,
              appeal: { ...s.appeal!, status: approved ? 'approved' : 'rejected', reviewedAt: new Date().toISOString(), reviewNote: note }
            } : s
          ));
          toast.success(`Appeal ${approved ? 'approved' : 'rejected'} successfully`);
        } catch (err) {
          console.error('Error reviewing appeal:', err);
          toast.error(err instanceof Error ? err.message : 'Failed to review appeal. Please try again.');
        } finally {
          setActionLoading(null);
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      },
    });
  };

  const filteredSuspensions = suspensions.filter(s => {
    const matchesSearch = s.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
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
          <Ban className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Suspension Data</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Suspension Center</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Manage provider suspensions and appeals</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewSuspension(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium"
          >
            <BanIcon className="w-4 h-4" />
            New Suspension
          </button>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <BanIcon className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.activeSuspensions || 0}</p>
          <p className="text-xs text-nilin-warmGray">Active</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pendingAppeals || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending Appeals</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.resolvedThisMonth || 0}</p>
          <p className="text-xs text-nilin-warmGray">Resolved</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.avgSuspensionDuration || 0}</p>
          <p className="text-xs text-nilin-warmGray">Avg Days</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Suspension Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="suspensions" fill="#EF4444" name="Suspensions" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolutions" fill="#10B981" name="Resolutions" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Category</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byCategory || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="category"
                >
                  {stats?.byCategory?.map((entry, index) => (
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
            placeholder="Search suspensions..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending_appeal">Pending Appeal</option>
          <option value="resolved">Resolved</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Categories</option>
          <option value="customer_complaint">Customer Complaint</option>
          <option value="policy_violation">Policy Violation</option>
          <option value="fraud">Fraud</option>
          <option value="quality">Quality Issues</option>
          <option value="non_compliance">Non-Compliance</option>
          <option value="safety">Safety</option>
        </select>
      </div>

      {/* Suspensions List */}
      <div className="space-y-4">
        {filteredSuspensions.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No suspensions match your filters</p>
          </div>
        ) : (
          filteredSuspensions.map(suspension => {
            const categoryConfig = CATEGORY_CONFIG[suspension.category];
            const statusConfig = STATUS_CONFIG[suspension.status];
            const typeConfig = TYPE_CONFIG[suspension.type];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedSuspension?.id === suspension.id;

            return (
              <div
                key={suspension.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  suspension.status === 'active' ? 'border-red-200 bg-red-50/30' :
                  suspension.status === 'pending_appeal' ? 'border-amber-200 bg-amber-50/30' :
                  suspension.status === 'resolved' ? 'border-green-200/50' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-100">
                    <BanIcon className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{suspension.providerName}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', typeConfig.color)}>
                        {typeConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: categoryConfig.bgColor, color: categoryConfig.color }}>
                        {categoryConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-nilin-warmGray">{suspension.reason}</p>
                    <div className="flex items-center gap-4 text-xs text-nilin-warmGray mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Suspended: {new Date(suspension.suspendedAt).toLocaleDateString()}
                      </span>
                      {suspension.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {suspension.status === 'resolved' ? 'Ended' : 'Expires'}: {new Date(suspension.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {suspension.status !== 'resolved' && (
                        <span>Impact: {suspension.impact.affectedBookings} bookings, AED {suspension.impact.affectedRevenue.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {suspension.status === 'active' && (
                      <button
                        onClick={() => handleReinstate(suspension.id)}
                        disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === suspension.id}
                        title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Reinstate provider'}
                        className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}
                    {suspension.status === 'pending_appeal' && (
                      <>
                        <button
                          onClick={() => handleReviewAppeal(suspension.id, true, 'Appeal approved')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === suspension.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Approve appeal'}
                          className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReviewAppeal(suspension.id, false, 'Appeal rejected')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === suspension.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Reject appeal'}
                          className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedSuspension(isSelected ? null : suspension)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Appeal Section */}
                      {suspension.appeal && (
                        <div>
                          <h4 className="text-sm font-medium text-nilin-charcoal mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-amber-500" />
                            Appeal Details
                          </h4>
                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                            <p className="text-sm text-nilin-charcoal mb-2">
                              <strong>Submitted:</strong> {new Date(suspension.appeal.submittedAt).toLocaleString()}
                            </p>
                            <p className="text-sm text-nilin-warmGray mb-2">
                              <strong>Reason:</strong> {suspension.appeal.reason}
                            </p>
                            {suspension.appeal.reviewedAt && (
                              <div className="mt-2 pt-2 border-t border-amber-200">
                                <p className="text-sm text-nilin-charcoal">
                                  <strong>Status:</strong> {suspension.appeal.status === 'approved' ? 'Approved' : 'Rejected'}
                                </p>
                                {suspension.appeal.reviewNote && (
                                  <p className="text-sm text-nilin-warmGray mt-1">{suspension.appeal.reviewNote}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* History Section */}
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">History</h4>
                        <div className="space-y-2">
                          {suspension.history.map((entry, index) => (
                            <div key={index} className="flex items-start gap-3 text-sm">
                              <div className="w-2 h-2 rounded-full bg-nilin-coral mt-1.5" />
                              <div>
                                <p className="text-nilin-charcoal">{entry.action}</p>
                                <p className="text-xs text-nilin-warmGray">
                                  {entry.performedBy} - {new Date(entry.performedAt).toLocaleString()}
                                </p>
                                {entry.note && <p className="text-xs text-nilin-warmGray mt-1 italic">{entry.note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={confirmModal.open}
        onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
        title={confirmModal.title}
        description={confirmModal.message}
        size="sm"
      >
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
            className="px-4 py-2 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
          >
            {confirmModal.cancelText}
          </button>
          <button
            onClick={confirmModal.onConfirm}
            disabled={!!actionLoading}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              confirmModal.variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600',
              actionLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
            ) : null}
            {confirmModal.confirmText}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default SuspensionCenter;
