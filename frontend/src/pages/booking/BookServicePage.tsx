import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import BookingFormWizard from '../../components/booking/BookingFormWizard';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types/search';
import { searchApi } from '../../services/searchApi';

const BookServicePage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isGuest = !isAuthenticated;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);

  // CRITICAL: Load service and variant from state or fetch from API
  useEffect(() => {
    // First check if service was passed via state (faster, no API call)
    const stateService = location.state?.service as Service | undefined;

    // Check if the state service matches the URL serviceId (flexible check)
    const stateServiceId = (stateService as any)?._id || (stateService as any)?.id;
    if (stateService && stateServiceId === serviceId) {
      console.log('[BookServicePage] Service loaded from state:', stateService.name, 'variant:', (stateService as any).selectedVariant);
      setService(stateService);
      // Also store variant info if passed
      if ((stateService as any).selectedVariant !== undefined) {
        setSelectedVariantIndex((stateService as any).selectedVariant);
      }
      setLoading(false);
      return;
    }

    // If not in state, fetch from API
    if (serviceId) {
      fetchServiceDetails();
    } else {
      setError('Invalid service ID');
      setLoading(false);
    }
  }, [serviceId]);

  // When navigating TO search, it means something went wrong - log it
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath === '/search' || currentPath.startsWith('/search?')) {
      console.error('[BookServicePage] REDIRECT TO SEARCH DETECTED - This should not happen!');
      console.error('This means BookServicePage could not load the service.');
    }
  }, [location.pathname]);

  // Idempotency keys are generated fresh on each submit inside BookingFormWizard.
  // Do NOT persist them in sessionStorage — that caused stale bookings to be returned
  // when the user changed date, time, or coupon and tried again.

  const fetchServiceDetails = async () => {
    if (!serviceId) {
      setError('Invalid service ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('[BookServicePage] Fetching service:', serviceId);

      // Use the searchApi service to fetch service details
      const response = await searchApi.getServiceById(serviceId);

      if (response.success && response.data?.service) {
        const fetchedService = response.data.service;
        console.log('[BookServicePage] Service fetched successfully:', fetchedService.name);
        setService(fetchedService);
      } else {
        console.error('[BookServicePage] Service not found:', response);
        setError('Service not found. It may have been removed.');
      }
    } catch (error) {
      console.error('[BookServicePage] Error fetching service:', error);
      setError('Unable to load service details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingSuccess = (bookingId: string, bookingNumber?: string) => {
    // Clear the booking state from sessionStorage
    sessionStorage.removeItem(`booking_idempotency_${serviceId}`);

    if (isGuest && bookingNumber) {
      navigate(`/track/${bookingNumber}`, {
        state: { message: 'Booking created successfully! Check your email for details.' }
      });
    } else {
      navigate(`/customer/bookings/${bookingId}`, {
        state: { message: 'Booking created successfully!' }
      });
    }
  };

  const handleCancel = () => {
    // Clear the booking state
    sessionStorage.removeItem(`booking_idempotency_${serviceId}`);
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading service details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-50 rounded-full p-3 w-16 h-16 mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Service</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-x-4">
              <button
                onClick={() => navigate('/search')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Browse Services
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Service not found</p>
            <button
              onClick={() => navigate('/search')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Search
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Normalize providerId (search API may return a populated object)
  const resolveProviderId = (svc: Service): string => {
    const raw = svc.providerId ?? (svc.provider as { _id?: string })?._id;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && '_id' in raw) {
      return String((raw as { _id: unknown })._id);
    }
    return '';
  };

  const resolvedProviderId = resolveProviderId(service);

  // Extract offer/coupon data from navigation state
  const offerData = location.state as {
    couponCode?: string;
    offerId?: string;
    offerDetails?: {
      code: string;
      title: string;
      type: 'percentage' | 'fixed' | 'free_service';
      value: number;
      maxDiscount?: number;
    };
    filterByOffer?: boolean;
  } | undefined;

  // Ensure service has required fields for BookingForm
  const serviceWithDefaults = {
    ...service,
    providerId: resolvedProviderId,
  };

  return (
    <BookingFormWizard
      service={serviceWithDefaults}
      providerId={resolvedProviderId}
      onSuccess={handleBookingSuccess}
      onCancel={handleCancel}
      guestMode={isGuest}
      preloadedOffer={offerData?.couponCode ? {
        code: offerData.couponCode,
        offerId: offerData.offerId,
        offerDetails: offerData.offerDetails,
      } : undefined}
    />
  );
};

export default BookServicePage;