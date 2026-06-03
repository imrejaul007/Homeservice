// ROAS Dashboard - Return on Ad Spend - Provider Analytics Component
import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Target, TrendingUp, Loader, DollarSign, MousePointer, Users, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi, ROASData, ROASStats, CampaignData } from '../../../services/analyticsApi';

interface ROASDashboardProps {
  providerId?: string;
  timeRange?: '7d' | '30d' | '90d';
}

// Default mock data for fallback when API is unavailable
const DEFAULT_ROAS_DATA: ROASData[] = [
  { date: 'Mon', adSpend: 50, revenue: 320, bookings: 4, roas: 6.4, cpc: 12.50, impressions: 1200, clicks: 24 },
  { date: 'Tue', adSpend: 75, revenue: 480, bookings: 6, roas: 6.4, cpc: 12.50, impressions: 1800, clicks: 36 },
  { date: 'Wed', adSpend: 60, revenue: 420, bookings: 5, roas: 7.0, cpc: 12.00, impressions: 1500, clicks: 30 },
  { date: 'Thu', adSpend: 80, revenue: 560, bookings: 7, roas: 7.0, cpc: 11.43, impressions: 2000, clicks: 42 },
  { date: 'Fri', adSpend: 100, revenue: 780, bookings: 9, roas: 7.8, cpc: 11.11, impressions: 2500, clicks: 54 },
  { date: 'Sat', adSpend: 120, revenue: 960, bookings: 12, roas: 8.0, cpc: 10.00, impressions: 3000, clicks: 72 },
  { date: 'Sun', adSpend: 90, revenue: 720, bookings: 8, roas: 8.0, cpc: 11.25, impressions: 2200, clicks: 48 },
];

const DEFAULT_ROAS_STATS: ROASStats = {
  totalAdSpend: 575,
  totalRevenue: 4240,
  overallROAS: 7.37,
  averageROAS: 7.24,
  totalBookings: 51,
  costPerBooking: 11.27,
  bestCampaign: 'Weekend Special',
  worstCampaign: 'Generic Search',
  targetROAS: 5.0,
};

const DEFAULT_CAMPAIGNS: CampaignData[] = [
  { name: 'Weekend Special', spend: 200, revenue: 1680, roas: 8.4, status: 'active' },
  { name: 'Category Boost', spend: 150, revenue: 1050, roas: 7.0, status: 'active' },
  { name: 'New Customer', spend: 125, revenue: 875, roas: 7.0, status: 'active' },
  { name: 'Generic Search', spend: 100, revenue: 635, roas: 6.35, status: 'paused' },
];

export const ROASDashboard: React.FC<ROASDashboardProps> = ({
  providerId,
  timeRange = '30d',
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'roas' | 'spend' | 'combined'>('combined');

  // Use API if providerId is available, otherwise show fallback data
  const shouldFetch = Boolean(providerId);

  const [apiData, setApiData] = useState<ROASMetricsData | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldFetch) return;

    let cancelled = false;
    setLoading(true);

    analyticsApi.getROASMetrics(providerId!).then(
      (data) => {
        if (!cancelled) {
          setApiData(data);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, providerId]);

  // Use API data if available, otherwise use defaults
  const roasData = apiData?.roasData ?? DEFAULT_ROAS_DATA;
  const stats = apiData?.stats ?? DEFAULT_ROAS_STATS;
  const campaigns = apiData?.campaigns ?? DEFAULT_CAMPAIGNS;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as ROASData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Ad Spend: <span className="font-medium">{formatCurrency(item.adSpend)}</span>
            </p>
            <p className="text-green-600">
              Revenue: <span className="font-medium">{formatCurrency(item.revenue)}</span>
            </p>
            <p className="text-purple-600">
              ROAS: <span className="font-medium">{item.roas.toFixed(2)}x</span>
            </p>
            <p className="text-gray-600">
              Bookings: <span className="font-medium">{item.bookings}</span>
            </p>
            <p className="text-gray-600">
              CPC: <span className="font-medium">{formatCurrency(item.cpc)}</span>
            </p>
            <p className="text-gray-600">
              CTR: <span className="font-medium">{((item.clicks / item.impressions) * 100).toFixed(1)}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const timeRanges = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  const isAboveTarget = stats.overallROAS >= stats.targetROAS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            ROAS Dashboard
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Return on Advertising Spend
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['roas', 'spend', 'combined'] as const).map((mode) => (
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
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            {timeRanges.map((range) => (
              <option key={range.key} value={range.key}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-lg p-4 ${isAboveTarget ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={`h-4 w-4 ${isAboveTarget ? 'text-green-600' : 'text-red-600'}`} />
            <p className={`text-sm ${isAboveTarget ? 'text-green-700' : 'text-red-700'}`}>Overall ROAS</p>
          </div>
          <p className={`text-2xl font-bold ${isAboveTarget ? 'text-green-700' : 'text-red-700'}`}>
            {stats.overallROAS.toFixed(2)}x
          </p>
          <p className="text-xs text-gray-500">Target: {stats.targetROAS}x</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total Spend
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAdSpend)}</p>
          <p className="text-xs text-gray-500">{stats.totalBookings} bookings</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-500">From ads</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Cost per Booking
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.costPerBooking)}</p>
          <p className="text-xs text-gray-500">Target: 15.00</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={roasData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="roasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickFormatter={(v) => `AED ${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                yAxisId="left"
                y={stats.targetROAS}
                stroke="#EF4444"
                strokeDasharray="5 5"
                label={{ value: `Target ${stats.targetROAS}x`, fill: '#EF4444', fontSize: 10 }}
              />
              {(viewMode === 'roas' || viewMode === 'combined') && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="roas"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill="url(#roasGradient)"
                  name="ROAS"
                />
              )}
              {(viewMode === 'spend' || viewMode === 'combined') && (
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#spendGradient)"
                  name="Revenue"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-600" />
          <span className="text-xs text-gray-600">ROAS (x)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-gray-600">Revenue (AED)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-gray-600">Target ROAS</span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Campaign Performance</h4>
        <div className="space-y-3">
          {campaigns.map((campaign, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${campaign.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="font-medium text-gray-900">{campaign.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(campaign.spend)} spend
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(campaign.revenue)}</p>
                  <p className="text-xs text-gray-500">Revenue</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${campaign.roas >= stats.targetROAS ? 'text-green-600' : 'text-red-600'}`}>
                    {campaign.roas.toFixed(2)}x
                  </p>
                  <p className="text-xs text-gray-500">ROAS</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  campaign.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {campaign.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ROASDashboard;
