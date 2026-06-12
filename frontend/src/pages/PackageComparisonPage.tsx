import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Scale,
  Star,
  Clock,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Trophy,
  TrendingUp,
  Zap,
  Users,
  Info,
  RefreshCw,
  ArrowLeft,
  ShoppingCart,
  Heart,
  Share2,
  Filter,
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import Button from '../components/common/Button';
import { packageComparisonApi, ComparisonPackage, ComparisonMetrics, RecommendedPackage } from '../services/packageComparisonApi';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const MAX_COMPARE_PACKAGES = 5;
const MIN_COMPARE_PACKAGES = 2;

interface PackageComparisonPageProps {
  initialPackageIds?: string[];
}

const PackageComparisonPage: React.FC<PackageComparisonPageProps> = ({ initialPackageIds }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [packages, setPackages] = useState<ComparisonPackage[]>([]);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [recommendedPackages, setRecommendedPackages] = useState<RecommendedPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Get package IDs from URL, props, or session storage
  const packageIdsFromUrl = useMemo(() => {
    const ids = searchParams.get('ids');
    return ids ? ids.split(',').filter(id => id) : [];
  }, [searchParams]);

  // Get package IDs from session storage
  const packageIdsFromSession = useMemo(() => {
    const stored = sessionStorage.getItem('comparePackageIds');
    return stored ? JSON.parse(stored) : [];
  }, []);

  // Combine all sources: props > URL > session storage
  const compareIds = useMemo(() => {
    if (initialPackageIds && initialPackageIds.length > 0) {
      return initialPackageIds;
    }
    if (packageIdsFromUrl.length > 0) {
      return packageIdsFromUrl;
    }
    // Clear session storage after use
    if (packageIdsFromSession.length > 0) {
      sessionStorage.removeItem('comparePackageIds');
    }
    return packageIdsFromSession;
  }, [initialPackageIds, packageIdsFromUrl, packageIdsFromSession]);

  // Format price
  const formatPrice = (price: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Fetch comparison data
  const fetchComparison = useCallback(async (ids: string[]) => {
    if (ids.length < MIN_COMPARE_PACKAGES) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await packageComparisonApi.compare(ids);
      setPackages(data.packages);
      setMetrics(data.comparisonMetrics);
      setSelectedIds(ids);
    } catch (err: any) {
      setError(err.message || 'Failed to load comparison');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch recommended packages for adding more
  const fetchRecommended = useCallback(async (excludeIds: string[]) => {
    setIsLoadingRecommended(true);
    try {
      const data = await packageComparisonApi.getRecommended({
        excludeIds,
      });
      // Filter out already selected packages
      const available = data.packages.filter(
        (pkg) => !excludeIds.includes(pkg._id)
      );
      setRecommendedPackages(available);
    } catch (err: any) {
      console.error('Failed to fetch recommended packages:', err);
    } finally {
      setIsLoadingRecommended(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (compareIds.length >= MIN_COMPARE_PACKAGES) {
      fetchComparison(compareIds);
      fetchRecommended(compareIds);
    } else {
      setIsLoading(false);
      fetchRecommended([]);
    }
  }, [compareIds, fetchComparison, fetchRecommended]);

  // Handle adding a package to comparison
  const handleAddPackage = (pkgId: string) => {
    if (selectedIds.length >= MAX_COMPARE_PACKAGES) {
      toast.error(`Maximum ${MAX_COMPARE_PACKAGES} packages can be compared`);
      return;
    }
    if (selectedIds.includes(pkgId)) {
      toast.error('Package already in comparison');
      return;
    }

    const newIds = [...selectedIds, pkgId];
    setSelectedIds(newIds);

    // Update URL
    setSearchParams({ ids: newIds.join(',') });
    fetchComparison(newIds);
    setShowAddModal(false);
  };

  // Handle removing a package from comparison
  const handleRemovePackage = (pkgId: string) => {
    const newIds = selectedIds.filter(id => id !== pkgId);
    setSelectedIds(newIds);

    if (newIds.length >= MIN_COMPARE_PACKAGES) {
      setSearchParams({ ids: newIds.join(',') });
      fetchComparison(newIds);
    } else {
      setSearchParams({});
      setPackages([]);
      setMetrics(null);
      fetchRecommended(newIds);
    }
  };

  // Check if a metric is the best
  const isBestValue = (pkg: ComparisonPackage) => {
    return metrics?.bestValue?._id === pkg._id;
  };

  const isHighestRated = (pkg: ComparisonPackage) => {
    return metrics?.highestRated?._id === pkg._id;
  };

  const isShortestDuration = (pkg: ComparisonPackage) => {
    return metrics?.shortestDuration?._id === pkg._id;
  };

  const isMostPopular = (pkg: ComparisonPackage) => {
    return metrics?.mostPopular?._id === pkg._id;
  };

  // Highlight styling for best values
  const getBestBadge = (pkg: ComparisonPackage) => {
    if (isBestValue(pkg)) {
      return { icon: Trophy, label: 'Best Value', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    }
    if (isHighestRated(pkg) && metrics?.ratingRange?.hasRated) {
      return { icon: Star, label: 'Top Rated', className: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
    if (isShortestDuration(pkg)) {
      return { icon: Clock, label: 'Quickest', className: 'bg-green-100 text-green-800 border-green-300' };
    }
    if (isMostPopular(pkg)) {
      return { icon: Users, label: 'Most Popular', className: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-nilin-warmGray">Loading comparison...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Not enough packages to compare
  if (packages.length === 0 && !showAddModal) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Breadcrumb
            items={[
              { label: 'Packages', href: '/packages' },
              { label: 'Compare' },
            ]}
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="w-20 h-20 bg-nilin-coral/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Scale className="w-10 h-10 text-nilin-coral" />
            </div>
            <h1 className="text-2xl font-serif text-nilin-charcoal mb-3">
              Compare Packages
            </h1>
            <p className="text-nilin-warmGray mb-6">
              Select at least 2 packages to compare them side-by-side.
            </p>

            {/* Recommended packages to add */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-nilin-charcoal mb-3 text-left">
                Popular Packages to Compare
              </h3>
              {isLoadingRecommended ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendedPackages.slice(0, 4).map((pkg) => (
                    <div
                      key={pkg._id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-medium text-nilin-charcoal line-clamp-1">
                          {pkg.name}
                        </p>
                        <p className="text-sm text-nilin-warmGray">
                          {formatPrice(pkg.price)} • {pkg.duration} min
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddPackage(pkg._id)}
                        disabled={selectedIds.length >= MAX_COMPARE_PACKAGES}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/packages')}
                className="flex-1"
              >
                Browse Packages
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                className="flex-1"
                disabled={selectedIds.length >= MAX_COMPARE_PACKAGES}
              >
                Add More
              </Button>
            </div>

            {selectedIds.length > 0 && selectedIds.length < MIN_COMPARE_PACKAGES && (
              <p className="text-sm text-orange-600 mt-4">
                Select at least {MIN_COMPARE_PACKAGES - selectedIds.length} more package(s) to compare
              </p>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb
          items={[
            { label: 'Packages', href: '/packages' },
            { label: 'Compare' },
          ]}
        />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-serif text-nilin-charcoal flex items-center gap-3">
                <Scale className="w-8 h-8 text-nilin-coral" />
                Compare Packages
              </h1>
              <p className="text-nilin-warmGray mt-1">
                Comparing {packages.length} package{packages.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                disabled={selectedIds.length >= MAX_COMPARE_PACKAGES}
              >
                <Filter className="w-4 h-4 mr-2" />
                Add Package
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/packages')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Packages
              </Button>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchComparison(selectedIds)}
                className="mt-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {/* Comparison Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Mobile Horizontal Scroll */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-nilin-charcoal w-40 sticky left-0 bg-gray-50">
                      Package
                    </th>
                    {packages.map((pkg) => (
                      <th key={pkg._id} className="px-4 py-3 text-center min-w-[200px]">
                        <div className="relative">
                          {/* Remove button */}
                          <button
                            onClick={() => handleRemovePackage(pkg._id)}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-colors"
                            title="Remove from comparison"
                          >
                            <X className="w-4 h-4" />
                          </button>

                          {/* Package Card */}
                          <Link to={`/packages/${pkg._id}`} className="block">
                            <div className="w-full h-32 bg-gradient-to-br from-nilin-coral/20 to-nilin-blush/30 rounded-lg mb-2 flex items-center justify-center">
                              <span className="text-5xl opacity-30">📦</span>
                            </div>
                            <h3 className="font-medium text-nilin-charcoal line-clamp-2 text-sm">
                              {pkg.name}
                            </h3>
                            <p className="text-xs text-nilin-warmGray mt-1">
                              {pkg.provider.name}
                            </p>

                            {/* Best badge */}
                            {(() => {
                              const badge = getBestBadge(pkg);
                              if (!badge) return null;
                              const Icon = badge.icon;
                              return (
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-2 ${badge.className}`}>
                                  <Icon className="w-3 h-3" />
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price Row */}
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal sticky left-0 bg-white">
                      Price
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-center">
                        <div>
                          <span className="text-xl font-bold text-nilin-charcoal">
                            {formatPrice(pkg.pricing.currentPrice)}
                          </span>
                          {pkg.pricing.hasDiscount && (
                            <span className="text-sm text-nilin-warmGray line-through ml-2">
                              {formatPrice(pkg.pricing.originalPrice)}
                            </span>
                          )}
                        </div>
                        {pkg.pricing.hasDiscount && (
                          <span className="text-xs text-green-600 font-medium">
                            Save {pkg.pricing.discountPercentage}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Duration Row */}
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal sticky left-0 bg-gray-50/50">
                      <Clock className="w-4 h-4 inline mr-2 text-nilin-coral" />
                      Duration
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-center">
                        <span className={isShortestDuration(pkg) ? 'text-green-600 font-medium' : ''}>
                          {pkg.duration.formatted}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Rating Row */}
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal sticky left-0 bg-white">
                      <Star className="w-4 h-4 inline mr-2 text-yellow-400 fill-yellow-400" />
                      Rating
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-medium ${isHighestRated(pkg) ? 'text-green-600' : ''}`}>
                            {pkg.stats.rating > 0 ? pkg.stats.rating.toFixed(1) : 'N/A'}
                          </span>
                          <span className="text-sm text-nilin-warmGray">
                            ({pkg.stats.reviewCount})
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Booking Count Row */}
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal sticky left-0 bg-gray-50/50">
                      <Users className="w-4 h-4 inline mr-2 text-nilin-coral" />
                      Bookings
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-center">
                        <span className={isMostPopular(pkg) ? 'text-green-600 font-medium' : ''}>
                          {pkg.stats.bookingCount > 0 ? pkg.stats.bookingCount.toLocaleString() : 'New'}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Verified Provider Row */}
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal sticky left-0 bg-white">
                      <Check className="w-4 h-4 inline mr-2 text-green-500" />
                      Verified
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-center">
                        {pkg.provider.isVerified ? (
                          <span className="text-green-600">Verified</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Instant Booking Row */}
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal sticky left-0 bg-gray-50/50">
                      <Zap className="w-4 h-4 inline mr-2 text-yellow-500" />
                      Instant Booking
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-center">
                        {pkg.availability.instantBooking ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Included Items Header */}
                  <tr className="bg-nilin-coral/5">
                    <td colSpan={packages.length + 1} className="px-4 py-2 text-sm font-medium text-nilin-charcoal">
                      <Info className="w-4 h-4 inline mr-2" />
                      Included Items ({(() => {
                        const allItems = new Set<string>();
                        packages.forEach(pkg => {
                          ((pkg as { includedItems?: Array<{ name: string } | string> }).includedItems || []).forEach(item => allItems.add(typeof item === 'string' ? item : (item as { name: string }).name));
                        });
                        return allItems.size;
                      })()})
                    </td>
                  </tr>

                  {/* Included Items Row */}
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 sticky left-0 bg-white" colSpan={packages.length + 1}>
                      <div className="grid grid-cols-1 divide-y divide-gray-100">
                        {/* Get all unique included items */}
                        {(() => {
                          const allItems = new Set<string>();
                          packages.forEach(pkg => {
                            ((pkg as { includedItems?: Array<{ name: string } | string> }).includedItems || []).forEach(item => {
                              const itemName = typeof item === 'string' ? item : (item as { name: string }).name;
                              allItems.add(itemName);
                            });
                          });

                          return Array.from(allItems).map(item => (
                            <div key={item} className="grid grid-cols-[160px_repeat(auto-fit,minmax(200px,1fr))] items-center py-2">
                              <span className="text-sm text-nilin-warmGray pl-4">{item}</span>
                              {packages.map(pkg => {
                                const pkgItems = (pkg.includedItems || []).map(i => typeof i === 'string' ? i : i.name);
                                return (
                                  <div key={pkg._id} className="text-center px-4">
                                    {pkgItems.includes(item) ? (
                                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                                    ) : (
                                      <X className="w-5 h-5 text-gray-300 mx-auto" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ));
                        })()}
                      </div>
                    </td>
                  </tr>

                  {/* Description Row */}
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium text-nilin-charcoal align-top sticky left-0 bg-white">
                      Description
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-3 text-sm text-nilin-warmGray align-top">
                        <p className="line-clamp-4">
                          {pkg.shortDescription || pkg.description}
                        </p>
                      </td>
                    ))}
                  </tr>

                  {/* Action Row */}
                  <tr>
                    <td className="px-4 py-4 sticky left-0 bg-white">
                      Actions
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg._id} className="px-4 py-4 text-center">
                        <div className="space-y-2">
                          <Button
                            onClick={() => navigate(`/book-package/${pkg._id}`)}
                            className="w-full"
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Book Now
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/packages/${pkg._id}`);
                                toast.success('Link copied!');
                              }}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Insights */}
          {metrics && (
            <div className="mt-6 bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-medium text-nilin-charcoal mb-4">
                <TrendingUp className="w-5 h-5 inline mr-2 text-nilin-coral" />
                Key Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.priceRange && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-nilin-warmGray mb-1">Price Range</p>
                    <p className="text-lg font-medium text-nilin-charcoal">
                      {formatPrice(metrics.priceRange.min)} - {formatPrice(metrics.priceRange.max)}
                    </p>
                  </div>
                )}
                {metrics.ratingRange?.hasRated && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-nilin-warmGray mb-1">Highest Rated</p>
                    <p className="text-lg font-medium text-nilin-charcoal">
                      {metrics.ratingRange.max.toFixed(1)} <Star className="w-4 h-4 inline text-yellow-400 fill-yellow-400" />
                    </p>
                  </div>
                )}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-nilin-warmGray mb-1">Duration Range</p>
                  <p className="text-lg font-medium text-nilin-charcoal">
                    {Math.min(...packages.map(p => p.duration.totalMinutes))} - {Math.max(...packages.map(p => p.duration.totalMinutes))} min
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-nilin-warmGray mb-1">Most Inclusions</p>
                  <p className="text-lg font-medium text-nilin-charcoal">
                    {Math.max(...packages.map(p => p.includedItems.length))} items
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Package Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-nilin-charcoal">Add Package to Compare</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {isLoadingRecommended ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendedPackages.length === 0 ? (
                    <p className="text-center text-nilin-warmGray py-8">
                      No more packages available to compare.
                    </p>
                  ) : (
                    recommendedPackages.map((pkg) => (
                      <div
                        key={pkg._id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-nilin-charcoal line-clamp-1">
                            {pkg.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                            <span>{formatPrice(pkg.price)}</span>
                            <span>•</span>
                            <span>{pkg.duration} min</span>
                            {pkg.rating > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                  {pkg.rating.toFixed(1)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddPackage(pkg._id)}
                        >
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => navigate('/packages')}
                className="w-full"
              >
                Browse All Packages
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default PackageComparisonPage;
