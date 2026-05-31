// Marketplace Velocity - Admin Analytics Component
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
import { Activity, TrendingUp, Loader, DollarSign, ShoppingCart, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketplaceVelocityProps {
  timeRange?: '24h' | '7d' | '30d' | '90d';
}

interface VelocityData {
  timestamp: string;
  bookings: number;
  revenue: number;
  newUsers: number;
  transactions: number;
}

interface VelocityStats {
  currentTPS: number;
  peakTPS: number;
  avgResponseTime: number;
  totalBookings: number;
  totalRevenue: number;
  totalUsers: number;
  activeProviders: number;
  growth: number;
}

const MOCK_DATA: VelocityData[] = [
  { timestamp: '00:00', bookings: 12, revenue: 2400, newUsers: 5, transactions: 15 },
  { timestamp: '04:00', bookings: 5, revenue: 850, newUsers: 2, transactions: 7 },
  { timestamp: '08:00', bookings: 45, revenue: 9200, newUsers: 18, transactions: 52 },
  { timestamp: '12:00', bookings: 78, revenue: 15600, newUsers: 32, transactions: 95 },
  { timestamp: '16:00', bookings: 95, revenue: 19200, newUsers: 45, transactions: 120 },
  { timestamp: '20:00', bookings: 62, revenue: 12400, newUsers: 28, transactions: 78 },
];

const MOCK_STATS: VelocityStats = {
  currentTPS: 125,
  peakTPS: 245,
  avgResponseTime: 45,
  totalBookings: 1847,
  totalRevenue: 369400,
  totalUsers: 28450,
  activeProviders: 892,
  growth: 15.3,
};

export const MarketplaceVelocity: React.FC<MarketplaceVelocityProps> = ({
  timeRange = '24h',
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VelocityData[]>(MOCK_DATA);
  const [stats, setStats] = useState<VelocityStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'bookings' | 'revenue' | 'users'>('bookings');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setData(MOCK_DATA);
      setLoading(false);
    };
    fetchData();
  }, [selectedRange]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return `AED ${value}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as VelocityData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Bookings: <span className="font-medium">{item.bookings}</span>
            </p>
            <p className="text-green-600">
              Revenue: <span className="font-medium">AED {formatCurrency(item.revenue)}</span>
            </p>
            <p className="text-purple-600">
              New Users: <span className="font-medium">{item.newUsers}</span>
            </p>
            <p className="text-orange-600">
              Transactions: <span className="font-medium">{item.transactions}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const timeRanges = [
    { key: '24h', label: '24 Hours' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  const avgBookings = data.reduce((sum, d) => sum + d.bookings, 0) / data.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Marketplace Velocity
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Real-time transaction velocity and platform health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['bookings', 'revenue', 'users'] as const).map((mode) => (
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-700">Current TPS</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.currentTPS}</p>
          <p className="text-xs text-gray-500">Peak: {stats.peakTPS}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Avg Response
          </p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgResponseTime}ms</p>
          <p className="text-xs text-green-600">Healthy</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Total Bookings
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalBookings)}</p>
          <p className="text-xs text-green-600">+{stats.growth}%</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-green-600">AED {formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-500">This period</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={avgBookings}
                stroke="#6B7280"
                strokeDasharray="5 5"
                label={{ value: `Avg: ${Math.round(avgBookings)}`, fill: '#6B7280', fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey={viewMode === 'bookings' ? 'bookings' : viewMode === 'revenue' ? 'revenue' : 'newUsers'}
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#velocityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalUsers)}</p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.activeProviders)}</p>
              <p className="text-sm text-gray-500">Active Providers</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.growth}%</p>
              <p className="text-sm text-gray-500">Growth Rate</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MarketplaceVelocity;
