# 🎨 Frontend Authentication Implementation Guide

## 📋 Implementation Checklist
- [ ] **Authentication Store**: Zustand store for user state and token management
- [ ] **Protected Routes**: Route guards with role-based access control
- [ ] **Registration Forms**: Customer (simple) and Provider (multi-step) registration
- [ ] **Login/Logout**: Authentication flow with error handling
- [ ] **Dashboard Components**: Role-specific dashboard layouts
- [ ] **Profile Management**: User profile editing and file uploads
- [ ] **Email Verification**: Verification flow and UI
- [ ] **Password Management**: Password reset and change functionality
- [ ] **Form Validation**: Zod schemas and React Hook Form integration
- [ ] **API Integration**: Auth service methods and interceptors
- [ ] **Error Handling**: User-friendly error messages and loading states
- [ ] **Testing**: Component tests and E2E authentication flows

---

## 🗂️ State Management with Zustand

### **Step 1: Create Authentication Store**
**File**: `frontend/src/stores/authStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/auth.api';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'customer' | 'provider' | 'admin';
  isEmailVerified: boolean;
  isActive: boolean;
  avatar?: string;
  bio?: string;
  createdAt: string;
}

export interface CustomerProfile {
  userId: string;
  preferences: {
    categories: string[];
    maxDistance: number;
    priceRange: { min: number; max: number };
  };
  addresses: Array<{
    _id?: string;
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates: { lat: number; lng: number };
    isDefault: boolean;
  }>;
  favoriteProviders: string[];
  loyaltyPoints: {
    total: number;
    available: number;
  };
  stats: {
    totalBookings: number;
    totalSpent: number;
    memberSince: string;
  };
}

export interface ProviderProfile {
  userId: string;
  businessInfo: {
    businessName: string;
    businessType: 'individual' | 'company';
    description: string;
    yearsOfExperience: number;
  };
  services: {
    primaryCategory: string;
    subcategories: string[];
    specializations: string[];
  };
  location: {
    businessAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    serviceAreas: string[];
    coordinates: { lat: number; lng: number };
    isMobile: boolean;
  };
  verification: {
    status: 'pending' | 'verified' | 'rejected';
    submittedAt?: string;
    reviewedAt?: string;
    notes?: string;
  };
  ratings: {
    average: number;
    count: number;
  };
  earnings: {
    totalEarned: number;
    availableBalance: number;
    pendingBalance: number;
  };
  stats: {
    totalBookings: number;
    completedBookings: number;
    responseTime: number;
    memberSince: string;
  };
}

interface AuthState {
  // State
  user: User | null;
  profile: CustomerProfile | ProviderProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; redirectPath?: string }>;
  logout: () => void;
  register: (data: any, type: 'customer' | 'provider') => Promise<{ success: boolean }>;
  getCurrentUser: () => Promise<void>;
  updateProfile: (data: any) => Promise<{ success: boolean }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean }>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  
  // Email verification
  verifyEmail: (token: string) => Promise<{ success: boolean }>;
  resendVerification: (email: string) => Promise<{ success: boolean }>;
  
  // Password reset
  forgotPassword: (email: string) => Promise<{ success: boolean }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      profile: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authApi.login(email, password);
          
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          });

          // Store token in localStorage for API interceptors
          localStorage.setItem('token', response.token);

          return { success: true, redirectPath: response.redirectPath };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Login failed',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Logout
      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          profile: null,
          token: null,
          isAuthenticated: false,
          error: null
        });
      },

      // Register
      register: async (data: any, type: 'customer' | 'provider') => {
        set({ isLoading: true, error: null });
        
        try {
          const response = type === 'customer' 
            ? await authApi.registerCustomer(data)
            : await authApi.registerProvider(data);
          
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          });

          localStorage.setItem('token', response.token);
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Registration failed',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Get current user
      getCurrentUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        
        try {
          const response = await authApi.getCurrentUser();
          set({
            user: response.user,
            profile: response.profile,
            token,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          localStorage.removeItem('token');
          set({
            user: null,
            profile: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      // Update profile
      updateProfile: async (data: any) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authApi.updateProfile(data);
          set({
            user: { ...get().user!, ...response.user },
            profile: response.profile,
            isLoading: false
          });
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Profile update failed',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Change password
      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authApi.changePassword(currentPassword, newPassword);
          set({ isLoading: false });
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Password change failed',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Email verification
      verifyEmail: async (token: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authApi.verifyEmail(token);
          set({ 
            user: { ...get().user!, isEmailVerified: true },
            isLoading: false 
          });
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Email verification failed',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Resend verification
      resendVerification: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authApi.resendVerification(email);
          set({ isLoading: false });
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Failed to send verification email',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Forgot password
      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authApi.forgotPassword(email);
          set({ isLoading: false });
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Failed to send reset email',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Reset password
      resetPassword: async (token: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authApi.resetPassword(token, password);
          set({ isLoading: false });
          return { success: true };
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Password reset failed',
            isLoading: false
          });
          return { success: false };
        }
      },

      // Utility actions
      clearError: () => set({ error: null }),
      setLoading: (loading: boolean) => set({ isLoading: loading })
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
```

---

## 🛡️ Protected Routes

### **Step 2: Create Route Protection Components**
**File**: `frontend/src/components/auth/ProtectedRoute.tsx`

```typescript
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('customer' | 'provider' | 'admin')[];
  requireEmailVerified?: boolean;
  requireProviderVerification?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = ['customer', 'provider', 'admin'],
  requireEmailVerified = false,
  requireProviderVerification = false
}) => {
  const { user, profile, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check email verification requirement
  if (requireEmailVerified && !user.isEmailVerified) {
    return <Navigate to="/verify-email-required" replace />;
  }

  // Check provider verification requirement
  if (requireProviderVerification && user.role === 'provider') {
    const providerProfile = profile as any;
    if (!providerProfile?.verification?.status || providerProfile.verification.status !== 'verified') {
      return <Navigate to="/provider/verification-pending" replace />;
    }
  }

  // Check account status
  if (!user.isActive) {
    return <Navigate to="/account-suspended" replace />;
  }

  return <>{children}</>;
};

// Specialized route components
export const CustomerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['customer']} requireEmailVerified>
    {children}
  </ProtectedRoute>
);

export const ProviderRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['provider']} requireEmailVerified requireProviderVerification>
    {children}
  </ProtectedRoute>
);

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin']} requireEmailVerified>
    {children}
  </ProtectedRoute>
);

// Public route (redirect authenticated users)
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuthStore();

  if (isAuthenticated && user) {
    // Redirect to appropriate dashboard based on role
    const dashboardPath = {
      customer: '/customer/dashboard',
      provider: '/provider/dashboard',
      admin: '/admin/dashboard'
    }[user.role];

    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
};
```

---

## 📝 Registration Forms

### **Step 3: Create Customer Registration**
**File**: `frontend/src/components/auth/CustomerRegistration.tsx`

```typescript
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, User, Mail, Phone, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useAuthStore } from '../../stores/authStore';

const customerRegistrationSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
  agreeToPrivacy: z.boolean().refine(val => val === true, 'You must agree to the privacy policy'),
  marketingOptIn: z.boolean().optional()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type CustomerRegistrationData = z.infer<typeof customerRegistrationSchema>;

export const CustomerRegistration: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<CustomerRegistrationData>({
    resolver: zodResolver(customerRegistrationSchema)
  });

  const onSubmit = async (data: CustomerRegistrationData) => {
    clearError();
    
    const result = await registerUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        marketing: data.marketingOptIn || false
      },
      agreeToTerms: data.agreeToTerms,
      agreeToPrivacy: data.agreeToPrivacy,
      marketingOptIn: data.marketingOptIn
    }, 'customer');

    if (result.success) {
      navigate('/customer/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Join as a Customer
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Book services from verified providers
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Registration Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <div className="mt-1 relative">
                <Input
                  id="firstName"
                  {...register('firstName')}
                  className={errors.firstName ? 'border-red-300' : ''}
                />
                <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <div className="mt-1 relative">
                <Input
                  id="lastName"
                  {...register('lastName')}
                  className={errors.lastName ? 'border-red-300' : ''}
                />
                <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="mt-1 relative">
              <Input
                id="email"
                type="email"
                {...register('email')}
                className={errors.email ? 'border-red-300' : ''}
              />
              <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <div className="mt-1 relative">
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                className={errors.phone ? 'border-red-300' : ''}
              />
              <Phone className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="mt-1 relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className={errors.password ? 'border-red-300' : ''}
              />
              <button
                type="button"
                className="absolute right-3 top-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="mt-1 relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-red-300' : ''}
              />
              <button
                type="button"
                className="absolute right-3 top-3"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Terms and Privacy */}
          <div className="space-y-4">
            <div className="flex items-start">
              <Checkbox
                id="agreeToTerms"
                {...register('agreeToTerms')}
                className={errors.agreeToTerms ? 'border-red-300' : ''}
              />
              <Label htmlFor="agreeToTerms" className="ml-2 text-sm">
                I agree to the{' '}
                <Link to="/terms" className="text-blue-600 hover:text-blue-500">
                  Terms of Service
                </Link>
              </Label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-sm text-red-600">{errors.agreeToTerms.message}</p>
            )}

            <div className="flex items-start">
              <Checkbox
                id="agreeToPrivacy"
                {...register('agreeToPrivacy')}
                className={errors.agreeToPrivacy ? 'border-red-300' : ''}
              />
              <Label htmlFor="agreeToPrivacy" className="ml-2 text-sm">
                I agree to the{' '}
                <Link to="/privacy" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {errors.agreeToPrivacy && (
              <p className="text-sm text-red-600">{errors.agreeToPrivacy.message}</p>
            )}

            <div className="flex items-start">
              <Checkbox
                id="marketingOptIn"
                {...register('marketingOptIn')}
              />
              <Label htmlFor="marketingOptIn" className="ml-2 text-sm">
                I would like to receive marketing communications and special offers
              </Label>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
```

### **Step 4: Create Provider Registration (Multi-Step)**
**File**: `frontend/src/components/auth/ProviderRegistration.tsx`

```typescript
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  MapPin,
  FileText,
  Camera,
  Loader2,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useAuthStore } from '../../stores/authStore';

const providerRegistrationSchema = z.object({
  // Step 1: Account Info
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().min(10, 'Phone number is required'),
  
  // Step 2: Business Info
  businessName: z.string().min(2, 'Business name is required'),
  businessType: z.enum(['individual', 'company']),
  businessDescription: z.string().min(50, 'Description must be at least 50 characters'),
  yearsOfExperience: z.number().min(0, 'Experience cannot be negative'),
  
  // Step 3: Services
  primaryCategory: z.string().min(1, 'Primary category is required'),
  subcategories: z.array(z.string()).min(1, 'At least one subcategory is required'),
  specializations: z.array(z.string()).optional(),
  
  // Step 4: Location
  businessAddress: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(5, 'Valid zip code is required'),
    country: z.string().default('US')
  }),
  serviceAreas: z.array(z.string()).min(1, 'At least one service area is required'),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  isMobile: z.boolean().optional(),
  
  // Step 5: Terms
  agreeToProviderTerms: z.boolean().refine(val => val === true),
  agreeToCommissionStructure: z.boolean().refine(val => val === true),
  agreeToBackgroundCheck: z.boolean().refine(val => val === true)
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type ProviderRegistrationData = z.infer<typeof providerRegistrationSchema>;

const STEPS = [
  { title: 'Account Info', description: 'Basic account information' },
  { title: 'Business Details', description: 'Tell us about your business' },
  { title: 'Services', description: 'What services do you offer?' },
  { title: 'Location', description: 'Where do you operate?' },
  { title: 'Documents', description: 'Upload verification documents' },
  { title: 'Review', description: 'Review and submit' }
];

export const ProviderRegistration: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File[] }>({});
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger
  } = useForm<ProviderRegistrationData>({
    resolver: zodResolver(providerRegistrationSchema),
    mode: 'onBlur'
  });

  const nextStep = async () => {
    const isValid = await trigger();
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleFileUpload = (fieldName: string, files: FileList | null) => {
    if (files) {
      setUploadedFiles(prev => ({
        ...prev,
        [fieldName]: Array.from(files)
      }));
    }
  };

  const onSubmit = async (data: ProviderRegistrationData) => {
    clearError();
    
    // Create FormData for file uploads
    const formData = new FormData();
    
    // Add form data
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    
    // Add uploaded files
    Object.entries(uploadedFiles).forEach(([fieldName, files]) => {
      files.forEach(file => {
        formData.append(fieldName, file);
      });
    });

    const result = await registerUser(formData, 'provider');

    if (result.success) {
      navigate('/provider/verification-pending');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Account Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input {...register('firstName')} />
                {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input {...register('lastName')} />
                {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input type="tel" {...register('phone')} />
              {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input type="password" {...register('password')} />
              {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Business Details</h3>
            
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input {...register('businessName')} />
              {errors.businessName && <p className="text-red-500 text-sm">{errors.businessName.message}</p>}
            </div>

            <div>
              <Label htmlFor="businessType">Business Type</Label>
              <Select onValueChange={(value) => setValue('businessType', value as 'individual' | 'company')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual/Sole Proprietor</SelectItem>
                  <SelectItem value="company">Company/LLC</SelectItem>
                </SelectContent>
              </Select>
              {errors.businessType && <p className="text-red-500 text-sm">{errors.businessType.message}</p>}
            </div>

            <div>
              <Label htmlFor="businessDescription">Business Description</Label>
              <Textarea 
                {...register('businessDescription')} 
                placeholder="Describe your business, services, and what makes you unique..."
                rows={4}
              />
              {errors.businessDescription && <p className="text-red-500 text-sm">{errors.businessDescription.message}</p>}
            </div>

            <div>
              <Label htmlFor="yearsOfExperience">Years of Experience</Label>
              <Input 
                type="number" 
                {...register('yearsOfExperience', { valueAsNumber: true })} 
              />
              {errors.yearsOfExperience && <p className="text-red-500 text-sm">{errors.yearsOfExperience.message}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Services Offered</h3>
            
            <div>
              <Label htmlFor="primaryCategory">Primary Category</Label>
              <Select onValueChange={(value) => setValue('primaryCategory', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beauty">Beauty</SelectItem>
                  <SelectItem value="wellness">Wellness</SelectItem>
                  <SelectItem value="fitness">Fitness</SelectItem>
                  <SelectItem value="home-care">Home Care</SelectItem>
                  <SelectItem value="tutoring">Tutoring</SelectItem>
                </SelectContent>
              </Select>
              {errors.primaryCategory && <p className="text-red-500 text-sm">{errors.primaryCategory.message}</p>}
            </div>

            <div>
              <Label>Subcategories (Select all that apply)</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {/* This would be dynamically populated based on primaryCategory */}
                <div className="flex items-center space-x-2">
                  <Checkbox id="hair-styling" />
                  <Label htmlFor="hair-styling">Hair Styling</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="makeup" />
                  <Label htmlFor="makeup">Makeup</Label>
                </div>
                {/* Add more subcategories */}
              </div>
            </div>

            <div>
              <Label htmlFor="specializations">Specializations (Optional)</Label>
              <Input 
                placeholder="e.g., Bridal makeup, Color correction, etc."
                {...register('specializations.0')} 
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Business Location</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input {...register('businessAddress.street')} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input {...register('businessAddress.city')} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input {...register('businessAddress.state')} />
                </div>
              </div>
              
              <div>
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input {...register('businessAddress.zipCode')} />
              </div>
            </div>

            <div>
              <Label>Service Areas</Label>
              <p className="text-sm text-gray-600">Select areas where you provide services</p>
              {/* Service area selection component */}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox {...register('isMobile')} />
              <Label>I offer mobile services (travel to customer locations)</Label>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Verification Documents</h3>
            
            <div className="space-y-4">
              <div>
                <Label>Identity Document (Required)</Label>
                <p className="text-sm text-gray-600 mb-2">Driver's license, passport, or state ID</p>
                <Input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload('identityDocument', e.target.files)}
                />
              </div>

              <div>
                <Label>Business License (If applicable)</Label>
                <p className="text-sm text-gray-600 mb-2">Business license or professional certification</p>
                <Input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileUpload('businessLicense', e.target.files)}
                />
              </div>

              <div>
                <Label>Portfolio Images (Optional)</Label>
                <p className="text-sm text-gray-600 mb-2">Showcase your work (max 10 images)</p>
                <Input 
                  type="file" 
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileUpload('portfolioImages', e.target.files)}
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Terms & Agreements</h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox {...register('agreeToProviderTerms')} />
                <Label className="text-sm">
                  I agree to the{' '}
                  <Link to="/provider-terms" className="text-blue-600 hover:text-blue-500">
                    Provider Terms of Service
                  </Link>
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox {...register('agreeToCommissionStructure')} />
                <Label className="text-sm">
                  I understand and agree to the commission structure (15% per booking)
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox {...register('agreeToBackgroundCheck')} />
                <Label className="text-sm">
                  I consent to background verification checks
                </Label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Your application will be reviewed within 2-3 business days</li>
                <li>• You'll receive an email notification about the status</li>
                <li>• Once approved, you can start offering services</li>
                <li>• Background check may take additional time</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Become a Service Provider
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Join our platform and grow your business
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                  ${index <= currentStep 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-300 text-gray-600'
                  }
                `}>
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="ml-2 text-xs text-gray-600 hidden sm:block">
                  {step.title}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`
                    w-8 sm:w-12 h-1 mx-2
                    ${index < currentStep ? 'bg-blue-600' : 'bg-gray-300'}
                  `} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow px-6 py-8">
          <form onSubmit={handleSubmit(onSubmit)}>
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep === STEPS.length - 1 ? (
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={nextStep}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Login Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔑 Login Component

### **Step 5: Create Login Form**
**File**: `frontend/src/components/auth/LoginForm.tsx`

```typescript
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuthStore } from '../../stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

type LoginData = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const from = (location.state as any)?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginData) => {
    clearError();
    
    const result = await login(data.email, data.password);
    
    if (result.success) {
      // Navigate to intended page or dashboard
      navigate(result.redirectPath || from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Email */}
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="mt-1 relative">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-red-300' : ''}
                placeholder="Enter your email"
              />
              <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="mt-1 relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                className={errors.password ? 'border-red-300' : ''}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute right-3 top-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Forgot your password?
            </Link>
          </div>

          {/* Submit Button */}
          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </div>

          {/* Registration Links */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">
                  Don't have an account?
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link to="/register/customer">
                <Button variant="outline" className="w-full">
                  Join as Customer
                </Button>
              </Link>
              <Link to="/register/provider">
                <Button variant="outline" className="w-full">
                  Become a Provider
                </Button>
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
```

---

## 📧 Email Verification Components

### **Step 6: Create Email Verification Flow**
**File**: `frontend/src/components/auth/EmailVerification.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuthStore } from '../../stores/authStore';

export const EmailVerification: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { verifyEmail, isLoading, error } = useAuthStore();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (token) {
      handleVerification();
    }
  }, [token]);

  const handleVerification = async () => {
    if (!token) return;

    const result = await verifyEmail(token);
    setVerificationStatus(result.success ? 'success' : 'error');

    if (result.success) {
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/customer/dashboard');
      }, 3000);
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Verifying your email...
            </h2>
            <p className="mt-2 text-gray-600">
              Please wait while we verify your email address.
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Email verified successfully!
            </h2>
            <p className="mt-2 text-gray-600">
              Your email address has been verified. You'll be redirected to your dashboard shortly.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/customer/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-600" />
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Verification failed
            </h2>
            <p className="mt-2 text-gray-600">
              {error || 'The verification link may have expired or is invalid.'}
            </p>
            <div className="mt-6 space-y-3">
              <Button onClick={() => navigate('/resend-verification')}>
                Resend Verification Email
              </Button>
              <div>
                <Link
                  to="/login"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow px-6 py-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// Email Verification Required Page
export const EmailVerificationRequired: React.FC = () => {
  const { user, resendVerification, isLoading } = useAuthStore();
  const [emailSent, setEmailSent] = useState(false);

  const handleResendEmail = async () => {
    if (!user?.email) return;

    const result = await resendVerification(user.email);
    if (result.success) {
      setEmailSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow px-6 py-8">
          <div className="text-center">
            <Mail className="mx-auto h-12 w-12 text-yellow-600" />
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Verify your email address
            </h2>
            <p className="mt-2 text-gray-600">
              We've sent a verification email to{' '}
              <span className="font-medium">{user?.email}</span>. Please check your inbox and click the verification link.
            </p>

            {emailSent ? (
              <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                Verification email sent! Please check your inbox.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-gray-500">
                  Didn't receive the email?
                </p>
                <Button
                  onClick={handleResendEmail}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Resend verification email'
                  )}
                </Button>
              </div>
            )}

            <div className="mt-6">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔄 Password Reset Components

### **Step 7: Create Password Reset Flow**
**File**: `frontend/src/components/auth/PasswordReset.tsx`

```typescript
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuthStore } from '../../stores/authStore';

// Forgot Password Component
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword: React.FC = () => {
  const { forgotPassword, isLoading, error, clearError } = useAuthStore();
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    clearError();
    
    const result = await forgotPassword(data.email);
    if (result.success) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow px-6 py-8">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-6 text-2xl font-bold text-gray-900">
                Check your email
              </h2>
              <p className="mt-2 text-gray-600">
                We've sent password reset instructions to your email address.
              </p>
              <div className="mt-6">
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Reset your password
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="mt-1 relative">
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  className={errors.email ? 'border-red-300' : ''}
                  placeholder="Enter your email address"
                />
                <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send reset instructions'
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Reset Password Component
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema)
  });

  const onSubmit = async (data: ResetPasswordData) => {
    if (!token) return;

    clearError();
    
    const result = await resetPassword(token, data.password);
    if (result.success) {
      setResetSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow px-6 py-8">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-6 text-2xl font-bold text-gray-900">
                Password reset successful
              </h2>
              <p className="mt-2 text-gray-600">
                Your password has been reset successfully. You'll be redirected to the login page shortly.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/login')} className="w-full">
                  Go to Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Set new password
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Choose a strong password for your account.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="password">New Password</Label>
              <div className="mt-1 relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className={errors.password ? 'border-red-300' : ''}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="mt-1 relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  className={errors.confirmPassword ? 'border-red-300' : ''}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
```

---

## 📊 Dashboard Components

### **Step 8: Create Role-Specific Dashboards**
**File**: `frontend/src/components/dashboard/CustomerDashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Star, 
  MapPin, 
  Search, 
  Heart,
  CreditCard,
  User,
  Bell,
  TrendingUp
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuthStore } from '../../stores/authStore';

interface UpcomingBooking {
  id: string;
  serviceName: string;
  providerName: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'completed';
}

interface RecommendedProvider {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  distance: string;
  avatar: string;
}

export const CustomerDashboard: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [recommendedProviders, setRecommendedProviders] = useState<RecommendedProvider[]>([]);

  useEffect(() => {
    // Load dashboard data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // This would fetch real data from your API
    setUpcomingBookings([
      {
        id: '1',
        serviceName: 'Hair Styling',
        providerName: 'Sarah Johnson',
        date: '2024-01-15',
        time: '2:00 PM',
        status: 'confirmed'
      },
      {
        id: '2',
        serviceName: 'Home Cleaning',
        providerName: 'Clean Pro Services',
        date: '2024-01-18',
        time: '10:00 AM',
        status: 'pending'
      }
    ]);

    setRecommendedProviders([
      {
        id: '1',
        name: 'Emma Wilson',
        category: 'Massage Therapy',
        rating: 4.8,
        reviewCount: 127,
        distance: '0.8 miles',
        avatar: '/api/placeholder/60/60'
      },
      {
        id: '2',
        name: 'Mike Rodriguez',
        category: 'Personal Training',
        rating: 4.9,
        reviewCount: 203,
        distance: '1.2 miles',
        avatar: '/api/placeholder/60/60'
      }
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.firstName}!
              </h1>
              <p className="text-gray-600">
                Ready to book your next service?
              </p>
            </div>
            <div className="flex space-x-3">
              <Button>
                <Search className="h-4 w-4 mr-2" />
                Find Services
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold">{(profile as any)?.stats?.totalBookings || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold">${(profile as any)?.stats?.totalSpent || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Loyalty Points</p>
                  <p className="text-2xl font-bold">{(profile as any)?.loyaltyPoints?.available || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Heart className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Favorites</p>
                  <p className="text-2xl font-bold">{(profile as any)?.favoriteProviders?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Bookings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Upcoming Bookings</h3>
                <Link to="/customer/bookings">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingBookings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingBookings.map(booking => (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Calendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">{booking.serviceName}</p>
                          <p className="text-sm text-gray-600">{booking.providerName}</p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>{booking.date}</span>
                            <span>•</span>
                            <span>{booking.time}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming bookings</h3>
                  <p className="mt-1 text-sm text-gray-500">Start by exploring our services</p>
                  <div className="mt-6">
                    <Link to="/services">
                      <Button>Browse Services</Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommended Providers */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Recommended for You</h3>
                <Link to="/services">
                  <Button variant="outline" size="sm">Explore More</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendedProviders.map(provider => (
                  <div key={provider.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <img
                        src={provider.avatar}
                        alt={provider.name}
                        className="h-10 w-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-sm text-gray-600">{provider.category}</p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-400 mr-1" />
                            <span>{provider.rating}</span>
                            <span>({provider.reviewCount})</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span>{provider.distance}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Link to={`/providers/${provider.id}`}>
                      <Button size="sm">View Profile</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <h3 className="text-lg font-medium">Quick Actions</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link to="/customer/search">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <Search className="h-6 w-6 mb-2" />
                  <span className="text-sm">Find Services</span>
                </Button>
              </Link>
              
              <Link to="/customer/favorites">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <Heart className="h-6 w-6 mb-2" />
                  <span className="text-sm">My Favorites</span>
                </Button>
              </Link>
              
              <Link to="/customer/loyalty">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <TrendingUp className="h-6 w-6 mb-2" />
                  <span className="text-sm">Loyalty Rewards</span>
                </Button>
              </Link>
              
              <Link to="/customer/profile">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <User className="h-6 w-6 mb-2" />
                  <span className="text-sm">My Profile</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

---

## 🔌 API Service Integration

### **Step 9: Create Auth API Service**
**File**: `frontend/src/services/auth.api.ts`

```typescript
import api from './api';

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isEmailVerified: boolean;
    isActive: boolean;
    avatar?: string;
  };
  redirectPath: string;
}

export interface RegisterResponse {
  message: string;
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isEmailVerified: boolean;
  };
}

export interface CurrentUserResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    isEmailVerified: boolean;
    isActive: boolean;
    avatar?: string;
    bio?: string;
    createdAt: string;
  };
  profile: any;
}

export const authApi = {
  // Login
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Customer Registration
  registerCustomer: async (data: any): Promise<RegisterResponse> => {
    const response = await api.post('/auth/register/customer', data);
    return response.data;
  },

  // Provider Registration
  registerProvider: async (formData: FormData): Promise<RegisterResponse> => {
    const response = await api.post('/auth/register/provider', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get Current User
  getCurrentUser: async (): Promise<CurrentUserResponse> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Update Profile
  updateProfile: async (data: any): Promise<any> => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  // Change Password
  changePassword: async (currentPassword: string, newPassword: string): Promise<any> => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  // Email Verification
  verifyEmail: async (token: string): Promise<any> => {
    const response = await api.get(`/auth/verify-email/${token}`);
    return response.data;
  },

  // Resend Verification Email
  resendVerification: async (email: string): Promise<any> => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  // Forgot Password
  forgotPassword: async (email: string): Promise<any> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Reset Password
  resetPassword: async (token: string, password: string): Promise<any> => {
    const response = await api.post(`/auth/reset-password/${token}`, { password });
    return response.data;
  },

  // Logout
  logout: async (): Promise<any> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // Refresh Token
  refreshToken: async (): Promise<any> => {
    const response = await api.post('/auth/refresh-token');
    return response.data;
  }
};
```

---

## 🧪 Testing Setup

### **Step 10: Create Component Tests**
**File**: `frontend/src/__tests__/auth/LoginForm.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { useAuthStore } from '../../stores/authStore';

// Mock the auth store
jest.mock('../../stores/authStore');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('LoginForm', () => {
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      profile: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: jest.fn(),
      register: jest.fn(),
      getCurrentUser: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      clearError: mockClearError,
      setLoading: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn()
    });

    mockLogin.mockClear();
    mockClearError.mockClear();
  });

  it('renders login form', () => {
    renderWithRouter(<LoginForm />);
    
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderWithRouter(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    renderWithRouter(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('calls login function with correct data on valid submission', async () => {
    mockLogin.mockResolvedValue({ success: true, redirectPath: '/customer/dashboard' });
    
    renderWithRouter(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Password123!');
    });
  });

  it('toggles password visibility', () => {
    renderWithRouter(<LoginForm />);
    
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button

    expect(passwordInput.type).toBe('password');
    
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');
    
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  it('displays error message when login fails', () => {
    mockUseAuthStore.mockReturnValue({
      ...mockUseAuthStore(),
      error: 'Invalid credentials'
    });

    renderWithRouter(<LoginForm />);
    
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('shows loading state during login', () => {
    mockUseAuthStore.mockReturnValue({
      ...mockUseAuthStore(),
      isLoading: true
    });

    renderWithRouter(<LoginForm />);
    
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });
});
```

---

## 🔧 Implementation Commands

### **Step 11: Install Frontend Dependencies**
**Package.json additions**:

```json
{
  "dependencies": {
    "zustand": "^4.4.1",
    "react-hook-form": "^7.45.4",
    "@hookform/resolvers": "^3.3.1",
    "zod": "^3.22.2",
    "axios": "^1.5.0",
    "react-router-dom": "^6.15.0",
    "lucide-react": "^0.279.0"
  },
  "devDependencies": {
    "@testing-library/react": "^13.4.0",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/user-event": "^14.4.3",
    "jest": "^29.6.4"
  }
}
```

### **Step 12: Router Configuration**
**File**: `frontend/src/App.tsx`

```typescript
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Auth Components
import { LoginForm } from './components/auth/LoginForm';
import { CustomerRegistration } from './components/auth/CustomerRegistration';
import { ProviderRegistration } from './components/auth/ProviderRegistration';
import { EmailVerification, EmailVerificationRequired } from './components/auth/EmailVerification';
import { ForgotPassword, ResetPassword } from './components/auth/PasswordReset';

// Protected Route Components
import { ProtectedRoute, CustomerRoute, ProviderRoute, AdminRoute, PublicRoute } from './components/auth/ProtectedRoute';

// Dashboard Components
import { CustomerDashboard } from './components/dashboard/CustomerDashboard';
import { ProviderDashboard } from './components/dashboard/ProviderDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';

// Other Components
import { HomePage } from './components/HomePage';
import { UnauthorizedPage } from './components/UnauthorizedPage';
import { NotFoundPage } from './components/NotFoundPage';

function App() {
  const { getCurrentUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize authentication state
    if (localStorage.getItem('token')) {
      getCurrentUser();
    }
  }, [getCurrentUser]);

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          
          {/* Auth Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginForm />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register/customer" 
            element={
              <PublicRoute>
                <CustomerRegistration />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register/provider" 
            element={
              <PublicRoute>
                <ProviderRegistration />
              </PublicRoute>
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            } 
          />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<EmailVerification />} />
          <Route path="/verify-email-required" element={<EmailVerificationRequired />} />

          {/* Customer Routes */}
          <Route 
            path="/customer/dashboard" 
            element={
              <CustomerRoute>
                <CustomerDashboard />
              </CustomerRoute>
            } 
          />

          {/* Provider Routes */}
          <Route 
            path="/provider/dashboard" 
            element={
              <ProviderRoute>
                <ProviderDashboard />
              </ProviderRoute>
            } 
          />

          {/* Admin Routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />

          {/* Error Pages */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

---

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install zustand react-hook-form @hookform/resolvers zod axios react-router-dom lucide-react

# Install dev dependencies
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Start development server
npm run dev

# Run tests
npm run test
```

This comprehensive frontend implementation guide provides all the components, state management, routing, and testing needed for a complete authentication system that integrates perfectly with the backend implementation.