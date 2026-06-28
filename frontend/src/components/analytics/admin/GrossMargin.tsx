// Gross Margin - Admin Analytics Component
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
  ReferenceLine,
  ComposedChart,
  Line,
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Loader, Percent, Target, Calculator, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface GrossMarginProps {
  timeRange?: '30d' | '90d' | '1y';
}

interface MarginData {
  date: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
}

interface CategoryMarginData {
  category: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
  volume: number;
}

interface TrendData {
  month: string;
  margin: number;
  benchmark: number;
  revenue: number;
}

interface MarginStats {
  currentMargin: number;
  previousMargin: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  totalRevenue: number;
  totalGrossProfit: number;
  industryBenchmark: number;
  targetMargin: number;
}

const EMPTY_STATS: MarginStats = {
  currentMargin: 0,
  previousMargin: 0,
  change: 0,
  changePercent: 0,
  trend: 'stable',
  totalRevenue: 0,
  totalGrossProfit: 0,
  industryBenchmark: 38,
  targetMargin: 45,
};

export const GrossMargin: React.FC<GrossMarginProps> = ({
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marginData, setMarginData] = useState<MarginData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryMarginData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [stats, setStats] = useState<MarginStats>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'trend' | 'breakdown'>('trend');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getAdminGrossMargin(selectedRange);
        const breakdown = apiData.breakdown || [];
        const trend = apiData.trend || [];
        const summary = apiData.summary;

        setCategoryData(
          breakdown.map((entry) => ({
            category: entry.category,
            revenue: entry.revenue,
            cost: entry.cost,
            grossProfit: entry.grossProfit,
            margin: entry.margin,
            volume: 0,
          })),
        );
        setTrendData(
          trend.map((entry, index) => ({
            month: entry.month,
            margin: entry.margin,
            benchmark: entry.benchmark,
            revenue: breakdown[index]?.revenue || summary?.totalRevenue || 0,
          })),
        );
        setMarginData(
          trend.map((entry) => ({
            date: entry.month,
            revenue: summary?.totalRevenue || 0,
            cost: summary?.totalCost || 0,
            grossProfit: summary?.totalProfit || 0,
            margin: entry.margin,
          })),
        );

        const currentMargin = summary?.overallMargin || 0;
        const previousMargin = trend.length > 1 ? trend[trend.length - 2].margin : currentMargin;
        const change = currentMargin - previousMargin;

        setStats({
          currentMargin,
          previousMargin,
          change,
          changePercent: previousMargin > 0 ? (change / previousMargin) * 100 : 0,
          trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
          totalRevenue: summary?.totalRevenue || 0,
          totalGrossProfit: summary?.totalProfit || 0,
          industryBenchmark: 38,
          targetMargin: 45,
        });
      } catch (err) {
        setMarginData([]);
        setCategoryData([]);
        setTrendData([]);
        setStats(EMPTY_STATS);
        setError(err instanceof Error ? err.message : 'Failed to load gross margin data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedRange]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `AED ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `AED ${(value / 1000).toFixed(0)}K`;
    }
    return `AED ${value}`;
  };

  const progressToTarget = Math.min((stats.currentMargin / stats.targetMargin) * 100, 100);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color }}>
                {entry.name}: <span className="font-medium">
                  {entry.name.includes('%') ? `${entry.value}%` : formatCurrency(entry.value)}
                </span>
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

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-green-600';
    if (margin >= 35) return 'text-yellow-600';
    return 'text-red-600';
  };

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
            <Calculator className="h-5 w-5 text-green-600" />
            Gross Margin Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Platform margin calculation and category breakdown
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
              onClick={() => setViewMode('breakdown')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'breakdown'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Category
            </button>
          </div>

          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            {timeRanges.map((range) => (
              <option key={range.key} value={range.key}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700">Gross Margin</p>
          </div>
          <p className={`text-3xl font-bold ${getMarginColor(stats.currentMargin)}`}>
            {stats.currentMargin}%
          </p>
          <p className={`text-xs font-medium ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.change >= 0 ? '+' : ''}{stats.changePercent}% vs last period
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-500">this period</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Gross Profit
          </p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalGrossProfit)}</p>
          <p className="text-xs text-gray-500">after costs</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <Target className="h-4 w-4" />
            Target
          </p>
          <p className="text-2xl font-bold text-gray-900">{stats.targetMargin}%</p>
          <p className="text-xs text-gray-500">goal</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Benchmark</p>
          <p className="text-2xl font-bold text-blue-600">{stats.industryBenchmark}%</p>
          <p className="text-xs text-gray-500">industry avg</p>
        </div>
      </div>

      {/* Progress to Target */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500 flex items-center gap-1">
            <Target className="h-4 w-4" />
            Target: {stats.targetMargin}%
          </span>
          <span className="font-medium text-gray-900">
            {progressToTarget.toFixed(0)}% achieved ({stats.currentMargin}% / {stats.targetMargin}%)
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressToTarget}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <Loader className="h-8 w-8 text-green-600 animate-spin" />
        </div>
      ) : viewMode === 'trend' ? (
        <>
          {/* Margin Trend Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  yAxisId="left"
                  domain={[30, 50]}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={stats.industryBenchmark}
                  yAxisId="left"
                  stroke="#6B7280"
                  strokeDasharray="5 5"
                  label={{ value: `Benchmark: ${stats.industryBenchmark}%`, fill: '#6B7280', fontSize: 10 }}
                />
                <ReferenceLine
                  y={stats.targetMargin}
                  yAxisId="left"
                  stroke="#10B981"
                  strokeDasharray="5 5"
                  label={{ value: `Target: ${stats.targetMargin}%`, fill: '#10B981', fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  yAxisId="left"
                  dataKey="margin"
                  name="Margin %"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#marginGradient)"
                />
                <Line
                  type="monotone"
                  yAxisId="right"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={{ fill: '#2563EB', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span className="text-sm text-gray-600">Gross Margin %</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <span className="text-sm text-gray-600">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-400" style={{ opacity: 0.5 }} />
              <span className="text-sm text-gray-600">Benchmark</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Category Breakdown Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  domain={[0, 50]}
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  x={stats.industryBenchmark}
                  stroke="#6B7280"
                  strokeDasharray="5 5"
                  label={{ value: `Benchmark: ${stats.industryBenchmark}%`, fill: '#6B7280', fontSize: 10, position: 'top' }}
                />
                <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, index) => (
                    <rect
                      key={`cell-${index}`}
                      fill={entry.margin >= 40 ? '#10B981' : entry.margin >= 35 ? '#F59E0B' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Cost</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Profit</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Margin</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((cat) => (
                  <tr key={cat.category} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-900">{cat.category}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(cat.revenue)}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(cat.cost)}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(cat.grossProfit)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${getMarginColor(cat.margin)}`}>
                        {cat.margin}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-medium">
                  <td className="py-3 px-4 text-gray-900">Total</td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatCurrency(categoryData.reduce((sum, c) => sum + c.revenue, 0))}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">
                    {formatCurrency(categoryData.reduce((sum, c) => sum + c.cost, 0))}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600">
                    {formatCurrency(categoryData.reduce((sum, c) => sum + c.grossProfit, 0))}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600">
                    {(categoryData.reduce((sum, c) => sum + c.grossProfit, 0) / categoryData.reduce((sum, c) => sum + c.revenue, 0) * 100).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Margin Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h5 className="font-medium text-green-900 mb-2">Above Benchmark</h5>
            <p className="text-sm text-green-700">
              Your margin of {stats.currentMargin}% is {stats.currentMargin - stats.industryBenchmark}% above the industry benchmark of {stats.industryBenchmark}%.
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">Top Performing Category</h5>
            <p className="text-sm text-blue-700">
              <span className="font-medium">Cleaning</span> leads with {Math.max(...categoryData.map(c => c.margin))}% margin.
              Consider expanding this service line.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GrossMargin;
