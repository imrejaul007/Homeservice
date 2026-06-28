import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  CreditCard,
  Users
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Treemap
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface RefundData {
  id: string;
  refundId: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  amount: number;
  refundAmount: number;
  refundPercentage: number;
  reason: string;
  category: 'customer_request' | 'service_issue' | 'provider_cancellation' | 'quality_issue' | 'no_show' | 'other';
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  requestDate: string;
  processedDate?: string;
  processingTime: number;
  paymentMethod: string;
}

interface RefundStats {
  totalRefunds: number;
  totalAmount: number;
  pendingCount: number;
  avgProcessingTime: number;
  refundRate: number;
  approvalRate: number;
  rejectionRate: number;
  monthlyTrend: Array<{ month: string; count: number; amount: number; rate: number }>;
  byCategory: Array<{ category: string; count: number; amount: number; color: string }>;
  byStatus: Array<{ status: string; count: number; color: string }>;
  topReasons: Array<{ reason: string; count: number; percentage: number }>;
  avgRefundAmount: number;
  highestRefund: number;
  lowestRefund: number;
}

interface RefundAnalyticsProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CATEGORY_CONFIG = {
  customer_request: { label: 'Customer Request', color: '#3B82F6', bgColor: 'bg-blue-100' },
  service_issue: { label: 'Service Issue', color: '#EF4444', bgColor: 'bg-red-100' },
  provider_cancellation: { label: 'Provider Cancellation', color: '#F59E0B', bgColor: 'bg-amber-100' },
  quality_issue: { label: 'Quality Issue', color: '#8B5CF6', bgColor: 'bg-purple-100' },
  no_show: { label: 'No Show', color: '#DC2626', bgColor: 'bg-red-200' },
  other: { label: 'Other', color: '#6B7280', bgColor: 'bg-gray-100' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
};

export const RefundAnalytics: React.FC<RefundAnalyticsProps> = ({
  embedded = false,
  onClose
}) => {
  const [refunds, setRefunds] = useState<RefundData[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRefund, setSelectedRefund] = useState<RefundData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/refunds/analytics');

      if (response.data?.success) {
        setRefunds(response.data.data.refunds || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching refund data:', err);
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

  const filteredRefunds = refunds.filter(refund => {
    const matchesSearch = refund.refundId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          refund.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          refund.providerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || refund.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || refund.category === categoryFilter;
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
          <DollarSign className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Refund Data</h3>
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
            <RefreshCw className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Refund Analytics</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Track refund trends and patterns</p>
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
          <DollarSign className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{formatCurrency(stats?.totalAmount || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Refunds</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pendingCount || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.approvalRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Approval Rate</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <BarChart3 className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{formatCurrency(stats?.avgRefundAmount || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Avg Refund</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.refundRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Refund Rate</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Refund Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <defs>
                  <linearGradient id="refundGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area yAxisId="left" type="monotone" dataKey="amount" stroke="#EF4444" fill="url(#refundGradient)" strokeWidth={2} name="Amount (AED)" />
                <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#F59E0B" strokeWidth={2} name="Rate (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Status */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byStatus || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="status"
                >
                  {stats?.byStatus?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.byStatus?.map(item => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-nilin-warmGray">{item.status}</span>
                </div>
                <span className="text-xs font-medium text-nilin-charcoal">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Reasons */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Top Refund Reasons</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats?.topReasons?.map((item, index) => (
            <div key={item.reason} className="p-4 bg-nilin-blush/30 rounded-xl text-center">
              <p className="text-2xl font-serif text-nilin-coral">{item.count}</p>
              <p className="text-xs text-nilin-warmGray mt-1">{item.reason}</p>
              <p className="text-xs text-nilin-charcoal font-medium mt-1">{item.percentage}%</p>
            </div>
          ))}
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
            placeholder="Search refunds..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Categories</option>
          <option value="quality_issue">Quality Issue</option>
          <option value="service_issue">Service Issue</option>
          <option value="customer_request">Customer Request</option>
          <option value="provider_cancellation">Provider Cancellation</option>
          <option value="no_show">No Show</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Refunds Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-nilin-blush/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Refund ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nilin-border/50">
            {filteredRefunds.map(refund => {
              const categoryConfig = CATEGORY_CONFIG[refund.category];
              const statusConfig = STATUS_CONFIG[refund.status];
              const StatusIcon = statusConfig.icon;

              return (
                <tr
                  key={refund.id}
                  className="hover:bg-nilin-blush/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedRefund(selectedRefund?.id === refund.id ? null : refund)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-nilin-charcoal">{refund.refundId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-nilin-charcoal">{refund.customerName}</p>
                    <p className="text-xs text-nilin-warmGray">{refund.serviceName}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-nilin-warmGray">
                    {refund.providerName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', categoryConfig.bgColor)} style={{ color: categoryConfig.color }}>
                      {categoryConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold text-nilin-charcoal">{formatCurrency(refund.refundAmount)}</p>
                    <p className="text-xs text-nilin-warmGray">of {formatCurrency(refund.amount)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', statusConfig.color)}>
                      <StatusIcon className="w-3 h-3 inline mr-1" />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-nilin-warmGray">
                    {new Date(refund.requestDate).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRefund && (
        <div className="mt-6 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Refund Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-nilin-warmGray">Booking ID</p>
              <p className="text-sm text-nilin-charcoal font-medium">{selectedRefund.bookingId}</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Processing Time</p>
              <p className="text-sm text-nilin-charcoal font-medium">{selectedRefund.processingTime} hours</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Payment Method</p>
              <p className="text-sm text-nilin-charcoal font-medium">{selectedRefund.paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Refund Percentage</p>
              <p className="text-sm text-nilin-charcoal font-medium">{selectedRefund.refundPercentage}%</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-nilin-warmGray mb-1">Reason</p>
            <p className="text-sm text-nilin-charcoal">{selectedRefund.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundAnalytics;
