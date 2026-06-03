import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Star,
  MapPin,
  Clock,
  Check,
  ChevronRight,
  Shield,
  Heart,
  Share2,
  ArrowLeft,
  Calendar,
  User,
  MessageSquare,
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import Button from '../components/common/Button';
import { apiClient } from '../services/api/client';
import { useAuthStore } from '../stores/authStore';

interface Package {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  duration: number;
  category: string;
  subcategory?: string;
  provider: {
    _id: string;
    name: string;
    rating: number;
    reviewCount: number;
    verified: boolean;
    responseTime?: string;
    completedJobs?: number;
    avatar?: string;
    bio?: string;
    location?: string;
  };
  rating: number;
  reviewCount: number;
  images?: string[];
  features: string[];
  inclusions: string[];
  exclusions: string[];
  terms?: string;
  isFeatured?: boolean;
  isPopular?: boolean;
  createdAt: string;
}

interface Review {
  _id: string;
  user: {
    name: string;
    avatar?: string;
  };
  rating: number;
  comment: string;
  createdAt: string;
}

const PackageDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchPackageDetails();
    }
  }, [id]);

  const fetchPackageDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/packages/${id}`);
      setPkg(response.data.data.package);
      setReviews(response.data.data.reviews || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load package details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookNow = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/packages/${id}` } });
      return;
    }
    // Navigate to package booking flow where user selects a service from the package
    navigate(`/book-package/${id}`);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: pkg?.name,
          text: `Check out this service package: ${pkg?.name}`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDiscountPercentage = (original: number, current: number) => {
    return Math.round(((original - current) / original) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">
              {error || 'Package not found'}
            </h2>
            <Button onClick={() => navigate('/packages')}>
              Back to Packages
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb
          items={[
            { label: 'Packages', href: '/packages' },
            { label: pkg.category, href: `/packages?category=${pkg.category}` },
            { label: pkg.name },
          ]}
        />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Image Gallery */}
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="relative h-80 md:h-96 bg-gradient-to-br from-nilin-coral/20 to-nilin-blush/30 flex items-center justify-center">
                  <span className="text-9xl opacity-30">📦</span>

                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    {pkg.isFeatured && (
                      <span className="bg-nilin-coral text-white text-sm font-medium px-4 py-1.5 rounded-full">
                        Featured
                      </span>
                    )}
                    {pkg.isPopular && (
                      <span className="bg-nilin-charcoal text-white text-sm font-medium px-4 py-1.5 rounded-full">
                        Popular
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={`p-3 rounded-full ${
                        isFavorite
                          ? 'bg-red-500 text-white'
                          : 'bg-white/90 text-nilin-warmGray hover:text-red-500'
                      } transition-colors`}
                    >
                      <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-3 rounded-full bg-white/90 text-nilin-warmGray hover:text-nilin-coral transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Discount Badge */}
                  {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                    <div className="absolute bottom-4 left-4 bg-green-500 text-white font-bold px-4 py-2 rounded-lg">
                      {getDiscountPercentage(pkg.originalPrice, pkg.price)}% OFF
                    </div>
                  )}
                </div>
              </div>

              {/* Package Info */}
              <div className="bg-white rounded-xl p-6">
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-4">{pkg.name}</h1>

                {/* Provider Info */}
                <Link
                  to={`/provider/${pkg.provider._id}`}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-14 h-14 bg-nilin-coral/20 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-nilin-coral">
                      {pkg.provider.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-nilin-charcoal">{pkg.provider.name}</h3>
                      {pkg.provider.verified && (
                        <span className="text-blue-500 text-sm">✓ Verified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-nilin-warmGray mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>{pkg.provider.rating.toFixed(1)}</span>
                        <span>({pkg.provider.reviewCount})</span>
                      </div>
                      {pkg.provider.completedJobs && (
                        <span>{pkg.provider.completedJobs} jobs</span>
                      )}
                      {pkg.provider.responseTime && (
                        <span>Responds {pkg.provider.responseTime}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
                </Link>

                {/* Description */}
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-nilin-charcoal mb-3">About this package</h2>
                  <p className="text-nilin-warmGray leading-relaxed">{pkg.description}</p>
                </div>

                {/* Duration and Rating */}
                <div className="flex items-center gap-6 py-4 border-y border-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-nilin-coral" />
                    <span className="text-nilin-charcoal">{pkg.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-nilin-charcoal font-medium">{pkg.rating.toFixed(1)}</span>
                    <span className="text-nilin-warmGray">({pkg.reviewCount} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="text-nilin-charcoal">Quality Guaranteed</span>
                  </div>
                </div>

                {/* Features */}
                <div className="py-6">
                  <h2 className="text-lg font-medium text-nilin-charcoal mb-4">What's included</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pkg.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-nilin-warmGray">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inclusions */}
                {pkg.inclusions && pkg.inclusions.length > 0 && (
                  <div className="py-6 border-t border-gray-100">
                    <h2 className="text-lg font-medium text-nilin-charcoal mb-4">Inclusions</h2>
                    <ul className="space-y-2">
                      {pkg.inclusions.map((item, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-nilin-warmGray">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Exclusions */}
                {pkg.exclusions && pkg.exclusions.length > 0 && (
                  <div className="py-6 border-t border-gray-100">
                    <h2 className="text-lg font-medium text-nilin-charcoal mb-4">Exclusions</h2>
                    <ul className="space-y-2">
                      {pkg.exclusions.map((item, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="text-red-500 flex-shrink-0 mt-0.5">✕</span>
                          <span className="text-nilin-warmGray">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Terms */}
                {pkg.terms && (
                  <div className="py-6 border-t border-gray-100">
                    <h2 className="text-lg font-medium text-nilin-charcoal mb-4">Terms & Conditions</h2>
                    <p className="text-nilin-warmGray text-sm leading-relaxed">{pkg.terms}</p>
                  </div>
                )}
              </div>

              {/* Reviews Section */}
              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-nilin-charcoal">
                    Customer Reviews ({pkg.reviewCount})
                  </h2>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.round(pkg.rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {reviews.length === 0 ? (
                  <p className="text-nilin-warmGray text-center py-8">
                    No reviews yet. Be the first to review this package!
                  </p>
                ) : (
                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review._id} className="pb-6 border-b border-gray-100 last:border-0">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-nilin-coral/20 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-nilin-coral">
                              {review.user.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-nilin-charcoal">{review.user.name}</h4>
                              <span className="text-sm text-nilin-warmGray">
                                {formatDate(review.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mb-2">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < review.rating
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-nilin-warmGray">{review.comment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Booking Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-6 shadow-sm sticky top-4">
                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-nilin-charcoal">
                      {formatPrice(pkg.price)}
                    </span>
                    {pkg.originalPrice && (
                      <span className="text-lg text-nilin-warmGray line-through">
                        {formatPrice(pkg.originalPrice)}
                      </span>
                    )}
                  </div>
                  {pkg.originalPrice && (
                    <span className="text-green-600 font-medium text-sm">
                      Save {formatPrice(pkg.originalPrice - pkg.price)}
                    </span>
                  )}
                </div>

                {/* Book Button */}
                <Button
                  onClick={handleBookNow}
                  className="w-full mb-4"
                  size="lg"
                >
                  Book Now
                </Button>

                {/* Contact Provider */}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mb-6">
                  <MessageSquare className="w-5 h-5 text-nilin-warmGray" />
                  <span className="text-nilin-charcoal">Contact Provider</span>
                </button>

                {/* Quick Info */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-nilin-warmGray" />
                    <div>
                      <p className="text-sm text-nilin-warmGray">Duration</p>
                      <p className="font-medium text-nilin-charcoal">{pkg.duration} minutes</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-nilin-warmGray" />
                    <div>
                      <p className="text-sm text-nilin-warmGray">Availability</p>
                      <p className="font-medium text-nilin-charcoal">Check available dates</p>
                    </div>
                  </div>

                  {pkg.provider.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-nilin-warmGray" />
                      <div>
                        <p className="text-sm text-nilin-warmGray">Service Area</p>
                        <p className="font-medium text-nilin-charcoal">{pkg.provider.location}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Safety Note */}
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Quality Guaranteed</p>
                      <p className="text-sm text-green-700 mt-1">
                        If you're not satisfied, we'll make it right or refund your payment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PackageDetailPage;
