import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AuthTokens, AuthUser, LoginCredentials, RegisterData } from '../services/AuthService';

// Re-export types for backward compatibility
export type User = AuthUser;
export type { AuthTokens, LoginCredentials };

// Legacy type compatibility
export interface RegisterCustomerData extends RegisterData {
  role: 'customer';
}

export interface RegisterProviderData extends RegisterData {
  role: 'provider';
  businessInfo?: any;
  locationInfo?: any;
  services?: any[];
  [key: string]: any;
}

export interface CustomerProfile {
  _id: string;
  userId: string;
  preferences: {
    categories: string[];
    maxDistance: number;
    priceRange: {
      min: number;
      max: number;
    };
    preferredTimes: string[];
    autoBooking: boolean;
  };
  addresses: Array<{
    _id: string;
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    isDefault: boolean;
  }>;
  favoriteProviders: string[];
  bookingStats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowCount: number;
  };
  loyaltyPoints: {
    current: number;
    earned: number;
    redeemed: number;
    expiringPoints: {
      amount: number;
      expiryDate: string;
    };
  };
  // Add missing loyaltySystem property
  loyaltySystem: {
    points: number;
    tier: string;
    benefits: string[];
  };
}

export interface ProviderProfile {
  _id: string;
  userId: string;
  businessInfo: {
    businessName: string;
    businessType: 'individual' | 'small_business' | 'company' | 'franchise';
    description: string;
    tagline?: string;
    website?: string;
    establishedDate?: string;
  };
  verificationStatus: {
    overall: 'pending' | 'approved' | 'rejected' | 'suspended';
    documents: 'pending' | 'approved' | 'rejected';
    backgroundCheck: 'pending' | 'approved' | 'rejected';
    businessVerification: 'pending' | 'approved' | 'rejected';
  };
  services: Array<{
    _id: string;
    name: string;
    category: string;
    status: 'active' | 'inactive' | 'pending_review';
  }>;
  // Add missing properties for provider
  earnings?: {
    total: number;
    thisMonth: number;
    pending: number;
    totalEarned: number;
    availableBalance: number;
    pendingBalance: number;
  };
  ratings?: {
    average: number;
    count: number;
    distribution: { [key: number]: number };
  };
  analytics?: {
    views: number;
    bookings: number;
    completionRate: number;
    profileViews: number;
    repeatCustomers: number;
  };
}

export interface AuthError {
  message: string;
  code: string;
  field?: string;
}

export interface AuthState {
  // State
  user: User | null;
  customerProfile: CustomerProfile | null;
  providerProfile: ProviderProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  errors: AuthError[];

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  registerCustomer: (data: RegisterCustomerData) => Promise<void>;
  registerProvider: (data: RegisterProviderData, files?: FormData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  clearAuth: () => void;
  getCurrentUser: () => Promise<void>;
  updateProfile: (data: Partial<User>, files?: FormData) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  clearErrors: () => void;
  setError: (error: AuthError) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;

  // New method for AuthService integration
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User | null) => void;
  setCustomerProfile: (profile: CustomerProfile | null) => void;
  setProviderProfile: (profile: ProviderProfile | null) => void;
}

// Create the Zustand store with AuthService delegation
export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => {
      const store = {
      // Initial state
      user: null,
      customerProfile: null,
      providerProfile: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      errors: [],

      // Actions - All delegate to AuthService for single source of truth
      login: async (credentials: LoginCredentials) => {
        // Lazy import to avoid circular dependency
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await authService.login(credentials);

          set((state) => {
            state.user = response.data.user;
            state.tokens = response.data.tokens;
            state.isAuthenticated = true;
            state.isLoading = false;

            // Set role-specific profiles using correct property names
            if (response.data.user.role === 'customer' && response.data.customerProfile) {
              state.customerProfile = response.data.customerProfile;
            } else if (response.data.user.role === 'provider' && response.data.providerProfile) {
              state.providerProfile = response.data.providerProfile;
            }
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Login failed',
              code: 'LOGIN_ERROR'
            }];
          });
          throw error;
        }
      },

      registerCustomer: async (data: RegisterCustomerData) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await authService.register(data);

          set((state) => {
            state.user = response.data.user;
            state.tokens = response.data.tokens;
            state.customerProfile = response.data.customerProfile;
            state.isAuthenticated = true;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Registration failed',
              code: 'REGISTER_ERROR'
            }];
          });
          throw error;
        }
      },

      registerProvider: async (data: RegisterProviderData, files?: FormData) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          let finalData = data;

          // Handle file uploads if provided
          if (files) {
            // Create FormData with all the registration data
            const formData = new FormData();

            // Add registration data to FormData
            Object.entries(data).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                if (typeof value === 'object' && !(value instanceof File)) {
                  formData.append(key, JSON.stringify(value));
                } else {
                  formData.append(key, String(value));
                }
              }
            });

            // Add files
            for (const [key, file] of files.entries()) {
              formData.append(key, file);
            }

            // Use file upload method
            const response = await authService.uploadFile('/auth/register/provider', formData);

            set((state) => {
              state.user = (response as any).data.user;
              state.tokens = (response as any).data.tokens;
              state.providerProfile = (response as any).data.providerProfile;
              state.isAuthenticated = true;
              state.isLoading = false;
            });
            return;
          }

          const response = await authService.register(finalData);

          set((state) => {
            state.user = response.data.user;
            state.tokens = response.data.tokens;
            state.providerProfile = response.data.providerProfile;
            state.isAuthenticated = true;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Provider registration failed',
              code: 'REGISTER_PROVIDER_ERROR'
            }];
          });
          throw error;
        }
      },

      logout: async () => {
        const authService = (await import('../services/AuthService')).default;

        try {
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
          // Continue with local logout even if API fails
        } finally {
          set((state) => {
            state.user = null;
            state.customerProfile = null;
            state.providerProfile = null;
            state.tokens = null;
            state.isAuthenticated = false;
            state.errors = [];
          });
        }
      },

      logoutAll: async () => {
        const authService = (await import('../services/AuthService')).default;

        try {
          await authService.logoutAll();
        } catch (error) {
          console.error('Logout all error:', error);
        } finally {
          set((state) => {
            state.user = null;
            state.customerProfile = null;
            state.providerProfile = null;
            state.tokens = null;
            state.isAuthenticated = false;
            state.errors = [];
          });
        }
      },

      clearAuth: () => {
        set((state) => {
          state.user = null;
          state.customerProfile = null;
          state.providerProfile = null;
          state.tokens = null;
          state.isAuthenticated = false;
          state.errors = [];
        });
      },

      getCurrentUser: async () => {
        const authService = (await import('../services/AuthService')).default;

        try {
          const response = await authService.getCurrentUser();

          set((state) => {
            state.user = response.data.user;
            
            // Handle role-specific profiles using correct property names
            if (response.data.user.role === 'customer' && response.data.customerProfile) {
              state.customerProfile = response.data.customerProfile;
            } else if (response.data.user.role === 'provider' && response.data.providerProfile) {
              state.providerProfile = response.data.providerProfile;
            }
          });
        } catch (error) {
          console.error('Get current user error:', error);
          // Don't throw error, just log it
        }
      },

      updateProfile: async (data: Partial<User>, files?: FormData) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          let response;

          if (files) {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                formData.append(key, String(value));
              }
            });
            for (const [key, file] of files.entries()) {
              formData.append(key, file);
            }

            response = await authService.uploadFile('/auth/me', formData);
          } else {
            response = await authService.updateProfile(data);
          }

          set((state) => {
            state.user = (response as any).data.user;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Profile update failed',
              code: 'UPDATE_PROFILE_ERROR'
            }];
          });
          throw error;
        }
      },

      changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.changePassword(currentPassword, newPassword, confirmPassword);

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Password change failed',
              code: 'CHANGE_PASSWORD_ERROR'
            }];
          });
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.forgotPassword(email);

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Password reset request failed',
              code: 'FORGOT_PASSWORD_ERROR'
            }];
          });
          throw error;
        }
      },

      resetPassword: async (token: string, password: string, confirmPassword: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.resetPassword(token, password, confirmPassword);

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Password reset failed',
              code: 'RESET_PASSWORD_ERROR'
            }];
          });
          throw error;
        }
      },

      verifyEmail: async (token: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.verifyEmail(token);

          // Refresh user data after verification
          await get().getCurrentUser();

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Email verification failed',
              code: 'EMAIL_VERIFICATION_ERROR'
            }];
          });
          throw error;
        }
      },

      resendVerification: async (email: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.resendVerification(email);

          set((state) => {
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to resend verification',
              code: 'RESEND_VERIFICATION_ERROR'
            }];
          });
          throw error;
        }
      },

      refreshToken: async () => {
        // This is now handled automatically by AuthService interceptors
        // But we keep this method for backward compatibility
        const authService = (await import('../services/AuthService')).default;

        try {
          // AuthService handles refresh automatically through interceptors
          // This method can be used for manual refresh if needed
          const tokens = get().tokens;
          if (tokens?.refreshToken) {
            await authService.post('/auth/refresh-token', {
              refreshToken: tokens.refreshToken
            });
          }
        } catch (error) {
          // Auto-logout handled by AuthService
          throw error;
        }
      },

      clearErrors: () => {
        set((state) => {
          state.errors = [];
        });
      },

      setError: (error: AuthError) => {
        set((state) => {
          state.errors = [error];
        });
      },

      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      initialize: async () => {
        const tokens = get().tokens;

        if (tokens?.accessToken) {
          try {
            // First try to get current user
            await get().getCurrentUser();
            set((state) => {
              state.isAuthenticated = true;
              state.isInitialized = true;
            });
          } catch (error: any) {
            console.error('Failed to initialize auth:', error);

            // If it's a 401 and we have refresh token, try to refresh
            if (error?.response?.status === 401 && tokens?.refreshToken) {
              try {
                const authService = (await import('../services/AuthService')).default;
                const response = await authService.post('/auth/refresh-token', {
                  refreshToken: tokens.refreshToken
                });

                const newTokens = (response as any).data.tokens;
                set((state) => {
                  state.tokens = newTokens;
                });

                // Now try to get user again with new token
                await get().getCurrentUser();
                set((state) => {
                  state.isAuthenticated = true;
                  state.isInitialized = true;
                });
                return;
              } catch (refreshError) {
                console.error('Token refresh failed during init:', refreshError);
              }
            }

            // Only clear tokens if refresh also failed
            set((state) => {
              state.tokens = null;
              state.isAuthenticated = false;
              state.isInitialized = true;
              state.user = null;
              state.customerProfile = null;
              state.providerProfile = null;
            });
          }
        } else {
          set((state) => {
            state.isInitialized = true;
          });
        }
      },

      // New methods for AuthService integration
      setTokens: (tokens: AuthTokens) => {
        set((state) => {
          state.tokens = tokens;
        });
      },

      setUser: (user: User | null) => {
        set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
        });
      },

      setCustomerProfile: (profile: CustomerProfile | null) => {
        set((state) => {
          state.customerProfile = profile;
        });
      },

      setProviderProfile: (profile: ProviderProfile | null) => {
        set((state) => {
          state.providerProfile = profile;
        });
      },

      // Initialize event listener for token updates from API service
      _initTokenListener: () => {
        if (typeof window !== 'undefined') {
          window.addEventListener('auth-tokens-updated', ((event: CustomEvent) => {
            const newTokens = event.detail;
            if (newTokens) {
              set((state) => {
                state.tokens = newTokens;
              });
            }
          }) as EventListener);
        }
      },
      };

      // Initialize token listener when store is created
      if (typeof window !== 'undefined') {
        setTimeout(() => store._initTokenListener(), 0);
      }

      return store;
    }),
    {
      name: 'auth-storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        customerProfile: state.customerProfile,
        providerProfile: state.providerProfile,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Remove the old authenticatedFetch and authAPI exports
// These are now handled by the AuthService
export { useAuthStore as default };