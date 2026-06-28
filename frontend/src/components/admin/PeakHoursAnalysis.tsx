import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Zap,
  Sun,
  Moon,
  Sunset,
  Sunrise,
  ArrowRight
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
  Cell,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface HourlyData {
  hour: number;
  hourLabel: string;
  demand: number;
  supply: number;
  bookings: number;
  revenue: number;
  avgWaitTime: number;
  utilization: number;
  category?: string;
}

interface DayData {
  day: string;
  isWeekend: boolean;
  totalDemand: number;
  totalBookings: number;
  peakHour: number;
  avgRevenue: number;
}

interface PeakHoursStats {
  overallPeakHour: number;
  weekdayPeakHour: number;
  weekendPeakHour: number;
  highestDemand: number;
  lowestDemand: number;
  avgDemandGap: number;
  supplyDemandRatio: number;
  peakHours: Array<{ hour: number; demand: number; supply: number; ratio: number }>;
  dailyPattern: Array<{ day: string; demand: number; bookings: number; revenue: number }>;
  weeklyPattern: DayData[];
  categoryPatterns: Array<{ category: string; peakHour: number; demand: number }>;
  recommendations: string[];
}

interface PeakHoursAnalysisProps {
  embedded?: boolean;
  onClose?: () => void;
}

const getTimeOfDay = (hour: number): { label: string; icon: React.ElementType; color: string } => {
  if (hour >= 5 && hour < 12) return { label: 'Morning', icon: Sunrise, color: '#F59E0B' };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon', icon: Sun, color: '#EF4444' };
  if (hour >= 17 && hour < 21) return { label: 'Evening', icon: Sunset, color: '#8B5CF6' };
  return { label: 'Night', icon: Moon, color: '#3B82F6' };
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
};

export const PeakHoursAnalysis: React.FC<PeakHoursAnalysisProps> = ({
  embedded = false,
  onClose
}) => {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [stats, setStats] = useState<PeakHoursStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'hourly' | 'daily' | 'weekly'>('hourly');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/analytics/peak-hours');

      if (response.data?.success) {
        setHourlyData(response.data.data.hourly || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching peak hours data:', err);
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

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Peak Hours Data</h3>
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

  const peakHourConfig = getTimeOfDay(stats?.overallPeakHour || 18);
  const PeakHourIcon = peakHourConfig.icon;

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Peak Hours Analysis</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Demand & supply patterns</p>
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
          <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${peakHourConfig.color}20` }}>
            <PeakHourIcon className="w-5 h-5" style={{ color: peakHourConfig.color }} />
          </div>
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.overallPeakHour}:00</p>
          <p className="text-xs text-nilin-warmGray mt-1">Overall Peak</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.highestDemand || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Peak Demand</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <Zap className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{Math.round((stats?.supplyDemandRatio || 0) * 100)}%</p>
          <p className="text-xs text-nilin-warmGray mt-1">Supply Coverage</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.lowestDemand || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Lowest Demand</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['hourly', 'daily', 'weekly'] as const).map(view => (
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

      {/* Hourly View */}
      {selectedView === 'hourly' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">24-Hour Demand & Supply Pattern</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hourLabel" stroke="#6B7280" fontSize={10} />
                  <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <defs>
                    <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area yAxisId="left" type="monotone" dataKey="demand" stroke="#EF4444" fill="url(#demandGradient)" strokeWidth={2} name="Demand" />
                  <Area yAxisId="left" type="monotone" dataKey="supply" stroke="#10B981" fill="url(#supplyGradient)" strokeWidth={2} name="Supply" />
                  <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" name="Utilization %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Utilization Heatmap */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Utilization by Hour</h3>
            <div className="grid grid-cols-12 gap-2">
              {hourlyData.map(hour => {
                const utilization = hour.utilization;
                const bgColor = utilization > 80 ? '#EF4444' :
                               utilization > 60 ? '#F59E0B' :
                               utilization > 40 ? '#10B981' : '#E5E7EB';
                return (
                  <div
                    key={hour.hour}
                    className="aspect-square rounded-lg flex items-center justify-center text-xs font-medium text-white"
                    style={{ backgroundColor: bgColor }}
                    title={`${hour.hourLabel}: ${utilization}%`}
                  >
                    {hour.hour}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500" />
                <span>40-60%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-amber-500" />
                <span>60-80%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span>80%+</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily View */}
      {selectedView === 'daily' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Demand by Day of Week</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.weeklyPattern || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="day" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Bar dataKey="totalDemand" fill="#EF4444" radius={[4, 4, 0, 0]} name="Demand">
                    {stats?.weeklyPattern?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isWeekend ? '#8B5CF6' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-xs text-nilin-warmGray">Weekdays</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-xs text-nilin-warmGray">Weekends</span>
              </div>
            </div>
          </div>

          {/* Weekday vs Weekend Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-xl border border-nilin-border/50 p-4">
              <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Weekday Peak Hours</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-serif text-nilin-charcoal">{stats?.weekdayPeakHour}:00 - {stats?.weekdayPeakHour + 2}:00</p>
                  <p className="text-xs text-nilin-warmGray">Peak demand window</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl border border-nilin-border/50 p-4">
              <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Weekend Peak Hours</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Sun className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-serif text-nilin-charcoal">{stats?.weekendPeakHour}:00 - {stats?.weekendPeakHour + 2}:00</p>
                  <p className="text-xs text-nilin-warmGray">Afternoon preference</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly View */}
      {selectedView === 'weekly' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Weekly Revenue Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.dailyPattern || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="day" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Peak Times */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Category Peak Hours</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats?.categoryPatterns?.map(cat => (
                <div key={cat.category} className="p-4 bg-nilin-blush/30 rounded-xl text-center">
                  <p className="text-sm font-medium text-nilin-charcoal">{cat.category}</p>
                  <p className="text-2xl font-serif text-nilin-coral mt-2">{cat.peakHour}:00</p>
                  <p className="text-xs text-nilin-warmGray mt-1">Peak at {cat.demand} demand</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {stats?.recommendations && stats.recommendations.length > 0 && (
        <div className="mt-6 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-nilin-blush/30 rounded-xl">
                <ArrowRight className="w-4 h-4 text-nilin-coral mt-1 flex-shrink-0" />
                <p className="text-sm text-nilin-charcoal">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeakHoursAnalysis;
