// Booking Frequency Chart - Customer Analytics Component
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Loader, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface BookingFrequencyProps {
  customerId?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y';
  onPeriodChange?: (period: string) => void;
}

interface FrequencyData {
  date: string;
  bookings: number;
  revenue: number;
  avgValue: number;
}

interface FrequencyStats {
  totalBookings: number;
  avgPerWeek: number;
  avgPerMonth: number;
  trend: number;
  trendDirection: 'up' | 'down' | 'stable';
  mostActiveDay: string;
  peakHours: string;
}

const EMPTY_STATS: FrequencyStats = {
  totalBookings: 0,
  avgPerWeek: 0,
  avgPerMonth: 0,
  trend: 0,
  trendDirection: 'stable',
  mostActiveDay: 'N/A',
  peakHours: 'N/A',
};

export const BookingFrequency: React.FC<BookingFrequencyProps> = ({
  customerId,
  timeRange = '30d',
  onPeriodChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FrequencyData[]>([]);
  const [stats, setStats] = useState<FrequencyStats>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getCustomerBookingFrequency(selectedRange, customerId);
        const weeksInPeriod =
          selectedRange === '7d' ? 1 : selectedRange === '30d' ? 4 : selectedRange === '90d' ? 13 : 52;

        setData(apiData.timeSeries || []);
        setStats({
          totalBookings: apiData.totalBookings,
          avgPerWeek: weeksInPeriod > 0
            ? Math.round((apiData.totalBookings / weeksInPeriod) * 10) / 10
            : 0,
          avgPerMonth: apiData.averageBookingsPerMonth,
          trend: apiData.trend,
          trendDirection: apiData.trendDirection,
          mostActiveDay: apiData.mostActiveDay,
          peakHours: apiData.peakHours,
        });
      } catch (err) {
        setData([]);
        setStats(EMPTY_STATS);
        setError(err instanceof Error ? err.message : 'Failed to load booking frequency data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId, selectedRange]);

  const handlePeriodChange = (period: string) => {
    setSelectedRange(period as typeof selectedRange);
    onPeriodChange?.(period);
  };

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
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{label}</p>
          <p className="text-blue-600">
            Bookings: <span className="font-medium">{payload[0]?.value || 0}</span>
          </p>
          <p className="text-green-600">
            Revenue: <span className="font-medium">{formatCurrency(payload[1]?.value || 0)}</span>
          </p>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Booking Frequency
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Track your booking patterns over time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => handlePeriodChange(range.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedRange === range.key
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Avg per Week</p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgPerWeek}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Trend</p>
          <div className="flex items-center gap-1">
            {stats.trendDirection === 'up' ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : stats.trendDirection === 'down' ? (
              <TrendingDown className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5" />
            )}
            <span
              className={`text-lg font-bold ${
                stats.trendDirection === 'up'
                  ? 'text-green-600'
                  : stats.trendDirection === 'down'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}
            >
              {stats.trend > 0 ? '+' : ''}{stats.trend}%
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Most Active</p>
          <p className="text-lg font-bold text-gray-900">{stats.mostActiveDay}</p>
          <p className="text-xs text-gray-500">{stats.peakHours}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Bookings over time</p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              chartType === 'bar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Bar
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              chartType === 'line'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Line
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center">
          <Calendar className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No booking activity yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Your booking frequency chart will appear after your first booking.
          </p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="bookings" fill="#2563EB" radius={[4, 4, 0, 0]} name="Bookings" />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#2563EB' }}
                  name="Bookings"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {!loading && stats.totalBookings > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Insights</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
              <p className="text-gray-600">
                Your booking frequency has {stats.trend >= 0 ? 'increased' : 'decreased'} by{' '}
                <span className="font-medium text-gray-900">{Math.abs(stats.trend)}%</span> compared to the previous period.
              </p>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
              <p className="text-gray-600">
                You tend to book the most on{' '}
                <span className="font-medium text-gray-900">{stats.mostActiveDay}</span>.
              </p>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5" />
              <p className="text-gray-600">
                Peak booking hours are around{' '}
                <span className="font-medium text-gray-900">{stats.peakHours}</span>.
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default BookingFrequency;
