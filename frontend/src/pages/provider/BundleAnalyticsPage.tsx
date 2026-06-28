import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Users,
  BarChart3,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { bundleApi, Bundle } from '../../services/bundleApi';
import { formatPrice } from '../../utils/currency';
import toast from 'react-hot-toast';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';

interface BundleAnalyticsData {
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  bookingTrend: Array<{ date: string; count: number; revenue: number }>;
  customerLocations: Array<{ area: string; count: number }>;
  peakBookingDays: Array<{ day: string; count: number }>;
}

const BundleAnalyticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [analytics, setAnalytics] = useState<BundleAnalyticsData | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      loadBundleAnalytics();
    }
  }, [id]);

  const loadBundleAnalytics = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch bundle details
      const bundleData = await bundleApi.getBundle(id!);
      setBundle(bundleData);

      // Fetch analytics from the dedicated endpoint
      try {
        const response = await bundleApi.getAnalytics(id!);
        setAnalyticsError(null);
        setAnalytics({
          totalBookings: response.totalBookings || 0,
          totalRevenue: response.totalRevenue || 0,
          averageRating: response.averageRating || bundleData.averageRating || 0,
          bookingTrend: response.bookingTrend || [],
          customerLocations: response.customerLocations || [],
          peakBookingDays: response.peakBookingDays || [],
        });
      } catch (analyticsError) {
        // Analytics API failed - set error state instead of using derived data
        setAnalyticsError('Unable to load analytics data. Please try again later.');
        toast.error('Analytics temporarily unavailable', { id: 'analytics-unavailable' });
        setAnalytics(null);
      }
    } catch (error) {
      console.error('Failed to load bundle analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-serif text-nilin-charcoal mb-2">Bundle Not Found</h2>
            <p className="text-nilin-warmGray mb-4">The requested bundle could not be found.</p>
            <button
              onClick={() => navigate('/provider/bundles')}
              className="px-4 py-2 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose transition-colors"
            >
              Back to Bundles
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/provider/bundles')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bundles
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 rounded-nilin">
                  <Package className="h-8 w-8 text-nilin-coral" />
                </div>
                <div>
                  <h1 className="text-3xl font-serif text-nilin-charcoal mb-1">{bundle.name}</h1>
                  <p className="text-nilin-warmGray">Bundle Analytics</p>
                </div>
              </div>

              <button
                onClick={() => loadBundleAnalytics(true)}
                disabled={refreshing}
                className="px-4 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Analytics Error Banner */}
          {analyticsError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-nilin-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Analytics Data Unavailable</p>
                <p className="text-sm text-amber-700 mt-0.5">{analyticsError}</p>
              </div>
              <button
                onClick={() => loadBundleAnalytics(true)}
                disabled={refreshing}
                className="text-sm text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-nilin">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-nilin-warmGray mb-1">Total Bookings</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {analytics ? analytics.totalBookings : '--'}
              </p>
            </div>

            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-nilin">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-nilin-warmGray mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {analytics ? formatPrice(analytics.totalRevenue, 'AED') : '--'}
              </p>
            </div>

            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-yellow-100 rounded-nilin">
                  <Users className="h-5 w-5 text-yellow-600" />
                </div>
                <span className="text-xs text-nilin-warmGray">Avg Rating</span>
              </div>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {bundle.averageRating?.toFixed(1) || '0.0'} / 5.0
              </p>
            </div>

            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                  <Calendar className="h-5 w-5 text-nilin-coral" />
                </div>
                <span className="text-xs text-nilin-warmGray">Validity</span>
              </div>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {bundle.validityDays || 30} days
              </p>
            </div>
          </div>

          {/* Bundle Details */}
          <div className="glass-nilin rounded-nilin-lg p-6 mb-8">
            <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Bundle Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-nilin-warmGray mb-1">Price</p>
                <p className="text-xl font-bold text-nilin-charcoal">
                  {formatPrice(bundle.bundlePrice || 0, 'AED')}
                </p>
              </div>
              <div>
                <p className="text-sm text-nilin-warmGray mb-1">Discount</p>
                <p className="text-xl font-bold text-green-600">
                  {bundle.discountPercent || 0}% OFF
                </p>
              </div>
              <div>
                <p className="text-sm text-nilin-warmGray mb-1">Services Included</p>
                <p className="text-xl font-bold text-nilin-charcoal">
                  {bundle.services?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Placeholder for detailed charts - to be implemented */}
          <div className="glass-nilin rounded-nilin-lg p-6">
            <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Booking Trend</h2>
            {!analytics ? (
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-nilin-warmGray">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Booking trend data unavailable</p>
                  <p className="text-sm mt-1">Unable to load analytics at this time</p>
                </div>
              </div>
            ) : analytics.bookingTrend.length > 0 ? (
              <div className="h-64 flex items-end gap-1">
                {analytics.bookingTrend.map((day, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                    style={{ height: '50%' }}
                  />
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-nilin-warmGray">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Booking trend data will appear here</p>
                  <p className="text-sm mt-1">Check back after customers start booking this bundle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BundleAnalyticsPage;