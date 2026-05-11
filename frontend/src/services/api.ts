import axios from 'axios';
import type { AxiosInstance, AxiosError, AxiosResponse } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Get auth tokens from Zustand store
const getAuthTokens = () => {
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
};

// Update auth tokens in Zustand store
const updateAuthTokens = (tokens: any) => {
  try {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.state.tokens = tokens;
      localStorage.setItem('auth-storage', JSON.stringify(parsed));

      // Dispatch custom event to notify store of token update
      window.dispatchEvent(new CustomEvent('auth-tokens-updated', { detail: tokens }));
    }
  } catch (error) {
    console.error('Failed to update stored tokens:', error);
  }
};

// Clear auth from Zustand store
const clearAuth = () => {
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
};

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((callback) => callback(token));
  refreshSubscribers = [];
};

// Request interceptor - Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const tokens = getAuthTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh and errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
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

        // Redirect to homepage
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other error types
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response?.data);
    }

    if (error.response && error.response.status >= 500) {
      console.error('Server error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

// API service methods
export const apiService = {
  // Health check
  checkHealth: async () => {
    const response = await axios.get(`${API_URL.replace('/api', '')}/health`);
    return response.data;
  },

  // Test API connection
  testConnection: async () => {
    const response = await api.get('/test');
    return response.data;
  },

  // Verify all services
  verifyServices: async () => {
    const response = await api.get('/verify');
    return response.data;
  },

  // Verify database
  verifyDatabase: async () => {
    const response = await api.get('/verify/database');
    return response.data;
  },

  // Verify external services
  verifyCloudinary: async () => {
    const response = await api.get('/verify/cloudinary');
    return response.data;
  },

  verifyStripe: async () => {
    const response = await api.get('/verify/stripe');
    return response.data;
  },

  verifyEmail: async () => {
    const response = await api.get('/verify/email');
    return response.data;
  },

  // Admin services
  admin: {
    // Get pending providers for verification
    getPendingProviders: async (params?: { page?: number; limit?: number; search?: string }) => {
      const response = await api.get('/admin/providers/pending', { params });
      return response.data;
    },

    // Get provider details for verification
    getProviderDetails: async (id: string) => {
      const response = await api.get(`/admin/providers/${id}`);
      return response.data;
    },

    // Approve provider
    approveProvider: async (id: string, notes?: string) => {
      const response = await api.post(`/admin/providers/${id}/approve`, { notes });
      return response.data;
    },

    // Reject provider
    rejectProvider: async (id: string, reason: string, notes?: string) => {
      const response = await api.post(`/admin/providers/${id}/reject`, { reason, notes });
      return response.data;
    },

    // Get verification statistics
    getVerificationStats: async () => {
      const response = await api.get('/admin/providers/stats');
      return response.data;
    },
  },
};

export default api;