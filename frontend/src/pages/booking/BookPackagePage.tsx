import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Package, Check, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Button from '../../components/common/Button';
import { packageApi, type ServicePackage } from '../../services/packageApi';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

interface ServiceItem {
  _id: string;
  name: string;
  duration: number;
  price: number;
}

const BookPackagePage: React.FC = () => {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isGuest = !isAuthenticated;

  const [pkg, setPkg] = useState<ServicePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [proceeding, setProceeding] = useState(false);

  // Get packageId from route params or location state
  const resolvedPackageId = packageId || (location.state as { packageId?: string })?.packageId;

  useEffect(() => {
    if (resolvedPackageId) {
      fetchPackage();
    } else {
      setError('No package specified');
      setLoading(false);
    }
  }, [resolvedPackageId]);

  const fetchPackage = async () => {
    if (!resolvedPackageId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await packageApi.getPackage(resolvedPackageId);
      setPkg(response.package);

      // Auto-select first service if available
      if (response.package.services?.length > 0) {
        setSelectedServiceId(response.package.services[0]._id);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || 'Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToBooking = async () => {
    if (!selectedServiceId || !pkg) {
      toast.error('Please select a service to book');
      return;
    }

    const selectedService = pkg.services.find(s => s._id === selectedServiceId);
    if (!selectedService) {
      toast.error('Selected service not found');
      return;
    }

    // Navigate to regular booking with package and service info
    navigate(`/book/${selectedServiceId}`, {
      state: {
        packageId: pkg._id,
        packageName: pkg.name,
        packagePrice: pkg.pricing.currentPrice,
        isFromPackage: true
      }
    });
  };

  const formatPrice = (price: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-nilin-coral mx-auto mb-4" />
            <p className="text-gray-600">Loading package details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md p-6">
            <div className="bg-red-50 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || 'Package not found'}
            </h2>
            <p className="text-gray-600 mb-6">
              We couldn't load the package details. Please try again.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => navigate('/packages')}>
                Back to Packages
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream">
      <NavigationHeader />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-nilin-warmGray hover:text-nilin-coral transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full mb-4">
            <Package className="w-5 h-5 text-nilin-coral" />
            <span className="text-sm font-medium text-nilin-charcoal">Package Booking</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-nilin-charcoal mb-2">
            Book Your Package
          </h1>
          <p className="text-nilin-warmGray">
            Select a service from your package to proceed with booking
          </p>
        </div>

        {/* Package Summary Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="relative h-48 bg-gradient-to-br from-nilin-coral/20 to-nilin-blush/30">
            <img
              src={pkg.images?.[0] || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'}
              alt={pkg.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="inline-block px-3 py-1 bg-nilin-coral/90 text-white text-sm font-medium rounded-full mb-2">
                {pkg.category}
              </span>
              <h2 className="text-2xl font-bold text-white">{pkg.name}</h2>
            </div>
          </div>

          <div className="p-6">
            {/* Package Description */}
            {pkg.shortDescription && (
              <p className="text-nilin-warmGray mb-6">{pkg.shortDescription}</p>
            )}

            {/* Package Price */}
            <div className="flex items-baseline gap-3 mb-6 pb-6 border-b border-gray-100">
              <span className="text-3xl font-bold text-nilin-charcoal">
                {formatPrice(pkg.pricing.currentPrice, pkg.pricing.currency)}
              </span>
              {pkg.pricing.originalPrice > pkg.pricing.currentPrice && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(pkg.pricing.originalPrice, pkg.pricing.currency)}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                    Save {Math.round(((pkg.pricing.originalPrice - pkg.pricing.currentPrice) / pkg.pricing.originalPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            {/* Package Features */}
            {pkg.features && pkg.features.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-nilin-charcoal mb-3">What's Included</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <span className="w-4 h-4 text-center text-red-400 text-xs">x</span>
                      )}
                      <span className={feature.included ? 'text-nilin-charcoal' : 'text-gray-400 line-through'}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Service Selection */}
        {pkg.services && pkg.services.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
              Select a Service to Book
            </h3>
            <p className="text-sm text-nilin-warmGray mb-4">
              Choose which service from this package you'd like to book first
            </p>

            <div className="space-y-3">
              {pkg.services.map((service: ServiceItem) => (
                <button
                  key={service._id}
                  onClick={() => setSelectedServiceId(service._id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    selectedServiceId === service._id
                      ? 'border-nilin-coral bg-nilin-coral/5'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedServiceId === service._id
                        ? 'border-nilin-coral bg-nilin-coral'
                        : 'border-gray-300'
                    }`}>
                      {selectedServiceId === service._id && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-nilin-charcoal">{service.name}</p>
                      <p className="text-sm text-nilin-warmGray">{service.duration} minutes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-nilin-charcoal">
                      {formatPrice(service.price, pkg.pricing.currency)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty Services State */}
        {(!pkg.services || pkg.services.length === 0) && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center mb-8">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-nilin-charcoal mb-2">No Services Available</h3>
            <p className="text-nilin-warmGray mb-4">
              This package doesn't have any services linked. Please contact support.
            </p>
            <Button variant="secondary" onClick={() => navigate('/packages')}>
              Browse Other Packages
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate(`/packages/${pkg._id}`)}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            View Package Details
          </Button>
          <Button
            onClick={handleProceedToBooking}
            disabled={!selectedServiceId || proceeding}
            loading={proceeding}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Proceed to Booking
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BookPackagePage;
