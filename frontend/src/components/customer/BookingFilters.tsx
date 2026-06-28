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
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

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
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'in_progress', label: 'In Progress', icon: Loader2 },
  { value: 'completed', label: 'Completed', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle },
  { value: 'no_show', label: 'No Show', icon: AlertCircle },
];

const PRESET_FILTERS: FilterPreset[] = [
  { label: 'All Time', value: { dateRange: { start: null, end: null } } },
  { label: 'Today', value: { dateRange: { start: new Date(), end: new Date() } } },
  { label: 'This Week', value: { dateRange: { start: subDays(new Date(), 7), end: new Date() } } },
  { label: 'This Month', value: { dateRange: { start: startOfMonth(new Date()), end: endOfMonth(new Date()) } } },
  { label: 'Last 30 Days', value: { dateRange: { start: subDays(new Date(), 30), end: new Date() } } },
  { label: 'Last 90 Days', value: { dateRange: { start: subDays(new Date(), 90), end: new Date() } } },
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

  const datePresets = useMemo(() => PRESET_FILTERS, []);

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

  const toggleStatus = useCallback(
    (status: string) => {
      const newStatuses = filters.status.includes(status)
        ? filters.status.filter((s) => s !== status)
        : [...filters.status, status];
      updateFilters({ status: newStatuses });
    },
    [filters.status, updateFilters]
  );

  const handlePresetClick = useCallback(
    (preset: FilterPreset) => {
      setActivePreset(preset.label);
      updateFilters(preset.value);
    },
    [updateFilters]
  );

  const clearAllFilters = useCallback(() => {
    setActivePreset(null);
    updateFilters(DEFAULT_FILTERS);
  }, [updateFilters]);

  const clearFilter = useCallback(
    (filterKey: keyof BookingFiltersState) => {
      switch (filterKey) {
        case 'search': updateFilters({ search: '' }); break;
        case 'status': updateFilters({ status: [] }); break;
        case 'dateRange':
          setActivePreset(null);
          updateFilters({ dateRange: { start: null, end: null } });
          break;
        case 'amountRange': updateFilters({ amountRange: { min: null, max: null } }); break;
        case 'providerId': updateFilters({ providerId: null }); break;
        case 'category': updateFilters({ category: null }); break;
      }
    },
    [updateFilters]
  );

  const toggleSortOrder = useCallback(() => {
    updateFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [filters.sortOrder, updateFilters]);

  const formatDateDisplay = (date: Date | null): string => {
    if (!date) return '';
    return format(date, 'MMM dd, yyyy');
  };

  const amountPresets = [
    { label: 'Any', value: { min: null, max: null } },
    { label: 'Under 200', value: { min: 0, max: 200 } },
    { label: '200-500', value: { min: 200, max: 500 } },
    { label: '500-1000', value: { min: 500, max: 1000 } },
    { label: 'Over 1000', value: { min: 1000, max: null } },
  ];

  return (
    <div className="bg-white rounded-nilin shadow-nilin border border-nilin-border overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-nilin-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nilin-blush rounded-lg" aria-hidden="true">
              <Filter className="h-5 w-5 text-nilin-coral" />
            </div>
            <div>
              <h3 className="font-semibold text-nilin-charcoal">Filter Bookings</h3>
              <p className="text-sm text-nilin-warmGray">
                {totalResults > 0 ? `${totalResults} booking${totalResults !== 1 ? 's' : ''} found` : 'No filters applied'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-nilin-warmGray hover:text-nilin-error transition-colors"
              >
                Clear all ({activeFilterCount})
              </button>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="expanded-filters"
              className="flex items-center gap-2 px-3 py-1.5 bg-nilin-muted hover:bg-nilin-blush rounded-nilin transition-colors focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <span className="text-sm font-medium text-nilin-charcoal">
                {isExpanded ? 'Less filters' : 'More filters'}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-nilin-warmGray transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
            <input
              type="text"
              placeholder="Search by booking number, provider, or service..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-shadow"
            />
            {filters.search && (
              <button
                onClick={() => clearFilter('search')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-nilin-muted rounded"
              >
                <X className="h-4 w-4 text-nilin-warmGray" />
              </button>
            )}
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-4">
          <label className="text-sm font-medium text-nilin-charcoal mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = filters.status.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleStatus(option.value)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-nilin-coral text-white shadow-nilin-warm'
                      : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
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
          <label className="text-sm font-medium text-nilin-charcoal mb-2 block flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </label>
          <div className="flex flex-wrap gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={`px-3 py-1.5 rounded-nilin text-sm font-medium transition-colors ${
                  activePreset === preset.label
                    ? 'bg-nilin-coral text-white shadow-nilin-warm'
                    : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
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
            id="expanded-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-nilin-border bg-nilin-muted space-y-4">
              {/* Custom Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date-start" className="text-sm font-medium text-nilin-charcoal mb-1 block">Start Date</label>
                  <input
                    id="date-start"
                    type="date"
                    value={filters.dateRange.start ? format(filters.dateRange.start, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      setActivePreset(null);
                      updateFilters({
                        dateRange: { ...filters.dateRange, start: e.target.value ? new Date(e.target.value) : null },
                      });
                    }}
                    className="w-full px-3 py-2 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                  />
                </div>
                <div>
                  <label htmlFor="date-end" className="text-sm font-medium text-nilin-charcoal mb-1 block">End Date</label>
                  <input
                    id="date-end"
                    type="date"
                    value={filters.dateRange.end ? format(filters.dateRange.end, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      setActivePreset(null);
                      updateFilters({
                        dateRange: { ...filters.dateRange, end: e.target.value ? new Date(e.target.value) : null },
                      });
                    }}
                    className="w-full px-3 py-2 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <label className="text-sm font-medium text-nilin-charcoal mb-1 block flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amount Range (AED)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {amountPresets.map((preset) => {
                    const isActive = filters.amountRange.min === preset.value.min && filters.amountRange.max === preset.value.max;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => updateFilters({ amountRange: preset.value })}
                        className={`px-3 py-1.5 rounded-nilin text-sm font-medium transition-colors ${
                          isActive ? 'bg-nilin-success text-white' : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="amount-min"
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min ?? ''}
                    onChange={(e) => updateFilters({ amountRange: { ...filters.amountRange, min: e.target.value ? parseFloat(e.target.value) : null } })}
                    className="w-28 px-3 py-2 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                  />
                  <span className="text-nilin-warmGray">to</span>
                  <input
                    id="amount-max"
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max ?? ''}
                    onChange={(e) => updateFilters({ amountRange: { ...filters.amountRange, max: e.target.value ? parseFloat(e.target.value) : null } })}
                    className="w-28 px-3 py-2 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label htmlFor="category-filter" className="text-sm font-medium text-nilin-charcoal mb-1 block">Service Category</label>
                <select
                  id="category-filter"
                  value={filters.category ?? ''}
                  onChange={(e) => updateFilters({ category: e.target.value || null })}
                  className="w-full px-3 py-2 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {/* Provider Filter */}
              {providers.length > 0 && (
                <div>
                  <label htmlFor="provider-filter" className="text-sm font-medium text-nilin-charcoal mb-1 block">Provider</label>
                  <select
                    id="provider-filter"
                    value={filters.providerId ?? ''}
                    onChange={(e) => updateFilters({ providerId: e.target.value || null })}
                    className="w-full px-3 py-2 border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                  >
                    <option value="">All Providers</option>
                    {providers.map((provider) => <option key={provider._id} value={provider._id}>{provider.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer with Sort Options */}
      <div className="px-4 py-3 border-t border-nilin-border bg-nilin-muted">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-nilin-warmGray" aria-hidden="true" />
            <span className="text-sm text-nilin-warmGray">Sort by:</span>
            <select
              id="sort-by"
              value={filters.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value as BookingFiltersState['sortBy'] })}
              className="px-2 py-1 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
            >
              <option value="scheduledDate">Scheduled Date</option>
              <option value="createdAt">Created Date</option>
              <option value="totalAmount">Amount</option>
            </select>
          </div>

          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-nilin-muted hover:bg-nilin-blush rounded-nilin transition-colors focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
          >
            {filters.sortOrder === 'asc' ? (
              <>
                <SortAsc className="h-4 w-4 text-nilin-charcoal" aria-hidden="true" />
                <span className="text-sm font-medium text-nilin-charcoal">Ascending</span>
              </>
            ) : (
              <>
                <SortDesc className="h-4 w-4 text-nilin-charcoal" aria-hidden="true" />
                <span className="text-sm font-medium text-nilin-charcoal">Descending</span>
              </>
            )}
          </button>
        </div>

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="mt-3 pt-3 border-t border-nilin-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-nilin-warmGray">Active filters:</span>
              {filters.search && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-nilin-blush text-nilin-charcoal rounded text-xs">
                  Search: "{filters.search}"
                  <button onClick={() => clearFilter('search')} aria-label={`Clear search: ${filters.search}`} className="hover:text-nilin-error">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.status.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-nilin-blush text-nilin-charcoal rounded text-xs">
                  Status: {filters.status.join(', ')}
                  <button onClick={() => clearFilter('status')} aria-label="Clear status filter" className="hover:text-nilin-error">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.dateRange.start && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-nilin-blush text-nilin-charcoal rounded text-xs">
                  From: {formatDateDisplay(filters.dateRange.start)}
                  <button onClick={() => clearFilter('dateRange')} aria-label="Clear date range filter" className="hover:text-nilin-error">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.dateRange.end && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-nilin-blush text-nilin-charcoal rounded text-xs">
                  To: {formatDateDisplay(filters.dateRange.end)}
                </span>
              )}
              {filters.amountRange.min !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-nilin-blush text-nilin-charcoal rounded text-xs">
                  Min: {filters.amountRange.min} AED
                  <button onClick={() => clearFilter('amountRange')} aria-label="Clear amount filter" className="hover:text-nilin-error">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-nilin-blush text-nilin-charcoal rounded text-xs">
                  Category: {filters.category}
                  <button onClick={() => clearFilter('category')} aria-label="Clear category filter" className="hover:text-nilin-error">
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
        <div role="status" aria-live="polite" className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-nilin-coral animate-spin" />
        </div>
      )}
    </div>
  );
};

export default BookingFilters;
