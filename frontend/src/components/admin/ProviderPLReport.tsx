import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Users,
  PieChart as PieChartIcon,
  ArrowUpDown,
  FileText,
  Calculator,
  Wallet
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
  Area,
  ComposedChart
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface ProviderPL {
  providerId: string;
  providerName: string;
  period: string;
  revenue: {
    grossRevenue: number;
    platformFees: number;
    paymentFees: number;
    netRevenue: number;
  };
  expenses: {
    labor: number;
    materials: number;
    transportation: number;
    equipment: number;
    insurance: number;
    marketing: number;
    other: number;
    total: number;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
  metrics: {
    totalJobs: number;
    avgJobValue: number;
    totalHours: number;
    avgHourlyRate: number;
    equipmentDepreciation: number;
    trainingCosts: number;
  };
  breakdown: Array<{
    category: string;
    revenue: number;
    jobs: number;
    expenses: number;
  }>;
}

interface ProviderPLStats {
  totalProviders: number;
  profitableProviders: number;
  avgMargin: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  topPerformers: Array<{ providerId: string; providerName: string; netProfit: number; margin: number }>;
  expenseBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  trend: Array<{ period: string; revenue: number; expenses: number; profit: number }>;
}

interface ProviderPLReportProps {
  embedded?: boolean;
  onClose?: () => void;
}

const EXPENSE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#6366F1'
];

const EXPENSE_CATEGORIES = [
  'Labor',
  'Materials',
  'Transportation',
  'Equipment',
  'Insurance',
  'Marketing',
  'Other'
];

export const ProviderPLReport: React.FC<ProviderPLReportProps> = ({
  embedded = false,
  onClose
}) => {
  const [providerPLs, setProviderPLs] = useState<ProviderPL[]>([]);
  const [stats, setStats] = useState<ProviderPLStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<string>('monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'netProfit' | 'revenue' | 'margin'>('netProfit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedProvider, setSelectedProvider] = useState<ProviderPL | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/provider-pl', {
        params: { dateRange }
      });

      if (response.data?.success) {
        setProviderPLs(response.data.data.providers || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setProviderPLs([
          {
            providerId: 'prov-001',
            providerName: 'Ahmed Al-Rashid',
            period: '2024-Q1',
            revenue: {
              grossRevenue: 45600,
              platformFees: 4560,
              paymentFees: 912,
              netRevenue: 40128
            },
            expenses: {
              labor: 12000,
              materials: 8500,
              transportation: 4200,
              equipment: 2800,
              insurance: 1500,
              marketing: 2000,
              other: 1200,
              total: 32200
            },
            profit: {
              gross: 7928,
              net: 7928,
              margin: 17.4
            },
            metrics: {
              totalJobs: 156,
              avgJobValue: 292,
              totalHours: 468,
              avgHourlyRate: 97,
              equipmentDepreciation: 800,
              trainingCosts: 400
            },
            breakdown: [
              { category: 'Electrical', revenue: 28500, jobs: 98, expenses: 18000 },
              { category: 'AC Repair', revenue: 12100, jobs: 42, expenses: 10200 },
              { category: 'Appliance', revenue: 5000, jobs: 16, expenses: 4000 }
            ]
          },
          {
            providerId: 'prov-002',
            providerName: 'Fatima Hassan',
            period: '2024-Q1',
            revenue: {
              grossRevenue: 38900,
              platformFees: 3890,
              paymentFees: 778,
              netRevenue: 34232
            },
            expenses: {
              labor: 15000,
              materials: 6500,
              transportation: 3500,
              equipment: 2200,
              insurance: 1800,
              marketing: 1500,
              other: 800,
              total: 31300
            },
            profit: {
              gross: 2932,
              net: 2932,
              margin: 7.5
            },
            metrics: {
              totalJobs: 134,
              avgJobValue: 290,
              totalHours: 536,
              avgHourlyRate: 73,
              equipmentDepreciation: 600,
              trainingCosts: 200
            },
            breakdown: [
              { category: 'Hair Styling', revenue: 22000, jobs: 76, expenses: 16000 },
              { category: 'Makeup', revenue: 11200, jobs: 39, expenses: 9500 },
              { category: 'Nail Care', revenue: 5700, jobs: 19, expenses: 5800 }
            ]
          },
          {
            providerId: 'prov-003',
            providerName: 'Omar Malik',
            period: '2024-Q1',
            revenue: {
              grossRevenue: 52300,
              platformFees: 5230,
              paymentFees: 1046,
              netRevenue: 46024
            },
            expenses: {
              labor: 18000,
              materials: 12000,
              transportation: 4800,
              equipment: 3500,
              insurance: 2000,
              marketing: 2500,
              other: 1500,
              total: 44300
            },
            profit: {
              gross: 1724,
              net: 1724,
              margin: 3.3
            },
            metrics: {
              totalJobs: 178,
              avgJobValue: 294,
              totalHours: 712,
              avgHourlyRate: 73,
              equipmentDepreciation: 1000,
              trainingCosts: 500
            },
            breakdown: [
              { category: 'Plumbing', revenue: 35000, jobs: 119, expenses: 28000 },
              { category: 'Drain Cleaning', revenue: 10500, jobs: 36, expenses: 9500 },
              { category: 'Water Heater', revenue: 6800, jobs: 23, expenses: 6800 }
            ]
          },
          {
            providerId: 'prov-004',
            providerName: 'Sara Khan',
            period: '2024-Q1',
            revenue: {
              grossRevenue: 31200,
              platformFees: 3120,
              paymentFees: 624,
              netRevenue: 27456
            },
            expenses: {
              labor: 8000,
              materials: 5500,
              transportation: 2800,
              equipment: 1500,
              insurance: 1200,
              marketing: 1800,
              other: 900,
              total: 21700
            },
            profit: {
              gross: 5756,
              net: 5756,
              margin: 18.4
            },
            metrics: {
              totalJobs: 142,
              avgJobValue: 220,
              totalHours: 355,
              avgHourlyRate: 88,
              equipmentDepreciation: 400,
              trainingCosts: 300
            },
            breakdown: [
              { category: 'Home Cleaning', revenue: 18000, jobs: 82, expenses: 11000 },
              { category: 'Deep Cleaning', revenue: 8900, jobs: 41, expenses: 6500 },
              { category: 'Office Cleaning', revenue: 4300, jobs: 19, expenses: 4200 }
            ]
          },
          {
            providerId: 'prov-005',
            providerName: 'Youssef Ibrahim',
            period: '2024-Q1',
            revenue: {
              grossRevenue: 67800,
              platformFees: 6780,
              paymentFees: 1356,
              netRevenue: 59664
            },
            expenses: {
              labor: 22000,
              materials: 18500,
              transportation: 5500,
              equipment: 4500,
              insurance: 2500,
              marketing: 3000,
              other: 1800,
              total: 57800
            },
            profit: {
              gross: 1864,
              net: 1864,
              margin: 2.7
            },
            metrics: {
              totalJobs: 198,
              avgJobValue: 342,
              totalHours: 792,
              avgHourlyRate: 86,
              equipmentDepreciation: 1200,
              trainingCosts: 600
            },
            breakdown: [
              { category: 'Carpentry', revenue: 42000, jobs: 123, expenses: 35000 },
              { category: 'Furniture Repair', revenue: 15800, jobs: 46, expenses: 14000 },
              { category: 'Cabinet Installation', revenue: 10000, jobs: 29, expenses: 8800 }
            ]
          }
        ]);
        setStats({
          totalProviders: 156,
          profitableProviders: 142,
          avgMargin: 12.3,
          totalRevenue: 2345000,
          totalExpenses: 1856000,
          totalProfit: 489000,
          topPerformers: [
            { providerId: 'prov-001', providerName: 'Ahmed Al-Rashid', netProfit: 7928, margin: 17.4 },
            { providerId: 'prov-004', providerName: 'Sara Khan', netProfit: 5756, margin: 18.4 },
            { providerId: 'prov-002', providerName: 'Fatima Hassan', netProfit: 2932, margin: 7.5 }
          ],
          expenseBreakdown: [
            { category: 'Labor', amount: 745000, percentage: 40.1 },
            { category: 'Materials', amount: 510000, percentage: 27.5 },
            { category: 'Transportation', amount: 228000, percentage: 12.3 },
            { category: 'Equipment', amount: 145000, percentage: 7.8 },
            { category: 'Insurance', amount: 80000, percentage: 4.3 },
            { category: 'Marketing', amount: 108000, percentage: 5.8 },
            { category: 'Other', amount: 40000, percentage: 2.2 }
          ],
          trend: [
            { period: 'Jan', revenue: 720000, expenses: 580000, profit: 140000 },
            { period: 'Feb', revenue: 780000, expenses: 620000, profit: 160000 },
            { period: 'Mar', revenue: 845000, expenses: 656000, profit: 189000 }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching provider P&L data:', err);
      setError('Failed to load provider P&L data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `AED ${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `AED ${(amount / 1000).toFixed(1)}K`;
    }
    return `AED ${amount.toLocaleString()}`;
  };

  const filteredProviders = providerPLs.filter(p =>
    p.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.providerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProviders = filteredProviders.slice().sort((a, b) => {
    const aVal = a.profit[sortBy];
    const bVal = b.profit[sortBy];
    const modifier = sortOrder === 'asc' ? 1 : -1;
    return (aVal - bVal) * modifier;
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Provider P&L</h3>
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
            <Calculator className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Provider P&L Report</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Provider profit & loss analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button className="px-4 py-2 border border-nilin-border rounded-xl hover:bg-nilin-blush/30 transition-colors text-sm font-medium">
            <Download className="w-4 h-4 inline mr-2" />
            Export
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <DollarSign className="w-5 h-5 text-nilin-warmGray" />
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
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatCurrency(stats?.totalProfit || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Profit</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{formatCurrency(stats?.totalRevenue || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Revenue</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingDown className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{formatCurrency(stats?.totalExpenses || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Expenses</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <BarChart3 className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.avgMargin || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Avg Margin</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Total Providers</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.totalProviders || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Profitable</span>
            <span className="text-lg font-serif text-green-600">{stats?.profitableProviders || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Not Profitable</span>
            <span className="text-lg font-serif text-red-600">{(stats?.totalProviders || 0) - (stats?.profitableProviders || 0)}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Profitability Rate</span>
            <span className="text-lg font-serif text-green-600">
              {stats ? ((stats.profitableProviders / stats.totalProviders) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* P&L Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">P&L Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="period" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="revenue" fill="#10B981" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Expense Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.expenseBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="amount"
                  nameKey="category"
                >
                  {stats?.expenseBreakdown?.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats?.expenseBreakdown.map((item, idx) => (
              <div key={item.category} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[idx] }} />
                <span className="text-xs text-nilin-warmGray">{item.category}</span>
                <span className="text-xs font-medium text-nilin-charcoal ml-auto">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Top Performing Providers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats?.topPerformers.map((performer, idx) => (
            <div key={performer.providerId} className="p-4 bg-green-50/50 rounded-xl border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                  <span className="text-lg font-bold text-green-700">#{idx + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">{performer.providerName}</p>
                  <p className="text-sm text-green-600 font-medium">{formatCurrency(performer.netProfit)}</p>
                </div>
                <span className="ml-auto px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  {performer.margin}% margin
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSort('netProfit')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              sortBy === 'netProfit' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
            )}
          >
            Net Profit
          </button>
          <button
            onClick={() => handleSort('revenue')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              sortBy === 'revenue' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
            )}
          >
            Revenue
          </button>
          <button
            onClick={() => handleSort('margin')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              sortBy === 'margin' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
            )}
          >
            Margin %
          </button>
        </div>
      </div>

      {/* Provider P&L Table */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nilin-blush/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray">Provider</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Gross Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Fees</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Net Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Expenses</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Net Profit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Margin</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nilin-border/30">
              {sortedProviders.map(provider => (
                <>
                  <tr
                    key={provider.providerId}
                    className="hover:bg-nilin-blush/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedProvider(selectedProvider?.providerId === provider.providerId ? null : provider)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-nilin-charcoal">{provider.providerName}</p>
                      <p className="text-xs text-nilin-warmGray">{provider.providerId}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">
                      {formatCurrency(provider.revenue.grossRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-nilin-warmGray">
                      {formatCurrency(provider.revenue.platformFees + provider.revenue.paymentFees)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">
                      {formatCurrency(provider.revenue.netRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatCurrency(provider.expenses.total)}
                    </td>
                    <td className={cn(
                      'px-4 py-3 text-right font-medium',
                      provider.profit.net >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatCurrency(provider.profit.net)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        provider.profit.margin >= 10 ? 'bg-green-100 text-green-700' :
                        provider.profit.margin >= 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {provider.profit.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChevronDown className={cn(
                        'w-4 h-4 mx-auto text-nilin-warmGray transition-transform',
                        selectedProvider?.providerId === provider.providerId && 'rotate-180'
                      )} />
                    </td>
                  </tr>
                  {selectedProvider?.providerId === provider.providerId && (
                    <tr key={`${provider.providerId}-details`}>
                      <td colSpan={8} className="px-4 py-4 bg-nilin-blush/10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Metrics */}
                          <div>
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Performance Metrics</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-nilin-warmGray">Total Jobs</p>
                                <p className="text-lg font-serif text-nilin-charcoal">{provider.metrics.totalJobs}</p>
                              </div>
                              <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-nilin-warmGray">Avg Job Value</p>
                                <p className="text-lg font-serif text-nilin-charcoal">AED {provider.metrics.avgJobValue}</p>
                              </div>
                              <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-nilin-warmGray">Total Hours</p>
                                <p className="text-lg font-serif text-nilin-charcoal">{provider.metrics.totalHours}h</p>
                              </div>
                              <div className="p-3 bg-white/50 rounded-lg">
                                <p className="text-xs text-nilin-warmGray">Avg Hourly Rate</p>
                                <p className="text-lg font-serif text-nilin-charcoal">AED {provider.metrics.avgHourlyRate}</p>
                              </div>
                            </div>
                          </div>

                          {/* Category Breakdown */}
                          <div>
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Revenue by Category</h4>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={provider.breakdown} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                  <XAxis type="number" stroke="#6B7280" fontSize={10} tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} />
                                  <YAxis dataKey="category" type="category" stroke="#6B7280" fontSize={10} width={80} />
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Bar dataKey="revenue" fill="#10B981" name="Revenue" radius={[0, 4, 4, 0]} />
                                  <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* Expense Breakdown */}
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Expense Breakdown</h4>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Labor</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.labor)}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Materials</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.materials)}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Transportation</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.transportation)}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Equipment</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.equipment)}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Insurance</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.insurance)}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Marketing</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.marketing)}</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg">
                              <p className="text-xs text-nilin-warmGray">Other</p>
                              <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(provider.expenses.other)}</p>
                            </div>
                            <div className="p-3 bg-red-50/50 rounded-lg border border-red-200">
                              <p className="text-xs text-red-600">Total</p>
                              <p className="text-lg font-serif text-red-600">{formatCurrency(provider.expenses.total)}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProviderPLReport;
