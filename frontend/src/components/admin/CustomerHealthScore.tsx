import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Clock,
  ShoppingCart,
  Star,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  Users,
  Award,
  Target,
  Zap
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface EngagementMetrics {
  loginFrequency: number;
  bookingFrequency: number;
  reviewRate: number;
  referralRate: number;
  retentionDays: number;
}

interface CustomerHealthData {
  overallScore: number;
  engagement: EngagementMetrics;
  lifetimeValue: number;
  segment: 'new' | 'active' | 'at_risk' | 'churned';
  lastActivity: string;
  totalBookings: number;
  avgOrderValue: number;
  churnRisk: 'low' | 'medium' | 'high' | 'critical';
  trend: Array<{ month: string; engagement: number; bookings: number }>;
  engagementScore: number;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  recommendationScore: number;
}

interface CustomerHealthScoreProps {
  customerId?: string;
  embedded?: boolean;
  onClose?: () => void;
}

const CHURN_COLORS = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#DC2626'
};

const SEGMENT_CONFIG = {
  new: { label: 'New Customer', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200' },
  at_risk: { label: 'At Risk', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  churned: { label: 'Churned', color: 'bg-red-100 text-red-700 border-red-200' }
};

const getTierConfig = (tier: string) => {
  const configs = {
    bronze: { label: 'Bronze', bgColor: 'bg-amber-700', textColor: 'text-amber-100', icon: '🥉' },
    silver: { label: 'Silver', bgColor: 'bg-gray-400', textColor: 'text-gray-100', icon: '🥈' },
    gold: { label: 'Gold', bgColor: 'bg-yellow-500', textColor: 'text-yellow-900', icon: '🥇' },
    platinum: { label: 'Platinum', bgColor: 'bg-purple-500', textColor: 'text-purple-100', icon: '💎' }
  };
  return configs[tier as keyof typeof configs] || configs.bronze;
};

export const CustomerHealthScore: React.FC<CustomerHealthScoreProps> = ({
  customerId,
  embedded = false,
  onClose
}) => {
  const [data, setData] = useState<CustomerHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMetric, setActiveMetric] = useState<'engagement' | 'value' | 'loyalty'>('engagement');

  const fetchHealthScore = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get(customerId
        ? `/admin/customers/${customerId}/health-score`
        : '/admin/health-scores/customers'
      );

      if (response.data?.success) {
        setData(response.data.data);
      } else {
        // Mock data
        setData({
          overallScore: 78,
          engagement: {
            loginFrequency: 85,
            bookingFrequency: 72,
            reviewRate: 65,
            referralRate: 45,
            retentionDays: 120
          },
          lifetimeValue: 2450,
          segment: 'active',
          lastActivity: new Date().toISOString(),
          totalBookings: 18,
          avgOrderValue: 136,
          churnRisk: 'low',
          trend: [
            { month: 'Jan', engagement: 60, bookings: 2 },
            { month: 'Feb', engagement: 65, bookings: 3 },
            { month: 'Mar', engagement: 70, bookings: 2 },
            { month: 'Apr', engagement: 75, bookings: 4 },
            { month: 'May', engagement: 78, bookings: 5 },
            { month: 'Jun', engagement: 82, bookings: 2 }
          ],
          engagementScore: 82,
          loyaltyTier: 'gold',
          recommendationScore: 75
        });
      }
    } catch (err) {
      console.error('Error fetching customer health score:', err);
      setError('Failed to load health score data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchHealthScore();
  }, [fetchHealthScore]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealthScore();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-6xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-48 bg-nilin-blush/30 rounded-xl"></div>
            <div className="h-48 bg-nilin-blush/30 rounded-xl"></div>
            <div className="h-48 bg-nilin-blush/30 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-6xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Health Score</h3>
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

  const segmentConfig = SEGMENT_CONFIG[data.segment];
  const tierConfig = getTierConfig(data.loyaltyTier);
  const churnColor = CHURN_COLORS[data.churnRisk];

  const radarData = [
    { metric: 'Login Frequency', value: data.engagement.loginFrequency },
    { metric: 'Booking Rate', value: data.engagement.bookingFrequency },
    { metric: 'Review Rate', value: data.engagement.reviewRate },
    { metric: 'Referral Rate', value: data.engagement.referralRate }
  ];

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-6xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Customer Health Score</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Engagement & retention metrics</p>
          </div>
          <div className={cn('px-3 py-1.5 rounded-full border text-xs font-semibold', segmentConfig.color)}>
            {segmentConfig.label}
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

      {/* Churn Risk Banner */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between"
        style={{ backgroundColor: `${churnColor}15`, border: `1px solid ${churnColor}30` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${churnColor}20` }}
          >
            <Zap className="w-5 h-5" style={{ color: churnColor }} />
          </div>
          <div>
            <p className="font-medium text-nilin-charcoal">Churn Risk Level</p>
            <p className="text-sm text-nilin-warmGray capitalize">{data.churnRisk} risk</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-2xl font-serif" style={{ color: churnColor }}>{data.overallScore}</p>
            <p className="text-xs text-nilin-warmGray">Health Score</p>
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <ShoppingCart className="w-6 h-6 text-nilin-coral mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{data.totalBookings}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Total Bookings</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">AED {data.avgOrderValue}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Avg Order Value</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Award className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">AED {data.lifetimeValue}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Lifetime Value</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Calendar className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{data.engagement.retentionDays}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Days Retained</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Engagement Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Engagement Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E8E0D8',
                    fontFamily: 'system-ui'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#E8B4A8"
                  fill="#E8B4A840"
                  strokeWidth={2}
                  name="Engagement"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Engagement Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis dataKey="metric" stroke="#6B7280" fontSize={11} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#6B7280" fontSize={10} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#E8B4A8"
                  fill="#E8B4A8"
                  fillOpacity={0.5}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E8E0D8',
                    fontFamily: 'system-ui'
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Detailed Engagement Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#3B82F6"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${data.engagement.loginFrequency * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-nilin-charcoal">
                {data.engagement.loginFrequency}%
              </span>
            </div>
            <p className="text-xs text-nilin-warmGray">Login Frequency</p>
          </div>
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="6" fill="none" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#10B981"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${data.engagement.bookingFrequency * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-nilin-charcoal">
                {data.engagement.bookingFrequency}%
              </span>
            </div>
            <p className="text-xs text-nilin-warmGray">Booking Rate</p>
          </div>
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="6" fill="none" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#F59E0B"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${data.engagement.reviewRate * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-nilin-charcoal">
                {data.engagement.reviewRate}%
              </span>
            </div>
            <p className="text-xs text-nilin-warmGray">Review Rate</p>
          </div>
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="6" fill="none" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#8B5CF6"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${data.engagement.referralRate * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-nilin-charcoal">
                {data.engagement.referralRate}%
              </span>
            </div>
            <p className="text-xs text-nilin-warmGray">Referral Rate</p>
          </div>
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="6" fill="none" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#EC4899"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${data.recommendationScore * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-nilin-charcoal">
                {data.recommendationScore}%
              </span>
            </div>
            <p className="text-xs text-nilin-warmGray">NPS Score</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerHealthScore;
