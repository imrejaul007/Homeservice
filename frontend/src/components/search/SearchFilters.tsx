import React, { useState } from 'react';
import { Filter, X, MapPin, DollarSign, Star, ChevronDown } from 'lucide-react';
import { useSearchStore } from '@/store/searchStore';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface SearchFiltersProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'distance', label: 'Nearest First' },
  { value: 'newest', label: 'Newest First' },
];

const SearchFilters: React.FC<SearchFiltersProps> = ({
  className,
  isCollapsed = false,
  onToggle,
}) => {
  const { filters, setFilters, clearFilters, performSearch } = useSearchStore();
  const { categories } = useCategories();

  const [localFilters, setLocalFilters] = useState(filters);
  const [showPriceRange, setShowPriceRange] = useState(false);
  const [showRadius, setShowRadius] = useState(false);

  const hasActiveFilters = !!(
    filters.category ||
    filters.subcategory ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minRating ||
    filters.city ||
    filters.state
  );

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = {
      ...localFilters,
      [key]: value,
      page: 1, // Reset to first page when filters change
    };
    setLocalFilters(newFilters);
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    performSearch();
  };

  const handleClearFilters = () => {
    clearFilters();
    setLocalFilters(filters);
  };

  if (isCollapsed) {
    return (
      <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium">Filters</h3>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {Object.values(filters).filter(v => v !== undefined && v !== '').length} Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear All
            </button>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={localFilters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            value={localFilters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Price Range */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Price Range
            </label>
            <button
              onClick={() => setShowPriceRange(!showPriceRange)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showPriceRange ? 'Hide' : 'Show'}
            </button>
          </div>

          {showPriceRange && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  placeholder="Min price"
                  value={localFilters.minPrice || ''}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Max price"
                  value={localFilters.maxPrice || ''}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Rating Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Rating
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => handleFilterChange('minRating', rating === localFilters.minRating ? undefined : rating)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md border transition-colors',
                  localFilters.minRating === rating
                    ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                )}
              >
                <Star className="h-4 w-4" fill={localFilters.minRating === rating ? 'currentColor' : 'none'} />
                <span className="text-sm">{rating}+</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="City"
              value={localFilters.city || ''}
              onChange={(e) => handleFilterChange('city', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">
                Search Radius
              </label>
              <button
                onClick={() => setShowRadius(!showRadius)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showRadius ? 'Hide' : 'Show'}
              </button>
            </div>

            {showRadius && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={localFilters.radius || 25}
                  onChange={(e) => handleFilterChange('radius', Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 min-w-0">
                  {localFilters.radius || 25}km
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Results per page */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Results per page
          </label>
          <select
            value={localFilters.limit}
            onChange={(e) => handleFilterChange('limit', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 results</option>
            <option value={20}>20 results</option>
            <option value={50}>50 results</option>
          </select>
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApplyFilters}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors font-medium"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default SearchFilters;
