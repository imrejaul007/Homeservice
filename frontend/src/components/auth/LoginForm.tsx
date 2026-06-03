import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
  returnTo?: string;
  email?: string;
  message?: string;
}

const LoginFormComponent: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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
    reset,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: '', rememberMe: false },
  });

  const watchedEmail = watch('email');

  useEffect(() => { clearErrors(); }, [watchedEmail, clearErrors]);

  useEffect(() => {
    if (prefilledEmail) {
      reset({ email: prefilledEmail, password: '', rememberMe: false });
    }
  }, [prefilledEmail, reset]);

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
    try {
      clearErrors();
      setIsSubmitted(false);
      await login({ email: data.email, password: data.password, rememberMe: data.rememberMe });
      setIsSubmitted(true);
    } catch (error) {
      if (errors && errors.length > 0) {
        errors.forEach(err => {
          if (err.field) {
            setError(err.field as keyof LoginForm, { type: 'server', message: err.message });
          }
        });
      }
    }
  };

  if (user && isSubmitted && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-serif text-nilin-charcoal mb-2">Welcome back!</h2>
            <p className="text-nilin-warmGray">Redirecting to your dashboard...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-nilin-coral/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-nilin-rose/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-nilin-blush/30 blur-3xl" />
      </div>

      <NavigationHeader />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-6">
              <span className="text-nilin-coral text-sm font-medium">Welcome to NILIN</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-light text-nilin-charcoal tracking-wide mb-2">NILIN</h1>
            <p className="text-nilin-warmGray">Beauty & Wellness at your doorstep</p>
          </div>

          {/* Main Card */}
          <div className="glass rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-2 text-center">Sign In</h2>
            <p className="text-nilin-warmGray text-center mb-6">Enter your credentials to continue</p>

            {stateMessage && (
              <div className="mb-6 p-4 rounded-xl bg-nilin-peach/50 border border-nilin-coral/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-nilin-coral flex-shrink-0" />
                  <p className="text-sm text-nilin-charcoal">{stateMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-nilin-charcoal mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-nilin-warmGray" />
                  </div>
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                  />
                </div>
                {formErrors.email && <p className="mt-1.5 text-sm text-red-500">{formErrors.email.message}</p>}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-nilin-charcoal mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-nilin-warmGray" />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all text-nilin-charcoal placeholder:text-nilin-lightGray"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-nilin-warmGray hover:text-nilin-charcoal transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formErrors.password && <p className="mt-1.5 text-sm text-red-500">{formErrors.password.message}</p>}
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input {...register('rememberMe')} type="checkbox" className="w-4 h-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral/30" />
                  <span className="text-sm text-nilin-warmGray">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-sm text-nilin-coral hover:text-nilin-rose transition-colors">Forgot password?</Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg shadow-nilin-rose/30 hover:shadow-xl hover:shadow-nilin-rose/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* Server Errors */}
              {errors && errors.length > 0 && !formErrors.email && !formErrors.password && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 text-sm">Sign in failed</h4>
                      <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                        {errors.map((error, i) => <li key={i}>{error.message}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-nilin-border" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-transparent text-nilin-warmGray">New to NILIN?</span></div>
            </div>

            {/* Register Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/register/customer"
                state={{
                  email: prefilledEmail || watchedEmail || undefined,
                  returnTo,
                }}
                className="py-3 rounded-xl border border-nilin-border text-center text-sm font-medium text-nilin-charcoal hover:bg-nilin-blush/50 transition-colors"
              >
                Join as Customer
              </Link>
              <Link to="/register/provider" className="py-3 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-center text-sm font-medium text-white shadow-md hover:shadow-lg transition-shadow">
                Become a Pro
              </Link>
            </div>

            {/* Terms */}
            <p className="mt-6 text-center text-xs text-nilin-warmGray">
              By signing in, you agree to our{' '}
              <Link to="/terms" className="text-nilin-coral hover:text-nilin-rose">Terms</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-nilin-coral hover:text-nilin-rose">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LoginFormComponent;
