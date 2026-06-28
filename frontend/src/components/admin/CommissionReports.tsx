import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Users,
  Building2,
  CreditCard,
  ArrowRight,
  ChevronDown,
  ChevronUp
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
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface CommissionReport {
  id: string;
  reportId: string;
  period: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  commissionRate: number;
  grossRevenue: number;
  commissionAmount: number;
  netPayable: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  refunds: number;
  adjustments: number;
  generatedAt: string;
  status: 'pending' | 'calculated' | 'approved' | 'paid';
}

interface CommissionStats {
  totalCommissionCollected: number;
  totalProviders: number;
  avgCommissionRate: number;
  pendingPayouts: number;
  avgProcessingTime: number;
  monthlyTrend: Array<{ month: string; collected: number; paid: number }>;
  byTier: Array<{ tier: string; count: number; commission: number; percentage: number; color: string }>;
  topCategories: Array<{ category: string; amount: number; bookings: number }>;
  totalRevenue: number;
  platformEarnings: number;
}

interface CommissionReportsProps {
  embedded?: boolean;
  onClose?: () => void;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  calculated: { label: 'Calculated', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', color: 'bg-purple-100 text-purple-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' }
};

const TIER_CONFIG = {
  bronze: { label: 'Bronze', color: '#CD7F32' },
  silver: { label: 'Silver', color: '#C0C0C0' },
  gold: { label: 'Gold', color: '#FFD700' },
  platinum: { label: 'Platinum', color: '#8B5CF6' }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
};

export const CommissionReports: React.FC<CommissionReportsProps> = ({
  embedded = false,
  onClose
}) => {
  const [reports, setReports] = useState<CommissionReport[]>([]);
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/commissions/reports');

      if (response.data?.success) {
        setReports(response.data.data.reports || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching commission data:', err);
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

  const handleExport = async (reportId: string, format: 'pdf' | 'csv' | 'json') => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsExporting(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          report.reportId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchesTier = tierFilter === 'all' || report.tier === tierFilter;
    return matchesSearch && matchesStatus && matchesTier;
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Commission Data</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Commission Reports</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Platform commission breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('all', 'pdf')}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-nilin-border rounded-xl hover:bg-nilin-blush/30 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
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
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatCurrency(stats?.totalCommissionCollected || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Total Commission</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{formatCurrency(stats?.platformEarnings || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Platform Earnings</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalProviders || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Providers</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pendingPayouts || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Pending Payouts</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <BarChart3 className="w-6 h-6 text-nilin-coral mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.avgCommissionRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray mt-1">Avg Commission</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Commission Trend */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Commission Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} formatter={(value: number) => formatCurrency(value)} />
                <defs>
                  <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="collected" stroke="#10B981" fill="url(#commissionGradient)" strokeWidth={2} name="Collected" />
                <Line type="monotone" dataKey="paid" stroke="#3B82F6" strokeWidth={2} name="Paid" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Tier */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Tier</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byTier || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="commission"
                  nameKey="tier"
                >
                  {stats?.byTier?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.byTier?.map(item => (
              <div key={item.tier} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-nilin-warmGray">{item.tier}</span>
                </div>
                <span className="text-xs font-medium text-nilin-charcoal">{item.count}</span>
              </div>
            ))}
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
            placeholder="Search reports..."
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
          <option value="calculated">Calculated</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Tiers</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-nilin-blush/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Report ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Tier</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Commission</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Net Payable</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nilin-border/50">
            {filteredReports.map(report => {
              const statusConfig = STATUS_CONFIG[report.status];
              const tierConfig = TIER_CONFIG[report.tier];

              return (
                <tr key={report.id} className="hover:bg-nilin-blush/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-nilin-charcoal">{report.reportId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-nilin-charcoal">{report.providerName}</p>
                    <p className="text-xs text-nilin-warmGray">{report.providerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: tierConfig.color }}>
                      {tierConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">
                    {formatCurrency(report.grossRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-nilin-coral font-medium">{formatCurrency(report.commissionAmount)}</span>
                    <span className="text-xs text-nilin-warmGray ml-1">({report.commissionRate}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {formatCurrency(report.netPayable)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                        className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                      >
                        {selectedReport?.id === report.id ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                      </button>
                      <button
                        onClick={() => handleExport(report.id, 'pdf')}
                        className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                      >
                        <Download className="w-4 h-4 text-nilin-warmGray" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedReport && (
        <div className="mt-6 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Report Details: {selectedReport.reportId}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-nilin-blush/30 rounded-xl text-center">
              <p className="text-xs text-nilin-warmGray">Total Bookings</p>
              <p className="text-xl font-serif text-nilin-charcoal">{selectedReport.totalBookings}</p>
            </div>
            <div className="p-4 bg-green-50/50 rounded-xl text-center">
              <p className="text-xs text-nilin-warmGray">Completed</p>
              <p className="text-xl font-serif text-green-600">{selectedReport.completedBookings}</p>
            </div>
            <div className="p-4 bg-red-50/50 rounded-xl text-center">
              <p className="text-xs text-nilin-warmGray">Cancelled</p>
              <p className="text-xl font-serif text-red-600">{selectedReport.cancelledBookings}</p>
            </div>
            <div className="p-4 bg-amber-50/50 rounded-xl text-center">
              <p className="text-xs text-nilin-warmGray">Refunds</p>
              <p className="text-xl font-serif text-amber-600">{selectedReport.refunds}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-green-50/30 rounded-xl">
            <div>
              <p className="text-sm text-nilin-warmGray">Gross Revenue</p>
              <p className="text-sm text-nilin-charcoal font-medium">{formatCurrency(selectedReport.grossRevenue)}</p>
            </div>
            <div>
              <p className="text-sm text-nilin-warmGray">- Commission ({selectedReport.commissionRate}%)</p>
              <p className="text-sm text-nilin-coral font-medium">{formatCurrency(selectedReport.commissionAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-nilin-warmGray">+ Adjustments</p>
              <p className="text-sm text-nilin-charcoal font-medium">{formatCurrency(selectedReport.adjustments)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-nilin-warmGray">Net Payable</p>
              <p className="text-xl font-serif text-green-600 font-bold">{formatCurrency(selectedReport.netPayable)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionReports;
