import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import ServiceCard from '../components/customer/ServiceCard';
import type { Service } from '../components/customer/ServiceCard';
import { searchApi } from '../services/searchApi';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { PageErrorBoundary } from '../components/common/PageErrorBoundary';
import BottomSheet from '../components/mobile/BottomSheet';
import { CardSkeleton } from '../components/mobile/LoadingSkeleton';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 12, total: 0, pages: 0,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [maxPriceLimit, setMaxPriceLimit] = useState<number>(10000);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('popularity');

  const { categories: apiCategories } = useCategories();

  const categoryList = useMemo(() => {
    return apiCategories.map(cat => ({ value: cat.slug || cat.name, label: cat.name }));
  }, [apiCategories]);

  const hasActiveFilters = () => {
    return selectedCategory !== '' || priceRange[1] !== maxPriceLimit || minRating > 0;
  };

  // Fetch price filter limits from API
  useEffect(() => {
    const fetchFilterLimits = async () => {
      try {
        const response = await searchApi.getSearchFilters();
        if (response.success && response.data?.priceRange) {
          setMaxPriceLimit(response.data.priceRange.max);
          setPriceRange([0, response.data.priceRange.max]);
        }
      } catch (error) {
        console.error('Failed to fetch filter limits:', error);
      }
    };
    fetchFilterLimits();
  }, []);

  // Sync URL params on initial load
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam && !selectedCategory) {
      // Use slug directly from URL, match against category slugs
      const matchingCategory = apiCategories.find(
        cat => cat.slug === categoryParam || cat.name.toLowerCase() === categoryParam.toLowerCase()
      );
      setSelectedCategory(matchingCategory ? matchingCategory.name : categoryParam);
    }
    const sortParam = searchParams.get('sortBy');
    if (sortParam) setSortBy(sortParam);
  }, [apiCategories]);

  // Fetch services with AbortController cleanup
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchServices = async () => {
      try {
        setLoading(true);
        const query = searchParams.get('q') || '';
        const categoryParam = searchParams.get('category');
        const categoryToUse = selectedCategory || categoryParam || undefined;

        const response = await searchApi.searchServices({
          q: query,
          category: categoryToUse,
          minPrice: priceRange[0],
          maxPrice: priceRange[1],
          minRating: minRating > 0 ? minRating : undefined,
          sortBy: sortBy as any,
          page: pagination.page,
          limit: pagination.limit,
        }, abortController.signal);

        // FIX: Only update state if component is still mounted
        if (response.success && response.data.services && isMounted) {
          setServices(response.data.services);
          if (response.data.pagination) {
            setPagination(prev => ({
              ...prev,
              total: response.data.pagination!.total,
              pages: response.data.pagination!.pages,
            }));
          }
        }
      } catch (error) {
        // Ignore abort errors - expected on unmount
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error fetching services:', error);
      } finally {
        // FIX: Only update loading state if still mounted
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchServices();

    // CRITICAL FIX: Proper cleanup order - abort BEFORE setting isMounted
    // This ensures the abort signal stops any in-flight requests before
    // we mark the component as unmounted, preventing race conditions
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [searchParams, selectedCategory, priceRange, minRating, sortBy, pagination.page]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(prev => prev === category ? '' : category);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setPriceRange([0, maxPriceLimit]);
    setMinRating(0);
    setSortBy('popularity');
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({});
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const { page, pages: totalPages } = pagination;
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavigationHeader />

      <PageErrorBoundary pageName="Search">
        {/* Page Header */}
      <div className="bg-nilin-cream border-b border-nilin-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-1">
            {searchParams.get('q')
              ? `Results for "${searchParams.get('q')}"`
              : selectedCategory
                ? `${selectedCategory} Services`
                : 'Browse All Services'
            }
          </h1>
          <p className="text-sm text-nilin-warmGray">
            {pagination.total > 0
              ? `${pagination.total} services available`
              : 'Find the perfect beauty service'
            }
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
                className={`px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-nilin-primary border-nilin-primary text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-nilin-primary/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active filter pills */}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory('')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-nilin-primary/10 text-nilin-primary rounded-full text-sm font-medium hover:bg-nilin-primary/20 transition-colors"
              >
                {selectedCategory} <X className="h-3.5 w-3.5" />
              </button>
            )}
            {minRating > 0 && (
              <button
                onClick={() => setMinRating(0)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
              >
                {minRating}+ <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> <X className="h-3.5 w-3.5" />
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
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nilin-primary/20"
          >
            <option value="popularity">Most Popular</option>
            <option value="price">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest First</option>
          </select>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <CardSkeleton key={n} />
            ))}
          </div>
        ) : services.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {services.map((service) => (
                <ServiceCard key={service._id} service={service} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                {getPageNumbers().map((pageNum, idx) => (
                  pageNum === '...' ? (
                    <span key={`e-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum as number)}
                      className={`min-w-[40px] h-10 rounded-lg text-sm font-medium transition-all ${
                        pagination.page === pageNum
                          ? 'bg-nilin-primary text-white'
                          : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                ))}
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-nilin-blush/30 rounded-2xl p-12 text-center border border-nilin-border">
            <div className="w-20 h-20 bg-nilin-cream rounded-full flex items-center justify-center mx-auto mb-5">
              <Search className="h-10 w-10 text-nilin-coral" />
            </div>
            <h3 className="text-xl font-bold text-nilin-charcoal mb-2">No services found</h3>
            <p className="text-nilin-warmGray mb-6 text-sm">
              Try adjusting your search or browse categories above.
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
        )}
      </div>

      {/* Mobile Filter FAB */}
      <button
        onClick={() => setShowMobileFilters(true)}
        className="md:hidden fixed bottom-6 right-6 bg-nilin-primary text-white px-5 py-3 rounded-full shadow-lg font-semibold flex items-center gap-2 z-40"
      >
        <SlidersHorizontal className="h-5 w-5" />
        Filters
      </button>

      {/* Mobile Filter Bottom Sheet */}
      <BottomSheet
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        title="Filters"
        footer={
          <button
            onClick={() => {
              setPagination(prev => ({ ...prev, page: 1 }));
              setShowMobileFilters(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full py-3 bg-nilin-primary text-white rounded-full font-semibold"
          >
            Show {pagination.total} Results
          </button>
        }
      >
        <div className="space-y-6">
          {/* Price Range */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Price Range</h4>
            <input
              type="range"
              min="0" max={maxPriceLimit} step="500"
              value={priceRange[1]}
              onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-nilin-primary"
            />
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">AED 0</span>
              <span className="font-medium text-nilin-primary">AED {priceRange[1].toLocaleString()}</span>
            </div>
          </div>

          {/* Rating */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Minimum Rating</h4>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(minRating === r ? 0 : r)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    minRating === r
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
      </PageErrorBoundary>

      <Footer />
    </div>
  );
};

export default SearchPage;
