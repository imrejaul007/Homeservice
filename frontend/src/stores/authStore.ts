import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AuthResponse, AuthTokens, AuthUser, LoginCredentials, RegisterData } from '../services/AuthService';
import { ApiError, Requires2FAError } from '../services/AuthService';
import type { BusinessInfo, LocationInfo, ServiceInput } from '../types/auth';
import { secureStorage } from '@/lib/security';
import { socketService } from '../services/socket';
import logger from '../lib/logger';

// WeakMap to track in-flight getCurrentUser promises per store instance
const getCurrentUserPromises = new WeakMap<object, Promise<void>>();

async function refreshFeatureFlagsForUser(userId?: string): Promise<void> {
  try {
    const { featureFlags } = await import('../services/marketplace/FeatureFlags');
    await featureFlags.loadFromServer(userId);
  } catch (error) {
    logger.warn('Failed to refresh feature flags', error);
  }
}

/** Connect socket when user is authenticated (no-op if already connected). */
async function connectAuthenticatedSocket(): Promise<void> {
  try {
    if (!socketService.isConnected()) {
      await socketService.connect();
    }
  } catch (error) {
    logger.warn('[Auth] Socket connect failed', error);
  }
}

/**
 * Custom zustand storage adapter that uses secureStorage
 * This provides XSS protection by not exposing tokens in raw sessionStorage
 */
const secureAuthStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return secureStorage.getItem(name);
    } catch (error) {
      console.error('secureAuthStorage.getItem error:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      secureStorage.setItem(name, value);
    } catch (error) {
      // Handle QuotaExceededError gracefully
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Attempting to clear old data...');
        // Try to clear non-essential storage and retry once
        try {
          if (typeof localStorage !== 'undefined') {
            // Clear non-critical localStorage items
            const keysToKeep = ['auth-storage', 'nilin-preferences'];
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && !keysToKeep.some(k => key.includes(k))) {
                localStorage.removeItem(key);
              }
            }
          }
          secureStorage.setItem(name, value);
        } catch (retryError) {
          console.error('Failed to save after clearing storage:', retryError);
        }
      } else {
        console.error('secureAuthStorage.setItem error:', error);
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      secureStorage.removeItem(name);
    } catch (error) {
      console.error('secureAuthStorage.removeItem error:', error);
    }
  },
};

// Re-export types for backward compatibility
export type User = AuthUser;
export type { AuthTokens, LoginCredentials };

// Legacy type compatibility
export interface RegisterCustomerData extends RegisterData {
  role: 'customer';
}

export interface RegisterProviderData extends RegisterData {
  role: 'provider';
  businessInfo?: BusinessInfo;
  locationInfo?: LocationInfo;
  services?: ServiceInput[];
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
  // Add ratings property for average rating given by customer
  ratings?: {
    averageRatingGiven: number;
    totalRatingsGiven: number;
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
  // Additional properties
  bio?: string;
  serviceCategories?: string[];
  yearsExperience?: number;
  serviceAreas?: string[];
  isVerified?: boolean;
  // Analytics & Earnings
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
    // Historical data for trends
    previousEarnings?: number;
    previousBookings?: number;
    previousViews?: number;
    totalBookings?: number;
    customerMetrics?: {
      repeatCustomers?: number;
      totalCustomers?: number;
    };
  };
  // Settings properties
  businessSettings?: {
    autoAcceptBookings?: boolean;
    maxAdvanceBookingDays?: number;
    minBookingNoticeHours?: number;
    cancellationPolicyHours?: number;
  };
  locationInfo?: {
    serviceAreas?: Array<{
      city: string;
      state: string;
      zipCode?: string;
      coordinates?: { lat: number; lng: number };
    }>;
  };
  privacySettings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showReviewsPublicly?: boolean;
  };
}

export interface AuthError {
  message: string;
  code: string;
  field?: string;
  status?: number;
  data?: Record<string, unknown>;
}

export interface AuthState {
  // State
  user: User | null;
  customerProfile: CustomerProfile | null;
  providerProfile: ProviderProfile | null;
  tokens: AuthTokens | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  errors: AuthError[];

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  verifyLogin2FA: (preAuthToken: string, code: string) => Promise<void>;
  registerCustomer: (data: RegisterCustomerData) => Promise<void>;
  registerProvider: (data: RegisterProviderData, files?: FormData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  clearAuth: () => void;
  getCurrentUser: () => Promise<void>;
  updateProfile: (data: Partial<User>, files?: FormData) => Promise<void>;
  updateAvatar: (avatarUrl: string) => void;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  forgotPassword: (email: string, captchaToken?: string) => Promise<void>;
  resetPassword: (token: string, password: string, confirmPassword: string, captchaToken?: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string, captchaToken?: string) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearErrors: () => void;
  setError: (error: AuthError) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;

  // New method for AuthService integration
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User | null) => void;
  setCustomerProfile: (profile: CustomerProfile | null) => void;
  setProviderProfile: (profile: ProviderProfile | null) => void;
  refreshProviderProfile: () => Promise<void>;
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
      sessionId: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      errors: [],

      // Actions - All delegate to AuthService for single source of truth
      login: async (credentials: LoginCredentials) => {
        const authService = (await import('../services/AuthService')).default;
        const { Requires2FAError } = await import('../services/AuthService');

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await authService.login(credentials);
          const loggedInUser = response.data.user;

          set((state) => {
            state.user = loggedInUser;
            state.tokens = response.data.tokens ?? null;
            state.sessionId = response.data.sessionId ?? null;
            state.isAuthenticated = Boolean(response.data.tokens?.accessToken);
            state.isLoading = false;

            if (loggedInUser.role === 'customer' && response.data.customerProfile) {
              state.customerProfile = response.data.customerProfile;
            } else if (loggedInUser.role === 'provider' && response.data.providerProfile) {
              state.providerProfile = response.data.providerProfile;
            }
          });
          await refreshFeatureFlagsForUser(loggedInUser.id || loggedInUser._id);
          await connectAuthenticatedSocket();
        } catch (error) {
          if (error instanceof Requires2FAError) {
            set((state) => {
              state.isLoading = false;
            });
            throw error;
          }
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

      verifyLogin2FA: async (preAuthToken: string, code: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await authService.verifyLogin2FA(preAuthToken, code);
          const loggedInUser = response.data.user;

          set((state) => {
            state.user = loggedInUser;
            state.tokens = response.data.tokens ?? null;
            state.sessionId = response.data.sessionId ?? null;
            state.isAuthenticated = Boolean(response.data.tokens?.accessToken);
            state.isLoading = false;

            if (loggedInUser.role === 'customer' && response.data.customerProfile) {
              state.customerProfile = response.data.customerProfile;
            } else if (loggedInUser.role === 'provider' && response.data.providerProfile) {
              state.providerProfile = response.data.providerProfile;
            }
          });
          await refreshFeatureFlagsForUser(loggedInUser.id || loggedInUser._id);
          await connectAuthenticatedSocket();
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Two-factor verification failed',
              code: 'LOGIN_2FA_ERROR'
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
            state.customerProfile = response.data.customerProfile ?? null;
            state.isAuthenticated = true;
            state.isLoading = false;
          });
          await connectAuthenticatedSocket();
        } catch (err: unknown) {
          // Preserve the ApiError structure so components can access status and data
          const error = err instanceof ApiError ? err : ApiError.fromAxios(err);
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error.message,
              code: error.code || 'REGISTER_ERROR',
              status: error.status,
              data: error.data
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
            const response = await authService.uploadFile<{
              success: boolean;
              data: { user: AuthUser; tokens: AuthTokens; providerProfile: ProviderProfile | null };
            }>(
              '/auth/register/provider',
              formData
            );

            const payload = response.data ?? response;

            set((state) => {
              state.user = payload.user;
              state.tokens = payload.tokens;
              state.providerProfile = payload.providerProfile ?? null;
              state.isAuthenticated = true;
              state.isLoading = false;
            });
            await connectAuthenticatedSocket();
            return;
          }

          const response = await authService.register(finalData);

          set((state) => {
            state.user = response.data.user;
            state.tokens = response.data.tokens;
            state.providerProfile = response.data.providerProfile ?? null;
            state.isAuthenticated = true;
            state.isLoading = false;
          });
          await connectAuthenticatedSocket();
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
          // Cleanup event listener before clearing state
          store._cleanupTokenListener?.();

          // FIX 6: Disconnect socket on logout to prevent memory leaks and stale connections
          // Guard against race condition: check socketService exists and is connected
          if (socketService && typeof socketService.disconnect === 'function') {
            try {
              // Clear pending events before disconnect to prevent race condition
              socketService.disconnect();
              logger.info('[Auth] Socket disconnected on logout');
            } catch (socketError) {
              console.error('Socket disconnect error:', socketError);
            }
          }

          set((state) => {
            state.user = null;
            state.customerProfile = null;
            state.providerProfile = null;
            state.tokens = null;
            state.sessionId = null;
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
          // Cleanup event listener before clearing state
          store._cleanupTokenListener?.();

          // FIX 6: Disconnect socket on logout to prevent memory leaks and stale connections
          // Guard against race condition: check socketService exists and is connected
          if (socketService && typeof socketService.disconnect === 'function') {
            try {
              // Clear pending events before disconnect to prevent race condition
              socketService.disconnect();
              logger.info('[Auth] Socket disconnected on logout all');
            } catch (socketError) {
              console.error('Socket disconnect error:', socketError);
            }
          }

          set((state) => {
            state.user = null;
            state.customerProfile = null;
            state.providerProfile = null;
            state.tokens = null;
            state.sessionId = null;
            state.isAuthenticated = false;
            state.errors = [];
          });
        }
      },

      clearAuth: () => {
        // Cleanup event listener before clearing state
        store._cleanupTokenListener?.();

        set((state) => {
          state.user = null;
          state.customerProfile = null;
          state.providerProfile = null;
          state.tokens = null;
          state.sessionId = null;
          state.isAuthenticated = false;
          state.errors = [];
        });
      },

      getCurrentUser: async () => {
        // Use WeakMap to track in-flight promise for this specific store instance
        const existingPromise = getCurrentUserPromises.get(store);
        if (existingPromise) {
          return existingPromise;
        }

        const newPromise = (async () => {
          const authService = (await import('../services/AuthService')).default;

          try {
            const response = await authService.getCurrentUser();
            const currentUser = response.data.user;

            set((state) => {
              state.user = currentUser;

              if (currentUser.role === 'customer' && response.data.customerProfile) {
                state.customerProfile = response.data.customerProfile;
              } else if (currentUser.role === 'provider' && response.data.providerProfile) {
                state.providerProfile = response.data.providerProfile;
              }
            });

            await refreshFeatureFlagsForUser(currentUser.id || currentUser._id);
          } catch (error) {
            console.error('Get current user error:', error);
          } finally {
            getCurrentUserPromises.delete(store);
          }
        })();

        getCurrentUserPromises.set(store, newPromise);
        return newPromise;
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

            response = await authService.uploadFile<{ user: AuthUser }>('/auth/me', formData);
          } else {
            response = await authService.updateProfile(data);
          }

          set((state) => {
            state.user = response.data.user;
            state.isLoading = false;
          });

          // Refresh user and providerProfile if user is a provider
          const currentUser = get().user;
          if (currentUser?.role === 'provider') {
            try {
              await get().getCurrentUser();
            } catch (profileError) {
              console.error('Failed to refresh providerProfile:', profileError);
            }
          }
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

      forgotPassword: async (email: string, captchaToken?: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.forgotPassword(email, captchaToken);

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

      resetPassword: async (token: string, password: string, confirmPassword: string, captchaToken?: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.resetPassword(token, password, confirmPassword, captchaToken);

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

      resendVerification: async (email: string, captchaToken?: string) => {
        const authService = (await import('../services/AuthService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          await authService.resendVerification(email, captchaToken);

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

      refreshToken: async (): Promise<boolean> => {
        // This method handles manual token refresh
        // Returns true if refresh was successful, false otherwise
        const authService = (await import('../services/AuthService')).default;

        try {
          const tokens = get().tokens;
          if (!tokens?.refreshToken) {
            console.error('No refresh token available');
            return false;
          }

          // Call the refresh endpoint
          const response = await authService.post<AuthResponse<{ tokens: AuthTokens; user: AuthUser }>>('/auth/refresh-token', {
            refreshToken: tokens.refreshToken
          });

          if (response.data?.tokens) {
            // Update tokens in store
            set((state) => {
              state.tokens = response.data.tokens;
            });
            if (get().isAuthenticated) {
              await socketService.reconnect().catch((err) => {
                logger.warn('[Auth] Socket reconnect after token refresh failed', err);
              });
            }
            return true;
          }

          return false;
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Auto-logout handled by AuthService
          return false;
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
        const authService = (await import('../services/AuthService')).default;

        if (tokens?.accessToken) {
          if (!authService.isTokenValid() && tokens.refreshToken) {
            const refreshed = await get().refreshToken();
            if (!refreshed) {
              get().clearAuth();
              set((state) => {
                state.isInitialized = true;
              });
              return;
            }
          } else if (!authService.isTokenValid()) {
            get().clearAuth();
            set((state) => {
              state.isInitialized = true;
            });
            return;
          }

          try {
            // First try to get current user
            await get().getCurrentUser();
            set((state) => {
              state.isAuthenticated = true;
              state.isInitialized = true;
            });
            await connectAuthenticatedSocket();
          } catch (error: unknown) {
            console.error('Failed to initialize auth:', error);

            // FIX: Type-safe error handling for non-axios errors
            // Check if error is an axios error with response property
            const isAxiosError = error &&
              typeof error === 'object' &&
              'response' in error &&
              error.response !== undefined;

            // If it's a 401 and we have refresh token, try to refresh
            if (isAxiosError && (error as { response: { status?: number } }).response?.status === 401 && tokens?.refreshToken) {
              try {
                const authService = (await import('../services/AuthService')).default;
                const response = await authService.post<AuthResponse<{ tokens: AuthTokens }>>('/auth/refresh-token', {
                  refreshToken: tokens.refreshToken
                });

                const newTokens = response.data.tokens;
                set((state) => {
                  state.tokens = newTokens;
                });

                // Now try to get user again with new token
                await get().getCurrentUser();
                set((state) => {
                  state.isAuthenticated = true;
                  state.isInitialized = true;
                });
                await connectAuthenticatedSocket();
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
          await refreshFeatureFlagsForUser();
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

      updateAvatar: (avatarUrl: string) => {
        set((state) => {
          if (state.user) {
            state.user.avatar = avatarUrl;
          }
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

      refreshProviderProfile: async () => {
        await get().getCurrentUser();
      },

      // Token update handler reference for cleanup
      _tokenUpdateHandler: null as ((event: CustomEvent) => void) | null,
      _socketUnauthorizedHandler: null as (() => void) | null,
      _initTimerId: null as ReturnType<typeof setTimeout> | null,

      // Initialize event listener for token updates from API service
      _initTokenListener: () => {
        if (typeof window !== 'undefined') {
          // Remove existing listener if any (prevents duplicates)
          store._cleanupTokenListener?.();

          store._tokenUpdateHandler = ((event: CustomEvent) => {
            const newTokens = event.detail;
            if (newTokens) {
              set((state) => {
                state.tokens = newTokens;
              });
              if (get().isAuthenticated) {
                socketService.reconnect().catch((err) => {
                  logger.warn('[Auth] Socket reconnect after token update failed', err);
                });
              }
            }
          }) as (event: CustomEvent) => void;

          window.addEventListener('auth-tokens-updated', store._tokenUpdateHandler as EventListener);

          const handleSocketUnauthorized = async () => {
            const refreshed = await get().refreshToken();
            if (refreshed) {
              await socketService.reconnect().catch((err) => {
                logger.warn('[Auth] Socket reconnect after unauthorized failed', err);
              });
            }
          };
          window.addEventListener('socket:unauthorized', handleSocketUnauthorized);
          store._socketUnauthorizedHandler = handleSocketUnauthorized;
        }
      },

      // Cleanup event listener - call this on logout
      _cleanupTokenListener: () => {
        if (typeof window !== 'undefined' && store._tokenUpdateHandler) {
          window.removeEventListener('auth-tokens-updated', store._tokenUpdateHandler as EventListener);
          store._tokenUpdateHandler = null;
        }
        if (typeof window !== 'undefined' && store._socketUnauthorizedHandler) {
          window.removeEventListener('socket:unauthorized', store._socketUnauthorizedHandler);
          store._socketUnauthorizedHandler = null;
        }
        // Clear the init timer if it exists
        if (store._initTimerId !== null) {
          clearTimeout(store._initTimerId);
          store._initTimerId = null;
        }
      },
      };

      // Initialize token listener when store is created
      if (typeof window !== 'undefined') {
        store._initTimerId = setTimeout(() => {
          store._initTokenListener();
          store._initTimerId = null; // Clear reference after execution
        }, 0);
      }

      return store;
    }),
    {
      name: 'auth-storage',
      version: 2,
      // Use secure storage adapter that wraps secureStorage
      // This provides XSS protection by using encrypted storage
      storage: createJSONStorage(() => secureAuthStorage),
      partialize: (state) => ({
        user: state.user,
        customerProfile: state.customerProfile,
        providerProfile: state.providerProfile,
        tokens: state.tokens,
        sessionId: state.sessionId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Remove the old authenticatedFetch and authAPI exports
// These are now handled by the AuthService
export { useAuthStore as default };

// Selector exports for optimized re-renders
export const useAuthStoreUser = () => useAuthStore((state) => state.user);