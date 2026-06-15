import React, { useState } from 'react';
import BottomSheet from '../mobile/BottomSheet';
import { formatPrice } from '../../utils/priceConverter';

interface FilterState {
  category: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters: FilterState;
  categories: Array<{ _id: string; name: string; slug: string }>;
}

const MobileFilterSheet: React.FC<Props> = ({
  open,
  onClose,
  onApply,
  initialFilters,
  categories,
}) => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [minPriceInput, setMinPriceInput] = useState(
    initialFilters.minPrice?.toString() || ''
  );
  const [maxPriceInput, setMaxPriceInput] = useState(
    initialFilters.maxPrice?.toString() || ''
  );

  // Reset filters when opening with new initial filters
  React.useEffect(() => {
    setFilters(initialFilters);
    setMinPriceInput(initialFilters.minPrice?.toString() || '');
    setMaxPriceInput(initialFilters.maxPrice?.toString() || '');
  }, [initialFilters, open]);

  const handleApply = () => {
    onApply({
      ...filters,
      minPrice: minPriceInput ? Number(minPriceInput) : undefined,
      maxPrice: maxPriceInput ? Number(maxPriceInput) : undefined,
    });
    onClose();
  };

  const handleClearAll = () => {
    setFilters({
      category: '',
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      sortBy: 'popularity',
    });
    setMinPriceInput('');
    setMaxPriceInput('');
  };

  const hasActiveFilters =
    filters.category ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minRating ||
    filters.sortBy !== 'popularity';

  return (
    <BottomSheet
      isOpen={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex-1 px-4 py-3 text-sm font-medium text-nilin-charcoal bg-nilin-muted rounded-xl
              hover:bg-nilin-blush/50 active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
              transition-all"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-nilin-coral rounded-xl
              hover:bg-nilin-rose active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
              transition-all"
          >
            Apply Filters
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-4">
        {/* Category Filter */}
        <div>
          <h3 className="text-sm font-semibold text-nilin-charcoal mb-3">
            Category
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({ ...f, category: '' }))
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                !filters.category
                  ? 'bg-nilin-coral text-white'
                  : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50'
              }`}
            >
              All
            </button>
            {categories.slice(0, 12).map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() =>
                  setFilters((f) => ({ ...f, category: cat.slug }))
                }
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filters.category === cat.slug
                    ? 'bg-nilin-coral text-white'
                    : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range Filter */}
        <div>
          <h3 className="text-sm font-semibold text-nilin-charcoal mb-3">
            Price Range
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-nilin-lightGray mb-1 block">
                Min
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-nilin-lightGray">
                  AED
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  className="w-full pl-12 pr-3 py-3 text-sm bg-nilin-cream border border-nilin-blush/50 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral
                    transition-all"
                />
              </div>
            </div>
            <span className="text-nilin-lightGray mt-5">—</span>
            <div className="flex-1">
              <label className="text-xs text-nilin-lightGray mb-1 block">
                Max
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-nilin-lightGray">
                  AED
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  className="w-full pl-12 pr-3 py-3 text-sm bg-nilin-cream border border-nilin-blush/50 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral
                    transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Min Rating Filter */}
        <div>
          <h3 className="text-sm font-semibold text-nilin-charcoal mb-3">
            Minimum Rating
          </h3>
          <div className="flex gap-2">
            {[3, 4, 4.5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    minRating: f.minRating === rating ? undefined : rating,
                  }))
                }
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  filters.minRating === rating
                    ? 'bg-nilin-coral text-white'
                    : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50'
                }`}
              >
                {rating}+ ★
              </button>
            ))}
          </div>
        </div>

        {/* Sort By Filter */}
        <div>
          <h3 className="text-sm font-semibold text-nilin-charcoal mb-3">
            Sort By
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'popularity', label: 'Most Popular' },
              { value: 'price', label: 'Price: Low' },
              { value: 'price_desc', label: 'Price: High' },
              { value: 'rating', label: 'Highest Rated' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setFilters((f) => ({ ...f, sortBy: option.value }))
                }
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                  filters.sortBy === option.value
                    ? 'bg-nilin-coral text-white'
                    : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default MobileFilterSheet;
