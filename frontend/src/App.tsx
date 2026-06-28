import React, { useEffect, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useBackButton } from './hooks/useBackButton';
import { useCapacitor } from './hooks/useCapacitor';
import { ToastProvider } from './components/common/Toast';
import { OfflineBanner } from './components/common/OfflineBanner';
import { MaintenanceGuard } from './components/common/MaintenanceGuard';
import { PlatformConfigProvider, usePlatformConfig } from './components/common/PlatformConfigProvider';
import { AppShell } from './components/mobile/AppShell';
import { SearchModalProvider, useSearchModal } from './context/SearchModalContext';
import { GlobalLoadingOverlay } from './components/common/GlobalLoadingOverlay';
import { usePageLoading } from './hooks/usePageLoading';
import { useDeferredMount } from './hooks/useDeferredMount';

const FloatingChatWidget = lazy(() => import('./components/chat/FloatingChatWidget'));
const SearchModal = lazy(() => import('./components/search/SearchModal'));

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
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboardEnhanced'));
const StatsView = lazy(() => import('./components/dashboard/StatsView'));
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
const ProviderMetricsDashboard = lazy(() => import('./pages/admin/ProviderMetricsDashboard'));
const ChatbotBuilderPage = lazy(() => import('./pages/admin/ChatbotBuilderPage'));
const AnalyticsDashboard = lazy(() => import('./pages/admin/AnalyticsDashboard'));
const ExecutiveDashboard = lazy(() => import('./pages/admin/ExecutiveDashboard'));
const ProviderDashboard = lazy(() => import('./components/dashboard/ProviderDashboard'));
const SearchAnalyticsDashboard = lazy(() => import('./pages/admin/SearchAnalyticsDashboard'));
const CustomReports = lazy(() => import('./pages/admin/CustomReports'));
const FraudReport = lazy(() => import('./pages/admin/FraudReport'));
const AnomalyDashboard = lazy(() => import('./pages/admin/AnomalyDashboard'));
const SLAReport = lazy(() => import('./pages/admin/SLAReport'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const BookingManagement = lazy(() => import('./pages/admin/BookingManagement'));
const DisputeCenter = lazy(() => import('./pages/admin/DisputeCenter'));
const RefundManagement = lazy(() => import('./pages/admin/RefundManagement'));
const BundleManagement = lazy(() => import('./pages/admin/BundleManagement'));
const OfferAnalyticsPage = lazy(() => import('./pages/admin/OfferAnalyticsPage'));
const HeroSlideManager = lazy(() => import('./pages/admin/HeroSlideManager'));
const LaunchDashboard = lazy(() => import('./pages/admin/LaunchDashboard'));
const PermissionManager = lazy(() => import('./pages/admin/PermissionManager'));
const CustomerManagement = lazy(() => import('./pages/admin/CustomerManagement'));
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ExperiencesPage = lazy(() => import('./pages/ExperiencesPage'));
const TrendingPage = lazy(() => import('./pages/TrendingPage'));
const CuratedTrendingManagement = lazy(() => import('./pages/admin/CuratedTrendingManagement'));
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
const BookPackagePage = lazy(() => import('./pages/booking/BookPackagePage'));
const ProviderBookingDetailPage = lazy(() => import('./pages/provider/BookingDetailPage'));
const TrackBookingPage = lazy(() => import('./pages/booking/TrackBookingPage'));
const CustomerStatsPage = lazy(() => import('./pages/customer/CustomerStatsPage'));
const CustomerAnalyticsPage = lazy(() => import('./pages/customer/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'));
const FavoritesPage = lazy(() => import('./pages/customer/FavoritesPage'));
const WishlistPage = lazy(() => import('./pages/customer/WishlistPage'));
const RewardsPage = lazy(() => import('./pages/customer/RewardsPage'));
const AddressesPage = lazy(() => import('./pages/customer/AddressesPage'));
const PaymentMethodsPage = lazy(() => import('./pages/customer/PaymentMethodsPage'));
const NotificationsPage = lazy(() => import('./pages/customer/NotificationsPage'));
const NotificationSettings = lazy(() => import('./pages/customer/NotificationSettings'));
const WalletPage = lazy(() => import('./pages/customer/WalletPage'));
const WalletTransactionsPage = lazy(() => import('./pages/customer/WalletTransactionsPage'));
const BookServicesPage = lazy(() => import('./pages/customer/BookServicesPage'));
const ReviewsPage = lazy(() => import('./pages/customer/ReviewsPage'));
const MessagesPage = lazy(() => import('./pages/customer/MessagesPage'));
const NewMessagePage = lazy(() => import('./pages/customer/NewMessagePage'));
const MyClaimsPage = lazy(() => import('./pages/customer/MyClaimsPage'));
const CustomerDisputeDetailPage = lazy(() => import('./pages/customer/CustomerDisputeDetailPage'));
const AIAssistantPage = lazy(() => import('./pages/customer/AIAssistantPage'));
const GDPRExportPage = lazy(() => import('./pages/customer/GDPRExport'));
const PrivacySettings = lazy(() => import('./pages/PrivacySettings'));
const ProviderProfilePage = lazy(() => import('./pages/provider/ProviderProfilePage'));
const ProviderPortfolioPage = lazy(() => import('./pages/provider/ProviderPortfolioPage'));
const ProviderAnalyticsPage = lazy(() => import('./pages/provider/ProviderAnalyticsPage'));
const ProviderEarningsPage = lazy(() => import('./pages/provider/ProviderEarningsPage'));
const ProviderVerificationPage = lazy(() => import('./pages/provider/ProviderVerificationPage'));
const ProviderReviewsPage = lazy(() => import('./pages/provider/ProviderReviewsPage'));
const AdsPage = lazy(() => import('./pages/provider/AdsPage'));
const ProviderSettingsPage = lazy(() => import('./pages/provider/ProviderSettingsPage'));
const SubscriptionPlansPage = lazy(() => import('./pages/SubscriptionPlans'));
const SubscriptionManagementPage = lazy(() => import('./pages/customer/SubscriptionManagementPage'));

const ManagedServicesPage = lazy(() => import('./pages/provider/ManagedServicesPage'));
const MyBundlesPage = lazy(() => import('./pages/provider/MyBundlesPage'));
const BundleAnalyticsPage = lazy(() => import('./pages/provider/BundleAnalyticsPage'));
const EarningsReport = lazy(() => import('./pages/provider/EarningsReport'));
const ProviderInsightsRedirect = lazy(() => import('./pages/provider/ProviderInsightsRedirect'));
const AvailabilityPage = lazy(() => import('./pages/provider/AvailabilityPage'));
const ServiceAvailabilityPage = lazy(() => import('./pages/provider/ServiceAvailabilityPage'));
const ProviderCalendarPage = lazy(() => import('./pages/provider/ProviderCalendarPage'));
const OperationsDashboard = lazy(() => import('./pages/provider/OperationsDashboard'));
const PayoutDashboard = lazy(() => import('./pages/provider/PayoutDashboard'));
const SuperAppPage = lazy(() => import('./pages/customer/SuperAppPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const OfferDetailPage = lazy(() => import('./pages/OfferDetailPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const CookiesPage = lazy(() => import('./pages/CookiesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const SupportHubPage = lazy(() => import('./pages/customer/SupportHubPage'));
const SupportTicketDetailPage = lazy(() => import('./pages/customer/SupportTicketDetailPage'));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage'));
const PackagesPage = lazy(() => import('./pages/PackagesPage'));
const PackageDetailPage = lazy(() => import('./pages/PackageDetailPage'));
const PackageComparisonPage = lazy(() => import('./pages/PackageComparisonPage'));
const PaymentPage = lazy(() => import('./pages/booking/PaymentPage'));
const Demo = lazy(() => import('./pages/Demo'));

import {
  ProtectedRoute,
  CustomerRoute,
  ProviderRoute,
  AdminRoute,
  PublicRoute
} from './components/auth/ProtectedRoute';

// Loading spinner for Suspense fallback - uses NILIN theme
const LoadingSpinner = () => null; // Global loading overlay handles loading state


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

const FaqGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = usePlatformConfig();
  if (!config.enableFAQ) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

/** Demo/investor experience — disabled in production unless explicitly enabled */
const DemoGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDemoEnabled =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';
  if (!isDemoEnabled) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const DeferredFloatingChatWidget: React.FC = () => {
  const ready = useDeferredMount();
  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <FloatingChatWidget
        botName="NILIN Assistant"
        welcomeMessage="Hi there! How can I help you today?"
      />
    </Suspense>
  );
};

// Search Modal Wrapper — load after idle or when opened
const SearchModalWrapper: React.FC = () => {
  const { isOpen, initialQuery, close } = useSearchModal();
  const deferredReady = useDeferredMount();

  if (!deferredReady && !isOpen) return null;

  return (
    <Suspense fallback={null}>
      <SearchModal isOpen={isOpen} onClose={close} initialQuery={initialQuery} />
    </Suspense>
  );
};

function App() {
  const { initialize, isInitialized } = useAuthStore();
  const { isCapacitor, isMobile } = useCapacitor();
  useBackButton();
  // Enable global page loading on route changes
  usePageLoading();

  // FIX: Memoize platform detection to prevent re-computation on every render
  const isMobilePlatform = useMemo(() => isMobile || isCapacitor, [isMobile, isCapacitor]);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // Wrap app content in AppShell on mobile devices
  const appContent = (
    <AppErrorBoundary>
      <ToastProvider>
        <PlatformConfigProvider>
          <SearchModalProvider>
            {/* Global Search Modal */}
            <SearchModalWrapper />
            {/* CRITICAL FIX: Global offline indicator */}
            <OfflineBanner autoHideDelay={3000} showCloseButton={true} />
            {/* Global Loading Overlay */}
            <GlobalLoadingOverlay />
            <MaintenanceGuard>
              <div className="App">
                <ScrollToTop />
                <Suspense fallback={null}>
                  <Routes>
        {/* Public Routes */}
        <Route
          path="/unsubscribe"
          element={
            <Suspense fallback={null}>
              <UnsubscribePage />
            </Suspense>
          }
        />

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

        {/* Service Packages Routes */}
        <Route
          path="/packages/compare"
          element={<PackageComparisonPage />}
        />
        <Route
          path="/packages/:id"
          element={<PackageDetailPage />}
        />
        <Route
          path="/packages"
          element={<PackagesPage />}
        />
        <Route
          path="/book-package/:packageId"
          element={<BookPackagePage />}
        />
        <Route
          path="/book-package"
          element={<BookPackagePage />}
        />

        {/* Experiences Route */}
        <Route
          path="/experiences"
          element={<ExperiencesPage />}
        />

        <Route
          path="/trending"
          element={<TrendingPage />}
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

        <Route
          path="/demo"
          element={
            <DemoGate>
              <Demo />
            </DemoGate>
          }
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
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/faq" element={<FaqGate><FAQPage /></FaqGate>} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpPage />} />

        {/* Protected Customer Routes */}
        <Route
          path="/customer"
          element={<Navigate to="/customer/dashboard" replace />}
        />

        <Route
          path="/customer/dashboard"
          element={
            <CustomerRoute>
              <CustomerDashboard />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/analytics"
          element={
            <CustomerRoute>
              <CustomerAnalyticsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/stats"
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
          path="/customer/bookings/:bookingId/payment"
          element={
            <CustomerRoute>
              <PaymentPage />
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
          path="/customer/wishlist"
          element={
            <CustomerRoute>
              <WishlistPage />
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
          path="/customer/my-claims/:disputeId"
          element={
            <CustomerRoute>
              <CustomerDisputeDetailPage />
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
          path="/customer/ai-assistant"
          element={
            <CustomerRoute>
              <AIAssistantPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/gdpr"
          element={
            <CustomerRoute>
              <GDPRExportPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/data-export"
          element={
            <CustomerRoute>
              <GDPRExportPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/privacy-settings"
          element={
            <CustomerRoute>
              <PrivacySettings />
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
          path="/provider/notifications"
          element={
            <ProviderRoute>
              <NotificationsPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/notifications"
          element={<Navigate to="/customer/notifications" replace />}
        />

        <Route
          path="/customer/notification-settings"
          element={
            <CustomerRoute>
              <NotificationSettings />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/wallet"
          element={
            <CustomerRoute>
              <WalletPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/transactions"
          element={
            <CustomerRoute>
              <WalletTransactionsPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/customer/referrals"
          element={<Navigate to="/customer/profile?tab=referral" replace />}
        />

        <Route
          path="/customer/book-services"
          element={
            <CustomerRoute>
              <BookServicesPage />
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

        {/* Customer Support Hub */}
        <Route
          path="/customer/support"
          element={
            <CustomerRoute>
              <SupportHubPage />
            </CustomerRoute>
          }
        />
        <Route
          path="/customer/support/tickets/:ticketId"
          element={
            <CustomerRoute>
              <SupportTicketDetailPage />
            </CustomerRoute>
          }
        />

        {/* Customer Messages Routes */}
        <Route
          path="/customer/messages"
          element={
            <CustomerRoute>
              <MessagesPage />
            </CustomerRoute>
          }
        />
        <Route
          path="/customer/messages/new"
          element={
            <CustomerRoute>
              <NewMessagePage />
            </CustomerRoute>
          }
        />

        {/* Provider Messages Route */}
        <Route
          path="/provider/messages"
          element={
            <ProviderRoute>
              <MessagesPage />
            </ProviderRoute>
          }
        />

        {/* Subscription Management Routes */}
        <Route
          path="/subscriptions"
          element={
            <CustomerRoute>
              <SubscriptionPlansPage />
            </CustomerRoute>
          }
        />

        <Route
          path="/subscriptions/manage"
          element={
            <CustomerRoute>
              <SubscriptionManagementPage />
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
            <ProviderRoute requireVerification={true}>
              <ServiceManagementPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/bookings"
          element={
            <ProviderRoute requireVerification={true}>
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
          path="/provider/service-availability"
          element={
            <ProviderRoute>
              <ServiceAvailabilityPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/calendar"
          element={
            <ProviderRoute>
              <ProviderCalendarPage />
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
            <ProviderRoute requireVerification={true}>
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
          path="/provider/change-password"
          element={
            <ProviderRoute>
              <ChangePassword />
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
          path="/provider/managed-services/:contractId"
          element={
            <ProviderRoute>
              <ManagedServicesPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/bundles"
          element={
            <ProviderRoute>
              <MyBundlesPage />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/bundles/:id/analytics"
          element={
            <ProviderRoute>
              <BundleAnalyticsPage />
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
              <ProviderInsightsRedirect />
            </ProviderRoute>
          }
        />

        <Route
          path="/provider/availability-alt"
          element={<Navigate to="/provider/availability" replace />}
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
            <ProviderRoute requireVerification={true}>
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
          path="/admin/curated-trending"
          element={
            <AdminRoute>
              <CuratedTrendingManagement />
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
        <Route
          path="/admin/providers/metrics"
          element={
            <AdminRoute>
              <ProviderMetricsDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/analytics"
          element={
            <AdminRoute>
              <AnalyticsDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/executive"
          element={
            <AdminRoute>
              <ExecutiveDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/search-analytics"
          element={
            <AdminRoute>
              <SearchAnalyticsDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/custom-reports"
          element={
            <AdminRoute>
              <CustomReports />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/fraud"
          element={
            <AdminRoute>
              <FraudReport />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/anomalies"
          element={
            <AdminRoute>
              <AnomalyDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/sla"
          element={
            <AdminRoute>
              <SLAReport />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/audit"
          element={
            <AdminRoute>
              <AuditLogPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/bookings"
          element={
            <AdminRoute>
              <BookingManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/disputes"
          element={
            <AdminRoute>
              <DisputeCenter />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/refunds"
          element={
            <AdminRoute>
              <RefundManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/bundles"
          element={
            <AdminRoute>
              <BundleManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/offers-analytics"
          element={
            <AdminRoute>
              <OfferAnalyticsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/hero-slides"
          element={
            <AdminRoute>
              <HeroSlideManager />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/launch"
          element={
            <AdminRoute>
              <LaunchDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/permissions"
          element={
            <AdminRoute>
              <PermissionManager />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/customers"
          element={
            <AdminRoute>
              <CustomerManagement />
            </AdminRoute>
          }
        />

        {/* Default Route - Homepage */}
        <Route
          path="/"
          element={<HomePage />}
        />

        {/* Admin Support Dashboard */}
        <Route
          path="/admin/support"
          element={
            <AdminRoute>
              <AdminSupportPage />
            </AdminRoute>
          }
        />

        {/* Chatbot Builder */}
        <Route
          path="/admin/chatbot-builder"
          element={
            <AdminRoute>
              <ChatbotBuilderPage />
            </AdminRoute>
          }
        />

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
        </Routes>

        <DeferredFloatingChatWidget />
              </Suspense>
              </div>
              </MaintenanceGuard>
            </SearchModalProvider>
          </PlatformConfigProvider>
        </ToastProvider>
      </AppErrorBoundary>
  );

  // Wrap with AppShell on mobile devices (Capacitor or small screens)
  // FIX: Use memoized value instead of recomputing on every render
  if (isMobilePlatform) {
    return <AppShell>{appContent}</AppShell>;
  }

  return appContent;
}

export default App;
