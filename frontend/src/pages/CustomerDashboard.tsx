import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  Clock,
  Package,
  User,
  Users,
  ChevronDown,
  ArrowRight,
  Search,
  Star,
  MapPin,
  LogOut,
  Settings,
  Bell,
  Plus,
  Sparkles,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import ViewProModal from '../components/dashboard/ViewProModal';
import { useAuthStore } from '../stores/authStore';
import { customerDashboardApi, type DashboardStats, type BookingSummary } from '../services/customerDashboardApi';
import { bookingApi } from '../services/bookingApi';
import { formatBookingStatus, type BookingStatus } from '../types/booking.types';

// ============================================
// STATUS CONFIGURATION
// ============================================

const statusConfig: Record<BookingStatus, { color: string; bgColor: string; label: string }> = {
  pending: { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Pending' },
  confirmed: { color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Confirmed' },
  in_progress: { color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'In Progress' },
  completed: { color: 'text-green-600', bgColor: 'bg-green-50', label: 'Completed' },
  cancelled: { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Cancelled' },
  no_show: { color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'No Show' },
  refunded: { color: 'text-teal-600', bgColor: 'bg-teal-50', label: 'Refunded' },
};

// ============================================
// SKELETON COMPONENTS
// ============================================

const StatCardSkeleton = () => (
  <div className="glass-nilin rounded-nilin-lg p-5 animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-full bg-nilin-coral/20" />
      <div className="w-6 h-6 rounded bg-nilin-border/50" />
    </div>
    <div className="h-8 w-16 bg-nilin-border/50 rounded mb-2" />
    <div className="h-4 w-24 bg-nilin-border/30 rounded" />
  </div>
);

const BookingRowSkeleton = () => (
  <tr className="border-b border-nilin-border/30">
    <td className="py-4 px-4"><div className="h-4 w-20 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-32 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-24 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-16 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-6 w-20 bg-nilin-border/30 rounded-full" /></td>
    <td className="py-4 px-4"><div className="h-8 w-16 bg-nilin-border/30 rounded" /></td>
  </tr>
);

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; positive: boolean };
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend
}) => (
  <div className="glass-nilin rounded-nilin-lg p-5 hover:shadow-nilin transition-all duration-300 group">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
          <TrendingUp className={`w-3 h-3 ${!trend.positive && 'rotate-180'}`} />
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-nilin-charcoal mb-1">{value}</div>
    <div className="text-sm text-nilin-warmGray">{title}</div>
    {subtitle && <div className="text-xs text-nilin-warmGray/70 mt-1">{subtitle}</div>}
  </div>
);

// ============================================
// NAVIGATION CARD COMPONENT
// ============================================

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  color: string;
}

const NavCard: React.FC<NavCardProps> = ({ title, description, icon: Icon, href, onClick, color }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      navigate(href);
    }
  };
  return (
    <button
      onClick={handleClick}
      className="text-left w-full glass-nilin rounded-nilin-lg p-5 hover:shadow-nilin transition-all duration-300 group hover:-translate-y-0.5"
    >
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-nilin-charcoal mb-1">{title}</h3>
      <p className="text-sm text-nilin-warmGray">{description}</p>
      <ArrowRight className="w-4 h-4 text-nilin-coral mt-3 group-hover:translate-x-1 transition-transform" />
    </button>
  );
};

// ============================================
// BOOKING ROW COMPONENT
// ============================================

interface BookingRowProps {
  booking: BookingSummary;
  onView: (id: string) => void;
}

const BookingRow: React.FC<BookingRowProps> = ({ booking, onView }) => {
  const status = statusConfig[booking.status] || statusConfig.pending;
  const formattedDate = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <tr className="border-b border-nilin-border/30 hover:bg-nilin-muted/30 transition-colors cursor-pointer" onClick={() => onView(booking._id)}>
      <td className="py-4 px-4">
        <div className="font-mono text-sm text-nilin-coral font-medium">#{booking.bookingNumber.slice(-6)}</div>
      </td>
      <td className="py-4 px-4">
        <div className="font-medium text-nilin-charcoal">{booking.serviceName}</div>
        <div className="text-xs text-nilin-warmGray">{booking.serviceCategory}</div>
      </td>
      <td className="py-4 px-4">
        <div className="text-sm text-nilin-charcoal">{formattedDate}</div>
        <div className="text-xs text-nilin-warmGray">{booking.scheduledTime}</div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-nilin-coral/10 flex items-center justify-center">
            {booking.providerAvatar ? (
              <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5 text-nilin-coral" />
            )}
          </div>
          <span className="text-sm text-nilin-charcoal">{booking.providerName}</span>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <div className="font-semibold text-nilin-charcoal">
          {booking.currency === 'AED' ? 'AED ' : ''}{booking.totalAmount.toFixed(2)}
        </div>
        {booking.duration && (
          <div className="text-xs text-nilin-warmGray flex items-center justify-end gap-1">
            <Clock className="w-3 h-3" />
            {booking.duration} min
          </div>
        )}
      </td>
    </tr>
  );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<BookingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showViewProModal, setShowViewProModal] = useState(false);
  const [showPackagesModal, setShowPackagesModal] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch stats and bookings in parallel
      const [statsData, bookingsData] = await Promise.all([
        customerDashboardApi.getStats(),
        bookingApi.getBookings({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ bookings: [], total: 0 }))
      ]);

      setStats(statsData);

      // Transform bookings to BookingSummary format
      const transformedBookings: BookingSummary[] = bookingsData.bookings.map((booking) => ({
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        duration: booking.duration || booking.estimatedDuration,
        totalAmount: booking.pricing?.totalAmount || booking.pricing?.total || 0,
        currency: booking.pricing?.currency || 'AED',
        serviceName: booking.service?.name || 'Service',
        serviceCategory: booking.service?.category || '',
        providerName: booking.provider
          ? `${booking.provider.firstName}${booking.provider.lastName ? ` ${booking.provider.lastName}` : ''}`
          : 'Provider',
        providerId: booking.provider?._id || '',
        providerAvatar: booking.provider?.avatar,
        createdAt: booking.createdAt,
      }));

      setRecentBookings(transformedBookings);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Calculate active bookings count (from stats API or calculate from booking statuses)
  const activeBookings = stats?.activeBookings ?? 0;

  // Navigation cards configuration
  const navCards = [
    {
      title: 'View Packages',
      description: 'Explore curated service bundles',
      icon: Package,
      onClick: () => setShowPackagesModal(true),
      color: 'bg-gradient-to-br from-purple-500 to-purple-600',
    },
    {
      title: 'Find Professionals',
      description: 'Browse verified service providers',
      icon: Users,
      onClick: () => setShowViewProModal(true),
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
    },
    {
      title: 'Book Service',
      description: 'Quick booking for any service',
      icon: Plus,
      href: '/search',
      color: 'bg-gradient-to-br from-nilin-coral to-nilin-rose',
    },
    {
      title: 'My Bookings',
      description: 'View & manage appointments',
      icon: Calendar,
      href: '/customer/bookings',
      color: 'bg-gradient-to-br from-teal-500 to-teal-600',
    },
  ];

  // Quick actions configuration
  const quickActions = [
    { icon: Search, label: 'Browse Services', onClick: () => navigate('/search') },
    { icon: Bell, label: 'Notifications', onClick: () => navigate('/customer/notifications') },
    { icon: Settings, label: 'Settings', onClick: () => navigate('/customer/profile') },
    { icon: CreditCard, label: 'Wallet', onClick: () => navigate('/customer/wallet') },
  ];

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Handle booking click
  const handleViewBooking = (bookingId: string) => {
    navigate(`/customer/bookings/${bookingId}`);
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <main className="flex-1 w-full">
        {/* Hero Section with Welcome */}
        <div className="bg-gradient-to-br from-nilin-charcoal via-gray-800 to-nilin-charcoal text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Welcome Message */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-serif font-light">
                    Welcome back, {user?.name?.split(' ')[0] || 'there'}
                  </h1>
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-gray-400">
                  {user?.email || 'Manage your bookings and discover new services'}
                </p>
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-nilin-coral flex items-center justify-center">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="font-medium text-white">{user?.name || 'User'}</div>
                    <div className="text-xs text-gray-400 capitalize">{user?.role || 'Customer'}</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showProfileDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProfileDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="p-4 border-b border-nilin-border/30">
                        <div className="font-medium text-nilin-charcoal">{user?.name}</div>
                        <div className="text-sm text-nilin-warmGray">{user?.email}</div>
                      </div>
                      <div className="py-2">
                        <button
                          onClick={() => { navigate('/customer/profile'); setShowProfileDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                        >
                          <User className="w-4 h-4 text-nilin-warmGray" />
                          <span>My Profile</span>
                        </button>
                        <button
                          onClick={() => { navigate('/customer/bookings'); setShowProfileDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                        >
                          <Calendar className="w-4 h-4 text-nilin-warmGray" />
                          <span>My Bookings</span>
                        </button>
                        <button
                          onClick={() => { navigate('/customer/rewards'); setShowProfileDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                        >
                          <Star className="w-4 h-4 text-nilin-warmGray" />
                          <span>Rewards & Points</span>
                        </button>
                        <button
                          onClick={() => { navigate('/customer/wallet'); setShowProfileDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                        >
                          <CreditCard className="w-4 h-4 text-nilin-warmGray" />
                          <span>Wallet</span>
                        </button>
                      </div>
                      <div className="border-t border-nilin-border/30 py-2">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600">!</span>
              </div>
              <div>
                <div className="font-medium">Error loading dashboard</div>
                <div className="text-sm">{error}</div>
              </div>
              <button
                onClick={fetchDashboardData}
                className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Active Bookings"
                  value={activeBookings}
                  icon={Clock}
                  color="bg-gradient-to-br from-amber-500 to-orange-500"
                  subtitle="Pending, confirmed & in progress"
                />
                <StatCard
                  title="Completed"
                  value={stats?.completedBookings || 0}
                  icon={CheckCircle}
                  color="bg-gradient-to-br from-green-500 to-emerald-500"
                  subtitle="Total completed bookings"
                />
                <StatCard
                  title="Total Spent"
                  value={stats?.totalSpent ? `AED ${stats.totalSpent.toFixed(0)}` : 'AED 0'}
                  icon={CreditCard}
                  color="bg-gradient-to-br from-blue-500 to-indigo-500"
                  subtitle={stats?.averageOrderValue ? `Avg. AED ${stats.averageOrderValue.toFixed(0)}/booking` : 'No spending data'}
                />
                <StatCard
                  title="Your Rating"
                  value={stats?.averageRating ? stats.averageRating.toFixed(1) : 'N/A'}
                  icon={Star}
                  color="bg-gradient-to-br from-purple-500 to-pink-500"
                  subtitle="Average service rating"
                />
              </>
            )}
          </div>

          {/* Navigation Cards */}
          <div className="mb-8">
            <h2 className="text-xl font-serif text-nilin-charcoal mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {navCards.map((card) => (
                <NavCard key={card.title} {...card} />
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Recent Bookings Table */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-serif text-nilin-charcoal">Recent Bookings</h2>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="text-sm font-medium text-nilin-coral hover:text-nilin-rose flex items-center gap-1 transition-colors"
                >
                  View All <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="glass-nilin rounded-nilin-lg overflow-hidden">
                {isLoading ? (
                  <table className="w-full">
                    <tbody>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <BookingRowSkeleton key={i} />
                      ))}
                    </tbody>
                  </table>
                ) : recentBookings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-nilin-border/30 bg-nilin-muted/30">
                          <th className="py-3 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">Booking</th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">Service</th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">Date & Time</th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">Provider</th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">Status</th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((booking) => (
                          <BookingRow
                            key={booking._id}
                            booking={booking}
                            onView={handleViewBooking}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-nilin-coral" />
                    </div>
                    <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">No bookings yet</h3>
                    <p className="text-nilin-warmGray mb-4">Start by booking your first service</p>
                    <button
                      onClick={() => navigate('/search')}
                      className="px-6 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl font-medium shadow-nilin-warm hover:shadow-nilin-lg transition-all"
                    >
                      Browse Services
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Quick Actions & Profile Summary */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="glass-nilin rounded-nilin-lg p-5">
                <h3 className="font-semibold text-nilin-charcoal mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-nilin-muted transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
                        <action.icon className="w-4 h-4 text-nilin-coral" />
                      </div>
                      <span className="text-nilin-charcoal font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Summary Card */}
              <div className="glass-nilin rounded-nilin-lg p-5">
                <h3 className="font-semibold text-nilin-charcoal mb-4">Your Profile</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-nilin-coral flex items-center justify-center">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-xl">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-nilin-charcoal">{user?.name || 'User'}</div>
                    <div className="text-sm text-nilin-warmGray">{user?.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-nilin-muted/50 rounded-lg text-center">
                    <div className="text-lg font-bold text-nilin-charcoal">{stats?.totalBookings || 0}</div>
                    <div className="text-xs text-nilin-warmGray">Total Bookings</div>
                  </div>
                  <div className="p-3 bg-nilin-muted/50 rounded-lg text-center">
                    <div className="text-lg font-bold text-nilin-charcoal">
                      {stats?.cancelledBookings || 0}
                    </div>
                    <div className="text-xs text-nilin-warmGray">Cancelled</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/customer/profile')}
                  className="w-full py-2.5 border border-nilin-border text-nilin-charcoal rounded-xl font-medium hover:bg-nilin-muted transition-colors"
                >
                  Edit Profile
                </button>
              </div>

              {/* Help Card */}
              <div className="glass-nilin rounded-nilin-lg p-5 bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-nilin-coral flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-nilin-charcoal">Need Help?</div>
                    <div className="text-xs text-nilin-warmGray">We're here for you</div>
                  </div>
                </div>
                <p className="text-sm text-nilin-warmGray mb-4">
                  Contact our support team for assistance with bookings, payments, or any questions.
                </p>
                <button
                  onClick={() => navigate('/customer/contact')}
                  className="w-full py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* View Pro Modal */}
      <ViewProModal
        open={showViewProModal}
        onOpenChange={setShowViewProModal}
        limit={12}
      />

      {/* Packages Modal - Navigate to packages page */}
      {showPackagesModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-nilin-charcoal/40 backdrop-blur-sm"
            onClick={() => {
              setShowPackagesModal(false);
              navigate('/packages');
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white rounded-nilin-lg shadow-nilin-warm-lg p-6 w-full max-w-sm text-center">
            <div className="w-14 h-14 rounded-full bg-purple-100 mx-auto mb-4 flex items-center justify-center">
              <Package className="w-7 h-7 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">View Packages</h3>
            <p className="text-sm text-nilin-warmGray mb-5">Explore curated service bundles and save more!</p>
            <button
              onClick={() => {
                setShowPackagesModal(false);
                navigate('/packages');
              }}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              Browse Packages
            </button>
            <button
              onClick={() => setShowPackagesModal(false)}
              className="w-full mt-2 py-2 text-sm text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
            >
              Close
            </button>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
};

export default CustomerDashboard;
