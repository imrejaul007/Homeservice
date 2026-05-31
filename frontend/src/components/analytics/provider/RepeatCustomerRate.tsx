// Repeat Customer Rate - Provider Analytics Component
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
  Cell,
} from 'recharts';
import { Users, Repeat, Loader, TrendingUp, Clock, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface RepeatCustomerRateProps {
  providerId?: string;
  timeRange?: '30d' | '90d' | '1y';
}

interface TrendData {
  month: string;
  newCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}

interface CohortData {
  cohort: string;
  month1: number;
  month2: number;
  month3: number;
  month6: number;
  retention: number;
}

interface FactorData {
  factor: string;
  impact: number;
  description: string;
}

interface RepeatStats {
  repeatRate: number;
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  avgTimeToRepeat: number;
  targetRate: number;
  trend: number;
  topRetentionCategory: string;
}

const MOCK_TREND_DATA: TrendData[] = [
  { month: 'Jan', newCustomers: 45, repeatCustomers: 12, repeatRate: 21 },
  { month: 'Feb', newCustomers: 52, repeatCustomers: 15, repeatRate: 22 },
  { month: 'Mar', newCustomers: 48, repeatCustomers: 18, repeatRate: 27 },
  { month: 'Apr', newCustomers: 61, repeatCustomers: 22, repeatRate: 27 },
  { month: 'May', newCustomers: 58, repeatCustomers: 25, repeatRate: 30 },
  { month: 'Jun', newCustomers: 72, repeatCustomers: 32, repeatRate: 31 },
];

const MOCK_COHORT_DATA: CohortData[] = [
  { cohort: 'Jan 2024', month1: 100, month2: 68, month3: 52, month6: 38, retention: 38 },
  { cohort: 'Feb 2024', month1: 100, month2: 72, month3: 58, month6: 42, retention: 42 },
  { cohort: 'Mar 2024', month1: 100, month2: 75, month3: 62, month6: 48, retention: 48 },
  { cohort: 'Apr 2024', month1: 100, month2: 78, month3: 65, month6: 0, retention: 65 },
  { cohort: 'May 2024', month1: 100, month2: 82, month3: 0, month6: 0, retention: 82 },
  { cohort: 'Jun 2024', month1: 100, month2: 0, month3: 0, month6: 0, retention: 100 },
];

const MOCK_FACTOR_DATA: FactorData[] = [
  { factor: 'Service Quality', impact: 85, description: 'High impact on retention' },
  { factor: 'Response Time', impact: 72, description: 'Fast responses win loyalty' },
  { factor: 'Pricing', impact: 58, description: 'Competitive pricing matters' },
  { factor: 'Communication', impact: 65, description: 'Clear communication builds trust' },
  { factor: 'Availability', impact: 45, description: 'Flexible scheduling helps' },
];

const MOCK_STATS: RepeatStats = {
  repeatRate: 31,
  totalCustomers: 336,
  repeatCustomers: 104,
  newCustomers: 232,
  avgTimeToRepeat: 18,
  targetRate: 35,
  trend: 8.5,
  topRetentionCategory: 'Deep Cleaning',
};

const RETENTION_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

export const RepeatCustomerRate: React.FC<RepeatCustomerRateProps> = ({
  providerId,
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<TrendData[]>(MOCK_TREND_DATA);
  const [cohortData, setCohortData] = useState<CohortData[]>(MOCK_COHORT_DATA);
  const [factorData] = useState<FactorData[]>(MOCK_FACTOR_DATA);
  const [stats, setStats] = useState<RepeatStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'trend' | 'cohort'>('trend');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTrendData(MOCK_TREND_DATA);
      setCohortData(MOCK_COHORT_DATA);
      setLoading(false);
    };
    fetchData();
  }, [providerId, selectedRange]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-AE').format(value);
  };

  const progressToTarget = Math.min((stats.repeatRate / stats.targetRate) * 100, 100);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              New Customers: <span className="font-medium">{payload[0]?.value || 0}</span>
            </p>
            <p className="text-green-600">
              Repeat Customers: <span className="font-medium">{payload[1]?.value || 0}</span>
            </p>
            <p className="text-purple-600">
              Repeat Rate: <span className="font-medium">{payload[2]?.value || 0}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CohortTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as CohortData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">Cohort: {item.cohort}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">Month 1: <span className="font-medium">{item.month1}%</span></p>
            <p className="text-gray-600">Month 2: <span className="font-medium">{item.month2}%</span></p>
            <p className="text-gray-600">Month 3: <span className="font-medium">{item.month3}%</span></p>
            <p className="text-gray-600">Month 6: <span className="font-medium">{item.month6}%</span></p>
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
            <Repeat className="h-5 w-5 text-blue-600" />
            Repeat Customer Rate
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Track customer loyalty and retention
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
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
              onClick={() => setViewMode('cohort')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'cohort'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cohort
            </button>
          </div>

          {/* Time Range Selector */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-100">
          <p className="text-sm text-blue-700 mb-1">Repeat Rate</p>
          <p className="text-2xl font-bold text-gray-900">{stats.repeatRate}%</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalCustomers)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Repeat Customers</p>
          <p className="text-2xl font-bold text-green-600">{formatNumber(stats.repeatCustomers)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Avg Time to Repeat</p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgTimeToRepeat} days</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Trend</p>
          <p className="text-2xl font-bold text-green-600">+{stats.trend}%</p>
        </div>
      </div>

      {/* Progress to Target */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500 flex items-center gap-1">
            <Target className="h-4 w-4" />
            Target: {stats.targetRate}%
          </span>
          <span className="font-medium text-gray-900">{progressToTarget.toFixed(0)}% achieved</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressToTarget}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : viewMode === 'trend' ? (
        <>
          {/* Trend Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="newCustomerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="repeatCustomerGradient" x1="0" y1="0" x2="0" y2="1">
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
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  yAxisId="left"
                />
                <YAxis
                  orientation="right"
                  domain={[0, 50]}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  yAxisId="right"
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="newCustomers"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#newCustomerGradient)"
                  name="New"
                />
                <Area
                  type="monotone"
                  dataKey="repeatCustomers"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#repeatCustomerGradient)"
                  name="Repeat"
                />
                <ReferenceLine
                  y={stats.targetRate}
                  stroke="#6B7280"
                  strokeDasharray="5 5"
                  yAxisId="right"
                  label={{ value: `Target: ${stats.targetRate}%`, fill: '#6B7280', fontSize: 10 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <span className="text-sm text-gray-600">New Customers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span className="text-sm text-gray-600">Repeat Customers</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Cohort Analysis */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Cohort</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Month 1</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Month 2</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Month 3</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Month 6</th>
                </tr>
              </thead>
              <tbody>
                {cohortData.map((cohort, index) => (
                  <tr key={cohort.cohort} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-900">{cohort.cohort}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className="inline-block px-2 py-1 rounded"
                        style={{ backgroundColor: `${RETENTION_COLORS[0]}33`, color: RETENTION_COLORS[0] }}
                      >
                        {cohort.month1}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className="inline-block px-2 py-1 rounded"
                        style={{ backgroundColor: cohort.month2 ? `${RETENTION_COLORS[1]}33` : '#f3f4f6', color: cohort.month2 ? RETENTION_COLORS[1] : '#9CA3AF' }}
                      >
                        {cohort.month2 || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className="inline-block px-2 py-1 rounded"
                        style={{ backgroundColor: cohort.month3 ? `${RETENTION_COLORS[2]}33` : '#f3f4f6', color: cohort.month3 ? RETENTION_COLORS[2] : '#9CA3AF' }}
                      >
                        {cohort.month3 || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className="inline-block px-2 py-1 rounded"
                        style={{ backgroundColor: cohort.month6 ? `${RETENTION_COLORS[3]}33` : '#f3f4f6', color: cohort.month6 ? RETENTION_COLORS[3] : '#9CA3AF' }}
                      >
                        {cohort.month6 || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Retention Factors */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          Key Retention Factors
        </h4>
        <div className="space-y-3">
          {factorData.map((factor) => (
            <div key={factor.factor} className="flex items-center gap-4">
              <span className="text-sm text-gray-700 w-32">{factor.factor}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${factor.impact}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900 w-12 text-right">{factor.impact}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Insights</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
            <p className="text-gray-600">
              Your repeat rate has increased by{' '}
              <span className="font-medium text-gray-900">+{stats.trend}%</span> over the period.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">{stats.topRetentionCategory}</span> has the highest retention rate.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5" />
            <p className="text-gray-600">
              Average time to repeat purchase:{' '}
              <span className="font-medium text-gray-900">{stats.avgTimeToRepeat} days</span>.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RepeatCustomerRate;
