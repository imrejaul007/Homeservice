/**
 * PackagesSection Component
 * Displays service packages in a beautiful card grid layout
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  Star,
  Users,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { packageApi, type ServicePackage, normalizeFeatures, isFeatureIncluded, getFeatureText } from '../../services/packageApi';

interface PackagesSectionProps {
  limit?: number;
  showViewAll?: boolean;
  category?: string;
}

const PackagesSection: React.FC<PackagesSectionProps> = ({
  limit = 3,
  showViewAll = true,
  category,
}) => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Normalize backend response: backend returns includedItems, frontend expects features
  const normalizePackage = (pkg: ServicePackage): ServicePackage => {
    if (pkg.includedItems && !pkg.features) {
      return { ...pkg, features: pkg.includedItems };
    }
    return pkg;
  };

  // Handle image load errors with graceful fallback
  const handleImageError = (pkgId: string) => {
    setFailedImages(prev => new Set(prev).add(pkgId));
  };

  // Get image source with fallback
  const getPackageImage = (pkg: ServicePackage): string => {
    if (failedImages.has(pkg._id)) {
      return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80';
    }
    return pkg.images?.[0] || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80';
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPackages = useCallback(async () => {
    try {
      setError(null);
      const filters = {
        limit,
        isFeatured: true,
        ...(category && { category }),
      };
      const response = await packageApi.getPackages(filters);
      setPackages(response.packages.slice(0, limit).map(normalizePackage));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  }, [limit, category]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPackages();
    setIsRefreshing(false);
  };

  const handlePackageClick = (pkg: ServicePackage) => {
    navigate(`/packages/${pkg._id}`);
  };

  const handleBookNow = (e: React.MouseEvent, pkg: ServicePackage) => {
    e.stopPropagation();
    navigate(`/book-package/${pkg._id}`);
  };

  const handleViewAll = () => {
    navigate('/packages');
  };

  const getSavingsPercentage = (pkg: ServicePackage): number => {
    const originalPrice = pkg.pricing?.originalPrice ?? 0;
    const currentPrice = pkg.pricing?.currentPrice ?? 0;
    if (originalPrice <= 0) return 0;
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  };

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="animate-pulse">
              <div className="h-7 bg-gray-200 rounded-lg w-48 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-72" />
            </div>
          </div>

          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-gradient-to-br from-gray-100 to-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                    <div className="h-6 bg-gray-200 rounded w-20" />
                    <div className="h-8 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-100">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">
              Unable to load packages
            </h3>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (packages.length === 0) {
    return (
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Packages Available
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Check back soon for exciting service packages tailored just for you.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-nilin-rose hover:bg-nilin-coral text-white rounded-xl text-sm font-medium transition-all shadow-nilin-warm hover:shadow-nilin-lg"
            >
              Browse Services
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8" aria-labelledby="packages-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2
                id="packages-heading"
                className="text-xl md:text-2xl font-serif font-light text-nilin-charcoal"
              >
                View Packages
              </h2>
            </div>
            <p className="text-sm text-nilin-warmGray">
              Save more with bundled services
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showViewAll && (
              <button
                onClick={handleViewAll}
                className="hidden sm:flex items-center gap-1 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Refresh packages"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg, index) => {
            const savings = getSavingsPercentage(pkg);
            const displayPrice = pkg.pricing?.currentPrice ?? 0;
            const originalPrice = pkg.pricing?.originalPrice ?? 0;
            const currency = pkg.pricing?.currency || 'AED';

            return (
              <article
                key={pkg._id}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                onClick={() => handlePackageClick(pkg)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePackageClick(pkg);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View ${pkg.name} package`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image Section */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={getPackageImage(pkg)}
                    alt={pkg.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={() => handleImageError(pkg._id)}
                  />

                  {/* Savings Badge */}
                  {savings > 0 && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-xs font-bold shadow-lg">
                      Save {savings}%
                    </div>
                  )}

                  {/* Featured Badge */}
                  {pkg.isFeatured && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Featured
                    </div>
                  )}

                  {/* Duration Badge */}
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm text-white rounded-full text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {typeof pkg.duration === 'string' ? pkg.duration : pkg.duration?.formatted ?? 'N/A'}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-5">
                  {/* Category Tag */}
                  <span className="inline-block px-2 py-0.5 bg-nilin-blush/50 text-nilin-rose text-xs font-medium rounded-full mb-2">
                    {pkg.category}
                  </span>

                  {/* Title */}
                  <h3 className="font-sans font-semibold text-nilin-charcoal text-base mb-1.5 group-hover:text-nilin-rose transition-colors line-clamp-1">
                    {pkg.name}
                  </h3>

                  {/* Short Description */}
                  {pkg.shortDescription && (
                    <p className="text-sm text-nilin-warmGray line-clamp-2 mb-3">
                      {pkg.shortDescription}
                    </p>
                  )}

                  {/* Features Preview */}
                  <div className="space-y-1.5 mb-4">
                    {normalizeFeatures(pkg.features).slice(0, 3).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                        {feature.included ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        )}
                        <span className={feature.included ? '' : 'text-gray-400 line-through'}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                    {(normalizeFeatures(pkg.features).length ?? 0) > 3 && (
                      <span className="text-xs text-nilin-coral font-medium">
                        +{normalizeFeatures(pkg.features).length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Rating & Reviews */}
                  {pkg.stats && pkg.stats.rating !== undefined && (
                    <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="font-medium text-gray-700">
                          {pkg.stats.rating.toFixed(1)}
                        </span>
                      </div>
                      <span>({pkg.stats.reviewCount ?? 0} reviews)</span>
                      <span className="text-gray-300">|</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {pkg.stats.totalPurchases ?? 0} sold
                      </span>
                    </div>
                  )}

                  {/* Price & CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      <span className="text-2xl font-bold text-nilin-charcoal">
                        {currency} {displayPrice}
                      </span>
                      {originalPrice > displayPrice && (
                        <span className="text-sm text-gray-400 line-through ml-2">
                          {currency} {originalPrice}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePackageClick(pkg);
                        }}
                        className="flex items-center gap-1 px-3 py-2 border border-nilin-border/50 text-nilin-charcoal rounded-xl text-xs font-medium hover:bg-gray-50 transition-all"
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => handleBookNow(e, pkg)}
                        className="flex items-center gap-1 px-3 py-2 bg-nilin-primary text-white rounded-xl text-xs font-semibold hover:bg-nilin-coral transition-all"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Mobile View All Button */}
        {showViewAll && packages.length > 0 && (
          <div className="mt-6 text-center sm:hidden">
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-6 py-3 bg-nilin-primary/10 text-nilin-primary rounded-xl text-sm font-semibold hover:bg-nilin-primary hover:text-white transition-all"
            >
              View All Packages
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PackagesSection;
