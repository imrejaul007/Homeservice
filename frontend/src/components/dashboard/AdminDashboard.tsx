import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import PageLayout from '../layout/PageLayout';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  Shield,
  BarChart3,
  Calendar,
  DollarSign,
  Activity,
  LogOut,
  Search,
  Filter,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RefreshCw,
  Download,
  Plus,
  Pause
} from 'lucide-react';

// Types
interface DashboardStats {
  totalUsers: number;
  totalCustomers: number;
  totalProviders: number;
  pendingVerifications: number;
  activeBookings: number;
  totalRevenue: number;
  monthlyGrowth: number;
  systemHealth: 'good' | 'warning' | 'critical';
}

interface Service {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  tags: string[];
  status: string;
  providerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    businessInfo?: {
      businessName: string;
    };
  };
  images: string[];
  createdAt: string;
  updatedAt: string;
  rating: {
    average: number;
    count: number;
  };
  isActive: boolean;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  accountStatus: string;
  createdAt: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  loyaltySystem: {
    totalCoins: number;
    tier: string;
  };
}

interface ServiceStats {
  total: number;
  active: number;
  inactive: number;
  pendingReview: number;
  draft: number;
  approvalRate: number;
}

interface UserStats {
  total: number;
  customers: number;
  providers: number;
  admins: number;
  active: number;
  suspended: number;
  verified: number;
}

interface ProviderForVerification {
  _id: string;
  userId: {
    _id: string;
    email: string;
    role: string;
    accountStatus: string;
    createdAt: string;
    firstName: string;
    lastName: string;
  };
  businessInfo: {
    businessName: string;
    businessType: string;
    description: string;
    tagline: string;
    serviceRadius: number;
  };
  verificationStatus: {
    overall: 'pending' | 'approved' | 'rejected';
    identity: { status: 'pending' | 'verified' | 'rejected' };
    business: { status: 'pending' | 'verified' | 'rejected' };
    background: { status: 'pending' | 'verified' | 'rejected' };
    adminNotes?: string;
  };
  completionPercentage: number;
  activeServicesCount: number;
  createdAt: string;
  services?: Service[];
}

// Service Row Component (moved outside to prevent re-creation)
const ServiceRow: React.FC<{
  service: Service;
  onStatusUpdate: (id: string, status: string) => void;
}> = ({ service, onStatusUpdate }) => {
  if (!service || !service._id) {
    return <div className="p-3 text-red-500">Invalid service data</div>;
  }

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {service.status === 'active' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {service.status === 'pending_review' && <Clock className="h-4 w-4 text-yellow-500" />}
            {service.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
            {service.status === 'inactive' && <Pause className="h-4 w-4 text-gray-500" />}
          </div>

          <div>
            <h6 className="text-sm font-medium text-gray-900">{service.name || 'Untitled Service'}</h6>
            <p className="text-xs text-gray-500">
              {service.category || 'Unknown'} • AED {service.price?.amount || 0} • ⭐ {service.rating?.average || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          service.status === 'active' ? 'bg-green-100 text-green-800' :
          service.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
          service.status === 'rejected' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {service.status ? service.status.replace('_', ' ') : 'Unknown'}
        </span>

        <select
          value={service.status || 'pending_review'}
          onChange={(e) => onStatusUpdate(service._id, e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="pending_review">Pending Review</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </div>
  );
};

// Provider Service Card Component (moved outside)
const ProviderServiceCard: React.FC<{
  provider: ProviderForVerification;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onServiceStatusUpdate: (id: string, status: string) => void;
}> = ({ provider, isExpanded, onToggleExpand, onServiceStatusUpdate }) => {
  if (!provider || !provider._id) {
    return <div className="p-4 text-red-500">Invalid provider data</div>;
  }

  const pendingServicesCount = (provider.services || []).filter(s => s.status === 'pending_review').length;
  const activeServicesCount = (provider.services || []).filter(s => s.status === 'active').length;

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Provider Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {isExpanded ?
                <ChevronDown className="h-5 w-5 text-gray-400" /> :
                <ChevronRight className="h-5 w-5 text-gray-400" />
              }
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {provider.businessInfo?.businessName || 'Unknown Business'}
              </h4>
              <p className="text-xs text-gray-500">
                {provider.userId?.firstName || ''} {provider.userId?.lastName || ''} • {provider.userId?.email || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                {activeServicesCount} Active
              </span>
              {pendingServicesCount > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                  {pendingServicesCount} Pending
                </span>
              )}
            </div>

            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              provider.verificationStatus?.overall === 'approved' ?
                'bg-green-100 text-green-800' :
                provider.verificationStatus?.overall === 'pending' ?
                'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
            }`}>
              {provider.verificationStatus?.overall || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Services List */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3">
              Services ({(provider.services || []).length})
            </h5>

            {(provider.services || []).length === 0 ? (
              <p className="text-sm text-gray-500 italic">No services created yet</p>
            ) : (
              <div className="space-y-2">
                {(provider.services || []).map((service) => (
                  <ServiceRow
                    key={service._id}
                    service={service}
                    onStatusUpdate={onServiceStatusUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Pending Service Card Component (moved outside)
const PendingServiceCard: React.FC<{
  service: Service;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
}> = ({ service, isSelected, onSelect, onApprove, onReject }) => {
  if (!service || !service._id) {
    return <div className="p-4 text-red-500">Invalid service data</div>;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <div>
            <h4 className="text-sm font-medium text-gray-900">{service.name || 'Untitled Service'}</h4>
            <p className="text-xs text-gray-500">
              {service.category || 'Unknown'} • AED {service.price?.amount || 0} •
              Provider: {service.providerId?.businessInfo?.businessName || service.providerId?.email || 'Unknown'}
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={onReject}
            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Reject
          </button>
          <button
            onClick={onApprove}
            className="inline-flex items-center px-2.5 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Approve
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Submitted: {service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'Unknown'} •
        {service.description ? service.description.substring(0, 100) + '...' : 'No description'}
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // State
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCustomers: 0,
    totalProviders: 0,
    pendingVerifications: 0,
    activeBookings: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,
    systemHealth: 'good'
  });

  // Services State
  const [services, setServices] = useState<Service[]>([]);
  const [serviceStats, setServiceStats] = useState<ServiceStats>({
    total: 0,
    active: 0,
    inactive: 0,
    pendingReview: 0,
    draft: 0,
    approvalRate: 0
  });

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    total: 0,
    customers: 0,
    providers: 0,
    admins: 0,
    active: 0,
    suspended: 0,
    verified: 0
  });

  // Providers State
  const [providers, setProviders] = useState<ProviderForVerification[]>([]);

  // Enhanced Provider-Service Management
  const [providersWithServices, setProvidersWithServices] = useState<ProviderForVerification[]>([]);
  const [pendingServices, setPendingServices] = useState<Service[]>([]);

  // Loading and Error States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section Visibility
  const [showVerifications, setShowVerifications] = useState(true);
  const [showPendingServices, setShowPendingServices] = useState(false);
  const [showProvidersServices, setShowProvidersServices] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  // Interactive States
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // Filters and Search
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Modals
  const [selectedProvider, setSelectedProvider] = useState<ProviderForVerification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (showServices) {
      fetchServices();
    }
  }, [showServices, serviceSearch, serviceStatusFilter]);

  useEffect(() => {
    if (showUsers) {
      fetchUsers();
    }
  }, [showUsers, userSearch, userRoleFilter]);

  useEffect(() => {
    if (showProvidersServices) {
      fetchProvidersWithServices();
    }
  }, [showProvidersServices]);

  useEffect(() => {
    if (showPendingServices) {
      fetchPendingServices();
    }
  }, [showPendingServices]);

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchDashboardStats(),
        fetchProviders()
      ]);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const data = await authService.get<{success: boolean, data: any}>('/admin/providers/stats');
      if (data.success) {
        const stats = data.data.stats;
        setStats({
          totalUsers: stats.total || 0,
          totalCustomers: Math.floor((stats.total || 0) * 0.7),
          totalProviders: stats.total || 0,
          pendingVerifications: stats.pending || 0,
          activeBookings: Math.floor((stats.approved || 0) * 0.6),
          totalRevenue: (stats.approved || 0) * 1200,
          monthlyGrowth: stats.approvalRate || 0,
          systemHealth: 'good' as const
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchProviders = async () => {
    try {
      const data = await authService.get<{success: boolean, data: any}>('/admin/providers/pending?limit=10');
      if (data.success) {
        setProviders(data.data.providers);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchProvidersWithServices = async () => {
    try {
      const data = await authService.get<{success: boolean, data: any}>('/admin/providers-with-services?limit=50');
      if (data.success) {
        setProvidersWithServices(data.data.providers);
      }
    } catch (error) {
      console.error('Error fetching providers with services:', error);
    }
  };

  const fetchPendingServices = async () => {
    try {
      const data = await authService.get<{success: boolean, data: any}>('/admin/services/pending?limit=50');
      if (data.success) {
        setPendingServices(data.data.services);
      }
    } catch (error) {
      console.error('Error fetching pending services:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: '20',
        ...(serviceStatusFilter !== 'all' && { status: serviceStatusFilter }),
        ...(serviceSearch && { search: serviceSearch }),
      });

      const data = await authService.get<{success: boolean, data: any}>(`/admin/services?${queryParams}`);
      if (data.success) {
        setServices(data.data.services);
      }

      // Fetch service stats
      try {
        const statsData = await authService.get<{success: boolean, data: any}>('/admin/services/stats');
        if (statsData.success) {
          setServiceStats(statsData.data.stats);
        }
      } catch (statsError) {
        console.error('Error fetching service stats:', statsError);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: '20',
        ...(userRoleFilter !== 'all' && { role: userRoleFilter }),
        ...(userSearch && { search: userSearch }),
      });

      const data = await authService.get<{success: boolean, data: any}>(`/admin/users?${queryParams}`);
      if (data.success) {
        setUsers(data.data.users);
      }

      // Fetch user stats
      try {
        const statsData = await authService.get<{success: boolean, data: any}>('/admin/users/stats');
        if (statsData.success) {
          setUserStats(statsData.data.stats);
        }
      } catch (userStatsError) {
        console.error('Error fetching user stats:', userStatsError);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleVerificationAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const endpoint = `/admin/providers/${id}/${action}`;
      const body = action === 'approve' ?
        { notes: 'Approved by admin' } :
        { reason: 'incomplete-documentation', notes: 'Rejected by admin' };

      const response = await authService.post(endpoint, body);

      if ((response as any).success) {
        await fetchProviders();
        await fetchDashboardStats();
        if (selectedProvider && selectedProvider._id === id) {
          setIsModalOpen(false);
          setSelectedProvider(null);
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing provider:`, error);
      setError(`Failed to ${action} provider`);
    }
  };

  const handleServiceStatusUpdate = async (serviceId: string, newStatus: string) => {
    try {
      const response = await authService.patch(`/admin/services/${serviceId}/status`, { status: newStatus });

      if ((response as any).success) {
        // Refresh relevant data
        if (showProvidersServices) await fetchProvidersWithServices();
        if (showServices) await fetchServices();
        if (showPendingServices) await fetchPendingServices();
      }
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  };

  const handleServiceAction = async (serviceId: string, action: 'approve' | 'reject') => {
    const newStatus = action === 'approve' ? 'active' : 'rejected';
    await handleServiceStatusUpdate(serviceId, newStatus);
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedServices.size === 0) return;

    try {
      const response = await authService.post('/admin/services/batch-action', {
        serviceIds: Array.from(selectedServices),
        action,
        reason: action === 'reject' ? 'Batch rejection by admin' : undefined
      });

      if ((response as any).success) {
        await fetchPendingServices();
        await fetchProvidersWithServices();
        setSelectedServices(new Set());
        alert(`Successfully ${action}d ${(response as any).data.modified} services`);
      }
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      alert(`Failed to ${action} services`);
    }
  };

  const toggleProviderExpansion = (providerId: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  };

  const handleUserStatusUpdate = async (userId: string, newStatus: string) => {
    try {
      const response = await authService.patch(`/admin/users/${userId}/status`, { status: newStatus });

      if ((response as any).ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Admin Dashboard"
      subtitle={`Welcome back, ${user?.firstName}`}
      headerActions={
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">
            {user?.firstName} {user?.lastName}
          </span>
          <button
            onClick={() => alert('Settings coming soon')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
          <button
            onClick={() => window.open('/admin/reports', '_blank')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </button>
        </div>
      }
    >
      {/* Error Alert */}
      {error && (
        <div className="rounded-md p-4 mb-6 bg-red-50 border border-red-200">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm mt-1 text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.totalUsers.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserCheck className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Bookings</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.activeBookings}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">AED {stats.totalRevenue.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Growth Rate</dt>
                  <dd className="text-lg font-medium text-gray-900">+{stats.monthlyGrowth}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Customers</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.totalCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Providers</h3>
                <p className="text-3xl font-bold text-green-600">{stats.totalProviders}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Pending Verifications</h3>
                <p className="text-3xl font-bold text-yellow-600">{stats.pendingVerifications}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Users className="h-5 w-5 mr-2" />
              Manage Users
            </button>
            <button
              onClick={() => setShowProvidersServices(!showProvidersServices)}
              className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              Manage Services & Providers
            </button>
            <button
              onClick={() => setShowPendingServices(!showPendingServices)}
              className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Clock className="h-5 w-5 mr-2" />
              Pending Approvals
            </button>
            <button
              onClick={() => alert('System config coming soon')}
              className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-5 w-5 mr-2" />
              System Config
            </button>
          </div>
        </div>
      </div>

      {/* Provider Verification Section */}
      <div className="mb-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Provider Verifications</h3>
            <button
              onClick={() => setShowVerifications(!showVerifications)}
              className="text-gray-400 hover:text-gray-600"
            >
              {showVerifications ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>

          {showVerifications && (
            <div className="space-y-4">
              {providers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No pending verifications</p>
              ) : (
                providers.map((provider) => (
                  <div key={provider._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{provider.businessInfo.businessName}</h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Provider: {provider.userId.email}</p>
                    <p className="text-xs text-gray-500 mb-3">Submitted: {formatTime(provider.createdAt)}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">{provider.completionPercentage}% complete</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedProvider(provider);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </button>
                        <button
                          onClick={() => handleVerificationAction(provider._id, 'reject')}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleVerificationAction(provider._id, 'approve')}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pending Services Section */}
      {showPendingServices && (
        <div className="mb-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Pending Service Approvals</h3>
                <p className="text-sm text-gray-500">{pendingServices.length} services awaiting approval</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={selectedServices.size === 0}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Bulk Approve ({selectedServices.size})
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={selectedServices.size === 0}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Bulk Reject ({selectedServices.size})
                </button>
                <button
                  onClick={() => setShowPendingServices(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {pendingServices.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No pending services</p>
              ) : (
                pendingServices.map((service) => (
                  <PendingServiceCard
                    key={service._id}
                    service={service}
                    isSelected={selectedServices.has(service._id)}
                    onSelect={() => toggleServiceSelection(service._id)}
                    onApprove={() => handleServiceAction(service._id, 'approve')}
                    onReject={() => handleServiceAction(service._id, 'reject')}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Provider-Service Management Section */}
      {showProvidersServices && (
        <div className="mb-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Providers & Services Management</h3>
                <p className="text-sm text-gray-500">
                  Hierarchical view of providers and their services
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setExpandedProviders(new Set(providersWithServices.map(p => p._id)))}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Expand All
                </button>
                <button
                  onClick={() => setExpandedProviders(new Set())}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  Collapse All
                </button>
                <button
                  onClick={() => fetchProvidersWithServices()}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowProvidersServices(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {providersWithServices.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No providers found</p>
              ) : (
                providersWithServices.map((provider) => (
                  <ProviderServiceCard
                    key={provider._id}
                    provider={provider}
                    isExpanded={expandedProviders.has(provider._id)}
                    onToggleExpand={() => toggleProviderExpansion(provider._id)}
                    onServiceStatusUpdate={handleServiceStatusUpdate}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Management Section */}
      {showUsers && (
        <div className="mb-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">User Management</h3>
              <button
                onClick={() => setShowUsers(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-semibold text-gray-900">{userStats.total}</p>
                <p className="text-sm text-gray-600">Total Users</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-lg font-semibold text-blue-900">{userStats.customers}</p>
                <p className="text-sm text-blue-600">Customers</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-lg font-semibold text-green-900">{userStats.providers}</p>
                <p className="text-sm text-green-600">Providers</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-lg font-semibold text-purple-900">{userStats.admins}</p>
                <p className="text-sm text-purple-600">Admins</p>
              </div>
            </div>

            {/* User Filters */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="customer">Customer</option>
                <option value="provider">Provider</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Users List */}
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</h4>
                      <p className="text-xs text-gray-500">{user.email} • {user.role}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.accountStatus === 'active' ? 'bg-green-100 text-green-800' :
                        user.accountStatus === 'suspended' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.accountStatus}
                      </span>
                      <select
                        value={user.accountStatus}
                        onChange={(e) => handleUserStatusUpdate(user._id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="deactivated">Deactivated</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Joined: {formatTime(user.createdAt)} •
                      {user.isEmailVerified ? ' Verified' : ' Unverified'} •
                      {user.loyaltySystem.tier} tier
                    </p>
                    <div className="flex space-x-1">
                      <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-400' : 'bg-gray-300'}`}></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Provider Details Modal */}
      {isModalOpen && selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedProvider.businessInfo.businessName}
                </h3>
                <p className="text-sm text-gray-500">{selectedProvider.userId.email}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className={`rounded-md p-4 ${
                selectedProvider.verificationStatus.overall === 'pending' ? 'bg-yellow-50 border border-yellow-200' :
                selectedProvider.verificationStatus.overall === 'approved' ? 'bg-green-50 border border-green-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {selectedProvider.verificationStatus.overall === 'pending' && <Clock className="h-5 w-5 text-yellow-400" />}
                    {selectedProvider.verificationStatus.overall === 'approved' && <CheckCircle className="h-5 w-5 text-green-400" />}
                    {selectedProvider.verificationStatus.overall === 'rejected' && <XCircle className="h-5 w-5 text-red-400" />}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${
                      selectedProvider.verificationStatus.overall === 'pending' ? 'text-yellow-800' :
                      selectedProvider.verificationStatus.overall === 'approved' ? 'text-green-800' :
                      'text-red-800'
                    }`}>
                      Status: {selectedProvider.verificationStatus.overall.charAt(0).toUpperCase() + selectedProvider.verificationStatus.overall.slice(1)}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      selectedProvider.verificationStatus.overall === 'pending' ? 'text-yellow-700' :
                      selectedProvider.verificationStatus.overall === 'approved' ? 'text-green-700' :
                      'text-red-700'
                    }`}>
                      Profile Completion: {selectedProvider.completionPercentage}% • {selectedProvider.activeServicesCount} Services
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Business Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Business Type</label>
                    <p className="text-sm text-gray-900 capitalize">{selectedProvider.businessInfo.businessType}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Service Radius</label>
                    <p className="text-sm text-gray-900">{selectedProvider.businessInfo.serviceRadius} miles</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500">Description</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedProvider.businessInfo.description}</p>
                  </div>
                </div>
              </div>

              {selectedProvider.verificationStatus.overall === 'pending' && (
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleVerificationAction(selectedProvider._id, 'reject')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Provider
                  </button>
                  <button
                    onClick={() => handleVerificationAction(selectedProvider._id, 'approve')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Provider
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default AdminDashboard;