import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Package,
  ArrowRight,
  Loader2,
  Sparkles,
  Grid3X3,
  Clock,
  Star,
  MapPin,
  ChevronRight,
  Zap,
  TrendingUp,
  Heart,
  Filter
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import CustomerHubNav from '../../components/customer/CustomerHubNav';
import Breadcrumb from '../../components/common/Breadcrumb';
import type { Service } from '../../types/service';
import { useCategories } from '../../hooks/useCategories';
import { searchApi } from '../../services/searchApi';
import { CATEGORY_IMAGES } from '../../constants/images';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { favoritesApi } from '../../services/favoritesApi';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

// ============================================
// CATEGORY CARD COMPONENT
// ============================================
interface CategoryCardProps {
  name: string;
  slug: string;
  icon?: string;
  image: string;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ name, slug, image }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/category/${slug}`)}
      className="group relative flex flex-col items-center p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:border-rose-200 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
    >
      {/* Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Image Container */}
      <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden ring-2 ring-gray-100 group-hover:ring-rose-200 transition-all duration-300 shadow-sm">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* Category Name */}
      <span className="relative mt-3 text-sm font-semibold text-gray-700 group-hover:text-rose-600 transition-colors text-center leading-tight">
        {name}
      </span>

      {/* Arrow indicator */}
      <ChevronRight className="absolute bottom-3 right-3 w-4 h-4 text-gray-300 group-hover:text-rose-400 group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
    </button>
  );
};

// ============================================
// SERVICE CARD COMPONENT (Inline for this page)
// ============================================
interface ServiceCardProps {
  service: Service;
  onBookNow?: (service: Service) => void;
  onClick?: () => void;
}

const ServiceCardInline: React.FC<ServiceCardProps> = ({ service, onBookNow, onClick }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const displayTitle = service.title || service.name || 'Service';
  const displayPrice = typeof service.price === 'number'
    ? service.price
    : (service.price?.amount || 0);
  const displayRating = typeof service.rating === 'number'
    ? service.rating
    : (service.rating?.average || 0);
  const ratingCount = service.reviewCount ||
    (typeof service.rating === 'object' ? service.rating?.count : 0) ||
    service.reviews?.count || 0;

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/services/${service._id}`);
    }
  };

  const handleBookNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBookNow) {
      onBookNow(service);
    } else {
      navigate(`/book/${service._id}`, { state: { service } });
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/services/${service._id}` } });
      return;
    }

    if (isToggling) return;
    setIsToggling(true);

    try {
      const providerId = service.provider?._id || service.providerId;
      if (isFavorited) {
        await favoritesApi.removeFavorite(providerId);
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await favoritesApi.addFavorite(providerId);
        setIsFavorited(true);
        toast.success('Added to favorites');
      }
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      toast.error('Failed to update favorites');
    } finally {
      setIsToggling(false);
    }
  };

  // Generate gradient based on category
  const gradients: Record<string, string> = {
    hair: 'from-amber-100 to-orange-100',
    makeup: 'from-pink-100 to-rose-100',
    nails: 'from-purple-100 to-pink-100',
    'skin aesthetics': 'from-blue-100 to-cyan-100',
    'massage body': 'from-green-100 to-teal-100',
    'personal care': 'from-gray-100 to-slate-100',
    default: 'from-rose-100 to-orange-100',
  };
  const gradientKey = service.category?.toLowerCase() || 'default';
  const gradient = gradients[gradientKey] || gradients.default;

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden cursor-pointer"
    >
      {/* Image Section */}
      <div className={`relative h-40 bg-gradient-to-br ${gradient} overflow-hidden`}>
        {service.image ? (
          <img
            src={service.image}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-50">✨</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {service.isNew && (
            <span className="px-2.5 py-1 bg-rose-500 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1">
              <Zap className="w-3 h-3" /> NEW
            </span>
          )}
          {service.isFeatured && (
            <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Featured
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          disabled={isToggling}
          className={`absolute top-3 right-3 p-2 rounded-full shadow-sm transition-all ${
            isFavorited
              ? 'bg-red-500 text-white'
              : 'bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:bg-white'
          } ${isToggling ? 'opacity-50' : ''}`}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
        </button>

        {/* Rating Badge */}
        {displayRating > 0 && (
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full flex items-center gap-1.5 shadow-sm">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-gray-700">{displayRating.toFixed(1)}</span>
            {ratingCount > 0 && (
              <span className="text-xs text-gray-400">({ratingCount})</span>
            )}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Category Tag */}
        {service.category && (
          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-md mb-2">
            {service.category}
          </span>
        )}

        {/* Title */}
        <h3 className="font-semibold text-gray-800 text-base mb-2 line-clamp-1 group-hover:text-rose-600 transition-colors">
          {displayTitle}
        </h3>

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          {service.duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {service.duration} min
            </span>
          )}
          {service.provider?.location && (
            <span className="flex items-center gap-1 truncate max-w-[120px]">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{service.provider.location}</span>
            </span>
          )}
        </div>

        {/* Provider & Price */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="min-w-0">
            {service.provider && (
              <p className="text-xs text-gray-400 truncate max-w-[140px]">
                by {service.provider.firstName || service.provider.name || 'Provider'}
              </p>
            )}
            <p className="text-lg font-bold text-gray-800">
              AED {displayPrice}
            </p>
          </div>

          <button
            onClick={handleBookNow}
            className="px-4 py-2 bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md hover:from-rose-500 hover:to-pink-600 active:scale-95 transition-all"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SKELETON COMPONENTS
// ============================================
const CategorySkeleton = () => (
  <div className="flex flex-col items-center p-5 rounded-2xl bg-white border border-gray-100">
    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gray-200 animate-pulse" />
    <div className="mt-3 w-16 h-4 bg-gray-200 rounded animate-pulse" />
  </div>
);

const ServiceSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className="h-40 bg-gray-200 animate-pulse" />
    <div className="p-4">
      <div className="w-16 h-4 bg-gray-200 rounded mb-2 animate-pulse" />
      <div className="w-3/4 h-5 bg-gray-200 rounded mb-3 animate-pulse" />
      <div className="w-1/2 h-3 bg-gray-200 rounded mb-3 animate-pulse" />
      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
        <div className="w-20 h-6 bg-gray-200 rounded animate-pulse" />
        <div className="w-16 h-8 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

// ============================================
// MAIN PAGE COMPONENT
// ============================================
const BookServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, isLoading: categoriesLoading } = useCategories(undefined, true);
  const [popularServices, setPopularServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

  const fetchPopularServices = useCallback(async () => {
    setServicesLoading(true);
    setServicesError(null);
    const query = searchParams.get('q')?.trim();
    try {
      const response = query
        ? await searchApi.searchServices({
            q: query,
            sortBy: 'popularity',
            page: 1,
            limit: 12,
          })
        : await searchApi.getPopularServices(undefined, 12);
      if (response.success && response.data.services) {
        setPopularServices(response.data.services as Service[]);
      } else {
        setPopularServices([]);
      }
    } catch (err) {
      console.error('[BookServicesPage] Failed to load services:', err);
      setServicesError('Could not load services. Please try again.');
      setPopularServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPopularServices();
  }, [fetchPopularServices]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) {
      setSearchParams({ q });
    } else {
      setSearchParams({});
    }
  };

  const handleBookNow = (service: Service) => {
    const serviceId = service._id;
    if (serviceId) {
      navigate(`/book/${serviceId}`, { state: { service } });
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const isSearching = !!searchParams.get('q');

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <CustomerHubNav />

        <main className="flex-1 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/customer/dashboard' },
                { label: 'Book a Service' },
              ]}
            />

            {/* ==================== HERO SECTION ==================== */}
            <section className="mt-4 mb-8">
              <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-lg shadow-gray-200/50 p-6 md:p-10">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute -top-20 -right-20 w-72 h-72 bg-rose-100 rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-pink-100 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-rose-100 rounded-xl">
                      <Sparkles className="w-5 h-5 text-rose-500" />
                    </div>
                    <span className="text-sm font-semibold text-rose-600 uppercase tracking-wide">
                      Quick Booking
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                    {isSearching ? (
                      <>Search results for <span className="text-rose-500">"{searchParams.get('q')}"</span></>
                    ) : (
                      <>Find Your Perfect <span className="text-rose-500">Service</span>`
                    </>
                    )}
                  </h1>

                  <p className="text-gray-500 mb-6 max-w-lg">
                    {isSearching
                      ? `Found popular services matching your search. Book instantly!`
                      : 'Browse categories, explore top-rated services, or search for exactly what you need.'
                    }
                  </p>

                  {/* Search Form */}
                  <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search for services..."
                        aria-label="Search services"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold rounded-2xl shadow-lg shadow-rose-200 hover:shadow-xl hover:from-rose-600 hover:to-pink-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Search className="w-5 h-5" />
                      Search
                    </button>
                    {isSearching && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-6 py-4 bg-gray-100 text-gray-600 font-medium rounded-2xl hover:bg-gray-200 transition-all"
                      >
                        Clear
                      </button>
                    )}
                  </form>

                  {/* Quick Links */}
                  {!isSearching && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      <span className="text-sm text-gray-400">Popular:</span>
                      {['Haircut', 'Massage', 'Facial', 'Manicure'].map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                            setSearchInput(term);
                            setSearchParams({ q: term });
                          }}
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ==================== CATEGORIES SECTION ==================== */}
            {!isSearching && (
              <section className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-xl">
                      <Grid3X3 className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900">Browse Categories</h2>
                      <p className="text-sm text-gray-500">Pick a category to explore services</p>
                    </div>
                  </div>
                </div>

                {categoriesLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <CategorySkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {categories.map((category) => {
                      const images = CATEGORY_IMAGES[category.slug];
                      const thumbnailUrl =
                        images?.thumbnail ||
                        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80';
                      return (
                        <CategoryCard
                          key={category._id}
                          name={category.name}
                          slug={category.slug}
                          image={thumbnailUrl}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ==================== PACKAGES BANNER ==================== */}
            {!isSearching && (
              <section className="mb-10">
                <Link
                  to="/packages"
                  className="group relative flex items-center justify-between p-6 md:p-8 rounded-3xl bg-gradient-to-r from-amber-50 via-white to-pink-50 border border-amber-100 overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  {/* Background Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 via-transparent to-pink-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative flex items-center gap-5">
                    <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 items-center justify-center shadow-lg shadow-amber-200">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
                        Service Packages
                      </h3>
                      <p className="text-sm md:text-base text-gray-500">
                        Save up to 30% with curated service bundles from top providers
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-center gap-3 text-rose-500 font-semibold">
                    <span className="hidden sm:inline">Explore Packages</span>
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {/* ==================== SERVICES SECTION ==================== */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-xl">
                    <Zap className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                      {isSearching ? 'Search Results' : 'Popular Services'}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {isSearching
                        ? `${popularServices.length} services found`
                        : 'Top-rated services bookable in minutes'
                      }
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
              </div>

              {/* Content States */}
              {servicesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ServiceSkeleton key={i} />
                  ))}
                </div>
              ) : servicesError ? (
                <div className="text-center py-16 rounded-3xl bg-white border border-gray-200">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h3>
                  <p className="text-gray-500 mb-6 max-w-sm mx-auto">{servicesError}</p>
                  <button
                    type="button"
                    onClick={fetchPopularServices}
                    className="px-6 py-3 bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : popularServices.length === 0 ? (
                <div className="text-center py-16 rounded-3xl bg-white border border-gray-200">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {isSearching ? 'No services found' : 'No services available'}
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                    {isSearching
                      ? `We couldn't find any services matching "${searchParams.get('q')}". Try a different search term.`
                      : 'Check back soon for new services from our providers.'
                    }
                  </p>
                  {isSearching ? (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Clear Search
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/search')}
                        className="px-6 py-3 bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 transition-colors"
                      >
                        Advanced Search
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={fetchPopularServices}
                      className="px-6 py-3 bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 transition-colors"
                    >
                      Refresh
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {popularServices.map((service) => (
                    <ServiceCardInline
                      key={service._id}
                      service={service}
                      onBookNow={handleBookNow}
                      onClick={() => navigate(`/services/${service._id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ==================== BOTTOM CTA ==================== */}
            {!isSearching && popularServices.length > 0 && (
              <section className="mb-8">
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Looking for something specific?</p>
                  <button
                    type="button"
                    onClick={() => navigate('/search')}
                    className="px-8 py-3 bg-gray-900 text-white font-semibold rounded-2xl hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
                  >
                    <Search className="w-5 h-5" />
                    Browse All Services
                  </button>
                </div>
              </section>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </PageErrorBoundary>
  );
};

export default BookServicesPage;