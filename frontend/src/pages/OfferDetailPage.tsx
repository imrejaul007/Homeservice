import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import { useAuthStore } from '../stores/authStore';
import { offerService } from '../services/offerService';
import { toast } from 'react-hot-toast';
import {
  Sparkles,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Check,
  Copy,
  Search,
  ChevronRight
} from 'lucide-react';

interface ServiceSummary {
  _id: string;
  name: string;
  category?: { name: string };
  subcategory?: { name: string };
  shortDescription?: string;
  price: { amount: number; currency: string };
  duration: number;
  rating?: { average: number; count: number };
  thumbnail?: string;
}

interface OfferDetail {
  _id: string;
  code: string;
  title: string;
  description?: string;
  displayTitle?: string;
  displaySubtitle?: string;
  displayGradient?: string;
  displayBadge?: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  validUntil?: string;
  minOrderValue: number;
  applicableServices?: string[];
  applicableCategories?: string[];
}

const OfferDetailPage: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, tokens } = useAuthStore();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    loadOfferData();
  }, [offerId]);

  const loadOfferData = async () => {
    if (!offerId) return;

    setIsLoading(true);
    try {
      // Get offer details
      const offerData = await offerService.getOfferById(offerId);
      if (offerData) {
        setOffer(offerData);

        // If offer has linked services, load them
        if (offerData.applicableServices && offerData.applicableServices.length > 0) {
          await loadLinkedServices(offerData.applicableServices);
        }

        // If offer has linked categories, load services by category
        if (offerData.applicableCategories && offerData.applicableCategories.length > 0) {
          await loadServicesByCategory(offerData.applicableCategories);
        }

        // Check if already claimed
        if (isAuthenticated) {
          const claims = await offerService.getMyClaims();
          const claimed = claims.some(c => c.offer?._id === offerId || c.offerId === offerId);
          setIsClaimed(claimed);
        }
      }
    } catch (error) {
      console.error('Failed to load offer:', error);
      toast.error('Failed to load offer details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLinkedServices = async (serviceIds: string[]) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = tokens?.accessToken || '';

      const servicesData = await Promise.all(
        serviceIds.map(id =>
          fetch(`${API_URL}/services/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.json())
        )
      );

      const loadedServices = servicesData
        .filter(data => data.success)
        .map(data => data.data?.service || data.data);

      setServices(prev => [...prev, ...loadedServices]);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const loadServicesByCategory = async (categoryIds: string[]) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = tokens?.accessToken || '';

      const servicesData = await Promise.all(
        categoryIds.map(id =>
          fetch(`${API_URL}/services?category=${id}&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.json())
        )
      );

      const loadedServices = servicesData
        .flatMap(data => data.success ? (data.data?.services || data.data || []) : []);

      setServices(prev => {
        const existingIds = new Set(prev.map(s => s._id));
        const newServices = loadedServices.filter((s: ServiceSummary) => !existingIds.has(s._id));
        return [...prev, ...newServices];
      });
    } catch (error) {
      console.error('Failed to load services by category:', error);
    }
  };

  const handleClaimOffer = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to claim this offer');
      navigate('/login');
      return;
    }

    if (!offerId) return;

    setIsClaiming(true);
    try {
      const result = await offerService.claimOffer(offerId);
      if (result.success) {
        toast.success(result.message || 'Offer claimed successfully!');
        setIsClaimed(true);
      } else {
        toast.error(result.message || 'Failed to claim offer');
      }
    } catch (error) {
      toast.error('Failed to claim offer');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopyCode = async () => {
    if (offer?.code) {
      await navigator.clipboard.writeText(offer.code);
      setCopiedCode(true);
      toast.success(`Code "${offer.code}" copied!`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleBookService = (serviceId: string) => {
    // Navigate to book service page with offer code
    navigate(`/book/${serviceId}`, { state: { couponCode: offer?.code } });
  };

  const handleBrowseServices = () => {
    if (offer?.applicableCategories?.length > 0) {
      navigate(`/search?category=${offer.applicableCategories[0]}`);
    } else {
      navigate('/search');
    }
  };

  const getGradientClass = (gradient?: string): string => {
    const map: Record<string, string> = {
      'from-nilin-rose to-nilin-coral': 'from-rose-500 via-pink-400 to-rose-300',
      'from-nilin-charcoal to-gray-700': 'from-gray-800 via-gray-700 to-gray-600',
      'from-yellow-400 to-orange-500': 'from-yellow-400 via-orange-400 to-orange-500',
      'from-green-400 to-teal-500': 'from-green-400 via-teal-400 to-teal-500',
    };
    return map[gradient || ''] || 'from-rose-500 via-pink-400 to-rose-300';
  };

  const getDiscountText = () => {
    if (!offer) return '';
    if (offer.type === 'percentage') return `${offer.value}% OFF`;
    if (offer.type === 'fixed') return `AED ${offer.value} OFF`;
    if (offer.type === 'free_service') return 'FREE SERVICE';
    return 'SPECIAL OFFER';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream">
        <NavigationHeader />
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-3 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-nilin-cream">
        <NavigationHeader />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-serif text-nilin-charcoal mb-4">Offer Not Found</h1>
          <button onClick={() => navigate('/')} className="btn-nilin">
            Go Home
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 pt-4">
        <Breadcrumb items={[{ label: 'Special Offers', href: '/' }, { label: offer.displayTitle || offer.title }]} />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Offer Hero */}
        <div className={`bg-gradient-to-br ${getGradientClass(offer.displayGradient)} rounded-3xl p-8 md:p-12 text-white mb-8 relative overflow-hidden`}>
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center gap-1 px-4 py-2 bg-white/25 backdrop-blur-sm rounded-full text-lg font-bold">
              <Sparkles className="w-5 h-5" />
              {getDiscountText()}
            </span>
          </div>

          {offer.displayBadge && (
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium mb-4">
              {offer.displayBadge}
            </span>
          )}

          <h1 className="text-3xl md:text-4xl font-serif mb-3">
            {offer.displayTitle || offer.title}
          </h1>
          <p className="text-lg text-white/80 mb-6">
            {offer.displaySubtitle || offer.description}
          </p>

          {/* Promo Code Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between max-w-md">
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">Use code at checkout</p>
              <p className="text-2xl font-mono font-bold text-nilin-charcoal">{offer.code}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-3 rounded-xl bg-nilin-coral/10 hover:bg-nilin-coral/20 transition-colors"
            >
              {copiedCode ? (
                <Check className="w-6 h-6 text-green-600" />
              ) : (
                <Copy className="w-6 h-6 text-nilin-coral" />
              )}
            </button>
          </div>

          {/* Offer Details */}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-white/80">
            {offer.validUntil && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Valid until {new Date(offer.validUntil).toLocaleDateString()}
              </div>
            )}
            {offer.minOrderValue > 0 && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Min. order AED {offer.minOrderValue}
              </div>
            )}
          </div>
        </div>

        {/* Claim Button */}
        <div className="bg-white rounded-2xl border border-nilin-border p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-serif text-nilin-charcoal mb-1">
                {isClaimed ? 'Offer Claimed!' : 'Ready to save?'}
              </h2>
              <p className="text-nilin-warmGray">
                {isClaimed
                  ? 'Use this offer on your next booking. Browse services below.'
                  : 'Claim this offer to use on your next booking'}
              </p>
            </div>
            <button
              onClick={isClaimed ? handleBrowseServices : handleClaimOffer}
              disabled={isClaiming}
              className={`px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                isClaimed
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : isClaiming
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:opacity-90 shadow-nilin'
              }`}
            >
              {isClaimed ? (
                <>
                  <Search className="w-5 h-5" />
                  Browse Services
                </>
              ) : isClaiming ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Ticket className="w-5 h-5" />
                  Claim Offer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Linked Services */}
        {services.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif text-nilin-charcoal">
                Services with this offer
              </h2>
              <button
                onClick={handleBrowseServices}
                className="flex items-center gap-1 text-nilin-coral hover:underline"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map(service => (
                <div
                  key={service._id}
                  className="bg-white rounded-2xl border border-nilin-border overflow-hidden hover:shadow-nilin-lg transition-all group"
                >
                  {/* Service Image */}
                  <div className="h-40 bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center">
                    {service.thumbnail ? (
                      <img src={service.thumbnail} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-12 h-12 text-nilin-coral/50" />
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-nilin-charcoal line-clamp-1">{service.name}</h3>
                      {service.rating && (
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-yellow-500">★</span>
                          <span className="text-nilin-charcoal">{service.rating.average}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-nilin-warmGray line-clamp-2 mb-3">
                      {service.shortDescription || service.category?.name}
                    </p>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-nilin-charcoal">
                          AED {service.price?.amount || 0}
                        </span>
                        {service.duration && (
                          <span className="text-xs text-nilin-warmGray ml-2">
                            {service.duration} min
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleBookService(service._id)}
                        disabled={!isClaimed}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1 ${
                          isClaimed
                            ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Book
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No linked services - show browse all */}
        {services.length === 0 && (
          <div className="bg-white rounded-2xl border border-nilin-border p-8 text-center">
            <Search className="w-16 h-16 text-nilin-warmGray mx-auto mb-4" />
            <h3 className="text-xl font-serif text-nilin-charcoal mb-2">
              Browse all services
            </h3>
            <p className="text-nilin-warmGray mb-6">
              This offer can be used on any service
            </p>
            <button onClick={handleBrowseServices} className="btn-nilin">
              <Search className="w-5 h-5 mr-2" />
              Browse Services
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default OfferDetailPage;
