import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ChevronRight, ChevronLeft, Clock, MapPin, Star, Heart } from 'lucide-react';
import { searchApi } from '../../services/searchApi';
import { useAuthStore } from '../../stores/authStore';
import { favoritesApi } from '../../services/favoritesApi';
import { toast } from 'react-hot-toast';
import type { Service } from '../../types/service';
import { usePriceConversion, formatPrice } from '../../utils/priceConverter';
import { CardContainer, CardBody, CardItem } from '../ui/3d-card';

interface RecommendedServicesSectionProps {
  limit?: number;
}

// Category color mapping for beautiful gradients
const CATEGORY_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  hair: { from: 'from-rose-100', to: 'to-pink-100', accent: 'text-rose-500' },
  makeup: { from: 'from-purple-100', to: 'to-violet-100', accent: 'text-purple-500' },
  nails: { from: 'from-pink-100', to: 'to-rose-100', accent: 'text-pink-500' },
  skincare: { from: 'from-teal-100', to: 'to-cyan-100', accent: 'text-teal-500' },
  massage: { from: 'from-amber-100', to: 'to-orange-100', accent: 'text-amber-500' },
  spa: { from: 'from-emerald-100', to: 'to-green-100', accent: 'text-emerald-500' },
  default: { from: 'from-nilin-blush/50', to: 'to-nilin-peach/50', accent: 'text-nilin-coral' },
};

const getCategoryStyle = (category: string) => {
  const cat = category?.toLowerCase() || '';
  for (const [key, style] of Object.entries(CATEGORY_COLORS)) {
    if (cat.includes(key)) return style;
  }
  return CATEGORY_COLORS.default;
};

const ServiceCardSkeleton: React.FC = () => (
  <div className="flex-shrink-0 w-[300px] rounded-2xl overflow-hidden bg-white border border-nilin-border/30 shadow-sm animate-pulse">
    <div className="h-40 bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  </div>
);

const RecommendedServicesSection: React.FC<RecommendedServicesSectionProps> = ({
  limit = 6
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { convert, currency, format } = usePriceConversion();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await searchApi.searchServices({ limit, sortBy: 'popularity' });
        if (response.success && response.data.services) {
          setServices(response.data.services);
        }
      } catch (err) {
        console.error('Error fetching recommended services:', err);
        setError('Failed to load services');
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, [limit]);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, serviceId: string, providerId: string) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/services/${serviceId}` } });
      return;
    }

    try {
      if (favorites.has(serviceId)) {
        await favoritesApi.removeFavorite(providerId);
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(serviceId);
          return next;
        });
        toast.success('Removed from favorites');
      } else {
        await favoritesApi.addFavorite(providerId);
        setFavorites(prev => {
          const next = new Set(prev);
          next.add(serviceId);
          return next;
        });
        toast.success('Added to favorites');
      }
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      toast.error('Failed to update favorites');
    }
  };

  const displayPrice = (service: Service) => {
    const rawPrice = (service as any).pricing?.currentPrice
      ?? (typeof service.price === 'number' ? service.price : service.price?.amount || 0);
    // Convert price based on user's location
    return convert(rawPrice, 'USD');
  };

  const displayRating = (service: Service) => {
    return typeof service.rating === 'number'
      ? service.rating
      : (service.rating?.average || 0);
  };

  if (!isLoading && services.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-white via-nilin-cream/20 to-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div className="flex items-start gap-4">
            {/* Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center shadow-lg shadow-nilin-coral/10">
              <Sparkles className="w-7 h-7 text-nilin-coral" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-nilin-charcoal mb-1">
                Services For You
              </h2>
              <p className="text-nilin-warmGray">Discover what's trending in your area</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => scroll('left')}
              className="w-11 h-11 rounded-xl bg-white border border-nilin-border/50 flex items-center justify-center hover:shadow-lg hover:border-nilin-coral/30 transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5 text-nilin-charcoal" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-11 h-11 rounded-xl bg-white border border-nilin-border/50 flex items-center justify-center hover:shadow-lg hover:border-nilin-coral/30 transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5 text-nilin-charcoal" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {[1, 2, 3, 4].map((i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Services Carousel */}
        {!isLoading && services.length > 0 && (
          <>
            <div
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto pb-8 pt-4 px-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none' }}
            >
              {services.map((service, index) => {
                const categoryStyle = getCategoryStyle(service.category);
                const isFavorite = favorites.has(service._id || '');
                const providerId = service.provider?._id || (service as any).providerId || '';
                const title = service.title || service.name || '';
                const price = displayPrice(service);
                const rating = displayRating(service);
                const reviewCount = service.reviewCount || (typeof service.rating === 'object' ? service.rating?.count : 0) || 0;

                return (
                  <CardContainer
                    key={service._id || index}
                    className="flex-shrink-0 w-[300px]"
                    containerClassName="py-6"
                  >
                    <CardBody
                      className="bg-white rounded-2xl border border-nilin-border/30 overflow-hidden shadow-sm w-full cursor-pointer"
                      onClick={() => navigate(`/services/${service._id}`)}
                    >
                      {/* Image Area - 3D Effect */}
                      <CardItem translateZ="80px" className="relative h-40 w-full">
                        <div className={`absolute inset-0 bg-gradient-to-br ${categoryStyle.from} ${categoryStyle.to} overflow-hidden`}>
                          {service.image ? (
                            <img
                              src={service.image}
                              alt={title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-5xl opacity-50">✨</span>
                            </div>
                          )}
                        </div>

                        {/* Rating Badge - 3D Effect */}
                        {rating > 0 && (
                          <CardItem translateZ="120px" className="absolute top-3 right-3">
                            <div className="bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span className="text-xs font-bold text-nilin-charcoal">{rating.toFixed(1)}</span>
                              {reviewCount > 0 && (
                                <span className="text-[10px] text-nilin-warmGray">({reviewCount})</span>
                              )}
                            </div>
                          </CardItem>
                        )}

                        {/* Favorite Button - 3D Effect */}
                        <CardItem translateZ="100px" className="absolute top-3 left-3">
                          <button
                            onClick={(e) => handleToggleFavorite(e, service._id || '', providerId)}
                            className={`p-2 rounded-full shadow-sm transition-all duration-200 ${
                              isFavorite
                                ? 'bg-red-500 text-white'
                                : 'bg-white/90 backdrop-blur-sm text-gray-500 hover:bg-white hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                          </button>
                        </CardItem>

                        {/* Category Tag - 3D Effect */}
                        <CardItem translateZ="60px" className="absolute bottom-3 left-3">
                          <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-nilin-charcoal text-[10px] font-semibold rounded-full shadow-sm capitalize">
                            {service.category || 'Service'}
                          </span>
                        </CardItem>
                      </CardItem>

                      {/* Content Area - 3D Effect */}
                      <CardItem translateZ="50px" className="p-4">
                        {/* Title */}
                        <h3 className="font-semibold text-nilin-charcoal text-sm mb-2 line-clamp-1">
                          {title}
                        </h3>

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-xs text-nilin-warmGray mb-3">
                          {service.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {service.duration} min
                            </span>
                          )}
                          {service.provider?.location && (
                            <span className="flex items-center gap-1 truncate max-w-[100px]">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{service.provider.location}</span>
                            </span>
                          )}
                        </div>

                        {/* Provider + Price Row */}
                        <div className="flex items-center justify-between pt-3 border-t border-nilin-border/20">
                          <div className="min-w-0">
                            {service.provider && (
                              <p className="text-[10px] text-nilin-warmGray truncate">
                                by {service.provider.businessName || (service as any).providerName || 'Pro'}
                              </p>
                            )}
                            <CardItem translateZ="70px" className="text-lg font-bold text-nilin-charcoal">
                              {format(price, currency)}
                            </CardItem>
                          </div>
                          <CardItem translateZ="90px">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/book/${service._id}`, { state: { service } });
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-nilin-coral/25 transition-all duration-200 active:scale-95"
                            >
                              Book
                            </button>
                          </CardItem>
                        </div>
                      </CardItem>
                    </CardBody>
                  </CardContainer>
                );
              })}
            </div>

            {/* Scroll indicators for mobile */}
            <div className="flex md:hidden justify-center gap-2 mt-4">
              {services.slice(0, 5).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-nilin-coral/30" />
              ))}
            </div>
          </>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="text-center py-12">
            <p className="text-nilin-warmGray">{error}</p>
          </div>
        )}

        {/* View All Button */}
        {!isLoading && services.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-nilin-charcoal text-white font-semibold hover:bg-nilin-charcoal/90 transition-all duration-200 shadow-lg hover:shadow-xl group"
            >
              Explore All Services
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecommendedServicesSection;