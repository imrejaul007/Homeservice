import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import type { SearchResultItem, QuickAction, SearchResultType } from '@/types/globalSearch';

// ============================================
// ICON COMPONENTS (inline to avoid circular deps)
// ============================================

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const UserCogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="15" r="3"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M10 15H6"/>
    <path d="M6 4l-2 2v2"/>
    <path d="M14 7h4"/>
    <path d="M18 7v2"/>
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
    <line x1="16" x2="16" y1="2" y2="6"/>
    <line x1="8" x2="8" y1="2" y2="6"/>
    <line x1="3" x2="21" y1="10" y2="10"/>
  </svg>
);

const BriefcaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const UserPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" x2="19" y1="8" y2="14"/>
    <line x1="22" x2="16" y1="11" y2="11"/>
  </svg>
);

const CalendarPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
    <line x1="16" x2="16" y1="2" y2="6"/>
    <line x1="8" x2="8" y1="2" y2="6"/>
    <line x1="3" x2="21" y1="10" y2="10"/>
    <line x1="19" x2="19" y1="16" y2="22"/>
    <line x1="16" x2="22" y1="19" y2="19"/>
  </svg>
);

// ============================================
// TYPES
// ============================================

interface CustomerResult {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  accountStatus?: string;
}

interface ProviderResult {
  _id: string;
  businessName: string;
  email: string;
  phone?: string;
  verificationStatus?: { overall: string };
}

interface BookingResult {
  _id: string;
  bookingNumber?: string;
  customerId?: { firstName: string; lastName: string; email: string };
  providerId?: { businessName: string };
  serviceId?: { name: string };
  status?: string;
}

interface ServiceResult {
  _id: string;
  name: string;
  provider?: { businessName: string };
  category?: string;
  status?: string;
}

interface DisputeResult {
  _id: string;
  disputeNumber?: string;
  bookingId?: { bookingNumber?: string };
  customerId?: { firstName: string; lastName: string };
  providerId?: { businessName: string };
  status?: string;
}

interface UseGlobalSearchOptions {
  minLength?: number;
  maxResultsPerType?: number;
  debounceMs?: number;
  enabled?: boolean;
}

// Parallel per-entity search endpoints (no unified /api/admin/search).

const searchCustomers = async (
  query: string,
  signal?: AbortSignal
): Promise<CustomerResult[]> => {
  const response = await api.get('/admin/customers/search', {
    params: { q: query, limit: 10 },
    signal,
  });
  return response.data.data?.customers || [];
};

const searchProviders = async (
  query: string,
  signal?: AbortSignal
): Promise<ProviderResult[]> => {
  const response = await api.get('/admin/providers/search', {
    params: { q: query, limit: 10 },
    signal,
  });
  return response.data.data?.providers || [];
};

const searchBookings = async (
  query: string,
  signal?: AbortSignal
): Promise<BookingResult[]> => {
  const response = await api.get('/admin/bookings/search', {
    params: { q: query, limit: 10 },
    signal,
  });
  return response.data.data?.bookings || [];
};

const searchServices = async (
  query: string,
  signal?: AbortSignal
): Promise<ServiceResult[]> => {
  const response = await api.get('/admin/services/search', {
    params: { q: query, limit: 10 },
    signal,
  });
  return response.data.data?.services || [];
};

const searchDisputes = async (
  query: string,
  signal?: AbortSignal
): Promise<DisputeResult[]> => {
  const response = await api.get('/admin/disputes/search', {
    params: { q: query, limit: 10 },
    signal,
  });
  return response.data.data?.disputes || [];
};

// ============================================
// TRANSFORMERS
// ============================================

const transformCustomer = (customer: CustomerResult): SearchResultItem => ({
  id: `customer-${customer._id}`,
  type: 'customer',
  title: `${customer.firstName} ${customer.lastName}`.trim(),
  subtitle: customer.email,
  meta: customer.phone || customer.accountStatus,
  href: `/admin/customers?search=${encodeURIComponent(customer.email || customer._id)}`,
});

const transformProvider = (provider: ProviderResult): SearchResultItem => ({
  id: `provider-${provider._id}`,
  type: 'provider',
  title: provider.businessName,
  subtitle: provider.email,
  meta: provider.verificationStatus?.overall || provider.phone,
  href: `/admin/providers?search=${encodeURIComponent(provider.businessName || provider.email || provider._id)}`,
});

const transformBooking = (booking: BookingResult): SearchResultItem => ({
  id: `booking-${booking._id}`,
  type: 'booking',
  title: booking.bookingNumber || booking._id.slice(-8).toUpperCase(),
  subtitle: [
    booking.customerId && `${booking.customerId.firstName} ${booking.customerId.lastName}`,
    booking.providerId && booking.providerId.businessName,
  ]
    .filter(Boolean)
    .join(' • '),
  meta: booking.serviceId?.name || booking.status,
  href: `/admin/bookings?search=${encodeURIComponent(booking.bookingNumber || booking._id)}`,
});

const transformService = (service: ServiceResult): SearchResultItem => ({
  id: `service-${service._id}`,
  type: 'service',
  title: service.name,
  subtitle: service.provider?.businessName || service.category || '',
  meta: service.status,
  href: `/admin/providers?search=${encodeURIComponent(service.name || service._id)}`,
});

const transformDispute = (dispute: DisputeResult): SearchResultItem => ({
  id: `dispute-${dispute._id}`,
  type: 'dispute',
  title: dispute.disputeNumber || dispute._id.slice(-8).toUpperCase(),
  subtitle: [
    dispute.customerId && `${dispute.customerId.firstName} ${dispute.customerId.lastName}`,
    dispute.providerId && dispute.providerId.businessName,
  ]
    .filter(Boolean)
    .join(' vs '),
  meta: dispute.status,
  href: `/admin/disputes?search=${encodeURIComponent(dispute.disputeNumber || dispute._id)}`,
});

// ============================================
// CUSTOM HOOK
// ============================================

export function useGlobalSearch(
  query: string,
  options: UseGlobalSearchOptions = {}
) {
  const {
    minLength = 2,
    maxResultsPerType = 10,
    enabled = true,
  } = options;

  const navigate = useNavigate();

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const groupedResults = useMemo(() => {
    const grouped: Record<SearchResultType, SearchResultItem[]> = {
      customer: [],
      provider: [],
      booking: [],
      service: [],
      dispute: [],
    };

    results.forEach((result) => {
      if (grouped[result.type]) {
        grouped[result.type].push(result);
      }
    });

    return grouped;
  }, [results]);

  const totalResults = useMemo(() => results.length, [results]);

  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [];
    const encodedQuery = encodeURIComponent(query);

    const isIdPattern = /^[a-f0-9]{24}$/i.test(query) ||
                        /^\d+$/.test(query) ||
                        /^#?\w{3,}$/i.test(query);

    if (isIdPattern) {
      const id = query.replace(/^#/, '');

      actions.push(
        {
          id: 'go-customer',
          label: `Go to Customer ${id}`,
          description: 'Search customers for this ID',
          icon: <UsersIcon />,
          action: () => navigate(`/admin/customers?search=${encodeURIComponent(id)}`),
        },
        {
          id: 'go-provider',
          label: `Go to Provider ${id}`,
          description: 'Search providers for this ID',
          icon: <UserCogIcon />,
          action: () => navigate(`/admin/providers?search=${encodeURIComponent(id)}`),
        },
        {
          id: 'go-booking',
          label: `Go to Booking ${id}`,
          description: 'Search bookings for this ID',
          icon: <CalendarIcon />,
          action: () => navigate(`/admin/bookings?search=${encodeURIComponent(id)}`),
        }
      );
    }

    actions.push(
      {
        id: 'search-customers',
        label: `Search customers for "${query}"`,
        description: 'View all customer search results',
        icon: <UsersIcon />,
        action: () => navigate(`/admin/customers?search=${encodedQuery}`),
      },
      {
        id: 'search-providers',
        label: `Search providers for "${query}"`,
        description: 'View all provider search results',
        icon: <UserCogIcon />,
        action: () => navigate(`/admin/providers?search=${encodedQuery}`),
      },
      {
        id: 'search-bookings',
        label: `Search bookings for "${query}"`,
        description: 'View all booking search results',
        icon: <CalendarIcon />,
        action: () => navigate(`/admin/bookings?search=${encodedQuery}`),
      },
      {
        id: 'new-customer',
        label: 'Open customer management',
        description: 'Manage customers in admin',
        icon: <UserPlusIcon />,
        action: () => navigate('/admin/customers'),
      },
      {
        id: 'new-booking',
        label: 'Open booking management',
        description: 'Manage bookings in admin',
        icon: <CalendarPlusIcon />,
        action: () => navigate('/admin/bookings'),
      }
    );

    return actions;
  }, [query, navigate]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < minLength) {
      setResults([]);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const [customers, providers, bookings, services, disputes] = await Promise.allSettled([
        searchCustomers(searchQuery, abortControllerRef.current.signal),
        searchProviders(searchQuery, abortControllerRef.current.signal),
        searchBookings(searchQuery, abortControllerRef.current.signal),
        searchServices(searchQuery, abortControllerRef.current.signal),
        searchDisputes(searchQuery, abortControllerRef.current.signal),
      ]);

      const items: SearchResultItem[] = [];

      if (customers.status === 'fulfilled') {
        items.push(...customers.value.slice(0, maxResultsPerType).map(transformCustomer));
      }
      if (providers.status === 'fulfilled') {
        items.push(...providers.value.slice(0, maxResultsPerType).map(transformProvider));
      }
      if (bookings.status === 'fulfilled') {
        items.push(...bookings.value.slice(0, maxResultsPerType).map(transformBooking));
      }
      if (services.status === 'fulfilled') {
        items.push(...services.value.slice(0, maxResultsPerType).map(transformService));
      }
      if (disputes.status === 'fulfilled') {
        items.push(...disputes.value.slice(0, maxResultsPerType).map(transformDispute));
      }

      setResults(items);

      const failedSearches = [
        customers.status === 'rejected' && 'customers',
        providers.status === 'rejected' && 'providers',
        bookings.status === 'rejected' && 'bookings',
        services.status === 'rejected' && 'services',
        disputes.status === 'rejected' && 'disputes',
      ].filter(Boolean);

      if (failedSearches.length > 0) {
        console.warn(`Global search partial failure: ${failedSearches.join(', ')}`);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Search failed. Please try again.');
        console.error('Global search error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [minLength, maxResultsPerType]);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, enabled, performSearch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    results,
    groupedResults,
    totalResults,
    isLoading,
    error,
    quickActions,
    clearResults,
    refresh: () => performSearch(query),
  };
}

export default useGlobalSearch;
