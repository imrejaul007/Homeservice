import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Package,
  ArrowRight,
  Sparkles,
  Grid3X3,
  ChevronRight,
  Zap,
  Filter,
  Map as MapIcon,
  LayoutGrid,
  Bookmark,
  X,
  AlertCircle,
  Share2,
  List,
  Repeat,
  CheckSquare,
  Square,
  GitCompare,
  ListChecks,
  Clock,
  Trash2
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import CustomerHubNav from '../../components/customer/CustomerHubNav';
import Breadcrumb from '../../components/common/Breadcrumb';
import Pagination from '../../components/common/Pagination';
import ServiceCard from '../../components/customer/ServiceCard';
import ServiceQuickViewModal from '../../components/customer/ServiceQuickViewModal';
import type { Service } from '../../types/service';
import { useCategories } from '../../hooks/useCategories';
import { searchApi } from '../../services/searchApi';
import { CATEGORY_IMAGES } from '../../constants/images';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import ComparisonBar from '../../components/search/ComparisonBar';
import LazyMapView from '../../components/search/LazyMapView';
import { useSavedSearchStore } from '../../stores/savedSearchStore';
import { useRecentlyViewedStore } from '../../stores/recentlyViewedStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { formatPrice } from '../../utils/priceConverter';
import toast from 'react-hot-toast';
import MobileFilterSheet from '../../components/customer/MobileFilterSheet';

// N40: Extract magic numbers to constants
const DEFAULT_LIMIT = 12;
const TIMEOUT_DURATION = 15000;
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
      className="group relative flex flex-col items-center p-5 rounded-2xl bg-nilin-surface border border-nilin-blush/40 shadow-nilin-sm overflow-hidden
        transition-all duration-300 ease-out
        hover:shadow-nilin hover:border-nilin-coral hover:-translate-y-1
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
        active:scale-[0.98]
        motion-reduce:transition-none motion-reduce:hover:transform-none"
    >
      {/* Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-nilin-blush/40 via-nilin-cream to-nilin-peach/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Image Container */}
      <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden ring-2 ring-nilin-blush group-hover:ring-nilin-coral transition-all duration-300 shadow-nilin-sm">
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
// SKELETON COMPONENTS
// ============================================
const CategorySkeleton = () => (
  <div className="flex flex-col items-center p-5 rounded-2xl bg-nilin-surface border border-nilin-blush/40">
    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-nilin-blush animate-pulse" />
    <div className="mt-3 w-16 h-4 bg-nilin-blush rounded animate-pulse" />
  </div>
);

const ServiceSkeleton = () => (
  <div className="bg-nilin-surface rounded-2xl border border-nilin-blush/40 overflow-hidden">
    <div className="h-40 bg-nilin-blush animate-pulse" />
    <div className="p-4">
      <div className="w-16 h-4 bg-nilin-blush rounded mb-2 animate-pulse" />
      <div className="w-3/4 h-5 bg-nilin-blush rounded mb-3 animate-pulse" />
      <div className="flex gap-3 mb-3">
        <div className="w-20 h-3 bg-nilin-blush rounded animate-pulse" />
        <div className="w-24 h-3 bg-nilin-blush rounded animate-pulse" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-nilin-blush/30">
        <div className="w-20 h-6 bg-nilin-blush rounded animate-pulse" />
        <div className="w-16 h-8 bg-nilin-blush rounded animate-pulse" />
      </div>
    </div>
  </div>
);

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
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [quickViewService, setQuickViewService] = useState<Service | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bulk select mode state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      toast.success(`Added ${added} service${added > 1 ? 's' : ''} to comparison`);
    }
    if (skipped > 0) {
      toast.error(`${skipped} service${skipped > 1 ? 's' : ''} could not be added (limit reached or already in comparison)`);
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

  // Get page from URL params (default to 1)
  const pageParam = searchParams.get('page');
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const sortBy = searchParams.get('sortBy') || 'popularity';

  // Category filter state
  const activeCategory = searchParams.get('category') || '';

  // Price and Rating filter state (read from URL)
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
  const minRating = searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined;

  // Active filter count for badge
  const activeFilterCount = [
    searchParams.get('category'),
    searchParams.get('minPrice'),
    searchParams.get('maxPrice'),
    searchParams.get('minRating'),
    searchParams.get('sortBy') !== 'popularity' ? searchParams.get('sortBy') : null,
  ].filter(Boolean).length;

  const { categories, isLoading: categoriesLoading } = useCategories();
  // Saved searches state
  const savedSearches = useSavedSearchStore((s) => s.searches);
  const { addSearch, removeSearch } = useSavedSearchStore();

  // Recently viewed state
  const { viewed, addViewed, clearViewed } = useRecentlyViewedStore();

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
      } else {
        setPopularServices([]);
        setPagination(DEFAULT_PAGINATION);
      }
    } catch (err: any) {
      // Ignore abort errors - they are expected when component unmounts or effect re-runs
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('[BookServicesPage] Failed to load services:', err);
      const isNetworkError = !err.response;
      const status = err.response?.status;
      if (isNetworkError) {
        setServicesError('No internet connection. Check your network and try again.');
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

  // Abortable fetch with timeout
  const fetchWithTimeout = useCallback(async (page: number) => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_DURATION);

    try {
      await fetchPopularServices(page);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setServicesError('Request timed out. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [fetchPopularServices]);

  // Fetch services when page changes
  useEffect(() => {
    // Abort previous request
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const controller = controllerRef.current;

    fetchPopularServices(currentPage)
      .then(() => {
        // Success - no action needed
      })
      .catch((err) => {
        if (currentPage > 1) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('page', '1');
            return next;
          });
          toast.error('Failed to load page. Showing page 1.');
        }
      })
      .finally(() => {
        // Clean up abort controller if component unmounts
        if (controller.signal.aborted) {
          return;
        }
      });

    return () => controller.abort();
  }, [fetchPopularServices, currentPage]);

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
    // Reset to page 1 when search changes
    if (sanitized) {
      setSearchParams({ q: sanitized });
    } else {
      setSearchParams({});
    }
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
    const existing = useSavedSearchStore.getState().searches;
    const exists = existing.some(s => s.query === query && JSON.stringify(s.filters) === '{}');
    if (exists) {
      toast('Search already saved');
      return;
    }
    addSearch({ query, filters: {} });
    toast.success('Search saved!');
  };

  const handleShare = async () => {
    const url = window.location.origin + '/book-services?' + searchParams.toString();
    if (navigator.share) {
      await navigator.share({ title: 'Book Services', url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNotifyMe = (service: Service) => {
    toast.success('We\'ll notify you when this service becomes available');
  };

  // Load more services for infinite scroll
  const loadMore = useCallback(async () => {
    if (infiniteLoading || !hasMore) return;

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
      console.error('[BookServicesPage] Failed to load more services:', err);
      toast.error('Failed to load more services');
    } finally {
      setInfiniteLoading(false);
    }
  }, [infiniteLoading, hasMore, pagination.page, searchParams, minPrice, maxPrice, minRating]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (paginationMode !== 'infinite') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !infiniteLoading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

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
              <div className="relative overflow-hidden rounded-3xl bg-nilin-surface border border-nilin-blush/40 shadow-nilin-lg p-6 md:p-10">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute -top-20 -right-20 w-72 h-72 bg-nilin-blush rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-nilin-peach rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-nilin-blush rounded-xl">
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
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search for services..."
                        aria-label="Search services"
                        maxLength={100}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-nilin-cream border border-nilin-blush/50 text-nilin-charcoal placeholder-nilin-lightGray
                          focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral
                          transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-8 py-4 bg-nilin-coral text-white font-semibold rounded-2xl shadow-nilin
                        hover:bg-nilin-rose hover:shadow-nilin-lg
                        active:scale-95
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        transition-all flex items-center justify-center gap-2"
                    >
                      <Search className="w-5 h-5" aria-hidden="true" />
                      Search
                    </button>
                    {isSearching && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        aria-label="Clear search"
                        className="px-6 py-4 bg-nilin-muted text-nilin-warmGray font-medium rounded-2xl
                          hover:bg-nilin-blush/40
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          transition-all"
                      >
                        Clear
                      </button>
                    )}
                  </form>

                  {/* Quick Links */}
                  {!isSearching && (
                    // N42: Use SEARCH_TERMS constant for consistency
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-nilin-lightGray">Popular:</span>
                      {SEARCH_TERMS.map((term) => (
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
                            active:scale-95 transition-transform transition-colors"
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
                    <div className="p-2 bg-nilin-blush rounded-xl">
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
                    <div className="p-2 bg-nilin-blush rounded-xl">
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
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush/30 rounded-lg transition-colors"
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
                      className="flex-shrink-0 w-48 bg-nilin-surface rounded-xl border border-nilin-blush/40 overflow-hidden hover:shadow-nilin hover:border-nilin-coral/30 transition-all group"
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
                  <div className="p-2 bg-nilin-blush rounded-xl">
                    <Zap className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-nilin-charcoal">
                      {isSearching ? 'Search Results' : activeCategory ? `${categories.find(c => c.slug === activeCategory)?.name || 'Category'} Services` : 'Popular Services'}
                    </h2>
                    <p className="text-sm text-nilin-warmGray" aria-live="polite">
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

                <div className="flex items-center gap-3">
                  {/* Bulk Select Mode Toggle */}
                  {viewMode === 'grid' && popularServices.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleBulkMode}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        ${bulkMode
                          ? 'bg-nilin-coral text-white'
                          : 'bg-nilin-muted text-nilin-charcoal hover:bg-nilin-blush/40'
                        }`}
                    >
                      {bulkMode ? <CheckSquare className="w-4 h-4" aria-hidden="true" /> : <Square className="w-4 h-4" aria-hidden="true" />}
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
                        className="px-3 py-2 text-sm text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="px-3 py-2 text-sm text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={bulkAddToComparison}
                        disabled={selectedIds.size < 2}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          ${selectedIds.size >= 2
                            ? 'bg-nilin-coral text-white hover:bg-nilin-rose'
                            : 'bg-nilin-muted text-nilin-lightGray cursor-not-allowed'
                          }`}
                      >
                        <GitCompare className="w-4 h-4" aria-hidden="true" />
                        Add to Compare
                      </button>
                    </div>
                  )}

                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="px-3 py-2 text-sm bg-nilin-muted text-nilin-charcoal border border-nilin-blush/50 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral
                      hover:bg-nilin-blush/40 cursor-pointer transition-all"
                    aria-label="Sort services"
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        viewMode === 'grid'
                          ? 'bg-nilin-surface text-nilin-primary shadow-sm'
                          : 'text-nilin-warmGray hover:text-nilin-charcoal'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                    >
                      <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Services</span>
                    </button>
                    <button
                      onClick={() => setViewMode('map')}
                      aria-pressed={viewMode === 'map'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        viewMode === 'map'
                          ? 'bg-nilin-surface text-nilin-primary shadow-sm'
                          : 'text-nilin-warmGray hover:text-nilin-charcoal'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
                    >
                      <MapIcon className="w-4 h-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Map</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setMobileFiltersOpen(true);
                      } else {
                        navigate('/search');
                      }
                    }}
                    className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-warmGray bg-nilin-muted rounded-xl hover:bg-nilin-blush/40
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-colors"
                  >
                    <Filter className="w-4 h-4" aria-hidden="true" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-nilin-coral text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-warmGray bg-nilin-muted rounded-xl hover:bg-nilin-blush/40
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-colors"
                  >
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    {copied ? 'Copied!' : 'Share'}
                  </button>

                  {/* Pagination Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => setPaginationMode(v => v === 'pagination' ? 'infinite' : 'pagination')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      ${paginationMode === 'pagination'
                        ? 'bg-nilin-muted text-nilin-charcoal hover:bg-nilin-blush/40'
                        : 'bg-nilin-coral text-white hover:bg-nilin-rose'
                      }`}
                    title={paginationMode === 'pagination' ? 'Switch to infinite scroll' : 'Switch to pagination'}
                  >
                    {paginationMode === 'pagination' ? (
                      <>
                        <List className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden lg:inline">Infinite</span>
                      </>
                    ) : (
                      <>
                        <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden lg:inline">Paginate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Category Filter Chips - Always visible, hidden on mobile during search */}
              {categories.length > 0 && (
                <div className="mb-6">
                  <div className="relative flex gap-2 overflow-x-auto pb-2 md:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {/* Left fade */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-nilin-cream to-transparent z-10 pointer-events-none" aria-hidden="true" />
                    {/* Right fade */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-nilin-cream to-transparent z-10 pointer-events-none" aria-hidden="true" />
                    {/* "All" chip - resets category */}
                    <button
                      type="button"
                      onClick={handleClearCategory}
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
                    {/* N45: Use MAX_CATEGORY_CHIPS constant */}
                    {categories.slice(0, MAX_CATEGORY_CHIPS).map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => handleCategorySelect(cat.slug)}
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
                  <div className="relative hidden md:flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {/* Left fade */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-nilin-cream to-transparent z-10 pointer-events-none" aria-hidden="true" />
                    {/* Right fade */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-nilin-cream to-transparent z-10 pointer-events-none" aria-hidden="true" />
                    {/* "All" chip - resets category */}
                    <button
                      type="button"
                      onClick={handleClearCategory}
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
                    {/* N45: Use MAX_CATEGORY_CHIPS constant */}
                    {categories.slice(0, MAX_CATEGORY_CHIPS).map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => handleCategorySelect(cat.slug)}
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
                </div>
              )}

              {/* Active filter pills - show what filters are applied */}
              {(minPrice || maxPrice || minRating) && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs text-nilin-lightGray">Active filters:</span>
                  {minPrice || maxPrice ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-nilin-blush/50 text-nilin-charcoal rounded-full text-xs">
                      Price: {minPrice ? formatPrice(minPrice, 'AED') : '0'} - {maxPrice ? formatPrice(maxPrice, 'AED') : '∞'}
                      <button onClick={() => handlePriceRangeChange(undefined, undefined)} className="ml-1 hover:text-nilin-error active:scale-95 transition-all" aria-label={`Remove ${minPrice ? `AED ${minPrice}` : '0'} - ${maxPrice ? `AED ${maxPrice}` : '∞'} price filter`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null}
                  {minRating ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-nilin-blush/50 text-nilin-charcoal rounded-full text-xs">
                      {minRating}+ ★
                      <button onClick={() => handleMinRatingChange(undefined)} className="ml-1 hover:text-nilin-error active:scale-95 transition-all" aria-label={`Remove ${minRating}+ star rating filter`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null}
                  <button onClick={handleClearAllFilters} className="text-xs text-nilin-coral hover:text-nilin-rose" aria-label="Clear all filters">
                    Clear all
                  </button>
                </div>
              )}

              {/* Filter panel - desktop only, hidden on mobile */}
              <div className="hidden md:flex flex-wrap gap-4 mb-6 p-4 bg-nilin-surface rounded-2xl border border-nilin-blush/30">
                {/* Price Range */}
                <fieldset className="flex flex-col gap-2 min-w-[160px]">
                  <legend className="text-xs font-medium text-nilin-charcoal">Price Range</legend>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={minPrice || ''}
                      onChange={(e) => handlePriceRangeChange(e.target.value ? Number(e.target.value) : undefined, maxPrice)}
                      className="w-20 px-2 py-1.5 text-sm bg-nilin-cream border border-nilin-blush/50 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral"
                      aria-label="Minimum price"
                    />
                    <span className="text-nilin-lightGray">—</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={maxPrice || ''}
                      onChange={(e) => handlePriceRangeChange(minPrice, e.target.value ? Number(e.target.value) : undefined)}
                      className="w-20 px-2 py-1.5 text-sm bg-nilin-cream border border-nilin-blush/50 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:border-nilin-coral"
                      aria-label="Maximum price"
                    />
                  </div>
                </fieldset>

                {/* Min Rating */}
                <fieldset className="flex flex-col gap-2 min-w-[160px]">
                  <legend className="text-xs font-medium text-nilin-charcoal">Min Rating</legend>
                  <div className="flex gap-1">
                    {[3, 4, 4.5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleMinRatingChange(minRating === rating ? undefined : rating)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
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
                <div className="text-center py-16 rounded-3xl bg-nilin-surface border border-nilin-blush/40">
                  <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-nilin-coral" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Something went wrong</h3>
                  <p className="text-nilin-warmGray mb-6 max-w-sm mx-auto">{servicesError}</p>
                  <button
                    type="button"
                    onClick={() => { setServicesError(null); fetchPopularServices(currentPage); }}
                    className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-xl hover:bg-nilin-rose
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : popularServices.length === 0 ? (
                <div className="text-center py-16 rounded-3xl bg-nilin-surface border border-nilin-blush/40">
                  <div className="w-16 h-16 rounded-full bg-nilin-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-nilin-lightGray" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">No services found</h3>
                  <p className="text-nilin-warmGray mb-6 max-w-sm mx-auto">
                    {isSearching
                      ? `No services match "${searchParams.get('q')}". Try a different search term.`
                      : 'Check back soon for new services from our providers.'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {isSearching && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-6 py-3 bg-nilin-muted text-nilin-charcoal font-medium rounded-xl hover:bg-nilin-blush/40
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                          transition-colors"
                      >
                        Clear Search
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/search')}
                      className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-xl hover:bg-nilin-rose
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                        transition-colors"
                    >
                      Advanced Search
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
                      height="h-[400px] md:h-[600px]"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {popularServices.map((service) => (
                        <ServiceCard
                          key={service._id}
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
                        />
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
                    <div className="flex justify-center py-8">
                      <div className="flex items-center gap-3 text-nilin-warmGray">
                        <div className="w-6 h-6 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading more services...</span>
                      </div>
                    </div>
                  )}

                  {/* End of results message */}
                  {!hasMore && popularServices.length > 0 && (
                    <div className="text-center py-8 text-nilin-warmGray text-sm">
                      You've reached the end of the list
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ==================== BOTTOM CTA ==================== */}
            {!isSearching && popularServices.length > 0 && (
              <section className="mb-8">
                <div className="text-center py-8 px-6 bg-nilin-surface rounded-2xl border border-nilin-blush/30">
                  {/* N47: Bottom CTA text color - use charcoal for better contrast */}
                  <p className="text-nilin-charcoal mb-4 font-medium">Looking for something specific?</p>
                  <button
                    type="button"
                    onClick={() => navigate('/search')}
                    className="px-8 py-3 bg-nilin-charcoal text-nilin-cream font-semibold rounded-2xl hover:bg-nilin-charcoal/90
                      shadow-nilin hover:shadow-nilin-lg
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                      transition-all inline-flex items-center gap-2"
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
