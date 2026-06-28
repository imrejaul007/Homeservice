// LTV By Segment - Admin Analytics Component
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Users, TrendingUp, Loader, DollarSign, PieChart as PieIcon, ArrowUpRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface LTVBySegmentProps {
  timeRange?: '30d' | '90d' | '1y' | 'all';
}

interface SegmentData {
  segmentId: string;
  segmentName: string;
  userCount: number;
  avgLTV: number;
  totalLTV: number;
  avgOrders: number;
  avgOrderValue: number;
  churnRate: number;
  growth: number;
}

interface LTVStats {
  totalUsers: number;
  avgLTV: number;
  totalLTV: number;
  topSegment: string;
  fastestGrowingSegment: string;
  segments: SegmentData[];
}

const SEGMENT_COLORS: Record<string, string> = {
  vip: '#7C3AED',
  frequent: '#2563EB',
  regular: '#10B981',
  occasional: '#F59E0B',
  at_risk: '#EF4444',
};

export const LTVBySegment: React.FC<LTVBySegmentProps> = ({
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LTVStats>({
    totalUsers: 0,
    avgLTV: 0,
    totalLTV: 0,
    topSegment: 'N/A',
    fastestGrowingSegment: 'N/A',
    segments: [],
  });
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [sortBy, setSortBy] = useState<'ltv' | 'users' | 'growth'>('ltv');
  const [viewMode, setViewMode] = useState<'bar' | 'pie'>('bar');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getAdminLTVBySegment(selectedRange);
        setStats(apiData.stats);
        setSegments(apiData.segments || []);
      } catch (err) {
        setStats({
          totalUsers: 0,
          avgLTV: 0,
          totalLTV: 0,
          topSegment: 'N/A',
          fastestGrowingSegment: 'N/A',
          segments: [],
        });
        setSegments([]);
        setError(err instanceof Error ? err.message : 'Failed to load LTV segment data');
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
    return `AED ${value.toFixed(0)}`;
  };

  const sortedSegments = [...segments].sort((a, b) => {
    switch (sortBy) {
      case 'ltv':
        return b.avgLTV - a.avgLTV;
      case 'users':
        return b.userCount - a.userCount;
      case 'growth':
        return b.growth - a.growth;
      default:
        return 0;
    }
  });

  const pieData = segments.map((s) => ({
    name: s.segmentName,
    value: s.totalLTV,
    color: SEGMENT_COLORS[s.segmentId],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const segment = payload[0].payload as SegmentData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{segment.segmentName}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Users: <span className="font-medium">{segment.userCount.toLocaleString()}</span>
            </p>
            <p className="text-purple-600">
              Avg LTV: <span className="font-medium">{formatCurrency(segment.avgLTV)}</span>
            </p>
            <p className="text-blue-600">
              Total LTV: <span className="font-medium">{formatCurrency(segment.totalLTV)}</span>
            </p>
            <p className="text-green-600">
              Avg Orders: <span className="font-medium">{segment.avgOrders}</span>
            </p>
            <p className="text-orange-600">
              Churn Rate: <span className="font-medium">{segment.churnRate}%</span>
            </p>
            <p className={segment.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
              Growth: <span className="font-medium">{segment.growth >= 0 ? '+' : ''}{segment.growth}%</span>
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
    { key: 'all', label: 'All Time' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            LTV by Segment
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Customer lifetime value distribution across segments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'bar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setViewMode('pie')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'pie'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pie
            </button>
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
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-700 mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Avg LTV
          </p>
          <p className="text-2xl font-bold text-purple-700">{formatCurrency(stats.avgLTV)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total LTV</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalLTV)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Top Segment</p>
          <p className="text-lg font-bold text-gray-900">{stats.topSegment}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Sort by: {sortBy}</p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['ltv', 'users', 'growth'] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                sortBy === sort
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {sort}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'bar' ? (
              <BarChart
                data={sortedSegments}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <YAxis
                  type="category"
                  dataKey="segmentName"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  width={115}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgLTV" name="Avg LTV" radius={[0, 4, 4, 0]}>
                  {sortedSegments.map((entry) => (
                    <Cell key={entry.segmentId} fill={SEGMENT_COLORS[entry.segmentId]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Segment Details</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Segment</th>
                <th className="pb-3 font-medium text-right">Users</th>
                <th className="pb-3 font-medium text-right">Avg LTV</th>
                <th className="pb-3 font-medium text-right">Avg Orders</th>
                <th className="pb-3 font-medium text-right">Churn Rate</th>
                <th className="pb-3 font-medium text-right">Growth</th>
              </tr>
            </thead>
            <tbody>
              {sortedSegments.map((segment) => (
                <tr key={segment.segmentId} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SEGMENT_COLORS[segment.segmentId] }}
                      />
                      <span className="font-medium text-gray-900">{segment.segmentName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-gray-900">
                    {segment.userCount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-purple-600 font-medium">
                    {formatCurrency(segment.avgLTV)}
                  </td>
                  <td className="py-3 text-right text-gray-900">{segment.avgOrders}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        segment.churnRate < 10
                          ? 'bg-green-100 text-green-700'
                          : segment.churnRate < 25
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {segment.churnRate}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className={`flex items-center justify-end gap-1 ${
                      segment.growth >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {segment.growth >= 0 && <ArrowUpRight className="h-4 w-4" />}
                      <span className="text-sm font-medium">{segment.growth >= 0 ? '+' : ''}{segment.growth}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default LTVBySegment;
