import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  MapPin, Clock, Star, Heart, Share2, CheckCircle,
  AlertTriangle, User, Award, ChevronRight
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { searchApi } from '../services/searchApi';
import { favoritesApi } from '../services/favoritesApi';
import { useAuthStore } from '../stores/authStore';
import { CATEGORY_IMAGES, SUBCATEGORY_IMAGES } from '../constants/images';
import { PageErrorBoundary } from '../components/common/PageErrorBoundary';

interface ServiceDetail {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  images: string[];
  tags: string[];
  requirements?: string[];
  includedItems?: string[];
  location: {
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  rating: {
    average: number;
    count: number;
    distribution?: { [key: number]: number };
  };
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    businessInfo?: {
      businessName: string;
      description: string;
      website?: string;
      businessType?: string;
    };
    rating?: {
      average: number;
      count: number;
    } | number;
  };
  isFeatured: boolean;
  isPopular: boolean;
  createdAt: string;
}

// Breadcrumb
const Breadcrumb: React.FC<{ items: { label: string; href?: string }[] }> = ({ items }) => {
  const navigate = useNavigate();
  return (
    <nav className="flex items-center gap-2 text-sm flex-wrap">
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          {item.href ? (
            <button onClick={() => navigate(item.href!)} className="text-gray-500 hover:text-gray-900 transition-colors">
              {item.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

const ServiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    fetchServiceDetails();
  }, [id]);

  const fetchServiceDetails = async () => {
    if (!id) { setError('Service ID not provided'); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await searchApi.getServiceById(id);
      if (response.success && response.data.service) {
        setService(response.data.service);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    // Ensure service is loaded before navigating
    if (!service || loading) {
      toast.error('Please wait for service to load');
      return;
    }
    console.log('[ServiceDetailPage] Booking service:', {
      id: service._id,
      name: service.name,
      providerId: service.provider?._id
    });
    navigate(`/book/${id}`, { state: { service } });
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/services/${id}` } });
      return;
    }

    // Use providerId from the service if available, otherwise check provider._id
    const providerId = service?.provider?._id;
    if (!providerId) {
      console.error('Provider ID not available');
      return;
    }

    try {
      const result = await favoritesApi.toggleFavorite(providerId);
      setIsFavorited(result.isFavorited);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const shareService = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: service?.name, text: `Check out: ${service?.name}`, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const getServiceImage = (): string => {
    if (service?.images?.[0]) return service.images[0];
    const catSlug = service?.category?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
    const subSlug = service?.subcategory?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
    if (catSlug && subSlug && SUBCATEGORY_IMAGES[catSlug]?.[subSlug]) return SUBCATEGORY_IMAGES[catSlug][subSlug];
    if (catSlug && CATEGORY_IMAGES[catSlug]) return CATEGORY_IMAGES[catSlug].hero;
    return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-primary" />
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Service Not Found</h2>
            <p className="text-gray-600 mb-8">{error || 'This service could not be found.'}</p>
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-3 bg-nilin-primary text-white rounded-full font-semibold hover:bg-nilin-primary-dark transition-colors"
            >
              Browse Services
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ratingDistribution = service.rating.distribution || {};
  const totalRatings = service.rating.count;
  const ratingPercentages = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    percentage: totalRatings > 0 ? ((ratingDistribution[stars] || 0) / totalRatings * 100) : 0,
  }));

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavigationHeader />

      {/* Breadcrumb */}
      <div className="bg-nilin-cream border-b border-nilin-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Breadcrumb items={[
            { label: 'Home', href: '/' },
            { label: service.category, href: `/category/${service.category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}` },
            { label: service.name },
          ]} />
        </div>
      </div>

      {/* Main Content - 2 column on desktop */}
      <PageErrorBoundary pageName="Service Details">
        <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column - Service Details (2/3 width) */}
            <div className="lg:col-span-2">
              {/* Hero Image */}
              <div className="relative h-[280px] md:h-[400px] rounded-2xl overflow-hidden mb-6">
                <img
                  src={getServiceImage()}
                  alt={service.name}
                  className="w-full h-full object-cover"
                />
                {/* Action buttons */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={toggleFavorite}
                    className={`p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-md transition-colors ${
                      isFavorited ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={shareService}
                    className="p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-md text-gray-600 hover:text-blue-500 transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
                {service.isFeatured && (
                  <span className="absolute top-4 left-4 px-3 py-1.5 bg-nilin-accent text-white text-xs font-semibold rounded-full">
                    Featured
                  </span>
                )}
              </div>

              {/* Service Info */}
              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-nilin-blush/50 text-nilin-rose text-xs font-medium rounded-full mb-3">
                  {service.category}
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-3">{service.name}</h1>
                <div className="flex items-center gap-4 text-sm text-nilin-warmGray mb-4">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 px-2 py-1 bg-green-50 rounded">
                      <Star className="w-3.5 h-3.5 text-green-600 fill-green-600" />
                      <span className="text-xs font-semibold text-green-700">{service.rating.average.toFixed(1)}</span>
                    </div>
                    <span className="text-nilin-lightGray">({service.rating.count} reviews)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{service.duration} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{service.location.address.city}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-nilin-charcoal mb-3">About this service</h3>
                <p className="text-nilin-warmGray leading-relaxed">{service.description}</p>
              </div>

              {/* What's Included */}
              {service.includedItems && service.includedItems.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-3">What's included</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {service.includedItems.map((item, index) => (
                      <div key={index} className="flex items-start gap-2.5 p-3 bg-nilin-blush/30 rounded-xl border border-nilin-border">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-nilin-charcoal">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {service.requirements && service.requirements.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-3">Requirements</h3>
                  <ul className="space-y-2">
                    {service.requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-nilin-warmGray">
                        <span className="text-nilin-coral mt-1">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reviews */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Customer reviews</h3>
                <div className="bg-nilin-blush/30 rounded-2xl p-5 md:p-6 border border-nilin-border">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="text-center flex-shrink-0">
                      <div className="text-4xl font-bold text-nilin-charcoal mb-1">{service.rating.average.toFixed(1)}</div>
                      <div className="flex items-center justify-center gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= Math.round(service.rating.average)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-nilin-muted fill-nilin-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-nilin-warmGray">{service.rating.count} reviews</p>
                    </div>
                    <div className="flex-1 space-y-2">
                      {ratingPercentages.map(({ stars, percentage }) => (
                        <div key={stars} className="flex items-center gap-3">
                          <span className="text-sm text-nilin-warmGray w-3">{stars}</span>
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <div className="flex-1 h-2 bg-nilin-muted/30 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-xs text-nilin-lightGray w-8">{percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {service.tags.length > 0 && (
                <div className="mb-8">
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 bg-nilin-blush/50 text-nilin-rose text-sm rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Sticky booking card (1/3 width) */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {/* Booking Card */}
                <div className="bg-white rounded-2xl p-6 border border-nilin-border shadow-sm">
                  <div className="text-center mb-5">
                    <div className="text-3xl font-bold text-nilin-charcoal mb-1">
                      {service.price.currency || 'AED'} {service.price.amount}
                    </div>
                    <div className="text-sm text-nilin-warmGray">per {service.price.type}</div>
                  </div>
                  <button
                    onClick={handleBookNow}
                    className="w-full py-3 bg-nilin-coral text-white rounded-full font-semibold hover:bg-nilin-rose transition-colors mb-3"
                  >
                    Book Now
                  </button>
                  <div className="text-center text-sm text-green-600 flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Instant booking available
                  </div>
                </div>

                {/* Provider Info Card */}
                {service.provider && (
                  <div className="bg-white rounded-2xl p-6 border border-nilin-border shadow-sm">
                    <h3 className="text-sm font-semibold text-nilin-charcoal mb-4">About the provider</h3>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-nilin-blush/50 flex items-center justify-center overflow-hidden">
                        {service.provider.avatar ? (
                          <img src={service.provider.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-nilin-coral" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-nilin-charcoal text-sm">
                          {service.provider.businessInfo?.businessName || `${service.provider.firstName} ${service.provider.lastName}`}
                        </h4>
                        {service.provider.rating && (
                          <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {typeof service.provider.rating === 'number'
                              ? service.provider.rating.toFixed(1)
                              : `${service.provider.rating.average.toFixed(1)} (${service.provider.rating.count})`
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    {service.provider.businessInfo?.description && (
                      <p className="text-xs text-nilin-warmGray line-clamp-3 mb-3">
                        {service.provider.businessInfo.description}
                      </p>
                    )}
                    <button
                      onClick={() => navigate(`/provider/${service.provider!._id}`)}
                      className="w-full py-2 border border-nilin-border rounded-full text-sm font-medium text-nilin-charcoal hover:bg-nilin-blush/30 transition-colors"
                    >
                      View Profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </PageErrorBoundary>

      {/* Mobile Fixed Bottom Booking Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-nilin-border px-4 py-3 z-50 lg:hidden">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <span className="text-xl font-bold text-nilin-charcoal">
              {service.price.currency || 'AED'} {service.price.amount}
            </span>
            <span className="text-xs text-nilin-warmGray ml-1">/{service.price.type}</span>
          </div>
          <button
            onClick={handleBookNow}
            className="px-6 py-2.5 bg-nilin-coral text-white rounded-full font-semibold text-sm hover:bg-nilin-rose transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>

      {/* Spacer for mobile fixed bar */}
      <div className="h-16 lg:hidden" />

      <Footer />
    </div>
  );
};

export default ServiceDetailPage;
