import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { customerDashboardApi } from '../../services/customerDashboardApi';
import type { ServicePackage } from '../../services/customerDashboardApi';
import { usePriceConversion } from '../../utils/priceConverter';

interface CategorySpotlightProps {
  categorySlug?: string;
  title?: string;
  limit?: number;
}

const CategorySpotlight: React.FC<CategorySpotlightProps> = ({
  categorySlug,
  title = 'Beauty Studio',
  limit = 6
}) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { convert, format, currency } = usePriceConversion();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeaturedPackages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[CategorySpotlight] Fetching featured packages...');
        const response = await customerDashboardApi.getFeaturedPackages({
          limit,
          category: categorySlug
        });
        console.log('[CategorySpotlight] API response:', response);
        console.log('[CategorySpotlight] Packages:', response?.packages?.length);

        if (response.packages && response.packages.length > 0) {
          setPackages(response.packages);
        } else {
          // Fallback to regular packages if no featured
          console.log('[CategorySpotlight] No featured, trying regular packages...');
          const packagesResponse = await customerDashboardApi.getPackages({
            limit,
            category: categorySlug,
            sortBy: 'popularity',
            page: 1,
          });
          console.log('[CategorySpotlight] Regular packages:', packagesResponse?.packages?.length);
          setPackages(packagesResponse.packages || []);
        }
      } catch (err) {
        console.error('Error fetching featured packages:', err);
        setError('Failed to load services');
        // Don't show error to user, just hide the section gracefully
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedPackages();
  }, [categorySlug, limit]);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
    }
  };

  // Always show section (don't hide if no packages yet)
  // Empty state will be shown instead

  return (
    <section className="py-16 px-4 bg-white relative overflow-hidden">
      {/* Decorative blur */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-nilin-blush/30 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-nilin-peach/40 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal">NILIN Certified</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-2">
              {title}
            </h2>
            <p className="text-nilin-warmGray">By NILIN Certified Artists</p>
          </div>

          <div className="hidden md:flex gap-3">
            <button
              onClick={() => scroll('left')}
              className="glass w-12 h-12 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="glass w-12 h-12 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[300px] rounded-3xl overflow-hidden">
                <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cards Carousel */}
        {!isLoading && packages.length > 0 && (
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {packages.map((pkg) => {
              // Extract price - handle both number and object format
              const getPrice = (p: any): number => {
                if (typeof p === 'number') return p;
                if (typeof p === 'object' && p !== null) return p.amount || p.currentPrice || 0;
                return 0;
              };

              const originalPrice = getPrice(pkg.pricing?.originalPrice || pkg.basePrice);
              const currentPrice = getPrice(pkg.pricing?.currentPrice || pkg.discountedPrice || originalPrice);
              const displayPrice = currentPrice > 0 ? currentPrice : originalPrice;
              const sourceCurrency = pkg.pricing?.currency || 'AED';
              const localizedPrice = format(convert(displayPrice, sourceCurrency), currency);

              // Get image
              const imageUrl = pkg.images?.[0] || pkg.image ||
                'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80';

              // Get first service name for subtitle (handle both serviceName and name)
              const firstService = pkg.services?.[0];
              const subtitle = firstService?.serviceName || firstService?.name || pkg.category || 'Professional Service';

              return (
                <button
                  key={pkg._id}
                  onClick={() => navigate(`/packages/${pkg._id}`)}
                  className="flex-shrink-0 group"
                >
                  <div className="relative w-[260px] md:w-[300px] rounded-3xl overflow-hidden shadow-lg card-3d">
                    {/* Image */}
                    <div className="aspect-[3/4] relative">
                      <img
                        src={imageUrl}
                        alt={pkg.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80';
                        }}
                      />

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Verified Badge */}
                      <div className="absolute top-4 left-4">
                        <span className="glass rounded-full px-3 py-1.5 text-xs font-medium text-nilin-charcoal flex items-center gap-1 backdrop-blur-md">
                          <Sparkles className="w-3 h-3 text-nilin-coral" />
                          {pkg.provider?.isVerified ? 'Verified' : 'NILIN Certified'}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="absolute top-4 right-4">
                        <span className="glass rounded-full px-3 py-1.5 text-xs font-semibold text-nilin-charcoal backdrop-blur-md">
                          From {localizedPrice}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                        <h3 className="text-xl font-medium text-white mb-1">{pkg.name}</h3>
                        <p className="text-sm text-white/80 mb-4">{subtitle}</p>

                        <div className="flex items-center gap-2 text-white/0 group-hover:text-white transition-all duration-300">
                          <span className="text-sm font-medium">Book Now</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && packages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-nilin-warmGray">No services available at the moment</p>
          </div>
        )}

        {/* Mobile View All */}
        {!isLoading && packages.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/search')}
              className="btn-3d inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-nilin-rose to-nilin-coral text-white"
            >
              View All Services
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default CategorySpotlight;