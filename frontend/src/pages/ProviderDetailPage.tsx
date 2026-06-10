import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Shield,
  CheckCircle2,
  MessageCircle,
  Heart,
  Share2,
  ChevronRight,
  ChevronLeft,
  Award,
  Briefcase,
  User,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import ServiceReviews from '../components/service/ServiceReviews';
import { ShareModal } from '../components/common/ShareModal';
import { useProvider } from '../hooks/useProvider';
import { useAuthStore } from '../stores/authStore';
import { favoritesApi } from '../services/favoritesApi';
import { CATEGORY_IMAGES, SUBCATEGORY_IMAGES } from '../constants/images';
import type { ProviderService, Certification } from '../types/provider';

const getAvatarColor = (name: string): string => {
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-pink-500 to-rose-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-cyan-500',
    'from-violet-500 to-fuchsia-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
  const words = name.split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getServiceImage = (service: ProviderService): string | null => {
  if (service.images && service.images.length > 0) return service.images[0];

  const catSlug = service.category?.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
  const subSlug = service.subcategory?.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');

  if (catSlug && subSlug && SUBCATEGORY_IMAGES[catSlug]?.[subSlug]) {
    return SUBCATEGORY_IMAGES[catSlug][subSlug];
  }
  if (catSlug && CATEGORY_IMAGES[catSlug]?.card) {
    return CATEGORY_IMAGES[catSlug].card;
  }
  return null;
};

const ServiceCard: React.FC<{
  service: ProviderService;
  onBook: () => void;
  onViewDetails: () => void;
}> = ({ service, onBook, onViewDetails }) => {
  const image = getServiceImage(service);

  return (
    <div
      onClick={onViewDetails}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
    >
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
        {image ? (
          <img
            src={image}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-nilin-pink to-nilin-lavender flex items-center justify-center">
            <Scissors className="w-10 h-10 text-nilin-primary/40" />
          </div>
        )}
        {service.isPopular && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-nilin-accent text-white text-xs font-semibold rounded-full shadow-sm">
            Popular
          </span>
        )}
        {service.isFeatured && !service.isPopular && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-nilin-primary text-white text-xs font-semibold rounded-full shadow-sm">
            Featured
          </span>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 shadow-sm">
            View Details
          </span>
        </div>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-nilin-primary transition-colors line-clamp-1">
          {service.name}
        </h4>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
          {service.shortDescription || service.description}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-gray-900">
              AED {service.price.amount}
            </span>
            <span className="text-sm text-gray-400 ml-1.5">· {service.duration} mins</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
            className="px-4 py-2 bg-nilin-primary text-white text-sm font-semibold rounded-full hover:bg-nilin-primary-dark transition-colors shadow-sm hover:shadow-md"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
};

const CertificationCard: React.FC<{
  certification: Certification;
}> = ({ certification }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
      certification.isVerified ? 'bg-emerald-100' : 'bg-gray-100'
    }`}>
      <Award className={`w-4 h-4 ${certification.isVerified ? 'text-emerald-600' : 'text-gray-500'}`} />
    </div>
    <div className="min-w-0">
      <span className="text-sm font-medium text-gray-700 block truncate">{certification.name}</span>
      <p className="text-xs text-gray-400">{certification.issuingOrganization}</p>
    </div>
    {certification.isVerified && (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 ml-auto" />
    )}
  </div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-white">
    <NavigationHeader />
    <div className="animate-pulse">
      <div className="h-48 md:h-64 bg-gray-100" />
      <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gray-100 -mt-16 md:-mt-20 mx-auto md:mx-0" />
            <div className="flex-1 space-y-3">
              <div className="h-7 bg-gray-100 rounded w-48 mx-auto md:mx-0" />
              <div className="h-4 bg-gray-100 rounded w-64 mx-auto md:mx-0" />
              <div className="flex gap-3 justify-center md:justify-start">
                <div className="h-6 bg-gray-100 rounded w-20" />
                <div className="h-6 bg-gray-100 rounded w-28" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-2xl" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-40 bg-gray-100 rounded-2xl" />
            <div className="h-28 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ErrorState: React.FC<{ message: string; onBack: () => void }> = ({ message, onBack }) => (
  <div className="min-h-screen bg-white">
    <NavigationHeader />
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <User className="w-10 h-10 text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Provider Not Found</h1>
      <p className="text-gray-500 mb-8">{message}</p>
      <button
        onClick={onBack}
        className="px-6 py-3 bg-nilin-primary text-white rounded-full font-semibold hover:bg-nilin-primary-dark transition-colors"
      >
        Go Back
      </button>
    </div>
  </div>
);

const calculateExperience = (establishedDate?: string, memberSince?: string): string => {
  const date = establishedDate || memberSince;
  if (!date) return 'New';
  const start = new Date(date);
  const now = new Date();
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return 'New';
  if (years === 1) return '1 year exp.';
  return `${years} years exp.`;
};

const formatResponseTime = (minutes?: number): string => {
  if (!minutes) return 'Quick responder';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `Replies in < ${rounded} min`;
  if (rounded < 1440) return `Replies in < ${Math.round(rounded / 60)}h`;
  return `Replies in < ${Math.round(rounded / 1440)}d`;
};

const ProviderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showAllServices, setShowAllServices] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [reviewStats, setReviewStats] = useState<{ total: number; averageRating: number } | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  const { provider, isLoading, error } = useProvider(id);
  const { isAuthenticated } = useAuthStore();

  const handleReviewStatsLoaded = useCallback((stats: { total: number; averageRating: number }) => {
    setReviewStats(stats);
  }, []);

  useEffect(() => {
    if (id && isAuthenticated) {
      favoritesApi.checkFavorite(id)
        .then(res => setIsFavorite(res.data.isFavorited))
        .catch(() => {});
    }
  }, [id, isAuthenticated]);

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/provider/${id}` } });
      return;
    }

    if (!id || isTogglingFavorite) return;

    setIsTogglingFavorite(true);
    try {
      if (isFavorite) {
        await favoritesApi.removeFavorite(id);
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        await favoritesApi.addFavorite(id);
        setIsFavorite(true);
        toast.success('Added to favorites');
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast.error('Failed to update favorites. Please try again.');
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleMessage = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/provider/${id}` } });
      return;
    }
    if (!id || !provider) return;
    const displayName = provider.businessName || `${provider.firstName} ${provider.lastName}`;
    const providerName = encodeURIComponent(displayName);
    navigate(`/customer/messages/new?providerId=${id}&providerName=${providerName}`);
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleBookService = (serviceId: string) => {
    setShowServicePicker(false);
    navigate(`/book/${serviceId}`);
  };

  const handleBookNow = () => {
    if (!provider || provider.services.length === 0) return;
    if (provider.services.length === 1) {
      handleBookService(provider.services[0]._id);
    } else {
      setShowServicePicker(true);
    }
  };

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error || !provider) {
    return (
      <ErrorState
        message={error || "The provider you're looking for doesn't exist or has been removed."}
        onBack={() => navigate(-1)}
      />
    );
  }

  const displayName = provider.businessName || `${provider.firstName} ${provider.lastName}`;
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(displayName);
  const providerId = provider._id || (provider as { id?: string }).id || id!;

  const displayRating = reviewStats?.averageRating ?? provider.reviewsData?.averageRating ?? 0;
  const displayReviewCount = reviewStats?.total ?? provider.reviewsData?.totalReviews ?? 0;

  const filteredServices = selectedFilter === 'all'
    ? provider.services
    : selectedFilter === 'popular'
    ? provider.services.filter(s => s.isPopular)
    : provider.services.filter(s => s.subcategory?.toLowerCase() === selectedFilter.toLowerCase());

  const displayedServices = showAllServices ? filteredServices : filteredServices.slice(0, 4);
  const subcategories = [...new Set(provider.services.map(s => s.subcategory).filter(Boolean))];

  const scrollGallery = (direction: 'left' | 'right') => {
    if (galleryRef.current) {
      galleryRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  };

  const galleryImages = provider.portfolio?.featured?.flatMap(item => item.images) || [];

  const stats = [];
  if (provider.stats?.completionRate && provider.stats.completionRate > 0) {
    stats.push({ value: `${provider.stats.completionRate}%`, label: 'Completion' });
  }
  if (provider.stats?.repeatCustomerRate && provider.stats.repeatCustomerRate > 0) {
    stats.push({ value: `${provider.stats.repeatCustomerRate}%`, label: 'Repeat Clients' });
  }
  if (provider.stats?.totalBookings && provider.stats.totalBookings > 0) {
    stats.push({ value: `${provider.stats.totalBookings}+`, label: 'Bookings' });
  }
  if (stats.length === 0) {
    stats.push({ value: `${provider.services.length}`, label: 'Services' });
    if (displayRating > 0) {
      stats.push({ value: displayRating.toFixed(1), label: 'Rating' });
    }
    stats.push({ value: calculateExperience(provider.establishedDate, provider.memberSince), label: 'Experience' });
  }

  const statsGridClass =
    stats.length === 1 ? 'grid-cols-1' :
    stats.length === 2 ? 'grid-cols-2' :
    'grid-cols-3';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavigationHeader />

      {/* Cover Image */}
      <div className="relative h-44 md:h-64 overflow-hidden">
        {provider.coverPhoto ? (
          <img
            src={provider.coverPhoto}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-nilin-primary via-purple-500 to-nilin-accent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-900 hover:bg-white transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium text-sm hidden sm:inline">Back</span>
        </button>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            disabled={isTogglingFavorite}
            className={`p-2 rounded-full shadow-sm transition-colors ${
              isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white'
            } ${isTogglingFavorite ? 'opacity-50' : ''}`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={handleShare}
            className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:bg-white transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Provider Info Card */}
      <div className="max-w-6xl mx-auto px-4 -mt-14 relative z-10 w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <div className="relative -mt-14 md:-mt-18 mx-auto md:mx-0 flex-shrink-0">
              {provider.profilePhoto ? (
                <img
                  src={provider.profilePhoto}
                  alt={displayName}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className={`w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br ${avatarColor} border-4 border-white shadow-md flex items-center justify-center`}>
                  <span className="text-white font-bold text-2xl md:text-3xl">{initials}</span>
                </div>
              )}
              {provider.isVerified && (
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{displayName}</h1>
                {provider.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full mx-auto md:mx-0 flex-shrink-0">
                    <Shield className="w-3 h-3" />
                    Verified Pro
                  </span>
                )}
              </div>
              {provider.tagline && (
                <p className="text-gray-500 text-sm mb-3">{provider.tagline}</p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm">
                {displayRating > 0 && (
                  <button
                    type="button"
                    onClick={scrollToReviews}
                    className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-gray-900">{displayRating.toFixed(1)}</span>
                    <span className="text-gray-400">({displayReviewCount})</span>
                  </button>
                )}
                {provider.location && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{provider.location.city}, {provider.location.state}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatResponseTime(provider.stats?.responseTime)}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>{calculateExperience(provider.establishedDate, provider.memberSince)}</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleBookNow}
                disabled={provider.services.length === 0}
                className="px-7 py-2.5 bg-nilin-accent text-white font-semibold rounded-full hover:bg-pink-600 transition-colors disabled:opacity-50 shadow-sm"
              >
                Book Now
              </button>
              <button
                onClick={handleMessage}
                className="px-7 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>

          {stats.length > 0 && (
            <div className={`grid ${statsGridClass} gap-4 mt-5 pt-5 border-t border-gray-100`}>
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Services Section */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Services ({provider.services.length})
                </h2>
                {subcategories.length > 0 && (
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-nilin-primary/20 bg-white"
                  >
                    <option value="all">All Services</option>
                    <option value="popular">Popular</option>
                    {subcategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                )}
              </div>

              {displayedServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayedServices.map(service => (
                    <ServiceCard
                      key={service._id}
                      service={service}
                      onBook={() => navigate(`/book/${service._id}`)}
                      onViewDetails={() => navigate(`/services/${service._id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No services in this category</p>
                </div>
              )}

              {filteredServices.length > 4 && (
                <button
                  onClick={() => setShowAllServices(!showAllServices)}
                  className="w-full mt-4 py-3 text-nilin-primary font-semibold text-sm hover:bg-nilin-primary/5 rounded-xl transition-colors"
                >
                  {showAllServices ? 'Show Less' : `View All ${filteredServices.length} Services`}
                </button>
              )}
            </section>

            {/* Portfolio Gallery */}
            {galleryImages.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Portfolio</h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => scrollGallery('left')}
                      className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollGallery('right')}
                      className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  ref={galleryRef}
                  className="flex gap-3 overflow-x-auto pb-2"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="flex-shrink-0 w-44 h-44 rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <img src={img.url} alt={img.caption || `Work ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews Section — live API via ServiceReviews */}
            <section ref={reviewsRef}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Reviews ({displayReviewCount})
                </h2>
                {displayReviewCount > 0 && (
                  <button
                    type="button"
                    onClick={scrollToReviews}
                    className="text-sm text-nilin-primary font-semibold hover:underline"
                  >
                    See all
                  </button>
                )}
              </div>
              <ServiceReviews
                providerId={providerId}
                embedded
                onStatsLoaded={handleReviewStatsLoaded}
              />
            </section>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">About</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {provider.bio || provider.description || 'Professional beauty and wellness service provider on NILIN.'}
              </p>
              {provider.businessType && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Business Type</span>
                  <p className="text-sm text-gray-700 font-medium capitalize mt-0.5">
                    {provider.businessType.replace('_', ' ')}
                  </p>
                </div>
              )}
              {provider.contact?.website && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <a
                    href={provider.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-nilin-primary hover:underline"
                  >
                    Visit website
                  </a>
                </div>
              )}
            </div>

            {provider.specializations && provider.specializations.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Specializations</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.specializations.map(spec => (
                    <span key={spec} className="px-3 py-1 bg-nilin-primary/10 text-nilin-primary text-xs font-medium rounded-full">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {provider.portfolio?.certifications && provider.portfolio.certifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Certifications</h3>
                <div className="space-y-2">
                  {provider.portfolio.certifications.map((cert, idx) => (
                    <CertificationCard key={idx} certification={cert} />
                  ))}
                </div>
              </div>
            )}

            {provider.portfolio?.awards && provider.portfolio.awards.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Awards</h3>
                <div className="space-y-2">
                  {provider.portfolio.awards.map((award, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                      <Award className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-700 block truncate">{award.title}</span>
                        <p className="text-xs text-gray-400">{award.organization} · {award.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {provider.verificationBadges && provider.verificationBadges.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Verifications</h3>
                <div className="space-y-2">
                  {provider.verificationBadges.map((badge, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-700 capitalize block truncate">
                          {badge.type.replace('_', ' ')}
                        </span>
                        <p className="text-xs text-gray-400">
                          Verified {new Date(badge.verifiedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-nilin-primary/5 to-purple-50 rounded-2xl border border-nilin-primary/10 p-5">
              <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Availability</h3>
              {provider.availability?.instantBooking && (
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-gray-600">Instant booking available</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mb-4">
                Book up to {provider.availability?.advanceBookingDays || 30} days in advance
              </p>
              <button
                onClick={handleBookNow}
                disabled={provider.services.length === 0}
                className="w-full py-2.5 bg-nilin-primary text-white font-semibold rounded-full hover:bg-nilin-primary-dark transition-colors disabled:opacity-50 text-sm"
              >
                Check Full Availability
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 p-3 md:hidden z-50">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={handleMessage}
            className="p-2.5 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleBookNow}
            disabled={provider.services.length === 0}
            className="flex-1 py-2.5 bg-nilin-accent text-white font-semibold rounded-full hover:bg-pink-600 transition-colors disabled:opacity-50 shadow-sm"
          >
            Book Now
          </button>
        </div>
      </div>

      {/* Service Picker Modal */}
      {showServicePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Choose a Service</h3>
              <button
                onClick={() => setShowServicePicker(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {provider.services.map(service => (
                <button
                  key={service._id}
                  onClick={() => handleBookService(service._id)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-nilin-primary/30 hover:bg-nilin-primary/5 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-500">{service.duration} mins</p>
                  </div>
                  <span className="font-bold text-gray-900">AED {service.price.amount}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={displayName}
        description={provider.tagline || provider.bio}
        url={typeof window !== 'undefined' ? `${window.location.origin}/provider/${providerId}` : undefined}
        image={provider.profilePhoto}
        itemType="provider"
        itemId={providerId}
      />

      <div className="pb-20 md:pb-0">
        <Footer />
      </div>
    </div>
  );
};

export default ProviderDetailPage;
