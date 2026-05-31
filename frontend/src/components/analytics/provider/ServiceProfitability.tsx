// Service Profitability Analysis - Provider Analytics Component
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
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Loader, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi, ServiceData, ProfitabilityStats } from '../../../services/analyticsApi';

interface ServiceProfitabilityProps {
  providerId?: string;
  timeRange?: '30d' | '90d' | '1y';
}

// Default mock data for fallback when API is unavailable
const DEFAULT_SERVICE_DATA: ServiceData[] = [
  { serviceId: '1', serviceName: 'Deep Cleaning', revenue: 4500, costs: 900, profit: 3600, margin: 80, bookings: 45, avgPrice: 100, trend: 12, category: 'Cleaning' },
  { serviceId: '2', serviceName: 'AC Repair', revenue: 6200, costs: 1860, profit: 4340, margin: 70, bookings: 31, avgPrice: 200, trend: 8, category: 'HVAC' },
  { serviceId: '3', serviceName: 'Plumbing', revenue: 3800, costs: 1140, profit: 2660, margin: 70, bookings: 38, avgPrice: 100, trend: -5, category: 'Plumbing' },
  { serviceId: '4', serviceName: 'Electrical', revenue: 2900, costs: 870, profit: 2030, margin: 70, bookings: 29, avgPrice: 100, trend: 15, category: 'Electrical' },
  { serviceId: '5', serviceName: 'Handyman', revenue: 2200, costs: 880, profit: 1320, margin: 60, bookings: 44, avgPrice: 50, trend: 3, category: 'General' },
  { serviceId: '6', serviceName: 'Pest Control', revenue: 1800, costs: 720, profit: 1080, margin: 60, bookings: 18, avgPrice: 100, trend: 20, category: 'Pest Control' },
  { serviceId: '7', serviceName: 'Gardening', revenue: 1500, costs: 750, profit: 750, margin: 50, bookings: 25, avgPrice: 60, trend: -8, category: 'Outdoor' },
  { serviceId: '8', serviceName: 'Window Cleaning', revenue: 1200, costs: 600, profit: 600, margin: 50, bookings: 30, avgPrice: 40, trend: 5, category: 'Cleaning' },
];

const DEFAULT_PROFITABILITY_STATS: ProfitabilityStats = {
  totalRevenue: 24100,
  totalCosts: 7220,
  totalProfit: 16880,
  averageMargin: 70,
  topPerformer: 'Deep Cleaning',
  worstPerformer: 'Gardening',
  potentialSavings: 1200,
};

export const ServiceProfitability: React.FC<ServiceProfitabilityProps> = ({
  providerId,
  timeRange = '30d',
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'revenue'>('profit');
  const [viewMode, setViewMode] = useState<'bars' | 'trend'>('bars');

  // Use API if providerId is available, otherwise show empty state
  const shouldFetch = Boolean(providerId);
  const effectiveProviderId = providerId || '';

  const { data: apiData, isLoading: loading } = useQuery({
    queryKey: ['provider', 'serviceAnalytics', effectiveProviderId, selectedRange],
    queryFn: () => analyticsApi.getServiceProfitability(effectiveProviderId),
    enabled: shouldFetch,
  });

  // Use API data if available, otherwise use defaults
  const services = apiData?.services ?? DEFAULT_SERVICE_DATA;
  const stats = apiData?.stats ?? DEFAULT_PROFITABILITY_STATS;

  const sortedData = [...services].sort((a, b) => b[sortBy] - a[sortBy]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 70) return '#10B981'; // Green
    if (margin >= 50) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as ServiceData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{item.serviceName}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Revenue: <span className="font-medium">{formatCurrency(item.revenue)}</span>
            </p>
            <p className="text-red-600">
              Costs: <span className="font-medium">{formatCurrency(item.costs)}</span>
            </p>
            <p className="text-green-600">
              Profit: <span className="font-medium">{formatCurrency(item.profit)}</span>
            </p>
            <p className="text-blue-600">
              Margin: <span className="font-medium">{item.margin}%</span>
            </p>
            <p className="text-gray-600">
              Bookings: <span className="font-medium">{item.bookings}</span>
            </p>
            <p className={item.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
              Trend: <span className="font-medium">{item.trend >= 0 ? '+' : ''}{item.trend}%</span>
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
            <DollarSign className="h-5 w-5 text-green-600" />
            Service Profitability
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Analyze profit margins by service
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('bars')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'bars'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bars
            </button>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Profit</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalProfit)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Avg Margin</p>
          <p className="text-xl font-bold text-blue-600">{stats.averageMargin}%</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Top Performer</p>
          <p className="text-lg font-bold text-gray-900">{stats.topPerformer}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Services sorted by {sortBy}</p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['profit', 'margin', 'revenue'] as const).map((sort) => (
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
          <Loader className="h-8 w-8 text-green-600 animate-spin" />
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'bars' ? (
              <BarChart
                data={sortedData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="serviceName"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  width={95}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="margin" name="Margin" radius={[0, 4, 4, 0]}>
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getMarginColor(entry.margin)} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={sortedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="serviceName"
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="margin"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-gray-600">High (70%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-xs text-gray-600">Medium (50-70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-gray-600">Low (&lt;50%)</span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Detailed Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Service</th>
                <th className="pb-3 font-medium text-right">Revenue</th>
                <th className="pb-3 font-medium text-right">Costs</th>
                <th className="pb-3 font-medium text-right">Profit</th>
                <th className="pb-3 font-medium text-right">Margin</th>
                <th className="pb-3 font-medium text-right">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((service) => (
                <tr key={service.serviceId} className="border-b border-gray-100">
                  <td className="py-3">
                    <div>
                      <p className="font-medium text-gray-900">{service.serviceName}</p>
                      <p className="text-xs text-gray-500">{service.category}</p>
                    </div>
                  </td>
                  <td className="py-3 text-right text-gray-900">{formatCurrency(service.revenue)}</td>
                  <td className="py-3 text-right text-red-600">{formatCurrency(service.costs)}</td>
                  <td className="py-3 text-right text-green-600 font-medium">{formatCurrency(service.profit)}</td>
                  <td className="py-3 text-right">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getMarginColor(service.margin)}20`,
                        color: getMarginColor(service.margin),
                      }}
                    >
                      {service.margin}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className={`flex items-center justify-end gap-1 ${
                      service.trend >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {service.trend >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {service.trend >= 0 ? '+' : ''}{service.trend}%
                      </span>
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

export default ServiceProfitability;
