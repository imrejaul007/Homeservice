import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  RefreshCw,
  Loader2,
  BarChart3,
  Target,
  PieChart as PieChartIcon,
  ArrowUpDown,
  Download,
  Calendar,
  Award,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter
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

interface ChannelMetrics {
  channel: string;
  cac: number;
  customers: number;
  ltv: number;
  ltvCacRatio: number;
  paybackPeriod: number;
  conversionRate: number;
  spend: number;
}

interface CohortData {
  cohort: string;
  date: string;
  customers: number;
  revenue: number;
  ltv: number;
  retention: number[];
}

interface UnitEconomicsMetrics {
  overall: {
    cac: number;
    ltv: number;
    ltvCacRatio: number;
    paybackPeriod: number;
    cacPaybackMonths: number;
  };
  byChannel: ChannelMetrics[];
  cohorts: CohortData[];
  trend: Array<{
    month: string;
    cac: number;
    ltv: number;
    ratio: number;
  }>;
  topChannels: Array<{ channel: string; ltvCacRatio: number; cac: number }>;
  avgBySource: Array<{ source: string; cac: number; customers: number }>;
}

interface UnitEconomicsProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CHANNEL_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#F97316'];

export const UnitEconomics: React.FC<UnitEconomicsProps> = ({
  embedded = false,
  onClose
}) => {
  const [metrics, setMetrics] = useState<UnitEconomicsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<string>('90d');
  const [sortBy, setSortBy] = useState<'ltvCacRatio' | 'cac' | 'customers'>('ltvCacRatio');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/unit-economics', {
        params: { dateRange }
      });

      if (response.data?.success) {
        setMetrics(response.data.data);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching unit economics data:', err);
      setError(getAdminFetchErrorMessage(err));
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
    return `AED ${amount.toLocaleString()}`;
  };

  const sortedChannels = metrics?.byChannel.slice().sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const modifier = sortOrder === 'asc' ? 1 : -1;
    return (aVal - bVal) * modifier;
  }) || [];

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
          <TrendingUp className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Unit Economics</h3>
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
            <Target className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Unit Economics</h2>
            <p className="text-sm text-nilin-warmGray mt-1">CAC, LTV, and cohort analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="180d">Last 6 months</option>
            <option value="365d">Last 12 months</option>
          </select>
          <button className="px-4 py-2 border border-nilin-border rounded-xl hover:bg-nilin-blush/30 transition-colors text-sm font-medium">
            <Download className="w-4 h-4 inline mr-2" />
            Export
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <Target className="w-5 h-5 text-nilin-warmGray" />
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

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <DollarSign className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{formatCurrency(metrics?.overall.cac || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Customer Acquisition Cost</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <Award className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatCurrency(metrics?.overall.ltv || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Lifetime Value</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{metrics?.overall.ltvCacRatio.toFixed(1) || 0}x</p>
          <p className="text-xs text-nilin-warmGray">LTV:CAC Ratio</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{metrics?.overall.cacPaybackMonths.toFixed(1) || 0}</p>
          <p className="text-xs text-nilin-warmGray">Payback Period (months)</p>
        </div>
      </div>

      {/* Ratio Indicator */}
      <div className="glass rounded-xl border border-nilin-border/50 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-nilin-warmGray">LTV:CAC Ratio Health</span>
          <span className="text-sm font-medium text-nilin-charcoal">
            {metrics?.overall.ltvCacRatio.toFixed(1) || 0}x / 3x target
          </span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-400 via-amber-400 to-green-500 rounded-full transition-all"
            style={{ width: `${Math.min((metrics?.overall.ltvCacRatio || 0) / 15 * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-nilin-warmGray mt-1">
          <span>1x (Poor)</span>
          <span>3x (Good)</span>
          <span>10x+ (Excellent)</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">CAC & LTV Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={metrics?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} tickFormatter={(v) => `AED ${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} domain={[0, 15]} tickFormatter={(v) => `${v}x`} />
                <Tooltip formatter={(value: number) => value.toLocaleString()} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar yAxisId="left" dataKey="cac" fill="#3B82F6" name="CAC" opacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="ltv" fill="#10B981" name="LTV" opacity={0.5} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="ratio" stroke="#8B5CF6" strokeWidth={3} name="LTV:CAC Ratio" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CAC by Channel */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">CAC by Acquisition Channel</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.byChannel || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#6B7280" fontSize={11} tickFormatter={(v) => `AED ${v}`} />
                <YAxis dataKey="channel" type="category" stroke="#6B7280" fontSize={10} width={100} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="cac" name="CAC" radius={[0, 4, 4, 0]}>
                  {metrics?.byChannel.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Channels */}
      <div className="glass rounded-2xl border border-green-200/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Best Performing Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics?.topChannels.map((channel, idx) => (
            <div key={channel.channel} className="p-4 bg-green-50/50 rounded-xl border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                  <span className="text-lg font-bold text-green-700">#{idx + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">{channel.channel}</p>
                  <p className="text-sm text-green-600 font-medium">{channel.ltvCacRatio.toFixed(1)}x LTV:CAC</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-nilin-warmGray">CAC</p>
                  <p className="text-sm font-medium text-nilin-charcoal">{formatCurrency(channel.cac)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif text-nilin-charcoal">Channel Comparison</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSort('ltvCacRatio')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              sortBy === 'ltvCacRatio' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
            )}
          >
            LTV:CAC Ratio
          </button>
          <button
            onClick={() => handleSort('cac')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              sortBy === 'cac' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
            )}
          >
            CAC
          </button>
          <button
            onClick={() => handleSort('customers')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              sortBy === 'customers' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
            )}
          >
            Customers
          </button>
        </div>
      </div>

      {/* Channel Table */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nilin-blush/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray">Channel</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">CAC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Customers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">LTV</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">LTV:CAC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Payback</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Conv. Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nilin-border/30">
              {sortedChannels.map((channel, idx) => (
                <tr key={channel.channel} className="hover:bg-nilin-blush/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[idx] }} />
                      <span className="font-medium text-nilin-charcoal">{channel.channel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">
                    {formatCurrency(channel.cac)}
                  </td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">
                    {channel.customers.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">
                    {formatCurrency(channel.ltv)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      channel.ltvCacRatio >= 10 ? 'bg-green-100 text-green-700' :
                      channel.ltvCacRatio >= 5 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {channel.ltvCacRatio.toFixed(1)}x
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">
                    {channel.paybackPeriod.toFixed(1)} mo
                  </td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">
                    {channel.conversionRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">
                    {channel.spend > 0 ? formatCurrency(channel.spend) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cohort Analysis */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Cohort Retention Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nilin-blush/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray">Cohort</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Customers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">LTV</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Month 0</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Month 1</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Month 2</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Month 3</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Month 4</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Month 5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nilin-border/30">
              {metrics?.cohorts.map((cohort, idx) => (
                <>
                  <tr
                    key={cohort.cohort}
                    className="hover:bg-nilin-blush/20 cursor-pointer transition-colors"
                    onClick={() => setExpandedCohort(expandedCohort === cohort.cohort ? null : cohort.cohort)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-nilin-warmGray" />
                        <span className="font-medium text-nilin-charcoal">{cohort.cohort}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">
                      {cohort.customers}
                    </td>
                    <td className="px-4 py-3 text-right text-nilin-charcoal">
                      {formatCurrency(cohort.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-nilin-charcoal">
                      {formatCurrency(cohort.ltv)}
                    </td>
                    {cohort.retention.map((rate, monthIdx) => (
                      <td key={monthIdx} className="px-4 py-3 text-center">
                        {rate !== null ? (
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            rate >= 80 ? 'bg-green-100 text-green-700' :
                            rate >= 60 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {rate}%
                          </span>
                        ) : (
                          <span className="text-nilin-warmGray">-</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <ChevronDown className={cn(
                        'w-4 h-4 mx-auto text-nilin-warmGray transition-transform',
                        expandedCohort === cohort.cohort && 'rotate-180'
                      )} />
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Retention Chart for Selected Cohort */}
        {expandedCohort && metrics?.cohorts.find(c => c.cohort === expandedCohort) && (
          <div className="mt-4 p-4 bg-nilin-blush/20 rounded-xl">
            <h4 className="text-sm font-medium text-nilin-charcoal mb-3">
              {expandedCohort} Retention Curve
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={metrics.cohorts.find(c => c.cohort === expandedCohort)?.retention
                    .map((rate, idx) => ({ month: `Month ${idx}`, retention: rate }))
                    .filter(d => d.retention !== null) || []
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Area type="monotone" dataKey="retention" stroke="#10B981" fill="#10B98130" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <h4 className="font-medium text-blue-800 mb-2">Recommendations</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Organic Search and Referral channels show the best LTV:CAC ratios (52.8x and 37.3x). Consider increasing investment.</span>
          </li>
          <li className="flex items-start gap-2">
            <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Display Ads and Instagram have lower LTV:CAC ratios. Optimize targeting or reduce spend.</span>
          </li>
          <li className="flex items-start gap-2">
            <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Current overall LTV:CAC ratio of 10x exceeds the 3x minimum target. Focus on maintaining quality acquisitions.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default UnitEconomics;
