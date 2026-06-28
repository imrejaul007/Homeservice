import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { fetchMaintenanceStatus, type MaintenanceStatus } from '../../services/platformApi';
import MaintenancePage from '../../pages/MaintenancePage';

const POLL_MS = 60_000;

const ALLOWED_PATHS = [
  '/maintenance',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin',
];

function isAllowedDuringMaintenance(pathname: string): boolean {
  return ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const pathnameRef = useRef(location.pathname);
  const userRoleRef = useRef(user?.role);

  pathnameRef.current = location.pathname;
  userRoleRef.current = user?.role;

  // Poll maintenance status on a stable interval (not on every route/user change)
  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const next = await fetchMaintenanceStatus();
        if (!cancelled) {
          setStatus(next);
        }
      } catch {
        // Fail open — do not block users if status endpoint is down
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    loadStatus();
    const id = setInterval(loadStatus, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Handle redirects when maintenance state or route changes
  useEffect(() => {
    if (!status) return;

    const isAdmin = userRoleRef.current === 'admin';
    const pathname = pathnameRef.current;
    const onMaintenanceRoute = pathname === '/maintenance';

    if (status.maintenanceMode && !isAdmin && !isAllowedDuringMaintenance(pathname)) {
      if (!onMaintenanceRoute) {
        navigate('/maintenance', { replace: true, state: { from: pathname } });
      }
    } else if (!status.maintenanceMode && onMaintenanceRoute) {
      navigate('/', { replace: true });
    }
  }, [status, location.pathname, user?.role, navigate]);

  if (checking && !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nilin-blush/20">
        <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const maintenanceActive = Boolean(status?.maintenanceMode);

  if (maintenanceActive && !isAdmin) {
    if (location.pathname === '/maintenance') {
      return <MaintenancePage status={status!} />;
    }
    if (!isAllowedDuringMaintenance(location.pathname)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-nilin-blush/20">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
