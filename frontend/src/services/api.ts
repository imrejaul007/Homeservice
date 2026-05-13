import axios, { type AxiosInstance, type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { sanitizeHtml, secureStorage, isSecureContext } from '@/lib/security';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Error types
export interface ApiError {
  success: false;
  message: string;
  error?: string;
  statusCode?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// Get auth tokens from sessionStorage (same as authStore for consistency)
// Using sessionStorage for improved security - tokens don't persist beyond current tab
const getAuthTokens = () => {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const tokens = parsed?.state?.tokens;

    if (tokens?.accessToken && tokens?.refreshToken) {
      return tokens;
    }
    return null;
  } catch {
    return null;
  }
};

// Update auth tokens - also save to sessionStorage
const updateAuthTokens = (tokens: { accessToken: string; refreshToken: string }) => {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    const parsed = stored ? JSON.parse(stored) : { state: {} };
    parsed.state.tokens = tokens;
    sessionStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch {
    // Silent fail
  }
};

// Clear auth
const clearAuth = () => {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state) {
        parsed.state.tokens = null;
        parsed.state.isAuthenticated = false;
        sessionStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    }
  } catch {
    // Silent fail
  }
};

// Generate correlation ID for request tracing
const generateCorrelationId = () => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Create axios instance with security configurations
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Initialize default auth header from stored tokens
const initAuthHeader = () => {
  const tokens = getAuthTokens();
  if (tokens?.accessToken) {
    api.defaults.headers.common.Authorization = `Bearer ${tokens.accessToken}`;
  }
};

// Call initialization after api is created
initAuthHeader();

// Token refresh management
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((callback) => callback(token));
  refreshSubscribers = [];
};

// Retry logic for failed requests
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error: AxiosError): boolean => {
  if (!error.config) return false;

  // Don't retry on 4xx errors (except 429 - Too Many Requests)
  if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
    return false;
  }

  // Retry on network errors or 5xx errors
  return !error.response || error.response.status >= 500 || error.response.status === 429;
};

const retryRequest = async (config: InternalAxiosRequestConfig, retryCount: number = 0): Promise<Response> => {
  if (retryCount >= MAX_RETRIES) {
    throw new Error('Max retries exceeded');
  }

  await sleep(RETRY_DELAY * Math.pow(2, retryCount)); // Exponential backoff

  return axios(config).then((response) => response.data);
};

// Request interceptor - Add auth token and correlation ID
api.interceptors.request.use(
  (config) => {
    // Add correlation ID for request tracing
    const correlationId = generateCorrelationId();
    config.headers['X-Correlation-ID'] = correlationId;

    // Add auth token if available
    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    // Sanitize URL params (basic XSS prevention)
    if (config.url) {
      config.url = sanitizeHtml(config.url);
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh, errors, and retries
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Sanitize response data if it's HTML content
    if (typeof response.data === 'string' && response.data.includes('<html')) {
      console.warn('Unexpected HTML response received');
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    // Log the error for debugging (sanitized)
    console.error('API Error:', {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message,
      correlationId: originalRequest?.headers?.['X-Correlation-ID'],
    });

    // Handle network errors with retry
    if (!error.response && shouldRetry(error)) {
      const retryCount = (originalRequest._retryCount || 0) + 1;
      originalRequest._retryCount = retryCount;

      if (retryCount <= MAX_RETRIES) {
        console.log(`Retrying request (${retryCount}/${MAX_RETRIES})...`);
        return retryRequest(originalRequest, retryCount);
      }
    }

    // Handle 401 Unauthorized - Token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const tokens = getAuthTokens();
        if (tokens?.refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken: tokens.refreshToken,
          });

          const newTokens = response.data.data.tokens;
          updateAuthTokens(newTokens);

          api.defaults.headers.common.Authorization = `Bearer ${newTokens.accessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          onRefreshed(newTokens.accessToken);

          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        clearAuth();

        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired';
        }
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      const message = (error.response.data as ApiError)?.message || 'Access denied';
      console.error('Access forbidden:', message);
    }

    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limited. Retry after ${retryAfter || 'unknown'} seconds`);
    }

    // Handle 500 Internal Server Error
    if (error.response?.status && error.response.status >= 500) {
      console.error('Server error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

// API service with typed methods
export const apiService = {
  // Health check
  checkHealth: async (): Promise<{ status: string; service: string }> => {
    const baseUrl = API_URL.replace('/api', '');
    const response = await axios.get(`${baseUrl}/health`);
    return response.data;
  },

  // Readiness check
  checkReadiness: async (): Promise<{ status: string; ready: boolean }> => {
    const baseUrl = API_URL.replace('/api', '');
    const response = await axios.get(`${baseUrl}/health/ready`);
    return response.data;
  },

  // Test API connection
  testConnection: async (): Promise<ApiResponse> => {
    const response = await api.get('/test');
    return response.data;
  },

  // Verify services
  verifyServices: async (): Promise<{
    success: boolean;
    services?: {
      database?: { status: string; details?: string };
      external?: {
        cloudinary?: { status: string; message?: string };
        stripe?: { status: string; message?: string; details?: string };
        email?: { status: string; message?: string; details?: string };
      };
    };
  }> => {
    const response = await api.get('/verify');
    return response.data;
  },

  // Admin services
  admin: {
    getPendingProviders: async (params?: { page?: number; limit?: number; search?: string }) => {
      const response = await api.get('/admin/providers/pending', { params });
      return response.data;
    },

    getProviderDetails: async (id: string) => {
      const response = await api.get(`/admin/providers/${id}`);
      return response.data;
    },

    approveProvider: async (id: string, notes?: string) => {
      const response = await api.post(`/admin/providers/${id}/approve`, { notes });
      return response.data;
    },

    rejectProvider: async (id: string, reason: string, notes?: string) => {
      const response = await api.post(`/admin/providers/${id}/reject`, { reason, notes });
      return response.data;
    },

    getVerificationStats: async () => {
      const response = await api.get('/admin/providers/stats');
      return response.data;
    },
  },

  // Payment services
  payment: {
    createPaymentIntent: async (bookingId: string) => {
      const response = await api.post('/payments/create-intent', { bookingId });
      return response.data;
    },

    getPaymentStatus: async (bookingId: string) => {
      const response = await api.get(`/payments/status/${bookingId}`);
      return response.data;
    },

    createRefund: async (bookingId: string, amount?: number) => {
      const response = await api.post(`/payments/refund/${bookingId}`, { amount });
      return response.data;
    },
  },
};

// Export typed API instance
export { api };

// Default export
export default apiService;
