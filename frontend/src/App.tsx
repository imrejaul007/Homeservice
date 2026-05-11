import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useBackButton } from './hooks/useBackButton';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
import { 
  ProtectedRoute, 
  CustomerRoute, 
  ProviderRoute, 
  AdminRoute, 
  PublicRoute 
} from './components/auth/ProtectedRoute';

// Import components
import StatusDashboard from './components/StatusDashboard';
import CustomerRegistration from './components/auth/CustomerRegistration';
import ProviderRegistration from './components/auth/ProviderRegistration';
import LoginForm from './components/auth/LoginForm';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import EmailVerification from './components/auth/EmailVerification';
import EmailVerificationRequired from './components/auth/EmailVerificationRequired';
import CustomerDashboard from './components/dashboard/CustomerDashboard';
import StatsView from './components/dashboard/StatsView';
import ProviderDashboard from './components/dashboard/ProviderDashboard';
import AdminDashboard from './components/dashboard/AdminDashboard';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import CategoryPage from './pages/CategoryPage';
import SubcategoryServicePage from './pages/SubcategoryServicePage';
import ProviderDetailPage from './pages/ProviderDetailPage';
import ServiceManagementPage from './pages/ServiceManagementPage';
// Booking pages
import {
  CustomerBookingsPage,
  ProviderBookingsPage,
  BookingDetailPage,
  ProviderAvailabilityPage,
  BookServicePage
} from './pages/booking';
import TrackBookingPage from './pages/booking/TrackBookingPage';
// Customer pages
import CustomerStatsPage from './pages/customer/CustomerStatsPage';
import {
  ProfilePage,
  FavoritesPage,
  RewardsPage
} from './pages/customer';



const AccountSuspended = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6">Account Suspended</h1>
      <p className="text-gray-600 text-center">Your account has been suspended. Please contact support.</p>
    </div>
  </div>
);

const ProviderVerificationPending = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6">Verification Pending</h1>
      <p className="text-gray-600 text-center">Your provider account is under review. We'll notify you once it's approved.</p>
    </div>
  </div>
);

const NotFound = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6">404 - Page Not Found</h1>
      <p className="text-gray-600 text-center">The page you're looking for doesn't exist.</p>
    </div>
  </div>
);

function App() {
  const { initialize, isInitialized } = useAuthStore();
  useBackButton();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  return (
    <div className="App">
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginForm />
            </PublicRoute>
          } 
        />
        
        <Route 
          path="/register/customer" 
          element={
            <PublicRoute>
              <CustomerRegistration />
            </PublicRoute>
          } 
        />
        
        <Route 
          path="/register/provider" 
          element={
            <PublicRoute>
              <ProviderRegistration />
            </PublicRoute>
          } 
        />

        {/* Password Management Routes */}
        <Route 
          path="/forgot-password" 
          element={
            <PublicRoute redirectAuthenticated={false}>
              <ForgotPassword />
            </PublicRoute>
          } 
        />
        
        <Route 
          path="/reset-password/:token" 
          element={
            <PublicRoute redirectAuthenticated={false}>
              <ResetPassword />
            </PublicRoute>
          } 
        />

        {/* Email Verification Routes */}
        <Route 
          path="/verify-email/:token" 
          element={
            <PublicRoute redirectAuthenticated={false}>
              <EmailVerification />
            </PublicRoute>
          } 
        />

        {/* Search Routes */}
        <Route 
          path="/search" 
          element={<SearchPage />} 
        />
        
        <Route 
          path="/services" 
          element={<SearchPage />} 
        />

        {/* Service Detail Route */}
        <Route
          path="/services/:id"
          element={<ServiceDetailPage />}
        />

        {/* Category Detail Route */}
        <Route
          path="/category/:slug"
          element={<CategoryPage />}
        />

        {/* Subcategory Service Route (Master Service Template) */}
        <Route
          path="/service/:categorySlug/:subcategorySlug"
          element={<SubcategoryServicePage />}
        />

        {/* Provider Detail Route */}
        <Route
          path="/provider/:id"
          element={<ProviderDetailPage />}
        />

        {/* Book Service Route (public - supports guest checkout) */}
        <Route
          path="/book/:serviceId"
          element={<BookServicePage />}
        />

        {/* Order Tracking Routes (public) */}
        <Route
          path="/track"
          element={<TrackBookingPage />}
        />
        <Route
          path="/track/:bookingNumber"
          element={<TrackBookingPage />}
        />

        {/* Status/Development Routes */}
        <Route 
          path="/status" 
          element={<StatusDashboard />} 
        />

        {/* Authentication Status Routes */}
        <Route 
          path="/verify-email-required" 
          element={
            <ProtectedRoute requireAuth={true} requireEmailVerified={false}>
              <EmailVerificationRequired />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/account-suspended" 
          element={<AccountSuspended />} 
        />
        
        <Route 
          path="/provider/verification-pending" 
          element={<ProviderVerificationPending />} 
        />

        {/* Protected Customer Routes */}
        <Route
          path="/customer/dashboard"
          element={
            <CustomerRoute>
              <CustomerStatsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/bookings"
          element={
            <CustomerRoute>
              <CustomerBookingsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/bookings/:bookingId"
          element={
            <CustomerRoute>
              <BookingDetailPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/profile"
          element={
            <CustomerRoute>
              <ProfilePage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/favorites"
          element={
            <CustomerRoute>
              <FavoritesPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/rewards"
          element={
            <CustomerRoute>
              <RewardsPage />
            </CustomerRoute>
          }
        />

        {/* Protected Provider Routes */}
        <Route 
          path="/provider/dashboard" 
          element={
            <ProviderRoute>
              <ProviderDashboard />
            </ProviderRoute>
          } 
        />
        
        <Route
          path="/provider/services"
          element={
            <ProviderRoute>
              <ServiceManagementPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/bookings"
          element={
            <ProviderRoute>
              <ProviderBookingsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/bookings/:bookingId"
          element={
            <ProviderRoute>
              <BookingDetailPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/availability"
          element={
            <ProviderRoute>
              <ProviderAvailabilityPage />
            </ProviderRoute>
          }
        />

        {/* Protected Admin Routes */}
        <Route 
          path="/admin/dashboard" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />

        {/* Default Route - Homepage */}
        <Route
          path="/"
          element={<HomePage />}
        />

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

// Component to handle default redirects based on user role
const RedirectToDashboard = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const dashboardPath = user.role === 'admin' 
    ? '/admin/dashboard' 
    : user.role === 'provider' 
      ? '/provider/dashboard' 
      : '/customer/dashboard';

  return <Navigate to={dashboardPath} replace />;
};

export default App;