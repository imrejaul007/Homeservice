// Platform CAC - Customer Acquisition Cost - Admin Analytics Component
import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Target, DollarSign, Loader, Users, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface PlatformCACProps {
  timeRange?: '30d' | '90d' | '1y';
}

interface CACData {
  month: string;
  totalSpend: number;
  newCustomers: number;
  newProviders: number;
  customerCAC: number;
  providerCAC: number;
  blendedCAC: number;
}

interface CACStats {
  currentCustomerCAC: number;
  currentProviderCAC: number;
  currentBlendedCAC: number;
  cacTrend: number;
  totalSpend: number;
  totalCustomers: number;
  totalProviders: number;
  ltvToCacRatio: number;
  cacByChannel: Array<{
    channel: string;
    spend: number;
    acquisitions: number;
    cac: number;
  }>;
}

const MOCK_DATA: CACData[] = [
  { month: 'Jan', totalSpend: 15000, newCustomers: 245, newProviders: 32, customerCAC: 52.50, providerCAC: 312.50, blendedCAC: 58.20 },
  { month: 'Feb', totalSpend: 18500, newCustomers: 280, newProviders: 45, customerCAC: 56.80, providerCAC: 255.56, blendedCAC: 62.10 },
  { month: 'Mar', totalSpend: 22000, newCustomers: 320, newProviders: 52, customerCAC: 58.50, providerCAC: 298.08, blendedCAC: 65.80 },
  { month: 'Apr', totalSpend: 25000, newCustomers: 385, newProviders: 58, customerCAC: 55.80, providerCAC: 305.17, blendedCAC: 63.90 },
  { month: 'May', totalSpend: 28000, newCustomers: 420, newProviders: 65, customerCAC: 57.14, providerCAC: 292.31, blendedCAC: 65.40 },
  { month: 'Jun', totalSpend: 32000, newCustomers: 485, newProviders: 72, customerCAC: 56.80, providerCAC: 305.56, blendedCAC: 64.80 },
];

const MOCK_STATS: CACStats = {
  currentCustomerCAC: 56.80,
  currentProviderCAC: 305.56,
  currentBlendedCAC: 64.80,
  cacTrend: -8.5,
  totalSpend: 140500,
  totalCustomers: 2135,
  totalProviders: 324,
  ltvToCacRatio: 5.2,
  cacByChannel: [
    { channel: 'Google Ads', spend: 45000, acquisitions: 620, cac: 72.58 },
    { channel: 'Facebook Ads', spend: 32000, acquisitions: 485, cac: 65.98 },
    { channel: 'Referral Program', spend: 15000, acquisitions: 380, cac: 39.47 },
    { channel: 'Influencer', spend: 28000, acquisitions: 295, cac: 94.92 },
    { channel: 'SEO/Organic', spend: 12000, acquisitions: 355, cac: 33.80 },
    { channel: 'Other', spend: 8500, acquisitions: 120, cac: 70.83 },
  ],
};

const CHANNEL_COLORS = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

export const PlatformCAC: React.FC<PlatformCACProps> = ({
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CACData[]>(MOCK_DATA);
  const [stats, setStats] = useState<CACStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'trend' | 'channel'>('trend');

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
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const isImproving = stats.cacTrend < 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as CACData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{item.month}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Total Spend: <span className="font-medium">{formatCurrency(item.totalSpend)}</span>
            </p>
            <p className="text-green-600">
              New Customers: <span className="font-medium">{item.newCustomers}</span>
            </p>
            <p className="text-purple-600">
              New Providers: <span className="font-medium">{item.newProviders}</span>
            </p>
            <p className="text-orange-600">
              Customer CAC: <span className="font-medium">{formatCurrency(item.customerCAC)}</span>
            </p>
            <p className="text-pink-600">
              Provider CAC: <span className="font-medium">{formatCurrency(item.providerCAC)}</span>
            </p>
            <p className="text-gray-600">
              Blended CAC: <span className="font-medium">{formatCurrency(item.blendedCAC)}</span>
            </p>
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

  const sortedChannels = [...stats.cacByChannel].sort((a, b) => a.cac - b.cac);
  const bestChannel = sortedChannels[0];
  const worstChannel = sortedChannels[sortedChannels.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-600" />
            Customer Acquisition Cost
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Track and optimize acquisition spending efficiency
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('trend')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'trend'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Trend
            </button>
            <button
              onClick={() => setViewMode('channel')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'channel'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Channels
            </button>
          </div>

          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Customer CAC</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.currentCustomerCAC)}</p>
          <div className={`flex items-center gap-1 text-xs ${isImproving ? 'text-green-600' : 'text-red-600'}`}>
            {isImproving ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            <span>{Math.abs(stats.cacTrend)}%</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Provider CAC</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.currentProviderCAC)}</p>
          <p className="text-xs text-gray-500">Per provider</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Blended CAC</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.currentBlendedCAC)}</p>
          <p className="text-xs text-gray-500">All users</p>
        </div>

        <div className={`rounded-lg p-4 ${stats.ltvToCacRatio >= 3 ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <p className="text-sm text-gray-500 mb-1">LTV:CAC Ratio</p>
          <p className={`text-2xl font-bold ${stats.ltvToCacRatio >= 3 ? 'text-green-700' : 'text-yellow-700'}`}>
            {stats.ltvToCacRatio.toFixed(1)}x
          </p>
          <p className="text-xs text-gray-500">{stats.ltvToCacRatio >= 3 ? 'Healthy' : 'Needs improvement'}</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-orange-600 animate-spin" />
        </div>
      ) : viewMode === 'trend' ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cacGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => `AED ${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="blendedCAC"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#cacGradient)"
                name="Blended CAC"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedChannels} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `AED ${v}`} />
              <YAxis
                type="category"
                dataKey="channel"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                width={95}
              />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="cac" name="CAC" radius={[0, 4, 4, 0]}>
                {sortedChannels.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">CAC by Channel</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Channel</th>
                <th className="pb-3 font-medium text-right">Spend</th>
                <th className="pb-3 font-medium text-right">Acquisitions</th>
                <th className="pb-3 font-medium text-right">CAC</th>
                <th className="pb-3 font-medium text-right">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {sortedChannels.map((channel, index) => (
                <tr key={channel.channel} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length] }}
                      />
                      <span className="font-medium text-gray-900">{channel.channel}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-gray-900">{formatCurrency(channel.spend)}</td>
                  <td className="py-3 text-right text-gray-900">{channel.acquisitions}</td>
                  <td className="py-3 text-right font-medium text-orange-600">
                    {formatCurrency(channel.cac)}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        channel.cac < stats.currentBlendedCAC
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {channel.cac < stats.currentBlendedCAC ? 'Efficient' : 'Above Avg'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <p className="text-sm font-medium text-gray-900">Total Acquisition Spend</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalSpend)}</p>
            <p className="text-xs text-gray-500 mt-1">This period</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-900">Best Channel</p>
            </div>
            <p className="text-lg font-bold text-green-700">{bestChannel?.channel}</p>
            <p className="text-xs text-green-600 mt-1">CAC: {formatCurrency(bestChannel?.cac || 0)}</p>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-red-600" />
              <p className="text-sm font-medium text-red-900">Needs Optimization</p>
            </div>
            <p className="text-lg font-bold text-red-700">{worstChannel?.channel}</p>
            <p className="text-xs text-red-600 mt-1">CAC: {formatCurrency(worstChannel?.cac || 0)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
            <p className="text-gray-600">
              <strong>SEO/Organic</strong> has the lowest CAC at {formatCurrency(33.80)}.
              Consider investing more in content marketing.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
            <p className="text-gray-600">
              <strong>Referral Program</strong> shows strong efficiency.
              Consider expanding the referral incentive structure.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
            <p className="text-gray-600">
              Your LTV:CAC ratio of {stats.ltvToCacRatio}x is {stats.ltvToCacRatio >= 3 ? 'healthy' : 'below the recommended 3:1'}.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PlatformCAC;
