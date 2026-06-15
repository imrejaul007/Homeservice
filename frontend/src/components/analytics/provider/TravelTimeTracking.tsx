// Travel Time Tracking - Provider Analytics Component
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
import { MapPin, Clock, Loader, Navigation, TrendingUp, Fuel } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  analyticsApi,
  TravelStats,
  TravelData,
  type ProviderTravelMetrics,
} from '../../../services/analyticsApi';
import { EmptyState } from '../../common/EmptyState';

interface TravelTimeTrackingProps {
  providerId?: string;
  timeRange?: '7d' | '30d' | '90d';
  hidePeriodSelector?: boolean;
}

const EMPTY_STATS: TravelStats = {
  totalTravelTime: 0,
  avgTravelTime: 0,
  totalDistance: 0,
  avgDistance: 0,
  fuelCost: 0,
  mostRemoteJob: '',
  leastEfficient: '',
  potentialSavings: 0,
  efficiency: 0,
};

export const TravelTimeTracking: React.FC<TravelTimeTrackingProps> = ({
  providerId,
  timeRange = '30d',
  hidePeriodSelector = false,
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'time' | 'distance' | 'efficiency'>('time');
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<ProviderTravelMetrics | null>(null);

  useEffect(() => {
    setSelectedRange(timeRange);
  }, [timeRange]);

  useEffect(() => {
    if (!providerId) {
      setApiData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    analyticsApi
      .getProviderTravelMetrics(providerId, selectedRange)
      .then((data) => {
        if (!cancelled) {
          setApiData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [providerId, selectedRange]);

  const travelData = apiData?.travelData ?? [];
  const stats = apiData?.stats ?? EMPTY_STATS;
  const jobsByArea = apiData?.jobsByArea ?? [];
  const hasTravelData =
    travelData.length > 0 ||
    stats.totalTravelTime > 0 ||
    stats.totalDistance > 0 ||
    jobsByArea.length > 0;

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
      className="glass-nilin rounded-nilin-lg p-6 hover-lift"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Travel Time Tracking
          </h3>
          <p className="text-sm text-nilin-warmGray mt-1">
            Monitor travel efficiency and optimize routes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['time', 'distance', 'efficiency'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
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

          {!hidePeriodSelector && (
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
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : !hasTravelData ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="Travel tracking coming soon"
          description="Route and travel-time analytics will appear here once GPS tracking is enabled for completed jobs."
          compact
        />
      ) : (
        <>
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

          {jobsByArea.length > 0 && (
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
          )}
        </>
      )}
    </motion.div>
  );
};

export default TravelTimeTracking;
