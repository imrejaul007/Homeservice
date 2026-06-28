"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { Eye, EyeOff, Mail, Phone, AlertCircle, CheckCircle, MapPin, Loader2, ArrowRight, Shield, Gift } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import CaptchaWidget from './CaptchaWidget';
import { ApiError } from '../../services/AuthService';
import { Sparkles } from '../ui/sparkles';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

const COUNTRY_CODES = [
  { code: '+91', country: 'India' },
  { code: '+971', country: 'UAE' },
  { code: '+1', country: 'USA' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+65', country: 'Singapore' },
  { code: '+966', country: 'Saudi Arabia' },
];

const getCountryCodeByCountry = (country: string): string => {
  const mapping: Record<string, string> = {
    'India': '+91', 'UAE': '+971', 'United Arab Emirates': '+971',
    'USA': '+1', 'United States': '+1', 'UK': '+44', 'United Kingdom': '+44',
    'Australia': '+61', 'Singapore': '+65', 'Saudi Arabia': '+966',
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
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  agreeToTermsAndPrivacy: z.boolean().refine(v => v === true, 'You must agree to Terms of Service and Privacy Policy'),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type CustomerRegistrationForm = z.infer<typeof customerRegistrationSchema>;

// Network error detection helper
const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('Network') ||
           error.message.includes('network') ||
           error.message.includes('fetch') ||
           error.message.includes('ECONNREFUSED') ||
           error.message.includes('ETIMEDOUT') ||
           error.message.includes('timeout');
  }
  return false;
};

const CustomerRegistration: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('+971');
  const [isDetectingLocation, setIsDetectingLocation] = useState(true);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [autoStreet, setAutoStreet] = useState<string>('');
  const [autoZipCode, setAutoZipCode] = useState<string>('');
  const [shake, setShake] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const controls = useAnimation();
  const autofillSynced = useRef(false);

  const userModifiedStreet = React.useRef(false);
  const userModifiedZipCode = React.useRef(false);
  const userModifiedEmail = React.useRef(false);

  const { registerCustomer, isLoading, errors } = useAuthStore();
  const { currentLocation, selectedCity, requestLocationPermission, getCurrentLocation } = useLocationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const registrationState = location.state as { email?: string; returnTo?: string } | null;
  const prefilledEmail = registrationState?.email || '';
  const returnTo = registrationState?.returnTo?.startsWith('/') ? registrationState.returnTo : '/customer/bookings';

  // Read referral code from URL ?ref=CODE query param
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
      setReferralApplied(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const detectLocation = async () => {
      setIsDetectingLocation(true);
      try {
        const granted = await requestLocationPermission();
        if (granted) await getCurrentLocation();
      } catch {
        // Location detection is optional during registration
      } finally {
        setIsDetectingLocation(false);
      }
    };
    detectLocation();
  }, []);

  useEffect(() => {
    const detectCountryCode = async () => {
      if (selectedCity?.country) {
        setSelectedCountryCode(getCountryCodeByCountry(selectedCity.country));
        setDetectedCity(selectedCity.name);
        return;
      }
      if (currentLocation?.address?.country) {
        setSelectedCountryCode(getCountryCodeByCountry(currentLocation.address.country));
        setDetectedCity(currentLocation.address.city || null);
        if (currentLocation.address.address) {
          const fullAddress = currentLocation.address.address;
          const city = currentLocation.address.city || '';
          const addressWithoutCity = fullAddress.replace(new RegExp(`, ${city},?`, 'i'), '').replace(/, [A-Z][a-z]+(\s[A-Z][a-z]+)*,?/g, '').replace(/ - \d{6},?/g, '').replace(/, India$/i, '').trim();
          setAutoStreet(addressWithoutCity || currentLocation.address.address);
        }
        if (currentLocation.address.postalCode) setAutoZipCode(currentLocation.address.postalCode);
      }
    };
    detectCountryCode();
  }, [selectedCity, currentLocation]);

  const { register, handleSubmit, formState: { errors: zodErrors, isSubmitting }, setError, clearErrors, watch, setValue, trigger } = useForm<CustomerRegistrationForm>({
    resolver: zodResolver(customerRegistrationSchema),
    defaultValues: { agreeToTermsAndPrivacy: false, email: prefilledEmail, street: autoStreet, zipCode: autoZipCode },
  });

  useEffect(() => {
    if (!userModifiedStreet.current && autoStreet) setValue('street', autoStreet, { shouldValidate: true });
    if (!userModifiedZipCode.current && autoZipCode) setValue('zipCode', autoZipCode, { shouldValidate: true });
    if (!userModifiedEmail.current && prefilledEmail) setValue('email', prefilledEmail, { shouldValidate: true });
    // Auto-focus on first name field
    setTimeout(() => firstNameRef.current?.focus(), 100);
  }, [autoStreet, autoZipCode, prefilledEmail, setValue]);

  // Handle browser autofill - sync and validate after mount
  useEffect(() => {
    if (autofillSynced.current) return;

    // Multiple attempts to catch autofill
    const attempts = [100, 300, 500, 1000];

    attempts.forEach(delay => {
      setTimeout(() => {
        if (autofillSynced.current) return;
        const emailValue = firstNameRef.current?.value;
        if (emailValue && emailValue.length > 3 && emailValue.includes('@')) {
          autofillSynced.current = true;
          setValue('email', emailValue, { shouldValidate: true });
          trigger('email');
        }
      }, delay);
    });

    return () => {};
  }, [setValue, trigger]);

  // Shake animation on server error
  useEffect(() => {
    if (errors && errors.length > 0) {
      setShake(true);
      controls.start({
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.5 }
      });
      setTimeout(() => setShake(false), 500);
    }
  }, [errors, controls]);

  const watchedPassword = watch('password');
  const watchedEmail = watch('email');

  // Clear server errors when user starts typing in email field
  useEffect(() => {
    if (errors && errors.length > 0 && watchedEmail) {
      // Only clear network errors or generic errors when user types
      const shouldClear = errors.every(e =>
        e.code === 'NETWORK_ERROR' ||
        e.code === 'REGISTER_ERROR' ||
        !e.field
      );
      if (shouldClear) {
        clearErrors();
      }
    }
  }, [watchedEmail, clearErrors, errors]);

  const onSubmit = async (data: CustomerRegistrationForm) => {
    // Prevent double submission
    if (isSubmitting || isLoading) return;

    try {
      clearErrors();
      const hasCoordinates = currentLocation?.coordinates && currentLocation.coordinates.latitude !== undefined;
      const address = {
        street: data.street,
        city: currentLocation?.address?.city || '',
        state: currentLocation?.address?.state || '',
        zipCode: data.zipCode,
        country: currentLocation?.address?.country || 'US',
        ...(hasCoordinates ? { coordinates: { type: 'Point' as const, coordinates: [currentLocation.coordinates.longitude, currentLocation.coordinates.latitude] as [number, number] } } : {})
      };
      const registrationData = {
        firstName: data.firstName, lastName: data.lastName, email: data.email, password: data.password,
        phone: selectedCountryCode + data.phone, agreeToTermsAndPrivacy: data.agreeToTermsAndPrivacy, address, role: 'customer' as const,
        ...(data.gender && { gender: data.gender }),
        ...(referralCode.trim() && { referralCode: referralCode.trim().toUpperCase() }),
        ...(captchaToken ? { captchaToken } : {}),
      };
      await registerCustomer(registrationData);
      setIsSuccess(true);
    } catch (err: unknown) {
      // Check for network errors first
      if (isNetworkError(err)) {
        setError('root', {
          type: 'server',
          message: 'Unable to connect to server. Please check your internet connection and try again.'
        });
        return;
      }
      const error = err instanceof ApiError ? err : ApiError.fromAxios(err);
      if (error.status === 409) {
        setError('email', { type: 'server', message: 'An account with this email already exists.' });
        return;
      }
      if (error.status === 400 && error.data?.errors) {
        error.data.errors.forEach((err: any) => {
          const fieldMap: Record<string, keyof CustomerRegistrationForm> = { 'email': 'email', 'phone': 'phone', 'password': 'password', 'firstName': 'firstName', 'lastName': 'lastName', 'street': 'street', 'zipCode': 'zipCode' };
          if (fieldMap[err.field] in data) setError(fieldMap[err.field], { type: 'server', message: err.message });
          else setError('root', { type: 'server', message: err.message });
        });
        return;
      }
      // Handle other HTTP errors with user-friendly messages
      if (error.status === 429) {
        setError('root', { type: 'server', message: 'Too many attempts. Please wait a moment and try again.' });
        return;
      }
      if (error.status === 403) {
        setError('root', { type: 'server', message: 'Access denied. Please try again later.' });
        return;
      }
      setError('root', { type: 'server', message: error.data?.message || error.message || 'Registration failed' });
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
        <Sparkles className="absolute inset-0" />
        <NavigationHeader showSearch={false} showCategoryTabs={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
              className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-2xl shadow-green-500/30">
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-4xl font-serif text-nilin-charcoal mb-3">Welcome to NILIN!</h2>
            <p className="text-nilin-charcoal/60 mb-8">Your account has been created successfully.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg hover:shadow-xl transition-all">
              Continue to Login <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      <Sparkles className="absolute inset-0" />

      <NavigationHeader showSearch={false} showCategoryTabs={false} />

      {/* Location Bar - Light Theme */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-nilin-border/30"
      >
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
          {isDetectingLocation ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 className="w-4 h-4 text-nilin-coral" />
              </motion.div>
              <span className="text-sm text-nilin-charcoal/60">Detecting your location...</span>
            </>
          ) : detectedCity ? (
            <>
              <MapPin className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Location: {detectedCity}</span>
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal/60">Set your location to get started</span>
            </>
          )}
        </div>
      </motion.div>

      <div className="flex-1 py-8 px-4 relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 backdrop-blur-sm border border-nilin-border/50 shadow-nilin-sm mb-6">
              <Sparkles className="w-5 h-5 text-nilin-coral" />
              <span className="text-nilin-coral text-sm font-medium">CREATE ACCOUNT</span>
            </motion.div>
            <h1 className="text-4xl font-serif font-light text-nilin-charcoal mb-2 tracking-wide">NILIN</h1>
            <p className="text-nilin-charcoal/60 text-base">Create your customer account</p>
          </motion.div>

          {/* Form Card - Wider */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="relative group">
            {/* Hover Glow Effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-nilin-coral/10 via-transparent to-nilin-rose/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Card Background */}
            <div className="relative rounded-3xl bg-white/95 backdrop-blur-sm border border-nilin-border/60 shadow-nilin-lg overflow-hidden">
              {/* Top Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-blush" />

              <motion.form onSubmit={handleSubmit(onSubmit)} animate={controls} className="p-6 sm:p-10 space-y-6">
                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <label htmlFor="firstName" className="block text-base font-medium text-nilin-charcoal mb-3">First Name *</label>
                    <input {...register('firstName')} ref={firstNameRef} id="firstName" placeholder="John"
                      aria-invalid={!!zodErrors.firstName}
                      aria-describedby={zodErrors.firstName ? "firstName-error" : undefined}
                      className="w-full px-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 focus:scale-[1.01] transition-all text-base" />
                    {zodErrors.firstName && <p id="firstName-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.firstName.message}</p>}
                  </motion.div>
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                    <label htmlFor="lastName" className="block text-base font-medium text-nilin-charcoal mb-3">Last Name *</label>
                    <input {...register('lastName')} id="lastName" placeholder="Doe"
                      aria-invalid={!!zodErrors.lastName}
                      aria-describedby={zodErrors.lastName ? "lastName-error" : undefined}
                      className="w-full px-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                    {zodErrors.lastName && <p id="lastName-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.lastName.message}</p>}
                  </motion.div>
                </div>

                {/* Email */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                  <label htmlFor="email" className="block text-base font-medium text-nilin-charcoal mb-3">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-charcoal/60" />
                    <input {...register('email')} id="email" type="email" placeholder="you@example.com"
                      aria-invalid={!!zodErrors.email}
                      aria-describedby={zodErrors.email ? "email-error" : undefined}
                      className="w-full pl-14 pr-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base"
                      onChange={(e) => { register('email').onChange(e); if (e.target.value && e.target.value !== prefilledEmail) userModifiedEmail.current = true; }} />
                  </div>
                  {zodErrors.email && <p id="email-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.email.message}</p>}
                </motion.div>

                {/* Phone */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
                  <label htmlFor="phone" className="block text-base font-medium text-nilin-charcoal mb-3">Phone <span className="text-red-500">*</span></label>
                  <div className="flex gap-4">
                    <select id="countryCode" value={selectedCountryCode} onChange={(e) => setSelectedCountryCode(e.target.value)}
                      className="w-32 px-4 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base">
                      {COUNTRY_CODES.map(({ code, country }) => (
                        <option key={code} value={code}>{code} {country}</option>
                      ))}
                    </select>
                    <div className="relative flex-1">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-charcoal/60" />
                      <input {...register('phone')} id="phone" placeholder="50 123 4567"
                        aria-invalid={!!zodErrors.phone}
                        aria-describedby={zodErrors.phone ? "phone-error" : undefined}
                        className="w-full pl-14 pr-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                    </div>
                  </div>
                  {zodErrors.phone && <p id="phone-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.phone.message}</p>}
                </motion.div>

                {/* Address */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                  <label htmlFor="street" className="block text-base font-medium text-nilin-charcoal mb-3">
                    Street Address <span className="text-red-500">*</span>
                    {autoStreet && <span className="ml-2 text-xs text-green-600 font-normal">(auto-filled)</span>}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-charcoal/60" />
                    <input {...register('street')} id="street" placeholder="123 Main Street"
                      aria-invalid={!!zodErrors.street}
                      aria-describedby={zodErrors.street ? "street-error" : undefined}
                      className="w-full pl-14 pr-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base"
                      onChange={(e) => { register('street').onChange(e); if (e.target.value && e.target.value !== autoStreet) userModifiedStreet.current = true; }} />
                  </div>
                  {zodErrors.street && <p id="street-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.street.message}</p>}
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }}>
                  <label htmlFor="zipCode" className="block text-base font-medium text-nilin-charcoal mb-3">
                    ZIP / Postal Code <span className="text-red-500">*</span>
                    {autoZipCode && <span className="ml-2 text-xs text-green-600 font-normal">(auto-filled)</span>}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-charcoal/60" />
                    <input {...register('zipCode')} id="zipCode" placeholder="12345"
                      aria-invalid={!!zodErrors.zipCode}
                      aria-describedby={zodErrors.zipCode ? "zipCode-error" : undefined}
                      className="w-full pl-14 pr-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base"
                      onChange={(e) => { register('zipCode').onChange(e); if (e.target.value && e.target.value !== autoZipCode) userModifiedZipCode.current = true; }} />
                  </div>
                  {zodErrors.zipCode && <p id="zipCode-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.zipCode.message}</p>}
                </motion.div>

                {/* Password */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                  <label htmlFor="password" className="block text-base font-medium text-nilin-charcoal mb-3">Password *</label>
                  <div className="relative">
                    <input {...register('password')} id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a strong password"
                      aria-invalid={!!zodErrors.password}
                      aria-describedby={zodErrors.password ? "password-error" : "password-hint"}
                      className="w-full px-5 pr-14 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-nilin-charcoal/60 hover:text-nilin-charcoal">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {zodErrors.password && <p id="password-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.password.message}</p>}
                  <PasswordStrengthIndicator password={watchedPassword || ''} />
                </motion.div>

                {/* Confirm Password */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.65 }}>
                  <label htmlFor="confirmPassword" className="block text-base font-medium text-nilin-charcoal mb-3">Confirm Password *</label>
                  <div className="relative">
                    <input {...register('confirmPassword')} id="confirmPassword" type={showConfirm ? 'text' : 'password'} placeholder="Confirm your password"
                      aria-invalid={!!zodErrors.confirmPassword}
                      aria-describedby={zodErrors.confirmPassword ? "confirmPassword-error" : undefined}
                      className="w-full px-5 pr-14 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-nilin-charcoal/60 hover:text-nilin-charcoal">
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {zodErrors.confirmPassword && <p id="confirmPassword-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{zodErrors.confirmPassword.message}</p>}
                </motion.div>

                {/* Referral Code (Optional) */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.67 }}>
                  <label htmlFor="referralCode" className="block text-base font-medium text-nilin-charcoal mb-3">
                    Referral Code <span className="text-nilin-warmGray text-sm font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Gift className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-charcoal/60" />
                    <input
                      id="referralCode"
                      type="text"
                      value={referralCode}
                      onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralApplied(false); }}
                      placeholder="Enter referral code (e.g. RE12345678)"
                      className={`w-full pl-14 pr-5 py-4 rounded-xl bg-white border-2 text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base font-mono tracking-wider ${
                        referralApplied ? 'border-green-400 bg-green-50' : 'border-nilin-border'
                      }`}
                    />
                    {referralApplied && (
                      <CheckCircle className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                  </div>
                  {referralApplied && referralCode && (
                    <p className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1">
                      <Gift className="w-4 h-4" />
                      Referral code applied! You'll earn {250} bonus coins after your first booking.
                    </p>
                  )}
                </motion.div>

                {/* Terms */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="pt-2">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <input {...register('agreeToTermsAndPrivacy')} id="agreeToTermsAndPrivacy" type="checkbox"
                      aria-invalid={!!zodErrors.agreeToTermsAndPrivacy}
                      aria-describedby={zodErrors.agreeToTermsAndPrivacy ? "agreeToTermsAndPrivacy-error" : undefined}
                      className="mt-1 w-5 h-5 rounded border-2 border-nilin-border bg-white text-nilin-coral focus:ring-nilin-coral/30 focus:ring-offset-0 accent-nilin-coral cursor-pointer" />
                    <span className="text-base text-nilin-charcoal/60">
                      I agree to the <Link to="/terms" className="text-nilin-coral hover:underline">Terms</Link> and <Link to="/privacy" className="text-nilin-coral hover:underline">Privacy Policy</Link> *
                    </span>
                  </label>
                  {zodErrors.agreeToTermsAndPrivacy && <p id="agreeToTermsAndPrivacy-error" className="text-sm text-red-500 mt-2" role="alert" aria-live="polite">{zodErrors.agreeToTermsAndPrivacy.message}</p>}
                </motion.div>

                <CaptchaWidget onToken={setCaptchaToken} className="mt-2" />

                {/* Submit */}
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
                  type="submit" disabled={isSubmitting || isLoading}
                  aria-busy={isSubmitting || isLoading}
                  whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.99 }}
                  className="relative w-full py-5 rounded-xl overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nilin-coral/25 hover:shadow-xl hover:shadow-nilin-coral/35">
                  <div className="absolute inset-0 bg-gradient-to-r from-nilin-rose to-nilin-coral" />
                  <div className="absolute inset-0 bg-gradient-to-r from-nilin-coral to-nilin-rose opacity-0 group-hover:opacity-100 transition-opacity" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2 text-white text-lg font-medium">
                    {isSubmitting || isLoading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </motion.button>

                {/* Server Errors */}
                <AnimatePresence>
                  {(errors?.length > 0 || zodErrors.root) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      role="alert"
                      aria-live="polite"
                      className={`p-5 rounded-xl border-2 flex items-start gap-4 ${
                        errors?.some(e => e.code === 'NETWORK_ERROR')
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        errors?.some(e => e.code === 'NETWORK_ERROR') ? 'text-amber-500' : 'text-red-500'
                      }`} />
                      <ul className={`text-base list-disc list-inside ${
                        errors?.some(e => e.code === 'NETWORK_ERROR') ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {zodErrors.root && <li>{zodErrors.root.message}</li>}
                        {errors?.map((e, i) => <li key={i}>{e.message}</li>)}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Trust */}
                <div className="flex items-center justify-center gap-10 pt-4">
                  <div className="flex items-center gap-2 text-nilin-charcoal/60 text-base">
                    <Shield className="w-4 h-4 text-nilin-success" />
                    Secure
                  </div>
                </div>
              </motion.form>
            </div>
          </motion.div>

          <p className="mt-8 text-center text-base text-nilin-charcoal/60">
            Already have an account? <Link to="/login" className="text-nilin-coral hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CustomerRegistration;
