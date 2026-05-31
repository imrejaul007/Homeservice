// Funnel Drop-off Analysis - Multi-stage booking funnel with conversion tracking
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  Search,
  CreditCard,
  CheckCircle,
  XCircle,
  MousePointer,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  BarChart3,
  Target,
  Timer,
  AlertTriangle
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
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../utils/formatting';
import { api } from '../../services/api';

interface FunnelStage {
  id: string;
  name: string;
  key: string;
  count: number;
  percentage: number;
  dropoffRate: number;
  dropoffCount: number;
  avgTimeSeconds: number;
  conversionRate: number;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface DropOffReason {
  stage: string;
  reason: string;
  count: number;
  percentage: number;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface FunnelMetrics {
  totalVisitors: number;
  totalBookings: number;
  overallConversionRate: number;
  avgTimeToConvertMinutes: number;
  revenueAtRisk: number;
  stages: FunnelStage[];
  dropoffReasons: DropOffReason[];
  conversionTrend: Array<{
    date: string;
    views: number;
    searches: number;
    bookings: number;
    payments: number;
    confirmed: number;
  }>;
  deviceConversion: Array<{
    device: string;
    views: number;
    bookings: number;
    rate: number;
  }>;
  locationConversion: Array<{
    location: string;
    views: number;
    bookings: number;
    rate: number;
  }>;
  timeToConvert: Array<{
    bucket: string;
    count: number;
    percentage: number;
  }>;
  revenueImpact: {
    estimatedLostRevenue: number;
    potentialRecovery: number;
    avgBookingValue: number;
  };
}

interface FunnelDropOffAnalysisProps {
  embedded?: boolean;
  onClose?: () => void;
}

const STAGE_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  views: { icon: Eye, color: '#3B82F6', bgColor: 'bg-blue-500' },
  search: { icon: Search, color: '#8B5CF6', bgColor: 'bg-purple-500' },
  booking: { icon: FileText, color: '#F59E0B', bgColor: 'bg-amber-500' },
  payment: { icon: CreditCard, color: '#EF4444', bgColor: 'bg-red-500' },
  confirmed: { icon: CheckCircle, color: '#10B981', bgColor: 'bg-green-500' }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatTime = (seconds: number): string => {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
};

export const FunnelDropOffAnalysis: React.FC<FunnelDropOffAnalysisProps> = ({
  embedded = false,
  onClose
}) => {
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<string>('30d');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'funnel' | 'trends' | 'reasons' | 'impact'>('funnel');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/funnel-dropoff', {
        params: { dateRange }
      });

      if (response.data?.success) {
        setMetrics(response.data.data);
      } else {
        // Mock data
        const stages: FunnelStage[] = [
          {
            id: 'views',
            name: 'Page Views',
            key: 'views',
            count: 45678,
            percentage: 100,
            dropoffRate: 0,
            dropoffCount: 0,
            avgTimeSeconds: 45,
            conversionRate: 100,
            description: 'Total unique visitors to the booking page',
            icon: Eye,
            color: '#3B82F6'
          },
          {
            id: 'search',
            name: 'Search Initiated',
            key: 'search',
            count: 28934,
            percentage: 63.3,
            dropoffRate: 36.7,
            dropoffCount: 16744,
            avgTimeSeconds: 120,
            conversionRate: 63.3,
            description: 'Users who initiated a service search',
            icon: Search,
            color: '#8B5CF6'
          },
          {
            id: 'booking',
            name: 'Booking Started',
            key: 'booking',
            count: 12456,
            percentage: 27.3,
            dropoffRate: 36.0,
            dropoffCount: 16478,
            avgTimeSeconds: 300,
            conversionRate: 43.0,
            description: 'Users who started filling the booking form',
            icon: FileText,
            color: '#F59E0B'
          },
          {
            id: 'payment',
            name: 'Payment Page',
            key: 'payment',
            count: 8923,
            percentage: 19.5,
            dropoffRate: 7.8,
            dropoffCount: 3533,
            avgTimeSeconds: 180,
            conversionRate: 71.6,
            description: 'Users who reached the payment page',
            icon: CreditCard,
            color: '#EF4444'
          },
          {
            id: 'confirmed',
            name: 'Booking Confirmed',
            key: 'confirmed',
            count: 7234,
            percentage: 15.8,
            dropoffRate: 3.7,
            dropoffCount: 1689,
            avgTimeSeconds: 0,
            conversionRate: 81.1,
            description: 'Successfully completed bookings',
            icon: CheckCircle,
            color: '#10B981'
          }
        ];

        setMetrics({
          totalVisitors: 45678,
          totalBookings: 7234,
          overallConversionRate: 15.8,
          avgTimeToConvertMinutes: 12.5,
          revenueAtRisk: 234500,
          stages,
          dropoffReasons: [
            {
              stage: 'Search',
              reason: 'No results matching criteria',
              count: 4523,
              percentage: 27.0,
              severity: 'high',
              recommendation: 'Improve search algorithm and expand provider coverage'
            },
            {
              stage: 'Booking Form',
              reason: 'Form abandonment - too many fields',
              count: 3892,
              percentage: 23.2,
              severity: 'high',
              recommendation: 'Simplify booking form, reduce required fields'
            },
            {
              stage: 'Booking Form',
              reason: 'Price too high compared to expectations',
              count: 2856,
              percentage: 17.1,
              severity: 'medium',
              recommendation: 'Display price ranges upfront, offer payment plans'
            },
            {
              stage: 'Payment',
              reason: 'Payment method issues',
              count: 1845,
              percentage: 11.0,
              severity: 'medium',
              recommendation: 'Add more payment options, improve checkout flow'
            },
            {
              stage: 'Payment',
              reason: 'Security concerns / trust issues',
              count: 1234,
              percentage: 7.4,
              severity: 'medium',
              recommendation: 'Display security badges, improve trust signals'
            },
            {
              stage: 'Search',
              reason: 'Provider not available at desired time',
              count: 2345,
              percentage: 14.0,
              severity: 'low',
              recommendation: 'Expand provider availability windows'
            }
          ],
          conversionTrend: [
            { date: 'Mon', views: 6500, searches: 4100, bookings: 1750, payments: 1250, confirmed: 1020 },
            { date: 'Tue', views: 6200, searches: 3950, bookings: 1680, payments: 1200, confirmed: 980 },
            { date: 'Wed', views: 6800, searches: 4300, bookings: 1850, payments: 1320, confirmed: 1080 },
            { date: 'Thu', views: 7100, searches: 4500, bookings: 1950, payments: 1400, confirmed: 1150 },
            { date: 'Fri', views: 7800, searches: 4950, bookings: 2100, payments: 1500, confirmed: 1220 },
            { date: 'Sat', views: 6200, searches: 3900, bookings: 1680, payments: 1200, confirmed: 980 },
            { date: 'Sun', views: 5080, searches: 3234, bookings: 1446, payments: 1053, confirmed: 804 }
          ],
          deviceConversion: [
            { device: 'Mobile', views: 28560, bookings: 4123, rate: 14.4 },
            { device: 'Desktop', views: 12340, bookings: 2345, rate: 19.0 },
            { device: 'Tablet', views: 4778, bookings: 766, rate: 16.0 }
          ],
          locationConversion: [
            { location: 'Dubai Marina', views: 12340, bookings: 2156, rate: 17.5 },
            { location: 'Downtown Dubai', views: 9876, bookings: 1723, rate: 17.4 },
            { location: 'Jumeirah', views: 7654, bookings: 1234, rate: 16.1 },
            { location: 'Abu Dhabi', views: 6543, bookings: 987, rate: 15.1 },
            { location: 'Sharjah', views: 9265, bookings: 1134, rate: 12.2 }
          ],
          timeToConvert: [
            { bucket: '0-2 min', count: 2345, percentage: 32.4 },
            { bucket: '2-5 min', count: 1890, percentage: 26.1 },
            { bucket: '5-10 min', count: 1456, percentage: 20.1 },
            { bucket: '10-30 min', count: 890, percentage: 12.3 },
            { bucket: '30+ min', count: 653, percentage: 9.0 }
          ],
          revenueImpact: {
            estimatedLostRevenue: 156780,
            potentialRecovery: 45670,
            avgBookingValue: 450
          }
        });
      }
    } catch (err) {
      console.error('Error fetching funnel dropoff data:', err);
      setError('Failed to load funnel analysis data');
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

  const maxCount = metrics?.stages[0]?.count || 1;

  const renderFunnelView = () => (
    <div className="space-y-6">
      {/* Visual Funnel */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Booking Funnel</h3>
        <div className="space-y-3">
          {metrics?.stages.map((stage, index) => {
            const config = STAGE_CONFIG[stage.key];
            const StageIcon = config?.icon || Eye;
            const barWidth = (stage.count / maxCount) * 100;
            const isExpanded = expandedStage === stage.id;

            return (
              <div key={stage.id} className="relative">
                <div
                  className="glass rounded-xl border border-nilin-border/50 p-4 cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${stage.color}20` }}
                    >
                      <StageIcon className="w-5 h-5" style={{ color: stage.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-nilin-charcoal">{stage.name}</span>
                          <span className="text-xs text-nilin-warmGray">Stage {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-serif text-nilin-charcoal">
                            {stage.count.toLocaleString()}
                          </span>
                          <span className="text-sm text-nilin-warmGray">
                            ({stage.percentage.toFixed(1)}%)
                          </span>
                          {stage.dropoffRate > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              -{stage.dropoffRate.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-4 bg-nilin-blush/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-nilin-warmGray transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 ml-14 p-4 bg-nilin-blush/20 rounded-xl">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-nilin-warmGray">Users at Stage</p>
                        <p className="text-lg font-serif text-nilin-charcoal">
                          {stage.count.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-nilin-warmGray">Drop-off</p>
                        <p className="text-lg font-serif text-red-600">
                          -{stage.dropoffCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-nilin-warmGray">Avg. Time Here</p>
                        <p className="text-lg font-serif text-nilin-charcoal">
                          {formatTime(stage.avgTimeSeconds)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-nilin-warmGray">Stage Conversion</p>
                        <p className="text-lg font-serif text-green-600">
                          {stage.conversionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-nilin-warmGray mt-3">{stage.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drop-off Heatmap */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Drop-off Heatmap</h3>
        <div className="space-y-2">
          {metrics?.stages.slice(1).map((stage) => {
            const dropoffPercent = stage.dropoffRate;
            const bgColor =
              dropoffPercent > 30 ? 'bg-red-500' :
              dropoffPercent > 20 ? 'bg-amber-500' :
              dropoffPercent > 10 ? 'bg-yellow-500' :
              'bg-green-500';

            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div className="w-32 text-sm text-nilin-charcoal">{stage.name}</div>
                <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', bgColor)}
                    style={{ width: `${dropoffPercent}%` }}
                  />
                </div>
                <div className="w-16 text-sm text-right font-medium text-red-600">
                  -{dropoffPercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Low (&lt;10%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Medium (10-20%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>High (20-30%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Critical (&gt;30%)</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrendsView = () => (
    <div className="space-y-6">
      {/* Conversion Trend */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Daily Conversion Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics?.conversionTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              <Line type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={2} name="Views" />
              <Line type="monotone" dataKey="searches" stroke="#8B5CF6" strokeWidth={2} name="Searches" />
              <Line type="monotone" dataKey="bookings" stroke="#F59E0B" strokeWidth={2} name="Bookings" />
              <Line type="monotone" dataKey="payments" stroke="#EF4444" strokeWidth={2} name="Payments" />
              <Line type="monotone" dataKey="confirmed" stroke="#10B981" strokeWidth={3} name="Confirmed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Device & Location Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Device</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.deviceConversion || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#6B7280" fontSize={11} />
                <YAxis dataKey="device" type="category" stroke="#6B7280" fontSize={11} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="views" fill="#3B82F6" name="Views" radius={[0, 4, 4, 0]} />
                <Bar dataKey="bookings" fill="#10B981" name="Bookings" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {metrics?.deviceConversion.map(device => (
              <div key={device.device} className="flex items-center justify-between text-sm">
                <span className="text-nilin-warmGray">{device.device}</span>
                <span className={cn(
                  'font-medium',
                  device.rate >= 17 ? 'text-green-600' : device.rate >= 14 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {device.rate}% conversion
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Time to Convert</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.timeToConvert || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="bucket" stroke="#6B7280" fontSize={10} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="count" fill="#8B5CF6" name="Users" radius={[4, 4, 0, 0]}>
                  {metrics?.timeToConvert.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? '#10B981' : index === 1 ? '#8B5CF6' : '#6B7280'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReasonsView = () => (
    <div className="space-y-6">
      {/* Drop-off Reasons */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Drop-off Reasons</h3>
        <div className="space-y-4">
          {metrics?.dropoffReasons.map((reason, idx) => (
            <div
              key={idx}
              className={cn(
                'p-4 rounded-xl border',
                reason.severity === 'high' ? 'bg-red-50/50 border-red-200' :
                reason.severity === 'medium' ? 'bg-amber-50/50 border-amber-200' :
                'bg-blue-50/50 border-blue-200'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    reason.severity === 'high' ? 'bg-red-100 text-red-700' :
                    reason.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {reason.stage}
                  </span>
                  <h4 className="font-medium text-nilin-charcoal mt-1">{reason.reason}</h4>
                </div>
                <div className="text-right">
                  <p className="text-lg font-serif text-nilin-charcoal">
                    {reason.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-nilin-warmGray">
                    {reason.percentage}% of drop-offs
                  </p>
                </div>
              </div>
              <div className="mt-2 p-3 bg-white/50 rounded-lg">
                <p className="text-xs text-green-700 font-medium mb-1">Recommendation</p>
                <p className="text-sm text-nilin-charcoal">{reason.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Location Breakdown */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Conversion by Location</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nilin-blush/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray">Location</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Views</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Bookings</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nilin-border/30">
              {metrics?.locationConversion.map(location => {
                const performance = location.rate >= 16 ? 'good' : location.rate >= 14 ? 'average' : 'poor';
                return (
                  <tr key={location.location}>
                    <td className="px-4 py-3 font-medium text-nilin-charcoal">{location.location}</td>
                    <td className="px-4 py-3 text-right text-nilin-charcoal">{location.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-nilin-charcoal">{location.bookings.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">{location.rate.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        performance === 'good' ? 'bg-green-100 text-green-700' :
                        performance === 'average' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {performance === 'good' ? 'Above Avg' : performance === 'average' ? 'Average' : 'Below Avg'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderImpactView = () => (
    <div className="space-y-6">
      {/* Revenue Impact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{formatCurrency(metrics?.revenueImpact.estimatedLostRevenue || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Estimated Lost Revenue</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatCurrency(metrics?.revenueImpact.potentialRecovery || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Potential Recovery</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{formatCurrency(metrics?.revenueImpact.avgBookingValue || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Avg. Booking Value</p>
        </div>
      </div>

      {/* Recovery Potential */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Recovery Potential by Fix</h3>
        <div className="space-y-4">
          {metrics?.dropoffReasons
            .filter(r => r.severity !== 'low')
            .map((reason, idx) => {
              const potentialRecovery = (reason.count * metrics.revenueImpact.avgBookingValue * 0.3);
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-48">
                    <p className="text-sm font-medium text-nilin-charcoal">{reason.reason}</p>
                    <p className="text-xs text-nilin-warmGray">{reason.stage}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                        style={{ width: `${(potentialRecovery / (metrics?.revenueImpact.potentialRecovery || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <p className="text-sm font-medium text-green-600">
                      +{formatCurrency(potentialRecovery)}
                    </p>
                    <p className="text-xs text-nilin-warmGray">
                      {((potentialRecovery / (metrics?.revenueImpact.potentialRecovery || 1)) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Key Insights */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
        <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Key Insights
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>The largest drop-off (36.7%) occurs at the Search stage. Focus on improving search relevance.</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>32.4% of users convert within 2 minutes. Optimize for quick completions.</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Desktop has 19% conversion vs Mobile 14.4%. Improve mobile UX for biggest impact.</span>
          </li>
        </ul>
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Funnel Analysis</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Funnel Drop-off Analysis</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Booking conversion funnel analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <Eye className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{formatNumber(metrics?.totalVisitors || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Visitors</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatNumber(metrics?.totalBookings || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Bookings</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <Target className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{metrics?.overallConversionRate.toFixed(1)}%</p>
          <p className="text-xs text-nilin-warmGray">Conversion Rate</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Timer className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{metrics?.avgTimeToConvertMinutes.toFixed(1)}</p>
          <p className="text-xs text-nilin-warmGray">Avg. Time (min)</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{formatCurrency(metrics?.revenueAtRisk || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Revenue at Risk</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['funnel', 'trends', 'reasons', 'impact'] as const).map(view => (
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
            {view === 'funnel' ? 'Funnel' : view === 'trends' ? 'Trends' : view === 'reasons' ? 'Reasons' : 'Impact'}
          </button>
        ))}
      </div>

      {/* Content based on selected view */}
      {selectedView === 'funnel' && renderFunnelView()}
      {selectedView === 'trends' && renderTrendsView()}
      {selectedView === 'reasons' && renderReasonsView()}
      {selectedView === 'impact' && renderImpactView()}
    </div>
  );
};

export default FunnelDropOffAnalysis;
