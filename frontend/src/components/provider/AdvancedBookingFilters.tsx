/**
 * AdvancedBookingFilters - Advanced search and filtering for bookings
 * Provider Dashboard Component
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Search,
  Filter,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  User,
  DollarSign,
  Clock,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface BookingFiltersState {
  /** Search query */
  search: string;
  /** Date range - start */
  dateFrom: string;
  /** Date range - end */
  dateTo: string;
  /** Multiple status selection */
  statuses: string[];
  /** Customer name search */
  customerName: string;
  /** Customer phone search */
  customerPhone: string;
  /** Minimum amount */
  amountMin: string;
  /** Maximum amount */
  amountMax: string;
  /** Service category filter */
  category: string;
  /** Service ID filter */
  serviceId: string;
  /** Sort by field */
  sortBy: 'scheduledDate' | 'createdAt' | 'total' | 'customerName';
  /** Sort order */
  sortOrder: 'asc' | 'desc';
}

export interface BookingFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface AdvancedBookingFiltersProps {
  /** Available filter options */
  options?: {
    statuses?: BookingFilterOption[];
    categories?: BookingFilterOption[];
    services?: BookingFilterOption[];
  };
  /** Current filter state */
  filters: BookingFiltersState;
  /** Callback when filters change */
  onFiltersChange: (filters: BookingFiltersState) => void;
  /** Callback when search is executed */
  onSearch: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Number of results */
  resultCount?: number;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Default Filter State
// =============================================================================

export const DEFAULT_FILTERS: BookingFiltersState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  statuses: [],
  customerName: '',
  customerPhone: '',
  amountMin: '',
  amountMax: '',
  category: '',
  serviceId: '',
  sortBy: 'scheduledDate',
  sortOrder: 'desc',
};

// =============================================================================
// Status Badge Component
// =============================================================================

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  no_show: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
};

interface StatusBadgeProps {
  status: string;
  selected: boolean;
  onClick: () => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, selected, onClick }) => {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const label = status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
        selected
          ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-nilin-coral`
          : `${colors.bg}/${colors.text} opacity-60 hover:opacity-100`
      )}
    >
      {selected && <Check className="w-3 h-3" />}
      {label}
    </button>
  );
};

// =============================================================================
// Date Range Picker Component
// =============================================================================

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateFrom,
  dateTo,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo, setTempTo] = useState(dateTo);

  useEffect(() => {
    setTempFrom(dateFrom);
    setTempTo(dateTo);
  }, [dateFrom, dateTo]);

  const handleApply = () => {
    onChange(tempFrom, tempTo);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('', '');
    setTempFrom('');
    setTempTo('');
    setIsOpen(false);
  };

  const presets = [
    { label: 'Today', days: 0 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'This month', days: -1 },
    { label: 'Last month', days: -2 },
  ];

  const getPresetDates = (days: number) => {
    const today = new Date();
    if (days === -1) {
      // This month
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    }
    if (days === -2) {
      // Last month
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        from: lastMonth.toISOString().split('T')[0],
        to: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0],
      };
    }
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    return {
      from: from.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
    };
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors',
          dateFrom || dateTo
            ? 'border-nilin-coral bg-nilin-blush text-nilin-coral'
            : 'border-nilin-border text-nilin-charcoal hover:border-nilin-coral/50'
        )}
      >
        <Calendar className="w-4 h-4" />
        <span className="text-sm">
          {dateFrom || dateTo ? (
            <>
              {dateFrom || '...'} - {dateTo || '...'}
            </>
          ) : (
            'Date Range'
          )}
        </span>
        {dateFrom || dateTo ? (
          <X
            className="w-4 h-4 ml-1 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-nilin-lg border border-nilin-border p-4 min-w-[320px]">
            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    const dates = getPresetDates(preset.days);
                    setTempFrom(dates.from);
                    setTempTo(dates.to);
                  }}
                  className="px-2 py-1 text-xs bg-nilin-muted rounded-md hover:bg-nilin-blush transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-nilin-warmGray mb-1">From</label>
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
              <span className="text-nilin-warmGray mt-5">-</span>
              <div className="flex-1">
                <label className="block text-xs text-nilin-warmGray mb-1">To</label>
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-sm text-nilin-warmGray hover:text-nilin-charcoal"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-sm border border-nilin-border rounded-lg hover:bg-nilin-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 text-sm bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// =============================================================================
// Amount Range Component
// =============================================================================

interface AmountRangeProps {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}

const AmountRange: React.FC<AmountRangeProps> = ({ min, max, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => onChange(e.target.value, max)}
          className="pl-8 pr-3 py-2 w-24 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
        />
      </div>
      <span className="text-nilin-warmGray">-</span>
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => onChange(min, e.target.value)}
          className="pl-8 pr-3 py-2 w-24 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
        />
      </div>
    </div>
  );
};

// =============================================================================
// Filter Summary Component
// =============================================================================

interface FilterSummaryProps {
  filters: BookingFiltersState;
  onRemove: (key: keyof BookingFiltersState, value?: string) => void;
  onClearAll: () => void;
}

const FilterSummary: React.FC<FilterSummaryProps> = ({ filters, onRemove, onClearAll }) => {
  const activeFilters: Array<{ key: keyof BookingFiltersState; label: string; value?: string }> = [];

  if (filters.search) {
    activeFilters.push({ key: 'search', label: `Search: "${filters.search}"` });
  }
  if (filters.dateFrom || filters.dateTo) {
    activeFilters.push({
      key: 'dateFrom',
      label: `Date: ${filters.dateFrom || '...'} to ${filters.dateTo || '...'}`,
    });
  }
  if (filters.statuses.length > 0) {
    activeFilters.push({
      key: 'statuses',
      label: `Status: ${filters.statuses.join(', ')}`,
    });
  }
  if (filters.customerName) {
    activeFilters.push({ key: 'customerName', label: `Customer: ${filters.customerName}` });
  }
  if (filters.customerPhone) {
    activeFilters.push({ key: 'customerPhone', label: `Phone: ${filters.customerPhone}` });
  }
  if (filters.amountMin || filters.amountMax) {
    activeFilters.push({
      key: 'amountMin',
      label: `Amount: ${filters.amountMin || '0'} - ${filters.amountMax || '...'}`,
    });
  }
  if (filters.category) {
    activeFilters.push({ key: 'category', label: `Category: ${filters.category}` });
  }
  if (filters.serviceId) {
    activeFilters.push({ key: 'serviceId', label: 'Specific service' });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {activeFilters.map((filter, index) => (
        <div
          key={`${filter.key}-${index}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nilin-coral/10 text-nilin-coral rounded-full text-sm"
        >
          <span>{filter.label}</span>
          <button
            onClick={() => onRemove(filter.key, filter.value)}
            className="hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={onClearAll}
        className="text-sm text-nilin-warmGray hover:text-red-500 transition-colors"
      >
        Clear all
      </button>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const AdvancedBookingFilters: React.FC<AdvancedBookingFiltersProps> = ({
  options = {},
  filters,
  onFiltersChange,
  onSearch,
  isLoading = false,
  resultCount,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.search);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const updateFilter = useCallback(
    <K extends keyof BookingFiltersState>(key: K, value: BookingFiltersState[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const toggleStatus = useCallback(
    (status: string) => {
      const newStatuses = filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status];
      updateFilter('statuses', newStatuses);
    },
    [filters.statuses, updateFilter]
  );

  const handleRemoveFilter = useCallback(
    (key: keyof BookingFiltersState, value?: string) => {
      if (key === 'statuses' && value) {
        updateFilter('statuses', filters.statuses.filter((s) => s !== value));
      } else if (key === 'dateFrom' || key === 'dateTo') {
        updateFilter('dateFrom', '');
        updateFilter('dateTo', '');
      } else if (key === 'amountMin' || key === 'amountMax') {
        updateFilter('amountMin', '');
        updateFilter('amountMax', '');
      } else {
        updateFilter(key, DEFAULT_FILTERS[key as keyof BookingFiltersState]);
      }
    },
    [filters, updateFilter]
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange(DEFAULT_FILTERS);
    setLocalSearch('');
  }, [onFiltersChange]);

  const handleDateRangeChange = useCallback(
    (from: string, to: string) => {
      updateFilter('dateFrom', from);
      updateFilter('dateTo', to);
    },
    [updateFilter]
  );

  const handleAmountChange = useCallback(
    (min: string, max: string) => {
      updateFilter('amountMin', min);
      updateFilter('amountMax', max);
    },
    [updateFilter]
  );

  const handleSortChange = useCallback(
    (field: BookingFiltersState['sortBy']) => {
      if (filters.sortBy === field) {
        updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        updateFilter('sortBy', field);
        updateFilter('sortOrder', 'desc');
      }
    },
    [filters.sortBy, filters.sortOrder, updateFilter]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.statuses.length > 0 ||
      filters.customerName ||
      filters.customerPhone ||
      filters.amountMin ||
      filters.amountMax ||
      filters.category ||
      filters.serviceId
    );
  }, [filters]);

  const allStatuses = options.statuses || [
    { value: 'pending', label: 'Pending', count: 0 },
    { value: 'confirmed', label: 'Confirmed', count: 0 },
    { value: 'in_progress', label: 'In Progress', count: 0 },
    { value: 'completed', label: 'Completed', count: 0 },
    { value: 'cancelled', label: 'Cancelled', count: 0 },
    { value: 'no_show', label: 'No Show', count: 0 },
  ];

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
            <Filter className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Filter Bookings
            </h3>
            {resultCount !== undefined && (
              <p className="text-sm text-nilin-warmGray">
                {resultCount.toLocaleString()} result{resultCount !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
        >
          {isExpanded ? 'Less filters' : 'More filters'}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Search Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
          <input
            type="text"
            placeholder="Search by booking ID, customer name, or notes..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-nilin-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('');
                updateFilter('search', '');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={onSearch}
          disabled={isLoading}
          className="px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </button>
      </div>

      {/* Filter Summary */}
      <FilterSummary
        filters={filters}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearAll}
      />

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-nilin-border">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Date Range
            </label>
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onChange={handleDateRangeChange}
            />
          </div>

          {/* Status Multi-select */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {allStatuses.map((status) => (
                <StatusBadge
                  key={status.value}
                  status={status.value}
                  selected={filters.statuses.includes(status.value)}
                  onClick={() => toggleStatus(status.value)}
                />
              ))}
            </div>
          </div>

          {/* Customer Search */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Customer Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                <input
                  type="text"
                  placeholder="Search by name"
                  value={filters.customerName}
                  onChange={(e) => updateFilter('customerName', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+971..."
                  value={filters.customerPhone}
                  onChange={(e) => updateFilter('customerPhone', e.target.value)}
                  className="w-full px-4 py-2 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Amount Range
            </label>
            <AmountRange
              min={filters.amountMin}
              max={filters.amountMax}
              onChange={handleAmountChange}
            />
          </div>

          {/* Category & Service */}
          {options.categories && options.categories.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="w-full px-4 py-2 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                >
                  <option value="">All Categories</option>
                  {options.categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              {options.services && options.services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Service
                  </label>
                  <select
                    value={filters.serviceId}
                    onChange={(e) => updateFilter('serviceId', e.target.value)}
                    className="w-full px-4 py-2 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  >
                    <option value="">All Services</option>
                    {options.services.map((svc) => (
                      <option key={svc.value} value={svc.value}>
                        {svc.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sort Options */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-nilin-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-nilin-warmGray">Sort by:</span>
          <div className="flex items-center gap-1">
            {(['scheduledDate', 'createdAt', 'total', 'customerName'] as const).map((field) => (
              <button
                key={field}
                onClick={() => handleSortChange(field)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors',
                  filters.sortBy === field
                    ? 'bg-nilin-coral text-white'
                    : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
                )}
              >
                {field === 'scheduledDate' && 'Date'}
                {field === 'createdAt' && 'Created'}
                {field === 'total' && 'Amount'}
                {field === 'customerName' && 'Customer'}
                {filters.sortBy === field && (
                  filters.sortOrder === 'asc' ? (
                    <ChevronUp className="inline w-3 h-3 ml-1" />
                  ) : (
                    <ChevronDown className="inline w-3 h-3 ml-1" />
                  )
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onSearch}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Active Filter Warning */}
      {hasActiveFilters && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Filters are active. Some bookings may be hidden from results.
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default AdvancedBookingFilters;
