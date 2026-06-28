import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  CheckCircle,
  Clock,
  Globe,
  Building2,
  Receipt,
  ChevronDown,
  ChevronUp
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

interface TaxReport {
  id: string;
  period: string;
  type: 'VAT' | 'GST' | 'Withholding';
  jurisdiction: string;
  taxableAmount: number;
  taxAmount: number;
  rate: number;
  status: 'draft' | 'pending' | 'submitted' | 'paid';
  dueDate: string;
  filingDate?: string;
  transactions: Array<{
    id: string;
    date: string;
    type: 'sale' | 'refund' | 'adjustment';
    amount: number;
    taxAmount: number;
    description: string;
  }>;
}

interface TaxStats {
  totalTaxCollected: number;
  totalTaxPaid: number;
  pendingFilings: number;
  overdueFilings: number;
  complianceRate: number;
  byJurisdiction: Array<{
    jurisdiction: string;
    amount: number;
    rate: number;
    color: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    collected: number;
    paid: number;
    net: number;
  }>;
  byType: Array<{
    type: string;
    amount: number;
    count: number;
  }>;
}

interface TaxReportsProps {
  embedded?: boolean;
  onClose?: () => void;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: DollarSign }
};

const JURISDICTION_COLORS = {
  'UAE': '#10B981',
  'Dubai': '#3B82F6',
  'Abu Dhabi': '#8B5CF6',
  'Sharjah': '#F59E0B'
};

export const TaxReports: React.FC<TaxReportsProps> = ({
  embedded = false,
  onClose
}) => {
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [stats, setStats] = useState<TaxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/tax-reports');

      if (response.data?.success) {
        setReports(response.data.data.reports || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching tax data:', err);
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
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
  };

  const filteredReports = reports.filter(report => {
    const matchesPeriod = selectedPeriod === 'all' || report.period === selectedPeriod;
    const matchesStatus = selectedStatus === 'all' || report.status === selectedStatus;
    const matchesJurisdiction = selectedJurisdiction === 'all' || report.jurisdiction === selectedJurisdiction;
    return matchesPeriod && matchesStatus && matchesJurisdiction;
  });

  const uniquePeriods = [...new Set(reports.map(r => r.period))];
  const uniqueJurisdictions = [...new Set(reports.map(r => r.jurisdiction))];

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
          <FileText className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Tax Reports</h3>
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
            <Receipt className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Tax Reports</h2>
            <p className="text-sm text-nilin-warmGray mt-1">VAT/GST & Withholding Tax Filing</p>
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
          <p className="text-2xl font-serif text-green-600">{formatCurrency(stats?.totalTaxCollected || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Tax Collected</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{formatCurrency(stats?.totalTaxPaid || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Tax Paid</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pendingFilings || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Pending</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.overdueFilings || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Overdue</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <CheckCircle className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.complianceRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray mt-1">Compliance</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Tax Collection Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Area type="monotone" dataKey="collected" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Collected" />
                <Area type="monotone" dataKey="paid" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} name="Paid" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Jurisdiction */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Jurisdiction</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byJurisdiction || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="amount"
                  nameKey="jurisdiction"
                >
                  {stats?.byJurisdiction?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.byJurisdiction?.map(item => (
              <div key={item.jurisdiction} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-nilin-warmGray">{item.jurisdiction}</span>
                </div>
                <span className="text-xs font-medium text-nilin-charcoal">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Periods</option>
          {uniquePeriods.map(period => (
            <option key={period} value={period}>{period}</option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={selectedJurisdiction}
          onChange={(e) => setSelectedJurisdiction(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Jurisdictions</option>
          {uniqueJurisdictions.map(j => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <FileText className="w-12 h-12 mx-auto mb-4 text-nilin-border" />
            <p className="font-medium">No tax reports match your filters</p>
          </div>
        ) : (
          filteredReports.map(report => {
            const statusConfig = STATUS_CONFIG[report.status];
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedReport === report.id;
            const isOverdue = new Date(report.dueDate) < new Date() && report.status !== 'paid';

            return (
              <div key={report.id} className={cn(
                'glass rounded-xl border p-4 transition-all',
                isOverdue ? 'border-red-200 bg-red-50/30' :
                report.status === 'paid' ? 'border-green-200/50' :
                'border-nilin-border/50'
              )}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-nilin-blush/30">
                    <Receipt className="w-6 h-6 text-nilin-coral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-nilin-charcoal">{report.period}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{report.type}</span>
                      <span className="px-2 py-0.5 bg-nilin-blush text-nilin-charcoal rounded text-xs font-medium">{report.jurisdiction}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-nilin-warmGray">Taxable Amount:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">{formatCurrency(report.taxableAmount)}</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Tax Amount:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">{formatCurrency(report.taxAmount)}</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Rate:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">{report.rate}%</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Due:</span>
                        <span className={cn('ml-1 font-medium', isOverdue ? 'text-red-600' : 'text-nilin-charcoal')}>
                          {new Date(report.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport(report.id, 'pdf')}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4 text-nilin-warmGray" />
                    </button>
                    {report.transactions.length > 0 && (
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                        className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <p className="text-sm font-medium text-nilin-charcoal mb-3">Transaction Details ({report.transactions.length})</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-nilin-blush/30">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-nilin-warmGray">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-nilin-warmGray">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-nilin-warmGray">Description</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-nilin-warmGray">Amount</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-nilin-warmGray">Tax</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-nilin-border/30">
                          {report.transactions.map(tx => (
                            <tr key={tx.id}>
                              <td className="px-3 py-2 text-nilin-charcoal">{new Date(tx.date).toLocaleDateString()}</td>
                              <td className="px-3 py-2">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium capitalize',
                                  tx.type === 'sale' ? 'bg-green-100 text-green-700' :
                                  tx.type === 'refund' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                )}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-nilin-charcoal">{tx.description}</td>
                              <td className="px-3 py-2 text-right font-medium text-nilin-charcoal">{formatCurrency(tx.amount)}</td>
                              <td className="px-3 py-2 text-right font-medium text-nilin-charcoal">{formatCurrency(tx.taxAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

export default TaxReports;
