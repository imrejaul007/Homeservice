import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Grid, List, Star, MapPin, ChevronDown, Scale, X, Check } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import Button from '../components/common/Button';
import { packageApi, normalizeFeatures, type ServicePackage, type PackageFilters } from '../services/packageApi';
import { showDeduplicatedError } from '../utils/toastUtils';
import { useCategories } from '../hooks/useCategories';

/** Normalize API package payload for UI rendering */
function normalizePackage(pkg: ServicePackage & Record<string, unknown>): ServicePackage {
  const pricing = pkg.pricing || {
    originalPrice: (pkg as { basePrice?: number }).basePrice ?? 0,
    currentPrice: (pkg as { discountedPrice?: number }).discountedPrice ?? 0,
    currency: 'AED',
    type: 'fixed' as const,
  };
  const duration = pkg.duration || {
    totalMinutes: (pkg as { durationMinutes?: number }).durationMinutes ?? 0,
    formatted: (pkg as { durationLabel?: string }).durationLabel ?? '—',
  };
  const provider = pkg.provider || {
    _id: String((pkg as { providerId?: string }).providerId || ''),
    firstName: String((pkg as { providerName?: string }).providerName || 'Provider').split(' ')[0],
    lastName: String((pkg as { providerName?: string }).providerName || '').split(' ').slice(1).join(' '),
    businessName: (pkg as { providerName?: string }).providerName,
  };
  const stats = pkg.stats || {
    rating: (pkg as { averageRating?: number }).averageRating ?? 0,
    reviewCount: (pkg as { totalReviews?: number }).totalReviews ?? 0,
    totalPurchases: 0,
  };
  const features = pkg.features?.length
    ? pkg.features
    : ((pkg.includedItems || []) as ServicePackage['features']);

  return {
    ...pkg,
    pricing,
    duration,
    provider,
    stats,
    features,
    isFeatured: pkg.isFeatured ?? false,
    isPopular: (pkg as { isPopular?: boolean }).isPopular ?? false,
  };
}

interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

/**
 * Generates smart page numbers for pagination with ellipsis
 * Shows: First page, ellipsis if needed, 2 pages before current,
 * current page, 2 pages after current, ellipsis if needed, last page
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];

  // Handle edge cases
  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  const leftBound = Math.max(2, currentPage - 2);
  const rightBound = Math.min(totalPages - 1, currentPage + 2);

  // Add ellipsis after first page if needed
  if (leftBound > 2) {
    pages.push('ellipsis');
  }

  // Add pages around current page
  for (let i = leftBound; i <= rightBound; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  // Add ellipsis before last page if needed
  if (rightBound < totalPages - 1) {
    pages.push('ellipsis');
  }

  // Always show last page (if not already added)
  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return pages;
}

const PackagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Package comparison selection state
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const MAX_COMPARE_PACKAGES = 5;

  // Toggle comparison selection for a package
  const togglePackageForComparison = (pkgId: string) => {
    if (selectedForComparison.includes(pkgId)) {
      setSelectedForComparison(prev => prev.filter(id => id !== pkgId));
    } else {
      if (selectedForComparison.length >= MAX_COMPARE_PACKAGES) {
        // Could show a toast here
        return;
      }
      setSelectedForComparison(prev => [...prev, pkgId]);
    }
  };

  // Go to comparison page with selected packages
  const goToComparison = () => {
    if (selectedForComparison.length >= 2) {
      navigate(`/packages/compare?ids=${selectedForComparison.join(',')}`);
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedForComparison([]);
    setIsCompareMode(false);
  };

  // Fetch categories dynamically
  const { categories, isLoading: isCategoriesLoading } = useCategories();

  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'popularity');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});

  const fetchPackages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const page = parseInt(searchParams.get('page') || '1', 10);
      const result = await packageApi.getPackages({
        page,
        limit: 12,
        q: searchParams.get('q') || undefined,
        category: selectedCategory || undefined,
        sortBy: (sortBy as PackageFilters['sortBy']) || 'popularity',
        featured: searchParams.get('featured') === 'true' ? 'true' : undefined,
      });

      setPackages(result.packages.map((pkg) => normalizePackage(pkg as ServicePackage & Record<string, unknown>)));
      setPagination({
        page: result.page,
        pages: result.totalPages,
        total: result.total,
        limit: 12,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load packages';
      setError(message);
      showDeduplicatedError('Failed to load packages', message);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, selectedCategory, sortBy]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery) {
      newParams.set('q', searchQuery);
    } else {
      newParams.delete('q');
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleCategoryChange = (category: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (category) {
      newParams.set('category', category);
    } else {
      newParams.delete('category');
    }
    newParams.delete('page');
    setSearchParams(newParams);
    setSelectedCategory(category);
  };

  const handleSortChange = (sort: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sortBy', sort);
    newParams.delete('page');
    setSearchParams(newParams);
    setSortBy(sort);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getDiscountPercentage = (original: number, current: number) => {
    return Math.round(((original - current) / original) * 100);
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-serif text-nilin-charcoal mb-2">Service Packages</h1>
            <p className="text-nilin-warmGray text-lg">
              Discover curated service packages from top-rated professionals
            </p>
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                  <input
                    type="text"
                    placeholder="Search packages..."
                    aria-label="Search packages"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral transition-all"
                  />
                </div>
              </form>

              {/* Filter Controls */}
              <div className="flex gap-3 items-center">
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  aria-label="Filter by category"
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 bg-white"
                  disabled={isCategoriesLoading}
                >
                  <option value="">All Categories</option>
                  {categories
                    .filter(cat => !cat.comingSoon)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((category) => (
                      <option key={category._id} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  aria-label="Sort packages"
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 bg-white"
                >
                  <option value="popularity">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>

                {/* View Toggle */}
                <div className="flex border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-3 ${viewMode === 'grid' ? 'bg-nilin-coral text-white' : 'bg-white text-nilin-warmGray hover:bg-gray-50'}`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-3 ${viewMode === 'list' ? 'bg-nilin-coral text-white' : 'bg-white text-nilin-warmGray hover:bg-gray-50'}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : packages.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-xl p-12 text-center">
              <div className="w-20 h-20 bg-nilin-coral/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No packages found</h3>
              <p className="text-nilin-warmGray max-w-md mx-auto mb-6">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              <Button onClick={() => {
                setSearchParams({});
                setSearchQuery('');
                setSelectedCategory('');
                setSortBy('popularity');
              }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Results Count and Compare Button */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-nilin-warmGray">
                  Showing {packages.length} packages
                  {pagination && ` of ${pagination.total}`}
                </p>
                <Button
                  variant={selectedForComparison.length > 0 ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setIsCompareMode(!isCompareMode)}
                  className="ml-auto"
                >
                  <Scale className="w-4 h-4 mr-2" />
                  {isCompareMode ? 'Cancel Selection' : 'Compare Packages'}
                  {selectedForComparison.length > 0 && (
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {selectedForComparison.length}
                    </span>
                  )}
                </Button>
              </div>

              {/* Comparison Selection Bar */}
              {selectedForComparison.length > 0 && (
                <div className="bg-nilin-coral text-white rounded-xl p-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5" />
                    <span>
                      {selectedForComparison.length} package{selectedForComparison.length !== 1 ? 's' : ''} selected
                      {selectedForComparison.length < 2 && ' (select at least 2)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="text-white hover:bg-white/20"
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={goToComparison}
                      disabled={selectedForComparison.length < 2}
                      className="bg-white text-nilin-coral hover:bg-gray-100"
                    >
                      Compare Now
                    </Button>
                  </div>
                </div>
              )}

              {/* Package Grid/List */}
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
              }>
                {packages.map((pkg) => {
                  const isSelected = selectedForComparison.includes(pkg._id);
                  return (
                  <div
                    key={pkg._id}
                    className={`bg-white rounded-xl overflow-hidden hover:shadow-lg transition-shadow relative ${
                      viewMode === 'list' ? 'flex' : ''
                    } ${isSelected ? 'ring-2 ring-nilin-coral' : ''}`}
                  >
                    {/* Compare Selection Checkbox */}
                    {isCompareMode && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePackageForComparison(pkg._id);
                        }}
                        className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-nilin-coral border-nilin-coral text-white'
                            : 'bg-white border-gray-300 hover:border-nilin-coral'
                        }`}
                        title={isSelected ? 'Remove from comparison' : 'Add to comparison'}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    )}

                    <Link
                      to={`/packages/${pkg._id}`}
                      className={`block ${isCompareMode ? 'pointer-events-none' : ''}`}
                    >
                    {/* Image */}
                    <div className={`relative ${viewMode === 'list' ? 'w-64 h-48 flex-shrink-0' : 'h-48'}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-nilin-coral/20 to-nilin-blush/30 flex items-center justify-center">
                        <span className="text-6xl opacity-30">📦</span>
                      </div>

                      {/* Badges */}
                      {pkg.isFeatured && (
                        <span className="absolute top-3 left-3 bg-nilin-coral text-white text-xs font-medium px-3 py-1 rounded-full">
                          Featured
                        </span>
                      )}
                      {pkg.isPopular && (
                        <span className="absolute top-3 right-3 bg-nilin-charcoal text-white text-xs font-medium px-3 py-1 rounded-full">
                          Popular
                        </span>
                      )}

                      {/* Discount Badge */}
                      {(pkg.pricing?.originalPrice ?? 0) > (pkg.pricing?.currentPrice ?? 0) && (
                        <span className="absolute bottom-3 left-3 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                          {getDiscountPercentage(pkg.pricing.originalPrice, pkg.pricing.currentPrice)}% OFF
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      {/* Provider */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-nilin-coral/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-nilin-coral">
                            {(pkg.provider?.businessName || pkg.provider?.firstName || 'P').charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm text-nilin-warmGray">
                          {pkg.provider?.businessName || `${pkg.provider?.firstName} ${pkg.provider?.lastName}`}
                        </span>
                        {pkg.provider?.isVerified && (
                          <span className="text-blue-500 text-xs">✓</span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-medium text-nilin-charcoal mb-1 line-clamp-2">
                        {pkg.name}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-nilin-warmGray mb-3 line-clamp-2">
                        {pkg.description}
                      </p>

                      {/* Features */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {normalizeFeatures(pkg.features).slice(0, 3).map((feature, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                          >
                            {feature.name}
                          </span>
                        ))}
                        {(normalizeFeatures(pkg.features).length || 0) > 3 && (
                          <span className="text-xs text-nilin-warmGray">
                            +{normalizeFeatures(pkg.features).length - 3} more
                          </span>
                        )}
                      </div>

                      {/* Rating and Reviews */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-medium text-nilin-charcoal">
                            {(pkg.stats?.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <span className="text-sm text-nilin-warmGray">
                          ({pkg.stats?.reviewCount || 0} reviews)
                        </span>
                      </div>

                      {/* Price and Duration */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-bold text-nilin-charcoal">
                            {formatPrice(pkg.pricing?.currentPrice ?? 0)}
                          </span>
                          {(pkg.pricing?.originalPrice ?? 0) > (pkg.pricing?.currentPrice ?? 0) && (
                            <span className="text-sm text-nilin-warmGray line-through ml-2">
                              {formatPrice(pkg.pricing!.originalPrice)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-nilin-warmGray">
                          <span>⏱</span>
                          <span>{pkg.duration?.formatted ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    </Link>
                  </div>
                );
                })}
              </div>

              {/* Smart Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex justify-center items-center gap-1 mt-8">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>

                  {getPageNumbers(pagination.page, pagination.pages).map((item, index) => {
                    if (item === 'ellipsis') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 py-2 text-gray-400">
                          ...
                        </span>
                      );
                    }
                    const pageNum = item as number;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-nilin-coral text-white'
                            : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        aria-current={pagination.page === pageNum ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PackagesPage;
