import type {
  User,
  CustomerProfile,
  ProviderProfile,
  AuthTokens,
  LoginCredentials,
  RegisterCustomerData,
  RegisterProviderData
} from '../stores/authStore';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  profile?: CustomerProfile | ProviderProfile;
}

export interface RegisterResponse {
  user: User;
  tokens: AuthTokens;
  profile: CustomerProfile | ProviderProfile;
}

export interface UserResponse {
  user: User;
  profile?: CustomerProfile | ProviderProfile;
}

// Request interceptor types
export interface RequestConfig extends RequestInit {
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class AuthAPIService {
  private baseURL: string;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  }

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

  private updateStoredTokens(tokens: AuthTokens): void {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.state.tokens = tokens;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    } catch (error) {
      console.error('Failed to update stored tokens:', error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if not skipped and available
    if (!options.skipAuth) {
      const tokens = this.getStoredTokens();
      if (tokens?.accessToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${tokens.accessToken}`,
        };
      }
    }

    try {
      const response = await fetch(url, config);
      
      // Handle 401 unauthorized - token might be expired
      if (response.status === 401 && !options.skipAuth && endpoint !== '/auth/refresh-token') {
        try {
          await this.handleTokenRefresh();
          // Retry the original request with new token
          return this.request<T>(endpoint, options);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          this.clearAuth();
          throw new Error('Authentication expired. Please log in again.');
        }
      }

      const data = await response.json().catch(() => ({
        success: false,
        message: 'Invalid response format',
      }));

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  private async handleTokenRefresh(): Promise<void> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    const tokens = this.getStoredTokens();
    
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.request<{ tokens: AuthTokens }>('/auth/refresh-token', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: tokens.refreshToken,
        }),
        skipAuth: true,
      });

      if (response.success && response.data.tokens) {
        this.updateStoredTokens(response.data.tokens);
      } else {
        throw new Error('Invalid refresh response');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  private clearAuth(): void {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.state = {
          ...parsed.state,
          user: null,
          customerProfile: null,
          providerProfile: null,
          tokens: null,
          isAuthenticated: false,
        };
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  // File upload helper
  private createFormData(data: any, files?: FormData): FormData {
    const formData = files || new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return formData;
  }

  // Authentication Methods
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      skipAuth: true,
    });
  }

  async registerCustomer(data: RegisterCustomerData): Promise<ApiResponse<RegisterResponse>> {
    return this.request<RegisterResponse>('/auth/register/customer', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  }

  async registerProvider(data: RegisterProviderData, files?: FormData): Promise<ApiResponse<RegisterResponse>> {
    if (files) {
      const formData = this.createFormData(data, files);
      return this.request<RegisterResponse>('/auth/register/provider', {
        method: 'POST',
        body: formData,
        headers: {}, // Remove Content-Type to let browser set it for FormData
        skipAuth: true,
      });
    } else {
      return this.request<RegisterResponse>('/auth/register/provider', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });
    }
  }

  async getCurrentUser(): Promise<ApiResponse<UserResponse>> {
    return this.request<UserResponse>('/auth/me');
  }

  async updateProfile(data: Partial<User>, files?: FormData): Promise<ApiResponse<UserResponse>> {
    if (files) {
      const formData = this.createFormData(data, files);
      return this.request<UserResponse>('/auth/me', {
        method: 'PATCH',
        body: formData,
        headers: {},
      });
    } else {
      return this.request<UserResponse>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    }
  }

  async logout(): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/logout', {
      method: 'POST',
    });
  }

  async logoutAll(): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/logout-all', {
      method: 'POST',
    });
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  }

  async resetPassword(token: string, password: string, confirmPassword: string): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        password,
        confirmPassword,
      }),
      skipAuth: true,
    });
  }

  async verifyEmail(token: string): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      skipAuth: true,
    });
  }

  async resendVerification(email: string): Promise<ApiResponse<{}>> {
    return this.request<{}>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  }

  async refreshToken(): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    return this.request<{ tokens: AuthTokens }>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken: tokens.refreshToken,
      }),
      skipAuth: true,
    });
  }

  // Health check
  async checkAuthHealth(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/auth/health', {
      method: 'GET',
      skipAuth: true,
    });
  }

  // Utility methods for token management
  isTokenExpiring(minutes: number = 5): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens?.expiresAt) return true;
    
    const expiryTime = new Date(tokens.expiresAt);
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + (minutes * 60 * 1000));
    
    return expiryTime <= thresholdTime;
  }

  isTokenExpired(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens?.expiresAt) return true;
    
    return new Date(tokens.expiresAt) <= new Date();
  }

  getTokenTimeRemaining(): number {
    const tokens = this.getStoredTokens();
    if (!tokens?.expiresAt) return 0;
    
    const expiryTime = new Date(tokens.expiresAt);
    const now = new Date();
    
    return Math.max(0, expiryTime.getTime() - now.getTime());
  }

  // Development helpers
  async testConnection(): Promise<boolean> {
    try {
      await this.checkAuthHealth();
      return true;
    } catch (error) {
      console.error('Auth API connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const authAPI = new AuthAPIService();

// Export types
export type { AuthAPIService };
export default authAPI;