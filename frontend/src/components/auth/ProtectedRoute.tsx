import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';

const enforceEmailVerification = import.meta.env.VITE_ENFORCE_EMAIL_VERIFICATION === 'true';

// NILIN-themed loading spinner
const NilinLoader = () => (
  <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#FDFBF9' }}>
    <div
      className="animate-spin rounded-full"
      style={{
        width: 32,
        height: 32,
        borderWidth: 3,
        borderStyle: 'solid',
        borderColor: '#F5E6E0',
        borderTopColor: '#E8B4A8'
      }}
    />
  </div>
);

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireEmailVerified?: boolean;
  allowedRoles?: Array<'customer' | 'provider' | 'admin'>;
  requireActiveAccount?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireEmailVerified = false,
  allowedRoles,
  requireActiveAccount = true,
  redirectTo = '/login',
  fallback = <NilinLoader />
}) => {
  const {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    initialize
  } = useAuthStore();

  const location = useLocation();
  const [tokenChecked, setTokenChecked] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (!isAuthenticated) {
      setTokenChecked(true);
      setTokenValid(true);
      return;
    }
    setTokenValid(authService.isTokenValid());
    setTokenChecked(true);
  }, [isAuthenticated, user]);

  // Show loading while initializing or checking token validity
  if (!isInitialized || isLoading || (isAuthenticated && !tokenChecked)) {
    return <>{fallback}</>;
  }

  // Handle authentication requirement
  if (requireAuth && !isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // If not requiring auth but user is authenticated, proceed
  if (!requireAuth) {
    return <>{children}</>;
  }

  // User must be authenticated with a valid token from this point
  if (!user || !tokenValid) {
    useAuthStore.getState().clearAuth();
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname, reason: 'session_expired', message: 'Your session has expired. Please sign in again.' }}
        replace
      />
    );
  }

  const shouldRequireEmailVerification = requireEmailVerified || enforceEmailVerification;
  if (shouldRequireEmailVerification && !user.isEmailVerified) {
    return (
      <Navigate
        to="/verify-email-required"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Check account status requirement
  if (requireActiveAccount && user.accountStatus !== 'active' && user.accountStatus !== 'pending_verification') {
    let redirectPath = '/account-suspended';
    
    if (user.accountStatus === 'deactivated') {
      redirectPath = '/account-deactivated';
    }
    
    return (
      <Navigate 
        to={redirectPath} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      const defaultDashboard = user.role === 'admin' 
        ? '/admin/dashboard' 
        : user.role === 'provider' 
          ? '/provider/dashboard' 
          : '/customer/dashboard';
      
      return (
        <Navigate 
          to={defaultDashboard} 
          replace 
        />
      );
    }
  }

  // All checks passed, render children
  return <>{children}</>;
};

// Specialized route components
export const CustomerRoute: React.FC<Omit<ProtectedRouteProps, 'allowedRoles'>> = (props) => (
  <ProtectedRoute {...props} allowedRoles={['customer']} />
);

export const ProviderRoute: React.FC<Omit<ProtectedRouteProps, 'allowedRoles'> & { requireVerification?: boolean }> = ({
  requireVerification = false,
  ...props
}) => {
  const { user, providerProfile, isLoading, isInitialized } = useAuthStore();

  // Show loading while auth is initializing
  if (!isInitialized || isLoading) {
    return (
      <NilinLoader />
    );
  }

  // Check provider verification status - with null safety check
  if (requireVerification && user?.role === 'provider' && providerProfile) {
    if (providerProfile.verificationStatus?.overall === 'pending') {
      return (
        <Navigate
          to="/provider/verification-pending"
          replace
        />
      );
    }

    if (providerProfile.verificationStatus?.overall === 'rejected') {
      return (
        <Navigate
          to="/provider/verification-rejected"
          replace
        />
      );
    }

    if (providerProfile.verificationStatus?.overall === 'suspended') {
      return (
        <Navigate
          to="/provider/suspended"
          replace
        />
      );
    }
  }

  return (
    <ProtectedRoute
      {...props}
      allowedRoles={['provider']}
      requireEmailVerified={enforceEmailVerification}
    />
  );
};

export const AdminRoute: React.FC<Omit<ProtectedRouteProps, 'allowedRoles'>> = (props) => (
  <ProtectedRoute 
    {...props} 
    allowedRoles={['admin']} 
    requireEmailVerified={false}
  />
);

export const PublicRoute: React.FC<{
  children: React.ReactNode;
  redirectAuthenticated?: boolean;
  redirectTo?: string;
}> = ({ 
  children, 
  redirectAuthenticated = true, 
  redirectTo 
}) => {
  const { isAuthenticated, user, isInitialized, initialize } = useAuthStore();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <NilinLoader />
    );
  }

  // Redirect authenticated users if required
  if (redirectAuthenticated && isAuthenticated && user) {
    if (!authService.isTokenValid()) {
      useAuthStore.getState().clearAuth();
      return <>{children}</>;
    }

    const stateReturn =
      (location.state as { returnTo?: string; from?: string } | null)?.returnTo ||
      (location.state as { from?: string } | null)?.from;
    const queryReturn = searchParams.get('returnTo');
    // SECURITY FIX: Prevent open redirect vulnerability
    // Must start with '/' but NOT '//' to prevent protocol-relative attacks like //attacker.com
    const safeReturn =
      queryReturn?.startsWith('/') && !queryReturn.startsWith('//')
        ? queryReturn
        : stateReturn?.startsWith('/') && !stateReturn.startsWith('//')
          ? stateReturn
          : null;

    const defaultRedirect = redirectTo || (
      user.role === 'admin'
        ? '/admin/dashboard'
        : user.role === 'provider'
          ? '/provider/dashboard'
          : '/customer/dashboard'
    );

    const destination =
      user.role === 'customer' && safeReturn ? safeReturn : defaultRedirect;

    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};

// HOC for protecting components
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) => {
  return (props: P) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

// Hook for checking access within components
export const useRouteAccess = () => {
  const { user, isAuthenticated } = useAuthStore();

  return {
    canAccess: (roles?: Array<'customer' | 'provider' | 'admin'>) => {
      if (!isAuthenticated || !user) return false;
      if (!roles || roles.length === 0) return true;
      return roles.includes(user.role);
    },
    
    canAccessProvider: (requireVerification = false) => {
      if (!isAuthenticated || !user || user.role !== 'provider') return false;
      if (enforceEmailVerification && !user.isEmailVerified) return false;
      if (!requireVerification) return true;
      return user.isEmailVerified;
    },
    
    isAdmin: () => isAuthenticated && user?.role === 'admin',
    isProvider: () => isAuthenticated && user?.role === 'provider',
    isCustomer: () => isAuthenticated && user?.role === 'customer',
    
    getDefaultDashboard: () => {
      if (!user) return '/login';
      return user.role === 'admin' 
        ? '/admin/dashboard' 
        : user.role === 'provider' 
          ? '/provider/dashboard' 
          : '/customer/dashboard';
    }
  };
};

export default ProtectedRoute;