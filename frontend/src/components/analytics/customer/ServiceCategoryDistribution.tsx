// Service Category Distribution - Customer Analytics Component
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
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PieChart as PieIcon, TrendingUp, Loader, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

interface ServiceCategoryDistributionProps {
  customerId?: string;
  timeRange?: '30d' | '90d' | '1y' | 'all';
}

interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  bookings: number;
  color: string;
}

interface TrendData {
  month: string;
  [key: string]: string | number;
}

interface CategoryStats {
  topCategory: string;
  totalCategories: number;
  mostUsedCategory: string;
  diversification: number;
}

const CATEGORY_COLORS = [
  '#2563EB', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

const MOCK_DATA: CategoryData[] = [
  { name: 'Cleaning', value: 2450, percentage: 35, bookings: 12, color: CATEGORY_COLORS[0] },
  { name: 'Plumbing', value: 1800, percentage: 26, bookings: 8, color: CATEGORY_COLORS[1] },
  { name: 'Electrical', value: 1200, percentage: 17, bookings: 6, color: CATEGORY_COLORS[2] },
  { name: 'Gardening', value: 850, percentage: 12, bookings: 4, color: CATEGORY_COLORS[3] },
  { name: 'Handyman', value: 550, percentage: 8, bookings: 3, color: CATEGORY_COLORS[4] },
  { name: 'Painting', value: 150, percentage: 2, bookings: 1, color: CATEGORY_COLORS[5] },
];

const MOCK_TREND_DATA: TrendData[] = [
  { month: 'Jan', Cleaning: 180, Plumbing: 120, Electrical: 80, Gardening: 60 },
  { month: 'Feb', Cleaning: 200, Plumbing: 140, Electrical: 90, Gardening: 70 },
  { month: 'Mar', Cleaning: 220, Plumbing: 150, Electrical: 85, Gardening: 80 },
  { month: 'Apr', Cleaning: 240, Plumbing: 160, Electrical: 100, Gardening: 90 },
  { month: 'May', Cleaning: 260, Plumbing: 170, Electrical: 95, Gardening: 100 },
  { month: 'Jun', Cleaning: 280, Plumbing: 180, Electrical: 110, Gardening: 110 },
];

const MOCK_STATS: CategoryStats = {
  topCategory: 'Cleaning',
  totalCategories: 6,
  mostUsedCategory: 'Cleaning',
  diversification: 72,
};

export const ServiceCategoryDistribution: React.FC<ServiceCategoryDistributionProps> = ({
  customerId,
  timeRange = '90d',
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CategoryData[]>(MOCK_DATA);
  const [trendData, setTrendData] = useState<TrendData[]>(MOCK_TREND_DATA);
  const [stats, setStats] = useState<CategoryStats>(MOCK_STATS);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setData(MOCK_DATA);
      setTrendData(MOCK_TREND_DATA);
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

  const totalSpending = data.reduce((sum, d) => sum + d.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as CategoryData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{item.name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Spending: <span className="font-medium">{formatCurrency(item.value)}</span>
            </p>
            <p className="text-green-600">
              Bookings: <span className="font-medium">{item.bookings}</span>
            </p>
            <p className="text-gray-600">
              Share: <span className="font-medium">{item.percentage}%</span>
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

  const onPieEnter = (_: unknown, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
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
            <PieIcon className="h-5 w-5 text-blue-600" />
            Service Category Distribution
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Spending breakdown by service category
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chart Type Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setChartType('pie')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                chartType === 'pie'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pie
            </button>
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
          </div>

          {/* Time Range Selector */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Spent</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalSpending)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Top Category</p>
          <p className="text-xl font-bold text-blue-600">{stats.topCategory}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Categories Used</p>
          <p className="text-xl font-bold text-gray-900">{stats.totalCategories}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Diversification</p>
          <p className="text-xl font-bold text-green-600">{stats.diversification}%</p>
        </div>
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <Loader className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chart */}
          <div className="flex-1 h-80">
            {chartType === 'pie' ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={activeIndex === index ? '#1F2937' : 'transparent'}
                        strokeWidth={activeIndex === index ? 3 : 0}
                        style={{ transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)', transformOrigin: 'center' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Category Breakdown Table */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-gray-400" />
          Category Breakdown
        </h4>
        <div className="space-y-2">
          {data.map((category, index) => (
            <div key={category.name} className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="flex-1 text-sm text-gray-700">{category.name}</span>
              <span className="text-sm text-gray-500 w-20 text-right">{category.bookings} bookings</span>
              <span className="text-sm font-medium text-gray-900 w-28 text-right">
                {formatCurrency(category.value)}
              </span>
              <div className="w-24">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${category.percentage}%`, backgroundColor: category.color }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-500 w-12 text-right">{category.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Insights
        </h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">{stats.topCategory}</span> is your most-used category,
              accounting for {data[0]?.percentage}% of your total spending.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
            <p className="text-gray-600">
              You've used <span className="font-medium text-gray-900">{stats.totalCategories} different categories</span>,
              showing good service diversification.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceCategoryDistribution;
