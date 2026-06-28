import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Star,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Keyboard,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  CheckSquare,
  Square,
  X,
  Power,
  Trash,
  RotateCcw,
  Archive,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import { useToastActions } from '../common/Toast';
import { socketService } from '../../services/socket';
import { AddServiceModal } from './AddServiceModal';
import { EditServiceModal } from './EditServiceModal';
import { SkeletonCard, SkeletonServiceList } from './SkeletonCard';
import { SkeletonStatCard, SkeletonStatGrid, SkeletonPerformanceCard } from './SkeletonStatCard';
import { EmptyState, NoServicesEmpty, NoServicesSearchEmpty, NoTrashItemsEmpty } from '../common/EmptyState';
import { ConfirmModal } from '../common/ConfirmModal';

interface ServiceAnalyticsData {
  totalViews: number;
  totalClicks: number;
  totalBookings: number;
  conversionRate: number;
  bookingRate: number;
  popularityScore: number;
}

interface ServicesPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
}

interface Service {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  images: string[];
  tags: string[];
  location: {
    address: {
      city: string;
      state: string;
    };
  };
  rating: {
    average: number;
    count: number;
  };
  searchMetadata: {
    searchCount: number;
    clickCount: number;
    bookingCount: number;
    popularityScore: number;
  };
  status: 'draft' | 'active' | 'inactive' | 'pending_review' | 'rejected';
  isActive: boolean;
  isFeatured: boolean;
  durationOptions?: Array<{ duration: number; price: number; label: string }>;
  addOns?: Array<{ name: string; price: number; description?: string }>;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  rejectionReason?: string;
}

interface ServiceStats {
  total: number;
  active: number;
  draft: number;
  inactive: number;
  pending_review: number;
  rejected?: number;
}

interface StatusCounts {
  all: number;
  active: number;
  draft: number;
  inactive: number;
  pending_review: number;
  rejected?: number;
}

interface PerformanceStats {
  totalViews: number;
  totalClicks: number;
  totalBookings: number;
  conversionRate: number;
  bookingRate: number;
}

interface BookingStats {
  newBookings: number;
  pendingRequests: number;
  todaySchedule: number;
  completedThisMonth: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
  iconClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon: Icon,
  iconClass = 'bg-nilin-blush text-nilin-coral',
}) => (
  <div className="glass-nilin rounded-nilin-lg p-5 hover-lift border border-nilin-border/60">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-nilin-warmGray font-sans">{label}</p>
        <p className="text-2xl font-serif text-nilin-charcoal mt-1">{value}</p>
        {hint && <p className="text-xs text-nilin-lightGray mt-1 font-sans">{hint}</p>}
      </div>
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const inputClass =
  'w-full bg-white border border-nilin-border rounded-nilin px-4 py-2.5 text-nilin-charcoal placeholder:text-nilin-lightGray font-sans transition-all focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral disabled:bg-nilin-muted disabled:cursor-not-allowed';

const selectClass =
  'w-full bg-white border border-nilin-border rounded-nilin px-4 py-2.5 text-nilin-charcoal font-sans transition-all focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral appearance-none cursor-pointer';

// Stable ref pattern: always points to latest callback without causing effect re-runs
function useCallbackRef<T extends (...args: Parameters<T>) => ReturnType<T>>(callback: T): React.MutableRefObject<T> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return callbackRef;
}

const ServiceManagement: React.FC = () => {
  const { user, tokens, isAuthenticated } = useAuthStore();
  const toast = useToastActions();

  const userRole = user?.role;
  const isProvider = isAuthenticated && userRole === 'provider' && !!tokens?.accessToken;

  const [services, setServices] = useState<Service[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, 'idle' | 'success' | 'error'>>({});

  // Toast deduplication for error handling
  const lastToastTime = useRef<number>(0);
  const TOAST_COOLDOWN = 5000; // 5 seconds between error toasts

  // Enhanced error handling with network detection
  const showErrorToast = useCallback((title: string, description?: string) => {
    const now = Date.now();
    if (now - lastToastTime.current < TOAST_COOLDOWN) return;
    lastToastTime.current = now;
    toast.error(title, description ? { description } : undefined);
  }, [toast]);

  // Network error detection
  const isNetworkError = useCallback((err: unknown): boolean => {
    return !navigator.onLine ||
      err instanceof TypeError ||
      (err as { message?: string })?.message?.includes('NetworkError');
  }, []);

  // Handle fetch error with network detection and appropriate messaging
  const handleFetchError = useCallback((err: unknown, context: string) => {
    if (isNetworkError(err)) {
      showErrorToast('Connection error', 'Please check your internet connection and try again');
      return;
    }

    const status = (err as { response?: { status?: number } })?.response?.status;
    switch (status) {
      case 401: showErrorToast('Session expired', 'Please log in again'); break;
      case 403: showErrorToast('Access denied', 'You do not have permission'); break;
      case 404: showErrorToast('Not found', `${context} not found`); break;
      case 429: showErrorToast('Too many requests', 'Please wait before trying again'); break;
      case 500: showErrorToast('Server error', 'Please try again later'); break;
      default: showErrorToast('Error', err instanceof Error ? err.message : 'An error occurred');
    }
  }, [isNetworkError, showErrorToast]);

  // Retry mechanism for transient 5xx failures
  const fetchWithRetry = useCallback(async <T,>(
    fetchFn: () => Promise<T>,
    context: string,
    maxAttempts = 2
  ): Promise<T | null> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fetchFn();
      } catch (err) {
        lastError = err;
        const status = (err as { response?: { status?: number } })?.response?.status;
        const isRetryable = status === 0 || (status && status >= 500);

        if (!isRetryable || attempt === maxAttempts - 1) {
          handleFetchError(err, context);
          return null;
        }

        // Exponential backoff: 1s, 2s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    handleFetchError(lastError, context);
    return null;
  }, [handleFetchError]);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ServicesPagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Date Range Filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Category Filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Rating Filter
  const [ratingFilter, setRatingFilter] = useState<string>('any');

  // Price Range Filter
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  // Featured Filter
  const [featuredOnly, setFeaturedOnly] = useState<boolean>(false);

  // Stats
  const [serviceStats, setServiceStats] = useState<ServiceStats>({
    total: 0,
    active: 0,
    draft: 0,
    inactive: 0,
    pending_review: 0,
    rejected: 0,
  });

  // Status counts for filter dropdown
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    active: 0,
    draft: 0,
    inactive: 0,
    pending_review: 0,
    rejected: 0,
  });

  // All available categories from API
  const [allCategories, setAllCategories] = useState<string[]>([]);

  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    totalViews: 0,
    totalClicks: 0,
    totalBookings: 0,
    conversionRate: 0,
    bookingRate: 0
  });

  // Booking Stats
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    newBookings: 0,
    pendingRequests: 0,
    todaySchedule: 0,
    completedThisMonth: 0
  });

  // Add Service Modal State
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);

  // Edit Service Modal State
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isCloningService, setIsCloningService] = useState(false);

  // Analytics Modal State
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsService, setAnalyticsService] = useState<Service | null>(null);
  const [analyticsData, setAnalyticsData] = useState<ServiceAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [deletingServiceName, setDeletingServiceName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Status Toggle State (debounce/deduplication)
  const [isToggling, setIsToggling] = useState(false);
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);

  // Status Toggle Confirmation Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalService, setStatusModalService] = useState<{ id: string; name: string; currentStatus: string } | null>(null);

  // Keyboard Navigation State
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const serviceRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Export State
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Bulk Selection State
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // Trash View State
  const [trashCount, setTrashCount] = useState(0);
  const [isViewingTrash, setIsViewingTrash] = useState(false);
  const [deletedServices, setDeletedServices] = useState<Service[]>([]);
  const [deletedServicesLoading, setDeletedServicesLoading] = useState(false);
  const [deletedServicesError, setDeletedServicesError] = useState<string | null>(null);
  const [deletedPagination, setDeletedPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false
  });

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoringServiceId, setRestoringServiceId] = useState<string | null>(null);
  const [restoringServiceName, setRestoringServiceName] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Permanent Delete Modal State
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [permanentDeletingServiceId, setPermanentDeletingServiceId] = useState<string | null>(null);
  const [permanentDeletingServiceName, setPermanentDeletingServiceName] = useState<string>('');
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  // Accessibility: Status announcer for screen readers
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');

  useEffect(() => {
    setPage(1);
    // Clear selection when filters change
    setSelectedServices(new Set());
  }, [statusFilter, sortBy, sortOrder, startDate, endDate, categoryFilter, searchTerm, ratingFilter, minPrice, maxPrice, featuredOnly]);

  const fetchServices = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!isProvider) {
        return;
      }

      // Validate date range
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          toast.error('Invalid date range', { description: 'Start date must be before end date' });
          return;
        }
      }

      try {
        if (pageNum === 1 && !append) {
          setListLoading(true);
        } else {
          setListLoading(true);
        }
        setListError(null);

        const queryParams = new URLSearchParams({
          status: statusFilter,
          sortBy,
          order: sortOrder,
          limit: '20',
          page: String(pageNum),
        });

        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
        if (categoryFilter !== 'all') queryParams.append('category', categoryFilter);
        if (searchTerm) queryParams.append('search', searchTerm);
        if (ratingFilter !== 'any') queryParams.append('minRating', ratingFilter);
        if (minPrice) queryParams.append('minPrice', minPrice);
        if (maxPrice) queryParams.append('maxPrice', maxPrice);
        if (featuredOnly) queryParams.append('featured', 'true');

        const data = await authService.get<{
          success: boolean;
          data: { services: Service[]; pagination: ServicesPagination };
        }>(`/provider/services?${queryParams}`);

        if (!data.success) {
          throw new Error('Failed to fetch services');
        }

        setServices((prev) =>
          append && pageNum > 1 ? [...prev, ...data.data.services] : data.data.services
        );
        setPagination(data.data.pagination);
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Failed to fetch services');
        if (isNetworkError(err)) {
          showErrorToast('Connection error', 'Please check your internet connection and try again');
        } else {
          const status = (err as { response?: { status?: number } })?.response?.status;
          switch (status) {
            case 401: showErrorToast('Session expired', 'Please log in again'); break;
            case 403: showErrorToast('Access denied', 'You do not have permission'); break;
            case 404: showErrorToast('Not found', 'Services not found'); break;
            case 429: showErrorToast('Too many requests', 'Please wait before trying again'); break;
            case 500: showErrorToast('Server error', 'Please try again later'); break;
            default: showErrorToast('Failed to load services', err instanceof Error ? err.message : 'An error occurred');
          }
        }
      } finally {
        setListLoading(false);
      }
    },
    [
      isProvider,
      statusFilter,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      categoryFilter,
      searchTerm,
      ratingFilter,
      minPrice,
      maxPrice,
      featuredOnly,
      showErrorToast,
      isNetworkError,
    ]
  );

  const fetchOverviewStats = useCallback(async () => {
    if (!isProvider) return;

    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const data = await authService.get<{
        success: boolean,
        data: {
          overview: {
            serviceStats: ServiceStats;
            statusCounts: StatusCounts;
            performanceStats: PerformanceStats;
            bookingStats: BookingStats;
            categories: string[];
            allCategories: string[];
          }
        }
      }>('/provider/analytics');

      if (data.success) {
        setServiceStats(data.data.overview.serviceStats);
        const statusCounts = data.data.overview.statusCounts;
        if (statusCounts) {
          setStatusCounts(statusCounts);
        } else {
          const stats = data.data.overview.serviceStats;
          setStatusCounts({
            all: stats.total ?? 0,
            active: stats.active ?? 0,
            inactive: stats.inactive ?? 0,
            pending_review: stats.pending_review ?? 0,
            draft: stats.draft ?? 0,
            rejected: stats.rejected ?? 0,
          });
        }
        setPerformanceStats(data.data.overview.performanceStats);
        setBookingStats(data.data.overview.bookingStats);
        setAllCategories(data.data.overview.allCategories || []);
      }
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : 'Failed to load overview');
      handleFetchError(err, 'Overview');
    } finally {
      setOverviewLoading(false);
    }
  }, [isProvider, handleFetchError]);

  const fetchServicesRef = useCallbackRef(fetchServices);
  const fetchOverviewStatsRef = useCallbackRef(fetchOverviewStats);

  // Track component mount state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isProvider) return;

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        void fetchServicesRef.current(page, page > 1);
      }
    }, searchTerm ? 350 : 0);

    return () => clearTimeout(timer);
  }, [page, fetchServicesRef, isProvider, searchTerm]);

  // Initial fetch of overview stats
  useEffect(() => {
    if (!isProvider) {
      setListError('Please log in as a provider to access this page');
      setOverviewLoading(false);
      setListLoading(false);
      return;
    }

    void fetchOverviewStats();

    authService.get<{ success: boolean; data: { count: number } }>('/provider/services/trash/count')
      .then((data) => {
        if (data.success && isMountedRef.current) {
          setTrashCount(data.data.count);
        }
      })
      .catch(() => { /* non-critical */ });
  }, [isProvider, fetchOverviewStats]);

  // Socket listeners for real-time service status updates
  useEffect(() => {
    if (!isProvider) return;

    const unsubServiceApproved = socketService.onServiceApproved((data) => {
      if (isMountedRef.current) {
        toast.success('Service Approved', data.reason || 'Your service has been approved and is now active.');
        void fetchServicesRef.current(1, false);
        void fetchOverviewStatsRef.current();
      }
    });

    const unsubServiceRejected = socketService.onServiceRejected((data) => {
      if (isMountedRef.current) {
        toast.error('Service Rejected', { description: data.reason || 'Your service was not approved.' });
        void fetchServicesRef.current(1, false);
        void fetchOverviewStatsRef.current();
      }
    });

    return () => {
      unsubServiceApproved();
      unsubServiceRejected();
    };
  }, [isProvider]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs/modals
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      const isContentEditable = target.isContentEditable;
      const isModalOpen = showAddServiceModal || showEditServiceModal || showDeleteModal || showAnalyticsModal || showShortcutsHelp;

      // If user is typing in an input field, only allow Escape to clear/close
      if (isInputField || isContentEditable) {
        if (e.key === 'Escape') {
          // Only clear search if focus is on search input
          if (target === searchInputRef.current) {
            setSearchTerm('');
            target.blur();
          }
          // Close any open modal
          if (showAddServiceModal) setShowAddServiceModal(false);
          if (showEditServiceModal) {
            setShowEditServiceModal(false);
            setEditingServiceId(null);
          }
          if (showDeleteModal) {
            setShowDeleteModal(false);
            setDeletingServiceId(null);
          }
          if (showAnalyticsModal) closeAnalyticsModal();
          if (showShortcutsHelp) setShowShortcutsHelp(false);
        }
        return;
      }

      // If a modal is open (not an input), only allow Escape
      if (isModalOpen && e.key !== 'Escape') {
        return;
      }

      // Close shortcuts help with Escape
      if (showShortcutsHelp && e.key === 'Escape') {
        setShowShortcutsHelp(false);
        return;
      }

      // Don't handle shortcuts if modal is open
      if (isModalOpen) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;

        case 'Escape':
          e.preventDefault();
          // Clear search
          setSearchTerm('');
          setFocusedRowIndex(-1);
          break;

        case 'n':
        case 'N':
          e.preventDefault();
          setShowAddServiceModal(true);
          break;

        case '?':
          e.preventDefault();
          setShowShortcutsHelp(true);
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (services.length > 0) {
            const newIndex = focusedRowIndex <= 0 ? services.length - 1 : focusedRowIndex - 1;
            setFocusedRowIndex(newIndex);
            serviceRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (services.length > 0) {
            const newIndex = focusedRowIndex >= services.length - 1 ? 0 : focusedRowIndex + 1;
            setFocusedRowIndex(newIndex);
            serviceRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedRowIndex >= 0 && focusedRowIndex < services.length) {
            const service = services[focusedRowIndex];
            setEditingServiceId(service._id);
            setShowEditServiceModal(true);
          }
          break;

        case 'e':
        case 'E':
          if (focusedRowIndex >= 0 && focusedRowIndex < services.length) {
            e.preventDefault();
            const service = services[focusedRowIndex];
            setEditingServiceId(service._id);
            setShowEditServiceModal(true);
          }
          break;

        case 'Delete':
        case 'Backspace':
          if (focusedRowIndex >= 0 && focusedRowIndex < services.length) {
            // Prevent backspace from navigating back
            if (e.key === 'Backspace') {
              e.preventDefault();
            }
            const service = services[focusedRowIndex];
            handleDeleteClick(service._id, service.name);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [services, focusedRowIndex, showAddServiceModal, showEditServiceModal, showDeleteModal, showAnalyticsModal, showShortcutsHelp]);

  const openAnalyticsModal = async (service: Service) => {
    setAnalyticsService(service);
    setShowAnalyticsModal(true);
    setAnalyticsData(null);
    setAnalyticsError(null);
    setAnalyticsLoading(true);

    try {
      const data = await authService.get<{
        success: boolean;
        data: { analytics: ServiceAnalyticsData };
      }>(`/provider/services/${service._id}/analytics`);

      if (data.success) {
        setAnalyticsData(data.data.analytics);
      }
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error(
        'Failed to load analytics',
        { description: err instanceof Error ? err.message : 'An error occurred' }
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const closeAnalyticsModal = () => {
    setShowAnalyticsModal(false);
    setAnalyticsService(null);
    setAnalyticsData(null);
    setAnalyticsError(null);
  };

  const canToggleService = (status: string) => status === 'active' || status === 'inactive';

  const flashCardState = (serviceId: string, state: 'success' | 'error') => {
    setCardStates((prev) => ({ ...prev, [serviceId]: state }));
    setTimeout(() => {
      setCardStates((prev) => ({ ...prev, [serviceId]: 'idle' }));
    }, 1000);
  };

  const toggleServiceStatus = async (serviceId: string, currentStatus: string) => {
    if (!canToggleService(currentStatus)) {
      toast.error('Cannot change status', { description: 'This service must be approved by admin first.' });
      return;
    }

    // Debounce: prevent multiple rapid clicks
    if (isToggling) return;
    setIsToggling(true);
    setTogglingServiceId(serviceId);

    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

      const data = await authService.patch<{ success: boolean; message?: string }>(
        `/provider/services/${serviceId}/status`,
        { status: newStatus }
      );

      if (data.success) {
        toast.success(
          newStatus === 'active' ? 'Service activated' : 'Service deactivated',
          data.message
        );
        flashCardState(serviceId, 'success');
        setPage(1);
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
        }
      } else {
        throw new Error('Failed to update service status');
      }
    } catch (err) {
      flashCardState(serviceId, 'error');
      toast.error(
        'Status update failed',
        { description: err instanceof Error ? err.message : 'Failed to update service status' }
      );
    } finally {
      setIsToggling(false);
      setTogglingServiceId(null);
    }
  };

  const handleDeleteClick = (serviceId: string, serviceName: string) => {
    setDeletingServiceId(serviceId);
    setDeletingServiceName(serviceName);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingServiceId) return;

    // Deduplication: prevent multiple rapid clicks
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const data = await authService.delete<{ success: boolean; message?: string }>(
        `/provider/services/${deletingServiceId}`
      );

      if (data.success) {
        const deletedServiceId = deletingServiceId;
        const deletedServiceName = deletingServiceName;

        // Close modal immediately
        setShowDeleteModal(false);
        setDeletingServiceId(null);
        setDeletingServiceName('');

        // Refresh the list
        setPage(1);
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
        }

        // Show undo toast with restore action
        toast.undo(
          'Service deleted',
          async () => {
            try {
              const restoreData = await authService.patch<{ success: boolean; message?: string }>(
                `/provider/services/${deletedServiceId}/restore`,
                {}
              );
              if (restoreData.success) {
                toast.success('Service restored', 'The service has been restored.');
                setPage(1);
                if (isMountedRef.current) {
                  void fetchServicesRef.current(1, false);
                  void fetchOverviewStatsRef.current();
                }
              }
            } catch (err) {
              toast.error('Restore failed', { description: err instanceof Error ? err.message : 'Failed to restore service' });
            }
          },
          data.message || `"${deletedServiceName}" can be restored within 8 seconds`,
          8000
        );
      } else {
        throw new Error('Failed to delete service');
      }
    } catch (err) {
      toast.error(
        'Delete failed',
        { description: err instanceof Error ? err.message : 'Failed to delete service' }
      );
    } finally {
      setIsDeleting(false);
      if (showDeleteModal) {
        setShowDeleteModal(false);
        setDeletingServiceId(null);
        setDeletingServiceName('');
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingServiceId(null);
    setDeletingServiceName('');
    setIsDeleting(false);
  };

  // Clone service handler
  const handleCloneService = async (service: Service) => {
    setIsCloningService(true);
    try {
      const data = await authService.post<{ success: boolean }>(`/provider/services/${service._id}/clone`, {});

      if (data.success) {
        toast.success('Service cloned', 'Cloned service created as draft. You can edit it now.');
        void fetchServicesRef.current(1, false);
        void fetchOverviewStatsRef.current();
      }
    } catch (err) {
      toast.error('Clone failed', { description: err instanceof Error ? err.message : 'Failed to clone service' });
    } finally {
      setIsCloningService(false);
    }
  };

  // Fetch deleted services (trash)
  const fetchTrashCount = useCallback(async () => {
    if (!isProvider) return;
    try {
      const data = await authService.get<{ success: boolean; data: { count: number } }>('/provider/services/trash/count');
      if (data.success && isMountedRef.current) {
        setTrashCount(data.data.count);
      }
    } catch {
      /* non-critical */
    }
  }, [isProvider]);

  const fetchDeletedServices = useCallback(async (pageNum: number = 1) => {
    if (!isProvider) return;

    try {
      setDeletedServicesLoading(true);
      setDeletedServicesError(null);

      const queryParams = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
      });

      const data = await authService.get<{
        success: boolean;
        data: { services: Service[]; pagination: typeof deletedPagination };
      }>(`/provider/services/trash?${queryParams}`);

      if (data.success) {
        setDeletedServices((prev) =>
          pageNum > 1 ? [...prev, ...data.data.services] : data.data.services
        );
        setDeletedPagination(data.data.pagination);
      }
    } catch (err) {
      setDeletedServicesError(err instanceof Error ? err.message : 'Failed to load trash');
      toast.error('Failed to load trash', { description: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setDeletedServicesLoading(false);
    }
  }, [isProvider]);

  // Switch between services list and trash view
  const switchToTrashView = () => {
    setIsViewingTrash(true);
    void fetchDeletedServices(1);
  };

  const switchToServicesView = () => {
    setIsViewingTrash(false);
    setPage(1);
    void fetchServicesRef.current(1, false);
  };

  // Restore handlers
  const handleRestoreClick = (serviceId: string, serviceName: string) => {
    setRestoringServiceId(serviceId);
    setRestoringServiceName(serviceName);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!restoringServiceId) return;

    setIsRestoring(true);
    try {
      const data = await authService.patch<{ success: boolean; message?: string }>(
        `/provider/services/${restoringServiceId}/restore`,
        {}
      );

      if (data.success) {
        toast.success('Service restored', data.message || 'The service has been restored successfully.');
        setShowRestoreModal(false);
        setRestoringServiceId(null);
        setRestoringServiceName('');

        // Refresh trash list and overview stats
        void fetchDeletedServices(1);
        void fetchOverviewStatsRef.current();
      } else {
        throw new Error('Failed to restore service');
      }
    } catch (err) {
      toast.error('Restore failed', { description: err instanceof Error ? err.message : 'Failed to restore service' });
    } finally {
      setIsRestoring(false);
    }
  };

  const cancelRestore = () => {
    setShowRestoreModal(false);
    setRestoringServiceId(null);
    setRestoringServiceName('');
    setIsRestoring(false);
  };

  // Permanent delete handlers
  const handlePermanentDeleteClick = (serviceId: string, serviceName: string) => {
    setPermanentDeletingServiceId(serviceId);
    setPermanentDeletingServiceName(serviceName);
    setShowPermanentDeleteModal(true);
  };

  const confirmPermanentDelete = async () => {
    if (!permanentDeletingServiceId) return;

    setIsPermanentDeleting(true);
    try {
      const data = await authService.delete<{ success: boolean; message?: string }>(
        `/provider/services/${permanentDeletingServiceId}/permanent`
      );

      if (data.success) {
        toast.success('Service permanently deleted', data.message || 'The service has been permanently removed.');
        setShowPermanentDeleteModal(false);
        setPermanentDeletingServiceId(null);
        setPermanentDeletingServiceName('');

        // Refresh trash list
        void fetchDeletedServices(1);
      } else {
        throw new Error('Failed to permanently delete service');
      }
    } catch (err) {
      toast.error('Permanent delete failed', { description: err instanceof Error ? err.message : 'Failed to permanently delete service' });
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const cancelPermanentDelete = () => {
    setShowPermanentDeleteModal(false);
    setPermanentDeletingServiceId(null);
    setPermanentDeletingServiceName('');
    setIsPermanentDeleting(false);
  };

  // Bulk selection handlers
  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (selectedServices.size === services.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(services.map((s) => s._id)));
    }
  };

  const clearSelection = () => {
    setSelectedServices(new Set());
  };

  // Bulk activate services
  const bulkActivate = async () => {
    if (selectedServices.size === 0) return;

    setIsBulkOperating(true);
    const serviceIds = Array.from(selectedServices);

    try {
      const data = await authService.post<{
        success: boolean;
        data: { processed: number; succeeded: number; failed: number; errors?: Array<{ id: string; reason: string }> }
      }>('/provider/services/bulk/activate', { serviceIds });

      if (data.success) {
        if (data.data.failed === 0) {
          toast.success('Services activated', `${data.data.succeeded} service(s) activated successfully.`);
        } else {
          toast.warning('Partial activation', `${data.data.succeeded} service(s) activated, ${data.data.failed} failed.`);
        }
        clearSelection();
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
        }
      }
    } catch (err) {
      toast.error('Bulk activation failed', { description: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Bulk deactivate services
  const bulkDeactivate = async () => {
    if (selectedServices.size === 0) return;

    setIsBulkOperating(true);
    const serviceIds = Array.from(selectedServices);

    try {
      const data = await authService.post<{
        success: boolean;
        data: { processed: number; succeeded: number; failed: number; errors?: Array<{ id: string; reason: string }> }
      }>('/provider/services/bulk/deactivate', { serviceIds });

      if (data.success) {
        if (data.data.failed === 0) {
          toast.success('Services deactivated', `${data.data.succeeded} service(s) deactivated successfully.`);
        } else {
          toast.warning('Partial deactivation', `${data.data.succeeded} service(s) deactivated, ${data.data.failed} failed.`);
        }
        clearSelection();
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
        }
      }
    } catch (err) {
      toast.error('Bulk deactivation failed', { description: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Bulk delete services
  const confirmBulkDelete = async () => {
    if (selectedServices.size === 0) return;

    setIsBulkOperating(true);
    const serviceIds = Array.from(selectedServices);

    try {
      const data = await authService.delete<{
        success: boolean;
        data: { processed: number; succeeded: number; failed: number; errors?: Array<{ id: string; reason: string }> }
      }>('/provider/services/bulk/delete', { data: { serviceIds } });

      if (data.success) {
        if (data.data.failed === 0) {
          toast.success('Services deleted', `${data.data.succeeded} service(s) deleted successfully.`);
        } else {
          toast.warning('Partial deletion', `${data.data.succeeded} service(s) deleted, ${data.data.failed} failed.`);
        }
        clearSelection();
        setShowBulkDeleteModal(false);
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
          void fetchTrashCount();
        }
      }
    } catch (err) {
      toast.error('Bulk deletion failed', { description: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Export services to CSV using backend endpoint
  const exportToCSV = async () => {
    setIsExporting(true);
    setShowExportDropdown(false);

    try {
      // Build query params from current filters
      const queryParams = new URLSearchParams({
        format: 'csv',
        status: statusFilter === 'all' ? 'all' : statusFilter,
      });
      if (categoryFilter !== 'all') queryParams.append('category', categoryFilter);
      if (searchTerm) queryParams.append('search', searchTerm);
      if (minPrice) queryParams.append('minPrice', minPrice);
      if (maxPrice) queryParams.append('maxPrice', maxPrice);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (ratingFilter !== 'any') queryParams.append('minRating', ratingFilter);
      if (featuredOnly) queryParams.append('featured', 'true');

      const blob = await authService.get<Blob>(
        `/provider/services/export?${queryParams}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `services-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export complete', 'All services exported to CSV');
    } catch (err) {
      toast.error('Export failed', { description: err instanceof Error ? err.message : 'Failed to export services' });
    } finally {
      setIsExporting(false);
    }
  };

  // Export services to JSON using backend endpoint
  const exportToJSON = async () => {
    setIsExporting(true);
    setShowExportDropdown(false);

    try {
      // Build query params from current filters
      const queryParams = new URLSearchParams({
        format: 'json',
        status: statusFilter === 'all' ? 'all' : statusFilter,
      });
      if (categoryFilter !== 'all') queryParams.append('category', categoryFilter);
      if (searchTerm) queryParams.append('search', searchTerm);
      if (minPrice) queryParams.append('minPrice', minPrice);
      if (maxPrice) queryParams.append('maxPrice', maxPrice);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (ratingFilter !== 'any') queryParams.append('minRating', ratingFilter);
      if (featuredOnly) queryParams.append('featured', 'true');

      const blob = await authService.get<Blob>(
        `/provider/services/export?${queryParams}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `services-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export complete', 'All services exported to JSON');
    } catch (err) {
      toast.error('Export failed', { description: err instanceof Error ? err.message : 'Failed to export services' });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string, rejectionReason?: string) => {
    switch (status) {
      case 'pending_review':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-warning/20 text-nilin-charcoal border border-nilin-warning/30">
            <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
            Pending Review
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
            <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-muted text-nilin-warmGray border border-nilin-border">
            <Edit3 className="w-3 h-3 mr-1" aria-hidden="true" />
            Draft
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            Inactive
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-rose/10 text-nilin-rose border border-nilin-rose/20">
            <XCircle className="w-3 h-3" aria-hidden="true" />
            Rejected
            {rejectionReason && (
              <span className="ml-1 px-1.5 py-0.5 bg-nilin-rose/20 rounded text-nilin-warmGray" title={rejectionReason}>
                (?)
              </span>
            )}
          </span>
        );
      default:
        return (
          <span className="badge-nilin">Unknown</span>
        );
    }
  };

  if (!isProvider && !overviewLoading) {
    return (
      <div className="glass-nilin rounded-nilin-lg p-10 border border-nilin-border text-center">
        <p className="text-nilin-warmGray">{listError || 'Please log in as a provider to access this page'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Accessibility: Screen reader status announcer */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      {/* Booking Stats - Primary Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-serif text-nilin-charcoal">Booking Overview</h2>
            <span className="px-2 py-0.5 text-xs bg-nilin-coral/10 text-nilin-coral rounded-full font-medium">Live</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setOverviewLoading(true);
              void fetchOverviewStatsRef.current();
            }}
            disabled={overviewLoading}
            className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh stats"
            aria-label="Refresh booking overview stats"
          >
            <RefreshCw className={`w-4 h-4 ${overviewLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {overviewError && !overviewLoading && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-nilin-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{overviewError}</p>
            <button
              type="button"
              onClick={() => void fetchOverviewStatsRef.current()}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        )}
        {overviewLoading ? (
          <SkeletonStatGrid columns={4} />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stagger-item" style={{ animationDelay: '0.1s' }}>
            <StatCard
              label="New Bookings"
              value={bookingStats.newBookings}
              hint="Last 7 days"
              icon={Calendar}
              iconClass="bg-nilin-blush text-nilin-coral"
            />
          </div>
          <div className="stagger-item" style={{ animationDelay: '0.15s' }}>
            <StatCard
              label="Pending Requests"
              value={bookingStats.pendingRequests}
              hint="Awaiting response"
              icon={Clock}
              iconClass="bg-nilin-warning/20 text-nilin-charcoal"
            />
          </div>
          <div className="stagger-item" style={{ animationDelay: '0.2s' }}>
            <StatCard
              label="Today's Schedule"
              value={bookingStats.todaySchedule}
              hint="Appointments"
              icon={Users}
              iconClass="bg-nilin-muted text-nilin-rose"
            />
          </div>
          <div className="stagger-item" style={{ animationDelay: '0.25s' }}>
            <StatCard
              label="Completed"
              value={bookingStats.completedThisMonth}
              hint="This month"
              icon={CheckCircle}
              iconClass="bg-nilin-coral/10 text-nilin-rose"
            />
          </div>
        </div>
        )}
      </section>

      {/* Service Stats - Secondary Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif text-nilin-charcoal">Service Performance</h2>
          <button
            type="button"
            onClick={() => {
              setOverviewLoading(true);
              void fetchOverviewStatsRef.current();
            }}
            disabled={overviewLoading}
            className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh stats"
            aria-label="Refresh service performance stats"
          >
            <RefreshCw className={`w-4 h-4 ${overviewLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {overviewLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <SkeletonPerformanceCard count={5} />
          </div>
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="glass-nilin rounded-nilin-lg p-5 border border-nilin-border/50 hover-lift group stagger-item" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-blush/60 flex items-center justify-center group-hover:bg-nilin-blush transition-colors">
                <Calendar className="w-5 h-5 text-nilin-coral" />
              </div>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal tracking-tight">{serviceStats.total}</p>
            <p className="text-sm text-nilin-warmGray mt-1">Total Services</p>
          </div>
          <div className="glass-nilin rounded-nilin-lg p-5 border border-nilin-border/50 hover-lift group stagger-item" style={{ animationDelay: '0.35s' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center group-hover:bg-nilin-coral/20 transition-colors">
                <CheckCircle className="w-5 h-5 text-nilin-rose" />
              </div>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal tracking-tight">{serviceStats.active}</p>
            <p className="text-sm text-nilin-warmGray mt-1">Active</p>
          </div>
          <div className="glass-nilin rounded-nilin-lg p-5 border border-nilin-border/50 hover-lift group stagger-item" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-blush/60 flex items-center justify-center group-hover:bg-nilin-blush transition-colors">
                <Eye className="w-5 h-5 text-nilin-coral" />
              </div>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal tracking-tight">{performanceStats.totalViews.toLocaleString()}</p>
            <p className="text-sm text-nilin-warmGray mt-1">Impressions</p>
          </div>
          <div className="glass-nilin rounded-nilin-lg p-5 border border-nilin-border/50 hover-lift group stagger-item" style={{ animationDelay: '0.45s' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-peach/50 flex items-center justify-center group-hover:bg-nilin-peach transition-colors">
                <TrendingUp className="w-5 h-5 text-nilin-charcoal" />
              </div>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal tracking-tight">{performanceStats.conversionRate.toFixed(1)}%</p>
            <p className="text-sm text-nilin-warmGray mt-1">CTR</p>
          </div>
          <div className="glass-nilin rounded-nilin-lg p-5 border border-nilin-border/50 hover-lift group stagger-item" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center group-hover:bg-nilin-coral/20 transition-colors">
                <Users className="w-5 h-5 text-nilin-rose" />
              </div>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal tracking-tight">{performanceStats.bookingRate.toFixed(1)}%</p>
            <p className="text-sm text-nilin-warmGray mt-1">Booking Rate</p>
          </div>
        </div>
        )}
      </section>

      {/* Services Management */}
      <div className="glass-nilin rounded-nilin-lg border border-nilin-border/60 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-nilin-border bg-gradient-to-r from-nilin-blush/40 to-nilin-peach/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-serif text-nilin-charcoal">Manage Services</h2>
                <p className="text-sm text-nilin-warmGray mt-0.5">Create, edit, and manage your service offerings</p>
              </div>
              {/* Tab Buttons */}
              <div role="tablist" aria-label="View selection" className="flex items-center gap-1 bg-white/60 rounded-nilin p-1 border border-nilin-border/50">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isViewingTrash}
                  tabIndex={!isViewingTrash ? 0 : -1}
                  onClick={switchToServicesView}
                  className={`px-4 py-2 rounded-nilin text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                    !isViewingTrash
                      ? 'bg-nilin-coral text-white shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Services
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isViewingTrash}
                  tabIndex={isViewingTrash ? 0 : -1}
                  onClick={switchToTrashView}
                  className={`px-4 py-2 rounded-nilin text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                    isViewingTrash
                      ? 'bg-nilin-coral text-white shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Trash className="w-4 h-4" />
                    Trash
                    {trashCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 text-xs bg-nilin-coral/20 text-nilin-coral rounded-full">
                        {trashCount}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isViewingTrash && (
                <button
                  type="button"
                  onClick={() => setShowShortcutsHelp(true)}
                  className="w-11 h-11 flex items-center justify-center text-nilin-warmGray hover:text-nilin-charcoal hover:bg-white/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  title="Keyboard shortcuts (?)"
                  aria-label="Show keyboard shortcuts"
                >
                  <Keyboard className="w-5 h-5" />
                </button>
              )}

              {/* Export Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  disabled={services.length === 0 || isExporting}
                  className="w-11 h-11 flex items-center justify-center text-nilin-warmGray hover:text-nilin-charcoal hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  title="Export services"
                  aria-label="Export services"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <ChevronDown className="w-3 h-3 inline-block ml-0.5" />
                </button>

                {showExportDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowExportDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-nilin-border z-20 py-1">
                      <button
                        type="button"
                        onClick={exportToCSV}
                        className="w-full px-4 py-2.5 text-left text-sm text-nilin-charcoal hover:bg-nilin-muted flex items-center gap-2 transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Export as CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportToJSON}
                        className="w-full px-4 py-2.5 text-left text-sm text-nilin-charcoal hover:bg-nilin-muted flex items-center gap-2 transition-colors"
                      >
                        <FileJson className="w-4 h-4 text-blue-600" />
                        Export as JSON
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!isViewingTrash && (
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(true)}
                  className="btn-nilin inline-flex items-center justify-center gap-2 shrink-0 hover:scale-105 active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add New Service
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters - Hidden when viewing trash */}
        {!isViewingTrash && (
          <div className="px-6 py-5 border-b border-nilin-border bg-nilin-cream/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-nilin-blush/50 flex items-center justify-center">
              <Filter className="w-4 h-4 text-nilin-coral" />
            </div>
            <span className="text-sm font-medium text-nilin-charcoal">Filter & sort</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="block text-xs font-medium text-nilin-warmGray mb-1.5">Search <span className="text-nilin-lightGray font-normal">(press / to focus)</span></label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray w-4 h-4 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${inputClass} pl-10 pr-10`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal"
                    aria-label="Clear search"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-nilin-warmGray mb-1.5">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
                <option value="all">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-nilin-warmGray mb-1.5">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                <option value="all">All ({statusCounts.all || serviceStats.total})</option>
                <option value="active">Active ({statusCounts.active || serviceStats.active})</option>
                <option value="draft">Draft ({statusCounts.draft || serviceStats.draft})</option>
                <option value="inactive">Inactive ({statusCounts.inactive || serviceStats.inactive})</option>
                <option value="pending_review">Pending ({statusCounts.pending_review || serviceStats.pending_review || 0})</option>
                <option value="rejected">Rejected ({statusCounts.rejected || serviceStats.rejected || 0})</option>
              </select>
            </div>

            <div>
              <label htmlFor="sort-by" className="block text-xs font-medium text-nilin-warmGray mb-1.5">Sort by</label>
              <select
                id="sort-by"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className={selectClass}
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating-desc">Rating: High to Low</option>
                <option value="rating-asc">Rating: Low to High</option>
                <option value="name-asc">Name: A-Z</option>
                <option value="views-desc">Most Views</option>
                <option value="popularity-desc">Most Popular</option>
              </select>
            </div>

            <div>
              <label htmlFor="rating-filter" className="block text-xs font-medium text-nilin-warmGray mb-1.5">Rating</label>
              <select id="rating-filter" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className={selectClass}>
                <option value="any">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Star</option>
              </select>
            </div>

            <div>
              <label htmlFor="price-range-min" className="block text-xs font-medium text-nilin-warmGray mb-1.5">Price Range (AED)</label>
              <div className="flex items-center gap-2">
                <input
                  id="price-range-min"
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={`${inputClass} text-sm`}
                  min="0"
                />
                <span className="text-sm text-nilin-warmGray shrink-0">to</span>
                <input
                  id="price-range-max"
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className={`${inputClass} text-sm`}
                  min="0"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-nilin-warmGray mb-1.5">Featured</span>
              <button
                type="button"
                aria-pressed={featuredOnly}
                onClick={() => setFeaturedOnly(!featuredOnly)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-nilin border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                  featuredOnly
                    ? 'bg-nilin-warning/20 border-nilin-warning/30 text-nilin-charcoal'
                    : 'bg-white border-nilin-border text-nilin-warmGray hover:border-nilin-coral/30'
                }`}
              >
                <Star className={`w-4 h-4 ${featuredOnly ? 'fill-nilin-warning text-nilin-warning' : ''}`} />
                <span className="text-sm font-medium">{featuredOnly ? 'Featured Only' : 'Any'}</span>
              </button>
            </div>

            <div className="sm:col-span-2 xl:col-span-2">
              <label htmlFor="date-start" className="block text-xs font-medium text-nilin-warmGray mb-1.5">Service created between</label>
              <div className="flex items-center gap-2">
                <input id="date-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} aria-label="Start date" />
                <span className="text-sm text-nilin-warmGray shrink-0">to</span>
                <input id="date-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} aria-label="End date" />
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {searchTerm && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
                <Search className="w-3.5 h-3.5" />
                <span className="max-w-[150px] truncate">{searchTerm}</span>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear search filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
                <span>Category: {categoryFilter}</span>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear category filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
                <span>Status: {statusFilter}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear status filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {startDate && endDate
                    ? `${startDate} to ${endDate}`
                    : startDate
                      ? `From ${startDate}`
                      : `Until ${endDate}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear date filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {ratingFilter !== 'any' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
                <Star className="w-3.5 h-3.5" />
                <span>{ratingFilter}+ Stars</span>
                <button
                  type="button"
                  onClick={() => setRatingFilter('any')}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear rating filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-coral/10 text-nilin-rose border border-nilin-coral/20">
                <DollarSign className="w-3.5 h-3.5" />
                <span>
                  {minPrice && maxPrice
                    ? `AED ${minPrice} - ${maxPrice}`
                    : minPrice
                      ? `Min: AED ${minPrice}`
                      : `Max: AED ${maxPrice}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-coral/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear price filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {featuredOnly && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-nilin-warning/20 text-nilin-charcoal border border-nilin-warning/30">
                <Star className="w-3.5 h-3.5 fill-nilin-warning text-nilin-warning" />
                <span>Featured Only</span>
                <button
                  type="button"
                  onClick={() => setFeaturedOnly(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-nilin-warning/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1"
                  aria-label="Clear featured filter"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {(searchTerm || startDate || endDate || categoryFilter !== 'all' || statusFilter !== 'all' || ratingFilter !== 'any' || minPrice || maxPrice || featuredOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStartDate('');
                  setEndDate('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setRatingFilter('any');
                  setMinPrice('');
                  setMaxPrice('');
                  setFeaturedOnly(false);
                  setSortBy('createdAt');
                  setSortOrder('desc');
                  setPage(1);
                }}
                className="text-sm text-nilin-warmGray hover:text-nilin-charcoal font-medium transition-colors underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        )}

        {/* Bulk Action Bar - Hidden when viewing trash */}
        {selectedServices.size > 0 && (
          <div className="px-6 py-3 bg-nilin-coral/10 border-b border-nilin-coral/20 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearSelection}
                className="w-9 h-9 flex items-center justify-center hover:bg-nilin-coral/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4 text-nilin-coral" />
              </button>
              <span className="text-sm font-medium text-nilin-charcoal">
                {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={bulkActivate}
                disabled={isBulkOperating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nilin-coral hover:bg-nilin-rose text-white text-sm font-medium rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" />
                Activate
              </button>
              <button
                type="button"
                onClick={bulkDeactivate}
                disabled={isBulkOperating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nilin-warning hover:bg-nilin-warning/80 text-white text-sm font-medium rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <ToggleLeft className="w-3.5 h-3.5" />
                Deactivate
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={isBulkOperating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nilin-rose hover:bg-nilin-rose/80 text-white text-sm font-medium rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="p-6">
          {listLoading && services.length === 0 ? (
            <SkeletonServiceList count={3} />
          ) : listError ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-nilin-warmGray mb-4">{listError}</p>
              <button type="button" onClick={() => fetchServices(1, false)} className="btn-nilin">
                Try Again
              </button>
            </div>
          ) : services.length === 0 && !listLoading ? (
            searchTerm ? (
              <NoServicesSearchEmpty onClearFilters={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setSortBy('createdAt');
                setSortOrder('desc');
                setPage(1);
              }} />
            ) : (
              <NoServicesEmpty onCreateService={() => setShowAddServiceModal(true)} />
            )
          ) : (
            <div className="space-y-4">
              {pagination.total > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAllSelection}
                    className={`w-9 h-9 flex items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                      selectedServices.size === services.length && services.length > 0
                        ? 'text-nilin-coral'
                        : 'text-nilin-lightGray hover:text-nilin-coral'
                    }`}
                    aria-label={selectedServices.size === services.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedServices.size === services.length && services.length > 0 ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <p className="text-sm text-nilin-warmGray font-sans">
                    Showing {services.length} of {pagination.total} services
                    {selectedServices.size > 0 && ` (${selectedServices.size} selected)`}
                  </p>
                </div>
              )}
              {services.map((service, index) => (
                <article
                  key={service._id}
                  ref={(el: HTMLDivElement | null) => { serviceRefs.current[index] = el; }}
                  aria-label={`Service: ${service.name}, Status: ${service.status}, Price: ${service.price.currency} ${service.price.amount}`}
                  className={`card-nilin hover-lift p-6 rounded-nilin-lg bg-white/90 border transition-all duration-200 hover:shadow-lg hover:border-nilin-coral/30 stagger-item ${
                    focusedRowIndex === index
                      ? 'border-nilin-coral shadow-lg ring-2 ring-nilin-coral/20'
                      : 'border-nilin-border'
                  } ${selectedServices.has(service._id) ? 'ring-2 ring-nilin-coral bg-nilin-coral/5' : ''} ${
                    cardStates[service._id] === 'success' ? 'animate-success-glow' : ''
                  } ${cardStates[service._id] === 'error' ? 'ring-2 ring-nilin-rose/40' : ''}`}
                  style={{ animationDelay: `${Math.min(index * 0.05, 0.15)}s` }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    {/* Checkbox for bulk selection */}
                    <div className="flex items-start pt-1">
                      <button
                        type="button"
                        onClick={() => toggleServiceSelection(service._id)}
                        className={`w-9 h-9 flex items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                          selectedServices.has(service._id)
                            ? 'text-nilin-coral'
                            : 'text-nilin-lightGray hover:text-nilin-coral'
                        }`}
                        aria-label={selectedServices.has(service._id) ? `Deselect ${service.name}` : `Select ${service.name}`}
                      >
                        {selectedServices.has(service._id) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Service Thumbnail */}
                    <div className="flex-shrink-0">
                      {service.images && service.images.length > 0 ? (
                        <img
                          src={service.images[0]}
                          alt={service.name}
                          className="w-20 h-20 rounded-nilin-lg object-cover border border-nilin-border/50"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-nilin-lg bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center border border-nilin-border/50">
                          <span className="text-2xl font-serif text-nilin-coral/50">
                            {service.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h3 className="text-xl font-serif text-nilin-charcoal tracking-tight truncate" title={service.name}>{service.name}</h3>
                        {getStatusBadge(service.status, service.rejectionReason)}
                        {service.isFeatured && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-warning/20 text-nilin-charcoal border border-nilin-warning/30">
                            <Star className="w-3 h-3 mr-1 fill-nilin-warning text-nilin-warning" aria-hidden="true" />
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2.5 text-sm text-nilin-warmGray">
                          <div className="w-8 h-8 rounded-lg bg-nilin-blush/40 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-nilin-coral" />
                          </div>
                          <span className="truncate">{service.category}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-nilin-charcoal">
                          <div className="w-8 h-8 rounded-lg bg-nilin-blush/40 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-nilin-coral" />
                          </div>
                          <span>
                            {service.price.currency || 'AED'} {service.price.amount}
                            {service.price.type !== 'fixed' && (
                              <span className="text-xs text-nilin-warmGray font-normal ml-1">({service.price.type})</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-nilin-warmGray">
                          <div className="w-8 h-8 rounded-lg bg-nilin-muted/50 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                          </div>
                          <span>{service.duration} min</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-nilin-warmGray">
                          <div className="w-8 h-8 rounded-lg bg-nilin-muted/50 flex items-center justify-center">
                            <MapPin className="w-4 h-4 shrink-0" />
                          </div>
                          <span className="truncate">
                            {service.location?.address?.city || '—'}
                            {service.location?.address?.state ? `, ${service.location.address.state}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-nilin-charcoal/70">
                          <Eye className="w-3.5 h-3.5 text-nilin-warmGray" />
                          <span className="font-semibold text-nilin-charcoal">{service.searchMetadata.searchCount.toLocaleString()}</span> impressions
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-nilin-charcoal/70">
                          <Users className="w-3.5 h-3.5 text-nilin-warmGray" />
                          <span className="font-semibold text-nilin-charcoal">{service.searchMetadata.clickCount.toLocaleString()}</span> views
                        </span>
                        {service.rating.count > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-nilin-charcoal/70">
                            <Star className="w-3.5 h-3.5 text-nilin-warning fill-nilin-warning" />
                            <span className="font-semibold text-nilin-charcoal">{service.rating.average.toFixed(1)}</span>
                            <span className="text-nilin-lightGray">({service.rating.count})</span>
                          </span>
                        )}
                        <span className="text-xs text-nilin-lightGray ml-auto">
                          Updated {new Date(service.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons - Grouped with visual separator */}
                    <div className="flex items-center lg:flex-col gap-1 shrink-0 bg-nilin-muted/30 p-2 rounded-xl border border-nilin-border/50">
                      {/* Analytics */}
                      <div className="relative group/analytics">
                        <button
                          type="button"
                          onClick={() => openAnalyticsModal(service)}
                          className="w-11 h-11 flex items-center justify-center text-nilin-warmGray hover:text-nilin-rose hover:bg-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                          aria-label={`View analytics for ${service.name}`}
                        >
                          <TrendingUp className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-nilin-charcoal text-white rounded opacity-0 group-hover/analytics:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                          Analytics
                        </span>
                      </div>

                      {/* Clone */}
                      <div className="relative group/clone">
                        <button
                          type="button"
                          onClick={() => handleCloneService(service)}
                          disabled={isCloningService}
                          className="w-11 h-11 flex items-center justify-center text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 disabled:opacity-50"
                          aria-label={`Clone ${service.name}`}
                        >
                          <Copy className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-nilin-charcoal text-white rounded opacity-0 group-hover/clone:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          Clone
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="w-full h-px bg-nilin-border/50 my-1" />

                      {/* Toggle */}
                      <div className="relative group/toggle">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusModalService({ id: service._id, name: service.name, currentStatus: service.status });
                            setShowStatusModal(true);
                          }}
                          disabled={!canToggleService(service.status) || (isToggling && togglingServiceId === service._id)}
                          className={`p-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                            service.status === 'active'
                              ? 'text-green-600 hover:bg-green-50'
                              : canToggleService(service.status)
                                ? 'text-nilin-lightGray hover:bg-white'
                                : 'text-nilin-lightGray/50 cursor-not-allowed'
                          }`}
                          aria-label={
                            canToggleService(service.status)
                              ? service.status === 'active'
                                ? `Deactivate ${service.name}`
                                : `Activate ${service.name}`
                              : `${service.name} awaiting admin approval`
                          }
                        >
                          {service.status === 'active' ? (
                            <ToggleRight className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" aria-hidden="true" />
                          )}
                        </button>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-nilin-charcoal text-white rounded opacity-0 group-hover/toggle:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                          {service.status === 'active' ? 'Deactivate' : 'Activate'}
                        </span>
                      </div>

                      {/* Edit */}
                      <div className="relative group/edit">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingServiceId(service._id);
                            setShowEditServiceModal(true);
                          }}
                          className="p-2.5 text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                          aria-label={`Edit ${service.name}`}
                        >
                          <Edit3 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-nilin-charcoal text-white rounded opacity-0 group-hover/edit:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                          Edit
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="w-full h-px bg-nilin-border/50 my-1" />

                      {/* Delete */}
                      <div className="relative group/delete">
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(service._id, service.name)}
                          className="w-11 h-11 flex items-center justify-center text-nilin-lightGray hover:text-nilin-rose hover:bg-nilin-rose/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-rose focus-visible:ring-offset-2"
                          aria-label={`Delete ${service.name}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-nilin-rose text-white rounded opacity-0 group-hover/delete:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                          Delete
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {listLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
                </div>
              )}
              {pagination.hasNext && !listLoading && (
                <div className="flex flex-col items-center gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="px-6 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                  >
                    Load more
                  </button>
                  {pagination.pages > 1 && (
                    <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                      <span>Page {pagination.page} of {pagination.pages}</span>
                      <button
                        type="button"
                        onClick={() => setPage(1)}
                        disabled={pagination.page === 1}
                        className="px-2 py-1 rounded border border-nilin-border disabled:opacity-50 hover:bg-nilin-muted transition-colors"
                        aria-label="Go to first page"
                      >
                        First
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page === 1}
                        className="px-2 py-1 rounded border border-nilin-border disabled:opacity-50 hover:bg-nilin-muted transition-colors"
                        aria-label="Go to previous page"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                        disabled={!pagination.hasNext}
                        className="px-2 py-1 rounded border border-nilin-border disabled:opacity-50 hover:bg-nilin-muted transition-colors"
                        aria-label="Go to next page"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage(pagination.pages)}
                        disabled={!pagination.hasNext}
                        className="px-2 py-1 rounded border border-nilin-border disabled:opacity-50 hover:bg-nilin-muted transition-colors"
                        aria-label="Go to last page"
                      >
                        Last
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trash View */}
        {isViewingTrash && (
          <div className="p-6">
            {deletedServicesLoading ? (
              <SkeletonServiceList count={3} />
            ) : deletedServicesError ? (
              <div className="py-12 text-center">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <p className="text-nilin-warmGray mb-4">{deletedServicesError}</p>
                <button type="button" onClick={() => fetchDeletedServices(1)} className="btn-nilin">
                  Try Again
                </button>
              </div>
            ) : deletedServices.length === 0 ? (
              <NoTrashItemsEmpty />
            ) : (
              <div className="space-y-4">
                {deletedPagination.total > 0 && (
                  <p className="text-sm text-nilin-warmGray font-sans">
                    Showing {deletedServices.length} of {deletedPagination.total} deleted services
                  </p>
                )}
                {deletedServices.map((service, index) => (
                  <article
                    key={service._id}
                    className="card-nilin hover-lift p-6 rounded-nilin-lg bg-white/90 border border-nilin-border transition-all duration-200 hover:shadow-lg hover:border-nilin-coral/30 stagger-item opacity-75"
                    style={{ animationDelay: `${Math.min(index * 0.05, 0.15)}s` }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                      {/* Service Thumbnail */}
                      <div className="flex-shrink-0">
                        {service.images && service.images.length > 0 ? (
                          <img
                            src={service.images[0]}
                            alt={service.name}
                            className="w-20 h-20 rounded-xl object-cover border border-nilin-border/50 grayscale"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center border border-nilin-border/50 grayscale">
                            <span className="text-2xl font-serif text-nilin-coral/50">
                              {service.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Service Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-xl font-serif text-nilin-charcoal tracking-tight truncate" title={service.name}>{service.name}</h3>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                            <Trash2 className="w-3 h-3 mr-1" aria-hidden="true" />
                            Deleted
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2.5 text-sm text-nilin-warmGray">
                            <div className="w-8 h-8 rounded-lg bg-nilin-blush/40 flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-nilin-coral" />
                            </div>
                            <span className="truncate">{service.category}</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-sm text-nilin-warmGray">
                            <div className="w-8 h-8 rounded-lg bg-nilin-blush/40 flex items-center justify-center">
                              <DollarSign className="w-4 h-4 text-nilin-coral" />
                            </div>
                            <span>{service.price.currency || 'AED'} {service.price.amount}</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-sm text-nilin-warmGray">
                            <div className="w-8 h-8 rounded-lg bg-nilin-muted/50 flex items-center justify-center">
                              <Clock className="w-4 h-4" />
                            </div>
                            <span>Deleted {service.deletedAt ? new Date(service.deletedAt).toLocaleDateString() : 'Unknown'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <span className="text-xs text-nilin-lightGray">
                            Created {new Date(service.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-nilin-lightGray">
                            Deleted {service.deletedAt ? new Date(service.deletedAt).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center lg:flex-col gap-1 shrink-0 bg-nilin-muted/30 p-2 rounded-xl border border-nilin-border/50">
                        {/* Restore */}
                        <div className="relative group/restore">
                          <button
                            type="button"
                            onClick={() => handleRestoreClick(service._id, service.name)}
                            disabled={isRestoring && restoringServiceId === service._id}
                            className="w-11 h-11 flex items-center justify-center text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 disabled:opacity-50"
                            aria-label={`Restore ${service.name}`}
                          >
                            {isRestoring && restoringServiceId === service._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-green-600 text-white rounded opacity-0 group-hover/restore:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            Restore
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-nilin-border/50 my-1" />

                        {/* Permanent Delete */}
                        <div className="relative group/permdelete">
                          <button
                            type="button"
                            onClick={() => handlePermanentDeleteClick(service._id, service.name)}
                            disabled={isPermanentDeleting && permanentDeletingServiceId === service._id}
                            className="p-2.5 text-nilin-lightGray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
                            aria-label={`Permanently delete ${service.name}`}
                          >
                            {isPermanentDeleting && permanentDeletingServiceId === service._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-red-600 text-white rounded opacity-0 group-hover/permdelete:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            Permanent Delete
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {deletedPagination.hasNext && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={() => fetchDeletedServices(deletedPagination.page + 1)}
                      className="px-6 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        onServiceAdded={() => {
          setPage(1);
          fetchServices(1, false);
          fetchOverviewStats();
        }}
      />

      {/* Edit Service Modal */}
      <EditServiceModal
        isOpen={showEditServiceModal}
        onClose={() => {
          setShowEditServiceModal(false);
          setEditingServiceId(null);
        }}
        onServiceUpdated={() => {
          setPage(1);
          fetchServices(1, false);
          fetchOverviewStats();
        }}
        serviceId={editingServiceId}
      />

      {/* Service Analytics Modal */}
      {showAnalyticsModal && analyticsService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nilin-charcoal/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-nilin-strong rounded-nilin-lg shadow-nilin-lg max-w-lg w-full max-h-[90vh] overflow-hidden border border-nilin-border animate-modal-enter">
            <div className="px-6 py-4 bg-gradient-to-r from-nilin-rose to-nilin-coral flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif text-white">Service Analytics</h2>
                <p className="text-sm text-white/90 font-sans">{analyticsService.name}</p>
              </div>
              <button
                type="button"
                onClick={closeAnalyticsModal}
                className="p-2 hover:bg-white/15 rounded-nilin transition-colors text-white/90 hover:text-white"
                aria-label="Close analytics modal"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              {analyticsLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
                  <p className="text-sm text-nilin-warmGray">Loading analytics…</p>
                </div>
              )}

              {analyticsError && !analyticsLoading && (
                <div className="space-y-3">
                  <div className="rounded-nilin bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                    {analyticsError}
                  </div>
                  <button
                    type="button"
                    onClick={() => openAnalyticsModal(analyticsService!)}
                    className="btn-nilin w-full"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {analyticsData && !analyticsLoading && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-nilin-blush/50 rounded-xl p-4 text-center border border-nilin-border">
                      <div className="text-3xl font-bold text-nilin-rose">
                        {analyticsData.totalViews.toLocaleString()}
                      </div>
                      <div className="text-sm text-nilin-warmGray mt-1">Search impressions</div>
                    </div>
                    <div className="bg-nilin-muted/50 rounded-xl p-4 text-center border border-nilin-border">
                      <div className="text-3xl font-bold text-nilin-charcoal">
                        {analyticsData.totalClicks.toLocaleString()}
                      </div>
                      <div className="text-sm text-nilin-warmGray mt-1">Clicks</div>
                    </div>
                    <div className="bg-green-50/50 rounded-xl p-4 text-center border border-green-100">
                      <div className="text-3xl font-bold text-green-600">
                        {analyticsData.totalBookings}
                      </div>
                      <div className="text-sm text-nilin-warmGray mt-1">Bookings</div>
                    </div>
                    <div className="bg-nilin-peach/40 rounded-xl p-4 text-center border border-nilin-border">
                      <div className="text-3xl font-bold text-nilin-charcoal">
                        {analyticsData.popularityScore}
                      </div>
                      <div className="text-sm text-nilin-warmGray mt-1">Popularity score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-nilin-coral/10 rounded-xl p-4 border border-nilin-coral/20 text-center">
                      <p className="text-sm text-nilin-charcoal font-medium">Click-through rate</p>
                      <p className="text-2xl font-bold text-nilin-rose mt-1">
                        {analyticsData.conversionRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-nilin-warmGray mt-1">Clicks ÷ impressions</p>
                    </div>
                    <div className="bg-nilin-warning/20 rounded-xl p-4 border border-nilin-warning/30 text-center">
                      <p className="text-sm text-nilin-charcoal font-medium">Booking rate</p>
                      <p className="text-2xl font-bold text-nilin-charcoal mt-1">
                        {analyticsData.bookingRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-nilin-warmGray mt-1">Bookings ÷ clicks</p>
                    </div>
                  </div>

                  <div className="bg-nilin-peach/30 rounded-xl p-4 border border-nilin-coral/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-nilin-charcoal">Average rating</span>
                      {analyticsService.rating.count > 0 ? (
                        <span className="text-lg font-bold text-nilin-rose">
                          {analyticsService.rating.average.toFixed(1)} ({analyticsService.rating.count})
                        </span>
                      ) : (
                        <span className="text-sm text-nilin-warmGray">No reviews yet</span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-nilin-border pt-4 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-nilin-warmGray">Status</span>
                      {getStatusBadge(analyticsService.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-nilin-warmGray">Category</span>
                      <span className="font-medium text-nilin-charcoal">{analyticsService.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-nilin-warmGray">Price</span>
                      <span className="font-medium text-nilin-charcoal">
                        {analyticsService.price.currency}{' '}
                        {analyticsService.price.type === 'custom'
                          ? 'Custom quote'
                          : analyticsService.price.amount}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-nilin-border bg-nilin-muted/30">
              <button type="button" onClick={closeAnalyticsModal} className="btn-nilin w-full">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Service"
        message={`Permanently delete "${deletingServiceName}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteModal}
        title="Delete Multiple Services"
        message={`Permanently delete ${selectedServices.size} service(s)? This cannot be undone.`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isBulkOperating}
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDeleteModal(false)}
      />

      {/* Status Toggle Confirmation Modal */}
      <ConfirmModal
        isOpen={showStatusModal}
        title={statusModalService?.currentStatus === 'active' ? 'Deactivate Service' : 'Activate Service'}
        message={
          statusModalService?.currentStatus === 'active'
            ? `Deactivate "${statusModalService?.name}"? Customers won't be able to book it.`
            : `Activate "${statusModalService?.name}"? It will be visible to customers.`
        }
        confirmLabel={statusModalService?.currentStatus === 'active' ? 'Deactivate' : 'Activate'}
        cancelLabel="Cancel"
        variant="warning"
        isLoading={isToggling}
        onConfirm={() => {
          if (statusModalService) {
            void toggleServiceStatus(statusModalService.id, statusModalService.currentStatus);
          }
          setShowStatusModal(false);
          setStatusModalService(null);
        }}
        onCancel={() => {
          setShowStatusModal(false);
          setStatusModalService(null);
        }}
      />

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nilin-charcoal/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-nilin-strong rounded-nilin-lg shadow-nilin-lg max-w-md w-full border border-nilin-border animate-modal-enter">
            <div className="px-6 py-4 bg-gradient-to-r from-nilin-rose to-nilin-coral flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-white" />
                <h2 className="text-lg font-serif text-white">Keyboard Shortcuts</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="p-2 hover:bg-white/15 rounded-nilin transition-colors text-white/90 hover:text-white"
                aria-label="Close keyboard shortcuts"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-nilin-border/50">
                  <span className="text-sm text-nilin-charcoal">Focus search</span>
                  <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">/</kbd>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-nilin-border/50">
                  <span className="text-sm text-nilin-charcoal">Clear search / filters</span>
                  <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">Esc</kbd>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-nilin-border/50">
                  <span className="text-sm text-nilin-charcoal">Add new service</span>
                  <div className="flex gap-1">
                    <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">n</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-nilin-border/50">
                  <span className="text-sm text-nilin-charcoal">Navigate rows</span>
                  <div className="flex gap-1">
                    <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border"><ArrowUp className="w-3 h-3 inline" /></kbd>
                    <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border"><ArrowDown className="w-3 h-3 inline" /></kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-nilin-border/50">
                  <span className="text-sm text-nilin-charcoal">Edit focused service</span>
                  <div className="flex gap-1">
                    <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">e</kbd>
                    <span className="text-nilin-lightGray text-sm">or</span>
                    <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">Enter</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-nilin-border/50">
                  <span className="text-sm text-nilin-charcoal">Delete focused service</span>
                  <div className="flex gap-1">
                    <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">Del</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-nilin-charcoal">Show shortcuts</span>
                  <kbd className="px-3 py-1.5 bg-nilin-muted rounded-nilin text-sm font-mono text-nilin-charcoal border border-nilin-border">?</kbd>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-nilin-border bg-nilin-muted/30">
              <button type="button" onClick={() => setShowShortcutsHelp(false)} className="btn-nilin w-full">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={showRestoreModal}
        title="Restore Service"
        message={`Restore "${restoringServiceName}"? The service will be moved back to your services list.`}
        confirmLabel="Restore"
        cancelLabel="Cancel"
        variant="default"
        isLoading={isRestoring}
        onConfirm={confirmRestore}
        onCancel={cancelRestore}
      />

      {/* Permanent Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showPermanentDeleteModal}
        title="Permanently Delete Service"
        message={`Permanently delete "${permanentDeletingServiceName}"? This action cannot be undone and the service will be lost forever.`}
        confirmLabel="Delete Forever"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isPermanentDeleting}
        onConfirm={confirmPermanentDelete}
        onCancel={cancelPermanentDelete}
      />
    </div>
  );
};

export default ServiceManagement;