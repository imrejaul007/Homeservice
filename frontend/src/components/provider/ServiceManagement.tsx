import React, { useState, useEffect } from 'react';
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
  XCircle
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import { AddServiceModal } from './AddServiceModal';
import { EditServiceModal } from './EditServiceModal';

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
  status: 'draft' | 'active' | 'inactive' | 'pending_review';
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
}

interface PerformanceStats {
  totalViews: number;
  totalClicks: number;
  totalBookings: number;
  conversionRate: number;
}

interface BookingStats {
  newBookings: number;
  pendingRequests: number;
  todaySchedule: number;
  completedThisMonth: number;
}

const ServiceManagement: React.FC = () => {
  const { user, tokens, isAuthenticated } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Date Range Filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Category Filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Stats
  const [serviceStats, setServiceStats] = useState<ServiceStats>({
    total: 0,
    active: 0,
    draft: 0,
    inactive: 0
  });

  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    totalViews: 0,
    totalClicks: 0,
    totalBookings: 0,
    conversionRate: 0
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
  const [addServiceLoading, setAddServiceLoading] = useState(false);

  // Edit Service Modal State
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [newService, setNewService] = useState({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    shortDescription: '',
    duration: 60,
    price: {
      amount: 0,
      currency: 'AED',
      type: 'fixed'
    },
    tags: [] as string[],
    status: 'active'
  });

  // Analytics Modal State
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsService, setAnalyticsService] = useState<Service | null>(null);

  useEffect(() => {
    // Don't make API calls if user is not authenticated as provider
    if (!isAuthenticated || !user || user.role !== 'provider' || !tokens?.accessToken) {
      console.warn('⚠️ User not properly authenticated as provider:', {
        isAuthenticated,
        userRole: user?.role,
        hasTokens: !!tokens?.accessToken
      });
      setError('Please log in as a provider to access this page');
      setLoading(false);
      return;
    }

    fetchServices();
    fetchOverviewStats();
  }, [statusFilter, sortBy, sortOrder, startDate, endDate, categoryFilter, isAuthenticated, user, tokens]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        status: statusFilter,
        sortBy,
        order: sortOrder,
        limit: '20'
      });

      // Add date range filters
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      // Add category filter
      if (categoryFilter !== 'all') queryParams.append('category', categoryFilter);

      // Add search filter
      if (searchTerm) queryParams.append('search', searchTerm);

      const data = await authService.get<{success: boolean, data: {services: Service[]}}>(`/provider/services?${queryParams}`);

      if (!data.success) {
        throw new Error('Failed to fetch services');
      }

      setServices(data.data.services);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverviewStats = async () => {
    try {
      const data = await authService.get<{
        success: boolean,
        data: {
          overview: {
            serviceStats: ServiceStats,
            performanceStats: PerformanceStats,
            bookingStats: BookingStats,
            categories: string[]
          }
        }
      }>('/provider/analytics');

      if (data.success) {
        setServiceStats(data.data.overview.serviceStats);
        setPerformanceStats(data.data.overview.performanceStats);
        setBookingStats(data.data.overview.bookingStats);
        setAvailableCategories(data.data.overview.categories || []);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const openAnalyticsModal = (service: Service) => {
    setAnalyticsService(service);
    setShowAnalyticsModal(true);
  };

  const toggleServiceStatus = async (serviceId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

      const data = await authService.patch<{success: boolean}>(`/provider/services/${serviceId}/status`, { status: newStatus });

      if (data.success) {
        fetchServices(); // Refresh the list
      } else {
        throw new Error('Failed to update service status');
      }
    } catch (err) {
      console.error('Error toggling service status:', err);
      alert('Failed to update service status');
    }
  };

  const deleteService = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const data = await authService.delete<{success: boolean}>(`/provider/services/${serviceId}`);

      if (data.success) {
        fetchServices(); // Refresh the list
        fetchOverviewStats(); // Refresh stats
      } else {
        throw new Error('Failed to delete service');
      }
    } catch (err) {
      console.error('Error deleting service:', err);
      alert('Failed to delete service');
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Inactive
        </span>
      );
    }

    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Edit3 className="w-3 h-3 mr-1" />
            Draft
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Unknown
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Services</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchServices()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Booking Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm border p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-100">New Bookings</p>
              <p className="text-2xl font-bold">{bookingStats.newBookings}</p>
              <p className="text-xs text-blue-200 mt-1">Last 7 days</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-sm border p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-100">Pending Requests</p>
              <p className="text-2xl font-bold">{bookingStats.pendingRequests}</p>
              <p className="text-xs text-yellow-200 mt-1">Awaiting response</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm border p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-100">Today's Schedule</p>
              <p className="text-2xl font-bold">{bookingStats.todaySchedule}</p>
              <p className="text-xs text-purple-200 mt-1">Appointments</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm border p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100">Completed</p>
              <p className="text-2xl font-bold">{bookingStats.completedThisMonth}</p>
              <p className="text-xs text-green-200 mt-1">This month</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Service Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Services</p>
              <p className="text-2xl font-semibold text-gray-900">{serviceStats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Services</p>
              <p className="text-2xl font-semibold text-gray-900">{serviceStats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Views</p>
              <p className="text-2xl font-semibold text-gray-900">{performanceStats.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{performanceStats.conversionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Management */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manage Services</h2>
              <p className="text-sm text-gray-600">Create, edit, and manage your service offerings</p>
            </div>
            <button
              onClick={() => setShowAddServiceModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Service
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
            >
              <option value="all">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Start date"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="End date"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[120px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
              <option value="pending_review">Pending Review</option>
            </select>

            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="views-desc">Most Views</option>
              <option value="popularity-desc">Most Popular</option>
            </select>

            {/* Clear Filters */}
            {(searchTerm || startDate || endDate || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStartDate('');
                  setEndDate('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Services List */}
        <div className="divide-y divide-gray-200">
          {filteredServices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No services found' : 'No services yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms or filters' 
                  : 'Start by creating your first service offering'}
              </p>
              {!searchTerm && (
                <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Service
                </button>
              )}
            </div>
          ) : (
            filteredServices.map((service) => (
              <div key={service._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {service.name}
                      </h3>
                      {getStatusBadge(service.status, service.isActive)}
                      {service.isFeatured && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Star className="w-3 h-3 mr-1" />
                          Featured
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-2">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {service.category}
                      </span>
                      <span className="flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        {service.price.currency || 'AED'} {service.price.amount} {service.price.type}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {service.duration} min
                      </span>
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {service.location.address.city}, {service.location.address.state}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {service.searchMetadata.searchCount} views
                      </span>
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {service.searchMetadata.clickCount} clicks
                      </span>
                      <span className="flex items-center">
                        <Star className="w-4 h-4 mr-1" />
                        {service.rating.average.toFixed(1)} ({service.rating.count} reviews)
                      </span>
                      <span>
                        Updated {new Date(service.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {/* Analytics */}
                    <button
                      onClick={() => openAnalyticsModal(service)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                      title="View Analytics"
                    >
                      <TrendingUp className="w-5 h-5" />
                    </button>

                    {/* Toggle Status */}
                    <button
                      onClick={() => toggleServiceStatus(service._id, service.status)}
                      className={`p-2 rounded-md transition-colors ${
                        service.isActive
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={service.isActive ? 'Deactivate service' : 'Activate service'}
                    >
                      {service.isActive ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingServiceId(service._id);
                        setShowEditServiceModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit service"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    
                    {/* Delete */}
                    <button
                      onClick={() => deleteService(service._id, service.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        onServiceAdded={() => {
          fetchServices();
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
          fetchServices();
          fetchOverviewStats();
        }}
        serviceId={editingServiceId}
      />

      {/* Service Analytics Modal */}
      {showAnalyticsModal && analyticsService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Service Analytics</h2>
                <p className="text-sm text-gray-600">{analyticsService.name}</p>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {analyticsService.searchMetadata.searchCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-600">Total Views</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {analyticsService.searchMetadata.bookingCount}
                  </div>
                  <div className="text-sm text-green-600">Total Bookings</div>
                </div>
              </div>

              {/* Book Rate */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-700">Book Rate</span>
                  <span className="text-lg font-bold text-purple-600">
                    {analyticsService.searchMetadata.clickCount > 0
                      ? ((analyticsService.searchMetadata.bookingCount / analyticsService.searchMetadata.clickCount) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, analyticsService.searchMetadata.clickCount > 0
                        ? (analyticsService.searchMetadata.bookingCount / analyticsService.searchMetadata.clickCount) * 100
                        : 0)}%`
                    }}
                  />
                </div>
                <p className="text-xs text-purple-600 mt-1">
                  {analyticsService.searchMetadata.clickCount} clicks
                </p>
              </div>

              {/* Rating */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-yellow-700">Average Rating</span>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(analyticsService.rating.average)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-bold text-yellow-600">
                      {analyticsService.rating.average.toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-yellow-600 mt-1">
                  Based on {analyticsService.rating.count} reviews
                </p>
              </div>

              {/* Additional Stats */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Popularity Score</span>
                    <span className="font-medium">{analyticsService.searchMetadata.popularityScore}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className="font-medium capitalize">{analyticsService.status}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Category</span>
                    <span className="font-medium">{analyticsService.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price</span>
                    <span className="font-medium">
                      {analyticsService.price.currency} {analyticsService.price.amount}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-medium">{analyticsService.duration} min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;