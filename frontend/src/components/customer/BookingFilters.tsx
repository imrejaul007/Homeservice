/**
 * Booking Filters Component for Customer Dashboard
 * Provides comprehensive filtering options for customer bookings
 */
import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  X,
  ChevronDown,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// Types
export interface BookingFiltersState {
  search: string;
  status: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
  providerId: string | null;
  category: string | null;
  sortBy: 'scheduledDate' | 'createdAt' | 'totalAmount';
  sortOrder: 'asc' | 'desc';
}

export interface BookingFiltersProps {
  onFiltersChange: (filters: BookingFiltersState) => void;
  initialFilters?: Partial<BookingFiltersState>;
  categories?: string[];
  providers?: Array<{ _id: string; name: string }>;
  isLoading?: boolean;
  totalResults?: number;
}

type FilterPreset = {
  label: string;
  value: Partial<BookingFiltersState>;
};

const DEFAULT_FILTERS: BookingFiltersState = {
  search: '',
  status: [],
  dateRange: { start: null, end: null },
  amountRange: { min: null, max: null },
  providerId: null,
  category: null,
  sortBy: 'scheduledDate',
  sortOrder: 'desc',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
  { value: 'in_progress', label: 'In Progress', icon: Loader2, color: 'text-purple-600 bg-purple-50' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600 bg-red-50' },
  { value: 'no_show', label: 'No Show', icon: AlertCircle, color: 'text-gray-600 bg-gray-50' },
];

const PRESET_FILTERS: FilterPreset[] = [
  {
    label: 'All Time',
    value: {
      dateRange: { start: null, end: null },
    },
  },
  {
    label: 'Today',
    value: {
      dateRange: {
        start: new Date(),
        end: new Date(),
      },
    },
  },
  {
    label: 'This Week',
    value: {
      dateRange: {
        start: subDays(new Date(), 7),
        end: new Date(),
      },
    },
  },
  {
    label: 'This Month',
    value: {
      dateRange: {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
      },
    },
  },
  {
    label: 'Last 30 Days',
    value: {
      dateRange: {
        start: subDays(new Date(), 30),
        end: new Date(),
      },
    },
  },
  {
    label: 'Last 90 Days',
    value: {
      dateRange: {
        start: subDays(new Date(), 90),
        end: new Date(),
      },
    },
  },
];

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  onFiltersChange,
  initialFilters,
  categories = ['Hair', 'Makeup', 'Nails', 'Skin & Aesthetics', 'Massage & Body', 'Personal Care'],
  providers = [],
  isLoading = false,
  totalResults = 0,
}) => {
  const [filters, setFilters] = useState<BookingFiltersState>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Memoized date range presets for quick selection
  const datePresets = useMemo(() => PRESET_FILTERS, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.amountRange.min !== null || filters.amountRange.max !== null) count++;
    if (filters.providerId) count++;
    if (filters.category) count++;
    return count;
  }, [filters]);

  // Update filters and notify parent
  const updateFilters = useCallback(
    (updates: Partial<BookingFiltersState>) => {
      setFilters((prev) => {
        const newFilters = { ...prev, ...updates };
        onFiltersChange(newFilters);
        return newFilters;
      });
    },
    [onFiltersChange]
  );

  // Handle status toggle
  const toggleStatus = useCallback(
    (status: string) => {
      const newStatuses = filters.status.includes(status)
        ? filters.status.filter((s) => s !== status)
        : [...filters.status, status];
      updateFilters({ status: newStatuses });
    },
    [filters.status, updateFilters]
  );

  // Handle preset selection
  const handlePresetClick = useCallback(
    (preset: FilterPreset) => {
      setActivePreset(preset.label);
      updateFilters(preset.value);
    },
    [updateFilters]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setActivePreset(null);
    updateFilters(DEFAULT_FILTERS);
  }, [updateFilters]);

  // Reset single filter
  const clearFilter = useCallback(
    (filterKey: keyof BookingFiltersState) => {
      switch (filterKey) {
        case 'search':
          updateFilters({ search: '' });
          break;
        case 'status':
          updateFilters({ status: [] });
          break;
        case 'dateRange':
          setActivePreset(null);
          updateFilters({ dateRange: { start: null, end: null } });
          break;
        case 'amountRange':
          updateFilters({ amountRange: { min: null, max: null } });
          break;
        case 'providerId':
          updateFilters({ providerId: null });
          break;
        case 'category':
          updateFilters({ category: null });
          break;
      }
    },
    [updateFilters]
  );

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    updateFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [filters.sortOrder, updateFilters]);

  // Format date for display
  const formatDateDisplay = (date: Date | null): string => {
    if (!date) return '';
    return format(date, 'MMM dd, yyyy');
  };

  // Amount range quick presets
  const amountPresets = [
    { label: 'Any', value: { min: null, max: null } },
    { label: 'Under 200', value: { min: 0, max: 200 } },
    { label: '200-500', value: { min: 200, max: 500 } },
    { label: '500-1000', value: { min: 500, max: 1000 } },
    { label: 'Over 1000', value: { min: 1000, max: null } },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Filter className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Filter Bookings</h3>
              <p className="text-sm text-gray-500">
                {totalResults > 0 ? `${totalResults} booking${totalResults !== 1 ? 's' : ''} found` : 'No filters applied'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear all ({activeFilterCount})
              </button>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                {isExpanded ? 'Less filters' : 'More filters'}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by booking number, provider, or service..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            {filters.search && (
              <button
                onClick={() => clearFilter('search')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = filters.status.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleStatus(option.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? `${option.color} ring-2 ring-offset-1 ring-${option.color.split('-')[1]}-500`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </label>
          <div className="flex flex-wrap gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activePreset === preset.label
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
              {/* Custom Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={filters.dateRange.start ? format(filters.dateRange.start, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      setActivePreset(null);
                      updateFilters({
                        dateRange: {
                          ...filters.dateRange,
                          start: e.target.value ? new Date(e.target.value) : null,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={filters.dateRange.end ? format(filters.dateRange.end, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      setActivePreset(null);
                      updateFilters({
                        dateRange: {
                          ...filters.dateRange,
                          end: e.target.value ? new Date(e.target.value) : null,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amount Range (AED)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {amountPresets.map((preset) => {
                    const isActive =
                      filters.amountRange.min === preset.value.min &&
                      filters.amountRange.max === preset.value.max;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => updateFilters({ amountRange: preset.value })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min ?? ''}
                    onChange={(e) =>
                      updateFilters({
                        amountRange: {
                          ...filters.amountRange,
                          min: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      })
                    }
                    className="w-28 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max ?? ''}
                    onChange={(e) =>
                      updateFilters({
                        amountRange: {
                          ...filters.amountRange,
                          max: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      })
                    }
                    className="w-28 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Service Category</label>
                <select
                  value={filters.category ?? ''}
                  onChange={(e) => updateFilters({ category: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Filter */}
              {providers.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Provider</label>
                  <select
                    value={filters.providerId ?? ''}
                    onChange={(e) => updateFilters({ providerId: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Providers</option>
                    {providers.map((provider) => (
                      <option key={provider._id} value={provider._id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer with Sort Options */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value as BookingFiltersState['sortBy'] })}
              className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="scheduledDate">Scheduled Date</option>
              <option value="createdAt">Created Date</option>
              <option value="totalAmount">Amount</option>
            </select>
          </div>

          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {filters.sortOrder === 'asc' ? (
              <>
                <SortAsc className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Ascending</span>
              </>
            ) : (
              <>
                <SortDesc className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Descending</span>
              </>
            )}
          </button>
        </div>

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              {filters.search && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  Search: "{filters.search}"
                  <button onClick={() => clearFilter('search')} className="hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.status.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  Status: {filters.status.join(', ')}
                  <button onClick={() => clearFilter('status')} className="hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.dateRange.start && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                  From: {formatDateDisplay(filters.dateRange.start)}
                  <button onClick={() => clearFilter('dateRange')} className="hover:text-purple-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.dateRange.end && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                  To: {formatDateDisplay(filters.dateRange.end)}
                </span>
              )}
              {filters.amountRange.min !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                  Min: {filters.amountRange.min} AED
                  <button onClick={() => clearFilter('amountRange')} className="hover:text-green-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
                  Category: {filters.category}
                  <button onClick={() => clearFilter('category')} className="hover:text-orange-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default BookingFilters;
