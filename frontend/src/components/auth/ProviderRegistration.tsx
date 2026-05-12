import React, { useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCategories } from '../../hooks/useCategories';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Building,
  MapPin,
  Briefcase,
  Upload,
  FileText,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Plus,
  X,
  Sparkles,
  Shield,
  Clock,
  TrendingUp,
  FileCheck,
  Image,
  Phone,
  Mail,
  Calendar,
  Globe,
  Navigation,
  Check,
} from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';

// Validation schema for provider registration
const providerRegistrationSchema = z.object({
  // Personal Information
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
    .regex(/^[\+]?[(]?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number'),

  dateOfBirth: z.string()
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 18 && birthDate < today;
    }, 'You must be at least 18 years old to become a provider'),

  // Business Information
  businessInfo: z.object({
    businessName: z.string()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name cannot exceed 100 characters'),

    businessType: z.enum(['individual', 'small_business', 'company', 'franchise']),

    description: z.string()
      .min(50, 'Business description must be at least 50 characters')
      .max(1000, 'Business description cannot exceed 1000 characters'),

    tagline: z.string().max(100, 'Tagline cannot exceed 100 characters').optional(),

    website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),

    establishedDate: z.string().optional(),

    serviceRadius: z.number().min(1, 'Service radius must be at least 1 km').max(100, 'Service radius cannot exceed 100 km').default(25),
  }),

  // Location Information
  locationInfo: z.object({
    primaryAddress: z.object({
      street: z.string().min(1, 'Street address is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      zipCode: z.string().min(1, 'ZIP code is required'),
      country: z.string().default('AE'),
    }),
    mobileService: z.boolean().default(true),
    hasFixedLocation: z.boolean().default(false),
  }),

  // Services
  services: z.array(z.object({
    name: z.string().min(1, 'Service name is required').max(100, 'Service name cannot exceed 100 characters'),
    category: z.string().min(1, 'Service category is required'),
    subcategory: z.string().optional(),
    description: z.string().min(1, 'Service description is required').max(500, 'Service description cannot exceed 500 characters'),
    duration: z.number().min(15, 'Duration must be at least 15 minutes').max(480, 'Duration cannot exceed 480 minutes'),
    price: z.object({
      amount: z.number().min(0, 'Price cannot be negative'),
      currency: z.string().default('AED'),
      type: z.enum(['fixed', 'hourly', 'custom']).default('fixed'),
    }),
    tags: z.array(z.string()).optional(),
  })).min(1, 'At least one service is required'),

  // Agreements
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions'
  }),

  agreeToPrivacy: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the privacy policy'
  }),

  agreeToBackground: z.boolean().refine((val) => val === true, {
    message: 'Background check agreement is required for providers'
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProviderRegistrationForm = z.infer<typeof providerRegistrationSchema>;

const STEPS = [
  { id: 1, name: 'Personal', fullName: 'Personal Info', icon: User, description: 'Your account details' },
  { id: 2, name: 'Business', fullName: 'Business Info', icon: Building, description: 'About your business' },
  { id: 3, name: 'Location', fullName: 'Location', icon: MapPin, description: 'Where you operate' },
  { id: 4, name: 'Services', fullName: 'Services', icon: Briefcase, description: 'What you offer' },
  { id: 5, name: 'Documents', fullName: 'Documents', icon: Upload, description: 'Verify your identity' },
  { id: 6, name: 'Review', fullName: 'Review & Submit', icon: FileText, description: 'Confirm everything' },
];

// NILIN styled input classes
const inputClass = "input-nilin w-full px-4 py-3.5 border border-[#E8E4E0] rounded-nilin text-sm text-nilin-charcoal placeholder-nilin-warmGray";
const selectClass = "input-nilin w-full px-4 py-3.5 border border-[#E8E4E0] rounded-nilin text-sm text-nilin-charcoal appearance-none";
const labelClass = "block text-sm font-semibold text-nilin-charcoal mb-2";
const errorClass = "mt-2 text-xs font-medium text-red-500";

const ProviderRegistration: React.FC = () => {
  const { categories, isLoading: categoriesLoading } = useCategories();

  const categoryOptions = useMemo(() => {
    return categories.map(cat => ({
      name: cat.name,
      subcategories: cat.subcategories?.map(sub => sub.name) || []
    }));
  }, [categories]);

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [files, setFiles] = useState<{[key: string]: File[]}>({
    identityDocument: [],
    businessLicense: [],
    certifications: [],
    portfolio: [],
  });

  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});

  const { registerProvider, isLoading, errors } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
    setError,
    clearErrors,
    watch,
    setValue,
    getValues,
    trigger,
  } = useForm<ProviderRegistrationForm>({
    resolver: zodResolver(providerRegistrationSchema),
    defaultValues: {
      businessInfo: {
        businessType: 'individual',
        serviceRadius: 25,
      },
      locationInfo: {
        primaryAddress: {
          country: 'AE',
        },
        mobileService: true,
        hasFixedLocation: false,
      },
      services: [
        {
          price: {
            currency: 'AED',
            type: 'fixed',
            amount: 0,
          },
          duration: 60,
        }
      ],
      agreeToTerms: false,
      agreeToPrivacy: false,
      agreeToBackground: false,
    },
    mode: 'onChange',
  });

  const watchedServices = watch('services');

  const handleFileChange = (fieldName: string, selectedFiles: FileList | null) => {
    if (selectedFiles) {
      const fileArray = Array.from(selectedFiles);
      setFiles(prev => ({
        ...prev,
        [fieldName]: fileArray,
      }));
    }
  };

  const removeFile = (fieldName: string, index: number) => {
    setFiles(prev => ({
      ...prev,
      [fieldName]: prev[fieldName].filter((_, i) => i !== index),
    }));
  };

  const addService = () => {
    const currentServices = getValues('services');
    setValue('services', [
      ...currentServices,
      {
        name: '',
        category: '',
        subcategory: '',
        description: '',
        duration: 60,
        price: {
          amount: 0,
          currency: 'AED',
          type: 'fixed' as const,
        },
        tags: [],
      }
    ]);
  };

  const removeService = (index: number) => {
    const currentServices = getValues('services');
    if (currentServices.length > 1) {
      setValue('services', currentServices.filter((_, i) => i !== index));
    }
  };

  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getFieldsForStep = (step: number): (keyof ProviderRegistrationForm)[] => {
    switch (step) {
      case 1:
        return ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'phone', 'dateOfBirth'];
      case 2:
        return ['businessInfo'];
      case 3:
        return ['locationInfo'];
      case 4:
        return ['services'];
      default:
        return [];
    }
  };

  const onSubmit = async (data: ProviderRegistrationForm) => {
    try {
      clearErrors();
      const formData = new FormData();

      Object.entries(files).forEach(([fieldName, fileList]) => {
        fileList.forEach(file => {
          formData.append(fieldName, file);
        });
      });

      await registerProvider({
        ...data,
        role: 'provider' as const
      }, formData);
      navigate('/provider/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';

      if (errors && errors.length > 0) {
        errors.forEach(err => {
          if (err.field) {
            setError(err.field as keyof ProviderRegistrationForm, {
              type: 'server',
              message: err.message,
            });
          }
        });
      }

      setError('root' as any, {
        type: 'server',
        message: errorMessage,
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoStep
          register={register}
          formErrors={formErrors}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
        />;
      case 2:
        return <BusinessInfoStep register={register} formErrors={formErrors} />;
      case 3:
        return <LocationInfoStep register={register} formErrors={formErrors} watch={watch} />;
      case 4:
        return <ServicesStep
          register={register}
          formErrors={formErrors}
          services={watchedServices}
          addService={addService}
          removeService={removeService}
          categoriesLoading={categoriesLoading}
          categoryOptions={categoryOptions}
          watchedServices={watchedServices}
        />;
      case 5:
        return <DocumentsStep
          files={files}
          handleFileChange={handleFileChange}
          removeFile={removeFile}
          fileInputRefs={fileInputRefs}
        />;
      case 6:
        return <ReviewStep
          data={getValues()}
          files={files}
          register={register}
          formErrors={formErrors}
        />;
      default:
        return null;
    }
  };

  const currentStepData = STEPS[currentStep - 1];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      {/* Decorative Image - low opacity */}
      <div className="absolute inset-0 opacity-10">
        <img src="/images/references/BLONDIES 💈for @oligopro Photographer @jofortin Creative direction @hoxtiff Hair artist @paco_pu (5).jpg" className="w-full h-full object-cover" />
      </div>

      {/* Floating decorative shapes */}
      <div className="absolute top-24 right-20 w-40 h-40 rounded-full bg-nilin-rose/20 blur-3xl float-shape" />
      <div className="absolute bottom-32 left-16 w-48 h-48 rounded-full bg-nilin-coral/20 blur-3xl float-shape" style={{animationDelay: '1s'}} />
      <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-nilin-peach/25 blur-2xl float-shape" style={{animationDelay: '2s'}} />

      <NavigationHeader />
      <div className="relative z-10 flex-1 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">

          {/* Hero Header */}
          <div className="text-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-nilin-rose/10 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-rose" />
              <span className="text-sm font-semibold text-nilin-rose">Join NILIN</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-light text-nilin-charcoal mb-2">
              Become a Service Provider
            </h1>
            <p className="text-nilin-warmGray text-sm md:text-base max-w-md mx-auto">
              Join Dubai's fastest-growing beauty platform and start earning on your own terms
            </p>

            {/* Value props */}
            <div className="flex flex-wrap justify-center gap-3 mt-5">
              <div className="flex items-center gap-1.5 text-xs text-nilin-warmGray">
                <Clock className="w-3.5 h-3.5 text-nilin-rose" />
                <span>Flexible hours</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-nilin-warmGray">
                <TrendingUp className="w-3.5 h-3.5 text-nilin-rose" />
                <span>Higher earnings</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-nilin-warmGray">
                <Shield className="w-3.5 h-3.5 text-nilin-rose" />
                <span>Trusted platform</span>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            {/* Desktop progress */}
            <div className="hidden sm:flex items-center justify-between relative">
              {/* Background line */}
              <div className="absolute top-5 left-[40px] right-[40px] h-0.5 bg-[#E8E4E0]/60" />
              {/* Active line */}
              <div
                className="absolute top-5 left-[40px] h-0.5 bg-nilin-rose transition-all duration-500"
                style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * (100 - (80 / (STEPS.length * 2 + 6)) * 100)}%` }}
              />

              {STEPS.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div key={step.id} className="relative flex flex-col items-center z-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? 'bg-nilin-rose text-white shadow-md shadow-nilin-rose/30'
                          : isActive
                          ? 'bg-nilin-rose text-white shadow-lg shadow-nilin-rose/30 scale-110'
                          : 'bg-white border-2 border-[#E8E4E0] text-nilin-warmGray'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-medium transition-colors ${
                      isActive ? 'text-nilin-rose' : isCompleted ? 'text-nilin-rose' : 'text-nilin-warmGray'
                    }`}>
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile progress */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-nilin-charcoal">
                  Step {currentStep} of {STEPS.length}
                </span>
                <span className="text-sm font-medium text-nilin-rose">
                  {currentStepData.fullName}
                </span>
              </div>
              <div className="h-2 bg-[#E8E4E0]/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-nilin-rose to-nilin-coral rounded-full transition-all duration-500"
                  style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* NILIN Glass Card */}
          <div className="glass-nilin-strong rounded-nilin border border-[#E8E4E0]/60 overflow-hidden shadow-nilin-warm">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step Header */}
              <div className="px-6 sm:px-8 pt-7 pb-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-nilin bg-nilin-rose/10 flex items-center justify-center">
                    <currentStepData.icon className="w-5 h-5 text-nilin-rose" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-nilin-charcoal">{currentStepData.fullName}</h2>
                    <p className="text-sm text-nilin-warmGray">{currentStepData.description}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-6">
                {(formErrors as any).root && (
                  <div className="mb-6 p-4 bg-red-50/80 border border-red-100 rounded-nilin flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-red-700">{(formErrors as any).root.message}</p>
                  </div>
                )}
                {renderStep()}
              </div>

              {/* Navigation Footer */}
              <div className="px-6 sm:px-8 py-5 bg-nilin-cream/50 border-t border-[#E8E4E0]/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-nilin-charcoal bg-white border border-[#E8E4E0] rounded-nilin hover:bg-nilin-blush/50 hover:border-nilin-coral/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                {currentStep < STEPS.length ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="btn-nilin flex items-center gap-2 px-7 py-2.5 text-sm font-semibold text-white rounded-nilin transition-all"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSubmit(onSubmit)(e);
                    }}
                    className="btn-nilin flex items-center gap-2 px-7 py-2.5 text-sm font-semibold text-white rounded-nilin transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting || isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <CheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Error Display */}
          {errors && errors.length > 0 && (
            <div className="mt-6 rounded-nilin bg-red-50 border border-red-100 p-5">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-800 mb-2">
                    Please correct the following:
                  </h3>
                  <ul className="space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                        {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Sign In Link */}
          <div className="mt-6 text-center pb-4">
            <span className="text-sm text-nilin-warmGray">Already have an account? </span>
            <Link to="/login" className="text-sm text-nilin-rose hover:text-nilin-coral font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

// ─── Step Components ─────────────────────────────────────────────────────────

const PersonalInfoStep = ({ register, formErrors, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword }: any) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <label className={labelClass}>First Name *</label>
        <div className="relative">
          <input
            {...register('firstName')}
            type="text"
            className={`${inputClass} pl-12`}
            placeholder="e.g. Sarah"
          />
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
        </div>
        {formErrors.firstName && <p className={errorClass}>{formErrors.firstName.message}</p>}
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <label className={labelClass}>Last Name *</label>
        <input
          {...register('lastName')}
          type="text"
          className={`${inputClass} pl-12`}
          placeholder="e.g. Ahmed"
        />
        {formErrors.lastName && <p className={errorClass}>{formErrors.lastName.message}</p>}
      </div>
    </div>

    <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <label className={labelClass}>Email Address *</label>
      <div className="relative">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
        <input
          {...register('email')}
          type="email"
          className={`${inputClass} pl-12`}
          placeholder="sarah@example.com"
        />
      </div>
      {formErrors.email && <p className={errorClass}>{formErrors.email.message}</p>}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <label className={labelClass}>Password *</label>
        <div className="relative">
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            className={`${inputClass} pr-12`}
            placeholder="Min. 8 characters"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-nilin-warmGray hover:text-nilin-coral transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {formErrors.password && <p className={errorClass}>{formErrors.password.message}</p>}
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <label className={labelClass}>Confirm Password *</label>
        <div className="relative">
          <input
            {...register('confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            className={`${inputClass} pr-12`}
            placeholder="Re-enter password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-nilin-warmGray hover:text-nilin-coral transition-colors"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {formErrors.confirmPassword && <p className={errorClass}>{formErrors.confirmPassword.message}</p>}
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
        <label className={labelClass}>Phone Number *</label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
          <input
            {...register('phone')}
            type="tel"
            className={`${inputClass} pl-12`}
            placeholder="+971 50 123 4567"
          />
        </div>
        {formErrors.phone && <p className={errorClass}>{formErrors.phone.message}</p>}
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <label className={labelClass}>Date of Birth *</label>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
          <input
            {...register('dateOfBirth')}
            type="date"
            className={`${inputClass} pl-12`}
          />
        </div>
        {formErrors.dateOfBirth && <p className={errorClass}>{formErrors.dateOfBirth.message}</p>}
      </div>
    </div>
  </div>
);

const BusinessInfoStep = ({ register, formErrors }: any) => (
  <div className="space-y-5">
    <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
      <label className={labelClass}>Business Name *</label>
      <div className="relative">
        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
        <input
          {...register('businessInfo.businessName')}
          type="text"
          className={`${inputClass} pl-12`}
          placeholder="e.g. Glow Beauty Studio"
        />
      </div>
      {formErrors.businessInfo?.businessName && <p className={errorClass}>{formErrors.businessInfo.businessName.message}</p>}
    </div>

    <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
      <label className={labelClass}>Business Type *</label>
      <select {...register('businessInfo.businessType')} className={selectClass}>
        <option value="individual">Individual Freelancer</option>
        <option value="small_business">Small Business</option>
        <option value="company">Registered Company</option>
        <option value="franchise">Franchise</option>
      </select>
    </div>

    <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <label className={labelClass}>Business Description *</label>
      <textarea
        {...register('businessInfo.description')}
        rows={4}
        className={`${inputClass} resize-none`}
        placeholder="Tell clients about your expertise, experience, and what makes your services special (min. 50 characters)"
      />
      {formErrors.businessInfo?.description && <p className={errorClass}>{formErrors.businessInfo.description.message}</p>}
    </div>

    <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      <label className={labelClass}>Tagline <span className="text-nilin-warmGray font-normal">(Optional)</span></label>
      <input
        {...register('businessInfo.tagline')}
        type="text"
        className={inputClass}
        placeholder="e.g. Your beauty, our passion"
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <label className={labelClass}>Website <span className="text-nilin-warmGray font-normal">(Optional)</span></label>
        <div className="relative">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
          <input
            {...register('businessInfo.website')}
            type="url"
            className={`${inputClass} pl-12`}
            placeholder="https://yourwebsite.com"
          />
        </div>
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
        <label className={labelClass}>Service Radius (km) *</label>
        <div className="relative">
          <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray transition-colors" />
          <input
            {...register('businessInfo.serviceRadius', { valueAsNumber: true })}
            type="number"
            min="1"
            max="100"
            className={`${inputClass} pl-12`}
            placeholder="25"
          />
        </div>
      </div>
    </div>
  </div>
);

const LocationInfoStep = ({ register, formErrors, watch }: any) => (
  <div className="space-y-6">
    {/* Address Section */}
    <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
      <h3 className="text-sm font-semibold text-nilin-charcoal mb-4 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-nilin-rose" />
        Primary Business Address
      </h3>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Street Address *</label>
          <input
            {...register('locationInfo.primaryAddress.street')}
            type="text"
            className={inputClass}
            placeholder="e.g. Al Wasl Road, Jumeirah"
          />
          {formErrors.locationInfo?.primaryAddress?.street && (
            <p className={errorClass}>{formErrors.locationInfo.primaryAddress.street.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>City *</label>
            <input
              {...register('locationInfo.primaryAddress.city')}
              type="text"
              className={inputClass}
              placeholder="Dubai"
            />
            {formErrors.locationInfo?.primaryAddress?.city && (
              <p className={errorClass}>{formErrors.locationInfo.primaryAddress.city.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Emirate *</label>
            <input
              {...register('locationInfo.primaryAddress.state')}
              type="text"
              className={inputClass}
              placeholder="Dubai"
            />
            {formErrors.locationInfo?.primaryAddress?.state && (
              <p className={errorClass}>{formErrors.locationInfo.primaryAddress.state.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>P.O. Box / ZIP *</label>
            <input
              {...register('locationInfo.primaryAddress.zipCode')}
              type="text"
              className={inputClass}
              placeholder="00000"
            />
            {formErrors.locationInfo?.primaryAddress?.zipCode && (
              <p className={errorClass}>{formErrors.locationInfo.primaryAddress.zipCode.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Country *</label>
            <select
              {...register('locationInfo.primaryAddress.country')}
              className={selectClass}
            >
              <option value="AE">United Arab Emirates</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    {/* Service Options */}
    <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
      <h3 className="text-sm font-semibold text-nilin-charcoal mb-4 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-nilin-rose" />
        Service Type
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="relative flex items-start gap-3 p-4 bg-nilin-blush/30 border-2 border-[#E8E4E0] rounded-nilin cursor-pointer hover:border-nilin-coral/40 has-[:checked]:border-nilin-rose has-[:checked]:bg-nilin-rose/5 transition-all">
          <input
            {...register('locationInfo.mobileService')}
            type="checkbox"
            className="sr-only peer"
          />
          <div className="w-10 h-10 rounded-nilin bg-nilin-peach/50 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-5 h-5 text-nilin-rose" />
          </div>
          <div>
            <span className="text-sm font-semibold text-nilin-charcoal block">Mobile Service</span>
            <span className="text-xs text-nilin-warmGray">I travel to clients</span>
          </div>
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-[#E8E4E0] peer-checked:border-nilin-rose peer-checked:bg-nilin-rose flex items-center justify-center transition-all">
            <Check className="w-3 h-3 text-white" />
          </div>
        </label>

        <label className="relative flex items-start gap-3 p-4 bg-nilin-blush/30 border-2 border-[#E8E4E0] rounded-nilin cursor-pointer hover:border-nilin-coral/40 has-[:checked]:border-nilin-rose has-[:checked]:bg-nilin-rose/5 transition-all">
          <input
            {...register('locationInfo.hasFixedLocation')}
            type="checkbox"
            className="sr-only peer"
          />
          <div className="w-10 h-10 rounded-nilin bg-nilin-peach/50 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-nilin-rose" />
          </div>
          <div>
            <span className="text-sm font-semibold text-nilin-charcoal block">Fixed Location</span>
            <span className="text-xs text-nilin-warmGray">Clients visit me</span>
          </div>
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-[#E8E4E0] peer-checked:border-nilin-rose peer-checked:bg-nilin-rose flex items-center justify-center transition-all">
            <Check className="w-3 h-3 text-white" />
          </div>
        </label>
      </div>
    </div>
  </div>
);

const ServicesStep = ({ register, formErrors, services, addService, removeService, categoriesLoading, categoryOptions, watchedServices }: any) => (
  <div className="space-y-5">
    {/* Service Cards */}
    <div className="space-y-4">
      {services.map((_: any, index: number) => (
        <div key={index} className="relative p-5 bg-nilin-blush/30 border border-[#E8E4E0] rounded-nilin">
          {/* Service number & remove */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-nilin-rose/10 flex items-center justify-center">
                <span className="text-xs font-bold text-nilin-rose">{index + 1}</span>
              </div>
              <h3 className="text-sm font-semibold text-nilin-charcoal">Service {index + 1}</h3>
            </div>
            {services.length > 1 && (
              <button
                type="button"
                onClick={() => removeService(index)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Service Name *</label>
                <input
                  {...register(`services.${index}.name`)}
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Bridal Makeup"
                />
                {formErrors.services?.[index]?.name && (
                  <p className={errorClass}>{formErrors.services[index].name.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Category *</label>
                <select
                  {...register(`services.${index}.category`)}
                  className={selectClass}
                  disabled={categoriesLoading}
                >
                  <option value="">{categoriesLoading ? 'Loading...' : 'Select category'}</option>
                  {categoryOptions.map((cat: any) => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                {formErrors.services?.[index]?.category && (
                  <p className={errorClass}>{formErrors.services[index].category.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>Subcategory <span className="text-nilin-warmGray font-normal">(Optional)</span></label>
              <select
                {...register(`services.${index}.subcategory`)}
                className={selectClass}
                disabled={!watchedServices?.[index]?.category}
              >
                <option value="">Select subcategory</option>
                {watchedServices?.[index]?.category &&
                  categoryOptions
                    .find((cat: any) => cat.name === watchedServices[index].category)
                    ?.subcategories.map((sub: string) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))
                }
              </select>
            </div>

            <div>
              <label className={labelClass}>Description *</label>
              <textarea
                {...register(`services.${index}.description`)}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="Briefly describe what this service includes"
              />
              {formErrors.services?.[index]?.description && (
                <p className={errorClass}>{formErrors.services[index].description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Duration (min) *</label>
                <input
                  {...register(`services.${index}.duration`, { valueAsNumber: true })}
                  type="number"
                  min="15"
                  max="480"
                  className={inputClass}
                  placeholder="60"
                />
                {formErrors.services?.[index]?.duration && (
                  <p className={errorClass}>{formErrors.services[index].duration.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Price (AED) *</label>
                <input
                  {...register(`services.${index}.price.amount`, { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  placeholder="150"
                />
                {formErrors.services?.[index]?.price?.amount && (
                  <p className={errorClass}>{formErrors.services[index].price.amount.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Price Type *</label>
                <select
                  {...register(`services.${index}.price.type`)}
                  className={selectClass}
                >
                  <option value="fixed">Fixed</option>
                  <option value="hourly">Hourly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Add Service Button */}
    <button
      type="button"
      onClick={addService}
      className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-[#E8E4E0] rounded-nilin text-sm font-semibold text-nilin-warmGray hover:border-nilin-rose hover:text-nilin-rose hover:bg-nilin-rose/5 transition-all"
    >
      <Plus className="w-4 h-4" />
      Add Another Service
    </button>
  </div>
);

const DocumentsStep = ({ files, handleFileChange, removeFile, fileInputRefs }: any) => {
  const uploadSections = [
    {
      key: 'identityDocument',
      icon: FileCheck,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      title: 'Identity Document',
      required: true,
      description: 'Government-issued ID (passport, Emirates ID, or driver\'s license)',
      accept: '.pdf,.jpg,.jpeg,.png',
      multiple: false,
    },
    {
      key: 'businessLicense',
      icon: FileText,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      title: 'Business License',
      required: false,
      description: 'Upload your trade license if applicable',
      accept: '.pdf,.jpg,.jpeg,.png',
      multiple: false,
    },
    {
      key: 'portfolio',
      icon: Image,
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      title: 'Portfolio Images',
      required: false,
      description: 'Showcase your best work (up to 10 images)',
      accept: '.jpg,.jpeg,.png,.webp',
      multiple: true,
    },
  ];

  return (
    <div className="space-y-4">
      {uploadSections.map((section, sectionIndex) => (
        <div
          key={section.key}
          className="group p-5 border-2 border-dashed border-[#E8E4E0] rounded-nilin hover:border-nilin-rose/40 transition-colors animate-fade-in-up"
          style={{ animationDelay: `${sectionIndex * 50}ms` }}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-nilin ${section.iconBg} flex items-center justify-center flex-shrink-0`}>
              <section.icon className={`w-6 h-6 ${section.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-nilin-charcoal">{section.title}</h3>
                {section.required ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-500 rounded-full">Required</span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-nilin-blush/50 text-nilin-warmGray rounded-full">Optional</span>
                )}
              </div>
              <p className="text-xs text-nilin-warmGray mb-3">{section.description}</p>

              <input
                ref={el => fileInputRefs.current[section.key] = el}
                type="file"
                accept={section.accept}
                multiple={section.multiple}
                onChange={e => handleFileChange(section.key, e.target.files)}
                className="hidden"
              />

              {files[section.key].length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[section.key]?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-rose bg-nilin-rose/10 rounded-nilin hover:bg-nilin-rose/20 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {section.multiple ? 'Choose Images' : 'Choose File'}
                </button>
              ) : (
                <div className="space-y-2">
                  {files[section.key].map((file: File, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-[#E8E4E0] px-3 py-2 rounded-nilin">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-nilin-charcoal truncate">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(section.key, index)}
                        className="p-1 text-nilin-warmGray hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[section.key]?.click()}
                    className="text-xs font-medium text-nilin-rose hover:underline"
                  >
                    + {section.multiple ? 'Add more' : 'Replace file'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ReviewStep = ({ data, files, register, formErrors }: any) => (
  <div className="space-y-5">
    {/* Personal Info Review */}
    <div className="p-5 bg-nilin-blush/30 rounded-nilin border border-[#E8E4E0]/40 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-nilin-rose" />
        <h3 className="text-sm font-bold text-nilin-charcoal">Personal Information</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <ReviewField label="Name" value={`${data.firstName} ${data.lastName}`} />
        <ReviewField label="Email" value={data.email} />
        <ReviewField label="Phone" value={data.phone} />
        <ReviewField label="Date of Birth" value={data.dateOfBirth} />
      </div>
    </div>

    {/* Business Info Review */}
    <div className="p-5 bg-nilin-blush/30 rounded-nilin border border-[#E8E4E0]/40 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <Building className="w-4 h-4 text-nilin-rose" />
        <h3 className="text-sm font-bold text-nilin-charcoal">Business Information</h3>
      </div>
      <div className="space-y-3">
        <ReviewField label="Business Name" value={data.businessInfo?.businessName} />
        <ReviewField label="Business Type" value={data.businessInfo?.businessType?.replace('_', ' ')} capitalize />
        <ReviewField label="Description" value={data.businessInfo?.description} />
      </div>
    </div>

    {/* Services Review */}
    <div className="p-5 bg-nilin-blush/30 rounded-nilin border border-[#E8E4E0]/40 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-4 h-4 text-nilin-rose" />
        <h3 className="text-sm font-bold text-nilin-charcoal">Services ({data.services?.length || 0})</h3>
      </div>
      <div className="space-y-3">
        {data.services?.map((service: any, index: number) => (
          <div key={index} className="bg-white p-4 rounded-nilin border border-[#E8E4E0]">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-nilin-charcoal">{service.name || 'Untitled'}</h4>
                <p className="text-xs text-nilin-warmGray mt-0.5">{service.category}{service.subcategory ? ` / ${service.subcategory}` : ''}</p>
              </div>
              <span className="text-sm font-bold text-nilin-rose">AED {service.price?.amount || 0}</span>
            </div>
            {service.description && (
              <p className="text-xs text-nilin-warmGray mt-2 line-clamp-2">{service.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-nilin-warmGray">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {service.duration} min</span>
              <span className="capitalize">{service.price?.type || 'fixed'} price</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Documents Review */}
    <div className="p-5 bg-nilin-blush/30 rounded-nilin border border-[#E8E4E0]/40 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <Upload className="w-4 h-4 text-nilin-rose" />
        <h3 className="text-sm font-bold text-nilin-charcoal">Uploaded Documents</h3>
      </div>
      <div className="space-y-2">
        {Object.entries(files).map(([fieldName, fileList]) => {
          const count = Array.isArray(fileList) ? fileList.length : 0;
          return (
            <div key={fieldName} className="flex items-center justify-between py-2">
              <span className="text-sm text-nilin-charcoal capitalize">
                {fieldName.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className={`text-sm font-medium ${count > 0 ? 'text-green-600' : 'text-nilin-warmGray'}`}>
                {count > 0 ? (
                  <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {count} file(s)</span>
                ) : 'Not uploaded'}
              </span>
            </div>
          );
        })}
      </div>
    </div>

    {/* Agreements */}
    <div className="p-5 bg-nilin-blush/30 rounded-nilin border border-[#E8E4E0]/40 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-nilin-rose" />
        <h3 className="text-sm font-bold text-nilin-charcoal">Required Agreements</h3>
      </div>

      <div className="space-y-4">
        <AgreementCheckbox
          register={register}
          name="agreeToTerms"
          title="I agree to the Terms and Conditions"
          description="By checking this, you agree to our terms of service and user agreement."
          error={formErrors.agreeToTerms}
        />
        <AgreementCheckbox
          register={register}
          name="agreeToPrivacy"
          title="I agree to the Privacy Policy"
          description="By checking this, you agree to our privacy policy and data handling practices."
          error={formErrors.agreeToPrivacy}
        />
        <AgreementCheckbox
          register={register}
          name="agreeToBackground"
          title="I consent to Background Check"
          description="Required for all providers to ensure platform safety and trust."
          error={formErrors.agreeToBackground}
        />
      </div>
    </div>
  </div>
);

// ─── Helper Components ───────────────────────────────────────────────────────

const ReviewField = ({ label, value, capitalize: cap }: { label: string; value?: string; capitalize?: boolean }) => (
  <div>
    <dt className="text-xs text-nilin-warmGray font-medium">{label}</dt>
    <dd className={`text-sm font-medium text-nilin-charcoal mt-0.5 ${cap ? 'capitalize' : ''}`}>
      {value || <span className="text-nilin-warmGray/50">Not provided</span>}
    </dd>
  </div>
);

const AgreementCheckbox = ({ register, name, title, description, error }: any) => (
  <div>
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          {...register(name)}
          type="checkbox"
          className="sr-only peer"
        />
        <div className="w-5 h-5 rounded-md border-2 border-[#E8E4E0] peer-checked:border-nilin-rose peer-checked:bg-nilin-rose flex items-center justify-center transition-all group-hover:border-nilin-coral">
          <Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
        </div>
      </div>
      <div>
        <span className="text-sm font-semibold text-nilin-charcoal block">{title} *</span>
        <span className="text-xs text-nilin-warmGray">{description}</span>
      </div>
    </label>
    {error && <p className="ml-8 mt-1 text-xs font-medium text-red-500">{error.message}</p>}
  </div>
);

export default ProviderRegistration;
