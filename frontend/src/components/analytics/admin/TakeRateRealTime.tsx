// Take Rate Real-Time - Admin Analytics Component
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
import { Percent, TrendingUp, Loader, DollarSign, PieChart as PieIcon, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface TakeRateRealTimeProps {
  timeRange?: '7d' | '30d' | '90d' | '1y';
}

interface TakeRateData {
  date: string;
  grossRevenue: number;
  netRevenue: number;
  platformRevenue: number;
  takeRate: number;
  transactionCount: number;
}

interface TakeRateStats {
  currentTakeRate: number;
  targetTakeRate: number;
  grossRevenue: number;
  platformRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
  takeRateTrend: number;
  byCategory: Array<{
    category: string;
    grossRevenue: number;
    takeRate: number;
  }>;
}

const CATEGORY_COLORS = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];

export const TakeRateRealTime: React.FC<TakeRateRealTimeProps> = ({
  timeRange = '30d',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TakeRateData[]>([]);
  const [stats, setStats] = useState<TakeRateStats>({
    currentTakeRate: 0,
    targetTakeRate: 25,
    grossRevenue: 0,
    platformRevenue: 0,
    totalTransactions: 0,
    avgTransactionValue: 0,
    takeRateTrend: 0,
    byCategory: [],
  });
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'rate' | 'revenue'>('revenue');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getAdminTakeRate(selectedRange);
        setData(apiData.timeSeries || []);
        setStats(apiData.stats);
      } catch (err) {
        setData([]);
        setError(err instanceof Error ? err.message : 'Failed to load take rate data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedRange]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `AED ${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `AED ${(value / 1000).toFixed(1)}K`;
    }
    return `AED ${value.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as TakeRateData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Gross Revenue: <span className="font-medium">{formatCurrency(item.grossRevenue)}</span>
            </p>
            <p className="text-green-600">
              Net Revenue: <span className="font-medium">{formatCurrency(item.netRevenue)}</span>
            </p>
            <p className="text-purple-600">
              Platform Revenue: <span className="font-medium">{formatCurrency(item.platformRevenue)}</span>
            </p>
            <p className="text-orange-600">
              Take Rate: <span className="font-medium">{item.takeRate.toFixed(1)}%</span>
            </p>
            <p className="text-gray-600">
              Transactions: <span className="font-medium">{item.transactionCount}</span>
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
    { key: '1y', label: '1 Year' },
  ];

  const totalGross = stats.byCategory.reduce((sum, c) => sum + c.grossRevenue, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Percent className="h-5 w-5 text-purple-600" />
            Take Rate Real-Time
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Platform commission and revenue metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['rate', 'revenue'] as const).map((mode) => (
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
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-4 w-4 text-purple-600" />
            <p className="text-sm text-purple-700">Take Rate</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.currentTakeRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Target: {stats.targetTakeRate}%</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Gross Revenue
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.grossRevenue)}</p>
          <p className="text-xs text-gray-500">{stats.totalTransactions} transactions</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Platform Revenue
          </p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.platformRevenue)}</p>
          <p className="text-xs text-gray-500">Take rate earnings</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <PieIcon className="h-4 w-4" />
            Avg Transaction
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.avgTransactionValue)}</p>
          <p className="text-xs text-gray-500">Per transaction</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="platformGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={stats.currentTakeRate}
                stroke="#F59E0B"
                strokeDasharray="5 5"
                label={{ value: `Target: ${stats.targetTakeRate}%`, fill: '#F59E0B', fontSize: 10 }}
              />
              {viewMode === 'revenue' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="grossRevenue"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#grossGradient)"
                    name="Gross Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="platformRevenue"
                    stroke="#7C3AED"
                    strokeWidth={2}
                    fill="url(#platformGradient)"
                    name="Platform Revenue"
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="takeRate"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill="url(#platformGradient)"
                  name="Take Rate"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Revenue by Category</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {stats.byCategory.map((cat, index) => (
              <div key={cat.category} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[index] }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{cat.category}</span>
                    <span className="text-sm text-gray-500">{formatCurrency(cat.grossRevenue)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(cat.grossRevenue / totalGross) * 100}%`,
                        backgroundColor: CATEGORY_COLORS[index],
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-500 w-12 text-right">
                  {((cat.grossRevenue / totalGross) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3">Take Rate Summary</h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Gross Revenue</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(stats.grossRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Platform Commission</span>
                <span className="text-sm font-medium text-purple-600">-{formatCurrency(stats.platformRevenue)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Net to Providers</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(stats.grossRevenue - stats.platformRevenue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TakeRateRealTime;
