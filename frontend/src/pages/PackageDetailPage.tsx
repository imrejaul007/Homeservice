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
  Scale,
  Edit3,
  Calculator,
  Printer,
  Download,
  Package,
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import Button from '../components/common/Button';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { showDeduplicatedError } from '../utils/toastUtils';
import { normalizeFeatures, packageApi } from '../services/packageApi';
import { PackagePriceCalculator } from '../components/price-calculator';
import type { PriceBreakdown } from '../services/priceCalculatorApi';
import ProviderAvailabilityWidget from '../components/provider/ProviderAvailabilityWidget';
import { WritePackageReviewModal } from '../components/customer/WritePackageReviewModal';
import { ShareModal } from '../components/common/ShareModal';
import { wishlistApi } from '../services/wishlistApi';
import { PrintButton } from '../components/common/PrintButton';
import PackageBookingWizard from '../components/booking/PackageBookingWizard';
import { PriceDisplay, ServicePriceDisplay } from '../components/common/PriceDisplay';
import { CATEGORY_IMAGES } from '../constants/images';

const PACKAGE_CATEGORY_IMAGES: Record<string, string> = {
  bridal: CATEGORY_IMAGES.makeup.hero,
  makeup: CATEGORY_IMAGES.makeup.hero,
  hair: CATEGORY_IMAGES.hair.hero,
  spa: CATEGORY_IMAGES['massage-body'].hero,
  nails: CATEGORY_IMAGES.nails.hero,
  skincare: CATEGORY_IMAGES['skin-aesthetics'].hero,
  'skin & aesthetics': CATEGORY_IMAGES['skin-aesthetics'].hero,
  'massage & body': CATEGORY_IMAGES['massage-body'].hero,
};

const DEFAULT_PACKAGE_IMAGE = CATEGORY_IMAGES.makeup.hero;

const getPackageDisplayImages = (pkg: BackendServicePackage): string[] => {
  if (pkg.images && pkg.images.length > 0) return pkg.images;
  const cat = pkg.category?.toLowerCase().trim() || '';
  return [PACKAGE_CATEGORY_IMAGES[cat] || DEFAULT_PACKAGE_IMAGE];
};

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

/**
 * Backend ServicePackage format - returned from API
 * Note: provider is flattened as providerId and providerName
 */
interface BackendServicePackage {
  _id: string;
  name: string;
  description: string;
  category: string;
  basePrice?: number;
  discountedPrice?: number;
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  features?: Array<{ name: string; included: boolean }>;
  includedItems?: string[];
  services?: Array<{ _id?: string; serviceId?: string; serviceName?: string; name?: string; duration: number; originalPrice: number }>;
  images?: string[];
  isActive: boolean;
  isFeatured: boolean;
  isPopular?: boolean;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  averageRating?: number;
  totalReviews?: number;
  inclusions?: string[];
  exclusions?: string[];
  terms?: string;
  addOns?: Array<{ name: string; price: number; description?: string }>;
  durationOptions?: Array<{ duration: number; price: number; label: string }>;
}

const PackageDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [pkg, setPkg] = useState<BackendServicePackage | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>();
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | undefined>();
  const [imageLoadError, setImageLoadError] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPriceCalculator, setShowPriceCalculator] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<PriceBreakdown | null>(null);
  const [showPackageWizard, setShowPackageWizard] = useState(false);
  const [wizardSelectedAddOns, setWizardSelectedAddOns] = useState<Array<{ id: string; name: string; price: number; description?: string }>>([]);

  useEffect(() => {
    if (id) {
      fetchPackageDetails();
      if (isAuthenticated) {
        fetchWishlistStatus();
      }
    }
  }, [id, isAuthenticated]);

  const fetchWishlistStatus = async () => {
    if (!id) return;

    try {
      const response = await wishlistApi.checkWishlist(id);
      setIsFavorite(response.data.isInWishlist);
    } catch (error) {
      console.error('Failed to check wishlist status:', error);
      // Default to not favorited if check fails
      setIsFavorite(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/packages/${id}` } });
      return;
    }

    if (!id) return;

    try {
      const response = await wishlistApi.toggleWishlist(id);
      setIsFavorite(response.data.isInWishlist);

      if (response.data.isInWishlist) {
        toast.success('Package added to wishlist');
      } else {
        toast.success('Package removed from wishlist');
      }
    } catch (error) {
      console.error('Failed to toggle wishlist:', error);
      const message = error?.response?.data?.message || 'Failed to update wishlist';
      showDeduplicatedError('Wishlist update failed', message);
    }
  };

  const fetchPackageDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await packageApi.getPackage(id!);
      const packageData = result.package;
      setPkg(packageData as unknown as BackendServicePackage);
      // Cast to any to access reviews - the API returns them but type doesn't include them
      setReviews((result as unknown as { reviews?: Review[] }).reviews || []);
      setImageLoadError(false);
      setSelectedImageIndex(0);
    } catch (err) {
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

  const handleContactProvider = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/packages/${id}` } });
      return;
    }
    if (pkg?.providerId) {
      navigate('/customer/messages', { state: { providerId: pkg.providerId } });
    } else {
      showDeduplicatedError('Unable to contact provider', 'Please try again later.');
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleSlotSelect = (slot: { id: string; startTime: string }, date: string) => {
    setSelectedDate(date);
    setSelectedSlot(slot.id);
    setSelectedSlotTime(slot.startTime);
    // Show toast with selected date/time for confirmation
    const slotTime = slot.startTime;
    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-AE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    toast.success(
      <div>
        <p className="font-medium">Selected: {formattedDate}</p>
        <p className="text-sm opacity-80">{slotTime}</p>
      </div>
    );
  };

  const handleBookWithSelectedSlot = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/packages/${id}` } });
      return;
    }
    navigate(`/book-package/${id}`, {
      state: {
        scheduledDate: selectedDate,
        scheduledTime: selectedSlotTime,
        fromPackageDetail: true,
      },
    });
  };

  const mapPackageService = (s: NonNullable<BackendServicePackage['services']>[number]) => ({
    _id: s.serviceId || s._id || '',
    name: s.serviceName || s.name || 'Service',
    duration: s.duration || 60,
    price: s.originalPrice || 0,
  });

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

  const handleWriteReview = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/packages/${id}` } });
      return;
    }
    setShowReviewModal(true);
  };

  const handleReviewSubmitted = (reviewId: string) => {
    toast.success('Review submitted! It will appear after admin approval.');
    // Refresh the page to show the new review (after approval)
    fetchPackageDetails();
  };

  const handlePriceChange = (breakdown: PriceBreakdown) => {
    setCalculatedPrice(breakdown);
  };

  const handleBookEntirePackage = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/packages/${id}` } });
      return;
    }

    // Get selected add-ons from the calculator if it's shown
    // The calculator component tracks its own selected add-ons internally
    // We'll pass whatever add-ons were selected in the calculator

    // If there's a price breakdown with add-ons, extract them
    const selectedAddOns =
      calculatedPrice?.addOns?.map((addon, index) => ({
        id: `addon-${index}`,
        name: addon.name,
        price: addon.price,
      })) || [];

    setWizardSelectedAddOns(selectedAddOns);
    setShowPackageWizard(true);
  };

  const handlePackageWizardComplete = (bookingId: string, bookingNumber?: string) => {
    toast.success('Package booked successfully!');
    // Navigate to booking confirmation or tracking page
    if (bookingNumber) {
      navigate(`/track/${bookingNumber}`);
    } else if (bookingId) {
      navigate(`/customer/bookings/${bookingId}`);
    } else {
      navigate('/customer/bookings');
    }
  };

  const handlePackageWizardCancel = () => {
    setShowPackageWizard(false);
  };

  // Transform addOns to match calculator component format
  const calculatorAddOns = pkg?.addOns?.map((addon, index) => ({
    id: `addon-${index}`,
    name: addon.name,
    price: addon.price,
    description: addon.description,
  })) || [];

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

  const displayImages = getPackageDisplayImages(pkg);

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
                <div className="relative h-80 md:h-96 bg-gradient-to-br from-nilin-coral/20 to-nilin-blush/30">
                  {displayImages.length > 0 && !imageLoadError ? (
                    <img
                      src={displayImages[selectedImageIndex]}
                      alt={pkg.name}
                      className="w-full h-full object-cover"
                      onError={() => setImageLoadError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-9xl opacity-30">📦</span>
                    </div>
                  )}

                  {displayImages.length > 1 && !imageLoadError && (
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      {displayImages.map((img, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                            selectedImageIndex === index
                              ? 'border-nilin-coral'
                              : 'border-white/80 opacity-80 hover:opacity-100'
                          }`}
                          aria-label={`View image ${index + 1}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

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
                      onClick={handleToggleWishlist}
                      className={`w-11 h-11 flex items-center justify-center rounded-full ${
                        isFavorite
                          ? 'bg-red-500 text-white'
                          : 'bg-white/90 text-nilin-warmGray hover:text-red-500'
                      } transition-colors`}
                      aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <PrintButton
                      packageId={pkg._id}
                      packageName={pkg.name}
                      variant="icon"
                      size="md"
                      className="!p-3"
                      label="Save as PDF"
                      useDownloadIcon={true}
                    />
                    <button
                      onClick={handleShare}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-white/90 text-nilin-warmGray hover:text-nilin-coral transition-colors"
                      aria-label="Share package"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Discount Badge */}
                  {pkg.pricing.originalPrice && pkg.pricing.originalPrice > pkg.pricing.currentPrice && (
                    <div className="absolute bottom-4 left-4 bg-green-500 text-white font-bold px-4 py-2 rounded-lg">
                      {getDiscountPercentage(pkg.pricing.originalPrice, pkg.pricing.currentPrice)}% OFF
                    </div>
                  )}
                </div>
              </div>

              {/* Package Info */}
              <div className="bg-white rounded-xl p-6">
                <h1 className="text-2xl sm:text-3xl font-serif text-nilin-charcoal mb-4 break-words">{pkg.name}</h1>

                {/* Provider Info */}
                {pkg.providerId && (
                  <Link
                    to={`/provider/${pkg.providerId}`}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-14 h-14 bg-nilin-coral/20 rounded-full flex items-center justify-center overflow-hidden">
                      {pkg.providerAvatar ? (
                        <img src={pkg.providerAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-nilin-coral">
                          {(pkg.providerName || 'P').charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-nilin-charcoal">
                          {pkg.providerName || 'Provider'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-nilin-warmGray mt-1">
                        {pkg.averageRating !== undefined && pkg.averageRating > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span>{pkg.averageRating.toFixed(1)}</span>
                            <span>({pkg.totalReviews || 0})</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
                  </Link>
                )}

                {/* Description */}
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-nilin-charcoal mb-3">About this package</h2>
                  <p className="text-nilin-warmGray leading-relaxed">{pkg.description}</p>
                </div>

                {/* Duration and Rating */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 border-y border-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-nilin-coral" />
                    <span className="text-nilin-charcoal">{pkg.duration.totalMinutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-nilin-charcoal font-medium">{pkg.averageRating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-nilin-warmGray">({pkg.totalReviews || 0} reviews)</span>
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
                    {normalizeFeatures(pkg.features || pkg.includedItems).map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-nilin-warmGray">{feature.name}</span>
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
                    Customer Reviews ({reviews.length})
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(pkg.averageRating || 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {isAuthenticated && (
                      <button
                        onClick={handleWriteReview}
                        className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors text-sm font-medium"
                      >
                        <Edit3 className="w-4 h-4" />
                        Write a Review
                      </button>
                    )}
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
                              {(review.user?.name || 'Customer').charAt(0).toUpperCase()}
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
            <div className="lg:col-span-1 space-y-4">
              {/* Price Calculator (optional) */}
              {showPriceCalculator && (calculatorAddOns.length > 0 || (pkg.durationOptions && pkg.durationOptions.length > 0)) && (
                <PackagePriceCalculator
                  packageId={pkg._id}
                  basePrice={pkg.pricing.currentPrice}
                  currency={pkg.pricing.currency}
                  addOns={calculatorAddOns}
                  durationOptions={pkg.durationOptions}
                  defaultDuration={pkg.duration.totalMinutes}
                  onPriceChange={handlePriceChange}
                />
              )}

              {/* Booking Card — always visible */}
              <div className="bg-white rounded-xl p-6 shadow-sm sticky top-4">
                {/* Price */}
                <div className="mb-6">
                  <ServicePriceDisplay
                    price={calculatedPrice?.totalAmount || pkg.pricing.currentPrice}
                    originalPrice={
                      pkg.pricing.originalPrice > pkg.pricing.currentPrice
                        ? pkg.pricing.originalPrice
                        : undefined
                    }
                    originalCurrency={pkg.pricing.currency}
                  />
                  {pkg.pricing.originalPrice > pkg.pricing.currentPrice && (
                    <p className="text-green-600 font-medium text-sm mt-1">
                      Save{' '}
                      <PriceDisplay
                        price={pkg.pricing.originalPrice - pkg.pricing.currentPrice}
                        originalCurrency={pkg.pricing.currency}
                        size="sm"
                        className="inline"
                      />
                    </p>
                  )}
                </div>

                {/* Book Button */}
                <Button
                  onClick={handleBookWithSelectedSlot}
                  className="w-full mb-3"
                  size="lg"
                >
                  {selectedDate && selectedSlot ? 'Continue to Booking' : 'Book Now'}
                </Button>

                {/* Book Entire Package Button */}
                {(pkg.services && pkg.services.length > 1) && (
                  <Button
                    onClick={handleBookEntirePackage}
                    variant="secondary"
                    className="w-full mb-4 bg-gradient-to-r from-nilin-coral/10 to-nilin-blush/10 border-nilin-coral/30 hover:from-nilin-coral/20 hover:to-nilin-blush/20"
                    size="lg"
                  >
                    <Package className="w-5 h-5 mr-2" />
                    Book Entire Package
                  </Button>
                )}

                {/* Compare Button */}
                <button
                  onClick={() => {
                    const existingIds = sessionStorage.getItem('comparePackageIds');
                    let currentIds: string[] = existingIds ? JSON.parse(existingIds) : [];
                    const wasAdded = id && !currentIds.includes(id);

                    if (wasAdded && id) {
                      currentIds.push(id);
                      sessionStorage.setItem('comparePackageIds', JSON.stringify(currentIds));
                      toast.success('Package added to compare list');
                    } else if (id && currentIds.includes(id)) {
                      toast('Package already in compare list', { icon: '📊' });
                    }

                    navigate('/packages/compare');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-nilin-coral text-nilin-coral rounded-xl hover:bg-nilin-coral/5 transition-colors mb-4"
                >
                  <Scale className="w-5 h-5" />
                  <span>Add to Compare</span>
                </button>

                {/* Contact Provider */}
                <button
                  onClick={handleContactProvider}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mb-4"
                >
                  <MessageSquare className="w-5 h-5 text-nilin-warmGray" />
                  <span className="text-nilin-charcoal">Contact Provider</span>
                </button>

                {/* Save as PDF Button */}
                <PrintButton
                  packageId={pkg._id}
                  packageName={pkg.name}
                  variant="icon-text"
                  size="lg"
                  className="w-full mb-4"
                  label="Save as PDF"
                  useDownloadIcon={true}
                />

                {/* Quick Info */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-nilin-warmGray" />
                    <div>
                      <p className="text-sm text-nilin-warmGray">Duration</p>
                      <p className="font-medium text-nilin-charcoal">{pkg.duration.formatted}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-nilin-warmGray" />
                    <div>
                      <p className="text-sm text-nilin-warmGray">Availability</p>
                      <button
                        onClick={() => setShowAvailabilityCalendar(!showAvailabilityCalendar)}
                        className="font-medium text-nilin-coral hover:underline"
                      >
                        {selectedDate && selectedSlotTime
                          ? `${selectedDate} at ${selectedSlotTime}`
                          : selectedDate
                            ? 'Date selected'
                            : 'Check available dates'}
                      </button>
                    </div>
                  </div>

                  {/* Toggle Calculator Button */}
                  {(calculatorAddOns.length > 0 || (pkg.durationOptions && pkg.durationOptions.length > 0)) && (
                    <button
                      onClick={() => setShowPriceCalculator(!showPriceCalculator)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-nilin-coral hover:bg-nilin-coral/5 rounded-lg transition-colors"
                    >
                      <Calculator className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {showPriceCalculator ? 'Hide Calculator' : 'Customize & Calculate Price'}
                      </span>
                    </button>
                  )}

                </div>

                {/* Availability Calendar */}
                {showAvailabilityCalendar && pkg.providerId && (
                  <div className="mt-4 pt-6 border-t border-gray-100">
                    <ProviderAvailabilityWidget
                      providerId={pkg.providerId}
                      selectedDate={selectedDate}
                      selectedSlot={selectedSlot}
                      onSlotSelect={handleSlotSelect}
                      compact={false}
                      showCalendar={true}
                      durationMinutes={pkg.duration.totalMinutes}
                    />
                  </div>
                )}

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

      {/* Write Review Modal */}
      {pkg && (
        <WritePackageReviewModal
          open={showReviewModal}
          onOpenChange={setShowReviewModal}
          packageId={pkg._id}
          packageName={pkg.name}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}

      {/* Package Booking Wizard Modal */}
      {showPackageWizard && pkg && (
        <div className="fixed inset-0 z-50 overflow-auto">
          <div className="min-h-screen">
            <PackageBookingWizard
              packageData={{
                id: pkg._id,
                name: pkg.name,
                services: (pkg.services || []).map((s) => {
                  const mapped = mapPackageService(s);
                  return {
                    _id: mapped._id,
                    name: mapped.name,
                    duration: mapped.duration,
                    price: mapped.price,
                    category: pkg.category,
                    description: pkg.description || '',
                    providerId: pkg.providerId,
                    provider: {
                      _id: pkg.providerId,
                      firstName: pkg.providerName || 'Provider',
                      lastName: '',
                      isVerified: true,
                    },
                    rating: pkg.averageRating || 0,
                    reviewCount: pkg.totalReviews || 0,
                    images: pkg.images || [],
                    isActive: pkg.isActive,
                    variants: [],
                    variantDetails: null,
                    selectedVariant: 0,
                    location: { type: 'provider', coordinates: [0, 0] },
                    tags: [],
                    createdAt: '',
                    updatedAt: '',
                  };
                }),
                basePrice: pkg.pricing.currentPrice,
                provider: {
                  _id: pkg.providerId,
                  firstName: pkg.providerName || 'Provider',
                  lastName: '',
                  isVerified: true,
                  rating: pkg.averageRating || 0,
                  avatar: pkg.providerAvatar,
                },
              }}
              selectedAddOns={wizardSelectedAddOns.map((addon: any) => ({
                _id: addon.id,
                name: addon.name,
                price: addon.price,
                description: addon.description,
              }))}
              calculatedPrice={{
                subtotal: calculatedPrice?.subtotal || pkg.pricing.currentPrice,
                addOnsTotal: calculatedPrice?.addOnsTotal || 0,
                discount: calculatedPrice?.discount || 0,
                tax: calculatedPrice?.tax || 0,
                total: calculatedPrice?.totalAmount || pkg.pricing.currentPrice,
              }}
              onComplete={handlePackageWizardComplete}
              onCancel={handlePackageWizardCancel}
              initialScheduledDate={selectedDate}
              initialScheduledTime={selectedSlotTime}
            />
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={pkg?.name || 'Package'}
        description={pkg?.description}
        url={typeof window !== 'undefined' ? window.location.href : ''}
        image={displayImages[0]}
        itemType="package"
        itemId={pkg?._id}
      />
    </div>
  );
};

export default PackageDetailPage;
