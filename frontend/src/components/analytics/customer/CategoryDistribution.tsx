// Category Distribution - Customer Analytics Component
import React, { useState, useEffect } from 'react';
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
import { PieChart as PieIcon, Loader, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface CategoryDistributionProps {
  customerId?: string;
  timeRange?: '30d' | '90d' | '1y' | 'all';
}

interface CategoryData {
  categoryId: string;
  categoryName: string;
  count: number;
  revenue: number;
  percentage: number;
  trend: number;
  color: string;
}

interface CategoryStats {
  topCategory: string;
  totalCategories: number;
  mostUsedCategory: string;
  fastestGrowingCategory: string;
}

const COLORS = [
  '#2563EB',
  '#7C3AED',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
];

const EMPTY_STATS: CategoryStats = {
  topCategory: 'N/A',
  totalCategories: 0,
  mostUsedCategory: 'N/A',
  fastestGrowingCategory: 'N/A',
};

export const CategoryDistribution: React.FC<CategoryDistributionProps> = ({
  customerId,
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryData[]>([]);
  const [stats, setStats] = useState<CategoryStats>(EMPTY_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getCustomerCategoryDistribution(selectedRange, customerId);
        const categories = (apiData.categories || []).map((category, index) => ({
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          count: category.bookingCount,
          revenue: category.totalSpent,
          percentage: category.percentage,
          trend: 0,
          color: COLORS[index % COLORS.length],
        }));

        const mostUsed = [...categories].sort((a, b) => b.count - a.count)[0];

        setData(categories);
        setStats({
          topCategory: apiData.topCategory || 'N/A',
          totalCategories: categories.length,
          mostUsedCategory: mostUsed?.categoryName || 'N/A',
          fastestGrowingCategory: categories[0]?.categoryName || 'N/A',
        });
      } catch (err) {
        setData([]);
        setStats(EMPTY_STATS);
        setError(err instanceof Error ? err.message : 'Failed to load category distribution');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId, selectedRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as CategoryData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <p className="font-semibold text-gray-900">{item.categoryName}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Bookings: <span className="font-medium">{item.count}</span>
            </p>
            <p className="text-gray-600">
              Revenue: <span className="font-medium">{formatCurrency(item.revenue)}</span>
            </p>
            <p className="text-gray-600">
              Share: <span className="font-medium">{item.percentage.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {data.slice(0, 5).map((entry) => (
        <div key={entry.categoryId} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-gray-600">{entry.categoryName}</span>
        </div>
      ))}
      {data.length > 5 && (
        <span className="text-xs text-gray-500">+{data.length - 5} more</span>
      )}
    </div>
  );

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
            <PieIcon className="h-5 w-5 text-purple-600" />
            Category Distribution
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            How you spend across service categories
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Top Category</p>
          <p className="text-lg font-bold text-gray-900">{stats.topCategory}</p>
          <p className="text-xs text-gray-500">Highest spend</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Categories Used</p>
          <p className="text-lg font-bold text-gray-900">{stats.totalCategories}</p>
          <p className="text-xs text-gray-500">In this period</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Most Booked</p>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <p className="text-lg font-bold text-green-600">{stats.mostUsedCategory}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center">
          <PieIcon className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">No category data yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Complete bookings to see how your spend is distributed across categories.
          </p>
        </div>
      ) : viewMode === 'pie' ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {renderLegend()}
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
            >
              <XAxis type="number" tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="categoryName"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                width={75}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="percentage" name="Share" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">All Categories</h4>
          <div className="space-y-2">
            {data.map((category) => (
              <div
                key={category.categoryId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{category.categoryName}</p>
                    <p className="text-xs text-gray-500">{category.count} bookings</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(category.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CategoryDistribution;
