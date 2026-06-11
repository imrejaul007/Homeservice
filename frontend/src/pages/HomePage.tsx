import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, ChevronLeft, Sparkles, ArrowRight, MapPin } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
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
  RecommendedServicesSection,
  CuratedReels,
  WhyNilin,
  ProviderCTA,
} from '../components/home';
import RecommendedProsSection from '../components/dashboard/RecommendedProsSection';
import PackagesSection from '../components/dashboard/PackagesSection';
import OngoingBookings from '../components/dashboard/OngoingBookings';
import RecentActivity from '../components/dashboard/RecentActivity';
import NotificationsSection from '../components/dashboard/NotificationsSection';
import LoggedInHomeBanner from '../components/home/LoggedInHomeBanner';
import ExperienceSection from '../components/experience/ExperienceSection';
import { PageErrorBoundary } from '../components/common/PageErrorBoundary';

// UNIFIED HERO CAROUSEL - Merged with hero
const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    badge: 'Hair & Styling',
    title: 'Transform Your Look',
    subtitle: 'Expert hair styling from verified professionals',
    cta: 'Book Hair Services',
    ctaLink: '/category/hair',
  },
  {
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400&q=80&fit=crop',
    badge: 'Bridal Services',
    title: 'Bridal & Special Days',
    subtitle: 'Look stunning on your special occasions',
    cta: 'View Packages',
    ctaLink: '/category/makeup',
  },
  {
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    badge: 'Spa & Wellness',
    title: 'Relax & Rejuvenate',
    subtitle: 'Premium spa treatments in your home',
    cta: 'Book Massage',
    ctaLink: '/category/massage-body',
  },
];

const CATEGORIES = [
  { name: 'Hair', image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80', link: '/category/hair' },
  { name: 'Makeup', image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=400&q=80', link: '/category/makeup' },
  { name: 'Nails', image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=80', link: '/category/nails' },
  { name: 'Spa', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80', link: '/category/massage-body' },
  { name: 'Skincare', image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80', link: '/category/skin-aesthetics' },
  { name: 'Eyes', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80', link: '/category/personal-care' },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { selectedCity, currentLocation } = useLocationStore();
  const { convert, format, currency } = usePriceConversion();
  const [popularServices, setPopularServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const popularScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchServices = async () => {
      try {
        setIsLoading(true);
        const popularRes = await searchApi.searchServices({ limit: 8, sortBy: 'popularity' }, abortController.signal);
        if (popularRes.success && popularRes.data.services && isMounted) {
          setPopularServices(popularRes.data.services);
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
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);

    // FIX: Proper cleanup order - abort request BEFORE clearing interval
    // This prevents race conditions where the fetch completes after abort
    return () => {
      isMounted = false;
      abortController.abort(); // Abort first to stop in-flight requests
      clearInterval(interval); // Then clear the interval
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader variant="hero" showSearch={false} showCategoryTabs={false} />

      <PageErrorBoundary pageName="Home">
        {/* UNIFIED HERO SECTION */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden animate-nilin-in">
        {/* Top vignette — keeps header readable on light hero images */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/55 via-black/25 to-transparent z-[15] pointer-events-none" />

        {/* Background Slides */}
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-nilin-charcoal/85 via-nilin-charcoal/50 to-transparent" />
          </div>
        ))}

        {/* Content Overlay */}
        <div className="absolute inset-0 z-20 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 glass-nilin rounded-full mb-6 animate-nilin-in" style={{animationDelay: '0.1s'}}>
                <Sparkles className="w-4 h-4 text-nilin-coral" />
                <span className="text-sm text-nilin-charcoal">{HERO_SLIDES[currentSlide].badge}</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-4 animate-nilin-in" style={{animationDelay: '0.2s'}}>
                {HERO_SLIDES[currentSlide].title}
              </h1>
              <p className="text-xl text-white/80 mb-8 max-w-lg animate-nilin-in" style={{animationDelay: '0.3s'}}>
                {HERO_SLIDES[currentSlide].subtitle}
              </p>

              <div className="flex flex-wrap gap-4 animate-nilin-in" style={{animationDelay: '0.4s'}}>
                <button
                  onClick={() => navigate(HERO_SLIDES[currentSlide].ctaLink)}
                  className="btn-nilin inline-flex items-center gap-2 px-8 py-4 rounded-nilin text-white"
                >
                  {HERO_SLIDES[currentSlide].cta}
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/register/provider')}
                  className="glass-nilin inline-flex items-center gap-2 px-8 py-4 rounded-nilin text-white hover-lift"
                >
                  Become a Pro
                </button>
              </div>

              <div className="flex items-center gap-8 mt-10 animate-nilin-in" style={{animationDelay: '0.5s'}}>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-3">
                    {[
                      { name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
                      { name: 'Amira', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop' },
                      { name: 'Fatima', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
                      { name: 'Layla', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
                    ].map((user, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-nilin-blush to-nilin-coral border-2 border-white flex items-center justify-center overflow-hidden hover:scale-110 transition-transform cursor-pointer"
                        title={user.name}
                      >
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling!.textContent = user.name.charAt(0);
                          }}
                        />
                        <span className="text-xs text-white font-medium absolute hidden">{user.name.charAt(0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-white">
                    <p className="font-medium">20,510+</p>
                    <p className="text-white/70">Happy Clients</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                  <span className="ml-1 text-white font-medium">4.9</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Image on Right */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 z-30 hidden lg:block">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-nilin-coral/30 to-nilin-rose/20 rounded-nilin blur-xl" />
            <div className="relative w-[350px] h-[450px] rounded-nilin overflow-hidden shadow-nilin float-3d hover-lift">
              <img
                src={REFERENCE_IMAGES[currentSlide % REFERENCE_IMAGES.length]}
                alt="NILIN Service"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            <div className="absolute -left-16 -bottom-8 w-32 h-40 rounded-nilin overflow-hidden shadow-nilin float-3d border-4 border-white/20 hover-lift" style={{animationDelay: '1s'}}>
              <img src={REFERENCE_IMAGES[(currentSlide + 1) % REFERENCE_IMAGES.length]} alt="Detail" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -right-8 -top-6 w-24 h-28 rounded-nilin overflow-hidden shadow-nilin float-3d border-4 border-white/20 hover-lift" style={{animationDelay: '2s'}}>
              <img src={REFERENCE_IMAGES[(currentSlide + 2) % REFERENCE_IMAGES.length]} alt="Detail" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1.5 rounded-nilin transition-all hover-lift ${
                index === currentSlide ? 'w-12 bg-nilin-coral' : 'w-4 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </section>

      <LoggedInHomeBanner />

      {/* Active bookings — shown early when user has in-progress or today's appointments */}
      {isAuthenticated && (
        <OngoingBookings limit={3} showViewAll={true} />
      )}

      {/* Category Quick Links - Sticky with Location */}
      <section className="sticky top-[64px] z-40 py-3 px-4 bg-white/95 backdrop-blur-md shadow-sm border-b border-nilin-border/20">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* Location indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-nilin-blush/30 rounded-full text-xs font-medium text-nilin-charcoal flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-nilin-coral" />
            <span>{selectedCity?.name || currentLocation?.address.city || 'All Locations'}</span>
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1" style={{scrollbarWidth: 'none'}}>
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => navigate(cat.link)}
                className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2 bg-white border border-nilin-border/50 rounded-full hover:border-nilin-coral/50 hover:shadow-md transition-all duration-200 group"
              >
                <img src={cat.image} alt={cat.name} className="w-6 h-6 rounded-full object-cover" />
                <span className="text-xs font-medium text-nilin-charcoal whitespace-nowrap group-hover:text-nilin-coral transition-colors">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="py-12 px-4 animate-nilin-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-serif text-nilin-charcoal mb-2">Popular Services</h2>
              <p className="text-nilin-warmGray">Most booked this week</p>
            </div>
            <button
              onClick={() => navigate('/search')}
              className="btn-nilin px-6 py-3 rounded-nilin text-sm text-white hover-lift"
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
                onClick={() => popularScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 glass-nilin w-12 h-12 rounded-nilin flex items-center justify-center shadow-nilin -ml-4 hover-lift"
              >
                <ChevronLeft className="w-6 h-6 text-nilin-charcoal" />
              </button>

              <div
                ref={popularScrollRef}
                className="flex gap-5 overflow-x-auto pb-4 px-2 scrollbar-hide"
                style={{scrollbarWidth: 'none'}}
              >
                {popularServices.length > 0 ? popularServices.map((service, index) => (
                  <div
                    key={service._id || index}
                    onClick={() => handleServiceClick(service._id)}
                    className="flex-shrink-0 w-[260px] glass-nilin rounded-nilin overflow-hidden cursor-pointer card-3d hover-lift"
                  >
                    <div className="relative h-36">
                      <img src={getServiceImage(service)} alt={service.name} className="w-full h-full object-cover" />
                      {index < 2 && (
                        <div className="absolute top-3 left-3 px-3 py-1 glass-nilin rounded-full text-xs font-medium text-nilin-charcoal flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-nilin-coral" />
                          Featured
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-nilin-charcoal mb-1 truncate">{service.name}</h3>
                      <p className="text-sm text-nilin-warmGray mb-3 truncate">{service.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-nilin-coral">{getDisplayPrice(service)}</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm text-nilin-charcoal">{(service.rating?.average || 4.8).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="w-full text-center py-12 text-nilin-warmGray">
                    <p>No services available yet</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => popularScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 glass-nilin w-12 h-12 rounded-nilin flex items-center justify-center shadow-nilin -mr-4 hover-lift"
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
      <CategorySpotlight />

      {/* Recommended Professionals Section - Only show for logged-in users */}
      {isAuthenticated && (
        <RecommendedProsSection limit={6} showViewAll={true} />
      )}

      {/* Recommended Services Section - Only show for logged-in users */}
      {isAuthenticated && (
        <RecommendedServicesSection limit={6} />
      )}

      {/* Personal Dashboard Sections - Only for logged-in users */}
      {isAuthenticated && (
        <>
          {/* Packages Section */}
          <PackagesSection limit={3} showViewAll={true} />

          {/* Recent Activity */}
          <RecentActivity limit={5} showViewAll={true} />
        </>
      )}

      {/* NILIN Experience Section */}
      <ExperienceSection />

      {/* Curated Reels */}
      <CuratedReels />

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
