import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Home
} from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import Breadcrumb from '../common/Breadcrumb';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types/search';
import type { CreateBookingData, BookingAddOn } from '../../services/BookingService';
import { API_BASE_URL } from '../../config/api';
import { getClaimOffer, type ClaimedOffer } from '../../types/offer';

// ============================================
// Duplicate Submission Prevention
// ============================================
interface PendingRequest {
  timestamp: number;
  requestKey: string;
}

// In-memory store for deduplication (survives component re-renders)
const pendingRequests: Map<string, PendingRequest> = new Map();
const REQUEST_DEDUP_WINDOW_MS = 5000; // 5 second deduplication window

/**
 * Check if a request is a duplicate and mark it as pending
 * Returns true if this is a duplicate request
 */
const isDuplicateRequest = (requestKey: string): boolean => {
  const now = Date.now();
  const existing = pendingRequests.get(requestKey);

  // Check if request exists and is within deduplication window
  if (existing && (now - existing.timestamp) < REQUEST_DEDUP_WINDOW_MS) {
    return true;
  }

  // Mark this request as pending
  pendingRequests.set(requestKey, { timestamp: now, requestKey });

  // Cleanup old entries periodically
  if (pendingRequests.size > 100) {
    for (const [key, value] of pendingRequests.entries()) {
      if ((now - value.timestamp) > REQUEST_DEDUP_WINDOW_MS) {
        pendingRequests.delete(key);
      }
    }
  }

  return false;
};

/**
 * Generate a unique request key for deduplication
 */
const generateRequestKey = (
  serviceId: string,
  providerId: string,
  scheduledDate: string,
  scheduledTime: string,
  isGuest: boolean,
  guestEmail?: string
): string => {
  return `${isGuest ? 'guest' : 'user'}:${serviceId}:${providerId}:${scheduledDate}:${scheduledTime}:${guestEmail || 'authenticated'}`;
};

// New UI Components
import DateCarousel from './ui/DateCarousel';
import TimeSlotGrid from './ui/TimeSlotGrid';
import LocationTypeSelector from './ui/LocationTypeSelector';
import DurationSelector from './ui/DurationSelector';
import ProfessionalPreference from './ui/ProfessionalPreference';
import PaymentMethodSelector from './ui/PaymentMethodSelector';
import BookingSummaryCard from './ui/BookingSummaryCard';
import { TrustBadge } from './ui/TrustBadge';

interface BookingFormWizardProps {
  service: Service;
  providerId: string;
  onSuccess?: (bookingId: string, bookingNumber?: string) => void;
  onCancel?: () => void;
  guestMode?: boolean;
  idempotencyKey?: string;
}

interface FormData {
  // Step 1: Date & Time
  scheduledDate: string;
  scheduledTime: string;

  // Step 2: Service Details
  locationType: 'at_home' | 'hotel';
  selectedDuration: number;
  professionalPreference: 'male' | 'female' | 'no_preference';
  experiencePreference: 'no_preference' | 'specific' | 'any_experience';
  specialRequests: string;

  // Step 3: Payment
  paymentMethod: 'apple_pay' | 'credit_card' | 'cash';

  // Guest info
  guestName: string;
  guestEmail: string;
  guestPhone: string;

  // Legacy fields for compatibility
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  customerInfo: {
    phone: string;
    specialRequests: string;
    accessInstructions: string;
  };
  addOns: BookingAddOn[];
}

// Initial form data factory to avoid reference issues
const createInitialFormData = (serviceDuration: number): FormData => ({
  scheduledDate: new Date().toISOString().split('T')[0],
  scheduledTime: '',
  locationType: 'at_home',
  selectedDuration: serviceDuration,
  professionalPreference: 'no_preference',
  experiencePreference: 'no_preference',
  specialRequests: '',
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  paymentMethod: 'cash',
  address: {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'AE'
  },
  customerInfo: {
    phone: '',
    specialRequests: '',
    accessInstructions: ''
  },
  addOns: []
});

const BookingFormWizard: React.FC<BookingFormWizardProps> = ({
  service,
  providerId,
  onSuccess,
  onCancel,
  guestMode = false,
  idempotencyKey
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, tokens } = useAuthStore();
  const { createBooking, getAvailableSlots, availableSlots, isSubmitting, isLoading, errors } = useBookingStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [confirmedBookingNumber, setConfirmedBookingNumber] = useState<string | null>(null);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [claimedOffers, setClaimedOffers] = useState<ClaimedOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<ClaimedOffer | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Get duration options from service or create default
  const durationOptions = service.durationOptions && service.durationOptions.length > 0
    ? service.durationOptions
    : [{ duration: service.duration, price: typeof service.price === 'number' ? service.price : service.price?.amount || 0, label: `${service.duration} min` }];

  const [formData, setFormData] = useState<FormData>(
    createInitialFormData(durationOptions[0]?.duration || service.duration)
  );

  // New step order as per mockups
  const steps = [
    { number: 1, title: 'Date & Time' },
    { number: 2, title: 'Service Details' },
    { number: 3, title: 'Payment' },
    { number: 4, title: 'Confirmation' }
  ];

  // Get current price based on selected duration
  const getCurrentPrice = () => {
    const selectedOption = durationOptions.find(opt => opt.duration === formData.selectedDuration);
    return selectedOption?.price || (typeof service.price === 'number' ? service.price : service.price?.amount || 0);
  };

  // Load available slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (formData.scheduledDate && providerId) {
        const duration = formData.selectedDuration || service.duration;

        setIsFetchingSlots(true);
        try {
          await getAvailableSlots(providerId, {
            date: formData.scheduledDate,
            duration,
            days: 1
          });
        } catch (err) {
          console.error('Failed to fetch slots:', err);
          toast.error('Failed to load available slots. Please try again.');
        } finally {
          setIsFetchingSlots(false);
        }
      }
    };

    fetchSlots();
  }, [formData.scheduledDate, formData.selectedDuration, providerId, service.duration, getAvailableSlots]);

  // Fetch user's claimed offers
  useEffect(() => {
    const fetchClaimedOffers = async () => {
      if (!isAuthenticated || guestMode) return;

      setLoadingOffers(true);
      try {
        const token = tokens?.accessToken || '';

        const response = await fetch(`${API_BASE_URL}/offers/my/claims`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Filter offers that are applicable to this service or have no restrictions
            const serviceId = String(service._id);
            const categoryId = typeof service.category === 'string' ? service.category : null;

            const applicableOffers = data.data.filter((claim: ClaimedOffer) => {
              const offer = getClaimOffer(claim);
              if (!offer) return false;
              // If no service linking, offer applies to all services
              if (!offer.applicableServices?.length && !offer.applicableCategories?.length) {
                return true;
              }
              if (offer.applicableServices?.some((s: string) => s === serviceId)) {
                return true;
              }
              if (categoryId && offer.applicableCategories?.some((c: string) => c === categoryId)) {
                return true;
              }
              return false;
            });
            setClaimedOffers(applicableOffers);
          }
        }
      } catch {
        // Silently handle claim fetch failure - offers are optional
      } finally {
        setLoadingOffers(false);
      }
    };

    fetchClaimedOffers();
  }, [service, isAuthenticated, guestMode]);

  const handleNext = () => {
    // Validation for Step 1: Date & Time
    if (currentStep === 1) {
      if (!formData.scheduledDate) {
        toast.error('Please select a date');
        return;
      }
      if (!formData.scheduledTime) {
        toast.error('Please select a time slot');
        return;
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // FIX: Track if we're currently submitting to prevent double-submission
  const submitInProgressRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    // FIX: Prevent duplicate submissions using in-memory deduplication
    const requestKey = generateRequestKey(
      String(service._id),
      providerId,
      formData.scheduledDate,
      formData.scheduledTime,
      guestMode,
      formData.guestEmail
    );

    if (isDuplicateRequest(requestKey)) {
      toast.error('Your booking request is being processed. Please wait.');
      return;
    }

    // FIX: Also prevent if submission is already in progress (ref-based as backup)
    if (submitInProgressRef.current) {
      return;
    }
    submitInProgressRef.current = true;

    // Guest mode validation
    if (guestMode) {
      if (!formData.guestName.trim()) {
        submitInProgressRef.current = false;
        toast.error('Please enter your name');
        return;
      }
      if (!formData.guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
        submitInProgressRef.current = false;
        toast.error('Please enter a valid email address');
        return;
      }
      if (!formData.guestPhone.trim()) {
        submitInProgressRef.current = false;
        toast.error('Please enter your phone number');
        return;
      }
    }

    // Location validation for at_home bookings - require address
    if (formData.locationType === 'at_home') {
      if (!formData.address.street.trim()) {
        submitInProgressRef.current = false;
        toast.error('Please enter your street address for at-home service');
        return;
      }
      if (!formData.address.city.trim()) {
        submitInProgressRef.current = false;
        toast.error('Please enter your city for at-home service');
        return;
      }
    }

    // Ensure scheduledDate is always a string in YYYY-MM-DD format
    const formatDateString = (date: string | Date) => {
      if (!date) return new Date().toISOString().split('T')[0];
      if (date instanceof Date) return date.toISOString().split('T')[0];
      return String(date).split('T')[0];
    };

    if (guestMode) {
      // Guest booking - call guest API directly
      setGuestSubmitting(true);
      try {
        const guestBookingData = {
          serviceId: service._id,
          providerId,
          scheduledDate: formatDateString(formData.scheduledDate),
          scheduledTime: formData.scheduledTime,
          guestInfo: {
            name: formData.guestName,
            email: formData.guestEmail,
            phone: formData.guestPhone
          },
          location: {
            type: formData.locationType === 'at_home' ? 'customer_address' : 'provider_location',
            address: formData.address.street ? {
              street: formData.address.street,
              city: formData.address.city,
              state: formData.address.state,
              zipCode: formData.address.zipCode,
              country: formData.address.country || 'AE'
            } : undefined,
            notes: formData.customerInfo.accessInstructions || formData.specialRequests || undefined
          },
          notes: formData.specialRequests || undefined,
          locationType: formData.locationType,
          selectedDuration: formData.selectedDuration,
          professionalPreference: formData.professionalPreference,
          experiencePreference: formData.experiencePreference,
          paymentMethod: formData.paymentMethod,
          couponCode: selectedOffer ? (getClaimOffer(selectedOffer)?.code ?? selectedOffer.couponCode) : undefined
        };

        const response = await fetch(`${API_BASE_URL}/bookings/guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guestBookingData)
        });

        const result = await response.json();

        if (response.ok && result.data) {
          // Guest booking response: bookingNumber, status, scheduledDate, etc. (no _id for guest)
          const bookingData = result.data.booking || result.data;
          setBookingConfirmed(true);
          setConfirmedBookingId(null); // Guest bookings don't have _id linked to user
          setConfirmedBookingNumber(bookingData.bookingNumber || null);
          setCurrentStep(4);
          // Clear form data after successful booking
          setFormData(createInitialFormData(durationOptions[0]?.duration || service.duration));
        } else {
          toast.error(result.message || 'Failed to create booking. Please try again.');
        }
      } catch {
        toast.error('Failed to create booking. Please try again.');
      } finally {
        setGuestSubmitting(false);
        submitInProgressRef.current = false;
      }
    } else {
      // Authenticated booking - use store
      const bookingData = {
        serviceId: service._id,
        providerId,
        scheduledDate: formatDateString(formData.scheduledDate),
        scheduledTime: formData.scheduledTime,
        location: {
          type: formData.locationType === 'at_home' ? 'customer_address' : 'provider_location',
          address: formData.address.street ? {
            street: formData.address.street,
            city: formData.address.city,
            state: formData.address.state,
            zipCode: formData.address.zipCode,
            country: formData.address.country || 'AE'
          } : undefined,
          notes: formData.customerInfo.accessInstructions || formData.specialRequests || undefined
        },
        customerInfo: {
          phone: formData.customerInfo.phone || user?.phone || '',
          specialRequests: formData.specialRequests || undefined,
          accessInstructions: formData.customerInfo.accessInstructions || undefined
        },
        addOns: formData.addOns,
        notes: formData.specialRequests || undefined,
        locationType: formData.locationType,
        selectedDuration: formData.selectedDuration,
        professionalPreference: formData.professionalPreference,
        experiencePreference: formData.experiencePreference,
        paymentMethod: formData.paymentMethod,
        couponCode: selectedOffer ? (getClaimOffer(selectedOffer)?.code ?? selectedOffer.couponCode) : undefined,
        metadata: {
          idempotencyKey: idempotencyKey
        }
      } as CreateBookingData;

      try {
        const booking = await createBooking(bookingData);

        if (booking && booking._id) {
          setBookingConfirmed(true);
          setConfirmedBookingId(booking._id);
          setConfirmedBookingNumber(booking.bookingNumber || null);
          setCurrentStep(4);
          // Clear form data after successful booking
          setFormData(createInitialFormData(durationOptions[0]?.duration || service.duration));
        }
      } catch (error) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.message || err?.message || 'Failed to create booking. Please try again.';
        toast.error(errorMessage);
      } finally {
        submitInProgressRef.current = false;
      }
    }
  }, [service, providerId, formData, guestMode, user, createBooking, idempotencyKey, selectedOffer, durationOptions, guestSubmitting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      submitInProgressRef.current = false;
    };
  }, []);

  // Transform availableSlots to TimeSlotGrid format
  const timeSlots = availableSlots?.map(slot => ({
    time: slot.time,
    isAvailable: slot.isAvailable
  })) || [];

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Header */}
          {!bookingConfirmed && (
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-1 font-serif">Book Your Service</h1>
              <p className="text-sm text-nilin-warmGray">Complete your booking in a few simple steps</p>
            </div>
          )}

          {/* Progress Indicator */}
          {!bookingConfirmed && (
            <div className="mb-10">
              <div className="relative">
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-nilin-muted/50">
                  <div
                    className="h-full bg-nilin-coral transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                  />
                </div>
                <div className="relative flex justify-between">
                  {steps.map((step) => (
                    <div key={step.number} className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                          step.number < currentStep
                            ? 'bg-nilin-coral text-white shadow-nilin-warm'
                            : step.number === currentStep
                            ? 'bg-nilin-coral text-white ring-4 ring-nilin-coral/20 shadow-nilin-warm'
                            : 'card-nilin border-2 border-nilin-muted/50 text-nilin-warmGray'
                        }`}
                      >
                        {step.number < currentStep ? <Check className="h-5 w-5" /> : step.number}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium transition-all duration-300 ${
                          step.number <= currentStep ? 'text-nilin-charcoal' : 'text-nilin-warmGray'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div className="card-nilin rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-nilin-warm">
            {/* Step 1: Date & Time */}
            {currentStep === 1 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  When would you like your {service.name}?
                </h2>
                <p className="text-nilin-warmGray mb-6">Select your preferred date and time</p>

                {/* Date Carousel */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Select Date
                  </label>
                  <DateCarousel
                    selectedDate={formData.scheduledDate}
                    onDateSelect={(date) => {
                      setFormData({ ...formData, scheduledDate: date, scheduledTime: '' });
                    }}
                    maxDays={14}
                  />
                </div>

                {/* Time Slots */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Select Time
                  </label>
                  <TimeSlotGrid
                    slots={timeSlots}
                    selectedTime={formData.scheduledTime}
                    onTimeSelect={(time) => setFormData({ ...formData, scheduledTime: time })}
                    isLoading={isFetchingSlots}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Service Details */}
            {currentStep === 2 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">Service Details</h2>
                <p className="text-nilin-warmGray mb-6">Help us prepare the right professional for you</p>

                {/* Location Type */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                    Where would you like the service?
                  </label>
                  <LocationTypeSelector
                    selected={formData.locationType}
                    onChange={(type) => setFormData({ ...formData, locationType: type })}
                  />
                </div>

                {/* Address Section - Show when At Home is selected */}
                {formData.locationType === 'at_home' && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
                    <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                      Service Address
                    </label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, street: e.target.value }
                          })
                        }
                        placeholder="Street Address / Building Name"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={formData.address.city}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, city: e.target.value }
                            })
                          }
                          placeholder="City"
                          className="px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                        />
                        <input
                          type="text"
                          value={formData.address.state}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, state: e.target.value }
                            })
                          }
                          placeholder="State"
                          className="px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                        />
                      </div>
                      <input
                        type="text"
                        value={formData.address.zipCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, zipCode: e.target.value }
                          })
                        }
                        placeholder="PIN Code"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                  </div>
                )}

                {/* Hotel Address - Show when Hotel is selected */}
                {formData.locationType === 'hotel' && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
                    <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                      Hotel Details
                    </label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: { ...formData.address, street: e.target.value }
                          })
                        }
                        placeholder="Hotel Name"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={formData.address.city}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, city: e.target.value }
                            })
                          }
                          placeholder="City"
                          className="px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                        />
                        <input
                          type="text"
                          value={formData.customerInfo.accessInstructions}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customerInfo: { ...formData.customerInfo, accessInstructions: e.target.value }
                            })
                          }
                          placeholder="Room Number"
                          className="px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Duration Options - Only show if service has multiple options */}
                {durationOptions.length > 1 && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                      Select Duration
                    </label>
                    <DurationSelector
                      options={durationOptions}
                      selected={formData.selectedDuration}
                      onSelect={(duration) => setFormData({ ...formData, selectedDuration: duration })}
                      currency="AED"
                    />
                  </div>
                )}

                {/* Gender Preference */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                    Gender Preference
                  </label>
                  <ProfessionalPreference
                    selected={formData.professionalPreference}
                    onChange={(pref) => setFormData({ ...formData, professionalPreference: pref })}
                  />
                </div>

                {/* Experience Preference */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                    Experience Preference
                  </label>
                  <select
                    value={formData.experiencePreference}
                    onChange={(e) => setFormData({ ...formData, experiencePreference: e.target.value as 'no_preference' | 'specific' | 'any_experience' })}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                  >
                    <option value="no_preference">No Preference</option>
                    <option value="specific">Specific Provider Required</option>
                    <option value="any_experience">Any Experience Level</option>
                  </select>
                </div>

                {/* Special Requests */}
                <div>
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-2">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    value={formData.specialRequests}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                    rows={3}
                    placeholder="Any specific requirements or preferences..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {currentStep === 3 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">Payment Authorization</h2>
                <p className="text-nilin-warmGray mb-6">Select your preferred payment method</p>

                {/* Claimed Offers Section */}
                {!guestMode && (claimedOffers.length > 0 || loadingOffers) && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300">
                    <h3 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-nilin-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Apply Your Claimed Offers
                    </h3>

                    {loadingOffers ? (
                      <div className="flex items-center gap-2 text-nilin-warmGray text-sm">
                        <div className="w-4 h-4 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin"></div>
                        Loading your offers...
                      </div>
                    ) : (
                      <>
                        {claimedOffers.length === 0 ? (
                          <p className="text-sm text-nilin-warmGray">No offers available for this service.</p>
                        ) : (
                          <select
                            value={selectedOffer ? JSON.stringify(selectedOffer) : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setSelectedOffer(JSON.parse(e.target.value));
                              } else {
                                setSelectedOffer(null);
                              }
                            }}
                            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                          >
                            <option value="">No offer selected</option>
                            {claimedOffers.map((claim, index) => {
                              const offer = getClaimOffer(claim);
                              if (!offer) return null;
                              const discountText = offer.type === 'percentage'
                                ? `${offer.value}% OFF`
                                : offer.type === 'fixed'
                                  ? `AED ${offer.value} OFF`
                                  : 'Free Service';
                              return (
                                <option key={offer._id || index} value={JSON.stringify(claim)}>
                                  {offer.code} - {discountText} {offer.title ? `(${offer.title})` : ''}
                                </option>
                              );
                            })}
                          </select>
                        )}

                        {selectedOffer && (() => {
                          const appliedOffer = getClaimOffer(selectedOffer);
                          if (!appliedOffer) return null;
                          const discountLabel = appliedOffer.type === 'percentage'
                            ? `${appliedOffer.value}% OFF`
                            : appliedOffer.type === 'fixed'
                              ? `AED ${appliedOffer.value} OFF`
                              : 'Free Service';
                          return (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-green-800">
                                  {discountLabel} Applied!
                                </p>
                                <p className="text-xs text-green-600">
                                  Code: {appliedOffer.code}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedOffer(null)}
                                className="text-xs text-green-700 hover:text-green-900 underline"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* Guest Info Section */}
                {guestMode && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
                    <h3 className="text-sm font-semibold text-nilin-charcoal mb-3">Your Contact Information</h3>
                    <p className="text-xs text-nilin-warmGray mb-4">We'll send your booking confirmation and tracking details to this email.</p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={formData.guestName}
                        onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                        placeholder="Full Name"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                      <input
                        type="email"
                        value={formData.guestEmail}
                        onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                        placeholder="Email Address"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                      <input
                        type="tel"
                        value={formData.guestPhone}
                        onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                        placeholder="Phone Number"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                  </div>
                )}

                {/* Booking Summary Card */}
                <div className="mb-6">
                  <BookingSummaryCard
                    serviceName={service.name}
                    date={formData.scheduledDate}
                    time={formData.scheduledTime}
                    duration={formData.selectedDuration}
                    locationType={formData.locationType}
                    price={getCurrentPrice()}
                    currency="AED"
                  />
                </div>

                {/* Payment Method */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                    Payment Method
                  </label>
                  <PaymentMethodSelector
                    selected={formData.paymentMethod}
                    onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                  />
                </div>

                {/* Trust Badge */}
                <TrustBadge type="verified" size="sm" />
              </div>
            )}

            {/* Step 4: Confirmation */}
            {(currentStep === 4 || bookingConfirmed) && (
              <div className="text-center py-8">
                {/* Success Icon */}
                <div className="card-nilin w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300">
                  <CheckCircle className="w-12 h-12 text-nilin-success" />
                </div>

                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  Your Booking is Confirmed!
                </h2>
                <p className="text-nilin-warmGray mb-2">
                  {guestMode
                    ? `We've sent a confirmation to ${formData.guestEmail}`
                    : "We've sent a confirmation to your email and phone."}
                </p>

                {/* Show booking number for all users */}
                {confirmedBookingNumber && (
                  <div className="card-nilin p-6 rounded-xl mb-6 inline-block bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300 hover:shadow-nilin-warm">
                    <p className="text-sm text-nilin-warmGray mb-1">Your Booking Number</p>
                    <p className="text-2xl font-bold text-nilin-charcoal tracking-wide">{confirmedBookingNumber}</p>
                    <p className="text-xs text-nilin-warmGray mt-1">Use this to track your booking</p>
                  </div>
                )}

                {/* Booking Details */}
                <div className="card-nilin rounded-xl p-6 mb-8 text-left max-w-md mx-auto transition-all duration-300 hover:shadow-nilin-warm">
                  <h3 className="font-semibold text-nilin-charcoal mb-4">Booking Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-nilin-charcoal">
                      <Calendar className="w-5 h-5 text-nilin-rose" />
                      <span>{new Date(formData.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-nilin-charcoal">
                      <Clock className="w-5 h-5 text-nilin-rose" />
                      <span>{formData.scheduledTime}</span>
                    </div>
                    <div className="flex items-center gap-3 text-nilin-charcoal">
                      <MapPin className="w-5 h-5 text-nilin-rose" />
                      <span>{formData.locationType === 'at_home' ? 'At Home' : 'Hotel'}</span>
                    </div>
                  </div>

                  <div className="border-t border-nilin-border/30 mt-4 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-nilin-charcoal">{service.name}</span>
                      <span className="font-bold text-nilin-coral">AED {getCurrentPrice().toLocaleString('en-AE')}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {guestMode && confirmedBookingNumber ? (
                    <button
                      onClick={() => {
                        navigate(`/track/${confirmedBookingNumber}`);
                        if (onSuccess) onSuccess(confirmedBookingId || '', confirmedBookingNumber);
                      }}
                      className="btn-nilin px-6 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300"
                    >
                      Track Booking
                    </button>
                  ) : confirmedBookingId ? (
                    <button
                      onClick={() => navigate(`/customer/bookings/${confirmedBookingId}`)}
                      className="btn-nilin px-6 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300"
                    >
                      View Booking
                    </button>
                  ) : null}
                  <button
                    onClick={() => navigate('/')}
                    className="card-nilin flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-nilin-blush/30 hover:shadow-nilin-warm"
                  >
                    <Home className="w-4 h-4" />
                    Back to Home
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {!bookingConfirmed && currentStep < 4 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-nilin-border/30">
                {currentStep > 1 ? (
                  <button
                    onClick={handleBack}
                    className="card-nilin flex items-center gap-2 px-6 py-3 font-medium transition-all duration-300 hover:bg-nilin-blush/30 hover:shadow-nilin-warm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < 3 ? (
                  <button
                    onClick={handleNext}
                    className="btn-nilin flex items-center gap-2 px-6 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || guestSubmitting || submitInProgressRef.current}
                    className="btn-nilin flex items-center gap-2 px-8 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={submitInProgressRef.current ? 'Booking is being processed...' : ''}
                  >
                    {(isSubmitting || guestSubmitting || submitInProgressRef.current) ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Confirm Booking
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BookingFormWizard;
