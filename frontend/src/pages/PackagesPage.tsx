import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Grid, List, Star, MapPin, ChevronDown } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import Button from '../components/common/Button';
import { api as apiClient } from '../services/api';

interface Package {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  duration: number;
  category: string;
  subcategory?: string;
  provider: {
    _id: string;
    name: string;
    rating: number;
    reviewCount: number;
    verified: boolean;
  };
  rating: number;
  reviewCount: number;
  image?: string;
  features: string[];
  isFeatured?: boolean;
  isPopular?: boolean;
}

interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

const PackagesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages] = useState<Package[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'popularity');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});

  useEffect(() => {
    fetchPackages();
  }, [searchParams]);

  const fetchPackages = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const page = searchParams.get('page') || '1';
      params.append('page', page);
      params.append('limit', '12');

      if (searchParams.get('q')) params.append('q', searchParams.get('q')!);
      if (selectedCategory) params.append('category', selectedCategory);
      if (sortBy) params.append('sortBy', sortBy);
      if (searchParams.get('featured') === 'true') params.append('featured', 'true');

      const response = await apiClient.get(`/packages?${params.toString()}`);
      setPackages(response.data.data.packages);
      setPagination(response.data.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  };

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
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 bg-white"
                >
                  <option value="">All Categories</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="handyman">Handyman</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="painting">Painting</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
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
              {/* Results Count */}
              <p className="text-nilin-warmGray mb-4">
                Showing {packages.length} packages
                {pagination && ` of ${pagination.total}`}
              </p>

              {/* Package Grid/List */}
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
              }>
                {packages.map((pkg) => (
                  <Link
                    key={pkg._id}
                    to={`/packages/${pkg._id}`}
                    className={`bg-white rounded-xl overflow-hidden hover:shadow-lg transition-shadow ${
                      viewMode === 'list' ? 'flex' : ''
                    }`}
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
                      {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                        <span className="absolute bottom-3 left-3 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                          {getDiscountPercentage(pkg.originalPrice, pkg.price)}% OFF
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      {/* Provider */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-nilin-coral/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-nilin-coral">
                            {pkg.provider.name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm text-nilin-warmGray">{pkg.provider.name}</span>
                        {pkg.provider.verified && (
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
                        {pkg.features.slice(0, 3).map((feature, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                          >
                            {feature}
                          </span>
                        ))}
                        {pkg.features.length > 3 && (
                          <span className="text-xs text-nilin-warmGray">
                            +{pkg.features.length - 3} more
                          </span>
                        )}
                      </div>

                      {/* Rating and Reviews */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-medium text-nilin-charcoal">
                            {pkg.rating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-sm text-nilin-warmGray">
                          ({pkg.reviewCount} reviews)
                        </span>
                      </div>

                      {/* Price and Duration */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-bold text-nilin-charcoal">
                            {formatPrice(pkg.price)}
                          </span>
                          {pkg.originalPrice && (
                            <span className="text-sm text-nilin-warmGray line-through ml-2">
                              {formatPrice(pkg.originalPrice)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-nilin-warmGray">
                          <span>⏱</span>
                          <span>{pkg.duration} min</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>

                  {[...Array(pagination.pages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePageChange(i + 1)}
                      className={`px-4 py-2 rounded-lg ${
                        pagination.page === i + 1
                          ? 'bg-nilin-coral text-white'
                          : 'border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
