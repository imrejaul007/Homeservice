/**
 * PackagesSection Component - Enhanced with Spotlight Effect
 * Displays service packages in a beautiful large card grid layout
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Gift,
  TrendingUp,
} from 'lucide-react';
import { packageApi, type ServicePackage, normalizeFeatures } from '../../services/packageApi';
import { usePriceConversion, CURRENCY_NAMES } from '../../utils/priceConverter';
import { useLocationStore } from '../../stores/locationStore';
import { CATEGORY_IMAGES } from '../../constants/images';
import { Spotlight } from '../ui/spotlight';

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

  const normalizePackage = (pkg: ServicePackage): ServicePackage => {
    if (pkg.includedItems && !pkg.features) {
      return { ...pkg, features: pkg.includedItems };
    }
    return pkg;
  };

  const handleImageError = (pkgId: string) => {
    setFailedImages(prev => new Set(prev).add(pkgId));
  };

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
      <section className="py-16 px-4 bg-gradient-to-b from-nilin-cream to-white">
        <div className="max-w-7xl mx-auto">
          {/* Section Header Skeleton */}
          <div className="flex items-center justify-between mb-12">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 rounded-xl w-56 mb-3" />
              <div className="h-5 bg-gray-100 rounded w-80" />
            </div>
          </div>

          {/* Large Cards Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse shadow-lg"
              >
                <div className="h-72 bg-gradient-to-br from-gray-100 to-gray-200" />
                <div className="p-8 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
                    <div className="h-8 bg-gray-200 rounded w-28" />
                    <div className="h-12 bg-gray-200 rounded w-32" />
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
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 rounded-3xl p-10 text-center border border-red-100 shadow-lg">
            <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-700 mb-2">
              Unable to load packages
            </h3>
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-2xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (packages.length === 0) {
    return (
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-14 text-center border-2 border-dashed border-gray-200">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Packages Available
            </h3>
            <p className="text-base text-gray-500 max-w-md mx-auto mb-8">
              Check back soon for exciting service packages tailored just for you.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-2xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              Browse Services
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-nilin-cream via-white to-nilin-cream" aria-labelledby="packages-heading">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Section Header */}
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-nilin-coral/10 to-nilin-rose/10 rounded-full mb-6"
          >
            <Gift className="w-5 h-5 text-nilin-coral" />
            <span className="text-sm font-semibold text-nilin-coral">Exclusive Deals</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            id="packages-heading"
            className="text-4xl md:text-5xl font-serif font-bold text-nilin-charcoal mb-4"
          >
            View Packages
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-nilin-warmGray max-w-2xl mx-auto"
          >
            Save more with bundled services
            {locationLabel && (
              <span className="inline-flex items-center gap-1 ml-2 text-nilin-coral/90">
                · <MapPin className="w-4 h-4" /> {locationLabel}
                · Prices in {currencyLabel}
              </span>
            )}
          </motion.p>

          {showViewAll && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8"
            >
              <button
                onClick={handleViewAll}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-nilin-coral to-nilin-rose shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                View All Packages
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </div>

        {/* Enhanced Cards Grid - Larger Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
              <motion.article
                key={pkg._id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                viewport={{ once: true }}
                className="group relative flex flex-col bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer"
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
              >
                {/* Spotlight Effect */}
                <Spotlight className="opacity-0 group-hover:opacity-100 transition-opacity duration-500" fill="rgba(232, 180, 168, 0.15)" />

                {/* Large Image Section */}
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={getPackageImage(pkg)}
                    alt={pkg.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                    onError={() => handleImageError(pkg._id)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                  {savings > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="absolute top-4 left-4 px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold shadow-lg flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Save {savings}%
                    </motion.div>
                  )}

                  {pkg.isFeatured && (
                    <div className="absolute top-4 right-4 px-4 py-2 bg-nilin-coral text-white rounded-full text-sm font-bold shadow-lg flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Featured
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 px-4 py-2 bg-black/55 backdrop-blur-sm text-white rounded-full text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {typeof pkg.duration === 'string' ? pkg.duration : pkg.duration?.formatted ?? 'N/A'}
                  </div>
                </div>

                {/* Enhanced Content Section */}
                <div className="flex flex-col flex-1 p-8">
                  <span className="inline-block self-start px-4 py-1.5 bg-nilin-blush/60 text-nilin-coral text-sm font-bold rounded-full mb-4 capitalize">
                    {pkg.category}
                  </span>

                  <h3 className="font-serif text-2xl text-nilin-charcoal mb-3 group-hover:text-nilin-coral transition-colors line-clamp-1">
                    {pkg.name}
                  </h3>

                  {pkg.shortDescription && (
                    <p className="text-base text-nilin-warmGray line-clamp-2 mb-5">
                      {pkg.shortDescription}
                    </p>
                  )}

                  {/* Features List */}
                  <div className="space-y-2.5 mb-6 flex-1">
                    {normalizeFeatures(pkg.features).slice(0, 4).map((feature, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-3 text-sm text-nilin-charcoal/90"
                      >
                        {feature.included ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-nilin-border flex-shrink-0" />
                        )}
                        <span className={feature.included ? '' : 'text-nilin-warmGray line-through'}>
                          {feature.name}
                        </span>
                      </motion.div>
                    ))}
                    {(normalizeFeatures(pkg.features).length ?? 0) > 4 && (
                      <span className="text-sm text-nilin-coral font-semibold">
                        +{normalizeFeatures(pkg.features).length - 4} more included
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  {pkg.stats && pkg.stats.rating !== undefined && (
                    <div className="flex items-center gap-4 mb-6 text-sm text-nilin-warmGray">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-nilin-charcoal">
                          {pkg.stats.rating.toFixed(1)}
                        </span>
                      </div>
                      <span>({pkg.stats.reviewCount ?? 0} reviews)</span>
                      <span className="text-nilin-border">|</span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {pkg.stats.totalPurchases ?? 0} sold
                      </span>
                    </div>
                  )}

                  {/* Price & CTA */}
                  <div className="pt-6 border-t border-nilin-border/30 mt-auto">
                    <div className="flex items-end justify-between gap-4 mb-5">
                      <div>
                        <p className="text-sm text-nilin-warmGray mb-1">Bundle price</p>
                        <p className="text-3xl font-bold text-nilin-coral leading-none">
                          {displayCurrent}
                        </p>
                        {displayOriginal && (
                          <p className="text-base text-nilin-warmGray line-through mt-1.5">
                            {displayOriginal}
                          </p>
                        )}
                        {displaySavings && savings > 0 && (
                          <p className="text-sm text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                            <Gift className="w-4 h-4" />
                            You save {displaySavings}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePackageClick(pkg);
                        }}
                        className="flex-1 py-3.5 border-2 border-nilin-border/60 text-nilin-charcoal rounded-2xl text-sm font-semibold hover:bg-nilin-blush/40 hover:border-nilin-coral/30 transition-all"
                      >
                        View details
                      </button>
                      <button
                        onClick={(e) => handleBookNow(e, pkg)}
                        className="flex-1 py-3.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-2xl text-sm font-bold hover:shadow-lg transition-all"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Mobile View All Button */}
        {showViewAll && packages.length > 0 && (
          <div className="mt-12 text-center lg:hidden">
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-2xl text-sm font-bold shadow-lg transition-all"
            >
              View All Packages
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PackagesSection;
