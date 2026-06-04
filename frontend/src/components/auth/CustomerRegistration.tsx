import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { Eye, EyeOff, User, Mail, Phone, AlertCircle, CheckCircle, MapPin, Loader2 } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { ApiError } from '../../services/AuthService';

const COUNTRY_CODES = [
  { code: '+91', country: 'India' },
  { code: '+971', country: 'UAE' },
  { code: '+1', country: 'USA' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+65', country: 'Singapore' },
  { code: '+966', country: 'Saudi Arabia' },
];

// Get country code by country name
const getCountryCodeByCountry = (country: string): string => {
  const mapping: Record<string, string> = {
    'India': '+91',
    'UAE': '+971',
    'United Arab Emirates': '+971',
    'USA': '+1',
    'United States': '+1',
    'UK': '+44',
    'United Kingdom': '+44',
    'Australia': '+61',
    'Singapore': '+65',
    'Saudi Arabia': '+966',
  };
  return mapping[country] || '+971';
};

const customerRegistrationSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50).regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50).regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters'),
  email: z.string().email('Please enter a valid email').toLowerCase(),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[@$!%*?&]/, 'Password must contain a special character'),
  confirmPassword: z.string(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^[\+]?[(]?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number'),
  street: z.string().min(1, 'Street address is required').max(200),
  zipCode: z.string().min(1, 'ZIP code is required').max(20),
  agreeToTermsAndPrivacy: z.boolean().refine(v => v === true, 'You must agree to Terms of Service and Privacy Policy'),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type CustomerRegistrationForm = z.infer<typeof customerRegistrationSchema>;

const CustomerRegistration: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('+971');
  const [isDetectingLocation, setIsDetectingLocation] = useState(true);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [autoStreet, setAutoStreet] = useState<string>('');
  const [autoZipCode, setAutoZipCode] = useState<string>('');

  const { registerCustomer, isLoading, errors } = useAuthStore();
  const { currentLocation, selectedCity, requestLocationPermission, getCurrentLocation } = useLocationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const registrationState = location.state as { email?: string; returnTo?: string } | null;
  const prefilledEmail = registrationState?.email || '';
  const returnTo =
    registrationState?.returnTo?.startsWith('/')
      ? registrationState.returnTo
      : '/customer/bookings';

  // Auto-detect location on page load
  useEffect(() => {
    const detectLocation = async () => {
      setIsDetectingLocation(true);
      try {
        // Request permission and get current location
        const granted = await requestLocationPermission();
        if (granted) {
          await getCurrentLocation();
        }
      } catch (error) {
        console.log('Location detection failed, using defaults');
      } finally {
        setIsDetectingLocation(false);
      }
    };
    detectLocation();
  }, []);

  // Auto-detect country code and address fields from location
  useEffect(() => {
    const detectCountryCode = async () => {
      // If we have a selected city, use its country
      if (selectedCity?.country) {
        const code = getCountryCodeByCountry(selectedCity.country);
        setSelectedCountryCode(code);
        setDetectedCity(selectedCity.name);
        return;
      }
      // If we have current location with address, use its country
      if (currentLocation?.address?.country) {
        const code = getCountryCodeByCountry(currentLocation.address.country);
        setSelectedCountryCode(code);
        setDetectedCity(currentLocation.address.city || null);

        // Auto-fill street from address (e.g., "4th C Cross, Chikka Adugodi")
        if (currentLocation.address.address) {
          // Extract just the street part before the city/postal code
          const fullAddress = currentLocation.address.address;
          const city = currentLocation.address.city || '';
          // Remove city, state, postal code and country from address to get street
          const addressWithoutCity = fullAddress
            .replace(new RegExp(`, ${city},?`, 'i'), '')
            .replace(/, [A-Z][a-z]+(\s[A-Z][a-z]+)*,?/g, '') // Remove state
            .replace(/ - \d{6},?/g, '') // Remove Indian PIN code
            .replace(/, India$/i, '')
            .trim();
          setAutoStreet(addressWithoutCity || currentLocation.address.address);
        }

        // Auto-fill ZIP code from postalCode
        if (currentLocation.address.postalCode) {
          setAutoZipCode(currentLocation.address.postalCode);
        }

        return;
      }
    };
    detectCountryCode();
  }, [selectedCity, currentLocation]);

  const { register, handleSubmit, formState: { errors: formErrors, isSubmitting }, setError, clearErrors, watch, reset } = useForm<CustomerRegistrationForm>({
    resolver: zodResolver(customerRegistrationSchema),
    defaultValues: {
      agreeToTermsAndPrivacy: false,
      email: prefilledEmail,
      street: autoStreet,
      zipCode: autoZipCode,
    },
  });

  // Update form defaults when auto-filled values change
  useEffect(() => {
    reset({
      agreeToTermsAndPrivacy: false,
      email: prefilledEmail,
      street: autoStreet,
      zipCode: autoZipCode,
    });
  }, [autoStreet, autoZipCode, prefilledEmail, reset]);

  const watchedPassword = watch('password');

  const onSubmit = async (data: CustomerRegistrationForm) => {
    try {
      clearErrors();

      // Build address with street, zipCode (required), and location data
      const hasCoordinates = currentLocation?.coordinates &&
        currentLocation.coordinates.latitude !== undefined &&
        currentLocation.coordinates.longitude !== undefined;

      // Build address object with all required fields
      const address = {
        street: data.street,
        city: currentLocation?.address?.city || '',
        state: currentLocation?.address?.state || '',
        zipCode: data.zipCode,
        country: currentLocation?.address?.country || 'AE',
        ...(hasCoordinates ? {
          coordinates: {
            type: 'Point' as const,
            coordinates: [currentLocation.coordinates.longitude, currentLocation.coordinates.latitude] as [number, number]
          }
        } : {})
      };

      // Always send address with all required fields
      const registrationData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        role: 'customer' as const,
        phone: selectedCountryCode + ' ' + data.phone,
        agreeToTermsAndPrivacy: data.agreeToTermsAndPrivacy,
        address,
      };

      console.log('registrationData:', registrationData);
      console.log('====================');

      await registerCustomer(registrationData);
      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      // Convert to ApiError if not already - this preserves status and data
      const error = err instanceof ApiError ? err : ApiError.fromAxios(err);

      // Debug: log the full error response with all details
      console.log('Registration error:', {
        error,
        errorMessage: error.message,
        errorStatus: error.status,
        errorData: error.data,
        errorCode: error.code,
        typeof: typeof error,
        keys: Object.keys(error)
      });

      // Handle 409 Conflict (email already exists)
      if (error.status === 409) {
        setError('email', {
          type: 'server',
          message: 'An account with this email already exists. Try logging in instead.'
        });
        return;
      }

      // Handle 400 Bad Request with field errors
      if (error.status === 400) {
        const errorData = error.data;

        // Check for field-specific errors from Joi validation
        if (errorData?.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          errorData.errors.forEach((err: any) => {
            const fieldMap: Record<string, keyof CustomerRegistrationForm> = {
              'email': 'email',
              'phone': 'phone',
              'password': 'password',
              'firstName': 'firstName',
              'lastName': 'lastName',
              'street': 'street',
              'zipCode': 'zipCode',
              'agreeToTermsAndPrivacy': 'agreeToTermsAndPrivacy',
            };
            const mappedField = fieldMap[err.field] || err.field;
            if (mappedField in data) {
              setError(mappedField as keyof CustomerRegistrationForm, { type: 'server', message: err.message });
            } else {
              // Unknown field - show as root error
              setError('root', { type: 'server', message: err.message });
            }
          });
          return;
        }

        // Show the backend error message if available
        if (errorData?.message) {
          setError('root', { type: 'server', message: errorData.message });
          return;
        }
      }

      // Handle network errors
      if (!error.status) {
        setError('root', {
          type: 'server',
          message: 'Unable to connect to server. Please check your internet connection.'
        });
        return;
      }

      // Fallback for other errors
      const errorMessage = error.data?.message || error.message || 'Something went wrong. Please try again.';
      setError('root', { type: 'server', message: errorMessage });
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-serif text-nilin-charcoal mb-2">Welcome to NILIN!</h2>
            <p className="text-nilin-warmGray mb-6">Your account has been created successfully.</p>
            <button onClick={() => navigate('/login')} className="px-8 py-3 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg">
              Continue to Login
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-nilin-coral/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-nilin-rose/15 blur-3xl" />
      </div>

      <NavigationHeader />

      {/* Auto-detected location indicator */}
      <div className="px-4 py-2 bg-white/50 backdrop-blur-sm border-b border-nilin-border/30">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-2">
          {isDetectingLocation ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-nilin-coral" />
              <span className="text-sm text-nilin-warmGray">Detecting your location...</span>
            </>
          ) : detectedCity ? (
            <>
              <MapPin className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Location: {detectedCity}</span>
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-warmGray">Set your location to get started</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 py-8 px-4 relative z-10">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif font-light text-nilin-charcoal tracking-wide mb-2">NILIN</h1>
            <p className="text-nilin-warmGray">Create your customer account</p>
          </div>

          <div className="glass rounded-3xl p-8 shadow-xl">
            <h2 className="text-xl font-serif text-nilin-charcoal mb-6 text-center">Get Started</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">First Name *</label>
                  <input {...register('firstName')} placeholder="John" className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  {formErrors.firstName && <p className="mt-1 text-xs text-red-500">{formErrors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Last Name *</label>
                  <input {...register('lastName')} placeholder="Doe" className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  {formErrors.lastName && <p className="mt-1 text-xs text-red-500">{formErrors.lastName.message}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                  <input {...register('email')} type="email" placeholder="you@example.com" className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                </div>
                {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email.message}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Phone <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    className="w-28 px-3 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal"
                  >
                    {COUNTRY_CODES.map(({ code, country }) => (
                      <option key={code} value={code}>{code} {country}</option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                    <input
                      {...register('phone')}
                      placeholder="50 123 4567"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all"
                    />
                  </div>
                </div>
                {formErrors.phone && <p className="mt-1 text-xs text-red-500">{formErrors.phone.message}</p>}
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
                  Street Address <span className="text-red-500">*</span>
                  {autoStreet && <span className="ml-2 text-xs text-green-600 font-normal">(auto-filled)</span>}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                  <input
                    {...register('street')}
                    placeholder="123 Main Street"
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all"
                  />
                </div>
                {formErrors.street && <p className="mt-1 text-xs text-red-500">{formErrors.street.message}</p>}
              </div>

              {/* ZIP Code */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">
                  ZIP / Postal Code <span className="text-red-500">*</span>
                  {autoZipCode && <span className="ml-2 text-xs text-green-600 font-normal">(auto-filled)</span>}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                  <input
                    {...register('zipCode')}
                    placeholder={detectedCity === 'Dubai' || detectedCity === 'Abu Dhabi' ? '12345' : '123456'}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all"
                  />
                </div>
                {formErrors.zipCode && <p className="mt-1 text-xs text-red-500">{formErrors.zipCode.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Password *</label>
                <div className="relative">
                  <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Create a strong password" className="w-full px-4 py-3 pr-12 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formErrors.password && <p className="mt-1 text-xs text-red-500">{formErrors.password.message}</p>}
                <PasswordStrengthIndicator password={watchedPassword || ''} />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <input {...register('confirmPassword')} type={showConfirm ? 'text' : 'password'} placeholder="Confirm your password" className="w-full px-4 py-3 pr-12 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal">
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{formErrors.confirmPassword.message}</p>}
              </div>

              {/* Terms */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input {...register('agreeToTermsAndPrivacy')} type="checkbox" className="mt-1 w-4 h-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral/30" />
                  <span className="text-sm text-nilin-warmGray">
                    I agree to the <Link to="/terms" className="text-nilin-coral hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-nilin-coral hover:underline">Privacy Policy</Link> *
                  </span>
                </label>
                {formErrors.agreeToTermsAndPrivacy && <p className="text-xs text-red-500">{formErrors.agreeToTermsAndPrivacy.message}</p>}
              </div>

              {/* Submit */}
              <button type="submit" disabled={isSubmitting || isLoading} className="w-full py-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg shadow-nilin-rose/30 hover:shadow-xl transition-all disabled:opacity-50">
                {isSubmitting || isLoading ? 'Creating Account...' : 'Create Account'}
              </button>

              {/* Server Errors */}
              {(errors?.length > 0 || formErrors.root) && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {formErrors.root && <li>{formErrors.root.message}</li>}
                    {errors?.map((e, i) => <li key={i}>{e.message}</li>)}
                  </ul>
                </div>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-nilin-warmGray">
              Already have an account? <Link to="/login" className="text-nilin-coral hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CustomerRegistration;
