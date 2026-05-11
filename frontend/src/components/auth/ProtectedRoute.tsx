import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

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
  fallback = <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
}) => {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    isInitialized, 
    initialize 
  } = useAuthStore();
  
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Show loading while initializing
  if (!isInitialized || isLoading) {
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

  // User must be authenticated from this point
  if (!user) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // ✅ EMAIL VERIFICATION DISABLED - Comment out email verification check
  // if (requireEmailVerified && !user.isEmailVerified) {
  //   return (
  //     <Navigate
  //       to="/verify-email-required"
  //       state={{ from: location.pathname }}
  //       replace
  //     />
  //   );
  // }

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
  const { user, providerProfile } = useAuthStore();
  
  // Check provider verification status
  if (requireVerification && user?.role === 'provider' && providerProfile) {
    if (providerProfile.verificationStatus.overall === 'pending') {
      return (
        <Navigate
          to="/provider/verification-pending"
          replace
        />
      );
    }

    if (providerProfile.verificationStatus.overall === 'rejected') {
      return (
        <Navigate
          to="/provider/verification-rejected"
          replace
        />
      );
    }

    if (providerProfile.verificationStatus.overall === 'suspended') {
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
      requireEmailVerified={false}
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

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect authenticated users if required
  if (redirectAuthenticated && isAuthenticated && user) {
    const defaultRedirect = redirectTo || (
      user.role === 'admin'
        ? '/admin/dashboard'
        : user.role === 'provider'
          ? '/provider/dashboard'
          : '/'
    );

    return <Navigate to={defaultRedirect} replace />;
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
      if (!requireVerification) return true;
      // ✅ EMAIL VERIFICATION DISABLED - Always return true
      // return user.isEmailVerified;
      return true;
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