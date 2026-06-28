import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
// Customer Journey Map - Visual journey stages with touchpoint analysis
import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Users,
  MapPin,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  Target,
  ArrowRight,
  ArrowDown,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  Search,
  Star,
  MessageCircle,
  CreditCard,
  Calendar,
  Home,
  Heart,
  AlertTriangle,
  Zap,
  Lightbulb,
  Thermometer,
  Droplets
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
  Sankey,
  ScatterChart,
  Scatter
} from 'recharts';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../utils/formatting';
import { api } from '../../services/api';

interface JourneyStage {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  touchpoints: Touchpoint[];
  avgDuration: number;
  conversionRate: number;
  dropoffRate: number;
  satisfaction: number;
  count: number;
}

interface Touchpoint {
  id: string;
  name: string;
  type: 'app' | 'web' | 'phone' | 'chat' | 'email' | 'in_person';
  interactions: number;
  satisfaction: number;
  avgDuration: number;
}

interface PainPoint {
  id: string;
  stage: string;
  description: string;
  frequency: number;
  severity: 'high' | 'medium' | 'low';
  impact: number;
  suggestion: string;
}

interface ConversionPath {
  path: string[];
  count: number;
  conversionRate: number;
  revenue: number;
}

interface CustomerJourneyMetrics {
  totalCustomers: number;
  avgJourneyLength: number;
  avgCompletionRate: number;
  avgTimeToConvert: number;
  stages: JourneyStage[];
  painPoints: PainPoint[];
  conversionPaths: ConversionPath[];
  touchpointEffectiveness: Array<{
    name: string;
    type: string;
    effectiveness: number;
    interactions: number;
  }>;
  satisfactionTrend: Array<{
    stage: string;
    score: number;
  }>;
  journeyPatterns: Array<{
    pattern: string;
    percentage: number;
    avgValue: number;
  }>;
  dropOffHeatmap: Array<{
    fromStage: string;
    toStage: string;
    dropoff: number;
  }>;
}

interface CustomerJourneyMapProps {
  embedded?: boolean;
  onClose?: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  awareness: '#3B82F6',
  consideration: '#8B5CF6',
  decision: '#F59E0B',
  booking: '#EF4444',
  payment: '#EC4899',
  service: '#10B981',
  review: '#6366F1',
  loyalty: '#22C55E'
};

const TOUCHPOINT_ICONS: Record<string, React.ElementType> = {
  app: MapPin,
  web: Eye,
  phone: Users,
  chat: MessageCircle,
  email: Star,
  in_person: Home
};

const formatTime = (minutes: number): string => {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes)}m`;
};

export const CustomerJourneyMap: React.FC<CustomerJourneyMapProps> = ({
  embedded = false,
  onClose
}) => {
  const [metrics, setMetrics] = useState<CustomerJourneyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'journey' | 'touchpoints' | 'pains' | 'paths'>('journey');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/customer-journey');

      if (response.data?.success) {
        setMetrics(response.data.data);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching customer journey data:', err);
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

  const maxCount = metrics?.stages[0]?.count || 1;

  const renderJourneyView = () => (
    <div className="space-y-6">
      {/* Journey Visualization */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-6">Customer Journey Flow</h3>

        {/* Stage Cards */}
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-nilin-coral to-green-500 opacity-30" />

          <div className="space-y-4">
            {metrics?.stages.map((stage, index) => {
              const StageIcon = stage.icon;
              const isExpanded = expandedStage === stage.id;
              const barWidth = (stage.count / maxCount) * 100;

              return (
                <div key={stage.id} className="relative">
                  {/* Connector */}
                  {index > 0 && (
                    <div className="absolute left-1/2 -top-4 transform -translate-x-1/2 z-10">
                      <div className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        stage.dropoffRate > 15 ? 'bg-red-100 text-red-600' :
                        stage.dropoffRate > 10 ? 'bg-amber-100 text-amber-600' :
                        'bg-green-100 text-green-600'
                      )}>
                        -{stage.dropoffRate}% drop
                      </div>
                    </div>
                  )}

                  {/* Stage Card */}
                  <div
                    className={cn(
                      'relative flex items-center gap-4 p-4 rounded-xl border border-nilin-border/50 cursor-pointer transition-all',
                      isExpanded ? 'bg-nilin-blush/20 shadow-md' : 'bg-white hover:shadow-sm'
                    )}
                    onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  >
                    {/* Stage Number */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm z-10"
                      style={{ backgroundColor: stage.color }}
                    >
                      {index + 1}
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <StageIcon className="w-5 h-5" style={{ color: stage.color }} />
                        <span className="font-medium text-nilin-charcoal">{stage.name}</span>
                        <span className="text-xs text-nilin-warmGray">
                          {stage.count.toLocaleString()} customers
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barWidth}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-serif text-nilin-charcoal">{stage.conversionRate}%</p>
                        <p className="text-xs text-nilin-warmGray">Conversion</p>
                      </div>
                      <div className="text-center">
                        <p className="font-serif text-nilin-charcoal">{formatTime(stage.avgDuration)}</p>
                        <p className="text-xs text-nilin-warmGray">Avg Time</p>
                      </div>
                      <div className="text-center">
                        <p className="font-serif text-green-600">{stage.satisfaction.toFixed(1)}</p>
                        <p className="text-xs text-nilin-warmGray">Satisfaction</p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Touchpoints */}
                  {isExpanded && (
                    <div className="ml-14 mt-2 p-4 bg-white rounded-xl border border-nilin-border/30">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Touchpoints</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {stage.touchpoints.map(tp => {
                          const TpIcon = TOUCHPOINT_ICONS[tp.type] || MapPin;
                          return (
                            <div key={tp.id} className="p-3 bg-nilin-blush/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <TpIcon className="w-4 h-4 text-nilin-warmGray" />
                                <span className="text-sm font-medium text-nilin-charcoal">{tp.name}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-nilin-warmGray">
                                <span>{tp.interactions.toLocaleString()} interactions</span>
                                <span>{tp.satisfaction} satisfaction</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Satisfaction Trend */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Satisfaction by Stage</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics?.satisfactionTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="stage" stroke="#6B7280" fontSize={10} />
              <YAxis stroke="#6B7280" fontSize={11} domain={[3.5, 5]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              <Area type="monotone" dataKey="score" stroke="#10B981" fill="#10B98120" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderTouchpointsView = () => (
    <div className="space-y-6">
      {/* Touchpoint Effectiveness */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Touchpoint Effectiveness</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                type="number"
                dataKey="interactions"
                stroke="#6B7280"
                fontSize={11}
                name="Interactions"
                label={{ value: 'Interactions', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="effectiveness"
                stroke="#6B7280"
                fontSize={11}
                domain={[0, 100]}
                name="Effectiveness"
                label={{ value: 'Effectiveness %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                formatter={(value: number, name: string) => [
                  name === 'interactions' ? value.toLocaleString() : `${value}%`,
                  name === 'interactions' ? 'Interactions' : 'Effectiveness'
                ]}
              />
              <Scatter
                data={metrics?.touchpointEffectiveness || []}
                fill="#3B82F6"
              >
                {(metrics?.touchpointEffectiveness || []).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.effectiveness > 85 ? '#10B981' : entry.effectiveness > 70 ? '#F59E0B' : '#EF4444'}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>High (&gt;85%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>Medium (70-85%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Low (&lt;70%)</span>
          </div>
        </div>
      </div>

      {/* Journey Patterns */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Journey Patterns</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics?.journeyPatterns || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" stroke="#6B7280" fontSize={11} />
              <YAxis dataKey="pattern" type="category" stroke="#6B7280" fontSize={10} width={150} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              <Bar dataKey="percentage" name="Percentage" radius={[0, 4, 4, 0]}>
                {(metrics?.journeyPatterns || []).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? '#10B981' : index === 1 ? '#3B82F6' : index === 2 ? '#6B7280' : '#8B5CF6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderPainsView = () => (
    <div className="space-y-6">
      {/* Pain Points */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Identified Pain Points</h3>
        <div className="space-y-4">
          {metrics?.painPoints.map(pain => (
            <div
              key={pain.id}
              className={cn(
                'p-4 rounded-xl border',
                pain.severity === 'high' ? 'bg-red-50/50 border-red-200' :
                pain.severity === 'medium' ? 'bg-amber-50/50 border-amber-200' :
                'bg-blue-50/50 border-blue-200'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    pain.severity === 'high' ? 'bg-red-100 text-red-700' :
                    pain.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {pain.stage}
                  </span>
                  <h4 className="font-medium text-nilin-charcoal mt-1">{pain.description}</h4>
                </div>
                <div className="text-right">
                  <p className="text-lg font-serif text-nilin-charcoal">{pain.frequency.toLocaleString()}</p>
                  <p className="text-xs text-nilin-warmGray">occurrences</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-nilin-warmGray">Impact:</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                      style={{ width: `${pain.impact * 10}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-white/50 rounded-lg">
                <p className="text-xs text-green-700 font-medium mb-1 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Suggested Fix
                </p>
                <p className="text-sm text-nilin-charcoal">{pain.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop-off Heatmap */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Drop-off Heatmap</h3>
        <div className="space-y-3">
          {metrics?.dropOffHeatmap.map((dropoff, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="w-32 text-sm text-nilin-charcoal truncate">{dropoff.fromStage}</div>
              <ArrowRight className="w-4 h-4 text-nilin-warmGray" />
              <div className="w-32 text-sm text-nilin-charcoal truncate">{dropoff.toStage}</div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      dropoff.dropoff > 15 ? 'bg-red-500' :
                      dropoff.dropoff > 10 ? 'bg-amber-500' :
                      'bg-green-500'
                    )}
                    style={{ width: `${dropoff.dropoff * 4}%` }}
                  />
                </div>
              </div>
              <div className="w-12 text-sm text-right font-medium text-red-600">
                -{dropoff.dropoff}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPathsView = () => (
    <div className="space-y-6">
      {/* Conversion Paths */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Top Conversion Paths</h3>
        <div className="space-y-4">
          {metrics?.conversionPaths.map((path, idx) => (
            <div key={idx} className="p-4 bg-nilin-blush/20 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-nilin-coral text-white text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-nilin-charcoal">
                    {path.count.toLocaleString()} customers
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-serif text-green-600">{path.conversionRate}%</p>
                  <p className="text-xs text-nilin-warmGray">conversion rate</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {path.path.map((stage, stageIdx) => (
                  <React.Fragment key={stageIdx}>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: STAGE_COLORS[stage] || '#6B7280' }}
                    >
                      {stage}
                    </span>
                    {stageIdx < path.path.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-nilin-warmGray" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue by Path */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue Contribution by Path</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={metrics?.conversionPaths || []}
                dataKey="revenue"
                nameKey="path"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(props: { payload?: { path?: string[] } }) => `${props.payload?.path?.length ?? 0} stages`}
              >
                {(metrics?.conversionPaths || []).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? '#10B981' : index === 1 ? '#3B82F6' : index === 2 ? '#8B5CF6' : '#F59E0B'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                formatter={(value: number) => formatTime(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

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
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Customer Journey</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Customer Journey Map</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Visual journey analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
            >
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
          <Users className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{formatNumber(metrics?.totalCustomers || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Customers</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <Target className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{metrics?.avgCompletionRate}%</p>
          <p className="text-xs text-nilin-warmGray">Completion Rate</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <Clock className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatTime(metrics?.avgTimeToConvert || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Avg Time to Convert</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Zap className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{metrics?.avgJourneyLength}</p>
          <p className="text-xs text-nilin-warmGray">Avg Journey Stages</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['journey', 'touchpoints', 'pains', 'paths'] as const).map(view => (
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
            {view === 'journey' ? 'Journey' : view === 'touchpoints' ? 'Touchpoints' : view === 'pains' ? 'Pain Points' : 'Paths'}
          </button>
        ))}
      </div>

      {/* Content */}
      {selectedView === 'journey' && renderJourneyView()}
      {selectedView === 'touchpoints' && renderTouchpointsView()}
      {selectedView === 'pains' && renderPainsView()}
      {selectedView === 'paths' && renderPathsView()}
    </div>
  );
};

export default CustomerJourneyMap;
