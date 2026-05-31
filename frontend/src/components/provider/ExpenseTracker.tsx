/**
 * ExpenseTracker - Expense logging and tracking
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Receipt,
  Plus,
  Edit3,
  Trash2,
  DollarSign,
  Calendar,
  Tag,
  FileText,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type ExpenseCategory =
  | 'supplies'
  | 'equipment'
  | 'transport'
  | 'marketing'
  | 'insurance'
  | 'utilities'
  | 'software'
  | 'training'
  | 'other';

export interface Expense {
  /** Unique expense ID */
  id: string;
  /** Expense description */
  description: string;
  /** Expense amount */
  amount: number;
  /** Currency code */
  currency?: string;
  /** Category */
  category: ExpenseCategory;
  /** Date */
  date: string;
  /** Receipt image URL (optional) */
  receiptUrl?: string;
  /** Notes */
  notes?: string;
  /** Tags */
  tags?: string[];
  /** Tax deductible flag */
  isTaxDeductible?: boolean;
  /** Associated service ID (optional) */
  serviceId?: string;
  /** Service name (optional) */
  serviceName?: string;
}

export interface ExpenseTrackerProps {
  /** Expenses to display */
  expenses: Expense[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when expense is added */
  onAddExpense: (expense: Partial<Expense>) => Promise<void>;
  /** Callback when expense is updated */
  onUpdateExpense: (expenseId: string, expense: Partial<Expense>) => Promise<void>;
  /** Callback when expense is deleted */
  onDeleteExpense: (expenseId: string) => Promise<void>;
  /** Callback when downloading expense report */
  onDownloadReport?: (filters?: { startDate?: string; endDate?: string; category?: ExpenseCategory }) => Promise<void>;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Category Configuration
// =============================================================================

const categoryConfig: Record<ExpenseCategory, { label: string; icon: React.ElementType; color: string }> = {
  supplies: { label: 'Supplies', icon: Receipt, color: 'text-blue-600 bg-blue-100' },
  equipment: { label: 'Equipment', icon: FileText, color: 'text-purple-600 bg-purple-100' },
  transport: { label: 'Transport', icon: TrendingUp, color: 'text-green-600 bg-green-100' },
  marketing: { label: 'Marketing', icon: Tag, color: 'text-pink-600 bg-pink-100' },
  insurance: { label: 'Insurance', icon: AlertCircle, color: 'text-amber-600 bg-amber-100' },
  utilities: { label: 'Utilities', icon: DollarSign, color: 'text-cyan-600 bg-cyan-100' },
  software: { label: 'Software', icon: FileText, color: 'text-indigo-600 bg-indigo-100' },
  training: { label: 'Training', icon: FileText, color: 'text-rose-600 bg-rose-100' },
  other: { label: 'Other', icon: Tag, color: 'text-gray-600 bg-gray-100' },
};

// =============================================================================
// Expense Form Modal
// =============================================================================

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: Partial<Expense>) => Promise<void>;
  expense?: Partial<Expense>;
  categories: ExpenseCategory[];
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  expense,
  categories,
}) => {
  const [formData, setFormData] = useState<Partial<Expense>>(
    expense || {
      description: '',
      amount: 0,
      category: 'supplies',
      date: new Date().toISOString().split('T')[0],
      isTaxDeductible: false,
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.description || !formData.amount || formData.amount <= 0) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-md w-full">
          <div className="p-6 border-b border-nilin-border">
            <h2 className="text-lg font-semibold text-nilin-charcoal">
              {expense?.id ? 'Edit Expense' : 'Add Expense'}
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Description *
              </label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                placeholder="e.g., Cleaning supplies"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Amount *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-lightGray">
                  AED
                </span>
                <input
                  type="number"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full pl-12 pr-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Category
              </label>
              <select
                value={formData.category || 'supplies'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryConfig[cat].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 resize-none"
                placeholder="Additional notes..."
              />
            </div>

            {/* Tax Deductible */}
            <label className="flex items-center gap-3 p-3 bg-nilin-muted rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isTaxDeductible || false}
                onChange={(e) => setFormData({ ...formData, isTaxDeductible: e.target.checked })}
                className="w-5 h-5 text-nilin-coral rounded focus:ring-nilin-coral"
              />
              <span className="text-sm text-nilin-charcoal">Tax deductible expense</span>
            </label>
          </div>

          <div className="p-6 border-t border-nilin-border flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.description || !formData.amount || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {expense?.id ? 'Update' : 'Add'} Expense
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Expense Item Component
// =============================================================================

interface ExpenseItemProps {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({ expense, onEdit, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const category = categoryConfig[expense.category];
  const CategoryIcon = category.icon;

  const formatCurrency = (amount: number, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-nilin-border p-4 hover:shadow-nilin-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', category.color)}>
            <CategoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-nilin-charcoal">{expense.description}</h4>
            <div className="flex items-center gap-3 mt-1 text-sm text-nilin-warmGray">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(expense.date)}
              </span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs', category.color)}>
                {category.label}
              </span>
            </div>
            {expense.notes && (
              <p className="text-xs text-nilin-lightGray mt-1 line-clamp-1">
                {expense.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-semibold text-nilin-charcoal">
              {formatCurrency(expense.amount, expense.currency)}
            </p>
            {expense.isTaxDeductible && (
              <span className="text-xs text-green-600">Tax deductible</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 text-nilin-warmGray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
  expenses,
  isLoading = false,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onDownloadReport,
  currency = 'AED',
  className,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');

  const categories: ExpenseCategory[] = ['supplies', 'equipment', 'transport', 'marketing', 'insurance', 'utilities', 'software', 'training', 'other'];

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;

    if (dateFilter === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
    } else if (dateFilter === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    return expenses.filter((expense) => {
      if (startDate && new Date(expense.date) < startDate) return false;
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          expense.description.toLowerCase().includes(query) ||
          expense.notes?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [expenses, categoryFilter, dateFilter, searchQuery]);

  // Calculate totals
  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const taxDeductibleTotal = useMemo(
    () =>
      filteredExpenses
        .filter((e) => e.isTaxDeductible)
        .reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Group by category
  const expensesByCategory = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, expense) => {
        if (!acc[expense.category]) {
          acc[expense.category] = { total: 0, count: 0 };
        }
        acc[expense.category].total += expense.amount;
        acc[expense.category].count += 1;
        return acc;
      },
      {} as Record<ExpenseCategory, { total: number; count: number }>
    );
  }, [filteredExpenses]);

  const handleSubmit = async (expenseData: Partial<Expense>) => {
    if (editingExpense) {
      await onUpdateExpense(editingExpense.id, expenseData);
    } else {
      await onAddExpense(expenseData);
    }
    setEditingExpense(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-nilin-muted rounded-xl" />
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Expense Tracker
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDownloadReport && (
            <button
              onClick={() => onDownloadReport()}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
              title="Download report"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-600">Total Expenses</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600">Tax Deductible</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(taxDeductibleTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expenses..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryConfig[cat].label}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Time</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Expense List */}
      {filteredExpenses.length > 0 ? (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              onEdit={() => setEditingExpense(expense)}
              onDelete={() => onDeleteExpense(expense.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Receipt className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No expenses found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            {expenses.length === 0
              ? 'Add your first expense to get started'
              : 'Try adjusting your filters'}
          </p>
        </div>
      )}

      {/* Form Modal */}
      <ExpenseFormModal
        isOpen={showForm || editingExpense !== null}
        onClose={() => {
          setShowForm(false);
          setEditingExpense(null);
        }}
        onSubmit={handleSubmit}
        expense={editingExpense}
        categories={categories}
      />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ExpenseTracker;
