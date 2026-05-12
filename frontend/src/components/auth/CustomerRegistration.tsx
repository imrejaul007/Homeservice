import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff, User, Mail, Phone, Calendar, MapPin } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

// Validation schema
const customerRegistrationSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),

  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),

  email: z.string()
    .email('Please enter a valid email address')
    .toLowerCase(),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'),

  confirmPassword: z.string(),

  phone: z.string()
    .regex(/^[\+]?[(]?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number')
    .optional(),

  dateOfBirth: z.string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 13 && birthDate < today;
    }, 'You must be at least 13 years old'),

  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),

  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().default('AE'),
  }).optional(),

  referralCode: z.string().optional(),

  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions'
  }),

  agreeToPrivacy: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the privacy policy'
  }),

  communicationPreferences: z.object({
    email: z.object({
      marketing: z.boolean().default(false),
      bookingUpdates: z.boolean().default(true),
      reminders: z.boolean().default(true),
      newsletters: z.boolean().default(false),
      promotions: z.boolean().default(false),
    }).optional(),
    sms: z.object({
      bookingUpdates: z.boolean().default(true),
      reminders: z.boolean().default(true),
      promotions: z.boolean().default(false),
    }).optional(),
  }).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CustomerRegistrationForm = z.infer<typeof customerRegistrationSchema>;

const CustomerRegistration: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const { registerCustomer, isLoading, errors } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
    setError,
    clearErrors,
    watch,
  } = useForm<CustomerRegistrationForm>({
    resolver: zodResolver(customerRegistrationSchema),
    defaultValues: {
      communicationPreferences: {
        email: {
          marketing: false,
          bookingUpdates: true,
          reminders: true,
          newsletters: false,
          promotions: false,
        },
        sms: {
          bookingUpdates: true,
          reminders: true,
          promotions: false,
        },
      },
      address: {
        country: 'AE',
      },
      agreeToTerms: false,
      agreeToPrivacy: false,
    },
  });

  const watchedPassword = watch('password');

  const onSubmit = async (data: CustomerRegistrationForm) => {
    try {
      clearErrors();

      // Prepare data for API
      const registrationData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        confirmPassword: data.password,
        role: 'customer' as const,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        address: data.address && (data.address.street || data.address.city) ? data.address : undefined,
        referralCode: data.referralCode,
        agreeToTerms: data.agreeToTerms,
        agreeToPrivacy: data.agreeToPrivacy,
        communicationPreferences: data.communicationPreferences,
      };

      await registerCustomer(registrationData);

      // Redirect to dashboard after successful registration
      navigate('/customer/dashboard');
    } catch (error) {
      // Handle registration errors
      if (errors && errors.length > 0) {
        errors.forEach(err => {
          if (err.field) {
            setError(err.field as keyof CustomerRegistrationForm, {
              type: 'server',
              message: err.message,
            });
          }
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      {/* Decorative Image - low opacity */}
      <div className="absolute inset-0 opacity-10">
        <img src="/images/references/BLONDIES 💈for @oligopro Photographer @jofortin Creative direction @hoxtiff Hair artist @paco_pu (3).jpg" className="w-full h-full object-cover" />
      </div>

      {/* Floating decorative shapes */}
      <div className="absolute top-32 right-16 w-36 h-36 rounded-full bg-nilin-rose/20 blur-3xl float-shape" />
      <div className="absolute bottom-24 left-12 w-44 h-44 rounded-full bg-nilin-coral/20 blur-3xl float-shape" style={{animationDelay: '0.5s'}} />
      <div className="absolute top-1/2 left-1/4 w-28 h-28 rounded-full bg-nilin-peach/25 blur-2xl float-shape" style={{animationDelay: '1.5s'}} />

      <NavigationHeader />
      <div className="relative z-10 flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center animate-fade-in-up">
          <h1 className="text-2xl font-serif font-light text-nilin-charcoal tracking-tight">NILIN</h1>
          <p className="text-sm text-nilin-warmGray mt-1">Beauty & Wellness at your doorstep</p>
        </div>
        <h2 className="mt-6 text-center text-3xl font-serif font-light text-nilin-charcoal animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          Create your customer account
        </h2>
        <p className="mt-2 text-center text-sm text-nilin-warmGray animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          Join thousands of satisfied customers
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* NILIN Glass Card */}
        <div className="glass-nilin rounded-nilin py-8 px-4 sm:rounded-lg sm:px-10 shadow-nilin-warm border border-[#E8E4E0]/60">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                <label htmlFor="firstName" className="block text-sm font-medium text-nilin-charcoal mb-2">
                  First Name *
                </label>
                <div className="mt-1">
                  <input
                    {...register('firstName')}
                    type="text"
                    className="input-nilin w-full px-4 py-3.5 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                    placeholder="John"
                  />
                  {formErrors.firstName && (
                    <p className="mt-2 text-sm text-red-500">{formErrors.firstName.message}</p>
                  )}
                </div>
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <label htmlFor="lastName" className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Last Name *
                </label>
                <div className="mt-1">
                  <input
                    {...register('lastName')}
                    type="text"
                    className="input-nilin w-full px-4 py-3.5 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                    placeholder="Doe"
                  />
                  {formErrors.lastName && (
                    <p className="mt-2 text-sm text-red-500">{formErrors.lastName.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <label htmlFor="email" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Email Address *
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-nilin-warmGray transition-colors" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  className="input-nilin w-full pl-12 pr-4 py-3.5 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                  placeholder="john@example.com"
                />
                {formErrors.email && (
                  <p className="mt-2 text-sm text-red-500">{formErrors.email.message}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <label htmlFor="password" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Password *
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-nilin w-full px-4 py-3.5 pr-12 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                  placeholder="Min. 8 characters"
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
                {formErrors.password && (
                  <p className="mt-2 text-sm text-red-500">{formErrors.password.message}</p>
                )}
              </div>
            </div>

            {/* Password Strength Indicator */}
            {watchedPassword && <PasswordStrengthIndicator password={watchedPassword} />}

            {/* Confirm Password */}
            <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Confirm Password *
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input-nilin w-full px-4 py-3.5 pr-12 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-nilin-warmGray hover:text-nilin-coral transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
                {formErrors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-500">{formErrors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Optional Fields Toggle */}
            <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <button
                type="button"
                onClick={() => setShowOptionalFields(!showOptionalFields)}
                className="text-sm text-nilin-rose hover:text-nilin-coral font-medium transition-colors hover:underline"
              >
                {showOptionalFields ? 'Hide optional fields' : 'Add optional information'}
              </button>
            </div>

            {/* Optional Fields */}
            {showOptionalFields && (
              <div className="space-y-6 p-5 bg-nilin-blush/50 rounded-nilin border border-[#E8E4E0]/40 animate-fade-in">
                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Phone Number
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-nilin-warmGray transition-colors" />
                    </div>
                    <input
                      {...register('phone')}
                      type="tel"
                      className="input-nilin w-full pl-12 pr-4 py-3.5 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                      placeholder="+971 50 123 4567"
                    />
                    {formErrors.phone && (
                      <p className="mt-2 text-sm text-red-500">{formErrors.phone.message}</p>
                    )}
                  </div>
                </div>

                {/* Date of Birth & Gender */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Date of Birth
                    </label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-nilin-warmGray transition-colors" />
                      </div>
                      <input
                        {...register('dateOfBirth')}
                        type="date"
                        className="input-nilin w-full pl-12 pr-4 py-3.5 border border-[#E8E4E0] rounded-nilin"
                      />
                      {formErrors.dateOfBirth && (
                        <p className="mt-2 text-sm text-red-500">{formErrors.dateOfBirth.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Gender
                    </label>
                    <div className="mt-1">
                      <select
                        {...register('gender')}
                        className="input-nilin w-full px-4 py-3.5 border border-[#E8E4E0] rounded-nilin text-nilin-charcoal"
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Referral Code */}
                <div>
                  <label htmlFor="referralCode" className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Referral Code
                  </label>
                  <div className="mt-1">
                    <input
                      {...register('referralCode')}
                      type="text"
                      className="input-nilin w-full px-4 py-3.5 border border-[#E8E4E0] rounded-nilin placeholder-nilin-warmGray"
                      placeholder="Enter referral code (optional)"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Terms and Privacy */}
            <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('agreeToTerms')}
                    type="checkbox"
                    className="h-4 w-4 text-nilin-rose border border-[#E8E4E0] rounded focus:ring-nilin-coral/30 focus:ring-offset-0"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="agreeToTerms" className="font-medium text-nilin-charcoal">
                    I agree to the{' '}
                    <Link to="/terms" className="text-nilin-rose hover:text-nilin-coral transition-colors">
                      Terms and Conditions
                    </Link>
                  </label>
                  {formErrors.agreeToTerms && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.agreeToTerms.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('agreeToPrivacy')}
                    type="checkbox"
                    className="h-4 w-4 text-nilin-rose border border-[#E8E4E0] rounded focus:ring-nilin-coral/30 focus:ring-offset-0"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="agreeToPrivacy" className="font-medium text-nilin-charcoal">
                    I agree to the{' '}
                    <Link to="/privacy" className="text-nilin-rose hover:text-nilin-coral transition-colors">
                      Privacy Policy
                    </Link>
                  </label>
                  {formErrors.agreeToPrivacy && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.agreeToPrivacy.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="btn-nilin w-full flex justify-center py-3.5 px-4 text-white transition-all"
              >
                {isSubmitting || isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>

            {/* Error Display */}
            {errors && errors.length > 0 && (
              <div className="rounded-nilin bg-red-50/80 border border-red-100 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-700">
                      Please correct the following errors:
                    </h3>
                    <div className="mt-2 text-sm text-red-600">
                      <ul className="list-disc list-inside space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Sign In Link */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E8E4E0]/60" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-nilin-warmGray">Already have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-[#E8E4E0] rounded-nilin text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-cream/50 hover:border-nilin-coral/40 focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 transition-all"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
};

export default CustomerRegistration;
