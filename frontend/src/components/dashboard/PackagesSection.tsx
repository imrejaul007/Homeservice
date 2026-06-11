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
  ArrowRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MapPin,
} from 'lucide-react';
import { packageApi, type ServicePackage, normalizeFeatures } from '../../services/packageApi';
import { usePriceConversion, CURRENCY_NAMES } from '../../utils/priceConverter';
import { useLocationStore } from '../../stores/locationStore';
import { CATEGORY_IMAGES } from '../../constants/images';

interface PackagesSectionProps {
  limit?: number;
  showViewAll?: boolean;
  category?: string;
}

const PACKAGE_CATEGORY_IMAGES: Record<string, string> = {
  bridal: CATEGORY_IMAGES.makeup.card,
  makeup: CATEGORY_IMAGES.makeup.card,
  hair: CATEGORY_IMAGES.hair.card,
  spa: CATEGORY_IMAGES['massage-body'].card,
  nails: CATEGORY_IMAGES.nails.card,
  skincare: CATEGORY_IMAGES['skin-aesthetics'].card,
  'skin & aesthetics': CATEGORY_IMAGES['skin-aesthetics'].card,
  'massage & body': CATEGORY_IMAGES['massage-body'].card,
};

const DEFAULT_PACKAGE_IMAGE = CATEGORY_IMAGES.hair.card;

const PackagesSection: React.FC<PackagesSectionProps> = ({
  limit = 3,
  showViewAll = true,
  category,
}) => {
  const navigate = useNavigate();
  const { convert, format, currency } = usePriceConversion();
  const { selectedCity, currentLocation } = useLocationStore();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const locationLabel = selectedCity?.name || currentLocation?.address.city || null;
  const currencyLabel = CURRENCY_NAMES[currency] || currency;

  const formatPackagePrice = useCallback(
    (amount: number, sourceCurrency: string) => format(convert(amount, sourceCurrency), currency),
    [convert, format, currency]
  );

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

  // Get image source with category-aware fallback
  const getPackageImage = (pkg: ServicePackage): string => {
    if (!failedImages.has(pkg._id) && pkg.images?.[0]) {
      return pkg.images[0];
    }
    const cat = pkg.category?.toLowerCase().trim() || '';
    return PACKAGE_CATEGORY_IMAGES[cat] || DEFAULT_PACKAGE_IMAGE;
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
    <section className="py-10 px-4" aria-labelledby="packages-heading">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-nilin-coral" />
              <h2
                id="packages-heading"
                className="text-2xl md:text-3xl font-serif text-nilin-charcoal"
              >
                View Packages
              </h2>
            </div>
            <p className="text-sm text-nilin-warmGray">
              Save more with bundled services
              {locationLabel && (
                <span className="inline-flex items-center gap-1 ml-2 text-nilin-coral/90">
                  · <MapPin className="w-3 h-3" /> {locationLabel}
                  · Prices in {currencyLabel}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showViewAll && (
              <button
                onClick={handleViewAll}
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-nilin text-sm font-semibold text-white bg-gradient-to-r from-nilin-coral to-nilin-rose shadow-nilin-warm hover:shadow-nilin transition-all"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-nilin-border/50 text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/40 transition-colors disabled:opacity-50"
              aria-label="Refresh packages"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg, index) => {
            const savings = getSavingsPercentage(pkg);
            const sourceCurrency = pkg.pricing?.currency || 'AED';
            const currentPrice = pkg.pricing?.currentPrice ?? 0;
            const originalPrice = pkg.pricing?.originalPrice ?? 0;
            const displayCurrent = formatPackagePrice(currentPrice, sourceCurrency);
            const displayOriginal =
              originalPrice > currentPrice
                ? formatPackagePrice(originalPrice, sourceCurrency)
                : null;
            const displaySavings =
              originalPrice > currentPrice
                ? formatPackagePrice(originalPrice - currentPrice, sourceCurrency)
                : null;

            return (
              <article
                key={pkg._id}
                className="group flex flex-col bg-white rounded-2xl border border-nilin-border/40 overflow-hidden shadow-sm hover:shadow-nilin hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                onClick={() => handlePackageClick(pkg)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePackageClick(pkg);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View ${pkg.name} package, ${displayCurrent}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image Section */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={getPackageImage(pkg)}
                    alt={pkg.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={() => handleImageError(pkg._id)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {savings > 0 && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-md">
                      Save {savings}%
                    </div>
                  )}

                  {pkg.isFeatured && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-nilin-coral text-white rounded-full text-xs font-bold shadow-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Featured
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/55 backdrop-blur-sm text-white rounded-full text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {typeof pkg.duration === 'string' ? pkg.duration : pkg.duration?.formatted ?? 'N/A'}
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-col flex-1 p-5">
                  <span className="inline-block self-start px-2.5 py-0.5 bg-nilin-blush/60 text-nilin-coral text-xs font-semibold rounded-full mb-2 capitalize">
                    {pkg.category}
                  </span>

                  <h3 className="font-serif text-lg text-nilin-charcoal mb-1 group-hover:text-nilin-coral transition-colors line-clamp-1">
                    {pkg.name}
                  </h3>

                  {pkg.shortDescription && (
                    <p className="text-sm text-nilin-warmGray line-clamp-2 mb-3">
                      {pkg.shortDescription}
                    </p>
                  )}

                  <div className="space-y-1.5 mb-4 flex-1">
                    {normalizeFeatures(pkg.features).slice(0, 3).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-nilin-charcoal/80">
                        {feature.included ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-nilin-border flex-shrink-0" />
                        )}
                        <span className={feature.included ? '' : 'text-nilin-warmGray line-through'}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                    {(normalizeFeatures(pkg.features).length ?? 0) > 3 && (
                      <span className="text-xs text-nilin-coral font-medium">
                        +{normalizeFeatures(pkg.features).length - 3} more included
                      </span>
                    )}
                  </div>

                  {pkg.stats && pkg.stats.rating !== undefined && (
                    <div className="flex items-center gap-2 mb-4 text-xs text-nilin-warmGray">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="font-medium text-nilin-charcoal">
                          {pkg.stats.rating.toFixed(1)}
                        </span>
                      </div>
                      <span>({pkg.stats.reviewCount ?? 0} reviews)</span>
                      <span className="text-nilin-border">|</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {pkg.stats.totalPurchases ?? 0} sold
                      </span>
                    </div>
                  )}

                  {/* Price & CTA */}
                  <div className="pt-4 border-t border-nilin-border/30 mt-auto">
                    <div className="flex items-end justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs text-nilin-warmGray mb-0.5">Bundle price</p>
                        <p className="text-2xl font-bold text-nilin-coral leading-none">
                          {displayCurrent}
                        </p>
                        {displayOriginal && (
                          <p className="text-sm text-nilin-warmGray line-through mt-1">
                            {displayOriginal}
                          </p>
                        )}
                        {displaySavings && savings > 0 && (
                          <p className="text-xs text-emerald-600 font-medium mt-1">
                            You save {displaySavings}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePackageClick(pkg);
                        }}
                        className="flex-1 py-2.5 border border-nilin-border/60 text-nilin-charcoal rounded-xl text-sm font-medium hover:bg-nilin-blush/40 transition-all"
                      >
                        View details
                      </button>
                      <button
                        onClick={(e) => handleBookNow(e, pkg)}
                        className="flex-1 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl text-sm font-semibold hover:shadow-nilin transition-all"
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
          <div className="mt-8 text-center sm:hidden">
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl text-sm font-semibold shadow-nilin-warm transition-all"
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
