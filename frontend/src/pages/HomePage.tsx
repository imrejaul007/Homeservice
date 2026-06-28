import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, ChevronLeft, Sparkles, ArrowRight, MapPin } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import HeroSearchBar from '../components/search/HeroSearchBar';
import TrendingSearches from '../components/search/TrendingSearches';
import { searchApi } from '../services/searchApi';
import type { Service } from '../types/service';
import { CATEGORY_IMAGES, SUBCATEGORY_IMAGES, REFERENCE_IMAGES } from '../constants/images';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { usePriceConversion, formatPrice } from '../utils/priceConverter';
import {
  CategoryCards,
  OfferBanner,
  CategorySpotlight,
  CuratedReels,
  WhyNilin,
  ProviderCTA,
  ParallaxServiceSlider,
} from '../components/home';
import RecommendedProsSection from '../components/dashboard/RecommendedProsSection';
import PackagesSection from '../components/dashboard/PackagesSection';
import OngoingBookings from '../components/dashboard/OngoingBookings';
import RecentActivity from '../components/dashboard/RecentActivity';
import NotificationsSection from '../components/dashboard/NotificationsSection';
import LoggedInHomeBanner from '../components/home/LoggedInHomeBanner';
import { DashboardBubbleButton } from '../components/ui/DashboardBubbleButton';
import ExperienceSection from '../components/experience/ExperienceSection';
import { PageErrorBoundary } from '../components/common/PageErrorBoundary';
import PopularServiceCard from '../components/home/PopularServiceCard';
import { homeTrendingApi } from '../services/homeTrendingApi';
import { useHeroSlides } from '../hooks/useHeroSlides';
import LazyInViewport from '../components/common/LazyInViewport';

const formatHappyClients = (count: number): string => {
  if (count <= 0) return '0';
  return `${count.toLocaleString()}+`;
};

// UNIFIED HERO CAROUSEL - loaded from API with static fallback
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { selectedCity, currentLocation } = useLocationStore();
  const { convert, format, currency } = usePriceConversion();
  const { slides: heroSlides } = useHeroSlides();
  const [popularServices, setPopularServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [platformStats, setPlatformStats] = useState({
    happyClients: 0,
    averageRating: 0,
    totalReviews: 0,
    verifiedProfessionals: 0,
    serviceCategories: 0,
  });
  const popularScrollRef = useRef<HTMLDivElement>(null);

  const activeSlide = heroSlides[currentSlide] ?? heroSlides[0];

  useEffect(() => {
    if (currentSlide >= heroSlides.length) {
      setCurrentSlide(0);
    }
  }, [heroSlides.length, currentSlide]);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchServices = async () => {
      try {
        setIsLoading(true);
        const [popularRes, statsRes] = await Promise.all([
          searchApi.searchServices({ limit: 8, sortBy: 'popularity' }, abortController.signal),
          homeTrendingApi.getPlatformStats(abortController.signal).catch(() => null),
        ]);
        if (popularRes.success && popularRes.data.services && isMounted) {
          setPopularServices(popularRes.data.services);
        }
        if (statsRes && isMounted) {
          setPlatformStats(statsRes);
        }
      } catch (error) {
        // Ignore abort/cancel errors — expected on unmount or rapid navigation
        if (axios.isCancel(error)) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error fetching services:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchServices();
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);

    // FIX: Proper cleanup order - abort request BEFORE clearing interval
    // This prevents race conditions where the fetch completes after abort
    return () => {
      isMounted = false;
      abortController.abort(); // Abort first to stop in-flight requests
      clearInterval(interval); // Then clear the interval
    };
  }, [heroSlides.length]);

  const handleServiceClick = (serviceId: string) => {
    navigate(`/services/${serviceId}`);
  };

  const getServiceImage = (service: Service): string => {
    if (service.images && service.images.length > 0) return service.images[0];
    const catSlug = service.category?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
    const subSlug = service.subcategory?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
    if (catSlug && subSlug && SUBCATEGORY_IMAGES[catSlug]?.[subSlug]) {
      return SUBCATEGORY_IMAGES[catSlug][subSlug];
    }
    if (catSlug && CATEGORY_IMAGES[catSlug]) {
      return CATEGORY_IMAGES[catSlug].card;
    }
    return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop';
  };

  // Get converted price for display (backend stores prices in AED by default)
  const getDisplayPrice = (service: Service): string => {
    const rawPrice = service.price?.amount || 0;
    const sourceCurrency = service.price?.currency || 'AED';
    return format(convert(rawPrice, sourceCurrency), currency);
  };

  const dashboardPath =
    user?.role === 'provider'
      ? '/provider/dashboard'
      : user?.role === 'admin'
        ? '/admin/dashboard'
        : '/customer/dashboard';

  const heroCard = (
    <div className="bg-black/40 md:bg-white/50 md:backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-xl shadow-black/10 md:shadow-white/20 w-full min-w-0 overflow-hidden p-4 sm:p-6 md:p-8">
      <div className="inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-black/30 md:bg-white/80 md:backdrop-blur-sm rounded-full mb-4 sm:mb-6 md:mb-8 animate-nilin-in border border-white/20 md:border-white/50 max-w-full" style={{ animationDelay: '0.1s' }}>
        <Sparkles className="w-4 h-4 text-nilin-coral flex-shrink-0" />
        <span className="text-xs sm:text-sm text-white md:text-nilin-charcoal font-bold tracking-wider uppercase truncate">{activeSlide?.badge}</span>
      </div>

      <h1 className="font-serif font-bold text-white md:text-nilin-charcoal animate-nilin-in drop-shadow-lg leading-[1.1] break-words text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl mb-4 sm:mb-6" style={{ animationDelay: '0.2s' }}>
        {activeSlide?.title}
      </h1>
      <p className="text-white/90 md:text-nilin-charcoal/80 max-w-xl font-medium animate-nilin-in text-base sm:text-lg md:text-xl lg:text-2xl mb-4 sm:mb-6 md:mb-8" style={{ animationDelay: '0.3s' }}>
        {activeSlide?.subtitle}
      </p>

      {isAuthenticated && (
        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
          className="lg:hidden mb-4 sm:mb-6 w-full min-h-[44px] btn-nilin flex items-center justify-center gap-2 rounded-nilin text-base font-medium animate-nilin-in"
          style={{ animationDelay: '0.35s' }}
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 animate-nilin-in mb-8 sm:mb-10 md:mb-12" style={{ animationDelay: '0.4s' }}>
        <button
          onClick={() => activeSlide && navigate(activeSlide.ctaLink)}
          className="btn-frosted-light inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-6 sm:px-10 py-4 sm:py-5 rounded-nilin text-nilin-charcoal font-medium text-base sm:text-lg"
        >
          {activeSlide?.cta}
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/register/provider')}
          className="glass-light inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-6 sm:px-10 py-4 sm:py-5 rounded-nilin text-nilin-charcoal font-medium text-base sm:text-lg hover:border-nilin-coral/30 hover-lift"
        >
          Become a Pro
        </button>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 md:gap-10 mb-6 sm:mb-8 animate-nilin-in" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex -space-x-2 sm:-space-x-3 flex-shrink-0">
            {[
              { name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
              { name: 'Amira', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop' },
              { name: 'Fatima', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
              { name: 'Layla', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
            ].map((person, i) => (
              <div
                key={i}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-nilin-blush to-nilin-coral border-2 border-white flex items-center justify-center overflow-hidden hover:scale-110 transition-transform cursor-pointer"
                title={person.name}
              >
                <img
                  src={person.avatar}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling!.textContent = person.name.charAt(0);
                  }}
                />
                <span className="text-xs text-white font-medium absolute hidden">{person.name.charAt(0)}</span>
              </div>
            ))}
          </div>
          <div className="text-sm sm:text-base text-nilin-charcoal min-w-0">
            <p className="font-semibold text-base sm:text-lg">{formatHappyClients(platformStats.happyClients)}</p>
            <p className="text-nilin-warm-gray">Happy Clients</p>
          </div>
        </div>
        {platformStats.averageRating > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  i <= Math.round(platformStats.averageRating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-yellow-400/30 fill-yellow-400/30'
                }`}
              />
            ))}
            <span className="ml-1 text-nilin-charcoal font-semibold text-base sm:text-lg">{platformStats.averageRating}</span>
          </div>
        )}
      </div>

      <div className="animate-nilin-in w-full min-w-0 mt-4 sm:mt-6 md:mt-8" style={{ animationDelay: '0.6s' }}>
        <HeroSearchBar
          variant="hero"
          placeholder="What service are you looking for?"
          className="w-full max-w-2xl"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader variant="hero" showSearch={false} showCategoryTabs={false} />

      <PageErrorBoundary pageName="Home">
        {/* UNIFIED HERO SECTION */}
      <section className="relative overflow-hidden animate-nilin-in h-[100dvh] min-h-[640px] max-h-[100dvh]">
        {/* Full-viewport hero — image fills screen; content centered; trending below fold */}

        {/* Background Slides — only mount current + adjacent images */}
        {heroSlides.map((slide, index) => {
          const slideCount = heroSlides.length;
          const prevIndex = (currentSlide - 1 + slideCount) % slideCount;
          const nextIndex = (currentSlide + 1) % slideCount;
          const isAdjacent = index === currentSlide || index === prevIndex || index === nextIndex;
          if (!isAdjacent) return null;

          const isActive = index === currentSlide;

          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={slide.image}
                alt={slide.title}
                loading={isActive ? 'eager' : 'lazy'}
                fetchpriority={isActive ? 'high' : 'auto'}
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent md:from-white/70 md:via-white/30 md:to-transparent" />
            </div>
          );
        })}

        {/* Content overlay — CTA left, dashboard right, vertically centered on hero image */}
        <div className="absolute inset-0 z-20 flex items-start lg:items-center overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-12 xl:px-16 pt-20 sm:pt-24 pb-8 sm:pb-10">
          <div className="flex w-full max-w-7xl mx-auto items-center justify-between gap-6 lg:gap-10">
            <div className="flex-1 min-w-0 max-w-3xl">
              {heroCard}
            </div>

            {isAuthenticated && (
              <div className="hidden lg:flex flex-shrink-0">
                <DashboardBubbleButton
                  variant="hero"
                  text="Go to Dashboard"
                  onClick={() => navigate(dashboardPath)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-1 sm:gap-2 px-4">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-nilin transition-all hover-lift"
            >
              <span
                className={`block h-1.5 rounded-nilin transition-all ${
                  index === currentSlide ? 'w-12 bg-nilin-coral' : 'w-4 bg-nilin-charcoal/30'
                }`}
              />
            </button>
          ))}
        </div>
      </section>

      {/* Trending Searches Section */}
      <TrendingSearches
        variant="modern"
        title="Trending searches"
        limit={8}
        showViewAll={true}
      />

      <LoggedInHomeBanner />

      {/* Active bookings — shown early when user has in-progress or today's appointments */}
      {isAuthenticated && (
        <LazyInViewport minHeight={120}>
          <OngoingBookings limit={3} showViewAll={true} />
        </LazyInViewport>
      )}

      {/* Popular Services */}
      <section className="py-12 px-4 animate-nilin-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif text-nilin-charcoal mb-2">Popular Services</h2>
              <p className="text-sm sm:text-base text-nilin-warmGray">Most booked this week</p>
            </div>
            <button
              onClick={() => navigate('/search')}
              className="btn-nilin px-5 sm:px-6 py-2.5 sm:py-3 rounded-nilin text-sm text-white hover-lift w-full sm:w-auto"
            >
              View All
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-nilin h-12 w-12 border-b-2 border-nilin-coral"></div>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => popularScrollRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 glass-nilin w-12 h-12 rounded-nilin items-center justify-center shadow-nilin -ml-4 hover-lift"
              >
                <ChevronLeft className="w-6 h-6 text-nilin-charcoal" />
              </button>

              <div
                ref={popularScrollRef}
                className="flex gap-6 overflow-x-auto pt-6 pb-12 px-4 scrollbar-hide"
                style={{scrollbarWidth: 'none'}}
              >
                {popularServices.length > 0 ? popularServices.map((service, index) => (
                  <PopularServiceCard
                    key={service._id || index}
                    service={service}
                    index={index}
                    onClick={() => handleServiceClick(service._id)}
                    getServiceImage={getServiceImage}
                    getDisplayPrice={getDisplayPrice}
                  />
                )) : (
                  <div className="w-full text-center py-12 text-nilin-warmGray">
                    <p>No services available yet</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => popularScrollRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 glass-nilin w-12 h-12 rounded-nilin items-center justify-center shadow-nilin -mr-4 hover-lift"
              >
                <ChevronRight className="w-6 h-6 text-nilin-charcoal" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Category Cards */}
      <CategoryCards />

      {/* Offer Banner */}
      <OfferBanner />

      {/* Category Spotlight */}
      <CategorySpotlight limit={10} />

      {/* Recommended Professionals Section - Only show for logged-in users */}
      {isAuthenticated && (
        <LazyInViewport minHeight={200}>
          <RecommendedProsSection limit={6} showViewAll={true} />
        </LazyInViewport>
      )}

      {/* 3D Parallax Service Slider - For You Section */}
      <LazyInViewport minHeight={320}>
        <ParallaxServiceSlider limit={6} services={popularServices} />
      </LazyInViewport>

      {/* Personal Dashboard Sections - Only for logged-in users */}
      {isAuthenticated && (
        <>
          {/* Packages Section */}
          <LazyInViewport minHeight={200}>
            <PackagesSection limit={3} showViewAll={true} />
          </LazyInViewport>

          {/* Recent Activity */}
          <LazyInViewport minHeight={200}>
            <RecentActivity limit={5} showViewAll={true} />
          </LazyInViewport>
        </>
      )}

      {/* NILIN Experience Section */}
      <LazyInViewport minHeight={240}>
        <ExperienceSection />
      </LazyInViewport>

      {/* Curated Reels */}
      <LazyInViewport minHeight={200}>
        <CuratedReels />
      </LazyInViewport>

      {/* Why NILIN */}
      <WhyNilin />

      {/* Provider CTA */}
      <ProviderCTA />
      </PageErrorBoundary>

      <Footer />
    </div>
  );
};

export default HomePage;
