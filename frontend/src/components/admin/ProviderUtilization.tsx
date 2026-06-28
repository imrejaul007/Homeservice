import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap,
  Target,
  DollarSign,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface ProviderUtilizationData {
  overallUtilization: number;
  averageHoursPerWeek: number;
  totalProviders: number;
  activeProviders: number;
  utilizationByTier: Array<{
    tier: string;
    utilization: number;
    count: number;
    avgJobsPerWeek: number;
  }>;
  utilizationTrend: Array<{
    date: string;
    utilization: number;
    bookings: number;
  }>;
  peakHours: Array<{
    hour: string;
    utilization: number;
    demand: number;
  }>;
  categoryUtilization: Array<{
    category: string;
    utilization: number;
    providers: number;
    bookings: number;
  }>;
  topPerformers: Array<{
    providerId: string;
    providerName: string;
    utilization: number;
    completedJobs: number;
    rating: number;
    earnings: number;
  }>;
  underperformers: Array<{
    providerId: string;
    providerName: string;
    utilization: number;
    completedJobs: number;
    avgRating: number;
  }>;
}

interface ProviderUtilizationProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TIER_COLORS = {
  platinum: '#8B5CF6',
  gold: '#F59E0B',
  silver: '#6B7280',
  bronze: '#D97706'
};

export const ProviderUtilization: React.FC<ProviderUtilizationProps> = ({
  embedded = false,
  onClose
}) => {
  const [data, setData] = useState<ProviderUtilizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'tiers' | 'categories' | 'performers'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/provider-utilization');

      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching utilization data:', err);
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

  if (error || !data) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Data</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error || 'Please try again later'}</p>
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

  const utilizationColor = data.overallUtilization >= 70 ? '#10B981' :
                          data.overallUtilization >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <Target className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Provider Utilization</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Track provider capacity and performance</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <div className="relative w-16 h-16 mx-auto mb-2">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="6" fill="none" />
              <circle
                cx="32" cy="32" r="28"
                stroke={utilizationColor}
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${data.overallUtilization * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-nilin-charcoal">
              {data.overallUtilization}%
            </span>
          </div>
          <p className="text-xs text-nilin-warmGray">Overall Utilization</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{data.averageHoursPerWeek}h</p>
          <p className="text-xs text-nilin-warmGray mt-1">Avg Hours/Week</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{data.activeProviders.toLocaleString()}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Active Providers</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Activity className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{Math.round(data.overallUtilization * data.activeProviders / 100)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Available Slots</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['overview', 'tiers', 'categories', 'performers'] as const).map(view => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize',
              selectedView === view
                ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-nilin-warm'
                : 'border border-nilin-border text-nilin-charcoal hover:bg-nilin-blush/30'
            )}
          >
            {view}
          </button>
        ))}
      </div>

      {/* Overview View */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Utilization Trend */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Utilization Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.utilizationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <defs>
                    <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="utilization" stroke="#10B981" fill="url(#utilGradient)" strokeWidth={2} name="Utilization %" />
                  <Line type="monotone" dataKey="bookings" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Bookings" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Hours */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Hourly Utilization Pattern</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Bar dataKey="utilization" fill="#10B981" radius={[4, 4, 0, 0]} name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tiers View */}
      {selectedView === 'tiers' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Utilization by Tier</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.utilizationByTier} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#6B7280" fontSize={11} domain={[0, 100]} />
                  <YAxis type="category" dataKey="tier" stroke="#6B7280" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Bar dataKey="utilization" radius={[0, 8, 8, 0]} name="Utilization %">
                    {data.utilizationByTier.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TIER_COLORS[entry.tier.toLowerCase() as keyof typeof TIER_COLORS]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.utilizationByTier.map(tier => (
              <div key={tier.tier} className="glass rounded-xl border border-nilin-border/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier.tier.toLowerCase() as keyof typeof TIER_COLORS] }}
                  />
                  <span className="font-medium text-nilin-charcoal">{tier.tier}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-nilin-warmGray">Utilization</span>
                    <span className="text-sm font-semibold text-nilin-charcoal">{tier.utilization}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nilin-warmGray">Providers</span>
                    <span className="text-sm font-semibold text-nilin-charcoal">{tier.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nilin-warmGray">Avg Jobs/Week</span>
                    <span className="text-sm font-semibold text-nilin-charcoal">{tier.avgJobsPerWeek}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories View */}
      {selectedView === 'categories' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Category Utilization</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categoryUtilization}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="category" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Bar dataKey="utilization" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-nilin-blush/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Providers</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Bookings</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nilin-border/50">
                {data.categoryUtilization.map(cat => (
                  <tr key={cat.category} className="hover:bg-nilin-blush/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal">{cat.category}</td>
                    <td className="px-4 py-3 text-sm text-nilin-warmGray text-right">{cat.providers}</td>
                    <td className="px-4 py-3 text-sm text-nilin-warmGray text-right">{cat.bookings}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                        cat.utilization >= 70 ? 'bg-green-100 text-green-700' :
                        cat.utilization >= 50 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {cat.utilization}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performers View */}
      {selectedView === 'performers' && (
        <div className="space-y-6">
          {/* Top Performers */}
          <div className="glass rounded-2xl border border-green-200/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Top Performers
            </h3>
            <div className="space-y-3">
              {data.topPerformers.map((provider, index) => (
                <div key={provider.providerId} className="flex items-center gap-4 p-3 bg-green-50/30 rounded-xl">
                  <span className="text-2xl font-bold text-green-600 w-8">{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium text-nilin-charcoal">{provider.providerName}</p>
                    <p className="text-sm text-nilin-warmGray">{provider.completedJobs} jobs this week</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-serif text-green-600">{provider.utilization}%</p>
                    <p className="text-xs text-nilin-warmGray">Utilization</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-nilin-charcoal">AED {provider.earnings.toLocaleString()}</p>
                    <p className="text-xs text-nilin-warmGray">Earnings</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Underperformers */}
          <div className="glass rounded-2xl border border-red-200/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Needs Attention
            </h3>
            <div className="space-y-3">
              {data.underperformers.map(provider => (
                <div key={provider.providerId} className="flex items-center gap-4 p-3 bg-red-50/30 rounded-xl">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <div className="flex-1">
                    <p className="font-medium text-nilin-charcoal">{provider.providerName}</p>
                    <p className="text-sm text-nilin-warmGray">{provider.completedJobs} jobs this week</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-serif text-red-600">{provider.utilization}%</p>
                    <p className="text-xs text-nilin-warmGray">Utilization</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-nilin-charcoal">{provider.avgRating}/5</p>
                    <p className="text-xs text-nilin-warmGray">Avg Rating</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderUtilization;
