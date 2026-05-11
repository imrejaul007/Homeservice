// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    refresh: '/auth/refresh-token',
    verify: '/auth/verify-email',
  },

  // Search & Services
  search: {
    services: '/search/services',
    suggestions: '/search/suggestions',
    trending: '/search/trending',
    filters: '/search/filters',
    popular: '/search/popular',
    category: '/search/category',
    service: '/search/service',
  },

  // User Management
  users: {
    profile: '/users/profile',
    update: '/users/profile',
    delete: '/users/profile',
  },

  // Provider Management
  providers: {
    profile: '/providers/profile',
    services: '/providers/services',
    bookings: '/providers/bookings',
  },

  // Bookings (future)
  bookings: {
    create: '/bookings',
    list: '/bookings',
    details: '/bookings',
    cancel: '/bookings',
  },

  // Payments (future)
  payments: {
    create: '/payments',
    confirm: '/payments/confirm',
    refund: '/payments/refund',
  },

  // Admin endpoints
  admin: {
    providers: {
      pending: '/admin/providers/pending',
      stats: '/admin/providers/stats',
      details: '/admin/providers',
      approve: '/admin/providers',
      reject: '/admin/providers',
    },
  },

  // Other endpoints
  health: '/health',
  test: '/test',
};

export const API_TIMEOUT = 30000; // 30 seconds
export const RETRY_COUNT = 3;

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  API_TIMEOUT,
  RETRY_COUNT,
};