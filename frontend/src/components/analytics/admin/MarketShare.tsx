// Market Share - Admin Analytics Component
import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { PieChart as PieIcon, TrendingUp, Loader, Globe, Users, DollarSign, Target, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface MarketShareProps {
  timeRange?: '30d' | '90d' | '1y';
  region?: string;
}

interface MarketShareData {
  platform: string;
  share: number;
  revenue: number;
  customers: number;
  growth: number;
  color: string;
}

interface TrendData {
  month: string;
  yourPlatform: number;
  competitor1: number;
  competitor2: number;
  competitor3: number;
}

interface ProjectionData {
  month: string;
  projected: number;
  optimistic: number;
  pessimistic: number;
}

interface ShareStats {
  currentShare: number;
  previousShare: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  totalMarket: number;
  totalRevenue: number;
  growthRate: number;
}

const PLATFORM_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const buildProjectionData = (trendData: TrendData[], growthRate: number): ProjectionData[] => {
  if (trendData.length === 0) {
    return [];
  }

  const latest = trendData[trendData.length - 1];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startIndex = monthNames.indexOf(latest.month);

  return Array.from({ length: 6 }, (_, index) => {
    const projected = Math.min(100, latest.yourPlatform + (index + 1) * (growthRate / 12));
    return {
      month: monthNames[(startIndex + index + 1) % monthNames.length],
      projected: Math.round(projected * 10) / 10,
      optimistic: Math.round((projected + 2) * 10) / 10,
      pessimistic: Math.round(Math.max(0, projected - 2) * 10) / 10,
    };
  });
};

export const MarketShare: React.FC<MarketShareProps> = ({
  timeRange = '90d',
  region: initialRegion = 'all',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<MarketShareData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [projectionData, setProjectionData] = useState<ProjectionData[]>([]);
  const [stats, setStats] = useState<ShareStats>({
    currentShare: 0,
    previousShare: 0,
    change: 0,
    changePercent: 0,
    trend: 'stable',
    totalMarket: 0,
    totalRevenue: 0,
    growthRate: 0,
  });
  const [platformCustomers, setPlatformCustomers] = useState(0);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [selectedRegion, setSelectedRegion] = useState(initialRegion);
  const [viewMode, setViewMode] = useState<'pie' | 'trend' | 'projection'>('pie');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getAdminMarketShare(selectedRange, selectedRegion);
        const coloredShare = (apiData.share || []).map((entry, index) => ({
          ...entry,
          color: PLATFORM_COLORS[index % PLATFORM_COLORS.length],
        }));

        const yourPlatform = coloredShare.find((entry) => entry.platform === 'Your Platform') || coloredShare[0];
        const previousShare = apiData.trend?.length > 1
          ? apiData.trend[apiData.trend.length - 2].yourPlatform
          : yourPlatform?.share || 0;
        const currentShare = yourPlatform?.share || 0;
        const change = currentShare - previousShare;
        const changePercent = previousShare > 0 ? (change / previousShare) * 100 : 0;

        setShareData(coloredShare);
        setTrendData(apiData.trend || []);
        setProjectionData(buildProjectionData(apiData.trend || [], yourPlatform?.growth || 0));
        setPlatformCustomers(yourPlatform?.customers || 0);
        setStats({
          currentShare,
          previousShare,
          change,
          changePercent: Math.round(changePercent * 10) / 10,
          trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
          totalMarket: apiData.totalMarket || 0,
          totalRevenue: yourPlatform?.revenue || 0,
          growthRate: yourPlatform?.growth || 0,
        });
      } catch (err) {
        setShareData([]);
        setTrendData([]);
        setProjectionData([]);
        setPlatformCustomers(0);
        setStats({
          currentShare: 0,
          previousShare: 0,
          change: 0,
          changePercent: 0,
          trend: 'stable',
          totalMarket: 0,
          totalRevenue: 0,
          growthRate: 0,
        });
        setError(err instanceof Error ? err.message : 'Failed to load market share data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedRange, selectedRegion]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `AED ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `AED ${(value / 1000).toFixed(0)}K`;
    }
    return `AED ${value}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color || entry.fill }}>
                {entry.name}: <span className="font-medium">{entry.value}%</span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const timeRanges = [
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: '1y', label: '1 Year' },
  ];

  const regions = [
    { key: 'all', label: 'All Regions' },
    { key: 'dubai', label: 'Dubai' },
    { key: 'abu-dhabi', label: 'Abu Dhabi' },
    { key: 'sharjah', label: 'Sharjah' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Market Share Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Platform market share and competitive landscape
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['pie', 'trend', 'projection'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {timeRanges.map((range) => (
              <option key={range.key} value={range.key}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <PieIcon className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-700">Your Share</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.currentShare}%</p>
          <p className={`text-xs font-medium ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.change >= 0 ? '+' : ''}{stats.changePercent}% vs {stats.previousShare}%
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            Your Revenue
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-green-600">+{stats.growthRate}% growth</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <Users className="h-4 w-4" />
            Your Customers
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(platformCustomers)}</p>
          <p className="text-xs text-gray-500">active users</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <Target className="h-4 w-4" />
            Total Market
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalMarket)}</p>
          <p className="text-xs text-gray-500">TAM</p>
        </div>
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : shareData.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-center">
          <Globe className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No market share data available</p>
          <p className="text-sm text-gray-500 mt-1">
            Market share metrics appear after the platform records completed bookings.
          </p>
        </div>
      ) : viewMode === 'pie' ? (
        <>
          {/* Market Share Pie Chart */}
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="h-80 lg:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="share"
                  >
                    {shareData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Share Details Table */}
            <div className="lg:w-1/2">
              <div className="space-y-3">
                {shareData.map((platform) => (
                  <div
                    key={platform.platform}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{platform.platform}</p>
                      <p className="text-sm text-gray-500">{formatNumber(platform.customers)} customers</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{platform.share}%</p>
                      <p className={`text-sm ${platform.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {platform.growth >= 0 ? '+' : ''}{platform.growth}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : viewMode === 'trend' ? (
        trendData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-sm text-gray-500">
            No trend data available for this period.
          </div>
        ) : (
        <>
          {/* Market Share Trend */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="yourPlatformGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  domain={[0, 50]}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="yourPlatform"
                  name="Your Platform"
                  stroke="#2563EB"
                  strokeWidth={3}
                  fill="url(#yourPlatformGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="competitor1"
                  name="Competitor A"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="competitor2"
                  name="Competitor B"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="competitor3"
                  name="Competitor C"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
        )
      ) : projectionData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-sm text-gray-500">
          Projection requires historical trend data.
        </div>
      ) : (
        <>
          {/* Market Share Projection */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  domain={[30, 50]}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pessimistic" name="Pessimistic" fill="#EF4444" fillOpacity={0.3} />
                <Bar dataKey="projected" name="Projected" fill="#2563EB" />
                <Bar dataKey="optimistic" name="Optimistic" fill="#10B981" fillOpacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">
            Projections based on current growth trajectory and market trends
          </p>
        </>
      )}

      {/* Competitive Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Market Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h5 className="font-medium text-green-900 mb-2">Market Leadership</h5>
            <p className="text-sm text-green-700">
              Your platform leads the market with {stats.currentShare}% share,
              a {stats.changePercent}% increase from {stats.previousShare}% last period.
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">Growth Trajectory</h5>
            <p className="text-sm text-blue-700">
              At current growth rate of {stats.growthRate}%, projected to reach
              {Math.round(stats.currentShare + stats.growthRate * 0.5)}% market share by year end.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MarketShare;
