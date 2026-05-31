import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useBackButton } from './hooks/useBackButton';
import { useCapacitor } from './hooks/useCapacitor';
import { ToastProvider } from './components/common/Toast';
import { OfflineBanner } from './components/common/OfflineBanner';
import { AppShell } from './components/mobile/AppShell';

// =============================================================================
// Error Boundary Component
// =============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('App Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-gray-100 rounded-lg p-3 mb-4 text-xs">
                <summary className="font-semibold cursor-pointer">Error Details</summary>
                <pre className="mt-2 overflow-auto">{this.state.error.toString()}</pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Lazy load all route components for code splitting
const StatusDashboard = lazy(() => import('./components/StatusDashboard'));
const CustomerRegistration = lazy(() => import('./components/auth/CustomerRegistration'));
const ProviderRegistration = lazy(() => import('./components/auth/ProviderRegistration'));
const LoginForm = lazy(() => import('./components/auth/LoginForm'));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const EmailVerification = lazy(() => import('./components/auth/EmailVerification'));
const EmailVerificationRequired = lazy(() => import('./components/auth/EmailVerificationRequired'));
const ChangePassword = lazy(() => import('./components/auth/ChangePassword'));
const CustomerDashboard = lazy(() => import('./components/dashboard/CustomerDashboard'));
const StatsView = lazy(() => import('./components/dashboard/StatsView'));
const ProviderDashboard = lazy(() => import('./components/dashboard/ProviderDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminSettings = lazy(() => import('./components/dashboard/AdminSettings'));
const AdminReports = lazy(() => import('./components/dashboard/AdminReports'));
const AdminOffersManagement = lazy(() => import('./components/dashboard/AdminOffersManagement'));
const AdminCategoryView = lazy(() => import('./pages/admin/AdminCategoryView'));
const CategoryManagement = lazy(() => import('./pages/admin/CategoryManagement'));
const ReviewModeration = lazy(() => import('./pages/admin/ReviewModeration'));
const CouponManagement = lazy(() => import('./pages/admin/CouponManagement'));
const ApiKeyManagement = lazy(() => import('./pages/admin/ApiKeyManagement'));
const MaintenanceMode = lazy(() => import('./pages/admin/MaintenanceMode'));
const PayoutManagement = lazy(() => import('./pages/admin/PayoutManagement'));
const ChurnReport = lazy(() => import('./pages/admin/ChurnReport'));
const ProviderManagement = lazy(() => import('./pages/admin/ProviderManagement'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ExperiencesPage = lazy(() => import('./pages/ExperiencesPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const SubcategoryServicePage = lazy(() => import('./pages/SubcategoryServicePage'));
const ProviderDetailPage = lazy(() => import('./pages/ProviderDetailPage'));
const ServiceManagementPage = lazy(() => import('./pages/ServiceManagementPage'));
const CustomerBookingsPage = lazy(() => import('./pages/booking/CustomerBookingsPage'));
const ProviderBookingsPage = lazy(() => import('./pages/booking/ProviderBookingsPage'));
const BookingDetailPage = lazy(() => import('./pages/booking/BookingDetailPage'));
const ProviderAvailabilityPage = lazy(() => import('./pages/booking/ProviderAvailabilityPage'));
const BookServicePage = lazy(() => import('./pages/booking/BookServicePage'));
const ProviderBookingDetailPage = lazy(() => import('./pages/provider/BookingDetailPage'));
const TrackBookingPage = lazy(() => import('./pages/booking/TrackBookingPage'));
const CustomerStatsPage = lazy(() => import('./pages/customer/CustomerStatsPage'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'));
const FavoritesPage = lazy(() => import('./pages/customer/FavoritesPage'));
const RewardsPage = lazy(() => import('./pages/customer/RewardsPage'));
const AddressesPage = lazy(() => import('./pages/customer/AddressesPage'));
const PaymentMethodsPage = lazy(() => import('./pages/customer/PaymentMethodsPage'));
const NotificationsPage = lazy(() => import('./pages/customer/NotificationsPage'));
const ReviewsPage = lazy(() => import('./pages/customer/ReviewsPage'));
const MyClaimsPage = lazy(() => import('./pages/customer/MyClaimsPage'));
const ProviderProfilePage = lazy(() => import('./pages/provider/ProviderProfilePage'));
const ProviderPortfolioPage = lazy(() => import('./pages/provider/ProviderPortfolioPage'));
const ProviderAnalyticsPage = lazy(() => import('./pages/provider/ProviderAnalyticsPage'));
const ProviderEarningsPage = lazy(() => import('./pages/provider/ProviderEarningsPage'));
const ProviderVerificationPage = lazy(() => import('./pages/provider/ProviderVerificationPage'));
const ProviderReviewsPage = lazy(() => import('./pages/provider/ProviderReviewsPage'));
const AdsPage = lazy(() => import('./pages/provider/AdsPage'));
const ProviderSettingsPage = lazy(() => import('./pages/provider/ProviderSettingsPage'));

const ManagedServicesPage = lazy(() => import('./pages/provider/ManagedServicesPage'));
const EarningsReport = lazy(() => import('./pages/provider/EarningsReport'));
const InsightsDashboard = lazy(() => import('./pages/provider/InsightsDashboard'));
const AvailabilityPage = lazy(() => import('./pages/provider/AvailabilityPage'));
const OperationsDashboard = lazy(() => import('./pages/provider/OperationsDashboard'));
const PayoutDashboard = lazy(() => import('./pages/provider/PayoutDashboard'));
const SuperAppPage = lazy(() => import('./pages/customer/SuperAppPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const OfferDetailPage = lazy(() => import('./pages/OfferDetailPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));

import {
  ProtectedRoute,
  CustomerRoute,
  ProviderRoute,
  AdminRoute,
  PublicRoute
} from './components/auth/ProtectedRoute';

// Loading spinner for Suspense fallback
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);



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

const ProviderVerificationRejected = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6 text-red-600">Verification Rejected</h1>
      <p className="text-gray-600 text-center mb-4">Your provider application has been rejected.</p>
      <p className="text-gray-500 text-center text-sm">Please contact support for more information or to resubmit your application.</p>
    </div>
  </div>
);

const ProviderSuspended = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6 text-orange-600">Account Suspended</h1>
      <p className="text-gray-600 text-center mb-4">Your provider account has been suspended.</p>
      <p className="text-gray-500 text-center text-sm">Please contact support to resolve this issue.</p>
    </div>
  </div>
);

const AccountDeactivated = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-600">Account Deactivated</h1>
      <p className="text-gray-600 text-center mb-4">Your account has been deactivated.</p>
      <p className="text-gray-500 text-center text-sm">Please contact support to reactivate your account.</p>
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

const Unauthorized = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-3m-4 0V9a2 2 0 012-2h2a2 2 0 012 2v2m-6 5v6m4-6v6" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
      <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
      <a
        href="/"
        className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Homepage
      </a>
    </div>
  </div>
);

function App() {
  const { initialize, isInitialized } = useAuthStore();
  const { isCapacitor, isMobile } = useCapacitor();
  useBackButton();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // Wrap app content in AppShell on mobile devices
  const appContent = (
    <AppErrorBoundary>
      <ToastProvider>
        {/* CRITICAL FIX: Global offline indicator */}
        <OfflineBanner autoHideDelay={3000} showCloseButton={true} />
        <div className="App">
          <ScrollToTop />
          <Suspense fallback={<LoadingSpinner />}>
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

        <Route
          path="/change-password"
          element={
            <ProtectedRoute requireAuth={true}>
              <ChangePassword />
            </ProtectedRoute>
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

        {/* Experiences Route */}
        <Route
          path="/experiences"
          element={<ExperiencesPage />}
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

        <Route
          path="/provider/verification-rejected"
          element={<ProviderVerificationRejected />}
        />

        <Route
          path="/provider/suspended"
          element={<ProviderSuspended />}
        />

        <Route
          path="/account-deactivated"
          element={<AccountDeactivated />}
        />

        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />

        {/* Static Pages */}
        <Route path="/about" element={<AboutPage />} />

        <Route path="/offer/:offerId" element={<OfferDetailPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpPage />} />

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
          path="/customer/superapp"
          element={
            <CustomerRoute>
              <SuperAppPage />
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

        <Route
          path="/customer/my-claims"
          element={
            <CustomerRoute>
              <MyClaimsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/addresses"
          element={
            <CustomerRoute>
              <AddressesPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/payment-methods"
          element={
            <CustomerRoute>
              <PaymentMethodsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/notifications"
          element={
            <CustomerRoute>
              <NotificationsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/reviews"
          element={
            <CustomerRoute>
              <ReviewsPage />
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
              <ProviderBookingDetailPage />
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

        <Route
          path="/provider/profile"
          element={
            <ProviderRoute>
              <ProviderProfilePage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/portfolio"
          element={
            <ProviderRoute>
              <ProviderPortfolioPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/analytics"
          element={
            <ProviderRoute>
              <ProviderAnalyticsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/earnings"
          element={
            <ProviderRoute>
              <ProviderEarningsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/verification"
          element={
            <ProviderRoute>
              <ProviderVerificationPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/reviews"
          element={
            <ProviderRoute>
              <ProviderReviewsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/ads"
          element={
            <ProviderRoute>
              <AdsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/settings"
          element={
            <ProviderRoute>
              <ProviderSettingsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/managed-services"
          element={
            <ProviderRoute>
              <ManagedServicesPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/earnings-report"
          element={
            <ProviderRoute>
              <EarningsReport />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/insights"
          element={
            <ProviderRoute>
              <InsightsDashboard />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/availability-alt"
          element={
            <ProviderRoute>
              <AvailabilityPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/operations"
          element={
            <ProviderRoute>
              <OperationsDashboard />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/payouts"
          element={
            <ProviderRoute>
              <PayoutDashboard />
            </ProviderRoute>
          }
        />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/category/view"
          element={
            <AdminRoute>
              <AdminCategoryView />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/categories"
          element={
            <AdminRoute>
              <CategoryManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminSettings />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <AdminRoute>
              <AdminReports />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/offers"
          element={
            <AdminRoute>
              <AdminOffersManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/reviews"
          element={
            <AdminRoute>
              <ReviewModeration />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/coupons"
          element={
            <AdminRoute>
              <CouponManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/api-keys"
          element={
            <AdminRoute>
              <ApiKeyManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/maintenance"
          element={
            <AdminRoute>
              <MaintenanceMode />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/churn"
          element={
            <AdminRoute>
              <ChurnReport />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/payouts"
          element={
            <AdminRoute>
              <PayoutManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/providers"
          element={
            <AdminRoute>
              <ProviderManagement />
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
        </Suspense>
        </div>
      </ToastProvider>
    </AppErrorBoundary>
  );

  // Wrap with AppShell on mobile devices (Capacitor or small screens)
  if (isMobile || isCapacitor) {
    return <AppShell>{appContent}</AppShell>;
  }

  return appContent;
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