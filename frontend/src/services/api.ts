import axios, { type AxiosInstance, type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { sanitizeHtml, secureStorage, isSecureContext } from '@/lib/security';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// CSRF token storage
let csrfToken: string | null = null;

// HTTP methods that require CSRF protection (state-changing operations)
const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Fetch CSRF token from server
const fetchCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await axios.get(`${API_URL}/auth/csrf-token`, {
      withCredentials: true,
    });
    return response.data?.csrfToken || null;
  } catch {
    return null;
  }
};

// Get CSRF token (from memory or fetch if not present)
const getCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) return csrfToken;

  // Try to get from cookie (where server sets it)
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='));
  if (csrfCookie) {
    csrfToken = csrfCookie.split('=')[1];
    return csrfToken;
  }

  // Fetch from server
  csrfToken = await fetchCsrfToken();
  return csrfToken;
};

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

// Get auth tokens from secure storage (same as authStore for consistency)
// Using secureStorage for improved XSS protection
const getAuthTokens = () => {
  try {
    const stored = secureStorage.getItem('auth-storage');
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

// Update auth tokens - also save to secure storage
const updateAuthTokens = (tokens: { accessToken: string; refreshToken: string }) => {
  try {
    const stored = secureStorage.getItem('auth-storage');
    const parsed = stored ? JSON.parse(stored) : { state: {} };
    parsed.state.tokens = tokens;
    secureStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch {
    // Silent fail
  }
};

// Clear auth
const clearAuth = () => {
  try {
    const stored = secureStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state) {
        parsed.state.tokens = null;
        parsed.state.isAuthenticated = false;
        secureStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    }
  } catch {
    // Silent fail
  }
  // Clear CSRF token on logout
  csrfToken = null;
};

// Refresh CSRF token (call after login or when token expires)
const refreshCsrfToken = async (): Promise<string | null> => {
  csrfToken = await fetchCsrfToken();
  return csrfToken;
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

// Token refresh management - FIX: Use Promise-based queue to prevent race conditions
let refreshPromise: Promise<string | null> | null = null;
let refreshPromiseResolve: ((token: string | null) => void) | null = null;

const getRefreshPromise = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = new Promise<string | null>((resolve) => {
      refreshPromiseResolve = resolve;
    });
  }
  return refreshPromise;
};

const resolveRefreshPromise = (token: string | null): void => {
  if (refreshPromiseResolve) {
    refreshPromiseResolve(token);
  }
  refreshPromise = null;
  refreshPromiseResolve = null;
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

// Request interceptor - Add auth token, correlation ID, and CSRF token
api.interceptors.request.use(
  async (config) => {
    // Add correlation ID for request tracing
    const correlationId = generateCorrelationId();
    config.headers['X-Correlation-ID'] = correlationId;

    // Add auth token if available
    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    // Add CSRF token for state-changing requests (mutations)
    const method = config.method?.toUpperCase();
    if (method && CSRF_PROTECTED_METHODS.includes(method)) {
      const token = await getCsrfToken();
      if (token) {
        config.headers['X-CSRF-Token'] = token;
      }
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

    // Log ALL errors for debugging including 404s
    const status = error.response?.status;
    console.error('[API ERROR]', {
      url: originalRequest?.url,
      status,
      statusText: error.response?.statusText,
      message: error.message,
      responseData: error.response?.data,
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

    // Maintenance mode — redirect non-admins to maintenance page
    if (error.response?.status === 503) {
      const data = error.response.data as { maintenanceMode?: boolean };
      if (data?.maintenanceMode && typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (!path.startsWith('/admin') && path !== '/maintenance' && path !== '/login') {
          window.location.href = '/maintenance';
        }
      }
    }

    // Handle 401 Unauthorized - Token refresh with proper Promise-based queue
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If a refresh is already in progress, wait for it
      if (refreshPromise) {
        return getRefreshPromise()
          .then((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            }
            // Refresh failed, redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/login?reason=session_expired';
            }
            return Promise.reject(error);
          })
          .catch(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/login?reason=session_expired';
            }
            return Promise.reject(error);
          });
      }

      // No refresh in progress, start one
      const tokens = getAuthTokens();
      if (!tokens?.refreshToken) {
        // No refresh token, redirect to login
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(error);
      }

      // Create refresh promise to prevent concurrent refresh attempts
      getRefreshPromise();

      try {
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken: tokens.refreshToken,
        }, {
          timeout: 10000, // 10 second timeout for refresh
        });

        const newTokens = response.data.data.tokens;
        updateAuthTokens(newTokens);

        api.defaults.headers.common.Authorization = `Bearer ${newTokens.accessToken}`;

        // Resolve waiting requests with the new token
        resolveRefreshPromise(newTokens.accessToken);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        clearAuth();

        // Reject all waiting requests
        resolveRefreshPromise(null);

        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(error);
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

// Export typed API instance and CSRF utilities
export { api, getCsrfToken, refreshCsrfToken, clearAuth };

// Default export
export default apiService;
