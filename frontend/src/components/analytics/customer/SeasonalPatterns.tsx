// Seasonal Patterns - Customer Analytics Component
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
} from 'recharts';
import { Calendar, TrendingUp, Loader, Sun, Snowflake, Leaf, CloudRain, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface SeasonalPatternsProps {
  customerId?: string;
  year?: number;
}

interface MonthlyData {
  month: string;
  monthNum: number;
  bookings: number;
  spending: number;
  avgValue: number;
  season: 'winter' | 'spring' | 'summer' | 'fall';
}

interface SeasonalData {
  season: string;
  bookings: number;
  spending: number;
  avgValue: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface HolidayData {
  name: string;
  date: string;
  bookings: number;
  spending: number;
}

interface PatternStats {
  peakMonth: string;
  slowMonth: string;
  seasonalityIndex: number;
  trendDirection: 'up' | 'down' | 'stable';
  forecast: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMPTY_STATS: PatternStats = {
  peakMonth: 'N/A',
  slowMonth: 'N/A',
  seasonalityIndex: 0,
  trendDirection: 'stable',
  forecast: 0,
};

const getSeasonConfig = (season: string) => {
  const configs: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
    winter: { icon: <Snowflake className="h-4 w-4" />, color: '#3B82F6', bgColor: 'bg-blue-100' },
    spring: { icon: <Leaf className="h-4 w-4" />, color: '#10B981', bgColor: 'bg-green-100' },
    summer: { icon: <Sun className="h-4 w-4" />, color: '#F59E0B', bgColor: 'bg-amber-100' },
    fall: { icon: <CloudRain className="h-4 w-4" />, color: '#8B5CF6', bgColor: 'bg-purple-100' },
  };
  return configs[season] || configs.spring;
};

export const SeasonalPatterns: React.FC<SeasonalPatternsProps> = ({
  customerId,
  year: initialYear = new Date().getFullYear(),
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [holidayData, setHolidayData] = useState<HolidayData[]>([]);
  const [stats, setStats] = useState<PatternStats>(EMPTY_STATS);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [viewMode, setViewMode] = useState<'area' | 'bar'>('area');
  const [showSeasonal, setShowSeasonal] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getCustomerSeasonalPatterns(selectedYear, customerId);
        const mappedMonthly = (apiData.monthlyData || []).map((entry) => ({
          month: MONTH_SHORT[entry.month - 1] || `M${entry.month}`,
          monthNum: entry.month,
          bookings: entry.bookings,
          spending: entry.spending,
          avgValue: entry.averageValue,
          season: entry.season,
        }));

        const peakMonthName = apiData.peakMonth?.month
          ? MONTH_NAMES[apiData.peakMonth.month - 1]
          : 'N/A';
        const slowMonthName = apiData.slowMonth?.month
          ? MONTH_NAMES[apiData.slowMonth.month - 1]
          : 'N/A';
        const peakEntry = mappedMonthly.find((entry) => entry.monthNum === apiData.peakMonth?.month);
        const avgSpending = mappedMonthly.reduce((sum, entry) => sum + entry.avgValue, 0)
          / Math.max(mappedMonthly.filter((entry) => entry.bookings > 0).length, 1);

        setMonthlyData(mappedMonthly);
        setHolidayData(
          peakEntry
            ? [{
                name: 'Peak Month',
                date: peakEntry.month,
                bookings: peakEntry.bookings,
                spending: peakEntry.spending,
              }]
            : [],
        );
        setStats({
          peakMonth: peakMonthName,
          slowMonth: slowMonthName,
          seasonalityIndex: apiData.seasonalityIndex || 0,
          trendDirection: apiData.seasonalityIndex > 1 ? 'up' : 'stable',
          forecast: Math.round(avgSpending),
        });
      } catch (err) {
        setMonthlyData([]);
        setHolidayData([]);
        setStats(EMPTY_STATS);
        setError(err instanceof Error ? err.message : 'Failed to load seasonal patterns');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerId, selectedYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const aggregateSeasonalData = (): SeasonalData[] => {
    const seasons: Record<string, { bookings: number; spending: number }> = {
      winter: { bookings: 0, spending: 0 },
      spring: { bookings: 0, spending: 0 },
      summer: { bookings: 0, spending: 0 },
      fall: { bookings: 0, spending: 0 },
    };

    monthlyData.forEach((d) => {
      seasons[d.season].bookings += d.bookings;
      seasons[d.season].spending += d.spending;
    });

    return Object.entries(seasons).map(([season, data]) => ({
      season: season.charAt(0).toUpperCase() + season.slice(1),
      bookings: data.bookings,
      spending: data.spending,
      avgValue: data.bookings > 0 ? data.spending / data.bookings : 0,
      ...getSeasonConfig(season),
    }));
  };

  const seasonalData = aggregateSeasonalData();
  const avgBookings = monthlyData.length > 0
    ? monthlyData.reduce((sum, d) => sum + d.bookings, 0) / monthlyData.length
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as MonthlyData;
      const seasonConfig = getSeasonConfig(item.season);
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-full ${seasonConfig.bgColor} flex items-center justify-center`} style={{ color: seasonConfig.color }}>
              {seasonConfig.icon}
            </div>
            <p className="font-semibold text-gray-900">{item.month} {selectedYear}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Bookings: <span className="font-medium">{item.bookings}</span>
            </p>
            <p className="text-green-600">
              Spending: <span className="font-medium">{formatCurrency(item.spending)}</span>
            </p>
            <p className="text-gray-600">
              Avg Value: <span className="font-medium">{formatCurrency(item.avgValue)}</span>
            </p>
            <p className="text-gray-500 capitalize">
              Season: <span className="font-medium">{item.season}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
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
            <Calendar className="h-5 w-5 text-purple-600" />
            Seasonal Patterns
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Booking patterns by season and month
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowSeasonal(true)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                showSeasonal
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Seasons
            </button>
            <button
              onClick={() => setShowSeasonal(false)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                !showSeasonal
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-100">
          <p className="text-sm text-amber-700 mb-1">Peak Month</p>
          <p className="text-xl font-bold text-gray-900">{stats.peakMonth}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Slow Month</p>
          <p className="text-xl font-bold text-gray-900">{stats.slowMonth}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Seasonality</p>
          <p className="text-xl font-bold text-purple-600">{stats.seasonalityIndex.toFixed(1)}x</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Forecast</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(stats.forecast)}</p>
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : monthlyData.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-500">
          No seasonal booking data for {selectedYear}.
        </div>
      ) : showSeasonal ? (
        <>
          {/* Seasonal Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {seasonalData.map((season) => (
              <div
                key={season.season}
                className="rounded-lg p-4 border"
                style={{ backgroundColor: `${season.bgColor}33`, borderColor: season.color }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: season.bgColor, color: season.color }}
                  >
                    {season.icon}
                  </div>
                  <span className="font-medium text-gray-900">{season.season}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: season.color }}>
                  {season.bookings}
                </p>
                <p className="text-sm text-gray-500">bookings</p>
                <p className="text-sm font-medium text-gray-700 mt-1">
                  {formatCurrency(season.spending)}
                </p>
              </div>
            ))}
          </div>

          {/* Seasonal Bar Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="season"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'bookings' ? `${value} bookings` : formatCurrency(value),
                    name === 'bookings' ? 'Bookings' : 'Spending',
                  ]}
                />
                <Bar dataKey="bookings" radius={[4, 4, 0, 0]}>
                  {seasonalData.map((entry, index) => (
                    <rect key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <>
          {/* Monthly Trend Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bookingsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
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
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={avgBookings}
                  stroke="#6B7280"
                  strokeDasharray="5 5"
                  label={{ value: `Avg: ${avgBookings.toFixed(0)}`, fill: '#6B7280', fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  dataKey="bookings"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fill="url(#bookingsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Holiday Impact */}
          {holidayData.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              Holiday & Event Impact
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {holidayData.map((holiday) => {
                const monthData = monthlyData.find((m) => m.month === holiday.date);
                const impact = monthData ? ((holiday.bookings - avgBookings) / avgBookings) * 100 : 0;
                return (
                  <div key={holiday.name} className="bg-gray-50 rounded-lg p-3">
                    <p className="font-medium text-gray-900 text-sm">{holiday.name}</p>
                    <p className="text-xs text-gray-500">{holiday.date}</p>
                    <p className="text-lg font-bold text-purple-600 mt-1">{holiday.bookings}</p>
                    <p className={`text-xs ${impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {impact > 0 ? '+' : ''}{impact.toFixed(0)}% vs avg
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </>
      )}

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Demand Forecasting
        </h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5" />
            <p className="text-gray-600">
              Your booking activity peaks in <span className="font-medium text-gray-900">{stats.peakMonth}</span> with{' '}
              <span className="font-medium text-gray-900">{Math.round((stats.seasonalityIndex - 1) * 100)}%</span> above average.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
            <p className="text-gray-600">
              Consider booking early during peak periods like{' '}
              <span className="font-medium text-gray-900">December</span> and{' '}
              <span className="font-medium text-gray-900">Eid holidays</span> for better availability.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SeasonalPatterns;
