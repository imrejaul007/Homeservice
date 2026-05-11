import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, ChevronLeft } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { searchApi } from '../services/searchApi';
import type { Service } from '../types/service';
import { CATEGORY_IMAGES, SUBCATEGORY_IMAGES } from '../constants/images';

import {
  HeroCarousel,
  CategoryCards,
  OfferBanner,
  CategorySpotlight,
  CuratedReels,
  WhyNilin,
  ProviderCTA,
} from '../components/home';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [popularServices, setPopularServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const popularScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setIsLoading(true);
      const popularRes = await searchApi.searchServices({ limit: 8, sortBy: 'popularity' });
      if (popularRes.success && popularRes.data.services) {
        setPopularServices(popularRes.data.services);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceClick = (serviceId: string) => {
    navigate(`/services/${serviceId}`);
  };

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction === 'left' ? -300 : 300,
        behavior: 'smooth',
      });
    }
  };

  const getServiceImage = (service: Service): string => {
    if (service.images && service.images.length > 0) return service.images[0];
    // Try subcategory image first, then category image
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />

      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Category Cards - Circular thumbnails */}
      <CategoryCards />

      {/* Promotional Offers */}
      <OfferBanner />

      {/* Curated Reels - Trending Content */}
      <CuratedReels />

      {/* Most Booked Services */}
      <section className="py-6 md:py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 mb-4 md:mb-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">Most booked services</h2>
              <p className="hidden md:block text-gray-500 text-sm mt-0.5">Popular services loved by customers</p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => scroll(popularScrollRef, 'left')}
                className="p-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => scroll(popularScrollRef, 'right')}
                className="p-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div
            ref={popularScrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[200px] md:w-[240px] bg-gray-100 rounded-2xl h-[260px] md:h-[300px] animate-pulse" />
              ))
            ) : (
              popularServices.length > 0 ? popularServices.map((service) => (
                <div
                  key={service._id}
                  onClick={() => handleServiceClick(service._id)}
                  className="flex-shrink-0 w-[200px] md:w-[240px] bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-0.5"
                >
                  <div className="relative h-[130px] md:h-[150px] overflow-hidden">
                    <img
                      src={getServiceImage(service)}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-medium rounded-md">
                      {service.category}
                    </span>
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2 group-hover:text-nilin-primary transition-colors">
                      {service.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 rounded">
                        <Star className="w-3 h-3 text-green-600 fill-green-600" />
                        <span className="text-xs font-semibold text-green-700">
                          {service.rating?.average?.toFixed(1) || '4.8'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        ({service.rating?.count || 0} reviews)
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 text-sm">
                      AED {service.price?.amount || 199}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="flex-shrink-0 w-full text-center py-8 text-gray-500">
                  No services available yet. Check back soon!
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Category Spotlights */}
      <CategorySpotlight categorySlug="hair" title="Hair Services" />
      <CategorySpotlight categorySlug="massage-body" title="Massage & Body" />
      <CategorySpotlight categorySlug="nails" title="Nail Services" />

      {/* Why NILIN Trust Section */}
      <WhyNilin />

      {/* Provider CTA */}
      <ProviderCTA />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;
