import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Download,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  Zap,
  Shield,
  CreditCard,
  Building2,
  Calendar,
  TrendingUp,
  BarChart3,
  ArrowRight
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

interface ReconciliationItem {
  id: string;
  type: 'payment' | 'payout' | 'refund' | 'commission' | 'dispute';
  status: 'matched' | 'mismatch' | 'pending' | 'resolved';
  amount: number;
  currency: string;
  platformRef: string;
  externalRef: string;
  providerId?: string;
  providerName?: string;
  customerId?: string;
  customerName?: string;
  bookingId?: string;
  description: string;
  platformDate: string;
  externalDate?: string;
  discrepancy?: number;
  discrepancyReason?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

interface ReconciliationStats {
  totalTransactions: number;
  matched: number;
  mismatched: number;
  pending: number;
  resolved: number;
  totalAmount: number;
  discrepancyAmount: number;
  matchRate: number;
  avgResolutionTime: number;
  trend: Array<{ date: string; matched: number; mismatched: number }>;
  byType: Array<{ type: string; count: number; amount: number; color: string }>;
  recentDiscrepancies: Array<{ type: string; count: number; avgAmount: number }>;
}

interface ReconciliationEngineProps {
  embedded?: boolean;
  onClose?: () => void;
}

const STATUS_CONFIG = {
  matched: { label: 'Matched', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  mismatch: { label: 'Mismatch', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle }
};

const TYPE_CONFIG = {
  payment: { label: 'Payment', icon: CreditCard, color: '#3B82F6' },
  payout: { label: 'Payout', icon: DollarSign, color: '#10B981' },
  refund: { label: 'Refund', icon: RefreshCw, color: '#F59E0B' },
  commission: { label: 'Commission', icon: Building2, color: '#8B5CF6' },
  dispute: { label: 'Dispute', icon: Shield, color: '#EF4444' }
};

const formatCurrency = (amount: number, currency = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(amount);
};

export const ReconciliationEngine: React.FC<ReconciliationEngineProps> = ({
  embedded = false,
  onClose
}) => {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoReconcileLoading, setAutoReconcileLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/reconciliation');

      if (response.data?.success) {
        setItems(response.data.data.items || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching reconciliation data:', err);
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

  const handleAutoReconcile = async () => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setAutoReconcileLoading(true);
    try {
      // Simulate auto-reconciliation
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchData();
    } finally {
      setAutoReconcileLoading(false);
    }
  };

  const handleMarkResolved = async (itemId: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setActionLoading(itemId);
    try {
      await api.patch(`/admin/reconciliation/${itemId}`, { status: 'resolved' });
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: 'resolved', resolvedAt: new Date().toISOString() } : item
      ));
    } catch (err) {
      console.error('Error resolving item:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.platformRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.externalRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.providerName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <RefreshCw className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Reconciliation Data</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Reconciliation Engine</h2>
            <p className="text-sm text-nilin-warmGray mt-1">
              Auto-matching & discrepancy resolution
              {lastRun && <span className="ml-2">Last run: {new Date(lastRun).toLocaleTimeString()}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoReconcile}
            disabled={WIDGET_MUTATIONS_READ_ONLY || autoReconcileLoading}
            title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Run auto-reconciliation'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-md transition-colors text-sm font-medium"
          >
            {autoReconcileLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Auto-Reconcile
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Match Rate</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-serif text-green-600">{stats?.matchRate || 0}%</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Matched</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-serif text-nilin-charcoal">{stats?.matched || 0}</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Mismatched</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-serif text-red-600">{stats?.mismatched || 0}</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Pending</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-serif text-nilin-charcoal">{stats?.pending || 0}</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Discrepancy</span>
            <DollarSign className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-serif text-red-600">{formatCurrency(stats?.discrepancyAmount || 0)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Reconciliation Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Area type="monotone" dataKey="matched" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Matched" />
                <Area type="monotone" dataKey="mismatched" stroke="#EF4444" fill="#EF444420" strokeWidth={2} name="Mismatched" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Transaction Type</h3>
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
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.byType?.map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-nilin-warmGray flex-1">{item.type}</span>
                <span className="text-xs font-medium text-nilin-charcoal">{item.count}</span>
              </div>
            ))}
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
            placeholder="Search by reference or name..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="matched">Matched</option>
          <option value="mismatch">Mismatch</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="payment">Payment</option>
          <option value="payout">Payout</option>
          <option value="refund">Refund</option>
          <option value="commission">Commission</option>
          <option value="dispute">Dispute</option>
        </select>
      </div>

      {/* Reconciliation Items */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">All transactions are reconciled</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const statusConfig = STATUS_CONFIG[item.status];
            const typeConfig = TYPE_CONFIG[item.type];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={item.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all hover:shadow-md',
                  item.status === 'mismatch' ? 'border-red-200 bg-red-50/30' :
                  item.status === 'pending' ? 'border-amber-200 bg-amber-50/30' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', item.status === 'mismatch' ? 'bg-red-100' : 'bg-nilin-blush/30')}>
                    <typeConfig.icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{ borderColor: typeConfig.color, color: typeConfig.color }}>
                        {typeConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="ml-auto font-semibold text-nilin-charcoal">
                        {formatCurrency(item.amount, item.currency)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-2">
                      <div>
                        <span className="text-nilin-warmGray">Platform:</span>
                        <span className="ml-1 text-nilin-charcoal font-medium">{item.platformRef}</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">External:</span>
                        <span className="ml-1 text-nilin-charcoal font-medium">{item.externalRef}</span>
                      </div>
                      {item.customerName && (
                        <div>
                          <span className="text-nilin-warmGray">Customer:</span>
                          <span className="ml-1 text-nilin-charcoal font-medium">{item.customerName}</span>
                        </div>
                      )}
                      {item.providerName && (
                        <div>
                          <span className="text-nilin-warmGray">Provider:</span>
                          <span className="ml-1 text-nilin-charcoal font-medium">{item.providerName}</span>
                        </div>
                      )}
                    </div>
                    {item.discrepancy && item.discrepancy > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-red-600">Discrepancy: {formatCurrency(item.discrepancy, item.currency)}</span>
                        {item.discrepancyReason && (
                          <span className="text-nilin-warmGray">({item.discrepancyReason})</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'mismatch' && (
                      <button
                        onClick={() => handleMarkResolved(item.id)}
                        disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === item.id}
                        title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Mark resolved'}
                        className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        {actionLoading === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resolve'}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      <ChevronDown className={cn('w-4 h-4 text-nilin-warmGray transition-transform', selectedItem?.id === item.id && 'rotate-180')} />
                    </button>
                  </div>
                </div>
                {selectedItem?.id === item.id && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-nilin-warmGray">Description</p>
                        <p className="text-sm text-nilin-charcoal">{item.description}</p>
                      </div>
                      <div>
                        <p className="text-xs text-nilin-warmGray">Platform Date</p>
                        <p className="text-sm text-nilin-charcoal">{new Date(item.platformDate).toLocaleString()}</p>
                      </div>
                      {item.externalDate && (
                        <div>
                          <p className="text-xs text-nilin-warmGray">External Date</p>
                          <p className="text-sm text-nilin-charcoal">{new Date(item.externalDate).toLocaleString()}</p>
                        </div>
                      )}
                      {item.resolvedBy && (
                        <div>
                          <p className="text-xs text-nilin-warmGray">Resolved By</p>
                          <p className="text-sm text-nilin-charcoal">{item.resolvedBy}</p>
                        </div>
                      )}
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

export default ReconciliationEngine;
