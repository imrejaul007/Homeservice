import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import { useToastActions } from '../common/Toast';
import { socketService } from '../../services/socket';
import { AddServiceModal } from './AddServiceModal';
import { EditServiceModal } from './EditServiceModal';

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    default: 'bg-nilin-coral hover:bg-nilin-coral/90 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
        <div className="text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-amber-100' : 'bg-nilin-blush'
          }`}>
            {variant === 'danger' ? (
              <AlertCircle className="w-6 h-6 text-red-600" />
            ) : variant === 'warning' ? (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-nilin-coral" />
            )}
          </div>
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">{title}</h3>
          <p className="text-sm text-nilin-warmGray mb-6">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-nilin font-medium transition-colors disabled:opacity-50 ${buttonStyles[variant]}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  createdAt: string;
  updatedAt: string;
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
function useCallbackRef<T extends (...args: never[]) => unknown>(callback: T): React.MutableRefObject<T> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return callbackRef;
}

const ServiceManagement: React.FC = () => {
  const { user, tokens, isAuthenticated } = useAuthStore();
  const toast = useToastActions();
  const toastRef = useCallbackRef(toast);

  const userRole = user?.role;
  const isProvider = isAuthenticated && userRole === 'provider' && !!tokens?.accessToken;

  const [services, setServices] = useState<Service[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortBy, sortOrder, startDate, endDate, categoryFilter, searchTerm]);

  const fetchServices = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!isProvider) {
        return;
      }

      try {
        if (pageNum === 1 && !append) {
          setListLoading(true);
        } else {
          setListLoading(true);
        }
        setError(null);

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
        console.error('Error fetching services:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch services');
        toastRef.current.error(
          'Failed to load services',
          err instanceof Error ? err.message : 'An error occurred'
        );
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
    ]
  );

  const fetchOverviewStats = useCallback(async () => {
    if (!isProvider) return;

    try {
      setOverviewLoading(true);
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
      console.error('Error fetching overview stats:', err);
      toastRef.current.error(
        'Failed to load overview',
        err instanceof Error ? err.message : 'An error occurred'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [isProvider]);

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
      setError('Please log in as a provider to access this page');
      setOverviewLoading(false);
      setListLoading(false);
      return;
    }

    void fetchOverviewStats();
  }, [isProvider, fetchOverviewStats]);

  // Socket listeners for real-time service status updates
  useEffect(() => {
    if (!isProvider) return;

    const unsubServiceApproved = socketService.onServiceApproved(() => {
      if (isMountedRef.current) {
        toastRef.current.success('Service Approved', 'Your service has been approved and is now active.');
        void fetchServicesRef.current(1, false);
        void fetchOverviewStatsRef.current();
      }
    });

    const unsubServiceRejected = socketService.onServiceRejected((data) => {
      if (isMountedRef.current) {
        toastRef.current.error('Service Rejected', data.reason || 'Your service was not approved.');
        void fetchServicesRef.current(1, false);
        void fetchOverviewStatsRef.current();
      }
    });

    return () => {
      unsubServiceApproved();
      unsubServiceRejected();
    };
  }, [isProvider]);

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
      console.error('Error loading service analytics:', err);
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error(
        'Failed to load analytics',
        err instanceof Error ? err.message : 'An error occurred'
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

  const toggleServiceStatus = async (serviceId: string, currentStatus: string) => {
    if (!canToggleService(currentStatus)) {
      toast.error('Cannot change status', 'This service must be approved by admin first.');
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
        setPage(1);
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
        }
      } else {
        throw new Error('Failed to update service status');
      }
    } catch (err) {
      console.error('Error toggling service status:', err);
      toast.error(
        'Status update failed',
        err instanceof Error ? err.message : 'Failed to update service status'
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
        toast.success('Service deleted', data.message || 'The service was permanently removed.');
        setPage(1);
        if (isMountedRef.current) {
          void fetchServicesRef.current(1, false);
          void fetchOverviewStatsRef.current();
        }
      } else {
        throw new Error('Failed to delete service');
      }
    } catch (err) {
      console.error('Error deleting service:', err);
      toast.error(
        'Delete failed',
        err instanceof Error ? err.message : 'Failed to delete service'
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeletingServiceId(null);
      setDeletingServiceName('');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingServiceId(null);
    setDeletingServiceName('');
    setIsDeleting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-muted text-nilin-warmGray border border-nilin-border">
            <Edit3 className="w-3 h-3 mr-1" />
            Draft
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            Inactive
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
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
        <p className="text-nilin-warmGray">{error || 'Please log in as a provider to access this page'}</p>
      </div>
    );
  }

  const overviewSkeleton = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-nilin rounded-nilin-lg p-5 animate-pulse">
          <div className="h-4 bg-nilin-muted rounded w-2/3 mb-3" />
          <div className="h-8 bg-nilin-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Overview stats */}
      <section>
        <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Booking overview</h2>
        {overviewLoading ? (
          overviewSkeleton
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="New Bookings"
            value={bookingStats.newBookings}
            hint="Last 7 days"
            icon={Calendar}
            iconClass="bg-nilin-blush text-nilin-coral"
          />
          <StatCard
            label="Pending Requests"
            value={bookingStats.pendingRequests}
            hint="Awaiting response"
            icon={Clock}
            iconClass="bg-amber-50 text-amber-700"
          />
          <StatCard
            label="Today's Schedule"
            value={bookingStats.todaySchedule}
            hint="Appointments"
            icon={Users}
            iconClass="bg-nilin-muted text-nilin-rose"
          />
          <StatCard
            label="Completed"
            value={bookingStats.completedThisMonth}
            hint="This month"
            icon={CheckCircle}
            iconClass="bg-green-50 text-green-700"
          />
        </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Service performance</h2>
        {overviewLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass-nilin rounded-nilin-lg p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            label="Total Services"
            value={serviceStats.total}
            icon={Calendar}
            iconClass="bg-nilin-blush text-nilin-coral"
          />
          <StatCard
            label="Active Services"
            value={serviceStats.active}
            icon={CheckCircle}
            iconClass="bg-green-50 text-green-700"
          />
          <StatCard
            label="Search Impressions"
            value={performanceStats.totalViews.toLocaleString()}
            hint="All-time · times shown in search"
            icon={Eye}
            iconClass="bg-nilin-muted text-nilin-rose"
          />
          <StatCard
            label="Click-through Rate"
            value={`${performanceStats.conversionRate.toFixed(1)}%`}
            hint="All-time · detail views ÷ impressions"
            icon={TrendingUp}
            iconClass="bg-nilin-peach text-nilin-charcoal"
          />
          <StatCard
            label="Booking Rate"
            value={`${performanceStats.bookingRate.toFixed(1)}%`}
            hint="All-time · completed bookings ÷ detail views"
            icon={Users}
            iconClass="bg-green-50 text-green-700"
          />
        </div>
        )}
      </section>

      {/* Services Management */}
      <div className="glass-nilin rounded-nilin-lg border border-nilin-border/60 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-nilin-border bg-gradient-to-r from-nilin-blush/40 to-nilin-peach/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-serif text-nilin-charcoal">Manage Services</h2>
              <p className="text-sm text-nilin-warmGray mt-0.5">Create, edit, and manage your service offerings</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddServiceModal(true)}
              className="btn-nilin inline-flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add New Service
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-5 border-b border-nilin-border bg-white/40">
          <div className="flex items-center gap-2 mb-4 text-nilin-warmGray">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter & sort</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="block text-xs font-medium text-nilin-warmGray mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray w-4 h-4 pointer-events-none" />
                <input
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
              <label className="block text-xs font-medium text-nilin-warmGray mb-1.5">Sort by</label>
              <select
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
                <option value="name-asc">Name: A-Z</option>
                <option value="views-desc">Most Views</option>
                <option value="popularity-desc">Most Popular</option>
              </select>
            </div>

            <div className="sm:col-span-2 xl:col-span-2">
              <label className="block text-xs font-medium text-nilin-warmGray mb-1.5">Service created between</label>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                <span className="text-nilin-warmGray shrink-0">to</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {(searchTerm || startDate || endDate || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setSortBy('createdAt');
                setSortOrder('desc');
                setPage(1);
              }}
              className="mt-4 text-sm text-nilin-coral hover:text-nilin-rose font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Services List */}
        <div className="p-6">
          {listLoading && services.length === 0 ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-nilin-muted/60 rounded-nilin animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-nilin-warmGray mb-4">{error}</p>
              <button type="button" onClick={() => fetchServices(1, false)} className="btn-nilin">
                Try Again
              </button>
            </div>
          ) : services.length === 0 && !listLoading ? (
            <div className="py-16 text-center">
              <div className="w-20 h-20 bg-nilin-blush/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-10 w-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">
                {searchTerm ? 'No services found' : 'No services yet'}
              </h3>
              <p className="text-nilin-warmGray mb-6 max-w-sm mx-auto">
                {searchTerm
                  ? 'Try adjusting your search terms or filters'
                  : 'Start by creating your first service offering and grow your business'}
              </p>
              {!searchTerm && (
                <button type="button" onClick={() => setShowAddServiceModal(true)} className="btn-nilin inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Your First Service
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {pagination.total > 0 && (
                <p className="text-sm text-nilin-warmGray font-sans">
                  Showing {services.length} of {pagination.total} services
                </p>
              )}
              {services.map((service) => (
                <article
                  key={service._id}
                  className="card-nilin hover-lift p-5 rounded-nilin-lg bg-white/80 border border-nilin-border"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-xl font-serif text-nilin-charcoal">{service.name}</h3>
                        {getStatusBadge(service.status)}
                        {service.isFeatured && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100">
                            <Star className="w-3 h-3 mr-1 fill-amber-400 text-amber-400" />
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                          <Calendar className="w-4 h-4 text-nilin-coral shrink-0" />
                          <span className="truncate">{service.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-nilin-charcoal">
                          <DollarSign className="w-4 h-4 text-nilin-coral shrink-0" />
                          <span>
                            {service.price.currency || 'AED'} {service.price.amount}
                            {service.price.type !== 'fixed' && (
                              <span className="text-xs text-nilin-warmGray font-normal ml-1">({service.price.type})</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>{service.duration} min</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {service.location?.address?.city || '—'}
                            {service.location?.address?.state ? `, ${service.location.address.state}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-nilin-lightGray">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {service.searchMetadata.searchCount} impressions
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {service.searchMetadata.clickCount} detail views
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          {service.rating.count > 0
                            ? `${service.rating.average.toFixed(1)} (${service.rating.count})`
                            : 'No reviews yet'}
                        </span>
                        <span>Updated {new Date(service.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 lg:flex-col lg:items-end shrink-0">
                      <button
                        type="button"
                        onClick={() => openAnalyticsModal(service)}
                        className="p-2.5 text-nilin-rose hover:bg-nilin-blush rounded-nilin transition-colors"
                        title="View analytics"
                      >
                        <TrendingUp className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleServiceStatus(service._id, service.status)}
                        disabled={!canToggleService(service.status) || (isToggling && togglingServiceId === service._id)}
                        className={`p-2.5 rounded-nilin transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          service.status === 'active'
                            ? 'text-green-700 hover:bg-green-50'
                            : canToggleService(service.status)
                              ? 'text-nilin-lightGray hover:bg-nilin-muted'
                              : 'text-nilin-lightGray/50 cursor-not-allowed'
                        }`}
                        title={
                          canToggleService(service.status)
                            ? service.status === 'active'
                              ? 'Deactivate service'
                              : 'Activate service'
                            : 'Awaiting admin approval'
                        }
                      >
                        {service.status === 'active' ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingServiceId(service._id);
                          setShowEditServiceModal(true);
                        }}
                        className="p-2.5 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-nilin transition-colors"
                        title="Edit service"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(service._id, service.name)}
                        className="p-2.5 text-nilin-warmGray hover:text-red-600 hover:bg-red-50 rounded-nilin transition-colors"
                        title="Delete service"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
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
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="px-6 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nilin-charcoal/40 backdrop-blur-sm">
          <div className="glass-nilin-strong rounded-nilin-lg shadow-nilin-lg max-w-lg w-full max-h-[90vh] overflow-hidden border border-nilin-border">
            <div className="px-6 py-4 bg-gradient-to-r from-nilin-rose to-nilin-coral flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif text-white">Service Analytics</h2>
                <p className="text-sm text-white/90 font-sans">{analyticsService.name}</p>
              </div>
              <button
                type="button"
                onClick={closeAnalyticsModal}
                className="p-2 hover:bg-white/15 rounded-nilin transition-colors text-white/90 hover:text-white"
                aria-label="Close"
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
                <div className="rounded-nilin bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                  {analyticsError}
                </div>
              )}

              {analyticsData && !analyticsLoading && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-pink-50 rounded-xl p-4 text-center border border-pink-100">
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
                    <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
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
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 text-center">
                      <p className="text-sm text-purple-700 font-medium">Click-through rate</p>
                      <p className="text-2xl font-bold text-purple-600 mt-1">
                        {analyticsData.conversionRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-purple-600 mt-1">Clicks ÷ impressions</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                      <p className="text-sm text-amber-800 font-medium">Booking rate</p>
                      <p className="text-2xl font-bold text-amber-700 mt-1">
                        {analyticsData.bookingRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-amber-700 mt-1">Bookings ÷ clicks</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-yellow-700">Average rating</span>
                      {analyticsService.rating.count > 0 ? (
                        <span className="text-lg font-bold text-yellow-600">
                          {analyticsService.rating.average.toFixed(1)} ({analyticsService.rating.count})
                        </span>
                      ) : (
                        <span className="text-sm text-yellow-700">No reviews yet</span>
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
    </div>
  );
};

export default ServiceManagement;