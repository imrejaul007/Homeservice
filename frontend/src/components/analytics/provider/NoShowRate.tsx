// No-Show Rate Tracking - Provider Analytics Component
import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { AlertTriangle, Loader, Calendar, Users, TrendingDown, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface NoShowRateProps {
  providerId?: string;
  timeRange?: '7d' | '30d' | '90d';
}

interface NoShowData {
  date: string;
  totalBookings: number;
  noShows: number;
  lateCancellations: number;
  completed: number;
  rate: number;
}

interface NoShowStats {
  totalBookings: number;
  noShows: number;
  lateCancellations: number;
  noShowRate: number;
  averageNoShowRate: number;
  trend: number;
  revenueLoss: number;
  topReason: string;
  customerImpact: number;
}

const CHART_COLORS = ['#10B981', '#EF4444', '#F59E0B'];

export const NoShowRate: React.FC<NoShowRateProps> = ({ providerId, timeRange = '7d' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<NoShowStats | null>(null);
  const [chartData, setChartData] = useState<NoShowData[]>([]);

  const fetchNoShowData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiData = await analyticsApi.getProviderNoShowRate(timeRange, providerId);
      const dailyData = apiData.dailyData || [];

      setStats({
        totalBookings: apiData.stats.totalBookings,
        noShows: apiData.stats.noShows,
        lateCancellations: apiData.stats.lateCancellations,
        noShowRate: apiData.stats.noShowRate,
        averageNoShowRate: apiData.stats.averageNoShowRate,
        trend: apiData.stats.trend,
        revenueLoss: apiData.stats.revenueLoss,
        topReason: apiData.stats.topReason,
        customerImpact: apiData.stats.customerImpact,
      });

      setChartData(
        dailyData.map((row) => ({
          date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          totalBookings: row.totalBookings,
          noShows: row.noShows,
          lateCancellations: row.lateCancellations,
          completed: row.completed,
          rate: row.rate,
        })),
      );
    } catch (err) {
      console.error('Failed to fetch no-show data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load no-show data');
      setStats(null);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange, providerId]);

  useEffect(() => {
    fetchNoShowData();
  }, [fetchNoShowData]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">No-Show Rate</h3>
        </div>
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={fetchNoShowData}
          className="mt-3 text-sm text-nilin-primary hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm text-center">
        <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-nilin-charcoal">No no-show data yet</p>
        <p className="text-sm text-nilin-warmGray mt-1">
          Metrics appear after you receive bookings in the selected period.
        </p>
      </div>
    );
  }

  const pieData = [
    { name: 'Completed', value: stats.totalBookings - stats.noShows - stats.lateCancellations },
    { name: 'No-Shows', value: stats.noShows },
    { name: 'Late Cancellations', value: stats.lateCancellations },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">No-Show Rate</h3>
            <p className="text-xs text-nilin-warmGray">Customer reliability metrics</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-red-600">{stats?.noShowRate.toFixed(1)}%</p>
          <p className={`text-xs ${(stats?.trend || 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(stats?.trend || 0) <= 0 ? '↓' : '↑'} {Math.abs(stats?.trend || 0)}% vs avg
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-nilin-warmGray mb-1">
            <Users className="h-4 w-4" />
            Total Bookings
          </div>
          <p className="text-xl font-bold text-nilin-charcoal">{stats?.totalBookings}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-nilin-warmGray mb-1">
            <AlertTriangle className="h-4 w-4" />
            No-Shows
          </div>
          <p className="text-xl font-bold text-red-600">{stats?.noShows}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-nilin-warmGray mb-1">
            <Clock className="h-4 w-4" />
            Late Cancel
          </div>
          <p className="text-xl font-bold text-orange-600">{stats?.lateCancellations}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-nilin-warmGray mb-1">
            <TrendingDown className="h-4 w-4" />
            Revenue Loss
          </div>
          <p className="text-xl font-bold text-red-600">AED {stats?.revenueLoss}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-nilin-warmGray mb-2">Distribution</p>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 text-xs">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index] }}></div>
                <span className="text-nilin-warmGray">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-nilin-warmGray mb-2">Last 7 Days</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData.slice(-7)}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 10 }}
                formatter={(value: number) => [value, 'No-Shows']}
              />
              <Bar dataKey="noShows" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High Risk Bookings */}
      {noShowRisks && noShowRisks.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-xs text-nilin-warmGray mb-2">High Risk Bookings</p>
          <div className="space-y-2 max-h-24 overflow-y-auto">
            {noShowRisks.slice(0, 3).map((risk, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-nilin-charcoal">{risk.customerName}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  risk.riskLevel === 'critical' ? 'bg-red-100 text-red-700' :
                  risk.riskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {risk.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default NoShowRate;
