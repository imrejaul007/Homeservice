import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import BookingFormWizard from '../../components/booking/BookingFormWizard';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types/search';

const BookServicePage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isGuest = !isAuthenticated;
  const [service, setService] = useState<Service | null>(location.state?.service || null);
  const [loading, setLoading] = useState(!service);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service && serviceId) {
      fetchServiceDetails();
    }
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the correct search API endpoint to fetch service details
      const response = await fetch(`http://localhost:5000/api/search/service/${serviceId}`);

      if (response.ok) {
        const data = await response.json();
        setService(data.data.service);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch service details');
      }
    } catch (error) {
      console.error('Error fetching service:', error);
      setError('Unable to load service details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingSuccess = (bookingId: string, bookingNumber?: string) => {
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

  // Ensure service has required fields for BookingForm
  const serviceWithDefaults = {
    ...service,
    providerId: service.providerId || (service.provider as any)?._id || ''
  };

  // Debug logging to identify provider ID issues
  console.log('🔍 Service Provider Debug:', {
    service,
    serviceProviderId: service.providerId,
    serviceProviderObject: service.provider,
    serviceProviderObjectId: (service.provider as any)?._id,
    finalProviderId: serviceWithDefaults.providerId
  });

  return (
    <BookingFormWizard
      service={serviceWithDefaults}
      providerId={serviceWithDefaults.providerId}
      onSuccess={handleBookingSuccess}
      onCancel={handleCancel}
      guestMode={isGuest}
    />
  );
};

export default BookServicePage;