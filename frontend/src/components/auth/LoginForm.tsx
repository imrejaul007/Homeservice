"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, ArrowRight, Shield, Star } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import { Sparkles } from '../ui/sparkles';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, 'Email is required')
    .email('Please enter a valid email'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

// Network error detection helper
const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('Network') ||
           error.message.includes('network') ||
           error.message.includes('fetch') ||
           error.message.includes('ECONNREFUSED') ||
           error.message.includes('ETIMEDOUT') ||
           error.message.includes('timeout') ||
           error.message.includes('CORS');
  }
  return false;
};

// Get user-friendly error message
const getErrorMessage = (error: unknown): string => {
  if (isNetworkError(error)) {
    return 'Unable to connect. Please check your internet connection.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};

interface LocationState {
  from?: string;
  returnTo?: string;
  email?: string;
  message?: string;
}

const LoginFormComponent: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [shake, setShake] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const controls = useAnimation();

  // Track if we've already synced autofill (prevent infinite loops)
  const autofillSynced = useRef(false);

  const { login, isLoading, errors, clearErrors, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as LocationState | null;
  const stateMessage = locationState?.message;
  const prefilledEmail = locationState?.email || searchParams.get('email') || '';
  const returnTo =
    searchParams.get('returnTo') ||
    locationState?.returnTo ||
    locationState?.from ||
    '/customer/bookings';

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
    setError,
    watch,
    setValue,
    trigger,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: '', rememberMe: false },
  });

  // Direct DOM event listener to catch browser autofill
  useEffect(() => {
    const input = emailInputRef.current;
    if (!input) return;

    const handleInput = () => {
      const value = input.value;
      if (value && value.length > 0) {
        setValue('email', value, { shouldValidate: false });
        setError('email', { message: '' });
      }
    };

    // Listen for both input and change events to catch autofill
    input.addEventListener('input', handleInput);
    input.addEventListener('change', handleInput);

    return () => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('change', handleInput);
    };
  }, [setValue, setError]);

  const watchedEmail = watch('email');

  // Set prefilled email with validation
  useEffect(() => {
    if (prefilledEmail) {
      setValue('email', prefilledEmail, { shouldValidate: true });
    }
    // Auto-focus on email field
    setTimeout(() => emailInputRef.current?.focus(), 100);
  }, [prefilledEmail, setValue]);

  // Handle browser autofill - sync and validate after mount
  useEffect(() => {
    if (autofillSynced.current) return;

    // Multiple attempts to catch autofill
    const attempts = [100, 300, 500, 1000];

    attempts.forEach(delay => {
      setTimeout(() => {
        if (autofillSynced.current) return;

        const emailValue = emailInputRef.current?.value;
        if (emailValue && emailValue.includes('@') && emailValue.includes('.')) {
          autofillSynced.current = true;
          setValue('email', emailValue, { shouldValidate: true });
          // Also trigger validation
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

  useEffect(() => {
    if (!user || !isSubmitted || isLoading) return;
    const destination =
      user.role === 'customer'
        ? returnTo.startsWith('/') ? returnTo : '/customer/bookings'
        : user.role === 'provider'
          ? '/provider/dashboard'
          : user.role === 'admin'
            ? '/admin/dashboard'
            : '/';
    navigate(destination, { replace: true });
  }, [user, isSubmitted, isLoading, returnTo, navigate]);

  const onSubmit = async (data: LoginForm) => {
    // Prevent double submission
    if (isSubmitting || isLoading) return;

    try {
      clearErrors();
      setIsSubmitted(false);
      await login({ email: data.email, password: data.password, rememberMe: data.rememberMe });
      setIsSubmitted(true);
    } catch (err) {
      // Check for network errors first
      if (isNetworkError(err)) {
        setError('root', {
          type: 'server',
          message: 'Unable to connect to server. Please check your internet connection and try again.'
        });
        return;
      }
      // Format the error message
      let errorMessage = 'Sign in failed. Please try again.';
      if (err instanceof Error) {
        // Handle specific error codes from backend
        if (err.message.includes('invalid') || err.message.includes('incorrect')) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (err.message.includes('locked') || err.message.includes('disabled')) {
          errorMessage = 'Account is locked. Please try again later or reset your password.';
        } else if (err.message.includes('pending') || err.message.includes('verify')) {
          errorMessage = 'Please verify your email before signing in.';
        } else if (err.message.length > 0 && err.message.length < 100) {
          errorMessage = err.message;
        }
      }
      setError('root', { type: 'server', message: errorMessage });
    }
  };

  if (user && isSubmitted && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
        <Sparkles className="absolute inset-0" />
        <NavigationHeader showSearch={false} showCategoryTabs={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-2xl shadow-green-500/30"
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-serif text-nilin-charcoal mb-3"
            >
              Welcome back!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-nilin-warmGray"
            >
              Redirecting to your dashboard...
            </motion.p>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      {/* Aceternity Sparkles - Light Theme */}
      <Sparkles className="absolute inset-0" />

      <NavigationHeader showSearch={false} showCategoryTabs={false} />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        {/* Wider Card Container */}
        <div className="w-full max-w-2xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            {/* NILIN Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/80 backdrop-blur-sm border border-nilin-border/50 shadow-nilin-sm mb-6"
            >
              <Sparkles className="w-5 h-5 text-nilin-coral" />
              <span className="text-nilin-coral text-sm font-medium tracking-wide">NILIN MEMBERS</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, letterSpacing: '0.12em' }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl md:text-6xl font-serif font-light text-nilin-charcoal mb-3"
            >
              NILIN
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-nilin-warmGray text-base tracking-wide"
            >
              Beauty & Wellness at your doorstep
            </motion.p>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative group"
          >
            {/* Hover Glow Effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-nilin-coral/10 via-transparent to-nilin-rose/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Card Background */}
            <div className="relative rounded-3xl bg-white/95 backdrop-blur-sm border border-nilin-border/60 shadow-nilin-lg overflow-hidden">
              {/* Top Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-blush" />

              <div className="p-10 space-y-8">
                {/* Card Header */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-center"
                >
                  <h2 className="text-3xl font-serif text-nilin-charcoal mb-2">Welcome Back</h2>
                  <p className="text-nilin-warmGray">Sign in to continue your journey</p>
                </motion.div>

                {/* State Message */}
                <AnimatePresence>
                  {stateMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      role="alert"
                      className="p-5 rounded-xl bg-nilin-peach/60 border border-nilin-coral/30"
                    >
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-nilin-coral flex-shrink-0" />
                        <p className="text-nilin-charcoal">{stateMessage}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.form
                  onSubmit={handleSubmit(onSubmit)}
                  animate={controls}
                  className="space-y-6"
                >
                  {/* Email Field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <label htmlFor="email" className="block text-base font-medium text-nilin-charcoal mb-3">
                      Email Address
                    </label>
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-nilin-charcoal/60 group-hover/input:text-nilin-charcoal transition-colors" />
                      </div>
                      <input
                        {...register('email')}
                        ref={emailInputRef}
                        id="email"
                        type="email"
                        autoComplete="email"
                        aria-describedby="email-error"
                        aria-invalid={!!formErrors.email}
                        placeholder="you@example.com"
                        className="w-full pl-14 pr-5 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 focus:scale-[1.01] transition-all text-base"
                      />
                    </div>
                    {formErrors.email && (
                      <p id="email-error" className="mt-3 text-sm text-red-500 flex items-center gap-2" role="alert" aria-live="polite">
                        <AlertCircle className="w-4 h-4" />
                        {formErrors.email.message}
                      </p>
                    )}
                  </motion.div>

                  {/* Password Field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <label htmlFor="password" className="block text-base font-medium text-nilin-charcoal mb-3">
                      Password
                    </label>
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-nilin-charcoal/60 group-hover/input:text-nilin-charcoal transition-colors" />
                      </div>
                      <input
                        {...register('password')}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-describedby="password-error"
                        aria-invalid={!!formErrors.password}
                        placeholder="Enter your password"
                        className="w-full pl-14 pr-14 py-4 rounded-xl bg-white border-2 border-nilin-border text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:border-nilin-coral focus:ring-3 focus:ring-nilin-coral/20 transition-all text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-5 flex items-center text-nilin-charcoal/60 hover:text-nilin-charcoal transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {formErrors.password && (
                      <p id="password-error" className="mt-3 text-sm text-red-500 flex items-center gap-2" role="alert" aria-live="polite">
                        <AlertCircle className="w-4 h-4" />
                        {formErrors.password.message}
                      </p>
                    )}
                  </motion.div>

                  {/* Remember & Forgot */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.65 }}
                    className="flex items-center justify-between"
                  >
                    <label className="flex items-center gap-3 cursor-pointer group/checkbox">
                      <input
                        {...register('rememberMe')}
                        type="checkbox"
                        className="w-5 h-5 rounded border-2 border-nilin-border bg-white text-nilin-coral focus:ring-nilin-coral/30 focus:ring-offset-0 cursor-pointer accent-nilin-coral"
                      />
                      <span className="text-base text-nilin-warmGray group-hover/checkbox:text-nilin-charcoal transition-colors">
                        Remember me
                      </span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-base text-nilin-coral hover:text-nilin-rose transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </motion.div>

                  {/* Submit Button */}
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    aria-busy={isSubmitting || isLoading}
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className="relative w-full py-5 rounded-xl overflow-hidden group/btn disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nilin-coral/25 hover:shadow-xl hover:shadow-nilin-coral/35"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-nilin-rose to-nilin-coral" />
                    <div className="absolute inset-0 bg-gradient-to-r from-nilin-coral to-nilin-rose opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2 text-white text-lg font-medium">
                      {isSubmitting || isLoading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </motion.button>

                  {/* Server Errors */}
                  {errors && errors.length > 0 && !formErrors.email && !formErrors.password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      role="alert"
                      aria-live="polite"
                      className={`p-5 rounded-xl border-2 ${
                        errors.some(e => e.code === 'NETWORK_ERROR')
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          errors.some(e => e.code === 'NETWORK_ERROR') ? 'text-amber-500' : 'text-red-500'
                        }`} />
                        <div>
                          <h4 className={`font-medium text-base ${
                            errors.some(e => e.code === 'NETWORK_ERROR') ? 'text-amber-700' : 'text-red-700'
                          }`}>
                            {errors.some(e => e.code === 'NETWORK_ERROR') ? 'Connection Error' : 'Sign in failed'}
                          </h4>
                          <ul className={`mt-2 text-base list-disc list-inside ${
                            errors.some(e => e.code === 'NETWORK_ERROR') ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {errors.map((error, i) => <li key={i}>{error.message}</li>)}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.form>

                {/* Divider */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="relative py-6"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-nilin-border/50" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-6 bg-white text-nilin-warmGray">New to NILIN?</span>
                  </div>
                </motion.div>

                {/* Register Buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="grid grid-cols-2 gap-4"
                >
                  <Link
                    to="/register/customer"
                    state={{ email: prefilledEmail || watchedEmail || undefined, returnTo }}
                    className="py-4 rounded-xl border-2 border-nilin-border text-center text-base font-medium text-nilin-charcoal hover:text-nilin-coral hover:border-nilin-coral/50 hover:bg-nilin-blush/50 transition-all"
                  >
                    Join as Customer
                  </Link>
                  <Link
                    to="/register/provider"
                    className="py-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-center text-base font-medium text-white shadow-md hover:shadow-lg transition-all"
                  >
                    Become a Pro
                  </Link>
                </motion.div>

                {/* Trust Indicators */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="flex items-center justify-center gap-10 pt-4"
                >
                  <div className="flex items-center gap-2 text-nilin-warmGray text-base">
                    <Shield className="w-4 h-4 text-nilin-success" />
                    Secure
                  </div>
                  <div className="flex items-center gap-2 text-nilin-warmGray text-base">
                    <Star className="w-4 h-4 text-amber-500" />
                    Trusted
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Terms */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-8 text-center text-base text-nilin-warmGray"
          >
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-nilin-coral hover:text-nilin-rose transition-colors">
              Terms
            </Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-nilin-coral hover:text-nilin-rose transition-colors">
              Privacy Policy
            </Link>
          </motion.p>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LoginFormComponent;
