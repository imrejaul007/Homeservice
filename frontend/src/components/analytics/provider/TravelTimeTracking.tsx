// Travel Time Tracking - Provider Analytics Component
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { MapPin, Clock, Loader, Navigation, AlertCircle, TrendingUp, Fuel } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi, TravelData, TravelStats, JobsByArea } from '../../../services/analyticsApi';

interface TravelTimeTrackingProps {
  providerId?: string;
  timeRange?: '7d' | '30d' | '90d';
}

// Default mock data for fallback when API is unavailable
const DEFAULT_TRAVEL_DATA: TravelData[] = [
  { date: 'Mon', totalTravelTime: 180, avgTravelTime: 22, totalDistance: 65, bookings: 8, efficiency: 72 },
  { date: 'Tue', totalTravelTime: 210, avgTravelTime: 26, totalDistance: 78, bookings: 7, efficiency: 68 },
  { date: 'Wed', totalTravelTime: 150, avgTravelTime: 19, totalDistance: 55, bookings: 8, efficiency: 78 },
  { date: 'Thu', totalTravelTime: 195, avgTravelTime: 24, totalDistance: 72, bookings: 8, efficiency: 70 },
  { date: 'Fri', totalTravelTime: 240, avgTravelTime: 30, totalDistance: 90, bookings: 8, efficiency: 65 },
  { date: 'Sat', totalTravelTime: 270, avgTravelTime: 34, totalDistance: 100, bookings: 7, efficiency: 62 },
  { date: 'Sun', totalTravelTime: 165, avgTravelTime: 21, totalDistance: 60, bookings: 8, efficiency: 75 },
];

const DEFAULT_TRAVEL_STATS: TravelStats = {
  totalTravelTime: 1410,
  avgTravelTime: 25,
  totalDistance: 520,
  avgDistance: 65,
  fuelCost: 182,
  mostRemoteJob: 'Palm Jumeirah',
  leastEfficient: 'Downtown Dubai',
  potentialSavings: 320,
  efficiency: 70,
};

const DEFAULT_JOBS_BY_AREA: JobsByArea[] = [
  { area: 'Marina', jobs: 28, avgTravel: 15, avgDistance: 8 },
  { area: 'Downtown', jobs: 22, avgTravel: 35, avgDistance: 18 },
  { area: 'JBR', jobs: 18, avgTravel: 20, avgDistance: 12 },
  { area: 'Palm Jumeirah', jobs: 8, avgTravel: 55, avgDistance: 35 },
  { area: 'Business Bay', jobs: 15, avgTravel: 25, avgDistance: 15 },
  { area: 'DIFC', jobs: 12, avgTravel: 22, avgDistance: 12 },
];

export const TravelTimeTracking: React.FC<TravelTimeTrackingProps> = ({
  providerId,
  timeRange = '30d',
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'time' | 'distance' | 'efficiency'>('time');

  // Use API if providerId is available, otherwise show empty state
  const shouldFetch = Boolean(providerId);
  const effectiveProviderId = providerId || '';

  const { data: apiData, isLoading: loading } = useQuery({
    queryKey: ['provider', 'travelTime', effectiveProviderId, selectedRange],
    queryFn: () => analyticsApi.getProviderTravelMetrics(effectiveProviderId),
    enabled: shouldFetch,
  });

  // Use API data if available, otherwise use defaults
  const travelData = apiData?.travelData ?? DEFAULT_TRAVEL_DATA;
  const stats = apiData?.stats ?? DEFAULT_TRAVEL_STATS;
  const jobsByArea = apiData?.jobsByArea ?? DEFAULT_JOBS_BY_AREA;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDistance = (km: number) => `${km} km`;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as TravelData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Total Travel: <span className="font-medium">{formatDuration(item.totalTravelTime)}</span>
            </p>
            <p className="text-green-600">
              Avg Travel: <span className="font-medium">{formatDuration(item.avgTravelTime)}</span>
            </p>
            <p className="text-purple-600">
              Distance: <span className="font-medium">{formatDistance(item.totalDistance)}</span>
            </p>
            <p className="text-orange-600">
              Efficiency: <span className="font-medium">{item.efficiency}%</span>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Travel Time Tracking
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Monitor travel efficiency and optimize routes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['time', 'distance', 'efficiency'] as const).map((mode) => (
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-700">Total Travel</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatDuration(stats.totalTravelTime)}</p>
          <p className="text-xs text-gray-500">{stats.avgTravelTime}m avg/day</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="h-4 w-4 text-purple-600" />
            <p className="text-sm text-purple-700">Total Distance</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatDistance(stats.totalDistance)}</p>
          <p className="text-xs text-gray-500">{stats.avgDistance} km avg/day</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Fuel className="h-4 w-4 text-orange-600" />
            <p className="text-sm text-orange-700">Fuel Cost</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.fuelCost)}</p>
          <p className="text-xs text-gray-500">Est. this period</p>
        </div>

        <div className={`rounded-lg p-4 ${stats.efficiency >= 70 ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={`h-4 w-4 ${stats.efficiency >= 70 ? 'text-green-600' : 'text-yellow-600'}`} />
            <p className={`text-sm ${stats.efficiency >= 70 ? 'text-green-700' : 'text-yellow-700'}`}>Efficiency</p>
          </div>
          <p className={`text-xl font-bold ${stats.efficiency >= 70 ? 'text-green-700' : 'text-yellow-700'}`}>
            {stats.efficiency}%
          </p>
          <p className="text-xs text-gray-500">Target: 75%</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'efficiency' ? (
              <LineChart data={travelData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="efficiency"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
              </LineChart>
            ) : (
              <BarChart data={travelData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={viewMode === 'time' ? 'avgTravelTime' : 'totalDistance'}
                  fill={viewMode === 'time' ? '#2563EB' : '#7C3AED'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Travel by Area</h4>
        <div className="space-y-3">
          {jobsByArea.map((area) => (
            <div key={area.area} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${area.avgTravel > 30 ? 'bg-red-400' : area.avgTravel > 20 ? 'bg-yellow-400' : 'bg-green-400'}`} />
                <div>
                  <p className="font-medium text-gray-900">{area.area}</p>
                  <p className="text-xs text-gray-500">{area.jobs} jobs</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-gray-500">Avg Travel</p>
                  <p className={`font-medium ${area.avgTravel > 30 ? 'text-red-600' : area.avgTravel > 20 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {formatDuration(area.avgTravel)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Avg Distance</p>
                  <p className="font-medium text-gray-900">{formatDistance(area.avgDistance)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          Optimization Tips
        </h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">{stats.mostRemoteJob}</span> is your most remote job location.
              Consider grouping nearby jobs together.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
            <p className="text-gray-600">
              You could save up to <span className="font-medium text-gray-900">{formatCurrency(stats.potentialSavings)}</span> monthly
              by optimizing your {stats.leastEfficient} route.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
            <p className="text-gray-600">
              Your <span className="font-medium text-gray-900">Marina</span> area efficiency is excellent. Focus on maintaining this routing pattern.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TravelTimeTracking;
