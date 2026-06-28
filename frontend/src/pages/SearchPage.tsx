import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import ServiceCard from '../components/customer/ServiceCard';
import type { Service } from '../components/customer/ServiceCard';
import ProviderCard from '../components/service/ProviderCard';
import LazyMapView from '../components/search/LazyMapView';
import ComparisonBar from '../components/search/ComparisonBar';
import axios from 'axios';
import { searchApi, SearchApiError } from '../services/searchApi';
import type { SearchProvider, SavedSearch } from '../types/search';
import {
  SlidersHorizontal, X, ChevronLeft, ChevronRight, Search, Star,
  LayoutGrid, User, Bookmark, BookmarkCheck, AlertCircle, RefreshCw, Map as MapIcon,
} from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { PageErrorBoundary } from '../components/common/PageErrorBoundary';
import BottomSheet from '../components/mobile/BottomSheet';
import { CardSkeleton } from '../components/mobile/LoadingSkeleton';
import AdvancedBookingFilters, { AdvancedFilterOptions } from '../components/customer/AdvancedBookingFilters';
import { toast } from 'react-hot-toast';
import { showDeduplicatedError } from '../utils/toastUtils';
import { useLocationStore } from '../stores/locationStore';

const SAVED_SEARCHES_KEY = 'nilin-saved-searches';
const MAX_SAVED_SEARCHES = 10;

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const DEFAULT_PAGINATION: Pagination = { page: 1, limit: 12, total: 0, pages: 0 };

function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedSearches(searches: SavedSearch[]) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_SAVED_SEARCHES)));
}

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterOptions>({});
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [maxPriceLimit, setMaxPriceLimit] = useState(10000);
  const [retryCount, setRetryCount] = useState(0);
  const [filterSheetPrice, setFilterSheetPrice] = useState<[number, number]>([0, 10000]);
  const [filterSheetRating, setFilterSheetRating] = useState(0);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);

  const { categories: apiCategories } = useCategories();
  const { currentLocation } = useLocationStore();

  // Get user coordinates for distance calculation
  const userLatitude = currentLocation?.coordinates?.latitude;
  const userLongitude = currentLocation?.coordinates?.longitude;

  // URL-derived state
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const subcategoryParam = searchParams.get('subcategory') || '';
  const providerParam = searchParams.get('provider') || '';
  const viewMode = (searchParams.get('view') === 'providers' || !!providerParam)
    ? 'providers' as const
    : searchParams.get('view') === 'map'
    ? 'map' as const
    : 'services' as const;
  const sortBy = searchParams.get('sortBy') || 'popularity';
  const minRating = Number(searchParams.get('minRating') || '0');
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const minPrice = Number(searchParams.get('minPrice') || '0');
  const maxPrice = Number(searchParams.get('maxPrice') || String(maxPriceLimit));

  const priceRange = useMemo<[number, number]>(
    () => [minPrice, maxPrice > 0 ? maxPrice : maxPriceLimit],
    [minPrice, maxPrice, maxPriceLimit]
  );

  const updateParams = useCallback((updates: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    });
    if (resetPage) params.delete('page');
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const categoryList = useMemo(
    () => apiCategories.map(cat => ({ value: cat.slug || cat.name, label: cat.name })),
    [apiCategories]
  );

  const activeCategory = useMemo(() => {
    if (!categoryParam) return null;
    return apiCategories.find(
      cat => cat.slug === categoryParam || cat.name.toLowerCase() === categoryParam.toLowerCase()
    ) ?? null;
  }, [apiCategories, categoryParam]);

  const activeSubcategory = useMemo(() => {
    if (!activeCategory || !subcategoryParam) return null;
    return activeCategory.subcategories?.find(
      sub => sub.slug === subcategoryParam || sub.name.toLowerCase() === subcategoryParam.toLowerCase()
    ) ?? null;
  }, [activeCategory, subcategoryParam]);

  const effectiveMinRating = Math.max(minRating, advancedFilters.providerRating || 0);

  const hasActiveFilters = () =>
    categoryParam !== '' ||
    subcategoryParam !== '' ||
    priceRange[1] < maxPriceLimit ||
    effectiveMinRating > 0 ||
    Object.keys(advancedFilters).length > 0;

  // Fetch price filter limits
  useEffect(() => {
    const fetchFilterLimits = async () => {
      try {
        const response = await searchApi.getSearchFilters();
        const priceRangeData = response.data?.filters?.priceRange ?? response.data?.priceRange;
        if (response.success && priceRangeData?.max) {
          setMaxPriceLimit(priceRangeData.max);
          if (!searchParams.get('maxPrice')) {
            // Only set default max if not already in URL
          }
        }
      } catch (err) {
        console.error('Failed to fetch filter limits:', err);
      }
    };
    fetchFilterLimits();
  }, []);

  // Main data fetch
  useEffect(() => {
    const abortController = new AbortController();

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const commonParams = {
          q: query || undefined,
          category: categoryParam || undefined,
          subcategory: subcategoryParam || undefined,
          minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
          maxPrice: priceRange[1] < maxPriceLimit ? priceRange[1] : undefined,
          minRating: effectiveMinRating > 0 ? effectiveMinRating : undefined,
          sortBy: sortBy as 'popularity' | 'price' | 'price_desc' | 'rating' | 'distance' | 'newest',
          page,
          limit: pagination.limit,
          // Use advanced filters location OR fall back to user's current location
          ...(advancedFilters.latitude ? { lat: advancedFilters.latitude } : userLatitude ? { lat: userLatitude } : {}),
          ...(advancedFilters.longitude ? { lng: advancedFilters.longitude } : userLongitude ? { lng: userLongitude } : {}),
          ...(advancedFilters.radiusKm ? { radius: advancedFilters.radiusKm } : {}),
          ...(advancedFilters.city && { city: advancedFilters.city }),
        };

        if (viewMode === 'services' || viewMode === 'map') {
          // FIX: Map view needs service results (with location) to render markers,
          // so it shares the services fetch path — not the providers path.
          const response = await searchApi.searchServices(
            { ...commonParams, providerId: providerParam || undefined },
            abortController.signal
          );

          if (response.success && response.data.services) {
            setServices(response.data.services);
            setProviders([]);
            if (response.data.pagination) {
              setPagination(prev => ({
                ...prev,
                page: response.data.pagination!.page,
                total: response.data.pagination!.total,
                pages: response.data.pagination!.pages,
              }));
            }
          }
        } else {
          const response = await searchApi.searchProviders(
            {
              ...commonParams,
              providerId: providerParam || undefined,
              tier: advancedFilters.providerTier,
              verified: advancedFilters.providerVerified,
            },
            abortController.signal
          );

          if (response.success && response.data.providers) {
            setProviders(response.data.providers);
            setServices([]);
            if (response.data.pagination) {
              setPagination(prev => ({
                ...prev,
                page: response.data.pagination.page,
                total: response.data.pagination.total,
                pages: response.data.pagination.pages,
              }));
            }
          }
        }
      } catch (err) {
        // Ignore aborted requests — expected when filters change or component unmounts
        if (axios.isCancel(err)) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof SearchApiError
          ? err.message
          : err instanceof Error ? err.message : 'Search failed';
        setError(message);
        showDeduplicatedError('Search failed', message);
        setServices([]);
        setProviders([]);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => abortController.abort();
  }, [
    query, categoryParam, subcategoryParam, providerParam, priceRange, effectiveMinRating,
    sortBy, page, viewMode, advancedFilters, maxPriceLimit, pagination.limit, retryCount, userLatitude, userLongitude,
  ]);

  const handleBookNow = (service: Service) => {
    const serviceId = service._id;
    if (serviceId) {
      navigate(`/book/${serviceId}`, { state: { service } });
    }
  };

  const handleCategorySelect = (slug: string) => {
    if (categoryParam === slug) {
      updateParams({ category: null, subcategory: null });
    } else {
      updateParams({ category: slug, subcategory: null });
    }
  };

  const handleViewModeChange = (mode: 'services' | 'providers' | 'map') => {
    // Reset map collapse when switching view modes
    if (mode !== 'map') {
      setIsMapCollapsed(false);
    }
    updateParams({ view: mode === 'services' ? null : mode });
  };

  const handleSortChange = (value: string) => {
    updateParams({ sortBy: value === 'popularity' ? null : value });
  };

  const handleSaveSearch = () => {
    const currentSearch: SavedSearch = {
      id: Date.now().toString(),
      query,
      filters: {
        category: categoryParam || undefined,
        subcategory: subcategoryParam || undefined,
        minPrice: priceRange[0],
        maxPrice: priceRange[1] < maxPriceLimit ? priceRange[1] : undefined,
        minRating: effectiveMinRating > 0 ? effectiveMinRating : undefined,
        sortBy: sortBy !== 'popularity' ? sortBy : undefined,
      },
      createdAt: Date.now(),
    };

    const exists = savedSearches.some(
      s => s.query === query &&
        s.filters.category === currentSearch.filters.category &&
        s.filters.subcategory === currentSearch.filters.subcategory
    );

    if (exists) {
      toast.error('This search is already saved');
      return;
    }

    const updated = [currentSearch, ...savedSearches].slice(0, MAX_SAVED_SEARCHES);
    setSavedSearches(updated);
    persistSavedSearches(updated);
    toast.success('Search saved');
  };

  const handleLoadSavedSearch = (saved: SavedSearch) => {
    const params: Record<string, string | null> = {
      q: saved.query || null,
      category: saved.filters.category || null,
      subcategory: saved.filters.subcategory || null,
      view: null, // Reset to default view mode
      sortBy: saved.filters.sortBy || null,
      minRating: saved.filters.minRating ? String(saved.filters.minRating) : null,
      minPrice: saved.filters.minPrice ? String(saved.filters.minPrice) : null,
      maxPrice: saved.filters.maxPrice ? String(saved.filters.maxPrice) : null,
    };
    updateParams(params);
    setAdvancedFilters({});
  };

  const handleDeleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    persistSavedSearches(updated);
    toast.success('Saved search removed');
  };

  const handleApplyAdvancedFilters = (filters: AdvancedFilterOptions) => {
    setAdvancedFilters(filters);
    updateParams({});
  };

  const handleClearAdvancedFilters = () => {
    setAdvancedFilters({});
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      updateParams({ page: newPage > 1 ? String(newPage) : null }, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearFilters = () => {
    setAdvancedFilters({});
    const params: Record<string, string | null> = {
      category: null,
      subcategory: null,
      sortBy: null,
      minRating: null,
      minPrice: null,
      maxPrice: null,
      provider: null,
    };
    if (query) params.q = query;
    updateParams(params);
  };

  const openFilters = () => {
    setFilterSheetPrice(priceRange);
    setFilterSheetRating(effectiveMinRating);
    setShowFilters(true);
  };

  const applyLocalFilters = () => {
    updateParams({
      minPrice: filterSheetPrice[0] > 0 ? String(filterSheetPrice[0]) : null,
      maxPrice: filterSheetPrice[1] < maxPriceLimit ? String(filterSheetPrice[1]) : null,
      minRating: filterSheetRating > 0 ? String(filterSheetRating) : null,
    });
    setShowFilters(false);
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const { pages: totalPages } = pagination;
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (page >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
    }
    return pages;
  };

  const pageTitle = query
    ? `Results for "${query}"`
    : activeSubcategory
      ? `${activeCategory?.name} > ${activeSubcategory.name}`
      : activeCategory
        ? `${activeCategory.name} ${viewMode === 'providers' ? 'Providers' : 'Services'}`
        : viewMode === 'providers' ? 'Browse All Providers' : 'Browse All Services';

  const resultCount = pagination.total;
  const resultLabel = viewMode === 'providers'
    ? `${resultCount} provider${resultCount !== 1 ? 's' : ''} available`
    : resultCount > 0
      ? `${resultCount} service${resultCount !== 1 ? 's' : ''} available`
      : 'Find the perfect beauty service';

  const hasResults = viewMode === 'services' ? services.length > 0 : providers.length > 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavigationHeader />

      <PageErrorBoundary pageName="Search">
        {/* Page Header */}
        <div className="bg-nilin-cream border-b border-nilin-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-1">
              {pageTitle}
            </h1>
            <p className="text-sm text-nilin-warmGray">
              {!loading ? resultLabel : 'Searching...'}
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          {/* Category Chips */}
          <div className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categoryList.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleCategorySelect(cat.value)}
                  aria-pressed={categoryParam === cat.value}
                  className={`min-h-11 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                    categoryParam === cat.value
                      ? 'bg-nilin-primary border-nilin-primary text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-nilin-primary/50 hover:bg-nilin-blush/30'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Inline Search Input - allows modifying search without navigation */}
              {query && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => updateParams({ q: e.target.value || null })}
                    placeholder="Search..."
                    className="pl-9 pr-4 py-2 w-48 md:w-64 text-sm bg-white border border-nilin-border rounded-nilin
                      focus:outline-none focus:ring-2 focus:ring-nilin-primary/20 focus:border-nilin-primary
                      placeholder:text-nilin-lightGray"
                    aria-label="Search query"
                  />
                </div>
              )}

              {/* View Toggle */}
              <div className="flex items-center bg-nilin-muted rounded-nilin p-1">
                <button
                  onClick={() => handleViewModeChange('services')}
                  aria-pressed={viewMode === 'services'}
                  className={`flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'services'
                      ? 'bg-white text-nilin-primary shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Services
                </button>
                <button
                  onClick={() => handleViewModeChange('providers')}
                  aria-pressed={viewMode === 'providers'}
                  className={`flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'providers'
                      ? 'bg-white text-nilin-primary shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Providers
                </button>
                <button
                  onClick={() => handleViewModeChange('map')}
                  aria-pressed={viewMode === 'map'}
                  className={`flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'map'
                      ? 'bg-white text-nilin-primary shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Map
                </button>
              </div>

              <button
                onClick={handleSaveSearch}
                className="flex items-center gap-1.5 min-h-11 px-3 py-1.5 text-gray-600 hover:text-nilin-primary transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                <span className="hidden sm:inline">Save Search</span>
              </button>

              <button
                onClick={openFilters}
                className="flex items-center gap-1.5 min-h-11 px-3 py-1.5 text-gray-600 hover:text-nilin-primary transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>

              <button
                onClick={() => setShowAdvancedFilters(true)}
                className="flex items-center gap-1.5 min-h-11 px-3 py-1.5 text-gray-600 hover:text-nilin-primary transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Advanced
              </button>

              {/* Active filter pills */}
              {activeCategory && (
                <button
                  onClick={() => handleCategorySelect(activeCategory.slug || categoryParam)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-nilin-primary/10 text-nilin-primary rounded-full text-sm font-medium hover:bg-nilin-primary/20 transition-colors"
                >
                  {activeCategory.name} <X className="h-3.5 w-3.5" />
                </button>
              )}
              {activeSubcategory && (
                <button
                  onClick={() => updateParams({ subcategory: null })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-nilin-blush text-nilin-charcoal rounded-full text-sm font-medium hover:bg-nilin-blush/80 transition-colors"
                >
                  {activeSubcategory.name} <X className="h-3.5 w-3.5" />
                </button>
              )}
              {effectiveMinRating > 0 && (
                <button
                  onClick={() => {
                    updateParams({ minRating: null });
                    setAdvancedFilters(prev => ({ ...prev, providerRating: undefined }));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
                >
                  {effectiveMinRating}+ <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> <X className="h-3.5 w-3.5" />
                </button>
              )}
              {priceRange[1] < maxPriceLimit && (
                <button
                  onClick={() => updateParams({ maxPrice: null })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                >
                  Up to AED {priceRange[1].toLocaleString()} <X className="h-3.5 w-3.5" />
                </button>
              )}
              {providerParam && viewMode === 'providers' && (
                <button
                  onClick={() => updateParams({ provider: null })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                >
                  Provider filter <X className="h-3.5 w-3.5" />
                </button>
              )}
              {hasActiveFilters() && (
                <button onClick={clearFilters} className="text-sm text-nilin-warmGray hover:text-nilin-charcoal underline">
                  Clear all
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nilin-primary/20"
            >
              <option value="popularity">Most Popular</option>
              <option value="distance">Nearest First</option>
              <option value="price">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest First</option>
            </select>
          </div>

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 rounded-2xl p-8 text-center border border-red-100 mb-6">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Search Error</h3>
              <p className="text-gray-600 mb-4 text-sm">{error}</p>
              <button
                onClick={() => { setError(null); setRetryCount(c => c + 1); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-nilin-coral text-white rounded-full font-semibold hover:bg-nilin-rose transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {loading ? (
            // FIX: Use pagination.limit instead of hardcoded 6 to match actual results
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: pagination.limit }).map((_, n) => (
                <CardSkeleton key={n} />
              ))}
            </div>
          ) : !error && hasResults ? (
            <>
              {viewMode === 'map' ? (
                // Map view - shows services as markers on OpenStreetMap
                <LazyMapView
                  services={services}
                  onViewDetails={(service) => navigate(`/services/${service._id}`)}
                  onBookNow={handleBookNow}
                  isMobileCollapsed={isMapCollapsed}
                  onToggleCollapse={() => setIsMapCollapsed(!isMapCollapsed)}
                />
              ) : viewMode === 'services' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {services.map((service, index) => (
                    <div
                      key={service._id}
                      className="animate-fade-in-up opacity-0"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <ServiceCard
                        service={service}
                        variant="default"
                        showDistance={true}
                        onBookNow={handleBookNow}
                        showBookNow={true}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {providers.map((provider, index) => (
                    <div
                      key={provider._id}
                      className="animate-fade-in-up opacity-0"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <ProviderCard
                        provider={{
                          id: provider._id,
                          firstName: provider.firstName,
                          lastName: provider.lastName,
                          businessName: provider.businessName,
                          profilePhoto: provider.profilePhoto,
                          tier: provider.tier,
                          rating: provider.rating,
                          reviewCount: provider.reviewCount,
                          isVerified: provider.isVerified,
                          startingPrice: provider.startingPrice ?? undefined,
                          maxPrice: provider.maxPrice ?? undefined,
                        }}
                        onClick={() => navigate(`/provider/${provider._id}`)}
                        onViewProfile={() => navigate(`/provider/${provider._id}`)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-8 pt-6 border-t border-gray-100">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="p-2 rounded-nilin border border-nilin-border hover:bg-nilin-blush/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-nilin-warmGray" />
                  </button>
                  {getPageNumbers().map((pageNum, idx) => (
                    pageNum === '...' ? (
                      <span key={`e-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum as number)}
                        aria-current={page === pageNum ? 'page' : undefined}
                        className={`min-w-[40px] h-10 rounded-nilin text-sm font-medium transition-all ${
                          page === pageNum
                            ? 'bg-nilin-primary text-white shadow-sm'
                            : 'border border-nilin-border text-nilin-charcoal hover:bg-nilin-blush/30'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === pagination.pages}
                    aria-label="Next page"
                    className="p-2 rounded-nilin border border-nilin-border hover:bg-nilin-blush/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
                  </button>
                </div>
              )}
            </>
          ) : !error ? (
            <div className="bg-nilin-blush/30 rounded-2xl p-12 text-center border border-nilin-border">
              <div className="w-20 h-20 bg-nilin-cream rounded-full flex items-center justify-center mx-auto mb-5">
                <Search className="h-10 w-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-bold text-nilin-charcoal mb-2">
                {query
                  ? `No results for "${query}"`
                  : viewMode === 'services' ? 'No services found' : 'No providers found'}
              </h3>
              <p className="text-nilin-warmGray mb-6 text-sm">
                {query ? 'Try adjusting your search terms or filters.' : 'Try adjusting your filters or browse categories above.'}
              </p>
              {hasActiveFilters() && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-nilin-coral text-white rounded-full font-semibold hover:bg-nilin-rose transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : null}

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-nilin-primary" />
                Saved Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {savedSearches.map((saved) => (
                  <div
                    key={saved.id}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm hover:border-nilin-primary hover:bg-nilin-primary/5 transition-all"
                  >
                    <button
                      onClick={() => handleLoadSavedSearch(saved)}
                      className="flex items-center gap-2"
                    >
                      <Search className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">
                        {saved.query || (saved.viewMode === 'providers' ? 'All Providers' : 'All Services')}
                        {saved.filters.category ? ` · ${saved.filters.category}` : ''}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteSavedSearch(saved.id)}
                      className="p-0.5 hover:bg-gray-100 rounded-full"
                      aria-label="Remove saved search"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter Bottom Sheet (mobile + desktop) */}
        <BottomSheet
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          title="Filters"
          footer={
            <button
              onClick={applyLocalFilters}
              className="w-full py-3 bg-nilin-primary text-white rounded-full font-semibold"
            >
              Apply Filters
            </button>
          }
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Price Range</h4>
              <input
                type="range"
                min="0"
                max={maxPriceLimit}
                step="500"
                value={filterSheetPrice[1]}
                onChange={(e) => setFilterSheetPrice([0, parseInt(e.target.value)])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-nilin-primary"
              />
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">AED 0</span>
                <span className="font-medium text-nilin-primary">AED {filterSheetPrice[1].toLocaleString()}</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Minimum Rating</h4>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setFilterSheetRating(filterSheetRating === r ? 0 : r)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterSheetRating === r
                        ? 'bg-nilin-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {r}+
                  </button>
                ))}
              </div>
            </div>
          </div>
        </BottomSheet>

        <AdvancedBookingFilters
          isOpen={showAdvancedFilters}
          onClose={() => setShowAdvancedFilters(false)}
          onApply={handleApplyAdvancedFilters}
          onClear={handleClearAdvancedFilters}
          currentFilters={advancedFilters}
          maxPriceLimit={maxPriceLimit}
        />
      </PageErrorBoundary>

      {/* Floating comparison bar - appears when 2+ services selected */}
      <ComparisonBar />

      <Footer />
    </div>
  );
};

export default SearchPage;
