import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  User,
  Mail,
  Phone,
  Tag,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import DateCarousel from './ui/DateCarousel';
import TimeSlotGrid from './ui/TimeSlotGrid';
import LocationTypeSelector from './ui/LocationTypeSelector';
import PaymentMethodSelector from './ui/PaymentMethodSelector';
import { TrustBadge } from './ui/TrustBadge';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types/search';
import { API_BASE_URL } from '../../config/api';
import { api } from '../../services/api';

// ============================================
// Duplicate Submission Prevention
// ============================================
interface PendingRequest {
  timestamp: number;
  requestKey: string;
}

const pendingRequests: Map<string, PendingRequest> = new Map();
const REQUEST_DEDUP_WINDOW_MS = 10000;

const isDuplicateRequest = (requestKey: string): boolean => {
  const now = Date.now();
  const existing = pendingRequests.get(requestKey);
  if (existing && (now - existing.timestamp) < REQUEST_DEDUP_WINDOW_MS) {
    return true;
  }
  pendingRequests.set(requestKey, { timestamp: now, requestKey });
  if (pendingRequests.size > 100) {
    for (const [key, value] of pendingRequests.entries()) {
      if ((now - value.timestamp) > REQUEST_DEDUP_WINDOW_MS) {
        pendingRequests.delete(key);
      }
    }
  }
  return false;
};

const clearPendingRequest = (requestKey: string): void => {
  pendingRequests.delete(requestKey);
};

// Provider interface
interface Provider {
  _id: string;
  firstName: string;
  lastName: string;
  name?: string;
  avatar?: string;
  rating?: number;
  isVerified?: boolean;
  businessInfo?: {
    businessName: string;
    description: string;
  };
}

// AddOn interface
interface AddOn {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration?: number;
}

export interface PackageBookingWizardProps {
  packageData: {
    id: string;
    name: string;
    services: Service[];
    basePrice: number;
    provider: Provider;
  };
  selectedAddOns: AddOn[];
  calculatedPrice: {
    subtotal: number;
    addOnsTotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  onComplete: (bookingId: string) => void;
  onCancel: () => void;
  initialScheduledDate?: string;
  initialScheduledTime?: string;
}

interface FormData {
  // Step 2: Date & Time
  scheduledDate: string;
  scheduledTime: string;

  // Step 3: Location & Contact
  locationType: 'at_home' | 'hotel';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  firstName: string;
  lastName: string;
  guestEmail: string;
  guestPhone: string;

  // Step 4: Payment
  paymentMethod: 'apple_pay' | 'credit_card' | 'cash';
  couponCode: string;
}

const createInitialFormData = (): FormData => ({
  scheduledDate: new Date().toISOString().split('T')[0],
  scheduledTime: '',
  locationType: 'at_home',
  address: {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'AE'
  },
  firstName: '',
  lastName: '',
  guestEmail: '',
  guestPhone: '',
  paymentMethod: 'cash',
  couponCode: ''
});

const formatBookingDisplayDate = (dateInput: string): string => {
  const dateStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateInput;
  const local = new Date(year, month - 1, day);
  return local.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const formatBookingDisplayTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes ?? 0).padStart(2, '0')} ${period}`;
};

const formatAddressLine = (address: FormData['address']): string | undefined => {
  if (!address.street?.trim()) return undefined;
  return [address.street, address.city, address.state, address.zipCode, address.country]
    .filter(Boolean)
    .join(', ');
};

const hoursUntilSlot = (scheduledDate: string, time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  const slotStart = new Date(scheduledDate);
  slotStart.setHours(hours, minutes || 0, 0, 0);
  return (slotStart.getTime() - Date.now()) / (1000 * 60 * 60);
};

const isSlotBookable = (
  scheduledDate: string,
  time: string,
  minAdvanceHours: number
): boolean => hoursUntilSlot(scheduledDate, time) >= minAdvanceHours;

const generateRequestKey = (
  packageId: string,
  scheduledDate: string,
  scheduledTime: string,
  isGuest: boolean,
  guestEmail?: string
): string => {
  return `package:${isGuest ? 'guest' : 'user'}:${packageId}:${scheduledDate}:${scheduledTime}:${guestEmail || 'authenticated'}`;
};

const PackageBookingWizard: React.FC<PackageBookingWizardProps> = ({
  packageData,
  selectedAddOns,
  calculatedPrice,
  onComplete,
  onCancel,
  initialScheduledDate,
  initialScheduledTime,
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, tokens } = useAuthStore();
  const {
    getAvailableSlots,
    availableSlots,
    minBookingAdvanceHours,
    setSubmitting
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [confirmedBookingNumber, setConfirmedBookingNumber] = useState<string | null>(null);
  const [submittingUi, setSubmittingUi] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  const submitInProgressRef = useRef(false);

  // Helper to extract price amount from service (handles both number and object formats)
  const getServicePrice = (service: Service): number => {
    if (typeof service.price === 'number') {
      return service.price;
    }
    return service.price?.amount || 0;
  };

  // Normalize service fields for display (handles backend format: serviceId, serviceName, originalPrice)
  const normalizeService = (service: Service) => {
    // Handle backend format where fields are: serviceId, serviceName, originalPrice
    const normalizedService = service as any;
    return {
      ...service,
      _id: service._id || normalizedService.serviceId || '',
      name: service.name || normalizedService.serviceName || 'Service',
      duration: service.duration || normalizedService.duration || 60,
      price: typeof service.price === 'number'
        ? service.price
        : (service.price as any)?.amount || normalizedService.originalPrice || 0,
    };
  };

  // Normalize all services once
  const normalizedServices = useMemo(() => {
    return packageData.services.map(normalizeService);
  }, [packageData.services]);

  // Calculate total duration from all services
  const totalDuration = useMemo(() => {
    return normalizedServices.reduce((sum, service) => sum + (service.duration || 60), 0);
  }, [normalizedServices]);

  // Calculate total price from all services
  const totalServicesPrice = useMemo(() => {
    return normalizedServices.reduce((sum, service) => sum + (typeof service.price === 'number' ? service.price : 0), 0);
  }, [normalizedServices]);

  const [formData, setFormData] = useState<FormData>(() => ({
    ...createInitialFormData(),
    ...(initialScheduledDate ? { scheduledDate: initialScheduledDate } : {}),
    ...(initialScheduledTime ? { scheduledTime: initialScheduledTime } : {}),
  }));

  const steps = [
    { number: 1, title: 'Package Summary', icon: Package },
    { number: 2, title: 'Date & Time', icon: Calendar },
    { number: 3, title: 'Location & Contact', icon: MapPin },
    { number: 4, title: 'Payment', icon: CreditCard },
    { number: 5, title: 'Confirmation', icon: CheckCircle }
  ];

  // Load available slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (formData.scheduledDate && packageData.provider?._id) {
        setIsFetchingSlots(true);
        try {
          await getAvailableSlots(packageData.provider._id, {
            date: formData.scheduledDate,
            duration: totalDuration,
            days: 1
          });
        } catch (err) {
          console.error('Failed to fetch slots:', err);
          toast.error('Failed to load available time slots. Please try again.');
        } finally {
          setIsFetchingSlots(false);
        }
      }
    };

    if (currentStep >= 2) {
      fetchSlots();
    }
  }, [formData.scheduledDate, packageData.provider?._id, totalDuration, getAvailableSlots, currentStep]);

  // Clear selected time if it falls inside the min advance window
  useEffect(() => {
    if (
      formData.scheduledTime &&
      formData.scheduledDate &&
      !isSlotBookable(formData.scheduledDate, formData.scheduledTime, minBookingAdvanceHours)
    ) {
      setFormData((prev) => ({ ...prev, scheduledTime: '' }));
    }
  }, [formData.scheduledDate, formData.scheduledTime, minBookingAdvanceHours, availableSlots]);

  // Filter time slots based on min advance hours
  const timeSlots = useMemo(() => {
    if (!formData.scheduledDate || !availableSlots?.length) return [];
    return availableSlots.map((slot) => ({
      time: slot.time,
      isAvailable:
        slot.isAvailable &&
        isSlotBookable(formData.scheduledDate, slot.time, minBookingAdvanceHours),
    }));
  }, [availableSlots, formData.scheduledDate, minBookingAdvanceHours]);

  const handleNext = () => {
    // Validation for Step 1: Package Summary (just proceed, no validation needed)
    if (currentStep === 1) {
      // Step 1 is review only, proceed immediately
    }

    // Validation for Step 2: Date & Time
    if (currentStep === 2) {
      if (!formData.scheduledDate) {
        toast.error('Please select a date');
        return;
      }
      if (!formData.scheduledTime) {
        toast.error('Please select a time slot');
        return;
      }
      if (!isSlotBookable(formData.scheduledDate, formData.scheduledTime, minBookingAdvanceHours)) {
        toast.error(`Please choose a time at least ${minBookingAdvanceHours} hours from now`);
        return;
      }
    }

    // Validation for Step 3: Location & Contact
    if (currentStep === 3) {
      if (formData.locationType === 'at_home') {
        if (!formData.address.street?.trim()) {
          toast.error('Please enter your street address for home service');
          return;
        }
        if (!formData.address.city?.trim()) {
          toast.error('Please enter your city for home service');
          return;
        }
      }
      // Validate guest/contact fields
      if (!formData.firstName.trim()) {
        toast.error('Please enter your first name');
        return;
      }
      if (!formData.lastName.trim()) {
        toast.error('Please enter your last name');
        return;
      }
      if (!formData.guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
        toast.error('Please enter a valid email address');
        return;
      }
      if (!formData.guestPhone.trim()) {
        toast.error('Please enter your phone number');
        return;
      }
    }

    if (currentStep < 5) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleApplyCoupon = useCallback(async () => {
    if (!formData.couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      // Validate coupon with backend
      const response = await api.post('/coupons/validate', {
        code: formData.couponCode.trim(),
        orderValue: calculatedPrice.subtotal + calculatedPrice.addOnsTotal,
      });

      const result = response.data;

      if (result.success) {
        const discount = result.data?.discount || 0;
        setAppliedCoupon({
          code: formData.couponCode.trim(),
          discount
        });
        toast.success(`Coupon applied! You save AED ${discount.toLocaleString()}`);
      } else {
        setCouponError(result.message || 'Invalid coupon code');
      }
    } catch {
      setCouponError('Failed to validate coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [formData.couponCode, packageData.id, calculatedPrice, tokens]);

  const handleSubmit = useCallback(async () => {
    const requestKey = generateRequestKey(
      packageData.id,
      formData.scheduledDate,
      formData.scheduledTime,
      !isAuthenticated,
      formData.guestEmail
    );

    if (submitInProgressRef.current) {
      toast.error('Please wait — your booking is still processing.');
      return;
    }

    if (isDuplicateRequest(requestKey)) {
      toast.error('Your booking request is being processed. Please wait.');
      return;
    }

    submitInProgressRef.current = true;
    setSubmittingUi(true);

    const finishSubmit = () => {
      submitInProgressRef.current = false;
      setSubmittingUi(false);
      setSubmitting(false);
    };

    try {
      // Format time to HH:MM
      const timeParts = formData.scheduledTime.split(':');
      const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1]?.padStart(2, '0') || '00'}`;

      // Generate idempotency key
      const timestamp = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
      const idempotencyKey = `${timestamp}-${randomPart}`;

      const bookingPayload = {
        bundleId: packageData.id,
        providerId: packageData.provider?._id,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formattedTime,
        location: {
          type: formData.locationType === 'at_home' ? 'customer_address' : 'hotel',
          address: formData.address.street?.trim() ? {
            street: formData.address.street,
            city: formData.address.city,
            state: formData.address.state,
            zipCode: formData.address.zipCode,
            country: formData.address.country || 'AE'
          } : undefined
        },
        customerInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.guestEmail,
          phone: formData.guestPhone
        },
        paymentMethod: formData.paymentMethod,
        couponCode: appliedCoupon?.code || formData.couponCode || undefined,
        addOns: selectedAddOns.map(a => ({ id: a._id, name: a.name, price: a.price, description: a.description })),
        metadata: {
          idempotencyKey,
          sessionId: crypto.randomUUID(),
          bookingSource: 'package',
          deviceType: 'desktop'
        }
      };

      const response = await api.post(`/packages/${packageData.id}/book-package`, bookingPayload, {
        timeout: 30000,
      });

      const result = response.data;

      if (response.status === 409) {
        toast.error(result.message || 'This time slot is being booked. Please select a different time.');
        clearPendingRequest(requestKey);
        finishSubmit();
        // Refresh slots
        if (packageData.provider?._id) {
          setIsFetchingSlots(true);
          try {
            await getAvailableSlots(packageData.provider._id, {
              date: formData.scheduledDate,
              duration: totalDuration,
              days: 1
            });
          } finally {
            setIsFetchingSlots(false);
          }
        }
        return;
      }

      if (result.success) {
        const bookingData = result.data?.booking || result.data;
        clearPendingRequest(requestKey);
        setConfirmedBookingId(bookingData?._id || null);
        setConfirmedBookingNumber(bookingData?.bookingNumber || null);
        setBookingConfirmed(true);
        setCurrentStep(5);
      } else {
        const errorMsg = result.message || result.errors?.[0]?.message || 'Failed to create booking.';
        toast.error(errorMsg);
        clearPendingRequest(requestKey);
      }
    } catch (err: unknown) {
      clearPendingRequest(requestKey);
      const axiosError = err as { code?: string; message?: string };
      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else {
        console.error('Package booking error:', err);
        toast.error('Failed to create booking. Please try again.');
      }
    } finally {
      finishSubmit();
    }
  }, [
    packageData,
    formData,
    isAuthenticated,
    tokens,
    selectedAddOns,
    appliedCoupon,
    getAvailableSlots,
    totalDuration
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      submitInProgressRef.current = false;
    };
  }, []);

  const handleConfirmComplete = () => {
    if (confirmedBookingId) {
      onComplete(confirmedBookingId);
    }
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Back Button & Header */}
          {!bookingConfirmed && (
            <>
              <button
                onClick={onCancel}
                className="flex items-center gap-2 text-nilin-warmGray hover:text-nilin-coral transition-colors mb-6 group"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-1 font-serif">
                  Book {packageData.name}
                </h1>
                <p className="text-sm text-nilin-warmGray">Complete your package booking in a few simple steps</p>
              </div>
            </>
          )}

          {/* Progress Indicator */}
          {!bookingConfirmed && (
            <div className="mb-10">
              <div className="relative">
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-nilin-muted/50">
                  <div
                    className="h-full bg-nilin-coral transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
                  />
                </div>
                <div className="relative flex justify-between">
                  {steps.map((step) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.number} className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                            step.number < currentStep
                              ? 'bg-nilin-coral text-white shadow-nilin-warm'
                              : step.number === currentStep
                              ? 'bg-nilin-coral text-white ring-4 ring-nilin-coral/20 shadow-nilin-warm'
                              : 'bg-white border-2 border-nilin-muted/50 text-nilin-warmGray'
                          }`}
                        >
                          {step.number < currentStep ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-xs font-medium transition-all duration-300 ${
                            step.number <= currentStep ? 'text-nilin-charcoal' : 'text-nilin-warmGray'
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div className="card-nilin rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-nilin-warm">
            {/* Step 1: Package Summary */}
            {currentStep === 1 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  Review Your Package
                </h2>
                <p className="text-nilin-warmGray mb-6">Confirm the services and pricing for your booking</p>

                {/* Package Header */}
                <div className="card-nilin rounded-xl p-6 mb-6 bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
                      <Package className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-nilin-charcoal">{packageData.name}</h3>
                      <p className="text-sm text-nilin-warmGray">
                        {normalizedServices.length} services · {totalDuration} min total
                      </p>
                    </div>
                  </div>
                  {packageData.provider && (
                    <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                      <User className="w-4 h-4" />
                      <span>
                        {packageData.provider.businessInfo?.businessName ||
                          `${packageData.provider.firstName} ${packageData.provider.lastName}`}
                      </span>
                      {packageData.provider.isVerified && (
                        <span className="text-nilin-coral font-medium">· Verified</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Services List */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 uppercase tracking-wide">
                    Included Services
                  </h4>
                  <div className="space-y-3">
                    {normalizedServices.map((service, index) => (
                      <div
                        key={service._id || index}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-nilin-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-nilin-blush/50 flex items-center justify-center">
                            <span className="text-sm font-bold text-nilin-rose">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-nilin-charcoal">{service.name}</p>
                            <p className="text-xs text-nilin-warmGray">{service.duration} min</p>
                          </div>
                        </div>
                        <p className="font-semibold text-nilin-charcoal">
                          AED {typeof service.price === 'number' ? service.price : 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add-ons */}
                {selectedAddOns.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 uppercase tracking-wide">
                      Selected Add-ons
                    </h4>
                    <div className="space-y-3">
                      {selectedAddOns.map((addOn, index) => (
                        <div
                          key={addOn._id || index}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-nilin-border/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                              <Tag className="w-4 h-4 text-nilin-coral" />
                            </div>
                            <div>
                              <p className="font-medium text-nilin-charcoal">{addOn.name}</p>
                              {addOn.duration && (
                                <p className="text-xs text-nilin-warmGray">+{addOn.duration} min</p>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-nilin-coral">
                            +AED {addOn.price}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Summary */}
                <div className="border-t border-nilin-border/30 pt-6">
                  <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 uppercase tracking-wide">
                    Price Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-nilin-charcoal">
                      <span>Package Base Price</span>
                      <span>AED {calculatedPrice.subtotal.toLocaleString()}</span>
                    </div>
                    {calculatedPrice.addOnsTotal > 0 && (
                      <div className="flex justify-between text-nilin-charcoal">
                        <span>Add-ons</span>
                        <span>+AED {calculatedPrice.addOnsTotal.toLocaleString()}</span>
                      </div>
                    )}
                    {calculatedPrice.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-AED {calculatedPrice.discount.toLocaleString()}</span>
                      </div>
                    )}
                    {calculatedPrice.tax > 0 && (
                      <div className="flex justify-between text-nilin-warmGray">
                        <span>Tax</span>
                        <span>+AED {calculatedPrice.tax.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-nilin-border/20 font-bold text-nilin-charcoal">
                      <span className="text-lg">Total</span>
                      <span className="text-2xl text-nilin-coral">
                        AED {calculatedPrice.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Date & Time */}
            {currentStep === 2 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  Select Date & Time
                </h2>
                <p className="text-nilin-warmGray mb-6">Choose when you want all services to be performed</p>

                {/* Date Carousel */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    <Calendar className="w-4 h-4 inline mr-2" />
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
                    <Clock className="w-4 h-4 inline mr-2" />
                    Select Time
                  </label>
                  <p className="text-xs text-nilin-warmGray mb-3">
                    Times must be at least {minBookingAdvanceHours} hours from now
                  </p>
                  <TimeSlotGrid
                    slots={timeSlots}
                    selectedTime={formData.scheduledTime}
                    onTimeSelect={(time) => setFormData({ ...formData, scheduledTime: time })}
                    isLoading={isFetchingSlots}
                  />
                </div>

                {/* Duration Info */}
                <div className="mt-6 p-4 bg-nilin-blush/30 rounded-xl">
                  <p className="text-sm text-nilin-warmGray">
                    <strong className="text-nilin-charcoal">Total duration:</strong> {totalDuration} minutes
                    <br />
                    <span className="text-xs">
                      All services will be performed during this time slot
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Location & Contact */}
            {currentStep === 3 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  Location & Contact
                </h2>
                <p className="text-nilin-warmGray mb-6">Where should we come and how can we reach you?</p>

                {/* Location Type */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Where would you like the service?
                  </label>
                  <LocationTypeSelector
                    selected={formData.locationType}
                    onChange={(type) => setFormData({ ...formData, locationType: type })}
                  />
                </div>

                {/* Address Section */}
                {formData.locationType === 'at_home' && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300">
                    <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                      <Home className="w-4 h-4 inline mr-2" />
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
                        placeholder="ZIP / Postal Code"
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                  </div>
                )}

                {/* Hotel Address */}
                {formData.locationType === 'hotel' && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300">
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
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div className="card-nilin p-6 rounded-xl transition-all duration-300">
                  <h3 className="text-sm font-semibold text-nilin-charcoal mb-3">
                    <User className="w-4 h-4 inline mr-2" />
                    Contact Information
                  </h3>
                  <p className="text-xs text-nilin-warmGray mb-4">
                    We'll send your booking confirmation to this email
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="First Name"
                        className="w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Last Name"
                        className="w-full pl-4 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                      <input
                        type="email"
                        value={formData.guestEmail}
                        onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                        placeholder="Email Address"
                        className="w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                      <input
                        type="tel"
                        value={formData.guestPhone}
                        onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                        placeholder="Phone Number"
                        className="w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Payment */}
            {currentStep === 4 && !bookingConfirmed && (
              <div>
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  Payment
                </h2>
                <p className="text-nilin-warmGray mb-6">Select your payment method and apply coupons</p>

                {/* Booking Summary */}
                <div className="card-nilin rounded-xl p-6 mb-6 bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20">
                  <h3 className="text-sm font-semibold text-nilin-charcoal mb-4">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-nilin-warmGray">{packageData.name}</span>
                      <span className="font-medium">AED {calculatedPrice.subtotal.toLocaleString()}</span>
                    </div>
                    {selectedAddOns.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-nilin-warmGray">{selectedAddOns.length} add-on(s)</span>
                        <span className="font-medium">+AED {calculatedPrice.addOnsTotal.toLocaleString()}</span>
                      </div>
                    )}
                    {appliedCoupon && (
                      <div className="flex justify-between text-green-600">
                        <span>Coupon ({appliedCoupon.code})</span>
                        <span>-AED {appliedCoupon.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-nilin-border/30">
                      <span className="font-semibold text-nilin-charcoal">Total</span>
                      <span className="text-xl font-bold text-nilin-coral">
                        AED {(calculatedPrice.total - (appliedCoupon?.discount || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coupon Code */}
                <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300">
                  <h3 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-nilin-coral" />
                    Have a coupon code?
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={formData.couponCode}
                      onChange={(e) => {
                        setFormData({ ...formData, couponCode: e.target.value.toUpperCase() });
                        setCouponError(null);
                      }}
                      placeholder="Enter coupon code"
                      disabled={!!appliedCoupon}
                      className="flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral disabled:opacity-50"
                    />
                    {appliedCoupon ? (
                      <button
                        onClick={() => {
                          setAppliedCoupon(null);
                          setFormData({ ...formData, couponCode: '' });
                        }}
                        className="px-4 py-3 rounded-xl bg-red-100 text-red-600 font-medium hover:bg-red-200 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon}
                        className="px-6 py-3 rounded-xl bg-nilin-coral text-white font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isApplyingCoupon ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Applying...
                          </>
                        ) : (
                          'Apply'
                        )}
                      </button>
                    )}
                  </div>
                  {couponError && (
                    <p className="mt-2 text-sm text-red-500">{couponError}</p>
                  )}
                  {appliedCoupon && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800">
                        Coupon applied! You save AED {appliedCoupon.discount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                    <CreditCard className="w-4 h-4 inline mr-2" />
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

            {/* Step 5: Confirmation */}
            {(currentStep === 5 || bookingConfirmed) && (
              <div className="text-center py-8">
                {/* Success Icon */}
                <div className="card-nilin w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-green-100 to-green-50 transition-all duration-300">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>

                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">
                  Package Booking Confirmed!
                </h2>
                <p className="text-nilin-warmGray mb-6">
                  We&apos;ve sent a confirmation to{' '}
                  <span className="font-medium text-nilin-charcoal">{formData.guestEmail}</span>
                </p>

                {confirmedBookingNumber && (
                  <div className="card-nilin p-6 rounded-xl mb-6 inline-block bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300 hover:shadow-nilin-warm">
                    <p className="text-sm text-nilin-warmGray mb-1">Your Booking Number</p>
                    <p className="text-2xl font-bold text-nilin-charcoal tracking-wide">{confirmedBookingNumber}</p>
                    <p className="text-xs text-nilin-warmGray mt-1">Use this to track your booking</p>
                  </div>
                )}

                {/* Confirmation Details */}
                <div className="card-nilin rounded-xl p-6 mb-6 text-left max-w-lg mx-auto space-y-5 transition-all duration-300 hover:shadow-nilin-warm">
                  {/* Package Info */}
                  <div className="flex items-start gap-3 pb-4 border-b border-nilin-border/30">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nilin-rose/20 to-nilin-coral/10 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-nilin-rose" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-nilin-charcoal text-lg">{packageData.name}</h3>
                      <p className="text-sm text-nilin-warmGray mt-0.5">
                        {normalizedServices.length} services · {totalDuration} min total
                      </p>
                    </div>
                  </div>

                  {/* Appointment Info */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-nilin-warmGray mb-3">
                      Appointment
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 text-nilin-charcoal">
                        <Calendar className="w-4 h-4 text-nilin-rose shrink-0" />
                        <span>{formatBookingDisplayDate(formData.scheduledDate)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-nilin-charcoal">
                        <Clock className="w-4 h-4 text-nilin-rose shrink-0" />
                        <span>{formatBookingDisplayTime(formData.scheduledTime)}</span>
                      </div>
                      <div className="flex items-start gap-3 text-nilin-charcoal">
                        <MapPin className="w-4 h-4 text-nilin-rose shrink-0 mt-0.5" />
                        <span>
                          {formData.locationType === 'at_home' ? 'At your home' : 'At hotel'}
                          {formatAddressLine(formData.address) && (
                            <span className="block text-sm text-nilin-warmGray mt-0.5">
                              {formatAddressLine(formData.address)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-nilin-warmGray mb-3">
                      Contact
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 text-nilin-charcoal">
                        <User className="w-4 h-4 text-nilin-rose shrink-0" />
                        <span>{formData.firstName} {formData.lastName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-nilin-charcoal">
                        <Mail className="w-4 h-4 text-nilin-rose shrink-0" />
                        <span className="break-all">{formData.guestEmail}</span>
                      </div>
                      <div className="flex items-center gap-3 text-nilin-charcoal">
                        <Phone className="w-4 h-4 text-nilin-rose shrink-0" />
                        <span>{formData.guestPhone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="border-t border-nilin-border/30 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-nilin-warmGray mb-3">
                      Price Summary
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-nilin-charcoal">
                        <span>Package</span>
                        <span>AED {calculatedPrice.subtotal.toLocaleString()}</span>
                      </div>
                      {calculatedPrice.addOnsTotal > 0 && (
                        <div className="flex justify-between text-nilin-charcoal">
                          <span>Add-ons</span>
                          <span>+AED {calculatedPrice.addOnsTotal.toLocaleString()}</span>
                        </div>
                      )}
                      {appliedCoupon && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount</span>
                          <span>-AED {appliedCoupon.discount.toLocaleString()}</span>
                        </div>
                      )}
                      {calculatedPrice.tax > 0 && (
                        <div className="flex justify-between text-nilin-warmGray">
                          <span>Tax</span>
                          <span>+AED {calculatedPrice.tax.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-nilin-border/20 font-semibold text-nilin-charcoal">
                        <span>Total</span>
                        <span className="text-lg text-nilin-coral">
                          AED {(calculatedPrice.total - (appliedCoupon?.discount || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {confirmedBookingNumber ? (
                    <button
                      onClick={() => navigate(`/track/${confirmedBookingNumber}`)}
                      className="btn-nilin px-6 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300"
                    >
                      Track Booking
                    </button>
                  ) : confirmedBookingId ? (
                    <button
                      onClick={handleConfirmComplete}
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
            {!bookingConfirmed && currentStep < 5 && (
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

                {currentStep < 4 ? (
                  <button
                    onClick={handleNext}
                    className="btn-nilin flex items-center gap-2 px-6 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : currentStep === 4 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={submittingUi}
                    className="btn-nilin flex items-center gap-2 px-8 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={submittingUi ? 'Booking is being processed...' : ''}
                  >
                    {submittingUi ? (
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
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PackageBookingWizard;