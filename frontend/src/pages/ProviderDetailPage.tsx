import React, { useState, useRef } from 'react';
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
  SlidersHorizontal,
  Award,
  Briefcase,
  Users,
  ThumbsUp,
  User,
  Scissors,
  Sparkles
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { useProvider } from '../hooks/useProvider';
import { CATEGORY_IMAGES, SUBCATEGORY_IMAGES } from '../constants/images';
import type { Provider, ProviderService, ProviderReview, PortfolioItem, Certification } from '../types/provider';

// Generate a consistent gradient from name
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

// Get image for a service based on its category/subcategory
const getServiceImage = (service: ProviderService): string | null => {
  if (service.images && service.images.length > 0) return service.images[0];

  // Try subcategory images
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

// Service Card Component
const ServiceCard: React.FC<{
  service: ProviderService;
  providerId: string;
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
        {/* Hover overlay */}
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

// Review Card Component
const ReviewCard: React.FC<{
  review: ProviderReview;
}> = ({ review }) => {
  const reviewerInitial = review.isVerified ? 'V' : 'C';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nilin-primary to-purple-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">{reviewerInitial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 text-sm">
                {review.isVerified ? 'Verified Customer' : 'Customer'}
              </h4>
              {review.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </div>
            <span className="text-xs text-gray-400">
              {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-0.5 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
              />
            ))}
            {review.title && (
              <span className="text-sm text-gray-600 font-medium ml-2">{review.title}</span>
            )}
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
          {review.response && (
            <div className="mt-3 ml-3 pl-3 border-l-2 border-nilin-primary/30">
              <p className="text-sm text-gray-500">
                <strong className="text-gray-700">Provider Response:</strong> {review.response.text}
              </p>
            </div>
          )}
          <button className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 hover:text-nilin-primary transition-colors">
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Helpful</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Certification Card Component
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

// Loading Skeleton
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

// Error State
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

// Helper function to calculate experience
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
  if (minutes < 60) return `Replies in < ${minutes} min`;
  if (minutes < 1440) return `Replies in < ${Math.round(minutes / 60)}h`;
  return `Replies in < ${Math.round(minutes / 1440)}d`;
};

const ProviderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showAllServices, setShowAllServices] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const { provider, isLoading, error } = useProvider(id);

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

  // Filter services
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

  // Stats - only show meaningful ones
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
  // Always show at least services count and rating
  if (stats.length === 0) {
    stats.push({ value: `${provider.services.length}`, label: 'Services' });
    if (provider.reviewsData?.averageRating && provider.reviewsData.averageRating > 0) {
      stats.push({ value: provider.reviewsData.averageRating.toFixed(1), label: 'Rating' });
    }
    stats.push({ value: calculateExperience(provider.establishedDate, provider.memberSince), label: 'Experience' });
  }

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

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-900 hover:bg-white transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium text-sm hidden sm:inline">Back</span>
        </button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-2 rounded-full shadow-sm transition-colors ${
              isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:bg-white transition-colors shadow-sm">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Provider Info Card */}
      <div className="max-w-6xl mx-auto px-4 -mt-14 relative z-10 w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            {/* Avatar */}
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

            {/* Info */}
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

              {/* Meta row */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm">
                {(provider.reviewsData?.averageRating ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-gray-900">
                      {provider.reviewsData?.averageRating?.toFixed(1)}
                    </span>
                    <span className="text-gray-400">
                      ({provider.reviewsData?.totalReviews || 0})
                    </span>
                  </div>
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

            {/* CTA Buttons - Desktop */}
            <div className="hidden md:flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  if (provider.services.length > 0) navigate(`/book/${provider.services[0]._id}`);
                }}
                disabled={provider.services.length === 0}
                className="px-7 py-2.5 bg-nilin-accent text-white font-semibold rounded-full hover:bg-pink-600 transition-colors disabled:opacity-50 shadow-sm"
              >
                Book Now
              </button>
              <button className="px-7 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <div className={`grid grid-cols-${Math.min(stats.length, 3)} gap-4 mt-5 pt-5 border-t border-gray-100`}>
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
          {/* Left Column */}
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
                      providerId={provider.id}
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

            {/* Reviews Section */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Reviews ({provider.reviewsData?.totalReviews || 0})
                </h2>
                {provider.reviewsData && provider.reviewsData.totalReviews > 0 && (
                  <button className="text-sm text-nilin-primary font-semibold hover:underline">
                    See all
                  </button>
                )}
              </div>

              {/* Rating summary */}
              {provider.reviewsData && provider.reviewsData.averageRating > 0 && (
                <div className="flex items-center gap-4 mb-5 p-4 bg-gray-50 rounded-2xl">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {provider.reviewsData.averageRating.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= Math.round(provider.reviewsData!.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {provider.reviewsData.totalReviews} reviews
                    </div>
                  </div>
                </div>
              )}

              {provider.reviewsData?.recentReviews && provider.reviewsData.recentReviews.length > 0 ? (
                <div className="space-y-3">
                  {provider.reviewsData.recentReviews.map((review, idx) => (
                    <ReviewCard key={idx} review={review} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl">
                  <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No reviews yet</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to review this provider!</p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-5">
            {/* About */}
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

            {/* Specializations */}
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

            {/* Certifications */}
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

            {/* Awards */}
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

            {/* Verifications */}
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

            {/* Availability CTA */}
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
                onClick={() => {
                  if (provider.services.length > 0) navigate(`/book/${provider.services[0]._id}`);
                }}
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
          <button className="p-2.5 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
            <MessageCircle className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => {
              if (provider.services.length > 0) navigate(`/book/${provider.services[0]._id}`);
            }}
            disabled={provider.services.length === 0}
            className="flex-1 py-2.5 bg-nilin-accent text-white font-semibold rounded-full hover:bg-pink-600 transition-colors disabled:opacity-50 shadow-sm"
          >
            Book Now
          </button>
        </div>
      </div>

      <div className="pb-20 md:pb-0">
        <Footer />
      </div>
    </div>
  );
};

export default ProviderDetailPage;
