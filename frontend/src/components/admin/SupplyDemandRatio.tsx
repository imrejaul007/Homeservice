import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  MapPin,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap,
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface CategoryRatio {
  categoryId: string;
  categoryName: string;
  activeProviders: number;
  activeCustomers: number;
  ratio: number;
  demandTrend: number;
  supplyTrend: number;
  avgWaitTime: number;
  fulfillmentRate: number;
}

interface TimeSeriesData {
  hour: string;
  supply: number;
  demand: number;
  ratio: number;
}

interface SupplyDemandData {
  overallRatio: number;
  balanceStatus: 'undersupply' | 'balanced' | 'oversupply';
  totalProviders: number;
  totalDemand: number;
  categories: CategoryRatio[];
  timeSeries: TimeSeriesData[];
  hourlyPattern: Array<{ hour: number; supply: number; demand: number }>;
  cityBreakdown: Array<{ city: string; ratio: number; providers: number; demand: number }>;
  recommendations: string[];
}

interface SupplyDemandRatioProps {
  embedded?: boolean;
  onClose?: () => void;
}

const RATIO_COLORS = {
  undersupply: '#EF4444',
  balanced: '#10B981',
  oversupply: '#F59E0B'
};

const RATIO_CONFIG = {
  undersupply: { label: 'Undersupply', description: 'More demand than providers', color: 'bg-red-100 text-red-700 border-red-200' },
  balanced: { label: 'Balanced', description: 'Supply meets demand', color: 'bg-green-100 text-green-700 border-green-200' },
  oversupply: { label: 'Oversupply', description: 'More providers than demand', color: 'bg-amber-100 text-amber-700 border-amber-200' }
};

export const SupplyDemandRatio: React.FC<SupplyDemandRatioProps> = ({
  embedded = false,
  onClose
}) => {
  const [data, setData] = useState<SupplyDemandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'categories' | 'geographic' | 'hourly'>('overview');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/supply-demand');

      if (response.data?.success) {
        setData(response.data.data);
      } else {
        // Mock data
        setData({
          overallRatio: 1.15,
          balanceStatus: 'balanced',
          totalProviders: 1247,
          totalDemand: 1432,
          categories: [
            { categoryId: 'cat-1', categoryName: 'Cleaning', activeProviders: 342, activeCustomers: 456, ratio: 0.75, demandTrend: 12, supplyTrend: 5, avgWaitTime: 45, fulfillmentRate: 89 },
            { categoryId: 'cat-2', categoryName: 'Plumbing', activeProviders: 189, activeCustomers: 234, ratio: 0.81, demandTrend: 8, supplyTrend: 3, avgWaitTime: 52, fulfillmentRate: 85 },
            { categoryId: 'cat-3', categoryName: 'Electrical', activeProviders: 156, activeCustomers: 189, ratio: 0.83, demandTrend: 15, supplyTrend: 7, avgWaitTime: 38, fulfillmentRate: 92 },
            { categoryId: 'cat-4', categoryName: 'Painting', activeProviders: 98, activeCustomers: 287, ratio: 0.34, demandTrend: 22, supplyTrend: 2, avgWaitTime: 120, fulfillmentRate: 62 },
            { categoryId: 'cat-5', categoryName: 'Gardening', activeProviders: 145, activeCustomers: 134, ratio: 1.08, demandTrend: -3, supplyTrend: 8, avgWaitTime: 25, fulfillmentRate: 98 },
            { categoryId: 'cat-6', categoryName: 'Moving', activeProviders: 78, activeCustomers: 132, ratio: 0.59, demandTrend: 18, supplyTrend: 4, avgWaitTime: 95, fulfillmentRate: 74 }
          ],
          timeSeries: [
            { hour: '00:00', supply: 120, demand: 85, ratio: 1.41 },
            { hour: '04:00', supply: 98, demand: 72, ratio: 1.36 },
            { hour: '08:00', supply: 456, demand: 890, ratio: 0.51 },
            { hour: '10:00', supply: 678, demand: 1120, ratio: 0.61 },
            { hour: '12:00', supply: 789, demand: 1345, ratio: 0.59 },
            { hour: '14:00', supply: 845, demand: 1234, ratio: 0.68 },
            { hour: '16:00', supply: 812, demand: 1567, ratio: 0.52 },
            { hour: '18:00', supply: 567, demand: 1876, ratio: 0.30 },
            { hour: '20:00', supply: 345, demand: 1234, ratio: 0.28 },
            { hour: '22:00', supply: 234, demand: 567, ratio: 0.41 }
          ],
          hourlyPattern: [
            { hour: 0, supply: 120, demand: 85 },
            { hour: 4, supply: 98, demand: 72 },
            { hour: 8, supply: 456, demand: 890 },
            { hour: 12, supply: 789, demand: 1345 },
            { hour: 16, supply: 812, demand: 1567 },
            { hour: 20, supply: 345, demand: 1234 }
          ],
          cityBreakdown: [
            { city: 'Dubai', ratio: 1.08, providers: 567, demand: 623 },
            { city: 'Abu Dhabi', ratio: 1.24, providers: 312, demand: 251 },
            { city: 'Sharjah', ratio: 0.89, providers: 189, demand: 212 },
            { city: 'Al Ain', ratio: 0.72, providers: 98, demand: 136 },
            { city: 'Ajman', ratio: 0.65, providers: 81, demand: 125 }
          ],
          recommendations: [
            'Recruit more painting service providers - high demand with low supply',
            'Increase provider incentives during peak hours (16:00-20:00)',
            'Focus recruitment in Al Ain and Ajman regions'
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching supply-demand data:', err);
      setError('Failed to load supply-demand data');
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
          <div className="h-64 bg-nilin-blush/30 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="w-12 h-12 text-red-400 mb-4" />
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

  const statusConfig = RATIO_CONFIG[data.balanceStatus];

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Supply vs Demand Ratio</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Market balance analysis across services</p>
          </div>
          <span className={cn('px-3 py-1.5 rounded-full border text-xs font-semibold', statusConfig.color)}>
            {statusConfig.label}
          </span>
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
          <p className="text-3xl font-serif text-nilin-charcoal">{data.overallRatio.toFixed(2)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Overall Ratio</p>
          <p className="text-xs text-green-500 mt-1">{data.balanceStatus === 'balanced' ? 'Healthy' : 'Imbalanced'}</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{data.totalProviders.toLocaleString()}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Active Providers</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Calendar className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{data.totalDemand.toLocaleString()}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Active Demand</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Zap className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">
            {Math.round((data.categories.filter(c => c.ratio >= 0.8 && c.ratio <= 1.2).length / data.categories.length) * 100)}%
          </p>
          <p className="text-xs text-nilin-warmGray mt-1">Fulfilled</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['overview', 'categories', 'geographic', 'hourly'] as const).map(view => (
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
          {/* Ratio Chart */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Ratio Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <defs>
                    <linearGradient id="ratioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="ratio" stroke="#8B5CF6" fill="url(#ratioGradient)" strokeWidth={2} name="Ratio" />
                  <Line type="monotone" dataKey="supply" stroke="#10B981" strokeWidth={2} dot={false} name="Supply" />
                  <Line type="monotone" dataKey="demand" stroke="#F59E0B" strokeWidth={2} dot={false} name="Demand" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="glass rounded-2xl border border-nilin-border/50 p-6">
              <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Recommendations
              </h3>
              <div className="space-y-3">
                {data.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-nilin-blush/30 rounded-xl">
                    <ArrowRight className="w-4 h-4 text-nilin-coral mt-1 flex-shrink-0" />
                    <p className="text-sm text-nilin-charcoal">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories View */}
      {selectedView === 'categories' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Category Supply-Demand</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#6B7280" fontSize={11} domain={[0, 1]} />
                  <YAxis type="category" dataKey="categoryName" stroke="#6B7280" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Bar dataKey="ratio" radius={[0, 8, 8, 0]} name="Ratio">
                    {data.categories.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.ratio < 0.7 ? '#EF4444' : entry.ratio > 1.2 ? '#F59E0B' : '#10B981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Details Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-nilin-blush/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Providers</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Demand</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Ratio</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Avg Wait</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nilin-border/50">
                {data.categories.map(cat => (
                  <tr key={cat.categoryId} className="hover:bg-nilin-blush/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal">{cat.categoryName}</td>
                    <td className="px-4 py-3 text-sm text-nilin-warmGray text-right">{cat.activeProviders}</td>
                    <td className="px-4 py-3 text-sm text-nilin-warmGray text-right">{cat.activeCustomers}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                        cat.ratio < 0.7 ? 'bg-red-100 text-red-700' :
                        cat.ratio > 1.2 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {cat.ratio.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-nilin-warmGray text-right">{cat.avgWaitTime} min</td>
                    <td className="px-4 py-3 text-sm text-nilin-warmGray text-right">{cat.fulfillmentRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Geographic View */}
      {selectedView === 'geographic' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">City Breakdown</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.cityBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="city" stroke="#6B7280" fontSize={11} />
                    <YAxis stroke="#6B7280" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                    <Bar dataKey="providers" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Providers" />
                    <Bar dataKey="demand" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Demand" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.cityBreakdown.map(c => ({ name: c.city, value: c.providers }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                    >
                      <Cell fill="#3B82F6" />
                      <Cell fill="#10B981" />
                      <Cell fill="#F59E0B" />
                      <Cell fill="#8B5CF6" />
                      <Cell fill="#EC4899" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.cityBreakdown.map(city => (
              <div key={city.city} className="glass rounded-xl border border-nilin-border/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-nilin-charcoal">{city.city}</span>
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    city.ratio < 0.8 ? 'bg-red-100 text-red-700' :
                    city.ratio > 1.1 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  )}>
                    {city.ratio.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-nilin-warmGray">Providers</span>
                    <span className="text-nilin-charcoal font-medium">{city.providers}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nilin-warmGray">Demand</span>
                    <span className="text-nilin-charcoal font-medium">{city.demand}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly View */}
      {selectedView === 'hourly' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Hourly Supply vs Demand Pattern</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.hourlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} tickFormatter={v => `${v}:00`} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Area type="monotone" dataKey="supply" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Supply" />
                  <Area type="monotone" dataKey="demand" stroke="#F59E0B" fill="#F59E0B20" strokeWidth={2} name="Demand" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-xl border border-red-200 bg-red-50/50 p-4">
              <Clock className="w-6 h-6 text-red-500 mb-2" />
              <p className="text-sm font-medium text-nilin-charcoal">Peak Demand</p>
              <p className="text-xl font-serif text-red-600">16:00 - 20:00</p>
              <p className="text-xs text-nilin-warmGray mt-1">Highest shortage ratio</p>
            </div>
            <div className="glass rounded-xl border border-green-200 bg-green-50/50 p-4">
              <Activity className="w-6 h-6 text-green-500 mb-2" />
              <p className="text-sm font-medium text-nilin-charcoal">Balanced Hours</p>
              <p className="text-xl font-serif text-green-600">04:00 - 08:00</p>
              <p className="text-xs text-nilin-warmGray mt-1">Oversupply period</p>
            </div>
            <div className="glass rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <TrendingUp className="w-6 h-6 text-blue-500 mb-2" />
              <p className="text-sm font-medium text-nilin-charcoal">Avg Ratio</p>
              <p className="text-xl font-serif text-blue-600">{data.overallRatio.toFixed(2)}</p>
              <p className="text-xs text-nilin-warmGray mt-1">Platform-wide</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplyDemandRatio;
