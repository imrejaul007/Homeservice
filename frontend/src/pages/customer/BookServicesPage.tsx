import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { showDeduplicatedError } from '../../utils/toastUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Sparkles,
  Grid3X3,
  ChevronRight,
  Zap,
  Filter,
  Map as MapIcon,
  LayoutGrid,
  LayoutList,
  X,
  AlertCircle,
  Share2,
  List,
  CheckSquare,
  Square,
  GitCompare,
  Clock,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Star,
  Heart,
  Eye
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import CustomerHubNav from '../../components/customer/CustomerHubNav';
import Breadcrumb from '../../components/common/Breadcrumb';
import Pagination from '../../components/common/Pagination';
import ServiceCard from '../../components/customer/ServiceCard';
import ServiceQuickViewModal from '../../components/customer/ServiceQuickViewModal';
import type { Service } from '../../types/service';
import type { Suggestion } from '../../types/search';
import { useCategories } from '../../hooks/useCategories';
import { searchApi } from '../../services/searchApi';
import { CATEGORY_IMAGES } from '../../constants/images';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import ComparisonBar from '../../components/search/ComparisonBar';
import LazyMapView from '../../components/search/LazyMapView';
import { useSavedSearchStore } from '../../stores/savedSearchStore';
import { useRecentlyViewedStore } from '../../stores/recentlyViewedStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { formatPrice } from '../../utils/priceConverter';
import toast from 'react-hot-toast';
import MobileFilterSheet from '../../components/customer/MobileFilterSheet';

// N40: Extract magic numbers to constants
const DEFAULT_LIMIT = 12;
const DEBOUNCE_DELAY = 300;
const MAX_CATEGORY_DISPLAY = 12;  // N44: Max categories to show in grid
const MAX_CATEGORY_CHIPS = 10;    // N45: Max category chips in filter bar
const PRICE_SUFFIX = '/ service'; // N43: Price suffix constant
const SEARCH_TERMS = ['Haircut', 'Massage', 'Facial', 'Manicure'];

// N46: Helper to format showing range
const formatShowingRange = (page: number, limit: number, total: number): string => {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return `Showing ${start}-${end} of ${total} services`;
};

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const DEFAULT_PAGINATION: PaginationState = { page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 0 };

// ============================================
// CATEGORY CARD COMPONENT
// ============================================
interface CategoryCardProps {
  name: string;
  slug: string;
  image: string;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ name, slug, image }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/category/${slug}`)}
      aria-label={`Browse ${name} category`}
      className="group relative flex flex-col items-center p-5 rounded-nilin-lg bg-nilin-surface border border-nilin-blush/40 shadow-nilin-sm overflow-hidden
        transition-all duration-300 ease-out
        hover:shadow-nilin hover:border-nilin-coral hover:-translate-y-1
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
        active:scale-[0.98]
        motion-reduce:transition-none motion-reduce:hover:transform-none"
    >
      {/* Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-nilin-blush/40 via-nilin-cream to-nilin-peach/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Image Container */}
      <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-nilin overflow-hidden ring-2 ring-nilin-blush group-hover:ring-nilin-coral transition-all duration-300 shadow-nilin-sm">
        <img
          src={image}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* Category Name */}
      <span className="relative mt-3 text-sm font-semibold text-nilin-charcoal group-hover:text-nilin-rose transition-colors text-center leading-tight">
        {name}
      </span>

      {/* Arrow indicator */}
      <ChevronRight
        className="absolute bottom-3 right-3 w-4 h-4 text-nilin-lightGray group-hover:text-nilin-coral group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
};

// ============================================
// CATEGORY CHIPS COMPONENT
// ============================================
interface CategoryChipsProps {
  categories: { name: string; slug: string }[];
  activeCategory: string;
  onSelect: (slug: string) => void;
  onClear: () => void;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({ categories, activeCategory, onSelect, onClear }) => {
  return (
    <div className="relative flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-nilin-cream to-transparent z-10 pointer-events-none" aria-hidden="true" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-nilin-cream to-transparent z-10 pointer-events-none" aria-hidden="true" />
      {/* "All" chip - resets category */}
      <button
        type="button"
        onClick={onClear}
        aria-pressed={!activeCategory}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !activeCategory
            ? 'bg-nilin-coral text-white shadow-nilin-sm'
            : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50 hover:text-nilin-rose'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
      >
        All
      </button>

      {/* Category chips */}
      {categories.slice(0, MAX_CATEGORY_CHIPS).map((cat) => (
        <button
          key={cat.slug}
          type="button"
          onClick={() => onSelect(cat.slug)}
          aria-pressed={activeCategory === cat.slug}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === cat.slug
              ? 'bg-nilin-coral text-white shadow-nilin-sm'
              : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50 hover:text-nilin-rose'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

// ============================================
// SKELETON COMPONENTS
// ============================================
// Premium shimmer skeleton with NILIN brand colors
const shimmerClass = 'bg-gradient-to-r from-nilin-blush via-nilin-peach/50 to-nilin-blush bg-[length:200%_100%] animate-nilin-shimmer';

const CategorySkeleton = () => (
  <div className="flex flex-col items-center p-5 rounded-nilin-lg bg-nilin-surface border border-nilin-blush/40">
    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-nilin ${shimmerClass}`} />
    <div className={`mt-3 w-16 h-4 rounded-nilin ${shimmerClass}`} />
  </div>
);

const ServiceSkeleton = () => (
  <div className="bg-nilin-surface rounded-nilin-lg border border-nilin-blush/40 overflow-hidden">
    <div className={`h-40 ${shimmerClass}`} />
    <div className="p-4">
      <div className={`w-16 h-4 rounded-nilin mb-2 ${shimmerClass}`} />
      <div className={`w-3/4 h-5 rounded-nilin mb-3 ${shimmerClass}`} />
      <div className="flex gap-3 mb-3">
        <div className={`w-20 h-3 rounded-nilin ${shimmerClass}`} />
        <div className={`w-24 h-3 rounded-nilin ${shimmerClass}`} />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-nilin-blush/30">
        <div className={`w-20 h-6 rounded-nilin ${shimmerClass}`} />
        <div className={`w-16 h-8 rounded-nilin ${shimmerClass}`} />
      </div>
    </div>
  </div>
);

// ============================================
// SERVICE LIST ITEM COMPONENT
// ============================================
interface ServiceListItemProps {
  service: Service;
  onBookNow: (service: Service) => void;
  onQuickView?: (service: Service) => void;
  onClick: () => void;
  showCheckbox?: boolean;
  checked?: boolean;
  onCheck?: (id: string) => void;
  isFavorited?: boolean;
  onFavorite?: () => void;
}

const ServiceListItem: React.FC<ServiceListItemProps> = ({
  service,
  onBookNow,
  onQuickView,
  onClick,
  showCheckbox,
  checked,
  onCheck,
  isFavorited,
  onFavorite,
}) => {
  const getPrice = () => {
    if (typeof service.price === 'number') return service.price;
    return service.price?.amount || 0;
  };

  const getCurrency = () => {
    if (typeof service.price === 'object') return service.price?.currency || 'AED';
    return 'AED';
  };

  return (
    <article
      aria-label={`Service: ${service.name}, Price: ${formatPrice(getPrice(), getCurrency())}`}
      className="group relative flex gap-4 p-4 bg-nilin-surface rounded-nilin-lg border border-nilin-blush/40
        hover:shadow-nilin hover:border-nilin-coral/30 transition-all duration-300
        focus-within:ring-2 focus-within:ring-nilin-coral/50 focus-within:border-nilin-coral"
    >
      {/* Checkbox for bulk select */}
      {showCheckbox && onCheck && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCheck(service._id); }}
            aria-label={checked ? 'Deselect service' : 'Select service'}
            className={`w-9 h-9 flex items-center justify-center rounded-nilin border-2 transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
              active:scale-95
              ${checked
                ? 'bg-nilin-coral border-nilin-coral text-white'
                : 'border-nilin-blush hover:border-nilin-coral bg-white'
              }`}
          >
            {checked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Service Image */}
      <button
        type="button"
        onClick={onClick}
        className="relative flex-shrink-0 w-32 h-32 rounded-nilin overflow-hidden bg-nilin-blush/30
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
        aria-label={`View details for ${service.name}`}
      >
        {service.images && service.images.length > 0 ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-nilin-blush to-nilin-peach/50">
            <Clock className="w-10 h-10 text-nilin-lightGray" />
          </div>
        )}
        {service.isFeatured && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold bg-nilin-coral text-white rounded-full shadow-sm">
            Featured
          </span>
        )}
      </button>

      {/* Service Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          {/* Category Badge */}
          {service.category && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-nilin-coral bg-nilin-blush/50 rounded-nilin mb-1">
              {service.category}
            </span>
          )}

          {/* Service Name */}
          <button
            type="button"
            onClick={onClick}
            className="block text-left w-full focus-visible:outline-none"
          >
            <h3 className="text-base font-semibold text-nilin-charcoal group-hover:text-nilin-coral transition-colors line-clamp-1">
              {service.name}
            </h3>
          </button>

          {/* Short Description */}
          {service.shortDescription && (
            <p className="mt-1 text-sm text-nilin-warmGray line-clamp-2">
              {service.shortDescription}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 mt-2">
          {/* Rating */}
          {service.rating && service.rating.average > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" aria-hidden="true" />
              <span className="text-sm font-medium text-nilin-charcoal">{service.rating.average.toFixed(1)}</span>
              <span className="text-xs text-nilin-lightGray">({service.rating.count})</span>
            </div>
          )}

          {/* Duration */}
          {service.duration && (
            <div className="flex items-center gap-1 text-sm text-nilin-warmGray">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>{service.duration} min</span>
            </div>
          )}

          {/* Provider */}
          {service.provider && (
            <div className="flex items-center gap-1.5 text-sm text-nilin-warmGray">
              <span className="truncate max-w-[120px]">{service.provider.businessName || service.provider.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Price and Actions */}
      <div className="flex flex-col items-end justify-between py-1">
        {/* Price */}
        <div className="text-right">
          <p className="text-lg font-bold text-nilin-coral">
            {formatPrice(getPrice(), getCurrency())}
          </p>
          <p className="text-xs text-nilin-lightGray">{PRICE_SUFFIX}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-2">
          {/* Favorite Button */}
          {onFavorite && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFavorite(); }}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              className={`w-9 h-9 flex items-center justify-center rounded-nilin transition-all
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                active:scale-95
                ${isFavorited
                  ? 'bg-nilin-rose/10 text-nilin-rose'
                  : 'bg-nilin-muted text-nilin-warmGray hover:text-nilin-rose hover:bg-nilin-rose/10'
                }`}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-nilin-rose' : ''}`} />
            </button>
          )}

          {/* Quick View Button */}
          {onQuickView && (
            <button
              type="button"
              onClick={() => onQuickView(service)}
              aria-label="Quick view"
              className="w-9 h-9 flex items-center justify-center rounded-nilin bg-nilin-muted text-nilin-warmGray
                hover:bg-nilin-blush/50 hover:text-nilin-coral transition-all
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                active:scale-95"
            >
              <Eye className="w-5 h-5" />
            </button>
          )}

          {/* Book Now Button */}
          <button
            type="button"
            onClick={() => onBookNow(service)}
            aria-label={`Book ${service.name}`}
            className="px-5 py-2 bg-nilin-coral text-white text-sm font-semibold rounded-nilin
              hover:bg-nilin-rose hover:shadow-nilin transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
              active:scale-95"
          >
            Book Now
          </button>
        </div>
      </div>
    </article>
  );
};

// ============================================
// MAIN PAGE COMPONENT
// ============================================
const BookServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const controllerRef = React.useRef<AbortController | null>(null);
  const [popularServices, setPopularServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'map' | 'list'>('grid');
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [quickViewService, setQuickViewService] = useState<Service | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);

  // Bulk select mode state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterLoading, setFilterLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionAbortControllerRef = useRef<AbortController | null>(null);
  const debounceValueRef = useRef<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search metadata state (for Did You Mean)
  const [searchMetadata, setSearchMetadata] = useState<{
    didYouMean?: string[];
    correctionApplied?: boolean;
    suggestions?: string[];
  } | null>(null);

  // Toast deduplication ref
  const lastToastTime = useRef<number>(0);
  const TOAST_COOLDOWN = 5000; // 5 seconds cooldown between toasts

  // Comparison store for bulk add
  const addToComparison = useComparisonStore((s) => s.addService);
  const comparisonItems = useComparisonStore((s) => s.items);

  // Toggle bulk select mode
  const toggleBulkMode = () => {
    if (bulkMode) {
      // Exiting bulk mode - clear selection
      setSelectedIds(new Set());
    }
    setBulkMode(!bulkMode);
  };

  // Toggle individual service selection
  const toggleSelect = (serviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  // Select all services on current page
  const selectAll = () => {
    setSelectedIds(new Set(popularServices.map((s) => s._id)));
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk add selected services to comparison
  const bulkAddToComparison = () => {
    let added = 0;
    let skipped = 0;
    popularServices.forEach((service) => {
      if (selectedIds.has(service._id)) {
        const success = addToComparison(service);
        if (success) added++;
        else skipped++;
      }
    });
    if (added > 0) {
      showSuccessToast(`Added ${added} service${added > 1 ? 's' : ''} to comparison`);
    }
    if (skipped > 0) {
      showDeduplicatedError(`${skipped} service${skipped > 1 ? 's' : ''} could not be added (limit reached or already in comparison)`);
    }
    // Exit bulk mode after adding
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  // Infinite scroll state
  const [paginationMode, setPaginationMode] = useState<'pagination' | 'infinite'>('pagination');
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreInProgress = useRef(false);

  // Get page from URL params (default to 1)
  const pageParam = searchParams.get('page');
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const sortBy = searchParams.get('sortBy') || 'popularity';

  // Category filter state
  const activeCategory = searchParams.get('category') || '';

  // Price and Rating filter state (read from URL)
  const minPrice = useMemo(() => searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined, [searchParams]);
  const maxPrice = useMemo(() => searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined, [searchParams]);
  const minRating = useMemo(() => searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined, [searchParams]);

  // Active filter count for badge (sortBy is not a filter, only category/price/rating)
  const activeFilterCount = useMemo(() => [
    searchParams.get('category'),
    searchParams.get('minPrice'),
    searchParams.get('maxPrice'),
    searchParams.get('minRating'),
  ].filter(Boolean).length, [searchParams]);

  // Debounced search input handler with suggestions
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    setHighlightedIndex(-1);

    // Store current value for use in debounce
    debounceValueRef.current = value;

    // Debounced fetch suggestions
    if (value.length >= 2) {
      setShowSuggestions(true);
      setSuggestionsLoading(true);

      // Cancel previous request
      suggestionAbortControllerRef.current?.abort();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Effect to handle debounced API calls
  useEffect(() => {
    const value = debounceValueRef.current;
    if (!value || value.length < 2) return;

    const timeoutId = setTimeout(async () => {
      try {
        const controller = new AbortController();
        suggestionAbortControllerRef.current = controller;
        const response = await searchApi.getSearchSuggestions(value, 5, controller.signal);
        if (response.success && response.data?.suggestions) {
          setSuggestions(response.data.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          showDeduplicatedError('Failed to fetch suggestions');
        }
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: Suggestion) => {
    setSearchInput(suggestion.text);
    setShowSuggestions(false);
    setSuggestions([]);
    // Submit search with selected suggestion
    const sanitized = suggestion.text.trim().replace(/[<>'"]/g, '');
    if (sanitized) {
      setSearchParams({ q: sanitized });
    }
  };

  // Handle keyboard navigation in suggestions
  const handleSuggestionKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const { categories, isLoading: categoriesLoading } = useCategories();
  // Saved searches state
  const savedSearches = useSavedSearchStore((s) => s.searches);
  const { addSearch, removeSearch } = useSavedSearchStore();

  // Recently viewed state
  const { viewed, addViewed, clearViewed } = useRecentlyViewedStore();

  // Favorites state
  const { items: favorites, toggleFavorite } = useFavoritesStore();

  // Trending searches state
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);

  // Fetch trending searches on mount
  React.useEffect(() => {
    searchApi.getTrendingSearches(5)
      .then((response: any) => {
        if (Array.isArray(response)) {
          setTrendingSearches(response.slice(0, 5).map((t: any) => t.term));
        }
      })
      .catch(() => showDeduplicatedError('Failed to fetch trending services'));
  }, []);

  // Price range filter handler
  const handlePriceRangeChange = (min: number | undefined, max: number | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (min) next.set('minPrice', String(min));
    else next.delete('minPrice');
    if (max) next.set('maxPrice', String(max));
    else next.delete('maxPrice');
    next.delete('page');
    setSearchParams(next);
  };

  // Min rating filter handler
  const handleMinRatingChange = (rating: number | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (rating) next.set('minRating', String(rating));
    else next.delete('minRating');
    next.delete('page');
    setSearchParams(next);
  };

  // Clear all filters handler
  const handleClearAllFilters = () => {
    // Keep only search query, clear all other filters
    const q = searchParams.get('q');
    if (q) {
      setSearchParams({ q });
    } else {
      setSearchParams({});
    }
  };

  const fetchPopularServices = useCallback(async (page: number) => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      // Always use searchApi.searchServices to get pagination metadata
      const currentSortBy = searchParams.get('sortBy') || 'popularity';
      const response = await searchApi.searchServices({
        q: searchParams.get('q') || undefined,
        category: searchParams.get('category') || undefined,
        minPrice: minPrice,
        maxPrice: maxPrice,
        minRating: minRating,
        sortBy: currentSortBy as 'popularity' | 'price' | 'price_desc' | 'rating' | 'newest' | 'distance',
        page,
        limit: DEFAULT_LIMIT,
      });
      if (response.success && response.data.services) {
        setPopularServices(response.data.services as Service[]);
        // Update pagination state from response
        if (response.data.pagination) {
          setPagination({
            page: response.data.pagination.page,
            limit: response.data.pagination.limit,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
          });
        }
        // Update search metadata for Did You Mean
        if (response.data.searchMetadata) {
          setSearchMetadata({
            didYouMean: response.data.searchMetadata.didYouMean,
            correctionApplied: response.data.searchMetadata.correctionApplied,
            suggestions: response.data.searchMetadata.suggestions,
          });
        } else {
          setSearchMetadata(null);
        }
      } else {
        setPopularServices([]);
        setPagination(DEFAULT_PAGINATION);
        setSearchMetadata(null);
      }
    } catch (err) {
      // Ignore abort errors - they are expected when component unmounts or effect re-runs
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      showDeduplicatedError('Failed to load services', err instanceof Error ? err.message : 'Please try again');
      // Check for network errors including offline state
      const isNetworkError = !navigator.onLine || !err.response ||
        err.message?.includes('NetworkError') ||
        err.code === 'ECONNREFUSED';
      const status = err.response?.status;
      if (isNetworkError) {
        setServicesError('No internet connection. Check your network and try again.');
      } else if (status === 401) {
        setServicesError('Session expired. Please log in again.');
      } else if (status === 403) {
        setServicesError('You do not have permission to view this content.');
      } else if (status === 404) {
        setServicesError('Services not found.');
      } else if (status === 429) {
        setServicesError('Too many requests. Please wait a moment and try again.');
      } else if (status === 500) {
        setServicesError('Server error. Please try again.');
      } else {
        setServicesError('Could not load services. Please try again.');
      }
      setPopularServices([]);
      setPagination(DEFAULT_PAGINATION);
    } finally {
      setServicesLoading(false);
    }
  }, [searchParams, minPrice, maxPrice, minRating]);

  // Retry fetch with exponential backoff
  const retryFetch = useCallback(async (fn: () => Promise<void>, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fn();
        return;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500));
      }
    }
  }, []);

  // Success toast deduplication helper
  const showSuccessToast = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastToastTime.current < TOAST_COOLDOWN) return;
    lastToastTime.current = now;
    toast.success(message);
  }, []);

  // Fetch services when page changes
  useEffect(() => {
    // Create new controller first, then abort old one
    const newController = new AbortController();
    const oldController = controllerRef.current;
    controllerRef.current = newController;

    fetchPopularServices(currentPage)
      .then(() => {
        // Success - no action needed
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, ignore
          return;
        }
        // Page fallback to 1 should retry fetching page 1
        if (currentPage > 1) {
          retryFetch(() => fetchPopularServices(currentPage))
            .then(() => {
              // Successfully retried, update URL
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('page', '1');
                return next;
              });
              showDeduplicatedError('Failed to load page. Showing page 1.');
            })
            .catch(() => {
              // Still failed after retry, show error
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('page', '1');
                return next;
              });
              showDeduplicatedError('Failed to load page. Showing page 1.');
            });
        }
      })
      .finally(() => {
        // Clean up abort controller if component unmounts
        if (newController.signal.aborted) {
          return;
        }
      });

    // Abort the old controller after creating the new one
    oldController?.abort();

    return () => {
      if (!newController.signal.aborted) {
        newController.abort();
      }
    };
  }, [fetchPopularServices, currentPage, retryFetch]);

  // Navigation guard for unsaved filter changes
  useEffect(() => {
    const hasFilters = searchParams.toString().length > 0;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasFilters) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = searchInput.trim().replace(/[<>'"]/g, '');
    setSearchLoading(true);
    // Reset to page 1 when search changes
    if (sanitized) {
      setSearchParams({ q: sanitized });
    } else {
      setSearchParams({});
    }
    // Reset loading state after a short delay (servicesLoading will handle actual state)
    setTimeout(() => setSearchLoading(false), 500);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      // Update URL with new page
      const currentParams = Object.fromEntries(searchParams.entries());
      if (newPage === 1) {
        // Remove page param when on first page
        delete currentParams.page;
      } else {
        currentParams.page = String(newPage);
      }
      setSearchParams(currentParams);
      // Scroll to top of services section
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Move focus to results section for accessibility
      const resultsSection = document.getElementById('services-results');
      resultsSection?.focus();
    }
  };

  const handleSortChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'popularity') {
      next.delete('sortBy');
    } else {
      next.set('sortBy', value);
    }
    next.delete('page'); // Reset to page 1
    setSearchParams(next);
  };

  const handleBookNow = (service: Service) => {
    const serviceId = service._id;
    if (serviceId) {
      navigate(`/book/${serviceId}`, { state: { service } });
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  // Category filter handlers
  const handleCategorySelect = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug === activeCategory) {
      // Clicking the same chip deselects it
      next.delete('category');
    } else {
      next.set('category', slug);
    }
    next.delete('page'); // Reset to page 1
    setSearchParams(next);
  };

  const handleClearCategory = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    next.delete('page');
    setSearchParams(next);
  };

  // Handle mobile filter sheet apply
  const handleMobileFiltersApply = (filters: {
    category: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sortBy: string;
  }) => {
    const next = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) next.set('q', q);
    if (filters.category) next.set('category', filters.category);
    if (filters.minPrice) next.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) next.set('maxPrice', String(filters.maxPrice));
    if (filters.minRating) next.set('minRating', String(filters.minRating));
    if (filters.sortBy && filters.sortBy !== 'popularity') next.set('sortBy', filters.sortBy);
    setSearchParams(next);
  };

  const handleSaveSearch = () => {
    const query = searchParams.get('q') || '';
    const filters = {
      category: searchParams.get('category') || undefined,
      minPrice: minPrice,
      maxPrice: maxPrice,
      minRating: minRating,
      sortBy: searchParams.get('sortBy') || undefined,
    };
    const existing = useSavedSearchStore.getState().searches;
    const exists = existing.some(s => s.query === query && JSON.stringify(s.filters) === JSON.stringify(filters));
    if (exists) {
      toast('Search already saved');
      return;
    }
    addSearch({ query, filters });
    showSuccessToast('Search saved!');
  };

  // Restore a saved search
  const handleRestoreSearch = (search: typeof savedSearches[0]) => {
    const next = new URLSearchParams();
    if (search.query) next.set('q', search.query);
    if (search.filters.category) next.set('category', search.filters.category);
    if (search.filters.minPrice) next.set('minPrice', String(search.filters.minPrice));
    if (search.filters.maxPrice) next.set('maxPrice', String(search.filters.maxPrice));
    if (search.filters.minRating) next.set('minRating', String(search.filters.minRating));
    if (search.filters.sortBy && search.filters.sortBy !== 'popularity') next.set('sortBy', search.filters.sortBy);
    setSearchParams(next);
    setSearchInput(search.query || '');
    setShowSavedSearches(false);
    showSuccessToast('Search restored!');
  };

  // Delete a saved search
  const handleDeleteSearch = (searchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSearch(searchId);
    showSuccessToast('Search removed');
  };

  const handleShare = async () => {
    const url = window.location.origin + '/book-services?' + searchParams.toString();
    if (navigator.share) {
      await navigator.share({ title: 'Book Services', url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showSuccessToast('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNotifyMe = (service: Service) => {
    showSuccessToast('We\'ll notify you when this service becomes available');
  };

  // Load more services for infinite scroll
  const loadMore = useCallback(async () => {
    // Request deduplication
    if (loadMoreInProgress.current || !hasMore) return;

    // Page boundary check
    if (pagination.page >= pagination.pages) {
      setHasMore(false);
      return;
    }

    loadMoreInProgress.current = true;
    setInfiniteLoading(true);
    const nextPage = pagination.page + 1;

    try {
      const currentSortBy = searchParams.get('sortBy') || 'popularity';
      const response = await searchApi.searchServices({
        q: searchParams.get('q') || undefined,
        category: searchParams.get('category') || undefined,
        minPrice: minPrice,
        maxPrice: maxPrice,
        minRating: minRating,
        sortBy: currentSortBy as 'popularity' | 'price' | 'price_desc' | 'rating' | 'newest' | 'distance',
        page: nextPage,
        limit: DEFAULT_LIMIT,
      });

      if (response.success && response.data.services) {
        setPopularServices(prev => [...prev, ...(response.data.services as Service[])]);
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            page: response.data.pagination.page,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
          }));
          setHasMore(response.data.pagination.page < response.data.pagination.pages);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      showDeduplicatedError('Failed to load more services', err instanceof Error ? err.message : 'Please try again');
      // Check for network errors
      const isNetworkError = !navigator.onLine || !err.response ||
        err.message?.includes('NetworkError') ||
        err.code === 'ECONNREFUSED';
      const status = err.response?.status;

      if (isNetworkError) {
        showDeduplicatedError('Connection error', 'Check your network and try again');
      } else if (status === 429) {
        showDeduplicatedError('Too many requests', 'Please wait a moment');
      } else if (status === 500) {
        showDeduplicatedError('Server error', 'Please try again');
      }
      // Retry once for transient errors
      if (status === 0 || (status && status >= 500)) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const response = await searchApi.searchServices({
            q: searchParams.get('q') || undefined,
            category: searchParams.get('category') || undefined,
            minPrice: minPrice,
            maxPrice: maxPrice,
            minRating: minRating,
            sortBy: currentSortBy as 'popularity' | 'price' | 'price_desc' | 'rating' | 'newest' | 'distance',
            page: nextPage,
            limit: DEFAULT_LIMIT,
          });
          if (response.success && response.data.services) {
            setPopularServices(prev => [...prev, ...(response.data.services as Service[])]);
            if (response.data.pagination) {
              setPagination(prev => ({
                ...prev,
                page: response.data.pagination.page,
                total: response.data.pagination.total,
                pages: response.data.pagination.pages,
              }));
              setHasMore(response.data.pagination.page < response.data.pagination.pages);
            }
            showSuccessToast('Loaded more services');
            return;
          }
        } catch (retryErr) {
          showDeduplicatedError('Retry failed', retryErr instanceof Error ? retryErr.message : 'Please try again');
        }
      }
    } finally {
      setInfiniteLoading(false);
      loadMoreInProgress.current = false;
    }
  }, [hasMore, pagination.page, pagination.pages, searchParams, minPrice, maxPrice, minRating]);

  // Intersection Observer for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (paginationMode !== 'infinite') {
      observerRef.current?.disconnect();
      return;
    }

    // Disconnect existing observer if any
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !infiniteLoading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [paginationMode, infiniteLoading, hasMore, loadMore]);

  // Reset infinite scroll state when filters change
  useEffect(() => {
    if (paginationMode === 'infinite') {
      setPopularServices([]);
      setPagination(DEFAULT_PAGINATION);
      setHasMore(true);
    }
  }, [searchParams, paginationMode]);

  // Close saved searches dropdown when clicking outside
  useEffect(() => {
    if (!showSavedSearches) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[role="menu"]') && !target.closest('button[aria-label="Saved searches"]')) {
        setShowSavedSearches(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSavedSearches]);

  const isSearching = !!searchParams.get('q');

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <CustomerHubNav />

        <main className="flex-1 w-full">
          <a
            href="#services-results"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-white focus:text-nilin-charcoal focus:rounded-xl focus:shadow-nilin-lg focus:font-semibold focus:text-sm"
          >
            Skip to main content
          </a>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/customer/dashboard' },
                { label: 'Book a Service' },
              ]}
            />

            {/* ==================== HERO SECTION ==================== */}
            <section className="mt-4 mb-8">
              <div className="relative overflow-hidden rounded-nilin-lg bg-nilin-surface border border-nilin-blush/40 shadow-nilin-lg p-6 md:p-10">
                {/* Premium animated background elements */}
                <div className="absolute inset-0 opacity-30 overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-72 h-72 bg-nilin-blush rounded-full blur-3xl animate-pulse" />
                  <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-nilin-peach rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                  {/* Floating decorative elements */}
                  <div className="absolute top-10 right-1/4 w-4 h-4 rounded-full bg-nilin-coral/20 animate-float" />
                  <div className="absolute bottom-20 left-1/4 w-3 h-3 rounded-full bg-nilin-rose/20 animate-float" style={{ animationDelay: '1s' }} />
                  <div className="absolute top-1/2 right-10 w-2 h-2 rounded-full bg-nilin-blush/30 animate-float" style={{ animationDelay: '1.5s' }} />
                </div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-nilin-blush rounded-nilin">
                      <Sparkles className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-semibold text-nilin-rose uppercase tracking-wide">
                      Quick Booking
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl font-bold text-nilin-charcoal mb-3">
                    {isSearching ? (
                      <>Search results for <span className="text-nilin-coral">"{searchParams.get('q')}"</span></>
                    ) : (
                      <>Find Your Perfect <span className="text-nilin-coral">Service</span></>
                    )}
                  </h1>

                  <p className="text-nilin-warmGray mb-6 max-w-lg">
                    {isSearching
                      ? `Found popular services matching your search. Book instantly!`
                      : 'Browse categories, explore top-rated services, or search for exactly what you need.'
                    }
                  </p>

                  {/* Search Form */}
                  <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-lightGray" aria-hidden="true" />
                      <input
                        type="search"
                        ref={searchInputRef}
                        value={searchInput}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        onKeyDown={handleSuggestionKeyDown}
                        onFocus={() => searchInput.length >= 2 && setShowSuggestions(true)}
                        placeholder="Search for services..."
                        aria-label="Search services"
                        aria-autocomplete="list"
                        aria-controls="search-suggestions"
                        aria-activedescendant={highlightedIndex >= 0 ? `suggestion-${highlightedIndex}` : undefined}
                        maxLength={100}
                        className="w-full pl-12 pr-16 py-4 rounded-nilin-lg bg-nilin-cream border border-nilin-blush/50 text-nilin-charcoal placeholder-nilin-lightGray
                          focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral focus:shadow-nilin-glow
                          transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-nilin-lightGray">
                        {searchInput.length}/100
                      </span>

                      {/* Search Suggestions Dropdown */}
                      {showSuggestions && (
                        <div
                          ref={suggestionsRef}
                          id="search-suggestions"
                          role="listbox"
                          aria-label="Search suggestions"
                          className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-nilin-lg border border-nilin-blush/50 shadow-nilin-lg overflow-hidden"
                        >
                          {suggestionsLoading ? (
                            <div className="px-4 py-3 text-sm text-nilin-warmGray flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
                              Loading suggestions...
                            </div>
                          ) : suggestions.length > 0 ? (
                            suggestions.map((suggestion, index) => (
                              <button
                                key={`${suggestion.type}-${suggestion.text}`}
                                id={`suggestion-${index}`}
                                role="option"
                                aria-selected={highlightedIndex === index}
                                type="button"
                                onClick={() => handleSuggestionSelect(suggestion)}
                                className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors ${
                                  highlightedIndex === index
                                    ? 'bg-nilin-blush/30 text-nilin-rose'
                                    : 'text-nilin-charcoal hover:bg-nilin-muted'
                                }`}
                              >
                                <Search className="w-4 h-4 text-nilin-lightGray flex-shrink-0" />
                                <span className="flex-1">{suggestion.text}</span>
                                <span className="text-xs text-nilin-lightGray capitalize">{suggestion.type}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-nilin-warmGray">
                              No suggestions found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="px-8 py-4 bg-nilin-coral text-white font-semibold rounded-nilin-lg shadow-nilin
                        hover:bg-nilin-rose hover:shadow-nilin-lg
                        active:scale-95
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {searchLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" aria-hidden="true" />
                      )}
                      Search
                    </button>
                    {isSearching && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        aria-label="Clear search"
                        className="px-6 py-4 bg-nilin-muted text-nilin-warmGray font-medium rounded-nilin-lg
                          hover:bg-nilin-blush/40
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          active:scale-95 transition-all"
                      >
                        Clear
                      </button>
                    )}
                    {/* Save Search Button - shown when there are active filters or search query */}
                    {(searchParams.get('q') || searchParams.get('category') || minPrice || maxPrice || minRating) && (
                      <button
                        type="button"
                        onClick={handleSaveSearch}
                        aria-label="Save this search"
                        className="px-4 py-4 bg-nilin-blush/50 text-nilin-coral font-medium rounded-nilin-lg
                          hover:bg-nilin-blush hover:text-nilin-rose
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Bookmark className="w-5 h-5" aria-hidden="true" />
                        <span className="hidden sm:inline">Save</span>
                      </button>
                    )}
                  </form>

                  {/* Click outside to close suggestions */}
                  {showSuggestions && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowSuggestions(false)}
                      aria-hidden="true"
                    />
                  )}

                  {/* Trending Searches / Quick Links */}
                  {!isSearching && (
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-nilin-lightGray flex items-center gap-1">
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                        Trending:
                      </span>
                      {(trendingSearches.length > 0 ? trendingSearches : SEARCH_TERMS).map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                            setSearchInput(term);
                            setSearchParams({ q: term });
                          }}
                          aria-label={`Search for ${term}`}
                          className="px-3 py-1.5 text-sm bg-nilin-muted text-nilin-warmGray rounded-full
                            hover:bg-nilin-blush/50 hover:text-nilin-rose
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                            active:scale-95 transition-all"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* N41: Hero/Categories spacing consistency - mb-8 for both */}
            {!isSearching && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-nilin-blush rounded-nilin">
                      <Grid3X3 className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-nilin-charcoal">Browse Categories</h2>
                      <p className="text-sm text-nilin-warmGray">Pick a category to explore services</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {categoriesLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)
                  ) : (
                    // N44: Use MAX_CATEGORY_DISPLAY constant
                    categories.slice(0, MAX_CATEGORY_DISPLAY).map((cat) => (
                      <CategoryCard
                        key={cat.slug}
                        name={cat.name}
                        slug={cat.slug}
                        image={CATEGORY_IMAGES[cat.slug]?.card || CATEGORY_IMAGES[cat.slug]?.hero || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80'}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* ==================== RECENTLY VIEWED SECTION ==================== */}
            {!isSearching && viewed.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-nilin-blush rounded-nilin">
                      <Clock className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-nilin-charcoal">Recently Viewed</h2>
                      <p className="text-sm text-nilin-warmGray">{viewed.length} service{viewed.length !== 1 ? 's' : ''} viewed</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => clearViewed()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush/30 rounded-nilin transition-colors active:scale-95"
                    aria-label="Clear history"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear History
                  </button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {viewed.slice(0, 10).map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => navigate(`/services/${item._id}`)}
                      aria-label={`View ${item.title}, ${formatPrice(typeof item.price === 'number' ? item.price : (item.price as any)?.amount || 0, 'AED')}`}
                      className="flex-shrink-0 w-48 bg-nilin-surface rounded-nilin border border-nilin-blush/40 overflow-hidden hover:shadow-nilin hover:border-nilin-coral/30 transition-all group active:scale-95"
                    >
                      <div className="h-28 bg-gradient-to-br from-nilin-blush to-nilin-peach relative overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Clock className="w-8 h-8 text-nilin-lightGray" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-nilin-charcoal line-clamp-1 group-hover:text-nilin-coral transition-colors">
                          {item.title}
                        </h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold text-nilin-coral">
                            {formatPrice(typeof item.price === 'number' ? item.price : (item.price as any)?.amount || 0, 'AED')}
                          </span>
                          <span className="text-xs text-nilin-warmGray">View</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ==================== SERVICES SECTION ==================== */}
            <section id="services-results" aria-label="Services" role="region" className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-nilin-blush rounded-nilin">
                    <Zap className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-nilin-charcoal">
                      {isSearching ? 'Search Results' : activeCategory ? `${categories.find(c => c.slug === activeCategory)?.name || 'Category'} Services` : 'Popular Services'}
                    </h2>
                    <p className="text-sm text-nilin-warmGray" aria-atomic="true" aria-live="polite">
                      {/* N46: Use helper for showing range */}
                      {pagination.total > 0
                        ? formatShowingRange(pagination.page, pagination.limit, pagination.total)
                        : isSearching
                        ? `${popularServices.length} services found`
                        : activeCategory
                        ? `Showing services in ${categories.find(c => c.slug === activeCategory)?.name || activeCategory}`
                        : 'Top-rated services bookable in minutes'}
                    </p>
                  </div>
                </div>

                {/* Did You Mean / Spelling Correction */}
                {searchMetadata && (
                  searchMetadata.didYouMean && searchMetadata.didYouMean.length > 0 && (
                    <div className="mb-4 p-4 bg-nilin-blush/20 rounded-nilin-lg border border-nilin-blush/40" role="region" aria-label="Search suggestions">
                      <p className="text-sm text-nilin-charcoal mb-2">
                        Did you mean:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {searchMetadata.didYouMean.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setSearchInput(suggestion);
                              setSearchParams({ q: suggestion });
                            }}
                            className="px-3 py-1.5 text-sm bg-white text-nilin-coral rounded-full border border-nilin-coral/30
                              hover:bg-nilin-coral hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      {searchMetadata.correctionApplied && (
                        <p className="text-xs text-nilin-warmGray mt-2">
                          Showing results for corrected spelling
                        </p>
                      )}
                    </div>
                  )
                )}

                <div className="flex items-center gap-3">
                  {/* Bulk Select Mode Toggle */}
                  {viewMode === 'grid' && popularServices.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleBulkMode}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-nilin transition-colors active:scale-95
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        ${bulkMode
                          ? 'bg-nilin-coral text-white'
                          : 'bg-nilin-muted text-nilin-charcoal hover:bg-nilin-blush/40'
                        }`}
                    >
                      {bulkMode ? <CheckSquare className="w-5 h-5" aria-hidden="true" /> : <Square className="w-5 h-5" aria-hidden="true" />}
                      <span className="hidden sm:inline">
                        {bulkMode ? 'Exit Selection' : 'Select'}
                      </span>
                      {bulkMode && selectedIds.size > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-white/20 text-white text-xs rounded-full">
                          {selectedIds.size}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Bulk Select Actions Bar */}
                  {bulkMode && selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        aria-label="Select all services on this page"
                        className="px-3 py-2 text-sm text-nilin-warmGray hover:text-nilin-charcoal transition-colors active:scale-95"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        aria-label="Clear all selections"
                        className="px-3 py-2 text-sm text-nilin-warmGray hover:text-nilin-charcoal transition-colors active:scale-95"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={bulkAddToComparison}
                        disabled={selectedIds.size < 2}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-nilin transition-colors active:scale-95
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          ${selectedIds.size >= 2
                            ? 'bg-nilin-coral text-white hover:bg-nilin-rose'
                            : 'bg-nilin-muted text-nilin-lightGray cursor-not-allowed'
                          }`}
                      >
                        <GitCompare className="w-5 h-5" aria-hidden="true" />
                        Add to Compare
                      </button>
                    </div>
                  )}

                  {/* Sort Dropdown */}
                  <label htmlFor="sort-services" className="sr-only">Sort services</label>
                  <select
                    id="sort-services"
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="px-3 py-2 text-sm bg-nilin-muted text-nilin-charcoal border border-nilin-blush/50 rounded-nilin
                      focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral
                      hover:bg-nilin-blush/40 cursor-pointer transition-all"
                  >
                    <option value="popularity">Most Popular</option>
                    <option value="price">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="newest">Newest</option>
                  </select>

                  {/* View Toggle */}
                  <div className="flex items-center bg-nilin-muted rounded-nilin p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      aria-pressed={viewMode === 'grid'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-nilin text-sm font-medium transition-all active:scale-95 ${
                        viewMode === 'grid'
                          ? 'bg-nilin-surface text-nilin-primary shadow-nilin-sm'
                          : 'text-nilin-warmGray hover:text-nilin-charcoal'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                    >
                      <LayoutGrid className="w-5 h-5" aria-hidden="true" />
                      <span className="hidden sm:inline">Services</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      aria-pressed={viewMode === 'list'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-nilin text-sm font-medium transition-all active:scale-95 ${
                        viewMode === 'list'
                          ? 'bg-nilin-surface text-nilin-primary shadow-nilin-sm'
                          : 'text-nilin-warmGray hover:text-nilin-charcoal'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                    >
                      <LayoutList className="w-5 h-5" aria-hidden="true" />
                      <span className="hidden sm:inline">List</span>
                    </button>
                    <button
                      onClick={() => setViewMode('map')}
                      aria-pressed={viewMode === 'map'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-nilin text-sm font-medium transition-all active:scale-95 ${
                        viewMode === 'map'
                          ? 'bg-nilin-surface text-nilin-primary shadow-nilin-sm'
                          : 'text-nilin-warmGray hover:text-nilin-charcoal'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                    >
                      <MapIcon className="w-5 h-5" aria-hidden="true" />
                      <span className="hidden sm:inline">Map</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Open filters"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setMobileFiltersOpen(true);
                      } else {
                        navigate('/search');
                      }
                    }}
                    className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-warmGray bg-nilin-muted rounded-nilin hover:bg-nilin-blush/40
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-colors active:scale-95"
                  >
                    <Filter className="w-5 h-5" aria-hidden="true" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 bg-nilin-coral text-white text-xs font-bold rounded-full flex items-center justify-center"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label="Share this page"
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-warmGray bg-nilin-muted rounded-nilin hover:bg-nilin-blush/40
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-colors active:scale-95"
                  >
                    <Share2 className="w-5 h-5" aria-hidden="true" />
                    {copied ? 'Copied!' : 'Share'}
                  </button>

                  {/* Saved Searches Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Saved searches"
                      aria-expanded={showSavedSearches}
                      aria-haspopup="true"
                      onClick={() => setShowSavedSearches(!showSavedSearches)}
                      className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-warmGray bg-nilin-muted rounded-nilin hover:bg-nilin-blush/40
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        transition-colors active:scale-95"
                    >
                      <Bookmark className="w-5 h-5" aria-hidden="true" />
                      <span className="hidden lg:inline">Saved</span>
                      {savedSearches.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-nilin-coral text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {savedSearches.length}
                        </span>
                      )}
                    </button>

                    {/* Saved Searches Dropdown Panel */}
                    {showSavedSearches && (
                      <div
                        role="menu"
                        aria-label="Saved searches"
                        className="absolute right-0 top-full mt-2 w-72 bg-white rounded-nilin-lg border border-nilin-blush/50 shadow-nilin-lg z-50 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-nilin-blush/30">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-nilin-charcoal">Saved Searches</h3>
                            <button
                              type="button"
                              onClick={() => setShowSavedSearches(false)}
                              className="p-1 text-nilin-lightGray hover:text-nilin-charcoal rounded transition-colors"
                              aria-label="Close saved searches"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                          {savedSearches.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                              <Bookmark className="w-8 h-8 text-nilin-lightGray mx-auto mb-2" />
                              <p className="text-sm text-nilin-warmGray">No saved searches yet</p>
                              <p className="text-xs text-nilin-lightGray mt-1">Save a search to quickly access it later</p>
                            </div>
                          ) : (
                            <div className="py-1">
                              {savedSearches.map((search) => (
                                <div
                                  key={search.id}
                                  role="menuitem"
                                  className="group px-3 py-3 hover:bg-nilin-blush/20 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreSearch(search)}
                                      className="flex-1 text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <BookmarkCheck className="w-4 h-4 text-nilin-coral flex-shrink-0" />
                                        <span className="text-sm font-medium text-nilin-charcoal">
                                          {search.query || 'All services'}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-1">
                                        {search.filters.category && (
                                          <span className="px-2 py-0.5 text-xs bg-nilin-muted text-nilin-warmGray rounded">
                                            {search.filters.category}
                                          </span>
                                        )}
                                        {search.filters.minPrice || search.filters.maxPrice ? (
                                          <span className="px-2 py-0.5 text-xs bg-nilin-muted text-nilin-warmGray rounded">
                                            {formatPrice(search.filters.minPrice || 0, 'AED')}
                                            {' - '}
                                            {formatPrice(search.filters.maxPrice || 9999, 'AED')}
                                          </span>
                                        ) : null}
                                        {search.filters.minRating ? (
                                          <span className="px-2 py-0.5 text-xs bg-nilin-muted text-nilin-warmGray rounded">
                                            {search.filters.minRating}+ stars
                                          </span>
                                        ) : null}
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteSearch(search.id, e)}
                                      className="p-1.5 text-nilin-lightGray hover:text-nilin-rose hover:bg-nilin-rose/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      aria-label={`Delete saved search: ${search.query || 'All services'}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pagination Mode Toggle */}
                  <button
                    type="button"
                    aria-label={paginationMode === 'pagination' ? 'Switch to infinite scroll' : 'Switch to pagination'}
                    onClick={() => setPaginationMode(v => v === 'pagination' ? 'infinite' : 'pagination')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-nilin transition-colors active:scale-95
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      ${paginationMode === 'pagination'
                        ? 'bg-nilin-muted text-nilin-charcoal hover:bg-nilin-blush/40'
                        : 'bg-nilin-coral text-white hover:bg-nilin-rose'
                      }`}
                  >
                    {paginationMode === 'pagination' ? (
                      <>
                        <List className="w-5 h-5" aria-hidden="true" />
                        <span className="hidden lg:inline">Infinite</span>
                      </>
                    ) : (
                      <>
                        <LayoutGrid className="w-5 h-5" aria-hidden="true" />
                        <span className="hidden lg:inline">Paginate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              {categories.length > 0 && (
                <div className="mb-6" role="group" aria-label="Category filters">
                  <CategoryChips
                    categories={categories}
                    activeCategory={activeCategory}
                    onSelect={handleCategorySelect}
                    onClear={handleClearCategory}
                  />
                </div>
              )}

              {/* Active filter pills - show what filters are applied */}
              {(minPrice || maxPrice || minRating) && (
                <div className="flex flex-wrap items-center gap-2 mb-4" aria-label="Active filters">
                  <span className="text-xs text-nilin-lightGray">Active filters:</span>
                  {minPrice || maxPrice ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-nilin-blush/50 text-nilin-charcoal rounded-full text-xs">
                      Price: {minPrice ? formatPrice(minPrice, 'AED') : '0'} - {maxPrice ? formatPrice(maxPrice, 'AED') : '∞'}
                      <button onClick={() => handlePriceRangeChange(undefined, undefined)} className="ml-1 hover:text-nilin-error active:scale-95 transition-all" aria-label={`Remove ${minPrice ? `AED ${minPrice}` : '0'} - ${maxPrice ? `AED ${maxPrice}` : '∞'} price filter`}>
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ) : null}
                  {minRating ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-nilin-blush/50 text-nilin-charcoal rounded-full text-xs">
                      {minRating}+ ★
                      <button onClick={() => handleMinRatingChange(undefined)} className="ml-1 hover:text-nilin-error active:scale-95 transition-all" aria-label={`Remove ${minRating}+ star rating filter`}>
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ) : null}
                  <button onClick={handleClearAllFilters} className="text-xs text-nilin-coral hover:text-nilin-rose active:scale-95 transition-all" aria-label="Clear all filters">
                    Clear all
                  </button>
                </div>
              )}

              {/* Filter panel - desktop only, hidden on mobile */}
              <div className="hidden md:flex flex-wrap gap-4 mb-6 p-4 bg-nilin-surface rounded-nilin-lg border border-nilin-blush/30">
                {/* Price Range */}
                <fieldset className="flex flex-col gap-2 min-w-[160px]">
                  <legend className="text-xs font-medium text-nilin-charcoal">Price Range</legend>
                  <div className="flex items-center gap-2">
                    <label htmlFor="min-price" className="text-xs text-nilin-warmGray">Min</label>
                    <input
                      id="min-price"
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={minPrice || ''}
                      onChange={(e) => {
                        const newMin = e.target.value ? Number(e.target.value) : undefined;
                        // Validate minPrice <= maxPrice
                        if (newMin !== undefined && maxPrice !== undefined && newMin > maxPrice) {
                          showDeduplicatedError('Minimum price cannot be greater than maximum price');
                          return;
                        }
                        handlePriceRangeChange(newMin, maxPrice);
                      }}
                      className="w-20 px-2 py-1.5 text-sm bg-nilin-cream border border-nilin-blush/50 rounded-nilin
                        focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral"
                      aria-describedby="min-price-hint"
                    />
                    <span className="text-nilin-lightGray" aria-hidden="true">—</span>
                    <label htmlFor="max-price" className="text-xs text-nilin-warmGray">Max</label>
                    <input
                      id="max-price"
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={maxPrice || ''}
                      onChange={(e) => {
                        const newMax = e.target.value ? Number(e.target.value) : undefined;
                        // Validate minPrice <= maxPrice
                        if (minPrice !== undefined && newMax !== undefined && minPrice > newMax) {
                          showDeduplicatedError('Maximum price cannot be less than minimum price');
                          return;
                        }
                        handlePriceRangeChange(minPrice, newMax);
                      }}
                      className="w-20 px-2 py-1.5 text-sm bg-nilin-cream border border-nilin-blush/50 rounded-nilin
                        focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral"
                      aria-describedby="max-price-hint"
                    />
                    <span id="min-price-hint" className="sr-only">Enter minimum price in AED</span>
                    <span id="max-price-hint" className="sr-only">Enter maximum price in AED</span>
                  </div>
                </fieldset>

                {/* Min Rating */}
                <fieldset className="flex flex-col gap-2 min-w-[160px]">
                  <legend className="text-xs font-medium text-nilin-charcoal">Minimum Rating</legend>
                  <div className="flex gap-1" role="group" aria-label="Filter by minimum rating">
                    <button
                      type="button"
                      onClick={() => handleMinRatingChange(undefined)}
                      aria-pressed={!minRating}
                      className={`px-3 py-1.5 text-sm rounded-nilin transition-colors active:scale-95 ${
                        !minRating
                          ? 'bg-nilin-coral text-white'
                          : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                    >
                      Any
                    </button>
                    {[3, 4, 4.5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleMinRatingChange(minRating === rating ? undefined : rating)}
                        aria-pressed={minRating === rating}
                        aria-label={`Minimum ${rating} stars`}
                        className={`px-3 py-1.5 text-sm rounded-nilin transition-colors active:scale-95 ${
                          minRating === rating
                            ? 'bg-nilin-coral text-white'
                            : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50'
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                      >
                        {rating}+ ★
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              {/* Content States */}
              {servicesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-busy="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ServiceSkeleton key={i} />
                  ))}
                </div>
              ) : servicesError ? (
                <div className="text-center py-16 rounded-nilin-lg bg-nilin-surface border border-nilin-blush/40" role="alert" aria-live="assertive">
                  <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-nilin-coral" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Something went wrong</h3>
                  <p className="text-nilin-warmGray mb-6 max-w-sm mx-auto">{servicesError}</p>
                  <button
                    type="button"
                    onClick={() => { setServicesError(null); fetchPopularServices(currentPage); }}
                    className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-nilin hover:bg-nilin-rose
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-colors active:scale-95"
                  >
                    Try Again
                  </button>
                </div>
              ) : popularServices.length === 0 ? (
                <div className="text-center py-16 rounded-nilin-lg bg-nilin-surface border border-nilin-blush/40">
                  <div className="w-16 h-16 rounded-full bg-nilin-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-nilin-lightGray" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">No services found</h3>
                  <p className="text-nilin-warmGray mb-4 max-w-sm mx-auto">
                    {isSearching
                      ? `No services match "${searchParams.get('q')}". Try a different search term.`
                      : 'Check back soon for new services from our providers.'}
                  </p>
                  {isSearching && (
                    <div className="mb-6">
                      <p className="text-sm text-nilin-lightGray mb-2">Try searching for:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {SEARCH_TERMS.filter(term => term.toLowerCase() !== searchParams.get('q')?.toLowerCase()).slice(0, 3).map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => {
                              setSearchInput(term);
                              setSearchParams({ q: term });
                            }}
                            className="px-3 py-1.5 text-sm bg-nilin-muted text-nilin-warmGray rounded-full
                              hover:bg-nilin-blush/50 hover:text-nilin-rose active:scale-95 transition-colors"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {isSearching && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-6 py-3 bg-nilin-muted text-nilin-charcoal font-medium rounded-nilin hover:bg-nilin-blush/40
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          transition-colors active:scale-95"
                      >
                        Clear Search
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/book-services')}
                      className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-nilin hover:bg-nilin-rose
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        transition-colors active:scale-95"
                    >
                      Browse Popular Services
                    </button>
                  </div>
                </div>
              ) : (
                <div className="transition-all duration-300">
                  {viewMode === 'map' ? (
                    <LazyMapView
                      services={popularServices}
                      onViewDetails={(service) => { addViewed(service); navigate(`/services/${service._id}`); }}
                      onBookNow={handleBookNow}
                      height="h-[350px] sm:h-[450px] md:h-[600px]"
                    />
                  ) : viewMode === 'list' ? (
                    <div className="flex flex-col gap-4">
                      {popularServices.map((service, index) => (
                        <div
                          key={service._id}
                          className="animate-fade-in-up"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <ServiceListItem
                            service={service}
                            onBookNow={handleBookNow}
                            onQuickView={(s) => setQuickViewService(s)}
                            onClick={() => { addViewed(service); navigate(`/services/${service._id}`); }}
                            showCheckbox={bulkMode}
                            checked={selectedIds.has(service._id)}
                            onCheck={toggleSelect}
                            isFavorited={favorites.some(f => f.providerId === service.provider?._id)}
                            onFavorite={async () => {
                              const providerId = service.provider?._id || (service as any).providerId;
                              if (providerId) await toggleFavorite(providerId);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {popularServices.map((service, index) => (
                        <div
                          key={service._id}
                          className="animate-fade-in-up"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <ServiceCard
                            service={service}
                            variant="default"
                            onBookNow={handleBookNow}
                            showBookNow={true}
                            onQuickView={(s) => setQuickViewService(s)}
                            showQuickView={true}
                            onClick={() => { addViewed(service); navigate(`/services/${service._id}`); }}
                            showCheckbox={bulkMode}
                            checked={selectedIds.has(service._id)}
                            onCheck={toggleSelect}
                            onNotifyMe={handleNotifyMe}
                            isFavorited={favorites.some(f => f.providerId === service.provider?._id)}
                            onFavorite={async () => {
                              const providerId = service.provider?._id || (service as any).providerId;
                              if (providerId) await toggleFavorite(providerId);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pagination / Infinite Scroll */}
              {paginationMode === 'pagination' ? (
                pagination.pages > 1 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.pages}
                    onPageChange={handlePageChange}
                  />
                )
              ) : (
                <>
                  {/* Infinite scroll sentinel */}
                  <div ref={sentinelRef} className="h-px" />

                  {/* Loading indicator for infinite scroll */}
                  {infiniteLoading && (
                    <div className="flex justify-center py-8" role="status" aria-live="polite">
                      <div className="flex items-center gap-3 text-nilin-warmGray">
                        <div className="w-6 h-6 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading more services...</span>
                      </div>
                    </div>
                  )}

                  {/* End of results message */}
                  {!hasMore && popularServices.length > 0 && (
                    <div className="text-center py-8 text-nilin-warmGray text-sm" role="status" aria-live="polite">
                      You've reached the end of the list
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ==================== BOTTOM CTA ==================== */}
            {!isSearching && popularServices.length > 0 && (
              <section className="mb-8">
                <div className="text-center py-8 px-6 bg-nilin-surface rounded-nilin-lg border border-nilin-blush/30">
                  {/* N47: Bottom CTA text color - use charcoal for better contrast */}
                  <p className="text-nilin-charcoal mb-4 font-medium">Looking for something specific?</p>
                  <button
                    type="button"
                    onClick={() => navigate('/search')}
                    className="px-8 py-3 bg-nilin-charcoal text-nilin-cream font-semibold rounded-nilin-lg hover:bg-nilin-charcoal/90
                      shadow-nilin hover:shadow-nilin-lg
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-all active:scale-95 inline-flex items-center gap-2"
                  >
                    <Search className="w-5 h-5" aria-hidden="true" />
                    Browse All Services
                  </button>
                </div>
              </section>
            )}
          </div>
        </main>

        {/* Floating comparison bar - appears when 2+ services selected */}
        <ComparisonBar />

        {/* Quick View Modal */}
        <ServiceQuickViewModal
          service={quickViewService}
          open={!!quickViewService}
          onClose={() => setQuickViewService(null)}
        />

        {/* Mobile Filter Bottom Sheet */}
        <MobileFilterSheet
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          onApply={handleMobileFiltersApply}
          initialFilters={{
            category: activeCategory,
            minPrice,
            maxPrice,
            minRating,
            sortBy,
          }}
          categories={categories}
        />

        <Footer />
      </div>
    </PageErrorBoundary>
  );
};

export default BookServicesPage;
