import axios from 'axios';
// Use simplified types to avoid bundling issues
import { useAuthStore } from '../stores/authStore';

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  name?: string; // Computed full name
  role: 'customer' | 'provider' | 'admin';
  isEmailVerified: boolean;
  accountStatus: string;
  loyaltySystem?: {
    points: number;
    tier: string;
    benefits: string[];
    totalCoins: number;
    currentStreak: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  role: 'customer' | 'provider';
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
  [key: string]: any; // For additional role-specific fields
}

export interface AuthResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  profile?: any;
  customerProfile?: any;
  providerProfile?: any;
  redirectUrl?: string;
  requiresEmailVerification?: boolean;
}

export interface RegisterResponse {
  user: AuthUser;
  tokens: AuthTokens;
  profile?: any;
  customerProfile?: any;
  providerProfile?: any;
}

/**
 * Unified Authentication Service - Single Source of Truth
 * Industry-grade authentication with automatic token refresh,
 * security monitoring, and comprehensive error handling.
 */
class AuthService {
  private httpClient: ReturnType<typeof axios.create>;
  private refreshPromise: Promise<void> | null = null;
  private isRefreshing = false;
  private isLoggingOut = false;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.httpClient = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      withCredentials: true,  // For httpOnly cookies
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    this.startTokenRefreshTimer();
  }

  /**
   * Setup request and response interceptors for automatic auth handling
   */
  private setupInterceptors(): void {
    // REQUEST INTERCEPTOR - Automatically add auth headers
    this.httpClient.interceptors.request.use(
      (config) => {
        const tokens = this.getStoredTokens();

        // Add authorization header if token exists and not explicitly skipped
        if (tokens?.accessToken && !config.headers?.skipAuth) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }

        // Add security headers
        config.headers['X-Requested-With'] = 'XMLHttpRequest';

        return config;
      },
      (error) => Promise.reject(error)
    );

    // RESPONSE INTERCEPTOR - Handle auth errors and automatic refresh
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error: any) => {
        const originalRequest = error.config as any;

        // Define public endpoints that should NEVER trigger token refresh
        const publicEndpoints = [
          '/auth/login',
          '/auth/register',
          '/auth/forgot-password',
          '/auth/reset-password',
          '/auth/verify-email',
          '/auth/resend-verification'
        ];

        // Check if this is a public endpoint
        const isPublicEndpoint = publicEndpoints.some(endpoint =>
          originalRequest.url?.includes(endpoint)
        );

        // Handle 401 Unauthorized with automatic token refresh
        // BUT ONLY for authenticated requests (not login, register, etc.)
        if (error.response?.status === 401 &&
            !originalRequest._retry &&
            !this.isLoggingOut &&
            !isPublicEndpoint &&
            !originalRequest.headers?.skipAuth) {

          // Prevent infinite retry loops for refresh and logout endpoints
          if (originalRequest.url?.includes('/auth/refresh-token') ||
              originalRequest.url?.includes('/auth/logout')) {
            console.error('Refresh token failed, logging out user');
            this.handleAuthFailure();
            return Promise.reject(error);
          }

          // Only attempt refresh if we actually have stored tokens
          const storedTokens = this.getStoredTokens();
          if (!storedTokens?.refreshToken) {
            console.log('No refresh token available, skipping token refresh');
            return Promise.reject(error);
          }

          // Mark request as retried to prevent infinite loops
          originalRequest._retry = true;

          try {
            // Attempt token refresh
            await this.refreshTokens();

            // Retry original request with new token
            const tokens = this.getStoredTokens();
            if (tokens?.accessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              return this.httpClient(originalRequest);
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            this.handleAuthFailure();
            return Promise.reject(refreshError);
          }
        }

        // Handle other error responses
        if (error.response?.status === 403) {
          console.error('Access forbidden:', error.response.data);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get stored authentication tokens from localStorage
   */
  private getStoredTokens(): AuthTokens | null {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.tokens || null;
      }
    } catch (error) {
      console.error('Failed to get stored tokens:', error);
    }
    return null;
  }

  /**
   * Update stored authentication tokens
   */
  private updateStoredTokens(tokens: AuthTokens): void {
    try {
      const authStore = useAuthStore.getState();
      authStore.setTokens(tokens);
    } catch (error) {
      console.error('Failed to update stored tokens:', error);
    }
  }

  /**
   * Refresh authentication tokens using refresh token
   */
  private async refreshTokens(): Promise<void> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (this.isRefreshing) {
      throw new Error('Token refresh already in progress');
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform actual token refresh operation
   */
  private async performTokenRefresh(): Promise<void> {
    const tokens = this.getStoredTokens();

    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Use axios directly to avoid interceptor loop
      const response = await axios.post<AuthResponse<{ tokens: AuthTokens }>>(
        `${this.httpClient.defaults.baseURL}/auth/refresh-token`,
        { refreshToken: tokens.refreshToken },
        {
          withCredentials: true,
          timeout: 10000
        }
      );

      if (response.data.success && response.data.data.tokens) {
        this.updateStoredTokens(response.data.data.tokens);
      } else {
        throw new Error('Invalid refresh response format');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Handle authentication failure by clearing data and redirecting
   */
  private handleAuthFailure(): void {
    try {
      // Don't trigger logout if we're already in the process of logging out
      if (this.isLoggingOut) {
        return;
      }
      
      const authStore = useAuthStore.getState();
      authStore.logout();

      // Redirect to homepage
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to handle auth failure:', error);
    }
  }

  /**
   * Clear local authentication data without calling API
   */
  private clearLocalAuth(): void {
    try {
      // Stop token refresh timer
      this.stopTokenRefreshTimer();

      const authStore = useAuthStore.getState();
      authStore.clearAuth();

      // Clear any localStorage auth data directly as backup
      localStorage.removeItem('auth-storage');

      // Clear any cookies
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      // Reset interceptor flags
      this.isRefreshing = false;
      this.refreshPromise = null;
      this.isLoggingOut = false;

      // Redirect to homepage after logout
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to clear local auth:', error);
    }
  }

  /**
   * Validate if current tokens are still valid
   */
  public isTokenValid(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens?.accessToken || !tokens?.expiresAt) {
      return false;
    }

    // Check if token expires within next minute
    const expirationTime = new Date(tokens.expiresAt).getTime();
    const currentTime = Date.now();
    const bufferTime = 60 * 1000; // 1 minute buffer

    return expirationTime > (currentTime + bufferTime);
  }

  /**
   * Decode JWT token to get expiration time
   */
  private decodeToken(token: string): { exp: number } | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if token needs refresh (within 24 hours of expiration)
   */
  private shouldRefreshToken(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens?.accessToken) {
      return false;
    }

    const decoded = this.decodeToken(tokens.accessToken);
    if (!decoded?.exp) {
      return false;
    }

    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours

    // Refresh if token expires within next 24 hours
    return (expirationTime - currentTime) < oneDayInMs;
  }

  /**
   * Start background timer to check and refresh tokens
   */
  private startTokenRefreshTimer(): void {
    // Clear any existing timer
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }

    // Check every hour if token needs refresh
    this.tokenRefreshTimer = setInterval(async () => {
      if (this.isAuthenticated() && this.shouldRefreshToken()) {
        try {
          console.log('Proactively refreshing token before expiration');
          await this.refreshTokens();
        } catch (error) {
          console.error('Proactive token refresh failed:', error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    // Also check immediately on startup
    setTimeout(async () => {
      if (this.isAuthenticated() && this.shouldRefreshToken()) {
        try {
          console.log('Checking token on startup - refreshing if needed');
          await this.refreshTokens();
        } catch (error) {
          console.error('Startup token refresh failed:', error);
        }
      }
    }, 1000); // Check 1 second after startup
  }

  /**
   * Stop token refresh timer
   */
  private stopTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  // ==========================================
  // PUBLIC AUTHENTICATION METHODS
  // ==========================================

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse<LoginResponse>> {
    try {
      const response = await this.httpClient.post<AuthResponse<LoginResponse>>(
        '/auth/login',
        credentials,
        { headers: { skipAuth: true } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Login failed');
      }
      throw error;
    }
  }

  /**
   * Register new user account
   */
  async register(data: RegisterData): Promise<AuthResponse<RegisterResponse>> {
    try {
      const endpoint = data.role === 'customer'
        ? '/auth/register/customer'
        : '/auth/register/provider';

      const response = await this.httpClient.post<AuthResponse<RegisterResponse>>(
        endpoint,
        data,
        { headers: { skipAuth: true } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Registration failed');
      }
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthResponse<{ user: AuthUser; profile?: any; customerProfile?: any; providerProfile?: any }>> {
    try {
      const response = await this.httpClient.get<AuthResponse<{ user: AuthUser; profile?: any }>>('/auth/me');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Failed to get user');
      }
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<AuthUser>): Promise<AuthResponse<{ user: AuthUser }>> {
    try {
      const response = await this.httpClient.patch<AuthResponse<{ user: AuthUser }>>('/auth/me', data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Failed to update profile');
      }
      throw error;
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(): Promise<void> {
    // Set flag to prevent token refresh during logout
    this.isLoggingOut = true;

    try {
      // Try to notify backend, but don't fail logout if this fails
      const tokens = this.getStoredTokens();
      if (tokens?.accessToken) {
        try {
          // Use direct axios call to bypass interceptors
          await axios.post(
            `${this.httpClient.defaults.baseURL}/auth/logout`,
            {},
            {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json'
              },
              withCredentials: true,
              timeout: 3000 // Shorter timeout for logout
            }
          );
        } catch (apiError) {
          console.log('Logout API call failed (continuing with local logout):', apiError);
          // Don't throw - continue with local logout
        }
      }
    } finally {
      // Always clean up locally regardless of API call success
      // This ensures logout always works even if backend is down
      this.clearLocalAuth();
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(): Promise<void> {
    // Set flag to prevent token refresh during logout
    this.isLoggingOut = true;

    try {
      // Try to notify backend, but don't fail logout if this fails
      const tokens = this.getStoredTokens();
      if (tokens?.accessToken) {
        try {
          // Use direct axios call to bypass interceptors
          await axios.post(
            `${this.httpClient.defaults.baseURL}/auth/logout-all`,
            {},
            {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json'
              },
              withCredentials: true,
              timeout: 3000 // Shorter timeout for logout
            }
          );
        } catch (apiError) {
          console.log('Logout all API call failed (continuing with local logout):', apiError);
          // Don't throw - continue with local logout
        }
      }
    } finally {
      // Always clean up locally regardless of API call success
      // This ensures logout always works even if backend is down
      this.clearLocalAuth();
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<AuthResponse<{}>> {
    try {
      const response = await this.httpClient.post<AuthResponse<{}>>('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Password change failed');
      }
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<AuthResponse<{}>> {
    try {
      const response = await this.httpClient.post<AuthResponse<{}>>('/auth/forgot-password',
        { email },
        { headers: { skipAuth: true } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Password reset request failed');
      }
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string, confirmPassword: string): Promise<AuthResponse<{}>> {
    try {
      const response = await this.httpClient.post<AuthResponse<{}>>('/auth/reset-password',
        { token, password, confirmPassword },
        { headers: { skipAuth: true } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Password reset failed');
      }
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<AuthResponse<{}>> {
    try {
      const response = await this.httpClient.post<AuthResponse<{}>>('/auth/verify-email',
        { token },
        { headers: { skipAuth: true } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Email verification failed');
      }
      throw error;
    }
  }

  /**
   * Resend email verification
   */
  async resendVerification(email: string): Promise<AuthResponse<{}>> {
    try {
      const response = await this.httpClient.post<AuthResponse<{}>>('/auth/resend-verification',
        { email },
        { headers: { skipAuth: true } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || 'Failed to resend verification');
      }
      throw error;
    }
  }

  // ==========================================
  // UNIFIED HTTP CLIENT METHODS
  // These replace both authAPI and authenticatedFetch
  // ==========================================

  /**
   * HTTP GET request with automatic auth handling
   */
  async get<T>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.httpClient.get<T>(url, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || `GET ${url} failed`);
      }
      throw error;
    }
  }

  /**
   * HTTP POST request with automatic auth handling
   */
  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.httpClient.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || `POST ${url} failed`);
      }
      throw error;
    }
  }

  /**
   * HTTP PUT request with automatic auth handling
   */
  async put<T>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.httpClient.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || `PUT ${url} failed`);
      }
      throw error;
    }
  }

  /**
   * HTTP PATCH request with automatic auth handling
   */
  async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.httpClient.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || `PATCH ${url} failed`);
      }
      throw error;
    }
  }

  /**
   * HTTP DELETE request with automatic auth handling
   */
  async delete<T>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.httpClient.delete<T>(url, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.message || `DELETE ${url} failed`);
      }
      throw error;
    }
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile<T>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    try {
      const response = await this.httpClient.post<T>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data;
        const message = data?.message || `Upload to ${url} failed`;
        // Include detailed validation errors if available
        const detailedErrors = data?.errors;
        if (detailedErrors && Array.isArray(detailedErrors)) {
          const details = detailedErrors.map((e: any) => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`${message} — ${details}`);
        }
        throw new Error(message);
      }
      throw error;
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Get the underlying axios instance for advanced usage
   */
  getHttpClient(): ReturnType<typeof axios.create> {
    return this.httpClient;
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    const authStore = useAuthStore.getState();
    return authStore.isAuthenticated && this.isTokenValid();
  }

  /**
   * Get current user from store
   */
  getCurrentUserFromStore(): AuthUser | null {
    const authStore = useAuthStore.getState();
    return authStore.user;
  }
}

// Export singleton instance - Single Source of Truth
export const authService = new AuthService();
export default authService;