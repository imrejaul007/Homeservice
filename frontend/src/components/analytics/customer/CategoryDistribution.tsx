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
  Legend,
} from 'recharts';
import { PieChart as PieIcon, Loader, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

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
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
];

const MOCK_DATA: CategoryData[] = [
  { categoryId: '1', categoryName: 'Home Cleaning', count: 45, revenue: 9450, percentage: 32.4, trend: 15, color: COLORS[0] },
  { categoryId: '2', categoryName: 'Beauty & Spa', count: 32, revenue: 7680, percentage: 23.2, trend: 8, color: COLORS[1] },
  { categoryId: '3', categoryName: 'Plumbing', count: 18, revenue: 5400, percentage: 13.0, trend: -5, color: COLORS[2] },
  { categoryId: '4', categoryName: 'Electrical', count: 15, revenue: 4500, percentage: 10.9, trend: 12, color: COLORS[3] },
  { categoryId: '5', categoryName: 'AC Repair', count: 12, revenue: 3600, percentage: 8.7, trend: 22, color: COLORS[4] },
  { categoryId: '6', categoryName: 'Gardening', count: 10, revenue: 2000, percentage: 7.2, trend: -2, color: COLORS[5] },
  { categoryId: '7', categoryName: 'Other', count: 7, revenue: 1370, percentage: 4.6, trend: 5, color: COLORS[6] },
];

const MOCK_STATS: CategoryStats = {
  topCategory: 'Home Cleaning',
  totalCategories: 7,
  mostUsedCategory: 'Home Cleaning',
  fastestGrowingCategory: 'AC Repair',
};

export const CategoryDistribution: React.FC<CategoryDistributionProps> = ({
  customerId,
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CategoryData[]>(MOCK_DATA);
  const [stats, setStats] = useState<CategoryStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setData(MOCK_DATA);
      setLoading(false);
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
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
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
            <p className={item.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
              Trend: <span className="font-medium">{item.trend >= 0 ? '+' : ''}{item.trend}%</span>
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
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
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
      {/* Header */}
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

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
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

          {/* Time Range */}
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

      {/* Stats Cards */}
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
          <p className="text-sm text-gray-500 mb-1">Fastest Growing</p>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <p className="text-lg font-bold text-green-600">{stats.fastestGrowingCategory}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
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
              <Bar
                dataKey="percentage"
                name="Share"
                radius={[0, 4, 4, 0]}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category List */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">All Categories</h4>
        <div className="space-y-2">
          {data.map((category) => (
            <div
              key={category.categoryId}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{category.categoryName}</p>
                  <p className="text-xs text-gray-500">{category.count} bookings</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(category.revenue)}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    category.trend >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {category.trend >= 0 ? '+' : ''}{category.trend}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default CategoryDistribution;
