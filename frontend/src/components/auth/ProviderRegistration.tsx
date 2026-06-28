"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCategories } from '../../hooks/useCategories';
import { Eye, EyeOff, Mail, Phone, Building, MapPin, AlertCircle, CheckCircle, ChevronRight, ArrowRight, Shield } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import CaptchaWidget from './CaptchaWidget';
import { Sparkles } from '../ui/sparkles';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiError } from '../../services/AuthService';
import type { RegisterProviderData } from '../../stores/authStore';

const SUPPORTED_CITIES = [
  { value: 'dubai', label: 'Dubai', coords: [55.2708, 25.2048] },
  { value: 'abu-dhabi', label: 'Abu Dhabi', coords: [54.3773, 24.4539] },
  { value: 'sharjah', label: 'Sharjah', coords: [55.4209, 25.3463] },
  { value: 'ajman', label: 'Ajman', coords: [55.4209, 25.3488] },
  { value: 'riyadh', label: 'Riyadh', coords: [46.6753, 24.7136] },
  { value: 'jeddah', label: 'Jeddah', coords: [46.6753, 24.7136] },
  { value: 'mumbai', label: 'Mumbai', coords: [72.8777, 19.0760] },
];

const providerRegistrationSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50).regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50).regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters'),
  email: z.string().email('Please enter a valid email').toLowerCase(),
  password: z.string().min(12, 'Password must be at least 12 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Must have uppercase, lowercase, number & special character'),
  confirmPassword: z.string(),
  phone: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  businessName: z.string().min(2, 'Business name required').max(100),
  businessDescription: z.string().min(50, 'Business description must be at least 50 characters').max(1000),
  city: z.string().min(1, 'City is required'),
  categories: z.array(z.string()).min(1, 'Select at least one category'),
  agreeToTermsAndPrivacy: z.boolean().refine(v => v === true, 'You must agree to Terms of Service and Privacy Policy'),
  agreeToBackground: z.boolean().refine(v => v === true, 'You must agree to the background check'),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type ProviderRegistrationForm = z.infer<typeof providerRegistrationSchema>;

function buildProviderPayload(
  data: ProviderRegistrationForm,
  selectedCategoryIds: string[],
  categoryList: Array<{ _id: string; name: string }>
): RegisterProviderData {
  const cityConfig = SUPPORTED_CITIES.find((c) => c.value === data.city);
  const selectedCats = categoryList.filter((c) => selectedCategoryIds.includes(c._id));

  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    password: data.password,
    phone: data.phone || undefined,
    dateOfBirth: data.dateOfBirth,
    role: 'provider',
    agreeToTermsAndPrivacy: data.agreeToTermsAndPrivacy,
    agreeToBackground: data.agreeToBackground,
    businessInfo: {
      businessName: data.businessName,
      businessType: 'individual',
      description: data.businessDescription,
    },
    locationInfo: {
      primaryAddress: {
        street: data.businessName,
        city: cityConfig?.label || data.city,
        state: cityConfig?.label || data.city,
        zipCode: '00000',
        country: 'AE',
        ...(cityConfig
          ? { coordinates: { type: 'Point', coordinates: cityConfig.coords as [number, number] } }
          : {}),
      },
      mobileService: true,
      hasFixedLocation: false,
    },
    services: selectedCats.map((cat) => ({
      name: cat.name,
      category: cat.name,
      description: `${cat.name} services offered by ${data.businessName}`,
      duration: 60,
      price: { amount: 0, currency: 'AED', type: 'fixed' as const },
    })),
  };
}

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

const ProviderRegistration: React.FC = () => {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { registerProvider, isLoading, errors } = useAuthStore();
  const { categories } = useCategories();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors: formErrors, isSubmitting }, setError, clearErrors, watch } = useForm<ProviderRegistrationForm>({
    resolver: zodResolver(providerRegistrationSchema),
    defaultValues: {
      categories: [],
      agreeToTermsAndPrivacy: false,
      agreeToBackground: false,
      city: '',
    },
  });

  const watchedPassword = watch('password');
  const watchedEmail = watch('email');

  // Clear server errors when user starts typing in email field
  useEffect(() => {
    if (errors && errors.length > 0 && watchedEmail) {
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

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const validateStep1 = async () => {
    const fields: (keyof ProviderRegistrationForm)[] = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'businessName', 'businessDescription', 'dateOfBirth', 'city'];
    let isValid = true;
    for (const field of fields) {
      const value = watch(field) as string | undefined;
      if (!value || value.trim() === '') {
        setError(field, { type: 'required', message: `${field} is required` });
        isValid = false;
      }
    }
    if (selectedCategories.length === 0) {
      setError('categories', { type: 'min', message: 'Select at least one category' });
      isValid = false;
    }
    return isValid;
  };

  const onSubmit = async (data: ProviderRegistrationForm) => {
    // Prevent double submission
    if (isSubmitting || isLoading) return;

    try {
      clearErrors();
      await registerProvider({
        ...buildProviderPayload(data, selectedCategories, categories),
        ...(captchaToken ? { captchaToken } : {}),
      });
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
      // Use ApiError for consistent error handling
      const error = err instanceof ApiError ? err : ApiError.fromAxios(err);
      if (error.data?.errors) {
        error.data.errors.forEach((e: { field?: string; message?: string }) => {
          if (e.field) setError(e.field as keyof ProviderRegistrationForm, { type: 'server', message: e.message || 'Error' });
          else setError('root', { type: 'server', message: e.message || 'Registration failed' });
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
            <p className="text-nilin-warmGray mb-4">Your provider account has been created.</p>
            <p className="text-nilin-warmGray mb-8 text-base">Our team will review your application and get back to you within 24-48 hours.</p>
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

      <div className="flex-1 py-8 px-4 relative z-10 min-h-0">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 backdrop-blur-sm border border-nilin-border/50 shadow-nilin-sm mb-6">
              <Sparkles className="w-5 h-5 text-nilin-coral" />
              <span className="text-nilin-coral text-sm font-medium">BECOME A PRO</span>
            </motion.div>
            <h1 className="text-4xl font-serif font-light text-nilin-charcoal mb-2 tracking-wide">NILIN</h1>
            <p className="text-nilin-warmGray text-base">Join our network of beauty professionals</p>
          </motion.div>

          {/* Progress Indicator */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-nilin-coral' : 'text-nilin-warmGray'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-nilin-coral text-white' : 'bg-nilin-border text-nilin-warmGray'}`}>
                {step > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">Account</span>
            </div>
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-nilin-coral' : 'bg-nilin-border'}`} />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-nilin-coral' : 'text-nilin-warmGray'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-nilin-coral text-white' : 'bg-nilin-border text-nilin-warmGray'}`}>
                2
              </div>
              <span className="text-sm font-medium">Review</span>
            </div>
          </motion.div>

          {/* Form Card - Wider */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="relative group">
            {/* Hover Glow Effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-nilin-coral/10 via-transparent to-nilin-rose/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Card Background */}
            <div className="relative rounded-3xl bg-white/95 backdrop-blur-sm border border-nilin-border/60 shadow-nilin-lg overflow-hidden">
              {/* Top Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-blush" />

              <form onSubmit={handleSubmit(onSubmit)} className="p-10">
                {step === 1 && (
                  <div className="space-y-6">
                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-6">
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                        <label htmlFor="firstName" className="block text-base font-medium text-nilin-charcoal mb-3">First Name *</label>
                        <input {...register('firstName')} id="firstName" placeholder="John"
                          aria-invalid={!!formErrors.firstName}
                          aria-describedby={formErrors.firstName ? "firstName-error" : undefined}
                          className="w-full px-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                        {formErrors.firstName && <p id="firstName-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.firstName.message}</p>}
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                        <label htmlFor="lastName" className="block text-base font-medium text-nilin-charcoal mb-3">Last Name *</label>
                        <input {...register('lastName')} id="lastName" placeholder="Doe"
                          aria-invalid={!!formErrors.lastName}
                          aria-describedby={formErrors.lastName ? "lastName-error" : undefined}
                          className="w-full px-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                        {formErrors.lastName && <p id="lastName-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.lastName.message}</p>}
                      </motion.div>
                    </div>

                    {/* Email */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                      <label htmlFor="email" className="block text-base font-medium text-nilin-charcoal mb-3">Email Address *</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                        <input {...register('email')} id="email" type="email" placeholder="you@example.com"
                          aria-invalid={!!formErrors.email}
                          aria-describedby={formErrors.email ? "email-error" : undefined}
                          className="w-full pl-14 pr-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                      </div>
                      {formErrors.email && <p id="email-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.email.message}</p>}
                    </motion.div>

                    {/* Phone */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                      <label htmlFor="phone" className="block text-base font-medium text-nilin-charcoal mb-3">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                        <input {...register('phone')} id="phone" type="tel" autoComplete="tel" placeholder="+971 50 123 4567"
                          aria-invalid={!!formErrors.phone}
                          aria-describedby={formErrors.phone ? "phone-error" : undefined}
                          className="w-full pl-14 pr-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                      </div>
                      {formErrors.phone && <p id="phone-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.phone.message}</p>}
                    </motion.div>

                    {/* Date of Birth */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 }}>
                      <label htmlFor="dateOfBirth" className="block text-base font-medium text-nilin-charcoal mb-3">Date of Birth *</label>
                      <input {...register('dateOfBirth')} id="dateOfBirth" type="date"
                        aria-invalid={!!formErrors.dateOfBirth}
                        aria-describedby={formErrors.dateOfBirth ? 'dateOfBirth-error' : undefined}
                        className="w-full px-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                      {formErrors.dateOfBirth && <p id="dateOfBirth-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.dateOfBirth.message}</p>}
                    </motion.div>

                    {/* Business Description */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.29 }}>
                      <label htmlFor="businessDescription" className="block text-base font-medium text-nilin-charcoal mb-3">Business Description *</label>
                      <textarea {...register('businessDescription')} id="businessDescription" rows={4}
                        placeholder="Describe your business, experience, and the services you offer (min. 50 characters)"
                        aria-invalid={!!formErrors.businessDescription}
                        aria-describedby={formErrors.businessDescription ? 'businessDescription-error' : undefined}
                        className="w-full px-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base resize-y" />
                      {formErrors.businessDescription && <p id="businessDescription-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.businessDescription.message}</p>}
                    </motion.div>

                    {/* Business Name */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                      <label htmlFor="businessName" className="block text-base font-medium text-nilin-charcoal mb-3">Business Name *</label>
                      <div className="relative">
                        <Building className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                        <input {...register('businessName')} id="businessName" placeholder="Your business name"
                          aria-invalid={!!formErrors.businessName}
                          aria-describedby={formErrors.businessName ? "businessName-error" : undefined}
                          className="w-full pl-14 pr-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                      </div>
                      {formErrors.businessName && <p id="businessName-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.businessName.message}</p>}
                    </motion.div>

                    {/* City */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                      <label htmlFor="city" className="block text-base font-medium text-nilin-charcoal mb-3">City *</label>
                      <div className="relative">
                        <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                        <select {...register('city')} id="city"
                          aria-invalid={!!formErrors.city}
                          aria-describedby={formErrors.city ? "city-error" : undefined}
                          className="w-full pl-14 pr-5 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base appearance-none">
                          <option value="">Select your city</option>
                          {SUPPORTED_CITIES.map(city => (
                            <option key={city.value} value={city.value}>{city.label}</option>
                          ))}
                        </select>
                      </div>
                      {formErrors.city && <p id="city-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.city.message}</p>}
                    </motion.div>

                    {/* Continue Button */}
                    <motion.button
                      type="button"
                      onClick={async () => {
                        setIsValidating(true);
                        if (await validateStep1()) setStep(2);
                        setIsValidating(false);
                      }}
                      disabled={isValidating}
                      aria-busy={isValidating}
                      className="w-full py-5 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg shadow-nilin-coral/25 hover:shadow-xl hover:shadow-nilin-coral/35 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:active:scale-100"
                    >
                      {isValidating ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                          Validating...
                        </>
                      ) : (
                        <>Continue <ChevronRight className="w-5 h-5" /></>
                      )}
                    </motion.button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    {/* Password */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                      <label htmlFor="password" className="block text-base font-medium text-nilin-charcoal mb-3">Password *</label>
                      <div className="relative">
                        <input {...register('password')} id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a strong password"
                          aria-invalid={!!formErrors.password}
                          aria-describedby={formErrors.password ? "password-error" : "password-hint"}
                          className="w-full px-5 pr-14 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal">
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {formErrors.password && <p id="password-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.password.message}</p>}
                      <PasswordStrengthIndicator password={watchedPassword || ''} />
                    </motion.div>

                    {/* Confirm Password */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                      <label htmlFor="confirmPassword" className="block text-base font-medium text-nilin-charcoal mb-3">Confirm Password *</label>
                      <div className="relative">
                        <input {...register('confirmPassword')} id="confirmPassword" type={showConfirm ? 'text' : 'password'} placeholder="Confirm your password"
                          aria-invalid={!!formErrors.confirmPassword}
                          aria-describedby={formErrors.confirmPassword ? "confirmPassword-error" : undefined}
                          className="w-full px-5 pr-14 py-4 rounded-xl bg-nilin-cream/80 border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base" />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                          aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal">
                          {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {formErrors.confirmPassword && <p id="confirmPassword-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.confirmPassword.message}</p>}
                    </motion.div>

                    {/* Service Categories */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                      <span className="block text-base font-medium text-nilin-charcoal mb-3">Service Categories *</span>
                      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Service categories">
                        {categories.map(cat => (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => toggleCategory(cat._id)}
                            aria-pressed={selectedCategories.includes(cat._id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${
                              selectedCategories.includes(cat._id)
                                ? 'border-nilin-coral bg-nilin-blush/50 text-nilin-charcoal'
                                : 'border-nilin-border bg-white text-nilin-warmGray hover:border-nilin-coral/50'
                            }`}
                          >
                            <span className="text-base font-medium">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                      {formErrors.categories && <p id="categories-error" className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">{formErrors.categories.message}</p>}
                    </motion.div>

                    {/* Background check agreement */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="pt-2">
                      <label className="flex items-start gap-4 cursor-pointer">
                        <input {...register('agreeToBackground')} id="agreeToBackground" type="checkbox"
                          aria-invalid={!!formErrors.agreeToBackground}
                          aria-describedby={formErrors.agreeToBackground ? 'agreeToBackground-error' : undefined}
                          className="mt-1 w-5 h-5 rounded border-2 border-nilin-border bg-white text-nilin-coral focus:ring-nilin-coral/30 focus:ring-offset-0 accent-nilin-coral cursor-pointer" />
                        <span className="text-base text-nilin-warmGray">
                          I agree to a background check as required for all NILIN providers *
                        </span>
                      </label>
                      {formErrors.agreeToBackground && <p id="agreeToBackground-error" className="text-sm text-red-500 mt-2" role="alert" aria-live="polite">{formErrors.agreeToBackground.message}</p>}
                    </motion.div>

                    {/* Terms */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="pt-2">
                      <label className="flex items-start gap-4 cursor-pointer">
                        <input {...register('agreeToTermsAndPrivacy')} id="agreeToTermsAndPrivacy" type="checkbox"
                          aria-invalid={!!formErrors.agreeToTermsAndPrivacy}
                          aria-describedby={formErrors.agreeToTermsAndPrivacy ? "agreeToTermsAndPrivacy-error" : undefined}
                          className="mt-1 w-5 h-5 rounded border-2 border-nilin-border bg-white text-nilin-coral focus:ring-nilin-coral/30 focus:ring-offset-0 accent-nilin-coral cursor-pointer" />
                        <span className="text-base text-nilin-warmGray">
                          I agree to the <Link to="/terms" className="text-nilin-coral hover:underline">Terms</Link> and <Link to="/privacy" className="text-nilin-coral hover:underline">Privacy Policy</Link> *
                        </span>
                      </label>
                      {formErrors.agreeToTermsAndPrivacy && <p id="agreeToTermsAndPrivacy-error" className="text-sm text-red-500 mt-2" role="alert" aria-live="polite">{formErrors.agreeToTermsAndPrivacy.message}</p>}
                    </motion.div>

                    {/* Server Errors */}
                    <AnimatePresence>
                      {(errors?.length > 0 || formErrors.root) && (
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
                            {formErrors.root && <li>{formErrors.root.message}</li>}
                            {errors?.map((e, i) => <li key={i}>{e.message}</li>)}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <CaptchaWidget onToken={setCaptchaToken} className="mt-2" />

                    {/* Buttons */}
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex-1 py-5 rounded-xl border-2 border-nilin-border text-nilin-charcoal font-medium hover:bg-nilin-blush/50 transition-all"
                      >
                        Back
                      </button>
                      <motion.button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        aria-busy={isSubmitting || isLoading}
                        whileHover={{ scale: 1.01, y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        className="flex-1 relative py-5 rounded-xl overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nilin-coral/25 hover:shadow-xl hover:shadow-nilin-coral/35"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-nilin-rose to-nilin-coral" />
                        <div className="absolute inset-0 bg-gradient-to-r from-nilin-coral to-nilin-rose opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white text-lg font-medium">
                          {isSubmitting || isLoading ? (
                            <>
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}
                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                              Creating...
                            </>
                          ) : (
                            'Create Account'
                          )}
                        </span>
                      </motion.button>
                    </div>

                    {/* Trust */}
                    <div className="flex items-center justify-center gap-10 pt-2">
                      <div className="flex items-center gap-2 text-nilin-warmGray text-base">
                        <Shield className="w-4 h-4 text-nilin-success" />
                        Secure
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </motion.div>

          <p className="mt-8 text-center text-base text-nilin-warmGray">
            Already have an account? <Link to="/login" className="text-nilin-coral hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderRegistration;