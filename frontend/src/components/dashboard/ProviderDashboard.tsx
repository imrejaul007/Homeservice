import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import PageLayout from '../layout/PageLayout';
import { bookingService } from '../../services/BookingService';
import { 
  Building, 
  DollarSign, 
  Calendar, 
  Star, 
  TrendingUp, 
  Users, 
  Eye, 
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  Plus,
  ArrowRight,
  BarChart,
  Camera,
  Award,
  Activity
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: string;
}

interface BookingRequest {
  _id: string;
  bookingNumber: string;
  customerName: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress';
  totalAmount: number;
  customer?: {
    firstName: string;
    lastName: string;
  };
  service?: {
    name: string;
  };
  pricing?: {
    totalAmount: number;
  };
}

interface RecentReview {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  serviceName: string;
  date: string;
}

const ProviderDashboard: React.FC = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const { user, providerProfile, logout } = useAuthStore();

  // Mock data - in real app, this would come from API
  const [stats] = useState<StatCard[]>([
    {
      title: 'Monthly Earnings',
      value: providerProfile?.earnings?.totalEarned || 2450,
      subtitle: 'This month',
      icon: DollarSign,
      trend: { value: 12, isPositive: true },
      color: 'bg-green-500'
    },
    {
      title: 'Total Bookings',
      value: 28,
      subtitle: 'This month',
      icon: Calendar,
      trend: { value: 5, isPositive: true },
      color: 'bg-blue-500'
    },
    {
      title: 'Average Rating',
      value: providerProfile?.ratings?.average || 4.8,
      subtitle: `${providerProfile?.ratings?.count || 45} reviews`,
      icon: Star,
      color: 'bg-yellow-500'
    },
    {
      title: 'Profile Views',
      value: providerProfile?.analytics?.profileViews || 156,
      subtitle: 'This week',
      icon: Eye,
      trend: { value: 23, isPositive: true },
      color: 'bg-purple-500'
    }
  ]);


  const [recentReviews] = useState<RecentReview[]>([
    {
      id: '1',
      customerName: 'Jessica Davis',
      rating: 5,
      comment: 'Amazing service! Very thorough and professional. Will definitely book again.',
      serviceName: 'Deep Cleaning',
      date: '2024-01-20'
    },
    {
      id: '2',
      customerName: 'Robert Miller',
      rating: 4,
      comment: 'Good job overall, arrived on time and did quality work.',
      serviceName: 'Regular Cleaning',
      date: '2024-01-18'
    },
    {
      id: '3',
      customerName: 'Amanda Taylor',
      rating: 5,
      comment: 'Exceeded expectations! House looks incredible. Highly recommend.',
      serviceName: 'Move-out Cleaning',
      date: '2024-01-15'
    }
  ]);

  // Fetch booking requests
  useEffect(() => {
    const fetchBookingRequests = async () => {
      try {
        setLoadingBookings(true);
        const response = await bookingService.getProviderBookings({
          status: 'pending',
          limit: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });

        if (response.success && response.data.bookings) {
          const transformedBookings = response.data.bookings.map((booking: any) => {
            // Resolve customer name: try populated customer, then customerInfo snapshot, then guestInfo
            const firstName = booking.customer?.firstName || booking.customerInfo?.firstName || booking.guestInfo?.name?.split(' ')[0];
            const lastName = booking.customer?.lastName || booking.customerInfo?.lastName || booking.guestInfo?.name?.split(' ').slice(1).join(' ');
            const customerName = (firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : (booking.isGuestBooking ? 'Guest' : 'Customer');

            return {
            _id: booking._id,
            bookingNumber: booking.bookingNumber,
            customerName,
            serviceName: booking.service?.name || 'Service',
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
            status: booking.status,
            totalAmount: booking.pricing?.totalAmount || 0,
            customer: booking.customer,
            service: booking.service,
            pricing: booking.pricing
          };
          });
          setBookingRequests(transformedBookings);
        }
      } catch (error) {
        console.error('Error fetching booking requests:', error);
        setBookingRequests([]);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchBookingRequests();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getVerificationStatusDisplay = () => {
    // Get verification status with proper fallbacks
    const verificationStatus = providerProfile?.verificationStatus;
    const status = verificationStatus?.overall || (typeof verificationStatus === 'string' ? verificationStatus : 'pending');

    // Debug logging
    console.log('🔍 Provider Profile Debug:', {
      hasProviderProfile: !!providerProfile,
      verificationStatus: providerProfile?.verificationStatus,
      overallStatus: providerProfile?.verificationStatus?.overall,
      statusUsed: status
    });
    const config = {
      pending: { 
        color: 'text-yellow-600 bg-yellow-100', 
        icon: Clock, 
        text: 'Verification Pending',
        description: 'Your account is under review. We\'ll notify you once approved.'
      },
      approved: { 
        color: 'text-green-600 bg-green-100', 
        icon: CheckCircle, 
        text: 'Verified Provider',
        description: 'Your account is verified and active.'
      },
      rejected: { 
        color: 'text-red-600 bg-red-100', 
        icon: XCircle, 
        text: 'Verification Rejected',
        description: 'Please review your documents and resubmit.'
      },
      suspended: { 
        color: 'text-red-600 bg-red-100', 
        icon: AlertTriangle, 
        text: 'Account Suspended',
        description: 'Contact support for assistance.'
      }
    };
    
    return config[status];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'in_progress':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const verificationStatus = getVerificationStatusDisplay();
  const StatusIcon = verificationStatus.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">🏠 Provider Dashboard</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <Building className="h-5 w-5 text-white" />
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 text-gray-500" />
                </button>

                {showUserMenu && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b">
                        <div className="font-medium">{providerProfile?.businessInfo?.businessName || `${user?.firstName} ${user?.lastName}`}</div>
                        <div className="text-gray-500">{user?.email}</div>
                      </div>
                      <Link
                        to="/provider/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Business Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">
                  {getGreeting()}, {user?.firstName}! 💼
                </h2>
                <p className="text-green-100 mb-4">
                  Manage your business, track earnings, and connect with customers.
                </p>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    <span>AED {providerProfile?.earnings?.availableBalance || 0} available</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    <span>{providerProfile?.ratings?.average || 0} avg rating</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{providerProfile?.analytics?.repeatCustomers || 0} repeat customers</span>
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <Link
                  to="/provider/services"
                  className="bg-white text-green-600 px-6 py-3 rounded-lg font-medium hover:bg-green-50 transition-colors inline-flex items-center"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Status Banner */}
        {providerProfile?.verificationStatus?.overall !== 'approved' && (
          <div className={`mb-8 rounded-lg p-4 ${verificationStatus.color.replace('text-', 'bg-').replace('600', '50')}`}>
            <div className="flex items-center">
              <StatusIcon className={`h-5 w-5 mr-3 ${verificationStatus.color.split(' ')[0]}`} />
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${verificationStatus.color.split(' ')[0]}`}>
                  {verificationStatus.text}
                </h3>
                <p className={`text-sm ${verificationStatus.color.split(' ')[0]} opacity-75 mt-1`}>
                  {verificationStatus.description}
                </p>
              </div>
              {providerProfile?.verificationStatus?.overall === 'rejected' && (
                <Link
                  to="/provider/verification"
                  className="text-sm font-medium text-red-700 hover:text-red-800"
                >
                  Update Documents
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            to="/provider/services"
            className="group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Manage Services</h3>
                <p className="text-xs text-gray-500">Create & edit services</p>
              </div>
            </div>
          </Link>

          <Link
            to="/provider/bookings"
            className="group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">View Bookings</h3>
                <p className="text-xs text-gray-500">Manage appointments</p>
              </div>
            </div>
          </Link>

          <Link
            to="/provider/analytics"
            className="group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <BarChart className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Analytics</h3>
                <p className="text-xs text-gray-500">Performance insights</p>
              </div>
            </div>
          </Link>

          <Link
            to="/provider/profile"
            className="group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                <Award className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Business Profile</h3>
                <p className="text-xs text-gray-500">Update business info</p>
              </div>
            </div>
          </Link>

          <Link
            to="/provider/availability"
            className="group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <Clock className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-900">Availability</h3>
                <p className="text-xs text-gray-500">Manage your schedule</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <div className="flex items-baseline">
                      <p className="text-2xl font-semibold text-gray-900">
                        {typeof stat.value === 'number' && stat.title.includes('Earnings') ? `$${stat.value}` : stat.value}
                      </p>
                      {stat.trend && (
                        <span className={`ml-2 text-sm font-medium ${
                          stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stat.trend.isPositive ? '+' : '-'}{stat.trend.value}
                        </span>
                      )}
                    </div>
                    {stat.subtitle && (
                      <p className="text-sm text-gray-500">{stat.subtitle}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Booking Requests */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Booking Requests</h3>
                <Link
                  to="/provider/bookings"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium flex items-center"
                >
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading booking requests...</span>
                </div>
              ) : bookingRequests.length > 0 ? (
                <div className="space-y-4">
                  {bookingRequests.map((request) => (
                    <div key={request._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{request.customerName}</h4>
                          <p className="text-sm text-gray-500">{request.serviceName}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {getStatusDisplayText(request.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Calendar className="mr-1 h-4 w-4" />
                          {formatDate(request.scheduledDate)} at {request.scheduledTime}
                        </div>
                        <div className="font-medium text-gray-900">
                          ${request.totalAmount}
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button className="flex-1 bg-green-600 text-white text-xs py-2 px-3 rounded-md hover:bg-green-700">
                            Accept
                          </button>
                          <button className="flex-1 bg-gray-300 text-gray-700 text-xs py-2 px-3 rounded-md hover:bg-gray-400">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No pending booking requests</h3>
                  <p className="mt-1 text-sm text-gray-500">New requests will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Reviews */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Recent Reviews</h3>
                <Link
                  to="/provider/reviews"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium flex items-center"
                >
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {recentReviews.length > 0 ? (
                <div className="space-y-4">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {review.customerName.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-gray-900">{review.customerName}</h4>
                            <p className="text-xs text-gray-500">{review.serviceName} • {formatDate(review.date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No reviews yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Customer reviews will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              to="/provider/services"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Plus className="h-8 w-8 text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Add Service</span>
            </Link>
            <Link
              to="/provider/availability"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Calendar className="h-8 w-8 text-green-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Manage Availability</span>
            </Link>
            <Link
              to="/provider/portfolio"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Camera className="h-8 w-8 text-purple-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Update Portfolio</span>
            </Link>
            <Link
              to="/provider/analytics"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <BarChart className="h-8 w-8 text-indigo-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">View Analytics</span>
            </Link>
            <Link
              to="/provider/profile"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Settings className="h-8 w-8 text-gray-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Settings</span>
            </Link>
          </div>
        </div>

        {/* Business Performance Overview */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">This Month Performance</h4>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Booking Rate</span>
                <span className="text-sm font-medium text-gray-900">78%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Response Time</span>
                <span className="text-sm font-medium text-gray-900">2.5 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="text-sm font-medium text-gray-900">95%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">Revenue Breakdown</h4>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Earned</span>
                <span className="text-sm font-medium text-gray-900">AED {providerProfile?.earnings?.totalEarned || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Available</span>
                <span className="text-sm font-medium text-green-600">AED {providerProfile?.earnings?.availableBalance || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="text-sm font-medium text-yellow-600">AED {providerProfile?.earnings?.pendingBalance || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">Recognition</h4>
              <Award className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overall Rating</span>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                  <span className="text-sm font-medium text-gray-900">{providerProfile?.ratings?.average || 0}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Reviews</span>
                <span className="text-sm font-medium text-gray-900">{providerProfile?.ratings?.count || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Badge</span>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Top Rated</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;