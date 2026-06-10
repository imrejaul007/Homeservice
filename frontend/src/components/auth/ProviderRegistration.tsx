import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCategories } from '../../hooks/useCategories';
import { Eye, EyeOff, Mail, Phone, Building, MapPin, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

const providerRegistrationSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50).regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50).regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters'),
  email: z.string().email('Please enter a valid email').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Must have uppercase, lowercase, number & special character'),
  confirmPassword: z.string(),
  phone: z.string().optional().or(z.literal('')),
  businessName: z.string().min(2, 'Business name required'),
  serviceCategories: z.array(z.string()).min(1, 'Select at least one category'),
  agreeToTerms: z.boolean().refine(v => v === true, 'You must agree to terms'),
  agreeToPrivacy: z.boolean().refine(v => v === true, 'You must agree to privacy policy'),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

type ProviderRegistrationForm = z.infer<typeof providerRegistrationSchema>;

const ProviderRegistration: React.FC = () => {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { registerProvider, isLoading, errors } = useAuthStore();
  const { categories } = useCategories();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors: formErrors, isSubmitting }, setError, clearErrors, watch, setValue, trigger } = useForm<ProviderRegistrationForm>({
    resolver: zodResolver(providerRegistrationSchema),
    defaultValues: { serviceCategories: [], agreeToTerms: false, agreeToPrivacy: false },
  });

  const watchedPassword = watch('password');
  const watchedCategories = watch('serviceCategories');

  const validateStep1 = async () => {
    const fieldsToValidate: Array<keyof ProviderRegistrationForm> = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'password',
      'confirmPassword'
    ];

    const result = await trigger(fieldsToValidate);
    return result;
  };

  const toggleCategory = (catId: string) => {
    const current = watchedCategories || [];
    if (current.includes(catId)) {
      setValue('serviceCategories', current.filter(c => c !== catId));
    } else {
      setValue('serviceCategories', [...current, catId]);
    }
  };

  const onSubmit = async (data: ProviderRegistrationForm) => {
    try {
      clearErrors();
      await registerProvider({
        firstName: data.firstName, lastName: data.lastName, email: data.email,
        password: data.password, confirmPassword: data.confirmPassword, role: 'provider' as const,
        phone: data.phone, businessName: data.businessName, serviceCategories: data.serviceCategories,
        agreeToTermsAndPrivacy: data.agreeToTerms && data.agreeToPrivacy,
      });
      setIsSuccess(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Registration failed');
      setError('root', { type: 'server', message: error.message });
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
            <h2 className="text-3xl font-serif text-nilin-charcoal mb-2">Application Submitted!</h2>
            <p className="text-nilin-warmGray mb-6">We'll review your application and get back to you within 24-48 hours.</p>
            <button onClick={() => navigate('/login')} className="px-8 py-3 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg">
              Go to Login
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

      <div className="flex-1 py-12 px-4 relative z-10">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif font-light text-nilin-charcoal tracking-wide mb-2">NILIN</h1>
            <p className="text-nilin-warmGray">Apply to become a NILIN Pro Partner</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2].map(s => (
              <React.Fragment key={s}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                  s < step ? 'bg-green-500 text-white' : s === step ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white' : 'bg-white/50 text-nilin-warmGray'
                }`}>
                  {s < step ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                {s < 2 && <div className={`w-16 h-1 rounded ${s < step ? 'bg-green-500' : 'bg-white/30'}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="glass rounded-3xl p-8 shadow-xl">
            {step === 1 && (
              <form className="space-y-5">
                <h2 className="text-xl font-serif text-nilin-charcoal mb-2 text-center">Personal Details</h2>

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

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                    <input {...register('email')} type="email" placeholder="you@example.com" className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  </div>
                  {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                    <input {...register('phone')} placeholder="+971 50 123 4567" className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  </div>
                  {formErrors.phone && <p className="mt-1 text-xs text-red-500">{formErrors.phone.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Password *</label>
                  <div className="relative">
                    <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Create password" className="w-full px-4 py-3 pr-12 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {formErrors.password && <p className="mt-1 text-xs text-red-500">{formErrors.password.message}</p>}
                  <PasswordStrengthIndicator password={watchedPassword || ''} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Confirm Password *</label>
                  <input {...register('confirmPassword')} type="password" placeholder="Confirm password" className="w-full px-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  {formErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{formErrors.confirmPassword.message}</p>}
                </div>

                <button type="button" onClick={async () => { if (await validateStep1()) setStep(2) }} className="w-full py-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg shadow-nilin-rose/30 hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <h2 className="text-xl font-serif text-nilin-charcoal mb-2 text-center">Business Details</h2>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1.5">Business Name *</label>
                  <div className="relative">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                    <input {...register('businessName')} placeholder="Your business or salon name" className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-all" />
                  </div>
                  {formErrors.businessName && <p className="mt-1 text-xs text-red-500">{formErrors.businessName.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-3">Service Categories *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.slice(0, 6).map(cat => (
                      <button key={cat._id} type="button" onClick={() => toggleCategory(cat._id)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                          watchedCategories?.includes(cat._id)
                            ? 'border-nilin-coral bg-nilin-coral/10 text-nilin-charcoal'
                            : 'border-nilin-border bg-white/60 text-nilin-warmGray hover:border-nilin-coral/50'
                        }`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  {formErrors.serviceCategories && <p className="mt-1 text-xs text-red-500">{formErrors.serviceCategories.message}</p>}
                </div>

                <div className="pt-2 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input {...register('agreeToTerms')} type="checkbox" className="mt-1 w-4 h-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral/30" />
                    <span className="text-sm text-nilin-warmGray">I agree to the <Link to="/terms" className="text-nilin-coral hover:underline">Terms of Service</Link></span>
                  </label>
                  {formErrors.agreeToTerms && <p className="mt-1 text-xs text-red-500">{formErrors.agreeToTerms.message}</p>}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input {...register('agreeToPrivacy')} type="checkbox" className="mt-1 w-4 h-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral/30" />
                    <span className="text-sm text-nilin-warmGray">I agree to the <Link to="/privacy" className="text-nilin-coral hover:underline">Privacy Policy</Link></span>
                  </label>
                  {formErrors.agreeToPrivacy && <p className="mt-1 text-xs text-red-500">{formErrors.agreeToPrivacy.message}</p>}
                </div>

                {errors?.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <ul className="text-sm text-red-600 list-disc list-inside">
                      {errors.map((e, i) => <li key={i}>{e.message}</li>)}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl border border-nilin-border text-nilin-charcoal font-medium hover:bg-white/50 transition-colors">
                    Back
                  </button>
                  <button type="submit" disabled={isSubmitting || isLoading} className="flex-1 py-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
                    {isSubmitting || isLoading ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            )}

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

export default ProviderRegistration;
