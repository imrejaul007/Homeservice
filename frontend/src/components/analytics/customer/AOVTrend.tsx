// Average Order Value Trend - Customer Analytics Component
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
import { TrendingUp, TrendingDown, DollarSign, Loader, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface AOVTrendProps {
  customerId?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y';
}

interface AOVData {
  date: string;
  aov: number;
  orderCount: number;
  totalSpent: number;
}

interface AOVStats {
  currentAOV: number;
  previousAOV: number;
  change: number;
  changePercent: number;
  lifetimeAverage: number;
  highestOrder: number;
  lowestOrder: number;
  targetAOV: number;
}

const MOCK_DATA: Record<string, AOVData[]> = {
  '7d': [
    { date: 'Mon', aov: 210, orderCount: 2, totalSpent: 420 },
    { date: 'Tue', aov: 185, orderCount: 1, totalSpent: 185 },
    { date: 'Wed', aov: 230, orderCount: 3, totalSpent: 690 },
    { date: 'Thu', aov: 195, orderCount: 1, totalSpent: 195 },
    { date: 'Fri', aov: 220, orderCount: 2, totalSpent: 440 },
    { date: 'Sat', aov: 245, orderCount: 4, totalSpent: 980 },
    { date: 'Sun', aov: 180, orderCount: 1, totalSpent: 180 },
  ],
  '30d': [
    { date: 'Week 1', aov: 205, orderCount: 8, totalSpent: 1640 },
    { date: 'Week 2', aov: 220, orderCount: 12, totalSpent: 2640 },
    { date: 'Week 3', aov: 195, orderCount: 7, totalSpent: 1365 },
    { date: 'Week 4', aov: 235, orderCount: 15, totalSpent: 3525 },
  ],
  '90d': [
    { date: 'Jan', aov: 198, orderCount: 28, totalSpent: 5544 },
    { date: 'Feb', aov: 212, orderCount: 35, totalSpent: 7420 },
    { date: 'Mar', aov: 228, orderCount: 42, totalSpent: 9576 },
  ],
  '1y': [
    { date: 'Q1', aov: 195, orderCount: 85, totalSpent: 16575 },
    { date: 'Q2', aov: 210, orderCount: 112, totalSpent: 23520 },
    { date: 'Q3', aov: 225, orderCount: 98, totalSpent: 22050 },
    { date: 'Q4', aov: 240, orderCount: 145, totalSpent: 34800 },
  ],
};

const MOCK_STATS: AOVStats = {
  currentAOV: 235,
  previousAOV: 210,
  change: 25,
  changePercent: 11.9,
  lifetimeAverage: 218,
  highestOrder: 450,
  lowestOrder: 85,
  targetAOV: 250,
};

export const AOVTrend: React.FC<AOVTrendProps> = ({ customerId, timeRange = '30d' }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AOVData[]>([]);
  const [stats, setStats] = useState<AOVStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setData(MOCK_DATA[selectedRange] || []);
      setLoading(false);
    };
    fetchData();
  }, [customerId, selectedRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-blue-600 text-sm">
              AOV: <span className="font-medium">{formatCurrency(payload[0]?.value || 0)}</span>
            </p>
            <p className="text-green-600 text-sm">
              Orders: <span className="font-medium">{payload[1]?.value || 0}</span>
            </p>
            <p className="text-gray-600 text-sm">
              Total: <span className="font-medium">{formatCurrency(payload[2]?.value || 0)}</span>
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

  const progressToTarget = Math.min((stats.currentAOV / stats.targetAOV) * 100, 100);

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
            <DollarSign className="h-5 w-5 text-green-600" />
            Average Order Value
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Track your spending patterns over time
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => setSelectedRange(range.key as typeof selectedRange)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedRange === range.key
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main AOV Display */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900">
              {formatCurrency(stats.currentAOV)}
            </span>
            <span className="text-gray-500">per order</span>
          </div>

          {/* Change Indicator */}
          <div className={`flex items-center gap-1 mt-2 ${
            stats.change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {stats.change >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            <span className="font-medium">
              {stats.change >= 0 ? '+' : ''}{formatCurrency(stats.change)}
            </span>
            <span className="text-sm">
              ({stats.change >= 0 ? '+' : ''}{stats.changePercent.toFixed(1)}%)
            </span>
            <span className="text-sm text-gray-500 ml-1">vs previous period</span>
          </div>
        </div>

        {/* Progress to Target */}
        <div className="w-48">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Target AOV</span>
            <span className="font-medium text-gray-900">{formatCurrency(stats.targetAOV)}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToTarget}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {progressToTarget.toFixed(0)}% of target
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Lifetime Average</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.lifetimeAverage)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Highest Order</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(stats.highestOrder)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Lowest Order</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.lowestOrder)}</p>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-green-600 animate-spin" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="aovGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={stats.lifetimeAverage}
                stroke="#6B7280"
                strokeDasharray="5 5"
                label={{ value: 'Avg', fill: '#6B7280', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="aov"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#aovGradient)"
                name="AOV"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Spending Insights</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            {stats.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 mt-0.5" />
            )}
            <p className="text-gray-600">
              Your average order value has{' '}
              <span className={`font-medium ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.change >= 0 ? 'increased' : 'decreased'}
              </span>{' '}
              by {Math.abs(stats.changePercent).toFixed(1)}% compared to last period.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-gray-600">
              You're {(stats.currentAOV / stats.targetAOV * 100).toFixed(0)}% of the way to your target AOV of{' '}
              {formatCurrency(stats.targetAOV)}.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AOVTrend;
