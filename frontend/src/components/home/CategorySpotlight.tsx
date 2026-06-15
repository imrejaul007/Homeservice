import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { customerDashboardApi } from '../../services/customerDashboardApi';
import type { ServicePackage } from '../../services/customerDashboardApi';
import { usePriceConversion } from '../../utils/priceConverter';
import { cn } from '@/lib/utils';

interface CategorySpotlightProps {
  categorySlug?: string;
  title?: string;
  limit?: number;
}

const CARD_GRADIENTS = [
  'from-rose-100/80 via-white to-amber-50/70',
  'from-purple-100/80 via-white to-pink-50/70',
  'from-teal-100/80 via-white to-cyan-50/70',
  'from-emerald-100/80 via-white to-green-50/70',
  'from-nilin-blush/70 via-white to-nilin-peach/60',
  'from-amber-100/80 via-white to-orange-50/70',
];

const getPackagePrice = (pkg: ServicePackage): number => {
  const getPrice = (p: unknown): number => {
    if (typeof p === 'number') return p;
    if (typeof p === 'object' && p !== null) {
      const obj = p as { amount?: number; currentPrice?: number };
      return obj.amount || obj.currentPrice || 0;
    }
    return 0;
  };
  const originalPrice = getPrice(pkg.pricing?.originalPrice || pkg.basePrice);
  const currentPrice = getPrice(pkg.pricing?.currentPrice || pkg.discountedPrice || originalPrice);
  return currentPrice > 0 ? currentPrice : originalPrice;
};

interface SpotlightCardProps {
  pkg: ServicePackage;
  index: number;
  localizedPrice: string;
  onSelect: () => void;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  pkg,
  index,
  localizedPrice,
  onSelect,
}) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const imageUrl =
    pkg.images?.[0] ||
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
  const firstService = pkg.services?.[0];
  const subtitle = firstService?.name || pkg.category || 'Professional Service';
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ y: isHovered ? -14 : 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="flex-shrink-0 w-[320px] sm:w-[380px] md:w-[420px] text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50 rounded-[1.75rem]"
    >
      <div className={cn('spotlight-orbit-border rounded-[1.75rem]', isHovered && 'is-orbit-active')}>
      <div
        className={cn(
          'spotlight-orbit-border-inner rounded-[1.625rem] overflow-hidden shadow-[0_16px_48px_rgba(45,45,45,0.1)]',
          'bg-gradient-to-br transition-shadow duration-500',
          gradient,
          isHovered && 'shadow-[0_28px_70px_rgba(232,180,168,0.35)]'
        )}
        style={{
          transform: isHovered
            ? `perspective(1000px) rotateX(${-tilt.y * 0.35}deg) rotateY(${tilt.x * 0.35}deg)`
            : 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
          transition: 'transform 0.35s ease, box-shadow 0.35s ease',
        }}
      >
        {/* Magazine portrait frame */}
        <div className="relative aspect-[3/4] overflow-hidden m-4 mb-0 rounded-2xl ring-1 ring-nilin-charcoal/5">
          <motion.img
            src={imageUrl}
            alt={pkg.name}
            animate={{
              scale: isHovered ? 1.1 : 1,
              x: tilt.x * 0.6,
              y: tilt.y * 0.6,
            }}
            transition={{ type: 'spring', stiffness: 180, damping: 18 }}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-nilin-charcoal/35 via-transparent to-transparent pointer-events-none" />

          <div className="absolute top-4 left-4">
            <span className="px-3.5 py-2 bg-white/90 backdrop-blur-md rounded-full text-sm font-semibold text-nilin-charcoal flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              NILIN Certified
            </span>
          </div>

          <div className="absolute top-4 right-4">
            <span className="px-3.5 py-2 bg-white/90 backdrop-blur-md rounded-full text-sm font-bold text-nilin-charcoal shadow-sm">
              From {localizedPrice}
            </span>
          </div>
        </div>

        {/* Editorial caption block */}
        <div className="p-6 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-nilin-coral mb-2">
            Studio Pick
          </p>
          <h3 className="text-2xl sm:text-[1.65rem] font-serif text-nilin-charcoal mb-2 leading-tight line-clamp-2">
            {pkg.name}
          </h3>
          <p className="text-base text-nilin-warmGray mb-5 line-clamp-1">{subtitle}</p>

          <motion.div
            animate={{ x: isHovered ? 6 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="inline-flex items-center gap-2 text-base font-semibold text-nilin-charcoal"
          >
            <span>Explore package</span>
            <ArrowRight className="w-5 h-5 text-nilin-coral transition-transform duration-300 group-hover:translate-x-1" />
          </motion.div>
        </div>
      </div>
      </div>
    </motion.button>
  );
};

const CategorySpotlight: React.FC<CategorySpotlightProps> = ({
  categorySlug,
  title = 'Beauty Studio',
  limit = 10,
}) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { convert, format, currency } = usePriceConversion();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canScroll, setCanScroll] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScroll(false);
      return;
    }
    setCanScroll(el.scrollWidth > el.clientWidth + 8);
  }, []);

  useEffect(() => {
    const fetchFeaturedPackages = async () => {
      try {
        setIsLoading(true);
        const response = await customerDashboardApi.getFeaturedPackages({
          limit,
          category: categorySlug,
        });

        if (response.packages && response.packages.length > 0) {
          setPackages(response.packages);
        } else {
          const packagesResponse = await customerDashboardApi.getPackages({
            limit,
            category: categorySlug,
            sortBy: 'popularity',
            page: 1,
          });
          setPackages(packagesResponse.packages || []);
        }
      } catch (err) {
        console.error('Error fetching featured packages:', err);
        setPackages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedPackages();
  }, [categorySlug, limit]);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [packages, isLoading, updateScrollState]);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -440 : 440, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-16 px-2 sm:px-3 lg:px-4 bg-gradient-to-b from-[#F6EFE8] via-nilin-blush/20 to-nilin-cream relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full bg-nilin-peach/30 blur-3xl translate-x-1/3 -translate-y-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-nilin-blush/40 blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-[100rem] mx-auto relative">
        {/* Header */}
        <div className="mb-10 px-1 sm:px-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm rounded-full mb-4 border border-white/80 shadow-sm">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm font-semibold text-nilin-charcoal">NILIN Certified</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-3 leading-tight">
            {title}
          </h2>
          <p className="text-lg md:text-xl text-nilin-charcoal/75 max-w-2xl">
            By NILIN Certified Artists — curated packages for every beauty moment.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[320px] sm:w-[380px] md:w-[420px] rounded-[1.75rem] overflow-hidden bg-white/60 animate-pulse">
                <div className="aspect-[3/4] m-4 mb-0 bg-gray-200/80 rounded-2xl" />
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-gray-200/80 rounded w-1/4" />
                  <div className="h-8 bg-gray-200/80 rounded w-3/4" />
                  <div className="h-4 bg-gray-200/80 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cards */}
        {!isLoading && packages.length > 0 && (
          <div
            ref={scrollRef}
            className="flex gap-5 sm:gap-6 overflow-x-auto pt-2 pb-6 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {packages.map((pkg, index) => {
              const displayPrice = getPackagePrice(pkg);
              const sourceCurrency = pkg.pricing?.currency || 'AED';
              const localizedPrice = format(convert(displayPrice, sourceCurrency), currency);

              return (
                <SpotlightCard
                  key={pkg._id}
                  pkg={pkg}
                  index={index}
                  localizedPrice={localizedPrice}
                  onSelect={() => navigate(`/packages/${pkg._id}`)}
                />
              );
            })}
          </div>
        )}

        {/* Empty */}
        {!isLoading && packages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-lg text-nilin-warmGray">No studio packages available at the moment</p>
          </div>
        )}

        {/* Nav arrows — below cards, only when scrollable */}
        {!isLoading && canScroll && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-0.5 transition-all border border-nilin-border/20"
              aria-label="Scroll studio packages left"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-0.5 transition-all border border-nilin-border/20"
              aria-label="Scroll studio packages right"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default CategorySpotlight;
