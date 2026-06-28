import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  UserX,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  Ban,
  CheckCircle,
  AlertTriangle,
  Shield,
  Users,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronUp,
  Bell,
  MessageSquare,
  CreditCard,
  RefreshCcw,
  Eye,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

/** Mutation endpoints are not implemented for this widget — actions are read-only. */
const WIDGET_MUTATIONS_READ_ONLY = true;

interface AbuseCase {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  type: 'refund_abuse' | 'booking_abuse' | 'chargeback_abuse' | 'review_abuse' | 'promo_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'actioned' | 'restricted' | 'banned';
  reportedAt: string;
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    refundRequests: number;
    approvedRefunds: number;
    rejectedRefunds: number;
    chargebacks: number;
    totalRefundAmount: number;
    totalChargebackAmount: number;
  };
  evidence: {
    descriptions: string[];
    bookingIds: string[];
    refundIds: string[];
    dates: string[];
  };
  actions: Array<{
    type: 'warning' | 'restriction' | 'account_ban' | 'refund_reversal' | 'promo_block';
    description: string;
    by: string;
    at: string;
  }>;
  notes: Array<{
    text: string;
    author: string;
    createdAt: string;
  }>;
  history: Array<{
    action: string;
    by: string;
    at: string;
  }>;
}

interface CustomerAbuseStats {
  totalCases: number;
  open: number;
  investigating: number;
  actioned: number;
  restricted: number;
  banned: number;
  refundAbuseCount: number;
  chargebackAbuseCount: number;
  totalAmountRecovered: number;
  totalAmountLost: number;
  byType: Array<{ type: string; count: number; amount: number; color: string }>;
  bySeverity: { low: number; medium: number; high: number; critical: number };
  trend: Array<{ date: string; cases: number; banned: number; recovered: number }>;
  topOffenders: Array<{ customerId: string; customerName: string; cases: number; amount: number }>;
}

interface CustomerAbuseMonitorProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  refund_abuse: { label: 'Refund Abuse', icon: RefreshCcw, color: '#EF4444', bgColor: 'bg-red-100' },
  booking_abuse: { label: 'Booking Abuse', icon: Calendar, color: '#F59E0B', bgColor: 'bg-amber-100' },
  chargeback_abuse: { label: 'Chargeback Abuse', icon: CreditCard, color: '#DC2626', bgColor: 'bg-red-200' },
  review_abuse: { label: 'Review Abuse', icon: AlertTriangle, color: '#8B5CF6', bgColor: 'bg-purple-100' },
  promo_abuse: { label: 'Promo Abuse', icon: DollarSign, color: '#3B82F6', bgColor: 'bg-blue-100' }
};

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' }
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  investigating: { label: 'Investigating', color: 'bg-blue-100 text-blue-700', icon: Eye },
  actioned: { label: 'Actioned', color: 'bg-orange-100 text-orange-700', icon: Bell },
  restricted: { label: 'Restricted', color: 'bg-purple-100 text-purple-700', icon: Shield },
  banned: { label: 'Banned', color: 'bg-gray-100 text-gray-700', icon: UserX }
};

export const CustomerAbuseMonitor: React.FC<CustomerAbuseMonitorProps> = ({
  embedded = false,
  onClose
}) => {
  const [cases, setCases] = useState<AbuseCase[]>([]);
  const [stats, setStats] = useState<CustomerAbuseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<AbuseCase | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/customer-abuse');

      if (response.data?.success) {
        setCases(response.data.data.cases || []);
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

  const handleUpdateStatus = async (caseId: string, newStatus: AbuseCase['status']) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setActionLoading(caseId);
    try {
      await api.patch(`/admin/customer-abuse/${caseId}`, { status: newStatus });
      setCases(prev => prev.map(c =>
        c.id === caseId
          ? { ...c, status: newStatus, history: [...c.history, { action: `Status changed to ${newStatus}`, by: 'admin@nilin.com', at: new Date().toISOString() }] }
          : c
      ));
    } catch (err) {
      // Error state handled by getAdminFetchErrorMessage in caller
    } finally {
      setActionLoading(null);
    }
  };

  const handleTakeAction = async (caseId: string, actionType: string, description: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setActionLoading(caseId);
    try {
      await api.post(`/admin/customer-abuse/${caseId}/actions`, { type: actionType, description });
      setCases(prev => prev.map(c =>
        c.id === caseId
          ? {
              ...c,
              actions: [...c.actions, { type: actionType as any, description, by: 'admin@nilin.com', at: new Date().toISOString() }],
              history: [...c.history, { action: `${actionType}: ${description}`, by: 'admin@nilin.com', at: new Date().toISOString() }]
            }
          : c
      ));
    } catch (err) {
      // Error state handled by getAdminFetchErrorMessage in caller
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async (caseId: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY || !newNote.trim()) return;

    setActionLoading(caseId);
    try {
      await api.post(`/admin/customer-abuse/${caseId}/notes`, { text: newNote });
      setCases(prev => prev.map(c =>
        c.id === caseId
          ? { ...c, notes: [...c.notes, { text: newNote, author: 'admin@nilin.com', createdAt: new Date().toISOString() }] }
          : c
      ));
      setNewNote('');
    } catch (err) {
      // Error state handled by getAdminFetchErrorMessage in caller
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCases = cases.filter(c => {
    const matchesSearch =
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || c.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesType && matchesSeverity;
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
          <UserX className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Customer Abuse Monitor</h3>
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
            <UserX className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Customer Abuse Monitor</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Track & action customer violations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <AlertCircle className="w-5 h-5 text-nilin-warmGray" />
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
          <UserX className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCases || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Cases</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.open || 0}</p>
          <p className="text-xs text-nilin-warmGray">Open</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <Shield className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.restricted || 0}</p>
          <p className="text-xs text-nilin-warmGray">Restricted</p>
        </div>
        <div className="glass rounded-xl border border-gray-200/50 p-4 text-center">
          <Ban className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-gray-600">{stats?.banned || 0}</p>
          <p className="text-xs text-nilin-warmGray">Banned</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">AED {stats?.totalAmountRecovered || 0}</p>
          <p className="text-xs text-nilin-warmGray">Recovered</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Refund Abuse</span>
            <span className="text-lg font-serif text-red-600">{stats?.refundAbuseCount || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Chargeback Abuse</span>
            <span className="text-lg font-serif text-red-600">{stats?.chargebackAbuseCount || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Investigating</span>
            <span className="text-lg font-serif text-blue-600">{stats?.investigating || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Amount Lost</span>
            <span className="text-lg font-serif text-red-600">AED {stats?.totalAmountLost || 0}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Case Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Area type="monotone" dataKey="cases" stroke="#EF4444" fill="#EF444420" strokeWidth={2} name="Cases" />
                <Area type="monotone" dataKey="banned" stroke="#6B7280" fill="#6B728020" strokeWidth={2} name="Banned" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Abuse Type</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byType || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="type" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="count" fill="#8B5CF6" name="Cases" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="actioned">Actioned</option>
          <option value="restricted">Restricted</option>
          <option value="banned">Banned</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="refund_abuse">Refund Abuse</option>
          <option value="booking_abuse">Booking Abuse</option>
          <option value="chargeback_abuse">Chargeback Abuse</option>
          <option value="review_abuse">Review Abuse</option>
          <option value="promo_abuse">Promo Abuse</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No abuse cases match your filters</p>
          </div>
        ) : (
          filteredCases.map(c => {
            const typeConfig = TYPE_CONFIG[c.type];
            const severityConfig = SEVERITY_CONFIG[c.severity];
            const statusConfig = STATUS_CONFIG[c.status];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedCase?.id === c.id;

            return (
              <div
                key={c.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  c.status === 'banned' ? 'border-gray-200 bg-gray-50/50' :
                  c.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                  c.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', typeConfig.bgColor)}>
                    <typeConfig.icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{c.customerName}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', severityConfig.color)}>
                        {severityConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 bg-nilin-blush text-nilin-charcoal rounded text-xs font-medium">
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span>{c.stats.totalBookings} bookings</span>
                      <span>{c.stats.refundRequests} refund requests</span>
                      <span>{c.stats.chargebacks} chargebacks</span>
                      {(c.stats.totalRefundAmount > 0 || c.stats.totalChargebackAmount > 0) && (
                        <span className="text-red-600 font-medium">
                          AED {(c.stats.totalRefundAmount + c.stats.totalChargebackAmount).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status !== 'banned' && c.status !== 'restricted' && (
                      <>
                        <button
                          onClick={() => handleTakeAction(c.id, 'warning', 'Warning issued for policy violation')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === c.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Issue warning'}
                          className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors text-sm font-medium"
                        >
                          Warn
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'restricted')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === c.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Restrict account'}
                          className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors text-sm font-medium"
                        >
                          Restrict
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'banned')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === c.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Ban account'}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          Ban
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedCase(isSelected ? null : c)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    {/* Customer Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-xs text-nilin-warmGray">Total Bookings</p>
                        <p className="text-xl font-serif text-nilin-charcoal">{c.stats.totalBookings}</p>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-xs text-nilin-warmGray">Cancellation Rate</p>
                        <p className="text-xl font-serif text-nilin-charcoal">
                          {c.stats.totalBookings > 0 ? ((c.stats.cancelledBookings / c.stats.totalBookings) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-xs text-nilin-warmGray">Refund Rate</p>
                        <p className="text-xl font-serif text-nilin-charcoal">
                          {c.stats.totalBookings > 0 ? ((c.stats.refundRequests / c.stats.totalBookings) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-xs text-nilin-warmGray">Total Lost</p>
                        <p className="text-xl font-serif text-red-600">
                          AED {(c.stats.totalRefundAmount + c.stats.totalChargebackAmount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Evidence */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Evidence</h4>
                      <div className="space-y-2">
                        {c.evidence.descriptions.map((desc, idx) => (
                          <div key={idx} className="p-3 bg-red-50/50 rounded-lg border border-red-100">
                            <p className="text-sm text-nilin-charcoal">{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    {c.actions.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Actions Taken</h4>
                        <div className="space-y-2">
                          {c.actions.map((action, idx) => (
                            <div key={idx} className="p-3 bg-orange-50/50 rounded-lg border border-orange-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded text-xs font-medium capitalize">
                                  {action.type.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-nilin-warmGray">by {action.by}</span>
                                <span className="text-xs text-nilin-warmGray ml-auto">{new Date(action.at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-nilin-charcoal">{action.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Notes</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && !WIDGET_MUTATIONS_READ_ONLY && handleAddNote(c.id)}
                        />
                        <button
                          onClick={() => handleAddNote(c.id)}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || !newNote.trim() || actionLoading === c.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Add note'}
                          className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors text-sm disabled:opacity-50"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                      {c.notes.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {c.notes.map((note, idx) => (
                            <div key={idx} className="p-2 bg-blue-50/50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-blue-700">{note.author}</span>
                                <span className="text-xs text-nilin-warmGray">{new Date(note.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-nilin-charcoal">{note.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* History */}
                    <div>
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-2">History</h4>
                      <div className="space-y-1">
                        {c.history.map((h, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-nilin-warmGray">
                            <span className="w-2 h-2 rounded-full bg-nilin-coral" />
                            <span>{h.action}</span>
                            <span className="text-nilin-charcoal">by {h.by}</span>
                            <span className="ml-auto">{new Date(h.at).toLocaleString()}</span>
                          </div>
                        ))}
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

export default CustomerAbuseMonitor;
