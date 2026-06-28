import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import BookingFormWizard from '../../components/booking/BookingFormWizard';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types/search';
import type { BookingAttributionContext } from '../../types/bookingAttribution';
import { searchApi } from '../../services/searchApi';
import { showDeduplicatedError } from '../../utils/toastUtils';

const BookServicePage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isGuest = !isAuthenticated;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stateService = location.state?.service as Service | undefined;
    const stateServiceId = (stateService as { _id?: string; id?: string })?._id
      || (stateService as { id?: string })?.id;

    if (stateService && stateServiceId === serviceId) {
      setService(stateService);
      setLoading(false);
      return;
    }

    if (serviceId) {
      fetchServiceDetails();
    } else {
      setError('Invalid service ID');
      setLoading(false);
    }
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    if (!serviceId) {
      setError('Invalid service ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await searchApi.getServiceById(serviceId);

      if (response.success && response.data?.service) {
        setService(response.data.service);
      } else {
        setError('Service not found. It may have been removed.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load service details. Please try again.';
      setError(message);
      showDeduplicatedError('Failed to load service', message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingSuccess = (bookingId: string, bookingNumber?: string) => {
    sessionStorage.removeItem(`booking_idempotency_${serviceId}`);

    if (isGuest && bookingNumber) {
      navigate(`/track/${bookingNumber}`, {
        state: { message: 'Booking created successfully! Check your email for details.' },
      });
    } else {
      navigate(`/customer/bookings/${bookingId}`, {
        state: { message: 'Booking created successfully!' },
      });
    }
  };

  const attribution = (location.state as { attribution?: BookingAttributionContext })?.attribution;
  const providerId = (location.state as { providerId?: string })?.providerId
    || (service as { providerId?: string })?.providerId
    || service?.provider?._id;

  if (loading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-rose/30 border-t-nilin-rose rounded-full animate-spin mx-auto mb-4" />
            <p className="text-nilin-warmGray">Loading service details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal mb-2">Unable to Load Service</h2>
            <p className="text-nilin-warmGray mb-6">{error || 'Service not found'}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={fetchServiceDetails}
                className="px-6 py-2 bg-nilin-rose text-white rounded-xl font-medium hover:bg-nilin-coral transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/search')}
                className="px-6 py-2 border border-nilin-border text-nilin-charcoal rounded-xl font-medium hover:bg-white transition-colors"
              >
                Browse Services
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <BookingFormWizard
      service={service}
      providerId={providerId || ''}
      guestMode={isGuest}
      attribution={attribution}
      onSuccess={handleBookingSuccess}
      onCancel={() => navigate(-1)}
    />
  );
};

export default BookServicePage;
