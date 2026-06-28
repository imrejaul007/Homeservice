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
import { TrendingUp, TrendingDown, DollarSign, Loader, ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

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

const EMPTY_STATS: AOVStats = {
  currentAOV: 0,
  previousAOV: 0,
  change: 0,
  changePercent: 0,
  lifetimeAverage: 0,
  highestOrder: 0,
  lowestOrder: 0,
  targetAOV: 0,
};

export const AOVTrend: React.FC<AOVTrendProps> = ({ customerId, timeRange = '30d' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AOVData[]>([]);
  const [stats, setStats] = useState<AOVStats>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getCustomerAOVTrend(selectedRange, customerId);
        setData(apiData.timeSeries || []);
        setStats({
          currentAOV: apiData.currentAOV,
          previousAOV: apiData.previousAOV,
          change: apiData.change,
          changePercent: apiData.changePercent,
          lifetimeAverage: apiData.lifetimeAverage,
          highestOrder: apiData.highestOrder,
          lowestOrder: apiData.lowestOrder,
          targetAOV: apiData.targetAOV || apiData.lifetimeAverage * 1.15,
        });
      } catch (err) {
        setData([]);
        setStats(EMPTY_STATS);
        setError(err instanceof Error ? err.message : 'Failed to load AOV trend data');
      } finally {
        setLoading(false);
      }
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

  const progressToTarget = stats.targetAOV > 0
    ? Math.min((stats.currentAOV / stats.targetAOV) * 100, 100)
    : 0;

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

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
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No order value data for this period.
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
              You're {stats.targetAOV > 0 ? (stats.currentAOV / stats.targetAOV * 100).toFixed(0) : '0'}% of the way to your target AOV of{' '}
              {formatCurrency(stats.targetAOV)}.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AOVTrend;
