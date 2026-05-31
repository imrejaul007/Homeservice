/**
 * ProviderPL - Provider Profit & Loss View
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ShoppingCart,
  Car,
  Zap,
  Wifi,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { formatPrice } from '../../lib/utils';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ExpenseCategory {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: Array<{ name: string; amount: number }>;
}

export interface PLData {
  /** Total revenue */
  totalRevenue: number;
  /** Total expenses */
  totalExpenses: number;
  /** Net profit */
  netProfit: number;
  /** Profit margin percentage */
  profitMargin: number;
  /** Revenue breakdown */
  revenueBreakdown: {
    bookings: number;
    tips: number;
    packages: number;
    other: number;
  };
  /** Expense breakdown by category */
  expenses: ExpenseCategory[];
  /** Monthly trend data */
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  /** Comparison with previous period */
  comparison: {
    revenueChange: number;
    expensesChange: number;
    profitChange: number;
  };
}

export interface ProviderPLProps {
  /** P&L data */
  data: PLData;
  /** Currency code */
  currency?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Callback when export is clicked */
  onExport?: () => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EXPENSE_COLORS = ['#E8B4A8', '#D4A5A0', '#C09590', '#A88580', '#8C7570', '#6B5A55', '#554540'];

const EXPENSE_CATEGORIES = [
  { id: 'supplies', name: 'Supplies & Materials', icon: ShoppingCart },
  { id: 'travel', name: 'Travel & Transport', icon: Car },
  { id: 'utilities', name: 'Utilities', icon: Zap },
  { id: 'marketing', name: 'Marketing', icon: Wifi },
  { id: 'tools', name: 'Tools & Equipment', icon: Receipt },
  { id: 'fees', name: 'Platform Fees', icon: DollarSign },
  { id: 'other', name: 'Other Expenses', icon: AlertCircle },
];

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (amount: number, currency = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// =============================================================================
// Summary Card Component
// =============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  change,
  trend,
  icon,
  color = 'coral',
}) => {
  const colorClasses: Record<string, { bg: string; icon: string }> = {
    coral: { bg: 'bg-nilin-coral/10', icon: 'text-nilin-coral' },
    success: { bg: 'bg-green-100', icon: 'text-green-600' },
    danger: { bg: 'bg-red-100', icon: 'text-red-600' },
    info: { bg: 'bg-blue-100', icon: 'text-blue-600' },
  };

  const classes = colorClasses[color] || colorClasses.coral;

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-nilin-warmGray">{title}</span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', classes.bg)}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-nilin-charcoal mb-1">{value}</p>
      {change !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs',
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-nilin-warmGray'
          )}
        >
          {trend === 'up' ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : trend === 'down' ? (
            <ArrowDownRight className="w-3 h-3" />
          ) : null}
          <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}% vs last period</span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Revenue Breakdown Component
// =============================================================================

interface RevenueBreakdownProps {
  revenue: PLData['revenueBreakdown'];
  currency?: string;
}

const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ revenue, currency = 'AED' }) => {
  const total = revenue.bookings + revenue.tips + revenue.packages + revenue.other;

  const data = [
    { name: 'Bookings', value: revenue.bookings, color: '#E8B4A8' },
    { name: 'Tips', value: revenue.tips, color: '#4CAF50' },
    { name: 'Packages', value: revenue.packages, color: '#2196F3' },
    { name: 'Other', value: revenue.other, color: '#9E9E9E' },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Revenue Breakdown</h4>

      <div className="flex items-center gap-6">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-nilin-charcoal">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-nilin-charcoal">
                  {formatCurrency(item.value, currency)}
                </span>
                <span className="text-xs text-nilin-warmGray ml-2">
                  ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Expense Breakdown Component
// =============================================================================

interface ExpenseBreakdownProps {
  expenses: ExpenseCategory[];
  currency?: string;
}

const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({ expenses, currency = 'AED' }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Expense Breakdown</h4>

      <div className="space-y-3">
        {expenses.map((expense) => (
          <div key={expense.id}>
            <button
              onClick={() => setExpandedCategory(expandedCategory === expense.id ? null : expense.id)}
              className="w-full flex items-center justify-between p-3 bg-nilin-muted/30 rounded-lg hover:bg-nilin-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: expense.color }}
                />
                <span className="text-sm font-medium text-nilin-charcoal">{expense.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-nilin-charcoal">
                  {formatCurrency(expense.amount, currency)}
                </span>
                <span className="text-xs text-nilin-warmGray w-10 text-right">
                  {expense.percentage.toFixed(0)}%
                </span>
                {expense.subcategories && (
                  expandedCategory === expense.id ? (
                    <ChevronDown className="w-4 h-4 text-nilin-warmGray" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                  )
                )}
              </div>
            </button>

            {expandedCategory === expense.id && expense.subcategories && (
              <div className="pl-6 py-2 space-y-2">
                {expense.subcategories.map((sub, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-nilin-warmGray">{sub.name}</span>
                    <span className="text-nilin-charcoal">{formatCurrency(sub.amount, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Trend Chart Component
// =============================================================================

interface TrendChartProps {
  data: PLData['monthlyData'];
  currency?: string;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, currency = 'AED' }) => {
  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Monthly Trend</h4>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4CAF50" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#4CAF50" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8B4A8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#E8B4A8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B6B6B', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B6B6B', fontSize: 12 }}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E8E4E0',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number, name: string) => [
                formatCurrency(value, currency),
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#4CAF50"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#E8B4A8"
              strokeWidth={2}
              fill="url(#expenseGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// =============================================================================
// Income Statement Component
// =============================================================================

interface IncomeStatementProps {
  data: PLData;
  currency?: string;
}

const IncomeStatement: React.FC<IncomeStatementProps> = ({ data, currency = 'AED' }) => {
  const totalRevenue = data.revenueBreakdown.bookings +
    data.revenueBreakdown.tips +
    data.revenueBreakdown.packages +
    data.revenueBreakdown.other;

  const rows = [
    {
      label: 'Service Revenue',
      value: data.revenueBreakdown.bookings,
      type: 'revenue' as const,
    },
    {
      label: 'Tips & Gratuity',
      value: data.revenueBreakdown.tips,
      type: 'revenue' as const,
    },
    {
      label: 'Package Sales',
      value: data.revenueBreakdown.packages,
      type: 'revenue' as const,
    },
    {
      label: 'Other Income',
      value: data.revenueBreakdown.other,
      type: 'revenue' as const,
    },
    { label: '', value: 0, type: 'divider' as const },
    {
      label: 'Total Revenue',
      value: totalRevenue,
      type: 'total' as const,
      color: 'text-green-600',
    },
    { label: '', value: 0, type: 'divider' as const },
    ...data.expenses.map((exp) => ({
      label: exp.name,
      value: exp.amount,
      type: 'expense' as const,
    })),
    { label: '', value: 0, type: 'divider' as const },
    {
      label: 'Total Expenses',
      value: data.totalExpenses,
      type: 'total' as const,
      color: 'text-red-600',
    },
    { label: '', value: 0, type: 'divider' as const },
    {
      label: 'Net Profit',
      value: data.netProfit,
      type: 'profit' as const,
      color: data.netProfit >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      label: 'Profit Margin',
      value: data.profitMargin,
      type: 'percentage' as const,
      color: data.profitMargin >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Income Statement</h4>

      <div className="space-y-1">
        {rows.map((row, index) => {
          if (row.type === 'divider') {
            return <div key={index} className="h-px bg-nilin-border my-2" />;
          }

          return (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between py-2',
                row.type === 'total' && 'font-semibold',
                row.type === 'profit' && 'text-lg border-t-2 border-nilin-border pt-3 mt-2'
              )}
            >
              <span
                className={cn(
                  'text-sm',
                  row.type === 'revenue' && 'text-nilin-charcoal',
                  row.type === 'expense' && 'text-nilin-warmGray',
                  row.type === 'total' && 'text-nilin-charcoal',
                  row.type === 'profit' && 'text-nilin-charcoal',
                  row.type === 'percentage' && 'text-nilin-warmGray'
                )}
              >
                {row.label}
              </span>
              <span className={cn('text-sm font-medium', ('color' in row && row.color) ? row.color : 'text-nilin-charcoal')}>
                {row.type === 'percentage'
                  ? `${row.value.toFixed(1)}%`
                  : formatCurrency(row.value, currency)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// Comparison Table Component
// =============================================================================

interface ComparisonTableProps {
  data: PLData;
  currency?: string;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ data, currency = 'AED' }) => {
  const { revenueChange, expensesChange, profitChange } = data.comparison;

  const rows = [
    { label: 'Revenue', change: revenueChange },
    { label: 'Expenses', change: expensesChange, invertColors: true },
    { label: 'Net Profit', change: profitChange },
  ];

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">
        vs Previous Period
      </h4>

      <div className="space-y-3">
        {rows.map((row) => {
          const isPositive = row.invertColors ? row.change < 0 : row.change >= 0;

          return (
            <div
              key={row.label}
              className="flex items-center justify-between p-3 bg-nilin-muted/30 rounded-lg"
            >
              <span className="text-sm text-nilin-charcoal">{row.label}</span>
              <div
                className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{row.change >= 0 ? '+' : ''}{row.change.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ProviderPL: React.FC<ProviderPLProps> = ({
  data,
  currency = 'AED',
  isLoading = false,
  onRefresh,
  onExport,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'trends'>('overview');

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Profit & Loss Statement
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Financial overview for your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Total Revenue"
          value={formatCurrency(data.totalRevenue, currency)}
          change={data.comparison.revenueChange}
          trend={data.comparison.revenueChange >= 0 ? 'up' : 'down'}
          icon={<DollarSign className="w-4 h-4" />}
          color="success"
        />
        <SummaryCard
          title="Total Expenses"
          value={formatCurrency(data.totalExpenses, currency)}
          change={data.comparison.expensesChange}
          trend={data.comparison.expensesChange <= 0 ? 'up' : 'down'}
          icon={<Receipt className="w-4 h-4" />}
          color="danger"
        />
        <SummaryCard
          title="Net Profit"
          value={formatCurrency(data.netProfit, currency)}
          change={data.comparison.profitChange}
          trend={data.comparison.profitChange >= 0 ? 'up' : 'down'}
          icon={<TrendingUp className="w-4 h-4" />}
          color={data.netProfit >= 0 ? 'success' : 'danger'}
        />
        <SummaryCard
          title="Profit Margin"
          value={`${data.profitMargin.toFixed(1)}%`}
          trend={data.profitMargin >= 0 ? 'up' : 'down'}
          icon={<BarChart3 className="w-4 h-4" />}
          color={data.profitMargin >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-nilin-border">
        {(['overview', 'detailed', 'trends'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'pb-3 px-1 text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'text-nilin-coral border-b-2 border-nilin-coral'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <IncomeStatement data={data} currency={currency} />
          <div className="space-y-6">
            <RevenueBreakdown revenue={data.revenueBreakdown} currency={currency} />
            <ComparisonTable data={data} currency={currency} />
          </div>
        </div>
      )}

      {activeTab === 'detailed' && (
        <div className="grid grid-cols-2 gap-6">
          <ExpenseBreakdown expenses={data.expenses} currency={currency} />
          <IncomeStatement data={data} currency={currency} />
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <TrendChart data={data.monthlyData} currency={currency} />
          <ComparisonTable data={data} currency={currency} />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ProviderPL;
