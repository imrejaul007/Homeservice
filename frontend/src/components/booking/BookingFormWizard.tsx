import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';

// Refs for step input elements to enable focus management
const stepRefs: { [key: number]: React.RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null> } = {
  1: React.createRef<HTMLInputElement>(),
  2: React.createRef<HTMLInputElement>(),
  3: React.createRef<HTMLInputElement>(),
};
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  User,
  Mail,
  Phone,
  Briefcase,
  LogIn,
  UserPlus
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
import { api } from '../../services/api';
import { getClaimOffer, type ClaimedOffer } from '../../types/offer';
import AvailabilityPreview from './ui/AvailabilityPreview';
import CouponCodeInput from '../payment/CouponCodeInput';
import offerService from '../../services/offerService';
import SavedAddressSelector from './ui/SavedAddressSelector';
import AddressForm from './ui/AddressForm';
import { customerApi, type Address } from '../../services/customerApi';

// ============================================
// Duplicate Submission Prevention
// ============================================
interface PendingRequest {
  timestamp: number;
  requestKey: string;
}

// In-memory store for deduplication (survives component re-renders)
const pendingRequests: Map<string, PendingRequest> = new Map();
const REQUEST_DEDUP_WINDOW_MS = 10000; // 10 second deduplication window

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

const clearPendingRequest = (requestKey: string): void => {
  pendingRequests.delete(requestKey);
};

const BOOKING_SESSION_STORAGE_KEY = 'booking_checkout_session_id';

const getOrCreateBookingSessionId = (): string => {
  const existing = sessionStorage.getItem(BOOKING_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(BOOKING_SESSION_STORAGE_KEY, id);
  return id;
};

/** Normalize providerId — search APIs may return a populated user object */
const resolveProviderId = (
  service: Service,
  propProviderId?: string
): string => {
  const candidates = [
    propProviderId,
    (service as { providerId?: string | { _id?: string } }).providerId,
    (service as { provider?: { _id?: string } }).provider?._id,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && /^[0-9a-fA-F]{24}$/.test(raw)) return raw;
    if (raw && typeof raw === 'object' && '_id' in raw) {
      const id = String((raw as { _id: unknown })._id);
      if (/^[0-9a-fA-F]{24}$/.test(id)) return id;
    }
  }
  return '';
};

/** API expects HH:MM (24h); slots may include seconds */
const formatScheduledTime = (time: string): string => {
  if (!time) return '';
  const parts = time.split(':');
  const hours = parts[0]?.padStart(2, '0') ?? '00';
  const minutes = (parts[1] ?? '00').padStart(2, '0');
  return `${hours}:${minutes}`;
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

/**
 * Generate a unique request key for deduplication
 */
interface ConfirmedBookingSnapshot {
  bookingNumber: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  locationType: 'at_home' | 'hotel';
  addressLine?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  pricing: {
    basePrice?: number;
    subtotal: number;
    tax: number;
    totalAmount: number;
    currency: string;
    couponDiscount?: number;
    couponCode?: string;
  };
  status?: string;
}

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

const formatCouponUserMessage = (rawMessage?: string): string => {
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('limit') || msg.includes('maximum number of times') || msg.includes('already used') || msg.includes('reached the limit')) {
    return 'This offer has already been used on your account. Remove it to continue at full price, or pick a different offer.';
  }
  if (msg.includes('expired')) {
    return 'This offer has expired. Remove it to continue your booking at the regular price.';
  }
  if (msg.includes('sign in')) {
    return 'Please sign in to use this promo code.';
  }
  if (msg.includes('claim')) {
    return 'This offer must be claimed from My Offers before you can use it here.';
  }
  if (msg.includes('not valid for the selected service')) {
    return 'This offer does not apply to the service you are booking.';
  }
  if (msg.includes('inactive') || msg.includes('not active')) {
    return 'This offer is no longer active. Please choose a different offer.';
  }
  if (msg.includes('not yet valid') || msg.includes('not yet active')) {
    return 'This offer is not yet available. Please check back later.';
  }
  if (msg.includes('minimum order')) {
    return 'The minimum order value for this offer has not been met.';
  }
  return rawMessage || 'This offer cannot be applied to this booking.';
};

const isCouponRelatedError = (message: string): boolean =>
  /promo|coupon|offer|limit|expired|claim/i.test(message);

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
import { usePriceConversion } from '../../utils/priceConverter';

interface BookingFormWizardProps {
  service: Service;
  providerId: string;
  onSuccess?: (bookingId: string, bookingNumber?: string) => void;
  onCancel?: () => void;
  guestMode?: boolean;
  // Pre-loaded offer from claim flow
  preloadedOffer?: {
    code: string;
    offerId?: string;
    offerDetails?: {
      code: string;
      title: string;
      type: 'percentage' | 'fixed' | 'free_service';
      value: number;
      maxDiscount?: number;
    };
  };
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
  couponCode?: string; // Manual promo code entry

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

// Applied coupon state
interface AppliedCoupon {
  code: string;
  discountAmount: number;
  discountType?: 'fixed' | 'percentage';
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
  preloadedOffer
}) => {
  const navigate = useNavigate();
  const { convert, format, currency } = usePriceConversion();
  const { user, isAuthenticated, tokens } = useAuthStore();
  const {
    createBooking,
    getAvailableSlots,
    availableSlots,
    minBookingAdvanceHours,
    isSubmitting,
    isLoading,
    errors,
    setSubmitting,
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [confirmedBookingNumber, setConfirmedBookingNumber] = useState<string | null>(null);
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<ConfirmedBookingSnapshot | null>(null);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [submittingUi, setSubmittingUi] = useState(false);
  const [claimedOffers, setClaimedOffers] = useState<ClaimedOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<ClaimedOffer | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [preloadedOfferApplied, setPreloadedOfferApplied] = useState(false);

  const formatMoney = useCallback(
    (amount: number, sourceCurrency = 'AED') => format(convert(amount, sourceCurrency), currency),
    [convert, format, currency],
  );

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [saveAddressOnBooking, setSaveAddressOnBooking] = useState(false);

  const parseDuration = (durationStr: string | number): number => {
    if (typeof durationStr === 'number') return durationStr;
    const match = String(durationStr).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
  };

  // Normalize subcategory variant(s): single object or array
  const normalizedVariants = useMemo(() => {
    const variantDetails = (service as any).variantDetails;
    if (!variantDetails) return null;
    return Array.isArray(variantDetails) ? variantDetails : [variantDetails];
  }, [service]);

  const selectedVariantMeta = useMemo(() => {
    if (!normalizedVariants?.length) return null;
    const idx = (service as any).selectedVariant ?? 0;
    const v = normalizedVariants[idx] ?? normalizedVariants[0];
    if (!v) return null;
    const price = typeof v.price === 'number' ? v.price : (v.price as { amount?: number })?.amount;
    return {
      variantDuration: parseDuration(v.duration),
      variantPrice: price,
      selectedVariantIndex: idx,
    };
  }, [normalizedVariants, service]);

  // Get duration options from service - prioritize variant details if passed
  const durationOptions = useMemo(() => {
    if (normalizedVariants && normalizedVariants.length > 0) {
      return normalizedVariants.map((v: { duration: string | number; price?: number; name?: string }) => ({
        duration: parseDuration(v.duration),
        price: typeof v.price === 'number' ? v.price : 0,
        label: v.name || `${v.duration} min`,
      }));
    }

    // Otherwise use service's durationOptions if available
    if (service.durationOptions && service.durationOptions.length > 0) {
      return service.durationOptions;
    }

    // Fallback to default
    return [{ duration: service.duration, price: typeof service.price === 'number' ? service.price : service.price?.amount || 0, label: `${service.duration} min` }];
  }, [service, normalizedVariants]);

  const [formData, setFormData] = useState<FormData>(
    createInitialFormData(
      selectedVariantMeta?.variantDuration ??
        parseDuration(durationOptions[0]?.duration || service.duration)
    )
  );

  // Keep duration aligned when user arrives from subcategory variant selection
  useEffect(() => {
    if (!selectedVariantMeta?.variantDuration) return;
    setFormData((prev) =>
      prev.selectedDuration === selectedVariantMeta.variantDuration
        ? prev
        : { ...prev, selectedDuration: selectedVariantMeta.variantDuration }
    );
  }, [selectedVariantMeta?.variantDuration]);

  // Auto-apply preloaded offer from claim flow
  useEffect(() => {
    if (!preloadedOffer || !isAuthenticated || preloadedOfferApplied) return;

    const applyOffer = async () => {
      try {
        const result = await handleApplyCoupon(preloadedOffer.code);
        if (result?.valid) {
          toast.success(`Offer "${preloadedOffer.offerDetails?.title || preloadedOffer.code}" applied!`);
          setPreloadedOfferApplied(true);
        } else {
          toast.error(result?.message || 'This offer cannot be applied to this booking.');
        }
      } catch {
        toast.error('This offer cannot be applied to this booking.');
      }
    };

    // Small delay to let the component render first
    const timer = setTimeout(applyOffer, 500);
    return () => clearTimeout(timer);
  }, [preloadedOffer, isAuthenticated, preloadedOfferApplied]);

  // New step order as per mockups
  const steps = [
    { number: 1, title: 'Date & Time' },
    { number: 2, title: 'Service Details' },
    { number: 3, title: 'Payment' },
    { number: 4, title: 'Confirmation' }
  ];

  const getDisplayServiceName = useCallback(() => {
    const idx = (service as { selectedVariant?: number }).selectedVariant ?? 0;
    const variant = normalizedVariants?.[idx] as { name?: string; label?: string } | undefined;
    if (variant?.name || variant?.label) return variant.name || variant.label;
    const variantDetails = (service as { variantDetails?: { name?: string } }).variantDetails;
    if (variantDetails && !Array.isArray(variantDetails) && variantDetails.name) {
      return variantDetails.name;
    }
    return service.name;
  }, [service, normalizedVariants]);

  const getEffectiveDuration = () =>
    selectedVariantMeta?.variantDuration ?? formData.selectedDuration ?? service.duration;

  // Get current price based on selected duration / variant
  const getCurrentPrice = () => {
    if (selectedVariantMeta?.variantPrice) return selectedVariantMeta.variantPrice;
    const selectedOption = durationOptions.find(opt => opt.duration === getEffectiveDuration());
    return selectedOption?.price || (typeof service.price === 'number' ? service.price : service.price?.amount || 0);
  };

  const buildConfirmedSnapshot = useCallback(
    (
      bookingResponse: Record<string, unknown>,
      form: FormData,
      coupon?: AppliedCoupon | null
    ): ConfirmedBookingSnapshot => {
      const apiPricing = (bookingResponse.pricing || {}) as ConfirmedBookingSnapshot['pricing'] & {
        discounts?: Array<{ code?: string; amount?: number }>;
        couponDiscount?: number;
      };
      const guestInfo = bookingResponse.guestInfo as
        | { name?: string; email?: string; phone?: string }
        | undefined;

      // Always show what the user selected — API may return a stale idempotent booking
      const dateStr = String(form.scheduledDate).split('T')[0];
      const timeStr = formatScheduledTime(form.scheduledTime);

      const basePrice =
        apiPricing.basePrice ??
        selectedVariantMeta?.variantPrice ??
        (typeof service.price === 'number' ? service.price : service.price?.amount) ??
        0;
      const subtotal = apiPricing.subtotal ?? basePrice;
      const tax = apiPricing.tax ?? 0;
      const apiCouponDiscount =
        apiPricing.couponDiscount ??
        apiPricing.discounts?.find((d) => d.amount && d.amount > 0)?.amount ??
        0;
      const apiCouponCode = apiPricing.discounts?.find((d) => d.code)?.code;
      const couponDiscount = apiCouponDiscount > 0 ? apiCouponDiscount : (coupon?.discountAmount ?? 0);
      const couponCode = apiCouponCode || coupon?.code;
      const hasDiscount = couponDiscount > 0;
      const totalAmount =
        apiCouponDiscount > 0
          ? (apiPricing.totalAmount ?? Math.max(0, subtotal + tax - apiCouponDiscount))
          : hasDiscount
            ? Math.max(0, subtotal + tax - couponDiscount)
            : (apiPricing.totalAmount ?? subtotal + tax);

      return {
        bookingNumber: String(bookingResponse.bookingNumber || ''),
        serviceName: getDisplayServiceName(),
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        duration: Number(
          bookingResponse.duration ??
            selectedVariantMeta?.variantDuration ??
            form.selectedDuration
        ),
        locationType: form.locationType,
        addressLine: formatAddressLine(form.address),
        guestName: guestInfo?.name || form.guestName,
        guestEmail: guestInfo?.email || form.guestEmail,
        guestPhone: guestInfo?.phone || form.guestPhone,
        pricing: {
          basePrice,
          subtotal,
          tax,
          totalAmount,
          currency: apiPricing.currency || 'AED',
          couponDiscount: hasDiscount ? couponDiscount : undefined,
          couponCode: hasDiscount ? couponCode : undefined,
        },
        status: bookingResponse.status as string | undefined,
      };
    },
    [getDisplayServiceName, selectedVariantMeta, service.price]
  );

  // Load available slots when date or service duration changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (formData.scheduledDate && providerId) {
        const duration = getEffectiveDuration();

        setIsFetchingSlots(true);
        try {
          await getAvailableSlots(providerId, {
            date: formData.scheduledDate,
            duration,
            days: 1,
            serviceId: String(service._id),
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
  }, [
    formData.scheduledDate,
    formData.selectedDuration,
    selectedVariantMeta?.variantDuration,
    providerId,
    service._id,
    service.duration,
    getAvailableSlots,
  ]);

  // Clear selected time if it is no longer bookable (conflict, advance window, or slots refreshed)
  useEffect(() => {
    if (!formData.scheduledTime || !formData.scheduledDate || isFetchingSlots) return;
    if (!availableSlots?.length) return;

    const inAdvanceWindow = isSlotBookable(
      formData.scheduledDate,
      formData.scheduledTime,
      minBookingAdvanceHours
    );
    const inAvailableList = availableSlots.some(
      (slot) => slot.time === formData.scheduledTime && slot.isAvailable
    );

    if (!inAdvanceWindow || !inAvailableList) {
      setFormData((prev) =>
        prev.scheduledTime === formData.scheduledTime
          ? { ...prev, scheduledTime: '' }
          : prev
      );
    }
  }, [
    formData.scheduledDate,
    formData.scheduledTime,
    minBookingAdvanceHours,
    availableSlots,
    isFetchingSlots,
  ]);

  // Fetch user's claimed offers
  useEffect(() => {
    const fetchClaimedOffers = async () => {
      if (!isAuthenticated || guestMode) return;

      setLoadingOffers(true);
      try {
        const response = await api.get('/offers/my/claims');

        if (response.status === 200 || response.status === 201) {
          const data = response.data;
          if (data.success && data.data) {
            // Filter offers that are applicable to this service or have no restrictions
            const serviceId = String(service._id);
            // Handle both string category IDs and populated category objects
            const categoryId = typeof service.category === 'string'
              ? service.category
              : (service.category as { _id?: string })?._id || null;

            const applicableOffers = data.data.filter((claim: ClaimedOffer) => {
              if (claim.status !== 'claimed') return false;
              if (claim.isExpired || (claim.expiresAt && new Date(claim.expiresAt) < new Date())) {
                return false;
              }
              const offer = getClaimOffer(claim);
              if (!offer) return false;
              // If no service linking, offer applies to all services
              if (!offer.applicableServices?.length && !offer.applicableCategories?.length) {
                return true;
              }
              // Check services - handle both string IDs and populated objects
              const offerServiceIds = offer.applicableServices?.map((s: string | { _id?: string }) =>
                typeof s === 'string' ? s : s._id
              );
              if (offerServiceIds?.some((s: string) => s === serviceId)) {
                return true;
              }
              // Check categories - handle both string IDs and populated objects
              const offerCategoryIds = offer.applicableCategories?.map((c: string | { _id?: string }) =>
                typeof c === 'string' ? c : c._id
              );
              if (categoryId && offerCategoryIds?.some((c: string) => c === categoryId)) {
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

  // Load saved addresses for authenticated users
  useEffect(() => {
    const fetchSavedAddresses = async () => {
      if (!isAuthenticated || guestMode) return;

      try {
        const response = await customerApi.getAddresses();
        setSavedAddresses(response.data.addresses);
        // Auto-select default address
        const defaultAddr = response.data.addresses.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedSavedAddressId(defaultAddr._id);
          // Populate form with default address
          setFormData(prev => ({
            ...prev,
            address: {
              street: defaultAddr.street,
              city: defaultAddr.city,
              state: defaultAddr.state || '',
              zipCode: defaultAddr.zipCode || '',
              country: defaultAddr.country || 'AE'
            }
          }));
        }
      } catch (err) {
        console.error('[BookingFormWizard] Failed to fetch saved addresses:', err);
      }
    };

    fetchSavedAddresses();
  }, [isAuthenticated, guestMode]);

  // Handle saved address selection
  const handleSavedAddressSelect = (address: Address | null) => {
    if (address) {
      setSelectedSavedAddressId(address._id);
      setShowNewAddressForm(false);
      setFormData(prev => ({
        ...prev,
        address: {
          street: address.street,
          city: address.city,
          state: address.state || '',
          zipCode: address.zipCode || '',
          country: address.country || 'AE'
        }
      }));
    } else {
      setSelectedSavedAddressId(null);
      setShowNewAddressForm(true);
    }
  };

  // ============================================
  // Coupon/Offers Handlers
  // ============================================

  const clearAppliedCouponState = () => {
    setSelectedOffer(null);
    setAppliedCoupon(null);
    setCouponError(null);
    setFormData((prev) => ({ ...prev, couponCode: undefined }));
  };

  const handleApplyCoupon = async (code: string) => {
    const orderAmount = getCurrentPrice();
    const serviceId = String(service._id);
    const categoryId = typeof service.category === 'string' ? service.category : null;

    try {
      const result = await offerService.validatePromoCode(code, orderAmount, serviceId, categoryId || undefined);

      if (result.valid && result.discountAmount) {
        setAppliedCoupon({
          code: result.couponCode || code,
          discountAmount: result.discountAmount,
          discountType: result.discountType as 'fixed' | 'percentage' | undefined,
        });
        setCouponError(null);
        setFormData(prev => ({ ...prev, couponCode: result.couponCode || code }));
        return { valid: true, code: result.couponCode || code, discountAmount: result.discountAmount };
      }

      const friendly = formatCouponUserMessage(result.message);
      setCouponError(friendly);
      return { valid: false, code, message: friendly };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply coupon';
      const friendly = formatCouponUserMessage(errorMessage);
      setCouponError(friendly);
      return { valid: false, code, message: friendly };
    }
  };

  const handleRemoveCoupon = async () => {
    clearAppliedCouponState();
  };

  const validateCouponBeforeBooking = async (): Promise<boolean> => {
    const code = getEffectiveCouponCode();
    if (!code) return true;

    const orderAmount = getCurrentPrice();
    const serviceId = String(service._id);
    const categoryId = typeof service.category === 'string' ? service.category : null;
    const result = await offerService.validatePromoCode(code, orderAmount, serviceId, categoryId || undefined);

    if (result.valid && result.discountAmount) {
      setAppliedCoupon({
        code: result.couponCode || code,
        discountAmount: result.discountAmount,
        discountType: result.discountType as 'fixed' | 'percentage' | undefined,
      });
      setCouponError(null);
      setFormData((prev) => ({ ...prev, couponCode: result.couponCode || code }));
      return true;
    }

    const friendly = formatCouponUserMessage(result.message);
    clearAppliedCouponState();
    setCouponError(friendly);
    toast.error(friendly, { duration: 6000 });
    return false;
  };

  // Save address if user checked the option
  const handleSaveAddressAfterBooking = async () => {
    if (!saveAddressOnBooking) return;
    if (selectedSavedAddressId) return; // Already saved, no need to save again

    try {
      // Determine label based on city or default
      const label = formData.address.city ? `${formData.address.city} Address` : 'Home';

      await customerApi.addAddress({
        label,
        street: formData.address.street,
        city: formData.address.city,
        state: formData.address.state,
        zipCode: formData.address.zipCode,
        country: formData.address.country || 'AE',
        isDefault: savedAddresses.length === 0, // First address is default
      });
      console.log('[BookingFormWizard] Address saved successfully');
    } catch (err) {
      console.error('[BookingFormWizard] Failed to save address:', err);
      // Don't show error toast - the booking was successful, address save is optional
    }
  };

  // Get effective coupon code - prefer claimed offer, then manual entry
  const getEffectiveCouponCode = (): string | undefined => {
    if (selectedOffer) {
      const offer = getClaimOffer(selectedOffer);
      if (offer?.code) return offer.code;
    }
    if (appliedCoupon?.code) return appliedCoupon.code;
    if (formData.couponCode) return formData.couponCode;
    return undefined;
  };

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
      if (!isSlotBookable(formData.scheduledDate, formData.scheduledTime, minBookingAdvanceHours)) {
        toast.error(`Please choose a time at least ${minBookingAdvanceHours} hours from now`);
        return;
      }
    }

    // Validation for Step 2: Address validation for at_home location type
    if (currentStep === 2) {
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
      // FIX: Validate guest contact fields when advancing from step 2 in guest mode
      if (guestMode) {
        if (!formData.guestName.trim()) {
          toast.error('Please enter your name');
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
    }

    if (currentStep < 4) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // ACCESSIBILITY FIX: Move focus to first field of new step after render
      setTimeout(() => {
        const firstFieldId = `step-${nextStep}-field`;
        const firstField = document.getElementById(firstFieldId);
        if (firstField) {
          // If it's a custom component, focus the first interactive element inside
          const focusable = firstField.querySelector<HTMLElement>(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable) {
            focusable.focus();
          }
        } else {
          // Fallback: focus first input on page
          const firstInput = document.querySelector<HTMLInputElement>(
            '.form-container input:not([disabled]), .form-container select:not([disabled]), .form-container textarea:not([disabled])'
          );
          if (firstInput) {
            firstInput.focus();
          }
        }
      }, 100);
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
  // FIX: Use ref for guestSubmitting to avoid dependency array issues
  const guestSubmittingRef = useRef(false);

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

    if (isSubmitting || guestSubmitting || submittingUi || submitInProgressRef.current) {
      toast.error('Please wait — your booking is still processing.');
      return;
    }

    if (isDuplicateRequest(requestKey)) {
      toast.error('Your booking request is being processed. Please wait.');
      return;
    }

    // FIX: Also prevent if submission is already in progress (ref-based as backup)
    if (submitInProgressRef.current) {
      toast.error('Please wait — your booking is still processing.');
      return;
    }
    submitInProgressRef.current = true;
    setSubmittingUi(true);

    const finishSubmit = () => {
      setGuestSubmitting(false);
      guestSubmittingRef.current = false;
      submitInProgressRef.current = false;
      setSubmittingUi(false);
      setSubmitting(false);
    };

    const handleBookingConflict = async (message: string) => {
      toast.error(message);
      clearPendingRequest(requestKey);
      finishSubmit();
      if (providerId && formData.scheduledDate) {
        setIsFetchingSlots(true);
        try {
          await getAvailableSlots(providerId, {
            date: formData.scheduledDate,
            duration: formData.selectedDuration || service.duration,
          } as Parameters<typeof getAvailableSlots>[1]);
        } finally {
          setIsFetchingSlots(false);
        }
      }
    };

    // Guest mode validation
    if (guestMode) {
      if (!formData.guestName.trim()) {
        clearPendingRequest(requestKey);
        finishSubmit();
        toast.error('Please enter your name');
        return;
      }
      if (!formData.guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
        clearPendingRequest(requestKey);
        finishSubmit();
        toast.error('Please enter a valid email address');
        return;
      }
      if (!formData.guestPhone.trim()) {
        clearPendingRequest(requestKey);
        finishSubmit();
        toast.error('Please enter your phone number');
        return;
      }
    }

    // Location validation for at_home bookings - require address
    if (formData.locationType === 'at_home') {
      if (!formData.address.street.trim()) {
        clearPendingRequest(requestKey);
        finishSubmit();
        toast.error('Please enter your street address for at-home service');
        return;
      }
      if (!formData.address.city.trim()) {
        clearPendingRequest(requestKey);
        finishSubmit();
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
      guestSubmittingRef.current = true;
      submitInProgressRef.current = true;

      try {
        // FIX: Generate a FRESH idempotency key for each booking attempt
        const timestamp = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
        const guestIdempotencyKey = `${timestamp}-${randomPart}`;

        // Ensure scheduledTime is in HH:MM format (24-hour)
        const timeParts = formData.scheduledTime.split(':');
        const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1]?.padStart(2, '0') || '00'}`;

        // Get providerId from service
        const serviceProviderId = (service as any).providerId
          || (service as any).provider?._id
          || (service as any).provider?.id
          || providerId;

        console.log('[GuestBooking] Service data:', {
          _id: service._id,
          providerId: serviceProviderId
        });

        if (!serviceProviderId) {
          toast.error('Unable to determine provider. Please try again.');
          clearPendingRequest(requestKey);
          finishSubmit();
          return;
        }

        const guestSessionId = getOrCreateBookingSessionId();

        const guestBookingData = {
          serviceId: service._id,
          providerId: serviceProviderId,
          scheduledDate: formatDateString(formData.scheduledDate),
          scheduledTime: formattedTime,
          guestInfo: {
            name: formData.guestName,
            email: formData.guestEmail,
            phone: formData.guestPhone
          },
          location: {
            type: formData.locationType === 'at_home' ? 'customer_address' : formData.locationType === 'hotel' ? 'hotel' : 'provider_location',
            // FIX: Always include address fields to satisfy backend Joi validation
            // Backend requires street and city even for non-at_home locations
            address: {
              street: formData.address.street || '',
              city: formData.address.city || '',
              state: formData.address.state || '',
              zipCode: formData.address.zipCode || '',
              country: formData.address.country || 'AE'
            },
            notes: formData.specialRequests || undefined
          },
          locationType: formData.locationType === 'at_home' ? 'at_home' : 'hotel',
          selectedDuration: selectedVariantMeta?.variantDuration ?? formData.selectedDuration,
          metadata: {
            bookingSource: 'search',
            deviceType: 'desktop',
            sessionId: guestSessionId,
            idempotencyKey: guestIdempotencyKey,
            ...(selectedVariantMeta && {
              variantDuration: selectedVariantMeta.variantDuration,
              variantPrice: selectedVariantMeta.variantPrice,
              selectedVariantIndex: selectedVariantMeta.selectedVariantIndex,
            }),
          }
        };

        console.log('[GuestBooking] Sending request...');

        const response = await api.post('/bookings/guest', guestBookingData, {
          timeout: 30000,
        });

        const result = response.data;

        if (response.status === 409) {
          await handleBookingConflict(
            result.message || 'This time slot is being booked. Please select a different time.'
          );
          return;
        }

        if (result.success) {
          const bookingData = result.data?.booking || result.data;
          clearPendingRequest(requestKey);
          sessionStorage.removeItem(`booking_idempotency_${service._id}`);
          sessionStorage.removeItem(BOOKING_SESSION_STORAGE_KEY);
          setConfirmedSnapshot(buildConfirmedSnapshot(bookingData, formData, appliedCoupon));
          setBookingConfirmed(true);
          setConfirmedBookingId(null);
          setConfirmedBookingNumber(bookingData?.bookingNumber || null);
          setCurrentStep(4);
          // Note: Don't save address for guest users - they don't have an account
        } else {
          const errorMsg = result.message || result.errors?.[0]?.message || 'Failed to create booking.';
          toast.error(errorMsg);
          clearPendingRequest(requestKey);
        }
      } catch (err: any) {
        clearPendingRequest(requestKey);
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          console.error('[GuestBooking] Request timed out');
          toast.error('Request timed out. Please try again.');
        } else {
          console.error('[GuestBooking] Error:', err);
          toast.error('Failed to create booking. Please try again.');
        }
      } finally {
        finishSubmit();
      }
    } else {
      // Authenticated booking - use store
      const resolvedProviderId = resolveProviderId(service, providerId);
      const formattedTime = formatScheduledTime(formData.scheduledTime);
      // Always generate a fresh idempotency key - don't cache it to avoid returning duplicate bookings
      const bookingIdempotencyKey = crypto.randomUUID();

      const locationType =
        formData.locationType === 'at_home'
          ? 'customer_address'
          : formData.locationType === 'hotel'
            ? 'hotel'
            : 'provider_location';

      const bookingData = {
        serviceId: service._id,
        ...(resolvedProviderId ? { providerId: resolvedProviderId } : {}),
        scheduledDate: formatDateString(formData.scheduledDate),
        scheduledTime: formattedTime,
        location: {
          type: locationType,
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
        specialRequests: formData.specialRequests || undefined,
        locationType: formData.locationType,
        selectedDuration: selectedVariantMeta?.variantDuration ?? formData.selectedDuration,
        professionalPreference: formData.professionalPreference,
        experiencePreference: formData.experiencePreference,
        paymentMethod: formData.paymentMethod,
        couponCode: getEffectiveCouponCode(),
        metadata: {
          idempotencyKey: bookingIdempotencyKey,
          sessionId: getOrCreateBookingSessionId(),
          bookingSource: 'search',
          deviceType: 'desktop',
          ...(selectedVariantMeta && {
            variantDuration: selectedVariantMeta.variantDuration,
            variantPrice: selectedVariantMeta.variantPrice,
            selectedVariantIndex: selectedVariantMeta.selectedVariantIndex,
          }),
        }
      } as CreateBookingData;

      console.log('[Booking] Submitting authenticated booking', {
        serviceId: bookingData.serviceId,
        providerId: resolvedProviderId || '(auto-assign)',
        scheduledDate: bookingData.scheduledDate,
        scheduledTime: bookingData.scheduledTime,
        locationType: bookingData.location?.type,
        paymentMethod: bookingData.paymentMethod,
      });

      const couponOk = await validateCouponBeforeBooking();
      if (!couponOk) {
        clearPendingRequest(requestKey);
        finishSubmit();
        return;
      }

      try {
        const booking = await createBooking(bookingData);
        console.log('[Booking] Created successfully', {
          bookingId: booking?._id,
          bookingNumber: booking?.bookingNumber,
          isDuplicate: booking?.isDuplicate,
        });

        if (booking && booking._id) {
          clearPendingRequest(requestKey);
          sessionStorage.removeItem(`booking_idempotency_${service._id}`);
          sessionStorage.removeItem(BOOKING_SESSION_STORAGE_KEY);

          const responseDate = String(booking.scheduledDate || '').split('T')[0];
          const submittedDate = formatDateString(formData.scheduledDate);
          const submittedTime = formatScheduledTime(formData.scheduledTime);
          if (
            booking.isDuplicate &&
            (responseDate !== submittedDate || booking.scheduledTime !== submittedTime)
          ) {
            toast.error(
              'A previous booking was returned instead of your new selection. Please check My Bookings or try again.'
            );
          }

          setConfirmedSnapshot(
            buildConfirmedSnapshot(
              {
                bookingNumber: booking.bookingNumber,
                scheduledDate: booking.scheduledDate,
                scheduledTime: booking.scheduledTime,
                duration: booking.duration,
                pricing: booking.pricing,
                status: booking.status,
              },
              formData,
              appliedCoupon
            )
          );
          setBookingConfirmed(true);
          setConfirmedBookingId(booking._id);
          setConfirmedBookingNumber(booking.bookingNumber || null);
          setCurrentStep(4);
          // Save address if user checked the option
          handleSaveAddressAfterBooking();
        } else {
          clearPendingRequest(requestKey);
          toast.error('Failed to create booking. Please try again.');
        }
      } catch (error) {
        const err = error as { message?: string };
        const errorMessage = err?.message || 'Failed to create booking. Please try again.';
        const isSlotConflict =
          /time slot|slot is|being booked|already booked|temporarily unavailable|try again/i.test(errorMessage);

        clearPendingRequest(requestKey);

        if (isSlotConflict) {
          await handleBookingConflict(errorMessage);
        } else if (isCouponRelatedError(errorMessage)) {
          const friendly = formatCouponUserMessage(errorMessage);
          clearAppliedCouponState();
          setCouponError(friendly);
          toast.error(friendly, { duration: 6000 });
        } else {
          toast.error(errorMessage);
        }
        return;
      } finally {
        finishSubmit();
      }
    }
  }, [service, providerId, formData, guestMode, user, createBooking, selectedOffer, appliedCoupon, durationOptions, selectedVariantMeta, getAvailableSlots, isSubmitting, guestSubmitting, submittingUi, setSubmitting, buildConfirmedSnapshot]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      submitInProgressRef.current = false;
    };
  }, []);

  // Transform availableSlots — hide slots inside min advance window (defense in depth)
  const timeSlots = useMemo(() => {
    if (!formData.scheduledDate || !availableSlots?.length) return [];
    return availableSlots.map((slot) => ({
      time: slot.time,
      isAvailable:
        slot.isAvailable &&
        isSlotBookable(formData.scheduledDate, slot.time, minBookingAdvanceHours),
    }));
  }, [availableSlots, formData.scheduledDate, minBookingAdvanceHours]);

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Back Button & Header */}
          {!bookingConfirmed && (
            <>
              <button
                onClick={onCancel || (() => navigate(-1))}
                className="flex items-center gap-2 text-nilin-warmGray hover:text-nilin-coral transition-colors mb-6 group"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </button>

              {/* Preloaded Offer Banner */}
              {preloadedOffer && preloadedOfferApplied && appliedCoupon && (
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-green-800">
                        {preloadedOffer.offerDetails?.title || 'Special Offer'} Applied
                      </p>
                      <p className="text-sm text-green-600">
                        {appliedCoupon.discountType === 'percentage'
                          ? `${appliedCoupon.discountAmount}% off your booking`
                          : `${formatMoney(appliedCoupon.discountAmount)} off your booking`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-mono rounded-full">
                        {appliedCoupon.code}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-1 font-serif">Book Your Service</h1>
                <p className="text-sm text-nilin-warmGray">Complete your booking in a few simple steps</p>
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
              <div id="step-1-field" className="form-container">
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

                {/* Availability Preview - Quick Overview */}
                {formData.scheduledDate && providerId && (
                  <div className="mt-6">
                    <AvailabilityPreview
                      providerId={providerId}
                      serviceId={String(service._id)}
                      duration={getEffectiveDuration()}
                      selectedDate={formData.scheduledDate}
                      availabilitySlots={timeSlots}
                      isLoadingSlots={isFetchingSlots}
                      onSlotSelect={(time) => setFormData({ ...formData, scheduledTime: time })}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Service Details */}
            {currentStep === 2 && !bookingConfirmed && (
              <div id="step-2-field" className="form-container">
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
                    {/* For authenticated users with saved addresses */}
                    {!guestMode && savedAddresses.length > 0 ? (
                      <>
                        <SavedAddressSelector
                          selectedAddressId={selectedSavedAddressId}
                          onSelect={handleSavedAddressSelect}
                          onManageAddresses={() => navigate('/customer/addresses')}
                        />
                        {/* New address form when "Enter new address" is selected */}
                        {(showNewAddressForm || !selectedSavedAddressId) && (
                          <div className="mt-4 pt-4 border-t border-nilin-border/30">
                            <p className="text-xs text-nilin-warmGray mb-3">Enter new address:</p>
                            <AddressForm
                              address={formData.address}
                              onChange={(newAddress) =>
                                setFormData({ ...formData, address: newAddress })
                              }
                              showCountry={true}
                            />
                            {/* Save address checkbox */}
                            <div className="mt-4 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setSaveAddressOnBooking(!saveAddressOnBooking)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  saveAddressOnBooking
                                    ? 'bg-nilin-coral border-nilin-coral'
                                    : 'border-nilin-border hover:border-nilin-coral'
                                }`}
                              >
                                {saveAddressOnBooking && <Check className="w-3 h-3 text-white" />}
                              </button>
                              <span className="text-sm text-nilin-charcoal">
                                Save this address for future bookings
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* For guest users or users with no saved addresses */
                      <>
                        <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
                          Service Address
                        </label>
                        <AddressForm
                          address={formData.address}
                          onChange={(newAddress) =>
                            setFormData({ ...formData, address: newAddress })
                          }
                          showCountry={true}
                        />
                      </>
                    )}
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
              <div id="step-3-field" className="form-container">
                <h2 className="text-2xl font-bold text-nilin-charcoal mb-2 font-serif">Payment Authorization</h2>
                <p className="text-nilin-warmGray mb-6">Select your preferred payment method</p>

                {couponError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl" role="alert">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Offer could not be applied</p>
                        <p className="text-sm text-red-700 mt-1">{couponError}</p>
                        <button
                          type="button"
                          onClick={() => clearAppliedCouponState()}
                          className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900"
                        >
                          Remove offer and continue at full price
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                            onChange={async (e) => {
                              if (e.target.value) {
                                const claim = JSON.parse(e.target.value);
                                setSelectedOffer(claim);
                                setCouponError(null);

                                const orderAmount = getCurrentPrice();
                                const offer = getClaimOffer(claim);
                                if (offer) {
                                  const result = await offerService.validatePromoCode(
                                    offer.code,
                                    orderAmount,
                                    String(service._id),
                                    typeof service.category === 'string' ? service.category : null
                                  );

                                  if (result.valid && result.discountAmount) {
                                    setAppliedCoupon({
                                      code: result.couponCode || offer.code,
                                      discountAmount: result.discountAmount,
                                      discountType: result.discountType as 'fixed' | 'percentage' | undefined,
                                    });
                                    setFormData(prev => ({ ...prev, couponCode: result.couponCode || offer.code }));
                                    setCouponError(null);
                                  } else {
                                    clearAppliedCouponState();
                                    const friendly = formatCouponUserMessage(result.message);
                                    setCouponError(friendly);
                                    toast.error(friendly, { duration: 6000 });
                                  }
                                }
                              } else {
                                clearAppliedCouponState();
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
                                  ? `${formatMoney(offer.value)} OFF`
                                  : 'Free Service';
                              const expiresAt = new Date(claim.expiresAt);
                              const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              const expiresText = daysLeft > 0 ? `${daysLeft} days left` : 'Expiring soon';
                              return (
                                <option key={offer._id || index} value={JSON.stringify(claim)}>
                                  {offer.code} - {discountText} ({expiresText})
                                </option>
                              );
                            })}
                          </select>
                        )}

                        {/* Applied offer display - shown when dropdown selection is active */}
                        {selectedOffer && appliedCoupon && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-green-800">
                                  {appliedCoupon.discountType === 'percentage'
                                    ? `${appliedCoupon.discountAmount}% OFF`
                                    : `${formatMoney(appliedCoupon.discountAmount)} OFF`} Applied!
                                </p>
                                <p className="text-xs text-green-600">
                                  Code: {appliedCoupon.code}
                                </p>
                                {selectedOffer.expiresAt && (
                                  <p className="text-xs text-green-500 mt-1">
                                    Expires: {new Date(selectedOffer.expiresAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => clearAppliedCouponState()}
                                className="text-xs text-green-700 hover:text-green-900 underline"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Coupon Code Input Section (for manually entered promo codes) */}
                {/* Only show if no claimed offer is selected (claimed offers use the dropdown above) */}
                {!guestMode && !selectedOffer && (
                  <div className="mb-6 card-nilin p-6 rounded-xl transition-all duration-300">
                    <CouponCodeInput
                      onApply={handleApplyCoupon}
                      onRemove={handleRemoveCoupon}
                      appliedCoupon={appliedCoupon}
                      currency="AED"
                    />
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
                    discountAmount={appliedCoupon?.discountAmount}
                    discountCode={appliedCoupon?.code}
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
                <p className="text-nilin-warmGray mb-6">
                  {confirmedSnapshot?.guestEmail
                    ? (
                      <>
                        We&apos;ve sent a confirmation to{' '}
                        <span className="font-medium text-nilin-charcoal">{confirmedSnapshot.guestEmail}</span>
                      </>
                    )
                    : "We've sent a confirmation to your email and phone."}
                </p>

                {confirmedBookingNumber && (
                  <div className="card-nilin p-6 rounded-xl mb-6 inline-block bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300 hover:shadow-nilin-warm">
                    <p className="text-sm text-nilin-warmGray mb-1">Your Booking Number</p>
                    <p className="text-2xl font-bold text-nilin-charcoal tracking-wide">{confirmedBookingNumber}</p>
                    <p className="text-xs text-nilin-warmGray mt-1">Use this to track your booking</p>
                  </div>
                )}

                {confirmedSnapshot && (
                  <div className="card-nilin rounded-xl p-6 mb-6 text-left max-w-lg mx-auto space-y-5 transition-all duration-300 hover:shadow-nilin-warm">
                    <div className="flex items-start gap-3 pb-4 border-b border-nilin-border/30">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nilin-blush/40 to-nilin-peach/30 flex items-center justify-center shrink-0">
                        <Briefcase className="w-5 h-5 text-nilin-rose" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-nilin-charcoal text-lg">{confirmedSnapshot.serviceName}</h3>
                        <p className="text-sm text-nilin-warmGray mt-0.5">
                          {confirmedSnapshot.duration} min ·{' '}
                          {confirmedSnapshot.status === 'confirmed' ? 'Confirmed' : 'Pending provider approval'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-nilin-warmGray mb-3">
                        Appointment
                      </h4>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-nilin-charcoal">
                          <Calendar className="w-4 h-4 text-nilin-rose shrink-0" />
                          <span>{formatBookingDisplayDate(confirmedSnapshot.scheduledDate)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-nilin-charcoal">
                          <Clock className="w-4 h-4 text-nilin-rose shrink-0" />
                          <span>{formatBookingDisplayTime(confirmedSnapshot.scheduledTime)}</span>
                        </div>
                        <div className="flex items-start gap-3 text-nilin-charcoal">
                          <MapPin className="w-4 h-4 text-nilin-rose shrink-0 mt-0.5" />
                          <span>
                            {confirmedSnapshot.locationType === 'at_home' ? 'At your home' : 'At hotel'}
                            {confirmedSnapshot.addressLine && (
                              <span className="block text-sm text-nilin-warmGray mt-0.5">
                                {confirmedSnapshot.addressLine}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {guestMode && (confirmedSnapshot.guestName || confirmedSnapshot.guestPhone) && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-nilin-warmGray mb-3">
                          Guest contact
                        </h4>
                        <div className="space-y-2.5">
                          {confirmedSnapshot.guestName && (
                            <div className="flex items-center gap-3 text-nilin-charcoal">
                              <User className="w-4 h-4 text-nilin-rose shrink-0" />
                              <span>{confirmedSnapshot.guestName}</span>
                            </div>
                          )}
                          {confirmedSnapshot.guestEmail && (
                            <div className="flex items-center gap-3 text-nilin-charcoal">
                              <Mail className="w-4 h-4 text-nilin-rose shrink-0" />
                              <span className="break-all">{confirmedSnapshot.guestEmail}</span>
                            </div>
                          )}
                          {confirmedSnapshot.guestPhone && (
                            <div className="flex items-center gap-3 text-nilin-charcoal">
                              <Phone className="w-4 h-4 text-nilin-rose shrink-0" />
                              <span>{confirmedSnapshot.guestPhone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-nilin-border/30 pt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-nilin-warmGray mb-3">
                        Price summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-nilin-charcoal">
                          <span>Service</span>
                          <span>
                            {confirmedSnapshot.pricing.currency}{' '}
                            {(confirmedSnapshot.pricing.basePrice ?? confirmedSnapshot.pricing.subtotal).toLocaleString('en-AE')}
                          </span>
                        </div>
                        {(confirmedSnapshot.pricing.couponDiscount ?? 0) > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>
                              Coupon
                              {confirmedSnapshot.pricing.couponCode && (
                                <span className="text-xs ml-1">({confirmedSnapshot.pricing.couponCode})</span>
                              )}
                            </span>
                            <span>
                              -{confirmedSnapshot.pricing.currency}{' '}
                              {confirmedSnapshot.pricing.couponDiscount!.toLocaleString('en-AE')}
                            </span>
                          </div>
                        )}
                        {confirmedSnapshot.pricing.tax > 0 && (
                          <div className="flex justify-between text-nilin-warmGray">
                            <span>Tax</span>
                            <span>
                              {confirmedSnapshot.pricing.currency}{' '}
                              {confirmedSnapshot.pricing.tax.toLocaleString('en-AE')}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-nilin-border/20 font-semibold text-nilin-charcoal">
                          <span>Total</span>
                          <span className="text-lg text-nilin-coral">
                            {confirmedSnapshot.pricing.currency}{' '}
                            {confirmedSnapshot.pricing.totalAmount.toLocaleString('en-AE')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {guestMode && confirmedSnapshot?.guestEmail && (
                  <div className="card-nilin rounded-xl p-5 mb-6 max-w-lg mx-auto text-left border border-nilin-coral/20 bg-gradient-to-br from-nilin-blush/20 to-white">
                    <h4 className="font-semibold text-nilin-charcoal mb-1">Save this booking to your account</h4>
                    <p className="text-sm text-nilin-warmGray mb-4">
                      Sign in or create an account with{' '}
                      <span className="font-medium text-nilin-charcoal break-all">
                        {confirmedSnapshot.guestEmail}
                      </span>{' '}
                      and this booking will appear in My Bookings.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/login', {
                            state: {
                              email: confirmedSnapshot.guestEmail,
                              returnTo: '/customer/bookings',
                              message:
                                'Sign in with the same email you used for this booking to see it in My Bookings.',
                            },
                          })
                        }
                        className="btn-nilin flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </button>
                      <Link
                        to="/register/customer"
                        state={{
                          email: confirmedSnapshot.guestEmail,
                          returnTo: '/customer/bookings',
                        }}
                        className="card-nilin flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold hover:bg-nilin-blush/30 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Create Account
                      </Link>
                    </div>
                  </div>
                )}

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
                    disabled={isSubmitting || guestSubmitting || submittingUi}
                    className="btn-nilin flex items-center gap-2 px-8 py-3 rounded-full font-semibold hover:shadow-nilin-warm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={submittingUi ? 'Booking is being processed...' : ''}
                  >
                    {(isSubmitting || guestSubmitting || submittingUi) ? (
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
