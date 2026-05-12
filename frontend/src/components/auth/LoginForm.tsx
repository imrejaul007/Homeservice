import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';

const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z.string()
    .min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
  message?: string;
}

const LoginFormComponent: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { login, isLoading, errors, clearErrors, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as LocationState | null;
  const stateMessage = locationState?.message;

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
    setError,
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const watchedEmail = watch('email');

  useEffect(() => {
    clearErrors();
  }, [watchedEmail, clearErrors]);

  const onSubmit = async (data: LoginForm) => {
    try {
      clearErrors();
      setIsSubmitted(false);

      await login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });

      setIsSubmitted(true);
    } catch (error) {
      if (errors && errors.length > 0) {
        errors.forEach(err => {
          if (err.field) {
            setError(err.field as keyof LoginForm, {
              type: 'server',
              message: err.message,
            });
          }
        });
      }
    }
  };

  if (user && isSubmitted && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream">
        <NavigationHeader />
        <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
            <div className="rounded-full bg-green-100 p-3 inline-block mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-serif font-light text-nilin-charcoal">
              Welcome back!
            </h2>
            <p className="mt-2 text-sm text-nilin-warmGray">
              Redirecting...
            </p>
            <div className="mt-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-nilin-coral mx-auto"></div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      <NavigationHeader />

      <div className="relative z-10 flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-light text-nilin-charcoal tracking-wide">NILIN</h1>
            <p className="text-sm text-nilin-warmGray mt-1">Beauty & Wellness at your doorstep</p>
          </div>

          <h2 className="text-center text-2xl font-serif font-light text-nilin-charcoal mb-2">
            Welcome back
          </h2>
          <p className="text-center text-sm text-nilin-warmGray mb-8">
            Sign in to continue your journey
          </p>

          {/* NILIN Glass Card */}
          <div className="glass-nilin-strong rounded-nilin p-8 shadow-nilin-warm border border-[#E8E4E0]/60">
            {stateMessage && (
              <div className="mb-6 rounded-nilin bg-nilin-peach/50 p-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-nilin-coral" />
                  <p className="text-sm text-nilin-charcoal">{stateMessage}</p>
                </div>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                <label htmlFor="email" className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-nilin-warmGray transition-colors group-focus-within:input-nilin-icon" />
                  </div>
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className="input-nilin block w-full pl-12 pr-4 py-3.5"
                    placeholder="Enter your email"
                  />
                </div>
                {formErrors.email && (
                  <p className="mt-2 text-sm text-red-500 animate-shake">{formErrors.email.message}</p>
                )}
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                <label htmlFor="password" className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-nilin-warmGray transition-colors" />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input-nilin block w-full pl-12 pr-12 py-3.5"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-nilin-warmGray hover:text-nilin-coral transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="mt-2 text-sm text-red-500 animate-shake">{formErrors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center">
                  <input
                    {...register('rememberMe')}
                    type="checkbox"
                    className="h-4 w-4 text-nilin-coral rounded border-[#E8E4E0] focus:ring-nilin-coral/30 focus:ring-offset-0"
                  />
                  <label htmlFor="rememberMe" className="ml-2.5 text-sm text-nilin-charcoal">
                    Remember me
                  </label>
                </div>
                <Link to="/forgot-password" className="text-sm text-nilin-coral hover:text-nilin-rose transition-colors hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="btn-nilin w-full flex justify-center py-3.5 px-4 text-white animate-fade-in-up"
                style={{ animationDelay: '150ms' }}
              >
                {isSubmitting || isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>

              {errors && errors.length > 0 && !formErrors.email && !formErrors.password && (
                <div className="rounded-nilin bg-red-50/80 border border-red-100 p-4 animate-fade-in">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Sign in failed</h3>
                      <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                        {errors.map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <div className="mt-8">
              <div className="relative animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E8E4E0]/60" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-nilin-warmGray">New to NILIN?</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
                <Link
                  to="/register/customer"
                  className="glass-btn w-full flex justify-center py-3.5 px-4 rounded-nilin text-sm font-medium text-nilin-charcoal border border-[#E8E4E0] hover:bg-nilin-blush/50 hover:border-nilin-coral/40 transition-all"
                >
                  Join as Customer
                </Link>
                <Link
                  to="/register/provider"
                  className="btn-nilin w-full flex justify-center py-3.5 px-4 rounded-nilin text-sm font-medium text-white"
                >
                  Become a Provider
                </Link>
              </div>
            </div>

            <div className="mt-6 text-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <p className="text-xs text-nilin-warmGray">
                By signing in, you agree to our{' '}
                <Link to="/terms" className="text-nilin-coral hover:text-nilin-rose transition-colors">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-nilin-coral hover:text-nilin-rose transition-colors">Privacy Policy</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LoginFormComponent;
