// Peak Hours Revenue Chart - Provider Analytics Component
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
  ReferenceLine,
} from 'recharts';
import { Clock, TrendingUp, Loader, DollarSign, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface PeakHoursRevenueProps {
  providerId?: string;
  timeRange?: '7d' | '30d' | '90d';
}

interface HourlyData {
  hour: number;
  hourLabel: string;
  revenue: number;
  bookings: number;
  avgDuration: number;
  demand: 'low' | 'medium' | 'high' | 'peak';
}

interface PeakStats {
  peakHour: number;
  peakRevenue: number;
  slowHour: number;
  potentialRevenue: number;
  totalRevenue: number;
  totalBookings: number;
  avgBookingValue: number;
}

const MOCK_DATA: HourlyData[] = [
  { hour: 6, hourLabel: '6 AM', revenue: 150, bookings: 2, avgDuration: 60, demand: 'low' },
  { hour: 7, hourLabel: '7 AM', revenue: 280, bookings: 3, avgDuration: 65, demand: 'low' },
  { hour: 8, hourLabel: '8 AM', revenue: 520, bookings: 6, avgDuration: 70, demand: 'medium' },
  { hour: 9, hourLabel: '9 AM', revenue: 890, bookings: 10, avgDuration: 75, demand: 'high' },
  { hour: 10, hourLabel: '10 AM', revenue: 1250, bookings: 14, avgDuration: 80, demand: 'peak' },
  { hour: 11, hourLabel: '11 AM', revenue: 1380, bookings: 15, avgDuration: 85, demand: 'peak' },
  { hour: 12, hourLabel: '12 PM', revenue: 920, bookings: 10, avgDuration: 75, demand: 'high' },
  { hour: 13, hourLabel: '1 PM', revenue: 750, bookings: 8, avgDuration: 70, demand: 'medium' },
  { hour: 14, hourLabel: '2 PM', revenue: 980, bookings: 11, avgDuration: 72, demand: 'high' },
  { hour: 15, hourLabel: '3 PM', revenue: 1150, bookings: 13, avgDuration: 78, demand: 'peak' },
  { hour: 16, hourLabel: '4 PM', revenue: 1220, bookings: 14, avgDuration: 80, demand: 'peak' },
  { hour: 17, hourLabel: '5 PM', revenue: 1350, bookings: 15, avgDuration: 82, demand: 'peak' },
  { hour: 18, hourLabel: '6 PM', revenue: 1080, bookings: 12, avgDuration: 78, demand: 'high' },
  { hour: 19, hourLabel: '7 PM', revenue: 820, bookings: 9, avgDuration: 70, demand: 'medium' },
  { hour: 20, hourLabel: '8 PM', revenue: 580, bookings: 6, avgDuration: 65, demand: 'low' },
  { hour: 21, hourLabel: '9 PM', revenue: 320, bookings: 4, avgDuration: 60, demand: 'low' },
];

const MOCK_STATS: PeakStats = {
  peakHour: 17,
  peakRevenue: 1350,
  slowHour: 6,
  potentialRevenue: 12450,
  totalRevenue: 15680,
  totalBookings: 175,
  avgBookingValue: 89.60,
};

const DEMAND_COLORS = {
  low: '#9CA3AF',
  medium: '#60A5FA',
  high: '#34D399',
  peak: '#F59E0B',
};

export const PeakHoursRevenue: React.FC<PeakHoursRevenueProps> = ({
  providerId,
  timeRange = '30d',
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HourlyData[]>(MOCK_DATA);
  const [stats, setStats] = useState<PeakStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'revenue' | 'bookings'>('revenue');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setData(MOCK_DATA);
      setLoading(false);
    };
    fetchData();
  }, [providerId, selectedRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getDemandColor = (demand: string) => {
    return DEMAND_COLORS[demand as keyof typeof DEMAND_COLORS] || DEMAND_COLORS.low;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as HourlyData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{item.hourLabel}</p>
          <div className="space-y-1 text-sm">
            <p className="text-yellow-600">
              Revenue: <span className="font-medium">{formatCurrency(item.revenue)}</span>
            </p>
            <p className="text-blue-600">
              Bookings: <span className="font-medium">{item.bookings}</span>
            </p>
            <p className="text-gray-600">
              Avg Duration: <span className="font-medium">{item.avgDuration} min</span>
            </p>
            <p className={`font-medium ${
              item.demand === 'peak' ? 'text-yellow-600' :
              item.demand === 'high' ? 'text-green-600' :
              item.demand === 'medium' ? 'text-blue-600' : 'text-gray-600'
            }`}>
              Demand: <span className="capitalize">{item.demand}</span>
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
  ];

  const avgRevenue = stats.totalRevenue / data.filter(d => d.revenue > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Peak Hours Revenue
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Revenue distribution by hour of day
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('revenue')}
              className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'revenue'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Revenue
            </button>
            <button
              onClick={() => setViewMode('bookings')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'bookings'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bookings
            </button>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range.key}
                onClick={() => setSelectedRange(range.key as typeof selectedRange)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedRange === range.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-100">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-700">Peak Hour</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {data.find(d => d.hour === stats.peakHour)?.hourLabel}
          </p>
          <p className="text-sm text-yellow-600 font-medium">
            {formatCurrency(stats.peakRevenue)}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-sm text-gray-500">{stats.totalBookings} bookings</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Avg Booking Value</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.avgBookingValue)}</p>
          <p className="text-sm text-gray-500">per booking</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Potential Revenue</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(stats.potentialRevenue)}</p>
          <p className="text-sm text-gray-500">if peak all day</p>
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <Loader className="h-8 w-8 text-yellow-600 animate-spin" />
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="hourLabel"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={{ stroke: '#E5E7EB' }}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={{ stroke: '#E5E7EB' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={avgRevenue}
                stroke="#6B7280"
                strokeDasharray="5 5"
                label={{
                  value: `Avg: ${formatCurrency(avgRevenue)}`,
                  fill: '#6B7280',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Bar
                dataKey={viewMode === 'revenue' ? 'revenue' : 'bookings'}
                radius={[4, 4, 0, 0]}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getDemandColor(entry.demand)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mt-4">
        {Object.entries(DEMAND_COLORS).map(([demand, color]) => (
          <div key={demand} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600 capitalize">{demand} demand</span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Insights
        </h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
            <p className="text-gray-600">
              Your peak revenue hour is <span className="font-medium text-gray-900">{
                data.find(d => d.hour === stats.peakHour)?.hourLabel
              }</span> at{' '}
              <span className="font-medium text-gray-900">{formatCurrency(stats.peakRevenue)}</span>.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
            <p className="text-gray-600">
              Morning slots (6-8 AM) have lower demand. Consider offering{' '}
              <span className="font-medium text-gray-900">discounts</span> to fill these slots.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
            <p className="text-gray-600">
              Evening peak (4-6 PM) is your highest revenue window.{' '}
              <span className="font-medium text-gray-900">Maximize availability</span> during these hours.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PeakHoursRevenue;
